# Integrating the model chapter into the thesis (when you choose to)

Same convention as the other chapter folders: `\ifdefined\maindoc` scaffold, starts at
`\section`, standalone-compilable here. Steps, all in YOUR hands:

1. **Place the files**: copy `Complex_Processes_Chapter.tex` and `figures/` to
   `thesis/Chapters/System Model/` (or your preferred folder name).

2. **main.tex**:
   - Insert a NEW chapter line between Literature Review and the Input chapter:
     `\chapter{Complex Processes as Directed Acyclic Graphs}` (or the final title)
     followed by `\label{ch:system-model}` and
     `\include{Chapters/System Model/Complex_Processes_Chapter}`.
   - Retitle the input chapter line to plain `\chapter{Input Processing Module}`
     (it currently carries the "System Information Model" prefix this chapter takes over).
   - Add `\label{ch:capacity-toolkit}` after the Capacity Flow chapter line and
     `\label{ch:critical-path}` after the Critical Path chapter line (the labels for
     input/diamond/probability are already required by the other chapters' notes).
   - Extend `\graphicspath` with `{Chapters/System Model/figures/}`.

3. **Renumbering**: everything from Input onward shifts by one. All cross-chapter
   references use `\ref{ch:...}` so nothing breaks. The STANDALONE fallback numbers
   inside `Diamond_Chapter_v2` and `CPM_Chapter_v1` still reflect the old order
   (cosmetic, standalone-only); update them to the new numbers when convenient.

4. **Bibliography**: one entry (`ouyang2014interdependent`), already present in the
   diamond chapter's bib, so merging is a no-op if that bib is already at the root.
   Consider adding a self-citation of the RESS paper in Section 2's orientation
   discussion once its final publication details exist.

5. **Knock-on edits owned by you, flagged not applied**: the Input chapter's intro
   currently carries modelling weight (node-role sentence, the structure-vs-inputs
   framing) that this chapter now grounds; it can slim and reference
   `ch:system-model`. The diamond chapter's Preliminaries re-derives fork/join and
   ancestry; those can become references to Definitions 1-3 here.
