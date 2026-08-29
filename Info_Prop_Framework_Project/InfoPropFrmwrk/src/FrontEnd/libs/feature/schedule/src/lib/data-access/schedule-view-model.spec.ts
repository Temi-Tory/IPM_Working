import { NetworkStructure } from '@inf-prop/shared/api-client';
import {
  accumulationPassMock,
  floatLongestPassMock,
  intervalConservativePassMock,
  intervalExactPassMock,
} from './mock-responses';
import {
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
  rolesFromStructure,
  scenarioMetrics,
  scenarioOverlays,
} from './schedule-view-model';

function row<T extends { nodeId: number }>(rows: readonly T[], id: number): T {
  const found = rows.find((r) => r.nodeId === id);
  if (!found) throw new Error(`no row for node ${id}`);
  return found;
}

const structure = {
  total_nodes: 4,
  total_edges: 4,
  nodes: [1, 2, 3, 4],
  edges: [
    [1, 2],
    [1, 3],
    [2, 4],
    [3, 4],
  ],
  source_nodes: [1],
  sink_nodes: [4],
  fork_nodes: [1],
  join_nodes: [4],
  iteration_sets: [[1], [2, 3], [4]],
  iteration_sets_count: 3,
  ancestors: {},
  descendants: {},
  outgoing_index: {},
  incoming_index: {},
  computation_time: 0,
} as unknown as NetworkStructure;

describe('schedule-view-model', () => {
  describe('rolesFromStructure', () => {
    it('labels source / sink / fork / join from graph position', () => {
      const roles = rolesFromStructure(structure);
      expect(roles.get(1)).toBe('source');
      expect(roles.get(4)).toBe('sink');
      expect(roles.get(2)).toBe('interior');
    });

    it('is empty when no structure is loaded', () => {
      expect(rolesFromStructure(null).size).toBe(0);
    });
  });

  describe('Float64 longest-path pass', () => {
    const roles = rolesFromStructure(structure);
    const rows = activityRows(floatLongestPassMock, roles);
    const summary = passSummary(floatLongestPassMock);

    it('derives one row per forward-keyed activity, sorted', () => {
      expect(rows.map((r) => r.nodeId)).toEqual([1, 2, 3, 4]);
    });

    it('carries the classical schedule quantities for an additive pass', () => {
      const n2 = row(rows, 2);
      expect(n2.forward).toBe(25);
      expect(n2.earlyStart).toBe(10);
      expect(n2.lateFinish).toBe(25);
      expect(n2.critical).toBe('critical');
    });

    it('flags near-critical activities distinctly from critical', () => {
      const n3 = row(rows, 3);
      expect(n3.critical).toBe('near-critical');
    });

    it('summarises project value, method and critical count', () => {
      expect(summary.projectValue).toBe(45);
      expect(summary.method).toBe('exact_scalar');
      expect(summary.criticalCount).toBe(3);
      expect(summary.nearCriticalCount).toBe(1);
      expect(summary.scheduleAvailable).toBe(true);
      expect(summary.isConservative).toBe(false);
    });

    it('critical ids are the reported critical path', () => {
      expect(criticalNodeIds(floatLongestPassMock)).toEqual([1, 2, 4]);
    });
  });

  describe('Interval pass — conservative enclosure', () => {
    const roles = rolesFromStructure(structure);
    const rows = activityRows(intervalConservativePassMock, roles);
    const summary = passSummary(intervalConservativePassMock);

    it('keeps interval values as bound pairs (never midpointed)', () => {
      const n1 = row(rows, 1);
      expect(n1.forward).toEqual({ type: 'interval', lower: 9, upper: 11 });
    });

    it('does not fabricate a classical schedule for interval inputs', () => {
      const n1 = row(rows, 1);
      expect(n1.earlyStart).toBeNull();
      expect(n1.lateFinish).toBeNull();
      expect(summary.scheduleAvailable).toBe(false);
    });

    it('separates necessarily- from possibly-critical', () => {
      const n1 = row(rows, 1);
      const n2 = row(rows, 2);
      expect(n1.critical).toBe('necessary');
      expect(n2.critical).toBe('possible');
      expect(criticalNodeIds(intervalConservativePassMock)).toEqual([1, 4]);
      expect(possiblyCriticalNodeIds(intervalConservativePassMock)).toEqual([
        1, 2, 4,
      ]);
    });

    it('marks the result as a sound over-approximation, not exact', () => {
      expect(summary.method).toBe('conservative_enclosure');
      expect(summary.isConservative).toBe(true);
      expect(summary.isExactInterval).toBe(false);
      expect(summary.methodNote).toContain('conservative enclosure');
      expect(summary.cornerCount).toBe(4);
    });
  });

  describe('Interval pass — exact', () => {
    it('is flagged exact and drops the empty method note', () => {
      const summary = passSummary(intervalExactPassMock);
      expect(summary.method).toBe('exact_domination_split');
      expect(summary.isConservative).toBe(false);
      expect(summary.isExactInterval).toBe(true);
      expect(summary.methodNote).toBeNull();
    });
  });

  describe('Accumulation pass', () => {
    const roles = rolesFromStructure(structure);
    const summary = passSummary(accumulationPassMock);
    const rows = accumulationRows(accumulationPassMock, roles);

    it('has no critical-path concept', () => {
      expect(summary.kind).toBe('accumulation');
      expect(activityRows(accumulationPassMock, roles)).toEqual([]);
      expect(criticalNodeIds(accumulationPassMock)).toEqual([]);
    });

    it('exposes total, target and the contribution ranking', () => {
      expect(summary.total).toBe(480);
      expect(summary.target).toBe(4);
      expect(summary.topContributor).toBe(1);
      expect(row(rows, 1).rank).toBe(1);
      expect(row(rows, 1).contribution).toBe(200);
      expect(row(rows, 1).multiplicity).toBe(2);
    });
  });

  describe('scenarioMetrics — labelled real outputs only', () => {
    it('reads critical path length and cost straight off the response', () => {
      const metrics = scenarioMetrics(
        floatLongestPassMock,
        floatLongestPassMock,
      );
      expect(metrics).toEqual([
        { label: 'Critical path length', value: 45, direction: 'lower-better' },
        { label: 'Critical activities', value: 3, direction: 'neutral' },
        { label: 'Critical path cost', value: 45, direction: 'lower-better' },
      ]);
    });

    it('keeps an interval metric in its form', () => {
      const [first] = scenarioMetrics(intervalConservativePassMock, null);
      expect(first.value).toEqual({ type: 'interval', lower: 41, upper: 49 });
    });

    it('reports the accumulation total', () => {
      const metrics = scenarioMetrics(accumulationPassMock, null);
      expect(metrics[0]).toEqual({
        label: 'Accumulated total',
        value: 480,
        direction: 'neutral',
      });
    });
  });

  describe('scenarioOverlays', () => {
    it('highlights the critical path, traceable to a real output', () => {
      expect(scenarioOverlays(floatLongestPassMock)).toEqual([
        { focus: 'critical-path', label: 'Critical path', nodeIds: [1, 2, 4] },
      ]);
    });

    it('emits nothing when there is no critical path', () => {
      expect(scenarioOverlays(accumulationPassMock)).toEqual([]);
    });
  });

  describe('vocabulary matches the Critical Path chapter', () => {
    it('uses the modes table names and operator pairs', () => {
      expect(modeLabel('longest_path')).toBe('LongestPath');
      expect(modeLabel('shortest_path')).toBe('ShortestPath');
      expect(modeLabel('max_scaling')).toBe('MaxScaling');
      expect(modeLabel('accumulation')).toBe('Accumulation');
      expect(modeOperators('longest_path')).toBe('max / +');
      expect(modeOperators('max_scaling')).toBe('max / ×');
      expect(modeOperators('accumulation')).toBe('sum / +');
    });

    it('names each margin as the modes table does', () => {
      expect(marginLabel('slack')).toBe('Slack');
      expect(marginLabel('margin')).toBe('Margin over optimum');
      expect(marginLabel('ratio_slack')).toBe('Ratio slack');
      expect(marginLabel('allowance')).toBe('Allowance');
    });

    it('names the margin-zero structure per mode, or "necessarily critical" for intervals', () => {
      expect(criticalStructureLabel('longest_path', false)).toBe('Critical path');
      expect(criticalStructureLabel('shortest_path', false)).toBe('Optimal chain');
      expect(criticalStructureLabel('max_scaling', false)).toBe('Best route');
      expect(criticalStructureLabel('longest_path', true)).toBe(
        'Necessarily critical',
      );
    });

    it('describes the interval scheme in the chapter’s words', () => {
      expect(intervalMethodPhrase('exact_domination_split')).toBe(
        'domination split',
      );
      expect(intervalMethodPhrase('exact_corners_exhaustive')).toBe(
        'exhaustive corner enumeration',
      );
      expect(intervalMethodPhrase('conservative_enclosure')).toBe(
        'sound enclosure',
      );
    });

    it('reads F as a completion / success factor / accumulated total', () => {
      expect(forwardLabel('longest_path')).toBe('Completion');
      expect(forwardLabel('max_scaling')).toBe('Success factor');
      expect(forwardLabel('accumulation')).toBe('Accumulated total');
      expect(projectValueCaption('longest_path')).toContain('critical path');
    });
  });

  describe('accumulation allowance', () => {
    it('is null when no budget was supplied', () => {
      const roles = rolesFromStructure(structure);
      expect(
        accumulationRows(accumulationPassMock, roles).every(
          (r) => r.allowance === null,
        ),
      ).toBe(true);
    });

    it('is read per node when the response carries a budget allowance', () => {
      const roles = rolesFromStructure(structure);
      const withBudget = {
        ...accumulationPassMock,
        allowance: { '1': 6.9, '2': 9.6, '3': 16, '4': 24 },
      };
      expect(row(accumulationRows(withBudget, roles), 1).allowance).toBe(6.9);
    });
  });
});
