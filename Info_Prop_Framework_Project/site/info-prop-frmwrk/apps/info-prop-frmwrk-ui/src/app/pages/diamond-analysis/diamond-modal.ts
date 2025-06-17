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
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { MainServerService } from '../../services/main-server-service';
import { GraphStateService } from '../../services/graph-state-service';
import { VisualizationRendererService } from '../../services/vis/vis-renderer-service';
import { HighlightService } from '../../services/vis/highlight.service';
import { DiamondClassification, DiamondStructureData, DiamondSubsetAnalysisRequest, AnalysisResult } from '../../shared/models/main-sever-interface';
import { GraphStructure } from '../../shared/models/graph-structure-interface';
import { VisualizationConfig, NodeHighlight, LayoutOption } from '../../shared/models/vis/vis-types';
import { LAYOUT_OPTIONS, ZOOM_CONFIG } from '../../shared/models/vis/vis-constants';

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
    MatProgressSpinnerModule, MatRadioModule, MatSelectModule, MatChipsModule,
    MatDividerModule, MatTooltipModule, FormsModule
  ],
  providers: [VisualizationRendererService, HighlightService],
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
            <!-- Diamond Information -->
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

            <!-- Visualization Controls -->
            <div class="viz-controls">
              <h4>🎯 Visualization Options</h4>
              
              <div class="control-row">
                <!-- Highlighting Options -->
                <div class="control-group">
                  <span class="control-label">Highlighting:</span>
                  <div class="checkbox-group">
                    <mat-chip-set>
                      <mat-chip
                        [highlighted]="showSourceNodes()"
                        (click)="showSourceNodes.set(!showSourceNodes()); updateVisualization()">
                        🔴 Source Nodes
                      </mat-chip>
                      <mat-chip
                        [highlighted]="showSinkNodes()"
                        (click)="showSinkNodes.set(!showSinkNodes()); updateVisualization()">
                        🟢 Sink Nodes
                      </mat-chip>
                      <mat-chip
                        [highlighted]="showForkNodes()"
                        (click)="showForkNodes.set(!showForkNodes()); updateVisualization()">
                        🔵 Fork Nodes
                      </mat-chip>
                      <mat-chip
                        [highlighted]="showJoinNodes()"
                        (click)="showJoinNodes.set(!showJoinNodes()); updateVisualization()">
                        🟡 Join Nodes
                      </mat-chip>
                      <mat-chip
                        [highlighted]="showDiamonds()"
                        (click)="showDiamonds.set(!showDiamonds()); updateVisualization()">
                        💎 Diamond Structures
                      </mat-chip>
                    </mat-chip-set>
                  </div>
                </div>
              </div>

              <div class="control-row">
                <!-- Layout Selection -->
                <div class="control-group">
                  <span class="control-label">Layout:</span>
                  <mat-select
                    [(value)]="selectedLayout"
                    (selectionChange)="onLayoutChange()"
                    class="layout-select">
                    @for (layout of layoutOptions; track layout.value) {
                      <mat-option [value]="layout.value" [matTooltip]="layout.description">
                        {{ layout.label }}
                      </mat-option>
                    }
                  </mat-select>
                </div>

                <!-- Display Options -->
                <div class="control-group">
                  <span class="control-label">Display:</span>
                  <div class="checkbox-group">
                    <mat-chip-set>
                      <mat-chip
                        [highlighted]="showNodeLabels()"
                        (click)="showNodeLabels.set(!showNodeLabels()); updateVisualization()">
                        <mat-icon>label</mat-icon>
                        Node Labels
                      </mat-chip>
                      <mat-chip
                        [highlighted]="showEdgeLabels()"
                        (click)="showEdgeLabels.set(!showEdgeLabels()); updateVisualization()">
                        <mat-icon>linear_scale</mat-icon>
                        Edge Labels
                      </mat-chip>
                    </mat-chip-set>
                  </div>
                </div>
              </div>

              <div class="control-row">
                <!-- Zoom Control -->
                <div class="control-group">
                  <span class="control-label">Zoom: {{ zoomLevel() }}%</span>
                  <mat-slider [min]="25" [max]="200" [step]="25">
                    <input matSliderThumb [(ngModel)]="zoomLevel" (ngModelChange)="onZoomChange($event)" name="zoomLevel">
                  </mat-slider>
                </div>

                <!-- Action Buttons -->
                <div class="control-group">
                  <div class="action-buttons">
                    <button mat-button (click)="resetView()" matTooltip="Reset View">
                      <mat-icon>refresh</mat-icon>
                      Reset
                    </button>
                    <button mat-button (click)="fitToScreen()" matTooltip="Fit to Screen">
                      <mat-icon>fit_screen</mat-icon>
                      Fit
                    </button>
                    <button mat-button (click)="exportDot()" matTooltip="Export DOT">
                      <mat-icon>download</mat-icon>
                      Export
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <mat-divider></mat-divider>
            
            <!-- Visualization Display -->
            <div class="diamond-viz-display">
              <div #diamondViz class="diamond-visualization"></div>
              
              <!-- Node Details Panel -->
              <div class="node-details" *ngIf="selectedNodeInfo()">
                <h4>🔍 Node Details</h4>
                <div class="selected-node-info">
                  <div class="node-info-item">
                    <span class="label">Node ID:</span>
                    <span class="value">{{ selectedNodeInfo()?.nodeId }}</span>
                  </div>
                  <div class="node-info-item">
                    <span class="label">Type:</span>
                    <span class="value">{{ selectedNodeInfo()?.type }}</span>
                  </div>
                  @if (selectedNodeInfo()?.probability !== undefined) {
                    <div class="node-info-item">
                      <span class="label">Probability:</span>
                      <span class="value">{{ selectedNodeInfo()?.probability?.toFixed(4) }}</span>
                    </div>
                  }
                </div>
              </div>
            </div>

            <!-- Legend -->
            <div class="viz-legend">
              <h4>🗺️ Legend</h4>
              <div class="legend-items">
                <div class="legend-item" *ngIf="showSourceNodes()">
                  <span class="legend-color source"></span>
                  <span>Source Nodes</span>
                </div>
                <div class="legend-item" *ngIf="showSinkNodes()">
                  <span class="legend-color sink"></span>
                  <span>Sink Nodes</span>
                </div>
                <div class="legend-item" *ngIf="showForkNodes()">
                  <span class="legend-color fork"></span>
                  <span>Fork Nodes</span>
                </div>
                <div class="legend-item" *ngIf="showJoinNodes()">
                  <span class="legend-color join"></span>
                  <span>Join Nodes</span>
                </div>
                <div class="legend-item" *ngIf="showDiamonds()">
                  <span class="legend-color diamond"></span>
                  <span>Diamond Nodes</span>
                </div>
              </div>
            </div>
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
                    [min]="0.1" [max]="1" [step]="0.1">
                    <input matSliderThumb [(ngModel)]="nodePrior" (ngModelChange)="updateParams()" name="nodePrior">
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
                    [min]="0.1" [max]="1" [step]="0.1">
                    <input matSliderThumb [(ngModel)]="edgeProb" (ngModelChange)="updateParams()" name="edgeProb">
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
      max-height: 80vh;
      overflow: auto;
    }

    .viz-controls {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 16px;
      margin: 16px 0;
      
      h4 {
        margin-top: 0;
        color: #1976d2;
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }

    .control-row {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 16px;
      align-items: center;
    }

    .control-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 200px;
      
      .control-label {
        font-weight: 500;
        color: #666;
        font-size: 0.9em;
      }
      
      .checkbox-group {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      
      .layout-select {
        min-width: 180px;
      }
      
      mat-slider {
        width: 150px;
      }
    }

    .action-buttons {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .diamond-viz-display {
      display: flex;
      gap: 16px;
      min-height: 400px;
      
      .diamond-visualization {
        flex: 1;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        background: white;
        min-height: 400px;
      }
      
      .node-details {
        width: 250px;
        background: #f5f5f5;
        border-radius: 8px;
        padding: 16px;
        
        h4 {
          margin-top: 0;
          color: #1976d2;
        }
        
        .node-info-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          
          .label {
            font-weight: 500;
            color: #666;
          }
          
          .value {
            font-weight: 600;
            color: #333;
          }
        }
      }
    }

    .viz-legend {
      background: white;
      border-radius: 8px;
      padding: 16px;
      border: 1px solid #e0e0e0;
      margin-top: 16px;
      
      h4 {
        margin-top: 0;
        color: #1976d2;
      }
      
      .legend-items {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
      }
      
      .legend-item {
        display: flex;
        align-items: center;
        gap: 8px;
        
        .legend-color {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          
          &.source { background-color: #4CAF50; }
          &.sink { background-color: #4CAF50; }
          &.fork { background-color: #FF9800; }
          &.join { background-color: #2196F3; }
          &.diamond { background-color: #E91E63; }
        }
      }
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
  private highlightService = inject(HighlightService);
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

  // Visualization controls
  selectedLayout = signal<string>('dot');
  zoomLevel = signal<number>(ZOOM_CONFIG.DEFAULT);
  showNodeLabels = signal<boolean>(true);
  showEdgeLabels = signal<boolean>(false);
  showSourceNodes = signal<boolean>(true);
  showSinkNodes = signal<boolean>(true);
  showForkNodes = signal<boolean>(false);
  showJoinNodes = signal<boolean>(true);
  showDiamonds = signal<boolean>(true);
  selectedNodeInfo = signal<any>(null);

  // Constants
  readonly layoutOptions: LayoutOption[] = LAYOUT_OPTIONS;

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
      const highlights = this.generateDiamondHighlights(diamondStructure);
      
      const config: VisualizationConfig = {
        layout: this.selectedLayout(),
        zoomLevel: this.zoomLevel(),
        showNodeLabels: this.showNodeLabels(),
        showEdgeLabels: this.showEdgeLabels(),
        highlightMode: 'custom',
        highlights: highlights
      };

      this.rendererService.renderWithD3(container, diamondStructure, config);
      
      // Add click handlers for node selection
      this.addNodeClickHandlers(container);
    } catch (error) {
      console.error('Diamond visualization failed:', error);
      container.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">Failed to render diamond visualization</div>';
    }
  }

  private generateDiamondHighlights(structure: GraphStructure): NodeHighlight[] {
    const highlights: NodeHighlight[] = [];
    
    if (this.showSourceNodes()) {
      structure.source_nodes.forEach(nodeId => {
        highlights.push({ nodeId, type: 'source', color: '#4CAF50' });
      });
    }
    
    if (this.showForkNodes()) {
      structure.fork_nodes.forEach(nodeId => {
        highlights.push({ nodeId, type: 'fork', color: '#FF9800' });
      });
    }
    
    if (this.showJoinNodes()) {
      structure.join_nodes.forEach(nodeId => {
        highlights.push({ nodeId, type: 'join', color: '#2196F3' });
      });
    }
    
    if (this.showDiamonds()) {
      // Highlight all diamond nodes
      const diamondNodes = this.getDiamondNodes();
      diamondNodes.forEach(nodeId => {
        if (!highlights.find(h => h.nodeId === nodeId)) {
          highlights.push({ nodeId, type: 'diamond', color: '#E91E63' });
        }
      });
    }
    
    return highlights;
  }

  private addNodeClickHandlers(container: HTMLElement) {
    const nodes = container.querySelectorAll('.node');
    nodes.forEach(node => {
      node.addEventListener('click', (event) => {
        const nodeId = parseInt((event.target as HTMLElement).getAttribute('data-node-id') || '0');
        if (nodeId) {
          this.onNodeClick(nodeId);
        }
      });
    });
  }

  private onNodeClick(nodeId: number) {
    const structure = this.buildDiamondSubgraph();
    let nodeType = 'regular';
    
    if (structure.source_nodes.includes(nodeId)) nodeType = 'source';
    else if (structure.fork_nodes.includes(nodeId)) nodeType = 'fork';
    else if (structure.join_nodes.includes(nodeId)) nodeType = 'join';
    else if (this.getDiamondNodes().includes(nodeId)) nodeType = 'diamond';
    
    const result = this.analysisResults().find(r => r.node === nodeId);
    
    this.selectedNodeInfo.set({
      nodeId,
      type: nodeType,
      probability: result?.probability
    });
  }

  // Visualization control methods
  onLayoutChange() {
    this.updateVisualization();
  }

  onZoomChange(value: number) {
    this.zoomLevel.set(value);
    const container = this.diamondVizRef?.nativeElement;
    if (container) {
      this.rendererService.applyZoom(value, container);
    }
  }

  updateVisualization() {
    setTimeout(() => {
      this.renderDiamondVisualization();
    }, 100);
  }

  resetView() {
    this.selectedLayout.set('dot');
    this.zoomLevel.set(ZOOM_CONFIG.DEFAULT);
    this.showNodeLabels.set(true);
    this.showEdgeLabels.set(false);
    this.showSourceNodes.set(true);
    this.showSinkNodes.set(true);
    this.showForkNodes.set(false);
    this.showJoinNodes.set(true);
    this.showDiamonds.set(true);
    this.selectedNodeInfo.set(null);
    this.updateVisualization();
  }

  fitToScreen() {
    const container = this.diamondVizRef?.nativeElement;
    if (container) {
      // Implement fit to screen logic
      this.rendererService.fitToScreen(container);
    }
  }

  exportDot() {
    const structure = this.buildDiamondSubgraph();
    const highlights = this.generateDiamondHighlights(structure);
    
    let dotContent = `digraph DiamondSubgraph {\n`;
    dotContent += `  layout="${this.selectedLayout()}";\n`;
    dotContent += `  node [shape=circle, style=filled];\n`;
    
    // Add nodes with colors
    const nodeSet = this.extractUniqueNodes(structure.edgelist);
    nodeSet.forEach(nodeId => {
      const highlight = highlights.find(h => h.nodeId === nodeId);
      if (highlight) {
        dotContent += `  "${nodeId}" [fillcolor="${highlight.color}"];\n`;
      } else {
        dotContent += `  "${nodeId}" [fillcolor="#9E9E9E"];\n`;
      }
    });
    
    // Add edges
    structure.edgelist.forEach(([from, to]) => {
      dotContent += `  "${from}" -> "${to}";\n`;
    });
    
    dotContent += `}\n`;

    const blob = new Blob([dotContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = `diamond_${this.data.diamond.join_node}_${Date.now()}.dot`;
    link.click();
    
    window.URL.revokeObjectURL(url);
  }

  private extractUniqueNodes(edges: [number, number][]): number[] {
    const nodes = new Set<number>();
    edges.forEach(([from, to]) => {
      nodes.add(from);
      nodes.add(to);
    });
    return Array.from(nodes).sort((a, b) => a - b);
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