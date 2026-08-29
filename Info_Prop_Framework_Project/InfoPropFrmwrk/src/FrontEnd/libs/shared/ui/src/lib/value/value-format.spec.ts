import {
  formatValueForm,
  valueFormLabel,
} from './value-format';

describe('value-format — never flattens an uncertain value', () => {
  it('keeps a number a number', () => {
    expect(formatValueForm(0.8342)).toBe('0.8342');
    expect(valueFormLabel(0.8342)).toBe('number');
  });

  it('keeps an interval a bound pair', () => {
    const v = { type: 'interval' as const, lower: 0.4, upper: 0.9 };
    expect(formatValueForm(v)).toBe('[0.4, 0.9]');
    expect(valueFormLabel(v)).toBe('interval');
  });

  it('keeps a p-box a typed mean range, not a midpoint', () => {
    const v = {
      type: 'pbox' as const,
      mean_lower: 0.5,
      mean_upper: 0.7,
      var_lower: 0,
      var_upper: 0.1,
      shape: 'normal',
      name: '',
      bounded: true,
      discretization_size: 200,
      bounds_summary: { left_min: 0, left_max: 1, right_min: 0, right_max: 1 },
    };
    const out = formatValueForm(v);
    expect(out).toContain('E ∈ [0.5, 0.7]');
    expect(out).not.toBe('0.6');
    expect(valueFormLabel(v)).toBe('p-box');
  });
});
