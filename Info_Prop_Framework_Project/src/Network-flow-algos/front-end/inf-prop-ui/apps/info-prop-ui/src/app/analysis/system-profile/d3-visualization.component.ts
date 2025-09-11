import { 
  Component, 
  Input, 
  OnInit, 
  OnDestroy, 
  OnChanges, 
  SimpleChanges,
  ElementRef, 
  ViewChild, 
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as d3 from 'd3';
import { VisualizationDataPoint } from '../../shared/models/system-profile.models';

export type ChartType = 'bar' | 'radar' | 'heatmap' | 'network' | 'line' | 'scatter';
export type ThemeMode = 'light' | 'dark';

interface ChartDataPoint {
  label: string;
  value: number;
  category?: string;
}

/**
 * D3.js Visualization Component for System Profile
 * 
 * Supports multiple chart types with theme-aware rendering
 */
@Component({
  selector: 'app-d3-visualization',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="d3-visualization-container" [attr.data-theme]="themeMode">
      <div class="chart-header" *ngIf="title">
        <h3 class="chart-title">{{ title }}</h3>
        <p class="chart-subtitle" *ngIf="subtitle">{{ subtitle }}</p>
      </div>
      
      <div class="chart-controls" *ngIf="showControls">
        <div class="control-group">
          <label for="chart-type-select">Chart Type:</label>
          <select id="chart-type-select" [(ngModel)]="chartType" (change)="onChartTypeChange()">
            <option value="bar">Bar Chart</option>
            <option value="radar">Radar Chart</option>
            <option value="heatmap">Heatmap</option>
            <option value="network">Network Graph</option>
            <option value="line">Line Chart</option>
            <option value="scatter">Scatter Plot</option>
          </select>
        </div>
        
        <div class="control-group">
          <label for="animation-toggle">Animation:</label>
          <input id="animation-toggle" type="checkbox" [(ngModel)]="enableAnimations" (change)="redraw()">
        </div>
      </div>
      
      <div class="chart-wrapper">
        <svg #chartSvg class="d3-chart"></svg>
        <div class="chart-tooltip" #tooltip></div>
      </div>
      
      <div class="chart-legend" #legend *ngIf="showLegend"></div>
      
      <div class="chart-info" *ngIf="visualizationData && visualizationData.length > 0">
        <span class="data-points">{{ visualizationData.length }} visualizations</span>
        <span class="last-updated" *ngIf="lastUpdated">Updated: {{ lastUpdated | date:'short' }}</span>
      </div>
    </div>
  `,
  styles: [`
    .d3-visualization-container {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: var(--surface-color);
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .chart-header {
      margin-bottom: 16px;
    }

    .chart-title {
      margin: 0 0 4px 0;
      font-size: 1.2em;
      font-weight: 600;
      color: var(--primary-color);
    }

    .chart-subtitle {
      margin: 0;
      font-size: 0.9em;
      color: var(--text-secondary);
    }

    .chart-controls {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
      padding: 8px;
      background: var(--background-color);
      border-radius: 4px;
      flex-wrap: wrap;
    }

    .control-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .control-group label {
      font-size: 0.9em;
      font-weight: 500;
      color: var(--text-primary);
    }

    .control-group select,
    .control-group input {
      padding: 4px 8px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: var(--surface-color);
      color: var(--text-primary);
    }

    .chart-wrapper {
      flex: 1;
      position: relative;
      min-height: 300px;
    }

    .d3-chart {
      width: 100%;
      height: 100%;
      background: var(--surface-color);
    }

    .chart-tooltip {
      position: absolute;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 0.85em;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 1000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }

    .chart-legend {
      margin-top: 12px;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      justify-content: center;
    }

    .chart-info {
      margin-top: 8px;
      display: flex;
      justify-content: space-between;
      font-size: 0.8em;
      color: var(--text-secondary);
    }

    [data-theme="dark"] .chart-tooltip {
      background: rgba(255,255,255,0.9);
      color: #333;
    }

    @media (max-width: 768px) {
      .chart-controls {
        flex-direction: column;
        gap: 8px;
      }
      
      .control-group {
        justify-content: space-between;
      }
    }
  `]
})
export class D3VisualizationComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('chartSvg', { static: true }) chartSvg!: ElementRef<SVGElement>;
  @ViewChild('tooltip', { static: true }) tooltip!: ElementRef<HTMLDivElement>;
  @ViewChild('legend', { static: true }) legend!: ElementRef<HTMLDivElement>;

  @Input() visualizationData: VisualizationDataPoint[] = [];
  @Input() chartType: ChartType = 'bar';
  @Input() title?: string;
  @Input() subtitle?: string;
  @Input() themeMode: ThemeMode = 'light';
  @Input() showControls = true;
  @Input() showLegend = true;
  @Input() enableAnimations = true;
  @Input() width?: number;
  @Input() height?: number;
  @Input() lastUpdated?: Date;

  private svg: d3.Selection<SVGElement, unknown, null, undefined> | null = null;
  private resizeObserver?: ResizeObserver;

  // Chart dimensions and margins
  private margin = { top: 20, right: 30, bottom: 40, left: 50 };
  private chartWidth = 0;
  private chartHeight = 0;

  // Color schemes for different themes
  private colorSchemes = {
    light: {
      primary: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b'],
      background: '#ffffff',
      text: '#333333',
      grid: '#e0e0e0',
      axis: '#666666'
    },
    dark: {
      primary: ['#8dd3c7', '#ffffb3', '#bebada', '#fb8072', '#80b1d3', '#fdb462'],
      background: '#2d2d2d',
      text: '#ffffff',
      grid: '#444444',
      axis: '#cccccc'
    }
  };

  ngOnInit(): void {
    console.log('🎨 D3VisualizationComponent initializing with', this.visualizationData?.length || 0, 'visualizations');
  }

  ngAfterViewInit(): void {
    if (this.chartSvg?.nativeElement) {
      this.initializeChart();
    }
  }

  ngOnDestroy(): void {
    // Clean up D3 elements
    if (this.svg) {
      this.svg.selectAll('*').remove();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visualizationData'] || changes['chartType'] || changes['themeMode']) {
      if (this.svg) {
        this.redraw();
      }
    }
  }

  private initializeChart(): void {
    if (!this.chartSvg?.nativeElement) {
      console.warn('Chart SVG element not available');
      return;
    }

    const element = this.chartSvg.nativeElement;
    this.svg = d3.select(element);
    
    // Set initial dimensions based on container
    this.updateDimensions();
    this.redraw();
  }

  private updateDimensions(): void {
    const container = this.chartSvg.nativeElement.parentElement!;
    const rect = container.getBoundingClientRect();
    
    this.chartWidth = (this.width || rect.width) - this.margin.left - this.margin.right;
    this.chartHeight = (this.height || rect.height) - this.margin.top - this.margin.bottom;
    
    this.svg!
      .attr('width', this.chartWidth + this.margin.left + this.margin.right)
      .attr('height', this.chartHeight + this.margin.top + this.margin.bottom);
  }

  onChartTypeChange(): void {
    console.log('📊 Chart type changed to:', this.chartType);
    this.redraw();
  }

  redraw(): void {
    if (!this.svg || !this.visualizationData || this.visualizationData.length === 0) {
      return;
    }

    // Clear previous chart
    this.svg.selectAll('*').remove();

    // Create main group
    const g = this.svg
      .append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    // Get sample data from first visualization
    const sampleData = this.getSampleData();
    
    if (sampleData.length === 0) {
      this.drawNoDataMessage(g);
      return;
    }

    // Draw chart based on type
    switch (this.chartType) {
      case 'bar':
        this.drawBarChart(g, sampleData);
        break;
      case 'radar':
        this.drawRadarChart(g, sampleData);
        break;
      case 'heatmap':
        this.drawHeatmap(g, sampleData);
        break;
      case 'network':
        this.drawNetworkGraph(g, sampleData);
        break;
      case 'line':
        this.drawLineChart(g, sampleData);
        break;
      case 'scatter':
        this.drawScatterPlot(g, sampleData);
        break;
    }

    this.updateLegend(sampleData);
  }

  private getSampleData(): ChartDataPoint[] {
    if (!this.visualizationData || this.visualizationData.length === 0) {
      // Return empty array if no data - let the component show "no data" message
      return [];
    }

    // Extract actual system profile data for meaningful visualization
    const chartData: ChartDataPoint[] = [];

    this.visualizationData.forEach(viz => {
      if (viz.data && Array.isArray(viz.data)) {
        // Use actual data from visualization
        viz.data.forEach((dataPoint: any) => {
          if (dataPoint.label && typeof dataPoint.value === 'number') {
            chartData.push({
              label: dataPoint.label,
              value: Math.max(0, Math.min(100, dataPoint.value)), // Ensure 0-100 range
              category: viz.category
            });
          }
        });
      } else if (viz.metadata) {
        // Extract meaningful metrics from metadata
        const metrics = this.extractMetricsFromVisualization(viz);
        chartData.push(...metrics);
      }
    });

    // If we still have no data, return a meaningful message dataset
    if (chartData.length === 0) {
      return [
        { label: 'No Analysis Data', value: 0, category: 'info' }
      ];
    }

    return chartData;
  }

  private extractMetricsFromVisualization(viz: any): ChartDataPoint[] {
    const metrics: ChartDataPoint[] = [];
    
    // Extract different types of metrics based on visualization category
    switch (viz.category) {
      case 'performance':
        if (viz.metadata?.averageTime) {
          metrics.push({
            label: 'Avg Computation Time',
            value: Math.min(100, viz.metadata.averageTime / 10), // Scale to 0-100
            category: 'performance'
          });
        }
        if (viz.metadata?.efficiency) {
          metrics.push({
            label: 'System Efficiency',
            value: Math.max(0, Math.min(100, viz.metadata.efficiency)),
            category: 'performance'
          });
        }
        break;
        
      case 'risk':
        if (viz.metadata?.riskScore) {
          metrics.push({
            label: 'Risk Score',
            value: Math.max(0, Math.min(100, viz.metadata.riskScore)),
            category: 'risk'
          });
        }
        break;
        
      case 'analysis':
        if (viz.metadata?.scenarioCount) {
          metrics.push({
            label: 'Scenarios Analyzed',
            value: Math.min(100, viz.metadata.scenarioCount * 10), // Scale to percentage
            category: 'analysis'
          });
        }
        break;
    }
    
    return metrics;
  }

  private drawNoDataMessage(g: d3.Selection<SVGGElement, unknown, null, undefined>): void {
    g.append('text')
      .attr('x', this.chartWidth / 2)
      .attr('y', this.chartHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', this.colorSchemes[this.themeMode].text)
      .attr('font-size', '16px')
      .text('No data available for visualization');
  }

  private drawBarChart(g: d3.Selection<SVGGElement, unknown, null, undefined>, data: ChartDataPoint[]): void {
    const colors = this.colorSchemes[this.themeMode];
    
    // Ensure all values are positive and reasonable
    const safeData = data.map(d => ({
      ...d,
      value: Math.max(0, Math.min(100, d.value)) // Clamp values between 0-100
    }));
    
    // Scales
    const xScale = d3.scaleBand()
      .domain(safeData.map(d => d.label))
      .range([0, this.chartWidth])
      .padding(0.1);

    const maxValue = d3.max(safeData, d => d.value) || 100;
    const yScale = d3.scaleLinear()
      .domain([0, maxValue])
      .range([this.chartHeight, 0]);

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${this.chartHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .style('fill', colors.axis);

    g.append('g')
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .style('fill', colors.axis);

    // Bars
    const bars = g.selectAll('.bar')
      .data(safeData)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => xScale(d.label)!)
      .attr('width', xScale.bandwidth())
      .attr('y', this.chartHeight)
      .attr('height', 0)
      .attr('fill', (d, i) => colors.primary[i % colors.primary.length])
      .on('mouseover', (event, d) => this.showTooltip(event, d))
      .on('mouseout', () => this.hideTooltip());

    // Animate bars with safe height calculation
    if (this.enableAnimations) {
      bars.transition()
        .duration(750)
        .attr('y', d => yScale(d.value))
        .attr('height', d => Math.max(0, this.chartHeight - yScale(d.value))); // Ensure non-negative height
    } else {
      bars
        .attr('y', d => yScale(d.value))
        .attr('height', d => Math.max(0, this.chartHeight - yScale(d.value))); // Ensure non-negative height
    }
  }

  private drawRadarChart(g: d3.Selection<SVGGElement, unknown, null, undefined>, data: ChartDataPoint[]): void {
    const colors = this.colorSchemes[this.themeMode];
    
    // Ensure minimum container dimensions and safe radius calculation
    const minDimension = 200;
    const safeWidth = Math.max(minDimension, this.chartWidth);
    const safeHeight = Math.max(minDimension, this.chartHeight);
    
    // Calculate radius with proper bounds checking
    const maxRadius = Math.min(safeWidth, safeHeight) / 2;
    const marginBuffer = 80; // Space for labels and margins
    const radius = Math.max(60, maxRadius - marginBuffer);
    
    const centerX = safeWidth / 2;
    const centerY = safeHeight / 2;

    // Move to center with safe positioning
    g.attr('transform', `translate(${centerX}, ${centerY})`);

    const angleSlice = (Math.PI * 2) / data.length;
    const maxValue = d3.max(data, d => Math.max(0, d.value)) || 1;

    // Create scales with bounds checking
    const rScale = d3.scaleLinear()
      .domain([0, maxValue])
      .range([0, radius]);

    // Draw grid circles with radius validation
    const levels = 5;
    for (let i = 1; i <= levels; i++) {
      const gridRadius = (radius / levels) * i;
      if (gridRadius > 0) {
        g.append('circle')
          .attr('r', gridRadius)
          .attr('fill', 'none')
          .attr('stroke', colors.grid)
          .attr('stroke-width', 1)
          .attr('opacity', 0.3);
      }
    }

    // Draw axes and labels
    data.forEach((d, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      g.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', x)
        .attr('y2', y)
        .attr('stroke', colors.grid)
        .attr('stroke-width', 1)
        .attr('opacity', 0.5);

      // Add labels with better positioning
      const labelRadius = radius + 25;
      const labelX = Math.cos(angle) * labelRadius;
      const labelY = Math.sin(angle) * labelRadius;
      
      g.append('text')
        .attr('x', labelX)
        .attr('y', labelY)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', colors.text)
        .attr('font-size', '11px')
        .attr('font-weight', '500')
        .text(d.label);
    });

    // Draw data polygon with value clamping
    const lineGenerator = d3.lineRadial<ChartDataPoint>()
      .angle((d, i) => angleSlice * i)
      .radius(d => {
        const clampedValue = Math.max(0, Math.min(maxValue, d.value));
        return Math.max(0, rScale(clampedValue));
      })
      .curve(d3.curveLinearClosed);

    g.append('path')
      .datum(data)
      .attr('d', lineGenerator)
      .attr('fill', colors.primary[0])
      .attr('fill-opacity', 0.3)
      .attr('stroke', colors.primary[0])
      .attr('stroke-width', 2);

    // Add data points with bounds checking
    data.forEach((d, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const clampedValue = Math.max(0, Math.min(maxValue, d.value));
      const pointRadius = Math.max(0, rScale(clampedValue));
      const x = Math.cos(angle) * pointRadius;
      const y = Math.sin(angle) * pointRadius;

      g.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 4)
        .attr('fill', colors.primary[0])
        .attr('stroke', colors.background)
        .attr('stroke-width', 2)
        .on('mouseover', (event) => this.showTooltip(event, d))
        .on('mouseout', () => this.hideTooltip());
    });

    // Add center point for reference
    g.append('circle')
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', 2)
      .attr('fill', colors.text)
      .attr('opacity', 0.5);
  }

  private drawHeatmap(g: d3.Selection<SVGGElement, unknown, null, undefined>, data: ChartDataPoint[]): void {
    const colors = this.colorSchemes[this.themeMode];
    const gridSize = Math.min(this.chartWidth, this.chartHeight) / Math.ceil(Math.sqrt(data.length));

    const colorScale = d3.scaleSequential(d3.interpolateBlues)
      .domain([0, d3.max(data, d => d.value) || 1]);

    data.forEach((d, i) => {
      const row = Math.floor(i / Math.ceil(Math.sqrt(data.length)));
      const col = i % Math.ceil(Math.sqrt(data.length));

      g.append('rect')
        .attr('x', col * gridSize)
        .attr('y', row * gridSize)
        .attr('width', gridSize - 1)
        .attr('height', gridSize - 1)
        .attr('fill', colorScale(d.value))
        .on('mouseover', (event) => this.showTooltip(event, d))
        .on('mouseout', () => this.hideTooltip());
    });
  }

  private drawNetworkGraph(g: d3.Selection<SVGGElement, unknown, null, undefined>, data: ChartDataPoint[]): void {
    // Simplified network visualization
    const colors = this.colorSchemes[this.themeMode];
    
    data.forEach((d, i) => {
      const x = (i % 5) * (this.chartWidth / 5) + 50;
      const y = Math.floor(i / 5) * (this.chartHeight / 3) + 50;
      
      g.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', Math.sqrt(d.value) * 2 + 5)
        .attr('fill', colors.primary[i % colors.primary.length])
        .attr('fill-opacity', 0.7)
        .on('mouseover', (event) => this.showTooltip(event, d))
        .on('mouseout', () => this.hideTooltip());
        
      g.append('text')
        .attr('x', x)
        .attr('y', y + 25)
        .attr('text-anchor', 'middle')
        .attr('fill', colors.text)
        .attr('font-size', '10px')
        .text(d.label);
    });
  }

  private drawLineChart(g: d3.Selection<SVGGElement, unknown, null, undefined>, data: ChartDataPoint[]): void {
    const colors = this.colorSchemes[this.themeMode];

    // Scales
    const xScale = d3.scalePoint()
      .domain(data.map(d => d.label))
      .range([0, this.chartWidth]);

    const yScale = d3.scaleLinear()
      .domain(d3.extent(data, d => d.value) as [number, number])
      .range([this.chartHeight, 0]);

    // Line generator
    const line = d3.line<ChartDataPoint>()
      .x(d => xScale(d.label)!)
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX);

    // Draw line
    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', colors.primary[0])
      .attr('stroke-width', 2)
      .attr('d', line);

    // Draw points
    g.selectAll('.dot')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('cx', d => xScale(d.label)!)
      .attr('cy', d => yScale(d.value))
      .attr('r', 4)
      .attr('fill', colors.primary[0])
      .on('mouseover', (event, d) => this.showTooltip(event, d))
      .on('mouseout', () => this.hideTooltip());
  }

  private drawScatterPlot(g: d3.Selection<SVGGElement, unknown, null, undefined>, data: ChartDataPoint[]): void {
    const colors = this.colorSchemes[this.themeMode];

    // Scales
    const xScale = d3.scaleLinear()
      .domain([0, data.length - 1])
      .range([0, this.chartWidth]);

    const yScale = d3.scaleLinear()
      .domain(d3.extent(data, d => d.value) as [number, number])
      .range([this.chartHeight, 0]);

    // Draw points
    g.selectAll('.dot')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('cx', (d, i) => xScale(i))
      .attr('cy', d => yScale(d.value))
      .attr('r', 6)
      .attr('fill', (d, i) => colors.primary[i % colors.primary.length])
      .attr('fill-opacity', 0.7)
      .on('mouseover', (event, d) => this.showTooltip(event, d))
      .on('mouseout', () => this.hideTooltip());
  }

  private showTooltip(event: MouseEvent, data: ChartDataPoint): void {
    const tooltip = d3.select(this.tooltip.nativeElement);
    
    tooltip
      .style('opacity', 1)
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY - 10) + 'px')
      .html(`
        <strong>${data.label}</strong><br/>
        Value: ${data.value.toFixed(2)}<br/>
        ${data.category ? `Category: ${data.category}` : ''}
      `);
  }

  private hideTooltip(): void {
    d3.select(this.tooltip.nativeElement)
      .style('opacity', 0);
  }

  private updateLegend(data: ChartDataPoint[]): void {
    if (!this.showLegend || !this.legend) return;

    const colors = this.colorSchemes[this.themeMode];
    const legend = d3.select(this.legend.nativeElement);
    legend.selectAll('*').remove();

    const legendItems = legend.selectAll('.legend-item')
      .data(data.slice(0, 6)) // Limit to 6 items
      .enter()
      .append('div')
      .attr('class', 'legend-item')
      .style('display', 'inline-flex')
      .style('align-items', 'center')
      .style('margin-right', '12px')
      .style('margin-bottom', '4px');

    legendItems.append('div')
      .style('width', '12px')
      .style('height', '12px')
      .style('background-color', (d, i) => colors.primary[i % colors.primary.length])
      .style('margin-right', '6px')
      .style('border-radius', '2px');

    legendItems.append('span')
      .style('font-size', '0.85em')
      .style('color', colors.text)
      .text(d => d.label);
  }
}