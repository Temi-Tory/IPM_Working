# Background / Literature Review — research gameplan

Drafted 2026-08-19, revised same day after Temi's first round of notes. Purpose: map what every
other chapter already grounds in literature (so the Background chapter never re-litigates it),
think through what a PhD-level literature review chapter needs to cover given this thesis's
actual content, and name concrete research threads with search targets. Nothing here is a
chapter draft.

## 0. The decision, settled

Round 1 treated keep-vs-fold as open. It isn't: her supervisor's expectation is a dedicated
literature review / background chapter, regardless of how much the method chapters already
ground locally. **Kept, standalone, and sized like a real literature review chapter** — the
"fold into the intro if it shrinks below ~8 pages" clause in `Model_Chapter_v1/CHAPTER_PLAN.md`
no longer applies; a chapter built to the outline in §2 runs closer to 15–20 pages.

## 1. What a thesis literature review chapter needs to do here

A method-chapter-local survey (what Diamond, Probability, CPM each already have) proves command
of *that chapter's* technique. A literature review chapter proves something different: that the
candidate has surveyed the *field* the thesis sits in, positioned the contribution against real
alternatives, and shown the gap the thesis fills was actually looked for, not assumed. Four
things follow from that distinction, given what this thesis actually contains:

- **A compressed methodological map still belongs here**, even though every technique is grounded
  in depth in its own chapter. An examiner reading only this chapter should come away knowing the
  landscape of network reliability computation, decomposition strategies, scheduling under
  uncertainty, and flow analysis exists and roughly how it's shaped, with each subsection ending
  in an explicit forward pointer to the chapter that goes deep. Summary, not duplication.
- **The comparative positioning has to be real**, not asserted. The thesis's central claim, one
  DAG, one decomposition, three analysis toolkits, native imprecise-probability propagation
  across the toolkits that support it, is a strong claim precisely because it's a claim about
  what *doesn't* exist elsewhere. That has to be checked, and the check has to be visible in the
  chapter.
- **The delivery model is part of the contribution**, not an afterthought bolted onto a Front-End
  chapter. A no-code, local-first web interface over this analysis stack is itself a positioning
  claim (nothing else does structural + quantitative + imprecision-aware analysis in one visual,
  local tool) and belongs in the field-level chapter at the category level, distinct from and
  broader than the specific software citations Front-End already carries locally.
- **The implementation language is a defensible choice, not a footnote**, given how much of this
  framework's design (one propagation mechanism, generic over three value types via Julia's
  multiple dispatch) actually depends on it. That argument deserves a literature-backed home.

## 2. Proposed outline of the chapter (for sizing and gap-mapping, not final)

1. The problem domain — infrastructure and process-network reliability/resilience, briefly:
   what "resilience" means in this literature, why source-to-node reachability under component
   failure is a legitimate formalisation of it. Light (Gap 3).
2. The methodological landscape, compressed — reliability computation approaches, decomposition
   strategies, scheduling under uncertainty, flow/capacity analysis, each a short subsection
   ending "...examined in depth in Chapter~X." (Gap 3 continued + the thin end of Gap 2.)
3. Existing multi-analysis / integrated frameworks — the comparative positioning (Gap 1, still
   the load-bearing thread).
4. Flow and capacity analysis under uncertainty, in more depth than §2's summary, because the
   framework's own Capacity toolkit does NOT propagate imprecision (verified 2026-08-19 against
   `CapacityAnalysisKit.jl`, not just the server — see §3 Gap-2 note) and that boundary needs a
   real landscape to be framed against (Gap 2).
5. The software delivery landscape for this class of interface — no-code/low-code engineering
   analysis tools, local-first architecture, at the category level (Gap 4, expanded per her note).
6. Language and ecosystem — Julia versus Python (and R where relevant) for graph, reliability,
   and imprecise-probability computation, and why the framework's type-generic design leans on
   Julia specifically (Gap 5, expanded per her note; must sit above, not repeat, the Input
   chapter's Graphs.jl-vs-custom-object comparison).
7. Comparable theses — a short positioning paragraph, not a section on its own (Gap 6).
8. Synthesis — the gap this thesis fills, stated once. Distinct register from the Model
   chapter's own closing "three problem statements": this is a claim about the *literature*,
   the Model chapter's is a claim about the *model*. Keep them from reading as the same move
   twice.

## 3. Coverage map — what each chapter already owns (unchanged from round 1, still binding)

| Chapter | What it already covers, with citations |
|---|---|
| **Model** (`Model_Chapter_v1`) | Interdependent infrastructure systems, one citation (`ouyang2014interdependent`). Thin by design. |
| **Diamond** (`Diamond_Chapter_v2`) | Decomposition as a strategy, thoroughly: series-parallel reduction, factoring theorem, polygon-to-chain (`satyanarayana1985linear`, `satyanarayana1983factoring`, `wood1985polygon`, `moore1956reliable`, `page1988practical`), treewidth (`robertson1986graphminors`, `goharshady2020treewidth`), BDD canonicity (`bryant1986graph`), hash-consing (`ershov1958programming`, `filliatre2006hashconsing`), interdependent-infrastructure framing (`ouyang2014interdependent`, `buldyrev2010cascade`), a reliability survey (`perez2018sixty`). |
| **Probability** (`Probability_Chapter_v1`) | Full survey subsection: RBD/FTA (`billinton1992network`, `xing2008fault`), path/cut-set + recursive decomposition (`liu2012improved`, `kim2013network`), Monte Carlo (`fishman1986comparison`), BDDs (`bryant1986graph`, `rauzy1993new`, `bryant2002ordered`), cutset conditioning/junction tree/dPrPm (`pearl1988probabilistic`, `lauritzen1988local`, `tong2019probability`), imprecise probability and Fréchet–Hoeffding (`ferson2003constructing`, `williamson1990probabilistic`), #P-hardness (`valiant1979complexity`, `ball1986computational`). |
| **CPM** (`CPM_Chapter_v1`) | Classical CPM/PERT origin (`kelley1959critical`, `malcolm1959pert`), interval-valued activity time complexity/criticality (`chanas2002complexity`, `chanas2003planar`, `dubois2005floats`, `fortin2010criticality`), max-plus algebra (`baccelli1992sync`), series-parallel digraph recognition (`valdes1982seriesparallel`). |
| **Capacity / Flow** | Thin: `ford1956`/`ford1962` (Ford–Fulkerson), `birnbaum1969` (importance-measure analogy). No survey of flow-network reliability, no positioning against other flow toolkits, no literature on capacity under uncertainty. Confirmed algorithm-level scope 2026-08-19 (§3 note below). |
| **Front-End** (`UI_Chapter_v2`) | Last-mile problem (`hannay2009scientists`, `prabhu2011survey`), visualisation-only tools (`bastian2009gephi`, `shannon2003cytoscape`), the imprecise-probability software ecosystem (`opencossan2018`, `ferson2019pbar`, `gray2021pbajulia`, `gray2022pba`), local-first (`kleppmann2019local`), cloud custody risk (`hashizume2013analysis`). Narrow and software-specific, not a category-level survey — Background's §2.5 sits above it. |
| **Input Module** | Not currently accessible on disk (thesis-tree mirror empty, see note below); from an in-session read, it has its own "Why not Julia's Native Graph Object?" comparison against `Graphs.jl`/`MetaGraphs.jl`/`NamedGraphs.jl` with a brief `NetworkX` mention, at the package-internals level. Background's §2.6 must sit above this (language-level, not package-internals-level) or it duplicates. |
| **Julia package** (ch 9, not yet drafted) | Unknown. Overlaps §2.6 below; split to be decided once ch. 9 is planned. |

**Verified 2026-08-19 (algorithm-level, per Temi's instruction to check the actual code rather
than the server):** `InfoPropFrmwrk/src/Algorithms/FlowCapacity/CapacityAnalysisKit.jl`, the
active capacity module, declares its public entry point `analyze_all` with
`capacities::Dict{Tuple{Int64,Int64},Float64}` and
`node_capacities::Union{Dict{Int64,Float64}, Nothing}` — no `where T` type parameter, no
`Interval`/`pbox` handling anywhere in the file (grep confirms zero occurrences). This matches
what the Input Module chapter already states in its input-contracts section ("capacity in this
work is not uncertainty-polymorphic and only handles fixed values," from the same in-session
read). **So Gap 2's premise is confirmed at the algorithm level, independent of the known server
staleness** — the FE/server rebuild she's planning will need to correctly *reflect* this
boundary, not remove it, since the underlying algorithm genuinely has no imprecision path for
capacity today. This is a current, real, and honestly-stated scope choice, not a bug.

Note: the thesis-tree mirror (`Full thesis/thesis/`) is empty on this machine (an Overleaf sync
state). The Flow chapter and Input Module chapter citation summaries above are from in-session
reads; re-verify against the live files once the sync is restored, and re-check this table
against whatever changes when the server/FE rebuild lands.

## 4. Research threads

### Thread 1 — Comparable multi-analysis frameworks (still the load-bearing one)

Unchanged from round 1. **Question**: does an existing tool already combine reachability/
reliability, capacity/flow, and schedule/cost analysis over one network model? The thesis's
central originality claim rests on the honest answer to this, found, not assumed.

**Where to look**: infrastructure resilience assessment platforms and digital-twin tooling in
civil/reliability engineering venues; multi-hazard risk assessment software surveys; PRA
(probabilistic risk assessment) toolkits in nuclear/process-safety contexts (this framework's own
funding domain, so precedent is plausible); general graph-analysis platforms that grew reliability
*or* flow modules as extensions (check whether any grew both). Search terms: "integrated
infrastructure resilience framework," "unified reliability and performance analysis," "multi-
metric network assessment tool," "graph-based decision support infrastructure."

### Thread 2 — Flow and capacity analysis under uncertainty (verified premise, §3)

**Question**: what does the robust/stochastic/interval max-flow literature actually offer, so the
framework's Float64-only capacity boundary can be stated against a real landscape rather than
read as an oversight next to the imprecision-native Probability and CPM (Interval-only) toolkits.

**Where to look**: robust optimisation on network flow (robust max-flow, interval-capacitated
flow), stochastic-flow network reliability (a distinct established sub-field — check whether it
already cites the same message-passing/decomposition lineage Probability covers, which would let
Background cross-reference instead of duplicating).

### Thread 3 — The software delivery landscape (expanded per her note, distinct from Thread 1)

**Question**: is there a comparable *category* of tool, a no-code or low-code, web-based,
engineering-domain analysis interface, whether or not it does the same analyses this framework
does? This is a different question from Thread 1 (which asks about analytical capability); this
one asks about the delivery/interface model. Front-End's own chapter already cites the
last-mile problem and two general visualisation tools narrowly; Background needs the category
survey those citations sit inside.

**Where to look**: reliability-block-diagram software with GUIs (commercial RBD/FTA tools —
ReliaSoft-class products and their published descriptions), web-based risk-assessment platforms,
engineering-simulation-as-a-service platforms, any civil/infrastructure-specific no-code analysis
tool. Search terms: "no-code engineering analysis web tool," "low-code reliability software,"
"browser-based risk assessment platform," "local-first scientific software" (extends
`kleppmann2019local` past the single citation Front-End already carries).

### Thread 4 — Julia versus Python (and R) for this class of computation (expanded per her note)

**Question**: what does the Julia ecosystem offer for graph/reliability/imprecise-probability
computation, how does it compare to the equivalent Python (and R) ecosystems, and what is the
actual, citable argument for Julia specifically given this framework's design leans on multiple
dispatch to realise one propagation mechanism generically over `Float64`/`Interval`/`pbox`. This
sits ABOVE the Input Module chapter's package-internals comparison (custom object vs Graphs.jl) —
language-level, not package-level.

**Where to look**: the canonical Julia language paper (Bezanson, Edelman, Karpinski, Shah, "Julia:
A Fresh Approach to Numerical Computing," SIAM Review, 2017 — verify at the publisher record
before citing, standard practice this session), JuliaGraphs ecosystem overview, Python's
NetworkX and its scale/performance discussion in its own literature, Python probabilistic-
graphical-model packages (pgmpy, and check whether a Python reliability-specific package exists
at all, which would itself be evidence for Thread 1), R's equivalent if one exists. The
multiple-dispatch argument specifically: search for literature on multiple dispatch as a design
pattern for numerically generic code (this may already trace to the Bezanson et al. paper itself).

### Thread 5 — Resilience/reliability terminology (light, §2.1 of the outline)

Unchanged from round 1. A handful of definitional references, not a survey; check whether one
well-cited definitional paper covers it cleanly rather than compiling several.

### Thread 6 — Comparable theses

Unchanged from round 1, downgraded in the outline (§2.7) to a short paragraph rather than its own
section, since her supervisor's expectation is now the driver for chapter depth rather than a
length target calibrated against comparable theses. Still worth 2–4 genuine comparators: EThOS
(UK) / ProQuest, same search terms as Thread 1 plus "imprecise probability network reliability
thesis," "diamond decomposition reliability," filtered to the last ~10 years.

### Thread 7 — Scientific software / reproducibility (coordination point, Background vs ch. 9)

Unchanged in substance from round 1's Gap 5, but now overlaps Thread 4 more directly (Julia
package-ecosystem positioning could live in either chapter). Open question for her: does the
language/ecosystem argument (Thread 4) live entirely in Background, with ch. 9 assuming it and
moving straight to implementation, or does ch. 9 want its own reproducibility/software-engineering
angle (`hannay2009scientists` is already spent once in Front-End) separate from the ecosystem
comparison here. Revisit once ch. 9 is planned; not blocking Background's drafting.

## 5. What NOT to research (unchanged, still binding)

- Any reliability computation method already surveyed in the Probability chapter.
- Any decomposition method already surveyed in the Diamond chapter.
- Any interval-CPM or scheduling method already surveyed in the CPM chapter.
- Imprecise-probability arithmetic foundations already cited in the Probability chapter — Background
  references the discipline's existence, doesn't re-derive Fréchet–Hoeffding.
- The specific software citations Front-End already carries (Gephi, Cytoscape, the PBA software
  family, local-first) — Background's Thread 3 is the category above them, not a repeat of them.
- The Graphs.jl-vs-custom-object package comparison already in the Input Module chapter —
  Background's Thread 4 is the language above it, not a repeat of it.

## 6. Collection method (unchanged)

Every citation verified at its publisher record before it enters a references.bib, checked both
for existing and for saying what it's cited for, same discipline as every chapter this session.
Per thread: search, shortlist 3–8 candidates prioritising surveys/reviews that can carry several
claims at once, verify, and for Thread 1 specifically log every comparator found and its actual
scope (even rejected ones) so the novelty claim is defensible against "did you look."

## 7. Open items for Temi

- Thread 7's split between Background and the (unplanned) Julia package chapter.
- Whether the software-delivery survey (Thread 3) and the framework-comparison survey (Thread 1)
  should stay as two chapter sections or merge into one, once actual search results come back
  and it's clear how much distinct material each really has.
- Whether to run the threads now, and at what depth per thread — a handful of anchor sources
  each, or a fuller pass on Threads 1, 3, and 4 given they now carry more of the chapter's weight.
