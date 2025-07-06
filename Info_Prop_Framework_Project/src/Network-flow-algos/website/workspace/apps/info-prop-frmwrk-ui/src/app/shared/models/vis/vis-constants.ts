import { LayoutOption, HighlightOption } from "./vis-types";

interface ForceConfig {
  linkDistance: number;
  chargeStrength: number;
  collisionRadius: number;
}

interface NodeTypeColors {
  source: string;
  fork: string;
  join: string;
  regular: string;
  diamond: string;
  [key: string]: string;
}

interface ForceConfigs {
  dot: ForceConfig;
  neato: ForceConfig;
  fdp: ForceConfig;
  circo: ForceConfig;
  twopi: ForceConfig;
  sfdp: ForceConfig;
  default: ForceConfig;
  [key: string]: ForceConfig;
}

export const VISUALIZATION_CONSTANTS = {
  DEFAULT_WIDTH: 800,
  DEFAULT_HEIGHT: 600,
  NODE_RADIUS: 12,
  
  COLORS: {
    NODE_TYPES: {
      source: '#4CAF50',
      fork: '#FF9800',
      join: '#2196F3',
      regular: '#9E9E9E',
      diamond: '#E91E63'
    } as NodeTypeColors,
    EDGE: '#999',
    BACKGROUND: '#fafafa'
  },

  FORCE_CONFIGS: {
    dot: {
      linkDistance: 80,
      chargeStrength: -200,
      collisionRadius: 20
    },
    neato: {
      linkDistance: 100,
      chargeStrength: -300,
      collisionRadius: 25
    },
    fdp: {
      linkDistance: 100,
      chargeStrength: -300,
      collisionRadius: 25
    },
    circo: {
      linkDistance: 80,
      chargeStrength: -100,
      collisionRadius: 30
    },
    twopi: {
      linkDistance: 90,
      chargeStrength: -150,
      collisionRadius: 25
    },
    sfdp: {
      linkDistance: 120,
      chargeStrength: -400,
      collisionRadius: 30
    },
    default: {
      linkDistance: 80,
      chargeStrength: -200,
      collisionRadius: 20
    }
  } as ForceConfigs
};

export const LAYOUT_OPTIONS: LayoutOption[] = [
  {
    value: 'dot',
    label: 'Hierarchical (DOT)',
    description: 'Top-down hierarchical layout, best for DAGs'
  },
  {
    value: 'neato',
    label: 'Spring Model (Neato)',
    description: 'Force-directed layout using spring model'
  },
  {
    value: 'fdp',
    label: 'Force-Directed (FDP)',
    description: 'Force-directed layout with simulated annealing'
  },
  {
    value: 'circo',
    label: 'Circular (Circo)',
    description: 'Circular layout, good for small graphs'
  },
  {
    value: 'twopi',
    label: 'Radial (Twopi)',
    description: 'Radial layout with one node at center'
  },
  {
    value: 'sfdp',
    label: 'Large Graph (SFDP)',
    description: 'Scalable force-directed layout for large graphs'
  }
];

export const HIGHLIGHT_OPTIONS: HighlightOption[] = [
  { value: 'none', label: 'No Highlighting' },
  { value: 'node-types', label: 'Node Types' },
  { value: 'iteration-levels', label: 'Iteration Levels' },
  { value: 'diamond-structures', label: 'Diamond Structures' },
  { value: 'critical-path', label: 'Critical Paths' }
];

export const ZOOM_CONFIG = {
  MIN: 25,
  MAX: 200,
  STEP: 25,
  DEFAULT: 100
};