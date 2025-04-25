import React, { useState, useEffect, useRef } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import * as d3 from 'd3';
import { signOut } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebaseConfig';
import './MarketingDashboard.css'; // We'll create this CSS file next

// Define interfaces for the expected data structure from the backend
interface AvgStarsMonthlyData {
    year: number;
    month: number;
    average_stars: number;
}

interface VoteDistributionData {
    total_useful: number;
    total_funny: number;
    total_cool: number;
}

interface ReviewsByStateData {
    state: string;
    review_count: number;
}

interface TopCategoriesData {
    category: string;
    review_count: number;
}

interface UserStatsData {
    overall_avg_user_rating: number;
    total_fans: number;
    total_compliments: number;
    total_users: number;
}

interface MarketingData {
    avgStarsMonthly?: AvgStarsMonthlyData[];
    voteDistribution?: VoteDistributionData[]; // Expecting an array with one object
    reviewsByState?: ReviewsByStateData[];
    topCategories?: TopCategoriesData[];
    userStats?: UserStatsData[]; // Expecting an array with one object
}

// --- Placeholder Chart Components --- 

const BarChart: React.FC<{ data: { label: string, value: number }[], title: string, chartId: string }> = ({ data, title, chartId }) => {
    const ref = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!data || data.length === 0 || !ref.current) return;

        const svg = d3.select(ref.current);
        svg.selectAll("*").remove(); // Clear previous render

        const width = 400;
        const height = 250;
        const margin = { top: 20, right: 20, bottom: 70, left: 40 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const x = d3.scaleBand()
            .domain(data.map(d => d.label))
            .range([0, innerWidth])
            .padding(0.1);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.value) || 0])
            .range([innerHeight, 0]);

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        g.append("g")
            .attr("class", "axis axis--x")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(d3.axisBottom(x))
            .selectAll("text")
            .style("text-anchor", "end")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .attr("transform", "rotate(-45)");

        g.append("g")
            .attr("class", "axis axis--y")
            .call(d3.axisLeft(y));

        g.selectAll(".bar")
            .data(data)
            .enter().append("rect")
            .attr("class", "bar")
            .attr("x", d => x(d.label) || 0)
            .attr("y", d => y(d.value))
            .attr("width", x.bandwidth())
            .attr("height", d => innerHeight - y(d.value))
            .attr("fill", "var(--primary-color)");

        svg.append("text")
          .attr("x", width / 2)
          .attr("y", margin.top / 2 + 10)
          .attr("text-anchor", "middle")
          .style("font-size", "16px")
          .style("font-weight", "bold")
          .text(title);

    }, [data, title]);

    return <svg ref={ref} id={chartId} width={400} height={250}></svg>;
};

const LineChart: React.FC<{ data: { date: Date, value: number }[], title: string, chartId: string }> = ({ data, title, chartId }) => {
    const ref = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!data || data.length === 0 || !ref.current) return;

        const svg = d3.select(ref.current);
        svg.selectAll("*").remove(); // Clear previous render

        const width = 500;
        const height = 250;
        const margin = { top: 20, right: 30, bottom: 30, left: 40 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const x = d3.scaleTime()
            .domain(d3.extent(data, d => d.date) as [Date, Date])
            .range([0, innerWidth]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.value) || 0])
            .range([innerHeight, 0]);

        const line = d3.line<{ date: Date, value: number }>()
            .x(d => x(d.date))
            .y(d => y(d.value));

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        g.append("g")
            .attr("class", "axis axis--x")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(d3.axisBottom(x));

        g.append("g")
            .attr("class", "axis axis--y")
            .call(d3.axisLeft(y));

        g.append("path")
            .datum(data)
            .attr("fill", "none")
            .attr("stroke", "var(--primary-color)")
            .attr("stroke-width", 1.5)
            .attr("d", line);

         svg.append("text")
          .attr("x", width / 2)
          .attr("y", margin.top / 2 + 10) // Adjust position slightly
          .attr("text-anchor", "middle")
          .style("font-size", "16px")
          .style("font-weight", "bold")
          .text(title);

    }, [data, title]);

    return <svg ref={ref} id={chartId} width={500} height={250}></svg>;
};

// --- Main Dashboard Component --- 

const MarketingDashboard: React.FC = () => {
    const [data, setData] = useState<MarketingData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const { currentUser } = useAuth();

    const handleLogout = async () => {
        console.log("Marketing Dashboard: Attempting logout...");
        try {
            await signOut(auth);
            console.log('Marketing Dashboard: User logged out successfully');
            // Auth listener in AuthContext will handle redirect/UI changes
        } catch (error) {
            console.error('Marketing Dashboard Logout Error:', error);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const functions = getFunctions();
                const getMarketingDataFunc = httpsCallable<void, MarketingData>(functions, 'getMarketingData');
                const result = await getMarketingDataFunc();
                setData(result.data);
            } catch (err: any) {
                console.error("Error fetching marketing data:", err);
                setError(err.message || "Failed to fetch data. Check console for details.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // --- Data Transformation for Charts --- 
    const avgStarsMonthlyData = data?.avgStarsMonthly
        ?.map(d => ({
            date: new Date(d.year, d.month - 1), // JS months are 0-indexed
            value: d.average_stars
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());

    const voteDistributionData = data?.voteDistribution?.[0] ? [
        { label: 'Useful', value: data.voteDistribution[0].total_useful },
        { label: 'Funny', value: data.voteDistribution[0].total_funny },
        { label: 'Cool', value: data.voteDistribution[0].total_cool },
    ] : [];

    const reviewsByStateData = data?.reviewsByState?.map(d => ({ label: d.state, value: d.review_count }));

    const topCategoriesData = data?.topCategories?.map(d => ({ label: d.category, value: d.review_count }));

    const userStats = data?.userStats?.[0];

    // --- Render Logic --- 
    if (loading) {
        return <div className="marketing-dashboard-loading">Loading Marketing Data...</div>;
    }

    if (error) {
        return <div className="marketing-dashboard-error">Error: {error}</div>;
    }

    if (!data) {
        return <div className="marketing-dashboard-error">No data available.</div>;
    }

    return (
        <div className="marketing-dashboard-container">
            <header className="marketing-dashboard-header">
                <h1>Marketing & Customer Experience Dashboard</h1>
                <div className="user-actions">
                    {currentUser && <span>Welcome, {currentUser.email}</span>}
                    <button onClick={handleLogout} className="logout-button">Logout</button>
                </div>
            </header>

            <div className="dashboard-section stats-overview">
                <h2>User Overview</h2>
                 {userStats ? (
                    <div className="kpi-grid">
                        <div className="kpi-card">
                            <span className="kpi-value">{userStats.total_users?.toLocaleString()}</span>
                            <span className="kpi-label">Total Users</span>
                        </div>
                         <div className="kpi-card">
                            <span className="kpi-value">{userStats.overall_avg_user_rating?.toFixed(2)}</span>
                            <span className="kpi-label">Avg. User Rating</span>
                        </div>
                        <div className="kpi-card">
                            <span className="kpi-value">{userStats.total_fans?.toLocaleString()}</span>
                            <span className="kpi-label">Total Fans</span>
                        </div>
                        <div className="kpi-card">
                             <span className="kpi-value">{userStats.total_compliments?.toLocaleString()}</span>
                             <span className="kpi-label">Total Compliments</span>
                        </div>
                    </div>
                 ) : <p>User stats not available.</p>}
            </div>

            <div className="dashboard-section chart-grid">
                {avgStarsMonthlyData && avgStarsMonthlyData.length > 0 && (
                     <div className="chart-container">
                        <LineChart 
                            data={avgStarsMonthlyData} 
                            title="Average Star Rating Over Time" 
                            chartId="avg-stars-monthly-chart"
                        />
                    </div>
                )}
                {voteDistributionData && voteDistributionData.length > 0 && (
                    <div className="chart-container">
                        <BarChart 
                            data={voteDistributionData} 
                            title="Review Vote Distribution" 
                            chartId="vote-distribution-chart" 
                         />
                    </div>
                )}
                 {reviewsByStateData && reviewsByStateData.length > 0 && (
                     <div className="chart-container">
                        <BarChart 
                            data={reviewsByStateData} 
                            title="Top 10 States by Review Count" 
                            chartId="reviews-by-state-chart"
                        />
                    </div>
                 )}
                 {topCategoriesData && topCategoriesData.length > 0 && (
                     <div className="chart-container">
                        <BarChart 
                            data={topCategoriesData} 
                            title="Top 10 Business Categories by Review Count" 
                            chartId="top-categories-chart"
                        />
                    </div>
                )}
            </div>

        </div>
    );
};

export default MarketingDashboard; 