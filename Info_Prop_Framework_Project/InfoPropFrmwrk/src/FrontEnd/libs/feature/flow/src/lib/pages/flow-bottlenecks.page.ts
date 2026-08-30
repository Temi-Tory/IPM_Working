import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import {
  CardComponent,
  EmptyStateComponent,
  StatTileComponent,
} from '@inf-prop/shared/ui';
import { FlowWorkbenchStore } from '../data/flow-workbench.store';
import { Edge, edgeKey, edgeLabel, num, utilisationPercent } from '../flow-view.util';

const TABLE_LIMIT = 20;

/**
 * Bottlenecks sub-view: the minimum-cut lattice, the bottleneck ranking,
 * structural single points of failure, the three flow-sensitivity functions,
 * single- and k-edge failure impact, capacity-degradation scenarios and the
 * parametric degradation thresholds — every one a field of the response.
 * Terminology follows the Flow/Capacity chapter.
 */
@Component({
  selector: 'ipf-flow-bottlenecks-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, EmptyStateComponent, StatTileComponent],
  template: `
    @if (vm(); as vm) {
      <div class="tiles">
        <ipf-stat-tile label="Minimum-cut capacity">
          {{ fmt(vm.cr.min_cut_analysis.min_cut_capacity) }}
        </ipf-stat-tile>
        <ipf-stat-tile
          label="Edges in every minimum cut"
          caption="structurally rigid bottleneck"
        >
          {{ vm.cr.min_cut_analysis.edges_in_every_cut.length }}
        </ipf-stat-tile>
        <ipf-stat-tile
          label="Edges in ≥ 1 minimum cut"
          caption="distributed bottleneck"
        >
          {{ vm.cr.min_cut_analysis.edges_in_some_cut.length }}
        </ipf-stat-tile>
        <ipf-stat-tile label="Structural SPOF nodes">
          {{ vm.cr.structure.spof_nodes.length }}
        </ipf-stat-tile>
        <ipf-stat-tile label="Free-zone size" caption="cut degeneracy">
          {{ vm.cr.min_cut_analysis.enumeration.free_zone_size }}
        </ipf-stat-tile>
        <ipf-stat-tile
          label="Distinct minimum cuts"
          [caption]="
            vm.cr.min_cut_analysis.enumeration.is_complete
              ? 'all enumerated'
              : 'capped at cut_limit'
          "
        >
          {{ vm.cr.min_cut_analysis.enumeration.total_cuts }}
        </ipf-stat-tile>
        <ipf-stat-tile
          label="Edge connectivity λ"
          caption="global weakest link, any node pair — not just S/T"
        >
          {{ vm.cr.global_connectivity.edge_connectivity.lambda }}
        </ipf-stat-tile>
        <ipf-stat-tile
          label="Node connectivity κ"
          caption="global weakest link, node-wise"
        >
          {{ vm.cr.global_connectivity.node_connectivity.kappa }}
        </ipf-stat-tile>
      </div>

      <ipf-card>
        <h2>Bottleneck ranking</h2>
        <p class="muted">
          Edges crossing the representative minimum cut, ranked tightest capacity
          first. Top {{ tableLimit }} of {{ vm.bottlenecks.length }}.
        </p>
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Edge</th>
                <th class="n">Flow f*</th>
                <th class="n">Capacity</th>
                <th class="n">Residual</th>
                <th class="n">Utilisation</th>
              </tr>
            </thead>
            <tbody>
              @for (row of vm.bottlenecks.slice(0, tableLimit); track row.rank) {
                <tr>
                  <td>{{ row.rank }}</td>
                  <td>{{ label(row.edge) }}</td>
                  <td class="n">{{ fmt(row.flow) }}</td>
                  <td class="n">{{ fmt(row.capacity) }}</td>
                  <td class="n">{{ fmt(row.residual_capacity) }}</td>
                  <td class="n">{{ util(row.flow, row.capacity) }}%</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </ipf-card>

      <div class="cols">
        <ipf-card>
          <h2>Minimum-cut lattice</h2>
          <div class="partition">
            <span
              >Representative minimum cut — S*:
              <strong>{{ vm.cr.min_cut_analysis.representative_cut.S.length }}</strong>
              nodes, T:
              <strong>{{ vm.cr.min_cut_analysis.representative_cut.T.length }}</strong>
              nodes, capacity
              <strong>{{ fmt(vm.cr.min_cut_analysis.representative_cut.capacity) }}</strong></span
            >
            <span
              >Free zone |F| =
              <strong>{{ vm.cr.min_cut_analysis.enumeration.free_zone_size }}</strong>
              — nodes assignable to either side without changing cut capacity
              (|F| = 0 ⇒ the representative cut is unique)</span
            >
            <span
              >Enumeration
              {{
                vm.cr.min_cut_analysis.enumeration.is_complete
                  ? 'complete'
                  : 'capped at cut_limit (completion flag not set)'
              }}</span
            >
          </div>

          <h3>Edges in every minimum cut</h3>
          <p class="note">Present in all 2<sup>|F|</sup> minimum cuts.</p>
          <div class="chips">
            @for (edge of vm.cr.min_cut_analysis.edges_in_every_cut; track key(edge)) {
              <span class="chip danger">{{ label(edge) }}</span>
            } @empty {
              <span class="muted">none</span>
            }
          </div>

          <h3>Edges in at least one minimum cut</h3>
          <div class="chips">
            @for (edge of vm.cr.min_cut_analysis.edges_in_some_cut; track key(edge)) {
              <span class="chip">{{ label(edge) }}</span>
            } @empty {
              <span class="muted">none</span>
            }
          </div>
        </ipf-card>

        <ipf-card>
          <h2>Structural single points of failure</h2>
          <p class="muted">
            A node whose removal disconnects every source-to-sink path — its
            deletion drops F* to 0. A node can be flow-limiting without being
            structurally indispensable, and vice versa.
          </p>
          <div class="chips">
            @for (node of vm.cr.structure.spof_nodes; track node) {
              <span class="chip danger">node {{ node }}</span>
            } @empty {
              <span class="muted">
                No structural SPOF node — every node has an alternative route
                around it.
              </span>
            }
          </div>
        </ipf-card>

        <ipf-card>
          <h2>Edge redundancy</h2>
          <p class="muted">
            Path-disjoint redundancy per edge (Menger, unit capacity) —
            structural, independent of any capacity assignment. Least
            redundant first; a score of 0 means the edge has no disjoint
            alternative.
          </p>
          <div class="scroll">
            <table>
              <thead>
                <tr>
                  <th>Edge</th>
                  <th class="n">Redundancy score</th>
                </tr>
              </thead>
              <tbody>
                @for (row of vm.redundancy.slice(0, tableLimit); track row.key) {
                  <tr>
                    <td>{{ row.label }}</td>
                    <td class="n">{{ row.score }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="2" class="muted">No redundancy scores returned.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </ipf-card>
      </div>

      <ipf-card>
        <h2>Flow sensitivity</h2>
        <p class="muted">
          The three sensitivity functions over the saturated candidate edges
          (every minimum cut is made only of saturated edges). ΔF*: throughput
          loss on removal. μ: marginal capacity value (throughput gained per unit
          capacity added). B: marginal range — the total throughput the edge can
          influence, F*(c = ∞) − F*(c = 0) (a.k.a. Birnbaum importance).
        </p>
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>Edge</th>
                <th class="n">ΔF* (removal)</th>
                <th class="n">Baseline F*</th>
                <th class="n">F* with edge removed</th>
                <th class="n">Marginal capacity μ</th>
                <th class="n">Marginal range B</th>
              </tr>
            </thead>
            <tbody>
              @for (row of vm.sensitivity.slice(0, tableLimit); track row.key) {
                <tr>
                  <td>{{ row.label }}</td>
                  <td class="n">{{ fmt(row.drop) }}</td>
                  <td class="n">{{ fmt(row.baseline_flow) }}</td>
                  <td class="n">{{ fmt(row.perturbed_flow) }}</td>
                  <td class="n">{{ row.marginal === null ? '—' : fmt4(row.marginal) }}</td>
                  <td class="n">{{ row.birnbaum === null ? '—' : fmt4(row.birnbaum) }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="muted">No critical edges identified.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </ipf-card>

      <div class="cols">
        <ipf-card>
          <h2>Single-edge failure impact</h2>
          <div class="scroll">
            <table>
              <thead>
                <tr>
                  <th>Edge</th>
                  <th class="n">Impact ΔF*</th>
                  <th class="n">F* after failure</th>
                  <th>Critical</th>
                </tr>
              </thead>
              <tbody>
                @for (
                  row of vm.cr.failure_impact.single_edge_failures.slice(0, tableLimit);
                  track key(row.edge)
                ) {
                  <tr>
                    <td>{{ label(row.edge) }}</td>
                    <td class="n">{{ fmt(row.drop) }}</td>
                    <td class="n">
                      {{ row.is_unbounded ? 'Unbounded' : fmt(row.perturbed_flow) }}
                    </td>
                    <td>{{ row.is_critical ? 'yes' : 'no' }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="4" class="muted">No single-edge failures returned.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </ipf-card>

        <ipf-card>
          <h2>k-edge failure impact</h2>
          <p class="muted">
            Combined impact of k edges failing at once (candidates: edges in at
            least one minimum cut).
          </p>
          <div class="scroll">
            <table>
              <thead>
                <tr>
                  <th>Edge set K</th>
                  <th class="n">Combined impact ΔK</th>
                  <th class="n">F* after failure</th>
                </tr>
              </thead>
              <tbody>
                @for (
                  row of vm.cr.failure_impact.k_edge_failures.slice(0, tableLimit);
                  track $index
                ) {
                  <tr>
                    <td>{{ edgeSet(row.edges) }}</td>
                    <td class="n">{{ fmt(row.drop) }}</td>
                    <td class="n">
                      {{ row.is_unbounded ? 'Unbounded' : fmt(row.perturbed_flow) }}
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="3" class="muted">No k-edge failures returned.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </ipf-card>
      </div>

      @if (vm.cr.failure_impact.degradation_results.length) {
        <ipf-card>
          <h2>Capacity degradation scenarios</h2>
          <p class="muted">Uniform scaling — every finite capacity set to α × c.</p>
          <div class="scroll">
            <table>
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th class="n">Throughput F*(α)</th>
                  <th class="n">Loss vs baseline</th>
                </tr>
              </thead>
              <tbody>
                @for (
                  row of vm.cr.failure_impact.degradation_results;
                  track row.scenario_id
                ) {
                  <tr>
                    <td>{{ scenarioLabel(row.scenario_id) }}</td>
                    <td class="n">
                      {{ row.is_unbounded ? 'Unbounded' : fmt(row.max_flow) }}
                    </td>
                    <td class="n">{{ fmt(row.drop_from_baseline) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </ipf-card>
      }

      <ipf-card>
        <h2>Parametric degradation thresholds</h2>
        <p class="muted">
          @if (vm.cr.parametric_thresholds.target_flow === null) {
            The degradation threshold c† is the lowest capacity each edge can
            fall to before the baseline throughput drops; the degradation margin
            (capacity − c†) is the tolerable capacity loss.
          } @else {
            The degradation threshold c† is the lowest capacity each edge can
            fall to while still meeting a target throughput of
            {{ fmt(vm.cr.parametric_thresholds.target_flow) }}; the degradation
            margin is the tolerable capacity loss before that target is breached.
          }
        </p>
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>Edge</th>
                <th class="n">Capacity</th>
                <th class="n">Degradation threshold c†</th>
                <th class="n">Degradation margin</th>
                <th>Target achievable</th>
              </tr>
            </thead>
            <tbody>
              @for (
                row of vm.cr.parametric_thresholds.degradation_thresholds.slice(0, tableLimit);
                track key(row.target_edge)
              ) {
                <tr>
                  <td>{{ label(row.target_edge) }}</td>
                  <td class="n">{{ fmt(row.original_capacity) }}</td>
                  <td class="n">{{ fmt(row.threshold_capacity) }}</td>
                  <td class="n">{{ fmt(row.degradation_margin) }}</td>
                  <td>{{ row.target_achievable ? 'yes' : 'no' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="muted">No thresholds returned.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </ipf-card>
    } @else {
      <ipf-empty-state
        icon="warning"
        title="No result yet"
        message="Run a flow analysis from Configure to see minimum-cut, structural, sensitivity and failure-impact diagnostics."
      />
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--spacingVerticalL, 16px);
      }
      .tiles {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: var(--spacingHorizontalM, 12px);
      }
      .cols {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--spacingHorizontalL, 16px);
        align-items: start;
      }
      @media (max-width: 900px) {
        .cols {
          grid-template-columns: 1fr;
        }
      }
      h2 {
        margin: 0 0 var(--spacingVerticalS, 8px);
        font-size: var(--fontSizeBase400, 16px);
        font-weight: var(--fontWeightSemibold, 600);
      }
      h3 {
        margin: var(--spacingVerticalM, 12px) 0 var(--spacingVerticalXS, 4px);
        font-size: var(--fontSizeBase200, 12px);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--colorNeutralForeground3);
      }
      .muted {
        color: var(--colorNeutralForeground3);
        font-size: var(--fontSizeBase200, 12px);
      }
      .note {
        margin: 0 0 4px;
        color: var(--colorNeutralForeground3);
        font-size: var(--fontSizeBase100, 10px);
      }
      .scroll {
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
        padding: 6px 10px;
        border-bottom: 1px solid var(--colorNeutralStroke2);
        white-space: nowrap;
      }
      th {
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground3);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .n {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .partition {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: var(--fontSizeBase300, 14px);
        color: var(--colorNeutralForeground2);
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .chip {
        font-size: var(--fontSizeBase200, 12px);
        padding: 2px 8px;
        border-radius: var(--borderRadiusSmall, 3px);
        background: var(--colorNeutralBackground3);
        color: var(--colorNeutralForeground2);
        font-variant-numeric: tabular-nums;
      }
      .chip.danger {
        background: var(--colorPaletteRedBackground2, #fdf3f4);
        color: var(--colorPaletteRedForeground1, #b10e1c);
      }
    `,
  ],
})
export class FlowBottlenecksPage {
  protected readonly store = inject(FlowWorkbenchStore);
  protected readonly tableLimit = TABLE_LIMIT;

  protected readonly vm = computed(() => {
    const cr = this.store.capacityResult();
    if (!cr) return null;

    const marginal = new Map(
      cr.sensitivity.marginal_capacity.map((m) => [edgeKey(m.edge), m.value]),
    );
    const birnbaum = new Map(
      cr.sensitivity.birnbaum.map((b) => [edgeKey(b.edge), b.value]),
    );

    const sensitivity = cr.sensitivity.critical_edges.map((row) => ({
      key: edgeKey(row.edge),
      label: edgeLabel(row.edge),
      drop: row.drop,
      baseline_flow: row.baseline_flow,
      perturbed_flow: row.perturbed_flow,
      marginal: marginal.get(edgeKey(row.edge)) ?? null,
      birnbaum: birnbaum.get(edgeKey(row.edge)) ?? null,
    }));

    const redundancy = [...cr.structure.edge_redundancy]
      .sort((a, b) => a.score - b.score)
      .map((row) => ({
        key: edgeKey(row.edge),
        label: edgeLabel(row.edge),
        score: row.score,
      }));

    return {
      cr,
      bottlenecks: cr.structure.bottleneck_ranking,
      sensitivity,
      redundancy,
    };
  });

  protected fmt(value: number | string): string {
    return num(value);
  }

  protected fmt4(value: number | string): string {
    return num(value, 4);
  }

  protected util(flow: number, capacity: number): string {
    return num(utilisationPercent(flow, capacity), 1);
  }

  protected label(edge: Edge): string {
    return edgeLabel(edge);
  }

  protected key(edge: Edge): string {
    return edgeKey(edge);
  }

  protected edgeSet(edges: Edge[]): string {
    return edges.map((e) => edgeLabel(e)).join(', ');
  }

  /** Show the uniform scale factor α behind a degradation scenario id. */
  protected scenarioLabel(scenarioId: number | string): string {
    const values = this.store.options().degradationScenarios;
    const index = typeof scenarioId === 'number' ? scenarioId - 1 : -1;
    const alpha = values && index >= 0 ? values[index] : undefined;
    return alpha === undefined
      ? `Scenario ${scenarioId}`
      : `α = ${num(alpha, 4)}`;
  }
}
