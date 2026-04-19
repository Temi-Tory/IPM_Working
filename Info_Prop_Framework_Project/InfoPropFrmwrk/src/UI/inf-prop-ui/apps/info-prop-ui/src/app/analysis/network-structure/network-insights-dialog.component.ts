import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA, MatDialogConfig, MatDialogContainer } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { from } from 'rxjs';

interface NetworkInsightsData {
  networkData: any;
  topologyInsights: Array<{type: 'info' | 'warning' | 'success', message: string, detail: string}>;
  structuralMetrics: any;
  performanceData?: {
    computation_time: number;
    processing_rate: number;
    estimated_memory_kb: number;
  };
}

@Component({
  selector: 'app-network-insights-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatCardModule,
    MatChipsModule
  ],
  template: `
    <div class="insights-dialog">
      <div mat-dialog-title class="dialog-header">
        <mat-icon class="dialog-icon">insights</mat-icon>
        <h2>Network Structure Analysis</h2>
        <button mat-icon-button mat-dialog-close class="close-button">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div mat-dialog-content class="dialog-content">
        <mat-tab-group>
          
          <!-- Structural Insights Tab -->
          <mat-tab label="Insights">
            <div class="tab-content">
              <div class="insights-section">
                <h3>Topology Analysis</h3>
                @if (data.topologyInsights.length > 0) {
                  <div class="insights-list">
                    @for (insight of data.topologyInsights; track insight.message) {
                      <div class="insight-card" [class]="'insight-' + insight.type">
                        <div class="insight-header">
                          <mat-icon class="insight-icon">
                            @switch (insight.type) {
                              @case ('success') { check_circle }
                              @case ('warning') { warning }
                              @case ('info') { info }
                              @default { help }
                            }
                          </mat-icon>
                          <h4>{{ insight.message }}</h4>
                        </div>
                        <p class="insight-detail">{{ insight.detail }}</p>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="no-insights">
                    <mat-icon>info</mat-icon>
                    <p>No specific structural insights available</p>
                  </div>
                }
              </div>
            </div>
          </mat-tab>

          <!-- Detailed Metrics Tab -->
          <mat-tab label="Metrics">
            <div class="tab-content">
              @if (data.structuralMetrics; as metrics) {
                <div class="metrics-grid">
                  <div class="metric-card">
                    <div class="metric-header">
                      <mat-icon>device_hub</mat-icon>
                      <h4>Connectivity</h4>
                    </div>
                    <div class="metric-details">
                      <div class="metric-row">
                        <span>Edge/Node Ratio:</span>
                        <span class="metric-value">{{ metrics.edge_to_node_ratio }}</span>
                      </div>
                      <div class="metric-row">
                        <span>Average Degree:</span>
                        <span class="metric-value">{{ metrics.average_degree }}</span>
                      </div>
                      <div class="metric-row">
                        <span>Network Density:</span>
                        <span class="metric-value">{{ metrics.network_density }}%</span>
                      </div>
                    </div>
                  </div>

                  <div class="metric-card">
                    <div class="metric-header">
                      <mat-icon>layers</mat-icon>
                      <h4>Structure</h4>
                    </div>
                    <div class="metric-details">
                      <div class="metric-row">
                        <span>Layer Efficiency:</span>
                        <span class="metric-value">{{ metrics.layer_efficiency }} nodes/layer</span>
                      </div>
                      <div class="metric-row">
                        <span>Boundary Nodes:</span>
                        <span class="metric-value">{{ metrics.boundary_node_ratio }}%</span>
                      </div>
                      <div class="metric-row">
                        <span>Complexity Score:</span>
                        <span class="metric-value">{{ metrics.structural_complexity }}/10</span>
                      </div>
                    </div>
                  </div>
                </div>
              }
            </div>
          </mat-tab>

          <!-- Scale Analysis Tab -->
          <mat-tab label="Scale Analysis">
            <div class="tab-content">
              <div class="scale-analysis">
                <h3>DAG Scale Characteristics</h3>
                
                <div class="scale-cards">
                  <div class="scale-card">
                    <div class="scale-header">
                      <mat-icon>account_tree</mat-icon>
                      <h4>Network Size</h4>
                    </div>
                    <div class="scale-content">
                      <div class="size-indicator" [class]="getSizeClass()">
                        {{ getSizeDescription() }}
                      </div>
                      <div class="size-details">
                        <p><strong>{{ data.networkData.total_nodes }}</strong> nodes, <strong>{{ data.networkData.total_edges }}</strong> edges</p>
                        <p>{{ getScaleRecommendations() }}</p>
                      </div>
                    </div>
                  </div>

                  <div class="scale-card">
                    <div class="scale-header">
                      <mat-icon>speed</mat-icon>
                      <h4>Processing Characteristics</h4>
                    </div>
                    <div class="scale-content">
                      @if (data.performanceData; as perf) {
                        <div class="performance-metrics">
                          <div class="perf-row">
                            <span>Analysis Time:</span>
                            <span>{{ perf.computation_time.toFixed(2) }}ms</span>
                          </div>
                          <div class="perf-row">
                            <span>Processing Rate:</span>
                            <span>{{ perf.processing_rate.toFixed(1) }} elements/ms</span>
                          </div>
                          <div class="perf-row">
                            <span>Est. Memory:</span>
                            <span>{{ perf.estimated_memory_kb.toFixed(1) }}KB</span>
                          </div>
                        </div>
                      }
                      <div class="processing-tips">
                        <h5>Optimization Tips:</h5>
                        <ul>
                          {{ getProcessingTips() }}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </mat-tab>

        </mat-tab-group>
      </div>

      <div mat-dialog-actions class="dialog-actions">
        <button mat-button mat-dialog-close>Close</button>
        <button mat-raised-button color="primary" (click)="exportInsights()">
          <mat-icon>download</mat-icon>
          Export Analysis
        </button>
      </div>
    </div>
  `,
  styles: [`
    .insights-dialog {
      width: 800px;
      max-width: 90vw;
      max-height: 80vh;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin: 0;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #e0e0e0;

      .dialog-icon {
        color: #1976d2;
        font-size: 1.5rem;
      }

      h2 {
        flex: 1;
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
      }

      .close-button {
        margin-left: auto;
      }
    }

    .dialog-content {
      padding: 0;
      max-height: 60vh;
      overflow-y: auto;
    }

    .tab-content {
      padding: 1.5rem;
    }

    .insights-section h3 {
      margin: 0 0 1rem 0;
      color: #333;
      font-size: 1.1rem;
      font-weight: 600;
    }

    .insights-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .insight-card {
      padding: 1rem;
      border-radius: 8px;
      border-left: 4px solid;

      &.insight-success {
        background: #f1f8e9;
        border-left-color: #4caf50;
      }

      &.insight-warning {
        background: #fff8e1;
        border-left-color: #ff9800;
      }

      &.insight-info {
        background: #e3f2fd;
        border-left-color: #2196f3;
      }

      .insight-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.5rem;

        .insight-icon {
          font-size: 1.25rem;
        }

        h4 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
        }
      }

      .insight-detail {
        margin: 0;
        color: #666;
        line-height: 1.4;
        margin-left: 2rem;
      }
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
    }

    .metric-card {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 1.5rem;

      .metric-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1rem;

        mat-icon {
          color: #1976d2;
        }

        h4 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
        }
      }

      .metric-details {
        .metric-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0;
          border-bottom: 1px solid #e0e0e0;

          &:last-child {
            border-bottom: none;
          }

          .metric-value {
            font-weight: 600;
            color: #1976d2;
            font-family: 'Roboto Mono', monospace;
          }
        }
      }
    }

    .scale-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 1.5rem;
    }

    .scale-card {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 1.5rem;

      .scale-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1rem;

        mat-icon {
          color: #1976d2;
        }

        h4 {
          margin: 0;
          font-weight: 600;
        }
      }

      .size-indicator {
        padding: 0.5rem 1rem;
        border-radius: 20px;
        font-weight: 600;
        text-align: center;
        margin-bottom: 1rem;

        &.small { background: #e8f5e8; color: #2e7d32; }
        &.medium { background: #fff3e0; color: #f57c00; }
        &.large { background: #ffebee; color: #c62828; }
        &.very-large { background: #f3e5f5; color: #7b1fa2; }
      }

      .size-details p {
        margin: 0.5rem 0;
        color: #666;
      }

      .performance-metrics {
        margin-bottom: 1rem;

        .perf-row {
          display: flex;
          justify-content: space-between;
          padding: 0.25rem 0;
          font-family: 'Roboto Mono', monospace;
          font-size: 0.9rem;
        }
      }

      .processing-tips {
        h5 {
          margin: 0 0 0.5rem 0;
          font-size: 0.9rem;
          font-weight: 600;
        }

        ul {
          margin: 0;
          padding-left: 1.25rem;
          font-size: 0.85rem;
          color: #666;
        }
      }
    }

    .no-insights {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      color: #999;
      font-style: italic;
      justify-content: center;
      padding: 2rem;

      mat-icon {
        font-size: 1.5rem;
      }
    }

    .dialog-actions {
      padding: 1rem 1.5rem;
      border-top: 1px solid #e0e0e0;
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
    }
  `]
})
export class NetworkInsightsDialogComponent {
  public dialogRef = inject(MatDialogRef<NetworkInsightsDialogComponent>);
  public data: NetworkInsightsData = inject(MAT_DIALOG_DATA);

  getSizeClass(): string {
    const nodes = this.data.networkData.total_nodes;
    if (nodes < 50) return 'small';
    if (nodes < 200) return 'medium';
    if (nodes < 1000) return 'large';
    return 'very-large';
  }

  getSizeDescription(): string {
    const nodes = this.data.networkData.total_nodes;
    if (nodes < 50) return 'Small DAG';
    if (nodes < 200) return 'Medium DAG';
    if (nodes < 1000) return 'Large DAG';
    return 'Very Large DAG';
  }

  getScaleRecommendations(): string {
    const nodes = this.data.networkData.total_nodes;
    if (nodes < 50) {
      return 'Ideal for detailed analysis and visualization. All features available.';
    } else if (nodes < 200) {
      return 'Good balance of detail and performance. Consider filtering for focused analysis.';
    } else if (nodes < 1000) {
      return 'Large network - use filters and pagination for optimal performance.';
    } else {
      return 'Very large network - strongly recommend using filters and consider chunked analysis.';
    }
  }

  getProcessingTips(): string {
    const nodes = this.data.networkData.total_nodes;
    const tips = [];
    
    if (nodes > 500) {
      tips.push('Use node type filters to focus on specific regions');
      tips.push('Enable pagination for large data tables');
    }
    
    if (nodes > 1000) {
      tips.push('Consider analyzing subgraphs separately');
      tips.push('Use degree range filters to identify key nodes');
    }
    
    if (this.data.networkData.iteration_sets_count > 10) {
      tips.push('Layer-based analysis recommended for deep DAGs');
    }
    
    return tips.length > 0 ? tips.join('; ') : 'Network size is optimal for all analysis features';
  }

  exportInsights(): void {
    const insights = {
      network_summary: {
        nodes: this.data.networkData.total_nodes,
        edges: this.data.networkData.total_edges,
        layers: this.data.networkData.iteration_sets_count
      },
      structural_metrics: this.data.structuralMetrics,
      topology_insights: this.data.topologyInsights,
      scale_analysis: {
        size_class: this.getSizeClass(),
        recommendations: this.getScaleRecommendations(),
        processing_tips: this.getProcessingTips()
      }
    };

    const blob = new Blob([JSON.stringify(insights, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'network-structure-analysis.json';
    link.click();
    window.URL.revokeObjectURL(url);
  }
}

