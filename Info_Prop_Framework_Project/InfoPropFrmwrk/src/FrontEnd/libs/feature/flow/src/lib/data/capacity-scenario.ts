import { Scenario, ScenarioAnalysis } from '@inf-prop/shared/data-access';

/**
 * Turning the shared scenario model into the flow workbench's picker options.
 *
 * A network carries one or more **scenarios** (named operating cases — value
 * forms like `float`, or cases like "Edge Bottleneck Demo"). `file-convention`
 * has already resolved each scenario's `*-capacities.json` to a network-relative
 * path ready for `/flow-analysis`'s `capacitiesPath`. This module just picks the
 * flow analyses out and labels them.
 *
 * Float64 only, every scenario — `CapacityAnalysisKit.jl` rejects a non-Float64
 * `data_type`. There is no interval/p-box branch in this track.
 */

/** A selectable capacities input for the flow workbench. */
export interface CapacityScenario {
  /** stable id — the scenario name (one flow run per scenario) */
  id: string;
  /** label shown in the picker and recorded on the scenario run */
  name: string;
  /** network-relative path the server resolves for `capacitiesPath` */
  capacitiesPath: string;
}

/** A readable label for a scenario folder name. */
export function displayScenarioName(name: string): string {
  if (!name || name === 'default') return 'Default';
  return name;
}

/**
 * The capacities scenarios available on the loaded network, from
 * `NetworkContextService.scenariosFor('flow')`. Empty when the upload carried no
 * capacities file — the workbench then shows a gated empty state.
 */
export function toCapacityScenarios(
  entries: ReadonlyArray<{ scenario: Scenario; analysis: ScenarioAnalysis }>,
): CapacityScenario[] {
  const seen = new Set<string>();
  const scenarios: CapacityScenario[] = [];

  for (const { scenario, analysis } of entries) {
    const capacitiesPath = analysis.paths.capacities;
    if (!capacitiesPath || seen.has(scenario.name)) continue;
    seen.add(scenario.name);
    scenarios.push({
      id: scenario.name,
      name: displayScenarioName(scenario.name),
      capacitiesPath,
    });
  }

  return scenarios;
}
