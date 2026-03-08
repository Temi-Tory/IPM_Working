import { NetworkStructure } from '../models/network-analysis.models';

export type NodeType = 'source' | 'sink' | 'fork' | 'join' | 'regular';

export interface PrimitiveGraphNode {
  id: string;
  nodeType: NodeType;
  layer: number;
  layerIndex: number;
  x: number;
  y: number;
}

export interface PrimitiveGraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface PrimitiveGraphData {
  nodes: PrimitiveGraphNode[];
  edges: PrimitiveGraphEdge[];
  width: number;
  height: number;
}

export const NODE_TYPE_COLORS: Record<NodeType, string> = {
  source: '#859900',
  sink: '#dc322f',
  fork: '#cb4b16',
  join: '#2aa198',
  regular: '#268bd2'
};

export function buildLayeredPrimitiveGraph(
  network: NetworkStructure,
  width = 980,
  height = 480
): PrimitiveGraphData {
  const sourceSet = new Set((network.source_nodes ?? []).map(n => String(n)));
  const sinkSet = new Set((network.sink_nodes ?? []).map(n => String(n)));
  const forkSet = new Set((network.fork_nodes ?? []).map(n => String(n)));
  const joinSet = new Set((network.join_nodes ?? []).map(n => String(n)));

  const layers = (network.iteration_sets?.length ?? 0) > 0
    ? network.iteration_sets
    : [network.nodes ?? []];

  const allNodes = new Set<string>();
  for (const [from, to] of network.edges ?? []) {
    allNodes.add(String(from));
    allNodes.add(String(to));
  }
  for (const n of network.nodes ?? []) {
    allNodes.add(String(n));
  }

  const layerMap = new Map<string, { layer: number; layerIndex: number }>();
  layers.forEach((layerNodes, layer) => {
    layerNodes.forEach((node, layerIndex) => {
      layerMap.set(String(node), { layer, layerIndex });
    });
  });

  let fallbackIndex = 0;
  for (const id of allNodes) {
    if (!layerMap.has(id)) {
      layerMap.set(id, { layer: layers.length, layerIndex: fallbackIndex++ });
    }
  }

  const maxLayer = Math.max(...Array.from(layerMap.values()).map(v => v.layer), 0);
  const leftPad = 45;
  const rightPad = 45;
  const topPad = 35;
  const bottomPad = 35;
  const usableWidth = Math.max(200, width - leftPad - rightPad);
  const usableHeight = Math.max(200, height - topPad - bottomPad);

  const nodes: PrimitiveGraphNode[] = Array.from(allNodes).map(id => {
    const { layer, layerIndex } = layerMap.get(id)!;
    const layerNodes = Array.from(layerMap.entries())
      .filter(([, v]) => v.layer === layer)
      .sort((a, b) => a[1].layerIndex - b[1].layerIndex);

    const x = leftPad + (maxLayer === 0 ? usableWidth / 2 : (layer / maxLayer) * usableWidth);
    const yStep = usableHeight / Math.max(1, layerNodes.length - 1);
    const y = topPad + (layerNodes.length === 1 ? usableHeight / 2 : layerIndex * yStep);

    const nodeType: NodeType = sourceSet.has(id)
      ? 'source'
      : sinkSet.has(id)
      ? 'sink'
      : forkSet.has(id)
      ? 'fork'
      : joinSet.has(id)
      ? 'join'
      : 'regular';

    return { id, nodeType, layer, layerIndex, x, y };
  });

  const edges: PrimitiveGraphEdge[] = (network.edges ?? []).map(([source, target]) => ({
    id: `${source}-${target}`,
    source: String(source),
    target: String(target)
  }));

  return { nodes, edges, width, height };
}
