import { NetworkStructure } from '@inf-prop/shared/api-client';
import { beliefLowerBound, buildBeliefRows } from './belief-rows';
import {
  mockFloatResponse,
  mockIntervalResponse,
  mockPboxResponse,
} from './reliability.mocks';

const structure = {
  source_nodes: [1, 2],
  sink_nodes: [5],
  fork_nodes: [2],
  join_nodes: [5],
} as unknown as NetworkStructure;

describe('buildBeliefRows', () => {
  it('keeps float beliefs as numbers and tags roles', () => {
    const rows = buildBeliefRows(mockFloatResponse(), structure, [5]);
    expect(rows).toHaveLength(5);
    expect(rows[0].nodeId).toBe(1);
    expect(rows[0].belief).toBe(0.9);
    expect(rows.find((r) => r.nodeId === 2)?.roleTags).toEqual(
      expect.arrayContaining(['source', 'fork']),
    );
    expect(rows.find((r) => r.nodeId === 5)?.hasDiamond).toBe(true);
    expect(rows.find((r) => r.nodeId === 1)?.hasDiamond).toBe(false);
  });

  it('keeps interval beliefs as bound pairs (never midpointed)', () => {
    const rows = buildBeliefRows(mockIntervalResponse(), structure, []);
    const five = rows.find((r) => r.nodeId === 5);
    expect(five?.belief).toEqual({ type: 'interval', lower: 0.55, upper: 0.8 });
  });

  it('keeps p-box beliefs as typed summaries', () => {
    const rows = buildBeliefRows(mockPboxResponse(), structure, []);
    const five = rows.find((r) => r.nodeId === 5);
    expect((five?.belief as { type: string }).type).toBe('pbox');
  });

  it('falls back to regular role when no structure', () => {
    const rows = buildBeliefRows(mockFloatResponse(), null, []);
    expect(rows.every((r) => r.roleTags[0] === 'regular')).toBe(true);
  });
});

describe('beliefLowerBound', () => {
  it('is the number itself, the interval lower, or the p-box mean_lower', () => {
    expect(beliefLowerBound(0.7)).toBe(0.7);
    expect(beliefLowerBound({ type: 'interval', lower: 0.4, upper: 0.9 })).toBe(
      0.4,
    );
    expect(
      beliefLowerBound({
        type: 'pbox',
        mean_lower: 0.5,
        mean_upper: 0.7,
        var_lower: 0,
        var_upper: 0,
        shape: '',
        name: '',
        bounded: true,
        discretization_size: 1,
        bounds_summary: { left_min: 0, left_max: 1, right_min: 0, right_max: 1 },
      }),
    ).toBe(0.5);
  });
});
