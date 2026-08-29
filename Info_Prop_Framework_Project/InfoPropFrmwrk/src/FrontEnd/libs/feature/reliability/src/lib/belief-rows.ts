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
