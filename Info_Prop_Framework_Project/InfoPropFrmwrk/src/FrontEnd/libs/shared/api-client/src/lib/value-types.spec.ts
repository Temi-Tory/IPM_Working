import {
  TOOLKIT_VALUE_TYPES,
  isDeterministic,
  isIntervalData,
  isPboxData,
  valueFormKind,
} from './value-types';

describe('value-types', () => {
  it('recognises each form and never confuses them', () => {
    expect(isDeterministic(0.5)).toBe(true);
    expect(isIntervalData({ type: 'interval', lower: 0, upper: 1 })).toBe(true);
    expect(isPboxData({ type: 'pbox' } as never)).toBe(true);
    expect(isIntervalData(0.5)).toBe(false);
    expect(isPboxData({ type: 'interval', lower: 0, upper: 1 })).toBe(false);
  });

  it('maps a form to its value type', () => {
    expect(valueFormKind(0.5)).toBe('float64');
    expect(valueFormKind({ type: 'interval', lower: 0, upper: 1 })).toBe(
      'interval',
    );
  });

  it('encodes the per-toolkit value-type asymmetry', () => {
    expect(TOOLKIT_VALUE_TYPES.reliability).toEqual([
      'float64',
      'interval',
      'pbox',
    ]);
    expect(TOOLKIT_VALUE_TYPES.flow).toEqual(['float64']);
    expect(TOOLKIT_VALUE_TYPES.schedule).toEqual(['float64', 'interval']);
  });
});
