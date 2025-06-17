import { Component, OnInit, OnDestroy, ViewChild, ElementRef, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { MainServerService } from '../../services/main-server-service';
import { GraphStateService } from '../../services/graph-state-service';
import { VisualizationRendererService } from '../../services/vis/vis-renderer-service';
import { DiamondClassification, DiamondStructureData, DiamondSubsetAnalysisRequest, AnalysisResult } from '../../shared/models/main-sever-interface';
import { GraphStructure } from '../../shared/models/graph-structure-interface';
import { VisualizationConfig } from '../../shared/models/vis/vis-types';

interface DiamondModalData {
  diamond: DiamondClassification & { diamondStructure: DiamondStructureData };
  graphStructure: GraphStructure;
}

@Component({
  selector: 'app-diamond-path-analysis-modal',
  standalone: true,
  imports: [
    CommonModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatSliderModule, MatCheckboxModule, MatTabsModule, MatTableModule,
    MatProgressSpinnerModule, MatRadioModule, FormsModule
  ],
  providers: [VisualizationRendererService],
  template: `
    <div class="modal-header">
      <h2 mat-dialog-title>
        <mat-icon>diamond</mat-icon>
        Diamond Analysis - Join Node {{ data.diamond.join_node }}
      </h2>
      <button mat-icon-button mat-dialog-close>
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-dialog-content class="modal-content">
      <mat-tab-group>
        <!-- Diamond Visualization Tab -->
        <mat-tab label="🕸️ Diamond Subgraph">
          <div class="visualization-container">
            <div class="diamond-info">
              <div class="info-grid">
                <div class="info-item">
                  <span class="label">Type:</span>
                  <span class="value">{{ data.diamond.internal_structure }}</span>
                </div>
                <div class="info-item">
                  <span class="label">Complexity:</span>
                  <span class="value complexity" [style.color]="getComplexityColor(data.diamond.complexity_score)">
                    {{ data.diamond.complexity_score }}
                  </span>
                </div>
                <div class="info-item">
                  <span class="label">Nodes:</span>
                  <span class="value">{{ data.diamond.subgraph_size }}</span>
                </div>
                <div class="info-item">
                  <span class="label">Paths:</span>
                  <span class="value">{{ data.diamond.path_count }}</span>
                </div>
              </div>
            </div>
            
            <div #diamondViz class="diamond-visualization"></div>
          </div>
        </mat-tab>

        <!-- Analysis Tab -->
        <mat-tab label="🔬 Analysis Options">
          <div class="analysis-container">
            <!-- Analysis Mode Selection -->
            <div class="mode-selection">
              <h3>🎯 Analysis Mode</h3>
              <mat-radio-group [(ngModel)]="analysisMode" (change)="onModeChange()">
                <mat-radio-button value="local" class="mode-option">
                  <div class="mode-content">
                    <strong>Local Diamond Analysis</strong>
                    <p>Analyze only this diamond subgraph with temporary parameters</p>
                  </div>
                </mat-radio-button>
                <mat-radio-button value="global" class="mode-option">
                  <div class="mode-content">
                    <strong>Global Sensitivity Analysis</strong>
                    <p>Apply diamond parameters to main graph and run full analysis</p>
                  </div>
                </mat-radio-button>
              </mat-radio-group>
            </div>

            <div class="parameter-controls">
              <h3>💎 Diamond Parameters</h3>
              
              <div class="control-group">
                <div class="control-row">
                  <mat-checkbox 
                    [(ngModel)]="overrideNodes"
                    (change)="updateParams()">
                    Override Diamond Node Priors (Mass)
                  </mat-checkbox>
                  <mat-slider 
                    [disabled]="!overrideNodes"
                    [min]="0.1" [max]="1" [step]="0.1"
                    [(ngModel)]="nodePrior"
                    (input)="updateParams()">
                  </mat-slider>
                  <span class="value-display">{{ nodePrior.toFixed(1) }}</span>
                </div>
                
                <div class="control-row">
                  <mat-checkbox 
                    [(ngModel)]="overrideEdges"
                    (change)="updateParams()">
                    Override Diamond Edge Probabilities (Mass)
                  </mat-checkbox>
                  <mat-slider 
                    [disabled]="!overrideEdges"
                    [min]="0.1" [max]="1" [step]="0.1"
                    [(ngModel)]="edgeProb"
                    (input)="updateParams()">
                  </mat-slider>
                  <span class="value-display">{{ edgeProb.toFixed(1) }}</span>
                </div>
              </div>

              <!-- Individual Parameter Controls -->
              <div class="individual-controls">
                <h4>🎛️ Individual Parameter Overrides</h4>
                <div class="individual-buttons">
                  <button mat-button (click)="openIndividualNodeEditor()">
                    <mat-icon>tune</mat-icon>
                    Edit Individual Diamond Node Priors
                  </button>
                  <button mat-button (click)="openIndividualEdgeEditor()">
                    <mat-icon>tune</mat-icon>
                    Edit Individual Diamond Edge Probabilities
                  </button>
                </div>
                
                <div class="individual-status" *ngIf="hasIndividualOverrides()">
                  <p>Modified: {{ getModifiedNodesCount() }} nodes, {{ getModifiedEdgesCount() }} edges</p>
                </div>
              </div>

              <div class="action-buttons">
                <button mat-raised-button color="primary" 
                        [disabled]="isAnalyzing()"
                        (click)="runAnalysis()">
                  @if (isAnalyzing()) {
                    <mat-spinner diameter="20"></mat-spinner>
                  } @else {
                    <mat-icon>analytics</mat-icon>
                  }
                  {{ analysisMode === 'local' ? 'Run Local Analysis' : 'Run Global Analysis' }}
                </button>
                
                @if (analysisMode === 'global') {
                  <button mat-button 
                          [disabled]="isApplyingGlobal()"
                          (click)="applyToGlobalGraph()">
                    @if (isApplyingGlobal()) {
                      <mat-spinner diameter="20"></mat-spinner>
                    } @else {
                      <mat-icon>publish</mat-icon>
                    }
                    Apply to Global Graph
                  </button>
                }
                
                <button mat-button (click)="resetParams()">
                  <mat-icon>refresh</mat-icon>
                  Reset
                </button>
              </div>
            </div>

            <!-- Results Display -->
            @if (analysisResults().length > 0) {
              <div class="results-container">
                <h3>📊 {{ analysisMode === 'local' ? 'Local' : 'Global' }} Analysis Results</h3>
                <div class="results-summary">
                  <div class="summary-item">
                    <span class="label">Analyzed Nodes:</span>
                    <span class="value">{{ analysisResults().length }}</span>
                  </div>
                  <div class="summary-item">
                    <span class="label">Join Node Result:</span>
                    <span class="value">{{ getJoinNodeResult() }}</span>
                  </div>
                </div>
                
                <div class="results-table">
                  <table mat-table [dataSource]="analysisResults()">
                    <ng-container matColumnDef="node">
                      <th mat-header-cell *matHeaderCellDef>Node</th>
                      <td mat-cell *matCellDef="let result">{{ result.node }}</td>
                    </ng-container>
                    
                    <ng-container matColumnDef="probability">
                      <th mat-header-cell *matHeaderCellDef>Probability</th>
                      <td mat-cell *matCellDef="let result">{{ result.probability.toFixed(4) }}</td>
                    </ng-container>
                    
                    <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
                  </table>
                </div>
              </div>
            }
          </div>
        </mat-tab>
      </mat-tab-group>
    </mat-dialog-content>

    <mat-dialog-actions>
      <button mat-button mat-dialog-close>Close</button>
      <button mat-raised-button color="primary" (click)="exportResults()" [disabled]="analysisResults().length === 0">
        <mat-icon>download</mat-icon>
        Export Results
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-bottom: 1px solid #e0e0e0;
    }

    .modal-content {
      padding: 0;
      max-height: 70vh;
      overflow: auto;
    }

    .mode-selection {
      background: #f0f8ff;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      
      h3 {
        margin-top: 0;
        color: #1976d2;
      }
      
      .mode-option {
        display: block;
        margin-bottom: 12px;
        
        .mode-content {
          margin-left: 8px;
          
          strong {
            display: block;
            color: #333;
          }
          
          p {
            margin: 4px 0 0 0;
            font-size: 0.9em;
            color: #666;
          }
        }
      }
    }

    .individual-controls {
      background: #fff3e0;
      border-radius: 8px;
      padding: 16px;
      margin: 16px 0;
      
      h4 {
        margin-top: 0;
        color: #f57c00;
      }
      
      .individual-buttons {
        display: flex;
        gap: 12px;
        margin-bottom: 12px;
        flex-wrap: wrap;
      }
      
      .individual-status {
        font-size: 0.9em;
        color: #666;
      }
    }

    .visualization-container {
      padding: 20px;
    }

    .diamond-info {
      margin-bottom: 20px;
      background: #f5f5f5;
      border-radius: 8px;
      padding: 16px;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
    }

    .info-item {
      display: flex;
      justify-content: space-between;
      
      .label {
        font-weight: 500;
        color: #666;
      }
      
      .value {
        font-weight: 600;
        color: #333;
        
        &.complexity {
          font-size: 1.1em;
        }
      }
    }

    .diamond-visualization {
      min-height: 400px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      background: white;
    }

    .analysis-container {
      padding: 20px;
    }

    .parameter-controls {
      background: #f9f9f9;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .control-group {
      margin: 16px 0;
    }

    .control-row {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
      
      mat-checkbox {
        min-width: 280px;
      }
      
      mat-slider {
        flex: 1;
        max-width: 200px;
      }
      
      .value-display {
        min-width: 40px;
        font-weight: 500;
      }
    }

    .action-buttons {
      display: flex;
      gap: 12px;
      margin-top: 20px;
      flex-wrap: wrap;
    }

    .results-container {
      background: white;
      border-radius: 8px;
      padding: 20px;
      border: 1px solid #e0e0e0;
    }

    .results-summary {
      display: flex;
      gap: 24px;
      margin-bottom: 16px;
      
      .summary-item {
        display: flex;
        flex-direction: column;
        
        .label {
          font-size: 0.9em;
          color: #666;
        }
        
        .value {
          font-size: 1.2em;
          font-weight: 600;
          color: #1976d2;
        }
      }
    }

    .results-table {
      max-height: 300px;
      overflow: auto;
    }

    mat-dialog-actions {
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
    }
  `]
})
export class DiamondPathAnalysisModalComponent implements OnInit, OnDestroy {
  @ViewChild('diamondViz', { static: false }) diamondVizRef!: ElementRef;

  private destroy$ = new Subject<void>();
  private mainServerService = inject(MainServerService);
  private graphStateService = inject(GraphStateService);
  private rendererService = inject(VisualizationRendererService);
  public dialogRef = inject(MatDialogRef<DiamondPathAnalysisModalComponent>);
  public data: DiamondModalData = inject(MAT_DIALOG_DATA);

  // Analysis mode
  analysisMode: 'local' | 'global' = 'local';

  // Parameters
  overrideNodes = false;
  nodePrior = 1.0;
  overrideEdges = false;
  edgeProb = 0.9;

  // Individual overrides
  individualNodePriors = signal<{ [nodeId: string]: number }>({});
  individualEdgeProbabilities = signal<{ [edgeKey: string]: number }>({});

  // State
  isAnalyzing = signal(false);
  isApplyingGlobal = signal(false);
  analysisResults = signal<AnalysisResult[]>([]);
  displayedColumns = ['node', 'probability'];

  ngOnInit() {
    setTimeout(() => {
      this.renderDiamondVisualization();
    }, 100);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.rendererService.cleanup();
  }

  private renderDiamondVisualization() {
    const container = this.diamondVizRef?.nativeElement;
    if (!container || !this.data.diamond.diamondStructure) return;

    try {
      const diamondStructure = this.buildDiamondSubgraph();
      
      const config: VisualizationConfig = {
        layout: 'dot',
        zoomLevel: 100,
        showNodeLabels: true,
        showEdgeLabels: false,
        highlightMode: 'diamond-structures',
        highlights: []
      };

      this.rendererService.renderWithD3(container, diamondStructure, config);
    } catch (error) {
      console.error('Diamond visualization failed:', error);
      container.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">Failed to render diamond visualization</div>';
    }
  }

  private buildDiamondSubgraph(): GraphStructure {
    const diamond = this.data.diamond.diamondStructure;
    
    const allNodes = new Set<number>();
    const allEdges: [number, number][] = [];
    
    diamond.diamond.forEach(group => {
      group.relevant_nodes.forEach(node => allNodes.add(node));
      group.edgelist.forEach(edge => allEdges.push(edge));
    });

    allNodes.add(diamond.join_node);

    return {
      edgelist: allEdges,
      iteration_sets: [Array.from(allNodes)],
      outgoing_index: {},
      incoming_index: {},
      source_nodes: diamond.diamond.flatMap(g => g.highest_nodes),
      descendants: {},
      ancestors: {},
      join_nodes: [diamond.join_node],
      fork_nodes: diamond.diamond.flatMap(g => g.highest_nodes),
      node_priors: {},
      edge_probabilities: {},
      diamond_structures: null
    };
  }

  onModeChange() {
    this.analysisResults.set([]);
  }

  updateParams() {
    // Parameters updated
  }

  resetParams() {
    this.overrideNodes = false;
    this.nodePrior = 1.0;
    this.overrideEdges = false;
    this.edgeProb = 0.9;
    this.individualNodePriors.set({});
    this.individualEdgeProbabilities.set({});
    this.analysisResults.set([]);
  }

  openIndividualNodeEditor() {
    console.log('Opening individual node editor for diamond nodes');
  }

  openIndividualEdgeEditor() {
    console.log('Opening individual edge editor for diamond edges');
  }

  hasIndividualOverrides(): boolean {
    return Object.keys(this.individualNodePriors()).length > 0 || 
           Object.keys(this.individualEdgeProbabilities()).length > 0;
  }

  getModifiedNodesCount(): number {
    return Object.keys(this.individualNodePriors()).length;
  }

  getModifiedEdgesCount(): number {
    return Object.keys(this.individualEdgeProbabilities()).length;
  }

  async runAnalysis() {
    this.isAnalyzing.set(true);
    
    try {
      if (this.analysisMode === 'local') {
        await this.runLocalAnalysis();
      } else {
        await this.runGlobalAnalysis();
      }
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      this.isAnalyzing.set(false);
    }
  }

  private async runLocalAnalysis() {
    const request: DiamondSubsetAnalysisRequest = this.mainServerService.buildDiamondSubsetRequest(
      {
        joinNode: this.data.diamond.join_node.toString(),
        structure: this.data.diamond.diamondStructure
      },
      {
        overrideNodePrior: this.overrideNodes,
        overrideEdgeProb: this.overrideEdges,
        nodePrior: this.nodePrior,
        edgeProb: this.edgeProb,
        useIndividualOverrides: this.hasIndividualOverrides(),
        individualNodePriors: this.individualNodePriors(),
        individualEdgeProbabilities: this.individualEdgeProbabilities()
      }
    );

    const result = await this.mainServerService.analyzeDiamondSubset(request)
      .pipe(takeUntil(this.destroy$))
      .toPromise();

    if (result?.success) {
      this.analysisResults.set(result.results || []);
    } else {
      console.error('Local analysis failed:', result?.error);
    }
  }

  private async runGlobalAnalysis() {
    const diamondNodes = this.getDiamondNodes();
    const diamondEdges = this.getDiamondEdges();
    
    const globalNodePriors: { [nodeId: string]: number } = {};
    const globalEdgeProbabilities: { [edgeKey: string]: number } = {};

    // Apply mass overrides to diamond nodes/edges
    if (this.overrideNodes) {
      diamondNodes.forEach(nodeId => {
        globalNodePriors[nodeId.toString()] = this.nodePrior;
      });
    }

    if (this.overrideEdges) {
      diamondEdges.forEach(edge => {
        const edgeKey = `${edge[0]}-${edge[1]}`;
        globalEdgeProbabilities[edgeKey] = this.edgeProb;
      });
    }

    // Apply individual overrides
    Object.assign(globalNodePriors, this.individualNodePriors());
    Object.assign(globalEdgeProbabilities, this.individualEdgeProbabilities());

    const request = this.mainServerService.buildEnhancedRequest(
      this.graphStateService.csvContent(),
      {
        nodePrior: 1.0,
        edgeProb: 0.9,
        overrideNodePrior: false,
        overrideEdgeProb: false
      },
      {
        includeClassification: true,
        enableMonteCarlo: false,
        useIndividualOverrides: true,
        individualNodePriors: globalNodePriors,
        individualEdgeProbabilities: globalEdgeProbabilities
      }
    );

    const result = await this.mainServerService.analyzeEnhanced(request)
      .pipe(takeUntil(this.destroy$))
      .toPromise();

    if (result?.success) {
      this.analysisResults.set(result.results || []);
    } else {
      console.error('Global analysis failed:', result?.error);
    }
  }

  async applyToGlobalGraph() {
    this.isApplyingGlobal.set(true);
    
    try {
      const diamondNodes = this.getDiamondNodes();
      const diamondEdges = this.getDiamondEdges();
      
      const nodeUpdates: { [nodeId: string]: number } = {};
      const edgeUpdates: { [edgeKey: string]: number } = {};

      // Apply mass overrides
      if (this.overrideNodes) {
        diamondNodes.forEach(nodeId => {
          nodeUpdates[nodeId.toString()] = this.nodePrior;
        });
      }

      if (this.overrideEdges) {
        diamondEdges.forEach(edge => {
          const edgeKey = `${edge[0]}-${edge[1]}`;
          edgeUpdates[edgeKey] = this.edgeProb;
        });
      }

      // Apply individual overrides
      Object.assign(nodeUpdates, this.individualNodePriors());
      Object.assign(edgeUpdates, this.individualEdgeProbabilities());

      // Update global graph parameters
      this.graphStateService.updateGlobalParameters(nodeUpdates, edgeUpdates);
      
      console.log('Applied diamond parameters to global graph');
    } catch (error) {
      console.error('Failed to apply to global graph:', error);
    } finally {
      this.isApplyingGlobal.set(false);
    }
  }

  private getDiamondNodes(): number[] {
    const diamond = this.data.diamond.diamondStructure;
    const allNodes = new Set<number>();
    
    diamond.diamond.forEach(group => {
      group.relevant_nodes.forEach(node => allNodes.add(node));
    });
    allNodes.add(diamond.join_node);
    
    return Array.from(allNodes);
  }

  private getDiamondEdges(): [number, number][] {
    const diamond = this.data.diamond.diamondStructure;
    const allEdges: [number, number][] = [];
    
    diamond.diamond.forEach(group => {
      group.edgelist.forEach(edge => allEdges.push(edge));
    });
    
    return allEdges;
  }

  getJoinNodeResult(): string {
    const joinResult = this.analysisResults().find(r => r.node === this.data.diamond.join_node);
    return joinResult ? joinResult.probability.toFixed(4) : 'N/A';
  }

  getComplexityColor(score: number): string {
    if (score < 5) return '#4CAF50';
    if (score < 10) return '#FF9800';
    return '#F44336';
  }

  exportResults() {
    const results = this.analysisResults();
    if (results.length === 0) return;

    const csvContent = [
      'Node,Probability',
      ...results.map(r => `${r.node},${r.probability}`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `diamond_analysis_${this.data.diamond.join_node}_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}