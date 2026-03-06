import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Level3Story } from '../../state/capacity-story.models';
import { FullResultsTableComponent } from './full-results-table.component';
import { FlowDecompositionComponent } from './flow-decomposition.component';
import { ExportControlsComponent } from './export-controls.component';

@Component({
  selector: 'app-level-3-engineer',
  standalone: true,
  imports: [CommonModule, FullResultsTableComponent, FlowDecompositionComponent, ExportControlsComponent],
  template: `
    <div class="level-3-container">
      <app-full-results-table [nodes]="data.allNodes" [edges]="data.allEdges"></app-full-results-table>
      <app-flow-decomposition [decomposition]="data.flowDecomposition"></app-flow-decomposition>
      <app-export-controls [scenarioName]="scenarioName" [rawData]="data.rawData"></app-export-controls>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Level3EngineerComponent {
  @Input() data!: Level3Story;
  @Input() scenarioName: string = 'scenario';
}
