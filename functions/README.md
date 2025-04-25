# Firebase Cloud Function: `getInvestorDashboardData`

This document provides details about the `getInvestorDashboardData` Cloud Function used in the Yelp Web App.

## Purpose

This function serves aggregated business performance data from Google BigQuery, specifically tailored for the Investor & Business Analyst dashboard view within the frontend application.

## Trigger

*   **Type:** HTTPS Request
*   **URL:** The function is deployed and callable via an HTTPS endpoint (e.g., `https://us-central1-yelp-app-dfa90.cloudfunctions.net/getInvestorDashboardData`). The frontend `InvestorDashboard.jsx` component fetches data from this endpoint.

## Data Source

*   **Service:** Google BigQuery
*   **Project ID:** `yelp-456821`
*   **Dataset ID:** `investor_business_dataset`
*   **Tables Used:**
    *   `Fact_Business_Performance` (aliased as `T1` in queries)
    *   `Dim_Business` (aliased as `T3` in queries)

## Authentication

The function authenticates with Google Cloud services using a Service Account Key.

*   **Key File:** `yelp-456821-939594800d2e.json`
*   **Location:** This file must reside within the `functions` directory.
*   **Security:** **Crucially, this key file MUST be included in the `functions/.gitignore` file to prevent accidentally committing sensitive credentials.**

## Core Logic & Queries

The function executes three main SQL queries against the BigQuery dataset:

1.  **Overall KPIs (`kpiQuery`):** Calculates aggregate metrics across all relevant data in `Fact_Business_Performance`.
    *   Metrics: `total_businesses`, `total_reviews`, `total_checkins`, `total_tips`, `total_photos`, `avg_engagement_score`, `avg_growth_rate`.
2.  **Monthly Trends (`trendQuery`):** Aggregates performance metrics by month using the `month_id` field from `Fact_Business_Performance`.
    *   Metrics: `monthly_total_reviews`, `monthly_total_checkins`, `monthly_total_tips`, `monthly_total_photos`, `monthly_avg_engagement_score`, `monthly_avg_growth_rate`.
3.  **Performance by Category (`categoryQuery`):** Joins `Fact_Business_Performance` with `Dim_Business` to calculate aggregate metrics for the top 10 subcategories (based on total review count).
    *   Metrics: `subcategory`, `category_total_reviews`, `category_total_checkins`, `category_total_tips`, `category_total_photos`, `category_avg_engagement_score`, `category_avg_growth_rate`.

## Response Format

On success, the function returns a JSON object with HTTP status 200 and the following structure:

```json
{
  "kpis": {
    "total_businesses": number,
    "total_reviews": number,
    "total_checkins": number,
    "total_tips": number,
    "total_photos": number,
    "avg_engagement_score": number | null,
    "avg_growth_rate": number | null
    // ... other aggregated KPI values ...
  },
  "trends": [
    {
      "month_id": string, // e.g., "202401"
      "monthly_total_reviews": number,
      "monthly_total_checkins": number,
      // ... other monthly aggregated values ...
      "monthly_avg_engagement_score": number | null,
      "monthly_avg_growth_rate": number | null
    },
    // ... more monthly trend objects ...
  ],
  "byCategory": [
    {
      "subcategory": string,
      "category_total_reviews": number,
      "category_total_checkins": number,
      // ... other category aggregated values ...
      "category_avg_engagement_score": number | null,
      "category_avg_growth_rate": number | null
    },
    // ... more category performance objects (up to 10) ...
  ]
}
```

## CORS

The function uses the `cors` middleware to allow cross-origin requests from the frontend application hosted on Firebase Hosting or served locally during development (e.g., `http://localhost:xxxx`).

## Error Handling

If an error occurs during execution (e.g., BigQuery query failure, permission issues), the function:

1.  Logs the detailed error internally using `functions.logger.error` for debugging purposes.
2.  Returns an HTTP status 500 (Internal Server Error) with a generic error message string to the client. 