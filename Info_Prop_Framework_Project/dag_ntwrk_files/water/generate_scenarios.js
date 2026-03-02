/**
 * WATER Network Scenario Generator
 *
 * Generates realistic multi-scenario data for the WATER Bayesian network
 * (waste water treatment plant, Jensen et al. 1989) for use as a case study
 * demonstrating the Information Propagation Framework.
 *
 * Domain: 8 water quality variables measured at 4 time steps (15-min intervals)
 *   0: C_NI   - Nitrogen Input Concentration
 *   1: CKNI   - Kjeldahl Nitrogen Input
 *   2: CBODD  - BOD at Discharge (central hub)
 *   3: CKND   - Kjeldahl N at Discharge
 *   4: CNOD   - N-Oxide at Discharge
 *   5: CBODN  - BOD Nitrogen (N-removal process)
 *   6: CKNN   - Kjeldahl N in N-Process
 *   7: CNON   - N-Oxide in N-Process
 *
 * Network: 32 nodes (8 vars x 4 timesteps), 66 edges (22 per layer)
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

// Classify edge type
function edgeType(src, dst) {
  const sv = varIdx(src);
  const dv = varIdx(dst);
  if (sv === dv) return 'self_temporal';
  // Input variables affecting BOD discharge
  if ((sv === 0 || sv === 1) && dv === 2) return 'input_to_bod';
  // Input to discharge
  if (sv === 1 && dv === 3) return 'input_to_discharge';
  // BOD chain
  if (sv === 2 && (dv === 4 || dv === 5)) return 'bod_chain';
  // Discharge to process
  if (sv === 3 && dv === 6) return 'discharge_to_process';
  // Feedback to BOD
  if ((sv === 4 || sv === 5) && dv === 2) return 'feedback_to_bod';
  // Nitrogen chain
  if ((sv === 4 || sv === 5 || sv === 6) && dv === 7) return 'nitrogen_chain';
  // Reverse nitrogen
  if (sv === 7 && (dv === 4 || dv === 5)) return 'reverse_nitrogen';
  // Discharge feedback
  if (sv === 6 && dv === 3) return 'discharge_feedback';
  return 'other';
}

// Add noise to a value (bounded 0-1 for probabilities, unbounded for other values)
function noise(val, spread = 0.03, clampProb = true) {
  const noised = val + (Math.random() - 0.5) * 2 * spread;
  if (clampProb) return Math.max(0.01, Math.min(0.99, noised));
  return Math.max(0.01, noised);
}

// Round to 4 decimal places
function r(val) { return Math.round(val * 10000) / 10000; }

// ============================================================
// SCENARIO DEFINITIONS
// ============================================================

// --- FLOAT REACHABILITY SCENARIOS ---

const floatScenarios = {
  'Normal Operations': {
    description: 'Waste water treatment plant operating normally. Typical influent concentrations, treatment efficiency high. Temporal correlations strong, cross-variable propagation moderate.',
    sourcePriors: {
      0: 0.25,  // C_NI: moderate nitrogen input
      1: 0.30,  // CKNI: moderate Kjeldahl nitrogen
      2: 0.15,  // CBODD: low BOD at discharge (treatment effective)
      3: 0.10,  // CKND: low Kjeldahl N discharge
      4: 0.20,  // CNOD: moderate N-oxide discharge
      5: 0.12,  // CBODN: low BOD nitrogen
      6: 0.18,  // CKNN: moderate Kjeldahl N process
      7: 0.15   // CNON: moderate N-oxide process
    },
    // Interior priors by variable type — baseline state probability at each measurement point
    interiorPriorsByVar: {
      0: 0.50,  // C_NI: nitrogen persists through system
      1: 0.55,  // CKNI: Kjeldahl N persists
      2: 0.40,  // CBODD: BOD reduced by treatment
      3: 0.35,  // CKND: discharge N reduced
      4: 0.45,  // CNOD: N-oxide moderate persistence
      5: 0.38,  // CBODN: BOD-N reduced by treatment
      6: 0.42,  // CKNN: Kjeldahl in process
      7: 0.40   // CNON: N-oxide in process
    },
    edgeProbs: {
      self_temporal: 0.92,
      input_to_bod: 0.78,
      input_to_discharge: 0.80,
      bod_chain: 0.75,
      discharge_to_process: 0.72,
      feedback_to_bod: 0.68,
      nitrogen_chain: 0.74,
      reverse_nitrogen: 0.65,
      discharge_feedback: 0.70,
      other: 0.70
    }
  },
  'Storm Event': {
    description: 'Heavy rainfall causing combined sewer overflow. Pollutant concentrations spike, treatment capacity stressed. Strong correlations as contaminants propagate rapidly through the system.',
    sourcePriors: {
      0: 0.70,  // C_NI: high nitrogen input (runoff)
      1: 0.65,  // CKNI: high Kjeldahl nitrogen
      2: 0.80,  // CBODD: very high BOD (organic loading surge)
      3: 0.55,  // CKND: elevated discharge
      4: 0.60,  // CNOD: elevated N-oxide
      5: 0.75,  // CBODN: high BOD in N-removal
      6: 0.50,  // CKNN: elevated Kjeldahl
      7: 0.45   // CNON: elevated N-oxide process
    },
    // Storm overwhelms treatment — interior nodes have high baseline
    interiorPriorsByVar: {
      0: 0.72,  // C_NI: nitrogen surges through
      1: 0.70,  // CKNI: Kjeldahl N elevated
      2: 0.75,  // CBODD: BOD overwhelms treatment
      3: 0.60,  // CKND: discharge elevated
      4: 0.65,  // CNOD: N-oxide elevated
      5: 0.70,  // CBODN: BOD-N elevated
      6: 0.58,  // CKNN: Kjeldahl in process elevated
      7: 0.55   // CNON: N-oxide in process elevated
    },
    edgeProbs: {
      self_temporal: 0.88,
      input_to_bod: 0.90,
      input_to_discharge: 0.85,
      bod_chain: 0.87,
      discharge_to_process: 0.82,
      feedback_to_bod: 0.85,
      nitrogen_chain: 0.83,
      reverse_nitrogen: 0.78,
      discharge_feedback: 0.80,
      other: 0.80
    }
  }
};

// --- INTERVAL REACHABILITY SCENARIOS ---

const intervalScenarios = {
  'Sensor Uncertainty': {
    description: 'Sensors approaching end of calibration cycle. Measurements have significant uncertainty bounds. Plant operating near normal but sensor readings are imprecise.',
    sourcePriors: {
      0: { lower: 0.18, upper: 0.35 },  // C_NI: wide uncertainty
      1: { lower: 0.22, upper: 0.40 },  // CKNI
      2: { lower: 0.08, upper: 0.25 },  // CBODD
      3: { lower: 0.05, upper: 0.20 },  // CKND
      4: { lower: 0.12, upper: 0.30 },  // CNOD
      5: { lower: 0.06, upper: 0.22 },  // CBODN
      6: { lower: 0.10, upper: 0.28 },  // CKNN
      7: { lower: 0.08, upper: 0.25 }   // CNON
    },
    // Interior priors by variable type — uncertain baseline measurements
    interiorPriorsByVar: {
      0: { lower: 0.40, upper: 0.60 },  // C_NI
      1: { lower: 0.42, upper: 0.62 },  // CKNI
      2: { lower: 0.30, upper: 0.52 },  // CBODD
      3: { lower: 0.25, upper: 0.48 },  // CKND
      4: { lower: 0.35, upper: 0.55 },  // CNOD
      5: { lower: 0.28, upper: 0.50 },  // CBODN
      6: { lower: 0.32, upper: 0.52 },  // CKNN
      7: { lower: 0.30, upper: 0.50 }   // CNON
    },
    edgeProbs: {
      self_temporal:      { lower: 0.85, upper: 0.96 },
      input_to_bod:       { lower: 0.65, upper: 0.88 },
      input_to_discharge: { lower: 0.68, upper: 0.90 },
      bod_chain:          { lower: 0.62, upper: 0.85 },
      discharge_to_process: { lower: 0.58, upper: 0.82 },
      feedback_to_bod:    { lower: 0.52, upper: 0.78 },
      nitrogen_chain:     { lower: 0.60, upper: 0.84 },
      reverse_nitrogen:   { lower: 0.50, upper: 0.76 },
      discharge_feedback: { lower: 0.55, upper: 0.80 },
      other:              { lower: 0.55, upper: 0.80 }
    }
  },
  'Winter Operations': {
    description: 'Cold weather (< 5 deg C) reduces biological treatment efficiency. Nitrification slows significantly. Higher residual concentrations expected. Intervals reflect temperature-dependent uncertainty.',
    sourcePriors: {
      0: { lower: 0.30, upper: 0.45 },  // C_NI: elevated nitrogen (slower breakdown)
      1: { lower: 0.35, upper: 0.50 },  // CKNI: elevated
      2: { lower: 0.25, upper: 0.40 },  // CBODD: higher discharge BOD
      3: { lower: 0.20, upper: 0.35 },  // CKND: higher discharge
      4: { lower: 0.15, upper: 0.32 },  // CNOD: nitrification impaired
      5: { lower: 0.22, upper: 0.38 },  // CBODN: elevated
      6: { lower: 0.28, upper: 0.42 },  // CKNN: elevated Kjeldahl
      7: { lower: 0.18, upper: 0.35 }   // CNON: reduced NOx production
    },
    // Winter: biological treatment impaired, higher residual concentrations
    interiorPriorsByVar: {
      0: { lower: 0.50, upper: 0.68 },  // C_NI: elevated nitrogen
      1: { lower: 0.52, upper: 0.70 },  // CKNI: elevated
      2: { lower: 0.45, upper: 0.62 },  // CBODD: treatment less effective
      3: { lower: 0.38, upper: 0.55 },  // CKND: higher discharge
      4: { lower: 0.35, upper: 0.52 },  // CNOD: nitrification impaired
      5: { lower: 0.42, upper: 0.58 },  // CBODN: elevated
      6: { lower: 0.48, upper: 0.65 },  // CKNN: Kjeldahl accumulates
      7: { lower: 0.38, upper: 0.55 }   // CNON: reduced conversion
    },
    edgeProbs: {
      self_temporal:      { lower: 0.82, upper: 0.90 },
      input_to_bod:       { lower: 0.70, upper: 0.82 },
      input_to_discharge: { lower: 0.72, upper: 0.85 },
      bod_chain:          { lower: 0.55, upper: 0.70 },
      discharge_to_process: { lower: 0.50, upper: 0.68 },
      feedback_to_bod:    { lower: 0.60, upper: 0.75 },
      nitrogen_chain:     { lower: 0.45, upper: 0.62 },
      reverse_nitrogen:   { lower: 0.42, upper: 0.60 },
      discharge_feedback: { lower: 0.48, upper: 0.65 },
      other:              { lower: 0.50, upper: 0.68 }
    }
  }
};

// --- PBOX REACHABILITY SCENARIOS ---

const pboxScenarios = {
  'Equipment Degradation': {
    description: 'Aging infrastructure with several components running below specification. Moderate degradation in propagation efficiency. Represents a plant 15-20 years into service life without major renovation.',
    sourcePriors: {
      0: 0.35,  // C_NI: slightly elevated
      1: 0.38,  // CKNI: slightly elevated
      2: 0.30,  // CBODD: somewhat elevated discharge
      3: 0.25,  // CKND
      4: 0.28,  // CNOD
      5: 0.32,  // CBODN
      6: 0.30,  // CKNN
      7: 0.26   // CNON
    },
    // Aging equipment — moderate residual concentrations at all points
    interiorPriorsByVar: {
      0: 0.55,  // C_NI
      1: 0.58,  // CKNI
      2: 0.48,  // CBODD
      3: 0.42,  // CKND
      4: 0.50,  // CNOD
      5: 0.45,  // CBODN
      6: 0.48,  // CKNN
      7: 0.44   // CNON
    },
    // Simpler/higher edge probs for faster pbox computation
    edgeProbs: {
      self_temporal: 0.90,
      input_to_bod: 0.82,
      input_to_discharge: 0.84,
      bod_chain: 0.80,
      discharge_to_process: 0.78,
      feedback_to_bod: 0.76,
      nitrogen_chain: 0.80,
      reverse_nitrogen: 0.74,
      discharge_feedback: 0.76,
      other: 0.78
    }
  },
  'Emergency Response': {
    description: 'Major equipment failure requiring emergency operations. Primary clarifier offline, secondary treatment at partial capacity. Significant degradation across all process pathways. Represents worst-case operational scenario.',
    sourcePriors: {
      0: 0.55,  // C_NI: high (bypassing primary treatment)
      1: 0.50,  // CKNI: high
      2: 0.65,  // CBODD: very high discharge
      3: 0.45,  // CKND
      4: 0.40,  // CNOD
      5: 0.58,  // CBODN
      6: 0.42,  // CKNN
      7: 0.38   // CNON
    },
    // Emergency — high residual concentrations, treatment barely functioning
    interiorPriorsByVar: {
      0: 0.68,  // C_NI
      1: 0.65,  // CKNI
      2: 0.72,  // CBODD: BOD very high
      3: 0.58,  // CKND
      4: 0.62,  // CNOD
      5: 0.68,  // CBODN
      6: 0.55,  // CKNN
      7: 0.52   // CNON
    },
    // Simpler/higher edge probs for faster pbox computation
    edgeProbs: {
      self_temporal: 0.85,
      input_to_bod: 0.78,
      input_to_discharge: 0.80,
      bod_chain: 0.75,
      discharge_to_process: 0.72,
      feedback_to_bod: 0.74,
      nitrogen_chain: 0.76,
      reverse_nitrogen: 0.70,
      discharge_feedback: 0.72,
      other: 0.74
    }
  }
};

// --- CAPACITY SCENARIOS ---

const capacityScenarios = {
  'Normal Flow': {
    description: 'Typical dry weather daily flow. Treatment plant operating within design capacity. All nodes well within limits.',
    sourceRateBase: {
      0: 8.0,   // C_NI: moderate nitrogen input rate
      1: 10.0,  // CKNI: moderate Kjeldahl nitrogen
      2: 0.0,   // CBODD: not a source
      3: 0.0,   // CKND
      4: 0.0,   // CNOD
      5: 0.0,   // CBODN
      6: 0.0,   // CKNN
      7: 0.0    // CNON
    },
    nodeCapBase: {
      source: 20.0,     // source nodes
      hub: 28.0,        // CBODD nodes (high-connectivity hubs)
      process: 22.0,    // process nodes
      discharge: 18.0,  // discharge measurement nodes
      sink: 25.0        // final measurement nodes
    },
    edgeCapBase: {
      self_temporal: 18.0,
      input_to_bod: 15.0,
      input_to_discharge: 14.0,
      bod_chain: 16.0,
      discharge_to_process: 13.0,
      feedback_to_bod: 12.0,
      nitrogen_chain: 14.0,
      reverse_nitrogen: 11.0,
      discharge_feedback: 12.5,
      other: 13.0
    }
  },
  'Peak Hour Load': {
    description: 'Peak demand period (morning flush, 7-9 AM equivalent). Flow rates 1.5x normal. Some bottlenecks appearing at CBODD hub nodes. Represents typical daily peak stress.',
    sourceRateBase: {
      0: 14.0,   // C_NI: elevated
      1: 16.5,   // CKNI: elevated
      2: 0.0,
      3: 0.0,
      4: 0.0,
      5: 0.0,
      6: 0.0,
      7: 0.0
    },
    nodeCapBase: {
      source: 18.0,     // slightly tighter
      hub: 24.0,        // CBODD nodes stressed
      process: 20.0,
      discharge: 16.0,
      sink: 22.0
    },
    edgeCapBase: {
      self_temporal: 16.0,
      input_to_bod: 13.5,
      input_to_discharge: 12.0,
      bod_chain: 14.0,
      discharge_to_process: 11.5,
      feedback_to_bod: 10.0,
      nitrogen_chain: 12.0,
      reverse_nitrogen: 9.5,
      discharge_feedback: 11.0,
      other: 11.5
    }
  },
  'Storm Surge': {
    description: 'Combined sewer overflow during heavy rainfall. Flow rates 2.5-3x normal. Treatment plant at hydraulic capacity. Severe bottlenecks at hub nodes. Some bypass flow necessary.',
    sourceRateBase: {
      0: 22.0,   // C_NI: very high
      1: 25.0,   // CKNI: very high
      2: 0.0,
      3: 0.0,
      4: 0.0,
      5: 0.0,
      6: 0.0,
      7: 0.0
    },
    nodeCapBase: {
      source: 16.0,     // infrastructure limits
      hub: 20.0,        // CBODD severely constrained
      process: 17.0,
      discharge: 14.0,
      sink: 19.0
    },
    edgeCapBase: {
      self_temporal: 14.0,
      input_to_bod: 11.0,
      input_to_discharge: 10.0,
      bod_chain: 12.0,
      discharge_to_process: 9.5,
      feedback_to_bod: 8.0,
      nitrogen_chain: 10.0,
      reverse_nitrogen: 7.5,
      discharge_feedback: 9.0,
      other: 9.5
    }
  }
};

// --- CPM SCENARIOS ---

const cpmScenarios = {
  'Standard Treatment': {
    description: 'Normal treatment cycle with standard processing times and costs. All processes running at design specifications. Represents baseline operational scheduling.',
    nodeDurations: {
      source: 2.5,     // initial sampling/measurement time
      hub: 4.0,        // CBODD nodes: longer processing (central treatment)
      process: 3.0,    // intermediate processing
      discharge: 2.0,  // discharge measurement
      sink: 1.5        // final measurement
    },
    edgeDelays: {
      self_temporal: 1.5,
      input_to_bod: 3.0,
      input_to_discharge: 2.5,
      bod_chain: 2.8,
      discharge_to_process: 2.2,
      feedback_to_bod: 2.0,
      nitrogen_chain: 2.5,
      reverse_nitrogen: 1.8,
      discharge_feedback: 2.0,
      other: 2.0
    },
    nodeCosts: {
      source: 150,
      hub: 280,
      process: 200,
      discharge: 120,
      sink: 100
    },
    edgeCosts: {
      self_temporal: 45,
      input_to_bod: 95,
      input_to_discharge: 80,
      bod_chain: 90,
      discharge_to_process: 70,
      feedback_to_bod: 65,
      nitrogen_chain: 75,
      reverse_nitrogen: 55,
      discharge_feedback: 60,
      other: 65
    }
  },
  'Expedited Processing': {
    description: 'Rushed treatment cycle to handle surge capacity. Reduced residence times, increased chemical dosing. Faster but 40% more expensive. Risk of reduced treatment quality.',
    nodeDurations: {
      source: 1.5,
      hub: 2.5,
      process: 1.8,
      discharge: 1.2,
      sink: 0.8
    },
    edgeDelays: {
      self_temporal: 0.8,
      input_to_bod: 1.8,
      input_to_discharge: 1.5,
      bod_chain: 1.6,
      discharge_to_process: 1.3,
      feedback_to_bod: 1.2,
      nitrogen_chain: 1.5,
      reverse_nitrogen: 1.0,
      discharge_feedback: 1.2,
      other: 1.2
    },
    nodeCosts: {
      source: 195,
      hub: 390,
      process: 280,
      discharge: 170,
      sink: 140
    },
    edgeCosts: {
      self_temporal: 65,
      input_to_bod: 135,
      input_to_discharge: 115,
      bod_chain: 128,
      discharge_to_process: 100,
      feedback_to_bod: 92,
      nitrogen_chain: 108,
      reverse_nitrogen: 78,
      discharge_feedback: 85,
      other: 92
    }
  },
  'Enhanced Treatment': {
    description: 'Extended treatment for tighter discharge limits (e.g., nutrient-sensitive receiving waters). Longer residence times, additional treatment stages. Slowest but highest quality. 80% more expensive than standard.',
    nodeDurations: {
      source: 3.5,
      hub: 6.5,
      process: 5.0,
      discharge: 3.0,
      sink: 2.0
    },
    edgeDelays: {
      self_temporal: 2.5,
      input_to_bod: 5.0,
      input_to_discharge: 4.2,
      bod_chain: 4.8,
      discharge_to_process: 3.8,
      feedback_to_bod: 3.5,
      nitrogen_chain: 4.2,
      reverse_nitrogen: 3.0,
      discharge_feedback: 3.5,
      other: 3.5
    },
    nodeCosts: {
      source: 270,
      hub: 500,
      process: 360,
      discharge: 215,
      sink: 180
    },
    edgeCosts: {
      self_temporal: 82,
      input_to_bod: 172,
      input_to_discharge: 145,
      bod_chain: 162,
      discharge_to_process: 128,
      feedback_to_bod: 118,
      nitrogen_chain: 136,
      reverse_nitrogen: 100,
      discharge_feedback: 108,
      other: 118
    }
  }
};

// ============================================================
// FILE GENERATION FUNCTIONS
// ============================================================

function getNodeCategory(node) {
  const t = timeStep(node);
  const v = varIdx(node);
  if (t === 0) return 'source';
  if (t === 3) return 'sink';
  if (v === 2) return 'hub';      // CBODD
  if (v === 3 || v === 4) return 'discharge';
  return 'process';
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// --- Generate Float Reachability Files ---
function generateFloatReachability(scenarioName, config) {
  const dir = path.join(BASE_DIR, scenarioName);
  ensureDir(dir);

  // Node priors
  const nodes = {};
  for (let n = 1; n <= 32; n++) {
    const t = timeStep(n);
    const v = varIdx(n);
    if (t === 0) {
      nodes[String(n)] = r(noise(config.sourcePriors[v], 0.02));
    } else {
      nodes[String(n)] = r(noise(config.interiorPriorsByVar[v], 0.03));
    }
  }

  const nodepriors = {
    nodes,
    data_type: 'Float64',
    serialization: 'compact',
    description: `Node prior probabilities for WATER network - ${scenarioName} scenario. ${config.description}`
  };

  // Link probabilities
  const links = {};
  for (const [src, dst] of EDGES) {
    const et = edgeType(src, dst);
    const baseProb = config.edgeProbs[et] || config.edgeProbs.other;
    links[`(${src},${dst})`] = r(noise(baseProb, 0.02));
  }

  const linkprobs = {
    links,
    data_type: 'Float64',
    serialization: 'compact',
    description: `Link/edge probabilities for WATER network - ${scenarioName} scenario. ${config.description}`
  };

  fs.writeFileSync(path.join(dir, 'water-nodepriors.json'), JSON.stringify(nodepriors, null, 2));
  fs.writeFileSync(path.join(dir, 'water-linkprobabilities.json'), JSON.stringify(linkprobs, null, 2));
  console.log(`  Created: ${scenarioName}/ (Float reachability)`);
}

// --- Generate Interval Reachability Files ---
function generateIntervalReachability(scenarioName, config) {
  const dir = path.join(BASE_DIR, scenarioName);
  ensureDir(dir);

  // Node priors
  const nodes = {};
  for (let n = 1; n <= 32; n++) {
    const t = timeStep(n);
    const v = varIdx(n);
    if (t === 0) {
      const base = config.sourcePriors[v];
      nodes[String(n)] = {
        lower: r(noise(base.lower, 0.015)),
        upper: r(noise(base.upper, 0.015)),
        type: 'interval'
      };
    } else {
      const base = config.interiorPriorsByVar[v];
      nodes[String(n)] = {
        lower: r(noise(base.lower, 0.015)),
        upper: r(noise(base.upper, 0.015)),
        type: 'interval'
      };
    }
  }

  const nodepriors = {
    nodes,
    data_type: 'Interval',
    serialization: 'compact',
    description: `Node prior probabilities (interval) for WATER network - ${scenarioName} scenario. ${config.description}`
  };

  // Link probabilities
  const links = {};
  for (const [src, dst] of EDGES) {
    const et = edgeType(src, dst);
    const base = config.edgeProbs[et] || config.edgeProbs.other;
    links[`(${src},${dst})`] = {
      lower: r(noise(base.lower, 0.015)),
      upper: r(noise(base.upper, 0.015)),
      type: 'interval'
    };
  }

  const linkprobs = {
    links,
    data_type: 'Interval',
    serialization: 'compact',
    description: `Link/edge probabilities (interval) for WATER network - ${scenarioName} scenario. ${config.description}`
  };

  fs.writeFileSync(path.join(dir, 'water-nodepriors.json'), JSON.stringify(nodepriors, null, 2));
  fs.writeFileSync(path.join(dir, 'water-linkprobabilities.json'), JSON.stringify(linkprobs, null, 2));
  console.log(`  Created: ${scenarioName}/ (Interval reachability)`);
}

// --- Generate PBox Reachability Files ---
function generatePboxReachability(scenarioName, config) {
  const dir = path.join(BASE_DIR, scenarioName);
  ensureDir(dir);

  // Node priors
  const nodes = {};
  for (let n = 1; n <= 32; n++) {
    const t = timeStep(n);
    const v = varIdx(n);
    let value;
    if (t === 0) {
      value = r(noise(config.sourcePriors[v], 0.02));
    } else {
      value = r(noise(config.interiorPriorsByVar[v], 0.03));
    }
    nodes[String(n)] = {
      name: '',
      shape: '',
      construction_type: 'scalar',
      value: value,
      type: 'pbox'
    };
  }

  const nodepriors = {
    nodes,
    data_type: 'ProbabilityBoundsAnalysis.pbox',
    serialization: 'compact',
    description: `Node prior probabilities (pbox) for WATER network - ${scenarioName} scenario. ${config.description}`
  };

  // Link probabilities
  const links = {};
  for (const [src, dst] of EDGES) {
    const et = edgeType(src, dst);
    const baseProb = config.edgeProbs[et] || config.edgeProbs.other;
    links[`(${src},${dst})`] = {
      name: '',
      shape: '',
      construction_type: 'scalar',
      value: r(noise(baseProb, 0.02)),
      type: 'pbox'
    };
  }

  const linkprobs = {
    links,
    data_type: 'ProbabilityBoundsAnalysis.pbox',
    serialization: 'compact',
    description: `Link/edge probabilities (pbox) for WATER network - ${scenarioName} scenario. ${config.description}`
  };

  fs.writeFileSync(path.join(dir, 'water-nodepriors.json'), JSON.stringify(nodepriors, null, 2));
  fs.writeFileSync(path.join(dir, 'water-linkprobabilities.json'), JSON.stringify(linkprobs, null, 2));
  console.log(`  Created: ${scenarioName}/ (PBox reachability)`);
}

// --- Generate Capacity Files ---
function generateCapacity(scenarioName, config) {
  const dir = path.join(BASE_DIR, scenarioName);
  ensureDir(dir);

  const nodesCap = {};
  const sourceRates = {};
  const edgesCap = {};

  for (let n = 1; n <= 32; n++) {
    const cat = getNodeCategory(n);
    const v = varIdx(n);
    const baseCap = config.nodeCapBase[cat];
    nodesCap[String(n)] = r(noise(baseCap, baseCap * 0.05, false));

    // Source rates only for source nodes
    if (timeStep(n) === 0) {
      sourceRates[String(n)] = r(noise(config.sourceRateBase[v], 0.5, false));
    }
  }

  for (const [src, dst] of EDGES) {
    const et = edgeType(src, dst);
    const baseCap = config.edgeCapBase[et] || config.edgeCapBase.other;
    edgesCap[`(${src},${dst})`] = r(noise(baseCap, baseCap * 0.05, false));
  }

  const capacities = {
    network_type: 'capacity_flow',
    data_type: 'Float64',
    conversion_formulas: {
      reliability_bonus: 0.8,
      base_edge_capacity: config.edgeCapBase.self_temporal,
      edge_multiplier: 1.5,
      base_source_rate: config.sourceRateBase[0],
      base_node_capacity: config.nodeCapBase.process
    },
    capacities: {
      nodes: nodesCap,
      source_rates: sourceRates,
      edges: edgesCap
    },
    description: `Capacity analysis inputs for WATER network - ${scenarioName} scenario. ${config.description}`,
    generation_info: {
      total_nodes: 32,
      total_edges: 66,
      generated_from: 'domain_model',
      timestamp: new Date().toISOString(),
      source_nodes_count: 8
    }
  };

  fs.writeFileSync(path.join(dir, 'water-capacities.json'), JSON.stringify(capacities, null, 2));
  console.log(`  Created: ${scenarioName}/ (Capacity)`);
}

// --- Generate CPM Files ---
function generateCpm(scenarioName, config) {
  const dir = path.join(BASE_DIR, scenarioName);
  ensureDir(dir);

  const nodeDurations = {};
  const edgeDelays = {};
  const nodeCosts = {};
  const edgeCosts = {};

  for (let n = 1; n <= 32; n++) {
    const cat = getNodeCategory(n);
    nodeDurations[String(n)] = r(noise(config.nodeDurations[cat], config.nodeDurations[cat] * 0.08, false));
    nodeCosts[String(n)] = r(noise(config.nodeCosts[cat], config.nodeCosts[cat] * 0.06, false));
  }

  for (const [src, dst] of EDGES) {
    const et = edgeType(src, dst);
    const baseDelay = config.edgeDelays[et] || config.edgeDelays.other;
    const baseCost = config.edgeCosts[et] || config.edgeCosts.other;
    edgeDelays[`(${src},${dst})`] = r(noise(baseDelay, baseDelay * 0.08, false));
    edgeCosts[`(${src},${dst})`] = r(noise(baseCost, baseCost * 0.06, false));
  }

  const cpmInputs = {
    time_analysis: {
      edge_delays: edgeDelays,
      combination_function: 'max_combination',
      initial_time: 0.0,
      analysis_type: 'longest_path_time',
      propagation_function: 'additive_propagation',
      node_durations: nodeDurations
    },
    network_type: 'critical_path',
    data_type: 'Float64',
    cost_analysis: {
      initial_cost: 0.0,
      combination_function: 'max_combination',
      node_costs: nodeCosts,
      analysis_type: 'total_project_cost',
      propagation_function: 'additive_propagation',
      edge_costs: edgeCosts
    },
    conversion_formulas: {
      base_node_cost: config.nodeCosts.process,
      base_edge_delay: config.edgeDelays.self_temporal,
      delay_penalty: 3.0,
      base_node_duration: config.nodeDurations.process,
      edge_cost_penalty: 1.5,
      base_edge_cost: config.edgeCosts.self_temporal,
      cost_factor: 1.0,
      reliability_bonus: 2.0
    },
    description: `Critical Path Module inputs for WATER network - ${scenarioName} scenario. ${config.description}`,
    generation_info: {
      total_nodes: 32,
      total_edges: 66,
      generated_from: 'domain_model',
      timestamp: new Date().toISOString()
    }
  };

  fs.writeFileSync(path.join(dir, 'water-cpm-inputs.json'), JSON.stringify(cpmInputs, null, 2));
  console.log(`  Created: ${scenarioName}/ (CPM)`);
}

// ============================================================
// MAIN EXECUTION
// ============================================================

console.log('=== WATER Network Scenario Generator ===\n');
console.log('Generating realistic multi-scenario data for case study...\n');

console.log('Float Reachability Scenarios:');
for (const [name, config] of Object.entries(floatScenarios)) {
  generateFloatReachability(name, config);
}

console.log('\nInterval Reachability Scenarios:');
for (const [name, config] of Object.entries(intervalScenarios)) {
  generateIntervalReachability(name, config);
}

console.log('\nPBox Reachability Scenarios:');
for (const [name, config] of Object.entries(pboxScenarios)) {
  generatePboxReachability(name, config);
}

console.log('\nCapacity Scenarios:');
for (const [name, config] of Object.entries(capacityScenarios)) {
  generateCapacity(name, config);
}

console.log('\nCPM Scenarios:');
for (const [name, config] of Object.entries(cpmScenarios)) {
  generateCpm(name, config);
}

console.log('\n=== Done! Generated 12 scenarios (24 files) ===');
console.log('\nScenario summary:');
console.log('  Float:    Normal Operations, Storm Event');
console.log('  Interval: Sensor Uncertainty, Winter Operations');
console.log('  PBox:     Equipment Degradation, Emergency Response');
console.log('  Capacity: Normal Flow, Peak Hour Load, Storm Surge');
console.log('  CPM:      Standard Treatment, Expedited Processing, Enhanced Treatment');
console.log('\nOld directories (float/, capacity/, cpm/) can be removed if desired.');
