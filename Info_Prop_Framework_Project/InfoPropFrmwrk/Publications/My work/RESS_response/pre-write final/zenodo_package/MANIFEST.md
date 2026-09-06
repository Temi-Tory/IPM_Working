# Paper-scoped Zenodo package — manifest (staging, not yet assembled/zipped)

Per the user's decision (mint a new, paper-scoped Zenodo deposit rather than reusing the
thesis-data v1.0 repo). This file lists exactly what should go into that archive and why,
without physically duplicating the ~350MB of network files yet — do that as a fast final step
once this list is confirmed, right before minting (minting itself needs a separate explicit
go-ahead, per the plan: it's a one-way, outward-facing action).

All paths below are relative to `Info_Prop_Framework_Project/` unless stated otherwise.

## 1. Network definition files (`dag_ntwrk_files/`, 347MB total across 68 folders)

**Include (used in the current manuscript draft, `validation/probability/newress.zip`/`main.tex`):**
- `counterexample-n15` — reference network for the worked multi-level example (§4.2) and the
  p-box steps-scaling curve's "15-node reference network."
- `grid-graph` — the benchmark case study (§5.1), sources {1,3,13}.
- `power-network` — Tong & Tien (2019) Fig. 11 reproduction, §5.2 structured-network table.
- `KarlNetwork` — stress-test network, §5.2 structured-network table.
- `drone-network-fw-reliant-centralized`, `drone-network-vtol-dense-decentralized`,
  `drone-network-concentrated-minimal` (+ its `-k6-test` variant) — the applied case study, §5.4.
- `drone-network-full` — cited in §5.5/§5.4.3 as the unrestricted-connectivity boundary case
  (identification did not complete; include the network file + the identify-only log documenting
  the ~25.5GB memory demand, as evidence for the claim, not a completed result).
- `mlgw-gas-network` — real-infrastructure p-box evidence network (§5.3 corpus).
- The 17 bnlearn conversions used for corpus breadth: `alarm-bnlearn`, `andes-bnlearn`,
  `asia-bnlearn`, `barley-bnlearn`, `cancer-bnlearn`, `child-bnlearn`, `diabetes-bnlearn`,
  `earthquake-bnlearn`, `hailfinder-bnlearn`, `hepar2-bnlearn`, `insurance-bnlearn`,
  `link-bnlearn`, `mildew-bnlearn`, `munin-dag`, `munin-sub1`, `pathfinder-bnlearn`,
  `pigs-bnlearn`, `sachs-bnlearn`, `survey-bnlearn`, `water`, `win95pts-bnlearn` (include
  `diabetes-bnlearn` and `andes-bnlearn` themselves as network files — the manuscript's claim is
  about *why they're excluded from full validation*, which requires the network to be inspectable,
  even though no full-propagation result exists for them).
- `net3` (NOT `net3-water`) — **confirmed this session (Task 1)**: `net3` is the
  hydraulically-grounded conversion (97 nodes/119 edges, 307 unique diamonds, maxcond=12,
  identify 1.3s, Float64 propagation 2.9s, both comfortably tractable) and is the one to use if
  Net3 is added to the manuscript's corpus. `net3-water` is an older, less-realistic arbitrary-BFS
  conversion of the same source network (51 diamonds/maxcond=5) — **exclude it**; keeping both
  would be confusing since they represent the same real network with different, non-equivalent
  topologies. See `../data/TASK1_net3_summary.md`.
- Synthetic corpus generators: the 129-graph corpus (`random_nX_pY_sZ`, `mutant_rand28_sN`) is
  generated on the fly by seeded scripts (see §3), not stored as static files — include the
  generator scripts instead of 129 separate folders.
- `test-decomp3s2t` — **confirmed** (checked `main.tex` directly): this IS the Figure~12 /
  §sec:worked multi-level worked-example network (1:1 edge match, `b(16)=0.80614907`,
  68-vs-145 sub-problem trace all present in the current draft). **Move to Include.**
- Adversarial families (`fanin-k`, `mesh-w`) — **checked `main.tex`: NOT currently referenced
  anywhere in the manuscript** (no "adversarial"/"fanin"/"mesh" string appears at all), despite
  being fully validated with fresh numbers (`fresh_20260816/adversarial_timed.csv`,
  `adversarial_fit_summary.txt`) and having a paste-ready `tex/paper_adversarial.tex` fragment.
  This is a genuine, known gap — `CORPUS_CAMPAIGN_HANDBACK.md`'s own open-items list (§4 item 1,
  "Wave-4 writing") flags adding this table/figure as still pending, not something newly
  discovered here. **This is a scope decision for the rewrite session, not a data gap**: the
  validated adversarial data exists and is packaging-ready either way; whether it becomes a new
  manuscript subsection is a writing decision, flagged in `../README.md`. Include the generator
  scripts/data in the deposit regardless (harmless if unused; needed if the section is added).

**Exclude (superseded, keep out of the clean package; note their existence for provenance only):**
- `pareto-point-1..6-*` — the original six-Pareto case study, fully replaced (see
  `RESS_edit_proposals.md` scope decision, "old six-Pareto case study fully replaced"). Keep out
  of the reproduction package to avoid reviewer confusion about which networks the paper actually
  uses; mention in the README as "superseded, retained in the authors' working repository."
- `drone-network-balanced-k3`, `drone-network-cost-optimal`, `drone-network-geographic-knn`,
  `drone-network-resilience-optimal-k5`, `drone-network-time-optimal-k2`,
  `drone-medical-delivery-network`, `single-mission-drone-network`, `regional_hub_drone_medical` —
  exploratory drone variants not cited in the current manuscript draft (grep-check `main.tex`
  before finalising — if any of these is secretly referenced, move it to Include).
- `HB0_local_*`, `central_scotland_*`, `edinburgh_area`, `glasgow_area`,
  `glasgow_to_shetland_extreme`, `highland_to_lowland_full_network`,
  `military_multi_domain_network`, `continental_medical_network`, `hybrid_power_hierarchical`,
  `ergo-proxy-dag-network`, `metro_directed_dag_for_ipm`, `power-network-scenarios`,
  `psplib-j301_1`, `test-decomp3s2t`, `water-highvdemo`, `grid-graph-5x5` — not referenced in the
  current RESS draft (these belong to the CPM/Flow thesis chapters, a different paper). **Exclude
  from the RESS-specific deposit entirely** — they'd make the archive look like the whole thesis
  repo again, which the user specifically wanted to avoid by minting a new one.

*(`test-decomp3s2t` needs a second look: `RESS_edit_proposals.md` EDIT 6 says the Figure-12
worked-example network is `dag_ntwrk_files/test-decomp3s2t` — if so, MOVE to Include above.)*

## 2. Final data (`validation/probability/data/`, 138KB, 21 files) — include ALL of these verbatim
Every CSV/txt behind a manuscript table or figure, per `RESS_edit_proposals.md`'s own "Numbers
used in this document and their sources" list. Plus (once produced by this session's re-runs):
the fixed p-box steps-scaling curve and the refreshed grid p-box accuracy table — see `../data/`.

## 3. Scripts (subset of `validation/`, `validation/probability/`)
- Corpus generation: `graph_gen.jl`, `graph_families.jl`, `make_structured.jl`, `make_merged.jl`.
- Identification/propagation reference: `rc_core.jl`, `rc_core_factored.jl`.
- Oracles: `oracles.jl`, `bdd_oracle.jl`, `oracles_tiered.jl`.
- Corpus-wide validation drivers: `full_regression_sifted.jl`, `families_validate.jl`,
  `large_graphs.jl`, `interval_sweep.jl` (or `probability/rerun_129_corpus.jl`, the current one).
- Case-study scripts: `probability/grid_case_study/*.jl`, `drone_k_sweep.jl`,
  `drone_bdd_comparison.jl`, `probability/drone_ksweep_remeasure.jl`,
  `probability/asce_grid_reproduction.jl`, `probability/asce_power_reproduction.jl`.
- p-box: `cvx_sound.jl`, `corpus_cvx.jl`, `certified_bound_vignette.jl`,
  `certified_bound_threshold_sweep.jl`.
- Adversarial: `adversarial_scaling.jl`, `graph_adversarial.jl`, and the `fresh_20260816`
  timed/fitted versions.
- bnlearn conversion: `bif_to_edges.jl`, `bnlearn_diamond_stats.jl`.
- Net3: whatever this session's Task 1 uses.

## 4. Package/code
- Point to `InformationPropagationAnalysis.jl` v0.2.1 (General registry) by DOI-able reference
  (Zenodo auto-archives GitHub releases if the GitHub-Zenodo integration is enabled on that repo —
  check whether it already is; if not, that's a one-time repo setting, separate from this paper's
  deposit) rather than duplicating the package source inside this data deposit.

## 5. README for the deposit itself (to draft once the include list above is confirmed)
Structure: (1) what this is / how it relates to the paper, package, and thesis-data repos: (2) a
table mapping every manuscript table/figure number to its exact data file and generating script;
(3) how to reproduce (Julia version, environment, run order); (4) provenance table (reuse
`CORPUS_PROVENANCE.md` content); (5) license (MIT, matching the package and thesis-data repo);
(6) citation block (paper once published + package + this deposit's own DOI).

## Open decision for the user
The Include/Exclude split above is a first pass based on grepping `main.tex` for network names —
**please confirm or correct it** before anything is copied/zipped, especially: (a) whether
`test-decomp3s2t` is really the Figure-12 network (move to Include if so), (b) whether any of the
"exploratory drone variant" folders are secretly still referenced, (c) whether you want the
excluded exploratory/superseded folders mentioned at all in the deposit's README (as "not
included, available on request from the corresponding author") or omitted from the README too.
