# Integrating the Critical Path chapter into the thesis (when you choose to)

Same convention as `Diamond_Chapter_v2`: `\ifdefined\maindoc` scaffold, starts at `\section`,
standalone-compilable here (11 pages, 0 errors/undefined). Steps, all in YOUR hands:

1. **Place the files**: copy `Critical_Path_Chapter.tex` and `figures/` to
   `thesis/Chapters/Critical Path Toolkit/` (or your preferred folder name).

2. **main.tex**:
   - Under `\chapter{ Information As Schedule and Cost: Critical Path Toolkit}` add
     `\include{Chapters/Critical Path Toolkit/Critical_Path_Chapter}`
   - Extend `\graphicspath` with `{Chapters/Critical Path Toolkit/figures/}`
   - Chapter labels this chapter cross-references: `\label{ch:input-module}` (Ch3) and
     `\label{ch:probability-toolkit}` (Ch5) are already required by the diamond chapter's
     integration notes; additionally add `\label{ch:diamond-module}` after the
     `\chapter{ Sub-graph Decomposition: Diamond Processing Module}` line.
     (Standalone fallbacks in this file render them as 3/4/5 outside the thesis; skipped
     under `\maindoc`.)
   - For standalone compiles inside the thesis tree, flip `\addbibresource{references.bib}`
     to the thesis-root relative path as with the diamond chapter.

3. **Bibliography**: merge this folder's `references.bib` (8 entries, all verified against
   publisher records 2026-08-18) into the thesis-root bib.

4. Figures regenerate with `dot -Tpdf name.dot -o name.pdf` (run from a short working path;
   the thesis tree exceeds the ~260-character limit that makes `dot` fail silently).

Every number in the case-study section traces to an artifact under `validation/cpm_v2/`
(float/interval/tightness/scaling/MC logs, case_studies_log.txt, water_k32_float_bounds.csv,
slide_table_check output). The theory section's proofs mirror
`validation/cpm_v2/DOMINATION_SPLIT_THEORY.md`.
