import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  computed,
  input,
} from '@angular/core';
import {
  NetworkStructure,
  SchedulePassResult,
  isAccumulation,
} from '@inf-prop/shared/api-client';
import {
  ErrorBannerComponent,
  IconComponent,
  StatTileComponent,
  ValueDisplayComponent,
  formatNumber,
} from '@inf-prop/shared/ui';
import {
  ActivityRow,
  accumulationRows,
  activityRows,
  criticalNodeIds,
  criticalStructureLabel,
  forwardLabel,
  intervalMethodPhrase,
  marginLabel,
  modeLabel,
  modeOperators,
  passSummary,
  possiblyCriticalNodeIds,
  projectValueCaption,
  roleLabel,
  rolesFromStructure,
} from '../data-access/schedule-view-model';

/**
 * One schedule pass (time or cost), rendered in the Critical Path chapter's
 * vocabulary against whichever of the three `SchedulePassResult` variants came
 * back:
 *
 *  - Float64 path — a forward pass for the project value P, a backward pass for
 *    the margin (slack / margin over optimum / ratio slack); early/late schedule
 *    for the additive modes.
 *  - Interval path — forward quantities exact from two crisp corner runs; the
 *    margins either exact (domination split / exhaustive corner enumeration) or a
 *    declared-conservative sound enclosure, never allowed to look alike.
 *    Necessarily- and possibly-critical are kept separate.
 *  - Accumulation — a summed quantity: multiplicity, sensitivity and
 *    contribution, with an allowance in place of a slack.
 */
@Component({
  selector: 'ipf-schedule-pass-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    IconComponent,
    StatTileComponent,
    ValueDisplayComponent,
    ErrorBannerComponent,
  ],
  template: `
    @let s = summary();
    <section class="pass">
      <p class="kind">
        {{ kindLabel() }} pass ·
        {{ s.kind === 'accumulation' ? 'summed quantity' : 'forward pass and backward pass' }}
      </p>
      <div class="tiles">
        @if (s.kind === 'accumulation') {
          <ipf-stat-tile
            label="Total"
            icon="schedule"
            [caption]="'reaching target activity ' + s.target"
          >
            {{ fmt(s.total) }}
          </ipf-stat-tile>
          @if (s.topContributor !== null) {
            <ipf-stat-tile
              label="Largest contribution"
              icon="list"
              caption="activity, value × multiplicity"
            >
              {{ s.topContributor }}
            </ipf-stat-tile>
          }
        } @else {
          <ipf-stat-tile
            label="Project value"
            icon="schedule"
            [caption]="projectCaption()"
          >
            @if (s.projectValue !== null) {
              <ipf-value [value]="s.projectValue" [showTag]="s.valueType === 'Interval'" />
            }
          </ipf-stat-tile>

          @if (s.valueType === 'Interval') {
            <ipf-stat-tile
              label="Critical activities"
              icon="target"
              caption="necessarily / possibly"
            >
              {{ s.necessaryCount }} / {{ s.possibleCount }}
            </ipf-stat-tile>
            <ipf-stat-tile
              label="Corner runs"
              icon="more-horizontal"
              caption="crisp propagations"
            >
              {{ s.cornerCount }}
            </ipf-stat-tile>
          } @else {
            <ipf-stat-tile label="Critical activities" icon="target" caption="margin-zero">
              {{ s.criticalCount }}
            </ipf-stat-tile>
            @if (s.scheduleAvailable) {
              <ipf-stat-tile
                label="Near-critical"
                icon="warning"
                caption="slack under 10% of the project value"
              >
                {{ s.nearCriticalCount }}
              </ipf-stat-tile>
            }
          }
        }

        <ipf-stat-tile label="Mode" icon="settings" [caption]="modeOps()">
          {{ modeText() }}
        </ipf-stat-tile>
        <ipf-stat-tile label="Method" icon="info">{{ s.methodLabel }}</ipf-stat-tile>
        @if (computationTime() !== null) {
          <ipf-stat-tile label="Computation" icon="run">
            {{ fmt(computationTime()) }} s
          </ipf-stat-tile>
        }
      </div>

      @if (s.isConservative) {
        <ipf-error-banner
          intent="warning"
          [dismissible]="false"
          [message]="conservativeMessage()"
        />
      } @else if (s.valueType === 'Interval') {
        <p class="note">
          <ipf-icon name="info" [size]="14" />
          Exact float bounds via the {{ intervalMethodText() }}. Forward
          quantities — the project value, F and through — are exact from two crisp
          runs at the corners of the input box; the classical early/late schedule
          is not computed for interval inputs.
        </p>
      }

      @if (s.kind !== 'accumulation' && criticalChain().length) {
        <div class="chain">
          <span class="chain-label">{{ criticalLabel() }}</span>
          <span class="chain-nodes">
            @for (id of criticalChain(); track id; let last = $last) {
              <span class="node crit">{{ id }}</span>
              @if (!last) {
                <ipf-icon name="arrow-right" [size]="14" />
              }
            }
          </span>
        </div>
        @if (possiblyChain().length) {
          <div class="chain sub">
            <span class="chain-label">Possibly critical</span>
            <span class="chain-nodes">
              @for (id of possiblyChain(); track id) {
                <span class="node poss">{{ id }}</span>
              }
            </span>
          </div>
        }
      }

      <div class="table-wrap">
        @if (s.kind === 'accumulation') {
          <table>
            <thead>
              <tr>
                <th>Activity</th>
                <th>Role</th>
                <th class="num">Contribution</th>
                <th class="num">Multiplicity</th>
                <th class="num">Accumulated total</th>
                @if (hasAllowance()) {
                  <th class="num">Allowance</th>
                }
                <th class="num">Rank</th>
              </tr>
            </thead>
            <tbody>
              @for (row of accRows(); track row.nodeId) {
                <tr [class.top]="row.rank !== null && row.rank <= 3">
                  <td class="id">{{ row.nodeId }}</td>
                  <td>{{ roleText(row.role) }}</td>
                  <td class="num">{{ fmt(row.contribution) }}</td>
                  <td class="num">{{ row.multiplicity }}</td>
                  <td class="num">{{ fmt(row.accumulated) }}</td>
                  @if (hasAllowance()) {
                    <td class="num">{{ numOrDash(row.allowance) }}</td>
                  }
                  <td class="num">{{ row.rank ?? '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
          <p class="legend">
            Multiplicity — the number of directed routes from the activity to the
            target; a value added here reaches the total once per route, so it is
            also the sensitivity ∂total / ∂value. Contribution — value ×
            multiplicity, the activity's share of the total. There is no slack: a
            scheduling backward pass over a summed quantity answers no question.
            Where a budget is set the backward reading is an allowance — headroom
            against the budget, divided by multiplicity.
          </p>
        } @else {
          <table>
            <thead>
              <tr>
                <th>Activity</th>
                <th>Role</th>
                <th class="num">{{ forwardHeader() }}</th>
                <th class="num">Through</th>
                <th class="num">{{ marginHeader() }}</th>
                @if (s.scheduleAvailable) {
                  <th class="num">ES</th>
                  <th class="num">LS</th>
                  <th class="num">LF</th>
                }
                <th>Critical</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.nodeId) {
                <tr [class]="rowClass(row)">
                  <td class="id">{{ row.nodeId }}</td>
                  <td>{{ roleText(row.role) }}</td>
                  <td class="num"><ipf-value [value]="row.forward" [showTag]="false" /></td>
                  <td class="num">
                    @if (row.through !== null) {
                      <ipf-value [value]="row.through" [showTag]="false" />
                    } @else {
                      —
                    }
                  </td>
                  <td class="num">
                    @if (row.margin !== null) {
                      <ipf-value [value]="row.margin" [showTag]="false" />
                    } @else {
                      —
                    }
                  </td>
                  @if (s.scheduleAvailable) {
                    <td class="num">{{ numOrDash(row.earlyStart) }}</td>
                    <td class="num">{{ numOrDash(row.lateStart) }}</td>
                    <td class="num">{{ numOrDash(row.lateFinish) }}</td>
                  }
                  <td>
                    @switch (row.critical) {
                      @case ('critical') {
                        <span class="tag crit"><ipf-icon name="target" [size]="12" /> Critical</span>
                      }
                      @case ('near-critical') {
                        <span class="tag near">Near-critical</span>
                      }
                      @case ('necessary') {
                        <span class="tag crit"><ipf-icon name="target" [size]="12" /> Necessarily</span>
                      }
                      @case ('possible') {
                        <span class="tag poss">Possibly</span>
                      }
                      @default {
                        <span class="tag none">—</span>
                      }
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
          <p class="legend">
            {{ forwardHeader() }} (F) — the best value a chain of dependencies can
            deliver into the activity, inclusive of it. Through — the best
            complete path forced through the activity. {{ marginHeader() }} — the
            gap between the project value and the through-value{{
              s.mode === 'max_scaling' ? ', as a ratio' : ''
            }}; its zero set is the critical structure.
            @if (s.scheduleAvailable) {
              Early start is F − duration, late finish is the project value −
              reverse completion; total float equals the
              {{ marginHeader().toLowerCase() }}.
            }
          </p>
        }
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .kind {
        margin: 0 0 var(--spacingVerticalM, 12px);
        font-size: var(--fontSizeBase200, 12px);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--colorNeutralForeground3);
      }
      .tiles {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: var(--spacingHorizontalM, 12px);
        margin-bottom: var(--spacingVerticalL, 16px);
      }
      .note {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 0 0 var(--spacingVerticalL, 16px);
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground3);
      }
      ipf-error-banner {
        display: block;
        margin-bottom: var(--spacingVerticalL, 16px);
      }
      .chain {
        display: flex;
        align-items: baseline;
        gap: var(--spacingHorizontalS, 8px);
        flex-wrap: wrap;
        margin-bottom: var(--spacingVerticalM, 12px);
      }
      .chain.sub {
        margin-bottom: var(--spacingVerticalL, 16px);
      }
      .chain-label {
        font-size: var(--fontSizeBase200, 12px);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--colorNeutralForeground3);
      }
      .chain-nodes {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .node {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 24px;
        padding: 2px 6px;
        border-radius: var(--borderRadiusMedium, 4px);
        font-size: var(--fontSizeBase200, 12px);
        font-variant-numeric: tabular-nums;
      }
      .node.crit {
        background: var(--colorBrandBackground2);
        color: var(--colorBrandForeground1);
        border: 1px solid var(--colorBrandStroke2);
      }
      .node.poss {
        background: var(--colorNeutralBackground3);
        color: var(--colorNeutralForeground2);
        border: 1px dashed var(--colorNeutralStroke2);
      }
      .table-wrap {
        overflow-x: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--fontSizeBase300, 14px);
      }
      th,
      td {
        text-align: left;
        padding: var(--spacingVerticalS, 8px) var(--spacingHorizontalM, 12px);
        border-bottom: 1px solid var(--colorNeutralStroke2);
        white-space: nowrap;
      }
      th {
        font-size: var(--fontSizeBase200, 12px);
        font-weight: var(--fontWeightSemibold, 600);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--colorNeutralForeground3);
      }
      td.num,
      th.num {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      td.id {
        font-variant-numeric: tabular-nums;
        color: var(--colorNeutralForeground2);
      }
      tr.critical {
        background: var(--colorBrandBackground2);
      }
      tr.near {
        background: var(--colorNeutralBackground2);
      }
      tr.top {
        background: var(--colorNeutralBackground2);
      }
      .tag {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 1px 6px;
        border-radius: var(--borderRadiusSmall, 3px);
        font-size: var(--fontSizeBase200, 12px);
      }
      .tag.crit {
        background: var(--colorBrandBackground2);
        color: var(--colorBrandForeground1);
      }
      .tag.near {
        background: var(--colorNeutralBackground3);
        color: var(--colorNeutralForeground2);
      }
      .tag.poss {
        background: var(--colorNeutralBackground3);
        color: var(--colorNeutralForeground3);
        border: 1px dashed var(--colorNeutralStroke2);
      }
      .tag.none {
        color: var(--colorNeutralForeground4);
      }
      .legend {
        margin: var(--spacingVerticalM, 12px) 0 0;
        max-width: 72ch;
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground3);
      }
    `,
  ],
})
export class SchedulePassView {
  readonly pass = input.required<SchedulePassResult>();
  readonly structure = input<NetworkStructure | null>(null);
  /** 'Time' | 'Cost' — the accumulating quantity this pass reads */
  readonly kindLabel = input<string>('Time');
  /** seconds, from `critical_path_result.computation_time` */
  readonly computationTime = input<number | null>(null);

  private readonly roles = computed(() => rolesFromStructure(this.structure()));

  protected readonly summary = computed(() => passSummary(this.pass()));
  protected readonly rows = computed<ActivityRow[]>(() =>
    activityRows(this.pass(), this.roles()),
  );
  protected readonly accRows = computed(() => {
    const p = this.pass();
    return isAccumulation(p) ? accumulationRows(p, this.roles()) : [];
  });
  protected readonly criticalChain = computed(() => criticalNodeIds(this.pass()));
  protected readonly possiblyChain = computed(() => {
    const necessary = new Set(this.criticalChain());
    return possiblyCriticalNodeIds(this.pass()).filter((id) => !necessary.has(id));
  });
  protected readonly hasAllowance = computed(() =>
    this.accRows().some((r) => r.allowance !== null),
  );

  protected modeText(): string {
    return modeLabel(this.summary().mode);
  }
  protected modeOps(): string {
    return modeOperators(this.summary().mode);
  }
  protected projectCaption(): string {
    return projectValueCaption(this.summary().mode);
  }
  protected criticalLabel(): string {
    const s = this.summary();
    return criticalStructureLabel(s.mode, s.valueType === 'Interval');
  }
  protected intervalMethodText(): string {
    return intervalMethodPhrase(this.summary().method);
  }
  protected forwardHeader(): string {
    return forwardLabel(this.summary().mode);
  }
  protected marginHeader(): string {
    return marginLabel(this.summary().marginName);
  }
  protected roleText(role: ActivityRow['role']): string {
    return roleLabel(role);
  }
  protected rowClass(row: ActivityRow): string {
    if (row.critical === 'critical' || row.critical === 'necessary')
      return 'critical';
    if (row.critical === 'near-critical') return 'near';
    return '';
  }
  protected numOrDash(n: number | null): string {
    return n === null ? '—' : this.fmt(n);
  }
  protected fmt(n: number | null): string {
    return n === null ? '—' : formatNumber(n, { maxFractionDigits: 4 });
  }
  protected conservativeMessage(): string {
    const lead =
      'Conservative — the margin bounds below are a sound enclosure derived from the exact forward bounds, not an exact float range. The toolkit declares this rather than let an enclosure look like an exact value.';
    const note = this.summary().methodNote;
    return note ? `${lead} ${note}` : lead;
  }
}
