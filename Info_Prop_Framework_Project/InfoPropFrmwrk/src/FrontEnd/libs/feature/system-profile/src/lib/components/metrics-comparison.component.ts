import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  CardComponent,
  IconComponent,
  ScenarioComparisonTableComponent,
} from '@inf-prop/shared/ui';
import { ScenarioRun } from '@inf-prop/shared/data-access';
import { ToolkitGroup, groupByToolkit } from '../model/profile-view';

/**
 * The scenarios of one network set side by side: every cached scenario's real
 * outputs, one table per toolkit (their metrics differ) — the table itself is
 * `ipf-scenario-comparison-table` (`shared/ui`), the same component each
 * toolkit's own in-page Compare tab uses, scoped here to one toolkit's group.
 */
@Component({
  selector: 'ipf-sp-metrics-comparison',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, IconComponent, ScenarioComparisonTableComponent],
  template: `
    @for (group of groups(); track group.toolkit) {
      <ipf-card class="group">
        <header class="group-head">
          <div class="title">
            <ipf-icon [name]="iconFor(group.toolkit)" [size]="18" />
            <h3>{{ group.label }}</h3>
            <span class="muted"
              >{{ group.runs.length }} scenario{{
                group.runs.length === 1 ? '' : 's'
              }}</span
            >
          </div>
        </header>

        <ipf-scenario-comparison-table [runs]="group.runs" />
      </ipf-card>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .group {
        margin-bottom: var(--spacingVerticalL, 16px);
      }
      .group-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--spacingHorizontalM, 12px);
        flex-wrap: wrap;
        margin-bottom: var(--spacingVerticalM, 12px);
      }
      .title {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      h3 {
        margin: 0;
        font-size: var(--fontSizeBase400, 16px);
        font-weight: var(--fontWeightSemibold, 600);
        color: var(--colorNeutralForeground1);
      }
      .muted {
        color: var(--colorNeutralForeground3);
        font-size: var(--fontSizeBase200, 12px);
      }
    `,
  ],
})
export class MetricsComparisonComponent {
  readonly runs = input.required<ScenarioRun[]>();

  protected readonly groups = computed<ToolkitGroup[]>(() =>
    groupByToolkit(this.runs()),
  );

  protected iconFor(toolkit: string): 'reliability' | 'flow' | 'schedule' {
    return toolkit === 'flow'
      ? 'flow'
      : toolkit === 'schedule'
        ? 'schedule'
        : 'reliability';
  }
}
