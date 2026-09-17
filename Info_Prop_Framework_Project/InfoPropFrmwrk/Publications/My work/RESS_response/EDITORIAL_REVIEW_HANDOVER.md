# RESS_REVISED editorial review — handover (session ending 2026-09-17)

**Read this first, in this order**: this file, then the two locations it points at for detail
(`pre-write final/` for the pre-write context, the manuscript itself for the actual text). Do not
re-derive anything below from scratch — every claim here was checked this session, either by
reading a file in full or by running/tracing an actual artifact.

## What this session was asked to do, and the verdict it reached

Task: a reviewer-style straight-through read of §4–6 of
`InfoPropFrmwrk/Publications/My work/RESS_REVISED/original_submission/elsarticle-template-num.tex`
(the real, current manuscript — not a sandbox), specifically to judge whether §5.4 (the drone case
study) is "dense-but-earned or still padded" now that an earlier skeleton-comparison round fixed
its structural (checklist→narrative) problems.

**Verdict, reached and stable — do not re-litigate**: dense-but-earned at the structural/content
level. Every paragraph carries a genuine, distinct claim. The residual "still feels padded"
sensation traces to sentence-level construction, not content: §5.4.1 specifically has three
overloaded/run-on sentences (the opening ~70-word sentence trading off delivery time/cost/
resilience; the connections-existence sentence with a missing comma; the direction-of-dependency
sentence stacking three connectives) each ending in a trailing "-ing" participial clause — the
banned pattern from this project's own style rules. Fix is splitting/tightening those specific
sentences, not cutting content.

## Fixes already applied this session (verified, in the real manuscript)

- **§3.3 arithmetic error, fixed.** Lines ~441–442 of `elsarticle-template-num.tex`: the
  "Solution by Independent Update (Incorrect)" derivation had `0.83227`/`0.749043`; verified
  independently (`1-(1-0.59049)^2 = 0.8323016`, `×0.9 = 0.749071`) and corrected to
  `0.83230`/`0.749071`. This error was also present in the pre-write sandbox
  (`pre-write final/manuscript/main_CORRECTED.tex`), confirming it predates this session and was
  never caught by the earlier parity pass.

## Confirmed findings, not yet applied — pick one and go

1. **§5.4.1 sentence-level fixes** (the answer to the density question above). Three specific
   sentences named above, needs splitting + removing trailing "-ing" tails. Also minor, lower-
   priority flow notes elsewhere: §4's "by preventing..." attachment ambiguity (line ~523), §5.1's
   gerund-subject opener ("Confirming this benchmark..."), §6's passive opener, §5.5's uncited
   "widely used."

2. **§5.2 corpus-scope ambiguity.** The corpus-description sentence (line ~816) introduces "129
   random and mutated DAGs" then stacks "six topological families... larger random networks up to
   50 nodes... several real infrastructure networks" on top, uncounted. The next sentence
   ("Every network in the corpus was evaluated...") refers back to this whole, unsized set. Needs
   either a real total count or tighter scoping of the claim.

3. **§5.1's "no ROBDD row" justification is a post-hoc rationalisation, not the real reason.**
   The actual reason (verified by reading `grid_full_suite.jl` and `bench_grid.jl` in full): no
   script anywhere in the repo, `RESSdata`, or `thesis-data` has ever wrapped a CUDD build for the
   grid network in a timer — only a single point-evaluation for accuracy. The sentence about
   avoiding "the kind of uncontrolled comparison already rejected for dPrPm" describes a real and
   defensible editorial choice (don't drop a bare number next to an already-caveated external
   figure) but isn't honest about *why* the number isn't there. Needs rewording, or a real
   measurement (see "Grid CUDD timing" below — currently blocked).

4. **Nesting-depth-18 reviewer bridge — response-letter only, per explicit author ruling.**
   Verbatim, extracted this session from `RESS_response/Reviewer_Comments_Response_Tracker.docx`
   (first table, comment 6): *"The results indicate that networks with nesting depth 16-18 become
   computationally expensive or impractical..."* — and Reviewer #2, comment 4: *"computation times
   become intractable when diamond nesting depth reaches 18 or more... Section 5.3 should be
   expanded to discuss strategies for managing high-treewidth graphs, including a hybrid
   approach..."* The original submission's own six-Pareto drone case study (git commit `e62071c`,
   now fully replaced) is where "18" came from — a `PP1-HighRes-FW` table with a `MaxDepth` column.
   The current manuscript never says "nesting depth" in the drone section at all (grepped: appears
   exactly once, in a generic §3 sentence, unconnected to either reviewer's comment) — it reports
   conditioning-set size `|C|` instead. **The author's explicit ruling on this (do not
   re-litigate): the bridge between "nesting depth 16–18" and "conditioning-set size 16" belongs
   only in the reviewer-response letter, never in the manuscript body** (standing rule: no
   revision-history references in the body). The manuscript's own complexity substance (§4.3's
   formula/lemmas + §5.4.2's real `|C|=16` boundary) is self-contained and doesn't need fixing on
   this point. **The letter-side bridge sentence itself was never drafted this session — author
   said no, not now.** Someone still needs to write it before the response letter is finalised.

5. **Memphis/Berlin/EPANET (mlgw-gas-network, metro_directed_dag_for_ipm, Net3) — named in §5.2
   prose, never in a manuscript table.** Earlier in this session this was mischaracterised as "no
   results exist" — that was wrong. Real, validated data exists for all three:
   - `mlgw-gas-network`: 37 nodes/40 edges, 7 diamonds (4 maximal), maxcond 4, Float64 exact to
     1.1×10⁻¹⁶, Interval exact to 2.2×10⁻¹⁶. Source:
     `pre-write final/data/corpus_expansion/partA_mlgw-gas-network_full_summary.csv`.
   - `metro_directed_dag_for_ipm`: 306 nodes/350 edges, 147 diamonds (45 maximal), maxcond 6,
     Float64 exact to 2.8×10⁻¹⁶. Source: `pre-write final/data/corpus_expansion/
     partA_metro_directed_dag_for_ipm_full_summary.csv`.
   - `Net3`: 97 nodes/119 edges, 307 diamonds (21 maximal), maxcond 12, sources {1,2,4}. Source:
     `C:\Development\RESSdata\networks\net3\RESULTS.md` (also cross-confirmed in
     `pre-write final/data/TASK1_net3_summary.md`). No explicit oracle-comparison delta was found
     for Net3 in what was read — worth checking whether one exists before claiming exactness for
     it specifically.
   **The real gap**: none of the three have a captured ROBDD node-count anywhere found this
   session — the specific column `tab:structured` uses for its other four rows (power/grid/Karl/
   counterexample-n15). Adding a real table row needs that one more number, or a differently-
   shaped table that doesn't need it. Not located; may not exist yet.

## `grid_cost.csv` / IPA's published 0.928ms — provenance, resolved

The raw CSV artifact behind the manuscript's `0.928ms/1.72MB` grid runtime figure is **0 bytes
(empty) in both `RESSdata` and `thesis-data`** — the two canonical, git-tracked reproduction
snapshots. But the number itself is real and tracked: `thesis-data/validation/probability/notes/
MASTER_FINDINGS.md` line 66 logs it directly as a "REFRESHED" measurement (superseding an older
2.378ms/4.94MB figure). So: the number has a documented paper trail, just not a raw CSV backing it
in either snapshot. Not flagged as broken — just noted, in case anyone goes looking for the CSV
and can't find it.

## Grid CUDD timing — inconclusive, do not reuse any number from this session

No CUDD *timing* for the grid network exists anywhere in the repo, `RESSdata`, or `thesis-data`
(confirmed by a repo-wide search for any script combining `@benchmark` with a CUDD/BDD call — only
`grid_full_suite.jl` matches, and its cost section only times IPA, never CUDD). The grid's CUDD
**node count** (290, sifted) is already correctly published in `tab:structured` and is not in
question.

This session tried to measure the timing, reusing the actual proven methodology
(`validation/cudd_intractable.jl`'s `bdd_size` function, the real script behind
`validation/cudd_complexity.csv` — copied verbatim, not reinvented, after an earlier flawed
attempt that loaded the full `InfoPropFramework` into the same process as CUDD and got
contaminated/crashing results). Even with the correct methodology, repeated measurements were
wildly unstable and **trended monotonically worse across the session**:
- 1 run: 50.0ms
- 3 same-process repeats immediately after: 155–180ms
- 8 independent fresh-process trials: 1144–3165ms

Node count was 290 (correct, matching the published figure) in every single trial — the *build*
is verifiably right; only the *wall-clock time* is unstable. Working theory: this session launched
roughly a dozen Julia/CUDD processes in a row, including several that crashed with CUDD memory
errors, and likely degraded the machine's measurement environment progressively (memory
fragmentation, AV scan backlog, general load) rather than revealing genuine CUDD variance.

**Do not use 50ms, ~165ms, or ~1.1–3.2s as a grid CUDD timing figure in the manuscript.** If this
number is wanted, it needs a clean measurement taken in a session/machine state with no prior CUDD
activity — ideally the author running it, or a future session running it once, first thing, before
touching CUDD for anything else. A new, unused artifact from this session's first (least-loaded)
attempt exists at `validation/grid_cudd_complexity_row.csv` (290 nodes / 50.0ms) — the node count
in it is trustworthy, the timing is not; don't cite the ms figure from it.

## An incident this session caused — do not repeat

Early in this session, running the existing `bench_grid.jl` script "just to check it still works"
**overwrote `grid_cost.csv`** in a live, non-git-tracked OneDrive working folder
(`c:\Users\ohian\OneDrive - University of Strathclyde\Documents\...\Info_Prop_Framework_Project`)
with fresh, different numbers (Float64 1.286ms vs. the published 0.928ms). That folder is outside
the three sanctioned locations and was found only by following a hardcoded path constant inside
someone else's script — nobody asked for it to be touched. **The author was explicit and firm:
never go there again.** Work only within the git-tracked repo
(`C:\Development\Info_Prop_Framework_Project\Info_Prop_Framework_Project`) and the two data repos
(`C:\Development\RESSdata`, `C:\Development\thesis-data`) — all three are source-controlled on
git; OneDrive is not part of this workflow at all. **Whether the OneDrive file was ever recovered
(via OneDrive version history) is unknown — was not confirmed by the author before this session
ended.** Worth asking, but not worth chasing further unprompted.

## Standing rules this session re-confirmed or established (apply going forward)

- **Only read/work from `pre-write final/` (read in full this session, every file — reviewer
  comments, all task summaries, the sandbox manuscript, all judgment calls, the corrections
  checklist), `RESSdata`, and `thesis-data`.** Don't wander elsewhere by following a path found
  inside a script.
- **Trace provenance before trusting a number**: which script generated it, when (file mtimes,
  log timestamps), not just what the output CSV says. Don't guess.
- **Reuse existing, proven scripts/methodology exactly before writing something new.** Writing a
  new script from scratch (even a small one) when an existing, already-validated one could just be
  extended is the wrong default — it was the direct cause of the contaminated CUDD measurements
  earlier this session.
- **"Same process/same machine" in the manuscript's methods language means same hardware,
  controlled conditions — not literally co-resident in one OS process with an unrelated framework
  loaded.** Don't over-interpret this the way this session initially did.
- **Never reference reviewer comments or revision history in the manuscript body** — response
  letter only. Already a standing rule; re-confirmed via the nesting-depth-18 case above.
- **The checklist-driven writing process (anchored on `CORRECTIONS_APPLIED.md`) produces good
  section-by-section compliance but real seams between sections** — things that satisfy their own
  checklist item in isolation without surviving as connected narrative (Memphis/Berlin/EPANET is
  the caught example). A dedicated pass hunting specifically for this — different from the
  reviewer-style factual/flow pass already done — is still owed, once the fixes above land.

## Reviewer comments — now available verbatim, not paraphrased

Extracted in full this session from `RESS_response/Reviewer_Comments_Response_Tracker.docx` (a
real file in the git-tracked repo, previously only known via working-note paraphrases). Covers the
first unnamed-reviewer table (8 comments), Reviewer #2 (4 comments), Reviewer #3 (8 comments) —
all verbatim. Useful for any future response-letter drafting; don't re-paraphrase from memory
files when this is available.

## Not yet done (carried over, unchanged from before this session)

- Full editorial/proofreading pass — this session's read covered §4–6 plus a skim of §1–3; the
  "hunt for seams, not facts" pass described above is additionally owed.
- Reviewer response letter and cover letter — still held pending the original decision letter
  (MS number, handling editor) per the author's own prior instruction; unrelated to this session.
- Two follow-on handovers mentioned in earlier project memory (network-generation handover,
  thesis-parity handover) — not started, not touched this session.
