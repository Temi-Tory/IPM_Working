# Integrating this chapter into the thesis (when you choose to)

The chapter file follows the thesis chapter convention (`\ifdefined\maindoc` scaffold, starts at
`\section`, shared theorem counter assumed in main mode). Standalone build: 25 pages, 0 errors,
0 undefined references (pdflatex + biber). Integration steps, all in YOUR hands:

1. **Place the files**: copy `Probability_Propagation_Chapter.tex` and the `figures/` folder to
   `thesis/Chapters/Probability Toolkit/` (or your preferred folder name).

2. **main.tex**:
   - Under `\chapter{ Information As Probabilities: Probability Propagation Toolkit}`
     (which already carries `\label{ch:probability-toolkit}`) add
     `\include{Chapters/Probability Toolkit/Probability_Propagation_Chapter}`.
   - Extend `\graphicspath` with `{Chapters/Probability Toolkit/figures/}`.
   - The chapter cross-references `ch:system-model`, `ch:input-module`, `ch:diamond-module`
     by label. Standalone-only `\newlabel` fallbacks (numbers 3/4/5) are skipped under `\maindoc`.
   - For standalone compiles from inside the thesis tree, point `\addbibresource` at the
     thesis-root bib as with the other chapters.

3. **Bibliography**: `references.bib` here has the 17 entries this chapter cites. Only
   `bryant1986graph` overlaps the Diamond chapter's bib (identical entry, safe to merge). The
   survey entries (billinton1992network, xing2008fault, rauzy1993new, bryant2002ordered,
   liu2012improved, kim2013network, fishman1986comparison, tong2019probability,
   pearl1988probabilistic, lauritzen1988local, williamson1990probabilistic,
   ferson2003constructing, valiant1979complexity, ball1986computational) carry the bibliographic
   data of the RESS revision's verified reference list. `jones2025conceptual` is the drone source
   study, cited with `note = {Submitted}` and initials-only author names (update at proof stage if
   it publishes).

4. **Macro collision guard**: the chapter defines `\Pa`, `\anc`, `\infl` via `\providecommand`,
   so it composes with the Diamond chapter's `\newcommand{\infl}` in either include order.

## Overleaf integration (first full-thesis build, 2026-08-19)

Your Overleaf tree places the chapter at `Chapters/Probability/`. The first build's chapter
errors reduce to the two main.tex steps above, concretely:

- **Figures**: append `{Chapters/Probability/figures/}` to main.tex's `\graphicspath`. The
  chapter's own `\graphicspath{{figures/}}` is standalone-only, so under `\maindoc` the path
  must come from main.tex. All five figure files were already uploaded.
- **Bibliography**: the repo-root `MERGE_INTO_THESIS_BIB.bib` is the running full-thesis bib
  (Diamond + CPM + Flow/Input + Probability, 42 entries, no duplicate keys); its contents ARE
  the thesis-root references.bib for Overleaf. The Probability section (15 entries, the exact
  keys the first build reported missing) was appended 2026-08-19; `bryant1986graph` appears once,
  in the Diamond section. The short-lived chapter-local file of the same name is deleted.
- Most of the overfull boxes the build reported in this chapter's survey paragraphs (lines
  59-64, 84) are the undefined citations printing raw keys as unbreakable bold strings; they
  resolve with the bib merge. The one genuine display overfull (the conditional invariance
  lemma, 33pt in the thesis text block) is fixed in the chapter source by moving the sum's
  state range into the where-clause; re-upload the updated `Probability_Propagation_Chapter.tex`.
- Not from this chapter: the `fancyhdr` headheight warnings (main.tex and the Diamond chapter)
  and biblatex's `'volume+number' undefined` notice (biblatex-ieee version on TeX Live 2025)
  predate this integration and are benign.

## Chapter shape (post-revision 2026-08-19, per your notes)

1 Introduction, with §1.1 a survey of exact reliability computation (RBD/FTA, path/cut +
recursive decomposition, BDDs incl. ordering + reconvergence costs, MC, cutset conditioning +
junction tree + dPrPm, the imprecise gap; payoff held to the survey's end).
2 The Belief of a Node. 3 Propagation in a Single Pass. 4 Reconvergence Breaks the Local Update
(simple diamond). 5 Conditioning at a Join (Lemmas: invariance, separator sufficiency,
recombination across groups; the non-influencing set's treatment; fan-in 2k+1). 6 Supernodes and
Progressive Decomposition (supernode equivalence lemma, store, zero-weight skip) with §6.1 the
multi-level worked example. 7 Validation. 8 Complexity Analysis (posings vs unique diamonds,
a-priori bound + realised 1-5%, cutset-conditioning specialisation, width figure, resource
symmetry, honest no-superiority conclusion). 9 Propagating Uncertain Probabilities with §9.1
interval (corner-exactness proposition + proof, multilinearity mechanism, naive over-widening,
degeneracy-preserving convention, costs incl. one-shot 3.9-99.9x). 10 Probability-Box Propagation
(§10.1 convex-combination operator, §10.2 the two blends: Frechet proven vs positive-dependence
open, §10.3 envelope + certified-bound table, §10.4 cubic cost dial). 11 Case Study: the drone
network (traced inputs + flagged weather extension, three proxy designs, redundancy boundary +
BDD comparison, reliability map + Islay Hospital reading, p-box boundary). 12 Summary.

The worked example is the RESS multi-level network (3 sources, forks 1/7/14, joins 4/6/11/12/T):
diamond group + non-influencing parent 13 at join 6, nested diamonds inside D4, cross-context
store behaviour (20 posings, 16 distinct; D1's states reused by D3's recursion; D4's inner
diamonds keyed apart by the outer state).

## What this chapter deliberately does NOT contain

- Diamond identification detail (ch5 owns it); Julia detail (implementation chapter owns it); no
  code names.
- The dropped 27-28 unrestricted-drone width (replaced by the memory-exhaustion statement per
  your 2026-08-16 policy), the superseded 2.9-95x interval ratios and 2.7/8.3/110s p-box costs,
  any steps=800 p-box claim, mlgw-gas p-box (soundness margin within MC resolution).

## Terminology fixed by this chapter

| Use | Not |
|---|---|
| belief $b(v)$ | reachability probability (given once as gloss), reliability estimate |
| signal / signal probability $S_p$ | message |
| conditioning set $C$ (bridged once from ch5's "fixed nodes") | separating set, cutset (cutset conditioning cited as the method name only) |
| conditioning state | scenario |
| conditional signal map $\psi$ | supernode map |
| supernode | equivalent component (used once as gloss) |
| contextual belief | current belief, ambient belief |
| store / stored sub-problem | cache (code term, not used) |
| conditioning width / width | maxcond (code term, not used) |
| the propagation algorithm / the propagation | IPA after the single naming in the introduction |
| decision diagram (after first full naming) | BDD as prose term, sifted |

## Provenance of every number (fresh-verified 2026-08-16/17 campaign or this chapter's trace)

| Claim | Source artifact |
|---|---|
| Simple diamond: 0.81, 0.6561, 0.59049, naive 0.749071, exact 0.675462, psi(1)=0.926559, signal 0.750513 | `validation/fresh_20260816/prob_chapter_example_trace.jl` (+.log): framework + brute-force state enumeration |
| Worked network: all beliefs (b(6)=0.796843, b(11)=0.733329, b(12)=0.779068, b(T)=0.806149); trace table (w=0.81; psi values 0.889023/0, 0.893745/0.478297, 0.931860/0.583288, 0.913943/0.818038; P(E) 0.720108/0.814810/0.865631/0.895721); parent-13 signal 0.590490, join-6 recombination 0.885382; 20 posings / 16 distinct sub-problems; path-IE agreement <=5.6e-16 | same trace script (Example W; path-enumeration inclusion-exclusion oracle; cache dump) |
| Worked network interval [0.634002, 0.931254] at T, corner agreement exactly 0.0; sources kept [1,1] | same trace script, Example W interval leg |
| Corpus exactness 129 graphs worst 1.1e-16 both regimes; interval corners worst 2.8e-16 all 129 | `full_regression_sifted_fresh.csv`, `interval_sweep_full.csv` |
| Naive interval over-widening up to 0.45 | `interval_sweep_full` (0.4522) |
| Fan-in exactly 2k+1, k<=16; adversarial wall-time crossovers; square-mesh both-exponential | `adversarial_timed.csv`, `square_mesh.csv` |
| Realised work 1-5% of no-store posing bound | `w_predictor.log` |
| Width correlation figure + grid 7 vs log2(290)=8.2 | `width_correlation.pdf` (RESS artifact) + grid fresh check (bdd_nodes 290) |
| Resource symmetry specimen: 413 nodes/265 joins, identification memory vs diagram time past 2.5M nodes | `diabetes_witnessed.log` (artifact-grade) |
| p-box soundness 50 configs zero violations; envelope 0.18-0.70 (18/18) | F-section fresh logs; `grid_envelope` |
| Convolution unsoundness up to 0.34 | `validate_framework_pbox` history (0.34 -> 0.000) |
| Certified table [0,0.02]/[0,0.10]/[0,0.12]/[0.98,1.00]; MC 9,604/385/267 | `certified_bound_vignette` (confirmed digit-for-digit) |
| Interval ~1.2x; one-shot 3.9-99.9x on 8 families | `timing_imprecise` (interval leg); fresh `interval_bdd_vs_ipa_timing` |
| p-box ~cubic 1.2/6.0/39/276 s at 25/50/100/200 | `pbox_steps_probe.log` + curve (old quadratic claim retired) |
| Drone: configs 217/263/10, 242/1753/17, 230/1648/16; bands 0.089/0.100, 0.094/0.161, 0.093/0.161; Islay [0.562,0.722] | `drone_beliefs_check.log` + G1 |
| Drone: unrestricted identification memory-exhaustion (no width number) | `identify_diagnostics.log` (drone-network-full row) |
| Drone: K saturation at 16; dense exact <25s, sparse <<1s; IPA ~5s K=8..14; BDD ok K<=12 (123k nodes, 45s), timeout from K=14; interval one-shot ~50x (centralised) / ~15x (K=6); agreement 0.0 / 1.1e-16 | `g2_ksweep.log`, `g2_special_rows.log` |
| Drone p-box: centralised ~seconds (1.5s), minimal-K6 ~minutes (270s), K8 >1h timeout | A1.5 coverage note, G §7 (`drone_pbox_k8_timed_postfix`) |

## Figures

The figures folder holds exactly what the chapter references. fig01 (simple diamond) and fig03
(worked network) are dot sources; regenerate via `dot -Tpdf` from a short path. fig04 (width
correlation), fig05 (envelope), fig06 (drone map) are the RESS revision's data-backed figures,
copied from `RESS_response/newress.zip::figures/`; their generating scripts live in `validation/`
per the campaign notes. (fig02, the 8-node network from the first draft, was removed with its
folder when the worked example changed.)

## Worked-example trace

`validation/fresh_20260816/prob_chapter_example_trace.jl` (+.log) is this chapter's trace script:
simple diamond + the 8-node network (framework vs brute-force state enumeration) and the
multi-level worked network (framework vs path-enumeration inclusion-exclusion, faithful
per-diamond psi sub-problems, cache dump, interval corner checks). Re-run it if propagation or
identification changes. Conventions: sources prior 1.0 on the worked network (matching the RESS
example); interval widening preserves degenerate priors (sources stay [1,1]).
