import React, { useState, useEffect } from 'react';
import './InvestorDashboard.css'; // Import the CSS
import BarChart from './BarChart'; // Import BarChart
import LineChart from './LineChart'; // Import LineChart

// The URL for your deployed Cloud Function
const API_ENDPOINT = 'https://us-central1-yelp-app-dfa90.cloudfunctions.net/getInvestorDashboardData';

function InvestorDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(API_ENDPOINT);
        if (!response.ok) {
          // Throw an error if the response status is not OK
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        setError(`Failed to load dashboard data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []); // Empty dependency array means this runs once on mount

  const formatNumber = (num) => {
    if (typeof num !== 'number') return '-';
    return num.toLocaleString(undefined, { maximumFractionDigits: 1 });
  };

  if (loading) {
    return <div className="investor-dashboard-loading">Loading Investor Data...</div>;
  }

  if (error) {
    return <div className="investor-dashboard-error">{error}</div>;
  }

  if (!data || !data.kpis) {
    return <div className="investor-dashboard-error">No data available.</div>;
  }

  return (
    <div className="investor-dashboard-container">
      <h2>Investor & Business Analyst Dashboard</h2>

      {/* KPI Section (Updated Metrics) */}
      <section className="kpi-section">
        <h3>Overall KPIs</h3>
        <div className="kpi-cards">
          <div className="kpi-card">
            <h4>Total Businesses</h4>
            <p>{formatNumber(data.kpis.total_businesses)}</p>
          </div>
          <div className="kpi-card">
            <h4>Total Reviews</h4>
            <p>{formatNumber(data.kpis.total_reviews)}</p>
          </div>
          <div className="kpi-card">
            <h4>Total Check-ins</h4>
            <p>{formatNumber(data.kpis.total_checkins)}</p>
          </div>
          <div className="kpi-card">
            <h4>Total Tips</h4>
            <p>{formatNumber(data.kpis.total_tips)}</p>
          </div>
          <div className="kpi-card">
            <h4>Total Photos</h4>
            <p>{formatNumber(data.kpis.total_photos)}</p>
          </div>
          <div className="kpi-card">
            <h4>Avg. Engagement</h4>
            <p>{formatNumber(data.kpis.avg_engagement_score)}</p>
          </div>
           <div className="kpi-card">
            <h4>Avg. Growth Rate</h4>
            <p>{formatNumber(data.kpis.avg_growth_rate)}</p>
          </div>
        </div>
      </section>

      {/* Charts Section - Add two more charts */}
      <section className="charts-section">
        {/* Chart 1: Monthly Review Trend */}
        <div className="chart-container">
          {data.trends && data.trends.length > 0 ? (
            <LineChart
              data={data.trends}
              xAxisKey="month_id"
              yAxisKey="monthly_total_reviews"
              title="Monthly Review Trend"
            />
          ) : (
            <div className="chart-placeholder">Trend data not available.</div>
          )}
        </div>

        {/* Chart 2: Reviews by Top Subcategory */}
        <div className="chart-container">
          {data.byCategory && data.byCategory.length > 0 ? (
            <BarChart
              data={data.byCategory}
              xAxisKey="subcategory"
              yAxisKey="category_total_reviews"
              title="Total Reviews by Top Subcategory"
            />
          ) : (
            <div className="chart-placeholder">Category data not available.</div>
          )}
        </div>

        {/* Chart 3: Monthly Engagement Trend */}
        <div className="chart-container">
          {data.trends && data.trends.length > 0 ? (
            <LineChart
              data={data.trends}
              xAxisKey="month_id"
              yAxisKey="monthly_avg_engagement_score"
              title="Monthly Avg. Engagement Trend"
            />
          ) : (
            <div className="chart-placeholder">Trend data not available.</div>
          )}
        </div>

        {/* Chart 4: Growth Rate by Top Subcategory */}
        <div className="chart-container">
          {data.byCategory && data.byCategory.length > 0 ? (
            <BarChart
              data={data.byCategory}
              xAxisKey="subcategory"
              yAxisKey="category_avg_growth_rate"
              title="Avg. Growth Rate by Top Subcategory"
            />
          ) : (
            <div className="chart-placeholder">Category data not available.</div>
          )}
        </div>
      </section>
    </div>
  );
}

export default InvestorDashboard; 