# Corpus characteristics and 3-value-type coverage — reconciled picture (2026-09-06)

Answers two questions: what's the structural diversity of the validated networks (size, diamond
count, conditioning width), and how much of that diversity has actually been tested under all
three value types (Float64, Interval, p-box)? Built from `complexity_validation.csv`,
`CORPUS_INVENTORY.md` (reconciled against its own later 2026-08-16/17 corrections banner — some
of its per-network numbers predate the corpus fixes), and this session's fresh confirmations.
**A prior session already flagged this exact table ("corpus×mode coverage table") as a needed
manuscript addition and never built it — this is that table.**

## Structural spread (size, diamonds, conditioning width)

| group | V range | E range | n_diamonds range | maxcond range |
|---|---|---|---|---|
| 129-graph synthetic corpus | ~8–50 | ~12–113 | 4–154 | 1–17 |
| 6 named topological families | 8–25 | 21–36 | 13–55 | 4–10 |
| power-network | 23 | 27 | 9 | 3 |
| KarlNetwork | 26 | 74 | ~145 | 11 |
| counterexample-n15 | 15 | 23 | 13 | 4 |
| drone (3 official + K6 variant) | 217–242 | 263–1753 | up to ~1005 | 6–17 |
| mlgw-gas-network | 37 | 40 | 7 | 4 |
| Net3 (hydraulic conversion) | 97 | 119 | 307 | 12 |
| metro (Berlin) — **freshly re-confirmed this session** | 306 | 350 | 147 | 6 |
| bnlearn (17 networks) | 5–1,041 | 4–1,398 | up to 753 (andes) | 0–21 (andes=21, link=6, rest "0-21, <2s") |
| adversarial fanin-k | 7–49 | 8–64 | — | 1 (single wide fork) |
| adversarial mesh-w | 16–64 | 21–105 | 21–903 | 6–11 |
| **adversarial ISCAS85** (new, real published circuits, worst-case priors) | 11–913 | 12–1497 | up to 50,571 (c499) | **1 to 67** — c432 alone: maxcond=67, sum_2^C≈1.17e21; c1355/c1908 crash identification itself via memory exhaustion (16GB machine) — the single hardest boundary case found anywhere in this corpus |

**Overall span**: 5 to 1,041 nodes (208×) with real validated propagation results (`munin-dag`,
1,041 nodes/1,398 edges, is the largest network in the whole corpus with a clean propagated
result — not `link-bnlearn`'s 724 as an earlier pass here stated); conditioning width 0 to 21
among networks that actually propagate, with ISCAS85 adding a documented identify-only boundary
case at maxcond=67 (see the adversarial row above) once that family is counted. This is a
genuinely wide range against this literature's own conventions: the original submission's single
benchmark was fixed at 16 nodes; Tong & Tien (2019) itself tested one 16-node network plus one
power network; even the wider network-reliability-via-BDD literature typically standardises on a
fixed set of ~20 small benchmark networks (grid/lattice graphs, small classic topologies, often
under 30 nodes each) rather than anything approaching this corpus's scale or domain diversity.

## Coverage by value type (Float64 / Interval / p-box) — the table that was never built

| network group | Float64 | Interval | p-box |
|---|---|---|---|
| 129-graph corpus | 129/129 exact | 129/129 exact (worst 2.2e-16) | **not run** |
| 6 named families | 8/8 exact | 8/8 exact | 12 of these networks appear across 4 soundness sweeps (50 configs total, 0 violations) |
| power-network | exact | not independently confirmed this session | yes (scenario sweep: Baseline/Degraded/Interval/Pbox, mean bounds [0.907, 0.947]) |
| KarlNetwork | exact | exact | yes, sound (steps=50, 546s) |
| counterexample-n15 | exact | exact | yes — this is the "15-node reference network" for the steps-scaling curve |
| grid-graph (benchmark) | exact (1.1e-16) | exact both widths (1.1e-16) | **sound at both w=0.05 and w=0.10** (this session, 0.000e+00) |
| drone: fw-reliant-centralized | exact | exact | tractable, sound |
| drone: concentrated-minimal (K=16, shipped) | exact | exact | **not attempted at shipped K=16** (only the K=6 control variant is p-box-tractable) |
| drone: vtol-dense-decentralized | exact | exact | **intractable** (didn't finish steps=10 warm-up within 1hr, per historical note) |
| mlgw-gas-network | exact (freshly re-confirmed, 2.22e-16) | **exact (freshly re-confirmed this session, 2.22e-16)** | yes, sound (vs 3,000-sample MC, worst violation 0.0057) |
| Net3 | exact (confirmed this session) | not yet run | not attempted (identify-only stats predict it's beyond the current p-box tractability boundary — and now that ISCAS85 shows even 196-node networks can reach maxcond=67, this prediction should be treated as a real risk, not a formality) |
| metro (Berlin) | exact (freshly re-confirmed this session, 2.78e-16) | **exact (freshly re-confirmed this session, 3.33e-16)** | not attempted |
| **ISCAS85 (adversarial)** | c17 exact (1.11e-16); c432/c499/c880 identify-only only (adversarial-boundary, maxcond 41-67); c1355/c1908 identify itself crashes | c17 exact (0.0 corner diff) | c17 only: sound, cost matched the `measured_ops`-based prediction almost exactly (predicted 1.3-2.3s, actual 1.41s) |
| bnlearn (17 networks) | 129... i.e. all 17, Float64 exactness confirmed | **16/17** (later addition — andes intractable in Interval too; diabetes excluded) | **0/17 — not run on any bnlearn network** |
| adversarial fanin-k | exact vs path-enum/MC | exact through the tested range | not attempted |
| adversarial mesh-w | exact vs path-enum/MC (to w=5), exact-by-construction beyond | exact through mesh_7 | not attempted |

## The honest gap this surfaces

**p-box coverage is genuinely the thinnest of the three value types, by a wide margin**, and this
was true before this session and remains true after it:
- Zero p-box runs anywhere on the 129-graph corpus, the bnlearn corpus (all 17), Net3, or metro.
- On the one real network family where p-box tractability was pushed hard (drone), it succeeds at
  low redundancy and fails at the shipped configuration — a real, honestly-reported boundary
  finding (already in the manuscript's limitations section), not a gap being hidden.
- This is not a new problem to fix before submission — the manuscript is already honest about it
  ("for larger networks interval propagation combined with sampling is the practical recourse").
  It IS worth being precise about in the rewrite: the "several real infrastructure networks" and
  "129-graph corpus" breadth claims are Float64/Interval claims; the p-box claim's breadth is
  narrower (grid, KarlNetwork, mlgw, and the drone low-redundancy case), and the text should not
  blur the two together when describing corpus size.

## Recommendation

If the bnlearn breadth claim (checklist item #9) is added, be precise that it backs the
Float64/Interval exactness claim specifically, not a p-box claim — don't let "17 networks up to
724 nodes" read as if it applies to all three value types when it currently only applies to two.
