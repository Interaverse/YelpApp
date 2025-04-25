import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

// Simple Bar Chart Component using D3
const BarChart = ({ data, xAxisKey, yAxisKey, title }) => {
  const svgRef = useRef();
  const containerRef = useRef();

  useEffect(() => {
    if (!data || data.length === 0) return;

    const container = containerRef.current;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous chart elements

    // Get container dimensions for responsiveness
    const width = container.clientWidth;
    const height = 300; // Fixed height for simplicity, adjust as needed
    const margin = { top: 30, right: 20, bottom: 70, left: 50 }; // Increased bottom margin for labels
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create scales
    const xScale = d3.scaleBand()
      .domain(data.map(d => d[xAxisKey]))
      .range([0, innerWidth])
      .padding(0.2);

    // Calculate min and max for y-axis, ensuring min is not above 0 if all values are positive
    const yMin = d3.min(data, d => d[yAxisKey]);
    const yMax = d3.max(data, d => d[yAxisKey]);
    const yDomainMin = yMin < 0 ? yMin : 0; // Start at yMin if negative, otherwise 0

    const yScale = d3.scaleLinear()
      .domain([yDomainMin, yMax]) // Use calculated min (or 0) and max
      .range([innerHeight, 0])
      .nice();

    // Create a group for the chart content
    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Add X axis
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll("text")
        .attr("transform", "translate(-10,0)rotate(-45)") // Rotate labels
        .style("text-anchor", "end");

    // Add Y axis
    g.append("g")
      .call(d3.axisLeft(yScale));

    // Add bars
    g.selectAll(".bar")
      .data(data)
      .enter()
      .append("rect")
        .attr("class", "bar")
        .attr("x", d => xScale(d[xAxisKey]))
        // Adjust y and height calculation for negative values
        .attr("y", d => d[yAxisKey] >= 0 ? yScale(d[yAxisKey]) : yScale(0))
        .attr("width", xScale.bandwidth())
        .attr("height", d => d[yAxisKey] >= 0 ? innerHeight - yScale(d[yAxisKey]) : yScale(d[yAxisKey]) - yScale(0))
        .attr("fill", "var(--primary-color)");

    // Add Title (optional)
    svg.append("text")
       .attr("x", width / 2)
       .attr("y", margin.top / 2 + 5) // Adjust position as needed
       .attr("text-anchor", "middle")
       .style("font-size", "14px")
       .style("font-weight", "bold")
       .text(title);

  }, [data, xAxisKey, yAxisKey, title]); // Redraw chart if data or config changes

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <svg ref={svgRef} width="100%" height="300"></svg>
    </div>
  );
};

export default BarChart; 