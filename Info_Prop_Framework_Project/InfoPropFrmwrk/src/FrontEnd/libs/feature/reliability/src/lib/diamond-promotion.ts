import { ValueType } from '@inf-prop/shared/api-client';

/**
 * Diamond promotion — turn one identified diamond into a brand-new, independent
 * network the user can push through any toolkit.
 *
 * The framework's own account licenses this: each stored diamond is "a unified
 * graph object of its own", self-similar to the whole network. Promotion needs
 * NO new server endpoint — it serialises the diamond's subgraph into exactly the
 * files `/upload` already accepts (`<net>.EDGES` + a `float|interval|pbox/`
 * folder holding nodepriors + linkprobabilities) and feeds them through the
 * normal upload flow. The interface invents no second format.
 *
 * Node priors and edge probabilities are copied verbatim from the parent
 * scenario's own input files (fetched via `GET /files/…`), restricted to the
 * diamond's nodes and edges — so the promoted network carries the parent's real
 * attributes, in the parent's value form, not the computed beliefs.
 */

/** Parsed `*-nodepriors.json` from the parent scenario. */
export interface ParentPriorsFile {
  nodes: Record<string, unknown>;
  data_type?: string;
  [key: string]: unknown;
}

/** Parsed `*-linkprobabilities.json` from the parent scenario. */
export interface ParentLinksFile {
  links: Record<string, unknown>;
  data_type?: string;
  [key: string]: unknown;
}

export interface DiamondPromotionInput {
  /** name for the new network, e.g. `KarlNetwork-join-7` */
  networkName: string;
  valueType: ValueType;
  edgelist: [number, number][];
  relevantNodes: number[];
  parentPriors: ParentPriorsFile;
  parentLinks: ParentLinksFile;
  /** optional per-source-node prior substitution (node id -> replacement value) */
  priorOverrides?: Record<number, unknown>;
}

const FOLDER_FOR_VALUE_TYPE: Record<ValueType, string> = {
  float64: 'float',
  interval: 'interval',
  pbox: 'pbox',
};

const DATA_TYPE_FOR_VALUE_TYPE: Record<ValueType, string> = {
  float64: 'Float64',
  interval: 'Interval',
  pbox: 'pbox',
};

export function scenarioFolderFor(valueType: ValueType): string {
  return FOLDER_FOR_VALUE_TYPE[valueType] ?? 'float';
}

export function sanitiseNetworkName(name: string): string {
  return (
    name
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'diamond'
  );
}

function diamondNodeSet(input: DiamondPromotionInput): Set<number> {
  const set = new Set<number>(input.relevantNodes);
  for (const [u, v] of input.edgelist) {
    set.add(u);
    set.add(v);
  }
  return set;
}

export function buildEdgesContent(edgelist: [number, number][]): string {
  const rows = edgelist.map(([u, v]) => `${u},${v}`);
  return ['source,destination', ...rows].join('\n') + '\n';
}

/** Look up an edge's probability under any of the key spellings the package emits. */
function pickEdgeValue(
  links: Record<string, unknown>,
  u: number,
  v: number,
): unknown {
  const direct = [`(${u},${v})`, `(${u}, ${v})`, `${u},${v}`, `${u}->${v}`];
  for (const key of direct) {
    if (Object.prototype.hasOwnProperty.call(links, key)) return links[key];
  }
  for (const [key, value] of Object.entries(links)) {
    const m = key.match(/\(?\s*(\d+)\s*,\s*(\d+)\s*\)?/);
    if (m && Number(m[1]) === u && Number(m[2]) === v) return value;
  }
  return undefined;
}

export function buildPriorsContent(input: DiamondPromotionInput): string {
  const nodes: Record<string, unknown> = {};
  for (const id of [...diamondNodeSet(input)].sort((a, b) => a - b)) {
    const key = String(id);
    const override = input.priorOverrides?.[id];
    if (override !== undefined) {
      nodes[key] = override;
    } else if (Object.prototype.hasOwnProperty.call(input.parentPriors.nodes, key)) {
      nodes[key] = input.parentPriors.nodes[key];
    }
  }
  return JSON.stringify(
    {
      nodes,
      data_type:
        input.parentPriors.data_type ??
        DATA_TYPE_FOR_VALUE_TYPE[input.valueType],
      serialization: 'compact',
      description: `Promoted diamond subgraph of ${input.networkName}`,
    },
    null,
    2,
  );
}

export function buildLinksContent(input: DiamondPromotionInput): string {
  const links: Record<string, unknown> = {};
  for (const [u, v] of input.edgelist) {
    const value = pickEdgeValue(input.parentLinks.links, u, v);
    if (value !== undefined) links[`(${u},${v})`] = value;
  }
  return JSON.stringify(
    {
      links,
      data_type:
        input.parentLinks.data_type ??
        DATA_TYPE_FOR_VALUE_TYPE[input.valueType],
      serialization: 'compact',
      description: `Promoted diamond subgraph of ${input.networkName}`,
    },
    null,
    2,
  );
}

function asUploadFile(relativePath: string, content: string, type: string): File {
  const name = relativePath.split('/').pop() ?? relativePath;
  const file = new File([content], name, { type });
  Object.defineProperty(file, 'webkitRelativePath', { value: relativePath });
  return file;
}

/**
 * The `File[]` to hand to `UploadService.upload()`. `webkitRelativePath` carries
 * the folder layout so the server's naming convention sorts them correctly.
 */
export function buildDiamondUploadFiles(input: DiamondPromotionInput): File[] {
  const net = sanitiseNetworkName(input.networkName);
  const folder = scenarioFolderFor(input.valueType);
  return [
    asUploadFile(
      `${net}/${net}.EDGES`,
      buildEdgesContent(input.edgelist),
      'text/plain',
    ),
    asUploadFile(
      `${net}/${folder}/${net}-nodepriors.json`,
      buildPriorsContent(input),
      'application/json',
    ),
    asUploadFile(
      `${net}/${folder}/${net}-linkprobabilities.json`,
      buildLinksContent(input),
      'application/json',
    ),
  ];
}
