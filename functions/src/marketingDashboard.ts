import * as functions from "firebase-functions";
import { BigQuery } from "@google-cloud/bigquery";

// Initialize Firebase Admin SDK (if not already done in index.ts)
// Consider moving initialization to index.ts if it's used elsewhere
// if (admin.apps.length === 0) {
//   admin.initializeApp();
// }

// Configuration
const projectId = "yelp-456821";
const datasetId = "marketing_dataset"; // Use the full ID provided by the user
const keyFilename = "./yelp-456821-939594800d2e.json"; // Ensure this file is deployed with functions

// Initialize BigQuery client
let bigquery: BigQuery;
try {
    bigquery = new BigQuery({
        projectId: projectId,
        keyFilename: keyFilename,
    });
    functions.logger.info("BigQuery client initialized successfully.");
} catch (error) {
    functions.logger.error("Failed to initialize BigQuery client:", error);
    // Handle initialization error appropriately
    // Maybe throw or define a fallback behavior
    throw new Error("Could not initialize BigQuery client.");
}


/**
 * Fetches aggregated data for the Marketing Dashboard from BigQuery.
 */
export const getMarketingData = functions.https.onCall(async (data, context) => {
    // Authentication check: Ensure the user is authenticated.
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "The function must be called while authenticated."
        );
    }

    // Authorization check: Ensure the user has the correct email.
    const allowedEmails = ["marketing@demo.com", "customerexperience@demo.com"];
    if (!context.auth.token.email || !allowedEmails.includes(context.auth.token.email)) {
        throw new functions.https.HttpsError(
            "permission-denied",
            "User does not have permission to access this data."
        );
    }

    functions.logger.info(`User ${context.auth.token.email} requesting marketing data.`);

    try {
        // Construct full table paths
        const factCustomerEngagementTable = `\`${projectId}.${datasetId}.FactCustomerEngagement\``;
        const dimDateTable = `\`${projectId}.${datasetId}.DimDate\``;
        const dimBusinessTable = `\`${projectId}.${datasetId}.DimBusiness\``;
        const dimUserTable = `\`${projectId}.${datasetId}.DimUser\``;


        // Define queries for different dashboard sections using the constructed table paths
        const queries = {
            avgStarsMonthly: `
                SELECT
                    EXTRACT(YEAR FROM d.full_date) AS year,
                    EXTRACT(MONTH FROM d.full_date) AS month,
                    AVG(f.stars) AS average_stars
                FROM ${factCustomerEngagementTable} AS f
                JOIN ${dimDateTable} AS d ON f.date_id = d.date_id
                GROUP BY year, month
                ORDER BY year, month;`,
            voteDistribution: `
                SELECT
                    SUM(useful_votes) AS total_useful,
                    SUM(funny_votes) AS total_funny,
                    SUM(cool_votes) AS total_cool
                FROM ${factCustomerEngagementTable};`,
            reviewsByState: `
                SELECT
                    b.state,
                    COUNT(f.review_id) AS review_count
                FROM ${factCustomerEngagementTable} AS f
                JOIN ${dimBusinessTable} AS b ON f.business_id = b.business_id
                WHERE b.state IS NOT NULL
                GROUP BY b.state
                ORDER BY review_count DESC
                LIMIT 10;`, // Limit for visualization
            topCategories: `
                WITH CategoriesUnnested AS (
                    SELECT
                        b.business_id,
                        -- Select the 'element' field from the unnested struct
                        category.element AS category_name 
                    FROM 
                        ${dimBusinessTable} AS b,
                        -- Unnest the 'list' field within the 'categories' struct
                        UNNEST(b.categories.list) AS category 
                    WHERE 
                        b.categories IS NOT NULL 
                        AND b.categories.list IS NOT NULL
                )
                SELECT
                    cu.category_name,
                    COUNT(DISTINCT f.review_id) AS review_count
                FROM 
                    ${factCustomerEngagementTable} AS f
                JOIN 
                    CategoriesUnnested cu ON f.business_id = cu.business_id
                WHERE 
                    cu.category_name IS NOT NULL AND cu.category_name != '' 
                GROUP BY 
                    cu.category_name
                ORDER BY 
                    review_count DESC
                LIMIT 10;`, // Limit for visualization
             userStats: `
                SELECT
                    AVG(u.average_stars) AS overall_avg_user_rating,
                    SUM(u.fans) AS total_fans,
                    SUM(u.compliment_count) AS total_compliments,
                    COUNT(u.user_id) AS total_users -- Example stat
                FROM ${dimUserTable} u;`
        };

        // Execute queries in parallel
        const results = await Promise.all(
            Object.entries(queries).map(async ([key, query]) => {
                functions.logger.info(`Executing query: ${key}`);
                const [rows] = await bigquery.query({ query });
                functions.logger.info(`Query ${key} returned ${rows.length} rows.`);
                return { [key]: rows };
            })
        );

        // Combine results into a single object
        const combinedResults = results.reduce((acc, current) => ({ ...acc, ...current }), {});

        functions.logger.info("Successfully fetched marketing data.");
        return combinedResults;

    } catch (error) {
        functions.logger.error("Error querying BigQuery:", error);
        if (error instanceof Error) {
             throw new functions.https.HttpsError(
                "internal",
                `Failed to fetch marketing data: ${error.message}`
             );
        } else {
             throw new functions.https.HttpsError(
                "internal",
                "An unknown error occurred while fetching marketing data."
             );
        }
    }
}); 