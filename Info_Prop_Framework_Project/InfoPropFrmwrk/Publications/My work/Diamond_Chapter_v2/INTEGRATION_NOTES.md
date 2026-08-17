# Integrating this chapter into the thesis (when you choose to)

The chapter file is written in the thesis's own chapter convention (`\ifdefined\maindoc` scaffold,
starts at `\section`, shared theorem counter assumed in main mode) and was test-compiled inside a
copy of the thesis successfully (full build: 85 pages, 0 errors, 0 undefined references) before
being moved back here. Integration is four small steps, all in YOUR hands:

1. **Place the files**: copy `Diamond_Decomposition_Chapter.tex` and the `figures/` folder to
   `thesis/Chapters/Diamond Module/` (or whatever folder name you prefer — adjust step 2's path).

2. **main.tex — five lines**:
   - Under `\chapter{ Sub-graph Decomposition: Diamond Processing Module}` add:
     `\include{Chapters/Diamond Module/Diamond Decomposition Chapter}`
   - Extend the graphics path:
     `\graphicspath{{Chapters/Flow Toolkit/figures/}{Chapters/Diamond Module/figures/}}`
   - Add chapter labels (the diamond chapter cross-references these via `Chapter~\ref{...}`):
     - after `\chapter{ System Information Model: Input Processing Module}` add `\label{ch:input-module}`
     - after `\chapter{ Information As Probabilities: Probability Propagation Toolkit}` add `\label{ch:probability-toolkit}`
     (The chapter file carries standalone-only `\newlabel` fallbacks for these two names, skipped
     under `\maindoc`, so the standalone PDF prints "Chapter 3"/"Chapter 5" without warnings. If
     you prefer different label names, rename them in both main.tex and the chapter file.)
   - In the chapter's standalone preamble, change `\addbibresource{references.bib}` back to the
     thesis-root relative path `../../references.bib` (only matters for standalone compiles from
     inside the thesis tree).

3. **Bibliography**: the thesis's `main.tex` declares `\addbibresource{references.bib}` but no
   `references.bib` exists at the thesis root yet. The `references.bib` in THIS folder contains
   everything needed: the 13 entries this chapter cites PLUS `ford1956`, `ford1962`, and
   `birnbaum1969`, which the existing Flow and Input chapters cite but which no bib file
   currently supplies. Copy it to the thesis root (or merge into your own).

4. **Known pre-existing build conflict (independent of this chapter)**: `main.tex` loads the old
   `algorithmic` package, but the Input Module chapter's algorithm floats use `algpseudocode`
   commands (`\State`, `\Require`, ...) while the Flow chapter's use uppercase `algorithmic`
   commands (`\STATE`, `\WHILE`, ...). A full-thesis build fails on one or the other whichever
   single package is loaded. The fix that made the full build pass during testing: replace
   `\usepackage{algorithmic}` with `\usepackage{algpseudocode}` plus uppercase aliases:

   ```latex
   \newcommand{\STATE}{\State}
   \newcommand{\COMMENT}[1]{\Comment{#1}}
   \newcommand{\RETURN}{\State \textbf{return} }
   \newcommand{\IF}[1]{\If{#1}}
   \newcommand{\ELSE}{\Else}
   \newcommand{\ENDIF}{\EndIf}
   \newcommand{\FOR}[1]{\For{#1}}
   \newcommand{\ENDFOR}{\EndFor}
   \newcommand{\WHILE}[1]{\While{#1}}
   \newcommand{\ENDWHILE}{\EndWhile}
   ```

   (Alternatively, convert the Flow chapter's algorithm blocks to lowercase algpseudocode.)

Note on the chapter title: `main.tex` currently titles Chapter 4 "Sub-graph Decomposition:
Diamond Processing Module"; if you prefer "Network Decomposition Module", rename it there — the
chapter file itself carries no `\chapter` command in main mode.

Figures: each `figures/fig*/` folder holds the GraphViz source and its PDF; regenerate any figure
with `dot -Tpdf name.dot -o name.pdf`. (Heads-up: run `dot` from a short working path — the
compile fails silently on paths beyond ~260 characters, which the thesis tree exceeds.)

The worked examples in the chapter are machine-verified against the implementation
(`validation/fresh_20260816/chapter_example_trace.jl`); re-run that trace if the identification
algorithm ever changes.
