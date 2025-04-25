// Import necessary modules
const functions = require("firebase-functions");
const {BigQuery} = require("@google-cloud/bigquery");
const cors = require("cors")({origin: true});

// Initialize BigQuery client
// IMPORTANT: Ensure 'yelp-456821-939594800d2e.json' is in the 'functions' directory
// and added to .gitignore
const bigqueryClient = new BigQuery({
  projectId: "yelp-456821",
  keyFilename: "yelp-456821-939594800d2e.json",
});

// Cloud Function to get investor/analyst dashboard data
exports.getInvestorDashboardData = functions.https.onRequest((req, res) => {
  // Enable CORS
  cors(req, res, async () => {
    try {
      // --- Define BigQuery Queries ---
      // Note: Adjust table names (e.g., `investor_business_dataset.Fact_Business_Performance`)
      // if the dataset ID is part of the table name in BigQuery.
      // These queries are examples based on the schema; refine as needed.

      const datasetId = "investor_business_dataset"; // Dataset ID

      // Query 1: Overall KPIs (Updated Metrics)
      const kpiQuery = `
        SELECT
          COUNT(DISTINCT T1.business_id) AS total_businesses,
          SUM(T1.review_count) AS total_reviews,
          SUM(T1.checkin_count) AS total_checkins,
          SUM(T1.tip_count) AS total_tips,
          SUM(T1.photo_count) AS total_photos,
          AVG(T1.engagement_score) AS avg_engagement_score,
          AVG(T1.growth_rate) AS avg_growth_rate
        FROM \`${datasetId}.Fact_Business_Performance\` AS T1
        WHERE T1.engagement_score IS NOT NULL AND T1.growth_rate IS NOT NULL;
      `;

      // Query 2: Performance Trend (by month_id, Updated Metrics)
      const trendQuery = `
        SELECT
          T1.month_id, -- Use month_id directly
          SUM(T1.review_count) AS monthly_total_reviews,
          SUM(T1.checkin_count) AS monthly_total_checkins,
          SUM(T1.tip_count) AS monthly_total_tips,
          SUM(T1.photo_count) AS monthly_total_photos,
          AVG(T1.engagement_score) AS monthly_avg_engagement_score,
          AVG(T1.growth_rate) AS monthly_avg_growth_rate
        FROM \`${datasetId}.Fact_Business_Performance\` AS T1
        WHERE T1.engagement_score IS NOT NULL AND T1.growth_rate IS NOT NULL
        GROUP BY T1.month_id
        ORDER BY T1.month_id; -- Assuming month_id is sortable (e.g., 'YYYY-MM')
      `;

      // Query 3: Performance by Top 10 Categories (Updated Metrics & Field Name)
      const categoryQuery = `
        SELECT
          T3.subcategory, -- Correct field name
          SUM(T1.review_count) AS category_total_reviews,
          SUM(T1.checkin_count) AS category_total_checkins,
          SUM(T1.tip_count) AS category_total_tips,
          SUM(T1.photo_count) AS category_total_photos,
          AVG(T1.engagement_score) AS category_avg_engagement_score,
          AVG(T1.growth_rate) AS category_avg_growth_rate
        FROM \`${datasetId}.Fact_Business_Performance\` AS T1
        JOIN \`${datasetId}.Dim_Business\` AS T3 ON T1.business_id = T3.business_id
        WHERE T1.engagement_score IS NOT NULL AND T1.growth_rate IS NOT NULL AND T3.subcategory IS NOT NULL
        GROUP BY T3.subcategory -- Correct field name
        ORDER BY category_total_reviews DESC
        LIMIT 10;
      `;

      // --- Execute Queries ---
      const [kpiJob] = await bigqueryClient.createQueryJob({query: kpiQuery});
      const [trendJob] = await bigqueryClient.createQueryJob({query: trendQuery});
      const [categoryJob] = await bigqueryClient.createQueryJob({query: categoryQuery});

      const [kpiResults] = await kpiJob.getQueryResults();
      const [trendResults] = await trendJob.getQueryResults();
      const [categoryResults] = await categoryJob.getQueryResults();

      // --- Format and Send Response ---
      res.status(200).json({
        kpis: kpiResults[0] || {},
        trends: trendResults,
        byCategory: categoryResults,
      });
    } catch (error) {
      console.error("Error fetching BigQuery data:", error);
      // Log the detailed error for debugging
      functions.logger.error("BigQuery Error:", {
          message: error.message,
          stack: error.stack,
          errors: error.errors // BigQuery specific errors
      });
      // Send a generic error response to the client
      res.status(500).send("Internal Server Error fetching dashboard data.");
    }
  });
}); 