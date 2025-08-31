import { Component, Inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';

import { RootDiamondStructure } from '../../shared/models/network-analysis.models';

interface RootDiamondDialogData {
  diamond: RootDiamondStructure;
  joinNode: number;
}

@Component({
  selector: 'app-root-diamond-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatDividerModule,
    MatTooltipModule
  ],
  template: `
    <div class="root-diamond-dialog">
      <div class="dialog-header">
        <div class="header-content">
          <mat-icon class="header-icon">diamond</mat-icon>
          <div class="header-text">
            <h2>Root Diamond Structure</h2>
            <p>Join Node {{ data.joinNode }}</p>
          </div>
        </div>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        
        <!-- Basic Properties Card -->
        <mat-card class="property-card">
          <mat-card-header>
            <mat-icon mat-card-avatar>info</mat-icon>
            <mat-card-title>Basic Properties</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="property-grid">
              <div class="property-item">
                <span class="property-label">Join Node</span>
                <span class="property-value join-node">{{ data.joinNode }}</span>
              </div>
              <div class="property-item">
                <span class="property-label">Node Count</span>
                <span class="property-value">{{ data.diamond.diamond.node_count }}</span>
              </div>
              <div class="property-item">
                <span class="property-label">Edge Count</span>
                <span class="property-value">{{ data.diamond.diamond.edge_count }}</span>
              </div>
              <div class="property-item">
                <span class="property-label">Edge/Node Ratio</span>
                <span class="property-value">{{ edgeNodeRatio() }}</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Conditioning Nodes Card -->
        <mat-card class="property-card">
          <mat-card-header>
            <mat-icon mat-card-avatar>grain</mat-icon>
            <mat-card-title>Conditioning Nodes</mat-card-title>
            <mat-card-subtitle>{{ data.diamond.diamond.conditioning_nodes.length }} nodes</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="node-chips-container">
              @for (node of data.diamond.diamond.conditioning_nodes; track node) {
                <mat-chip 
                  class="conditioning-chip"
                  [matTooltip]="'Conditioning Node ' + node"
                  (click)="navigateToNode(node)">
                  <mat-icon matChipAvatar>grain</mat-icon>
                  {{ node }}
                </mat-chip>
              }
            </div>
            @if (data.diamond.diamond.conditioning_nodes.length === 0) {
              <div class="empty-state">
                <mat-icon>info_outline</mat-icon>
                <span>No conditioning nodes</span>
              </div>
            }
          </mat-card-content>
        </mat-card>

        <!-- Relevant Nodes Card -->
        <mat-card class="property-card">
          <mat-card-header>
            <mat-icon mat-card-avatar>category</mat-icon>
            <mat-card-title>Relevant Nodes</mat-card-title>
            <mat-card-subtitle>{{ data.diamond.diamond.relevant_nodes.length }} nodes</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="node-chips-container">
              @for (node of data.diamond.diamond.relevant_nodes; track node) {
                <mat-chip 
                  class="relevant-chip"
                  [matTooltip]="'Relevant Node ' + node"
                  (click)="navigateToNode(node)">
                  <mat-icon matChipAvatar>category</mat-icon>
                  {{ node }}
                </mat-chip>
              }
            </div>
            @if (data.diamond.diamond.relevant_nodes.length === 0) {
              <div class="empty-state">
                <mat-icon>info_outline</mat-icon>
                <span>No relevant nodes</span>
              </div>
            }
          </mat-card-content>
        </mat-card>

        <!-- Non-Diamond Parents Card -->
        <mat-card class="property-card">
          <mat-card-header>
            <mat-icon mat-card-avatar>call_made</mat-icon>
            <mat-card-title>Non-Diamond Parents</mat-card-title>
            <mat-card-subtitle>{{ data.diamond.non_diamond_parents.length }} nodes</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="node-chips-container">
              @for (node of data.diamond.non_diamond_parents; track node) {
                <mat-chip 
                  class="parent-chip"
                  [matTooltip]="'Non-Diamond Parent ' + node"
                  (click)="navigateToNode(node)">
                  <mat-icon matChipAvatar>call_made</mat-icon>
                  {{ node }}
                </mat-chip>
              }
            </div>
            @if (data.diamond.non_diamond_parents.length === 0) {
              <div class="empty-state">
                <mat-icon>check_circle</mat-icon>
                <span>Pure diamond structure - no external parents</span>
              </div>
            }
          </mat-card-content>
        </mat-card>

        <!-- Edge List Preview Card -->
        <mat-card class="property-card">
          <mat-card-header>
            <mat-icon mat-card-avatar>timeline</mat-icon>
            <mat-card-title>Diamond Edges</mat-card-title>
            <mat-card-subtitle>{{ data.diamond.diamond.edgelist.length }} edges</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="edges-preview">
              @for (edge of edgePreview(); track edge.id) {
                <div class="edge-item">
                  <span class="edge-source">{{ edge.source }}</span>
                  <mat-icon class="edge-arrow">arrow_forward</mat-icon>
                  <span class="edge-target">{{ edge.target }}</span>
                </div>
              }
              @if (data.diamond.diamond.edgelist.length > maxEdgePreview) {
                <div class="more-edges">
                  <mat-icon>more_horiz</mat-icon>
                  <span>{{ data.diamond.diamond.edgelist.length - maxEdgePreview }} more edges</span>
                </div>
              }
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Analysis Summary Card -->
        <mat-card class="property-card analysis-summary">
          <mat-card-header>
            <mat-icon mat-card-avatar>analytics</mat-icon>
            <mat-card-title>Diamond Analysis Summary</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-value">{{ diamondComplexity() }}</div>
                <div class="summary-label">Complexity</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">{{ diamondType() }}</div>
                <div class="summary-label">Diamond Type</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">{{ optimizationPotential() }}</div>
                <div class="summary-label">Optimization</div>
              </div>
            </div>
            
            <mat-divider></mat-divider>
            
            <div class="summary-description">
              <p>{{ diamondDescription() }}</p>
            </div>
          </mat-card-content>
        </mat-card>

      </div>

      <div class="dialog-actions">
        <button mat-button mat-dialog-close>Close</button>
        <button mat-raised-button color="primary" (click)="viewFullNetwork()">
          <mat-icon>account_tree</mat-icon>
          View in Network Structure
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./root-diamond-dialog.component.scss']
})
export class RootDiamondDialogComponent {
  maxEdgePreview = 10;

  constructor(
    private dialogRef: MatDialogRef<RootDiamondDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RootDiamondDialogData
  ) {}

  // Computed properties
  edgeNodeRatio = computed(() => {
    const nodeCount = this.data.diamond.diamond.node_count;
    const edgeCount = this.data.diamond.diamond.edge_count;
    return nodeCount > 0 ? (edgeCount / nodeCount).toFixed(2) : '0.00';
  });

  edgePreview = computed(() => {
    return this.data.diamond.diamond.edgelist.slice(0, this.maxEdgePreview).map((edge, index) => ({
      id: `${edge[0]}-${edge[1]}-${index}`,
      source: edge[0],
      target: edge[1]
    }));
  });

  diamondComplexity = computed(() => {
    const nodeCount = this.data.diamond.diamond.node_count;
    const edgeCount = this.data.diamond.diamond.edge_count;
    const ratio = edgeCount / nodeCount;
    
    if (ratio < 1.2) return 'Simple';
    if (ratio < 1.8) return 'Moderate';
    return 'Complex';
  });

  diamondType = computed(() => {
    const conditioningCount = this.data.diamond.diamond.conditioning_nodes.length;
    const relevantCount = this.data.diamond.diamond.relevant_nodes.length;
    const externalParents = this.data.diamond.non_diamond_parents.length;
    
    if (externalParents === 0) return 'Pure';
    if (conditioningCount > relevantCount) return 'Conditioning-Heavy';
    return 'Mixed';
  });

  optimizationPotential = computed(() => {
    const nodeCount = this.data.diamond.diamond.node_count;
    const conditioningCount = this.data.diamond.diamond.conditioning_nodes.length;
    
    if (nodeCount > 20 && conditioningCount > 5) return 'High';
    if (nodeCount > 10 || conditioningCount > 3) return 'Medium';
    return 'Low';
  });

  diamondDescription = computed(() => {
    const nodeCount = this.data.diamond.diamond.node_count;
    const edgeCount = this.data.diamond.diamond.edge_count;
    const conditioningCount = this.data.diamond.diamond.conditioning_nodes.length;
    const externalParents = this.data.diamond.non_diamond_parents.length;
    
    let description = `This root diamond structure contains ${nodeCount} nodes and ${edgeCount} edges, `;
    description += `with ${conditioningCount} conditioning nodes. `;
    
    if (externalParents === 0) {
      description += 'It forms a pure diamond pattern with no external dependencies, ';
      description += 'making it ideal for independent computational optimization.';
    } else {
      description += `It has ${externalParents} external parent connections, `;
      description += 'requiring coordination with other network components during computation.';
    }
    
    return description;
  });

  // Event handlers
  navigateToNode(nodeId: number): void {
    this.dialogRef.close({ navigateToNode: nodeId });
  }

  viewFullNetwork(): void {
    this.dialogRef.close({ viewFullNetwork: true });
  }
}