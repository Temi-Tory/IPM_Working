# Manuscript parity checklist (final consolidated version, 2026-09-06)

**Read this before anything else.** Everything below happened in a scratchpad sandbox copy of
`main.tex` (extracted from `validation/probability/newress.zip`) — **the sandbox is not the
rewrite source.** It exists to prove that proposed content compiles cleanly and that every number
in it is backed by a fresh artifact, not to be copied into the real submission verbatim. The real
rewrite happens in whatever document the author actually uses. **Treat every bullet below as a
parity check item**: confirm the real rewrite draft makes the same claim, in the author's own
words, and tick it off. "It's in `main_CORRECTED.tex`" is not the same thing as "it's in the
paper" — only the real document matters for submission.

The original `newress.zip` has never been touched (confirmed: untouched original compiles to 43pp
/ 978,773 bytes, byte-identical to the zip's own `main.pdf`). Sandbox copies (kept byte-identical
to each other) live at `manuscript/main_CORRECTED.tex` in this folder and at
`RESSdata/manuscript/main.tex`, purely for reference/compile-testing. Current sandbox state: 48pp,
compiles clean with zero warnings and zero undefined references (verified with two consecutive
`pdflatex` passes).

## A. Numeric/factual corrections (all backed by a named artifact — none from memory)

1. **Dropped the unmeasured "27–28" drone conditioning figure** (2 places: applied case study,
   limitations). It was never a real measurement — the run demanded ~25.5GB on a 16GB machine and
   never finished. Replaced with the honest statement: identification itself exceeded the memory
   budget on unrestricted connectivity.
2. **Filled in the dPrPm bound columns in the grid-accuracy table** (an author placeholder in the
   original draft) — read directly from Tong & Tien (2019) Table 2, page 7 of the source PDF, not
   retyped from memory. Added: the one nonzero dPrPm gap (node 16, 0.00048) coincides with the
   source study's own hardest-to-bound node; this method carries no gap there.
3. **Grid runtime**: 2.378ms/4.94MB → 0.928ms/1.72MB (a fresher, current-machine measurement) —
   flagged in the caption as machine-specific, not for cross-machine comparison.
4. **Interval-vs-BDD one-shot timing**: "2.9 to 95×" → "3.9 to 99.9×", every per-family cell in
   the table refreshed against the current dataset.
5. **Cosmetic diamond-count drift fixed**: grid 41→39, KarlNetwork 147→145.
6. **Drone vtol-dense-decentralized conditioning width**: 17→16 (a real, confirmed post-fix
   change, not noise) — both downstream prose mentions ("15–17") updated to "16" since both dense
   configurations now measure identically.
7. **§4.3 cost-formula wording**: now states the exact-cost formula is a sound *a-priori upper
   bound*, not the realised cost — realised work (after memoisation) is measured at 1–5% of the
   bound in practice.
8. **§5 preamble**: added the shared BDD/method measurement-environment statement (same process,
   same machine, dynamic reordering unless stated) and the degeneracy-preserving synthetic-
   widening methods sentence (structurally-certain components, exactly 0 or 1, are never widened
   into synthetic uncertainty).
9. **Data and Software Availability**: split into a code statement (package, Julia General
   registry + GitHub, version pinned) and a data statement (new paper-scoped Zenodo deposit, DOI
   placeholder pending minting, MIT licence).
10. **p-box steps-scaling curve, final clean numbers**: 1.5424s / 8.6771s / 51.0163s / 339.0249s
    at steps 25/50/100/200, empirical exponent ≈2.6 (climbing across the range: 2.49→2.56→2.73
    between successive points). This number went through a real retraction-and-redo mid-session —
    the first re-measurement attempt shared one Julia process across multiple large propagations
    (a documented anti-pattern in this project, known to inflate later/bigger measurements) and
    was pulled back out before it could ship; the number above is from a properly redesigned
    measurement (one clean propagation per fresh process, JIT-warmed on a throwaway network) and
    is the one actually in the sandbox now. Do not use any other steps-scaling number found
    elsewhere in this project's notes — this is the current, trustworthy one.
11. **§5.2 "several real infrastructure networks" — now named explicitly**: `mlgw-gas-network`,
    `metro_directed_dag_for_ipm`, and Net3, plus a new breadth claim (17 published Bayesian-
    network benchmark topologies, 8–1,041 nodes, explicitly framed as topology/scale breadth, not
    decision-relevant reliability values — do not let this read as if it applies to the p-box
    claim too, it only backs Float64/Interval exactness breadth).
12. **NNL → UKNNL** in the acknowledgements, per the thesis's own current wording.

## B. New content, drafted and verified compiling — genuinely new prose, read it, don't rubber-stamp

13. **New subsection: "Adversarial and Worst-Case Structural Complexity"** (placed after the
    applied case study, before Limitations — a placement choice, not a requirement). Parity
    checklist for what it must say:
    - [ ] Frames the section as probing both ends of the exact-vs-BDD comparison: a family where
      the method's own independent-diamond factorisation applies maximally, one where it can't
      apply at all, and a real published benchmark under the same worst-case convention, as a
      check the first two aren't hand-picked artefacts.
    - [ ] **fan-in-k**: k independent fork gadgets → exactly `2k+1` sub-problems for every tested
      k (2 through 16), exact on every instance; ROBDD grows as `16.0·k^1.49`; wall-clock: method
      under 1ms throughout vs. ~1–2s to build the diagram (~1000× faster).
    - [ ] **mesh-w** (fixed length L=8): **lead with wall-clock time, not raw op-counts** — at
      w=8 the diagram's advantage looks like ~1486× in ops but is actually 55× in seconds (a
      diagram node and a resolved sub-problem are not equivalent units of work). Crossover: method
      faster through w=4 (0.37s vs 1.19s), diagram faster from w=5 (3.9s vs 1.2s). New finding:
      between w=8 and w=9, sub-problems grow only 1.39× but wall-clock time grows 37× (159.5s →
      5,924.7s) — a *memory* boundary (sub-problem cache exceeding RAM), not a growing-op-count
      one; the diagram stays untroubled at w=9 (3,335 nodes, under 4s). State as a practical-
      boundary data point, not a further point on a smooth curve.
    - [ ] Table needed: fan-in k=8,16; mesh w=4,5,8,9 — ops, ROBDD nodes, time (both methods),
      regime label per row (exact figures in the sandbox's `tab:adversarial`).
    - [ ] **ISCAS85** (new domain, real published digital-circuit benchmarks, DAG-native):
      assigned the same illustrative non-degenerate reliability (0.9, uniform) already used
      elsewhere in the corpus — itself a deliberate worst case, since the implementation only
      excludes a node from conditioning when its reliability is exactly 0 or 1, so non-degenerate
      values everywhere mean nothing gets pruned. `c17` (11 gates): trivial, fully validated across
      all three input types, p-box cost matched the predicted band (1.3–2.3s predicted, 1.41s
      measured). `c432`/`c499`/`c880` (196/243/443 gates): conditioning widths 67/41/50 — an order
      of magnitude beyond anything else in this corpus, propagation not attempted.
      `c1355`/`c1908` (587/913 gates): exceed 16GB memory during identification itself.
    - [ ] **Citable corroboration, not just a data point**: El Fattah & Dechter (1996) — same
      circuits, classical tree-clustering/cutset-conditioning, comparably extreme parameters on
      `c432` ("clearly not feasible"). Since diagram size shares the same structural-width driver,
      a BDD would be expected to hit the same wall, not resolve it. Frame as an independently
      corroborated boundary in a fourth domain, not a method-specific weakness.
    - [ ] Closing line: one symmetric characterisation — every exact method pays a structural cost
      somewhere; method wins ~1000× on independent structure, diagram wins up to ~55× on
      correlated structure, both (and, independently, decades-old classical methods) hit the same
      wall on a real published family under an adversarial convention.
    - [ ] Two new bibliography entries: El Fattah & Dechter (1996), UAI-96, pp. 244–251; Brglez &
      Fujiwara (1985), IEEE ISCAS, pp. 695–698 (both venues verified via web search, not guessed).
    - [ ] **Do not attribute the "non-degenerate priors are a worst case" mechanism to any other
      section of the paper** — checked directly, no other section currently explains this
      degeneracy-exclusion behaviour, so the adversarial section must state it self-contained (an
      earlier sandbox draft wrongly cross-referenced a section that doesn't cover it — caught and
      fixed before this list was finalised; don't reintroduce that cross-reference).

14. **New figure: `measured_ops` vs. p-box propagation time** (log-log scatter, 14 networks,
    steps=50 fixed). Self-contained, paste-ready fragment: `manuscript/paper_pbox_cost_figure.tex`
    (also in `RESSdata/manuscript/`) — needs `\usepackage{tikz}` + `\usepackage{pgfplots}` +
    `\pgfplotsset{compat=1.18}` wherever it's used (the sandbox didn't have these loaded until this
    figure needed them). **Visually verified rendering correctly**, not just "compiled without
    error" — a clean near-linear trend across two orders of magnitude in `measured_ops`, tracking
    a reference line at ≈0.19 s/op. Caption point: this shows p-box cost tracks the same realised-
    work quantity (`measured_ops`) already used for the Float64/Interval cost story, not the raw
    conditioning-set-width bound — pairs with `PBOX_COST_MECHANISM_DRAFT.md`'s proposed §4.4
    paragraph (same section, same point, prose + figure together).

## C. Explicitly discussed and settled (not yet written into the sandbox — pure text to insert)

15. **Drone case-study disclosure** (`JUDGMENT_CALLS.md` §1) — discussed, no change needed beyond
    what's already in the draft: the three-config structure already makes "these are proxies for
    described design points, not the source study's own undisclosed optimisation result" legible;
    the underlying input data (locations, ranges, priors) is genuinely real throughout.
16. **BDD-comparison fairness** (`JUDGMENT_CALLS.md` §2) — the shared-environment methods
    paragraph is already applied (item A.8 above). A previously-recommended "we caught our own
    near-miss" narrative sentence was withdrawn on the author's correct pushback (not standard
    journal-article practice) — do not add it.
17. **PGM-applicability claim, R3 comment 8** (`JUDGMENT_CALLS.md` §3) — corrected in discussion,
    a genuine sharpening, not just wording: the method is a specialised reachability method that
    borrows cutset conditioning's *strategy* (general PGM inference already uses cutset
    conditioning itself, per Pearl 1988); the method's specific closed-form updates (noisy-OR
    combination, supernode caching) are derived for the monotone reachability structure and would
    need re-deriving, not reusing, for arbitrary CPTs in a general Bayesian network. The imprecise-
    propagation capability is a further, separate specialisation on top of that — not something a
    standard PGM engine gets "for free" from sharing the same conditioning strategy. Full corrected
    paragraph text: `reviewer_response/JUDGMENT_CALLS.md` §3 (already rewritten there, ready to
    insert as-is or adapted). Needs two new bibliography entries: Fagiuoli & Zaffalon (1998),
    Mauá & Cozman (2020).

## D. Deliberately not done — genuine open decisions, not oversights

- **Editorial/proofreading pass** over the full manuscript — flagged by prior sessions as still
  owed ("go over and over and over"), not attempted here. Deliberately deferred to the rewrite
  session.
- **`PBOX_COST_MECHANISM_DRAFT.md`'s §4.4 paragraph** — the mechanism explanation and the figure
  above (item 14) are both ready; the actual insertion into a real draft is deferred to the
  rewrite, per the author's decision to hold this rather than insert now.
- **Minting the Zenodo deposit** — `RESSdata/` is built and scoped; minting itself is the author's
  action, after the rewrite is otherwise done.

## Verification discipline followed throughout
Every numeric claim above is cited to a specific artifact file, per this project's own
"fresh-or-it-didn't-happen" rule — none are hand-typed from memory. The sandbox was recompiled
after every batch of changes with zero tolerance for `pdflatex` errors, and cross-references were
spot-checked against what the referenced section actually says (not just whether the label
resolves) — this caught and fixed two real problems in this session alone: a same-process timing-
measurement bug (item A.10) and a false cross-reference in the adversarial section (item B.13's
last bullet) that would have attributed a claim to a section that doesn't support it.
