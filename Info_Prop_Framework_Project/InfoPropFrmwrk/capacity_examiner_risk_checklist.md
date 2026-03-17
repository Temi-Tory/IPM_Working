# Capacity Chapter Examiner-Risk Checklist

Purpose: final pre-submission checks to avoid over-claims, citation gaps, and internal inconsistency.

Use: mark each item PASS/FAIL before freezing the chapter draft.

---

## A) Claim-strength control

- [ ] PASS / [ ] FAIL: Every use of “exact” is tied to deterministic solved-instance exactness.
- [ ] PASS / [ ] FAIL: Sensitivity/failure sections explicitly include evaluated-candidate-set qualifier.
- [ ] PASS / [ ] FAIL: No sentence claims global exhaustiveness unless all edges/subsets were actually enumerated.
- [ ] PASS / [ ] FAIL: Dinic/default algorithm wording does not imply universal empirical superiority.
- [ ] PASS / [ ] FAIL: Package comparison is framed as integration breadth, not unbenchmarked speed superiority.

## B) Theory-to-implementation consistency

- [ ] PASS / [ ] FAIL: Max-flow/min-cut theorem statement appears and is connected to validation checks.
- [ ] PASS / [ ] FAIL: Multi-source/multi-sink reduction is described as exact super-node augmentation.
- [ ] PASS / [ ] FAIL: Node-capacitated analysis is described using node-splitting equivalence.
- [ ] PASS / [ ] FAIL: Min-cut family/SPOF statements match lattice/reachability logic used in modules.
- [ ] PASS / [ ] FAIL: Parametric threshold discussion uses monotone piecewise behavior wording.

## C) Citation integrity

- [ ] PASS / [ ] FAIL: Core theorem claims have primary citations (Ford-Fulkerson, Menger, etc.).
- [ ] PASS / [ ] FAIL: Directed global min-cut claim cites Hao–Orlin with correct metadata.
- [ ] PASS / [ ] FAIL: Min-cut lattice claim cites Picard–Queyranne with corrected DOI.
- [ ] PASS / [ ] FAIL: Birnbaum analogy cites Birnbaum as original reliability-importance source.
- [ ] PASS / [ ] FAIL: No uncited quantitative complexity claims appear in algorithm section.

## D) Scope boundaries

- [ ] PASS / [ ] FAIL: Chapter explicitly says probabilistic reliability is not computed in this deterministic layer.
- [ ] PASS / [ ] FAIL: Chapter explicitly says dynamic/time-varying flow is out of scope.
- [ ] PASS / [ ] FAIL: Chapter explicitly says uncertainty propagation is deferred to later chapters.
- [ ] PASS / [ ] FAIL: Structural-preprobabilistic role is stated in intro and summary.

## E) Internal coherence

- [ ] PASS / [ ] FAIL: Notation is consistent across sections (`G=(V,E,c,S,T)`, `F(c)`, thresholds, SPOF terms).
- [ ] PASS / [ ] FAIL: Throughput, bottleneck, and failure-mode language are used consistently (no term drift).
- [ ] PASS / [ ] FAIL: Complexity statements in text match complexity table wording.
- [ ] PASS / [ ] FAIL: Summary does not introduce claims absent from the main body.

## F) Offline-readiness gate

- [ ] PASS / [ ] FAIL: All required citations exist locally in your bibliography file.
- [ ] PASS / [ ] FAIL: All figures/tables referenced in text are already drafted and captioned.
- [ ] PASS / [ ] FAIL: No sentence contains placeholder text like “add citation” or “verify later”.
- [ ] PASS / [ ] FAIL: All mandatory qualifiers from the claim matrix are present in final prose.

---

## Quick fail-fix rules

- If any A-item fails: weaken wording immediately (replace universal claims with scoped claims).
- If any B/C item fails: patch theory/citation alignment before prose polishing.
- If any D item fails: add one explicit boundary paragraph in Sections 1, 5, and 9.
- If any F item fails: chapter is not offline-ready; do not start final writing pass yet.
