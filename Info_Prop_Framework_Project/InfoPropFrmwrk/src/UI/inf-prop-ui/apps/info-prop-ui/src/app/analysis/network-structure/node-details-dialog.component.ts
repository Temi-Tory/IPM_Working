import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';

interface NodeDetailsData {
  nodeId: number;
  nodeDetails: {
    nodeId: number;
    types: string[];
    inDegree: number;
    outDegree: number;
    parents: number[];
    children: number[];
    ancestors: number[];
    descendants: number[];
    iterationSet: number;
    isChokepoint: boolean;
    connectivity: {
      totalConnections: number;
      connectivityRatio: number;
    };
  };
  networkData: any;
}

@Component({
  selector: 'app-node-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatCardModule,
    MatChipsModule,
    MatListModule,
    MatTooltipModule
  ],
  template: `
    <div class="node-details-dialog">
      <div mat-dialog-title class="dialog-header">
        <mat-icon class="dialog-icon">grain</mat-icon>
        <h2>Node {{ data.nodeId }} Details</h2>
        <button mat-icon-button mat-dialog-close class="close-button">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div mat-dialog-content class="dialog-content">
        <mat-tab-group>
          
          <!-- Basic Info Tab -->
          <mat-tab label="Basic Info">
            <div class="tab-content">
              <div class="info-grid">
                <div class="info-card">
                  <div class="info-header">
                    <mat-icon>info</mat-icon>
                    <h4>Node Classification</h4>
                  </div>
                  <div class="info-content">
                    <div class="node-types">
                      @for (type of data.nodeDetails.types; track type) {
                        <mat-chip class="type-chip" [class]="'type-' + type.toLowerCase()">
                          {{ type }}
                        </mat-chip>
                      }
                    </div>
                    @if (data.nodeDetails.isChokepoint) {
                      <div class="chokepoint-indicator">
                        <mat-icon color="warn">warning</mat-icon>
                        <span>Structural Chokepoint</span>
                      </div>
                    }
                  </div>
                </div>

                <div class="info-card">
                  <div class="info-header">
                    <mat-icon>device_hub</mat-icon>
                    <h4>Connectivity</h4>
                  </div>
                  <div class="info-content">
                    <div class="connectivity-metrics">
                      <div class="metric-row">
                        <span class="metric-label"
                              matTooltip="Number of incoming edges to this node"
                              matTooltipPosition="above">
                          In-Degree:
                          <mat-icon class="info-icon">info_outline</mat-icon>
                        </span>
                        <span class="metric-value">{{ data.nodeDetails.inDegree }}</span>
                      </div>
                      <div class="metric-row">
                        <span class="metric-label"
                              matTooltip="Number of outgoing edges from this node"
                              matTooltipPosition="above">
                          Out-Degree:
                          <mat-icon class="info-icon">info_outline</mat-icon>
                        </span>
                        <span class="metric-value">{{ data.nodeDetails.outDegree }}</span>
                      </div>
                      <div class="metric-row">
                        <span class="metric-label"
                              matTooltip="Total number of connections (in-degree + out-degree)"
                              matTooltipPosition="above">
                          Total Connections:
                          <mat-icon class="info-icon">info_outline</mat-icon>
                        </span>
                        <span class="metric-value">{{ data.nodeDetails.connectivity.totalConnections }}</span>
                      </div>
                      <div class="metric-row">
                        <span class="metric-label"
                              matTooltip="Percentage of this node's connections relative to total network connections. Formula: (node connections / total network edges) × 100"
                              matTooltipPosition="above">
                          Connectivity Ratio:
                          <mat-icon class="info-icon">info_outline</mat-icon>
                        </span>
                        <span class="metric-value">{{ (data.nodeDetails.connectivity.connectivityRatio * 100).toFixed(1) }}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="info-card">
                  <div class="info-header">
                    <mat-icon>layers</mat-icon>
                    <h4>DAG Position</h4>
                  </div>
                  <div class="info-content">
                    <div class="position-info">
                      <div class="metric-row">
                        <span>Iteration Set (Layer):</span>
                        <span class="metric-value">{{ data.nodeDetails.iterationSet }}</span>
                      </div>
                      <div class="metric-row">
                        <span>Ancestors Count:</span>
                        <span class="metric-value">{{ data.nodeDetails.ancestors.length }}</span>
                      </div>
                      <div class="metric-row">
                        <span>Descendants Count:</span>
                        <span class="metric-value">{{ data.nodeDetails.descendants.length }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </mat-tab>

          <!-- Relationships Tab -->
          <mat-tab label="Relationships">
            <div class="tab-content">
              <div class="relationships-grid">
                
                <!-- Direct Parents -->
                <div class="relationship-section">
                  <h4>
                    <mat-icon>arrow_upward</mat-icon>
                    Direct Parents ({{ data.nodeDetails.parents.length }})
                  </h4>
                  @if (data.nodeDetails.parents.length > 0) {
                    <mat-list class="node-list">
                      @for (parent of data.nodeDetails.parents; track parent) {
                        <mat-list-item class="node-item">
                          <mat-icon matListItemIcon>grain</mat-icon>
                          <span matListItemTitle>Node {{ parent }}</span>
                          <button mat-icon-button matListItemMeta (click)="navigateToNode(parent)">
                            <mat-icon>open_in_new</mat-icon>
                          </button>
                        </mat-list-item>
                      }
                    </mat-list>
                  } @else {
                    <div class="empty-state">
                      <mat-icon>info</mat-icon>
                      <span>No direct parents (this is a source node)</span>
                    </div>
                  }
                </div>

                <!-- Direct Children -->
                <div class="relationship-section">
                  <h4>
                    <mat-icon>arrow_downward</mat-icon>
                    Direct Children ({{ data.nodeDetails.children.length }})
                  </h4>
                  @if (data.nodeDetails.children.length > 0) {
                    <mat-list class="node-list">
                      @for (child of data.nodeDetails.children; track child) {
                        <mat-list-item class="node-item">
                          <mat-icon matListItemIcon>grain</mat-icon>
                          <span matListItemTitle>Node {{ child }}</span>
                          <button mat-icon-button matListItemMeta (click)="navigateToNode(child)">
                            <mat-icon>open_in_new</mat-icon>
                          </button>
                        </mat-list-item>
                      }
                    </mat-list>
                  } @else {
                    <div class="empty-state">
                      <mat-icon>info</mat-icon>
                      <span>No direct children (this is a sink node)</span>
                    </div>
                  }
                </div>
              </div>
            </div>
          </mat-tab>

          <!-- Hierarchy Tab -->
          <mat-tab label="Hierarchy">
            <div class="tab-content">
              <div class="hierarchy-sections">
                
                <!-- All Ancestors -->
                <div class="hierarchy-section">
                  <h4>
                    <mat-icon>account_tree</mat-icon>
                    All Ancestors ({{ data.nodeDetails.ancestors.length }})
                  </h4>
                  <div class="hierarchy-description">
                    <p>All nodes that can reach this node through any path</p>
                  </div>
                  @if (data.nodeDetails.ancestors.length > 0) {
                    <div class="node-chips">
                      @for (ancestor of data.nodeDetails.ancestors; track ancestor) {
                        <mat-chip class="node-chip" (click)="navigateToNode(ancestor)">
                          {{ ancestor }}
                        </mat-chip>
                      }
                    </div>
                  } @else {
                    <div class="empty-state">
                      <mat-icon>info</mat-icon>
                      <span>No ancestors - this is a root node</span>
                    </div>
                  }
                </div>

                <!-- All Descendants -->
                <div class="hierarchy-section">
                  <h4>
                    <mat-icon>account_tree</mat-icon>
                    All Descendants ({{ data.nodeDetails.descendants.length }})
                  </h4>
                  <div class="hierarchy-description">
                    <p>All nodes reachable from this node through any path</p>
                  </div>
                  @if (data.nodeDetails.descendants.length > 0) {
                    <div class="node-chips">
                      @for (descendant of data.nodeDetails.descendants; track descendant) {
                        <mat-chip class="node-chip" (click)="navigateToNode(descendant)">
                          {{ descendant }}
                        </mat-chip>
                      }
                    </div>
                  } @else {
                    <div class="empty-state">
                      <mat-icon>info</mat-icon>
                      <span>No descendants - this is a leaf node</span>
                    </div>
                  }
                </div>
              </div>
            </div>
          </mat-tab>

        </mat-tab-group>
      </div>

      <div mat-dialog-actions class="dialog-actions">
        <button mat-button mat-dialog-close>Close</button>
        <button mat-raised-button color="primary" (click)="exportNodeDetails()">
          <mat-icon>download</mat-icon>
          Export Details
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./node-details-dialog.component.scss']
})
export class NodeDetailsDialogComponent {
  public dialogRef = inject(MatDialogRef<NodeDetailsDialogComponent>);
  public data = inject<NodeDetailsData>(MAT_DIALOG_DATA);

  navigateToNode(nodeId: number): void {
    // Close current dialog and open new one for the selected node
    this.dialogRef.close({ navigateToNode: nodeId });
  }

  exportNodeDetails(): void {
    const details = {
      node_id: this.data.nodeId,
      basic_info: {
        types: this.data.nodeDetails.types,
        in_degree: this.data.nodeDetails.inDegree,
        out_degree: this.data.nodeDetails.outDegree,
        is_chokepoint: this.data.nodeDetails.isChokepoint,
        iteration_set: this.data.nodeDetails.iterationSet
      },
      relationships: {
        direct_parents: this.data.nodeDetails.parents,
        direct_children: this.data.nodeDetails.children,
        all_ancestors: this.data.nodeDetails.ancestors,
        all_descendants: this.data.nodeDetails.descendants
      },
      connectivity: this.data.nodeDetails.connectivity
    };

    const blob = new Blob([JSON.stringify(details, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `node-${this.data.nodeId}-details.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  }
}