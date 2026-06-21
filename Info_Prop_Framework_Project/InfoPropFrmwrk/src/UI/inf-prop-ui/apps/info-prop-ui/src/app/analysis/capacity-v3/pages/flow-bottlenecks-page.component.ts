import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { FlowWorkbenchStore } from '../flow-workbench.store';

@Component({
  selector: 'app-flow-bottlenecks-page',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  templateUrl: './flow-bottlenecks-page.component.html',
  styleUrl: './flow-bottlenecks-page.component.scss'
})
export class FlowBottlenecksPageComponent {
  readonly store = inject(FlowWorkbenchStore);

  readonly kpis = computed(() => {
    const result = this.store.result();
    if (!result) {
      return {
        minCutCapacity: 0,
        edgesEveryCut: 0,
        edgesSomeCut: 0,
        spofEdges: 0,
        spofNodes: 0,
        freeZoneSize: 0,
        cutsEnumerated: 0
      };
    }

    return {
      minCutCapacity: result.minCutAnalysis.minCutCapacity,
      edgesEveryCut: result.minCutAnalysis.edgesInEveryCut.length,
      edgesSomeCut: result.minCutAnalysis.edgesInSomeCut.length,
      spofEdges: result.structure.spofEdges.length,
      spofNodes: result.structure.spofNodes.length,
      freeZoneSize: result.minCutAnalysis.enumeration.freeZoneSize,
      cutsEnumerated: result.minCutAnalysis.enumeration.totalCuts
    };
  });

  readonly criticalRows = computed(() => {
    const result = this.store.result();
    if (!result) return [];

    const marginalMap = new Map(
      (result.sensitivity.marginalCapacity ?? []).map((row) => [
        this.edgeKey(row.edge),
        row.value
      ])
    );

    return (result.sensitivity.criticalEdges ?? []).map((row) => ({
      ...row,
      edgeKey: this.edgeKey(row.edge),
      marginalValue: marginalMap.get(this.edgeKey(row.edge))
    }));
  });

  readonly topBottleneckRanking = computed(() => {
    const rows = this.store.result()?.structure.bottleneckRanking ?? [];
    return rows.slice(0, 20);
  });

  readonly sortedSpofNodes = computed(() => {
    const nodes = this.store.result()?.structure.spofNodes ?? [];
    return [...nodes].sort((a, b) => a - b);
  });

  edgeKey(edge: [number, number]): string {
    return `${edge[0]} -> ${edge[1]}`;
  }

  ratioPercent(flow: number, capacity: number): number {
    if (!Number.isFinite(flow) || !Number.isFinite(capacity) || capacity <= 0) return 0;
    return (flow / capacity) * 100;
  }
}
