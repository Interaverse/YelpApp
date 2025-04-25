import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

// Simple Line Chart Component using D3
const LineChart = ({ data, xAxisKey, yAxisKey, title }) => {
  const svgRef = useRef();
  const containerRef = useRef();

  useEffect(() => {
    console.log(`LineChart (${title}) - Raw Data:`, data); // Log raw data
    if (!data || data.length === 0) {
      console.log(`LineChart (${title}) - No raw data.`);
      return;
    }

    // 1. Parse dates and filter invalid entries
    const parseTime = d3.timeParse("%Y%m");
    const processedData = data.map(d => {
      const date = parseTime(d[xAxisKey]);
      // Log parsing result for each item
      // console.log(`Parsing ${d[xAxisKey]}:`, date, `Value: ${d[yAxisKey]}`); 
      return {
        ...d,
        [xAxisKey]: date,
        [yAxisKey]: +d[yAxisKey] // Ensure y-value is numeric
      };
    }).filter(d => d[xAxisKey] !== null && !isNaN(d[yAxisKey])); // Filter invalid dates AND NaN y-values

    console.log(`LineChart (${title}) - Processed Data (${processedData.length} valid points):`, processedData);

    if (processedData.length === 0) {
      console.error(`LineChart (${title}) - No valid data points after processing.`);
      return;
    } // No valid data to plot

    const container = containerRef.current;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous chart elements

    // 2. Setup Dimensions and Margins
    const width = container.clientWidth;
    const height = 300;
    const margin = { top: 30, right: 20, bottom: 50, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const xDomain = d3.extent(processedData, d => d[xAxisKey]);
    const yDomain = [0, d3.max(processedData, d => d[yAxisKey])];
    console.log(`LineChart (${title}) - X Domain:`, xDomain);
    console.log(`LineChart (${title}) - Y Domain:`, yDomain);

    // Check for invalid domains
    if (!xDomain[0] || !xDomain[1] || isNaN(yDomain[1])) {
        console.error(`LineChart (${title}) - Invalid scale domain detected.`, { xDomain, yDomain });
        return;
    }

    // 3. Create Scales
    const xScale = d3.scaleTime()
      .domain(xDomain)
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain(yDomain)
      .range([innerHeight, 0])
      .nice();

    // 4. Create Line Generator
    const lineGenerator = d3.line()
      .x(d => xScale(d[xAxisKey]))
      .y(d => yScale(d[yAxisKey]))
      .curve(d3.curveMonotoneX); // Makes the line smooth

    // 5. Create SVG Group for Chart
    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // 6. Add Axes
    // X Axis
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(d3.timeMonth.every(3)).tickFormat(d3.timeFormat("%b '%y"))); // Show month abbr and year

    // Y Axis
    g.append("g")
      .call(d3.axisLeft(yScale));

    // 7. Draw the Line
    g.append("path")
      .datum(processedData)
      .attr("fill", "none")
      .attr("stroke", "var(--primary-color)")
      .attr("stroke-width", 1.5)
      .attr("d", lineGenerator);

    // 8. Add Title (optional)
     svg.append("text")
       .attr("x", width / 2)
       .attr("y", margin.top / 2 + 5)
       .attr("text-anchor", "middle")
       .style("font-size", "14px")
       .style("font-weight", "bold")
       .text(title);

  }, [data, xAxisKey, yAxisKey, title]);

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <svg ref={svgRef} width="100%" height="300"></svg>
    </div>
  );
};

export default LineChart; 