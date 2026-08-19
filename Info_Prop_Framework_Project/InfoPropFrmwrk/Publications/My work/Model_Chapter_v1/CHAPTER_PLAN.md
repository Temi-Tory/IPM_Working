# Model Chapter Plan — "Complex Processes as Directed Acyclic Graphs" (working title)

Drafted 2026-08-18 for the user to edit; nothing here is final until she says so.

## Agreed thesis flow (user, 2026-08-18)

1. Introduction — grounding, motivation, problem statement, framework aims
2. Background — MAY OR MAY NOT STAY (several chapters fold in their own literature;
   recommendation below)
3. **Complex Processes as Directed Acyclic Graphs** — this chapter: the model set-up
4. Input Processing Module (retitled plainly; loses the "System Information Model" prefix)
5. Network Decomposition / Diamond Module
6. Probability Propagation Toolkit
7. Capacity Flow Toolkit
8. Critical Path Toolkit
   (4–8 each keep their own internal case studies)
9. The Framework as a Julia Package — full-coverage code discussion
10. The No-Code Front End — short: API/UI contracts, data sovereignty, UX
11. Integrated Case Study — one network, every framework feature, driven through the
    front end with screenshots; doubles as the FE case study and the full-framework case study
12. Conclusions; Appendices if needed; References

Renumbering is absorbed by the `\ref{ch:...}` labels already in use; this chapter takes
`\label{ch:system-model}`.

## Scope contract

**In scope:**
- The target class: flow-oriented civil infrastructure and process networks — systems whose
  behaviour is organised by directed flow or precedence.
- From process to graph: components become nodes, dependencies become edges; why direction is
  intrinsic; why acyclicity is the right abstraction, what it excludes, and how cyclic physical
  realities are oriented in practice (the real-infrastructure orientation justification from the
  RESS work lands here).
- Node roles with physical referents: sources as supply/entry, sinks as demand/delivery, forks
  as distribution and deliberate redundancy, joins as convergence/assembly. Reconvergence
  introduced as a SYSTEM phenomenon (redundant routes reconverging), so the diamond chapter
  later names something the reader already owns.
- The formal object, stated once and authoritatively: G=(V,E), S, T, Pa/Ch, ancestors/
  descendants, fork/join; the notation table (supersedes/feeds the Nomenclature page).
- Information on the network: what a number on a node or edge MEANS under each of the three
  readings (probability of operation; duration/cost; capacity), and the three uncertainty
  representations (deterministic, interval, p-box) with where each arises in practice.
  Model-level meaning only.
- Assumptions and limits, stated plainly: component independence, binary states for the
  probability reading, static topology, acyclicity.
- **Closing section: the three problem statements.** Derived from the model: does information
  arrive despite failure; how much can flow; when and at what cost. The three toolkit chapters
  then read as answers to questions the reader already holds (the convention observed in
  comparable theses: the model chapter ends in problem formulation).

**Out of scope (lives elsewhere):**
- Structure-vs-analysis-inputs layering mechanics, file formats, parsing: Input chapter
  (user ruling 2026-08-18).
- Decomposition theory, identification, conditioning: diamond chapter.
- Any algorithm, any implementation.
- Method-specific literature: stays in the method chapters' own groundings.

## Consequences for existing chapters

- Input chapter: retitled "Input Processing Module"; intro slims (the data-silo story stays,
  the modelling weight moves here); graph terms referenced, not re-established.
- Diamond chapter Preliminaries: slims to chapter-specific definitions (topi, context, infl,
  diamond); fork/join/ancestor definitions referenced.
- CPM chapter: grounding keeps its method history; the object is referenced.
- Intro chapter (when written): carries motivation/fragmentation/aims; this chapter starts
  from "the systems" not from "the problem".

## Section sketch

1. Introduction — the class of systems, and that everything downstream operates on one model
   of them.
2. From process to graph — the mapping, directionality, acyclicity and its justification.
3. Node roles and structural phenomena — roles with physical referents; redundancy and
   reconvergence as system facts.
4. The formal object — definitions and notation, once.
5. Information on the network — value meanings per reading; uncertainty representations.
6. Assumptions and limits.
7. Three questions — the problem statements the toolkits answer.

## Figures (GraphViz dot+pdf per chapter convention)

- fig01: physical system schematic beside its DAG (candidate: the water treatment network,
  which then recurs through Input/CPM/case studies — one system carried through the thesis).
- fig02: small DAG annotated with roles (source/fork/join/sink).
- fig03: redundancy reconverging — the system-level picture whose graph-level formalisation
  the diamond chapter takes up (must not duplicate the diamond chapter's figures).

## Recommendation on the Background chapter (open decision)

Keep it only as a short positioning chapter (tool landscape and the gap: reliability
computation approaches, scheduling under uncertainty, flow analysis, existing multi-analysis
frameworks), NOT method theory, which the method chapters already ground locally. If it
shrinks below ~8 pages, fold it into the Introduction as a Related Work section. Decision can
wait until the intro is drafted.

## Open decisions for the user

- Final title ("Complex Processes as Directed Acyclic Graphs" vs a variant).
- Background chapter: keep as positioning, or fold into intro.
- Whether the water network is the recurring model example (recommended: yes, it already
  anchors the slides, CPM chapter and case-study material).
- Depth of the uncertainty-representation discussion here vs in the probability chapter.
