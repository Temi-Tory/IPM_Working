# Writing bible — revising thesis chapters

Compiled from Temi's manual edits and instructions across the revision rounds (started on the
Diamond chapter, 2026-08-18/19). Every rule traces to an edit she made or a correction she gave.
**Applies to every chapter of the thesis.** Concrete examples below come from the chapter where
the rule was learned; the rule itself is general.

## Voice

- British PhD student, late twenties. Human, direct, measured. No flowery, promotional, or
  buzzwordy language. Never overclaim, never underclaim.
- The unit contract: **a sentence makes one point, a paragraph tells an arc, a section tells
  a clear story.**
- Being readable matters more than being short. The rules below are not about curt sentences;
  they are about not paying for the same meaning twice.

## Hard punctuation rules

- **Never** em dashes (`---`) or en dashes (`--`) as sentence punctuation. Compound terms
  (`series--parallel`, `fork--join`, `union--find`) and number/theorem ranges are fine.
- Colons and semicolons **very rarely** as sentence-splicers. A colon before a genuine
  elaboration is allowed occasionally; a semicolon almost never.
- No prose written as a comma'd list. An item list (`itemize`) is for genuine enumerations,
  not a way to dress up one point three ways.

## The repetition law

Repetition is measured in **meaning**, not words. Each meaning gets exactly one paying
occurrence. The recurring failure shapes, all cut during revision:

1. **Drumbeat then explain.** "The conjunction matters. [explanation]" → "The conjunction
   matters **because** [explanation]." Weld the claim to its reason with because/since/therefore.
2. **State, then restate as consequence.** "...was built with propagation in mind, and a node
   whose value settles its reachability needs no resolving, so identification filters it" says
   the exclusion twice. Say it once.
3. **Contrapositive echo.** Stating a definition and then its negative reading — the second
   sentence is the first one backwards. Cut it.
4. **Positive/negative pair.** "not hand-derived" + "is the output of the implementation" —
   one meaning, two sentences. Keep one.
5. **Gloss stacking.** Defining a case and then glossing it again. Fuse name, meaning, and
   number once: "any inactive node (i.e. unreachable with prior = 0)".
6. **Abstraction that needs decoding.** "declared value already settles its behaviour" is a
   euphemism for "prior probability is deterministic". Name the actual quantity; every vague
   wrapper invites another restatement in new words.
7. **Same point in neighbouring subsections.** One home per point, chosen where it does the
   most work.
8. **The classic-three tic.** Examples arriving in rhythmic triads (substation / process
   lines / duty pump) is a symptom of repeating one point. One example developed properly
   beats three shallow ones.
9. **Definition restated at point of use.** Don't unpack a defined term where it is used
   ("related to nothing at v" *is* what singleton means).
10. **Audit-trail asides.** "a configuration that real benchmark scenarios do use" — evidence
    for the writer's confidence, not for the reader's understanding. Cut.

## Sentences and transitions

- Transitions are **claims about the subject** that happen to move the reader forward, never
  claims about the document. Banned: "The chapter proceeds as follows", "Four definitions
  carry the chapter", "the subsections that follow justify...", "Seen against Section X...",
  roadmaps, content lists. Test: a sentence that would become false if the chapter were
  reorganised but the maths unchanged is narration.
- Name the actor. "IPF returns two views...", "The decomposition module consumes...". Not
  "It is returned..." or "There are two views...".
- Vary sentence shape and length. A run of "The X does Y." sentences reads as AI output even
  when each sentence is fine alone.
- No hand-wavy environments: Remark blocks become prose or die.

## Structure

- **Find the organising idea first**, then let the required points attach to it (reduce vs
  partition carried a whole section). Ticking requirements one sentence each leaves seams.
- **Hold the payoff back.** Name the chapter's central object at the end of the survey that
  motivates it, not in the introduction. Defer detail until the reader needs it.
- Definition environments only for objects that earn formality. Lightweight notions are
  derived **in prose** where they are used. Families of related concepts can run as
  **bold-lead paragraphs**, ordered so each transitions into the next, ending with the
  one-line relationship between them.
- Definitions state what an object **is** ("a subgraph of G whose relevant node set R
  spans..."), not a notation dump ("a triple D = (R, C, E)").
- Keep layers apart: every claim has one owning chapter, stated there and nowhere else. No
  value-level semantics in structural chapters (a justified exception is explicitly flagged);
  no implementation storage detail in concept chapters (the Julia chapter owns it). Cross-
  chapter dependencies are named hand-offs, never silently absorbed and never "validated
  rather than proved" cop-outs. Proofs are complete chains or explicit hand-offs, nothing in
  between. One sentence may point forward to the owning chapter, nothing more.

- A chapter whose contribution displaces existing methods opens by surveying them (for the
  propagation chapter: BDDs and conditioning/inference methods especially). "No lit review"
  bans review-chapter padding, not positioning (Temi, 2026-08-19, probability chapter round 1).
- Worked examples cover the machinery's full reach in one developed example (nested diamonds,
  supernodes, non-influencing parents together), not the minimal case. A draft that reads
  "summarised" needs each section developed into proper discussion, not compressed further.
- Analysis chapters carry their own applied case study with the domain interpretation (input
  provenance, discussion of what the results mean), and cost sections are complexity analysis
  proper, not a cost summary. (Same round.)

## Examples and figures

- One concrete example, developed, in the domain (distribution systems, process lines). No
  need to say the example is an instance of the concept — the reader just watched it be one.
- Figures: dot sources carry no caption text and no decorative labels; captions live in LaTeX
  and stay short; legible fonts (16–18pt in dot). Refer to subfigures as "Figure 3a" via
  `\ref`, never "panel (a)". Drop legend explanations the drawing makes obvious.
- Worked-example numbers are machine-verified against the implementation before they enter
  the text (a trace script per chapter, e.g.
  `validation/fresh_20260816/chapter_example_trace.jl`), and the text says so once.

## Technical claims

- Every claim must hold against **the code and the underlying theory** — check the source,
  not memory or paraphrases of memory. Paraphrase drift is how E∩V(E_D) became E∩R.
- Never fabricate an example quantity ("average hop latency" does not exist in this
  framework). If an example must be real, find one in the corpus or don't give one.
- Citations: verify each reference exists AND says what we cite it for, at the publisher
  record. Recent references only where a sentence genuinely supports them.
- Cross-chapter references by label (`Chapter~\ref{ch:input-module}`), never hardcoded
  numbers.
- Match quantifiers to what is proved: "at most k", "only if", "wherever unsettled
  reconvergence exists". If the proof gives one direction, the prose claims one direction.

## Proofs and maths prose

- Never "the procedure", "the tally", "was tested", "displayed intersection" — proofs use the
  actual objects ("the intersection $\infl(p,E)\cap\infl(q,E)$ is evaluated for every pair").
- Proofs are structured like academic proofs: concise, organised, technical but clear — not
  prose-heavy narration. Long "proofs" that read as discussion lose the proof label and stand
  as the section's prose under a subsection carrying the theorem.
- Theorems sit beside the prose that claims them, never cited in parentheses from afar, and
  the prose does not restate what the adjacent theorem says.
- Long propositions get a one-line prose setup before the statement, and the statement stays
  tight.
- Equations are described with a *where* clause ("where $\ED$ is..., $f$ its..., and ..."),
  never "X together with Y with Z" chains.
- Comparisons are direct: "is similar to X. While X depends on..., ours is..." — no "the
  mechanism is not the same" sentences, no re-citing where something was proved.

## Terminology

- Thesis-facing names may diverge from code (`identify_diamonds` vs `new_identify`). Each
  chapter keeps a fixed-terminology table; the thesis uses its own terms consistently and the
  code rename is a separate decision, tracked but never assumed.
- A code name may be given once, in parentheses, where the thesis term is introduced.

### Thesis-wide terms

| Use | Not |
|---|---|
| IPF (the framework) | IPA outside Chapter 5 (IPA = the propagation algorithm only) |
| input processing | ingestion |
| ancestry closures (collective) / ancestor closure (individual) | mixing the two |
| unified graph object | network object, data structure |

### Diamond chapter terms

| Use | Not |
|---|---|
| discriminator function(s) | predicate; "is_det" as a prose term (code name given once) |
| eligibility criterion / anchoring structure / membership criterion | restating what each discriminator is |
| fixed context | conditioning context |
| influencing set | (unconditioned) influence set |
| non-influencing set | non-diamond parents (code name, may be given once) |
| maximal diamond (per-join aggregate incl. non-influencing edges) | root diamond |
| sub-diamond / nested diamond | — |
| induced diamond (all paths from one fork, one diamond join) | atomic diamond |
| overlapping diamonds (shared fork) | diamonds sharing a fork |
| `unique_subgraphs` (the store field on the graph object) | `unique_diamonds` (code dict name) |
| unique diamond object (the stored entry) | DiamondComputationData, subgraph_unit |
| `is_maximal` (the flag marking maximal diamonds) | `is_rootDiamond` (code field); `root_diamonds` is never referenced in the thesis — the flag discriminates |

## Process

- Temi's fresh rewrites are not to be re-voiced ("AI-ified"). Only mechanical and factual
  fixes on her text: typos, wrong digits, broken refs — each one flagged.
- When she restructures or re-words one section, that treatment is the **template for the
  remaining sections** — apply it throughout without waiting for per-section notes.
- When she names a term or a rename explicitly, apply it everywhere, first time. Reread her
  notes before claiming a round complete.
- IDE diagnostics go stale mid-batch — verify against the file (grep) before "fixing" a
  reported duplicate or missing label.
- Each chapter lives in its own folder (`Diamond_Chapter_v2/`, `CPM_Chapter_v1/`,
  `Model_Chapter_v1/`, ...) with the standalone/maindoc scaffold: `\ifdefined\maindoc`
  guards the preamble, and `\newlabel` fallbacks resolve cross-chapter refs in standalone
  compiles. Figures are dot sources in per-figure subfolders under `figures/`; compile via
  short paths (Windows 260-char limit; OneDrive can make a file unreadable to dot — copy to
  `$HOME` and compile there).
- Thesis integration is Temi's, per each chapter's `INTEGRATION_NOTES.md`. Never touch the
  thesis tree.
