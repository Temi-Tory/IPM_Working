import { Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  ScenarioAnalysisResult,
  ScenarioMetricRow,
  PROFILE_METRICS
} from '../../../shared/models/system-profile.models';
import { AnalysisStateService } from '../../../shared/services/analysis-state.service';
import {
  NODE_TYPE_COLORS,
  buildLayeredPrimitiveGraph,
  PrimitiveGraphData
} from '../../../shared/utils/network-graph-primitives';

@Component({
  selector: 'app-network-lens',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
    <mat-card class="lens-card">
      <mat-card-content>
        <h4 class="section-title">
          <mat-icon>hub</mat-icon>
          Network Lens
          <span class="title-meta">{{ selectedGraphFocusLabel() }}</span>
        </h4>

        @if (!graphData()) {
          <div class="lens-empty">No network structure available for graph lens.</div>
        } @else {
          <div class="lens-meta">
            <span class="meta-chip">
              <mat-icon>analytics</mat-icon>
              {{ selectedScenario() || '—' }}
            </span>
            <span class="meta-chip">
              <mat-icon>insights</mat-icon>
              {{ selectedMetricLabel() }}
            </span>
            <span class="meta-chip highlight-chip">
              <mat-icon>highlight</mat-icon>
              {{ highlightedNodeSet().size }} nodes
            </span>
          </div>

          <div class="lens-toolbar">
            <button mat-icon-button (click)="zoomOut()" matTooltip="Zoom out">
              <mat-icon>zoom_out</mat-icon>
            </button>
            <span class="zoom-level">{{ zoomPercent() }}</span>
            <button mat-icon-button (click)="zoomIn()" matTooltip="Zoom in">
              <mat-icon>zoom_in</mat-icon>
            </button>
            <button mat-icon-button (click)="resetZoom()" matTooltip="Reset zoom">
              <mat-icon>center_focus_strong</mat-icon>
            </button>
            <button mat-icon-button (click)="clearSelection()" matTooltip="Clear selection" [disabled]="!selectedNodeId() && !selectedEdgeId()">
              <mat-icon>clear</mat-icon>
            </button>
          </div>

          <svg class="lens-svg" [attr.viewBox]="'0 0 ' + graphData()!.width + ' ' + graphData()!.height" role="img"
            aria-label="Network lens graph">
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto">
                <path d="M 0 0 L 8 4 L 0 8 Z" [attr.fill]="'var(--text-secondary)'" />
              </marker>
              <marker id="arrowhead-highlight" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto">
                <path d="M 0 0 L 8 4 L 0 8 Z" [attr.fill]="'var(--primary-color)'" />
              </marker>
              <marker id="arrowhead-muted" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto">
                <path d="M 0 0 L 8 4 L 0 8 Z" [attr.fill]="'var(--text-disabled)'" />
              </marker>
            </defs>
            
            <g [attr.transform]="graphTransform()">
              @for (edge of graphData()!.edges; track edge.id) {
                <line [attr.x1]="nodePositionMap().get(edge.source)?.x" [attr.y1]="nodePositionMap().get(edge.source)?.y"
                  [attr.x2]="nodePositionMap().get(edge.target)?.x" [attr.y2]="nodePositionMap().get(edge.target)?.y"
                  [attr.stroke]="edgeStroke(edge.source, edge.target)"
                  [attr.stroke-opacity]="edgeStrokeOpacity(edge.source, edge.target)"
                  [attr.stroke-width]="edgeStrokeWidth(edge.source, edge.target)"
                  [attr.marker-end]="edgeMarker(edge.source, edge.target)"
                  class="lens-edge" (click)="selectEdge(edge.source, edge.target)" />
              }

              @for (node of graphData()!.nodes; track node.id) {
                <circle [attr.cx]="node.x" [attr.cy]="node.y" [attr.r]="nodeRadius(node.id)"
                  [attr.fill]="nodeFill(node.id, node.nodeType)" [attr.stroke]="nodeStroke(node.id)"
                  [attr.stroke-width]="nodeStrokeWidth(node.id)" class="lens-node" (click)="selectNode(node.id)" />
              }

              @for (node of graphData()!.nodes; track node.id) {
                <text [attr.x]="node.x" [attr.y]="node.y + 3" text-anchor="middle" class="node-label">{{ node.id }}</text>
              }
            </g>
          </svg>

          @if (selectedNodeId() || selectedEdgeId()) {
          <mat-card class="selection-card">
            <mat-card-content>
              <div class="selection-header">
                <div class="selection-title">
                  <mat-icon>{{selectedNodeId() ? 'circle' : 'arrow_forward'}}</mat-icon>
                  <span>{{selectedNodeId() ? 'Node' : 'Edge'}} <strong>{{ selectedNodeId() || selectedEdgeId() }}</strong></span>
                </div>
                <button mat-icon-button (click)="clearSelection()" matTooltip="Close">
                  <mat-icon>close</mat-icon>
                </button>
              </div>

              <div class="selection-content">
                <div class="focus-summary">
                  <span class="focus-label">Cross-Scenario Coverage:</span>
                  <span class="focus-value">{{ selectionFocusCount() }} / {{ rows().length }} scenarios highlight this {{ selectedNodeId() ? 'node' : 'edge' }}</span>
                </div>

                <div class="scenario-list">
                  @for (row of selectionScenarioDetails(); track row.scenario) {
                  <div class="scenario-item" [class.highlighted]="row.inFocus">
                    <div class="scenario-header">
                      <span class="scenario-name">{{ row.scenario }}</span>
                      <span class="scenario-status" [class.focused]="row.inFocus">
                        <mat-icon>{{ row.inFocus ? 'radio_button_checked' : 'radio_button_unchecked' }}</mat-icon>
                        {{ row.inFocus ? 'Highlighted' : 'Not highlighted' }}
                      </span>
                    </div>
                    @if (row.roleInfo) {
                    <div class="scenario-role">{{ row.roleInfo }}</div>
                    }
                  </div>
                  }
                </div>
              </div>
            </mat-card-content>
          </mat-card>
          }

          <div class="lens-legend">
            <div class="legend-item">
              <mat-icon>info_outline</mat-icon>
              <span>{{ highlightReasonSummary() }}</span>
            </div>
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .lens-card {
      background: var(--surface-container);
      border: 1px solid var(--outline-variant);
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 14px;
      font-size: 1.05rem;
      font-weight: 500;
      color: var(--text-primary);

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: var(--primary-color);
      }

      .title-meta {
        margin-left: auto;
        font-size: 0.84rem;
        font-weight: 400;
        color: var(--text-secondary);
      }
    }

    .lens-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }

    .meta-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 16px;
      background: var(--surface);
      border: 1px solid var(--outline-variant);
      font-size: 0.82rem;
      color: var(--text-secondary);

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: var(--text-secondary);
      }

      &.highlight-chip {
        border-color: color-mix(in srgb, var(--primary-color) 40%, var(--outline-variant));
        background: color-mix(in srgb, var(--primary-color) 8%, var(--surface));
        
        mat-icon {
          color: var(--primary-color);
        }
      }
    }

    .lens-svg {
      width: 100%;
      height: 540px;
      border: 1px solid var(--outline-variant);
      border-radius: 8px;
      background: color-mix(in srgb, var(--surface) 97%, var(--surface-container) 3%);
    }

    .lens-toolbar {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 10px;
      color: var(--text-secondary);

      button {
        &:disabled {
          opacity: 0.4;
        }
      }
    }

    .zoom-level {
      min-width: 52px;
      text-align: center;
      font-size: 0.82rem;
      color: var(--text-secondary);
      font-weight: 600;
    }

    .lens-edge,
    .lens-node {
      cursor: pointer;
      transition: all 120ms ease;
    }

    .lens-edge:hover {
      stroke-opacity: 1 !important;
      stroke-width: 2.5 !important;
    }

    .lens-node:hover {
      filter: brightness(1.12);
    }

    .node-label {
      font-size: 8px;
      fill: var(--text-primary);
      pointer-events: none;
      font-weight: 600;
      text-shadow: 0 0 3px var(--surface), 0 0 5px var(--surface);
    }

    .selection-card {
      margin-top: 16px;
      background: var(--surface);
      border: 1px solid var(--outline-variant);
    }

    .selection-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }

    .selection-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.92rem;
      color: var(--text-primary);

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: var(--primary-color);
      }

      strong {
        color: var(--primary-color);
      }
    }

    .selection-content {
      display: grid;
      gap: 14px;
    }

    .focus-summary {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 10px 12px;
      border-radius: 8px;
      background: color-mix(in srgb, var(--primary-color) 6%, var(--surface-container));
      border: 1px solid color-mix(in srgb, var(--primary-color) 20%, var(--outline-variant));
    }

    .focus-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-secondary);
      font-weight: 600;
    }

    .focus-value {
      font-size: 0.88rem;
      color: var(--text-primary);
      font-weight: 500;
    }

    .scenario-list {
      display: grid;
      gap: 8px;
      max-height: 320px;
      overflow-y: auto;
    }

    .scenario-item {
      padding: 10px 12px;
      border: 1px solid var(--outline-variant);
      border-radius: 8px;
      background: var(--surface-container);
      transition: all 150ms ease;

      &.highlighted {
        border-color: color-mix(in srgb, var(--primary-color) 50%, var(--outline-variant));
        background: color-mix(in srgb, var(--primary-color) 8%, var(--surface));
      }
    }

    .scenario-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .scenario-name {
      font-size: 0.85rem;
      color: var(--text-primary);
      font-weight: 600;
    }

    .scenario-status {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.78rem;
      color: var(--text-secondary);

      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }

      &.focused {
        color: var(--primary-color);
        font-weight: 500;

        mat-icon {
          color: var(--primary-color);
        }
      }
    }

    .scenario-role {
      margin-top: 6px;
      font-size: 0.78rem;
      color: var(--text-secondary);
      font-style: italic;
    }

    .lens-legend {
      margin-top: 14px;
      display: grid;
      gap: 8px;
    }

    .legend-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 8px;
      background: color-mix(in srgb, var(--surface-container) 50%, var(--surface));
      font-size: 0.82rem;
      color: var(--text-secondary);
      line-height: 1.5;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: var(--primary-color);
        flex-shrink: 0;
      }
    }

    .lens-empty {
      color: var(--text-secondary);
      padding: 16px 0;
      text-align: center;
    }
  `]
})
export class NetworkLensComponent {
  private analysisState = inject(AnalysisStateService);
  private _selectedNodeId = signal<string | null>(null);
  private _selectedEdgeId = signal<string | null>(null);
  private zoomLevel = signal(1);

  rows = input.required<ScenarioMetricRow[]>();
  scenarioResults = input.required<Map<string, ScenarioAnalysisResult>>();
  selectedScenario = input.required<string>();
  selectedMetricKey = input.required<string>();
  selectedGraphFocus = input.required<string>();

  zoomPercent = computed(() => `${Math.round(this.zoomLevel() * 100)}%`);

  graphTransform = computed(() => {
    const graph = this.graphData();
    if (!graph) {
      return 'translate(0,0) scale(1)';
    }

    const zoom = this.zoomLevel();
    const cx = graph.width / 2;
    const cy = graph.height / 2;
    return `translate(${cx} ${cy}) scale(${zoom}) translate(${-cx} ${-cy})`;
  });

  graphData = computed<PrimitiveGraphData | null>(() => {
    const network = this.analysisState.networkData();
    if (!network) {
      return null;
    }
    return buildLayeredPrimitiveGraph(network, 1000, 520);
  });

  nodePositionMap = computed(() => {
    const map = new Map<string, { x: number; y: number }>();
    const graph = this.graphData();
    if (!graph) {
      return map;
    }
    for (const node of graph.nodes) {
      map.set(node.id, { x: node.x, y: node.y });
    }
    return map;
  });

  selectedMetricLabel = computed(() => {
    const metric = PROFILE_METRICS.find(m => m.key === this.selectedMetricKey());
    return metric?.label ?? this.selectedMetricKey();
  });

  selectedNodeId = computed(() => this._selectedNodeId());
  selectedEdgeId = computed(() => this._selectedEdgeId());

  selectionScenarioDetails = computed(() => {
    const selectedNode = this._selectedNodeId();
    const selectedEdge = this._selectedEdgeId();
    const graphFocus = this.selectedGraphFocus();

    if (!selectedNode && !selectedEdge) {
      return [] as Array<{ scenario: string; inFocus: boolean; roleInfo?: string }>;
    }

    return this.rows().map(row => {
      const inFocus = selectedNode
        ? this.getHighlightedNodeSetForScenario(row.scenario).has(selectedNode)
        : selectedEdge
          ? this.getHighlightedEdgeSetForScenario(row.scenario).has(selectedEdge)
          : false;

      let roleInfo: string | undefined;
      if (inFocus && selectedNode) {
        roleInfo = this.getNodeRoleInfo(row.scenario, selectedNode, graphFocus);
      }

      return {
        scenario: row.scenario,
        inFocus,
        roleInfo
      };
    });
  });

  selectionFocusCount = computed(() => {
    return this.selectionScenarioDetails().filter(d => d.inFocus).length;
  });

  highlightReasonSummary = computed(() => {
    const graphFocus = this.selectedGraphFocusLabel();
    const highlighted = this.highlightedNodeSet().size;
    const edges = this.highlightedEdgeSet().size;
    
    if (highlighted === 0 && edges === 0) {
      return `No elements highlighted. Graph focus: ${graphFocus}.`;
    }

    const parts: string[] = [];
    if (highlighted > 0) {
      parts.push(`${highlighted} node${highlighted > 1 ? 's' : ''}`);
    }
    if (edges > 0) {
      parts.push(`${edges} edge${edges > 1 ? 's' : ''}`);
    }
    
    return `Highlighting ${parts.join(' and ')} based on ${graphFocus} for ${this.selectedScenario() || 'selected scenario'}.`;
  });

  selectedGraphFocusLabel = computed(() => {
    switch (this.selectedGraphFocus()) {
      case 'capacity-bottlenecks': return 'Capacity Bottlenecks';
      case 'capacity-upgrades': return 'Upgrade Priorities';
      case 'capacity-critical-paths': return 'Capacity Critical Paths';
      case 'cpm-critical-nodes': return 'CPM Critical Nodes';
      case 'reachability-low-belief': return 'Low Belief / High Uncertainty';
      case 'diamond-structure': return 'Diamond Structure Nodes';
      default: return 'Graph Focus';
    }
  });

  highlightedNodeSet = computed(() => {
    return this.getHighlightedNodeSetForScenario(this.selectedScenario());
  });

  highlightedEdgeSet = computed(() => {
    return this.getHighlightedEdgeSetForScenario(this.selectedScenario());
  });

  isNodeHighlighted(nodeId: string): boolean {
    return this.highlightedNodeSet().has(nodeId);
  }

  isEdgeHighlighted(source: string, target: string): boolean {
    return this.highlightedEdgeSet().has(this.edgeKey(source, target));
  }

  edgeMarker(source: string, target: string): string {
    const key = this.edgeKey(source, target);
    const isSelected = this._selectedEdgeId() === key;
    const isHighlighted = this.isEdgeHighlighted(source, target);
    const hasAnyHighlights = this.highlightedEdgeSet().size > 0;

    if (isSelected || isHighlighted) {
      return 'url(#arrowhead-highlight)';
    }
    if (hasAnyHighlights) {
      return 'url(#arrowhead-muted)';
    }
    return 'url(#arrowhead)';
  }

  selectNode(nodeId: string): void {
    this._selectedNodeId.set(nodeId);
    this._selectedEdgeId.set(null);
  }

  selectEdge(source: string, target: string): void {
    this._selectedNodeId.set(null);
    this._selectedEdgeId.set(this.edgeKey(source, target));
  }

  clearSelection(): void {
    this._selectedNodeId.set(null);
    this._selectedEdgeId.set(null);
  }

  zoomIn(): void {
    this.zoomLevel.set(Math.min(1.9, this.zoomLevel() + 0.15));
  }

  zoomOut(): void {
    this.zoomLevel.set(Math.max(0.7, this.zoomLevel() - 0.15));
  }

  resetZoom(): void {
    this.zoomLevel.set(1);
  }

  nodeRadius(nodeId: string): number {
    const graph = this.graphData();
    if (!graph) {
      return 7;
    }

    const nodeCount = Math.max(graph.nodes.length, 1);
    const areaPerNode = (graph.width * graph.height) / nodeCount;
    const base = Math.max(5.2, Math.min(9.8, Math.sqrt(areaPerNode) / 13));
    const zoomAdjusted = base / Math.sqrt(this.zoomLevel());
    return this.isNodeHighlighted(nodeId) ? zoomAdjusted * 1.35 : zoomAdjusted;
  }

  nodeFill(nodeId: string, nodeType: keyof typeof NODE_TYPE_COLORS): string {
    const isSelected = this._selectedNodeId() === nodeId;
    const isHighlighted = this.isNodeHighlighted(nodeId);
    const hasAnyHighlights = this.highlightedNodeSet().size > 0;

    if (isSelected) {
      return 'var(--primary-color)';
    }
    if (isHighlighted) {
      return 'color-mix(in srgb, var(--primary-color) 78%, var(--surface) 22%)';
    }
    // When highlights are active, non-highlighted nodes get neutral color
    if (hasAnyHighlights) {
      return 'var(--text-disabled)';
    }
    // No highlights active: show node type colors
    return this.nodeColor(nodeType);
  }

  nodeStroke(nodeId: string): string {
    const isSelected = this._selectedNodeId() === nodeId;
    const isHighlighted = this.isNodeHighlighted(nodeId);
    const hasAnyHighlights = this.highlightedNodeSet().size > 0;

    if (isSelected) {
      return 'var(--on-primary)';
    }
    if (isHighlighted) {
      return 'var(--primary-color)';
    }
    // When highlights are active, non-highlighted nodes get muted stroke
    if (hasAnyHighlights) {
      return 'var(--outline-variant)';
    }
    return 'var(--outline-variant)';
  }

  nodeStrokeWidth(nodeId: string): number {
    if (this._selectedNodeId() === nodeId) {
      return 2.6;
    }
    return this.isNodeHighlighted(nodeId) ? 2.1 : 1.2;
  }

  edgeStroke(source: string, target: string): string {
    const key = this.edgeKey(source, target);
    const isSelected = this._selectedEdgeId() === key;
    const isHighlighted = this.isEdgeHighlighted(source, target);
    const hasAnyHighlights = this.highlightedEdgeSet().size > 0;

    if (isSelected) {
      return 'var(--primary-color)';
    }
    if (isHighlighted) {
      return 'color-mix(in srgb, var(--primary-color) 82%, var(--surface) 18%)';
    }
    // When highlights are active, non-highlighted edges get very muted color
    if (hasAnyHighlights) {
      return 'var(--text-disabled)';
    }
    return 'var(--text-secondary)';
  }

  edgeStrokeOpacity(source: string, target: string): number {
    const key = this.edgeKey(source, target);
    const isSelected = this._selectedEdgeId() === key;
    const isHighlighted = this.isEdgeHighlighted(source, target);
    const hasAnyHighlights = this.highlightedEdgeSet().size > 0;

    if (isSelected) {
      return 1;
    }
    if (isHighlighted) {
      return 0.88;
    }
    // When highlights are active, non-highlighted edges are very faint
    if (hasAnyHighlights) {
      return 0.15;
    }
    return 0.42;
  }

  edgeStrokeWidth(source: string, target: string): number {
    const key = this.edgeKey(source, target);
    const base = 1.1 / Math.sqrt(this.zoomLevel());
    if (this._selectedEdgeId() === key) {
      return base + 1.5;
    }
    return this.isEdgeHighlighted(source, target) ? base + 0.9 : base;
  }

  nodeColor(nodeType: keyof typeof NODE_TYPE_COLORS): string {
    return NODE_TYPE_COLORS[nodeType] ?? NODE_TYPE_COLORS.regular;
  }

  private edgeKey(source: string, target: string): string {
    return `${source}->${target}`;
  }

  private getNodeRoleInfo(scenarioName: string, nodeId: string, graphFocus: string): string | undefined {
    const scenario = this.scenarioResults().get(scenarioName);
    if (!scenario) {
      return undefined;
    }

    if (graphFocus === 'capacity-bottlenecks') {
      return 'Identified as capacity bottleneck';
    }
    if (graphFocus === 'capacity-upgrades') {
      const upgrades = scenario.capacityAnalysis?.comparative_analysis?.upgrade_priorities ?? [];
      const upgrade = upgrades.find(u => String(u.node) === nodeId);
      if (upgrade) {
        return `Upgrade priority: ${upgrade.priority} (gap: ${upgrade.gap.toFixed(2)})`;
      }
      return 'Recommended for capacity upgrade';
    }
    if (graphFocus === 'capacity-critical-paths') {
      return 'Part of capacity critical path';
    }
    if (graphFocus === 'cpm-critical-nodes') {
      return 'CPM critical node (time/cost path)';
    }
    if (graphFocus === 'reachability-low-belief') {
      const beliefs = scenario.exactInference?.beliefs ?? {};
      const value = beliefs[nodeId];
      const numeric = this.toNumeric(value);
      if (numeric != null) {
        return `Low belief: ${(numeric * 100).toFixed(1)}%`;
      }
      return 'Low reachability belief';
    }
    if (graphFocus === 'diamond-structure') {
      return 'Diamond structure node';
    }

    return undefined;
  }

  private getHighlightedNodeSetForScenario(scenarioName: string): Set<string> {
    const set = new Set<string>();
    const graphFocus = this.selectedGraphFocus();
    const scenario = this.scenarioResults().get(scenarioName);

    if (!scenario) {
      return set;
    }

    if (scenario.capacityAnalysis) {
      const raw = scenario.capacityAnalysis.raw_capacity_result;
      const comp = scenario.capacityAnalysis.comparative_analysis;

      if (graphFocus === 'capacity-upgrades') {
        (comp?.upgrade_priorities ?? []).forEach(item => set.add(String(item.node)));
      }

      if (graphFocus === 'capacity-bottlenecks') {
        for (const values of Object.values(raw?.bottlenecks ?? {})) {
          this.extractNodeIds(values).forEach(nodeId => set.add(nodeId));
        }
      }

      if (graphFocus === 'capacity-critical-paths') {
        for (const paths of Object.values(raw?.critical_paths ?? {})) {
          for (const path of paths) {
            for (const node of path) {
              set.add(String(node));
            }
          }
        }
      }
    }

    if (scenario.cpmAnalysis && graphFocus === 'cpm-critical-nodes') {
      for (const node of scenario.cpmAnalysis.time_result?.critical_nodes ?? []) {
        set.add(String(node));
      }
      for (const node of scenario.cpmAnalysis.cost_result?.critical_nodes ?? []) {
        set.add(String(node));
      }
    }

    if (scenario.exactInference && graphFocus === 'reachability-low-belief') {
      const beliefs = scenario.exactInference.beliefs ?? {};
      const ranked = Object.entries(beliefs)
        .map(([node, value]) => ({ node, value: this.toNumeric(value) }))
        .filter((entry): entry is { node: string; value: number } => entry.value != null)
        .sort((a, b) => a.value - b.value);

      if (ranked.length > 0) {
        const lowCount = Math.max(1, Math.ceil(ranked.length * 0.2));
        ranked.slice(0, lowCount).forEach(entry => set.add(entry.node));
      }
    }

    if (scenario.diamondAnalysis && graphFocus === 'diamond-structure') {
      for (const value of Object.values(scenario.diamondAnalysis.raw_root_diamonds ?? {})) {
        value.diamond.conditioning_nodes.forEach(node => set.add(String(node)));
        value.diamond.relevant_nodes.forEach(node => set.add(String(node)));
      }
    }

    return set;
  }

  private getHighlightedEdgeSetForScenario(scenarioName: string): Set<string> {
    const set = new Set<string>();
    const graphFocus = this.selectedGraphFocus();
    const scenario = this.scenarioResults().get(scenarioName);
    const graph = this.graphData();
    if (!scenario || !graph) {
      return set;
    }

    if (scenario.capacityAnalysis && graphFocus === 'capacity-critical-paths') {
      const raw = scenario.capacityAnalysis.raw_capacity_result;
      for (const paths of Object.values(raw?.critical_paths ?? {})) {
        for (const path of paths) {
          for (let index = 0; index < path.length - 1; index += 1) {
            set.add(this.edgeKey(String(path[index]), String(path[index + 1])));
          }
        }
      }
    }

    if (set.size === 0) {
      const highlightedNodes = this.getHighlightedNodeSetForScenario(scenarioName);
      for (const edge of graph.edges) {
        if (highlightedNodes.has(edge.source) && highlightedNodes.has(edge.target)) {
          set.add(this.edgeKey(edge.source, edge.target));
        }
      }
    }

    return set;
  }

  private formatMetricValue(value: unknown, format: string | undefined): string {
    const num = typeof value === 'number' && Number.isFinite(value) ? value : null;
    if (num == null) {
      return 'NA';
    }

    if (format === 'percent' || format === 'probability') {
      return `${(num * 100).toFixed(1)}%`;
    }
    if (format === 'integer') {
      return `${Math.round(num)}`;
    }
    if (format === 'duration') {
      return `${num.toFixed(2)}s`;
    }
    return num.toFixed(3);
  }

  private extractNodeIds(value: unknown): string[] {
    if (value == null) {
      return [];
    }
    if (typeof value === 'number') {
      return [String(value)];
    }
    if (Array.isArray(value)) {
      return value.flatMap(item => this.extractNodeIds(item));
    }
    if (typeof value === 'object') {
      const node = (value as Record<string, unknown>)['node'];
      if (typeof node === 'number' || typeof node === 'string') {
        return [String(node)];
      }
    }
    return [];
  }

  private toNumeric(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (!value || typeof value !== 'object') {
      return null;
    }

    const obj = value as Record<string, unknown>;
    if (typeof obj['lower'] === 'number' && typeof obj['upper'] === 'number') {
      return ((obj['lower'] as number) + (obj['upper'] as number)) / 2;
    }
    if (typeof obj['mean_lower'] === 'number' && typeof obj['mean_upper'] === 'number') {
      return ((obj['mean_lower'] as number) + (obj['mean_upper'] as number)) / 2;
    }
    return null;
  }
}
