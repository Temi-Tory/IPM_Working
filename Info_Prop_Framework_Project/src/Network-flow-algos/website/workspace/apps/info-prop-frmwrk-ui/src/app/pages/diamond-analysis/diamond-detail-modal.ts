import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { Router } from '@angular/router';

import { DiamondClassification, DiamondStructureData } from '../../shared/models/main-sever-interface';

interface DiamondDetailModalData {
  diamond: DiamondClassification & { diamondStructure: DiamondStructureData };
}

@Component({
  selector: 'app-diamond-detail-modal',
  standalone: true,
  imports: [
    CommonModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatTooltipModule, MatDividerModule, MatChipsModule
  ],
  template: `
    <div class="modal-header">
      <h2 mat-dialog-title>
        <mat-icon>diamond</mat-icon>
        Diamond Details - Join Node {{ data.diamond.join_node }}
      </h2>
      <button mat-icon-button mat-dialog-close class="close-btn">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-dialog-content class="modal-content">
      <!-- Diamond Overview -->
      <div class="detail-section overview-section">
        <h3>💎 Diamond Overview</h3>
        <div class="overview-grid">
          <div class="overview-card primary">
            <div class="card-icon">🎯</div>
            <div class="card-content">
              <span class="card-value">{{ data.diamond.join_node }}</span>
              <span class="card-label">Join Node</span>
            </div>
          </div>
          <div class="overview-card complexity tooltip">
            <div class="card-icon">🧮</div>
            <div class="card-content">
              <span class="card-value" [style.color]="getComplexityColor(data.diamond.complexity_score)">
                {{ data.diamond.complexity_score.toFixed(1) }}
              </span>
              <span class="card-label">
                Complexity Score
                <mat-icon class="info-icon" matTooltip="Click for detailed explanation">help_outline</mat-icon>
              </span>
            </div>
            <div class="tooltiptext">
              <strong>Complexity Score Formula:</strong><br>
              (Nodes × Forks) + (Internal Decision Points × 2) + Edge Density<br><br>
              <strong>Components:</strong><br>
              • <strong>Base:</strong> Network size × fork complexity<br>
              • <strong>Internal:</strong> Nested decision points (weighted 2×)<br>
              • <strong>Density:</strong> How interconnected the diamond is<br><br>
              <strong>Higher scores</strong> indicate more computational complexity and potential bottlenecks
            </div>
          </div>
          <div class="overview-card">
            <div class="card-icon">📏</div>
            <div class="card-content">
              <span class="card-value">{{ data.diamond.subgraph_size }}</span>
              <span class="card-label">Nodes</span>
            </div>
          </div>
          <div class="overview-card">
            <div class="card-icon">🛤️</div>
            <div class="card-content">
              <span class="card-value">{{ data.diamond.path_count }}</span>
              <span class="card-label">Paths</span>
            </div>
          </div>
        </div>
      </div>

      <mat-divider></mat-divider>

      <!-- Classification Details -->
      <div class="detail-section">
        <h3>🔍 Classification Details</h3>
        <div class="classification-grid">
          <div class="classification-item">
            <div class="item-header">
              <mat-icon>account_tree</mat-icon>
              <span class="item-title">Fork Structure</span>
            </div>
            <div class="item-content">
              <mat-chip-set>
                <mat-chip [highlighted]="true" class="structure-chip">
                  {{ data.diamond.fork_structure }}
                </mat-chip>
              </mat-chip-set>
              <p class="item-description">{{ getForkStructureDescription(data.diamond.fork_structure) }}</p>
            </div>
          </div>

          <div class="classification-item">
            <div class="item-header">
              <mat-icon>hub</mat-icon>
              <span class="item-title">Internal Structure</span>
            </div>
            <div class="item-content">
              <mat-chip-set>
                <mat-chip [highlighted]="true" class="structure-chip">
                  {{ data.diamond.internal_structure }}
                </mat-chip>
              </mat-chip-set>
              <p class="item-description">{{ getInternalStructureDescription(data.diamond.internal_structure) }}</p>
            </div>
          </div>

          <div class="classification-item">
            <div class="item-header">
              <mat-icon>route</mat-icon>
              <span class="item-title">Path Topology</span>
            </div>
            <div class="item-content">
              <mat-chip-set>
                <mat-chip [highlighted]="true" class="structure-chip">
                  {{ data.diamond.path_topology }}
                </mat-chip>
              </mat-chip-set>
              <p class="item-description">{{ getPathTopologyDescription(data.diamond.path_topology) }}</p>
            </div>
          </div>

          <div class="classification-item">
            <div class="item-header">
              <mat-icon>merge_type</mat-icon>
              <span class="item-title">Join Structure</span>
            </div>
            <div class="item-content">
              <mat-chip-set>
                <mat-chip [highlighted]="true" class="structure-chip">
                  {{ data.diamond.join_structure }}
                </mat-chip>
              </mat-chip-set>
              <p class="item-description">{{ getJoinStructureDescription(data.diamond.join_structure) }}</p>
            </div>
          </div>
        </div>
      </div>

      <mat-divider></mat-divider>

      <!-- Metrics Dashboard -->
      <div class="detail-section">
        <h3>📊 Metrics Dashboard</h3>
        <div class="metrics-dashboard">
          <div class="metrics-row">
            <div class="metric-card tooltip">
              <div class="metric-icon">🍴</div>
              <div class="metric-content">
                <span class="metric-value">{{ data.diamond.fork_count }}</span>
                <span class="metric-label">Fork Count</span>
              </div>
              <div class="tooltiptext">
                Number of fork nodes that create parallel paths in this diamond structure
              </div>
            </div>

            <div class="metric-card tooltip">
              <div class="metric-icon">🔗</div>
              <div class="metric-content">
                <span class="metric-value">{{ (data.diamond.internal_forks || []).length }}</span>
                <span class="metric-label">Internal Forks</span>
              </div>
              <div class="tooltiptext">
                Fork nodes that exist within the diamond structure (not at the entry points)
              </div>
            </div>

            <div class="metric-card tooltip">
              <div class="metric-icon">🎯</div>
              <div class="metric-content">
                <span class="metric-value">{{ (data.diamond.internal_joins || []).length }}</span>
                <span class="metric-label">Internal Joins</span>
              </div>
              <div class="tooltiptext">
                Join nodes that exist within the diamond structure (not the final join node)
              </div>
            </div>
          </div>

          <div class="metrics-row">
            <div class="metric-card risk-card tooltip" [ngClass]="'risk-' + getRiskLevel(data.diamond.bottleneck_risk)">
              <div class="metric-icon">⚠️</div>
              <div class="metric-content">
                <span class="metric-value">{{ data.diamond.bottleneck_risk }}</span>
                <span class="metric-label">Bottleneck Risk</span>
              </div>
              <div class="tooltiptext">
                <strong>Risk Assessment:</strong><br>
                • <strong>Low:</strong> Well-distributed processing load<br>
                • <strong>Medium:</strong> Some potential for congestion<br>
                • <strong>High:</strong> Significant bottleneck potential<br>
                • <strong>Very High:</strong> Critical bottleneck likely
              </div>
            </div>

            <div class="metric-card optimization-card tooltip" [ngClass]="'opt-' + getOptimizationLevel(data.diamond.optimization_potential)">
              <div class="metric-icon">🚀</div>
              <div class="metric-content">
                <span class="metric-value">{{ data.diamond.optimization_potential }}</span>
                <span class="metric-label">Optimization Potential</span>
              </div>
              <div class="tooltiptext">
                <strong>Optimization Potential:</strong><br>
                • <strong>Low:</strong> Already well-optimized<br>
                • <strong>Medium:</strong> Some improvement possible<br>
                • <strong>High:</strong> Significant optimization opportunities<br>
                • <strong>Very High:</strong> Major restructuring recommended
              </div>
            </div>

            <div class="metric-card tooltip">
              <div class="metric-icon">🌐</div>
              <div class="metric-content">
                <span class="metric-value">{{ data.diamond.external_connectivity }}</span>
                <span class="metric-label">External Connectivity</span>
              </div>
              <div class="tooltiptext">
                How this diamond connects to the rest of the network structure
              </div>
            </div>
          </div>
        </div>
      </div>

      <mat-divider></mat-divider>

      <!-- Structure Analysis -->
      <div class="detail-section" *ngIf="data.diamond.diamondStructure">
        <h3>🏗️ Structure Analysis</h3>
        <div class="structure-analysis">
          <div class="structure-item">
            <h4>
              <mat-icon>input</mat-icon>
              Non-Diamond Parents
            </h4>
            <div class="node-chips">
              @for (node of data.diamond.diamondStructure.non_diamond_parents; track node) {
                <mat-chip class="node-chip parent-chip">{{ node }}</mat-chip>
              }
              @if (data.diamond.diamondStructure.non_diamond_parents.length === 0) {
                <span class="no-data">No external parent nodes</span>
              }
            </div>
          </div>

          <div class="structure-item">
            <h4>
              <mat-icon>hub</mat-icon>
              Diamond Groups ({{ data.diamond.diamondStructure.diamond.length }})
            </h4>
            @for (group of data.diamond.diamondStructure.diamond; track $index; let i = $index) {
              <div class="diamond-group">
                <h5>Group {{ i + 1 }}</h5>
                <div class="group-details">
                  <div class="group-section">
                    <span class="section-label">Highest Nodes:</span>
                    <div class="node-chips">
                      @for (node of group.highest_nodes; track node) {
                        <mat-chip class="node-chip highest-chip">{{ node }}</mat-chip>
                      }
                    </div>
                  </div>
                  <div class="group-section">
                    <span class="section-label">Relevant Nodes:</span>
                    <div class="node-chips">
                      @for (node of group.relevant_nodes; track node) {
                        <mat-chip class="node-chip relevant-chip">{{ node }}</mat-chip>
                      }
                    </div>
                  </div>
                  <div class="group-section">
                    <span class="section-label">Edges:</span>
                    <span class="edge-count">{{ group.edgelist.length }} connections</span>
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      </div>

      <mat-divider></mat-divider>

      <!-- Advanced Insights -->
      <div class="detail-section">
        <h3>🧠 Advanced Insights</h3>
        <div class="insights-grid">
          <div class="insight-card">
            <div class="insight-header">
              <mat-icon>psychology</mat-icon>
              <span>Computational Impact</span>
            </div>
            <div class="insight-content">
              <p>{{ getComputationalInsight() }}</p>
            </div>
          </div>

          <div class="insight-card">
            <div class="insight-header">
              <mat-icon>trending_up</mat-icon>
              <span>Performance Implications</span>
            </div>
            <div class="insight-content">
              <p>{{ getPerformanceInsight() }}</p>
            </div>
          </div>

          <div class="insight-card">
            <div class="insight-header">
              <mat-icon>build</mat-icon>
              <span>Optimization Recommendations</span>
            </div>
            <div class="insight-content">
              <p>{{ getOptimizationRecommendation() }}</p>
            </div>
          </div>
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions class="modal-actions">
      <button mat-button mat-dialog-close>
        <mat-icon>close</mat-icon>
        Close
      </button>
      <button mat-button (click)="visualizeDiamond()">
        <mat-icon>visibility</mat-icon>
        Visualize
      </button>
      <button mat-raised-button color="primary" (click)="analyzePaths()">
        <mat-icon>analytics</mat-icon>
        Analyze Paths
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      
      h2 {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
      }
      
      .close-btn {
        color: white;
        
        &:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      }
    }

    .modal-content {
      padding: 0;
      max-height: 80vh;
      overflow-y: auto;
    }

    .detail-section {
      padding: 24px;
      
      h3 {
        margin: 0 0 20px 0;
        color: #333;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }

    .overview-section {
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    }

    .overview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    .overview-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s ease;
      position: relative;
      
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
      }
      
      &.primary {
        border-left: 4px solid #667eea;
      }
      
      &.complexity {
        border-left: 4px solid #fd79a8;
      }
      
      .card-icon {
        font-size: 2rem;
        opacity: 0.8;
      }
      
      .card-content {
        display: flex;
        flex-direction: column;
        
        .card-value {
          font-size: 1.8rem;
          font-weight: bold;
          color: #333;
        }
        
        .card-label {
          font-size: 0.9rem;
          color: #666;
          display: flex;
          align-items: center;
          gap: 4px;
          
          .info-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
            cursor: help;
            opacity: 0.7;
          }
        }
      }
    }

    .classification-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
    }

    .classification-item {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 16px;
      border-left: 4px solid #28a745;
      
      .item-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        
        .item-title {
          font-weight: 600;
          color: #333;
        }
      }
      
      .item-content {
        .structure-chip {
          background: linear-gradient(45deg, #28a745, #20c997);
          color: white;
          font-weight: 500;
        }
        
        .item-description {
          margin: 8px 0 0 0;
          font-size: 0.9rem;
          color: #666;
          line-height: 1.4;
        }
      }
    }

    .metrics-dashboard {
      .metrics-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 16px;
        
        &:last-child {
          margin-bottom: 0;
        }
      }
    }

    .metric-card {
      background: white;
      border-radius: 8px;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      border: 2px solid #e0e0e0;
      transition: all 0.2s ease;
      position: relative;
      
      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }
      
      .metric-icon {
        font-size: 1.5rem;
        opacity: 0.8;
      }
      
      .metric-content {
        display: flex;
        flex-direction: column;
        
        .metric-value {
          font-size: 1.4rem;
          font-weight: bold;
          color: #333;
        }
        
        .metric-label {
          font-size: 0.85rem;
          color: #666;
        }
      }
      
      &.risk-card {
        &.risk-low {
          border-color: #28a745;
          background: rgba(40, 167, 69, 0.05);
        }
        
        &.risk-medium {
          border-color: #ffc107;
          background: rgba(255, 193, 7, 0.05);
        }
        
        &.risk-high, &.risk-very_high {
          border-color: #dc3545;
          background: rgba(220, 53, 69, 0.05);
        }
      }
      
      &.optimization-card {
        &.opt-low {
          border-color: #28a745;
          background: rgba(40, 167, 69, 0.05);
        }
        
        &.opt-medium {
          border-color: #17a2b8;
          background: rgba(23, 162, 184, 0.05);
        }
        
        &.opt-high, &.opt-very_high {
          border-color: #fd7e14;
          background: rgba(253, 126, 20, 0.05);
        }
      }
    }

    .structure-analysis {
      .structure-item {
        margin-bottom: 24px;
        
        h4 {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #333;
          margin-bottom: 12px;
        }
        
        .node-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          
          .node-chip {
            font-family: 'Courier New', monospace;
            font-weight: 500;
            
            &.parent-chip {
              background: #ff6b6b;
              color: white;
            }
            
            &.highest-chip {
              background: #4ecdc4;
              color: white;
            }
            
            &.relevant-chip {
              background: #45b7d1;
              color: white;
            }
          }
          
          .no-data {
            color: #999;
            font-style: italic;
          }
        }
      }
    }

    .diamond-group {
      background: white;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
      border: 1px solid #e0e0e0;
      
      h5 {
        margin: 0 0 12px 0;
        color: #667eea;
        font-weight: 600;
      }
      
      .group-details {
        .group-section {
          margin-bottom: 12px;
          
          .section-label {
            font-weight: 500;
            color: #666;
            display: block;
            margin-bottom: 6px;
          }
          
          .edge-count {
            color: #333;
            font-weight: 500;
          }
        }
      }
    }

    .insights-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 16px;
    }

    .insight-card {
      background: linear-gradient(135deg, #f0f8ff 0%, #e6f3ff 100%);
      border-radius: 8px;
      padding: 16px;
      border-left: 4px solid #1976d2;
      
      .insight-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-weight: 600;
        color: #1976d2;
      }
      
      .insight-content {
        p {
          margin: 0;
          color: #333;
          line-height: 1.4;
        }
      }
    }

    .modal-actions {
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
      background: #f8f9fa;
      
      button {
        mat-icon {
          margin-right: 4px;
        }
      }
    }

    // Tooltip styles matching original site
    .tooltip {
      .tooltiptext {
        visibility: hidden;
        width: 300px;
        background-color: #333;
        color: white;
        text-align: left;
        border-radius: 8px;
        padding: 12px;
        position: absolute;
        z-index: 1001;
        bottom: 125%;
        left: 50%;
        margin-left: -150px;
        opacity: 0;
        transition: opacity 0.3s;
        font-size: 13px;
        line-height: 1.4;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        
        &::after {
          content: "";
          position: absolute;
          top: 100%;
          left: 50%;
          margin-left: -8px;
          border-width: 8px;
          border-style: solid;
          border-color: #333 transparent transparent transparent;
        }
      }
      
      &:hover .tooltiptext {
        visibility: visible;
        opacity: 1;
      }
    }

    // Responsive design
    @media (max-width: 768px) {
      .overview-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      
      .classification-grid {
        grid-template-columns: 1fr;
      }
      
      .metrics-dashboard .metrics-row {
        grid-template-columns: 1fr;
      }
      
      .insights-grid {
        grid-template-columns: 1fr;
      }
      
      .modal-actions {
        flex-direction: column;
        gap: 8px;
        
        button {
          width: 100%;
        }
      }
    }
  `]
})
export class DiamondDetailModalComponent {
  public dialogRef = inject(MatDialogRef<DiamondDetailModalComponent>);
  public data: DiamondDetailModalData = inject(MAT_DIALOG_DATA);
  private router = inject(Router);

  getComplexityColor(score: number): string {
    if (score < 5) return '#4CAF50';
    if (score < 10) return '#FF9800';
    return '#F44336';
  }

  getRiskLevel(risk: string | number): string {
    return risk?.toString().toLowerCase() || 'low';
  }

  getOptimizationLevel(optimization: string | number): string {
    return optimization?.toString().toLowerCase() || 'low';
  }

  getForkStructureDescription(structure: string): string {
    const descriptions = {
      'SINGLE_FORK': 'Simple parallel branching with one primary fork point',
      'MULTI_FORK': 'Multiple fork points creating complex parallel paths',
      'CHAINED_FORK': 'Sequential fork points where outputs feed into subsequent forks',
      'SELF_INFLUENCE_FORK': 'Fork structure with feedback loops and self-referential paths'
    };
    return descriptions[structure as keyof typeof descriptions] || 'Complex fork structure with multiple decision points';
  }

  getInternalStructureDescription(structure: string): string {
    const descriptions = {
      'SIMPLE': 'Basic diamond with minimal internal complexity',
      'NESTED': 'Diamond containing other diamond structures within it',
      'SEQUENTIAL': 'Diamond with sequential processing stages',
      'INTERCONNECTED': 'Highly connected diamond with cross-path interactions'
    };
    return descriptions[structure as keyof typeof descriptions] || 'Complex internal structure with multiple interconnections';
  }

  getPathTopologyDescription(topology: string): string {
    const descriptions = {
      'LINEAR': 'Paths follow a linear progression from source to join',
      'BRANCHED': 'Paths branch and merge at multiple points',
      'MESH': 'Highly interconnected paths with multiple cross-connections',
      'HIERARCHICAL': 'Paths organized in hierarchical levels'
    };
    return descriptions[topology as keyof typeof descriptions] || 'Complex path topology with multiple routing options';
  }

  getJoinStructureDescription(structure: string): string {
    const descriptions = {
      'SIMPLE_JOIN': 'Basic join point where all paths converge',
      'MULTI_STAGE_JOIN': 'Multiple join stages with intermediate convergence points',
      'CONDITIONAL_JOIN': 'Join behavior depends on path conditions',
      'WEIGHTED_JOIN': 'Join with different weights for different input paths'
    };
    return descriptions[structure as keyof typeof descriptions] || 'Complex join structure with conditional convergence';
  }

  getComputationalInsight(): string {
    const complexity = this.data.diamond.complexity_score;
    const pathCount = this.data.diamond.path_count;
    
    if (complexity < 5) {
      return `Low computational overhead with ${pathCount} parallel paths. This diamond should process efficiently with minimal resource requirements.`;
    } else if (complexity < 10) {
      return `Moderate computational complexity with ${pathCount} paths. May require optimization for high-throughput scenarios.`;
    } else {
      return `High computational complexity with ${pathCount} paths. Consider restructuring or parallel processing to improve performance.`;
    }
  }

  getPerformanceInsight(): string {
    const risk = this.data.diamond.bottleneck_risk?.toString().toLowerCase();
    const size = this.data.diamond.subgraph_size;
    
    if (risk === 'low') {
      return `Well-balanced structure with ${size} nodes. Performance should be consistent across different load conditions.`;
    } else if (risk === 'medium') {
      return `Some performance concerns with ${size} nodes. Monitor for bottlenecks under heavy load conditions.`;
    } else {
      return `High bottleneck risk with ${size} nodes. Performance degradation likely under load. Priority optimization target.`;
    }
  }

  getOptimizationRecommendation(): string {
    const optimization = this.data.diamond.optimization_potential?.toString().toLowerCase();
    const forkCount = this.data.diamond.fork_count;
    
    if (optimization === 'low') {
      return `Structure is well-optimized with ${forkCount} forks. Focus on maintaining current efficiency levels.`;
    } else if (optimization === 'medium') {
      return `Moderate optimization opportunities with ${forkCount} forks. Consider path consolidation or load balancing.`;
    } else {
      return `High optimization potential with ${forkCount} forks. Recommend restructuring, path reduction, or parallel processing implementation.`;
    }
  }

  visualizeDiamond(): void {
    this.dialogRef.close();
    this.router.navigate(['/visualization'], {
      queryParams: { focusDiamond: this.data.diamond.join_node }
    });
  }

  analyzePaths(): void {
    this.dialogRef.close('analyze');
  }
}