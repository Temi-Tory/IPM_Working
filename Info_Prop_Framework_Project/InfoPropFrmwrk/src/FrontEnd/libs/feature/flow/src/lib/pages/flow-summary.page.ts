import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import {
  CardComponent,
  EmptyStateComponent,
  IconComponent,
  StatTileComponent,
} from '@inf-prop/shared/ui';
import { FlowWorkbenchStore } from '../data/flow-workbench.store';
import { num } from '../flow-view.util';

/** Summary sub-view: throughput, delivery and the headline diagnostics. */
@Component({
  selector: 'ipf-flow-summary-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, EmptyStateComponent, IconComponent, StatTileComponent],
  template: `
    @if (vm(); as vm) {
      <div class="tiles">
        <ipf-stat-tile
          label="Maximum throughput"
          icon="flow"
          [caption]="
            vm.cr.flow.is_unbounded ? 'unbounded' : 'F* — solver: ' + vm.cr.metadata.algorithm
          "
        >
          {{ vm.cr.flow.is_unbounded ? 'Unbounded' : fmt(vm.cr.flow.max_flow) }}
        </ipf-stat-tile>
        <ipf-stat-tile
          label="Minimum-cut capacity"
          icon="target"
          caption="tightest cut (= F* by duality)"
        >
          {{ fmt(vm.cr.min_cut_analysis.min_cut_capacity) }}
        </ipf-stat-tile>
        <ipf-stat-tile label="Baseline throughput" caption="F* at the input capacities">
          {{ fmt(vm.cr.metadata.baseline_max_flow) }}
        </ipf-stat-tile>
        <ipf-stat-tile
          label="Source-to-sink paths"
          icon="structure"
          caption="enumerated (≤ path_limit)"
        >
          {{ vm.cr.structure.paths_count }}
        </ipf-stat-tile>
        <ipf-stat-tile label="Saturated edges" caption="f* = c">
          {{ vm.cr.flow.saturated_edges.length }}
        </ipf-stat-tile>
        <ipf-stat-tile label="Free-zone size" caption="cut degeneracy">
          {{ vm.cr.min_cut_analysis.enumeration.free_zone_size }}
        </ipf-stat-tile>
        <ipf-stat-tile
          label="Structural SPOF nodes"
          icon="warning"
          caption="every s→t path passes through"
        >
          {{ vm.cr.structure.spof_nodes.length }}
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
      </div>

      <div class="cols">
        <ipf-card>
          <h2>Sink allocations</h2>
          @if (vm.cr.flow.sink_flow.length) {
            <table>
              <thead>
                <tr>
                  <th>Sink node</th>
                  <th class="n">Allocated flow</th>
                </tr>
              </thead>
              <tbody>
                @for (sink of vm.cr.flow.sink_flow; track sink[0]) {
                  <tr>
                    <td>{{ sink[0] }}</td>
                    <td class="n">{{ fmt(sink[1]) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <p class="muted">No per-sink allocation returned.</p>
          }

          <h3>Representative minimum-cut partition</h3>
          <div class="partition">
            <span
              ><ipf-icon name="circle" [size]="10" /> S* (source side):
              <strong>{{ vm.cr.flow.mincut_S.length }}</strong> nodes</span
            >
            <span
              ><ipf-icon name="circle" [size]="10" /> T (sink side):
              <strong>{{ vm.cr.flow.mincut_T.length }}</strong> nodes</span
            >
            <span
              >crossing edges:
              <strong>{{
                vm.cr.min_cut_analysis.representative_cut.crossing_edges.length
              }}</strong></span
            >
          </div>
        </ipf-card>

        <ipf-card>
          <h2>Flow decomposition</h2>
          <p>
            The solved flow decomposes into
            <strong>{{ vm.cr.flow_decomposition.components.length }}</strong>
            contributing path components (route-level) totalling
            <strong>{{ fmt(vm.cr.flow_decomposition.total_flow) }}</strong>.
            @if (largestContribution(); as largest) {
              The largest single path contribution (bottleneck flow) is
              <strong>{{ fmt(largest) }}</strong>.
            }
            @if (vm.cr.flow_decomposition.is_unique) {
              This decomposition is unique.
            } @else {
              Other decompositions of the same flow exist.
            }
          </p>

          @if (vm.cr.node_capacitated; as nc) {
            <h3>Node-capacitated diagnostics</h3>
            <div class="nc">
              <span
                >Throughput with node capacities:
                <strong>{{ fmt(nc.max_flow) }}</strong></span
              >
              <span
                >Saturating nodes:
                <strong>{{ nc.saturated_nodes.length }}</strong></span
              >
              <span
                >SPOF nodes (node-capacitated):
                <strong>{{ nc.spof_nodes.length }}</strong></span
              >
            </div>
          } @else {
            <p class="muted">
              Node capacities were not applied (none in the file, or the option
              was off).
            </p>
          }
        </ipf-card>
      </div>

      <ipf-card flush class="assumptions">
        <div class="a-row">
          <span>Solver <strong>{{ vm.cr.metadata.algorithm }}</strong></span>
          <span>Tolerance <strong>{{ vm.cr.metadata.tol }}</strong></span>
          @if (vm.input.source_nodes.length) {
            <span
              >Sources
              <strong>{{ vm.input.source_nodes.join(', ') }}</strong></span
            >
          }
          @if (vm.input.sink_nodes.length) {
            <span>Sinks <strong>{{ vm.input.sink_nodes.join(', ') }}</strong></span>
          }
          <span>Compute time <strong>{{ vm.compute }}</strong></span>
          <span>Schema <strong>{{ vm.input.capacity_schema }}</strong></span>
        </div>
      </ipf-card>
    } @else {
      <ipf-empty-state
        icon="flow"
        title="No result yet"
        message="Configure a capacities scenario and run the analysis to see throughput and diagnostics."
      />
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .tiles {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: var(--spacingHorizontalM, 12px);
        margin-bottom: var(--spacingVerticalL, 16px);
      }
      .cols {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--spacingHorizontalL, 16px);
        align-items: start;
        margin-bottom: var(--spacingVerticalL, 16px);
      }
      @media (max-width: 900px) {
        .cols {
          grid-template-columns: 1fr;
        }
      }
      h2 {
        margin: 0 0 var(--spacingVerticalM, 12px);
        font-size: var(--fontSizeBase400, 16px);
        font-weight: var(--fontWeightSemibold, 600);
      }
      h3 {
        margin: var(--spacingVerticalL, 16px) 0 var(--spacingVerticalS, 8px);
        font-size: var(--fontSizeBase300, 14px);
        font-weight: var(--fontWeightSemibold, 600);
        color: var(--colorNeutralForeground2);
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--fontSizeBase300, 14px);
      }
      th,
      td {
        text-align: left;
        padding: 6px 8px;
        border-bottom: 1px solid var(--colorNeutralStroke2);
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
      .partition,
      .nc {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: var(--fontSizeBase300, 14px);
        color: var(--colorNeutralForeground2);
      }
      .partition span {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .muted {
        color: var(--colorNeutralForeground3);
        font-size: var(--fontSizeBase200, 12px);
      }
      .assumptions {
        padding: var(--spacingVerticalM, 12px) var(--spacingHorizontalL, 16px);
        background: var(--colorNeutralBackground2);
      }
      .a-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 20px;
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground3);
      }
      .a-row strong {
        color: var(--colorNeutralForeground1);
        font-variant-numeric: tabular-nums;
      }
    `,
  ],
})
export class FlowSummaryPage {
  protected readonly store = inject(FlowWorkbenchStore);

  protected readonly vm = computed(() => {
    const response = this.store.result();
    if (!response) return null;
    const seconds = response.computation_time;
    return {
      cr: response.capacity_result,
      input: response.input,
      compute:
        seconds < 1
          ? `${Math.round(seconds * 1000)} ms`
          : `${seconds.toFixed(2)} s`,
    };
  });

  /** Largest single path contribution (bottleneck flow) in the decomposition. */
  protected readonly largestContribution = computed<number | null>(() => {
    const components = this.store.capacityResult()?.flow_decomposition.components;
    if (!components || components.length === 0) return null;
    return components.reduce((max, c) => Math.max(max, c.flow_value), 0);
  });

  protected fmt(value: number): string {
    return num(value);
  }
}
