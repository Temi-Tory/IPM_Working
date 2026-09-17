# RESS numeric/content parity audit — handover (session ending 2026-09-17)

**Read this first, in this order**: this file, then `EDITORIAL_REVIEW_HANDOVER.md` (same folder, prior
session, sentence-level review — separate concern, still valid). Everything below was checked this
session by reading a source file in full or tracing a number to a persisted CSV/log — not by inference
or by trusting a prior summary. Four parallel full-read agents covered `pre-write final/`, `validation/`
+ thesis chapters, a full numeric extraction of the live manuscript, and the algorithm code + RESSdata/
thesis-data; this document is the synthesis, plus direct follow-up tracing done afterward in-session.

Scope note: the author explicitly ruled **power-network extension and Net3-table-inclusion out of
scope** this session — both are real gaps (see below) but deliberately not being pursued now.

## Priority 1 — RESOLVED 2026-09-17

Fresh CUDD-based rerun of `grid_full_suite.jl`'s accuracy section (OneDrive path fixed, DataStructures
Queue API reverted, `GRID_SKIP_COST=1`) completed cleanly: `worst_unsound=0.000e+00` at both w=0.05 and
w=0.10, confirming the cvxP/cvxF soundness fix under full CUDD provenance (the Sept-6 Task-3 rerun had
used a BDDjl substitute for its interval half; this rerun used CUDD throughout, no caveat needed). The
`naive_vs_MC` rows (2.138e-02 / 1.724e-02) matched the stale CSV and Task-3's numbers bit-for-bit,
confirming reproducibility. Propagated the clean 9-row result (deduplicated — the script produces a
duplicate-row artifact in some runs, not this one) to all three canonical `grid_accuracy.csv` locations
(in-repo `RESS_response/grid_case_study/`, `RESSdata`, `thesis-data`) and rewrote the "DO NOT CLAIM
SOUND" language in all three READMEs to document the fix with dates and provenance, not just delete it.
**One data-quality note found while propagating**: `RESSdata`'s copy was NOT actually stale at the point
of propagation (mtime 2026-09-06, already holding Task-3's corrected-but-BDDjl numbers) — contradicting
an earlier agent's report that all three canonical copies were uniformly stale as of 2026-08-29. Always
re-check current file state directly before trusting a prior session's or agent's characterisation of it.
`grid_cost.csv` (timing) remains empty in all three — deliberately out of scope for this rerun (see
Priority 4 below, the grid Float64/Interval cost remeasurement).

## Priority 1 (original write-up, kept for context)

Three "canonical" copies of `grid_accuracy.csv` — in-repo `RESS_response/grid_case_study/data/`,
`C:\Development\RESSdata\data\grid_case_study\data\`, and
`C:\Development\thesis-data\validation\probability\grid_case_study\data\` (all byte-identical, dated
**2026-08-29**) — report the grid network's p-box-vs-Monte-Carlo comparison as **unsound**:
```
pbox@200,0.05,IPA_vs_MC,-,3.436e-01,CHECK
pbox@200,0.10,IPA_vs_MC,-,3.900e-01,CHECK
```
and the accompanying `grid_case_study/README.md` says outright: *"the conditioning recombination is
unsound... DO NOT CLAIM SOUND... runs the p-box-vs-MC comparison as EVIDENCE of the unsoundness for the
future-work section."*

A later rerun exists only inside `RESS_response/pre-write final/data/task3_grid_pbox/grid_accuracy.csv`
(dated **2026-09-06**), after a cvxP/cvxF conditioning-operator fix, showing the same comparison as fully
sound:
```
pbox@200,0.05,IPA_vs_MC,-,0.000e+00,sound
pbox@200,0.10,IPA_vs_MC,-,0.000e+00,sound
```
**This corrected file was never propagated back into RESSdata or thesis-data.** The current manuscript
(`RESS_REVISED/original_submission/elsarticle-template-num.tex`, §5.3.2) claims soundness throughout
("zero soundness violations across the sweep"), matching the *corrected* numbers — not what the archival
data repos actually contain right now.

**Author's own account (confirmed 2026-09-17, overrides the "judgment call" framing below — keep for
record)**: the Sept-6 rerun was not a random pre-write artifact — the author ran it personally,
specifically because `pre-write final/` was created on 2026-09-06 in order to get ALL fresh numbers
before the rewrite. This resolves the trust question: the Sept-6 fix is the author's own verified fresh
run, not a stale/unreviewed one. **Action needed**: still propagate it — overwrite the stale
`grid_case_study` copies in RESSdata/thesis-data and rewrite/remove the "DO NOT CLAIM SOUND" README in
both — but the open question is no longer "is it trustworthy," it's "redo the *interval* half with CUDD
so the whole thing is uniformly sourced" (see Priority 2) and "get the missing timing" (next paragraph).

**Exact script/design behind this, traced 2026-09-17** (canonical script:
`validation/probability/grid_case_study/grid_full_suite.jl`, also copied to
`RESSdata/data/grid_case_study/` and `RESS_response/grid_case_study/`): it is **one hands-off script**
that in a single run does ACCURACY (Float64 vs sifted CUDD BDD; Interval vs BDD corners + a naive
baseline; p-box vs Monte Carlo + a naive baseline) **then** COST (`@benchmark` timing for Float64 /
Interval / p-box at steps∈{50,200,500}) then PROFILING. Config: grid network (16 nodes/24 edges,
sources {1,3,13}), node priors exact 1.0, link probability 0.9, uncertainty half-widths **w∈{0.05,0.10}**
on links only, p-box accuracy discretisation **steps=200**, target node **16**, Monte Carlo **N=50,000**,
seed **42** (`MersenneTwister(42)`). **Task 3 (the Sept-6 fix) only reran the ACCURACY section — its own
summary says outright "Cost/profiling/complexity sections... were NOT re-run (out of scope)."** So
`grid_cost.csv` being 0 bytes in all three canonical copies isn't a separate mystery — the COST section
of this exact script has simply never been completed by anyone, on this network, ever. If a grid
interval/p-box *timing* number is wanted for the paper, this is the section that needs running.

**Blocker — fix before any rerun**: `grid_full_suite.jl` line 13 currently has
`const REPO = raw"c:\Users\ohian\OneDrive - University of Strathclyde\...\Info_Prop_Framework_Project"`
— the exact forbidden OneDrive path from the incident logged in `EDITORIAL_REVIEW_HANDOVER.md`. Task 3's
own summary noted it "fixed" this when adapting a copy for that session, but the script **on disk in the
repo still has the OneDrive path**. Must be repointed to the git-tracked repo before any execution, or
it will write into OneDrive again.

## Priority 1b — root environment was broken 2026-08-30 to 2026-09-17 (now fixed)

While attempting the Priority-1 grid rerun (2026-09-17), discovered the root `Pkg.activate(REPO)`
environment (the one with CUDD in it — used by `grid_full_suite.jl`, `complexity_validate.jl`,
`adversarial_scaling.jl`, `interval_bdd_vs_ipa_timing.jl`, i.e. every canonical CUDD-based script) could
not run `make_problem`/`identify_fork_and_join_nodes` at all: `find_iteration_sets` in
`InfoPropFrmwrk/src/Algorithms/Shared/InputProcessingModule.jl` threw
`MethodError: no method matching push!(::DataStructures.Queue{Int64}, ::Int64)`.

**Root cause, confirmed via `git log`/`git show`**: commit `d23db08` ("cx", 2026-08-30) changed
`find_iteration_sets`'s FIFO queue calls from `enqueue!`/`dequeue!` to `push!`/`popfirst!` — cosmetically
"modernising" to DataStructures.jl's newer Queue API (≥0.19), which fully replaced (not added to) the old
API. The root `Manifest.toml` was never bumped to match and still pinned **DataStructures.jl v0.18.22**
(confirmed against the actual installed package source in `~/.julia/packages/DataStructures/`, 5 versions
present). So the root environment has been unable to run this function since 2026-08-30.

**This does not call into question any already-published number** — everything traced to this session
(grid_accuracy.csv dated 8/29, the fresh_20260816 adversarial campaign, etc.) predates the break. It does
explain why Task 3's Sept-6 grid rerun needed `--project=InfoPropFrmwrk` (a different, CUDD-less
environment) instead of the root one — it was likely dodging this exact incompatibility as well as the
CUDD memory instability.

**Fix chosen and applied (2026-09-17)**: reverted the three call sites in commit `d23db08` back to
`enqueue!`/`dequeue!` — identical FIFO semantics, no behaviour change — rather than bumping DataStructures
in the root Manifest. **Bumping was attempted first and rejected**: `Pkg.add(DataStructures@0.19.3)`
produces an unsatisfiable-resolve error, because the same root environment's old Makie/GraphMakie/
AbstractPlotting/Plots/StatsPlots/ProbabilityBoundsAnalysis visualisation stack is compat-locked to old,
mutually-compatible versions that bottleneck DataStructures below what the newer Queue API needs — fixing
it that way would mean upgrading that whole stack, a much larger and riskier change for a one-line API
swap with no functional benefit. `Queue{` appears in exactly one place in the entire `Algorithms` tree, so
this revert is complete, not partial. Manifest.toml/Project.toml were untouched (confirmed via `git diff`
after the failed resolve attempt — Pkg failed atomically before writing anything).

**Worth doing at some point, not urgent**: this class of break (someone edits framework code against a
newer package API than what the root environment actually pins) could recur silently. No action taken
beyond the fix itself this session.

## Priority 4 (grid Float64 cost) — RESOLVED 2026-09-18

Two measurements were taken: a standalone `grid_cost_float_only.jl` script (written this session, CUDD-free,
just the Float64 `@benchmark`) gave 1.491ms, but it ran *concurrently* with another CUDD-heavy process
still computing on this machine — a direct violation of this project's own `grid_case_study/README.md`
rule ("the cost run measures wall-clock, so nothing else may compete with it"). The original
`grid_full_suite.jl`'s own COST section, running later once nothing else was CPU-bound, gave the clean
figure: **Float64 0.910ms / 1.74MB**, **Interval 1.082ms / 1.95MB (ratio 1.19×)**. Used the clean one.
`tab:computation_comparison_grid` updated to 0.910ms/1.74MB; full `grid_cost.csv` (both rows) propagated
to all three canonical data-repo locations, matching the pattern established for Priority 1.

**Recurring unresolved artifact, noted not chased**: a "CUDD: unable to allocate 228123137034682372 bytes"
message (byte-for-byte identical across multiple occurrences) has appeared trailing several log files this
session, after the real computation had already completed and printed its own "DONE" line. First suspected
to be a specific stuck zombie julia.exe process (PID 27884, ~72s CPU over ~2hrs wall-clock — killed), but
recurred in a later log even after that process was confirmed dead. Has not corrupted any actual data
output (every CSV produced this session traces correctly and consistently) — flagged for awareness, not
acted on further.

## Priority 2 — BDD implementation: identity resolved, one wording fix + one citation needed

**Confirmed with high confidence**: `CUDD.jl` v0.3.1 (Julia FFI wrapper) backed by `CUDD_jll` v3.0.0+0
(the real compiled CUDD C library, Fabio Somenzi), pinned in the repo-root `Manifest.toml`. This is the
oracle behind every number that actually appears in the manuscript's tables, specifically confirmed by
tracing scripts directly:
- `tab:structured` (power/grid/Karl/counterexample-n15 exactness + ROBDD sizes) ← `scripts/complexity_validate.jl` (`using CUDD, Random, Printf`, loads `dag_ntwrk_files/counterexample-n15/counterexample-n15.EDGES`)
- `tab:corpus` (129-graph corpus) ← `data/final_csvs/paper_data.csv`, CUDD-generated
- `tab:adversarial` (fan-in-k/mesh-w) ← `scripts/adversarial_scaling.jl` (`Pkg.activate(REPO); using CUDD`), output persisted at `validation/fresh_20260816/adversarial_timed.csv` and `RESSdata/data/final_csvs/adversarial_factored.csv` — **confirmed real and fresh**, not placeholder numbers (see Priority 4 below on your "is complexity actually quantitative" question)
- `tab:interval_timing` (one-shot interval vs BDD-corner route) ← `validation/interval_bdd_vs_ipa_timing.jl` (direct `Cudd_Init`/`Cudd_bddIthVar` calls)
- ISCAS85 adversarial subsection ← **no BDD comparison at all** for these circuits (IPA-only conditioning-width/memory/timing numbers); no ambiguity possible here since no oracle is invoked

**Two real loose ends**:
1. **Confirmed 2026-09-17: the manuscript text itself never mentions `BinaryDecisionDiagrams.jl`/BDDjl anywhere — only "CUDD."** So there is nothing to remove from the paper. The only place BDDjl provenance matters is the two validation scripts noted above (neither feeds a manuscript number) and the Sept-6 grid p-box rerun's *interval* rows (Priority 1) — the fix there is to redo that rerun with CUDD, not to edit the manuscript. Once that's done the "all comparisons use CUDD" sentence needs no caveat or wording change at all.
2. **CUDD itself has no citation anywhere in `references.bib`.** Add one (Somenzi, CUDD: CU Decision Diagram Package) alongside the prose claim at the §5 preamble.

## Priority 3 — RESOLVED 2026-09-18

Ran `validation/counterexample_n15_canonical_timing.jl` (new script, written this session, reusing
`interval_bdd_vs_ipa_timing.jl`'s proven `cudd_build_sifted`/`ipa_interval_time`/`bdd_interval_time`
verbatim plus one new matching Float64 timing pass) in one clean fresh process. Results:
`robdd_nodes_canonical=323`, `t_ipa_float64_ms=0.465`, `t_ipa_interval_ms=0.819` (ratio $1.76\times$),
`t_bdd_interval_ms=44.603` (ratio vs IPA interval $54.5\times$). The canonical fresh build landed on
**323** (matching `interval_bdd_vs_ipa_timing.jl`'s original number, not `complexity_validate.jl`'s 340)
— confirming the earlier diagnosis that this was sifting variable-order sensitivity between two
independently-built diagrams of the same function, not a data error. Propagated 323 into all three
citing locations (`tab:structured`, `tab:corpus`, the §5.2 "42 against N" prose) and the fresh
0.465/0.819/44.603 timing triple into `tab:interval_timing`'s counterexample row and the §5.3.2 prose
(which now correctly says "about $1.8\times$", not the old unsourced "about $1.2\times$" claim — the
real measured ratio differs from what was previously asserted). Raw artifact:
`validation/counterexample_n15_canonical_timing.csv`.

**Follow-up 2026-09-18, caught by a direct user question ("are the data repos actually in sync?") that I
had not verified myself**: the manuscript fix above was never propagated to the data repos. `RESSdata`'s
and `thesis-data`'s own `complexity_validation.csv` still had the stale `340`, and their
`interval_bdd_vs_ipa_timing.csv` still had the pre-canonical timing (0.837/48.317/57.73) — the same
stale-archive-vs-corrected-manuscript pattern as Priority 1, just missed this time. Fixed: updated the
counterexample row in both files in both repos (5 files total, including `thesis-data/figures/
ch05_probability/complexity_validation.csv` since the thesis cites the same underlying fact — only the
data CSV was touched there, no thesis `.tex` edited), and copied
`counterexample_n15_canonical_timing.csv` into both repos as the provenance record. **Lesson**: when a
number changes, explicitly re-check ALL files that cite the old value across every location, not just
the ones already top-of-mind from the immediate fix — don't assume propagation is complete just because
the highest-profile copy (the manuscript) was updated.

## Priority 3 (original write-up, kept for context)

**Counterexample ROBDD: 340 (`tab:structured`) vs 323 (`tab:interval_timing`).** Traced both to source:
- `tab:structured`'s 340 ← `data/final_csvs/complexity_validation.csv`, row `counterexample,15,23,13,4,56,788,42,340` — generated by `complexity_validate.jl`
- `tab:interval_timing`'s 323 ← `data/final_csvs/interval_bdd_vs_ipa_timing.csv`, row `counterexample,15,23,323,0.837,48.317,57.73` — generated by `interval_bdd_vs_ipa_timing.jl`

**Both scripts load the exact same source file** (`dag_ntwrk_files/counterexample-n15/counterexample-n15.EDGES`) and both call CUDD with sifting enabled — this is not a copy-paste error or two different networks. The most likely explanation is that CUDD's sifting is a local-search heuristic over variable order: the two scripts don't demonstrably initialise the BDD variable order identically before sifting runs, and sifting is not guaranteed to converge to the same node count from different starting orders. **This means "the ROBDD size" for a given network isn't a single canonical number in this pipeline — it's build-dependent.** Recommendation: either regenerate both tables from one script/one run so they agree, or add a footnote acknowledging sifted-BDD size is order-sensitive and the two figures come from independent builds. Don't silently pick one over the other without checking which build the paper actually wants to stand behind.

**The 0.67ms/0.79ms point-vs-interval figures in §5.3.2 prose have no traceable source at all.** Searched every CSV in `RESSdata`, `thesis-data`, and `validation/` (including the `fresh_20260816` campaign and the old/new `interval_bdd_vs_ipa_timing.csv` pair, which give 0.811/0.837ms for the *interval* figure alone, never a matching 0.67/0.79 pair for point-vs-interval). This violates the project's own "fresh-or-it-didn't-happen" rule (see `validation/fresh_20260816/MASTER_FINDINGS.md`) — these two numbers need either a real backing run or removal/replacement with a traceable pair before submission.

## Priority 4 — your direct questions, answered

**"Is the complexity analysis really quantitative, not qualitative?"** Yes, confirmed with real numbers traced to fresh, persisted CSVs, not placeholders or hand-waving:
- `tab:adversarial`'s fan-in-k (17, 33 sub-problems) and mesh-w (20,603 / 170,001 / 3,895,252 sub-problems; 0.37s–159.5s) rows are real — found verbatim in `validation/fresh_20260816/adversarial_timed.csv` and `RESSdata/data/final_csvs/adversarial_factored.csv`.
- ISCAS85 conditioning widths (c432=67, c499=41, c880=50) and the c17 p-box timing (1.41s) were independently cross-verified by the pre-write-pack agent against the raw `data/corpus_expansion/iscas85_*.csv` files — exact match.
- `tab:structured`'s per-network `|C|_max`/ROBDD/`|Δ|_max` figures trace to `complexity_validation.csv` as shown above.

**Update — 2026-09-17, DONE**: the raw `adversarial_timed.csv` actually goes one row further than the
manuscript table did — a **mesh-$w{=}9$** row that was never inserted: 5,426,417 sub-problems (only
1.39× more than $w{=}8$) but **5925s** of propagation (a 37× wall-clock jump), with $w{=}10$ attempted
and abandoned after exceeding a 180s/step budget. This is a genuine finding — sub-problem count stops
tracking wall-clock time at this scale, and the decision diagram (which grows much more mildly, 2.9s→3.8s)
pulls further ahead here than the sub-problem comparison alone suggests. **Added to the manuscript this
session**: the $w{=}9$ row in `tab:adversarial` and an explanatory paragraph, in
`elsarticle-template-num.tex` right after the table (§sec:complexity, "Adversarial structure").

**"Which BDD ran the corpus/complexity/timing numbers?"** — see Priority 2 above: CUDD, for everything that actually appears in a manuscript table.

**"Where's the raw accuracy/comparison numbers, and timing, for the grid three-way (interval-vs-BDD, pbox-vs-MC)?"** — accuracy/soundness numbers exist in two conflicting versions (Priority 1). Timing numbers **do not exist** — `grid_cost.csv` is empty in all three canonical locations; this specific sweep was never timed.

## Priority 5 — diamond-identification algorithm: confirmed gap, agreed action

Your suspicion is confirmed correct (see prior message) — reviewer comment #7 ("Algorithm reproducibility") is answered with correctness lemmas and identity-key prose but never the actual identification procedure. **Agreed action: write it up as an explicit algorithm, comparable in form to `Algorithm~\ref{alg:ipa}`.** The real procedure, read directly from `InfoPropFrmwrk/src/Algorithms/DiamondDecomposition/Internal/NewIdentify.jl` (the only active identification routine — `Pipeline.jl`/`Pipeline_Rewrite.jl` are dead code, and the module's own `README.md` still documents the *retired* functions, so don't consult that README when writing this up):

```
Algorithm: Diamond identification (recursive, factorised)
Input: join node v, parent set Pa(v), conditioning context E (initially ∅)
Output: independent conditioning groups for v, each with its diamond subgraph

1. For each parent p in Pa(v): compute infl(p, E) = ({p} ∪ ancestors(p)) \ E
2. Partition Pa(v) into groups by union-find: p, p' in the same group iff
   infl(p,E) ∩ infl(p',E) ≠ ∅   (independent groups combine later by inclusion–exclusion)
3. For each group G:
   a. shared_fork(G) := the topologically-highest fork node covering ≥2 members of G
      (or the asymmetric case: one member is an ancestor of another)
   b. If no valid shared fork exists, members of G ride along as ordinary non-diamond parents
   c. Otherwise: relevant nodes := v ∪ G ∪ ancestors(G); induced edges := edges among
      relevant nodes that stay inside E's already-fixed context; conditioning set :=
      {shared_fork(G)} ∪ (E ∩ relevant edges' endpoints)
   d. Recurse into the diamond's own join nodes with context E ∪ {shared_fork(G)}
4. Deduplicate by hash key = hash(sorted edge list, sorted conditioning-node set) —
   this is what lets the same substructure under a different outer context be cached
   as a genuinely different sub-problem (Section on identity/hkey already in the paper)
5. A node is excluded from a conditioning set only if it is provably degenerate
   (prior exactly 0, or prior exactly 1 AND it is a graph source) — excluding any
   other prior-1 node was a real bug, fixed 2026-08-17, that silently dropped diamonds
   whenever every prior was 1.0 (e.g. would have broken the grid benchmark)
```
This is a draft translation for the next writing session, not yet inserted into the manuscript. Once
it's in, expect to trim the current `sec:identification` prose (§4, "Identification of stored
sub-problems") since some of it will become redundant with the algorithm box — but keep the hkey/context
framing, since that's the part the algorithm box above doesn't fully spell out on its own.

## Confirmed NOT gaps (already in good shape, no action needed)

- Imprecise-inputs (interval/p-box) treatment: three dedicated subsections, including the new cost-mechanism paragraph and `fig:pbox_cost`, already present and substantial.
- Complexity/adversarial section (four lemmas, cutset-conditioning/junction-tree positioning, fan-in/mesh/ISCAS85): already migrated in and quantitatively real (Priority 4).
- PGM/credal-network applicability paragraph + its two supporting citations (Fagiuoli & Zaffalon 1998, Mauá & Cozman 2020): already in the manuscript and bibliography.

## Explicitly out of scope this session (author's call)

- **Power-network interval-vs-BDD / p-box-vs-MC extension** — confirmed this was never done anywhere (thesis, RESSdata, pre-write pack all have Float64-only for power network). Real gap, not being pursued now.
- **Net3 in a manuscript table** — named in §5.2 prose only, never tabulated. Not being pursued now.

## Still open: the systematic full parity pass

The numeric-extraction agent produced a complete, section-by-section list of every numeric claim in the
live manuscript (worked examples, every table cell, every complexity/timing figure, every drone-study
number) as the base for tracing each one back to a source artifact. That trace-every-number pass itself
has **not** been done yet beyond the specific items above — this document covers what surfaced from the
four-agent investigation plus this session's follow-up, not an exhaustive cell-by-cell reconciliation.
Recommend treating that as the next dedicated session, using this document's Priority 1–3 items as the
starting punch list rather than starting cold.

## Standing rules this session reaffirmed

- **Fresh-or-it-didn't-happen**: the untraceable 0.67/0.79ms figures (Priority 3) are exactly the failure
  mode this rule exists to catch.
- **Trace provenance before trusting a number**: the counterexample ROBDD 340-vs-323 split (Priority 3)
  looked like a bug until both were traced to real, distinct, individually-legitimate script runs.
- **Don't assume a stale-looking artifact is corrected just because a newer one exists elsewhere**: the
  Priority 1 finding is exactly this — a real fix exists, but only in a sandbox location, while the
  archival/deposit-bound copies still contradict it.
