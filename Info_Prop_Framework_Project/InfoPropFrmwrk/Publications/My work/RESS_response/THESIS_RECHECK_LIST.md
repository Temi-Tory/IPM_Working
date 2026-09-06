# Thesis recheck list — specific claims/numbers to verify against the actual chapters

Distinct from `THESIS_ADDITION_NOTES.md` (new findings to *add*): this is a list of specific
claims, numbers, citations, and phrasings from the RESS work that may already appear in the
thesis in a now-superseded form. **None of these have been checked against the actual thesis
chapter text yet** — that cross-check is explicitly deferred (per the author) to a dedicated pass
after the RESS rewrite and reviewer letter are done. This list exists so that pass doesn't have to
rediscover what to look for. Check main chapters (Diamond, Probability) *and* secondary ones
(Introduction, Conclusion, background/related-work sections) — several of these are exactly the
kind of claim that gets restated in an intro or conclusion without being updated everywhere.

## Soundness/framing claims — check for stale or overclaimed wording

1. **p-box conditioning soundness.** An old note (`grid_case_study/README.md`, dated 2026-07-26,
   predates the cvxP fix) states plainly: *"p-box: DO NOT CLAIM SOUND. The conditioning
   recombination is unsound... The suite still runs the p-box-vs-MC comparison as EVIDENCE of the
   unsoundness for the future-work section, not as a soundness claim."* This was TRUE at the time
   but is now **superseded** — the cvxP/cvxF operator (ported ~2026-07-27) fixed this, and this
   session independently reconfirmed soundness on the grid at both tested uncertainty widths
   (`worst_unsound=0.000e+00`). **Check**: does the thesis's Probability chapter (or anywhere else)
   still describe p-box conditioning as unsound, or cite the old evidence-not-claim framing? If so
   it needs updating to the current, correct status (sound, cvxP empirically validated across 50+
   configs, cvxF provably sound via Williamson & Downs 1990).
1b. **"The machinery transfers to any DAG probabilistic model" (PGM-applicability overclaim).**
    Caught and corrected in discussion with the author this session: source-to-node reachability
    is a specific monotone-Boolean-function computation, not the general arbitrary-CPT inference
    problem Bayesian networks solve. IPA specialises cutset conditioning's *strategy* with
    closed-form updates (noisy-OR, supernode caching) tailored to the monotone reachability
    structure — it is not a generalised PGM tool. Full corrected text:
    `THESIS_ADDITION_NOTES.md` item 6 / `pre-write final/reviewer_response/JUDGMENT_CALLS.md` §3.
    **Check**: any thesis passage (main or secondary chapters — intro/background/conclusion) that
    claims or implies IPA generalises to Bayesian-network/PGM inference broadly needs this same
    correction.
2. **"BDD cannot do interval at all."** The precise, literature-checked claim is narrower:
   interval-valued BDD reliability analysis already exists (Jacob, Dubois & Cardoso 2011; Imakhlaf,
   Hou & Sallak 2017) but doesn't scale well and produces ordering-dependent results. **Check**:
   any thesis passage claiming BDDs categorically cannot handle interval inputs needs this nuance.
3. **"Never call cvxP 'guaranteed' or 'proven'."** cvxP (the tighter, positive-dependence p-box
   operator) is empirically validated (now 50+ configs, zero violations) but not proven sound; only
   cvxF (the full Fréchet bound) is provably sound. **Check**: any thesis wording that blurs this
   distinction, especially in a results/conclusions section that might summarise "p-box bounds are
   guaranteed" without the cvxP/cvxF split.
4. **The "quadratic in discretisation level" p-box cost claim.** Confirmed stale within this
   project's own repo (appears in at least 3 files there); the corrected, cleanly-re-verified
   figure is a super-linear exponent of ≈2.6 (not quadratic), and the underlying mechanism is now
   understood precisely (see item 6 in `THESIS_ADDITION_NOTES.md`). **Check**: if the thesis states
   a specific p-box cost-scaling exponent or the word "quadratic" anywhere, it needs this fix.

## Citations — check the thesis bibliography for the same issues found in the RESS audit

5. **"Kozine, Krymsky & Gurov"** — this three-author combination does not appear to exist as a
   single paper. The closest verified match is Kozine & Krymsky (2017), two authors, a
   single-component (not network) scope. If the thesis cites "Kozine, Krymsky & Gurov," it's
   citing something that may not exist — check and correct to the real paper, or drop it.
6. Any other citation flagged in `pre-write final/literature/CITATION_STATUS.md` — worth a
   side-by-side check against the thesis's own reference list for the same errors/gaps (the RESS
   paper and thesis likely share several citations).

## Numbers and figures — check for staleness after this session's corrections

7. **Every number corrected in `pre-write final/manuscript/CORRECTIONS_APPLIED.md`** may also
   appear in the thesis (drafted around the same underlying validation work). Specifically worth
   checking: the "27-28" drone conditioning figure (dropped, never a real measurement); the grid
   runtime figure (2.378ms/4.94MB → 0.928ms/1.72MB, machine-specific); the drone
   vtol-dense-decentralized conditioning-width figure (17→16, a real post-fix change); interval
   one-shot timing ratios (2.9-95× → 3.9-99.9×); the grid/KarlNetwork diamond-count "cosmetic
   drift" (41→39, 147→145).
8. **`munin-dag`'s node count** — this session found and corrected an error in its own tracking
   docs: `munin-dag` is 1,041 nodes/1,398 edges, not the 724 (`link-bnlearn`'s count) that had been
   quoted as "the largest bnlearn network." If the thesis states a largest-network figure for this
   corpus anywhere, check which network it actually means.
9. **Any thesis figure generated from p-box timing data** should be checked against the corrected
   steps-scaling curve (1.5/8.7/51.0/339.0s at steps 25/50/100/200, clean one-process-per-
   measurement methodology) rather than the older, possibly-polluted numbers.

## Scope questions for the thesis pass, not yet decided

10. **Is a p-box-cost-mechanism discussion (§4.3-style, `PBOX_COST_MECHANISM_DRAFT.md`) worth its
    own expanded section in the thesis, or folded into the existing complexity discussion?** Not
    decided — flag for the thesis pass. Related: a natural **future-work angle** falls out of the
    now-understood mechanism (cost = realised-work-count × discretisation-dependent per-state
    price): since the per-state price is dominated by integrating over the conditioning weight's
    own discretisation plus a mixture-merge step, possible optimisations include (a) adaptive/
    non-uniform step allocation (fewer discretisation levels for diamonds deep in a nested
    structure where precision matters less), (b) a cheaper mixture-merge algorithm than PBA.jl's
    general-purpose one, (c) reusing weight-distribution integration results across diamonds that
    share the same conditioning fork. None of this is implemented or evaluated — pure future work,
    worth a sentence either in the RESS limitations section or the thesis.
11. **Adversarial data (fanin-k/mesh-w) and ISCAS85 — planned for RESS, but is either already in
    the thesis, or should either be added there too?** Not checked. Given the adversarial families
    are long-standing parts of this project's validation methodology (not new to this RESS
    session), they may well already be discussed in the thesis — verify rather than assume either
    way.
12. **Should ISCAS85 (specifically `c17`, the one fully-validated data point) become a genuine
    second propagation case study in the thesis, alongside or instead of the EPANET/Net3 real-
    infrastructure demonstration?** A balanced view, not a recommendation: `c17` is tiny (11
    nodes) — it doesn't carry the "meaningful scale" weight Net3 (97 nodes) does for demonstrating
    tractability at a non-trivial size, so it's unlikely to *replace* Net3 well. Its value is
    different: it's a genuinely different domain with all-three-value-type validation, including
    p-box, which Net3 currently lacks entirely (Net3 has Float64 only, this session). If the thesis
    wants one additional small, cross-domain, fully-validated demonstration point, `c17` fits; if
    it wants a second *substantial* case study, it's the wrong size — that role would need a larger
    ISCAS85 circuit, and per this session's findings, most of those (`c432` and up) are exactly the
    circuits that hit the identify-only wall, so there may not be a "medium-sized, fully-tractable"
    ISCAS85 option available at all.
13. **Is it a problem that the corroborating citation (El Fattah & Dechter) is from 1996?** No —
    and worth saying plainly wherever this gets discussed (RESS decision notes and/or thesis): this
    is a foundational, well-cited paper in the exact structural-inference literature establishing a
    *structural fact* about specific, still-standard benchmark circuits (their topology hasn't
    changed since 1985/1996). The RESS manuscript already cites comparably-aged foundational
    papers for the same kind of claim (Pearl 1988 for cutset conditioning, Lauritzen & Spiegelhalter
    1988 for junction trees) — age is not a weakness for this category of citation the way it might
    be for, say, a superseded performance benchmark or a since-revised standard.
