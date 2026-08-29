/**
 * The folder + naming convention the server uses to sort an upload into a
 * structure file plus one-or-more analysis-input sets. One upload supports the
 * whole comparative workflow — the convention carries **scenarios**: named
 * operating cases of the *same* network, each a self-contained bundle of any
 * subset of the analysis inputs.
 *
 *   <network>/
 *     <network>.EDGES                     structure — "source,destination" CSV
 *     <scenario>/                         a named operating case, e.g. "float",
 *                                         "interval", "Edge Bottleneck Demo",
 *                                         "Degraded", "01 Source Limited"
 *       *-nodepriors.json                 reliability (with *-linkprobabilities)
 *       *-linkprobabilities.json
 *       *-capacities.json                 flow
 *       *-cpm-inputs.json                 schedule
 *
 * Two conventions in use, both handled here:
 *   A. value-form folders: the scenario name IS a value type
 *      (`float` / `interval` / `pbox`), one analysis per folder.
 *   B. operating-case folders: an arbitrary name, often carrying all analyses
 *      at once (e.g. `water/Edge Bottleneck Demo/` has all four files). The
 *      value type then lives in each file's top-level `data_type` field.
 *
 * The interface invents no second format: the bytes uploaded are the bytes the
 * package reads. The authoritative value type of a run always comes back in the
 * analysis response (`value_type`); what this module derives is a best-effort
 * label for pre-selecting the value-type selector.
 */

export type FileRole =
  | 'edges'
  | 'nodepriors'
  | 'linkprobs'
  | 'capacities'
  | 'cpm'
  | 'node-mapping'
  | 'unknown';

export type ScenarioValueType = 'float64' | 'interval' | 'pbox';
export type AnalysisKind = 'reliability' | 'flow' | 'schedule';

const FILE_PATTERNS: Record<Exclude<FileRole, 'unknown'>, RegExp> = {
  edges: /\.edges$/i,
  nodepriors: /(nodepriors?|node-priors?).*\.json$/i,
  linkprobs: /(linkprob|link-prob|linkprobabilit).*\.json$/i,
  capacities: /capacit.*\.json$/i,
  cpm: /(cpm|cmp).*(input|analysis|data)?.*\.json$/i,
  'node-mapping': /(node[-_ ]?mapping|mapping).*\.(txt|json)$/i,
};

const FOLDER_VALUE_TYPES: Array<[ScenarioValueType, RegExp]> = [
  ['float64', /^(float|float64|crisp|deterministic)$/i],
  ['interval', /^(interval|range)$/i],
  ['pbox', /^(pbox|p-?box|probability-?box)$/i],
];

/** Conventional analysis-folder names — assume the obvious value type, don't probe the file. */
const STANDARD_FOLDER =
  /^(float|float64|crisp|deterministic|interval|range|pbox|p-?box|probability-?box|capacity|capacities|flow|cpm|cmp|critical|time|cost|schedule)$/i;

export interface ClassifiedFile {
  /** present for a local upload; absent when built from server paths */
  file?: File;
  /** path relative to the upload root (includes the network dir if foldered) */
  relativePath: string;
  /** path relative to the network dir — what the server `*Path` fields expect */
  networkRelativePath: string;
  role: FileRole;
  /** the scenario folder name, or 'default' for files at the network root */
  scenario: string;
}

export interface ScenarioAnalysis {
  kind: AnalysisKind;
  /**
   * Best-effort value type: the scenario folder keyword if it is one, else the
   * `data_type` read from the file (via `enrichValueTypes`), else 'float64'.
   * Not authoritative — the analysis response carries the real one.
   */
  valueType: ScenarioValueType;
  /** all required files for this analysis are present */
  complete: boolean;
  /** network-relative paths, ready for the server request fields */
  paths: {
    nodepriors?: string;
    linkprobs?: string;
    capacities?: string;
    cpm?: string;
  };
  files: ClassifiedFile[];
}

export interface Scenario {
  /** folder name, or 'default' */
  name: string;
  /** set when the folder name is itself a value-type keyword */
  folderValueType?: ScenarioValueType;
  analyses: ScenarioAnalysis[];
}

export interface ClassifiedUpload {
  networkName: string;
  edges?: ClassifiedFile;
  scenarios: Scenario[];
  unknown: ClassifiedFile[];
}

// ---------------------------------------------------------------------------

function relPathOf(file: File): string {
  return (
    (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
    file.name
  );
}

function roleOf(name: string): FileRole {
  for (const [role, re] of Object.entries(FILE_PATTERNS)) {
    if (re.test(name)) return role as FileRole;
  }
  return 'unknown';
}

function folderValueTypeOf(folder: string): ScenarioValueType | undefined {
  for (const [vt, re] of FOLDER_VALUE_TYPES) if (re.test(folder)) return vt;
  return undefined;
}

/** True for a conventional analysis folder (`float`, `cpm`, `capacity`, …). */
export function isStandardFolder(name: string): boolean {
  return STANDARD_FOLDER.test(name.split('/').pop() ?? name);
}

interface RawEntry {
  relativePath: string;
  file?: File;
}

function deriveNetworkName(entries: RawEntry[], explicit?: string): string {
  if (explicit) return explicit;
  for (const e of entries) {
    const parts = e.relativePath.split(/[\\/]/).filter(Boolean);
    if (parts.length > 1) return parts[0];
  }
  for (const e of entries) {
    const base = e.relativePath.split(/[\\/]/).pop() ?? e.relativePath;
    if (FILE_PATTERNS.edges.test(base)) return base.replace(/\.edges$/i, '');
  }
  return 'network';
}

function classifyEntries(
  entries: RawEntry[],
  explicitNetworkName?: string,
): ClassifiedUpload {
  const networkName = deriveNetworkName(entries, explicitNetworkName);

  const classified: ClassifiedFile[] = entries.map((e) => {
    const norm = e.relativePath.replace(/\\/g, '/');
    const parts = norm.split('/').filter(Boolean);
    const base = parts[parts.length - 1];
    // strip a leading "<networkName>/" so paths are network-relative
    let rel = parts;
    if (parts.length > 1 && parts[0].toLowerCase() === networkName.toLowerCase()) {
      rel = parts.slice(1);
    }
    const scenario = rel.length > 1 ? rel.slice(0, -1).join('/') : 'default';
    return {
      file: e.file,
      relativePath: norm,
      networkRelativePath: rel.join('/'),
      role: roleOf(base),
      scenario,
    };
  });

  const upload: ClassifiedUpload = {
    networkName,
    scenarios: [],
    unknown: [],
  };

  const byScenario = new Map<string, ClassifiedFile[]>();
  for (const c of classified) {
    if (c.role === 'edges') {
      // prefer one at the network root
      if (!upload.edges || c.scenario === 'default') upload.edges = c;
      continue;
    }
    if (c.role === 'unknown' || c.role === 'node-mapping') {
      upload.unknown.push(c);
      continue;
    }
    const list = byScenario.get(c.scenario) ?? [];
    list.push(c);
    byScenario.set(c.scenario, list);
  }

  for (const [name, files] of byScenario) {
    const folderSeg = name === 'default' ? '' : (name.split('/').pop() ?? name);
    const fvt = folderSeg ? folderValueTypeOf(folderSeg) : undefined;

    const pick = (role: FileRole) => files.find((f) => f.role === role);
    const np = pick('nodepriors');
    const lp = pick('linkprobs');
    const cap = pick('capacities');
    const cpm = pick('cpm');

    const analyses: ScenarioAnalysis[] = [];
    if (np || lp) {
      analyses.push({
        kind: 'reliability',
        valueType: fvt ?? 'float64',
        complete: !!(np && lp),
        paths: {
          nodepriors: np?.networkRelativePath,
          linkprobs: lp?.networkRelativePath,
        },
        files: [np, lp].filter((f): f is ClassifiedFile => !!f),
      });
    }
    if (cap) {
      analyses.push({
        kind: 'flow',
        valueType: 'float64', // flow is Float64 only
        complete: true,
        paths: { capacities: cap.networkRelativePath },
        files: [cap],
      });
    }
    if (cpm) {
      analyses.push({
        kind: 'schedule',
        valueType: fvt === 'pbox' ? 'float64' : (fvt ?? 'float64'),
        complete: true,
        paths: { cpm: cpm.networkRelativePath },
        files: [cpm],
      });
    }

    if (analyses.length) {
      upload.scenarios.push({ name, folderValueType: fvt, analyses });
    }
  }

  upload.scenarios.sort((a, b) => a.name.localeCompare(b.name));
  return upload;
}

/** Classify a local file / folder upload. */
export function classifyFiles(files: Iterable<File>): ClassifiedUpload {
  return classifyEntries(
    [...files].map((file) => ({ relativePath: relPathOf(file), file })),
  );
}

/**
 * Classify the server's returned relative paths (e.g. from an `UploadResponse`
 * or a session's `uploaded_files`) — used post-upload by every feature track to
 * find which scenario's files feed which analysis.
 */
export function classifyPaths(
  networkName: string,
  paths: readonly string[],
): ClassifiedUpload {
  return classifyEntries(
    paths.map((relativePath) => ({ relativePath })),
    networkName,
  );
}

/** Coarse "which toolkits can run at all" — for nav unlock. */
export function detectAvailableInputs(paths: readonly string[]): {
  reliability: boolean;
  flow: boolean;
  schedule: boolean;
} {
  return availableInputsFrom(classifyPaths('', paths));
}

/** Same, from a classified upload. */
export function availableInputsFrom(upload: ClassifiedUpload): {
  reliability: boolean;
  flow: boolean;
  schedule: boolean;
} {
  const any = (kind: AnalysisKind, needComplete = true) =>
    upload.scenarios.some((s) =>
      s.analyses.some((a) => a.kind === kind && (!needComplete || a.complete)),
    );
  return {
    reliability: any('reliability'),
    flow: any('flow'),
    schedule: any('schedule'),
  };
}

/** Every scenario that can feed a given analysis. */
export function scenariosFor(
  upload: ClassifiedUpload,
  kind: AnalysisKind,
): Array<{ scenario: Scenario; analysis: ScenarioAnalysis }> {
  const out: Array<{ scenario: Scenario; analysis: ScenarioAnalysis }> = [];
  for (const scenario of upload.scenarios) {
    for (const analysis of scenario.analyses) {
      if (analysis.kind === kind && analysis.complete) {
        out.push({ scenario, analysis });
      }
    }
  }
  return out;
}

// --- value-type enrichment (best-effort, from file content) -----------------

function mapDataType(raw: unknown): ScenarioValueType | undefined {
  if (typeof raw !== 'string') return undefined;
  const s = raw.toLowerCase();
  if (s.includes('pbox') || s.includes('probabilitybounds')) return 'pbox';
  if (s.includes('interval')) return 'interval';
  if (s.includes('float')) return 'float64';
  return undefined;
}

/** Read a JSON file's top-level `data_type` and map it to a value type. */
export async function readDataType(
  file: File,
): Promise<ScenarioValueType | undefined> {
  try {
    const text = await file.text();
    const json = JSON.parse(text) as { data_type?: unknown };
    return mapDataType(json.data_type);
  } catch {
    return undefined;
  }
}

/**
 * Fill in each analysis's `valueType` from its input file's `data_type`, where
 * the scenario folder name didn't already imply one (e.g. an operating case
 * like "Interval Conservative"). `readJson` fetches a file by its
 * network-relative path — pass a `File`-backed reader for a local upload, or an
 * HTTP `/files/` reader for a network already on the server. Mutates and
 * returns `upload`.
 */
export async function enrichValueTypesWith(
  upload: ClassifiedUpload,
  readJson: (
    networkRelativePath: string,
  ) => Promise<{ data_type?: unknown } | null | undefined>,
): Promise<ClassifiedUpload> {
  for (const scenario of upload.scenarios) {
    if (scenario.folderValueType) continue;
    const seg = scenario.name.split('/').pop() ?? scenario.name;
    // a conventional analysis folder (e.g. `cpm/`) — assume Float64, don't probe
    if (STANDARD_FOLDER.test(seg)) continue;
    for (const analysis of scenario.analyses) {
      if (analysis.kind === 'flow') continue; // always Float64
      const rel =
        analysis.paths.nodepriors ?? analysis.paths.cpm ?? undefined;
      if (!rel) continue;
      let json: { data_type?: unknown } | null | undefined;
      try {
        json = await readJson(rel);
      } catch {
        json = null;
      }
      const vt = mapDataType(json?.data_type);
      if (vt && !(analysis.kind === 'schedule' && vt === 'pbox')) {
        analysis.valueType = vt;
      }
    }
  }
  return upload;
}

/** Local-upload convenience — enrich from the `File` objects on the upload. */
export async function enrichValueTypes(
  upload: ClassifiedUpload,
): Promise<ClassifiedUpload> {
  const byPath = new Map<string, File>();
  for (const s of upload.scenarios) {
    for (const a of s.analyses) {
      for (const f of a.files) {
        if (f.file) byPath.set(f.networkRelativePath, f.file);
      }
    }
  }
  return enrichValueTypesWith(upload, async (rel) => {
    const file = byPath.get(rel);
    if (!file) return null;
    try {
      return JSON.parse(await file.text()) as { data_type?: unknown };
    } catch {
      return null;
    }
  });
}

export const RECOMMENDED_FOLDER_LAYOUT = `<network-name>/
  <network-name>.EDGES
  <scenario>/       *-nodepriors.json  *-linkprobabilities.json   (reliability)
                    *-capacities.json                             (flow)
                    *-cpm-inputs.json                             (schedule)

A scenario folder can carry any subset of the four inputs. Name it for the
value form (float / interval / pbox) or for the operating case ("Edge
Bottleneck", "Degraded", "01 Source Limited"). Value form for a non-keyword
folder is taken from each file's own "data_type" field.`;
