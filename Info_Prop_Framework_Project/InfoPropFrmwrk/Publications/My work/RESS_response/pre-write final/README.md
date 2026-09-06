# RESS revision — pre-write final package (final consolidated version, 2026-09-06)

**Read this first.** The manuscript copy this pass worked with (`manuscript/main_CORRECTED.tex`,
mirrored to `RESSdata/manuscript/main.tex`) is a **sandbox, not the rewrite source**. It exists to
prove new content compiles cleanly and every number is backed by a fresh artifact — not to be
copied into the real submission. The actual rewrite happens in whatever document the author uses.
`manuscript/CORRECTIONS_APPLIED.md` is written as a bulleted **parity checklist** for exactly this
reason: read each item, confirm the real draft says the same thing, tick it off. Nothing here
should need re-deriving when the rewrite actually happens.

**Bottom line**: a complete, compiling manuscript already existed before this pass (44pp, drafted
in a prior session, answering every reviewer comment). This pass audited it end to end, fixed
every stale number found, closed out the literature gaps, added a substantial new section
(adversarial/worst-case complexity, including a striking new result), built a new figure, and
packaged a paper-scoped reproduction repository. Current sandbox state: **48pp, compiles clean,
zero warnings, zero undefined references.**

## Folder map
- `manuscript/` — `main_CORRECTED.tex`/`.pdf` (sandbox only), `CORRECTIONS_APPLIED.md` (the real
  parity checklist — start here), `PBOX_COST_MECHANISM_DRAFT.md` (a mechanism explanation +
  proposed §4.4 paragraph, drafted but deliberately held for the rewrite session),
  `paper_pbox_cost_figure.tex` (a new, verified-rendering figure, ready to insert).
- `data/` — every fresh artifact generated this session (Net3, the p-box steps-scaling curve, the
  grid p-box re-confirmation, the corpus-expansion work for mlgw/metro/ISCAS85), each with a
  written summary of exactly what was run and how.
- `literature/CITATION_STATUS.md` — full citation audit.
- `reviewer_response/` — `POINT_BY_POINT_TRACKER.md` (all 3 reviewers, corrected), `JUDGMENT_CALLS.md`
  (three framings, all discussed and settled this session), `COVER_LETTER_DRAFT.md`.
- `NEXT_STEPS_CHECKLIST.md` — the 4-deliverable-level status and suggested order of work.
- `THESIS_ADDITION_NOTES.md` / `THESIS_RECHECK_LIST.md` — explicitly deferred thesis-side work,
  parked at the author's request; not part of this RESS pass's scope.

`C:\Development\RESSdata\` (separate from this folder) is a fully built, paper-scoped reproduction
package — networks, scripts, final data, the manuscript sandbox copy — ready for the author to
`git init`/push/mint themselves (no Claude git authorship).

## What this pass confirmed, unchanged from prior work
- The Julia package (`InformationPropagationAnalysis.jl`) is registered in the Julia General
  registry (currently v0.2.1), local repo clean and pushed, a faithful five-toolkit port of
  `InfoPropFrmwrk/src/Algorithms`.
- All 3 reviewers' comments extracted in full from `Reviewer_Comments_Response_Tracker.docx`, and
  the original submission itself confirmed already in hand (`OriginalPaper/`'s docx) — both
  confirmed by the author to be the real, unparaphrased documents, not summaries.
- The core validation claims (129/129 exactness, interval exactness, grid/power/Karl agreement,
  drone K-sweep, ASCE grid/power reproduction) — independently re-confirmed as of 2026-08-30 in
  `validation/probability/`, the freshest layer of three generations of validation work.

## What changed in the manuscript this session
See `manuscript/CORRECTIONS_APPLIED.md` for the full, bulleted, artifact-cited list. Headline
items: dropped an unmeasured "27–28" drone figure; filled in a standing dPrPm-table placeholder
from the actual source PDF; refreshed several stale timing/count numbers; named the real-
infrastructure networks explicitly and added a bnlearn breadth claim; corrected the p-box
steps-scaling curve through a genuine retraction-and-redo (see below); and added a full new
subsection on adversarial/worst-case structural complexity.

## The retraction-and-redo (worth understanding, not just the final number)
A first attempt at re-measuring the p-box steps-scaling curve shared one Julia process across
multiple large propagations — a documented anti-pattern in this project (known to inflate later,
bigger measurements). This was caught mid-session (via a suspicious warm-up-vs-timed-call pattern
in a follow-up experiment), the flawed number was pulled back out of the manuscript, both timing
scripts were rewritten to do one clean measurement per fresh process, and the real numbers were
re-derived: **1.5424s / 8.6771s / 51.0163s / 339.0249s at steps 25/50/100/200, exponent ≈2.6**
(climbing across the range, not a single flat exponent). The clean re-run also produced a genuine
bonus finding: p-box cost tracks `measured_ops` (the same realised-work quantity already governing
the Float64/Interval cost story), not the raw conditioning-set-width bound — see
`manuscript/PBOX_COST_MECHANISM_DRAFT.md` and the new figure (`paper_pbox_cost_figure.tex`).

## The adversarial section and its headline result
A new subsection was drafted covering the fanin-k/mesh-w synthetic worst-case families (corrected
to lead with wall-clock time, not raw op-counts, per this project's own finding that op-counts
overstate the real gap) plus a genuinely new result: **ISCAS85**, a real, published digital-circuit
benchmark suite, tested under the same worst-case reliability convention used throughout the
corpus. Result: the hardest boundary found anywhere in this session — a 196-node circuit alone
reaches a conditioning width of 67, and two larger circuits (587/913 nodes) crash diamond
*identification itself* via memory exhaustion, worse than the previously-hardest case
(diabetes-bnlearn). This is independently corroborated in the literature: El Fattah & Dechter
(1996) studied the same circuits with classical exact structural-inference methods and reported
comparably extreme parameters — meaning this is a genuine, citable boundary of exact structural
inference generally, not a weakness specific to this method. Full parity checklist for this
section: `manuscript/CORRECTIONS_APPLIED.md` item 13.

## Reproduction package (`RESSdata/`)
Built from a converged principle (after real discussion, not a unilateral rule): include every
network topology with real validated data supporting a claim, exclude only for a substantive
reason (no data exists, invalidated inputs, a different algorithm's validation, a redundant
duplicate) — never an arbitrary "real vs. synthetic" line. Final count: 40 network folders (grid,
power, Karl, counterexample, the drone case study, mlgw/metro/Net3, all 17 bnlearn networks, and
6 ISCAS85 circuits), 141MB, no git initialized. Two open manuscript-text recommendations surfaced
by this scoping work: name the real-infrastructure networks explicitly (done — see corrections
list) and add the bnlearn breadth claim (done).

## Literature — final status (`literature/CITATION_STATUS.md`)
All citations already in the manuscript are confirmed correct. A previously-verified batch
(credal networks / Mauá & Cozman, Fagiuoli & Zaffalon, Feng et al., Behrensdorf et al., Jacob/
Dubois/Cardoso) was never integrated into the manuscript — recommended for the corrected R3.8
paragraph (`JUDGMENT_CALLS.md` §3) and the related-work section. Two previously-open citations
resolved this session: Jacob et al. (2011)'s venue confirmed (SUM 2011); "Kozine, Krymsky & Gurov"
does not appear to exist as a single paper (found and read Kozine & Krymsky 2017 instead — flag
for the author's own judgment on whether to use it). Two new citations added for the adversarial
section: El Fattah & Dechter (1996), Brglez & Fujiwara (1985) — both venues verified via web
search, not guessed.

## The three judgment calls — all discussed and settled this session
1. **Drone case-study disclosure** — no change needed; the three-config structure already makes
   the "these are proxies, built from real data" point legible.
2. **BDD-comparison fairness** — the methods-discipline paragraph stands (already applied); a
   previously-recommended "we caught our own near-miss" narrative was withdrawn on the author's
   correct pushback (not standard journal-article practice).
3. **PGM-applicability claim (R3.8)** — corrected in discussion into a materially sharper claim:
   the method specialises cutset conditioning's *strategy* for the monotone reachability problem;
   it is not a generalised PGM tool, and its imprecise-propagation capability is a further
   specialisation on top of that, not something a standard PGM engine gets for free. Full text:
   `reviewer_response/JUDGMENT_CALLS.md` §3.

## Genuinely open — nothing below was decided unilaterally
1. **Where the adversarial section goes and its exact final wording** — drafted in the sandbox
   with a specific placement (after the drone case study), but that's a choice, not a requirement.
2. **`RESSdata/`'s network include list** — converged on a clear principle in discussion; worth a
   final skim of `RESSdata/MANIFEST_DECISIONS.md` before minting, but no more back-and-forth
   expected.
3. **Minting the Zenodo DOI** — deliberately not done; one-way and outward-facing; on the author,
   after the rewrite.
4. **Whether/how to insert the p-box cost mechanism paragraph + figure** — both ready
   (`PBOX_COST_MECHANISM_DRAFT.md`, `paper_pbox_cost_figure.tex`), insertion deliberately deferred
   to the rewrite session per the author's decision.
5. **Editorial/proofreading pass** — flagged by prior sessions as still owed, not attempted here,
   deliberately deferred to the rewrite session.

## What you should not need to re-derive
Every number in `manuscript/CORRECTIONS_APPLIED.md`, every claim in
`reviewer_response/POINT_BY_POINT_TRACKER.md`, and every network-inclusion decision in
`RESSdata/MANIFEST_DECISIONS.md` is cited to a specific artifact file. Check that file; don't
re-run the validation unless you specifically want a fresh reconfirmation.
