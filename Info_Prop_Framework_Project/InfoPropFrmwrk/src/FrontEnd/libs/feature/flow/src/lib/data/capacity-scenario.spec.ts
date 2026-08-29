import { Scenario, ScenarioAnalysis } from '@inf-prop/shared/data-access';
import { displayScenarioName, toCapacityScenarios } from './capacity-scenario';

function flowAnalysis(capacities: string | undefined): ScenarioAnalysis {
  return {
    kind: 'flow',
    valueType: 'float64',
    complete: true,
    paths: { capacities },
    files: [],
  };
}

function entry(
  name: string,
  capacities: string | undefined,
): { scenario: Scenario; analysis: ScenarioAnalysis } {
  return {
    scenario: { name, analyses: [flowAnalysis(capacities)] },
    analysis: flowAnalysis(capacities),
  };
}

describe('displayScenarioName', () => {
  it('labels the root scenario "Default"', () => {
    expect(displayScenarioName('default')).toBe('Default');
    expect(displayScenarioName('')).toBe('Default');
  });

  it('keeps an operating-case name as-is', () => {
    expect(displayScenarioName('Edge Bottleneck Demo')).toBe(
      'Edge Bottleneck Demo',
    );
    expect(displayScenarioName('float')).toBe('float');
  });
});

describe('toCapacityScenarios', () => {
  it('keeps only scenarios with a resolved capacities path', () => {
    const scenarios = toCapacityScenarios([
      entry('Edge Bottleneck Demo', 'Edge Bottleneck Demo/net-capacities.json'),
      entry('No Capacities', undefined),
    ]);
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0]).toEqual({
      id: 'Edge Bottleneck Demo',
      name: 'Edge Bottleneck Demo',
      capacitiesPath: 'Edge Bottleneck Demo/net-capacities.json',
    });
  });

  it('de-duplicates by scenario name', () => {
    const scenarios = toCapacityScenarios([
      entry('float', 'float/a-capacities.json'),
      entry('float', 'float/a-capacities.json'),
    ]);
    expect(scenarios).toHaveLength(1);
  });

  it('is empty when the network carries no capacities input', () => {
    expect(toCapacityScenarios([])).toEqual([]);
  });
});
