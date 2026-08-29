/**
 * Mock `CriticalPathV2` responses in the exact `models/schedule.ts` shape, used
 * by the feature's unit tests. Values mirror V2's validated cases where possible
 * (water Float64 project_value 45.0, accumulation total 480.0).
 */
import {
  CriticalPathResponse,
  ScheduleAccumulationResult,
  SchedulePathResultFloat,
  SchedulePathResultInterval,
} from '@inf-prop/shared/api-client';

export const floatLongestPassMock: SchedulePathResultFloat = {
  kind: 'path',
  mode: 'longest_path',
  method: 'exact_scalar',
  margin_name: 'slack',
  value_type: 'Float64',
  project_value: 45,
  forward: { '1': 10, '2': 25, '3': 20, '4': 45 },
  reverse_completion: { '1': 35, '2': 20, '3': 20, '4': 0 },
  through: { '1': 45, '2': 45, '3': 40, '4': 45 },
  margin: { '1': 0, '2': 0, '3': 5, '4': 0 },
  critical: [1, 2, 4],
  schedule_available: true,
  early_start: { '1': 0, '2': 10, '3': 10, '4': 25 },
  late_finish: { '1': 10, '2': 25, '3': 30, '4': 45 },
  late_start: { '1': 0, '2': 10, '3': 15, '4': 25 },
  near_critical_nodes: [3],
};

export const intervalConservativePassMock: SchedulePathResultInterval = {
  kind: 'path',
  mode: 'longest_path',
  method: 'conservative_enclosure',
  method_note:
    'exact interval floats are intractable for this instance (72 interval inputs with reconvergence — NP-hard in general); returning a sound conservative enclosure',
  margin_name: 'slack',
  value_type: 'Interval',
  project_value: { type: 'interval', lower: 41, upper: 49 },
  forward: {
    '1': { type: 'interval', lower: 9, upper: 11 },
    '2': { type: 'interval', lower: 23, upper: 27 },
    '3': { type: 'interval', lower: 18, upper: 22 },
    '4': { type: 'interval', lower: 41, upper: 49 },
  },
  through: {
    '1': { type: 'interval', lower: 41, upper: 49 },
    '2': { type: 'interval', lower: 41, upper: 49 },
    '3': { type: 'interval', lower: 36, upper: 44 },
    '4': { type: 'interval', lower: 41, upper: 49 },
  },
  margin: {
    '1': { type: 'interval', lower: 0, upper: 0 },
    '2': { type: 'interval', lower: 0, upper: 2 },
    '3': { type: 'interval', lower: 1, upper: 9 },
    '4': { type: 'interval', lower: 0, upper: 0 },
  },
  necessarily_critical: [1, 4],
  possibly_critical: [1, 2, 4],
  corner_count: 4,
  schedule_available: false,
};

export const intervalExactPassMock: SchedulePathResultInterval = {
  ...intervalConservativePassMock,
  method: 'exact_domination_split',
  method_note: '',
  necessarily_critical: [1, 2, 4],
  possibly_critical: [1, 2, 4],
  corner_count: 12,
};

export const accumulationPassMock: ScheduleAccumulationResult = {
  kind: 'accumulation',
  mode: 'accumulation',
  method: 'exact_scalar',
  margin_name: 'allowance',
  value_type: 'Float64',
  forward: { '1': 100, '2': 260, '3': 180, '4': 480 },
  target: 4,
  total: 480,
  multiplicity: { '1': 2, '2': 1, '3': 1, '4': 1 },
  sensitivity: { '1': 2, '2': 1, '3': 1, '4': 1 },
  contribution: { '1': 200, '2': 160, '3': 120, '4': 100 },
  ranking: [1, 2, 3, 4],
};

export function responseWith(
  time: CriticalPathResponse['critical_path_result']['time_result'],
  cost: CriticalPathResponse['critical_path_result']['cost_result'] = null,
): CriticalPathResponse {
  return {
    success: true,
    message: 'Critical path analysis completed',
    endpoint: 'critical-path-analysis',
    edges_file_path: 'KarlNetwork.EDGES',
    cpm_path: 'cpm/KarlNetwork-cpm-inputs.json',
    timestamp: '2026-08-29T12:00:00',
    critical_path_result: {
      module_version: 'CriticalPathV2',
      value_type: time.value_type,
      time_mode: time.mode,
      cost_mode: cost ? cost.mode : null,
      computation_time: 0.0123,
      time_result: time,
      cost_result: cost,
      input_files: { cpm_path: 'cpm/KarlNetwork-cpm-inputs.json' },
    },
  };
}
