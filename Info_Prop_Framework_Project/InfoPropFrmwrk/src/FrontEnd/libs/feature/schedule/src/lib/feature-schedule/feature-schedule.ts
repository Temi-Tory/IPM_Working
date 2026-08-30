import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, catchError, concatMap, from, of, tap, throwError } from 'rxjs';
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
  ScenarioRun,
  Scenario as UploadScenario,
  scenarioRunId,
} from '@inf-prop/shared/data-access';
import {
  CardComponent,
  EmptyStateComponent,
  ErrorBannerComponent,
  GraphHighlight,
  IconComponent,
  LoadingStateComponent,
  NetworkGraphComponent,
  PageHeaderComponent,
  ScenarioComparisonTableComponent,
  ValueTypeSelectorComponent,
} from '@inf-prop/shared/ui';
import { ScheduleAnalysisService } from '../data-access/schedule-analysis.service';
import {
  criticalNodeIds,
  possiblyCriticalNodeIds,
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
    NetworkGraphComponent,
    ScenarioComparisonTableComponent,
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
        message="This network has no CPM inputs file (a *-cpm-inputs.json in a scenario folder). Add one and re-upload, or add durations by hand."
      >
        <a slot="actions" routerLink="/upload">Add a CPM inputs file</a>
        <a slot="actions" routerLink="/inputs/schedule">Add inputs manually</a>
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
      }

      <!-- the tab strip and Compare are reachable without a result — Compare
           lets you run several scenarios before any of them has one, the same
           way Reliability's and Flow's Compare tabs do. Time/Cost/
           Visualisation each handle "no result yet" on their own. -->
      <div class="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          [class.active]="activeTab() === 'time'"
          [attr.aria-selected]="activeTab() === 'time'"
          (click)="selectTab('time')"
        >
          Time
        </button>
        @if (!result() || hasCost()) {
          <button
            type="button"
            role="tab"
            [class.active]="activeTab() === 'cost'"
            [attr.aria-selected]="activeTab() === 'cost'"
            (click)="selectTab('cost')"
          >
            Cost
          </button>
        } @else {
          <span class="tab-note">No cost analysis in this CPM file</span>
        }
        <button
          type="button"
          role="tab"
          [class.active]="activeTab() === 'visualisation'"
          [attr.aria-selected]="activeTab() === 'visualisation'"
          (click)="selectTab('visualisation')"
        >
          Visualisation
        </button>
        @if (scenarios().length > 1) {
          <button
            type="button"
            role="tab"
            [class.active]="activeTab() === 'compare'"
            [attr.aria-selected]="activeTab() === 'compare'"
            (click)="selectTab('compare')"
          >
            Compare
          </button>
        }
      </div>

      @if (activeTab() === 'time' || activeTab() === 'cost') {
        @if (activePass(); as pass) {
          <ipf-schedule-pass-view
            [pass]="pass"
            [structure]="ctx.structure()"
            [kindLabel]="activeTab() === 'time' ? 'Time' : 'Cost'"
            [computationTime]="result()?.computation_time ?? 0"
          />
        } @else {
          <ipf-empty-state
            icon="schedule"
            title="No result yet"
            [message]="
              'Run the analysis to see the ' +
              (activeTab() === 'time' ? 'Time' : 'Cost') +
              ' pass for ' +
              (selectedEntry()?.scenario?.name ?? 'this scenario') +
              '.'
            "
          />
        }
      }

      @if (activeTab() === 'visualisation') {
        @if (ctx.structure(); as s) {
          <ipf-card>
            <p class="hint">
              The network, drawn by layer.
              @if (vizHighlight(); as h) {
                The ringed nodes are {{ vizSource() === 'time' ? 'time' : 'cost' }}'s
                necessarily critical structure
                @if (vizPossibleCount(); as n) {
                  — {{ n }} more node{{ n === 1 ? '' : 's' }} are possibly critical
                  under interval uncertainty, not ringed here
                }.
              } @else {
                Run the analysis to highlight the critical structure here.
              }
              @if (result() && hasCost()) {
                <span class="viz-toggle">
                  Show:
                  <button
                    type="button"
                    class="link"
                    [class.active]="vizSource() === 'time'"
                    (click)="vizSource.set('time')"
                  >
                    Time
                  </button>
                  ·
                  <button
                    type="button"
                    class="link"
                    [class.active]="vizSource() === 'cost'"
                    (click)="vizSource.set('cost')"
                  >
                    Cost
                  </button>
                </span>
              }
            </p>
            <ipf-network-graph [structure]="s" [highlight]="vizHighlight()" />
          </ipf-card>
        } @else {
          <ipf-loading-state label="Loading network structure…" />
        }
      }

      @if (activeTab() === 'compare') {
        <ipf-card>
          <div class="compare-toolbar">
            <div class="compare-checks" role="group" aria-label="Scenarios to compare">
              @for (e of scenarios(); track e.scenario.name) {
                <label class="compare-check">
                  <input
                    type="checkbox"
                    [checked]="isCompareChecked(e.scenario.name)"
                    (change)="toggleCompare(e.scenario.name)"
                  />
                  {{ e.scenario.name }}
                  @if (!hasRun(e.scenario.name)) {
                    <span class="unran">not run</span>
                  }
                </label>
              }
            </div>
            <div class="compare-actions">
              <button type="button" class="link" (click)="selectAllCompare()">All</button>
              <button type="button" class="link" (click)="clearCompare()">None</button>
              <button
                type="button"
                class="run"
                [disabled]="runningSelected() || !pendingCompare().length"
                (click)="runSelected()"
              >
                <ipf-icon name="run" [size]="16" />
                @if (runSelectedProgress(); as p) {
                  Running {{ p.done + 1 }} of {{ p.total }}…
                } @else {
                  Run selected ({{ pendingCompare().length }})
                }
              </button>
            </div>
          </div>
        </ipf-card>

        <ipf-scenario-comparison-table
          [runs]="comparedRuns()"
          emptyMessage="Check at least one scenario with a completed run, or run selected above."
        />
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
      .viz-toggle {
        margin-left: 8px;
      }
      .viz-toggle .link {
        font: inherit;
        font-size: inherit;
        padding: 0;
        border: none;
        background: none;
        color: var(--colorNeutralForeground3);
        text-decoration: underline;
        cursor: pointer;
      }
      .viz-toggle .link.active {
        color: var(--colorBrandForeground1);
        font-weight: var(--fontWeightSemibold, 600);
      }
      .compare-toolbar {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--spacingHorizontalXL, 20px);
        flex-wrap: wrap;
      }
      .compare-checks {
        display: flex;
        flex-wrap: wrap;
        gap: 10px 16px;
        max-width: 60ch;
      }
      .compare-check {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: var(--fontSizeBase300, 14px);
        color: var(--colorNeutralForeground1);
        cursor: pointer;
      }
      .compare-check input {
        cursor: pointer;
      }
      .unran {
        font-size: var(--fontSizeBase100, 10px);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 1px 6px;
        border-radius: var(--borderRadiusSmall, 3px);
        background: var(--colorNeutralBackground3);
        color: var(--colorNeutralForeground3);
      }
      .compare-actions {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        flex: none;
      }
      .compare-actions .link {
        font: inherit;
        font-size: var(--fontSizeBase200, 12px);
        padding: 2px;
        border: none;
        background: none;
        color: var(--colorBrandForeground1);
        cursor: pointer;
        text-decoration: underline;
      }
      ipf-scenario-comparison-table {
        display: block;
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
  protected readonly activeTab = signal<
    'time' | 'cost' | 'visualisation' | 'compare'
  >('time');
  /** which pass the Visualisation tab highlights — follows whichever of
   *  Time/Cost was last viewed, so switching there shows what you were just
   *  looking at, with an explicit toggle when both passes exist. */
  protected readonly vizSource = signal<'time' | 'cost'>('time');
  private readonly _mismatch = signal<{
    expected: ValueType;
    actual: 'Float64' | 'Interval';
  } | null>(null);
  protected readonly mismatch = this._mismatch.asReadonly();

  protected readonly scenarios = computed<ScheduleScenarioEntry[]>(() =>
    this.ctx.scenariosFor('schedule'),
  );

  // --- Compare tab: multi-scenario selection, run-selected -----------------
  private readonly compareSelection = signal<Set<string>>(new Set());
  private compareRehydrated = false;
  protected readonly runningSelected = signal(false);
  protected readonly runSelectedProgress = signal<{
    done: number;
    total: number;
  } | null>(null);

  protected readonly comparedRuns = computed<ScenarioRun[]>(() => {
    const ctxVal = this.ctx.context();
    if (!ctxVal) return [];
    const names = this.compareSelection();
    if (!names.size) return [];
    return this.cache
      .runsForToolkit('schedule')
      .filter(
        (r) => r.networkPath === ctxVal.networkPath && names.has(r.scenarioName),
      );
  });

  protected readonly pendingCompare = computed<ScheduleScenarioEntry[]>(() => {
    const names = this.compareSelection();
    return this.scenarios().filter(
      (e) => names.has(e.scenario.name) && !this.hasRun(e.scenario.name),
    );
  });

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

  /** the pass the Visualisation tab reads from — `vizSource`, falling back to
   *  time if cost was picked but the current result has none */
  private readonly vizPass = computed(() => {
    const r = this.result();
    if (!r) return null;
    return this.vizSource() === 'cost' && r.cost_result
      ? r.cost_result
      : r.time_result;
  });

  protected readonly vizHighlight = computed<GraphHighlight | null>(() => {
    const pass = this.vizPass();
    if (!pass) return null;
    const nodeIds = criticalNodeIds(pass);
    if (!nodeIds.length) return null;
    return { nodeIds, label: 'the necessarily critical structure' };
  });

  /** possibly-critical count beyond the necessarily-critical set — non-null
   *  (and worth a caption) only for interval passes, where the two differ. */
  protected readonly vizPossibleCount = computed<number | null>(() => {
    const pass = this.vizPass();
    if (!pass) return null;
    const possible = possiblyCriticalNodeIds(pass).length;
    const necessary = criticalNodeIds(pass).length;
    const extra = possible - necessary;
    return extra > 0 ? extra : null;
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

    effect(() => {
      const list = this.scenarios();
      if (!list.length || this.compareRehydrated) return;
      untracked(() => {
        this.compareRehydrated = true;
        this.compareSelection.set(new Set(list.map((e) => e.scenario.name)));
      });
    });
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

  protected selectTab(tab: 'time' | 'cost' | 'visualisation' | 'compare'): void {
    this.activeTab.set(tab);
    if (tab === 'time' || tab === 'cost') this.vizSource.set(tab);
  }

  protected hasRun(scenarioName: string): boolean {
    const path = this.ctx.context()?.networkPath;
    return this.cache
      .runsForToolkit('schedule')
      .some((r) => r.scenarioName === scenarioName && r.networkPath === path);
  }

  protected isCompareChecked(name: string): boolean {
    return this.compareSelection().has(name);
  }

  protected toggleCompare(name: string): void {
    this.compareSelection.update((set) => {
      const next = new Set(set);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  protected selectAllCompare(): void {
    this.compareSelection.set(new Set(this.scenarios().map((e) => e.scenario.name)));
  }

  protected clearCompare(): void {
    this.compareSelection.set(new Set());
  }

  protected mismatchMessage(mm: {
    expected: ValueType;
    actual: 'Float64' | 'Interval';
  }): string {
    return `You pre-selected ${mm.expected}, but the CPM file resolved to ${mm.actual}. Showing ${mm.actual} results — the value type is read from the file's own data_type, not the selector.`;
  }

  /** Runs one CPM file and folds a successful response into `response` + the
   *  cross-scenario cache. Shared by `run()` (the selected/manual scenario)
   *  and `runSelected()` (every checked-but-unrun scenario, chained). */
  private executeRun(
    cpmPath: string,
    scenarioName: string,
  ): Observable<CriticalPathResponse> {
    const context = this.ctx.context();
    if (!context) return throwError(() => new Error('No network is loaded.'));
    const request: CriticalPathRequest = {
      networkPath: context.networkPath,
      edgesFilePath: context.edgesFilePath,
      cpmPath,
      mode: this.timeMode() || undefined,
      costMode: this.costMode() || undefined,
    };
    return this.analysis.analyse(request).pipe(
      tap((res) => {
        if (!res.success) return;
        this.response.set(res);
        this.reconcileValueType(res);
        this.recordScenario(res, cpmPath, scenarioName);
      }),
    );
  }

  protected run(): void {
    const context = this.ctx.context();
    const cpmPath = this.effectiveCpmPath();
    if (!context || !cpmPath) {
      this.error.set('Choose a scenario or enter a CPM inputs file first.');
      this.status.set('error');
      return;
    }
    const scenarioName =
      this.selectedEntry()?.scenario.name ?? scenarioNameFromPath(cpmPath);

    this.status.set('running');
    this.error.set(null);

    this.executeRun(cpmPath, scenarioName).subscribe({
      next: (res) => {
        if (!res.success) {
          this.status.set('error');
          this.error.set(res.message || 'Critical path analysis failed.');
          return;
        }
        this.activeTab.set('time');
        this.vizSource.set('time');
        this.status.set('done');
      },
      error: (err: ApiRequestError) => {
        this.status.set('error');
        this.error.set(err.message);
      },
    });
  }

  /**
   * Runs every checked-but-unrun scenario in the Compare tab, one at a time —
   * chained rather than parallel, the same reasoning as Reliability's and
   * Flow's "Run selected": nothing here has verified the Julia server handles
   * concurrent analysis requests safely, so a sequential queue with visible
   * progress is the safe default. A scenario that fails is recorded as an
   * error but doesn't stop the rest of the queue.
   */
  protected runSelected(): void {
    const pending = this.pendingCompare();
    if (!pending.length) return;
    this.runningSelected.set(true);
    this.error.set(null);
    this.runSelectedProgress.set({ done: 0, total: pending.length });
    from(pending)
      .pipe(
        concatMap((e) => {
          const cpmPath = e.analysis.paths.cpm;
          if (!cpmPath) return of(null);
          return this.executeRun(cpmPath, e.scenario.name).pipe(
            catchError((err: ApiRequestError) => {
              this.error.set(`${e.scenario.name}: ${err.message}`);
              return of(null);
            }),
          );
        }),
      )
      .subscribe({
        next: () => {
          this.runSelectedProgress.update((p) =>
            p ? { ...p, done: p.done + 1 } : p,
          );
        },
        complete: () => {
          this.runningSelected.set(false);
          this.runSelectedProgress.set(null);
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

  private recordScenario(
    res: CriticalPathResponse,
    cpmPath: string,
    scenarioName: string,
  ): void {
    const context = this.ctx.context();
    if (!context) return;

    const r = res.critical_path_result;
    const valueType: ValueType =
      r.value_type === 'Interval' ? 'interval' : 'float64';

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
