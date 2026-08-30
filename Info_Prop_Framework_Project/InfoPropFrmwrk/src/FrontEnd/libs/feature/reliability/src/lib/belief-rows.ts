import {
  BeliefValue,
  NetworkStructure,
  ProbabilityPropagationResponse,
  isIntervalData,
  isPboxData,
} from '@inf-prop/shared/api-client';
import { BeliefRow, NodeRole } from './reliability.types';

function rolesOf(nodeId: number, s: NetworkStructure | null): NodeRole[] {
  if (!s) return ['regular'];
  const tags: NodeRole[] = [];
  if (s.source_nodes?.includes(nodeId)) tags.push('source');
  if (s.sink_nodes?.includes(nodeId)) tags.push('sink');
  if (s.fork_nodes?.includes(nodeId)) tags.push('fork');
  if (s.join_nodes?.includes(nodeId)) tags.push('join');
  return tags.length ? tags : ['regular'];
}

/**
 * Sort key for a belief column. A plain number sorts on itself; an interval or
 * p-box has no single canonical order, so sort on its LOWER bound (a real field,
 * not a midpoint) — the UI labels the column accordingly when it does this.
 */
export function beliefLowerBound(v: BeliefValue): number {
  if (typeof v === 'number') return v;
  if (isIntervalData(v)) return v.lower;
  if (isPboxData(v)) return v.mean_lower;
  return Number.NaN;
}

/**
 * A single representative number for a belief value — the SAME numeric-summary
 * convention the server already applies to `belief_statistics` (an interval's
 * midpoint, a p-box's mean midpoint). For aggregate stat tiles ONLY; the
 * per-node table never flattens a value this way.
 */
export function beliefMidpoint(v: BeliefValue): number {
  if (typeof v === 'number') return v;
  if (isIntervalData(v)) return (v.lower + v.upper) / 2;
  if (isPboxData(v)) return (v.mean_lower + v.mean_upper) / 2;
  return Number.NaN;
}

/**
 * How wide a belief's stated bound is — the quantity the chapter's own case
 * study leads with when comparing designs ("a facility whose reachability is
 * confidently 0.6 and one whose reachability is anywhere between 0.56 and
 * 0.72 call for different interventions"). A deterministic value has none.
 * For an interval this is the exact range width; for a p-box it is the width
 * of the bound on the MEAN specifically (the p-box's own summary field, not
 * an estimate over its full distribution — no wider claim is made).
 */
export function beliefBandWidth(v: BeliefValue): number {
  if (typeof v === 'number') return 0;
  if (isIntervalData(v)) return v.upper - v.lower;
  if (isPboxData(v)) return v.mean_upper - v.mean_lower;
  return Number.NaN;
}

export function buildBeliefRows(
  res: ProbabilityPropagationResponse,
  structure: NetworkStructure | null,
  joinsWithDiamonds: readonly number[],
): BeliefRow[] {
  const ei = res.probability_result?.exact_inference;
  if (!ei?.beliefs) return [];
  const priors = ei.node_priors ?? {};
  const diamondJoins = new Set(joinsWithDiamonds);

  return Object.entries(ei.beliefs)
    .map(([idStr, belief]) => {
      const nodeId = Number(idStr);
      const roleTags = rolesOf(nodeId, structure);
      return {
        nodeId,
        belief,
        prior: Object.prototype.hasOwnProperty.call(priors, idStr)
          ? priors[idStr]
          : undefined,
        role: roleTags[0],
        roleTags,
        hasDiamond: diamondJoins.has(nodeId),
      } satisfies BeliefRow;
    })
    .sort((a, b) => a.nodeId - b.nodeId);
}
