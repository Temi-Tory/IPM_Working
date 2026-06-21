import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { FlowWorkbenchStore } from '../flow-workbench.store';

@Component({
  selector: 'app-flow-summary-page',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  templateUrl: './flow-summary-page.component.html',
  styleUrl: './flow-summary-page.component.scss'
})
export class FlowSummaryPageComponent {
  readonly store = inject(FlowWorkbenchStore);

  readonly kpis = computed(() => {
    const result = this.store.result();
    if (!result) return null;

    return {
      throughput: result.flow.maxFlow,
      minCutCapacity: result.flow.mincutCapacity,
      saturatedEdges: result.flow.saturatedEdges.length,
      spofNodes: result.structure.spofNodes.length,
      minCutDegeneracy: result.minCutAnalysis.enumeration.totalCuts,
      freeZoneSize: result.minCutAnalysis.enumeration.freeZoneSize,
      thresholdCount: result.parametricThresholds.degradationThresholds.length
    };
  });
}
