import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ApiRequestError,
  CriticalPathRequest,
  CriticalPathResponse,
  ScheduleMode,
  ValueType,
} from '@inf-prop/shared/api-client';
import {
  NetworkContextService,
  ScenarioAnalysis,
  ScenarioCacheService,
  Scenario as UploadScenario,
  scenarioRunId,
} from '@inf-prop/shared/data-access';
import {
  CardComponent,
  EmptyStateComponent,
  ErrorBannerComponent,
  IconComponent,
  LoadingStateComponent,
  PageHeaderComponent,
  ValueTypeSelectorComponent,
} from '@inf-prop/shared/ui';
import { ScheduleAnalysisService } from '../data-access/schedule-analysis.service';
import {
  scenarioMetrics,
  scenarioOverlays,
} from '../data-access/schedule-view-model';
import { SchedulePassView } from '../schedule-pass-view/schedule-pass-view';

type RunStatus = 'idle' | 'running' | 'done' | 'error';

interface ScheduleScenarioEntry {
  scenario: UploadScenario;
  analysis: ScenarioAnalysis;
}

const MODE_OPTIONS: { value: ScheduleMode | ''; label: string }[] = [
  { value: '', label: 'Auto — the operator pair the CPM file declares' },
  { value: 'longest_path', label: 'LongestPath · max / + · the classical critical path method' },
  { value: 'shortest_path', label: 'ShortestPath · min / +' },
  { value: 'max_scaling', label: 'MaxScaling · max / × · route selection' },
  { value: 'accumulation', label: 'Accumulation · sum / + · cost roll-up, load' },
];

/**
 * Track 3 — Schedule / Critical Path. Two passes (time, cost) over one activity
 * network, against `CriticalPathV2Module` via `/critical-path-analysis`.
 *
 * A network carries one or more schedule *scenarios* (named folders, each with a
 * `*-cpm-inputs.json`). The user picks one; `analysis.paths.cpm` is sent as
 * `cpmPath`. Value types are Float64 and Interval only — the shared selector
 * shows p-box disabled with a reason. The endpoint takes no value-type field;
 * the CPM file's own `data_type` decides, and the response's `value_type` is
 * what actually gets rendered.
 */
@Component({
  selector: 'ipf-feature-schedule',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    RouterLink,
    PageHeaderComponent,
    CardComponent,
    EmptyStateComponent,
    ErrorBannerComponent,
    LoadingStateComponent,
    IconComponent,
    ValueTypeSelectorComponent,
    SchedulePassView,
  ],
  template: `
    <ipf-page-header
      title="Schedule"
      description="One activity network read in two directions. A forward pass gives the extremal value a complete chain of dependencies can produce — a duration, a cost, a load. A backward pass gives the room each activity has before that value moves, wherever the quantity's algebra defines such a reading. Float64 and Interval; the decomposition module is bypassed entirely."
    />

    @if (!ctx.isLoaded()) {
      <ipf-empty-state
        icon="schedule"
        title="No network loaded"
        message="Upload an activity network to run a critical-path analysis."
      >
        <a slot="actions" routerLink="/upload">Upload a network</a>
      </ipf-empty-state>
    } @else if (!ctx.inputs().schedule) {
      <ipf-empty-state
        icon="schedule"
        title="No CPM inputs file"
        message="This network has no CPM inputs file (a *-cpm-inputs.json in a scenario folder). Add one and re-upload to enable the schedule toolkit."
      >
        <a slot="actions" routerLink="/upload">Add a CPM inputs file</a>
      </ipf-empty-state>
    } @else {
      <ipf-card>
        <div class="config">
          <div class="field">
            <label class="lbl" for="cpm-scenario">Scenario</label>
            @if (scenarios().length) {
              <select
                id="cpm-scenario"
                class="ctl"
                [value]="selectedScenarioName()"
                (change)="onSelectScenario($event)"
              >
                @for (e of scenarios(); track e.scenario.name) {
                  <option [value]="e.scenario.name">
                    {{ e.scenario.name }} ({{ e.analysis.valueType }}) —
                    {{ e.analysis.paths.cpm }}
                  </option>
                }
              </select>
            } @else {
              <p class="hint">
                No schedule scenario was detected for this session. Enter the CPM
                inputs path relative to the network folder.
              </p>
              <input
                class="ctl"
                type="text"
                placeholder="cpm/&lt;network&gt;-cpm-inputs.json"
                [value]="manualCpmPath()"
                (input)="onManualCpm($event)"
              />
            }
          </div>

          <ipf-value-type-selector
            [toolkit]="'schedule'"
            [(value)]="expectedValueType"
            legend="Expected value type"
          />
          <p class="hint">
            The value type comes from the CPM file's own <code>data_type</code>,
            not this selector — this is a pre-selection hint. The response's
            <code>value_type</code> is authoritative.
          </p>

          <details class="advanced">
            <summary>Advanced — pass modes</summary>
            <p class="hint">
              A mode is an operator pair together with whatever backward
              semantics its algebra supports. Each pass defaults to the pair the
              CPM file declares (currently always LongestPath, max / +). Override
              only if you know the file.
            </p>
            <div class="modes">
              <div class="field">
                <label class="lbl" for="time-mode">Time pass</label>
                <select
                  id="time-mode"
                  class="ctl"
                  [value]="timeMode()"
                  (change)="onTimeMode($event)"
                >
                  @for (m of modeOptions; track m.value) {
                    <option [value]="m.value">{{ m.label }}</option>
                  }
                </select>
              </div>
              <div class="field">
                <label class="lbl" for="cost-mode">Cost pass</label>
                <select
                  id="cost-mode"
                  class="ctl"
                  [value]="costMode()"
                  (change)="onCostMode($event)"
                >
                  @for (m of modeOptions; track m.value) {
                    <option [value]="m.value">{{ m.label }}</option>
                  }
                </select>
              </div>
            </div>
            @if (accumulationIntervalRisk()) {
              <p class="warn">
                <ipf-icon name="warning" [size]="14" />
                Interval + Accumulation is rejected by the server: a summed
                quantity has no interval margin scheme in V2, and a scheduling
                backward pass over a sum answers no question. Use Float64, or a
                path mode.
              </p>
            }
          </details>

          <div class="actions">
            <button
              type="button"
              class="run"
              [disabled]="!canRun()"
              (click)="run()"
            >
              <ipf-icon name="run" [size]="16" />
              {{ status() === 'done' ? 'Re-run analysis' : 'Run analysis' }}
            </button>
            <span class="ctx-line">{{ ctx.context()?.networkName }}</span>
          </div>
        </div>
      </ipf-card>

      @if (status() === 'running') {
        <ipf-loading-state label="Running critical path analysis…" />
      }

      @if (status() === 'error' && error()) {
        <ipf-error-banner
          [message]="error() ?? ''"
          [retryable]="true"
          (retry)="run()"
          (dismiss)="error.set(null)"
        />
      }

      @if (result(); as r) {
        @if (mismatch(); as mm) {
          <ipf-error-banner
            intent="info"
            [dismissible]="false"
            [message]="mismatchMessage(mm)"
          />
        }

        <div class="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            [class.active]="activeTab() === 'time'"
            [attr.aria-selected]="activeTab() === 'time'"
            (click)="activeTab.set('time')"
          >
            Time
          </button>
          @if (hasCost()) {
            <button
              type="button"
              role="tab"
              [class.active]="activeTab() === 'cost'"
              [attr.aria-selected]="activeTab() === 'cost'"
              (click)="activeTab.set('cost')"
            >
              Cost
            </button>
          } @else {
            <span class="tab-note">No cost analysis in this CPM file</span>
          }
        </div>

        @if (activePass(); as pass) {
          <ipf-schedule-pass-view
            [pass]="pass"
            [structure]="ctx.structure()"
            [kindLabel]="activeTab() === 'time' ? 'Time' : 'Cost'"
            [computationTime]="r.computation_time"
          />
        }
      }
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      ipf-card {
        display: block;
        margin-bottom: var(--spacingVerticalL, 16px);
      }
      .config {
        display: flex;
        flex-direction: column;
        gap: var(--spacingVerticalL, 16px);
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: var(--spacingVerticalXS, 4px);
      }
      .lbl {
        font-size: var(--fontSizeBase200, 12px);
        font-weight: var(--fontWeightSemibold, 600);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--colorNeutralForeground2);
      }
      .ctl {
        font: inherit;
        padding: 6px 10px;
        border: 1px solid var(--colorNeutralStroke1);
        border-radius: var(--borderRadiusMedium, 4px);
        background: var(--colorNeutralBackground1);
        color: var(--colorNeutralForeground1);
        max-width: 52ch;
      }
      .hint {
        margin: 0;
        max-width: 66ch;
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground3);
      }
      .hint code {
        font-family: var(--fontFamilyMonospace, monospace);
      }
      .warn {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: var(--spacingVerticalS, 8px) 0 0;
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground2);
      }
      .advanced summary {
        cursor: pointer;
        font-size: var(--fontSizeBase300, 14px);
        color: var(--colorNeutralForeground2);
      }
      .advanced .modes {
        display: flex;
        gap: var(--spacingHorizontalL, 16px);
        flex-wrap: wrap;
        margin-top: var(--spacingVerticalS, 8px);
      }
      .actions {
        display: flex;
        align-items: center;
        gap: var(--spacingHorizontalM, 12px);
      }
      .run {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font: inherit;
        font-weight: var(--fontWeightSemibold, 600);
        padding: 8px 16px;
        border: 1px solid transparent;
        border-radius: var(--borderRadiusMedium, 4px);
        background: var(--colorBrandBackground);
        color: var(--colorNeutralForegroundOnBrand, #fff);
        cursor: pointer;
      }
      .run:hover {
        background: var(--colorBrandBackgroundHover);
      }
      .run:disabled {
        background: var(--colorNeutralBackgroundDisabled);
        color: var(--colorNeutralForegroundDisabled);
        cursor: not-allowed;
      }
      .ctx-line {
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground3);
      }
      ipf-error-banner {
        display: block;
        margin-bottom: var(--spacingVerticalL, 16px);
      }
      .tabs {
        display: flex;
        align-items: center;
        gap: var(--spacingHorizontalXS, 4px);
        border-bottom: 1px solid var(--colorNeutralStroke2);
        margin-bottom: var(--spacingVerticalL, 16px);
      }
      .tabs button {
        font: inherit;
        font-size: var(--fontSizeBase300, 14px);
        padding: 8px 14px;
        border: none;
        background: none;
        color: var(--colorNeutralForeground2);
        border-bottom: 2px solid transparent;
        cursor: pointer;
      }
      .tabs button.active {
        color: var(--colorBrandForeground1);
        border-bottom-color: var(--colorBrandStroke1);
        font-weight: var(--fontWeightSemibold, 600);
      }
      .tab-note {
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground4);
        padding-left: var(--spacingHorizontalS, 8px);
      }
    `,
  ],
})
export class FeatureSchedule {
  protected readonly ctx = inject(NetworkContextService);
  private readonly analysis = inject(ScheduleAnalysisService);
  private readonly cache = inject(ScenarioCacheService);

  protected readonly modeOptions = MODE_OPTIONS;

  protected readonly expectedValueType = signal<ValueType>('float64');
  protected readonly selectedScenarioName = signal('');
  protected readonly manualCpmPath = signal('');
  protected readonly timeMode = signal<ScheduleMode | ''>('');
  protected readonly costMode = signal<ScheduleMode | ''>('');

  protected readonly status = signal<RunStatus>('idle');
  protected readonly error = signal<string | null>(null);
  protected readonly response = signal<CriticalPathResponse | null>(null);
  protected readonly activeTab = signal<'time' | 'cost'>('time');
  private readonly _mismatch = signal<{
    expected: ValueType;
    actual: 'Float64' | 'Interval';
  } | null>(null);
  protected readonly mismatch = this._mismatch.asReadonly();

  protected readonly scenarios = computed<ScheduleScenarioEntry[]>(() =>
    this.ctx.scenariosFor('schedule'),
  );

  protected readonly selectedEntry = computed<ScheduleScenarioEntry | null>(() => {
    const list = this.scenarios();
    if (!list.length) return null;
    return (
      list.find((e) => e.scenario.name === this.selectedScenarioName()) ??
      list[0]
    );
  });

  protected readonly effectiveCpmPath = computed(() => {
    const manual = this.manualCpmPath().trim();
    if (manual) return manual;
    return this.selectedEntry()?.analysis.paths.cpm ?? '';
  });

  protected readonly result = computed(
    () => this.response()?.critical_path_result ?? null,
  );
  protected readonly hasCost = computed(
    () => this.result()?.cost_result != null,
  );
  protected readonly activePass = computed(() => {
    const r = this.result();
    if (!r) return null;
    return this.activeTab() === 'cost' ? r.cost_result : r.time_result;
  });

  protected readonly canRun = computed(
    () => this.status() !== 'running' && this.effectiveCpmPath().length > 0,
  );

  protected readonly accumulationIntervalRisk = computed(
    () =>
      this.expectedValueType() === 'interval' &&
      (this.timeMode() === 'accumulation' ||
        this.costMode() === 'accumulation'),
  );

  constructor() {
    const first = this.scenarios()[0];
    if (first) {
      this.selectedScenarioName.set(first.scenario.name);
      this.expectedValueType.set(hintValueType(first.analysis));
    }
  }

  protected onSelectScenario(event: Event): void {
    const name = (event.target as HTMLSelectElement).value;
    this.selectedScenarioName.set(name);
    const entry = this.scenarios().find((e) => e.scenario.name === name);
    if (entry) this.expectedValueType.set(hintValueType(entry.analysis));
  }

  protected onManualCpm(event: Event): void {
    this.manualCpmPath.set((event.target as HTMLInputElement).value);
  }

  protected onTimeMode(event: Event): void {
    this.timeMode.set(
      (event.target as HTMLSelectElement).value as ScheduleMode | '',
    );
  }

  protected onCostMode(event: Event): void {
    this.costMode.set(
      (event.target as HTMLSelectElement).value as ScheduleMode | '',
    );
  }

  protected mismatchMessage(mm: {
    expected: ValueType;
    actual: 'Float64' | 'Interval';
  }): string {
    return `You pre-selected ${mm.expected}, but the CPM file resolved to ${mm.actual}. Showing ${mm.actual} results — the value type is read from the file's own data_type, not the selector.`;
  }

  protected run(): void {
    const context = this.ctx.context();
    const cpmPath = this.effectiveCpmPath();
    if (!context || !cpmPath) {
      this.error.set('Choose a scenario or enter a CPM inputs file first.');
      this.status.set('error');
      return;
    }

    const request: CriticalPathRequest = {
      networkPath: context.networkPath,
      edgesFilePath: context.edgesFilePath,
      cpmPath,
      mode: this.timeMode() || undefined,
      costMode: this.costMode() || undefined,
    };

    this.status.set('running');
    this.error.set(null);

    this.analysis.analyse(request).subscribe({
      next: (res) => {
        if (!res.success) {
          this.status.set('error');
          this.error.set(res.message || 'Critical path analysis failed.');
          return;
        }
        this.response.set(res);
        this.activeTab.set('time');
        this.reconcileValueType(res);
        this.status.set('done');
        this.recordScenario(res, cpmPath);
      },
      error: (err: ApiRequestError) => {
        this.status.set('error');
        this.error.set(err.message);
      },
    });
  }

  /** Sync the selector to what the file actually was; keep a note if they differ. */
  private reconcileValueType(res: CriticalPathResponse): void {
    const actual = res.critical_path_result.value_type;
    const actualKey: ValueType = actual === 'Interval' ? 'interval' : 'float64';
    this._mismatch.set(
      actualKey === this.expectedValueType()
        ? null
        : { expected: this.expectedValueType(), actual },
    );
    this.expectedValueType.set(actualKey);
  }

  private recordScenario(res: CriticalPathResponse, cpmPath: string): void {
    const context = this.ctx.context();
    if (!context) return;

    const r = res.critical_path_result;
    const valueType: ValueType =
      r.value_type === 'Interval' ? 'interval' : 'float64';
    const scenarioName =
      this.selectedEntry()?.scenario.name ?? scenarioNameFromPath(cpmPath);

    this.cache.record({
      id: scenarioRunId(
        'schedule',
        context.networkPath,
        scenarioName,
        valueType,
      ),
      networkPath: context.networkPath,
      networkName: context.networkName,
      toolkit: 'schedule',
      scenarioName,
      valueType,
      ranAt: Date.now(),
      computationTimeMs: (r.computation_time ?? 0) * 1000,
      inputFiles: {
        cpm_path: r.input_files?.cpm_path ?? cpmPath,
        edges: res.edges_file_path ?? context.edgesFilePath ?? '',
      },
      metrics: scenarioMetrics(r.time_result, r.cost_result ?? null),
      overlays: scenarioOverlays(r.time_result),
      raw: res,
    });
  }
}

function hintValueType(analysis: ScenarioAnalysis): ValueType {
  return analysis.valueType === 'interval' ? 'interval' : 'float64';
}

function scenarioNameFromPath(cpmPath: string): string {
  const parts = cpmPath.split(/[\\/]/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 2] : 'default';
}
