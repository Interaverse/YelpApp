console.log("--- BusinessManagerDashboard component script loaded ---"); // Top-level log

import React, { useState, useEffect, useRef, useCallback } from 'react'; // Restore full imports
import * as d3 from 'd3';
import { signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig.ts';
import { useAuth } from '../contexts/AuthContext';
import { getFunctions, httpsCallable } from 'firebase/functions'; // Restore Firebase Functions import
import { app } from '../firebaseConfig.ts'; // Restore app import
import './BusinessManagerDashboard.css';

// --- Restore Interfaces and helpers ---

interface KpiData {
  total_reviews: number;
  avg_rating: number;
  total_checkins: number;
  avg_sentiment: number;
}

interface TimeSeriesData {
  week_start_date: { value: string } | string;
  weekly_reviews: number;
  avg_weekly_rating: number;
}

interface SentimentData {
  stars: number;
  count: number;
}

interface UserRatingDistributionData { 
  review_count_group: string;
  user_count: number;
}

interface PerformanceByDayData {
  day_of_week: string;
  avg_checkins: number;
  avg_rating: number;
}

interface DashboardData {
  kpis: KpiData | null;
  timeSeries: TimeSeriesData[] | null;
  sentimentBreakdown: SentimentData[] | null;
  performanceByDay: PerformanceByDayData[] | null;
}

// --- Date Guards and Parsers --- 

function isFirebaseTimestamp(value: any): value is { _seconds: number; _nanoseconds: number } {
  // Check for _seconds property existence and type
  return value && typeof value === 'object' && typeof value._seconds === 'number';
}

function isBigQueryDate(value: any): value is { value: string } {
  // Check for value property existence and type
  return value && typeof value === 'object' && typeof value.value === 'string';
}

// Single, corrected parser for the weekly date
const parseWeeklyDateValue = (dateValue: TimeSeriesData['week_start_date']): Date | null => {
    // console.log('Parsing weekly dateValue:', dateValue);
    if (typeof dateValue === 'string') {
        // Attempt direct parse if it's just a string YYYY-MM-DD
        return d3.timeParse("%Y-%m-%d")(dateValue.split('T')[0]);
    } else if (isBigQueryDate(dateValue)) {
        // Handle BigQuery date object { value: "YYYY-MM-DD" }
        return d3.timeParse("%Y-%m-%d")(dateValue.value);
    } else if (isFirebaseTimestamp(dateValue)) {
         // Explicitly cast after type guard check
        return new Date((dateValue as { _seconds: number })._seconds * 1000);
    }
    console.warn('Could not parse week_start_date format:', dateValue);
    return null;
};

interface ProcessedTimeSeriesPoint {
    date: Date;
    value: number;
}

interface ProcessedWeeklyTimeSeriesPoint {
    date: Date;
    value: number;
}

// --- Component ---
function BusinessManagerDashboard() {
  console.log("--- BusinessManagerDashboard function executing ---"); // Log inside function body

  // Restore state, refs, effects, etc.
  const [data, setData] = useState<DashboardData>({ kpis: null, timeSeries: null, sentimentBreakdown: null, performanceByDay: null });
  const [loading, setLoading] = useState<Record<string, boolean>>({ kpis: false, timeSeries: false, sentimentBreakdown: false, performanceByDay: false });
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const overviewChartRef = useRef<SVGSVGElement>(null);
  const performanceChartRef = useRef<SVGSVGElement>(null);
  const feedbackChartRef = useRef<SVGSVGElement>(null);
  const performanceByDayChartRef = useRef<SVGSVGElement>(null);

  const { currentUser } = useAuth(); // Keep for header

  // Restore logout handler
  const handleLogout = async () => {
    console.log("Attempting logout...");
    try {
      await signOut(auth);
      console.log('User logged out successfully');
    } catch (error) {
      console.error('Logout Error:', error);
    }
  };

  // Restore Firebase function call memoization
  const getDashboardDataFunc = useCallback(() => {
    const functionsInstance = getFunctions(app);
    return httpsCallable(functionsInstance, 'getBusinessDashboardData');
  }, []);

  // Function to fetch data for a specific type
  const fetchDataByType = useCallback(async (type: keyof DashboardData) => {
    // Only skip if data already exists (null for kpis, empty array for others)
    const dataExists = data[type] !== null && (type !== 'kpis' ? (data[type] as any[]).length > 0 : true);

    // Remove the loading[type] check from the skip condition
    if (dataExists) {
      console.log(`[Fetch Trigger] Skipping fetch for ${type} (dataExists=${dataExists})`);
      return;
    }

    const callableFunc = getDashboardDataFunc();
    setError(prev => (prev || '').replace(`Failed to load ${type}:.*?;?`, '').trim()); // Clear previous error for this type
    console.log(`[Fetch Trigger] Attempting to fetch: ${type}`);

    try {
      setLoading(prev => ({ ...prev, [type]: true }));
      const result = await callableFunc({ type });
      console.log(`[Fetch] Raw result for ${type}:`, result);
      const fetchedData = result.data as { data: any };
      let processedDataForState: any = null;

      if (fetchedData && fetchedData.data) {
         processedDataForState = type === 'kpis' ? (fetchedData.data[0] ?? null) : (fetchedData.data ?? []);
         console.log(`[Fetch] Successfully processed data for ${type}:`, processedDataForState);
      } else {
         processedDataForState = type === 'kpis' ? null : [];
         console.warn(`[Fetch] No data found in result for type: ${type}. Setting empty state.`);
      }
      setData(prev => {
         const newState = { ...prev, [type]: processedDataForState };
         console.log(`[State Update] Setting state for ${type}. New state slice:`, newState[type]);
         return newState;
       });
    } catch (err: any) {
      console.error(`[Fetch] Error fetching ${type}:`, err);
      setError(prevError => `${prevError ? prevError + "; " : ""}Failed to load ${type}: ${err.message || 'Unknown error'}`);
      setData(prev => ({ ...prev, [type]: type === 'kpis' ? null : [] })); // Set to empty/null on error
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
      console.log(`[Fetch] Finished fetching ${type}. Loading set to false.`);
    }
  }, [getDashboardDataFunc, data]); // Dependencies: needed to check current state

  // Fetch initial KPI data on mount
  useEffect(() => {
    console.log("--- Initial KPI Fetch ---");
    fetchDataByType('kpis');
  }, [fetchDataByType]); // Depend on the memoized fetch function

  // --- Restore D3 Chart Rendering Effects ---

  // Restore Helper for SVG dimensions and margins
  const getChartDimensions = (refCurrent: SVGSVGElement | null, defaultWidth = 600, defaultHeight = 300) => {
    if (!refCurrent) return null;
    const container = d3.select(refCurrent.parentNode as Element);
    const width = container.node() ? (container.node() as HTMLElement).clientWidth : defaultWidth;
    const height = defaultHeight;
    const margin = { top: 20, right: 30, bottom: 50, left: 60 };
    const boundedWidth = width - margin.left - margin.right;
    const boundedHeight = height - margin.top - margin.bottom;
    return {
        width: Math.max(0, width),
        height: Math.max(0, height),
        margin,
        boundedWidth: Math.max(0, boundedWidth),
        boundedHeight: Math.max(0, boundedHeight)
    };
  };

   // Restore Overview Chart (Rating Gauge)
  useEffect(() => {
    console.log("--- Running Overview Chart Effect ---");
    const currentRef = overviewChartRef.current;
    const kpiData = data?.kpis;
    console.log("[Overview Chart] KPI Data:", kpiData);
    console.log("[Overview Chart] Ref exists:", !!currentRef);

    if (kpiData && currentRef) {
      console.log("[Overview Chart] Rendering Gauge...");
      const dims = getChartDimensions(currentRef, 200, 150);
      if (!dims) {
        console.error("[Overview Chart] Could not get dimensions.");
        return;
      }
      const { width, height, boundedHeight } = dims;
      const svg = d3.select(currentRef)
        .html("")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .append("g")
        .attr("transform", `translate(${width / 2}, ${height * 0.75})`);

      const rating = kpiData.avg_rating ?? 0;
      const maxRating = 5;
      const angleScale = d3.scaleLinear()
        .domain([0, maxRating])
        .range([-Math.PI / 2, Math.PI / 2]);

      const arcGenerator = d3.arc()
        .innerRadius(boundedHeight * 0.5)
        .outerRadius(boundedHeight * 0.7)
        .startAngle(-Math.PI / 2);

      svg.append("path")
         .datum({ endAngle: Math.PI / 2 })
         .style("fill", "#e0e0e0")
         .attr("d", arcGenerator as any);

      svg.append("path")
         .datum({ endAngle: angleScale(rating) })
         .style("fill", "var(--primary-color, #4A90E2)")
         .attr("d", arcGenerator as any);

      svg.append("text")
         .attr("text-anchor", "middle")
         .attr("dy", "0.35em")
         .attr("y", -10)
         .style("font-size", "1.5em")
         .style("font-weight", "bold")
         .text(rating.toFixed(1));

       svg.append("text")
         .attr("text-anchor", "middle")
         .attr("y", boundedHeight * 0.1)
         .style("font-size", "0.8em")
         .text("Avg Rating");
      console.log("[Overview Chart] Gauge Rendered.");
    }
  });

   // 2. Performance Time Series Chart (Line Chart) - Uses parseWeeklyDateValue
  useEffect(() => {
    console.log("--- Running Time Series Chart Effect (Weekly) ---"); // Update log message
    const currentRef = performanceChartRef.current;
    const timeSeriesData = data?.timeSeries;
    console.log("[Time Series Chart (Weekly)] Data:", timeSeriesData);
    console.log("[Time Series Chart (Weekly)] Ref exists:", !!currentRef);

    if (timeSeriesData && timeSeriesData.length > 0 && currentRef) {
        console.log("[Time Series Chart (Weekly)] Rendering Line Chart...");
      const dims = getChartDimensions(currentRef);
       if (!dims) {
           console.error("[Time Series Chart (Weekly)] Could not get dimensions.");
           return;
       }
      const { width, height, margin, boundedWidth, boundedHeight } = dims;

      const svg = d3.select(currentRef)
        .html("")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

      // Process weekly data - Ensure correct parser is used
      const processedData: ProcessedWeeklyTimeSeriesPoint[] = timeSeriesData
        .map(d => ({ date: parseWeeklyDateValue(d.week_start_date), value: d.weekly_reviews })) // Use the corrected parser
        .filter((d): d is ProcessedWeeklyTimeSeriesPoint => d.date instanceof Date);

       console.log("[Time Series Chart (Weekly)] Processed Data for Chart:", processedData);

      if (!processedData.length) {
          console.warn("[Time Series Chart (Weekly)] No valid data points after processing.");
          svg.append("text").attr("x", boundedWidth/2).attr("y", boundedHeight/2).attr("text-anchor", "middle").text("No valid time series data.");
          return;
      }

      // Scales (X scale remains time, Y scale adapts to weekly reviews)
      const xScale = d3.scaleTime()
        .domain(d3.extent(processedData, d => d.date) as [Date, Date])
        .range([0, boundedWidth]);

      const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.value) ?? 10])
        .nice()
        .range([boundedHeight, 0]);

      // Axes (Fix tickFormat and tick interval)
      const timeFormatter = d3.timeFormat("%Y-%m-%d");
      const xAxis = d3.axisBottom(xScale)
                      .ticks(10) // Ask D3 for ~10 ticks automatically
                      .tickFormat((date) => timeFormatter(date as Date))
                      .tickSizeOuter(0);
      const yAxis = d3.axisLeft(yScale).ticks(Math.max(1, Math.floor(height / 40)));

      svg.append("g")
        .attr("transform", `translate(0, ${boundedHeight})`)
        .call(xAxis)
        .selectAll("text")
            .style("text-anchor", "end")
            .attr("dx", "-0.8em")
            .attr("dy", "0.15em")
            .attr("transform", "rotate(-45)");

       svg.append("g")
        .call(yAxis)
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick line").clone()
            .attr("x2", boundedWidth)
            .attr("stroke-opacity", 0.1));

      const lineGenerator = d3.line<ProcessedWeeklyTimeSeriesPoint>()
        .x(d => xScale(d.date))
        .y(d => yScale(d.value))
        .defined(d => d.date instanceof Date && !isNaN(d.value))
        .curve(d3.curveMonotoneX);

      svg.append("path")
        .datum(processedData)
        .attr("fill", "none")
        .attr("stroke", "var(--primary-color, steelblue)")
        .attr("stroke-width", 1.5)
        .attr("d", lineGenerator);

      svg.append("text")
          .attr("class", "axis-label")
          .attr("text-anchor", "middle")
          .attr("x", boundedWidth / 2)
          .attr("y", height - margin.bottom + 15)
          .text("Week Starting Date");

      svg.append("text")
          .attr("class", "axis-label")
          .attr("text-anchor", "middle")
          .attr("transform", "rotate(-90)")
          .attr("y", -margin.left + 15)
          .attr("x", -boundedHeight / 2)
          .text("Weekly Reviews");
      console.log("[Time Series Chart (Weekly)] Line Chart Rendered.");
    }
  });

  // User Distribution by Review Count Pie Chart
  useEffect(() => {
    console.log("--- Running User Distribution by Review Count Pie Chart Effect ---"); // Updated log
    const currentRef = feedbackChartRef.current;
    // Use sentimentBreakdown state slice and UserRatingDistributionData type
    const userDistData = data?.sentimentBreakdown as UserRatingDistributionData[] | null; 
    console.log("[User Dist Chart] Data:", userDistData);
    console.log("[User Dist Chart] Ref exists:", !!currentRef);

    // Use userDistData
    if (userDistData && userDistData.length > 0 && currentRef) {
      console.log("[User Dist Chart] Rendering Pie Chart...");
      // REMOVED console.log for actual data structure

      const dims = getChartDimensions(currentRef, 350, 350);
      if (!dims) {
          console.error("[User Dist Chart] Could not get dimensions.");
          return;
      }
      const { width, height, margin } = dims;
      const radius = Math.min(dims.boundedWidth, dims.boundedHeight) / 2;

      const svg = d3.select(currentRef)
        .html("")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .append("g")
        .attr("transform", `translate(${width / 2}, ${height / 2})`);

      const colorScale = d3.scaleOrdinal<string>()
        // Use review_count_group for the domain
        .domain(userDistData.map(d => d.review_count_group)) // Use review_count_group
        .range(d3.schemeSet2);

      // Use user_count for value
      const pieGenerator = d3.pie<UserRatingDistributionData>() // Use correct type
        .value(d => d.user_count) // Use user_count
        .sort(null);

      const arcGenerator = d3.arc<d3.PieArcDatum<UserRatingDistributionData>>() // Use correct type
        .innerRadius(0)
        .outerRadius(radius * 0.8);

       const arcs = pieGenerator(userDistData);

      svg.selectAll("path")
        .data(arcs)
        .join("path")
          .attr("d", arcGenerator)
          // Use review_count_group for fill color mapping
          .attr("fill", d => colorScale(d.data.review_count_group)) // Use review_count_group
          .attr("stroke", "white")
          .style("stroke-width", "2px");

      const labelArc = d3.arc<d3.PieArcDatum<UserRatingDistributionData>>() // Use correct type
          .innerRadius(radius * 0.9)
          .outerRadius(radius * 0.9);

       svg.selectAll(".pie-label")
         .data(arcs)
         .join("text")
           .attr("class", "pie-label")
           .attr("transform", d => `translate(${labelArc.centroid(d)})`)
           .attr("dy", "0.35em")
           .attr("text-anchor", "middle")
           // Update label text for review_count_group and user_count
           .text(d => `${d.data.review_count_group} (${d.data.user_count})`); // Use review_count_group and user_count
      console.log("[User Dist Chart] Pie Chart Rendered.");
    }
  });

   // Restore Performance By Day Bar Chart
   useEffect(() => {
    console.log("--- Running Performance By Day Chart Effect ---");
    const currentRef = performanceByDayChartRef.current;
    const perfByDayData = data?.performanceByDay;
    console.log("[Perf By Day Chart] Data:", perfByDayData);
    console.log("[Perf By Day Chart] Ref exists:", !!currentRef);

    if (perfByDayData && perfByDayData.length > 0 && currentRef) {
        console.log("[Perf By Day Chart] Rendering Bar Chart...");
        const dims = getChartDimensions(currentRef);
        if (!dims) {
            console.error("[Perf By Day Chart] Could not get dimensions.");
            return;
        }
        const { width, height, margin, boundedWidth, boundedHeight } = dims;

      const svg = d3.select(currentRef)
        .html("")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

      const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const sortedData = [...perfByDayData].sort((a, b) => dayOrder.indexOf(a.day_of_week) - dayOrder.indexOf(b.day_of_week));

      const xScale = d3.scaleBand()
        .domain(dayOrder)
        .range([0, boundedWidth])
        .padding(0.2);

      const yScale = d3.scaleLinear()
        .domain([0, d3.max(sortedData, d => d.avg_checkins) ?? 10])
        .nice()
        .range([boundedHeight, 0]);

      const xAxis = d3.axisBottom(xScale).tickSizeOuter(0);
      const yAxis = d3.axisLeft(yScale).ticks(Math.max(1, Math.floor(height / 40)));

      svg.append("g")
        .attr("transform", `translate(0, ${boundedHeight})`)
        .call(xAxis)
        .selectAll("text")
          .style("text-anchor", "middle");

      svg.append("g")
        .call(yAxis)
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick line").clone()
            .attr("x2", boundedWidth)
            .attr("stroke-opacity", 0.1));

      svg.selectAll(".bar")
        .data(sortedData)
        .join("rect")
          .attr("class", "bar")
          .attr("x", d => xScale(d.day_of_week) as number)
          .attr("y", d => yScale(d.avg_checkins))
          .attr("width", xScale.bandwidth())
          .attr("height", d => boundedHeight - yScale(d.avg_checkins))
          .attr("fill", "var(--secondary-color, #6c757d)");

      svg.append("text")
          .attr("class", "axis-label")
          .attr("text-anchor", "middle")
          .attr("x", boundedWidth / 2)
          .attr("y", height - margin.bottom / 1.5)
          .text("Day of Week");

      svg.append("text")
          .attr("class", "axis-label")
          .attr("text-anchor", "middle")
          .attr("transform", "rotate(-90)")
          .attr("y", -margin.left + 20)
          .attr("x", -boundedHeight / 2)
          .text("Average Check-ins");
        console.log("[Perf By Day Chart] Bar Chart Rendered.");
    }
  });

  // Restore Loading/Error checks
  // Define critical error based on KPIs being null
  const criticalError = error && data.kpis === null;

  // Show loading only if KPIs haven't loaded yet and no critical error
  if (data.kpis === null && !criticalError) { 
      console.log("Showing main loading screen (waiting for KPIs)...");
      return <div className="loading">Loading Dashboard Data...</div>;
  }
  if (criticalError) {
      console.error("Critical error detected:", error);
      return <div className="error">Error loading essential dashboard data: {error}</div>;
  }

  console.log("Rendering main dashboard structure. Loading states:", loading, "Data state:", data, "Error state:", error);

  // Handler for changing tabs and fetching data
  const handleTabChange = (tabName: string) => {
    console.log(`Tab changed to: ${tabName}`);
    setActiveTab(tabName);

    // Determine data type based on tab name and fetch if needed
    let dataTypeToFetch: keyof DashboardData | null = null;
    switch (tabName) {
      case 'overview':
        dataTypeToFetch = 'kpis'; // Already fetched initially, but good practice
        break;
      case 'performance':
        dataTypeToFetch = 'timeSeries';
        break;
      case 'feedback':
        dataTypeToFetch = 'sentimentBreakdown';
        break;
      case 'byDay':
        dataTypeToFetch = 'performanceByDay';
        break;
    }

    if (dataTypeToFetch) {
      fetchDataByType(dataTypeToFetch);
    }
  };

  // Restore full JSX structure
  return (
    <div className="business-dashboard-container">
      <header className="business-dashboard-header">
        {/* Restore original title */}
        <h1>Business & Manager Dashboard</h1>
        <div className="user-info">
          {currentUser && <span style={{ marginRight: '1rem' }}>Welcome, {currentUser.email}!</span>}
          <button onClick={handleLogout} className="logout-button">Logout</button>
        </div>
      </header>

      <nav className="dashboard-tabs">
        <button onClick={() => handleTabChange('overview')} className={activeTab === 'overview' ? 'active' : ''}>Overview</button>
        <button onClick={() => handleTabChange('performance')} className={activeTab === 'performance' ? 'active' : ''}>Performance Trends</button>
        <button onClick={() => handleTabChange('feedback')} className={activeTab === 'feedback' ? 'active' : ''}>Customer Feedback</button>
        <button onClick={() => handleTabChange('byDay')} className={activeTab === 'byDay' ? 'active' : ''}>Performance By Day</button>
      </nav>

      <main className="dashboard-content">
        {error && !criticalError && <div className="error" style={{ border: '1px solid orange', background: '#fff3e0', color: '#e65100', marginBottom: '1rem', padding: '0.5rem' }}>Warning: Part of the data failed to load. {error}</div>}

        {activeTab === 'overview' && (
          <section id="overview">
            <h2>Overview KPIs</h2>
            {loading.kpis ? <p>Loading KPIs...</p> : data?.kpis && Object.keys(data.kpis).length > 0 ? (
              <div className="kpi-container">
                <div className="kpi-card">Total Reviews: {data.kpis.total_reviews?.toLocaleString() ?? 'N/A'}</div>
                <div className="kpi-card">Avg. Rating: {data.kpis.avg_rating?.toFixed(1) ?? 'N/A'}</div>
                <div className="kpi-card">Total Check-ins: {data.kpis.total_checkins?.toLocaleString() ?? 'N/A'}</div>
                <div className="kpi-card">Avg. Sentiment: {data.kpis.avg_sentiment?.toFixed(2) ?? 'N/A'}</div>
              </div>
            ) : <p>KPI data unavailable.</p>}
             <div className="chart-container overview-chart-container">
               <h3>Average Rating Gauge</h3>
               {loading.kpis ? <p>Loading...</p> : data?.kpis && data.kpis.avg_rating != null ? <svg ref={overviewChartRef}></svg> : <p>Rating data unavailable.</p>}
             </div>
          </section>
        )}

        {activeTab === 'performance' && (
          <section id="performance">
            <h2>Operational Performance Trends (Weekly Reviews)</h2>
             {loading.timeSeries ? <p>Loading chart data...</p> : data?.timeSeries && data.timeSeries.length > 0 ? (
                <div className="chart-container">
                  <svg ref={performanceChartRef}></svg>
                </div>
              ) : <p>Time series data unavailable.</p>}
          </section>
        )}

        {activeTab === 'feedback' && (
          <section id="feedback">
            <h2>User Distribution by Average Rating</h2>
             {loading.sentimentBreakdown ? <p>Loading chart data...</p> : data?.sentimentBreakdown && data.sentimentBreakdown.length > 0 ? (
               <div className="chart-container">
                 <svg ref={feedbackChartRef}></svg>
               </div>
             ): <p>Sentiment data unavailable.</p>}
          </section>
        )}

        {activeTab === 'byDay' && (
          <section id="byDay">
            <h2>Performance By Day of Week (Average Check-ins)</h2>
            {loading.performanceByDay ? <p>Loading chart data...</p> : data?.performanceByDay && data.performanceByDay.length > 0 ? (
              <div className="chart-container">
                <svg ref={performanceByDayChartRef}></svg>
              </div>
            ) : <p>Performance by day data unavailable.</p>}
          </section>
        )}
      </main>

      <footer className="business-dashboard-footer">
        <p>&copy; {new Date().getFullYear()} Your Yelp App</p>
      </footer>
    </div>
  );
}

export default BusinessManagerDashboard; 