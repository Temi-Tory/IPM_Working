# Viva preparation: chapter-by-chapter review

Temi Ohiani · viva Friday 9 October 2026, 1 pm · prepared 7 October 2026

Examiners: **external, a mathematician in an engineering context** (rigour: definitions, proofs, what
"exact" and "sound" mean, complexity, validated versus proved); **internal, a civil engineering
professor** (does the model represent real infrastructure, where did the inputs come from, hydraulics,
independence and common cause, what decision does it support).

---

## READ THIS FIRST

### What this is, and how far I got

- I read **every chapter (1 to 11) and both appendices in full from the `.tex` source**, plus
  `SPEAKER_NOTES.md` and `SPEAKER_SCRIPT.md`. Nothing is skimmed. The priority chapters (the six
  algorithm contributions, Ch. 8, 9, 10) have the deepest entries; Ch. 1, 2, 3 and 4 are shorter
  because the algorithm entries already carry their content.
- **Page numbers in this review are approximate (±1) and are for the current build. For the submitted copy use `VIVA_TAB_MAP.md`, which is checked against `thesis_SUBMITTED_30Aug2026.pdf`; from Chapter 7 onwards chapter pages are one lower in the submitted copy, and theorem pages quoted in Part A can be one too high.** Cite section and theorem numbers in the room.
- Page numbers are **printed page numbers in the current `main.pdf`**. The examiners hold the submitted copy
  (commit `5089ba6`). Pagination matches for the uncorrected pages; the corrected material (Ch. 6
  min-cut passage, Ch. 10 flow section, Ch. 11, App. B) may sit a page or so differently in their copy.
  Quote section and equation numbers, not pages, in the room.
- **Theorem numbering** (one counter per chapter shared by definitions, lemmas, propositions and
  theorems): Layered order = Thm 3.4; Grouping 4.4; Group disjointness 4.5; Termination 4.6; Edge isolation
  Lem 4.7; Identity Prop 4.8; Completeness 4.9; Determinism 4.10; Monotonicity Prop 5.1; Conditional
  invariance Lem 5.2; Separator sufficiency 5.3; Recombination 5.4; Supernode equivalence 5.5; Corner exactness
  Prop 5.6; Super-terminal reduction Prop 6.1; Picard–Queyranne Thm 6.5; Corner sufficiency Prop 7.1;
  Incomparable Lem 7.2; Dominated Lem 7.3; Domination split Thm 7.4. Algorithms: 1 layered order (p. 32),
  2 diamond identification (p. 46), 3 Ford–Fulkerson, 4 push-relabel, 5 order-based kernel (p. 139), 6 linear
  kernel (p. 140), 7 domination split (p. 146). **There is no algorithm box for the PPA, the min-cut
  enumerator, the thresholds or the p-box operator**: those are in prose and equations (see weak spot N10).
- **Checked beyond the thesis text** (all read-only, nothing edited): the package's p-box operator, the
  domination-split limits and the server's screening gate; the server's capacity handler (does it expose
  upgrade thresholds); the Net3 edge list and node map; the PSPLIB data files. I **ran one new check**: an
  exhaustive enumeration of the 23-node power network (section "A new independent check" below). Script and
  output are quoted there. I did **not** re-run any timing, so every timing quoted is the thesis's.
- Arithmetic I re-checked by hand and found correct: 0.749071 and 0.675462 (Ch. 5, §5.4);
  the 21,000× and 82 µs figures (Ch. 7); the A/B degradation trajectory 37α; 17/37 = 46%; the
  59 / 74 / 89 days; 43.3/680.1 = 6.4%; the 4-of-8 closed subsets of the chain 19→20→21; the 2k+1 counts.
- Where I give an interpretation that is **my reading and not in the thesis**, I say so.

### The thesis in five sentences

1. A goal-oriented process system, once its direction of flow is fixed, is a DAG, and three engineering
   questions (does supply reach, how much is delivered, when does it complete) share that topology but are
   normally answered by three separate models that each take one number per input.
2. The Information Propagation Framework builds one graph object (layers, ancestor and descendant closures,
   roles) that three toolkits read unchanged, and delivers it as a registered Julia package and a local no-code
   interface.
3. Redundancy is reconvergence, which is exactly what breaks the local update and makes exact analysis expensive,
   so a decomposition module finds every diamond once and the Probability Propagation Algorithm conditions on it:
   exact beliefs for numbers, the exact range for intervals (belief is monotone), sound bounds for p-boxes, at a cost set by the
   conditioning width, which is the same width a decision diagram pays.
4. The capacity toolkit gives throughput, every minimum cut, sensitivities and thresholds; the schedule toolkit
   generalises the critical path to operator-pair modes, gets interval forward quantities exactly from two runs
   and interval floats exactly by a domination split whose cost is set by bypass width.
5. Every exact result is checked against a computation sharing none of its machinery, each method's boundary is
   stated, and one public network (Net3) shows one model serving three analyses, including a joint finding about the river pump.

### The six contributions at a glance (full entries in Part A)

| # | Contribution (Ch. 1 §1.4, Ch. 11 §11.3) | Evidence strength | Where an examiner pushes |
|---|---|---|---|
| 1 | Network model and graph object (Ch. 3) | Definitional; Thm 3.4 proved (easy); demonstrated by three toolkits reading it | "DAG plus topological sort is textbook: what is new?" |
| 2 | Network decomposition module (Ch. 4) | **Proved**: grouping, disjointness, termination, completeness, determinism, identity | Completeness is proved at the top level only; no complexity bound for identification; eligibility depends on values |
| 3 | Probability Propagation Toolkit (Ch. 5) | Point: **proved** + oracle on 129 graphs. Interval: **proved** range (monotonicity) + empirical match of the algorithm. p-box Fréchet: **proved** (classical). p-box default: **validated, not proved** | p-box operator; "BDD with interval probabilities is already exact"; cost is no better than a BDD; power-network residual |
| 4 | Capacity Flow Toolkit (Ch. 6) | Reductions **proved**; min-cut lattice rests on a **cited** theorem (Picard–Queyranne); thresholds argued, not proved; everything oracle-checked on 12 networks | Max-flow is not hydraulics; enumeration is exponential in the free zone; "exact" only on candidate sets |
| 5 | Critical Path Toolkit (Ch. 7) | Forward exactness and domination split **proved** (LongestPath, point edges); validated against a path oracle and 50,000 Monte Carlo samples | Only LongestPath; fixed screen sent Net3 to the enclosure; dense mesh gives no gain |
| 6 | Delivery as package and interface (Ch. 8, 9) | **Demonstrated**; not user-tested | "Has any engineer used it?" No. Test suite is small. Public demo versus "no data leaves the machine" |

### The ten things to be able to say without notes

1. **One sentence of the contribution:** one DAG model, three analyses, and the uncertainty carried through the
   analysis instead of collapsed to a number first.
2. **Why reconvergence matters:** two routes into a join share the fork; treating them as independent gives
   0.749 where the truth is 0.675; conditioning on the fork gives it exactly.
3. **Exact versus sound:** *exact* means the reported bounds are attained; *sound* means the truth lies
   within them. Point and interval beliefs are exact; p-box bounds are sound; the conservative CPM enclosure is sound but not exact.
4. **Cost, said first and plainly:** exponential in the largest conditioning set, the same width as a
   sifted BDD; no asymptotic gain for point reliability; the case rests on native interval and p-box propagation.
5. **The p-box line:** Fréchet–Hoeffding operator is sound by a classical theorem; the default positive-dependence operator
   is validated (no violation in 50 configurations against Monte Carlo) but not proved, and the natural proof route fails
   because the distributions cross. Where a claim must rest on proof, use Fréchet.
6. **Interval beliefs:** belief is non-decreasing in every input (Prop 5.1), so the exact range is the two corner values (Prop 5.6).
7. **Domination split:** an interval float is hard in general (NP-hard), but its exact extreme needs only the durations that can route around the node
   enumerated (Thm 7.4); PSPLIB 50,524 runs against 2^30; stops paying on a dense 5×5 mesh.
8. **Net3 correction, 30 seconds:** 58 demand edges to the super-sink were missing from the flow input; corrected 680.1 L/s
   baseline (whole demand) and 43.3 L/s degraded, checked against independent Edmonds–Karp; Ch. 6 "exactly" became "at most 2^|F|" minimum cuts; no other number changed.
9. **The snapshot:** acyclicity is a property of one operating snapshot; flow reversal, diurnal demand and
   common-cause failure are outside the model, and every result is conditional on the four assumptions of Ch. 3 §3.8.
10. **Limits named first:** about 18 as the practical conditioning width; p-box only on small networks;
    point-valued capacity; LongestPath-only exact floats; interface demonstrated, not user-studied.

### The eleven known issues: one-line answers (detail in the chapter sections)

| # | Issue | One-line answer | Detail |
|---|---|---|---|
| 1 | Ch. 6 "exactly 2^|F| min cuts" | Picard–Queyranne: cut is minimum iff R is closed under residual reachability, so **at most** 2^|F|; no reported number changed (A: 4 cuts, B: 1) | §6.5 |
| 2 | Net3 flow 1,837.9/954.6 | Demand edges missing from input; corrected 680.1 and 43.3 L/s (6.4%), 24 min cuts, river pump in every one; checked by independent Edmonds–Karp | §10.5 |
| 3 | p-box positive-dependence operator | Validated not proved; Fréchet is the proved one; proof route fails because CDFs cross | §5.2 |
| 4 | Power-network residual 10^-3 | **Our value is confirmed by three independent exact computations** (BDD, and now exhaustive enumeration of all 2^27 link states); the difference is with the published number | §5.2, "A new independent check" |
| 5 | Snapshot orientation | Degraded Net3 flow is largely an orientation artefact; a degraded state needs its own orientation; this is the stated assumption 4 | §3, §10.5 |
| 6 | Max-flow vs hydraulics | An upper bound under stated capacities (Q = vA), not a head/pressure model | §6.5, §10.5 |
| 7 | Independence, common cause | Excluded by assumption 1; model a common cause as a shared upstream node | §3 |
| 8 | Cost vs BDD | No asymptotic gain for point values; case rests on interval and p-box; adversarial families show where each wins | §5.3 |
| 9 | Ch. 7 boundary | Split pays when bypass sets are small (50,524 vs 2^30), not on dense mesh (3.9×10^7 vs 3.4×10^7); Net3 declined by the fixed screen (122 > 60 intervals) | §7 |
| 10 | "No data leaves the machine" vs public site | Claim is about the local deployment (loopback server); the site is a demonstration with example networks | §9 |
| 11 | Package version 0.2.1 in text | Now 0.2.3 (0.2.2 min-cut enumeration, 0.2.3 node connectivity on sub-unit capacities); no thesis number changes | §8 |

### Fixes applied on 7 October (uncommitted, for you to review)

Thesis: PSPLIB ±20% (App. A §A.6, App. B §B.4); 2^9 (Ch. 5 §5.4); node 95 at the pump inlet (Ch. 10 §10.4); 1.5 m/s "assumed design velocity" (Ch. 10 §10.3); "three" folders (App. A); Table B.1 caption and Table B.5 row label; eleven names (Ch. 8); nine projects (Ch. 9). Errata sheet: new section 3. Slides: 2^9 on slide 5; limits on slide 10; capacity and schedule split into slides 7 and 8. Speaker script: 2^9 and the limits line. Speaker notes: backup slide list corrected to 18 pages and five new questions. **Not done:** the full thesis was not rebuilt; the "marked" corrections PDF was not regenerated; the Ch. 6 count wording (N14), the random-corpus description (N15) and N3 in Ch. 11 are untouched.

### Further weak spots (all NEW: not in your known list), ranked

**High (fix or be ready to explain; one is a factual error in an appendix):**

- **N1. PSPLIB interval width: ±20% in Ch. 7, ±10% in Appendix A.6 and B.4.** Ch. 7's numbers (project range
  [30.4, 45.6] = 38×0.8 and 38×1.2) and the data repository (`--halfwidth 0.2`, `RESULTS.md`) say **±20%**. Appendix A §A.6
  ("±10% relative half-width") and Appendix B §B.4 ("under ±10% duration uncertainty") are wrong. If an examiner
  notices, say "the appendix text is wrong; the chapter and the data are ±20%". Worth adding to the errata sheet.
- **N2. The Ch. 10 interval widening is described as "modest" but is large in failure terms.** ±5% on a pipe survival
  probability of 0.99 is a break probability moving from 1% to about 6%. The mean band of 0.36 and node 76 at [0.354, 0.990] follow from that
  compounding along ~16 pipes in series (my arithmetic: 0.806 × 0.95^n = 0.354 gives n ≈ 16). The civil engineer may say either "5% is unrealistically small"
  or "that is a huge uncertainty". Answer in §10.4 below.
- **N3. Ch. 11 says practical "to about fifty nodes" but the thesis reports exact results at 97 (Net3),
  242 (drone) and 306 nodes (metro).** The driver is conditioning width (ceiling about 18), not node count.
  Say that before they find it.

**Medium:**

- **N4. Ch. 10 §10.4 (p. 187) calls node 95 "the junction immediately downstream of the river pump".** The edge list
  (`net3.EDGES`: `2,95`; `95,97`) puts the river pump **from 95 to 97**, so 95 is the pump's **suction (upstream)** junction.
  "Downstream" is wrong, and "the point where the two supplies first meet" is not what node 95 is (it is on the river side only).
  Say "node 95, the junction at the river pump's inlet".
- **N5. Net3 capacity is demand-limited by construction.** Pipe capacity is the flow at 1.5 m/s through the
  stated diameter; so at baseline nothing binds and the answer is "the whole demand, 680.1". It is a statement about
  capacity, not about pressure; it is not independent evidence that Net3 is hydraulically adequate. Also, §10.3 says "the conservative end of the range in Section 10.3's convention": a
  self-reference; the 1.5 m/s convention is not stated anywhere else, so the answer to "why 1.5 m/s?" must come from you (assumed, conservative end of usual design velocities).
- **N6. Net3 schedule is a model output, not a forecast.** Dependencies are the flow orientation (a pipe is recommissioned only after its upstream pipes);
  one hour isolation, 8 h per pump and 24 h per tank are assumed; no parallel crews. "74 days" is the longest chain under that rule.
- **N7. Net3 reliability measures "no break in one year", not availability.** A pipe break stops supply only until repair (hours to days);
  the belief is the probability that no break occurs on a viable route over a year, i.e. a reliability, not an availability. Say so before being asked.
- **N8. "Exact interval range" is proved for the function but matched empirically for the algorithm.** Prop 5.6 proves the range of b(v) is the two corner
  values; the claim that the *propagation with interval arithmetic* attains it (the propagated interval equals the corner runs) rests on a multilinearity argument plus the
  match to 2.8×10^-16 on 129 graphs, and the weight w appears twice in w·A + (1−w)·B. Give the multilinearity argument, then the validation.
- **N9. Related-work gap: no credal networks / imprecise-reliability literature.** The thesis cites Ferson p-boxes, Williamson–Downs, Dempster–Shafer and fuzzy, but nothing on credal networks or interval-valued
  Bayesian-network inference (my reading: the obvious neighbour for "reachability as marginal inference with imprecise probabilities"). Neither does it cite imprecise-probability network reliability work
  from the supervisors' own area. A mathematician may ask "how does this relate to credal-network inference?". Honest answer in §2 below.
- **N10. No algorithm box for the PPA.** The headline algorithm is Eq. 5.5, 5.6 and §5.3 and §5.6 in prose. The examiner asking "state the algorithm" gets prose; have the five-line pseudocode in §A.2 ready.
- **N11. Ch. 5 §5.4: "2^10 component states" for the simple diamond.** The diamond has four uncertain nodes (the source has prior 1) and five uncertain edges: **9** uncertain components, so 2^9 = 512 states. (The same "two-to-the-ten" is in
  `SPEAKER_SCRIPT.md` slide 5.) Say "about five hundred states" or "2^9".

- **N21. The conditioning width is the one the algorithm *produces*, not shown to be the minimum the network *forces*.** Ch. 5 §5.8 says cost is governed by "the largest conditioning set the network forces", and the width-correlation figure (§5.8) correlates max |C| with the log of a *sifted* BDD size. But the module anchors each group on the *earliest* covering fork (a canonicity and reuse rule, §4.5.1), and minimality of the conditioning set is neither claimed nor proved; and sifting is itself a heuristic. So "same width as a BDD" is "heuristic against heuristic, correlated across the corpus". Say "the width our algorithm produces; it tracks the BDD's, and I do not claim it is minimal".

- **N22 [M]. Treewidth: the RESS paper positions the width against treewidth, the thesis does not say so as explicitly, and neither has a head-to-head junction-tree benchmark.** RESS (`PAPER_GUIDE.md` §5, `treewidth_sweep.jl`) states that max|C_d| is bounded by treewidth/pathwidth, that IPA ≈ 2^width as a well-ordered BDD ≈ 2^pathwidth and junction tree ≈ 2^treewidth, and that IPA is cutset conditioning specialised to reachability. Thesis Ch. 5 §5.8 says the cutset-conditioning specialisation and benchmarks the sifted BDD only. **Check the direction of the RESS claim** ("bounded by" versus "≥ pathwidth" in `REVIEWER_RESPONSE_map.md`) before quoting it: it is a claim that needs a proof, and N21 says minimality is not claimed. The RESS responses also cite the credal-network result (Mauá and Cozman 2020), so N9 is a thesis gap, not an RESS gap.
- **N23 [M]. Reproducibility claim versus the deferred clean-room re-run (from my 2 September notes, about five weeks old).** Ch. 8 §8.9 says reproducing a chapter is "installing the package…, checking out the archived repository at the cited tag, and running the scripts". My notes record that re-running the ≈ 22 cited scripts against the pinned release (compatibility shim, a few repointed calls) is deferred to a post-viva v1.1 tag; data, numbers and recorded responses are final. If asked, say that precisely.
- **N24 [L]. Ch. 9 §9.5 says the workspace holds "eight projects"** and lists a shell, five feature libraries and three shared libraries (nine); the repository has nine `project.json` files.
- **N25 [L]. "No request can arrive from elsewhere" (Ch. 8 §8.8) is true of the network, but loopback binding plus a CORS origin check is not authentication** (another process on the same machine can call it). The thesis claim is about data leaving the machine, which holds.
- **N26 [L]. Julia 1.13 fails (my notes: upstream `ProbabilityBoundsAnalysis` method overwriting becomes a hard error); the thesis only says 1.12.** Not in the thesis; post-viva.
- **N27 [M]. Net3's reliability and schedule numbers have no independent oracle run reported in Ch. 10** (the flow numbers were checked by independent Edmonds–Karp after the correction). Their exactness rests on the proofs and the corpus validation. Say "demonstration, not validation".
- **N28 [M]. "No score, ranking or threshold is computed in the interface" (Ch. 9 §9.4)** versus Compare-tab baseline differences (§9.3), the overlay's set intersection ("three nodes in both", §10.7) and the labelled midpoint tiles. They are arithmetic on returned values, not analyses, but they are numbers computed in the interface.
- **N29 [L]. Ch. 8 §8.3 says the facade re-exports "twelve names"** and lists five modules, two types and four entry points: eleven.

**Low (small, but a careful examiner may find them):**

- **N12.** Ch. 5 §5.7 "attributed to a difference in how the network was transcribed… or in the source's own evaluation" versus §5.12 and Ch. 11 "not explained": reconcile as "verified our computation; the cause on the published side is unknown".
- **N13.** Ch. 4 §4.4 defines the **eligibility** criterion in terms of declared *values* (prior 0, or a perfect source). So the decomposition is not purely topological. Ch. 5 says the eligibility test was "corrected" and "described in Chapter 4"; Ch. 4 describes the criterion but not as a correction.
- **N14.** Ch. 6 §6.7 "twelve networks, the ten DAGs of the Ch. 7 validation set with the three published drone designs in place of the larger drone network, plus the PSPLIB instance" reads as 13; Appendix B's table has 12 including PSPLIB. Say "twelve".
- **N15.** Appendix A §A.2 says "five published-reliability scenario folders" and then names three. Appendix A §A.12 gives random graphs as "10 to 28 nodes" and "node and edge probabilities uniform at 0.9"; Ch. 5 §5.7 says 10 to 25 nodes (the 28 is the mutant base) and priors drawn from (0.3, 0.99). Pin which is right before quoting.
- **N16.** Thesis-data DOI: Ch. 8 and App. B give `10.5281/zenodo.22821351`; my notes from 2 September record the concept DOI as `10.5281/zenodo.22180227` (app: `…22180253`, matches). A later version DOI is the likely reason. **Open the DOI before Friday.**
- **N17.** Ch. 10: Net3's pipe 330 (60→601) is `Closed` in the `.inp`; it is kept as an edge into a dead-end junction (node 96). It affects nothing, but "no link was dropped" is literally true for a closed pipe.
- **N18.** Ch. 7 §7.5 and Ch. 8 §8.5 record that an earlier interval implementation "was withdrawn because it produced wrong results". It is in the thesis, so be ready to give the two-line account (overloaded `max` on overlapping intervals; interval subtraction of dependent quantities gives [−16, 16] where the float is 0).
- **N19.** A code comment in the package (`Input.jl`) says the positive operator was "validated sound vs Monte Carlo… 20/20"; the thesis says **50** configurations. Quote 50 (the later sweep); do not quote 20.
- **N20.** The server's capacity handler returns degradation thresholds but **no upgrade thresholds** (zero occurrences of "upgrade" in `CapacityHandlers.jl`); the package computes them (`find_upgrade_threshold`). Contribution 4 lists both; the interface cannot show upgrades. Not a thesis error (Ch. 9 does not claim it), but "show me an upgrade threshold in the interface" cannot be done.

### A new independent check (power-network residual), so you can answer "how do you know?"

The question in §5.7 is why our values at R = 0.9 and 0.3 differ from Tong and Tien's published numbers by 1.8×10^-3 and 5.1×10^-4. The thesis rests the claim "it is not a computation error" on the BDD oracle.
A mathematician can fairly say "two programs by the same author". So I added a third, deliberately primitive one: **enumerate all 2^27 states of the 27 link
states, propagate reachability from sources {1, 7, 18} to sink 23, and count the states by number of working links**. It shares nothing with the Julia code or the BDD.
Script: `scratchpad/power_bruteforce.py` (a few lines of numpy); run time 18 s; output persisted in `scratchpad/power_bruteforce_output.txt`:

```
states with sink reached: 8226511 of 134217728
R=0.9 : reliability = 0.85917198
R=0.99: reliability = 0.98968706
R=0.3 : reliability = 0.00272158
```

These equal the PPA and BDD values (0.85917, 0.98969, 0.00272) to every printed digit. Published: 0.85741, 0.98969, 0.00221. So the residual is **not in the computation**; it is between the topology we transcribed from Figure 11
and whatever produced the published numbers (or in the published numbers themselves). Note that the source's own method (Ch. 2 §2.2) is described as approximate, so the published values at 0.9 and 0.3 being not exactly the exact value is a live possibility; that is a hypothesis, not a finding.
This check is **not in the thesis**; say it as "I have since checked it a third way by exhaustive enumeration". The exhaustive count also gives the reliability polynomial: the
minimum number of working links on any viable state is 6 (three states with exactly six).

I then tried the two most obvious explanations of the gap, both with the same exhaustive method (scripts `power_remove_one.py`, `power_node_conventions.py`; outputs persisted beside them):
**(a)** the published figure has one link fewer than the 27 we used: I removed each of the 27 links in turn and recomputed all three regimes; **no single removal reproduces the published triple** (closest at R = 0.9 is removing (2,3), (3,4) or (4,5): 0.85769, but those give 0.00270 at R = 0.3 against a published 0.00221). The thesis already reports that *adding* the one edge the figure could be read as containing makes every regime worse (by 2.8×10⁻² at R = 0.9). **(b)** reading R_l as a *node* reliability with perfect links: 0.759, 0.980, 0.0008, far off.
So the residual is not a one-edge transcription slip in either direction, and not a node-versus-link convention. What is left is something I cannot test from the thesis: that the published values at 0.9 and 0.3 are not exact for this topology (the source's own method is described as approximate in Ch. 2 §2.2), or a different input convention. State it that way: "ruled out the obvious transcription explanations; our value is confirmed three ways; cause on the published side unresolved". These two sweeps are **not in the thesis**; they are my own checks, offered as extra ammunition, not as results to quote as thesis findings.

### If time is short, read in this order

1. This section. 2. Part A, entries A.1 (diamond), A.2 (PPA), A.4 (p-box). 3. §10 (Net3) and §5 weak spots. 4. Part D (ten points, inconsistency table).

---

# PART A: THE CONTRIBUTIONS AND THE SIX ALGORITHMS

## A.0 The six contributions: claim, evidence, strength, challenge

Ch. 1 §1.4 (pp. 6–7) lists six; Ch. 11 §11.3 (p. 202) restates them chapter by chapter ("have each been delivered").
Strength scale used below: **Proved** (a theorem in the thesis covers it, under stated hypotheses) · **Validated** (agrees with an independent
oracle on a stated corpus, no theorem) · **Demonstrated** (shown working on an example, no independent check or proof).

### Contribution 1. A network model and its graph object (Ch. 3)

**Claim.** A system is a finite DAG with sources, sinks, forks, joins. The graph object adds, "in one pass", a layered topological order,
the self-inclusive ancestor and descendant closure of every node and the node roles. Every analysis reads it. An input module builds it from edge lists
and adjacency matrices and attaches analysis inputs from a JSON contract declaring the value form and analysis class.

**Substantiation.** Definitions 3.1–3.3 (§3.4, pp. 28–29); Theorem 3.4 (layered order, p. 31) by induction on |V|; Algorithm 1 (p. 32, layers plus
closures in one Kahn-style pass, O(|V|+|E|) for layers, O(|V|²) worst-case space for closures); input contracts (Table 3.2, p. 36);
the package types (Ch. 8 Table 8.2); "no imports between toolkits" (Ch. 8 §8.3, p. 156) and the lint rule in the interface (Ch. 9 §9.5).

**Strength.** Definitional plus one easy proof plus engineering demonstration. This is the weakest *mathematical* contribution and the strongest *architectural* one.

**Challenge and answer.**
- *Mathematician:* "A DAG with a topological sort is textbook. What is the contribution?" → The object, not the graph theory: layers, full closures and roles computed once and shared;
  a value-form contract (deterministic / interval / p-box) in one place; and the demonstration (Ch. 10) that three analyses with different semantics read it unchanged.
  Do not claim graph-theoretic novelty.
- *Mathematician:* "The closures cost O(|V|²) space." → Stated (§3.5). It is the trade for O(1) ancestry queries that the decomposition makes many thousands of times; Ch. 8 §8.6 says that on the densest corpus graphs closures are the largest structure in memory.
- *Engineer:* "Why must I turn my EPANET file into an edge list myself?" → Stated limitation (§3.7, Ch. 8 §8.10, Ch. 9 §9.8): no domain-format converters; converters exist in the data repository for the case studies.

### Contribution 2. A network decomposition module (Ch. 4)

**Claim.** The module "identifies every instance of a subgraph pattern", the diamond as default. Each unique diamond is stored once as a graph object of the same form as the network, and "the identification is proved to be complete, deterministic and terminating".

**Substantiation.** Theorems 4.4 (grouping), 4.5 (disjointness), 4.6 (termination), 4.9 (completeness), 4.10 (determinism), Lemma 4.7 (edge isolation), Proposition 4.8 (context-aware identity); three worked examples (§4.8, "machine-checked output of the implementation"); the whole of Ch. 5's oracle validation depends on it (a missed diamond gives an inexact belief).

**Strength.** **Proved**, with three caveats you should state yourself: (a) Theorem 4.9 is stated for the **top-level pass** (E = ∅); completeness of nested sub-diamonds is the same argument applied under E ≠ ∅ in the recursion, but is not a separate theorem;
(b) no complexity bound for identification is given (the practical limit is memory, Ch. 8 §8.6); (c) "generic over patterns" is **untested**: "No second pattern has been defined here to exercise it" (§4.9, p. 57).

**Challenge and answer.** See entry A.1.

### Contribution 3. The Probability Propagation Toolkit (Ch. 5)

**Claim.** The PPA computes, for every node, the exact probability that it operates and is reached from a source, in one pass, resolving each reconvergence by conditioning on the diamond there. Same propagation for deterministic, interval and p-box inputs: **exact** reliability; **exact range** for intervals "by a monotonicity argument"; **sound bounds** on the distribution for p-boxes. Validated against BDDs, path enumeration and Monte Carlo on 129 random networks, structured families, benchmark networks and a real medical logistics network.

**Substantiation.** Prop 5.1; Lemmas 5.2–5.5; Prop 5.6 (§5.5–5.9); corpus validation (§5.7); complexity (§5.8); p-box (§5.10); drone case study (§5.11).

**Strength.** Point: **proved** + oracle (worst 1.1×10⁻¹⁶). Interval: range **proved** (Prop 5.6); that the *algorithm* attains it is **validated** (match to corner runs ≤ 2.8×10⁻¹⁶) with a multilinearity argument. p-box with Fréchet blend: **proved** by the classical theorem. p-box **default** (positive dependence): **validated** (no violation in 50 configurations), **not proved**.

**Challenge and answer.** See entries A.2–A.4.

### Contribution 4. The Capacity Flow Toolkit (Ch. 6)

**Claim.** For point-valued capacities: maximum throughput, minimum cuts, saturated edges, single points of failure, degradation and upgrade thresholds, path-disjoint redundancy, "with every solution checked for feasibility, conservation and max-flow min-cut agreement".

**Substantiation.** Prop 6.1 and node-splitting (§6.3); solvers (§6.4); six questions (§6.5); Picard–Queyranne Thm 6.5; validation on 12 networks (§6.7); IEEE RTS-24 (§6.8.2); genrmf scale (§6.8.3).

**Strength.** Reductions **proved**; minimum-cut lattice rests on a **cited** theorem; thresholds **argued** (piecewise linearity) and **validated** by bisection and oracle evaluation either side; everything else **validated** against `GraphsFlows.jl` and brute force.
Ch. 6 says plainly: "What is new in this chapter is the collection of these answers on one graph object, with every one of them checked" (§6.1). Use that sentence; do not claim a new max-flow algorithm.

**Challenge and answer.** See entry A.5.

### Contribution 5. The Critical Path Toolkit, generalised over the propagated quantity (Ch. 7)

**Claim.** The classical method is one instance of a family defined by an operator pair; a backward pass exists only for pairs whose algebra supports one. For interval durations the forward quantities are exact by two corner runs; floats exact by a domination split reducing enumeration from every uncertain duration to those that can bypass the node.

**Substantiation.** Modes (Table 7.1), kernels (Alg. 5, 6), Prop 7.1, Lemmas 7.2–7.3, Thm 7.4, Alg. 7; validation §7.7; PSPLIB j301_1 (§7.8.1); dense-mesh boundary (§7.8.2).

**Strength.** Forward exactness **proved** (monotone); split **proved** for LongestPath with point edge values; validated against a path oracle, corner enumeration and 50,000-sample Monte Carlo. "Whether a proposed new mode has a backward pass is a mathematical question the implementation does not check" (§7.9).

**Challenge and answer.** See entry A.6.

### Contribution 6. Delivery as a package and an interface (Ch. 8, 9)

**Claim.** The framework is a Julia package; the package is the server behind a browser interface that runs entirely on the user's machine; it accepts the same files the package reads and returns results in the form the inputs were given.

**Strength.** **Demonstrated** (Ch. 10 walks the whole sequence with recorded requests and responses). Explicitly **not** user-tested: "has not yet been used independently by an engineer who does not program" (§9.7, p. 180).

**Challenge and answer.** See Part B.

---

## A.1 Diamond identification (Ch. 4, Algorithm 2)

**Problem.** Find every place where redundant routes reconverge with shared upstream structure, once, independently of any analysis. **Input:** the graph object (G, layers L, closures). **Output:** `unique_subgraphs`, a store of diamonds, each a graph object (Table 4.1, p. 52) with its conditioning set C, local sources, nested sub-diamond table and an `is_maximal` flag.

**Vocabulary (use exactly).** Influencing set of a parent *p* under fixed context *E*: infl(p,E) = Anc(p) \ E (self-inclusive closure). Two parents are structurally correlated under E iff their influencing sets intersect. **Diamond join**: a join where an unsettled fork lies in the shared ancestry of two parents, or one unsettled parent is an ancestor of another (Def. in §4.4, p. 42). **Non-influencing set**: parents whose influencing sets meet no other parent's; their edges are carried alongside as independent contributions. **Maximal diamond**: the full reconvergent subgraph at a diamond join (every diamond join has at most one; a fork can be in several). **Sub-diamond**: one found deeper inside a maximal diamond. **Induced** diamond: one fork, one join (the smallest). The set of unique diamonds = distinct maximal diamonds plus their sub-diamonds (§4.4).

**Algorithm 2 in prose.** For every join *v* of G, start with context E = ∅ and the join's parents P:
1. Partition P into groups by pairwise intersection of influencing sets, by union–find (Thm 4.4: this is exactly the connected components of the intersection graph).
2. For each group of two or more: choose the **earliest covering fork** *f*: among eligible nodes lying in the shared ancestry of at least two group members and not already in E (a member that is an ancestor of another counts as its own cover), the one with minimum topological index topi (a strict total order refining the layers). If none exists, the members go to the non-influencing set.
3. Build the diamond under boundary B = E ∪ {f}: relevant set R = {v} ∪ G ∪ ⋃Anc(p); edge list E_D = {(u,w) ∈ E : u,w ∈ R, w ∉ B, (w ≠ v or u ∈ G)}. The third clause cuts edges into fixed nodes (they act as local sources); the fourth admits an edge into the join only from the group (Lemma 4.7, Figure 4.6).
4. Look up the identity key hkey(D) = (E_D, {f} ∪ (E ∩ V(E_D))) in `unique_subgraphs`; reuse if present (hash-consing, as in BDDs).
5. Recurse at every join *j* inside D with context B (restricted to G when j = v).
6. Singleton groups join the non-influencing set.

**Correctness arguments (2–4 lines each).**
- **Thm 4.4 Grouping:** union–find over the pairwise-intersection relation returns exactly the components of the graph H on P.
- **Thm 4.5 Disjointness:** distinct groups' unions of influencing sets are disjoint (every cross pair was tested and found empty).
- **Thm 4.6 Termination:** each recursive call fixes a fork not already in E, so |V \ E| strictly decreases; at most |V| nested extensions along any path.
- **Lemma 4.7 Edge isolation:** every path in E_D into v ends in an edge from G; no node of B appears on a path except first. It is what blocks a direct edge (r, v) from a previously-fixed r from giving the diamond a second entry.
- **Prop 4.8 Identity:** (i) edge list plus fork can conflate a maximal diamond with a sub-diamond (same E_D, same f, different context), so the key must include E ∩ V(E_D). (ii) Equal keys imply the same join, group, edge list and set C.
- **Thm 4.9 Completeness:** a join gets a maximal diamond iff it has distinct parents p, q and an unsettled *a* that is a fork in Anc(p) ∩ Anc(q), or p ∈ Anc(q). (⇒ the group has coverage ≥ 2, so a covering fork exists; the topi-minimal one is anchored. ⇐ every admissible covering fork would give such a pair.)
- **Thm 4.10 Determinism:** each step is a function of its arguments only; partition is order-independent (Thm 4.4); fork choice is a unique minimum; store reuse is justified by Prop 4.8(ii).

**Complexity.** **No bound is stated in Ch. 4.** What the thesis does say: identification is bounded by memory, not time; on the largest networks it fails with out-of-memory (Ch. 8 §8.6; bnlearn width ≈21, dense drone designs "identification alone did not complete", Ch. 5 §5.8, §5.11). Counts you can quote: KarlNetwork (26 nodes, 74 edges) 18 maximal / 147 unique diamonds, max |C| = 11; grid-graph (16 nodes) 8 / 41, |C| = 7; Net3 21 / 307, width 12 (Ch. 5 Table 5.2; Ch. 10 §10.2). Do **not** invent an O(·) bound.

**What is new compared with Ch. 2.** Factoring conditions on one component (Satyanarayana–Chang); series–parallel reduction collapses pairs; tree decomposition uses bags; BDDs hash-cons sub-diagrams. The module's units are different: a diamond is a local separator (fork plus conditioning context) discovered per join, keyed by a context-aware identity, stored once as a graph object of the same form as the network, and generic in three discriminators. Honest framing: it is a **specialisation of cutset conditioning with local separators and a hash-consed store**, packaged as a reusable module; the thesis itself says the propagation is "a specialisation of cutset conditioning" (§5.8).

**Validation.** Indirect and strong: any missed diamond breaks the belief against the BDD oracle on 129 graphs plus named and adversarial families. Direct: three worked examples run through the implementation (§4.8). Two identification faults were found and fixed by the validation scripts: context/key collision (now Prop 4.8) and the eligibility test (Ch. 8 §8.7). Note that an *extra* (over-identified) diamond would not show up as an inexact belief, only as cost; "only there" is Theorem 4.9's converse.

**Code match.** Thesis names: `identify_diamonds` / `new_identify`, `unique_subgraphs`, `is_det` (eligibility), `topi`. Package: `Diamonds` module, 6 files, 3,355 lines (Ch. 8 Table 8.1). **I did not read the Diamonds code line by line**; I only checked that the p-box side of the probability module matches Ch. 5.

**Likely questions: mathematician.**
1. *"What does completeness claim, exactly? Of the diamonds, or of the conditioning?"* → Thm 4.9 (p. 51): every join with an unsettled shared fork or ancestor-parent pair gets a maximal diamond, and joins without one get none. Nested diamonds come from re-applying the same test under extended context (§4.5.2). That the resulting conditioning gives the right *probability* is a different claim, proved in Ch. 5 (Lemmas 5.2–5.5); Ch. 4 says so explicitly (§4.5.1, after Thm 4.5).
2. *"Why the earliest covering fork? Is the conditioning set minimal?"* → The thesis gives the reason as canonicity and reuse: the earliest fork "leaves the largest part of the group's shared structure intact downstream for reuse", and the strict total order makes it unique (§4.5.1). **Minimality of the conditioning set is not claimed** and is not proved. (My reading: choosing a different covering fork would still terminate and still give a correct belief, because correctness only needs the parents' influencing sets to become disjoint; but the width, and so the cost, could differ. Finding a minimum conditioning set is a separator problem I would expect to be hard in general. This is new weak spot **N21**.) The thesis compares against a **sifted** BDD, also a heuristic, so the width comparison is heuristic against heuristic.
3. *"Why must the key include the context?"* → Prop 4.8(i): there are graphs and contexts where the same edge list and fork arise as a maximal diamond and as a sub-diamond. Without the context, the store would conflate them. The collision was found on reconvergent grids under non-unit priors.
4. *"Is 'complete, deterministic, terminating' a statement about the implementation or the algorithm?"* → The algorithm (Algorithm 2). The implementation is checked by the oracle runs and the worked examples; no formal verification.
5. *"Complexity?"* → Not proved. Per diamond the cost is dominated downstream by 2^|C| (Ch. 5); identification's limit is memory. State that honestly rather than guess.
6. *"Your eligibility criterion depends on the *values*, so the decomposition is not purely topological."* → True (§4.4, p. 42): prior 0, or a perfect source (prior 1 *and* a source), makes a node deterministic and so ineligible; a non-source with prior 1 stays eligible because its in-edges can fail. The criterion is the one discriminator not drawn from the diamond's definition and is runtime-configurable.

**Likely questions: civil engineer.**
1. *"What is a diamond physically?"* → Two (or more) routes from one component to one downstream point: a duplicated pump train, a looped main. The join is where redundancy is supposed to help; the conditioning set is the component(s) whose state couples the routes.
2. *"Can I see these without the mathematics?"* → Yes: the Diamonds tab lists them with conditioning set and nesting; a diamond can be run alone or promoted to its own network (Ch. 9 Fig. 9.4).

**Weak spots (Ch. 4 algorithm).** No complexity bound; completeness stated at the top level; width not shown minimal (N21); genericity untested; values enter the eligibility test (N13).

---

## A.2 The Probability Propagation Algorithm (Ch. 5, Eqs. 5.1–5.6, §5.3, §5.6)

**Problem.** Given the graph object and the decomposition, compute b(v) = P(R_v = 1) for **every** node, where R_v = X_v ∧ (v ∈ S ∨ ⋁_{u∈Pa(v)} (R_u ∧ Y_uv)) (Eq. 5.1–5.2): the probability that v operates and is reached from at least one source. **Inputs:** node priors π_v and edge probabilities ρ_uv as floats, intervals or p-boxes, values in [0,1]. **Output:** the belief of every node in the form the inputs were given.
Computing b(v) subsumes two-terminal reliability, hence #P-hard (Valiant 1979; Ball 1986): "the aim is exactness at a cost set by the structure of the particular network".

**The algorithm in prose.** There is no algorithm box (N10). In order:
1. Sources: b(s) = π_s.
2. For each layer in order, for each node v: the **signal** through parent p is S_p = b(p)·ρ_pv (Eq. 5.3). If the parent signals are independent, b(v) = π_v (1 − ∏_p (1 − b(p)ρ_pv)) (Eq. 5.5); a single parent gives the chain rule.
3. At a join with diamonds (from the module): split the parents into the module's groups plus the non-influencing singletons. The group events are independent (Lemma 5.4), so P(signal) = 1 − ∏_k (1 − P(E_k)); each singleton is one more factor.
4. For a group with conditioning set C = {a₁…a_m}: P(E_k) = Σ_{c∈{0,1}^m} w(c) ψ(c) (Eq. 5.6), weights w(c) = ∏ b(a_i)^{c_i}(1−b(a_i))^{1−c_i}. For each state c, **pose the diamond as a network of its own** (conditioning nodes pinned to c, other local sources at their contextual beliefs, join's own prior set to 1), run the same pass, and read ψ(c) at the join. The solved diamond is a **supernode** delivering a signal with probability ψ(c).
5. Nested diamonds are resolved inside each state's sub-run, inside out. Two savings: every solved sub-problem is stored under (edge list, local-source values); a conditioning node already pinned to 0 or 1 collapses its enumeration to one state.
6. b(v) = π_v × P(signal at v).

**Five-line version for the board:** `b(s)=π_s` · `for layer, for v: groups ← module(v)` · `P_k ← Σ_c w(c)·ψ_D(c)` (recursive same-pass call) · `P(signal) ← 1 − ∏(1−P_k) ∏(1−b(p)ρ)` · `b(v) ← π_v · P(signal)`.

**Correctness argument.** Hypotheses: the four assumptions of Ch. 3 §3.8, notably **independent binary components**.
- **Prop 5.1 Monotonicity:** realise each indicator from its own uniform; raising a prior can only flip an indicator 0→1, and R_v is monotone; so b(v) is non-decreasing in every input.
- **Lemma 5.2 Conditional invariance:** law of total probability over R_A = c.
- **Lemma 5.3 Separator sufficiency:** if fixed nodes enter only as pinned local sources and the parents' influencing sets are pairwise disjoint, then given R_C = c the parents' signal events are mutually independent (functions of disjoint sets of independent indicators), so Eq. 5.5 applies conditionally.
- **Lemma 5.4 Recombination across groups:** group disjointness (Thm 4.5) gives independent group events; union rule applies. This is where the cost drops from 2^(Σ|C_k|) to Σ2^|C_k|.
- **Lemma 5.5 Supernode equivalence:** conditional on R_C = c, D's delivery event depends only on D's internal indicators, independent of everything outside, so replacing D by a supernode with probability ψ_D(c) leaves every downstream belief unchanged.
- **Exactness:** induction on nesting depth; termination inherited from Thm 4.6.

Where the proof is thin: Lemma 5.5's independence step relies on the decomposition guaranteeing that the enclosing computation fixes no node internal to D, via the context-aware identity of Prop 4.8. So "proved" is a chain of lemmas across Ch. 4 and 5; the 10⁻¹⁶ agreement with the BDD on 129 graphs is what protects against a gap in the chain.

**Complexity.** One resolution costs 2^|C|·O(|E_D|); total work sums over *posings*, not unique diamonds; the store collapses posings to between 1 and 5 per cent of the unmemoised bound on the corpus; factorisation gives Σ_k 2^|C_k|; fan-in-k family: exactly **2k+1** sub-problems for every k up to 16 (Table 5.4); mesh-w: 3.9×10⁶ sub-problems at w = 8 against a diagram of 2,621 nodes. The governing parameter is the **largest conditioning set the network forces** (N21: the one the algorithm produces); practical ceiling about **18** ("around eighteen", §5.11); drone designs at width 16 are practical, a bnlearn network at width ≈21 exhausted memory at identification (and the diagram exhausted its time budget on the same network). Interval costs ×1.2 over point.
**Honest statement of the comparison (Ch. 5 §5.8, Ch. 11):** "never structurally better than a well-ordered diagram for exact point-valued reliability: the two tie on independent structure and the diagram wins on dense correlated structure."

**What is new compared with Ch. 2.** Not the asymptotics. Against cutset conditioning (Pearl 1988): the separator is local per reconvergence and recursive, independent groups are factorised, sub-problems are shared. Against junction trees: no global tree. Against BDDs: native interval and p-box propagation, no diagram, and a one-shot interval range for every node. Against Tong and Tien's directed probability propagation: exact, not pairwise-approximate. The method was first published as the Information Propagation Method (ICSRS 2023); the RESS paper covers the proofs and the imprecise extensions.

**Validation.** Oracle: reduced ordered BDD with dynamic reordering, built independently per network (sifting keeps every corpus graph ≤ 20,323 nodes; naive order exceeds 2.5×10⁶). Corpus: **129** = 120 random + 8 mutants + 1 adversarial counterexample, two regimes, worst per-node deviation **1.1×10⁻¹⁶** (point), **2.8×10⁻¹⁶** (interval). Table 5.2: four named networks, worst deviations 5.6×10⁻¹⁷ to 1.1×10⁻¹⁶. Published benchmarks: the 16-node grid reproduces all 26 published values to within 5×10⁻⁶ (half a unit of the last published digit); the 23-node power network agrees at R = 0.99 and leaves a residual at 0.9 (+1.76×10⁻³) and 0.3 (+5.1×10⁻⁴), **now additionally confirmed by exhaustive enumeration** (see the top section). Seventeen bnlearn networks: identification under 2 s each; propagation completed on 16. The worked network (§5.6.1, Table 5.1): twenty conditioned sub-problems, sixteen distinct; b(T) = 0.806149.

**Code match.** `Probability` module (6 files, 747 lines), entry point `update_beliefs_iterative`; one source over three value forms through dispatch on helper functions (Ch. 8 Table 8.3). A lean store mode (off by default, ~100× smaller entries) exists for memory. Checked: p-box operator in the package (`Input.jl:145–154`) matches Ch. 5 §5.10 (below).

**Likely questions: mathematician.**
1. *"State and prove that your update is exact at a join with two diamonds and a plain parent."* → Lemma 5.4 gives independence of the groups' events (disjoint influencing sets, Thm 4.5); Lemma 5.3 gives conditional independence inside each group given its conditioning states; so P(signal) = 1 − (1−P(E₁))(1−P(E₂))(1−b(p)ρ). Worked numbers at join 6 of the worked network: 1 − (1−0.720108)(1−0.590490) = 0.885382, then × 0.9 = 0.796843.
2. *"Where precisely is independence used, and what if it fails?"* → Lemmas 5.3 and 5.4 (functions of disjoint sets of independent indicators) and the model assumption 1. If components share a common cause the result is not valid; the model remedy is a shared upstream node (Ch. 3 §3.8).
3. *"Cutset conditioning is Pearl 1988. What is new?"* → see above; give the three differences (local separator, factorisation, store) and concede the specialisation (§5.8).
4. *"Exact in floating point?"* → The proofs are over the reals; "exact" in the tables means agreement with an independently computed oracle to 10⁻¹⁶, i.e. round-off. No machine-checked proof.
5. *"Your belief is not the same as the two-terminal reliability; what about the correlation between nodes?"* → b(v) is the marginal for one node at a time; the joint distribution of several nodes is not computed (not claimed).
6. *"Complexity claims: you say 'practical to about fifty nodes' and report 306 nodes."* → See N3: the driver is width (ceiling ≈18), not node count; the 50-node phrase describes dense or deeply reconvergent structure.
7. *"What if the prior is exactly one on a non-source node?"* → handled by the eligibility rule (§4.4); the original test excluded such nodes and found no diamonds when all priors were one; found on the real networks (drone hubs, Net3), not the synthetic corpus (§5.7.1).

**Likely questions: civil engineer.**
1. *"Where do the probabilities come from?"* → In the thesis case studies: Net3, pipe-break rates by diameter class from the Utah State University survey, Poisson probability of no break over a year, pumps 0.99 (general guidance, "no figure exists for these pumps"); drone: the source study's own 0.2 non-hub failure assumption, hub availability 1, with a ±5% interval. The toolkit takes whatever the engineer supplies.
2. *"Does independence hold for a real network?"* → No, common causes (power supply, a shared trench, one valve) are outside the model unless represented as a shared upstream node; the thesis says every result is conditional on it.
3. *"What decision does a belief of 0.81 or a band [0.35, 0.99] support?"* → Where to spend: a facility confidently at 0.6 needs better routes; one anywhere in [0.56, 0.72] needs better component data first (Islay Hospital, §5.11.3).

**Weak spots.** N8 (algorithm versus function exactness), N10 (no algorithm box), N11 (2^9 not 2^10), N21 (width not shown minimal), N3, N12.

---

## A.3 Interval propagation (Ch. 5 §5.9.1, pp. 77–79)

**Problem.** Inputs π_v ∈ [π̲_v, π̄_v] and ρ_uv ∈ [ρ̲_uv, ρ̄_uv]; output the **exact range** of b(v) over all inputs consistent with the intervals, for every node, in one pass.

**How.** Prop 5.6 (Corner exactness): by monotonicity (Prop 5.1) the range is [b at all lower endpoints, b at all upper endpoints]. The implementation does not just run the two scalar corners; it runs the *same propagation on an Interval type* (Ch. 8 Table 8.3: corner product, complement [1−ā, 1−a̲], conditional combine by corner enumeration) and the proposition plus the validation say the result equals the corner runs. Three reasons the arithmetic stays exact (§5.9.1): complement and product are exact interval operations; the product form (Eq. 5.5) presents each signal to the arithmetic **once**; and the conditioning combination (Eq. 5.6) is **multilinear** in each conditioning belief, and a multilinear function over a box attains its extremes at corners, so evaluating at the endpoints suffices. Structural certainties are kept degenerate (a perfect source stays [1,1]) because widening a certainty "poses a different and harder problem" (it changes which nodes can carry conditioning).

**Correctness.** Range: proved (monotone function over a box). Algorithm attains it: the multilinearity argument above plus the empirical match to the two corner runs, **at worst 2.8×10⁻¹⁶** over all 129 graphs; worked network widened to [0.85, 0.95]: target [0.634002, 0.931254] matching the corner runs "to the last floating-point digit". Honest: the weight *w* appears twice in w·A + (1−w)·B, so naive interval arithmetic would over-widen; the thesis avoids it by endpoint evaluation (N8).

**Complexity.** About ×1.2 over point propagation; the conditioning depth is unchanged (imprecision never relaxes the structural cost). One-shot cost versus "build the diagram once, evaluate its two corners": faster on all eight families tested, by factors **3.9 to 99.9**; **scoped** to one-shot queries: "a workload that amortises one diagram across many repeated queries on a fixed network is a different and untested scenario" (p. 79).

**New compared with Ch. 2.** Be careful: the corner argument for monotone functions is classical and Ch. 2 §2.5.1 says so ("This observation is used in Chapters 5 and 7"). A BDD can also be evaluated at two corners for the exact range of the *point* belief. What the thesis offers: the range at **every node in one pass**, with no diagram to build, and the **same machinery** carrying p-boxes. Do not claim the monotonicity trick as new.

**Validation.** Coincides with corner runs ≤ 2.8×10⁻¹⁶ on 129 graphs; ignoring reconvergence "stays sound but over-widens, by up to 0.45 of the unit range" (so conditioning matters even for intervals); drone: bands 0.089–0.094 mean, 0.161 max (Table 5.7); Net3 ±5%: mean band 0.363, max 0.636 at node 76.

**Likely questions: mathematician.**
1. *"The BDD with interval probabilities is exact by the same monotonicity. So?"* → Agreed for a single query; the comparison in §5.9.1 is one-shot cost (diagram construction counted against it), 3.9–99.9× in the toolkit's favour, scoped; and the toolkit gives every node at once. The diagram has no analytic route to a distribution bound; p-boxes are where the gap is real.
2. *"Exact range of what? Do the intervals vary independently?"* → Yes, each input independently in its box; if two uncertain inputs are really correlated, the exact range of the independent box is a superset of the true one. True of any interval method.
3. *"How do you know the propagated interval equals the corner runs, not just contains it?"* → Multilinearity at the conditioning step, exact complement and product, each signal once; confirmed to 2.8×10⁻¹⁶ against the corner runs on all 129 graphs.
4. *"How does this relate to credal networks / interval-valued Bayesian-network inference?"* → (N9; not in the thesis.) Reachability from a source is marginal inference on a directed graphical model (Ch. 2 §2.2 says so); interval-valued probabilities there give a credal-network problem, which is NP-hard in general (my reading of the literature), but the **monotone** structure here (R_v is a monotone Boolean function and the inputs are independent intervals) is what makes the two corners exact. A general credal-network query has no such monotonicity. Say that and offer to add the reference.

**Likely questions: civil engineer.**
1. *"What does a band mean to me?"* → Under the stated range on each input, the true reachability lies in the band whatever the inputs are within it; a facility whose band is wide needs data before capital.
2. *"Is ±5% a realistic uncertainty?"* → See N2: on survival probability 0.99 it is a break probability from 1% to 6%; it is a stress test, not a calibrated uncertainty; the thesis does not calibrate it.

**Weak spots.** N2, N8, "novelty is not the corner argument", credal-network literature absent (N9), amortised-query scenario untested.

---

## A.4 p-box propagation and its two recombination operators (Ch. 5 §5.10, pp. 79–84)

**Problem.** Inputs are p-boxes (a pair of bounding CDFs \(\underline F \le \overline F\)); output a p-box bounding the distribution of each belief b(v), from which a requirement-violation probability P(b(v) ≤ x*) can be bounded analytically.

**Why not convolve (§5.10.1).** The conditioning combination, taking conditioning nodes one at a time, is the convex combination **W·A + (1−W)·B**, with W the conditioning node's contextual belief and A, B the conditional results of its two states. Two dependencies bind them: A and B are functions of the *same upstream reliabilities* (so dependent), and the two coefficients W and 1−W are *one random variable*. Convolving as independent ignores both and is **unsound**: mass escapes [0,1] by up to **0.34** on the benchmark grid.

**The operator in prose.** At each discretisation level of W's bounding functions: scale the two branch distributions by w and 1−w and combine them under an explicit **dependence bound**; mix the results across levels; envelope the mixture built on W's lower bounding function with the one built on its upper. Applied one conditioning node at a time, the nested two-way combination "reproduces the full mixture over all 2^|C| states" (stated in the text, not proved). The output is intersected with [0,1] (discarding only values a probability cannot take), guarded by an error if the excursion exceeds round-off by orders of magnitude, so that a soundness regression cannot hide in the projection.

**Two dependence bounds.**
- **Fréchet–Hoeffding:** valid under *any* joint dependence; soundness inherited from a classical theorem (Williamson–Downs); costs width, "on hard cases the width can approach vacuity".
- **Positive-dependence (the default):** restricts to non-negative dependence on the ground that A and B are both non-decreasing functions of the shared upstream reliabilities and "cannot move against each other". **In the code** (`InformationPropagationAnalysis.jl/src/Input/Input.jl:145–154`) this is `PBA.env(PBA.convIndep(x,y,op=+), PBA.convPerfect(x,y,op=+))`: the pointwise **envelope of the independent and the comonotone (perfect) convolutions**; `PBOX_COND_BLEND[]` defaults to `:positive`, and `:frechet` switches to `PBA.convFrechet`. That matches the thesis description. (A code comment cites "20/20" sound against Monte Carlo; the thesis says 50 configurations; quote 50.)

**What is proved and what is not.**
- **Proved (classical):** the Fréchet operator is sound for any dependence; the chain and union steps are standard p-box arithmetic under independence because the quantities are independent for the structural reason of Ch. 5; the whole is sound "at the discretisation level up to floating-point round-off, as is standard for Williamson–Downs arithmetic" (§5.12).
- **Not proved:** soundness of the positive-dependence operator. The thesis states why the natural route fails: "the dependence-bound literature offers a strict trichotomy, independence, a fully specified dependence, or no assumption at all, with no theorem for positive-but-otherwise-unknown dependence", and "the comparison function is not uniformly ordered, and independent against comonotone uniform inputs gives combined distributions that cross" (§5.10.2, p. 81).
- **My reading of why they cross (mine, not the thesis's; say it only if you are comfortable):** positive dependence orders sums in the *convex* (concordance) order, not the first-order stochastic order; the independent and comonotone sums have the same mean, so their CDFs must cross; therefore there is no pointwise stochastic ordering with which to sandwich an intermediate dependence, and the pointwise envelope of the two extremes is not guaranteed to contain a dependence strictly between them. That is the obstruction.
- **The practical distinction the thesis keeps:** positive operator is the default; Fréchet is "used wherever a claim must rest on proof alone".

**Complexity.** Cost grows faster than quadratically with the discretisation level L: factors per doubling about 5, 6.5, 7.1 (reference network n15: 1.2 s, 6.0 s, 39 s, 276 s at L = 25, 50, 100, 200) and 2.5, 6.75, 7.8 (power network: 3.05, 7.76, 52.4, 407 s) (Table 5.6, p. 84). The practical band is **25 to 100**. Identification does not depend on L. The library default is **200**; KarlNetwork at the default ran 17 minutes without finishing, at L = 50 it completes in 546 s (the interface exposes no control, Ch. 9 §9.4). The conditioning depth is the same as for points and intervals: "a network too reconvergent for exact point propagation is equally beyond exact interval or distributional propagation".

**Tightness.** Soundness never varies across the sweep; tightness does. Band ≈ **0.18** of the unit range under high reliability and weak reconvergence, ≈ **0.70** under deep reconvergence and broad uncertainty; no violations anywhere. Certified band on P(b ≤ 0.95): 0.02 to 0.12 wide (Table 5.5), against **267 to 9,604** Monte Carlo samples to match under worst-case a-priori planning ("the planning figure is the one to quote").

**New compared with Ch. 2.** p-box arithmetic exists (Williamson–Downs, `ProbabilityBoundsAnalysis.jl`); what is new is its use through a conditioning recursion, the handling of the *branch dependence and the weight-as-one-variable* at the conditioning step, and the interpretation (a certified bound on a violation probability from a single propagation, which a decision diagram cannot give).

**Validation.** 50 configurations against Monte Carlo (shapes × widths × reconvergence regimes on the benchmark grid): no violations; hero CDF (twelve-node DAG): the toolkit's band brackets the Monte Carlo distribution, the convolution band is shifted and puts mass where the true distribution has none (Fig. 5.x, §5.10.1).

**Likely questions: mathematician.**
1. *"Is your p-box result sound?"* → Yes for the Fréchet operator, by a classical theorem. For the default operator: validated against Monte Carlo on 50 configurations, **not proved**; I say so in the thesis as an open problem. If a claim must rest on proof, I use the Fréchet operator.
2. *"Why can't you prove it?"* → The dependence-bound literature has no theorem for positive-but-unknown dependence; the ordering route fails because independent and comonotone sums have crossing CDFs.
3. *"Then why is it the default?"* → Because Fréchet is often close to vacuous on reconvergent networks while the positive operator is tight and, empirically, never violated; and the branches are both monotone in shared inputs. The default is a practical choice, labelled as such.
4. *"What does 'sound' mean here, formally?"* → The computed pair of bounding functions contains the true distribution function of the belief for every joint distribution consistent with the inputs (and, for the discretised arithmetic, up to round-off). *Tight* means narrow; a sound result can still be too wide to use (§5.10.2).
5. *"Is the output guaranteed inside [0,1]?"* → The projection discards only values a probability cannot take, so it can tighten but not invalidate; it raises an error if the excursion before projection exceeds round-off by orders of magnitude.
6. *"Why must the weight be treated as one variable?"* → Because W and 1−W are the same random quantity; convolving them as independent can assign mass outside [0,1] (up to 0.34 on the grid).

**Likely questions: civil engineer.**
1. *"When would I need a p-box rather than an interval?"* → When you know something about the shape (e.g. a distribution with uncertain parameters, or samples measured with limited precision) and want a certified bound on the *probability* that a facility falls below a requirement.
2. *"Can I run it on my network?"* → On small networks only (practical at levels 25–100); for larger ones the recommended combination is exact intervals plus Monte Carlo sampling (§5.10.4). Net3's p-box scenario was not run (Σ2^|C| = 5.5×10⁴).

**Weak spots.** The default is unproved (known); the comparison with Fréchet width is shown in a data file (`grid_envelope_frechet.csv`) I did not open; the nested two-way = full-mixture equivalence is asserted, not proved; "never vacuous in practice" is an empirical statement; and the interface cannot set the level.

---

## A.5 The Capacity Flow Toolkit's modules (Ch. 6)

**What it answers (Q1–Q6, §6.1).** Throughput; binding cuts and how many; most damaging failures; capacity change to hold or reach a target; path-disjoint redundancy; single points of failure. It reads the graph object directly, uses neither layers nor the decomposition module, and is **point-valued**.

### A.5.1 The model and reductions (§6.3)

DAG G, capacities c ≥ 0, optional node bounds b; maximise F subject to capacity, conservation, source and sink balance (Eqs. 6.1–6.4). **Prop 6.1** (super-terminal reduction): add s*, t* with infinite connector capacities; flows map in both directions without changing value. **Node capacities** by splitting v into v⁻, v⁺ joined by an edge of capacity b_v. Throughput margin Δ_t = F* − D_t.

### A.5.2 Solvers (§6.4)

Edmonds–Karp O(VE²), Dinic O(V²E) (default), push-relabel O(V²E)–O(V³) (no highest-label invariant); all three post-checked for capacity feasibility, conservation, flow = cut. Standard algorithms (Ahuja–Magnanti–Orlin): not claimed as new.

### A.5.3 The minimum-cut lattice and enumeration (§6.5.1, pp. 106–108)

**Definitions.** G_f residual graph; R_T nodes that can reach t* in G_f (backward traversal); **extended source partition** S** = V \ R_T (any node outside R_T cannot reach the sink, so S** as source side is also a minimum cut, S* ⊆ S**); **free zone** F = S** \ S*; every minimum cut has the form S*∪R with R ⊆ F.
**Theorem 6.5 (Picard–Queyranne 1980).** For R ⊆ F, S*∪R is a minimum cut iff R is closed under reachability in G_f. Hence **at most 2^|F|** minimum cuts, with equality only when no node of F reaches another in G_f; |F| = 0 means the minimum cut is unique. Example: power network with all capacities 60: F = {19,20,21}, residual chain 19→20→21, 4 of 8 subsets closed (∅, {21}, {20,21}, {19,20,21}) ✓.
**Edge sets.** E_some = saturated edges (u,v) with u ∈ S**, v ∉ S*, **v ∉ Reach_{G_f}(u)** (the added condition; if v is unreachable from u then S*∪Reach(u) is closed and separates them); E_every = saturated edges with u ∈ S*, v ∈ T** = V \ S**; E_every ⊆ E_some.
**Enumerator.** Iterates over subsets R ⊆ F in binary counting order and keeps those whose cut capacity equals F*; by Thm 6.5 these are exactly the closed subsets; `cut_limit`: if 2^|F| ≤ cut_limit all subsets are examined and `is_complete = true`; otherwise the first cut_limit subsets, `is_complete = false`. Cost O(2^|F|·E) regardless of output.

**Why Thm 6.5 holds (my short proof sketch, for if they ask).** S is a minimum cut iff no residual arc leaves S. S* is closed. For S*∪R: arcs from S* stay inside (closure); an arc from u ∈ R to v ∈ T** would make u reach the sink, contradicting u ∉ R_T; so the only arcs that could leave are u→v with v ∈ F \ R. Hence closed under reachability within F is necessary and sufficient. (The residual arcs in G_f via S* or T** add nothing, because S* has no outgoing residual arcs and nothing in S** reaches T**.)

**Questions: mathematician.**
1. *"State the theorem and where it enters."* → Thm 6.5 above; it replaces the submitted text ("exactly 2^|F|, any free-zone node can move alone"), which was wrong when free-zone nodes reach each other. No reported number changed.
2. *"Your enumerator is exponential in |F| even when the output is small. Why not enumerate closed sets with polynomial delay?"* → It enumerates all subsets and filters; cost O(2^|F|·E) whatever the number of minimum cuts. (My reading: enumerating the closed sets of a preorder, or all minimum cuts, is known to be possible with output-polynomial delay, so the exponential is in the implementation, not the problem.) The thesis accepts it because |F| was small in every case reported (0, 2, 3, 6) and offers `cut_limit` and `is_complete` for symmetric networks. A fair answer: "it is a limitation I would remove by enumerating closed sets directly".
3. *"What is a minimum cut here: a node partition or an edge set?"* → The count is of node partitions S*∪R ("24 minimum cuts over a free zone of six nodes" in degraded Net3: 24 closed subsets of 64). Whether distinct partitions always give distinct edge sets is not stated in the thesis, and I did not check it. If asked, say partitions, and that E_some and E_every are the edge-level summaries.
4. *"Is exactness claimed everywhere?"* → "Exactness in this chapter is on the evaluated candidates" (§6.9): sensitivity and failure modules restrict to saturated edges and E_some; an edge outside the candidate set cannot change F* by a *small* change in capacity, "but a large enough change can", and k-edge failure is exhaustive only over the candidate set. Say this yourself.

### A.5.4 Redundancy and single points of failure (§6.5.2)

Path enumeration by DFS on the topological sort, bounded by `path_limit` (returns a sample, not the full set); flow decomposition ranks paths by bottleneck flow φ(P) = min_i f*_{v_i v_{i+1}}; **structural SPOF**: node v ∉ S∪T with F*(G∖{v}) = 0, by one BFS per candidate in C = (fwd(S) ∩ bwd(T)) \ (S∪T), O(|C|(V+E)); redundancy by Menger (unit capacities). A node can be both a flow-limiting bottleneck and a SPOF.
*Note:* global edge and node connectivity of a DAG (min over all ordered pairs) is **zero** because a sink has no outgoing edge; the module "computed exactly that definition and therefore returned zero on every network"; a source-to-sink measure is future work (§6.9). Expect a quick question: "why report a metric that is always zero?" → It is documented and left as defined; the per-pair disjoint-path counts answer the redundancy question.

### A.5.5 Sensitivity and failure impact (§6.5.3–6.5.4)

All restricted to **saturated** edges (by max-flow min-cut every minimum cut consists of saturated edges): **critical-edge ranking** Δ*_uv = F*(c) − F*(c with c_uv = 0); **marginal capacity** μ_uv = (F*(c+δ at uv) − F*(c))/δ (a finite difference, so depends on δ); **marginal range** B_uv = F*(c_uv = ∞) − F*(c_uv = 0), "analogous to Birnbaum importance… the analogy is conceptual" (deterministic throughput range, not probability-weighted). **Failure impact:** single-edge (candidates E_some), **k-edge** over C(|E_some|, k) combinations (throws if above 10,000), **degradation** by override dictionary or uniform factor α ∈ [0,1].

### A.5.6 Degradation and upgrade thresholds (§6.5.5, pp. 111–113)

**Idea.** F*(c_e) is piecewise linear in a single capacity c_e; each linear segment corresponds to a fixed minimum-cut partition; breakpoints occur where the partition shifts. **Degradation threshold** c†_uv = inf{c ∈ [0, c_uv] : F*(c) ≥ D_t}; margin c_uv − c†_uv; ranked by ascending margin. **Partition-change recursion:** start with endpoints c = 0 and c = c_uv, evaluate F* at the midpoint, compare partitions; if both endpoints share a partition the segment is linear and the threshold is solved analytically; otherwise descend into the sub-interval containing D_t. Degenerate cases handled (F*(0) ≥ D_t; F*(c_uv) < D_t). **Upgrade threshold:** if F* < D_t, doubling search to bracket, then the same recursion; `upgrade_ineffective = true` if F* stops increasing before reaching D_t (edge on no minimum cut). Default D_t = 0.9·F*.

**Why it is exact (my proof sketch, not in the thesis).** F*(c_e) = min over cuts S of cap_S(c_e), and each cap_S is affine in c_e with slope 0 or 1, so F* is concave, non-decreasing and piecewise linear. If the same cut S is minimum at two points, then F* ≤ cap_S everywhere and, by concavity, F* ≥ the chord, which equals cap_S there; so F* = cap_S between them: linear. The recursion is therefore correct whenever "same partition at both endpoints" really means the same *minimum cut* is optimal at both. Cost O(lg(c/ε) T_s) / O(lg²(c/ε) T_s) (Table 6.2); note the ε in a method the text calls "exact": it bounds the recursion's depth, not the answer.
**Weak points:** no theorem in the thesis (the piecewise-linearity argument is in prose); the solver returns *a* representative minimum cut, so two endpoints can show different partitions while the segment is still linear (costs extra recursion, not correctness); the server and interface do **not** expose upgrade thresholds (N20).

**Complexity table (Table 6.2, p. 114).** Everything is "number of solves × cost per solve": critical edges O(|E_sat|·T_s), marginal range O(|E_some|·T_s), k-edge O(C(|E_s|,k)·T_s), thresholds O(lg(c/ε)·T_s) per edge.

**New compared with Ch. 2.** Max-flow min-cut, residual-graph min-cut structure, node splitting, Menger and Birnbaum are all classical (Ch. 2 §2.3); robust and stochastic flow are cited and **not implemented**. New: the collection on one graph object, the lattice with E_some/E_every, the parametric thresholds, and every output checked ("every one of them checked", §6.1).

**Validation.** 12 networks (Table B.2): three solvers agree with each other and with `GraphsFlows.jl` exactly; every flow passes capacity, conservation and flow = cut; enumerated cuts checked to have capacity F* and disconnect the sources; on networks with ≤ 20 candidate edges every disconnecting subset enumerated and the reported cuts confirmed to be exactly the minimal ones of minimum capacity; E_every/E_some checked against intersection/union of the enumeration; SPOF and single-edge ranking by exhaustive removal on small networks, 15–40 sampled removals on large; thresholds by evaluating the oracle just below and above and by bisection; Menger against a unit-capacity oracle; node-capacity against the split graph. **One error found:** the node-split identifiers 2v and 2v+1 collided with unsplit identifiers when only some nodes carry a capacity (found on RTS-24); fixed by assigning identifiers above the maximum. Scale: genrmf DAG variants up to 36,992 nodes / 107,644 edges: Dinic 0.657 s warm (the xlarge instance is faster than the large one, 0.961 s, which is structure-dependent), oracle 28.9 s (Table 6.10, B.3).

**Questions: civil engineer.**
1. *"Is max-flow with Q = vA a hydraulic model?"* → No. It is an upper bound on deliverable flow under stated capacities; it ignores head, pressure and how flow actually divides at junctions (in a pipe network flow is determined by hydraulics, not chosen to maximise delivery). "Upper bound under stated capacities" is the correct framing, and the toolkit is for finding which constraint binds, not for predicting pressures.
2. *"IEEE RTS-24: throughput equals demand. What did you learn?"* → That at peak load neither lines nor generators limit delivery under the net-injection model: 1,607 MW net import demand fully met, no SPOF, no single-line or generator failure reduces throughput; four generators (buses 1, 2, 13, 16) sit at nameplate and line 7–8 has 4 MVA of headroom (171 of 175), so those bind first if demand grows (Table 6.9). The thesis states the limits: it is aggregate throughput under a flow model; operational security (a remaining path overloading under redispatch) is a separate question. In power systems, flow follows Kirchhoff's laws and cannot be routed at will, so max-flow is again an upper bound.
3. *"You oriented the RTS by DC power flow at peak load. What about other loading?"* → Snapshot assumption (Ch. 3 §3.8, assumption 4): "a property of the operating snapshot being analysed".
4. *"What would you do with an enumeration of 24 minimum cuts?"* → It tells you the bottleneck is not unique, so one reinforcement may not lift throughput; Configuration A (4 cuts) versus B (1 cut) have the same F* = 37.0 but different places to reinforce.

**Weak spots.** Enumerator exponential regardless of output; "exact on candidates"; thresholds argued not proved and not exposed for upgrade in the interface; capacity is not hydraulics; RTS and Net3 results are demand-limited (they show slack, not stress); N14 (the count of validation networks).

---

## A.6 The Critical Path Toolkit (Ch. 7)

### A.6.1 Modes and kernels (§7.3–7.4)

**Idea.** The forward recursion F_v = (⊕_{u∈pa(v)} F_u ⊗ w_uv) ⊗ d_v (Eq. 7.1) exists for any operator pair; a **backward pass exists only if the pair's algebra supports one**: ⊕ an order (max or min) with ⊗ monotone with a residual (residuation in an idempotent semiring, Baccelli et al. 1992), or ⊕ a sum (linear, so the backward object is an adjoint, a sensitivity, not a slack). "A slack reported for a pair without such a backward pass is a number with no meaning."

| Mode | ⊕ | ⊗ | Backward object | Margin |
|---|---|---|---|---|
| LongestPath | max | + | reverse fold; m = P − t_v | slack |
| ShortestPath | min | + | reverse fold; m = t_v − P | margin over optimum |
| MaxScaling | max | × | reverse fold; m = P/t_v − 1 | ratio slack |
| Accumulation | + | + | adjoint (path multiplicity m_v) | allowance a_v = (B − F_t)/m_v |

**Algorithm 5 (order-based kernel, p. 139).** Forward over layers: F_v; reverse over layers: R_v = ⊕_{s∈succ(v)} (R_s ⊗ d_s) ⊗ w_vs; project value P = ⊕ over sinks of F_v; through-value t_v = F_v ⊗ R_v; margin by the table; critical iff margin = 0; textbook ES, LF, LS recovered (Eq. 7.5). **Algorithm 6 (linear kernel, p. 140):** F_v = Σ_{u}(F_u + w_uv) + d_v; m_t = 1, m_v = Σ_{s∈succ(v)} m_s; F_t = Σ_v m_v d_v + Σ_{(u,v)} m_v w_uv; allowance a_v = (B − F_t)/m_v. Cost O(|V|+|E|) per pass for every mode. Example (Fig. 7.1): durations 1,5,2,1: LongestPath = 7 (node 3 slack 3); ShortestPath = 4.
*Why the allowance is exact (my reading):* for a single node's value changing by Δ with everything else fixed, F_t changes by m_v·Δ, so the headroom (B − F_t)/m_v is exact for that node alone.

### A.6.2 Interval durations and the domination split (§7.5–7.6, pp. 140–146)

**Forward quantities (F, R, t, P) are monotone** in every input: exact bounds from **two scalar runs** at the lower and upper corners; no interval arithmetic needed. **Margins are differences of two monotone quantities sharing inputs, hence not monotone**, and the hardness results apply (possibly critical NP-complete, float bounds NP-hard; Chanas–Zieliński). Three methods, each result **tagged with its method**: (1) **conservative enclosure** [max(0, P̲ − t̄_v), P̄ − t̲_v] (Eq. 7.10): sound, two corner runs, not exact (the lower corner of P and the upper corner of t_v are not attained by the same configuration); (2) **exhaustive corner enumeration**, 2^k runs for k interval inputs (refuses beyond a cap); (3) **domination split** (LongestPath, point-valued edge values). Necessarily critical: upper margin bound = 0; possibly critical: lower margin bound = 0.

**The proof chain.**
- **Prop 7.1 Corner sufficiency:** with others fixed, f_v is monotone in any single d_u (P(x) = max(C₀, C₁ + x), t_v(x) = max(A₀, A₁ + x), each one breakpoint slope 0 then 1; the difference has slope pattern 0,+1,0 or 0,−1,0), so extremes of f_v over the box are at corners (push each coordinate to the non-worsening endpoint).
- **Lemma 7.2 Incomparable:** if no complete path contains both u and v, f_v is non-decreasing in d_u (t_v doesn't depend on d_u; P does, non-decreasingly).
- **Lemma 7.3 Dominated:** if every complete path through u also passes through v (including u = v), f_v is non-increasing in d_u (if raising d_u raises P, the new maximiser contains u hence v, so t_v rises to P and the float drops to 0).
- **Bypass set** H_v = {u : some complete path contains both u and v, and some complete path contains u but not v}.
- **Thm 7.4 (Exactness of the domination split):** the maximum of f_v is attained at a corner with every incomparable duration at its upper bound, every dominated one at its lower bound, and bypass durations at some corner of H_v; the minimum dually. Enumerating the 2^|H_v| bypass corners with the rest pinned gives the exact float range of v.
- **Cost** 2·Σ_v 2^{|H_v|} scalar propagations, against 2^k.
**Algorithm 7 (p. 146).** Classify each interval node for every v; total = 2Σ2^{|H_v|}; **if 2^k ≤ total run the exhaustive sweep instead ("never worse")**; refuse if total > run limit; otherwise per node, per objective (max, min) pin the two classes and run the kernel at all corners of H_v. The implementation first screens on the **number of non-degenerate intervals**: **in the server, the split is attempted only if k ≤ 60** (`AnalysisCommon.jl:402`, `max_runs = 2,000,000`; the package default is 4,000,000), otherwise the conservative enclosure is returned **without pricing the split**; a separate exact-corner path is used for 0 < k ≤ 18. This is why Net3 (122 intervals > 60) got the enclosure.

**Complexity and boundary.** PSPLIB j301_1, all 30 durations ±20%: 2^30 ≈ 1.1×10⁹ exhaustive against **50,524** for the split (≈21,000× fewer), largest bypass set 13 of 30, mean 6.8, 4.2 s at ≈82 µs per corner. Dense 5×5 grid, all 25 interval: bypass sets up to 23 of 25, split would need 3.9×10⁷ against 3.4×10⁷ for one shared sweep: the never-worse rule picks the sweep ("the instance is at the boundary of the method"); "the same regime in which the conditioning sets of the probability toolkit grow".

**Results to know cold (PSPLIB j301_1).** 32 nodes (30 activities), 48 edges, one source, one sink, 12 forks, 12 joins, 11 layers. LongestPath **38** = MPM-Time published with the instance, chain 1→3→8→12→14→17→22→23→24→30→32; 11 critical nodes (9 activities); 3 more with slack 1 (4, 10, 16). ShortestPath **18** through 2, 4, 6, 10, 25, 30 (shares only activity 30). Accumulation total **362**; activity 2 (duration 8) on 5 routes contributes 40; activity 3 (duration 4) on 9 routes contributes 36; activity 16 (duration 10) on 2 routes contributes 20; under budget 398.2 (10% above) activity 3 can grow 4.0, 16 by 18.1, 6 by 36.2. Interval ±20%: project [**30.4, 45.6**]; split: **5** necessarily critical (two dummies + 23, 24, 30), **19** possibly critical, **13** activities never critical; enclosure: **0** necessarily critical and **26** possibly critical, so the split identifies **three** activities the enclosure cannot and removes **seven** from its possibly critical set. Monte Carlo 50,000: no violation; bounds attained at 30 of 32 nodes (the other two attained at corners the split itself identified).

**New compared with Ch. 2.** Hardness and tractable classes are known (Chanas–Zieliński; Dubois et al.; Fortin et al.; series-parallel). The generalised-modes framing builds on max-plus residuation. New in the thesis: the operator-pair mode family with its backward-pass condition, and the domination split as a reduction of the exponent from "all uncertain durations" to "durations that can bypass v". Be modest: it does not beat the hardness result; it locates where the hardness sits.

**Validation (§7.7).** Path oracle on 7 networks (32 to 306 nodes, 128 to 2,450 paths): agreement to **3×10⁻¹⁴** in every quantity for all four modes, identical critical sets; on the 3 networks with > 2.7×10⁶ paths: 2,000 sampled paths never beat the reported project value, and the accumulation total equals the multiplicity sum. Interval: path oracle at every corner gives the exact range; the enclosure contains it, exhaustive equals it, the split equals exhaustive wherever both run. Monte Carlo: 50,000 uniform configurations within the box.

**Code match.** `CriticalPath` module in the package (6 files, 626 lines): the split is `interval_analyze_split`, throws `SplitDeclined` (a type of its own) when over budget and `ArgumentError` for any mode other than LongestPath ("domination split is proven for LONGEST_PATH only"); `max_runs` 4,000,000 default; the server catches **only** `SplitDeclined` and falls back to the enclosure (this matters: an earlier version conflated floating-point error with intractability, Ch. 8 §8.8).

**Questions: mathematician.**
1. *"Prove the split is exact."* → Prop 7.1 + Lemmas 7.2–7.3 + Thm 7.4 above. At an optimal corner, moving an incomparable duration to its upper bound cannot decrease the maximum (it holds for *all* values of the others), and moving a dominated duration to its lower bound cannot decrease it; applying the moves one coordinate at a time reaches a corner of the pinned form that is still optimal.
2. *"The general problem is NP-hard. What exactly have you shown?"* → Not that the problem is easy. The cost is 2Σ2^{|H_v|}, exponential in the bypass width; instances with large bypass sets stay hard, and the dense mesh shows it.
3. *"Why is the minimum 'dual'? Show it."* → Swap the roles: for the minimum, incomparable durations go to the lower bound and dominated ones to the upper (the lemmas' monotonicity directions reverse). The thesis states it "dually" without writing it out.
4. *"Only LongestPath?"* → Yes: "proved and implemented for the LongestPath mode only"; the ShortestPath dual "mirrors" it but has not been derived in full; the toolkit refuses other modes for the split.
5. *"Edge values?"* → Point-valued edge values only; interval edges reduce to interval durations by subdividing the edge with a node, but the toolkit does not do it yet.
6. *"What does 'necessarily critical' mean precisely?"* → Float upper bound = 0: critical in every configuration of the box; "possibly critical": float lower bound = 0: critical in at least one.
7. *"Why does the enclosure flag seven activities the split clears?"* → See `SPEAKER_NOTES.md`: the enclosure takes P's low corner and t_v's high corner from two separate runs; no real configuration need attain both, so its lower float bound can reach zero when no real configuration makes it zero; those activities always keep some slack.
8. *"The original interval implementation was withdrawn."* → N18: overloaded `max` on overlapping intervals returns [5,7] from [3,7] and [5,6], describing no single path; interval subtraction of two dependent quantities gives [−16, 16] for the dummy start node, where the true float is exactly 0 (dependency problem).

**Questions: civil engineer.**
1. *"What is 'critical' for a restoration programme?"* → The chain whose delay delays completion; under interval durations "necessarily critical" are the activities that must be managed whatever the durations turn out to be.
2. *"Where do durations come from?"* → In Net3: the AWWA procedure (C600, C605, C651): 2 h pressure test, flush of three pipe volumes at 3 ft/s, 24 h chlorination hold, 40 h bacteriological sampling; one hour isolation assumed; pump 8 h and tank 24 h assumed (§10.3.3).
3. *"Why did Net3 get the enclosure?"* → Fixed screen (k ≤ 60 intervals) before the split is priced; stated limitation and future work.

**Weak spots.** LongestPath only; fixed screen (N-listed: Net3); no p-box form; the "dual" is not written out; the old implementation's withdrawal is in the text; the ±10%/±20% appendix error (N1).

---

## A.7 Ch. 11 as a whole: answers, limitations, future work

**§11.2 Answers to the five questions (pp. 199–202).** (1) One model, three analyses: **yes, on the model's four assumptions**; the three toolkits have no imports between them and share the graph object. (2) Reconvergence identified once: **yes for the probabilistic interpretation**; "the Critical Path Toolkit computes its own bypass sets and does not use the module; the two structures index reconvergence at different granularities and neither contains the other". (3) Exact reliability under imprecision, and its cost: exact for numbers and intervals, sound p-boxes; "exponential in the largest conditioning set the network forces, which is the same structural width that governs a well-ordered decision diagram"; "the toolkit's case rests on the two capabilities the diagram does not offer". (4) Schedule quantities: forward exactly at the cost of two runs; floats exactly "at a cost set by reconvergent width, with a boundary that the toolkit locates and refuses beyond". (5) Delivery: **yes; "the interface has been demonstrated and not yet studied in use"**.

**§11.4 Limitations (verbatim anchors).** Model: no common-cause failure, degraded component states, reconfiguration, or feedback; cyclic only after orientation. Probability: "no asymptotic advantage over a well-ordered decision diagram… practical to about fifty nodes of moderate reconvergence"; p-box "practical only for small networks"; the tighter operator "validated sound… but not proved"; power-network residual unexplained. Flow: point-valued; "a best-case and worst-case pair of capacities is two solves, not an interval result"; exact on evaluated candidates; whole-graph connectivity measures zero on any DAG. CPM: split for LongestPath only with point-valued edge values; no p-box form. Package: single-threaded, no domain conversion, test suite covers small instances only; interface exposes no p-box level control, no warning before a long run, no independent use by a non-programmer.

**§11.5 Future work (all eleven items).** Soundness proof for the positive operator; depth-limited hybrid for the probability toolkit (exact to a depth, bound beyond; intervals sound as is, p-boxes would need Fréchet beyond the depth); the power-network residual; shortest-path dual of the split, edge subdivision, shared corner evaluations; replace the fixed screen with the split's own bypass-set cost; p-box CPM and interval/p-box flow (flow *value* direct by monotonicity, cut structure and thresholds open); source-to-sink connectivity measure, minimum-cost flow, time-expanded flow; cyclic networks; a second decomposition pattern; parallel propagation with a lock-free store and a CI test suite running the validation corpus; p-box level control and a user study.

**§11.3 Contributions** also says: "In addition to the list, the thesis contributes a way of working… every result reported is produced by the toolkit and checked against a computation that shares none of its machinery… The six errors that the validation scripts found are recorded with their fixes, each at a boundary the synthetic corpus did not reach and a real or benchmark instance did."

**Closing remark claim** to be ready to defend: "The case study… showed, on a public water network, that the pump which bounds its throughput when the network is degraded also lies on the chain that sets its restoration time, which no single analysis could have said." (After the correction: the river pump is in every one of the 24 degraded minimum cuts and on the restoration chain; they share the pump, the super-sink and node 95/97.)

**Likely questions (whole-thesis, mathematician).**
1. *"Which of the six contributions is the most important, and which would you withdraw?"* → Most important: the exact conditioning decomposition (Ch. 4 + 5) because it is the core and proved; the p-box default operator is the one claim I qualify; I would withdraw nothing, I would restate the p-box default as "validated, not proved" (which the thesis already does).
2. *"What would you do differently?"* → Orient degraded states separately; replace the fixed screen with a priced split; add an algorithm box for the PPA and the enumerator; enumerate closed sets directly.
3. *"What is proved, what is validated, what is demonstrated?"* → The table at the top of this document.
4. *"Is any theorem in the thesis new mathematics?"* → Mostly careful applications: the new parts are the domination-split exactness (Thm 7.4), the context-aware identity and completeness theorems of the module (Ch. 4), and the recombination/supernode lemmas (Ch. 5); the p-box obstruction is a stated negative result. Do not claim deep new mathematics.

**Likely questions (whole-thesis, civil engineer).**
1. *"Who would use this and when?"* → The engineer who holds a system model and asks reach / deliver / restore, wanting a range not a number, on their own machine.
2. *"What does it not do?"* → Hydraulics, common cause, degraded states, time-varying demand, flow reversal; the interface has not been tested with engineers.
3. *"What do you recommend to the Net3 owner?"* → Reinstate the river pump first: it sits in every degraded minimum cut and on the restoration chain; do not read the 6.4% as a prediction, it is the oriented model's throughput.

---

# PART B: CHAPTER BY CHAPTER, IN THESIS ORDER

Each chapter has the same sub-headings. For Ch. 4 to 7 the algorithm content is in Part A; the chapter entries here carry the remaining items (numbers, assumptions, limitations, extra questions, weak spots). Ch. 8, 9, 10 are full entries.

---

## Chapter 1. Introduction (pp. 1–10)

**Key claims.** Goal-oriented process systems, with fixed flow direction and no feedback in normal operation, are DAGs (§1.1). Three questions, three classical methods (network reliability, max-flow min-cut, critical path), one topology; "what changes is the meaning of the value attached to a component". Values are rarely precise: aleatory versus epistemic; intervals and p-boxes. "All three methods named above consume a single value for each input." The thesis propagates intervals and p-boxes **through** the computation. Exact network reliability is #P-hard and "every exact method in common use… is built on point-valued component probabilities". The gap (§1.2): "No tool or method found in that review combines source-to-node reliability, capacitated flow and activity scheduling on one network representation"; closest are Huang–Huang–Lin (reliability + schedule, discrete point states) and Tong (reliability + flow, point-valued).

**The five research questions (§1.2, p. 5).** (1) one DAG model for reliability, capacity and schedule, topology entered once; (2) can reconvergence be identified once, independently of any analysis, and reused; (3) can exact source-to-node reliability be computed with interval or p-box probabilities, what is guaranteed, and what does it cost relative to decision diagrams; (4) which quantities of critical path analysis remain exactly computable under interval durations, at what cost, given NP-hardness; (5) can these be provided to an engineer who does not program, without the model leaving the machine.

**Objectives (§1.3).** Define the network model; develop exact methods for each interpretation and extend to intervals/p-boxes "as far as the mathematics of that interpretation allows"; validate every exact result against an independent computation and measure where each stops being practical; deliver as a documented package and a no-code interface.

**Definitions, theorems.** None; the contributions list is the item (Part A.0).

**Numbers to know cold.** 5 questions; 6 contributions; 129 random networks in the corpus; publications: ICSRS 2023 pp. 580–584 (the Information Propagation Method = the PPA), RESS paper under revision (exactness proofs, interval and p-box), an ESREL World 2027 paper on the interface (in preparation), a package paper (in preparation).

**Assumptions.** Fixed flow direction, no normal-operation feedback; independence and static topology are set in Ch. 3.

**Stated limitations.** The capacity toolkit is "point-valued in the present work"; the critical path toolkit carries deterministic and interval, not p-box.

**Likely questions: mathematician.**
1. *"'No tool or method found' is a negative claim. What was the search?"* → It is stated as a search result across four categories (commercial reliability suites, open-source infrastructure simulators, project-network reliability theory, one doctoral thesis) in Ch. 2 §2.6, not a proof of absence; the wording is "found". Offer to describe the sources if pressed; do not claim exhaustiveness.
2. *"Imprecise-probability reliability exists. Why 'rarely been done'?"* → N9: the thesis does not cite credal-network or imprecise-reliability work; concede the neighbour exists, restate the claim as "an exact one-pass propagation of intervals and p-boxes through a conditioning decomposition for source-to-node reachability, with a stated guarantee per value form".
3. *"Research question 3 says 'what is guaranteed': state it."* → Point: exact; interval: exact range; p-box: sound bounds (Fréchet proved; default validated). Cost: same width as a decision diagram.

**Likely questions: civil engineer.**
1. *"Why a DAG? Real networks are meshed."* → Orientation by the operating snapshot (Ch. 3 §3.2); excludes flow reversal and recirculation; stated as assumption 4.
2. *"Who is the user?"* → An engineer with a system model and one of the three questions, comfortable with a spreadsheet and a browser, not programming (§9.2).

**Weak spots.** N9; "rarely been done" is a literature claim with a thin related-work base; the contributions list says "degradation and upgrade thresholds" while the interface cannot show upgrades (N20).

---

## Chapter 2. Background (pp. 11–24)

**Key claims.** Reliability: #P-hard in general; RBD/fault trees fail where routes reconverge; path/cut sets, factoring, series-parallel, polygon-to-chain, tree decomposition (Robertson–Seymour; Goharshady metropolitan transit), Monte Carlo, BDDs (variable-ordering intractable in general; hash-consing), cutset conditioning and junction tree (Pearl, Lauritzen), Tong–Tien directed probability propagation (approximate, pairwise). Flow: max-flow min-cut, node splitting, flow decomposition, residual-graph cut structure; robust optimisation (robust max-flow polynomial, robust min-cut NP-hard, Bertsimas) and stochastic-flow reliability (Doulliez–Jamoulle). Scheduling: CPM (Kelley), PERT (Malcolm), interval durations: forward easy, backward NP-hard (Chanas–Zieliński; planar too), series-parallel tractable; max-plus residuation (Baccelli). Uncertainty: intervals (dependency problem; monotone ⇒ two corners), p-boxes (Ferson), Williamson–Downs arithmetic (convolution under independence, Fréchet bounds under unknown dependence), software in R/Python/Julia; fuzzy, Dempster–Shafer out of scope. Multi-analysis tools (pandapower, ArcGIS Utility Network, BlockSim/Isograph/ITEM, InfraRisk, Huang et al., Tong) and delivery (no-code review: 383 definitions across 306 publications 2014–2025; SimScale; web GIS review 1,775 screened / 65 admitted; local-first). Graph libraries across languages.

**Definitions/theorems.** p-box definition (§2.5.1); no theorem is proved. The key *stated* facts used later: monotone ⇒ corners (§2.5.1), Fréchet bound sound under any dependence, hash-consing, hardness of interval floats.

**Numbers to know cold.** 383/306 (no-code review); 1,775/65 (web-GIS review); four candidate tools/methods in the gap analysis; four ways software reaches users (browser service, licensed desktop, web GIS, plus the no-code category).

**Assumptions.** The search for multi-analysis tools is "a search", not a protocol.

**Stated limitations.** Fuzzy/DS not used; the delivery review is of categories, not a full survey.

**Likely questions: mathematician.**
1. *"Tree decomposition gives exact reliability with cost bounded by treewidth. Why did you not benchmark against a treewidth/junction-tree implementation?"* → N22: Ch. 2 presents treewidth methods as the structural alternative and Ch. 5 benchmarks against a **sifted BDD**; there is no head-to-head against a junction-tree implementation. Honest answer: the BDD is the standard reference for exact reliability and the one with a mature library; the conditioning width and the treewidth are different parameters (the PPA's recursion is a cutset-conditioning specialisation, Pearl 1988, whose width is a cutset-style quantity); a treewidth comparison is future work. Do not claim the toolkit beats treewidth methods.
2. *"Is it true that no exact method handles intervals natively?"* → BDD can be evaluated at corners, Ch. 2 says so ("an interval query against a decision diagram means evaluating the diagram at chosen input corners"). The claim is about the *propagation*, not about the corner trick.
3. *"Why is Dempster–Shafer/possibility out of scope?"* → The quantities propagated are probabilities, capacities and durations; the information on them is stated directly as an interval or p-box; the operations are products, complements and weighted combinations on which p-box arithmetic is closed (§2.5.2).
4. *"Williamson–Downs arithmetic: discretisation?"* → Convolution on a discretisation into a fixed number of levels; cost grows with the level (Ch. 5 §5.10.4).

**Likely questions: civil engineer.**
1. *"Why not just use commercial reliability software?"* → They pair reliability with flow but have no schedule module, use classical distributions, and are desktop installations; none propagates intervals/p-boxes natively (§2.6).
2. *"Is 'no-code' a fair description?"* → The thesis says no-code in the usual business sense does not cover engineering analysis; here it means "no programming", not a drag-and-drop builder (§2.7).

**Weak spots.** N22 (no treewidth comparison); N9 (credal networks absent); the gap claim is a search result; several citations are vendor documentation (BlockSim, Isograph, ITEM) for "none of their public documentation describes a schedule module".

---

## Chapter 3. Complex Processes as Directed Acyclic Graphs (pp. 25–37)

**Key claims.** Mapping process → graph: components are nodes, dependencies directed edges; direction is read off the system; acyclicity is natural for treatment trains and schedules and **imposed by orientation** for distribution networks ("orienting each edge by that dominant flow gives a directed acyclic snapshot of the operating regime"). Node roles: source, sink, fork (fan-out ≥ 2), join (fan-in ≥ 2); redundancy = fork + reconvergent join. Layered order and closures, the input module, the four assumptions.

**Definitions and theorems.** Def. 3.1 network model G = (V,E) finite DAG, S sources, T sinks, Pa, Ch. Def. 3.2 ancestry, **self-inclusive**. Def. 3.3 forks F = {v : |Ch(v)| ≥ 2}, joins J = {v : |Pa(v)| ≥ 2}. **Theorem 3.4 (Layered order):** every finite DAG has a partition into non-empty layers L₁…L_k such that every parent of a node in L_i lies in some L_j, j < i; processing layers in order visits each node once after all its parents, in exactly k layer steps. *Proof (induction on |V|):* a DAG has a source; take all sources as L₁, remove them, apply the hypothesis to the remainder. **Algorithm 1** (p. 32): depth-partitioned Kahn with ancestor and descendant closures accumulated in the same pass; layers in O(|V|+|E|); closures add set-union cost, O(|V|²) worst-case space.

**Numbers to know cold.** Four assumptions; Table 3.2 contracts (probability: node-prior file + edge-probability file, Float64/Interval/p-box, values in [0,1]; flow: edge records + optional node capacities, Float64 only, non-negative, not NaN, infinity token; critical path: time section (node durations, edge delays, initial time) + optional cost section, Float64/Interval; structure: edge list or adjacency matrix over **integer** identifiers, `.edges` or `.csv`, format detected in stages; self-loops rejected on ingestion, cycles detected during ingestion).

**Assumptions (§3.8, the four).** (1) Independent component behaviour; common cause must be modelled as a shared upstream node. (2) Binary component states under the probabilistic interpretation. (3) Static topology over the horizon; reconfiguration = a sequence of separate analyses. (4) Acyclicity excludes feedback and flow reversal; "a property of the operating snapshot being analysed, since the physical assets may carry flow in either direction". "None of the algorithms introduces an assumption beyond it."

**Stated limitations.** The four assumptions; conversion from domain formats is the user's task; ids must be mapped to integers by the user.

**Likely questions: mathematician.**
1. *"Prove the layered order; what is it for?"* → Thm 3.4 above; it fixes one processing order for all exact analyses, so the number of steps is known before running.
2. *"Why self-inclusive closures?"* → So that a parent that is itself an ancestor of another parent is handled uniformly (the asymmetric case in Thm 4.9: p ∈ Anc(q) with a = p).
3. *"Closures are O(|V|²)."* → Stated trade (§3.5).
4. *"Does the independence assumption cover edges?"* → Yes: all node and edge indicators are mutually independent (§5.2).

**Likely questions: civil engineer.**
1. *"My network is a mesh with flow in both directions."* → Orient by the dominant flow at the snapshot; Net3 was oriented by its own hydraulic run at the last step of the seven-day simulation (no link dropped, three zero-flow links kept the declared direction). Flow reversal under unusual demand and recirculation are excluded: say that.
2. *"Common-cause failures: a shared power supply, a flood?"* → Excluded by assumption 1; represent the shared cause as one upstream node feeding everything it affects.
3. *"Components with degraded states (a pump at half capacity)?"* → Probabilistic interpretation is binary (assumption 2); partial degradation is available in the capacity toolkit as a derated capacity, which is a separate scenario, not a probability.
4. *"Time-varying demand?"* → Static topology and a single snapshot; a sequence of separate analyses.

**Weak spots.** The independence assumption is the single largest engineering exposure; format detection in the parser is heuristic (a two-column table is treated as an edge list); the model has no notion of time. Ch. 3's own "every analysis is an exact method with no iterative convergence loop" is about the analyses, not the max-flow solvers (push-relabel iterates to termination).

---

## Chapter 4. Network Decomposition (pp. 38–58)

Full algorithm entry: **A.1**. Here the remaining items.

**Key claims.** Diamond as default decomposition unit; partition-forward (each diamond returned as a graph object of the same form as the network, can be handed to any analysis), secondarily reductive (a solved diamond stands in as a supernode; this is how the PPA uses it). Three discriminators (eligibility, anchoring, membership); only eligibility is runtime-configurable (§4.9).

**Worked examples to know (§4.8).** *Induced diamond:* source s, fork f, two disjoint paths, join j: one group, one fork, C = {f}. *Factorised join (Fig. 4.8):* nine edges, forks 1 and 2, single join 7 which source 8 also feeds directly; groups {3,4} (fork 1) and {5,6} (fork 2); parent 8 non-influencing; two constituent diamonds make the join's maximal diamond. *Nested (Figs. 4.3–4.7):* eight nodes, forks 1 and 3, joins 6 and 8; at join 8: parents {2,7}, infl(2,∅) = {1,2}, infl(7,∅) = {1,3,4,5,6,7}, intersect in {1} → maximal diamond D₁ spans all nine edges, C = {1}; at join 6 under B = {1}: infl(4,{1}) = {3,4}, infl(5,{1}) = {3,5} → still correlated through fork 3 → inner diamond D₃, C = {3}, E_D = {(3,4),(3,5),(4,6),(5,6)}, edge (1,3) cut by the boundary clause; at join 6 top level: forks 1 and 3 both cover 4 and 5, the earliest-covering-fork rule fixes fork **1** not 3 → D₂ with C = {1}; result **two maximal diamonds, three unique**: D₃ stored once, referenced from both. Edge-isolation example (Fig. 4.6): join 5 under E = {1}: nested diamond emitted with C = {2} ∪ ({1} ∩ V(E_D)) = {1,2}; edge (1,5) absent from its edge list, but present in the top-level maximal diamond at join 5.

**Numbers to know cold.** Algorithm 2 terminates in at most |V| nested extensions; counts in Table 5.2 (power 5/9, |C| = 3; grid 8/41, 7; Karl 18/147, 11; counterexample-n15 4/13, 4); Net3 21/307/12; the worked network of Ch. 5: four maximal diamonds.

**Assumptions.** DAG input (cycles broken by orientation first); fixed context semantics; the eligibility discriminator reads declared values (inactive prior 0; perfect source = source with prior 1; a non-source prior 1 stays eligible; interval/p-box only when collapsed to 0 or 1).

**Stated limitations (§4.9).** Only eligibility is configurable at run time; anchoring and membership are internal functions ("Changing either is a change to the source"); the diamond is "the only pattern for which a set of discriminators has been defined"; "No second pattern has been defined here to exercise it"; cyclic networks only after orientation.

**Extra questions.**
1. *Mathematician: "Is the module's genericity real or a design intention?"* → A design intention backed by the separation of algorithm and discriminators; untested on a second pattern (§4.9); listed as future work.
2. *Civil: "Does it matter which node I treat as the fork?"* → The module chooses the earliest covering fork by topological index; the conditioning set it reports is what the interface highlights; the chapter does not claim it is the smallest possible.

**Weak spots.** N13, N21, completeness at top level only, no complexity bound, genericity untested.

---

## Chapter 5. Information as Probabilities: Probability Propagation Toolkit (pp. 59–91)

Full entries: **A.2** (PPA), **A.3** (interval), **A.4** (p-box). Here the numbers, case study and remaining items.

**Key claims (§5.1).** Four: exact for point inputs (proved §5.5–5.6, checked against an independent oracle on 129 graphs and two published benchmarks); cost governed by the same width as a well-ordered BDD, neither dominating; intervals exact range at machine precision, lower one-shot cost; p-boxes sound bounds with a tightness envelope.

**Numbers to know cold.**
- Simple diamond (every non-source 0.9, source prior 1): local update **0.749071**, exact **0.675462** (overestimate 11% of the true value); b(2) = 0.81, signal per branch 0.59049; conditioned path success 0.729, join signal 0.926559 given fork reached, weighted 0.750513.
- Worked network (§5.6.1): sources prior 1, others 0.9; Table 5.1: D₁ at join 6 C = {1}, ψ(1) = 0.889023, ψ(0) = 0, P(E) = 0.720108; D₂ join 11 C = {7}, 0.893745 / 0.478297 / 0.814810; D₃ join 12 C = {14}, 0.931860 / 0.583288 / 0.865631; D₄ at T C = {1}, 0.913943 / 0.818038 / 0.895721; b(6) = 0.796843, b(11) = 0.733329, b(12) = 0.779068, **b(T) = 0.806149**; twenty sub-problems posed, sixteen distinct.
- Corpus: 129 = 120 + 8 + 1; worst deviations 1.1×10⁻¹⁶ / 2.8×10⁻¹⁶; second run reproduced all results within 10⁻⁹ after the eligibility correction (corpus never has a non-source prior of exactly one).
- BDD: naive order > 2.5×10⁶ nodes on densest graphs; sifted ≤ 20,323.
- Table 5.2: power 23/27 (5 maximal, 9 unique, |C| 3, dev 8.3×10⁻¹⁷); grid 16/24 (8, 41, 7, 1.1×10⁻¹⁶); Karl 26/74 (18, 147, 11, 5.6×10⁻¹⁷); counterexample-n15 15/23 (4, 13, 4, 5.6×10⁻¹⁷).
- Grid: 26 published values within 5×10⁻⁶; largest 4.8×10⁻⁶ at node 12 (0.9), 4.3×10⁻⁶ at node 16 (0.1); the source's own approximate method has a gap of 4.8×10⁻⁴ at node 16 under 0.9.
- Power (Table 5.3): R = 0.9: 0.85741 published, **0.85917** ours (+0.00176); 0.99: 0.98969 both; 0.3: 0.00221 published, **0.00272** ours (+0.00051); BDD agrees to 1.1×10⁻¹⁶; adding the one edge makes it worse by 2.8×10⁻² at 0.9. **New (not in thesis): exhaustive 2^27 enumeration gives 0.85917198 / 0.98968706 / 0.00272158.**
- Adversarial (Table 5.4): fan-in k = 4/8/12/16: 9/17/25/33 ops (= 2k+1), max |C| 1, diagram 126/474/636/802 nodes (tie). mesh-w = 2/4/6/8: 78 / 20,603 / 832,922 / 3,895,252 ops, |C| 6/8/10/11, diagram 315 / 700 / 1,487 / 2,621 nodes.
- bnlearn: 17 benchmarks, identification < 2 s each, propagation completed on 16; one width ≈ 21 out of memory at identification (diagram out of time).
- Interval: ×1.2; 3.9–99.9× faster one-shot on 8 families; ≤ 0.45 over-widening when conditioning ignored; worked [0.634002, 0.931254] for [0.85, 0.95].
- p-box: convolution mass escape up to 0.34; band ≈ 0.18 to ≈ 0.70; certified band widths 0.02–0.12 vs MC 267–9,604; time by level (Table 5.6); KarlNetwork 17 min at L = 200, 546 s at L = 50.
- Drone (Table 5.7): 217/263 w10 mean band 0.089 max 0.100 worst [0.750,0.850]; 242/1753 w16 0.094 / 0.161 / [0.562,0.722]; 230/1648 w16 0.093 / 0.161 / [0.562,0.722]; worst facility **Islay Hospital**; width saturates at 16 routes per location; practical ceiling ≈ 18; PPA interval < 25 s on dense designs, < 1 s on centralised; BDD completes to 12 routes (123,000 nodes in 45 s), does not complete from 14 (budget); PPA ~5 s across the sweep; **crossover between 12 and 14 routes**; one-shot interval faster by ≈ 50× (centralised) and ≈ 15× (minimal at 6 routes); p-box full analysis: seconds (centralised), minutes (minimal at 6 routes), > 1 h at 8 routes; eligibility correction reduced the dense width 17 → 16.

**Assumptions.** Independence of all node and edge indicators; binary; DAG; drone: location availability 0.2 failure for non-hubs (the source study's own assumption, **stated as an assumption there**), hub availability exactly 1, non-hub interval [0.75, 0.85]; a connection exists per drone type when the distance is within nominal range (70 km VTOL, 700 km fixed-wing); both types ⇒ independent alternatives; final 10% of range gets [0,1] (an *illustrative* derating margin: "the study quantifies none"); direction from hub tier outward.

**Stated limitations (§5.12, Ch. 11).** No asymptotic advantage over a well-ordered BDD; practical to ≈ 50 nodes of moderate reconvergence (N3); p-box only on small networks; recombination operator not proved; power residual open; DAG only.

**Extra questions (beyond A.2–A.4).**
1. *Mathematician: "The drone designs are proxies, not the study's layouts."* → The thesis says so: "They are proxies for a described character, not reproductions of an unavailable result, and every conclusion below attaches to them as such" (§5.11.2). The claim they support is the measured crossover on one real redundancy parameter, scoped as "narrow".
2. *Mathematician: "Is the BDD comparison fair? Which variable order, which library?"* → Sifting with dynamic reordering (a standard heuristic) against a naive-order failure (> 2.5×10⁶ nodes); the diagram "did not complete within a documented budget from fourteen routes, under dynamic reordering". Same process, same language, warm timings, one core (§5.7.3). A different BDD package or a better ordering heuristic could move the crossover; the thesis says the claim is narrow.
3. *Civil: "Why is Islay worst?"* → An island site reachable only through a few long hops: reachability compounds along them and there is little redundancy; its band is wide because the uncertain availabilities enter along every route.
4. *Civil: "The 0.2 non-hub failure — what is it?"* → The source study's own resilience assumption, used as a stated assumption and widened to an interval to make the analysis a sensitivity assessment of it.

**Weak spots.** N8, N10, N11, N12, N19, N21; drone designs are proxies; BDD library and ordering fixed; one network family for the crossover.

---

## Chapter 6. Information as Resources: Capacity Flow Toolkit (pp. 92–132)

Full entry: **A.5**. Here numbers and remaining items.

**Key claims.** Six questions answered by modules sharing one baseline solve; "What is new in this chapter is the collection of these answers on one graph object, with every one of them checked" (§6.1); point-valued; exactness on evaluated candidates; the correction.

**Numbers to know cold.**
- Flagship benchmark (43 nodes, 107 edges, 8 layers; 5 sources, 8 hubs, 7 sinks): **F\* = 37.0** in both configurations; A: 41 saturated edges, free zone {134,135} (size 2), **4** min cuts, 0 SPOF; B: 35 saturated, free zone 0, **1** cut, 0 SPOF; cut 1 has 13 crossing edges, cut 4 has 3 (Table 6.8); gateway edges 134→136 and 135→136 in E_some not E_every in A; removing either gateway edge drops 17.0 (≈ 46%) to 20.0; A: 15 edges with non-zero single-edge impact, B: 3; two-edge worst pair = both gateway edges, drop 34.0 → 3.0 (the bypass 132→140 keeps 3); node-capacitated: 30.0 (loss 7) with the same six Layer-3 nodes {114–119} saturating; sink_1 (137) 4.0 → 0.0, sink_2 (138) 6.0 → 3.0; node upgrade +7.0 for any of 114–119; flow decomposition 27 (A) / 25 (B) components, largest 3.0 on a path bottlenecked at 114→120; degradation F*(α) = 37α (33.3, 29.6, 25.9, 22.2, 18.5); thresholds: A gateway edges upgrade-ineffective (B_uv 17.0), B +1.0 (B_uv 23.0), bypass 132→140 +1.0 (10.0 in A, 16.0 in B); without 132→140, node 136 is the only SPOF, with it F*(G∖{136}) = 3.
- RTS-24 (Table 6.9): 24 buses, 33 units at 11 buses, 3405 MW, 38 lines (4 double-circuit) → **34 edges**, peak 2,850 MW, 17 load buses, slack bus 13; 21 of 34 lines carry flow against the file's order; zero-in-degree 7, 21, 22, 23; zero-out-degree 4, 5, 6, 8, 19; net exporters offer **2,162** MW, net importers need **1,607**, **1,243** served locally; throughput 1,607 (100%) with or without generator capacities; binding cut = the eleven import-bus edges; unique cut (free zone empty); no SPOF; generators at nameplate: buses 1, 2, 13, 16; line 7–8: 171 of 175 MVA (4 MVA headroom); contrast model (generation-only sources, load-only sinks): 2,725 MVA edge-only, 1,135 MVA with generator capacities, nine-line binding cut.
- Scale (Table 6.10): genrmf DAG variants 360/924, 3,332/9,324, 27,040/78,364, 36,992/107,644; Dinic 0.002 / 0.017 / 0.961 / 0.657 s; push-relabel 0.097 / 0.019 / 1.520 / 2.277 s; Edmonds–Karp 0.007 / 0.179 s (not run above 50,000 edges); oracle 29 s on the largest. Note these are a **variant** of the DIMACS family (every edge directed forward).
- Validation: **twelve** networks (Table B.2); all checks passed on all twelve; one error found (node-split identifier collision, found on RTS-24, fixed).

**Assumptions.** Point capacities; DAG; static; node capacities by splitting; super-terminal reduction with infinite connectors; RTS orientation by DC power flow at peak under uniform participation factor; net-injection formulation.

**Stated limitations (§6.9).** Point-valued (best/worst = two solves; flow value direct by monotonicity, cut structure and thresholds not monotone); exact on candidates; no probability; single fixed instance; whole-graph connectivity is zero on any DAG.

**Extra questions.**
1. *Mathematician: "'Exact' sensitivity on saturated edges only — what about a non-saturated edge?"* → §6.9: a small change cannot matter, a large enough one can; state it before they do.
2. *Mathematician: "The corrected statement of the lattice: what changed in the E_some set?"* → Added v ∉ Reach_{G_f}(u): if v is reachable from u in the residual graph then every closed set containing u contains v, so no minimum cut separates them; if not reachable, S*∪Reach(u) is closed and separates them.
3. *Civil: "Is the flagship benchmark a real system?"* → No: synthetic worked example built so each module has something to report (§6.8.1 says so). The real case is RTS-24.
4. *Civil: "Why does 24 give 100% of demand?"* → Net-injection model: throughput is bounded by net import demand; generators and lines have slack at peak.

**Weak spots.** N14, N20; the flagship results are by construction; RTS-24 and Net3 flow are demand-limited (they report slack); max-flow ≠ hydraulics/Kirchhoff; enumerator exponential regardless of output; thresholds argued not proved.

---

## Chapter 7. Information as Schedule and Cost: Critical Path Toolkit (pp. 133–152)

Full entry: **A.6**. Here remaining items.

**Assumptions.** Node durations d_v and edge delays w_uv (point-valued for the split); LongestPath for the proved split; MaxScaling needs positive values (margin P/t_v − 1); unit-agnostic ("durations, costs or any other quantity that accumulates along a path"); Accumulation needs a target (default: sink with largest forward value); critical iff margin exactly zero (the float-tolerance caveat in Ch. 8 §8.5: a float within tolerance of zero is set to zero before the interval is built).

**Stated limitations (§7.9).** Split only LongestPath, ShortestPath dual not derived; point-valued edge values; no p-box durations ("the margins would meet the same dependence problem… no corner argument applies"); cost grows with bypass sets; **fixed screening threshold**; whether a proposed new pair has a backward pass is unchecked by the implementation.

**Extra questions.**
1. *Mathematician: "MaxScaling is 'residuation' too?"* → Yes: max with × (on non-negative values) is an order with a monotone ⊗ having a residual; the margin is a ratio rather than a difference. Net3 uses it with reliabilities as factors (best route 0.9928, weakest best route 0.7515 at node 76).
2. *Mathematician: "Why is Accumulation's 'allowance' a meaningful margin?"* → It is not a slack against a deadline; it is the headroom under a budget divided across the node's routes, exact for a single node changing alone (my reading above). The thesis calls it "an allowance against a stated budget".
3. *Civil: "What would I do with the necessarily critical set?"* → Those are the activities to manage regardless of how durations fall in their ranges; the possibly critical set is the watch list.
4. *Civil: "What does the schedule toolkit not know?"* → Resources: PSPLIB's resource requirements are not used; the toolkit computes the precedence-only schedule, which equals the instance's recorded MPM-Time (38).

**Weak spots.** N1 (appendix ±10% vs ±20%), N18, LongestPath only, the Net3 decline, the dual not written out.

---

## Chapter 8. Package Implementation in Julia (pp. 153–166)

**Key claims.** Every method of Ch. 3 to 7 is implemented **once**, in one package; "no analysis logic exists anywhere else"; the interface "adds nothing to the computation". The chapter is "written for an engineer who would extend or embed the package, and an examiner who wants to know whether the software is a faithful and verifiable realisation of the methods". Julia chosen for multiple dispatch (one name, a method per value form), compiled performance with no second language, and an existing p-box library (`ProbabilityBoundsAnalysis.jl`). Two expectations failed: threading ("recursive task spawning over nested diamonds overflowed the task stack on deep networks, and the shared diamond cache would have needed locking that removed the gain") and JIT (first call slow, so **every timing is second-call**).

**Structure (Table 8.1, p. 156).** A facade `InformationPropagationAnalysis` re-exporting what the text calls **twelve** names (N29: the enumeration that follows gives eleven; five module names `Input`, `Diamonds`, `Probability`, `CriticalPath`, `Flow`; two value types `Interval`, `pbox`; four entry points `new_identify`, `update_beliefs_iterative`, `critical_path`, `analyze_all`) plus two internal support modules (`GraphValidation`, `GraphTraversal`). Sizes: Input + GraphValidation + GraphTraversal 3 files / 1,440 lines; Diamonds 6 / 3,355; Probability 6 / 747; Flow 12 / 6,101; CriticalPath 6 / 626. The decomposition is "four times the size of the propagation module it serves". The registered `CriticalPath` is the mode-based toolkit (development name `CriticalPathV2`; V1 dropped). A fourth analysis = a new module reading the graph object. "No imports between toolkits" is what the code enforces.

**The graph object (Table 8.2).** A Julia named tuple: `edgelist::Vector{Tuple{Int64,Int64}}`, `outgoing_index`/`incoming_index::Dict{Int64,Set{Int64}}`, `source_nodes`/`sink_nodes`/`fork_nodes`/`join_nodes::Set{Int64}`, `iteration_sets::Vector{Set{Int64}}`, `ancestors`/`descendants::Dict{Int64,Set{Int64}}`, `unique_subgraphs`. Built once by `read_complete_network`. **Why not `Graphs.jl`** (four reasons): contiguous 1…n ids (infrastructure ids have gaps); flat topological order rather than layers; no DAG type (acyclicity checked after construction, whereas Ch. 3 enforces it during ingestion); property-graph attaching of user-typed per-edge values is not type-stable (inner loops would allocate).

**Value forms (Table 8.3).** Float64 = Base arithmetic; `Interval(lower, upper)` immutable struct; `pbox` re-exported from `ProbabilityBoundsAnalysis` (operators `convIndep`, `convFrechet`, `convPerfect`). Helpers over which the propagation is generic: `multiply_values` (product / corner product / independent convolution), `complement_value` (1−a / [1−ā, 1−a̲] / 1⊖a), `sum_values`, `prod_values`, `pbox_conditional_combine` (wA+(1−w)B / corner enumeration / mixture over w with the positive-dependence blend). Direct dependencies: **four** (`ProbabilityBoundsAnalysis`, `JSON`, `DataStructures`, `DelimitedFiles`); `Combinatorics`, `DataFrames`, `Distributions` were removed. The CPM toolkit does **not** use dispatch for intervals (reason in Ch. 7); its `ValueInterval` carries a result and checks `lower <= upper` with no tolerance, so a float within tolerance of zero is set to zero by the caller before the interval is built.

**Caches and memory (§8.6).** Decomposition cached per (structure file, prior file) content hash; solved diamonds memoised under a compact key of hashes of the edge list and the priors; dedup reduces work to 1–5% of the a-priori bound. **Memory, not time, limits the toolkit**: under interval inputs the store reached **2 million entries and 24 GB** on one benchmark where the same network under point values needed **3,000**; a **lean mode** (off by default) stores only the belief at each entry's own join, ≈ 100× smaller; gated on identical results across an eleven-network regression set; identification failures at scale are out-of-memory, not time-outs.

**Validation infrastructure (§8.7).** Formal test suite **214 assertions** via `Pkg.test`, GitHub Actions on Julia 1.12, Ubuntu and Windows; chiefly a brute-force exact-reliability oracle over diamonds with up to 17 state bits; slow because **`ProbabilityBoundsAnalysis.jl` cannot be precompiled on Julia 1.12** (an upstream method overwrite), so the dependency chain loads interpreted; CI sets `JULIA_PKG_PRECOMPILE_AUTO=0`. **What the suite certifies is narrower than the chapters' claims**; the evidence for the chapters is a set of oracle-backed validation scripts (not a test suite; converting them is future work). **Six errors found** by the scripts: (1) context/key collision of diamonds on reconvergent grids under non-unit priors; (2) eligibility test excluded every prior-one node (no diamonds when all priors are one); (3) floating-point residual of a degenerate float on PSPLIB (strict constructor tripped); (4) node-split identifier collision (2v, 2v+1) on RTS-24; (5) "in every min cut" set computed on the wrong side of residual reachability (visible on the smallest network in the interface); (6) p-box input validation (library min/max of an imprecise box returns a box, not a number). "Each is a boundary the synthetic corpus did not reach and a real or benchmark instance did."

**Server (§8.8).** `InfoPropServer` on `HTTP.jl` and `JSON`; binds loopback; CORS only from the interface's origin ("the mechanism behind the data-sovereignty claim"); upload = session folder holding files byte for byte + metadata + persisted decomposition; handler per analysis; each response carries a request id and, on failure, the exception message and a bounded stack trace; OpenAPI 2.0.0 contract from which the client is generated. The handler catches only `SplitDeclined` (earlier, floating-point error was reported to the user as intractability).

**Distribution (§8.9).** General registry `InformationPropagationAnalysis.jl` **v0.2.1** (registered via PR #166556 at 0.2.0, updated to 0.2.1; **now 0.2.3**); results under Julia **1.12.6**; git-tree-sha1 `adcdacd7cc306d8ffe15e440ff0c7b72ce6f024a` (App. B); the same 214 assertions pass identically on 0.2.0 and 0.2.1; clean-depot install check: belief(5) = 0.5832878525190001 on the power network, max flow 10.0 = min cut 10.0, longest path 10.0. Repositories: `information-propagation-no-code` (server and interface; app DOI `10.5281/zenodo.22180253`), `InfoProp-Thesis-data` (corpus, scripts, logs, case-study inputs, figure scripts; DOI `10.5281/zenodo.22821351` per the thesis; N16), shared with the RESS paper.

**Numbers to know cold.** "twelve" re-exported names (eleven enumerated, N29); 7 modules (5 toolkit-facing + 2 support); 1,440 / 3,355 / 747 / 6,101 / 626 lines; 214 assertions; 6 errors; 2 M entries / 24 GB versus 3,000; ≈ 100×; 0.2.1 (now 0.2.3); Julia 1.12.6; 4 direct dependencies.

**Assumptions.** Julia 1.12 (PBA precompile issue); single thread; loopback.

**Stated limitations (§8.10).** Single-threaded propagation; test suite small instances only; two structure formats only, no domain conversion; no p-box CPM, no interval/p-box flow.

**Likely questions: mathematician.**
1. *"How do you know the code implements the algorithms you proved?"* → Two layers: a 214-assertion suite (small instances, brute-force oracle) and oracle-backed validation scripts (BDD, path enumeration, Monte Carlo, an external flow library, corner enumeration) on a fixed corpus with recorded seeds; six errors were found this way and fixed at cause. No formal verification. Say that plainly.
2. *"Your test suite does not cover the scale you report."* → Stated (§8.10, Ch. 11). The scale claims rest on the validation scripts and logs archived in the data repository.
3. *"Floating-point: is exactness meaningful?"* → Proofs over the reals; reported agreement is round-off (10⁻¹⁶); the CPM constructor's strictness exposed a one-ulp difference and the fix is in the caller.
4. *"Why not parallelise over layers?"* → Tried; stack overflow in recursive task spawning on deep networks and a shared cache that would need locking; future work (lock-free store).

**Likely questions: civil engineer.**
1. *"Can I install it?"* → Registered in the Julia General registry; installs with the package manager; the interface is a separate repository.
2. *"Is it maintained, licensed, versioned?"* → Versioned (0.2.3 now); Zenodo-archived data and application; do not claim a support commitment.
3. *"Which Julia versions?"* → 1.12 tested. (My notes from 2 September record that Julia 1.13 fails because `ProbabilityBoundsAnalysis` method overwriting becomes a hard error; not in the thesis; upstream issue, post-viva. N26.)

**Weak spots (Ch. 8).** N29 (twelve versus eleven re-exported names). N23: Ch. 8 claims "Reproducing a chapter's numbers is a matter of installing the package at the version stated, checking out the archived repository at the cited tag, and running the scripts". My notes from 2 September record that the clean-room re-run of the ≈ 22 cited scripts against the pinned package was **deferred to a post-viva v1.1 tag** (a compatibility shim and a few repointed calls); data, numbers and recorded responses are final. If asked "have you re-run them from scratch?", answer accurately: the recorded outputs are archived and final; the scripts are being brought to run unchanged against the pinned release. N26 (Julia 1.13). The thesis names six errors in the validation scripts' findings but gives bug history in a thesis chapter (that is already in the text; be ready to describe them in one line each). Table 8.1 line counts are a size indicator, not a quality measure.

---

## Chapter 9. The No-Code Web Interface (pp. 167–181)

**Key claims.** The analyses exist as a package, "a package is used by writing code", and the engineer does not code. The interface is a browser app running on the engineer's own machine that "takes the same files the package reads, runs the three toolkits… through the local server… and returns every result in the form the package computed it". Four requirements: no code; files **byte for byte** the package's; the model does not leave the machine; the screen shows what the package computed and adds no interpretation. Four **rules the interface enforces** (§9.4): (1) *a value keeps its form* (one `ValueDisplay` renders every value; a few summary tiles use a midpoint and say so); (2) *a result set is what the toolkit returned* ("no score, ranking or threshold is computed in the interface"); (3) *every result carries its method* (exact / enclosure; exact / decomposition-only); (4) *one analysis runs at a time* (single-threaded propagation, unlocked cache).
**One rule it does not yet enforce:** the p-box level. The library default is 200; KarlNetwork at the default ran **17 minutes** and blocked the single-threaded server; at level 50 it completes in 9. No control, no default of its own, no estimate or warning.

**Workflow (§9.3).** Upload a folder (structure file at the root, one sub-folder per scenario, any subset of four input files); the upload page lists what it found before sending; session = folder + metadata; network page shows the graph object (counts, sources, sinks, forks, joins, layered order, drawn by layer: where a mis-oriented edge shows up); per-toolkit pages share a layout (scenario chips with value form, value-form filter, tabs). Reliability tabs: Belief, Diamonds, Visualisation (conditioning set highlighted), Compare. Flow: configuration, summary, bottlenecks, visualisation. Schedule: time, cost, visualisation, compare. A diamond opens a detail view with two actions: run alone (local-source priors overridable) or **promote** to a new network. Compare tab: any subset of scenarios, runs unrun ones **one at a time**, side-by-side table with optional baseline differences. **System-profile page:** every result set on the network, one drawn by layer, a second overlaid.

**Architecture (§9.5).** Angular in an Nx workspace; Fluent web components (no card, table or grid component, so cards are its own, tables native HTML styled with tokens), d3 for drawing; about forty components registered at start-up, about fifty icons. Two build-enforced dependency rules: a **layer rule** (shell → features → shared; presentational components depend only on presentational components and the API client, never on data access) and a **scope rule** (a feature depends on its own scope and shared only, so no feature imports another; the standalone Diamonds page lives inside the reliability library); "checked by the linter on every build, which is how the claim that the three analyses are independent is made to hold in the interface as well as in the package". Loopback server; every request names files by session path; no request carries the network in its body.
**Contract (§9.6).** OpenAPI **version 2.0.0**, **fourteen** endpoints (I counted 14 paths in `API_CONTRACT_OPENAPI.yaml`, OpenAPI 3.0.3 format) from which the client is generated; values keep their form on the wire (number / interval object with lower and upper / typed p-box object); the contract changed once (three endpoints renamed to match the thesis's toolkit names, old names kept as aliases).
**Evaluation (§9.7).** "used by its author and demonstrated to others, and it has not yet been used independently by an engineer who does not program"; a **task-based walkthrough** (labelled as such); eight tasks; "cannot show the time a new user takes, where the labels are unclear, or which of the four rules a user notices".
**Limitations (§9.8).** No p-box level control or warning; no user study; two structure formats, no EPANET/MATPOWER import; one analysis at a time; session is a folder, no export beyond the response JSON; inherits every package limit.

**Numbers to know cold.** 4 requirements; 4 rules; 14 endpoints; contract 2.0.0; 17 min (L = 200) versus 9 min (L = 50) on KarlNetwork; ≈ 40 components, ≈ 50 icons.

**Assumptions.** A single user on one machine; the user knows the system and its data and is comfortable with a spreadsheet and a browser.

**Likely questions: mathematician.**
1. *"The interface 'adds nothing to the computation'; how do you know?"* → Rule 2 plus the Ch. 10 record of every request and response beside its screenshot; and files are not re-encoded. The honest qualifier: a few summary tiles use midpoints (labelled), Compare shows baseline differences and the profile page intersects result sets (Ch. 10 §10.7, "three nodes in both"); these are arithmetic on returned values, not analyses, but they are numbers computed in the interface (N28).
2. *"Errors were found in the interface during the Net3 run."* → Yes (Ch. 10 §10.8): non-finite values rendered as not-a-number in one column; the Compare table collapsed an interval scenario's two counts into one number, which is exactly a violation of rule 1. Both fixed; recorded.

**Likely questions: civil engineer.**
1. *"Has any engineer used it?"* → No independent use; the evidence is a walkthrough. The study is future work (§9.7, Ch. 11).
2. *"Does it keep my model on my machine?"* → Local deployment: the server binds loopback and accepts requests only from the interface's own origin; no request leaves the machine. The public website is a demonstration with example networks (N-listed issue 10). (A security reader might note that loopback binding and a CORS origin check stop remote access and other websites reading responses but not other processes on the same machine; the thesis claim is "no request leaves the machine", which holds. N25.)
3. *"Why Angular and Nx?"* → The build-enforced layer and scope rules make the independence claim hold in the interface; the choice is an engineering one, not part of the thesis's argument.
4. *"What if a run takes too long?"* → Known gap: p-box level control and a warning are listed as future work.

**Weak spots (Ch. 9).** N24: Ch. 9 says the workspace holds "eight projects" and lists a shell, five feature libraries and three shared libraries, which is nine (the repository has nine `project.json` files). N25 (loopback is not authentication). N28 (computed-in-interface numbers). The chapter reports no number from a screen by design, so it has no quantitative validation; its credibility rests on Ch. 10.

---

## Chapter 10. An End-to-End Application: One Network, Three Analyses (pp. 182–197)

**This chapter was corrected after submission; read the correction section first.**

### Key claims

One public water network (EPANET Net3, the third example network, file as bundled with WNTR 1.5.0) is converted **once**, uploaded through the interface and analysed by all three toolkits under several scenarios; every number is the one the server returned, with request and response recorded. It shows "the claim of Chapter 1 that one model of a system serves all three analyses without the topology being entered again". The joint finding: **the river pump** lies on both the degraded minimum cut and the restoration critical chain. Two boundaries were reached (p-box not run; exact interval floats declined) and three implementation errors found and fixed.

### The correction (what the submitted text said and what it says now)

| Item | Submitted | Corrected | Why |
|---|---|---|---|
| Baseline throughput | 1,837.9 L/s | **680.1 L/s** (680.14), the whole demand | 58 demand edges into the super-sink were missing from the edge list the flow analysis read; the server silently ignored capacity entries for edges the edge list did not contain; throughput exceeded total demand (680.14) |
| Degraded throughput | 954.6 L/s | **43.3 L/s** (6.4% of demand; 43.34) | same |
| Minimum cut baseline | — | unique; the 58 demand edges; free zone empty | |
| Degraded min cuts | — | **24** over a free zone of **6** nodes; **7** edges in every cut: the river pump (95→97, capacity 0) and demand edges of junctions 7, 8, 77, 79, 80, 81 | |
| Overlay | "no node in common" | **3 nodes in common**: 95, 97 and the super-sink | the river pump is on both the degraded cut and the restoration critical chain |
| Ch. 6 | "exactly 2^|F|" cuts, any free-zone node can move alone | "at most 2^|F|" (Picard–Queyranne) | no number changed |

Checked against an **independent Edmonds–Karp** implementation: 680.14 and 43.34, reproduced exactly by the corrected run. The server now **refuses** a capacity file naming edges missing from the edge list and names them. The algorithms were correct for the graph they received; the fault was in the inputs and the interface layer (§8.8). The reliability and schedule results are unchanged. Errata sheet (`errata.tex/.pdf`) and the marked-up pages exist. Do not narrate the server fault unless asked; say it in 30 seconds (the script is in `SPEAKER_NOTES.md`).

### The network and structure (§10.2)

Net3: two reservoirs (lake, river), three tanks, **92 junctions**, **117 pipes**, **2 pumps** → 97 nodes, 119 links. Oriented by the sign of each link's flow at the **final time step (604,800 s)** of the file's own seven-day simulation; three zero-flow links kept the declared direction; **no link dropped or merged** (the flow-oriented network was already acyclic). Graph object: **97 nodes, 119 edges, 3 sources** (the two reservoirs and one tank discharging at that step), **18 sinks** (16 demand junctions and two filling tanks), **35 forks, 23 joins, 28 layers**; decomposition **21 maximal, 307 unique diamonds, width 12**. An older breadth-first-oriented conversion has almost the same number of maximal diamonds and width **5**: the hydraulic orientation "keeps more of the network's real loop structure". The capacity analysis reads a copy with a super-sink and its **58** demand edges: **98 nodes, 177 edges** (119 + 58).

### Inputs (§10.3): what is sourced and what is assumed

- **Reliability.** Node priors all 1 (junctions are demand points; reservoirs and tanks have no failure mode here); reliability lives on edges. **Pumps 0.99** ("general guidance; no figure exists for these pumps" — the pumping literature's level for critical assets). **Three links** are placeholder tank connectors in the `.inp` (length 99 ft, diameter 99 in, roughness 199) and carry exactly 1. The **114 pipes**: probability of **no break in one year** from an annual break-rate model with breaks per 100 mile-years by diameter class from the **Utah State University survey** (Barfuss 2023): **13.3** for 3–12 in, **3.1** for 14–24 in, **0.2** for 30–36 in, all materials combined (the file records none); rate × length = expected breaks; Poisson probability of none = edge value; range **0.891** (longest small-diameter main) to **1.000**. Interval scenario widens every value that is not exactly 1 by **5% either side**.
- **p-box not run:** Σ over the 307 diamonds of 2^|C| = **5.5×10⁴**, beyond the point where a comparably costed drone design did not complete.
- **Capacity (L/s).** Pipe capacity = flow at **1.5 m/s** through the stated diameter; pump capacity = the **largest flow point of its own curve**: **252.4** (lake pump), **883.3** (river pump); reservoir edges and the three placeholder connectors unbounded; super-sink with one edge per **58** demand junctions, capacity = that junction's demand at the simulation step, **680.1 L/s** total; the capacity file names the super-sink as the only sink (otherwise the two filling tanks and one dead-end junction without demand would count as delivery points). **Degraded scenario:** the dominant transmission main (8.6-mile 30-inch, "by a wide margin the longest large-diameter link") derated to half, and the **river pump out of service**.
- **Schedule (restoration programme).** Per pipe: **1 h isolate (assumed)**, **2 h** pressure test, flush of three pipe volumes at 3 ft/s (minutes to **12.6 h** on the trunk), **24 h** chlorination hold, **40 h** bacteriological sampling (AWWA C600, C605, C651) → **67 h + flush**; pumps **8 h**, tanks **24 h** (both assumed); reservoirs and junctions 0; interval scenario ±**20%**; a fourth scenario carries the reliability edge probabilities as multiplicative factors with unit node values for MaxScaling.

### Results to know cold

- **Reliability (baseline):** belief ranges from **0.806** (node 76) to 1 at sources; mean **0.934** over the network, **0.928** over the 18 sinks; spot checks node 32 0.856, 29 0.930, 81 0.977, 54 0.810, 78 0.843; **4.6 s** warm. **Interval (±5%):** mean band **0.363**, max **0.636** at node 76, belief in **[0.354, 0.990]**; "cannot be certified above 0.35 at its worst-served junction". **Diamonds:** largest at join 77 spans 46 nodes, 56 edges, eleven sub-diamonds; width-12 set belongs to a diamond nested inside; **every one of the 21 maximal diamonds conditions on node 95 alone at its own level**; union of conditioning nodes across all 307 diamonds = **26 nodes**.
- **Capacity (baseline):** **680.1 L/s**, whole demand; **unique** minimum cut = the 58 demand edges; two pipes run full (18→17 and 86→87) but neither lies in a minimum cut; **401** source-to-sink paths; no SPOF; tightest cut edge 0.07 L/s (junction 64); sensitivity: junction 58 loses 280.1, junction 92 loses 103.3; marginal range finite, **327.3** for junction 58; worst pair 58 + 92 = **383.3** L/s. **Degraded:** **43.3 L/s (6.4%)**, 24 min cuts, free zone 6, seven edges in every cut; six junctions fully served (7, 8 downstream of the lake pump; 77–81 downstream of the discharging tank), **52** others receive less than their demand; the derated main does not bind because the river pump is its only feed. **4.1 s** (baseline).
- **Schedule:** **1,773.3 h ≈ 74 days** along a **28-activity** chain from the river reservoir through the trunk main and the eastern loop to junction 69; **27** more activities within 10% of the project value; interval **[1,418.7, 2,128.0] h** (= 59 to 89 days); exact floats **declined** (122 interval durations > the fixed screen of 60), conservative enclosure: **0** necessarily critical, **61** possibly critical; MaxScaling: best route **0.9928**, weakest best route **0.7515** at node 76 (worst-served node under both interpretations). **2.1 s** (baseline).
- **Overlay (§10.7):** degraded minimum-cut edges vs baseline critical path share **three nodes: 95, 97 and the super-sink**; "the pump whose loss leaves 6.4 per cent of the demand served also lies on the chain that sets the 74 days of restoration".
- Whole sequence under a minute of computation in a warm process (4.6, 4.1, 2.1 s).

### Assumptions

Operating snapshot (orientation at one time step); independent pipe failures (Poisson), no common cause; velocity-based capacity (no head loss, no pressure); demand fixed at the simulation step; restoration dependencies = flow orientation; assumed durations for isolation, pumps, tanks; a perfect-source assumption on reservoirs and tanks.

### Stated limitations

Two boundaries (p-box; fixed screen); degraded states need their own orientation (§10.5); the interface and the server errors found.

### Likely questions: mathematician

1. *"Is Net3 a validation or a demonstration?"* → A **demonstration** of the one-model claim. Its flow numbers were corrected and checked against an independent Edmonds–Karp. For reliability and schedule, Ch. 10 reports server outputs and does not report an independent oracle run on Net3 itself (N27): their exactness rests on the proofs and the corpus validation (Ch. 5, Ch. 7). Say that.
2. *"Your baseline cut is just the demand. What is the flow analysis telling you?"* → That at this demand and these capacities the network is not the limit: throughput = demand, the minimum cut is the 58 demand edges, unique. The informative parts are the **degraded** result, the sensitivity to demand, and the structural facts (no SPOF, 401 paths).
3. *"24 minimum cuts: distinct as edge sets?"* → They are node partitions over a free zone of six (24 closed subsets out of 64); I did not check distinctness as edge sets (A.5.3 Q3).
4. *"The correction: what exactly was wrong, and could other results be wrong the same way?"* → The edge list did not contain the demand edges; the server ignored unmatched capacity entries. The server now refuses a file whose capacity edges are not in the edge list and names them. The other two toolkits do not take a capacity file; reliability and schedule results are unchanged and unaffected by this path.
5. *"Why 24 cuts but 'the river pump in every one'? Is that a theorem or an observation?"* → Observation from the enumeration: seven edges (the pump and six demand edges) lie in every one of the 24 (E_every); that is the structural reason: with the pump at zero capacity it is trivially saturated and in every cut.
6. *"Interval schedule: 'possibly critical 61' of 97?"* → Conservative enclosure over-flags; the exact split was declined by the fixed screen without being priced; the thesis lists replacing the screen as future work, and states it is a limitation of the screen.

### Likely questions: civil engineer

1. *"You oriented the network by one time step. What about flow reversal and diurnal demand?"* → Stated limitation (assumption 4). The degraded result is largely a consequence of it: in the physical network the lake pump could drive water through pipes that run the other way at the snapshot; the oriented model cannot represent that. A degraded state needs its own orientation (backup slide).
2. *"Is max-flow with 1.5 m/s hydraulics?"* → No. It is a capacity upper bound; it ignores head loss, pressure, tank levels, and how flow actually divides. Baseline = demand is not evidence of hydraulic adequacy (N5). It is useful for finding which constraint binds and which failures matter.
3. *"Why 1.5 m/s?"* → An assumed, conservative-end design velocity (the thesis calls it "the conservative end of the range"; the convention is not otherwise stated in the chapter, N5). Be ready to say it is a stand-in: any rated capacity from the utility replaces it.
4. *"Where does 0.99 for the pumps come from?"* → Pumping-reliability guidance for critical assets (Butts 2022); "no figure exists for these pumps"; it is an assumption.
5. *"What is the break-rate model?"* → USU survey rates by diameter class, all materials combined, Poisson probability of no break in a year; pipe age, material and soil are not modelled; the file records no material.
6. *"What does 'belief 0.806' mean?"* → The probability that supply reaches node 76 with **no pipe break in the year** along a viable route, under independent breaks; a reliability over a horizon, not an availability (repairs take hours to days and are not modelled) (N7).
7. *"Is ±5% a modest uncertainty?"* → On survival probability 0.99 it is a break probability moving from 1% to ≈ 6%; the thesis does not calibrate it; it is a stress test that shows how the range compounds along long chains of small-diameter mains (N2).
8. *"Is 74 days a forecast?"* → No: the longest chain of a model in which each pipe is recommissioned only after the pipes upstream of it, with standard disinfection holds dominating (67 h of every pipe's duration are the regulatory holds); parallel crews and sectional isolation would shorten it (N6). The informative result is **where** the chain runs (the trunk main, because of its 12.6 h flush).
9. *"What would you tell the utility?"* → Reinstate the river pump first: it sits in all 24 degraded minimum cuts and on the restoration critical chain; junction 76 is the weakest point for supply reaching it.
10. *"Why Net3?"* → Public, citable (EPANET Example 3), with pumps, tanks and two reservoirs, so the conversion can be repeated; not a claim that Net3 is typical.

### Weak spots (Ch. 10)

N2, N4, N5, N6, N7, N17, N27: (a) the baseline flow result is demand-limited by construction; (b) the restoration model's dependency rule and several durations are assumed; (c) the interval widening is not calibrated; (d) §10.4 misdescribes node 95 (upstream of the pump, not downstream; edge list `2,95`, `95,97`); (e) "no link dropped" although pipe 330 is `Closed` in the `.inp`; (f) the Ch. 10 reliability and schedule outputs carry no independent oracle in the chapter; (g) the "conditions on node 95 alone" statement is striking and should be explainable (my reading, from the edge list): node 95 sits at the river reservoir's only entry (edge 2→95) and is a fork (95→96 into a dead-end junction, 95→97 the pump), so every reconvergence that involves the river supply passes through it.

---

## Chapter 11. Conclusions and Future Work (pp. 198–205)

Full anchors, limitations and future-work list: **A.7**.

**Numbers to know cold.** Five answers; six contributions; 1.1×10⁻¹⁶ on 129 graphs; grid reproduced at every sink; power at one of three regimes (10⁻³ residual at the other two); six errors; version 0.2.1 (now 0.2.3).

**Assumptions.** The four of Ch. 3.

**Likely questions** → A.7 (whole-thesis questions).

**Weak spots (Ch. 11).** Version 0.2.1; "about fifty nodes" (N3); the Net3 closing remark holds after correction but should be said with "in every one of the 24 degraded minimum cuts and on the restoration chain"; Ch. 11 §11.4 states the interface "gives no warning before a long run"; the conclusion that the pump finding "no single analysis could have said" is a statement about the demonstration, not a general result.

---

## Appendix A. Case-Study Network Specifications (pp. 207–215)

**What it holds.** Provenance of every named network (Table A.1): power-network 23/27 (Tong & Tien Fig. 11, already directed, sources {1,7,18}, sink 23); grid-graph 16/24 (Fig. 10, sources {1,3,13}); KarlNetwork 26/74 (colleague-generated 18-diamond stress test); counterexample-n15 15/23 (adversarial instance for an earlier routine); metro 306/350 (Berlin U/S-Bahn, oriented by BFS from node 18); PSPLIB j301_1 32/48; IEEE RTS-24 24/34 (26/54 with super-terminals); drone designs 217/263, 242/1753, 230/1648; bnlearn (17 + munin + water); Net3 97/119; the random and adversarial corpus (129 graphs, reconstructed from recorded seeds).

**Weak spots.** **N1** (§A.6 says ±10%); N15 (§A.2 "five folders" names three; §A.12 "10 to 28 nodes" and "uniform at 0.9" versus Ch. 5); the Net3 entry (§A.11) does not mention the super-sink construction that Ch. 10 uses (App. B covers the headline numbers); Appendix A says synthetic networks "carry no independent provenance".

## Appendix B. Full Numerical Results (pp. 216–223)

**What it holds.** Timing convention (**second call, warm process, one core, discarded warm-up; ratios of run counts where machine-dependent**); 129-graph exactness; named reproductions (Table B.1); adversarial families; flow validation (Table B.2: grid-5x5 35, metro 29, Karl 39, water 154, PSPLIB 14, continental 501, ergo 479, glasgow-shetland 762, highland-lowland 3,326, drones 755 / 5,939 / 6,044, all PASS); DIMACS timing (Table B.3); CPM float validation (Table B.4: ten networks, "…and five more"); Net3 headline (Table B.5); figure/table → script/data map (Table B.6) with package v0.2.1 (git-tree-sha1 `adcdacd7…`), app v1.0 (DOI `…22180253`), data DOI `…22821351`.

**Weak spots.** **N1** (§B.4 ±10%); Table B.1's caption calls the power residual "a modelling difference from the paper" while Ch. 5 and Ch. 11 say it is "not explained" (reconcile as in N12); Table B.5 labels the Net3 interval row "certified requirement range [0.35, 0.99]" though it is node 76's belief range; Table B.2's PSPLIB entry F* = 14 uses capacities drawn uniformly from [1, 20] (a validation set, not the schedule case); the figure map says interface figures are "not reproducible artefacts".

---

# PART C: CROSS-CHAPTER

## C.1 The through-line, in five sentences

1. Process systems with a fixed direction of flow are DAGs, and three engineering questions about them (reach, deliver, complete) have always been answered with three models that each want one number per input.
2. The thesis builds one graph object and three toolkits that read it, so the topology is entered once and the value on a component changes meaning (probability, capacity, duration) and form (number, interval, p-box).
3. The recurring difficulty is redundancy: reconvergent routes share upstream components, which breaks every local calculation and is what makes exact analysis expensive, so the decomposition module finds it once and the probability and schedule toolkits each pay for it by their own width (conditioning set; bypass set).
4. Where the mathematics allows, uncertainty is carried through exactly (interval beliefs by monotonicity; interval forward times by two corners; interval floats by the domination split), and where it does not, the output is a sound bound whose provenance is tagged (p-box beliefs; the conservative enclosure).
5. Every exact claim is checked against a computation that shares none of its machinery, each method's boundary is stated, and one public network shows the three analyses agreeing on where the problem is.

## C.2 Recurring themes

- **Exactness versus cost.** Exact analysis is #P-hard (reliability) or NP-hard (interval floats); the thesis states the exponent each time: conditioning width |C| (cap ≈ 18), bypass width |H_v|, free-zone size |F|, discretisation level L. Say "exact at a cost set by structure".
- **Soundness versus tightness.** *Sound* = the truth is inside the reported bounds; *exact* = the bounds are attained; *tight* = narrow. p-box: sound (Fréchet proved; default validated); enclosure: sound not exact; the split and interval beliefs: exact.
- **Conditioning width as the one structural cost.** The same quantity in disguise governs BDD size, the PPA's sub-problem count, the bypass sets of the split (different granularity, same phenomenon: "the regime in which the conditioning sets… grow"), and the drone and Net3 boundaries. Imprecision never relaxes it ("a network too reconvergent for exact point propagation is equally beyond exact interval or distributional propagation").
- **Validated versus proved, stated each time.** Proved: Ch. 3–5 core, Thm 6.5 cited, Ch. 7 split. Validated only: the p-box default, thresholds' implementation, everything at scale. Demonstrated only: the interface, Net3.
- **The snapshot.** Acyclicity and static topology are properties of one operating snapshot; every limitation about flow reversal, degraded states and diurnal demand traces to it.
- **A result names its method.** Interface rule 3; the CPM tags; "exact" versus "conservative enclosure".
- **The thesis's own working method:** every number produced by the toolkit and checked by a computation sharing none of its machinery; boundaries located and refused beyond; errors recorded where a real instance reached what the corpus did not.

## C.3 Cross-chapter consistency check

**Confirmed consistent across chapters (I checked each against the source text):**
129 graphs and 1.1×10⁻¹⁶ / 2.8×10⁻¹⁶ (Ch. 1, 5, 11, App. B); 0.749 / 0.675462 (Ch. 5, slides); the 2k+1 counts (Table 5.4); width 12 and 21 / 307 diamonds (Ch. 10, App. A); Net3 corrected 680.1 / 43.3 / 6.4% / 24 cuts / 3 shared nodes (Ch. 10, App. B, SPEAKER_NOTES); 74 days and 59 to 89 days (Ch. 10 §10.6, §10.9); 0.81 and [0.35, 0.99] (Ch. 10 §10.9, App. B); 50,524 versus 2^30 and ≈ 21,000× (Ch. 7, Ch. 11); 17 min / 546 s on KarlNetwork (Ch. 5 §5.10.4, Ch. 9 §9.4: 546 s = 9 min); Islay [0.562, 0.722] (Ch. 5, App. A); eligibility correction 17 → 16 (Ch. 5 §5.11.2); twelve flow networks (Ch. 6, App. B); six errors found (Ch. 8, Ch. 11); fourteen endpoints and contract 2.0.0 (Ch. 8, Ch. 9; I counted 14 in the YAML); 98 nodes / 177 edges for the capacity graph = 97+1, 119+58.

**Inconsistencies and loose ends found (all new, listed at the top as N-numbers):**

| # | Where | What disagrees | Right answer / action |
|---|---|---|---|
| N1 | Ch. 7 vs App. A.6, B.4 | PSPLIB interval width ±20% vs ±10% | ±20% (data repo, 30.4/45.6 = 38×0.8/1.2); appendices wrong; errata |
| N3 | Ch. 11 §11.4 vs Ch. 5 §5.11, Ch. 10, App. A | "about fifty nodes" vs exact results at 97, 242, 306 nodes | width not node count |
| N4 | Ch. 10 §10.4 vs net3.EDGES | node 95 "downstream of the river pump" | 95 is the pump's upstream (suction) junction |
| N11 | Ch. 5 §5.4, slide 5 | 2^10 states for the simple diamond | 9 uncertain components, 2^9 |
| N12 | Ch. 5 §5.7 vs §5.12/Ch. 11 vs App. B.1 caption | residual "attributed to transcription or the source's own evaluation" vs "not explained" vs "a modelling difference from the paper" | "our value is confirmed three ways; cause on the published side unresolved" |
| N14 | Ch. 6 §6.7 | "ten DAGs… three drones in place of… plus PSPLIB" reads as 13 | twelve (Table B.2) |
| N15 | App. A.2, A.12 vs Ch. 5 §5.7 | "five folders" naming three; random graphs "10 to 28 nodes", "uniform at 0.9" vs 10–25 nodes, priors in (0.3, 0.99) | verify against `corpus/random-and-mutated/README.md` |
| N16 | Ch. 8, App. B vs my notes | data DOI 22821351 vs concept DOI 22180227 | open the DOI before Friday |
| N24 | Ch. 9 §9.5 | "eight projects" lists nine | nine |
| N29 | Ch. 8 §8.3 | "twelve names" lists eleven | eleven |
| (ver) | Ch. 8, 11, App. B | version 0.2.1 | now 0.2.3 |
| (self) | Ch. 10 §10.3 | "…the conservative end of the range in Section 10.3's convention" | self-reference; convention not stated |

## C.4 The twelve hardest questions, as a drill (two-line answers)

1. **"Is your p-box default sound?"** Validated on 50 configurations, not proved; Fréchet is the proved operator; the proof route fails because the independent and comonotone sums have crossing CDFs.
2. **"You have no asymptotic advantage over a BDD. Why is this a contribution?"** Correct for point reliability, and the thesis says so first. The contribution is native interval and p-box propagation with a stated guarantee per form, the conditioning decomposition as a reusable module, and one model for three analyses.
3. **"Interval BDD evaluation is already exact."** For one query, yes; the gain is every node in one pass without building a diagram (3.9–99.9× one-shot), and the same machinery carrying p-boxes. The corner argument itself is classical, and the thesis says so.
4. **"Your residual against the published power network?"** Our value is confirmed by the BDD and by exhaustive enumeration of all 2^27 states; no single missing link and no node-versus-link reading reproduces the published triple; the cause on the published side is unresolved; the grid benchmark reproduces to the fifth decimal.
5. **"What did you get wrong in Net3 and how do you know it's right now?"** 58 demand edges were missing from the flow input; corrected 680.1 and 43.3; checked against an independent Edmonds–Karp; the server now refuses such files; reliability and schedule unchanged.
6. **"Why is the degraded flow only 6.4%?"** The oriented snapshot: with the river pump out, the lake pump and the discharging tank reach six junctions; real flow could reverse; a degraded state needs its own orientation.
7. **"Max-flow isn't hydraulics."** Agreed: an upper bound under stated capacities; it finds which constraint binds, not pressures.
8. **"Independence is unrealistic."** It is assumption 1; a common cause is modelled as a shared upstream node; every result is conditional on it.
9. **"Has any engineer used it?"** No independent use; a task walkthrough only; a user study is listed future work.
10. **"The domination split only works for LongestPath, and not on Net3."** Proved for LongestPath; the dual is not derived; Net3 was declined by a fixed screen before the split was priced, which the thesis names as a limitation and replaces in future work.
11. **"How do you know your enumeration of minimum cuts is complete?"** Theorem 6.5 (Picard–Queyranne): closed subsets of the free zone; the enumerator checks all 2^|F| subsets up to `cut_limit` and reports `is_complete`; checked against brute force on networks with ≤ 20 candidate edges.
12. **"What is not proved?"** The p-box default; the thresholds' piecewise-linear argument is prose; the minimality of the conditioning set; completeness of nested sub-diamonds is stated through the recursion rather than as its own theorem.

## C.5 Practical notes for the room

- **Name the limit before they do.** Width ≈ 18; p-box small networks; point-valued capacity; snapshot; LongestPath only; interface demonstrated not studied.
- **Say "exact", "sound", "validated", "proved", "demonstrated" precisely.** The thesis is strict; examiners will hold you to it.
- **If asked about something not in the thesis** (credal networks, treewidth comparison, Kirchhoff): say it is outside the thesis, say what the thesis does claim, and say what you would do.
- **Corrections:** two post-submission corrections are on the errata sheet; N1 is a third candidate (appendix width); decide beforehand whether to add it.
- **Background:** only if asked, one sentence.
- **Net3 numbers to have exact:** 680 and 43 L/s; 24 cuts; river pump (nodes 95→97); 74 days, 59–89; 0.81 and [0.35, 0.99]; width 12, 21/307.

---

# PART D: WHAT I DID NOT DO

- I did not read the Julia `Diamonds`, `Probability`, `Flow` and `CriticalPath` sources line by line; I checked the p-box operator and the split's limits and gate, the server's capacity handler, the Net3 edge list and the PSPLIB data. The statements "code matches" in Part A mean "the names, signatures and limits I checked agree with the text", not a code review.
- I did not re-run any timing or any validation script. The only new computations are the exhaustive power-network checks (`power_bruteforce.py`, `power_remove_one.py`, `power_node_conventions.py` in the session scratchpad, outputs saved beside them; the node-convention script's second line is buggy and is not used).
- I did not open `grid_envelope_frechet.csv`, the Fréchet tightness data, `RESULTS.md` beyond a few lines, or the errata sheet.
- Statements marked **(my reading)** are interpretations I added (why the p-box CDFs cross; the proof sketches for Thm 6.5 and the thresholds; polynomial-delay enumeration; the credal-network remark; the exactness of the accumulation allowance). They are not in the thesis; use them only if you are confident of them.
- Items drawn from my 2 September notes (reproducibility deferral, Julia 1.13, the data DOI) are about five weeks old; confirm them.
