# Viva cheat sheet (one page; detail in `VIVA_PREP_CHAPTER_REVIEW.md`)

## Vocabulary
**exact** = the reported bounds are attained · **sound** = the truth is inside the bounds · **tight** = narrow · **conservative enclosure** = sound, not exact · **proved / validated / demonstrated** are different words.

## Theorem one-liners
- **3.4 Layered order:** every DAG has layers; each node's parents lie in earlier layers.
- **4.4–4.6:** grouping = components of the influencing-set intersection graph; groups disjoint; recursion terminates in ≤ |V| nested steps.
- **4.9 Completeness:** a join gets a maximal diamond iff two parents share an unsettled fork (or one is an ancestor of the other).
- **4.10 Determinism:** earliest covering fork by a strict total order; union–find order-free; reuse by Prop 4.8(ii).
- **5.1 Monotone:** belief is non-decreasing in every input. **5.6 Corners:** exact interval range = belief at all-lower and all-upper endpoints.
- **5.2–5.5:** total probability; independence given the conditioning states and disjoint influence; groups recombine as 1 − ∏(1 − P(E_k)); a solved diamond is a supernode.
- **6.1:** super-source and super-sink reduction is exact. **6.5 (Picard–Queyranne):** S\*∪R is a minimum cut iff R is closed under residual reachability ⇒ **at most 2^|F|** cuts.
- **7.1–7.4:** a float is monotone in one duration; incomparable ⇒ upper bound, dominated ⇒ lower bound; enumerate only the bypass set: cost 2Σ2^{|H_v|}.

## Numbers
| What | Number |
|---|---|
| Simple diamond | naive 0.749071, exact **0.675462** (b(2)=0.81, branch 0.59049) |
| Worked network | b(6)=0.796843, b(11)=0.733329, b(12)=0.779068, **b(T)=0.806149**; 20 sub-problems, 16 distinct |
| Corpus | **129** = 120+8+1; worst **1.1×10⁻¹⁶** (point), **2.8×10⁻¹⁶** (interval) |
| Table 5.2 (nodes/edges; maximal/unique; \|C\|) | power 23/27; 5/9; 3 · grid 16/24; 8/41; 7 · Karl 26/74; 18/147; 11 · n15 15/23; 4/13; 4 |
| Grid benchmark | 26 values within 5×10⁻⁶ |
| Power network (R=0.9 / 0.99 / 0.3) | published 0.85741 / 0.98969 / 0.00221 · ours 0.85917 / 0.98969 / 0.00272 · **exhaustive 2^27: 0.85917198 / 0.98968706 / 0.00272158** |
| Fan-in-k | ops = 2k+1 (9, 17, 25, 33 at k=4, 8, 12, 16) |
| Mesh-w=8 | 3.9×10⁶ sub-problems vs 2,621 BDD nodes |
| Practical width | ≈ **18**; bnlearn width ≈ 21 out of memory; 16 of 17 completed |
| Interval | ×1.2 over point; 3.9–99.9× faster one-shot; ≤ 0.45 over-widening if reconvergence ignored |
| p-box | convolution mass escape ≤ 0.34; band ≈ 0.18 – 0.70; cost × ≈ 5–7.8 per doubling of level; use 25–100; Karl 17 min (L=200) vs 546 s (L=50); 50 configs no violation |
| Drone | widths 10 / 16 / 16; Islay **[0.562, 0.722]**; crossover with BDD at 12–14 routes; saturates at 16 routes |
| Flow flagship | F\*=**37.0**; A: 4 cuts, free zone 2; B: 1 cut; gateway edge loss 17.0 (46%); k=2 worst pair: 37 → 3 |
| RTS-24 | 1,607 MW net import met (100%); 2,850 peak; 1,243 local; gens 1, 2, 13, 16 at nameplate; line 7–8 headroom 4 MVA |
| genrmf | 107,644 edges: Dinic 0.657 s; oracle 28.9 s |
| PSPLIB j301_1 | LongestPath **38** (= MPM-Time); ShortestPath 18; accumulation 362; ±20%: [30.4, 45.6]; split **50,524** vs 2^30 (≈ 21,000×), 4.2 s; **5** necessarily critical (2 dummies + 23, 24, 30), **19** possibly, 13 never; enclosure 0 / 26 |
| 5×5 mesh | split 3.9×10⁷ vs 3.4×10⁷ sweep (boundary) |
| Net3 structure | 97/119; 3 sources, 18 sinks; 35 forks, 23 joins, 28 layers; **21 / 307 diamonds, width 12**; capacity graph 98/177 |
| Net3 reliability | worst **0.806** (node 76); mean 0.934; ±5%: **[0.354, 0.990]**, mean band 0.363 |
| Net3 flow (corrected) | **680.1 L/s** (whole demand; unique cut = 58 demand edges) · degraded **43.3 L/s (6.4%)**, 24 cuts, free zone 6, 7 edges in every cut (river pump 95→97 + junctions 7, 8, 77, 79, 80, 81) |
| Net3 schedule | **1,773.3 h ≈ 74 days**, 28-activity chain; [1,418.7, 2,128.0] h = 59–89 days; split declined (122 > 60); enclosure 0 necessarily / 61 possibly critical; MaxScaling 0.9928 / 0.7515 |
| Overlap | degraded cut ∩ restoration chain = nodes **95, 97**, super-sink |
| Package | v0.2.1 in text (**now 0.2.3**); 214 assertions; 7 modules; 6 errors found; Julia 1.12.6 |
| Interface | 14 endpoints, contract 2.0.0; 4 rules; no user study |

## The ten things to say without notes
1. One DAG model, three analyses, uncertainty carried through rather than collapsed first.
2. Redundancy is reconvergence: 0.749 naive vs 0.675 exact; condition on the fork.
3. Exact vs sound vs tight; point and interval exact, p-box sound, enclosure sound not exact.
4. Cost first: exponential in conditioning width, same as a sifted BDD; no asymptotic gain; the case is native interval and p-box.
5. p-box: Fréchet proved; positive-dependence default validated on 50 configurations, not proved; the CDFs cross.
6. Interval belief: monotone ⇒ two corners (Prop 5.6).
7. Domination split: floats are NP-hard, but only bypass durations need enumerating (Thm 7.4); 50,524 vs 2^30; not on a dense mesh.
8. Net3 correction in 30 seconds: 58 demand edges missing; 680.1 and 43.3; independent Edmonds–Karp; Ch. 6 "exactly" → "at most 2^|F|".
9. The snapshot: flow reversal, diurnal demand, common cause outside the model.
10. Limits first: width ≈ 18; p-box small; capacity point-valued; LongestPath only; interface not user-studied.

## Don't get caught out (new, from the review)
- PSPLIB interval width is **±20%** (Ch. 7, data); Appendices A.6 and B.4 say ±10% in error.
- "2^10 states" for the simple diamond is **2^9** (9 uncertain components).
- Node 95 is the river pump's **upstream** junction (Ch. 10 §10.4 says downstream).
- "About fifty nodes" is a width statement: results exist at 97, 242, 306 nodes.
- Interval ±5% on survival probability 0.99 = break probability 1% → ≈ 6%; belief is "no break in a year", not availability.
- Net3 baseline flow = demand is capacity slack (1.5 m/s assumed), not hydraulic adequacy; 74 days is a model output.
- Power residual: confirmed by BDD **and** exhaustive enumeration; no one-link slip reproduces the published triple.
- Interface cannot show upgrade thresholds (server returns degradation only).
- Check the data DOI before Friday (thesis 22821351 vs notes 22180227).
