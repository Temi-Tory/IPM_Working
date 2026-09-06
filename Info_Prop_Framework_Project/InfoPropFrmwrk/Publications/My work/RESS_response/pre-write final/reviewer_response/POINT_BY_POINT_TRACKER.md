# Point-by-point reviewer response tracker — consolidated, corrected (2026-09-06)

Base text: `validation/probability/notes/REVIEWER_RESPONSES_draft.md` (2026-07-28), which is
consistent with the current manuscript draft (`validation/probability/newress.zip` → `main.tex`).
This version applies one correction (item 6, first table) that the base draft had not caught, and
flags where a number is pending a fresh re-run (this session's Task 2/3 agent — see
`../data/` when it lands).

One statement used in several responses, kept verbatim: *the dPrPm reference implementation is
unavailable and its authors could not be reached, so validation was re-based on an independent,
open, exact oracle (a reduced-ordered binary decision diagram with dynamic variable reordering),
with dPrPm retained only as the published, explicitly caveated point of reference.*

================================================================================
## Comments to the Authors (first, unnamed reviewer table)

### 1. Limited benchmark validation (single 16-node network) — unchanged, verified current
> We agree, and have substantially expanded the validation. The revised manuscript validates the
> method against an independent exact oracle — a reduced-ordered binary decision diagram (ROBDD)
> with dynamic variable reordering — across a corpus of 129 random and mutated DAGs (10–28 nodes,
> densities 0.14–0.42), six topological families (multi-source, grid/lattice, layered, bridge,
> series–parallel, complete), larger random networks up to 50 nodes, and several real
> infrastructure networks, in addition to the original benchmark. Worst per-node disagreement
> anywhere in the corpus is 1.1×10⁻¹⁶ (floating-point round-off), for both perfect and imperfect
> component reliabilities (new §5.2). The applied drone networks are also now included in the
> exact-method comparison (§5.4.3).
>
> *Freshness note: re-confirmed 2026-08-30, 129/129 exact, 0/129 changed vs. the historical
> corpus (`validation/probability/rerun_129_corpus_results.csv`) — the number above is current,
> not carried over from an older run.*

### 2. Runtime comparison not fully convincing (134× from published runtimes) — unchanged
> We accept this criticism. The 134× figure has been removed from the abstract and conclusions,
> and the dPrPm runtime comparison is now explicitly labelled indicative and non-controlled
> (§5.1.2); as the dPrPm implementation is unavailable and its authors could not be reached, a
> controlled re-comparison against it is not possible. All quantitative performance claims in the
> revision rest instead on controlled, same-environment comparisons against an exact ROBDD
> (§5.2–5.4). We have also tightened the measurement protocol itself: every runtime reported was
> measured after a discarded warm-up run, so that program-initialisation cost is excluded, and
> this discipline is stated in the manuscript (§5 preamble). *See `JUDGMENT_CALLS.md` #2 for a
> recommended strengthening of this environment statement.*

### 3. Lack of comparison with established exact methods — unchanged
> A quantitative comparison against an exact method has been added. The revised §5.2 reports, for
> every corpus network, exact agreement with a sifted ROBDD together with cost measures on both
> sides (maximum conditioning-set size and realised sub-problem count for the proposed method;
> node count for the diagram). The finding is stated honestly: both methods are governed by the
> same structural width parameter, realised costs are of the same order, and neither dominates —
> the method's distinctive contribution is the native propagation of imprecise reliabilities (new
> §5.3), which decision-diagram methods do not provide. The comparison is extended to the applied
> drone networks in §5.4.3.

### 4. Theoretical complexity analysis requires clarification — unchanged, strengthen per lit review
> Section 4.3 has been rewritten. The revision gives an exact per-instance cost expression
> W = Σ_d 2^{|C_d|}·O(|E_d|) over the resolved diamonds, computable before enumeration because the
> conditioning sets are produced by the identification procedure itself; a new factorisation
> lemma (Lemma 3) showing when fan-in conditioning reduces from exponential to linear; and a
> formal positioning of the method as a specialisation of cutset conditioning, with its width
> parameter bounded by (and empirically tracking) the treewidth that governs junction-tree
> inference and well-ordered decision diagrams. Worst-case behaviour is discussed explicitly: the
> method is exponential in this width, as is every exact method, reflecting #P-hardness.
>
> *Wording caveat to add (from the campaign's own W-predictor finding): W above is a sound
> a-priori **upper bound**; realised work after memoisation is typically 1–5% of it. Say "upper
> bound," not "definite cost," in the final sentence of the formula's introduction.*

### 5. Drone case study lacks reliability insights — unchanged; see JUDGMENT_CALLS.md #1
> The case study has been rebuilt around reliability findings (revised §5.4). It now reports which
> facilities in each candidate design carry the most uncertainty about their delivery
> reachability: in the higher-redundancy designs the worst-served facilities have reachability
> probability bounded between 0.55 and 0.72 under the acknowledged input uncertainty, against
> near-certainty for well-connected ones, and a map-style figure locates where uncertainty
> concentrates. The redundancy/tractability trade-off is itself presented as a decision-relevant
> finding: provisioned redundancy improves resilience but raises the cost of verifying it exactly,
> and the practical boundary was measured on the real network. Runtime statistics now support,
> rather than substitute for, the engineering interpretation.
>
> **Recommended addition** (per `JUDGMENT_CALLS.md` #1): an explicit, early, one-paragraph
> disclosure that the three configurations are labelled proxies for the source study's described
> trade-off points (not reproductions of its unpublished optimisation output), stating exactly how
> each was built. This pre-empts rather than invites the "fits a story" reading.

### 6. Scalability limitations deserve deeper discussion — **CORRECTED, was citing a dropped number**
> **Base draft (DO NOT USE AS-IS)** cited: *"on the drone network, unrestricted connectivity
> produces conditioning requirements of 27–28... while bounding provisioned alternate routes per
> location to sixteen yields 15–17."* **The "27–28" figure was dropped by the 2026-08-17
> validation campaign**: that run never completed (diamond identification demanded ~25.5GB on a
> 16GB machine and was killed), so it was never an actual measurement — see
> `validation/probability/notes/CORPUS_CAMPAIGN_HANDBACK.md` §G. It is still present, uncorrected,
> in the current manuscript draft (`main.tex`, two occurrences) and must be fixed before
> resubmission (see `../manuscript/CORRECTIONS_APPLIED.md`).
>
> **Corrected response text:**
> The revised §5.5 discusses the practical range explicitly and anchors it to a measured,
> real-network example calibrated to the figure raised by the reviewers: on the drone network,
> connecting every operationally plausible pair of locations (unrestricted redundancy) makes exact
> diamond identification itself exceed the practical memory budget (identification alone demanded
> more memory than was available on a 16GB machine, and did not complete), while bounding
> provisioned alternate routes per location to sixteen brings the requirement to a measured
> conditioning-set size of 15–17 — just inside the practical range identified in the original
> submission — with full exact propagation completing in under 25 seconds. We are also explicit
> that imprecise propagation is not a scalability remedy (it uses the same conditioning depth),
> and that only network-design changes alter the cost. A depth-limited hybrid (exact conditioning
> to a chosen depth, rigorous bounding beyond it) is outlined as future work and clearly labelled
> as proposed, not implemented.

### 7. Algorithm reproducibility — unchanged
> The revision adds the formal machinery needed to reproduce the algorithm: the recursive
> reachability model and influence-set definitions (§2), full proofs of the conditional-invariance
> and supernode-equivalence lemmas plus new separator-sufficiency and factorisation lemmas (§4.1),
> an explicit statement of how stored sub-problems are identified by substructure and conditioning
> context (§4.2.1), and a worked multi-level nested example traced step by step (§4.2). The
> complete implementation and validation suite are openly available (Data and Software
> Availability — see `../zenodo_package/`).

### 8. Minor editorial issues — unchanged, still needs a final pass
> A language pass has been completed; the specific issues identified (duplicated punctuation,
> typographical errors, and overlong sentences in Sections 1, 4, and 5) have been corrected, and
> the sections rewritten in this revision were drafted to the same standard.
>
> *Status note: prior sessions flagged this needs "going over and over" before it can be called
> done with confidence — treat as not-yet-verified-complete; a dedicated proofreading pass of the
> full current `main.tex` is still owed before submission.*

================================================================================
## Reviewer #2

### 1. Parallels with Cutset Conditioning / Junction Tree — justify novelty — strengthen per lit review
> The revised §4.3 makes the relationship formal, and we state it candidly. The method is a
> specialisation of cutset conditioning to source-to-node reachability in DAGs: rather than a
> single global cutset, it identifies a local separating set at each reconvergence actually
> encountered (Lemma 2), conditions on it, and recurses, with memoisation of resolved sub-problems;
> a new factorisation lemma (Lemma 3) prevents joint conditioning over forks that are independent
> given the context, reducing fan-in cost from exponential to linear where independence permits.
> The realised cost is governed by the same width parameter as junction-tree inference and
> well-ordered decision diagrams, and we make no claim of asymptotic superiority. The theoretical
> contribution is the specialisation itself (definite per-instance cost, local conditioning,
> factorisation) together with the capability the specialisation enables: the propagation is
> arithmetic over {+, ×, complement}, and therefore extends natively to interval- and p-box-valued
> reliabilities (§5.3) — an exact-inference capability that junction-tree and decision-diagram
> engines do not provide. *See `JUDGMENT_CALLS.md` #3 for the recommended credal-network citation
> strengthening this specific point.*

### 2. Benchmark against state-of-the-art exact solvers on same grid/drone — unchanged; see JUDGMENT_CALLS.md #2
> Done. The grid benchmark is re-verified against a sifted ROBDD (agreement 1.1×10⁻¹⁶; §5.1.2), the
> full corpus comparison is reported in §5.2, and — addressing the "same drone networks" point
> directly — the comparison is extended to the applied case-study networks in §5.4.3: exact
> agreement on the configurations where the diagram completes, with the proposed method moderately
> faster for one-shot interval queries (approximately 14× and 6× on the sparse and low-redundancy
> configurations), and, at the higher-redundancy configuration, the diagram not completing within a
> practical budget under either of two ordering strategies while the proposed method completes in
> under 25 seconds. The claim is scoped precisely: a wider measured practical range on this
> network, not a structural superiority. *Recommend adding the shared-environment paragraph from
> `JUDGMENT_CALLS.md` #2 here explicitly, given this is the comment that first raised the fairness
> question.*

### 3. DAG transformation of the bidirectional multiplex network — unchanged
> The case study has been rebuilt, and its directionality is now grounded in the system rather
> than in a modelling convenience (revised §5.4.1). The source design study's connections are
> undirected (routes can be flown either way), but the reliability question is directional:
> whether supply reaches each facility from the hub tier. The dependency graph is therefore
> directed from hubs outward, matching the source study's own hub-and-spoke architecture; the
> previous level-ordering heuristic has been removed. We acknowledge explicitly (§5.5) that
> general cyclic and bidirectional dependency structures — feedback loops, return flows — are
> outside the present scope, and identify their principled treatment as future work; the revised
> limitation statement is written so that the validity of the source-to-facility reachability
> assessment does not rest on the suppressed cyclic behaviour.

### 4. Scalability limit; strategies for high-treewidth graphs including a hybrid — unchanged
> The revised §5.5 expands this discussion. It gives the measured practical boundary on a real
> network in terms of a controllable redundancy design parameter (see response 6 above / §5.4.3),
> and outlines the hybrid the reviewer describes: exact conditioning to a chosen depth, with
> reconvergent contributions beyond that depth combined without conditioning to give a rigorous
> bound — sound-but-wider intervals for interval inputs, and Fréchet-bounded combination for
> distributional inputs. We are transparent that this hybrid is proposed and analysed
> qualitatively, not implemented or evaluated in this revision; the method as reported never
> trades exactness for tractability, and we prefer to state the boundary honestly rather than
> claim an approximation capability we have not validated.

================================================================================
## Reviewer #3

### 1–7: unchanged from `REVIEWER_RESPONSES_draft.md` — no corrections needed (see that file / the
manuscript sections it maps to: §4.2 worked example, §4.2.1 supernode identity, §4.1 lemma
proofs, §5.2 exactness on overlapping topologies, §4.3 complexity, §5.4.1 drone transparency,
figure captions throughout).

### 8. Broader applicability (Bayesian networks) / limitations — strengthen per JUDGMENT_CALLS.md #3
> The relation to exact inference in probabilistic graphical models is now explicit (§1.1, §4.3):
> the method is a specialisation of cutset conditioning, in the same width-governed class as
> junction-tree inference, so the machinery transfers to source-to-node reachability queries on
> other directed acyclic probabilistic models. The capability that does not transfer back is
> imprecise propagation: standard exact engines (junction tree, decision diagrams) operate on
> point-valued parameters, whereas the proposed propagation extends natively to interval and p-box
> inputs (§5.3). Limitations are consolidated and stated explicitly in §5.5 (no structural
> advantage for exact point values; width-exponential practical range; p-box tightness
> structure-dependence and cost; DAG scope).
>
> **Recommended replacement** (adds a citable complexity-theoretic reason, not just an assertion)
> — see the full paragraph in `JUDGMENT_CALLS.md` #3, citing Mauá & Cozman (2020) and Fagiuoli &
> Zaffalon (1998): bounded treewidth does not rescue tractability for credal (imprecise-parameter)
> Bayesian-network inference in general, which is exactly why IPA's width-governed *exact*
> imprecise result on the reachability problem is a specific, non-trivial finding rather than an
> automatic consequence of bounded width.

================================================================================
## Open items not yet foldable into this tracker (pending, tracked in `../README.md`)
- Numbers pending this session's fresh re-runs: p-box steps-scaling curve, grid-specific p-box
  soundness table (both in progress as of this writing — check `../data/` for the task summaries).
- Original submitted manuscript + official decision letter: pending from the user.
- Final editorial/proofreading pass (item 8, first table) not yet done.
