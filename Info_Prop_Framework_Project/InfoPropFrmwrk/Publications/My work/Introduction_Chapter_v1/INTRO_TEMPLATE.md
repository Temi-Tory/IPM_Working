# Chapter 1 template, distilled from five real exemplar theses

Source material, all Strathclyde PhD theses, Chapter 1 (and, where relevant, the chapters either
side of it) read start to finish, not sampled:

1. **T15756** — Su Wang, "Wind Power Integration on Power System Reliability and Operating
   Reserve Capacity," 2020, Electronic and Electrical Engineering.
2. **T17086** — Adebayo Ojo, "Geometric Shape Parameterization and Optimization of Floating
   Offshore Wind Turbine Substructure within an MDAO Framework," 2024, Naval Architecture Ocean
   and Marine Engineering.
3. **Ding** — Jiansong Ding, "Optimisation of a Power Distribution Network's Active Power Loss
   and Reliability Performance," 2013, Electronic and Electrical Engineering.
4. **Cole** — Matthew Cole, "Investigation and Assessment of the Benefits For Power Systems From
   Wind Farm Control," 2023, Wind and Marine Energy Systems CDT.
5. **Raptodimos** — Yiannis Raptodimos, "Combination of Reliability Tools and Artificial
   Intelligence in a Hybrid Condition Monitoring Framework for Ship Machinery Systems," 2018,
   Naval Architecture Ocean and Marine Engineering.

Five theses, four different sub-disciplines, 2013 to 2024, different supervisors. The first two
converge tightly on one shape; the other three each do something structurally different from that
shape and from each other. That's the real finding: there is a firm set of *elements* every one of
them uses, but genuine variation in how those elements are packaged into chapters. Section "The
one real structural choice" below is the part this session first drafted, then had to walk back
after checking three more theses — worth knowing before you decide anything from this document.

This is Phase 1 only: the template itself. Phase 2, writing this thesis's actual Chapter 1 against
it, is a separate step once you've reviewed this.

---

## The elements that appear in every single one of the five

Regardless of how they're packaged into chapters, all five theses contain every one of these, in
this relative order:

1. **Motivation** — the funnel argument (see below), ending on a stated gap.
2. **Aim and/or Objectives** — what the thesis will do, stated as a checkable list or a short
   aim statement (or both).
3. **Contributions** — what's original, named explicitly.
4. **A roadmap of the thesis** — one passage per chapter, telling the reader what's coming.
5. **Publications** — a list, where the author has any to list.

None of the five treats a literature survey with citations-as-evidence for *prior methods* as
belonging in this material — that's a separate, later chapter's job in every one of them (their own
Chapter 2 or 3, matching this thesis's own Background chapter). None uses a per-paragraph
"this thesis differs from X" forward-pointer either; the "here's where this thesis sits" move is
reserved for wherever the roadmap element lives, once.

## The one real structural choice: how are these five elements packaged?

**Option A — one chapter holds all five** (T15756, T17086; Ding is a close variant of this, see
below). Motivation, Objectives, Contributions, Outline, and Publications are all subsections of
Chapter 1, in that order. This is the "skeleton" version, and it's what the rest of this document
mostly documents in sentence-level detail, because it's what two of the five do outright and what
a third does with one addition.

- **Ding's variant of Option A**: identical shape (1.1 through 1.6 map onto
  Motivation/Regulator-context/Objectives/Contributions/Structure/Publications), but adds a final
  **1.7 Summary** subsection, a short chapter-closing recap distinct from the Outline subsection.
  Worth knowing: in Ding's thesis (and in T15756's later chapters, which each end in their own
  "X.Y Summary"), ending a chapter with a brief summary is a recognised convention in its own
  right, separate from Chapter 1's specific Outline-of-thesis move. If later chapters in this
  thesis project already end on their own "Summary" subsections (check), Chapter 1 ending the same
  way would be consistent, not redundant with the roadmap subsection.

**Option B — Chapter 1 stays thin; Objectives moves later** (Cole). Chapter 1 is just Motivation,
Publications, and a "Summary of Thesis" that does double duty as both recap and roadmap. Two more
chapters (History/Context, then Background) build up the specific technical grounding before
"Aims and objectives" appears, as its own subsection inside the Background-equivalent chapter, not
inside the Introduction. This shape makes sense specifically when the motivation needs real
technical scaffolding (a whole chapter of "how does wind farm control work at all") before
objectives can be stated meaningfully — Cole's field required that scaffolding; whether this
thesis does depends on whether Background (already drafted) or Chapter 1 is the more natural home
for stating what the framework will do.

**Option C — Introduction and Aim/Objectives are two separate chapters** (Raptodimos). Chapter 1
is Motivation plus logistics only (1.1 Chapter outline, 1.2 domain motivation, 1.3 Thesis layout,
1.4 Chapter summary). Chapter 2 is titled "Aim & Objectives" outright, with its own Research
Question, Aim & Objectives, and Chapter summary subsections. Literature review is Chapter 3,
separately again. Notable new element here: **Chapter 1 opens on an explicit "chapter outline"
paragraph** (one short paragraph naming what 1.1/1.2/1.3 each cover, before 1.1 itself starts),
which none of the other four theses do — most open directly on the funnel's first sentence with no
meta-preamble at all. Treat the opening chapter-outline paragraph as a genuine third option, not
a default: it's a real thing one exemplar does, but the majority (4 of 5) just start the funnel
cold.

**What to take from this**: don't adopt Option A by default just because it's the version this
document originally drafted first. The real question is where this thesis's own Objectives belong
given what Background already covers. Background already carries the full field-level survey and
the honest novelty-gap statement (its Synthesis section). That argues for something closer to
Option A or Ding's variant — Background has already done the "technical scaffolding" job Cole's
Chapter 2/3 do, so there's no obvious need to delay Objectives into a later chapter the way Cole
does. But confirm that reading is right for this thesis specifically before committing; it's a
judgement call worth stating explicitly rather than defaulting into.

---

## Section 1: Motivation

**Purpose**: fund the reader's belief that the problem is real, specific, and unsolved, arriving at
one sentence that names the gap this thesis fills. Nothing here argues the thesis is good; it
argues the *problem* is real.

**Shape**: a funnel. Every exemplar opens at the widest possible frame (global energy crisis /
global climate emissions) and narrows one paragraph at a time until it reaches the exact technical
object the thesis works on. T15756's funnel: global energy crisis → power system reliability in
general → wind power's specific reliability problem → three named mechanisms by which wind hurts
reliability → the two existing solution families (interconnection, storage) → the specific gap
(capacity planning for storage-wind cooperation under reliability constraints hasn't been studied)
→ "this thesis will develop X." T17086's funnel: climate emissions → offshore wind broadly → fixed
vs floating foundations → floating's cost problem → design methodology (MDAO) as the lever → the
specific gap (nobody has integrated shape parameterization into the MDAO loop) → the aim.

**Paragraph-level pattern**: each paragraph does ONE of:
- state a fact about the field, cited, then narrow it slightly narrower than the paragraph before
  (the majority of paragraphs);
- survey 3-6 specific prior papers by name/number, one or two sentences each, stating what each
  one did and what it did or didn't solve (T15756 does this at length, paragraph after paragraph
  of "[25] showed X. [26] proposed Y for the purpose of Z. [27] took A and B as goals.");
- state the gap plainly, once, near the end: T15756's is one sentence ("Since the capacity
  planning of wind power and HPS cooperation systems based on system reliability requirements has
  not been fully studied, this thesis will develop the WP-HPS cooperation method..."), immediately
  followed by naming the exact subsection where that method is detailed.

**Sentence-level pattern**: plain declarative statements, citation attached to nearly every factual
claim (including simple ones — "There are two ways to utilize wind power: on-grid and off-grid
[6]" is typical density). Prior work is described by what it *did* and *found*, not editorialised
("[26] proposed a cooperative strategy... The simulation was performed using real-time data... the
results proved that..."). Numbered reasons appear inline when a claim has several parts ("first...
Secondly... Thirdly...").

**Length observed**: T15756 runs to about 13 pages / roughly 20 paragraphs; T17086's Overview runs
about 5 pages before splitting into Research Question. Scale to what the problem actually needs;
neither pads.

**Mapped to this thesis (a starting point, not the final wording)**: the funnel would run something
like — engineering-network analysis broadly (reliability, flow, schedule each independently
important, cite foundational sources per the pattern already established in Background) →
these three questions are usually asked separately with separate tools → the specific gap
Background's own research already verified (no tool combines all three with native imprecision,
pandapower shows the *architectural* pattern of multi-analysis-on-one-network exists elsewhere but
not this combination) → the one-sentence pivot ("this thesis develops a framework that...").
Background chapter's own Synthesis section is the ready-made source for that gap statement; this
section doesn't re-derive it, it restates it in the plainer, more direct register these exemplars
use and points forward to Background for the full case.

---

## Section 2 (optional): Research Question

**Purpose**: crystallise the funnel's endpoint into a single question the rest of the thesis
answers. Only T17086 does this as its own subsection; T15756 achieves the same thing with a single
sentence at the end of Motivation instead. Use as a separate subsection only if the question itself
needs unpacking (T17086's does: it states the question, then explains a structural/industry reason
*why* the question hasn't already been answered — floating-platform designers and turbine
manufacturers being separate entities, in their case).

**Sentence-level pattern**: one explicit question sentence ("The main question for this research
is determining how...") followed by 2-4 sentences of justification for why it's still open.

---

## Section 3: Aim / Objectives

**Purpose**: convert the gap into a concrete, checkable list of what the thesis will do. This is
the least prose-like section in the chapter — both exemplars switch to bullet points here, and
that switch itself is a signal to the reader that everything above was argument and everything
here is a commitment.

**Shape**:
- One short lead-in sentence naming the overall aim in prose (T17086's "Research Aim and
  Hypothesis" subsection) — optional but useful if the aim needs one sentence of its own before
  the bullet list.
- A bulleted or numbered list of objectives, 4-6 items in both exemplars. Every item starts with
  an infinitive verb: "To propose...", "To investigate...", "To improve..." (T15756); or an
  imperative: "Conduct a review...", "Develop an automated...", "Assess the impact..." (T17086).
  Pick one grammatical form and hold it for every bullet — both exemplars are internally
  consistent, never mixing forms.
- Each bullet is 1-3 sentences: the verb clause itself, then enough elaboration that the objective
  is checkable, not just aspirational ("To improve the probability-based simulation reliability
  assessment method of evaluating the reliability of the proposed power system containing wind
  power and HPS. The operating characteristics of wind power and HPS are different from those of
  CGUs, and the methods of reliability evaluation need to be modified according to these operating
  characteristics.").

**Mapped to this thesis**: objectives would likely track the framework's own major pieces — the
unified network object, the three propagation toolkits (reliability, flow, schedule) generic over
value type, the decomposition strategy, the delivery interface — each as one "To develop/implement/
evaluate..." bullet, matching however Diamond/Probability/Capacity/CPM/Front-End chapters already
frame their own individual contributions, so Chapter 1's objectives list reads as the sum of what
those chapters already establish, not a new invented list.

---

## Section 4: Contributions

**Purpose**: state, explicitly and by number, what is original. This is the one place in the whole
chapter where the thesis is allowed to say "this is new," stated as directly as anywhere in either
exemplar.

**Shape**: numbered items, "Contribution 1:", "Contribution 2:" etc. (T15756, three of them) or an
unnumbered bulleted list with the same effect (T17086, two long-form ones). Each contribution:
one sentence naming it, then 3-5 sentences of justification that follow a consistent micro-pattern:
**state what existing methods don't do → state what this thesis's version does instead → state
briefly why that matters.** T15756's Contribution 1 is a clean example: "unlike the CGUs, the
available power output needs to be changed according to the wind speed. Besides that, HPS is a
load in the pumping state and is a generator in the hydro state. It is also necessary to improve
the reliability evaluation for HPS-specific characteristics" — gap, then response, in two sentences.

**What's different from Motivation's prior-work paragraphs**: Motivation describes *other people's*
work in the third person ("[26] proposed..."); Contributions describes *this thesis's own* work in
the same register but now as the subject doing the acting ("this thesis develops...", "a new...
strategy is proposed..."). The shift from third-person survey to first-person-plural-implied
claim is what marks the section boundary, more than any topic sentence does.

**Mapped to this thesis**: the load-bearing gap Background's Synthesis already states (one network,
three analyses, native imprecision propagation, no-code local delivery) decomposes naturally into
3-4 contributions here, each taking one piece of that combination and stating it as its own
contribution with its own brief justification, mirroring exactly how T15756 splits "the reliability
evaluation method," "the cooperation strategy," and "the cost-benefit method" into three separate,
parallel contributions rather than one combined paragraph.

---

## Section 5: Outline of the thesis

**Purpose**: the one subsection whose entire job is document self-narration and forward-pointing —
everywhere else in the chapter (and everywhere in Background, per the fixes already made there)
that move is banned; here it's the point.

**Shape**: one paragraph per chapter, in chapter order, ending on the thesis's own final chapter.
Every paragraph opens with the chapter number as the grammatical subject: "Chapter 2 outlines...",
"Chapter 3 summarizes...", "Chapter 4 utilizes...", never "In the next chapter..." or "This thesis
will then...". Each paragraph is 3-6 sentences: what the chapter covers, in the order the chapter
itself covers it, ending on that chapter's own headline finding or purpose if it has one yet
(T15756's Chapter 6 paragraph ends "...effectively alleviate the negative impact... not only
ensuring reliable operation... but also effectively reducing the network loss," i.e. it previews
the chapter's conclusion, not just its topic list).

**Sentence-level pattern**: almost telegraphic compared to Motivation — short, declarative, verb-
first-on-the-chapter ("Chapter 2 outlines...", "Chapter 4 utilizes...", "Chapter 7 applies...").
No citations. No hedging. This is the most mechanical section in the chapter by design.

**Mapped to this thesis**: one paragraph each for the Model chapter, Input Module, Diamond, Background
itself, Probability, Capacity, CPM, the Julia package chapter, Front-End, and the Integrated Case
Study — in whatever the confirmed live chapter order turns out to be (per the Overleaf log:
Background=2, Model=3, Input=4, Diamond=5, Probability=6, Capacity=7, CPM=8, then 9 and 10/11 per
what's actually written for the Julia package/Front-End/case-study chapters).

---

## Section 6: Publications

**Purpose**: list papers already published or in preparation from the thesis's own work, per
university convention. Mechanical, bulleted, full citation per entry, no prose beyond the list
itself. Skip entirely if there are none yet; both exemplars only include it because they have
entries.

---

## Cross-cutting rules that apply to every section above

1. **Citation density stays high everywhere except Outline and the bullet lists.** Even simple
   factual claims carry a citation in Motivation. This matches the density standard already
   established for Background this session — nothing about Chapter 1 relaxes it.
2. **Prior work is reported, never editorialised, until Contributions.** "[X] proposed Y and found
   Z" — not "surprisingly, [X] failed to consider..." Motivation's job is establishing the field is
   real and the gap is real, not scoring points off individual papers.
3. **The gap-to-thesis pivot happens exactly once**, in one identifiable sentence at Motivation's
   end. Everything before it is field-survey; everything after it (Objectives onward) is
   commitment. Don't scatter "this thesis does X" claims earlier than that pivot.
4. **Grammatical consistency within a list.** Once Objectives starts with infinitives, every bullet
   stays infinitive. Once Outline starts naming the chapter as subject, every paragraph does.
5. **No banned punctuation carries over from the Background work**: no em/en dashes as sentence
   punctuation, no colon-heavy sentence-splicing, same repetition-law discipline throughout.

---

## Open questions for you before Phase 2 (writing) starts

- **Packaging (Option A / B / C above)**: which does this thesis's Chapter 1 follow? The
  Background-already-exists argument above points toward Option A or Ding's variant, but say so
  explicitly rather than leaving it implicit.
- **Chapter-ending Summary**: do other chapters in this thesis already end on their own "X.Y
  Summary" subsection? If so, Chapter 1 should probably match (Ding's pattern) rather than end
  cold after Publications (T15756/T17086's pattern).
- **Opening chapter-outline paragraph**: worth doing (Raptodimos's pattern) or not (everyone
  else)? Given the "no document self-narration" rule already enforced hard in Background this
  session, the 4-of-5 default (start the funnel cold, no meta-preamble) is probably the safer
  match to this thesis's established voice — flagging the alternative exists, not recommending it.
- **Research Question as its own move**: T17086 and Raptodimos both give it space (as a
  subsection or a chapter); T15756, Ding, and Cole fold it into a single pivot sentence at
  Motivation's end. 3-of-5 favours the single-sentence version; worth deviating only if this
  thesis's own question needs more unpacking than one sentence can carry.
- How many Contributions, and what should each one own? A first guess in the Contributions section
  above splits along the network-model / three-toolkits / decomposition / delivery seams already
  established elsewhere in the thesis, but you know the actual weighting of what's most original
  better than a guess from outside can.
- Confirm the actual final chapter order (the Overleaf log confirms 1-8 plus Front-End at 10; what
  sits at 9 and 11, and whether the Integrated Case Study chapter exists yet to describe in the
  roadmap element).
