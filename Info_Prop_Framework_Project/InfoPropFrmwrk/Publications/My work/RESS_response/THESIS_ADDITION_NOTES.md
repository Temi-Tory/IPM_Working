# Thesis addition notes — running log (started 2026-09-06)

**Purpose, per the author's instruction**: a running, non-exhaustive collection of session
findings worth folding into the thesis (primarily the Probability chapter) as a later, separate
pass — explicitly scheduled as the **final step after the RESS rewrite and reviewer-response
letter are both done**, not during this RESS pre-write pass. Nothing in this file should be acted
on now. This file (and the rest of the `RESS_response/` folder) will be drawn on for the thesis
additions/updates later in the week per the author.

**Open item**: the author has a personal notes file ("Untitled-1" in their editor) they intend to
fold in here — its content was never pasted into this session, so it is not reflected below.
Paste it in (or point to wherever it's saved) when picking this file back up.

---

## Findings from this session worth considering for the Probability chapter

### 1. p-box conditioning cost mechanism — a real, source-derived complexity result
Traced directly from `DiamondPropagation.jl`'s `_combine` recursion and
`InputProcessingModule.jl`'s `pbox_conditional_combine`: p-box cost at a diamond is governed by
the *same* `2^{|C_d|}` state enumeration that governs the Float64/Interval case (same recursive
call structure, same diamond cache), multiplied by a per-state price that is `O(1)` for
Float64/Interval but grows with the p-box discretisation level (a convolution of the class
formalised by Williamson & Downs 1990, integrated over the conditioning weight's own
discretisation). Empirically confirmed this session across 14 networks: propagation time at fixed
steps tracks `measured_ops` (realised, memoisation-adjusted work), not the raw `sum_2^C` bound,
to within a ~2x band across an 89x range. Full derivation + data:
`RESS_response/pre-write final/manuscript/PBOX_COST_MECHANISM_DRAFT.md`. This is a genuine
theoretical unification (one governing quantity, three different per-state prices across value
types) that likely belongs in the Probability chapter's own complexity discussion, not just the
RESS paper — check whether the chapter's existing complexity section already has this or would
benefit from it.

### 2. Measurement methodology hazard — worth a methods-section note in the thesis too
A real, twice-independently-rediscovered failure mode in this project: running multiple heavy
propagation calls in one Julia process inflates later/bigger measurements (confirmed via a direct
comparison this session — see `RESS_response/pre-write final/manuscript/CORRECTIONS_APPLIED.md`
item 10). The fix (one timed measurement per fresh process, JIT-warmed on a trivial throwaway
network, never the real target) is now the standard in this project's newer scripts
(`task2_pbox_steps_v2_one.jl`, `pbox_cost_vs_diamonds_v2_one.jl`, `corpus_expansion_partA_one.jl`).
If the thesis reports any timing numbers, worth checking they don't share this vulnerability.

### 3. A genuinely hard real-world boundary case: ISCAS85 combinational circuits
Real, published, DAG-native digital-circuit benchmarks (`pld.ttu.ee/~maksim/benchmarks/iscas85/`)
tested this session under a deliberate worst-case (non-degenerate uniform 0.9) prior convention —
`c432` (196 nodes) alone reaches a conditioning width of 67 (`sum_2^C≈1.17e21`); `c1355`/`c1908`
(587/913 nodes) crash diamond *identification itself* via memory exhaustion on a 16GB machine —
the hardest boundary case found in this entire corpus, harder than `diabetes-bnlearn`. Independently
corroborated in the literature: El Fattah & Dechter (1996), "An evaluation of structural
parameters for probabilistic reasoning: results on benchmark circuits," studies the same 11
ISCAS85 circuits via tree-clustering/cutset-conditioning and reports comparably extreme structural
parameters (cutset sizes up to 17-23+, described as "clearly not feasible" for `c432`; exponential
in 89 for `c3540`). This is a strong, citable addition to the Diamond/Probability chapters'
discussion of practical tractability limits — a real domain (not a synthetic construction) where
the method's boundary is reached at a much smaller absolute network size than anything else
tested, and where the wider exact-inference literature already agrees it's hard. Full data:
`RESS_response/pre-write final/data/corpus_expansion/`.

### 4. Corpus characteristics/coverage picture, corrected
`RESS_response/pre-write final/data/CORPUS_CHARACTERISTICS_AND_COVERAGE.md` — a consolidated view
of network size/diamond-structure spread and per-value-type (Float64/Interval/p-box) coverage
across the whole validated corpus (now including bnlearn, ISCAS85, and freshly-reconfirmed
mlgw/metro). Corrects a real error caught mid-session: `munin-dag` (1,041 nodes/1,398 edges) is
the largest network in the corpus with a clean propagated result, not `link-bnlearn`'s 724 as
first stated. Worth checking whether the thesis's own corpus description anywhere cites node-count
ranges that should be updated to match.

### 5. Literature found this session, not yet checked against the thesis's own bibliography
- Fagiuoli & Zaffalon (1998), Mauá & Cozman (2020) — credal-network complexity results (bounded
  treewidth does not rescue tractability for imprecise/credal Bayesian-network inference the way
  it does for precise inference) — directly relevant if the thesis discusses the method's relation
  to probabilistic graphical models anywhere.
- Jacob, Dubois & Cardoso (2011, SUM 2011) and Imakhlaf, Hou & Sallak (2017) — BDD-based interval
  reliability analysis already exists in the literature; useful if the thesis's own related-work
  section claims BDDs "cannot" propagate imprecise inputs without this nuance.
- El Fattah & Dechter (1996) — see item 3 above.
- Full audit: `RESS_response/pre-write final/literature/CITATION_STATUS.md`.

---

### 6. Corrected framing: IPA's relation to PGM/Bayesian-network inference
A recommendation drafted earlier this session ("the machinery transfers to source-to-node
reachability queries on any directed acyclic probabilistic model") overstated IPA's generality —
caught and corrected in discussion with the author. Source-to-node reachability is a *specific*,
narrower computation (a monotone Boolean function, an OR of ANDs of Bernoulli path indicators),
not the general arbitrary-CPT inference problem Bayesian networks solve. The corrected framing:
cutset conditioning *itself* (the general method, Pearl 1988) already applies to general PGM
inference — IPA's specific contribution is a set of closed-form update rules (noisy-OR
combination, supernode caching) derived for the monotone reachability structure specifically,
which would need re-deriving, not reusing, for arbitrary CPTs. **IPA is a specialised reachability
method that borrows PGM's strategy, not a generalised PGM tool** — and its imprecise-propagation
capability is a further, separate specialisation on top of that, not something a standard PGM
engine gets automatically from sharing the same conditioning strategy. Full corrected text:
`RESS_response/pre-write final/reviewer_response/JUDGMENT_CALLS.md` §3. **Check the thesis for
the same overstatement** wherever it discusses IPA's relation to Bayesian-network inference or
probabilistic graphical models generally (Diamond/Probability chapters, and any
introduction/background section that makes a broader-applicability claim) — this correction
should propagate there too, not just into the RESS paper.

## Not yet done (flagged, not forgotten)
- The actual cross-check against the Probability chapter's existing text (what it already says,
  what would need updating) — explicitly deferred this session, to be picked up as its own pass.
- Cross-check against `C:\Development\thesis-data` for consistency with what's already published
  there (structure, whether any of this session's fresh numbers supersede anything in that repo).
- Merging the author's own "Untitled-1" notes once supplied.
