# Handover — revising a thesis chapter tex

For any agent picking up revision work on Temi's thesis chapters. The writing rules live in
`Diamond_Chapter_v2/WRITING_BIBLE.md`; read it in full before touching a tex file. This document
is the working protocol around those rules.

## The job

Revise chapter tex in Temi's voice, with every technical claim verified against the source code
and the mathematics, written clearly and concisely with zero fluff. You are the second pair of
hands, not the author. She reads, she decides, you apply and verify.

## Voice, in one paragraph

British PhD student, late twenties. Direct, measured, human. A sentence makes one point, a
paragraph tells an arc, a section tells a clear story. No em or en dashes as punctuation, colons
and semicolons almost never, no prose-as-comma-list, no triads of shallow examples, no document
self-narration ("the chapter proceeds as follows"), no promotional or buzzwordy language. Each
meaning is paid for exactly once; claims weld to their reasons with since/because/therefore. The
bible's repetition law lists the ten failure shapes — check drafts against all ten.

## The working loop

1. Temi reads a section and issues notes, often several at once, often with her own rewrite
   pasted in. Apply **all** of them. Reread her notes before declaring a round done; missing an
   explicit instruction (a rename she "quite literally said") is the worst failure mode.
2. Her fresh rewrites are never re-voiced or "improved". The only edits allowed on her text are
   mechanical and factual: typos, wrong digits, broken refs. Flag every such fix to her
   individually, with the receipt (file and line in the code that shows the correct value).
3. When she restructures one section, that treatment is the template for the remaining sections.
   Propagate it without waiting for per-section notes.
4. When she fixes a term, apply it everywhere in the chapter immediately (`replace_all`), then
   grep to confirm zero stragglers.

## Validating claims against the code

- **Never write a technical claim from memory.** Open the source file and read the lines before
  the sentence goes in. Paraphrase drift is real: a formula was once written E∩R when the code
  computes E∩V(E_D), and only a line-level read caught it.
- Worked-example numbers enter the text only after a trace script has produced them by running
  the actual implementation (pattern: `validation/fresh_20260816/chapter_example_trace.jl`).
  Extend the trace script for each new example; keep its log. If the code changes, re-run it.
- Never fabricate a quantity, an example, or a citation. If an example must be real, find one in
  the corpus or do without.
- Thesis-facing names may deliberately diverge from code names (`identify_diamonds` vs
  `new_identify`). Keep the chapter's terminology table current, give the code name at most once
  in parentheses, and track proposed code renames as a separate decision that is hers.
- Verify every citation at the publisher record: it exists, and it says what the sentence cites
  it for.

## Mathematical correctness

- A proof is a complete chain or an explicit, named hand-off to the chapter that owns the missing
  step. Nothing in between. "Validated rather than proved" is banned.
- Check statements against set and graph theory by hand, including the conventions the code
  fixes (e.g. ancestry closures are self-inclusive by construction). A claim that reads well and
  is false is the failure this protocol exists to prevent.
- Match quantifiers and direction to what is actually proved: "at most k", "only if", one
  direction claimed when one direction is shown.
- Proofs use the actual mathematical objects, never process words ("the procedure", "the tally",
  "was tested"). Structure them as academic proofs, concise and organised; a proof that reads as
  discussion loses the proof label and becomes the section's prose.

## Never hedge

State what is true plainly and what is false plainly. If her draft has an error, say so with the
code receipt. If your own earlier claim was wrong, say that too. Do not soften with "should",
"appears to", or "might" when reading the source settles the question; equally, never claim more
than the proof or the run showed. Report compile results and trace outputs exactly as they are.

## Mechanics

- Each chapter lives in its own folder (`Diamond_Chapter_v2/`, `CPM_Chapter_v1/`, ...) with the
  standalone/maindoc scaffold: `\ifdefined\maindoc` guards the preamble, and `\newlabel`
  fallbacks resolve cross-chapter `\ref`s in standalone compiles. Cross-chapter references are
  always by label, never hardcoded numbers.
- Compile after every batch (pdflatex, biber for citation changes) and verify: 0 errors,
  0 undefined-reference warnings, expected page count. Then grep the tex for banned terms and
  the round's renames.
- Figures are GraphViz dot sources in per-figure subfolders under `figures/`. No caption text or
  decorative labels in the dot; captions live in LaTeX. On this machine, compile dot via short
  paths (Windows 260-char limit), and if OneDrive makes a file unreadable to dot, copy it to
  `$HOME` and compile there.
- IDE diagnostics go stale mid-batch. Verify a reported duplicate or missing label with grep
  before acting on it.

## Boundaries

- Chapter work stays in the chapter's folder. The thesis tree (`Full thesis/`) is Temi's;
  integration follows the chapter's `INTEGRATION_NOTES.md` and is done by her.
- Her standing notes and scripts are never edited; recommended corrections go to her in the
  conversation or in your own findings file.
- Commit nothing unless she asks.
