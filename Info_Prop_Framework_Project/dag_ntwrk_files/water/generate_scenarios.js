/**
 * WATER Network Scenario Generator — Case Study Edition
 *
 * Generates 4 complete "state of the world" scenarios for the WATER Bayesian network
 * (waste water treatment plant, Jensen et al. 1989). Each scenario contains:
 *   - Reachability data (node priors + link probabilities)
 *   - Capacity data (node caps + edge caps + source rates)
 *   - CPM data (time: durations + delays, cost: node costs + edge costs)
 *
 * Domain: 8 water quality variables measured at 4 time steps (15-min intervals)
 *   0: C_NI   - Nitrogen Input Concentration (influent)
 *   1: CKNI   - Kjeldahl Nitrogen Input (total organic + ammonia N)
 *   2: CBODD  - BOD at Discharge (central treatment hub)
 *   3: CKND   - Kjeldahl N at Discharge
 *   4: CNOD   - N-Oxide at Discharge (nitrification product)
 *   5: CBODN  - BOD Nitrogen (N-removal BOD)
 *   6: CKNN   - Kjeldahl N in N-Process (ammonia in nitrification)
 *   7: CNON   - N-Oxide in N-Process (nitrate production)
 *
 * Network: 32 nodes (8 vars x 4 timesteps), 66 edges (22 per layer)
 *
 * Scenarios:
 *   1. Normal Operations (Float)       — baseline dry-weather operation
 *   2. Storm Event (Float)             — acute hydraulic stress, CSO
 *   3. Nitrification Failure (Float)   — localized N-removal breakdown
 *   4. Winter Operations (Interval)    — cold weather + sensor uncertainty
 */

const fs = require('fs');
const path = require('path');

const BASE_DIR = __dirname;

// ============================================================
// EDGE DEFINITIONS (from water.EDGES)
// ============================================================
const EDGES = [
  // Layer 1→2 (t=0 → t=1)
  [1,9],[1,11],[2,10],[2,11],[2,12],[3,11],[3,13],[3,14],
  [4,12],[4,15],[5,11],[5,13],[5,16],[6,11],[6,14],[6,16],
  [7,12],[7,15],[7,16],[8,13],[8,14],[8,16],
  // Layer 2→3 (t=1 → t=2)
  [9,17],[9,19],[10,18],[10,19],[10,20],[11,19],[11,21],[11,22],
  [12,20],[12,23],[13,19],[13,21],[13,24],[14,19],[14,22],[14,24],
  [15,20],[15,23],[15,24],[16,21],[16,22],[16,24],
  // Layer 3→4 (t=2 → t=3)
  [17,25],[17,27],[18,26],[18,27],[18,28],[19,27],[19,29],[19,30],
  [20,28],[20,31],[21,27],[21,29],[21,32],[22,27],[22,30],[22,32],
  [23,28],[23,31],[23,32],[24,29],[24,30],[24,32]
];

// Variable index for a node (0-based)
function varIdx(node) { return (node - 1) % 8; }
// Time step for a node (0-based)
function timeStep(node) { return Math.floor((node - 1) / 8); }

// Classify edge type based on which variables it connects
function edgeType(src, dst) {
  const sv = varIdx(src);
  const dv = varIdx(dst);
  if (sv === dv) return 'self_temporal';
  if ((sv === 0 || sv === 1) && dv === 2) return 'input_to_bod';
  if (sv === 1 && dv === 3) return 'input_to_discharge';
  if (sv === 2 && (dv === 4 || dv === 5)) return 'bod_chain';
  if (sv === 3 && dv === 6) return 'discharge_to_process';
  if ((sv === 4 || sv === 5) && dv === 2) return 'feedback_to_bod';
  if ((sv === 4 || sv === 5 || sv === 6) && dv === 7) return 'nitrogen_chain';
  if (sv === 7 && (dv === 4 || dv === 5)) return 'reverse_nitrogen';
  if (sv === 6 && dv === 3) return 'discharge_feedback';
  return 'other';
}

// Node category for capacity/CPM parameter assignment
function getNodeCategory(node) {
  const t = timeStep(node);
  const v = varIdx(node);
  if (t === 0) return 'source';
  if (t === 3) return 'sink';
  if (v === 2) return 'hub';           // CBODD — central treatment hub
  if (v === 3 || v === 4) return 'discharge';
  return 'process';
}

// Noise functions
function noise(val, spread = 0.03, clampProb = true) {
  const noised = val + (Math.random() - 0.5) * 2 * spread;
  if (clampProb) return Math.max(0.01, Math.min(0.99, noised));
  return Math.max(0.01, noised);
}
function noiseInterval(lower, upper, spread = 0.015) {
  return {
    lower: Math.max(0.01, lower + (Math.random() - 0.5) * 2 * spread),
    upper: Math.min(upper + (Math.random() - 0.5) * 2 * spread,
           upper < 1.0 ? 0.99 : upper + spread),
    type: 'interval'
  };
}
function noiseIntervalUnbounded(lower, upper, spread) {
  return {
    lower: Math.max(0.01, lower + (Math.random() - 0.5) * 2 * spread),
    upper: upper + (Math.random() - 0.5) * 2 * spread,
    type: 'interval'
  };
}
function r(val) { return Math.round(val * 10000) / 10000; }
function rObj(obj) {
  if (typeof obj === 'number') return r(obj);
  return { lower: r(obj.lower), upper: r(obj.upper), type: 'interval' };
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ============================================================
// SCENARIO DEFINITIONS
// ============================================================

const SCENARIOS = {

  // ---- SCENARIO 1: Normal Operations (Float) ----
  'Normal Operations': {
    dataType: 'Float64',
    description: 'Typical dry-weather day. Plant operating within design parameters. Treatment effective across all stages. Moderate influent loading, strong temporal persistence.',
    reachability: {
      sourcePriors:      { 0: 0.25, 1: 0.30, 2: 0.15, 3: 0.10, 4: 0.20, 5: 0.12, 6: 0.18, 7: 0.15 },
      interiorPriorsByVar: { 0: 0.50, 1: 0.55, 2: 0.40, 3: 0.35, 4: 0.45, 5: 0.38, 6: 0.42, 7: 0.40 },
      edgeProbs: {
        self_temporal: 0.92, input_to_bod: 0.78, input_to_discharge: 0.80,
        bod_chain: 0.75, discharge_to_process: 0.72, feedback_to_bod: 0.68,
        nitrogen_chain: 0.74, reverse_nitrogen: 0.65, discharge_feedback: 0.70, other: 0.70
      }
    },
    capacity: {
      sourceRateBase: { 0: 8.0, 1: 10.0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
      nodeCapBase:    { source: 20, hub: 28, process: 22, discharge: 18, sink: 25 },
      edgeCapBase: {
        self_temporal: 18, input_to_bod: 15, input_to_discharge: 14,
        bod_chain: 16, discharge_to_process: 13, feedback_to_bod: 12,
        nitrogen_chain: 14, reverse_nitrogen: 11, discharge_feedback: 12.5, other: 13
      }
    },
    cpm: {
      nodeDurations: { source: 2.5, hub: 4.0, process: 3.0, discharge: 2.0, sink: 1.5 },
      edgeDelays: {
        self_temporal: 1.5, input_to_bod: 3.0, input_to_discharge: 2.5,
        bod_chain: 2.8, discharge_to_process: 2.2, feedback_to_bod: 2.0,
        nitrogen_chain: 2.5, reverse_nitrogen: 1.8, discharge_feedback: 2.0, other: 2.0
      },
      nodeCosts: { source: 150, hub: 280, process: 200, discharge: 120, sink: 100 },
      edgeCosts: {
        self_temporal: 45, input_to_bod: 95, input_to_discharge: 80,
        bod_chain: 90, discharge_to_process: 70, feedback_to_bod: 65,
        nitrogen_chain: 75, reverse_nitrogen: 55, discharge_feedback: 60, other: 65
      }
    }
  },

  // ---- SCENARIO 2: Storm Event (Float) ----
  'Storm Event': {
    dataType: 'Float64',
    description: 'Heavy rainfall causes combined sewer overflow. Influent flow 2.5-3x normal. Pollutant concentrations spike at input. Treatment capacity overwhelmed. Expedited processing at higher cost.',
    reachability: {
      sourcePriors:      { 0: 0.70, 1: 0.65, 2: 0.80, 3: 0.55, 4: 0.60, 5: 0.75, 6: 0.50, 7: 0.45 },
      interiorPriorsByVar: { 0: 0.72, 1: 0.70, 2: 0.75, 3: 0.60, 4: 0.65, 5: 0.70, 6: 0.58, 7: 0.55 },
      edgeProbs: {
        self_temporal: 0.85, input_to_bod: 0.90, input_to_discharge: 0.88,
        bod_chain: 0.87, discharge_to_process: 0.82, feedback_to_bod: 0.85,
        nitrogen_chain: 0.83, reverse_nitrogen: 0.78, discharge_feedback: 0.80, other: 0.80
      }
    },
    capacity: {
      sourceRateBase: { 0: 22.0, 1: 25.0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
      nodeCapBase:    { source: 16, hub: 20, process: 17, discharge: 14, sink: 19 },
      edgeCapBase: {
        self_temporal: 14, input_to_bod: 11, input_to_discharge: 10,
        bod_chain: 12, discharge_to_process: 9.5, feedback_to_bod: 8,
        nitrogen_chain: 10, reverse_nitrogen: 7.5, discharge_feedback: 9, other: 9.5
      }
    },
    cpm: {
      nodeDurations: { source: 1.5, hub: 2.5, process: 1.8, discharge: 1.2, sink: 0.8 },
      edgeDelays: {
        self_temporal: 0.8, input_to_bod: 1.8, input_to_discharge: 1.5,
        bod_chain: 1.6, discharge_to_process: 1.3, feedback_to_bod: 1.2,
        nitrogen_chain: 1.5, reverse_nitrogen: 1.0, discharge_feedback: 1.2, other: 1.2
      },
      nodeCosts: { source: 210, hub: 390, process: 280, discharge: 170, sink: 140 },
      edgeCosts: {
        self_temporal: 65, input_to_bod: 135, input_to_discharge: 115,
        bod_chain: 128, discharge_to_process: 100, feedback_to_bod: 92,
        nitrogen_chain: 108, reverse_nitrogen: 78, discharge_feedback: 85, other: 92
      }
    }
  },

  // ---- SCENARIO 3: Nitrification Failure (Float) ----
  'Nitrification Failure': {
    dataType: 'Float64',
    description: 'Biological nitrification process has failed (toxic shock / pH shift / low dissolved oxygen). Ammonia-to-nitrate conversion stops. Nitrogen pathways broken while BOD treatment continues normally. The most analytically interesting scenario — localized degradation.',
    reachability: {
      sourcePriors:      { 0: 0.30, 1: 0.35, 2: 0.18, 3: 0.40, 4: 0.12, 5: 0.15, 6: 0.55, 7: 0.10 },
      interiorPriorsByVar: { 0: 0.52, 1: 0.58, 2: 0.42, 3: 0.58, 4: 0.25, 5: 0.40, 6: 0.68, 7: 0.22 },
      edgeProbs: {
        self_temporal: 0.92, input_to_bod: 0.78, input_to_discharge: 0.82,
        bod_chain: 0.75, discharge_to_process: 0.72, feedback_to_bod: 0.68,
        nitrogen_chain: 0.35, reverse_nitrogen: 0.30, discharge_feedback: 0.72, other: 0.70
      }
    },
    capacity: {
      sourceRateBase: { 0: 8.0, 1: 10.0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
      // Nitrogen-related nodes have reduced capacity; BOD nodes unchanged
      nodeCapBase:    { source: 20, hub: 28, process: 22, discharge: 18, sink: 25 },
      // Override for nitrogen-specific nodes handled in generator
      nitrogenNodeCapOverride: { 6: 12, 7: 10 },  // CKNN, CNON nodes halved
      edgeCapBase: {
        self_temporal: 18, input_to_bod: 15, input_to_discharge: 14,
        bod_chain: 16, discharge_to_process: 13, feedback_to_bod: 12,
        nitrogen_chain: 7, reverse_nitrogen: 5.5, discharge_feedback: 12.5, other: 13
      }
    },
    cpm: {
      nodeDurations: { source: 2.5, hub: 4.0, process: 3.0, discharge: 2.0, sink: 1.5 },
      // Override for nitrogen nodes
      nitrogenDurationOverride: { 6: 5.4, 7: 5.0 },  // 80% longer
      edgeDelays: {
        self_temporal: 1.5, input_to_bod: 3.0, input_to_discharge: 2.5,
        bod_chain: 2.8, discharge_to_process: 2.2, feedback_to_bod: 2.0,
        nitrogen_chain: 4.5, reverse_nitrogen: 3.6, discharge_feedback: 2.0, other: 2.0
      },
      nodeCosts: { source: 150, hub: 280, process: 200, discharge: 120, sink: 100 },
      nitrogenCostOverride: { 6: 320, 7: 260 },  // 60% higher
      edgeCosts: {
        self_temporal: 45, input_to_bod: 95, input_to_discharge: 80,
        bod_chain: 90, discharge_to_process: 70, feedback_to_bod: 65,
        nitrogen_chain: 112, reverse_nitrogen: 82, discharge_feedback: 60, other: 65
      }
    }
  },

  // ---- SCENARIO 4: Winter Operations (Interval) ----
  'Winter Operations': {
    dataType: 'Interval',
    description: 'Cold weather (<5C water temp) degrades all biological processes, especially nitrification. Sensors suffer cold-weather drift and ice buildup. All values are intervals reflecting both degraded performance and measurement uncertainty. Nitrogen pathways have widest bounds (most temperature-sensitive).',
    reachability: {
      sourcePriors: {
        0: [0.28, 0.42], 1: [0.32, 0.48], 2: [0.20, 0.35], 3: [0.18, 0.33],
        4: [0.12, 0.28], 5: [0.18, 0.34], 6: [0.25, 0.42], 7: [0.14, 0.30]
      },
      interiorPriorsByVar: {
        0: [0.48, 0.66], 1: [0.50, 0.68], 2: [0.42, 0.60], 3: [0.36, 0.54],
        4: [0.30, 0.50], 5: [0.38, 0.56], 6: [0.45, 0.64], 7: [0.34, 0.52]
      },
      edgeProbs: {
        self_temporal: [0.84, 0.92], input_to_bod: [0.68, 0.82], input_to_discharge: [0.70, 0.84],
        bod_chain: [0.58, 0.74], discharge_to_process: [0.54, 0.70], feedback_to_bod: [0.56, 0.72],
        nitrogen_chain: [0.42, 0.62], reverse_nitrogen: [0.38, 0.58], discharge_feedback: [0.50, 0.68],
        other: [0.52, 0.70]
      }
    },
    capacity: {
      sourceRateBase: { 0: [6.5, 9.5], 1: [8.0, 12.0], 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
      nodeCapBase: {
        source: [17, 23], hub: [24, 30], process: [19, 25], discharge: [15, 21], sink: [21, 27]
      },
      edgeCapBase: {
        self_temporal: [15, 20], input_to_bod: [12, 17], input_to_discharge: [11, 16],
        bod_chain: [13, 18], discharge_to_process: [10, 15], feedback_to_bod: [9, 14],
        nitrogen_chain: [10, 16], reverse_nitrogen: [8, 13], discharge_feedback: [10, 14],
        other: [10, 15]
      }
    },
    cpm: {
      nodeDurations: {
        source: [2.0, 3.5], hub: [3.5, 5.5], process: [2.5, 4.0], discharge: [1.5, 3.0], sink: [1.0, 2.5]
      },
      edgeDelays: {
        self_temporal: [1.2, 2.2], input_to_bod: [2.5, 4.0], input_to_discharge: [2.0, 3.5],
        bod_chain: [2.2, 3.8], discharge_to_process: [1.8, 3.0], feedback_to_bod: [1.5, 2.8],
        nitrogen_chain: [2.0, 3.5], reverse_nitrogen: [1.4, 2.8], discharge_feedback: [1.6, 2.8],
        other: [1.8, 3.0]
      },
      nodeCosts: {
        source: [140, 200], hub: [260, 360], process: [190, 270], discharge: [110, 175], sink: [90, 150]
      },
      edgeCosts: {
        self_temporal: [38, 62], input_to_bod: [80, 125], input_to_discharge: [68, 108],
        bod_chain: [76, 118], discharge_to_process: [58, 95], feedback_to_bod: [52, 88],
        nitrogen_chain: [60, 100], reverse_nitrogen: [44, 75], discharge_feedback: [48, 82],
        other: [52, 85]
      }
    }
  }
};

// ============================================================
// FILE GENERATION FUNCTIONS
// ============================================================

function generateReachability(scenarioName, config) {
  const dir = path.join(BASE_DIR, scenarioName);
  ensureDir(dir);
  const isInterval = config.dataType === 'Interval';
  const reach = config.reachability;

  // Node priors
  const nodes = {};
  for (let n = 1; n <= 32; n++) {
    const t = timeStep(n);
    const v = varIdx(n);
    const base = t === 0 ? reach.sourcePriors[v] : reach.interiorPriorsByVar[v];
    if (isInterval) {
      nodes[String(n)] = rObj(noiseInterval(base[0], base[1], 0.015));
    } else {
      nodes[String(n)] = r(noise(base, 0.02));
    }
  }

  const nodepriors = {
    nodes,
    data_type: isInterval ? 'Interval' : 'Float64',
    serialization: 'compact',
    description: `Node prior probabilities for WATER network - ${scenarioName}. ${config.description}`
  };

  // Link probabilities
  const links = {};
  for (const [src, dst] of EDGES) {
    const et = edgeType(src, dst);
    const base = reach.edgeProbs[et] || reach.edgeProbs.other;
    if (isInterval) {
      links[`(${src},${dst})`] = rObj(noiseInterval(base[0], base[1], 0.015));
    } else {
      links[`(${src},${dst})`] = r(noise(base, 0.02));
    }
  }

  const linkprobs = {
    links,
    data_type: isInterval ? 'Interval' : 'Float64',
    serialization: 'compact',
    description: `Link/edge probabilities for WATER network - ${scenarioName}. ${config.description}`
  };

  fs.writeFileSync(path.join(dir, 'water-nodepriors.json'), JSON.stringify(nodepriors, null, 2));
  fs.writeFileSync(path.join(dir, 'water-linkprobabilities.json'), JSON.stringify(linkprobs, null, 2));
}

function generateCapacity(scenarioName, config) {
  const dir = path.join(BASE_DIR, scenarioName);
  ensureDir(dir);
  const isInterval = config.dataType === 'Interval';
  const cap = config.capacity;

  const nodesCap = {};
  const sourceRates = {};
  const edgesCap = {};

  for (let n = 1; n <= 32; n++) {
    const cat = getNodeCategory(n);
    const v = varIdx(n);
    const baseCap = cap.nodeCapBase[cat];

    // Check for nitrogen node override (Nitrification Failure scenario)
    const nitrogenOverride = cap.nitrogenNodeCapOverride && cap.nitrogenNodeCapOverride[v];
    const effectiveCap = nitrogenOverride !== undefined && timeStep(n) > 0 ? nitrogenOverride : baseCap;

    if (isInterval) {
      const base = Array.isArray(effectiveCap) ? effectiveCap : [effectiveCap, effectiveCap];
      nodesCap[String(n)] = rObj(noiseIntervalUnbounded(base[0], base[1], base[0] * 0.05));
    } else {
      nodesCap[String(n)] = r(noise(effectiveCap, effectiveCap * 0.05, false));
    }

    // Source rates
    if (timeStep(n) === 0) {
      const rateBase = cap.sourceRateBase[v];
      if (isInterval) {
        if (Array.isArray(rateBase) && rateBase[0] > 0) {
          sourceRates[String(n)] = rObj(noiseIntervalUnbounded(rateBase[0], rateBase[1], 0.5));
        } else if (typeof rateBase === 'number' && rateBase > 0) {
          sourceRates[String(n)] = rObj(noiseIntervalUnbounded(rateBase * 0.8, rateBase * 1.2, 0.3));
        }
      } else {
        if (rateBase > 0) {
          sourceRates[String(n)] = r(noise(rateBase, 0.5, false));
        }
      }
    }
  }

  for (const [src, dst] of EDGES) {
    const et = edgeType(src, dst);
    const baseCap = cap.edgeCapBase[et] || cap.edgeCapBase.other;
    if (isInterval) {
      const base = Array.isArray(baseCap) ? baseCap : [baseCap, baseCap];
      edgesCap[`(${src},${dst})`] = rObj(noiseIntervalUnbounded(base[0], base[1], base[0] * 0.05));
    } else {
      edgesCap[`(${src},${dst})`] = r(noise(baseCap, baseCap * 0.05, false));
    }
  }

  const capacities = {
    network_type: 'capacity_flow',
    data_type: isInterval ? 'Interval' : 'Float64',
    capacities: { nodes: nodesCap, source_rates: sourceRates, edges: edgesCap },
    description: `Capacity analysis inputs for WATER network - ${scenarioName}. ${config.description}`,
    generation_info: { total_nodes: 32, total_edges: 66, source_nodes_count: 8 }
  };

  fs.writeFileSync(path.join(dir, 'water-capacities.json'), JSON.stringify(capacities, null, 2));
}

function generateCpm(scenarioName, config) {
  const dir = path.join(BASE_DIR, scenarioName);
  ensureDir(dir);
  const isInterval = config.dataType === 'Interval';
  const cpmCfg = config.cpm;

  const nodeDurations = {};
  const edgeDelays = {};
  const nodeCosts = {};
  const edgeCosts = {};

  for (let n = 1; n <= 32; n++) {
    const cat = getNodeCategory(n);
    const v = varIdx(n);

    // Duration — check for nitrogen override
    const durOverride = cpmCfg.nitrogenDurationOverride && cpmCfg.nitrogenDurationOverride[v];
    const baseDur = durOverride !== undefined && timeStep(n) > 0 ? durOverride : cpmCfg.nodeDurations[cat];
    if (isInterval) {
      const base = Array.isArray(baseDur) ? baseDur : [baseDur, baseDur];
      nodeDurations[String(n)] = rObj(noiseIntervalUnbounded(base[0], base[1], base[0] * 0.08));
    } else {
      nodeDurations[String(n)] = r(noise(baseDur, baseDur * 0.08, false));
    }

    // Cost — check for nitrogen override
    const costOverride = cpmCfg.nitrogenCostOverride && cpmCfg.nitrogenCostOverride[v];
    const baseCost = costOverride !== undefined && timeStep(n) > 0 ? costOverride : cpmCfg.nodeCosts[cat];
    if (isInterval) {
      const base = Array.isArray(baseCost) ? baseCost : [baseCost, baseCost];
      nodeCosts[String(n)] = rObj(noiseIntervalUnbounded(base[0], base[1], base[0] * 0.06));
    } else {
      nodeCosts[String(n)] = r(noise(baseCost, baseCost * 0.06, false));
    }
  }

  for (const [src, dst] of EDGES) {
    const et = edgeType(src, dst);

    const baseDelay = cpmCfg.edgeDelays[et] || cpmCfg.edgeDelays.other;
    if (isInterval) {
      const base = Array.isArray(baseDelay) ? baseDelay : [baseDelay, baseDelay];
      edgeDelays[`(${src},${dst})`] = rObj(noiseIntervalUnbounded(base[0], base[1], base[0] * 0.08));
    } else {
      edgeDelays[`(${src},${dst})`] = r(noise(baseDelay, baseDelay * 0.08, false));
    }

    const baseCost = cpmCfg.edgeCosts[et] || cpmCfg.edgeCosts.other;
    if (isInterval) {
      const base = Array.isArray(baseCost) ? baseCost : [baseCost, baseCost];
      edgeCosts[`(${src},${dst})`] = rObj(noiseIntervalUnbounded(base[0], base[1], base[0] * 0.06));
    } else {
      edgeCosts[`(${src},${dst})`] = r(noise(baseCost, baseCost * 0.06, false));
    }
  }

  const cpmInputs = {
    time_analysis: {
      edge_delays: edgeDelays,
      combination_function: 'max_combination',
      initial_time: isInterval ? { lower: 0.0, upper: 0.0, type: 'interval' } : 0.0,
      analysis_type: 'longest_path_time',
      propagation_function: 'additive_propagation',
      node_durations: nodeDurations
    },
    network_type: 'critical_path',
    data_type: isInterval ? 'Interval' : 'Float64',
    cost_analysis: {
      initial_cost: isInterval ? { lower: 0.0, upper: 0.0, type: 'interval' } : 0.0,
      combination_function: 'max_combination',
      node_costs: nodeCosts,
      analysis_type: 'total_project_cost',
      propagation_function: 'additive_propagation',
      edge_costs: edgeCosts
    },
    description: `Critical Path Module inputs for WATER network - ${scenarioName}. ${config.description}`,
    generation_info: { total_nodes: 32, total_edges: 66 }
  };

  fs.writeFileSync(path.join(dir, 'water-cpm-inputs.json'), JSON.stringify(cpmInputs, null, 2));
}

// ============================================================
// MAIN EXECUTION
// ============================================================

console.log('=== WATER Network Scenario Generator (Case Study Edition) ===\n');

for (const [name, config] of Object.entries(SCENARIOS)) {
  console.log(`Generating: ${name} (${config.dataType})`);
  generateReachability(name, config);
  console.log(`  - Reachability (nodepriors + linkprobabilities)`);
  generateCapacity(name, config);
  console.log(`  - Capacity (nodes + edges + source_rates)`);
  generateCpm(name, config);
  console.log(`  - CPM (time: durations + delays, cost: node_costs + edge_costs)`);
  console.log();
}

console.log('=== Done! Generated 4 scenarios (12 files) ===');
console.log('\nScenario summary:');
console.log('  1. Normal Operations      (Float)    — baseline');
console.log('  2. Storm Event            (Float)    — acute hydraulic stress');
console.log('  3. Nitrification Failure  (Float)    — localized N-removal breakdown');
console.log('  4. Winter Operations      (Interval) — cold weather + sensor uncertainty');
console.log('\nEach scenario contains: reachability + capacity + CPM = complete profile');
