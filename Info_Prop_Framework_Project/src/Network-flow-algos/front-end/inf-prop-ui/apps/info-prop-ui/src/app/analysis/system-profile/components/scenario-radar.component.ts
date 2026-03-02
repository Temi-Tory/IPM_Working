import {
  Component, input, ElementRef, ViewChild,
  AfterViewInit, OnChanges, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';

export interface RadarDataset {
  name: string;
  values: number[];
  color: string;
}

@Component({
  selector: 'app-scenario-radar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="radar-wrapper">
      <div class="radar-title">{{ datasetName() }}</div>
      <div #radarChart class="radar-chart"></div>
    </div>
  `,
  styles: [`
    .radar-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }

    .radar-title {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-primary);
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      text-align: center;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .radar-chart {
      width: 240px;
      height: 240px;
    }
  `]
})
export class ScenarioRadarComponent implements AfterViewInit, OnChanges {
  axes = input.required<string[]>();
  dataset = input.required<RadarDataset>();
  datasetName = input.required<string>();

  @ViewChild('radarChart') chartRef!: ElementRef;

  ngAfterViewInit(): void {
    this.renderRadar();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.chartRef) {
      this.renderRadar();
    }
  }

  private renderRadar(): void {
    const el = this.chartRef?.nativeElement;
    if (!el) return;

    const axisLabels = this.axes();
    const ds = this.dataset();
    if (!axisLabels.length || !ds.values.length) return;

    d3.select(el).selectAll('*').remove();

    const size = 240;
    const margin = 40;
    const radius = (size - margin * 2) / 2;
    const cx = size / 2;
    const cy = size / 2;
    const n = axisLabels.length;
    const angleSlice = (2 * Math.PI) / n;

    const svg = d3.select(el)
      .append('svg')
      .attr('width', size)
      .attr('height', size);

    const g = svg.append('g')
      .attr('transform', `translate(${cx},${cy})`);

    const textColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--text-secondary').trim() || '#657b83';
    const gridColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--outline-variant').trim() || '#eee8d5';

    // Grid rings
    const levels = 4;
    for (let level = 1; level <= levels; level++) {
      const r = (radius * level) / levels;
      const points = axisLabels.map((_, i) => {
        const angle = angleSlice * i - Math.PI / 2;
        return `${r * Math.cos(angle)},${r * Math.sin(angle)}`;
      });
      g.append('polygon')
        .attr('points', points.join(' '))
        .attr('fill', 'none')
        .attr('stroke', gridColor)
        .attr('stroke-width', 0.5)
        .attr('stroke-dasharray', level < levels ? '2,2' : 'none');
    }

    // Axis lines and labels
    axisLabels.forEach((label, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);

      g.append('line')
        .attr('x1', 0).attr('y1', 0)
        .attr('x2', x).attr('y2', y)
        .attr('stroke', gridColor)
        .attr('stroke-width', 0.5);

      const labelX = (radius + 14) * Math.cos(angle);
      const labelY = (radius + 14) * Math.sin(angle);

      g.append('text')
        .attr('x', labelX)
        .attr('y', labelY)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .style('font-size', '9px')
        .style('fill', textColor)
        .text(label);
    });

    // Data polygon
    const values = ds.values;
    const dataPoints = values.map((v, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const r = radius * Math.max(0, Math.min(1, v));
      return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
    });

    // Fill
    g.append('polygon')
      .attr('points', dataPoints.map(p => `${p.x},${p.y}`).join(' '))
      .attr('fill', ds.color)
      .attr('fill-opacity', 0.2)
      .attr('stroke', ds.color)
      .attr('stroke-width', 2);

    // Data points
    dataPoints.forEach((p, i) => {
      const group = g.append('g').attr('transform', `translate(${p.x},${p.y})`);

      group.append('circle')
        .attr('r', 3.5)
        .attr('fill', ds.color)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1);

      // Tooltip on hover
      group.append('title')
        .text(`${axisLabels[i]}: ${values[i].toFixed(2)}`);
    });
  }
}
