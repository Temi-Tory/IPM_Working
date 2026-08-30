import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ToolkitKind, ValueType } from '@inf-prop/shared/api-client';
import { IconComponent } from '@inf-prop/shared/ui';
import { IconName } from '@inf-prop/shared/ui';
import { ScenarioRun } from '@inf-prop/shared/data-access';
import { ScenarioRosterRow, TOOLKIT_LABEL, scenarioRoster } from '../model/profile-view';

const TOOLKIT_ICON: Record<ToolkitKind, IconName> = {
  reliability: 'reliability',
  flow: 'flow',
  schedule: 'schedule',
};

const VALUE_TYPE_LABEL: Record<ValueType, string> = {
  float64: 'deterministic',
  interval: 'interval',
  pbox: 'probability box',
};

const TOOLKITS: readonly ToolkitKind[] = ['reliability', 'flow', 'schedule'];

/**
 * What has actually been run, by scenario name, across all three toolkits —
 * the one thing the per-toolkit metric tables below cannot show, since each
 * is scoped to its own toolkit. The Front-End chapter frames the profile view
 * as setting "the scenarios of one network side by side"; a network's scenario
 * folder commonly carries inputs for more than one toolkit at once (the same
 * `Degraded/` folder holding both a capacities file and a nodepriors/
 * linkprobs pair), so "side by side" has a scenario-name reading this table
 * gives and the toolkit-grouped tables don't: which named scenarios exist,
 * and which of the three toolkits have actually been run against each one.
 * A roster of what has been tested, not a judgement of it.
 */
@Component({
  selector: 'ipf-sp-scenario-roster',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Scenario</th>
            @for (tk of toolkits; track tk) {
              <th scope="col">
                <span class="tk-head">
                  <ipf-icon [name]="iconOf(tk)" [size]="14" />
                  {{ labelOf(tk) }}
                </span>
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.scenarioName) {
            <tr>
              <th scope="row">{{ row.scenarioName }}</th>
              @for (tk of toolkits; track tk) {
                <td>
                  @if (row.byToolkit[tk]; as entry) {
                    <span class="cell run" [class]="'vt-' + entry.valueType">
                      <ipf-icon name="checkmark" [size]="13" />
                      {{ valueTypeLabel(entry.valueType) }}
                    </span>
                  } @else {
                    <span class="cell not-run" aria-hidden="true">—</span>
                  }
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .wrap {
        overflow-x: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--fontSizeBase300, 14px);
      }
      th,
      td {
        padding: 7px 12px;
        text-align: left;
        white-space: nowrap;
      }
      thead th {
        font-size: var(--fontSizeBase200, 12px);
        font-weight: var(--fontWeightSemibold, 600);
        color: var(--colorNeutralForeground3);
        border-bottom: 1px solid var(--colorNeutralStroke2);
      }
      .tk-head {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }
      tbody tr {
        border-bottom: 1px solid var(--colorNeutralStroke2);
      }
      tbody tr:last-child {
        border-bottom: none;
      }
      tbody th {
        font-weight: var(--fontWeightSemibold, 600);
        color: var(--colorNeutralForeground1);
      }
      .cell {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: var(--fontSizeBase200, 12px);
        padding: 2px 8px;
        border-radius: var(--borderRadiusCircular, 999px);
      }
      .cell.run {
        color: var(--colorNeutralForeground1);
      }
      .cell.vt-float64 {
        background: var(--colorNeutralBackground3);
      }
      .cell.vt-interval {
        background: var(--colorPaletteBlueBackground2, #a9d3f2);
        color: var(--colorPaletteBlueForeground2, #0f6cbd);
      }
      .cell.vt-pbox {
        background: var(--colorPalettePurpleBackground2, #d0b8e6);
        color: var(--colorPalettePurpleForeground2, #6b3fa0);
      }
      .cell.not-run {
        color: var(--colorNeutralForeground4, var(--colorNeutralForeground3));
        padding-left: 0;
      }
    `,
  ],
})
export class ScenarioRosterComponent {
  readonly runs = input.required<ScenarioRun[]>();

  protected readonly toolkits = TOOLKITS;

  protected readonly rows = computed<ScenarioRosterRow[]>(() =>
    scenarioRoster(this.runs()),
  );

  protected iconOf(tk: ToolkitKind): IconName {
    return TOOLKIT_ICON[tk];
  }

  protected labelOf(tk: ToolkitKind): string {
    return TOOLKIT_LABEL[tk];
  }

  protected valueTypeLabel(vt: ValueType): string {
    return VALUE_TYPE_LABEL[vt];
  }
}
