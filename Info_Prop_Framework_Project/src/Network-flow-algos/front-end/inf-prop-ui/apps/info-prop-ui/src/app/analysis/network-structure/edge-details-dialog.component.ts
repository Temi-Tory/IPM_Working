import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';

interface EdgeDetailsData {
  source: number;
  target: number;
  edgeDetails: {
    source: number;
    target: number;
    sourceTypes: string[];
    targetTypes: string[];
    edgeType: string;
    isCritical: boolean;
    pathLength: number;
    sourceIterationSet: number;
    targetIterationSet: number;
    crossesLayers: boolean;
  };
  networkData: any;
}

@Component({
  selector: 'app-edge-details-dialog',
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
    <div class="edge-details-dialog">
      <div mat-dialog-title class="dialog-header">
        <mat-icon class="dialog-icon">timeline</mat-icon>
        <h2>Edge {{ data.source }} → {{ data.target }}</h2>
        <button mat-icon-button mat-dialog-close class="close-button">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div mat-dialog-content class="dialog-content">
        <mat-tab-group>
          
          <!-- Basic Info Tab -->
          <mat-tab label="Basic Info">
            <div class="tab-content">
              <div class="edge-overview">
                <div class="edge-visual">
                  <div class="node-box source-node">
                    <div class="node-id">{{ data.source }}</div>
                    <div class="node-types">
                      @for (type of data.edgeDetails.sourceTypes; track type) {
                        <mat-chip class="type-chip" [class]="'type-' + type.toLowerCase()">
                          {{ type }}
                        </mat-chip>
                      }
                    </div>
                  </div>
                  
                  <div class="edge-arrow">
                    <mat-icon class="arrow-icon">arrow_forward</mat-icon>
                    <div class="edge-info">
                      <div class="edge-type">{{ data.edgeDetails.edgeType }}</div>
                      @if (data.edgeDetails.isCritical) {
                        <div class="critical-indicator">
                          <mat-icon>warning</mat-icon>
                          <span>Critical Edge</span>
                        </div>
                      }
                    </div>
                  </div>
                  
                  <div class="node-box target-node">
                    <div class="node-id">{{ data.target }}</div>
                    <div class="node-types">
                      @for (type of data.edgeDetails.targetTypes; track type) {
                        <mat-chip class="type-chip" [class]="'type-' + type.toLowerCase()">
                          {{ type }}
                        </mat-chip>
                      }
                    </div>
                  </div>
                </div>

                <div class="edge-metrics">
                  <div class="metric-card">
                    <div class="metric-header">
                      <mat-icon>info</mat-icon>
                      <h4>Edge Properties</h4>
                    </div>
                    <div class="metric-content">
                      <div class="metric-row">
                        <span>Edge Type:</span>
                        <span class="metric-value">{{ data.edgeDetails.edgeType }}</span>
                      </div>
                      <div class="metric-row">
                        <span>Path Length:</span>
                        <span class="metric-value">{{ data.edgeDetails.pathLength }}</span>
                      </div>
                      <div class="metric-row">
                        <span>Critical Edge:</span>
                        <span class="metric-value" [class]="data.edgeDetails.isCritical ? 'critical' : 'normal'">
                          {{ data.edgeDetails.isCritical ? 'Yes' : 'No' }}
                        </span>
                      </div>
                      <div class="metric-row">
                        <span>Crosses Layers:</span>
                        <span class="metric-value" [class]="data.edgeDetails.crossesLayers ? 'warning' : 'normal'">
                          {{ data.edgeDetails.crossesLayers ? 'Yes' : 'No' }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="metric-card">
                    <div class="metric-header">
                      <mat-icon>layers</mat-icon>
                      <h4>Layer Information</h4>
                    </div>
                    <div class="metric-content">
                      <div class="metric-row">
                        <span>Source Layer:</span>
                        <span class="metric-value">{{ data.edgeDetails.sourceIterationSet }}</span>
                      </div>
                      <div class="metric-row">
                        <span>Target Layer:</span>
                        <span class="metric-value">{{ data.edgeDetails.targetIterationSet }}</span>
                      </div>
                      <div class="metric-row">
                        <span>Layer Distance:</span>
                        <span class="metric-value">{{ Math.abs(data.edgeDetails.targetIterationSet - data.edgeDetails.sourceIterationSet) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </mat-tab>

          <!-- Impact Analysis Tab -->
          <mat-tab label="Impact Analysis">
            <div class="tab-content">
              <div class="impact-analysis">
                
                <div class="impact-section">
                  <h4>
                    <mat-icon>assessment</mat-icon>
                    Structural Impact
                  </h4>
                  <div class="impact-content">
                    @if (data.edgeDetails.isCritical) {
                      <div class="impact-item critical">
                        <mat-icon>error</mat-icon>
                        <div class="impact-text">
                          <strong>Critical Edge</strong>
                          <p>Removing this edge would disconnect the target node from its only parent, potentially breaking the DAG structure.</p>
                        </div>
                      </div>
                    } @else {
                      <div class="impact-item normal">
                        <mat-icon>check_circle</mat-icon>
                        <div class="impact-text">
                          <strong>Non-Critical Edge</strong>
                          <p>This edge can be removed without disconnecting components, as the target has multiple parents.</p>
                        </div>
                      </div>
                    }

                    @if (data.edgeDetails.crossesLayers) {
                      <div class="impact-item warning">
                        <mat-icon>warning</mat-icon>
                        <div class="impact-text">
                          <strong>Layer-Crossing Edge</strong>
                          <p>This edge spans multiple layers, which may indicate a long-range dependency or potential optimization opportunity.</p>
                        </div>
                      </div>
                    }
                  </div>
                </div>

                <div class="impact-section">
                  <h4>
                    <mat-icon>timeline</mat-icon>
                    Flow Characteristics
                  </h4>
                  <div class="impact-content">
                    <div class="flow-info">
                      <div class="flow-item">
                        <span class="flow-label">Information Flow Direction:</span>
                        <span class="flow-value">{{ data.source }} → {{ data.target }}</span>
                      </div>
                      <div class="flow-item">
                        <span class="flow-label">Source Node Role:</span>
                        <span class="flow-value">{{ getSourceRole() }}</span>
                      </div>
                      <div class="flow-item">
                        <span class="flow-label">Target Node Role:</span>
                        <span class="flow-value">{{ getTargetRole() }}</span>
                      </div>
                      <div class="flow-item">
                        <span class="flow-label">Connection Type:</span>
                        <span class="flow-value">{{ getConnectionType() }}</span>
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
        <button mat-button (click)="navigateToSource()">
          <mat-icon>grain</mat-icon>
          View Source Node
        </button>
        <button mat-button (click)="navigateToTarget()">
          <mat-icon>grain</mat-icon>
          View Target Node
        </button>
        <button mat-button mat-dialog-close>Close</button>
        <button mat-raised-button color="primary" (click)="exportEdgeDetails()">
          <mat-icon>download</mat-icon>
          Export Details
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./edge-details-dialog.component.scss']
})
export class EdgeDetailsDialogComponent {
  public dialogRef = inject(MatDialogRef<EdgeDetailsDialogComponent>);
  public data = inject<EdgeDetailsData>(MAT_DIALOG_DATA);

  Math = Math;

  getSourceRole(): string {
    const types = this.data.edgeDetails.sourceTypes;
    if (types.includes('Source')) return 'Information Source';
    if (types.includes('Fork')) return 'Information Distributor';
    if (types.includes('Join')) return 'Information Aggregator';
    return 'Information Processor';
  }

  getTargetRole(): string {
    const types = this.data.edgeDetails.targetTypes;
    if (types.includes('Sink')) return 'Information Sink';
    if (types.includes('Fork')) return 'Information Distributor';
    if (types.includes('Join')) return 'Information Aggregator';
    return 'Information Processor';
  }

  getConnectionType(): string {
    const sourceTypes = this.data.edgeDetails.sourceTypes;
    const targetTypes = this.data.edgeDetails.targetTypes;
    
    if (sourceTypes.includes('Source') && targetTypes.includes('Sink')) {
      return 'Source-to-Sink';
    } else if (sourceTypes.includes('Fork') && targetTypes.includes('Join')) {
      return 'Fork-to-Join';
    } else if (sourceTypes.includes('Source')) {
      return 'Source Connection';
    } else if (targetTypes.includes('Sink')) {
      return 'Sink Connection';
    }
    
    return 'Internal Connection';
  }

  navigateToSource(): void {
    this.dialogRef.close({ navigateToNode: this.data.source });
  }

  navigateToTarget(): void {
    this.dialogRef.close({ navigateToNode: this.data.target });
  }

  exportEdgeDetails(): void {
    const details = {
      edge: `${this.data.source}->${this.data.target}`,
      source_node: {
        id: this.data.source,
        types: this.data.edgeDetails.sourceTypes,
        iteration_set: this.data.edgeDetails.sourceIterationSet
      },
      target_node: {
        id: this.data.target,
        types: this.data.edgeDetails.targetTypes,
        iteration_set: this.data.edgeDetails.targetIterationSet
      },
      edge_properties: {
        type: this.data.edgeDetails.edgeType,
        is_critical: this.data.edgeDetails.isCritical,
        path_length: this.data.edgeDetails.pathLength,
        crosses_layers: this.data.edgeDetails.crossesLayers,
        layer_distance: Math.abs(this.data.edgeDetails.targetIterationSet - this.data.edgeDetails.sourceIterationSet)
      },
      flow_analysis: {
        source_role: this.getSourceRole(),
        target_role: this.getTargetRole(),
        connection_type: this.getConnectionType()
      }
    };

    const blob = new Blob([JSON.stringify(details, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edge-${this.data.source}-${this.data.target}-details.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  }
}