/**
 * Builds the analysis-input files the server's naming convention expects
 * (`file-convention.ts`), from values a user enters by hand rather than from
 * an uploaded file. Used by the missing-inputs editor to let a session that
 * has no reliability/flow/schedule inputs yet get some, without leaving the
 * app to hand-author JSON.
 *
 * Every shape here matches what the server's own handlers parse — traced
 * directly from `Server/Handlers/{UploadHandlers,CapacityHandlers,
 * CriticalPathHandlers}.jl` and `AnalysisCommon.jl`, not invented:
 *  - nodepriors / linkprobabilities: `{ nodes | links, data_type, ... }`,
 *    link keys as `"(u,v)"` — the same shape `diamond-promotion.ts` writes.
 *  - capacities: the "toolkit-edges-array" schema (`edges: [{source,
 *    destination, capacity}]`, optional `nodes: [{node, capacity}]`) —
 *    Float64 only, `CapacityAnalysisKit.jl` hard-rejects anything else.
 *  - cpm-inputs: `{ data_type, time_analysis: { node_durations, edge_delays,
 *    initial_time }, cost_analysis?: { node_costs, edge_costs, initial_cost } }`.
 *    The mode (LongestPath/ShortestPath/MaxScaling/Accumulation) is chosen at
 *    RUN TIME by the toolkit's own mode selector, not declared in the file —
 *    the file's `combination_function`/`propagation_function` are left at
 *    their server-side defaults (LongestPath) since every run can override
 *    them per pass regardless.
 */

const DATA_TYPE_FOR: Record<'float64' | 'interval', string> = {
  float64: 'Float64',
  interval: 'Interval',
};

/** `File` with `webkitRelativePath` set, ready for `UploadService.upload()`. */
export function toUploadFile(relativePath: string, content: string, mime: string): File {
  const name = relativePath.split('/').pop() ?? relativePath;
  const file = new File([content], name, { type: mime });
  Object.defineProperty(file, 'webkitRelativePath', { value: relativePath });
  return file;
}

/** `<net>.EDGES` — "source,destination" CSV, the same shape the structure
 *  endpoint returns edges in, so it can be rebuilt from `ctx.structure()`
 *  without ever needing to re-fetch the original (non-JSON) file. */
export function buildEdgesFileContent(edges: readonly (readonly [number, number])[]): string {
  const rows = edges.map(([u, v]) => `${u},${v}`);
  return ['source,destination', ...rows].join('\n') + '\n';
}

export function buildNodePriorsContent(
  values: Readonly<Record<number, number>>,
  valueType: 'float64' | 'interval',
  description: string,
): string {
  const nodes: Record<string, number> = {};
  for (const [id, v] of Object.entries(values)) nodes[id] = v;
  return JSON.stringify(
    { nodes, data_type: DATA_TYPE_FOR[valueType], serialization: 'compact', description },
    null,
    2,
  );
}

/** `values` keyed `"u-v"` (this module's own in-memory edge key); written
 *  out as the wire's `"(u,v)"` link key. */
export function buildLinkProbabilitiesContent(
  values: Readonly<Record<string, number>>,
  valueType: 'float64' | 'interval',
  description: string,
): string {
  const links: Record<string, number> = {};
  for (const [key, v] of Object.entries(values)) {
    const [u, vId] = key.split('-');
    links[`(${u},${vId})`] = v;
  }
  return JSON.stringify(
    { links, data_type: DATA_TYPE_FOR[valueType], serialization: 'compact', description },
    null,
    2,
  );
}

/** Capacities are Float64 only (`CapacityAnalysisKit.jl` rejects anything
 *  else) — no value-type parameter. `edgeValues` keyed `"u-v"`. */
export function buildCapacitiesContent(
  edgeValues: Readonly<Record<string, number>>,
  nodeValues: Readonly<Record<number, number>> | undefined,
  description: string,
): string {
  const edges = Object.entries(edgeValues).map(([key, capacity]) => {
    const [source, destination] = key.split('-').map(Number);
    return { source, destination, capacity };
  });
  const payload: Record<string, unknown> = {
    data_type: 'Float64',
    edges,
    description,
  };
  if (nodeValues && Object.keys(nodeValues).length) {
    payload['nodes'] = Object.entries(nodeValues).map(([node, capacity]) => ({
      node: Number(node),
      capacity,
    }));
  }
  return JSON.stringify(payload, null, 2);
}

export interface CpmInputsInput {
  valueType: 'float64' | 'interval';
  nodeDurations: Readonly<Record<number, number>>;
  /** keyed `"u-v"`; entries are optional per edge (0 delay if omitted server-side,
   *  but the editor writes only the edges the user gave a value to) */
  edgeDelays: Readonly<Record<string, number>>;
  nodeCosts?: Readonly<Record<number, number>>;
  edgeCosts?: Readonly<Record<string, number>>;
}

export function buildCpmInputsContent(input: CpmInputsInput): string {
  const dataType = DATA_TYPE_FOR[input.valueType];
  const toEdgeMap = (values: Readonly<Record<string, number>>) => {
    const out: Record<string, number> = {};
    for (const [key, v] of Object.entries(values)) {
      const [u, v2] = key.split('-');
      out[`(${u},${v2})`] = v;
    }
    return out;
  };
  const toNodeMap = (values: Readonly<Record<number, number>>) => {
    const out: Record<string, number> = {};
    for (const [id, v] of Object.entries(values)) out[id] = v;
    return out;
  };

  const payload: Record<string, unknown> = {
    data_type: dataType,
    time_analysis: {
      node_durations: toNodeMap(input.nodeDurations),
      edge_delays: toEdgeMap(input.edgeDelays),
      initial_time: 0,
    },
  };
  if (input.nodeCosts && Object.keys(input.nodeCosts).length) {
    payload['cost_analysis'] = {
      node_costs: toNodeMap(input.nodeCosts),
      edge_costs: input.edgeCosts ? toEdgeMap(input.edgeCosts) : {},
      initial_cost: 0,
    };
  }
  return JSON.stringify(payload, null, 2);
}
