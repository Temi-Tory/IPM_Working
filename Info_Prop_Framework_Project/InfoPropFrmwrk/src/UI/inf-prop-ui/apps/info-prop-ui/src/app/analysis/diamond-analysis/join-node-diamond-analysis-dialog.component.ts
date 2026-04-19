import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

interface JoinNodeAnalysisData {
  nodeId: number;
  diamondCount: number;
  centralityScore: number;
  convergencePatterns: string[];
  isBottleneck: boolean;
  pathCount?: number;
  riskLevel?: 'low' | 'medium' | 'high';
}

@Component({
  selector: 'app-join-node-diamond-analysis-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatListModule,
    MatTabsModule,
    MatTooltipModule
  ],
  template: `
    <div class="join-node-analysis-dialog">
      <mat-dialog-content>
        <div class="dialog-header">
          <div class="header-icon">
            <mat-icon class="node-icon">device_hub</mat-icon>
          </div>
          <div class="header-content">
            <h2>Join Node {{ data.nodeId }} Analysis</h2>
            <p class="header-subtitle">Diamond participation and convergence analysis</p>
          </div>
          <div class="header-metrics">
            <div class="metric-chip" [class]="data.isBottleneck ? 'bottleneck' : 'normal'">
              <mat-icon>{{ data.isBottleneck ? 'warning' : 'check_circle' }}</mat-icon>
              {{ data.isBottleneck ? 'Bottleneck' : 'Normal Flow' }}
            </div>
          </div>
        </div>

        <div class="analysis-content">
          <!-- Key Metrics -->
          <mat-card class="metrics-card">
            <mat-card-header>
              <mat-icon mat-card-avatar>analytics</mat-icon>
              <mat-card-title>Join Node Metrics</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="metrics-grid">
                <div class="metric-item">
                  <div class="metric-value">{{ data.diamondCount }}</div>
                  <div class="metric-label">Diamond Patterns</div>
                </div>
                <div class="metric-item">
                  <div class="metric-value">{{ data.centralityScore | number:'1.2-2' }}</div>
                  <div class="metric-label">Centrality Score</div>
                </div>
                <div class="metric-item">
                  <div class="metric-value">{{ data.convergencePatterns.length }}</div>
                  <div class="metric-label">Convergence Patterns</div>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Convergence Patterns -->
          <mat-card class="patterns-card">
            <mat-card-header>
              <mat-icon mat-card-avatar>merge_type</mat-icon>
              <mat-card-title>Convergence Patterns</mat-card-title>
              <mat-card-subtitle>Path convergence patterns for this join node</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              @if (data.convergencePatterns.length > 0) {
                <div class="patterns-list">
                  @for (pattern of data.convergencePatterns; track pattern) {
                    <div class="pattern-item">
                      <mat-icon>arrow_forward</mat-icon>
                      <span class="pattern-text">{{ pattern }}</span>
                    </div>
                  }
                </div>
              } @else {
                <div class="no-patterns">
                  <mat-icon>info</mat-icon>
                  <p>No specific convergence patterns identified</p>
                </div>
              }
            </mat-card-content>
          </mat-card>

          <!-- Analysis Insights -->
          <mat-card class="insights-card">
            <mat-card-header>
              <mat-icon mat-card-avatar>lightbulb</mat-icon>
              <mat-card-title>Analysis Insights</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="insights-list">
                @if (data.isBottleneck) {
                  <div class="insight-item warning">
                    <mat-icon>warning</mat-icon>
                    <div class="insight-content">
                      <h4>Potential Bottleneck</h4>
                      <p>This join node receives paths from {{ data.diamondCount }} diamond patterns, creating a potential bottleneck point.</p>
                    </div>
                  </div>
                }
                
                @if (data.centralityScore > 0.7) {
                  <div class="insight-item info">
                    <mat-icon>hub</mat-icon>
                    <div class="insight-content">
                      <h4>High Centrality Score</h4>
                      <p>This node has a high centrality score ({{ data.centralityScore | number:'1.2-2' }}), indicating its importance in the network flow.</p>
                    </div>
                  </div>
                }
                
                @if (data.convergencePatterns.length > 1) {
                  <div class="insight-item info">
                    <mat-icon>merge_type</mat-icon>
                    <div class="insight-content">
                      <h4>Multiple Convergence Patterns</h4>
                      <p>Node participates in {{ data.convergencePatterns.length }} different convergence patterns.</p>
                    </div>
                  </div>
                }

                @if (data.riskLevel) {
                  <div class="insight-item" [class]="'risk-' + data.riskLevel">
                    <mat-icon>{{ data.riskLevel === 'high' ? 'error' : data.riskLevel === 'medium' ? 'warning' : 'check_circle' }}</mat-icon>
                    <div class="insight-content">
                      <h4>Risk Assessment</h4>
                      <p>This join node has a {{ data.riskLevel }} risk level based on its diamond participation patterns.</p>
                    </div>
                  </div>
                }
              </div>
            </mat-card-content>
          </mat-card>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button (click)="viewInNetworkStructure()" color="primary">
          <mat-icon>hub</mat-icon>
          View in Network
        </button>
        <button mat-button (click)="close()">Close</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .join-node-analysis-dialog {
      max-width: 800px;
      width: 100%;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.5rem 1.5rem 1rem;
      border-bottom: 1px solid var(--border-color);
      
      .header-icon {
        .node-icon {
          font-size: 2.5rem;
          width: 2.5rem;
          height: 2.5rem;
          color: var(--primary-color);
        }
      }
      
      .header-content {
        flex: 1;
        
        h2 {
          margin: 0 0 0.25rem 0;
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        
        .header-subtitle {
          margin: 0;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }
      }
      
      .header-metrics {
        .metric-chip {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          font-weight: 500;
          font-size: 0.9rem;
          
          &.bottleneck {
            background: rgba(244, 67, 54, 0.1);
            color: var(--error-color);
            border: 1px solid var(--error-color);
          }
          
          &.normal {
            background: rgba(76, 175, 80, 0.1);
            color: var(--success-color);
            border: 1px solid var(--success-color);
          }
        }
      }
    }

    .analysis-content {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .metrics-card {
      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
        
        .metric-item {
          text-align: center;
          
          .metric-value {
            font-size: 2rem;
            font-weight: 700;
            color: var(--primary-color);
            font-family: 'Monaco', 'Menlo', monospace;
            margin-bottom: 0.5rem;
          }
          
          .metric-label {
            font-size: 0.8rem;
            color: var(--text-secondary);
            text-transform: uppercase;
            font-weight: 500;
          }
        }
      }
    }

    .diamonds-card {
      .diamonds-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        
        .diamond-item {
          padding: 1rem;
          border-radius: 8px;
          border-left: 4px solid;
          
          &.risk-high { 
            border-left-color: var(--error-color); 
            background: rgba(244, 67, 54, 0.02);
          }
          &.risk-medium { 
            border-left-color: var(--warning-color); 
            background: rgba(255, 152, 0, 0.02);
          }
          &.risk-low { 
            border-left-color: var(--success-color); 
            background: rgba(76, 175, 80, 0.02);
          }
          
          .diamond-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.75rem;
            
            .diamond-id {
              display: flex;
              align-items: center;
              gap: 0.5rem;
              font-weight: 600;
              color: var(--text-primary);
              
              mat-icon {
                color: var(--primary-color);
              }
            }
            
            .risk-chip-high { background: var(--error-color); color: white; }
            .risk-chip-medium { background: var(--warning-color); color: white; }
            .risk-chip-low { background: var(--success-color); color: white; }
          }
          
          .diamond-details {
            .detail-row {
              display: flex;
              align-items: center;
              gap: 1rem;
              margin-bottom: 0.5rem;
              
              .detail-label {
                font-weight: 500;
                color: var(--text-secondary);
                min-width: 120px;
              }
              
              .detail-value {
                font-family: 'Monaco', 'Menlo', monospace;
                color: var(--primary-color);
                font-weight: 600;
              }
              
              .conditioning-nodes {
                display: flex;
                flex-wrap: wrap;
                gap: 0.25rem;
                
                .conditioning-chip {
                  background: var(--primary-color);
                  color: white;
                  font-size: 0.75rem;
                  cursor: pointer;
                  
                  &:hover {
                    background: var(--primary-color-dark);
                  }
                }
                
                .no-conditioning {
                  color: var(--text-disabled);
                  font-style: italic;
                }
              }
            }
          }
        }
      }
      
      .no-diamonds {
        text-align: center;
        padding: 2rem;
        color: var(--text-secondary);
        
        mat-icon {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }
      }
    }

    .insights-card {
      .insights-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        
        .insight-item {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          border-radius: 8px;
          
          &.warning {
            background: rgba(244, 67, 54, 0.05);
            border-left: 4px solid var(--error-color);
          }
          
          &.info {
            background: rgba(33, 150, 243, 0.05);
            border-left: 4px solid var(--primary-color);
          }
          
          mat-icon {
            margin-top: 0.1rem;
            flex-shrink: 0;
          }
          
          .insight-content {
            h4 {
              margin: 0 0 0.5rem 0;
              font-size: 1rem;
              font-weight: 600;
              color: var(--text-primary);
            }
            
            p {
              margin: 0;
              color: var(--text-secondary);
              line-height: 1.4;
            }
          }
        }
      }
    }
  `]
})
export class JoinNodeDiamondAnalysisDialogComponent {
  public dialogRef = inject(MatDialogRef<JoinNodeDiamondAnalysisDialogComponent>);
  public data = inject<JoinNodeAnalysisData>(MAT_DIALOG_DATA);

  viewInNetworkStructure(): void {
    this.dialogRef.close({ action: 'viewInNetwork', nodeId: this.data.nodeId });
  }

  close(): void {
    this.dialogRef.close();
  }
}