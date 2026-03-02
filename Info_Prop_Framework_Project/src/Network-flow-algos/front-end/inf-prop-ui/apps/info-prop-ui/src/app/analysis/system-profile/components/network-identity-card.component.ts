import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NetworkInfo } from '../../../shared/models/system-profile.models';

@Component({
  selector: 'app-network-identity-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatChipsModule, MatIconModule, MatTooltipModule],
  template: `
    @if (networkInfo(); as info) {
    <mat-card class="identity-card">
      <mat-card-content>
        <div class="identity-grid">
          <!-- Network name and topology badge -->
          <div class="identity-header">
            <h3 class="network-name">{{ info.name }}</h3>
            <span class="topology-badge" [class]="info.topology.type">
              {{ info.topology.type | uppercase }}
            </span>
            <span class="complexity-badge" [class]="info.complexity.level"
                  [matTooltip]="'Edge/node ratio: ' + info.complexity.edgeNodeRatio.toFixed(2) + ', Avg degree: ' + info.complexity.averageDegree.toFixed(1) + ', Max degree: ' + info.complexity.maxDegree">
              {{ info.complexity.level | titlecase }}
            </span>
          </div>

          <!-- Counts row -->
          <div class="counts-row">
            <div class="count-item">
              <span class="count-value">{{ info.totalNodes }}</span>
              <span class="count-label">Nodes</span>
            </div>
            <div class="count-item">
              <span class="count-value">{{ info.totalEdges }}</span>
              <span class="count-label">Edges</span>
            </div>
            <div class="count-item">
              <span class="count-value">{{ info.topology.layers }}</span>
              <span class="count-label">Layers</span>
            </div>
            <div class="count-item">
              <span class="count-value">{{ info.topology.maxWidth }}</span>
              <span class="count-label">Max Width</span>
            </div>
          </div>

          <!-- Node type chips -->
          <div class="node-types">
            <mat-chip-set>
              <mat-chip class="chip-source" [matTooltip]="'Source nodes: ' + info.sourceNodes.join(', ')">
                <mat-icon matChipAvatar>input</mat-icon>
                {{ info.sourceNodes.length }} Sources
              </mat-chip>
              <mat-chip class="chip-sink" [matTooltip]="'Sink nodes: ' + info.sinkNodes.join(', ')">
                <mat-icon matChipAvatar>output</mat-icon>
                {{ info.sinkNodes.length }} Sinks
              </mat-chip>
              <mat-chip class="chip-fork" [matTooltip]="'Fork nodes: ' + info.forkNodes.join(', ')">
                <mat-icon matChipAvatar>call_split</mat-icon>
                {{ info.forkNodes.length }} Forks
              </mat-chip>
              <mat-chip class="chip-join" [matTooltip]="'Join nodes: ' + info.joinNodes.join(', ')">
                <mat-icon matChipAvatar>call_merge</mat-icon>
                {{ info.joinNodes.length }} Joins
              </mat-chip>
            </mat-chip-set>
          </div>

          <!-- Topology stats -->
          <div class="topology-stats">
            <span class="stat">
              Branching: <strong>{{ info.topology.branchingFactor.toFixed(1) }}</strong>
            </span>
            <span class="stat">
              Convergence pts: <strong>{{ info.topology.convergencePoints }}</strong>
            </span>
          </div>
        </div>
      </mat-card-content>
    </mat-card>
    }
  `,
  styles: [`
    .identity-card {
      background: var(--surface-container);
      border: 1px solid var(--outline-variant);
    }

    .identity-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .identity-header {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .network-name {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    }

    .topology-badge, .complexity-badge {
      display: inline-flex;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .topology-badge {
      background: rgba(38, 139, 210, 0.15);
      color: #268bd2;
      border: 1px solid rgba(38, 139, 210, 0.3);

      &.tree { background: rgba(133, 153, 0, 0.15); color: #859900; border-color: rgba(133, 153, 0, 0.3); }
      &.cyclic { background: rgba(220, 50, 47, 0.15); color: #dc322f; border-color: rgba(220, 50, 47, 0.3); }
      &.mixed { background: rgba(203, 75, 22, 0.15); color: #cb4b16; border-color: rgba(203, 75, 22, 0.3); }
    }

    .complexity-badge {
      &.simple { background: rgba(133, 153, 0, 0.15); color: #859900; border: 1px solid rgba(133, 153, 0, 0.3); }
      &.moderate { background: rgba(181, 137, 0, 0.15); color: #b58900; border: 1px solid rgba(181, 137, 0, 0.3); }
      &.complex { background: rgba(203, 75, 22, 0.15); color: #cb4b16; border: 1px solid rgba(203, 75, 22, 0.3); }
      &.very-complex { background: rgba(220, 50, 47, 0.15); color: #dc322f; border: 1px solid rgba(220, 50, 47, 0.3); }
    }

    .counts-row {
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
    }

    .count-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 60px;
    }

    .count-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--primary-color);
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    }

    .count-label {
      font-size: 0.75rem;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .node-types {
      mat-chip-set { display: flex; flex-wrap: wrap; gap: 4px; }
    }

    .chip-source { --mdc-chip-elevated-container-color: rgba(133, 153, 0, 0.12); color: #859900 !important; }
    .chip-sink   { --mdc-chip-elevated-container-color: rgba(220, 50, 47, 0.12); color: #dc322f !important; }
    .chip-fork   { --mdc-chip-elevated-container-color: rgba(203, 75, 22, 0.12); color: #cb4b16 !important; }
    .chip-join   { --mdc-chip-elevated-container-color: rgba(108, 113, 196, 0.12); color: #6c71c4 !important; }

    .topology-stats {
      display: flex;
      gap: 24px;
      font-size: 0.85rem;
      color: var(--text-secondary);

      strong { color: var(--text-primary); }
    }

    @media (max-width: 600px) {
      .counts-row { gap: 16px; }
      .count-value { font-size: 1.2rem; }
    }
  `]
})
export class NetworkIdentityCardComponent {
  networkInfo = input.required<NetworkInfo>();
}
