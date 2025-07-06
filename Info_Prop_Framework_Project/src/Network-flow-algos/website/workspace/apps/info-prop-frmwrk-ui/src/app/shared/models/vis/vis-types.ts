import * as d3 from 'd3';

export interface LayoutOption {
  value: string;
  label: string;
  description: string;
}

export interface NodeHighlight {
  nodeId: number;
  type: 'source' | 'fork' | 'join' | 'diamond' | 'sink';
  color: string;
}

export interface D3Node extends d3.SimulationNodeDatum {
  id: number;
  name: string;
  type: string;
  color?: string;
}

export interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: number | D3Node;
  target: number | D3Node;
  value: number;
}

export interface VisualizationConfig {
  layout: string;
  zoomLevel: number;
  showNodeLabels: boolean;
  showEdgeLabels: boolean;
  highlightMode: string;
  highlights: NodeHighlight[];
}

export interface RenderResult {
  success: boolean;
  renderer: 'd3';
  error?: string;
}

export interface HighlightOption {
  value: string;
  label: string;
}

// D3 types are imported from d3 package
declare global {
  interface Window {
    d3: typeof d3;
  }
}