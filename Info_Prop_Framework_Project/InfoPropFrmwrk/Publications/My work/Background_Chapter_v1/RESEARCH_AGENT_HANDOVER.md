# Handover — researching and drafting the Background / Literature Review chapter

For an agent picking up the literature search and the chapter draft. Read this in full, then
`WRITING_BIBLE.md` (`Diamond_Chapter_v2/WRITING_BIBLE.md`) in full, then `RESEARCH_GAMEPLAN.md`
(this folder) in full, before searching for a single source or writing a single sentence. This
document is the writing-and-research protocol; the gameplan is the task specification (the
seven threads, the outline, the coverage map, what is out of scope).

## The job, and how it differs from every other chapter so far

Every other chapter this thesis has produced was written or revised against a ground truth the
agent could open and read: the Julia source, a trace script's output, a compiled proof. This
chapter's ground truth is different. Its claims are about the external literature and about what
does or doesn't already exist, and the only way to make those claims honestly is to actually
search, read what turns up, and report it plainly, including when the honest answer is "the
closest comparator does X, not what this framework does" rather than a clean "nothing exists."
You are not inventing a survey from what a language model already half-remembers about the field.
You are finding sources, verifying them, and writing from what they actually say.

You are the second pair of hands, not the author. Temi reads, decides, and integrates into the
live thesis herself. Everything you produce is a draft for her to read, correct, and approve, the
same relationship every other chapter in this project has had with the agents that helped write
it.

## Read these chapters before you write a word

The bible states the rules; these chapters show them followed. Read at least the first two in
full before drafting anything, because this chapter's job overlaps theirs more than any other
chapter's does, and the risk of quietly duplicating what they already say is real.

- **`Probability_Chapter_v1/Probability_Propagation_Chapter.tex`**, section "Computing network
  reliability". This is the closest existing model for what you are about to do at chapter scale:
  a genuine survey of a method landscape (RBD/FTA, path/cut-set decomposition, Monte Carlo, BDDs,
  cutset conditioning, junction trees, message passing, imprecise probability), written tight, one
  paragraph per family, each grounded in real citations, ending on where this framework sits
  relative to all of it. Read how little space it spends per family and how hard the payoff (the
  framework's own position) is held back until the survey has earned it.
- **`Diamond_Chapter_v2/Diamond_Decomposition_Chapter.tex`**, the introduction and
  "Decomposition in Complex Networks" section. Shows the "organising idea first" structure rule in
  practice (reduce vs partition vs compact representation, not a checklist of decomposition
  methods) and the discipline of ending a survey by naming the object it was building towards.
- **`CPM_Chapter_v1/Critical_Path_Chapter.tex`** and **`Model_Chapter_v1/Complex_Processes_Chapter.tex`**,
  for two more registers: CPM's grounding keeps the method's own history compressed to a few
  lines before moving on; the Model chapter shows how thin a survey can honestly be when the
  chapter's actual job is elsewhere.
- **`UI_Chapter_v2/Front_End_Chapter.tex`**, for the closest existing example of positioning
  against a landscape of prior tools (Gephi, Cytoscape, OpenCossan, the PBA family) without
  turning it into a catalogue.

## Voice, condensed

British PhD student, late twenties. Direct, measured, human. A sentence makes one point, a
paragraph tells an arc, a section tells a clear story. No em or en dashes as sentence punctuation
(compound terms and ranges are fine: `series--parallel`, Chapter~2--4). Colons and semicolons
almost never as sentence-splicers. No prose written as a comma'd list. No document
self-narration ("this chapter reviews the following areas..."), no promotional or buzzwordy
language, never overclaim, never underclaim. Each meaning is paid for exactly once; claims weld to
their reasons with because/since/therefore. The bible's repetition law names ten specific failure
shapes with examples, check every subsection against all ten before calling it done, not just the
ones that feel familiar.

**The specific trap this chapter sits in.** The bible's own process notes say a chapter whose
contribution displaces existing methods opens by surveying them, and that "no lit review" bans
review-chapter padding, not positioning. This chapter's entire job is that move, at full scale,
seven times over (once per thread). The discipline that keeps a method chapter's three-sentence
survey from padding is the same discipline that has to hold across a chapter this size: find the
organising idea per section rather than listing sources, hold the payoff (this framework's
position) back until each survey has earned it, and end every subsection with a real forward
pointer to the chapter that goes deep, not a document-narration sentence about what comes next.

## Research protocol (the part the bible doesn't cover, because it was written for code)

- **Never write a claim about the literature from memory or from what feels generally true.**
  Search for it. This applies hardest to Thread 1 (comparable multi-analysis frameworks) and
  Thread 3 (comparable software delivery category): a claim that nothing comparable exists is
  only honest once you've actually looked, using the search terms in the gameplan as a starting
  point, not an exhaustive list.
- **Verify every citation at the publisher record**: it exists, and it says what the sentence
  cites it for. This is the single rule violated most often by paraphrase drift in every chapter
  this session, and it is more dangerous here, where every sentence is a citation.
- **Log what you found and rejected, not just what you kept.** For Thread 1 especially, a
  candidate framework that does two of the three analyses but not the third, or does all three but
  with no native imprecision handling, is exactly the evidence that makes the eventual claim
  defensible. Keep that log even for entries that don't make the final chapter text.
- **Prefer one strong survey or review source that can carry several claims at once** over a list
  of narrow single papers on the same point, the way Probability and Diamond both already do.
  Citation-dumping is its own form of the repetition law's failure: many sources paying for one
  meaning.
- **Recent references only where a sentence genuinely supports them.** Do not chase recency for
  its own sake. Every existing chapter leans on foundational, decades-old citations where the
  foundational result is what's being cited (Ford & Fulkerson 1956, Kelley & Walker 1959, Moore &
  Shannon 1956), and this chapter should too wherever the point is a foundational one.
- **State findings plainly, never hedge.** If a genuine search for Thread 1 or 3 comes back with
  nothing closely comparable, say so once verified, in one clean sentence, not softened into
  "appears to be limited" or "may not exist." If something close is found, state the actual
  boundary honestly rather than either dismissing it or overclaiming past it.
- **Never fabricate a comparator, a statistic about the field, or a citation.** If a claim needs a
  number ("X% of reliability tools require programming"), it needs a real source or it doesn't go
  in the chapter.

## Mathematical and technical claims that touch the framework itself

A few threads (2 especially) make claims about what the framework currently does and doesn't do.
Those claims follow the same rule every other chapter in this project has followed: check the
actual algorithm source, not a paraphrase, not the server layer (which is known to be stale
relative to the algorithms and due a rebuild), not memory of an earlier conversation. The
verification already done for Thread 2, that `CapacityAnalysisKit.jl`'s `analyze_all` is hard-typed
`Float64` with zero `Interval`/`pbox` handling in the file, is the model: open the file, read the
signature, grep for the type names, and only then write the sentence.

## Never hedge, generally

State what is true plainly and what is false plainly. If a search comes back thin, say so and say
what was searched. If an earlier note in the gameplan turns out to be wrong once you actually
look, say that too, with what you found instead. Report search results and verification outcomes
exactly as they are, not smoothed into something more confident-sounding.

## Mechanics

- Work in `Background_Chapter_v1/`, following the same standalone/maindoc scaffold every other
  chapter uses: `\ifdefined\maindoc` guards the preamble, `\newlabel` fallbacks resolve
  cross-chapter `\ref`s in standalone compiles (this chapter will need fallbacks for every chapter
  it cross-references, check the gameplan's outline for which those are). Give it its own
  `references.bib` in the folder; verified entries only.
- Figures, if any, are GraphViz dot sources in per-figure subfolders under `figures/`, no caption
  text or decorative labels in the dot, captions live in LaTeX. Compile dot via a short path (the
  Windows 260-character limit bites inside this OneDrive tree; copy to `$HOME` and compile there
  if a file won't open).
- Compile after every batch (pdflatex, biber for citation changes) and verify 0 errors, 0
  undefined-reference warnings. Then grep the tex for banned punctuation and terms.
- Write an `INTEGRATION_NOTES.md` in the folder when the chapter is in a state to hand back,
  following the pattern in every other chapter's folder: what to paste where in main.tex, what
  bib entries are new, a provenance table for every substantive claim (which source backs it), and
  an explicit list of what was searched for and not found, for Thread 1 above all.

## Boundaries

- **The live thesis tree is off limits.** Chapter work stays in `Background_Chapter_v1/`.
  Integration into the thesis is Temi's, via the chapter's `INTEGRATION_NOTES.md`, same as every
  other chapter. Note: as of 2026-08-19 the local mirror of the thesis tree
  (`Full thesis/thesis/`) is empty on this machine, an Overleaf sync state, not something to
  "fix" by writing into it.
- **Judgment calls that shape the thesis's actual argument are not yours to make silently.**
  Thread 1's outcome in particular decides how the thesis states its central novelty claim. If the
  search turns up a genuinely close comparator, that is not a finding to soften or bury, it goes
  back to Temi as a flagged decision, with the source, before the chapter text asserts anything
  about it either way.
- **Her standing notes and scripts are never edited.** Corrections to the gameplan or this
  handover go to her in conversation or in your own findings file, not as silent edits to files
  she wrote.
- **Commit nothing unless she asks.**

## What she's told me about how she likes this to run, this session

- She corrects fast and in shorthand; the substance underneath is precise even when the typing
  isn't. Read for intent, don't stall on phrasing, but if a branch is genuinely ambiguous, ask
  rather than guess, especially where the answer changes what gets built.
- She overrides efficiency-minded recommendations when they conflict with an institutional
  constraint she's relaying (her supervisor's expectation that this chapter exist as a dedicated
  chapter regardless of length overrode my own "fold it if it's short" framing outright). Treat
  a constraint she states as coming from her supervisor, or any named external party, as
  non-negotiable, not a preference to weigh against others.
- She wants the ground truth checked at the right layer, not the nearest convenient one. When she
  flagged that the front end and server are known to be stale relative to the algorithms, the
  right response was to go read the algorithm module directly, not the server handler that calls
  it. The same instinct applies here: when a thread's premise touches the framework itself, check
  the source that actually implements the claim, not the chapter text that describes it, not a
  summary of the chapter text.
- She wants honest scope statements over impressive-sounding ones. The Capacity toolkit's
  Float64-only limitation is not something to write around or minimise, it's a finding to state
  plainly and then frame against real literature (Thread 2's whole purpose).
- She wants everything traceable. A number, a claim about what exists or doesn't, a citation, all
  need a receipt she could follow herself, the same discipline as the trace scripts and code
  receipts every other chapter in this project has used for its own claims.
