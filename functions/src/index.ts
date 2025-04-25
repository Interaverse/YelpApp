/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {onCall, HttpsError, CallableRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
// import * as functions from "firebase-functions/v2/https"; // This line is removed/commented out
import * as admin from "firebase-admin";
import {BigQuery} from "@google-cloud/bigquery";
import * as path from "path";

// Import the new function (using an alias temporarily if needed, but direct import might be fine)
import { getMarketingData as _getMarketingData } from "./marketingDashboard";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// Define the expected structure of the data sent from the client
interface DashboardDataRequest {
  type: "kpis" | "timeSeries" | "sentimentBreakdown" | "performanceByDay";
  businessId?: string; // Optional: Client might send specific business ID
  // timeRange?: { start: string, end: string }; // Optional: Add if time filtering is needed
}

// Initialize Firebase Admin SDK (if not already done)
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Initialize BigQuery client
// SECURITY WARNING: Using a key file directly is not recommended for production.
// Use Firebase config or Secret Manager instead.
const keyFilePath = path.join(__dirname, "..", "yelp-456821-939594800d2e.json");
const bigqueryClient = new BigQuery({
  projectId: "yelp-456821",
  keyFilename: keyFilePath,
});

const datasetId = "business_owner_managers_dataset"; // As specified by user

// Helper to safely stringify complex objects for logging
const safeStringify = (obj: any): string => {
  const cache = new Set();
  return JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) {
          // Circular reference found, discard key
          return "[Circular]";
        }
        // Store value in our collection
        cache.add(value);
      }
      // Handle BigInts
      if (typeof value === 'bigint') {
        return value.toString() + 'n'; // Indicate it was a BigInt
      }
      return value;
    },
    2 // Pretty print with 2 spaces
  );
};

/**
 * Fetches data from BigQuery for the Business/Manager dashboard.
 */
export const getBusinessDashboardData = onCall(async (request: CallableRequest<DashboardDataRequest>) => {
  const context = request;
  const data = request.data;

  if (!context.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }

  const queryType = data.type;
  const businessId = data.businessId;

  logger.info(`Processing Type: ${queryType}, BusinessId: ${businessId}`);

  let query = "";
  const params: {[key: string]: any} = {businessId: businessId || ""};

  switch (queryType) {
    case "kpis":
      query = `
        SELECT
          COUNT(DISTINCT fop.business_id) as num_businesses,
          SUM(fop.daily_reviews) as total_reviews,
          CAST(AVG(fop.avg_daily_rating) AS FLOAT64) as avg_rating,
          SUM(fop.daily_checkins) as total_checkins,
          CAST(AVG(fop.sentiment_score_avg) AS FLOAT64) as avg_sentiment
        FROM \`yelp-456821.${datasetId}.Fact_Operational_Performance\` AS fop
        -- WHERE fop.business_id = @businessId
      `;
      break;

    case "timeSeries":
      query = `
        SELECT
          DATE_TRUNC(d.date, WEEK(MONDAY)) as week_start_date,
          SUM(fop.daily_reviews) as weekly_reviews,
          CAST(AVG(fop.avg_daily_rating) AS FLOAT64) as avg_weekly_rating
        FROM \`yelp-456821.${datasetId}.Fact_Operational_Performance\` AS fop
        JOIN \`yelp-456821.${datasetId}.Dim_Date\` AS d ON fop.date_id = d.date_id
        -- WHERE fop.business_id = @businessId
        GROUP BY week_start_date
        ORDER BY week_start_date ASC
      `;
      break;

    case "sentimentBreakdown":
      query = `
        SELECT
          CASE
            WHEN du.review_count_total BETWEEN 1 AND 5 THEN '1-5 reviews'
            WHEN du.review_count_total BETWEEN 6 AND 20 THEN '6-20 reviews'
            WHEN du.review_count_total BETWEEN 21 AND 50 THEN '21-50 reviews'
            WHEN du.review_count_total > 50 THEN '51+ reviews'
            ELSE '0 reviews' -- Handle cases with 0 or null if necessary
          END AS review_count_group,
          COUNT(du.user_id) AS user_count
        FROM \`yelp-456821.${datasetId}.Dim_User\` AS du
        WHERE du.review_count_total IS NOT NULL
        GROUP BY review_count_group
        ORDER BY
          CASE review_count_group -- Custom order for meaningful presentation
            WHEN '0 reviews' THEN 0
            WHEN '1-5 reviews' THEN 1
            WHEN '6-20 reviews' THEN 2
            WHEN '21-50 reviews' THEN 3
            WHEN '51+ reviews' THEN 4
            ELSE 5
          END ASC
      `;
      break;

    case "performanceByDay":
      query = `
        SELECT
            d.day_of_week,
            CAST(AVG(fop.daily_checkins) AS FLOAT64) as avg_checkins,
            CAST(AVG(fop.avg_daily_rating) AS FLOAT64) as avg_rating
        FROM \`yelp-456821.${datasetId}.Fact_Operational_Performance\` AS fop
        JOIN \`yelp-456821.${datasetId}.Dim_Date\` AS d ON fop.date_id = d.date_id
        -- WHERE fop.business_id = @businessId
        GROUP BY d.day_of_week
        ORDER BY MIN(CASE d.day_of_week
            WHEN 'Monday' THEN 1
            WHEN 'Tuesday' THEN 2
            WHEN 'Wednesday' THEN 3
            WHEN 'Thursday' THEN 4
            WHEN 'Friday' THEN 5
            WHEN 'Saturday' THEN 6
            WHEN 'Sunday' THEN 7
            ELSE 8 END
        );
      `;
      break;

    default:
      logger.error(`Invalid query type: ${queryType}`);
      throw new HttpsError("invalid-argument", "Invalid data type requested.");
  }

  if (!query) {
    logger.error(`Query construction resulted in empty query for type: ${queryType}`);
    throw new HttpsError("internal", "Query could not be constructed.");
  }

  // Helper function to simplify BigQuery values into JSON-compatible types
  const simplifyValue = (value: any): any => {
    if (value === null || value === undefined) {
      return null;
    }

    // Handle BigQuery specific types (Date, Timestamp, Time, Datetime, Geography)
    if (typeof value === 'object' && value !== null && value.value !== undefined) {
      // Convert Date/Timestamp/Time/Datetime objects to ISO strings or relevant string formats
      // The .value property usually holds the string representation we need.
      return String(value.value);
    }

    // Handle native JavaScript Date objects
    if (value instanceof Date) {
      return value.toISOString();
    }

    // Handle BigInt (convert to string to avoid potential precision loss with Number)
    if (typeof value === 'bigint') {
      return value.toString();
    }

    // Handle arrays recursively
    if (Array.isArray(value)) {
      return value.map(simplifyValue);
    }

    // Handle plain objects recursively
    if (typeof value === 'object' && value !== null) {
      const simplifiedObj: { [key: string]: any } = {};
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          simplifiedObj[key] = simplifyValue(value[key]);
        }
      }
      return simplifiedObj;
    }

    // Return primitive types (string, number, boolean) as is
    return value;
  };

  try {
    const options = {
      query: query,
      location: "US",
      params: params,
    };

    logger.info(`Executing BigQuery query for type: ${queryType}`, options.query);
    const [rows] = await bigqueryClient.query(options);
    logger.info(`Query successful for ${queryType}, fetched ${rows.length} rows.`);

    logger.info(`Query results count: ${rows.length}`);

    // Process rows to create a simpler, serializable structure
    const processedRows = rows.map((row) => {
      const simplifiedRow: { [key: string]: any } = {};
      for (const key in row) {
        if (Object.prototype.hasOwnProperty.call(row, key)) {
          simplifiedRow[key] = simplifyValue(row[key]);
        }
      }
      return simplifiedRow;
    });

    // Log the structure of the data being returned for debugging
    try {
        // Use debug level for potentially large output
        logger.debug("Attempting to return data structure:", safeStringify({ data: processedRows }));
    } catch (logError: any) {
        logger.error("Error stringifying data for logging:", logError);
        // Log a simpler version if stringify failed
        logger.debug("Data to return (basic info):", { count: processedRows.length, firstRowKeys: processedRows.length > 0 ? Object.keys(processedRows[0]) : [] });
    }

    return { data: processedRows };

  } catch (error: any) {
    logger.error(`BigQuery query or processing failed for type ${queryType}:`, error);
    throw new HttpsError(
      "internal",
      `Failed to fetch or process ${queryType} data from BigQuery.`,
      error.message,
    );
  }
});

// Export the new function using export const
export const getMarketingData = _getMarketingData;
