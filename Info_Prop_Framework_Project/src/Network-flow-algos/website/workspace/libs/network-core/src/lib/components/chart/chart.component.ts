import { Component, Input, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'lib-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart-container">
      <canvas #chartCanvas></canvas>
    </div>
  `,
  styles: [`
    .chart-container {
      position: relative;
      width: 100%;
      height: 400px;
    }

    canvas {
      max-width: 100%;
      max-height: 100%;
    }
  `]
})
export class ChartComponent implements AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas', { static: true }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  
  @Input() type: ChartType = 'line';
  @Input() data: any = {};
  @Input() options: any = {};
  @Input() height = 400;

  private chart: Chart | null = null;

  ngAfterViewInit() {
    this.createChart();
  }

  ngOnDestroy() {
    if (this.chart) {
      this.chart.destroy();
    }
  }

  private createChart() {
    if (!this.chartCanvas?.nativeElement) {
      return;
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) {
      return;
    }

    const config: ChartConfiguration = {
      type: this.type,
      data: this.data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...this.options
      }
    };

    this.chart = new Chart(ctx, config);
  }

  updateChart(newData: any, newOptions?: any) {
    if (this.chart) {
      this.chart.data = newData;
      if (newOptions) {
        this.chart.options = { ...this.chart.options, ...newOptions };
      }
      this.chart.update();
    }
  }

  updateData(newData: any) {
    if (this.chart) {
      this.chart.data = newData;
      this.chart.update();
    }
  }

  updateOptions(newOptions: any) {
    if (this.chart) {
      this.chart.options = { ...this.chart.options, ...newOptions };
      this.chart.update();
    }
  }
}