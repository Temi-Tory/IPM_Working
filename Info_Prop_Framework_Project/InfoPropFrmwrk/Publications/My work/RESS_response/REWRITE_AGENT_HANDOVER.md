# Handover for the actual RESS rewrite/revision session

This document is instructions for whichever agent/session picks up the real rewrite. It is not a
task list for the session that wrote it — that session's job was confirmation and packaging,
documented in `pre-write final/`; this document tells the *next* session how to actually write.

## 0. What this session is, and is not

You are producing the real, submittable revised manuscript, the point-by-point reviewer response,
and the cover letter to the editor. You are **not** starting from a blank page — a huge amount of
confirmation, correction, and drafting work already happened. But you are also **not** simply
copying a finished file into place: the prior session's edited manuscript copy is a sandbox that
proved content compiles and numbers are correct, not prose to paste verbatim. Your job is to
actually *write* — in the author's own voice — using that sandbox and the tracking docs as a
verified source of facts and structure, not as source text.

**Where the real output goes**: `Publications/My work/RESS_REVISED/` (sibling to this
`RESS_response/` folder) is the actual home for the real rewrite — the live manuscript source,
the real reviewer-response letter, and the real cover letter. `RESS_response/pre-write final/`
stays confirmation/reference material (the parity checklist, the sandbox, the audit trail) — do
not write the real submission files into it. Set up `RESS_REVISED/` with its own sensible
structure (e.g. `manuscript/`, `reviewer_response/`) as you start actually writing.

**Important practical note**: the prior session's sandbox lived in a session-specific temp
directory that will not exist in your session. Do not go looking for it. Use the **persistent**
copies instead: `pre-write final/manuscript/main_CORRECTED.tex` and `RESSdata/manuscript/main.tex`
(kept byte-identical to each other) — these are the "proof it compiles" reference copies you
should read for structure/content, still not for verbatim prose.

## 1. Read, in this order, before writing anything

1. **Raw validation evidence**, not just summaries — spend real time in
   `Info_Prop_Framework_Project/validation/`, especially `validation/probability/` (the freshest
   layer) and `validation/fresh_20260816/MASTER_FINDINGS.md` (the fullest running record). Read
   actual logs and CSVs for anything you plan to state a number for, not just the `.md` summaries
   of them — the summaries are trustworthy but you should ground yourself in the primary evidence
   before writing claims that will be scrutinised by reviewers.
2. **This RESS_response folder's tracking docs**, in this order:
   `pre-write final/README.md` → `pre-write final/manuscript/CORRECTIONS_APPLIED.md` (the actual
   parity checklist — the core document) → `pre-write final/NEXT_STEPS_CHECKLIST.md` →
   `pre-write final/reviewer_response/JUDGMENT_CALLS.md` →
   `pre-write final/reviewer_response/POINT_BY_POINT_TRACKER.md` →
   `pre-write final/manuscript/PBOX_COST_MECHANISM_DRAFT.md` →
   `pre-write final/literature/CITATION_STATUS.md` → `RESSdata/MANIFEST_DECISIONS.md`.
3. **The sandbox manuscript** (`pre-write final/manuscript/main_CORRECTED.tex` — persistent copy,
   see note above) and its figure fragment (`paper_pbox_cost_figure.tex`) — read for structure and
   verified content, not as prose to copy.
4. a.**A relevant Strathclyde thesis chapter or two**, for structural/voice grounding from the
   author's own longer-form academic writing: `Full thesis/Chapters/Probability/`,
   `Full thesis/Chapters/DiamondModule/`, and/or skim `Full thesis/main.pdf`'s introduction. You
   do not need to read the whole thesis — enough to internalise register and structure.
   b. soeme xampes of either C:\Development\Info_Prop_Framework_Project\Info_Prop_Framework_Project\InfoPropFrmwrk\Publications\Examples of other ppl written works or 
   downloaded via webfetch actual RESS submissiosn
5. **The original RESS paper's own voice** — extract and read `RESS_response/RESS_Paper__New_.docx`
   (this is the as-submitted text, confirmed by the author) and/or `OriginalPaper/` — the goal is
   to preserve continuity of the author's existing voice and tone in the revision, not to
   reintroduce a generic or noticeably different register partway through the paper.
6. **The author's own writing-style rule files** (external to this repo, in Downloads):
   `THESIS_WRITING_MASTER.md`, `thesis_working_notes.md`, `thesis_writing_rules.md`. These codify
   explicit, already-established preferences — read them fully before drafting a single sentence,
   and follow them throughout, not just at the end as a check.
7. **`check_prose (1).py`** (also in Downloads) — a prose-checking script. Review what it actually
   checks for. It is explicitly worth extending: the author has flagged that some AI-writing tells
   are not obvious pattern matches and the script may need new checks added for them — use your own
   judgement reading the sandbox manuscript's prose to identify what those might be (repetitive
   sentence openers, overuse of certain hedges/connectives, uniform sentence length, etc.) and
   propose additions before relying on it.
8. **Calibrate the script before trusting it**: run `check_prose.py` against (a) the original RESS
   paper text and a few papers in `Publications/Examples of other ppl written works/` — these are
   expected to **pass** (or score however genuine human academic writing scores) — and (b) the
   sandbox manuscript (`main_CORRECTED.tex`) — **expected to fail/score noticeably worse**, since it
   was drafted by Claude across several sessions. This is a deliberate, useful sanity check: if the
   sandbox doesn't score worse than the human-written baselines, the script isn't catching what it
   should, and needs the extensions from step 7 before you rely on it to judge your own rewrite.
9. **Check Claude's memory files and this project's prior chat history** for how the author's
   writing rules and voice preferences have evolved over time (there may be refinements beyond
   what's in the three Downloads files above) — the author is a British PhD student, so British
   English spelling/punctuation conventions and a formal-but-direct academic register should be
   the default unless a specific rule file says otherwise.

## 2. What to actually do, once you've read all of the above

1. Write the revised manuscript into `RESS_REVISED/` (not the sandbox, not `RESS_response/`), following
   `manuscript/CORRECTIONS_APPLIED.md` section by section as a parity checklist — every bullet
   should have a corresponding statement in your draft, in the author's voice, not copied from the
   checklist's own summary wording.
2. Place the adversarial/worst-case-complexity content (checklist item 13) — decide final
   placement and wording yourself, informed by the thesis/original-paper voice reading above, not
   by reusing the sandbox's sentences directly.
3. Insert the two currently-held-back pieces if the author confirms they're wanted: the corrected
   R3.8/PGM-applicability paragraph (item 17) and the p-box cost mechanism paragraph + figure
   (`PBOX_COST_MECHANISM_DRAFT.md`, `paper_pbox_cost_figure.tex`).
4. Do a genuine editorial/proofreading pass — this has been flagged as owed by multiple prior
   sessions and never done. Check against the writing-rules files and the calibrated
   `check_prose.py`, and read the whole thing aloud-in-your-head for register consistency,
   especially at the seams between original text and newly drafted sections.
5. Finalise the point-by-point reviewer response letter and the cover letter to the editor
   (`reviewer_response/POINT_BY_POINT_TRACKER.md`, `COVER_LETTER_DRAFT.md`) against the manuscript's
   final, stable section numbering — do this after the manuscript structure is settled, not before.
6. Top up `RESSdata/` with anything the final manuscript ends up citing that isn't there yet
   (e.g. the adversarial family's fresh timed data) — content only, not git/minting (see §4).

## 3. What NOT to do
- Do not copy sentences from `main_CORRECTED.tex` verbatim into the real draft and call it done —
  it was never vetted for voice/register, only for factual/numerical correctness and compilation.
- Do not silently drop the author's established voice in favour of a more generic or more
  "textbook" academic register — the goal is continuity with the original submission's own style,
  corrected and strengthened, not a rewrite from scratch in a different voice.
- Do not re-run validation that's already documented as done with a persisted artifact — check
  `CORRECTIONS_APPLIED.md` and the `data/` folder first.
- Do not mint the Zenodo deposit or do any git operations on `RESSdata/` — that work belongs to a
  later, separate agent/session (see §4), specifically so that repo carries no Claude git
  authorship/collaboration at all.

## 4. What happens after this session finishes — and what THIS session must hand off

This rewrite session is not the last one. Once the manuscript itself is done — editorial pass
complete, all figures/tables checked against the final text, and the reviewer rebuttal letter +
cover letter to the editor written against the now-stable section numbering — **this session's
last deliverable is to write two new, separate handover documents** (alongside this one, same
`RESS_response/` root, following the same naming convention), because the remaining work splits
across two different future agents/sessions that should not be run together:

1. **`RESSDATA_MINTING_HANDOVER.md`** — for the agent that mints the Zenodo deposit and then
   updates the finished paper with the resulting DOI (same agent does both steps, in that order,
   since the DOI has to exist before it can be cited). This handover must be explicit that:
   - `git init`/commit/push on `RESSdata/` and the Zenodo minting itself are **the author's own
     actions** — this next agent should prepare/check content and walk the author through it, but
     must not become a git collaborator/author on that repository (no Claude commit authorship).
   - Once the DOI exists, go back into the finished manuscript (by then living in `RESS_REVISED/`,
     not the old sandbox) and fill in the DOI placeholder in the Data Availability statement (see
     `CORRECTIONS_APPLIED.md` item 9) — this is the one piece of manuscript text that genuinely
     cannot be finalised until after minting.
   - Point it at `RESSdata/MANIFEST_DECISIONS.md` and the final manuscript's citations so it knows
     exactly what must be in the deposit before minting.
2. **`THESIS_PARITY_HANDOVER.md`** — a fully separate handover for thesis-side updates/parity,
   pointing at `THESIS_ADDITION_NOTES.md` and `THESIS_RECHECK_LIST.md` (the already-parked,
   deliberately-deferred thesis follow-up items, including the corrected PGM-applicability
   finding). This is independent of the RESSdata/minting work above and should be run as its own
   agent/session, not bundled with it.

Write both of these once the manuscript/letters are actually finished, not before — they should
reflect the true final state of the paper (final section numbers, final DOI-shaped placeholder,
any new findings from the editorial pass), not a guess made mid-rewrite.
