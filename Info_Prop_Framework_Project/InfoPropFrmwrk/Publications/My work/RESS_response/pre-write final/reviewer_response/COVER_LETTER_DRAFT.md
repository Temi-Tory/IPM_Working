# Cover letter to the editor — draft

Standard RESS/Elsevier revision cover-letter structure (per web-checked convention): thank the
editor and reviewers, summarise the revision at a high level, point to the detailed point-by-point
response, close with availability statements. Fill in editor's name/manuscript number once the
original decision letter is in hand.

---

Dear [Editor name],

We thank you and the three reviewers for the detailed and constructive comments on manuscript
[MS number], "Information Propagation Algorithm for Exact Reliability Analysis in Directed
Acyclic Process Networks." We have substantially revised the manuscript in response to every
comment raised, and we believe the revision is materially stronger as a result. A complete
point-by-point response is enclosed; the main changes are summarised here.

**Validation breadth (Reviewer comments 1, 3; R2.1, R2.3; R3.2).** The single 16-node benchmark
has been supplemented with an independent exact oracle — a reduced-ordered binary decision
diagram with dynamic variable reordering — applied across a corpus of 129 random and mutated
directed acyclic graphs, six topological families, larger random networks, and real
infrastructure networks, in addition to the applied case study. Worst observed disagreement
anywhere in this corpus is at floating-point precision.

**The runtime comparison (comment 2; R2.2).** The previously reported 134× speedup, based on
runtimes quoted from a published paper obtained in an uncontrolled environment, has been removed
from the headline claims. All quantitative performance claims in the revision now rest on
controlled, same-environment comparisons against the exact decision-diagram oracle above.

**Theoretical positioning and complexity (comment 4; R2.1/R2.4; R3.1/R3.5).** The manuscript now
gives an exact per-instance cost expression, formally positions the method as a specialisation of
cutset conditioning to source-to-node reachability (with a new factorisation lemma), and relates
its cost parameter to the treewidth that governs junction-tree inference and well-ordered decision
diagrams — with full proofs of every lemma, including two new ones the reviewers' questions
motivated.

**The applied case study (comment 5; R2.5; R3.6).** The case study has been rebuilt from the
ground up around a medical drone logistics network for Scotland, with every input traced to the
cited source design study and exactly one clearly flagged extension. It now reports engineering
reliability findings — which facilities carry the most uncertainty about delivery reachability —
rather than runtime statistics alone, and locates the practical boundary of exact computation on
this real network in terms of a controllable redundancy design parameter.

**A new capability, not requested by any reviewer but added because it strengthens the
contribution substantially: native propagation of imprecise component reliabilities.** With
interval-valued inputs the method returns the exact reliability range at machine precision; with
probability-box inputs it returns guaranteed distributional bounds via a conditioning operator
grounded in the Fréchet–Hoeffding inequalities, enabling certified bounds on decision-relevant
probabilities that decision-diagram methods do not provide analytically. We believe this addition
directly answers the spirit of several reviewer comments about the method's broader value beyond
raw computational speed.

Every other comment — algorithm reproducibility, worked examples, supernode/cache management,
figure quality, editorial issues, and the relationship to probabilistic graphical model inference
— is addressed in full in the enclosed point-by-point response.

**Data and code availability.** The complete implementation is released as the open-source,
peer-registered Julia package `InformationPropagationAnalysis.jl` (Julia General registry,
current version 0.2.1, [GitHub URL]). All data and scripts needed to reproduce every number,
table, and figure in the revised manuscript are deposited at [Zenodo DOI — to be minted; see
`../zenodo_package/MANIFEST.md`].

We hope the revision addresses the reviewers' concerns fully and look forward to your decision.

Sincerely,
[Authors]

---

## Notes for finalising (not part of the letter itself)
- Fill in manuscript number and editor name once the original decision letter is supplied.
- Confirm the final comment-numbering scheme (first table 1–8, R2 1–4, R3 1–8) matches whatever
  the editor's own decision letter used, in case numbering differs from the extracted tracker.
- The Zenodo DOI placeholder must be filled in before this letter is finalised — minting needs a
  separate explicit go-ahead (see `../zenodo_package/MANIFEST.md`).
- Consider whether to mention the adversarial-scaling data gap explicitly (see `../README.md`) —
  recommend resolving that scope decision before this letter is finalised, since the letter's
  validation-breadth paragraph should match whatever ends up in the manuscript.
