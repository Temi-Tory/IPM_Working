import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Level1Story } from '../../state/capacity-story.models';
import { BottleneckTableComponent } from './bottleneck-table.component';
import { NodeTypeStatsComponent } from './node-type-stats.component';
import { SourceSinkSummaryComponent } from './source-sink-summary.component';

@Component({
  selector: 'app-level-1-bottleneck',
  standalone: true,
  imports: [CommonModule, BottleneckTableComponent, NodeTypeStatsComponent, SourceSinkSummaryComponent],
  template: `
    <div class="level-1-container">
      <app-node-type-stats [stats]="data.nodeTypeStats"></app-node-type-stats>
      <app-bottleneck-table [nodes]="data.bottleneckNodes" [edges]="data.bottleneckEdges"></app-bottleneck-table>
      <app-source-sink-summary [sourceFlows]="data.sourceFlowPaths" [sinkSummary]="data.sinkSummary"></app-source-sink-summary>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Level1BottleneckComponent {
  @Input() data!: Level1Story;
}
