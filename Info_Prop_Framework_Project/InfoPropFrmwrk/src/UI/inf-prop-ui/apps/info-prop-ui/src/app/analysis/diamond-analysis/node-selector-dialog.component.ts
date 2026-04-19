import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';

interface NodeSelectorData {
  title: string;
  subtitle: string;
  nodes: number[];
  networkStructure?: any;
}

@Component({
  selector: 'app-node-selector-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatCardModule
  ],
  template: `
    <div class="node-selector-dialog">
      <mat-dialog-content>
        <mat-card class="selector-card">
          <mat-card-header>
            <mat-icon mat-card-avatar>grain</mat-icon>
            <mat-card-title>{{ data.title }}</mat-card-title>
            <mat-card-subtitle>{{ data.subtitle }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <mat-list class="node-list">
              @for (nodeId of data.nodes; track nodeId) {
                <mat-list-item class="node-item" (click)="selectNode(nodeId)">
                  <mat-icon matListItemIcon>grain</mat-icon>
                  <div matListItemTitle class="node-id">Node {{ nodeId }}</div>
                  <div matListItemLine class="node-type">{{ getNodeType(nodeId) }}</div>
                  <mat-icon matListItemMeta>chevron_right</mat-icon>
                </mat-list-item>
              }
            </mat-list>
          </mat-card-content>
        </mat-card>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button (click)="cancel()">Cancel</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .node-selector-dialog {
      min-width: 400px;
      max-width: 500px;
    }
    
    .selector-card {
      .node-list {
        .node-item {
          cursor: pointer;
          border-radius: 8px;
          margin-bottom: 0.5rem;
          transition: all 0.2s ease;
          
          &:hover {
            background-color: var(--primary-color-light);
            transform: translateX(4px);
          }
          
          .node-id {
            font-weight: 600;
            color: var(--text-primary);
            font-family: 'Monaco', 'Menlo', monospace;
          }
          
          .node-type {
            font-size: 0.9rem;
            color: var(--text-secondary);
          }
        }
      }
    }
  `]
})
export class NodeSelectorDialogComponent {
  public dialogRef = inject(MatDialogRef<NodeSelectorDialogComponent>);
  public data = inject<NodeSelectorData>(MAT_DIALOG_DATA);

  selectNode(nodeId: number): void {
    this.dialogRef.close({ selectedNode: nodeId });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  getNodeType(nodeId: number): string {
    if (!this.data.networkStructure) return 'Node';
    
    const types: string[] = [];
    if (this.data.networkStructure.source_nodes?.includes(nodeId)) types.push('Source');
    if (this.data.networkStructure.sink_nodes?.includes(nodeId)) types.push('Sink'); 
    if (this.data.networkStructure.fork_nodes?.includes(nodeId)) types.push('Fork');
    if (this.data.networkStructure.join_nodes?.includes(nodeId)) types.push('Join');
    
    return types.length > 0 ? types.join(', ') : 'Regular Node';
  }
}