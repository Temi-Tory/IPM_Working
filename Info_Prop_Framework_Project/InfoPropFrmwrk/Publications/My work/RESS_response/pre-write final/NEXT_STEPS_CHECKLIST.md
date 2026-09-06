# Straight checklist to unblock all four target deliverables (final consolidated version, 2026-09-06)

Owner tags: **[me]** I can just do this. **[discuss]** needed live back-and-forth (all now done).
**[user]** only the author can do this. For the manuscript's own content/numbers, this file just
points at the authoritative source (`manuscript/CORRECTIONS_APPLIED.md`) rather than duplicating
it — that file is the actual parity checklist to work from when writing.

## Everything that was a blocker — status

All of the following are **resolved**: the 3 `JUDGMENT_CALLS.md` framings (discussed and settled —
drone disclosure needs no change, BDD near-miss narrative withdrawn on the author's correct
pushback, PGM-applicability claim corrected in discussion into a materially sharper version);
naming the real-infrastructure networks explicitly; the bnlearn breadth claim; the original
submission + reviewer comments (confirmed already in hand: `OriginalPaper/`'s docx and the
`Reviewer_Comments_Response_Tracker.docx` are the real, unparaphrased documents); Jones et al.'s
publication status (confirmed unchanged, "submitted"); affiliations (NNL → UKNNL per the thesis's
own wording, applied).

**Drafted and verified, not yet in the real rewrite** (this is genuinely new prose/content, not a
numeric tweak — read it before using it, per `manuscript/CORRECTIONS_APPLIED.md`'s framing note):
the new adversarial-complexity subsection (fanin-k/mesh-w with honest wall-clock framing, the
w=8→9 memory-wall finding, and the new ISCAS85 result with its independent 1996 literature
corroboration); the `measured_ops`-vs-time figure (visually verified rendering correctly); the
corrected R3.8/PGM-applicability paragraph text (fully drafted in `JUDGMENT_CALLS.md` §3, not yet
placed into any draft).

**Deliberately deferred, not forgotten** — clearly logged so the rewrite session knows what's
waiting: the full editorial/proofreading pass; inserting `PBOX_COST_MECHANISM_DRAFT.md`'s §4.4
paragraph (the figure above is ready to go with it); minting the Zenodo deposit (after the
rewrite, on the author).

## Per-deliverable status

**1. Mint new RESS paper data repo** — `C:\Development\RESSdata\` is built and scoped (every
network with real validated data included; benchmarks-only/dead-artifact/wrong-algorithm/
redundant-duplicate exclusions each have a specific reason, documented in its own
`MANIFEST_DECISIONS.md`). No `.git` — the author inits/pushes/mints themselves, after the rewrite,
so the deposit's contents match the published paper exactly.

**2. Write the reviewer rebuttal letter / letter to editor** — draft material ready
(`reviewer_response/POINT_BY_POINT_TRACKER.md`, `COVER_LETTER_DRAFT.md`); final pass needs the
manuscript's section structure to be stable first (i.e., after the adversarial section is placed
in the real draft), and the exact manuscript number/editor name once needed from the original
decision letter (already confirmed in hand, per above).

**3. Generate all figures and tables needed** — all existing tables corrected and verified this
session; the new adversarial table and the new `measured_ops`-vs-time figure are drafted and
verified rendering; `envelope.pdf` was not independently re-verified this session but is
recommended to trust as-is (cross-checked indirectly by this session's own independent grid p-box
re-confirmation landing at the same result it already claims).

**4. Write the revised RESS paper** — the umbrella task. Everything above feeds into it. See
`manuscript/CORRECTIONS_APPLIED.md` for the actual point-by-point content to write from.

## Suggested order (not a hard requirement)

1. Place the adversarial section and decide its exact wording (changes section numbers — do this
   before anything that references section numbers by number).
2. Insert the corrected R3.8/PGM paragraph and the two new judgment-call-adjacent bibliography
   entries (Fagiuoli & Zaffalon 1998, Mauá & Cozman 2020) alongside the adversarial section's own
   two new entries (El Fattah & Dechter 1996, Brglez & Fujiwara 1985).
3. Full editorial/proofread pass over the resulting manuscript.
4. Finalize the rebuttal letter and cover letter against the now-stable section structure.
5. Top up `RESSdata/` with the adversarial data (fanin-k/mesh-w fresh timed CSVs, ISCAS85 network
   files already there) once the manuscript text is final.
6. Mint the Zenodo repo — last, on the author.
