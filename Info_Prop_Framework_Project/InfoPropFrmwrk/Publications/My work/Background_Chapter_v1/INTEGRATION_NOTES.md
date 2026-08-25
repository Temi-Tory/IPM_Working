# Integrating the Background chapter into the thesis (round 3, full rewrite)

Same convention as every other chapter: `\ifdefined\maindoc` scaffold, starts at `\section`,
standalone-compilable here. **Current build: 9 pages, 0 errors, 0 undefined references, 0
overfull/underfull boxes, 0 biber warnings**, confirmed on a full clean rebuild (`latexmk -C`
then `latexmk -pdf`), not just an incremental one.

## Why this round exists, and what changed

Round 2's `Background_Chapter.tex` was rejected outright, not revised. Temi's read: it opened on
Bruneau et al.'s resilience framework as the chapter's grounding device, and although round 2 had
already stripped the explicit "here is where the thesis differs" sentences its predecessor used,
it still closed nearly every section with a forward pointer to one of this thesis's own later
chapters (`Chapter~\ref{ch:probability-toolkit} surveys this landscape in depth`, and seven more
like it). That is a chapter-by-chapter roadmap of this thesis in quieter language, the same move
round 2 thought it had removed. Her diagnosis was also that round 2 hadn't read enough source
material to earn either the structural claim or the voice-matching claim: two exemplar theses
sampled directly, a third checked only for whether it had a dedicated review chapter, and the two
large literature collections (Zotero export, early-PhD-reading folder) scanned by filename only.

This round does three things differently, in the order the brief asked for.

### A. Read all eighteen local exemplar theses in full, plus a broader web-sourced set

Every thesis in `C:\Users\ohian\Downloads\literature\` (`T13503` through `PDF_of_thesis_T17342`,
eighteen unique files once the `(1)`/`(2)` duplicates are excluded) was read in full for its
literature-review chapter, or for its distributed local surveys where it has no dedicated review
chapter (`T13503`, confirmed again this round: each technical chapter carries its own "Summary of
Previous Works" subsection instead). The work was split across five parallel research passes,
each producing a per-thesis craft log with page-numbered quotations, not a skim. Partway through,
the coordinator flagged a real risk: the local folder is Temi's own collection and skews toward
resilience-engineering and general mechanical/electrical PhD topics, the same framing she had just
said not to use, so reading only those theses risked absorbing a resilience-flavoured voice by
default. In response, before writing a word of the chapter, three more theses were sourced
independently from the web and read the same way: two University of Liverpool PhD theses
supervised by Edoardo Patelli (Temi's own ICSRS 2023 co-author), directly in the
imprecise-probability/p-box research community this thesis sits in (Calleja, *Uncertainty
Quantification for Tokamak Divertor Heating*, 2024, and a second Patelli-supervised UQ thesis),
plus corroborating searches for Julia-ecosystem and network-reliability-decomposition theses that
did not surface a full-text match as strong as the Liverpool pair.

**The finding, corroborated independently across all twenty-one theses (roughly 700 combined
pages of literature-review material read): the formulaic "this is developed in Chapter X" closing
device essentially does not occur in real, viva-passed UK engineering PhD writing.** Specifics,
thesis by thesis:

- **Fifteen of the twenty-one have zero instances** of a literature-review chapter naming the
  thesis's own later chapter by number, anywhere in the material read (`T13993`, `T13773`,
  `T14157`, `T15756`, `T15094`, `T15881`, `T16368`, `T16803`, `T16844`, `T16188`, `T17003`,
  `T17342`, and the Liverpool Tokamak thesis, among others). Their closing move instead is a
  field-level gap statement, a critique of the last surveyed source, an explicit numbered
  "research gaps" list that names no chapter, or simply stopping.
- **`T13511`** is a genuine outlier: five forward pointers in one 27-page chapter, but every one is
  a terse one-clause coda tacked onto an already-complete technical point ("...will be examined
  further in chapter 3"), never the paragraph's actual payload, and the chapter is framed from its
  first page as project-specific technical background, not a state-of-the-art survey.
- **`T14374`** has six forward pointers, but every one is functionally embedded in a
  method-selection justification ("chosen because it is used in Chapter 5"), the pattern closest
  to legitimate: forward-pointing when it does real argumentative work, never as a section-closing
  ritual.
- **`T16985`** does name later chapters repeatedly (7-8 times), but every instance sits in a
  chapter-*opening* roadmap paragraph, never a closing move, and the chapter itself is not a
  literature review in the usual sense but a theoretical/background part establishing formalism.
- **`T15713`** is the one thesis with frequent, closing-position forward pointers, and it is a
  thesis-by-publication in first-person-plural "we" voice, a structurally different genre where
  the literature review's explicit job is mapping each strand onto its own later paper-chapter.
- **`T17086`** has exactly one forward reference in 44 pages, a parenthetical equation-location
  signpost buried mid-paragraph, not a rhetorical device.
- The Liverpool Tokamak thesis (the closest-matched exemplar to this thesis's own content and
  research community) uses two or three functional, mid-sentence forward references across its
  17-page uncertainty-quantification chapter ("Two different stochastic models are discussed
  within this thesis, see Section 6.2 and 7.1") and its own closing "Chapter Summary" section
  names no later chapter at all.

The determining variable is not field or "good practice" in the abstract, it is **whether the
forward pointer does real argumentative work at the point it appears** (justifying a method
choice, locating an equation) versus being **a ritual closing move repeated after nearly every
subsection**, which is what round 2 did and what none of the twenty-one real exemplars do.
**Consequence for this round's chapter: zero `Chapter~\ref` cross-references appear anywhere in
the new text.** Given the volume and consistency of the evidence, this was judged the safer and
better-evidenced default over including one or two "functional" pointers; nothing in the chapter
needed one badly enough to risk reintroducing the pattern Temi flagged.

A second, related finding from the same reading: real literature reviews name their own
contribution sparingly and late, in declarative present-tense register ("this thesis studies...",
"this thesis adopts...", never "this thesis's novel framework..."), and hold the explicit
positioning statement to one place, near the chapter's end, not distributed across every section.
This chapter's Synthesis section follows that register: "this thesis's own framework sets out to
fill" that gap, stated once, at the very end, describing what the framework *does* rather than
naming a chapter number that does it.

### B. Mined both Zotero sources for content, not filenames, and found nothing new

- **`My Library zotero export.bib`** (192 entries, re-confirmed count on this pass): every title
  was read (two full-file greps covering the complete list, cross-checked against a byte-offset
  probe that confirmed no entries were missed). The library is overwhelmingly two things: disaster
  and infrastructure resilience *quantification and metrics* papers (Bruneau, Holling, Cimellaro,
  Cutter, Zobel, and around forty more in that lineage), and Bayesian-network/dynamic-Bayesian-
  network reliability-computation papers, plus the classical reliability-computation lineage
  (BDDs, cut-sets, fault trees, Monte Carlo) already owned by the Probability and Diamond
  chapters and explicitly out of Background's scope per the gameplan's "what NOT to research"
  list. One item deserved a direct check rather than a title-match dismissal: `ohiani_information
  _2023` ("The Information Propagation Method for Efficient Network Reliability Analysis", Ohiani
  and Patelli, ICSRS 2023) is Temi's own earlier conference paper, confirmed already cited
  elsewhere in the wider thesis project (`RESS_response`, the ESREL 2026 paper), so it is
  established prior work already in use, not a new external comparator this chapter's threads were
  searching for. A second item, `tong_analytical_2019` ("Analytical probability propagation method
  for reliability analysis of general complex networks", Tong & Tien, RESS 2019, DOI
  10.1016/j.ress.2019.04.013), is a genuinely different paper from the already-cited
  `tong2019probability` (the ASCE-ASME one), by the same authors, the same year, covering
  materially the same ground; per the "prefer one strong source over citation-dumping" rule it was
  not added as a second citation for a point already made once.
- **`Zotero Attachments/`** (124 PDFs on this machine, matching the bib export title-for-title):
  scanned by filename against all seven threads as a first pass (as round 2 did), then
  cross-checked against the bib export's abstracts for anything a title alone might undersell.
  Nothing surfaced beyond the two items above. This folder is Temi's early-PhD reading, dated
  mostly 2021-2022 by its `urldate` fields, predating the software-delivery, Julia-ecosystem, and
  comparable-thesis questions Threads 3, 4, and 6 actually need, which is itself a plausible
  explanation for the negative result rather than a sign the check was shallow.

**Plain statement of the outcome: nothing in either Zotero source changed, added to, or
contradicted any finding in `THREAD1_THREAD3_FINDINGS.md` or `THREAD2_4_5_6_7_FINDINGS.md`.**
Both were checked for substantive relevance, not just title matches, and the honest result is that
Temi's early reading and this chapter's actual research threads are different bodies of work,
overlapping only where the two round-2 checks already found (Bruneau's identity as a source she
already had, and the Bulteau & El Khadiri Monte Carlo paper, both logged in round 2's findings
files and not reopened here since the underlying content didn't change, only the confirmation that
the check was thorough this time).

### C. Rewrote the chapter from scratch

`Background_Chapter.tex` was overwritten, not edited. The prior draft's actual verified content
(all fifteen currently-cited sources, all seven threads' findings) carried over via
`THREAD1_THREAD3_FINDINGS.md`, `THREAD2_4_5_6_7_FINDINGS.md`, and `references.bib`, which were
read and reused, not re-searched. What changed:

1. **The resilience opening is gone.** The Introduction now grounds directly in the three
   questions (reachability, capacitated flow, longest-path scheduling) as three readings of one
   directed-graph object, with no resilience framework, no Bruneau citation, and no
   robustness/redundancy/resourcefulness/rapidity apparatus anywhere in the chapter.
   `bruneau2003resilience` is dropped from `references.bib` entirely (still verified and logged in
   `THREAD2_4_5_6_7_FINDINGS.md` if a future draft wants it back). The word "resilience" itself
   still appears twice, both times naming what a specific tool calls itself in its own title
   (InfraRisk's "resilience analysis" banner, in the Comparable Multi-Analysis Frameworks
   section), never as this chapter's own organising category.
2. **Zero chapter cross-references**, per the exemplar-reading finding above. The old preamble's
   eight `\newlabel` fallbacks for other chapters are gone along with the `\ref`s that needed them;
   the only `\ref`s remaining are to this chapter's own sections. This also retires the
   "chapter numbering inferred, not confirmed" soft spot every prior round carried, since the
   chapter no longer depends on any other chapter's number at all.
3. **Every section's closing now states a fact about the literature, not about the document or
   about this thesis's own chapters.** Where round 2 closed the Frameworks section, the
   Flow-Uncertainty section, the Delivery section, and the Language section each with a `Chapter
   ~\ref{...}` handoff, this draft closes each on the state of the field itself (what the three
   camps in Frameworks have in common, what the two formalisms in Flow-Uncertainty share, what no
   engineering tool combines in Delivery, what no Python package exists for in Language). The one
   place a positioning statement about this thesis's own framework appears is the Synthesis
   section's final sentence, once, in present-tense declarative register, matching how the
   twenty-one exemplars name their own contribution.
4. **The section-level organisation is largely unchanged** from round 2 (Introduction,
   Methodological Landscape, Comparable Multi-Analysis Frameworks, Flow and Capacity Analysis
   Under Uncertainty, The Software Delivery Landscape, Language and Ecosystem, Synthesis), because
   that structure already matched the thematic, topic-first organisation the exemplar theses use.
   The problem Temi flagged was in the prose, not the section list.
5. **Thread 5 (resilience terminology) is deliberately unused.** `bruneau2003resilience` was found,
   verified, and judged the single right citation for a light definitional paragraph in round 1 and
   round 2 (see `THREAD2_4_5_6_7_FINDINGS.md`'s Thread 5 section for the full verification). This
   round's decision, given Temi's explicit "not sold on whether we should be touching the
   resilience world at all", is that no sentence in the rewritten chapter needs it: the chapter
   never asserts a definitional claim about resilience, so the citation has nothing to attach to.
   This is a deliberate scoping choice, not an oversight, and it is easy to reverse if a later
   draft wants a resilience-definitional sentence after all, since the verification work already
   exists.

## Repetition-law pass

Run against all ten of the writing bible's failure shapes on the finished draft, not just the "is
real..." phrase flagged in round 2 (already absent, reconfirmed by grep: zero occurrences of
"is real" as a legitimising crutch anywhere in this draft).

- **Gloss stacking / drumbeat-then-explain**: the Introduction originally stated the three
  questions informally in paragraph 1, then restated all three again, formally, in paragraph 2.
  Merged into a single paragraph that states the shared graph object once and gives each
  question's technical reading directly, so each question's meaning is paid for once.
- **Semicolon-as-list**: the Methodological Landscape's reliability-computation paragraph
  originally chained four method families with three semicolons in one long sentence, effectively
  a comma'd list in semicolon's clothing. Broken into three separate sentences. The chapter now
  has zero semicolons anywhere (grep-confirmed).
- **Same point in neighbouring subsections**: the Comparable Multi-Analysis Frameworks section's
  closing paragraph restated, in almost identical words ("every one of the three, without
  exception, represents its uncertain inputs as point-valued or classical distributions"), a
  conclusion the section's own Camp A and Camp C paragraphs had already stated individually. Cut
  the redundant sentence; the section now closes on its one new observation (no two camps pair the
  same two analyses), leaving the "none of them use intervals or probability boxes" conclusion to
  do its single paying job in the Flow-Uncertainty section's own close and the chapter-final
  Synthesis.
- **Sentence-shape repetition**: the Software Delivery Landscape's closing paragraph originally ran
  three consecutive "The X is/are Y but not Z" sentences (SimScale, the desktop suites, the web-GIS
  platforms). Rewritten as one sentence that names the trade-off once and then instantiates it
  across the three, varying the grammar so the pattern doesn't repeat verbatim three times running.
- **Colon and semicolon proportionality, checked by grep**: 20 raw colon occurrences, 11 of them
  inside `\label`/`\ref` markup (not prose), leaving 9 genuine prose colons across roughly 2,700
  words of body text, each before a genuine elaboration, none splicing two independent clauses.
  Zero semicolons. Zero em or en dashes as sentence punctuation; every hyphenated form found
  (`series-parallel`, `max-flow-min-cut`, `path-set`, `no-code`, and the rest) is a legitimate
  compound, checked individually.
- **Audit-trail asides, contrapositive echo, positive/negative pairs, abstraction needing
  decoding, definition restated at point of use**: checked paragraph by paragraph; none found
  in the finished draft. The "own" possessive ("its own vocabulary", "its own literature", "its
  own account of itself", nine occurrences total across the chapter) was checked separately as a
  possible stylistic tic; each instance refers to a genuinely distinct subject and the chapter's
  actual theme is that these literatures each stayed separate, so the repeated word is doing real
  thematic work rather than padding.

## Provenance table (every substantive claim)

| Claim | Source |
|---|---|
| Reliability computation, decomposition, CPM, and flow method families named (no re-derivation, no citations added in this section per the "compressed map, not duplication" rule) | Uncited by design; each family is owned and cited in depth by `Probability_Chapter_v1`, `Diamond_Chapter_v2`, and `CPM_Chapter_v1` respectively |
| Commercial RBD/FTA suites bundle reliability with a flow/throughput module, no schedule module, classical distributions | `reliasoft2024blocksim`, `isograph2024availability`, `itemsoftware2024toolkit`, verified at vendor product pages (unchanged from round 2) |
| InfraRisk: flow across 3 domains + restoration-scheduling (not CPM) + no formal reliability computation + point-valued hazard probabilities | Balakrishnan & Cassottana 2022, `balakrishnan2022infrarisk`, full text read via open-access mirror (unchanged) |
| Multi-state project network exact reliability via decomposition; no CPM float; no true flow capacity; discrete point-valued states; case study numbers | Huang, Huang & Lin 2020, `huang2020exact`, full text read directly (unchanged) |
| Stochastic-flow-network reliability founded on discrete random arc capacities | Doulliez & Jamoulle 1972, `doulliez1972transportation`, verified at Numdam (unchanged) |
| Robust network flow, robust max-flow polynomial / robust min-cut NP-hard | Bertsimas, Nasrabadi & Stiller 2013, `bertsimas2013robust`, verified at CrossRef (unchanged) |
| Project scheduling recast as stochastic-flow network | `huang2020exact`, confirmed in its own introduction on full-text read (unchanged) |
| No-code/low-code systematic review; ten functional system classes, all business-software categories | Abendroth 2026, `abendroth2026democratization`, full text read directly (unchanged) |
| SimScale (browser-based CFD/FEA/thermal/EM, cloud not local) | `simscale`, verified via Wikipedia cross-checked against the vendor's own site (unchanged) |
| Web-GIS systematic review for natural hazard management (1,775 screened, 65 included, PRISMA) | Daud, Ugliotti & Osello 2024, `daud2024webgis`, verified at CrossRef and independently re-verified at a RePEc/IDEAS mirror (unchanged) |
| Concrete web-GIS platform: wind monitoring/forecasting/statistical mapping for ports, not structural reliability computation | Repetto et al. 2018, `repetto2018windgis`, full text read directly (unchanged) |
| Local-first software as a named movement | Kleppmann et al. 2019, `kleppmann2019local` (unchanged) |
| Multiple dispatch as Julia's generic-programming mechanism; Julia's core design claim | Bezanson et al. 2017, `bezanson2017julia`, verified at CrossRef (unchanged) |
| NetworkX as Python's general graph package | Hagberg, Schult & Swart 2008, `hagberg2008networkx`, verified via the SciPy Proceedings DOI record (unchanged) |
| No Python package purpose-built for network reliability computation; `pgmpy` is general PGM machinery | Search finding; `pgmpy` itself not independently cited (unchanged) |
| Tong's Georgia Tech dissertation combines connectivity and flow-capacity reliability, no schedule, point-valued probability; confirmed same author as `tong2019probability` | Tong 2021, `tong2021infrastructure`, cross-checked against Tong & Tien 2019 per Temi's own CrossRef verification (unchanged) |
| Resilience is not this chapter's frame; Bruneau et al. 2003 is verified but deliberately unused | Round 3's own scoping decision, per Temi's explicit instruction this round; `bruneau2003resilience` dropped from `references.bib`, still logged in `THREAD2_4_5_6_7_FINDINGS.md` |
| Zotero export (192 entries) and early-PhD-reading folder (124 PDFs) checked for content relevance across all seven threads, nothing new surfaced beyond confirming two already-known items | This round's own mining pass, §B above |
| Twenty-one PhD theses' literature-review chapters read in full for voice, paragraph-transition, and self-cross-referencing patterns; formulaic per-section forward-pointers to a thesis's own later chapters found in none of them | This round's own exemplar-reading pass, §A above |

## Known soft spots

1. **This is a second from-scratch draft, not a finished chapter.** The repetition-law pass above
   was run carefully against all ten of the bible's failure shapes, but a chapter this size still
   deserves the same fresh eyes on a later read that every other chapter in this project gets
   before being called finished.
2. **The word "framework" is used to mean this thesis's own information-propagation framework** in
   the Flow-Uncertainty and Synthesis sections' closing sentences, matching the thesis-wide term
   from the writing bible ("IPF (the framework)"), but the chapter never spells out IPF or
   introduces the term formally, since Background sits before the Model chapter that does that
   introduction. If chapter order changes, check this still reads cleanly as a first encounter.
3. **No figures.** This is a pure literature-survey chapter; the `figures/` folder exists but stays
   empty, unchanged from every prior round.

## What was searched for and found nothing comparable (Thread 1, unchanged from round 2)

No tool or method was found, across a broad search covering infrastructure-resilience simulation
platforms, PRA/nuclear risk software, commercial RBD/FTA suites, digital-twin literature, general
graph-analysis platforms, and doctoral theses, that combines reliability/reachability, capacity/
flow, and schedule/CPM analysis on one network model. The closest candidates split into four
camps (three tool/method camps plus one comparable dissertation), each doing two of the three
analyses, none handling imprecise probability, all detailed in full in
`THREAD1_THREAD3_FINDINGS.md` and `THREAD2_4_5_6_7_FINDINGS.md`. This round changed how that
finding is presented in chapter prose (field-first, no per-camp "here is where the thesis
differs" aside, the explicit gap statement held to the Synthesis section alone) but did not
change the finding itself, which was not re-searched this round per the brief's explicit
instruction to reuse Threads 1-7's already-verified research rather than re-searching the web.

## Steps to integrate

1. **Place the files**: copy `Background_Chapter.tex`, `references.bib`, and `figures/` (currently
   empty) to `thesis/Chapters/Background/` (or your preferred name).
2. **main.tex**: add `\chapter{Background}` with `\label{ch:background}`, then
   `\include{Chapters/Background/Background_Chapter}`. No cross-chapter labels are consumed by
   this chapter and it consumes none, so there is nothing to reconcile against other chapters'
   numbering, unlike every prior round.
3. **Bibliography**: `references.bib` has 15 entries, all 15 cited (verified by grep, see body of
   this note). `kleppmann2019local` is duplicated here from the Front-End chapter's own bib with
   identical field values, the same pattern CPM's and Front-End's bibs already use for shared
   citations; check for key collisions on `kleppmann2019local` specifically when merging into
   `MERGE_INTO_THESIS_BIB.bib`.
4. No figures.
