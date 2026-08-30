import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  CardComponent,
  EmptyStateComponent,
  IconComponent,
  ValueTypeSelectorComponent,
} from '@inf-prop/shared/ui';
import { NetworkContextService } from '@inf-prop/shared/data-access';
import { FlowWorkbenchStore } from '../data/flow-workbench.store';
import {
  FLOW_ALGORITHMS,
  FlowRunOptions,
  parseDegradationScenarios,
} from '../data/flow-run-options';

type NumericOptionKey =
  | 'tol'
  | 'kFailure'
  | 'cutLimit'
  | 'pathLimit'
  | 'combinationLimit'
  | 'maxDepth';

/** Configure sub-view: pick the capacities scenario, set solver options, run. */
@Component({
  selector: 'ipf-flow-config-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    FormsModule,
    RouterLink,
    CardComponent,
    EmptyStateComponent,
    IconComponent,
    ValueTypeSelectorComponent,
  ],
  template: `
    @if (!store.hasScenarios()) {
      <ipf-empty-state
        icon="flow"
        title="No capacities file on this network"
        message="The flow toolkit needs a *-capacities.json input. Add one to the network folder (under capacity/) and upload again, or add capacities by hand."
      >
        <a slot="actions" routerLink="/upload">Go to upload</a>
        <a slot="actions" routerLink="/inputs/flow">Add inputs manually</a>
      </ipf-empty-state>
    } @else {
      <div class="grid">
        <ipf-card>
          <h2>Capacities scenario</h2>
          <p class="hint">
            Each scenario is one <code>*-capacities.json</code> operating case
            found on this network.
          </p>
          <label class="field">
            <span>Scenario</span>
            <select
              [ngModel]="store.selectedScenario()?.id ?? null"
              (ngModelChange)="store.select($event)"
            >
              @for (scenario of store.scenarios(); track scenario.id) {
                <option [ngValue]="scenario.id">{{ scenario.name }}</option>
              }
            </select>
          </label>
          @if (store.selectedScenario(); as scenario) {
            <dl class="paths">
              <div>
                <dt>Capacities</dt>
                <dd>{{ scenario.capacitiesPath }}</dd>
              </div>
              <div>
                <dt>Network</dt>
                <dd>{{ networkName() }}</dd>
              </div>
              @if (edgesFile(); as edges) {
                <div>
                  <dt>Edges</dt>
                  <dd>{{ edges }}</dd>
                </div>
              }
            </dl>
          }

          <div class="value-type">
            <ipf-value-type-selector
              [toolkit]="'flow'"
              [value]="'float64'"
              legend="Capacity value type"
            />
          </div>
        </ipf-card>

        <ipf-card>
          <h2>Run options</h2>
          <div class="options">
            <label class="field">
              <span>Max-flow solver</span>
              <select
                [ngModel]="store.options().algorithm"
                (ngModelChange)="patch({ algorithm: $event })"
              >
                @for (algo of algorithms; track algo.value) {
                  <option [ngValue]="algo.value">{{ algo.label }}</option>
                }
              </select>
              <small>{{ solverHint() }}</small>
            </label>

            <label class="field">
              <span>Tolerance</span>
              <input
                type="number"
                step="1e-10"
                [ngModel]="store.options().tol"
                (ngModelChange)="patchNumber('tol', $event)"
              />
            </label>

            <label class="field">
              <span>k for k-edge failure analysis</span>
              <input
                type="number"
                min="1"
                step="1"
                [ngModel]="store.options().kFailure"
                (ngModelChange)="patchNumber('kFailure', $event)"
              />
              <small>Combined loss of k edges at once; intended for k = 2 or 3.</small>
            </label>

            <label class="field">
              <span>Minimum-cut enumeration limit</span>
              <input
                type="number"
                min="1"
                step="1"
                [ngModel]="store.options().cutLimit"
                (ngModelChange)="patchNumber('cutLimit', $event)"
              />
              <small>cut_limit — caps enumeration of the cut lattice.</small>
            </label>

            <label class="field">
              <span>Path enumeration limit</span>
              <input
                type="number"
                min="1"
                step="1"
                [ngModel]="store.options().pathLimit"
                (ngModelChange)="patchNumber('pathLimit', $event)"
              />
              <small>path_limit — caps source-to-sink path enumeration.</small>
            </label>

            <label class="field">
              <span>k-edge combination limit</span>
              <input
                type="number"
                min="1"
                step="1"
                [ngModel]="store.options().combinationLimit"
                (ngModelChange)="patchNumber('combinationLimit', $event)"
              />
            </label>

            <label class="field">
              <span>Max search depth</span>
              <input
                type="number"
                min="1"
                step="1"
                [ngModel]="store.options().maxDepth"
                (ngModelChange)="patchNumber('maxDepth', $event)"
              />
            </label>

            <label class="field">
              <span>Target throughput (optional)</span>
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="none"
                [ngModel]="store.options().targetFlow"
                (ngModelChange)="patchTargetFlow($event)"
              />
              <small>Target service level for the parametric threshold search.</small>
            </label>

            <label class="field wide">
              <span
                >Uniform capacity scale factors &alpha; (optional,
                comma-separated)</span
              >
              <input
                type="text"
                placeholder="e.g. 0.9, 0.75, 0.5"
                [ngModel]="degradationText()"
                (ngModelChange)="patchDegradation($event)"
              />
              <small
                >Each &alpha; re-solves max-flow with every finite capacity scaled
                to &alpha;&thinsp;&times;&thinsp;c.</small
              >
            </label>

            <label class="switch">
              <input
                type="checkbox"
                [ngModel]="store.options().includeNodeCapacities"
                (ngModelChange)="patch({ includeNodeCapacities: $event })"
              />
              <span
                >Apply node capacities when the file provides them (handled
                internally by node splitting)</span
              >
            </label>
          </div>

          <div class="actions">
            <button
              type="button"
              class="run"
              [disabled]="!store.canRun()"
              (click)="store.run()"
            >
              <ipf-icon name="run" [size]="16" />
              <span>{{
                store.isRunning() ? 'Running…' : 'Run flow analysis'
              }}</span>
            </button>
            @if (store.hasResult()) {
              <span class="ran">
                <ipf-icon name="checkmark" [size]="14" />
                Last run: {{ store.ranScenarioName() }}
              </span>
            }
          </div>
        </ipf-card>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .grid {
        display: grid;
        grid-template-columns: 1fr 1.4fr;
        gap: var(--spacingHorizontalL, 16px);
        align-items: start;
      }
      @media (max-width: 900px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }
      h2 {
        margin: 0 0 var(--spacingVerticalS, 8px);
        font-size: var(--fontSizeBase400, 16px);
        font-weight: var(--fontWeightSemibold, 600);
      }
      .hint {
        margin: 0 0 var(--spacingVerticalM, 12px);
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground3);
      }
      .options {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: var(--spacingHorizontalM, 12px) var(--spacingHorizontalL, 16px);
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground2);
      }
      .field.wide,
      .switch {
        grid-column: 1 / -1;
      }
      .field small {
        color: var(--colorNeutralForeground3);
        font-size: var(--fontSizeBase100, 10px);
      }
      select,
      input {
        font: inherit;
        font-size: var(--fontSizeBase300, 14px);
        padding: 6px 8px;
        border: 1px solid var(--colorNeutralStroke1);
        border-radius: var(--borderRadiusMedium, 4px);
        background: var(--colorNeutralBackground1);
        color: var(--colorNeutralForeground1);
      }
      input:focus,
      select:focus {
        outline: 2px solid var(--colorBrandStroke1);
        outline-offset: -1px;
      }
      .switch {
        flex-direction: row;
        align-items: center;
        gap: 8px;
        margin-top: var(--spacingVerticalS, 8px);
        font-size: var(--fontSizeBase300, 14px);
        color: var(--colorNeutralForeground1);
      }
      .switch input {
        width: 16px;
        height: 16px;
        padding: 0;
      }
      .paths {
        margin: var(--spacingVerticalM, 12px) 0 0;
        display: grid;
        gap: 6px;
        font-size: var(--fontSizeBase200, 12px);
      }
      .paths > div {
        display: flex;
        gap: 8px;
      }
      .paths dt {
        min-width: 72px;
        color: var(--colorNeutralForeground3);
      }
      .paths dd {
        margin: 0;
        color: var(--colorNeutralForeground2);
        word-break: break-all;
      }
      .value-type {
        margin-top: var(--spacingVerticalL, 16px);
        padding-top: var(--spacingVerticalM, 12px);
        border-top: 1px solid var(--colorNeutralStroke2);
      }
      .actions {
        display: flex;
        align-items: center;
        gap: var(--spacingHorizontalM, 12px);
        margin-top: var(--spacingVerticalL, 16px);
      }
      .run {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        border: none;
        border-radius: var(--borderRadiusMedium, 4px);
        background: var(--colorBrandBackground);
        color: var(--colorNeutralForegroundOnBrand, #fff);
        font: inherit;
        font-size: var(--fontSizeBase300, 14px);
        font-weight: var(--fontWeightSemibold, 600);
        cursor: pointer;
      }
      .run:hover:not(:disabled) {
        background: var(--colorBrandBackgroundHover);
      }
      .run:disabled {
        background: var(--colorNeutralBackgroundDisabled);
        color: var(--colorNeutralForegroundDisabled);
        cursor: not-allowed;
      }
      .ran {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorPaletteGreenForeground1, #0e700e);
      }
      code {
        font-size: 0.9em;
        background: var(--colorNeutralBackground3);
        padding: 1px 4px;
        border-radius: 3px;
      }
    `,
  ],
})
export class FlowConfigPage {
  protected readonly store = inject(FlowWorkbenchStore);
  private readonly ctx = inject(NetworkContextService);

  protected readonly algorithms = FLOW_ALGORITHMS;
  protected readonly degradationText = signal('');

  protected readonly networkName = computed(
    () => this.ctx.context()?.networkName ?? '',
  );
  protected readonly edgesFile = computed(
    () => this.ctx.context()?.edgesFilePath ?? '',
  );
  protected readonly solverHint = computed(
    () =>
      FLOW_ALGORITHMS.find((a) => a.value === this.store.options().algorithm)
        ?.hint ?? '',
  );

  protected patch(patch: Partial<FlowRunOptions>): void {
    this.store.patchOptions(patch);
  }

  protected patchNumber(key: NumericOptionKey, raw: unknown): void {
    if (raw === null || raw === '') return;
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    const patch: Partial<FlowRunOptions> = {};
    patch[key] = value;
    this.store.patchOptions(patch);
  }

  protected patchTargetFlow(raw: unknown): void {
    const value = Number(raw);
    this.store.patchOptions({
      targetFlow: raw === null || raw === '' || !Number.isFinite(value) ? null : value,
    });
  }

  protected patchDegradation(raw: string): void {
    this.degradationText.set(raw);
    this.store.patchOptions({
      degradationScenarios: parseDegradationScenarios(raw),
    });
  }
}
