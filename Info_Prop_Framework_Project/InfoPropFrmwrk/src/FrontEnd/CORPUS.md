# Test-network corpus — `../../../dag_ntwrk_files/`

Audit of the 91 network folders against the upload contract, 2026-08-29.
The new upload flow reads the folder/naming convention in
`shared/data-access/file-convention.ts` and **respects scenarios** — a network
can carry many named operating cases in one upload, each a self-contained
bundle of any subset of {reliability, flow, schedule} inputs.

## Ready now — all three toolkits, all three value forms (5)

`float/` + `interval/` + `pbox/` + `capacity/` + `cpm/`, all well-formed.
**Use these for testing every value form and every toolkit / for thesis screenshots.**

| Network | notes |
|---|---|
| `KarlNetwork` | 26 nodes, the canonical one. pbox `data_type` is `"ProbabilityBoundsAnalysis.pbox"`. |
| `ergo-proxy-dag-network` | |
| `metro_directed_dag_for_ipm` | |
| `munin-dag` | large |
| `power-network` | |

## Ready now — reliability + flow + schedule, Float64 (11)

`float/` + `capacity/` + `cpm/`. Reliability is Float64 only here (no interval/pbox folder).

`continental_medical_network`, `drone-medical-delivery-network`,
`glasgow_to_shetland_extreme`, `grid-graph-5x5`, `highland_to_lowland_full_network`,
`hybrid_power_hierarchical`, `mlgw-gas-network`, `munin-sub1`,
`regional_hub_drone_medical`, `single-mission-drone-network`,
`military_multi_domain_network` (its extra named-scenario folders are empty — float/capacity/cpm only).

## Ready now — operating-case scenario style (3)

One upload → many named scenarios, each carrying reliability + flow + schedule.
Files verified well-formed (top-level `data_type`, `cost_analysis` present).

| Network | scenarios |
|---|---|
| `water` | Edge Bottleneck Demo, Interval Conservative, Interval Optimistic, Mixed Bottleneck Demo, Node Bottleneck Demo, Single Point of Failure Demo, Source Limited Demo *(+ a `capacity_v2_demo_pack/` folder of .md/.js — ignored as unknown)* |
| `water-highvdemo` | 01 Source Limited, 02 Edge Bottleneck, 03 Node Bottleneck, 04 Mixed Bottleneck, 05 CPM Time-Critical, 06 Interval Stress *(+ SCENARIO_MANIFEST.json / topology-summary.json — ignored)* |
| `grid-graph` | float, Degraded, Major Degraded (reliability only); main scenario - dt, Breakdown 214 (interval) (all three) |

## Ready now — reliability only, Float64 (40)

`float/` with a nodepriors + linkprobs pair, nothing else.

all `*-bnlearn` (asia, alarm, andes, barley, cancer, child, diabetes, earthquake,
hailfinder, hepar2, insurance, link, mildew, pathfinder, pigs, sachs, survey,
win95pts), `HB0_local_1/2/3`, `central_scotland_1/2/3`, `counterexample-n15`
(also has a leftover `diamonds/` folder — ignored), `drone-network-balanced-k3`,
`drone-network-cost-optimal`, `drone-network-full`, `drone-network-geographic-knn`,
`drone-network-resilience-optimal-k5`, `drone-network-time-optimal-k2`,
`edinburgh_area`, `glasgow_area`, `pareto-point-1..6`, `test-decomp3s2t`.

## Ready now — reliability only, Interval (4)

`interval/` folder only.

`drone-network-concentrated-minimal`, `drone-network-concentrated-minimal-k6-test`,
`drone-network-fw-reliant-centralized`, `drone-network-vtol-dense-decentralized`.

## Structure only (1)

`net3-water` — `.EDGES` and nothing else. Loads for the network view; no analysis
can run until inputs are added.

## Empty scaffolds — NOT usable without generating inputs (27)

No `.EDGES`, empty `float/` (or `float`+`interval`+`pbox`) subfolders. Not a
format problem — the files were never generated.

`central_belt_distribution`, `central_scotland_network`,
`comprehensive_islands_supply_network`, `dual_mission_drone_medical`,
`emergency_supply_test`, `highlands_emergency_network`, `join-260`,
`layereddiamond-3`, `mainland_to_northern_isles`, `mainland_to_western_isles`,
`multi_hospital_supply_hub`, `multi_stage_supply_chain`, `national_1/2/3`,
`national_emergency_medical_network`, `realistic_failure_scenario`,
`southern_scotland_network`, `scaled-power-network-2x..15x` (9).

## File format contract (what the server parsers accept)

| Role | filename | shape |
|---|---|---|
| structure | `*.EDGES` | header `source,destination` then `u,v` per line |
| node priors | `*-nodepriors.json` | `{ "nodes": { "1": 0.9, ... }, "data_type": "Float64" }` — interval: values `{type,lower,upper}`, `data_type:"Interval"`; pbox: values `{value,type:"pbox",construction_type,...}`, `data_type` contains `"pbox"` |
| link probs | `*-linkprobabilities.json` | `{ "links": { "(7,16)": 0.9, ... } }` (same value-form rules) |
| capacities | `*-capacities.json` | `{ "data_type": "Float64", "capacities": { "nodes": {...}, "edges": { "(u,v)": cap } } }` — server **hard-rejects** non-Float64 |
| CPM | `*-cpm-inputs.json` | `{ "data_type": "Float64"\|"Interval", "time_analysis": { "node_durations": {...}, "edge_delays": { "(u,v)": ... } }, "cost_analysis": {...} }` — `cost_analysis` optional under V2 |

All files that exist in the corpus already match these shapes — the only gaps
are the 27 empty scaffolds (need generation) and, for value forms, that most
folders only ship `float/`.

## Added since the audit (2026-08-30)

`psplib-j301_1` — CPM-only, `.EDGES` at the root plus `float/` + `interval/`
(±20% durations) scenario folders. Converted from PSPLIB's `j30` benchmark
set (`j301_1.sm`, 32 nodes/48 edges) via `psplib_to_ipf.py`
at the repo root — a real external benchmark, not synthetic. Run end to end
against the live server; full results and a reproduction note are in its own
`RESULTS.md`. Not one of the 27 empty scaffolds below — a genuinely new
addition, useful as a citable, externally-validated CPM test case (its
computed project value matches PSPLIB's own published MPM-Time exactly).
