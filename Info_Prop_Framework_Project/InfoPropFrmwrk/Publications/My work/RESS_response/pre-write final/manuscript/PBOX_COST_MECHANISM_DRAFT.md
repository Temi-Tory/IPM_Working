**CORRECTION (2026-09-06, later same session): the first version of this note below was wrong on
the central point and has been rewritten.** It originally claimed p-box cost is governed by
discretisation level "rather than" conditioning-set width `|C_d|` — i.e., that the two cost
drivers are structurally separate. That was based on reading only the leaf-level
`pbox_conditional_combine` function. Checking the actual caller
(`ProbabilityPropagation/Internal/DiamondPropagation.jl`'s `_combine` recursion) shows this is
wrong: for `T <: pbox`, `_combine` builds the identical binary recursion tree over the `m=|C_d|`
conditioning nodes that the Float64/Interval path uses, and calls `pbox_conditional_combine`
**once per internal node of that tree — i.e. `O(2^{|C_d|})` times per diamond**, not once. The
corrected mechanism, below, is a direct generalisation of the existing §4.3 formula rather than a
separate cost regime — and a caught, corrected error, not a silently patched one. (Caught by the
user's own question — "does this not imply diamond structure doesn't matter?" — exactly the kind
of check this whole pre-write pass exists to survive before anything reaches the manuscript.)

---

# Proposed addition — why p-box cost grows the way it does (mechanism, not just the number)

**Status: recommendation, not yet applied to `main_CORRECTED.tex`.** Like the three judgment calls
in `../reviewer_response/JUDGMENT_CALLS.md`, this is new prose for your sign-off, not inserted
unilaterally. Unlike those three, this isn't answering reviewer anxiety — it's closing a real gap
in the paper's own rigor standard: §4.3 gives an *exact* derivation of why Float64/Interval cost is
what it is (the $W=\sum_d 2^{|C_d|}\cdot O(|E_d|)$ formula, Lemma-backed); §5.3.2 currently just
*reports* the p-box exponent (≈2.8) empirically, with no mechanistic derivation. That asymmetry is
worth closing, especially since the reviewers already showed they don't accept unexplained
performance numbers at face value (R2.2, the original 134× critique).

## Where this comes from
Traced directly from source, in two parts — the first version of this note only checked the
second part, which is why it got the headline claim backwards.

**Part 1 — how many times the p-box combine operator runs per diamond.**
`ProbabilityPropagation/Internal/DiamondPropagation.jl`'s join-resolution code branches on the
value type. For `T <: pbox`, the `_combine(i, base_idx)` closure recurses over the diamond's
`m = |C_d|` conditioning nodes, building the identical binary recursion tree the Float64 path
builds (`i > m` is the base case; otherwise it recurses into `up`/`down` branches and combines
them) — the only difference is *what* combines the two branches at each internal node: the Float64
path does a plain weighted sum (`state_probability`, O(1)), while the pbox path calls
`pbox_conditional_combine(belief_dict[...], up, down)`. A binary recursion tree with `m` levels has
`2^m - 1` internal nodes, so `pbox_conditional_combine` is called $O(2^{|C_d|})$ times per diamond
— exactly the same enumeration the exact/interval cost formula already counts.

**Part 2 — how much one such call costs.**
`InputProcessingModule.jl`'s `pbox_conditional_combine(W, A, B)` itself loops once per
discretisation level of the conditioning weight $W$ (`for i in 1:n` where `n = steps`), calling
`_pbox_branch_blend` twice per iteration; each call is `PBA.env(PBA.convIndep(x,y), PBA.convPerfect(x,y))`
from `ProbabilityBoundsAnalysis.jl` (`src/pbox/arithmetic.jl`) — the classical Fréchet/
dependency-bound convolution already cited in the manuscript (Williamson and Downs 1990), itself
polynomial in the discretisation level. The loop's `n` results are then merged by `PBA.mixture(...)`,
a further discretisation-level-dependent step. So a single call costs somewhere between quadratic
and cubic in `steps`.

**Combining the two, and a second, empirically-confirmed refinement**: total p-box cost for a
diamond is $O(2^{|C_d|})$ calls to the combine operator, each costing $O(\text{steps}^{\sim2})$ —
but exactly as Section~\ref{sec:complexity} already notes for the exact/interval case, the *raw*
$2^{|C_d|}$ enumeration over-counts once memoisation is accounted for: the same diamond-cache
that reduces realised Float64/Interval work to 1-5% of the a-priori bound $W=\sum_d 2^{|C_d|}\cdot
O(|E_d|)$ applies identically to the p-box recursion, since it is the same recursive call
structure (`_combine` in `DiamondPropagation.jl`) for all three value types. **This was confirmed
empirically this session, not just argued**: a scoped experiment measuring p-box propagation time
at a fixed, cheap discretisation level (steps=50) across 12 networks already characterised in
`complexity_validation.csv` (`sum_2^C` ranging 26–4072, a 157$\times$ span) found propagation time
tracks `measured_ops` (the realised, memoisation-adjusted work count already reported for the
exact/interval comparison), not `sum_2^C`, with the ratio time/`measured_ops` clustered in a narrow
0.14–0.25\,s/op band across an 89$\times$ range in `measured_ops` — while `sum_2^C` is actively
misleading (the network with the single highest `sum_2^C` in the batch, `bridge_5` at 4072,
finished faster than two networks with lower `sum_2^C` but higher `measured_ops`). **This is worth
stating as a headline part of the mechanism, not a footnote**: the same "distinct conditional
sub-problems actually resolved" quantity that already governs realised Float64/Interval cost also
governs p-box cost — the three value types differ only in the price paid per resolved
sub-problem ($O(1)$ for Float64, $O(1)$ for Interval, $O(\text{steps}^{\sim2})$ for p-box), not in
what is being counted.

## Proposed addition to §4.4 "Numerical Realisation" (`sec:numerical`), extending the existing
## third point about the p-box conditioning operator

Current text ends: "...and this projection is guarded: an excursion beyond [0,1] exceeding
ordinary floating-point round-off by several orders of magnitude raises an error rather than being
silently discarded, so that a genuine soundness regression cannot be masked as rounding."

**Proposed continuation (new paragraph, same subsection):**

> This operator is invoked with the same frequency as its point-valued counterpart: conditioning
> at a diamond enumerates the states of its conditioning set exactly as in the exact and interval
> cases, and the realised number of such enumerations, after memoisation, is the same quantity
> reported as realised work in Section~\ref{sec:complexity} — the recursive call structure that
> resolves diamonds is shared by all three value types, and the diamond cache benefits p-box
> resolution exactly as it benefits the exact and interval cases. What differs is the price paid
> per resolved sub-problem. For point-valued and interval inputs this is an $O(1)$ scalar update;
> for p-box inputs the conditioning weight is itself represented at a chosen discretisation level,
> and the law-of-total-probability step (Lemma~\ref{lem:invariance}) at each resolved sub-problem
> requires integrating over that discretisation — combining the two branch distributions once per
> discretisation level and merging the results — where each combination is a convolution of the
> class formalised by Williamson and Downs (1990), itself polynomial in the discretisation level.
> Consequently p-box cost is governed by the same realised-work quantity as the exact and interval
> results, multiplied by a per-unit price that grows with the discretisation level rather than
> being constant: measured across a corpus of networks at a fixed discretisation level, propagation
> time tracks this realised-work count closely (to within a small, roughly constant factor) across
> more than an order of magnitude of network sizes, while the raw conditioning-set-width bound
> $2^{|C_d|}$ does not — a network with a smaller such bound but more realised sub-problems costs
> more, not less. This is why p-box cost in this paper is reported and controlled via the
> discretisation level in addition to, not instead of, the network's own structure.

## Proposed cross-reference addition to §5.3.2 (`sec:pbox`), at the point the exponent is first quoted

Current text: "...while p-box propagation grows super-linearly ... (an empirical exponent of
approximately 2.8), in exchange for proportionally tighter bands..."

**Proposed insertion immediately after "approximately $2.8$)":** add "(the mechanism is described
in Section~\ref{sec:numerical})".

## Why this level of detail, not a one-line footnote
You asked whether this should be short or fully explained and linked to the rest of the IPA math.
Given the paper already carries a full lemma-and-formula apparatus for the point-valued/interval
cost story (Lemma 1–4, the $W$ formula, the treewidth/cutset-conditioning positioning in
Section~\ref{sec:complexity}), a one-line footnote for p-box would read as an unexplained
asymmetry — exactly the kind of gap a reviewer who read Section 4.3 carefully would notice and
flag. The proposed paragraph above is short (one paragraph) but does three things a footnote
couldn't: (1) names the actual mechanism (the same $2^{|C_d|}$ enumeration as the exact/interval
cases, with a discretisation-dependent price per state rather than the earlier draft's — incorrect
— claim that discretisation *replaces* the conditioning-set width as the cost driver), (2) shows
this is a direct generalisation of the existing formula rather than a separate story, reinforcing
rather than undercutting the paper's "same width parameter" positioning, and (3) reuses the
paper's own existing citation (Williamson and Downs 1990) rather than introducing new machinery.
No new lemma or bibliography entry is needed.

## A supporting data point in progress
A scoped follow-up experiment is running as of this writing: p-box propagation time at a fixed,
cheap discretisation level (steps=50) across the ~14 networks already characterised in
`validation/probability/data/complexity_validation.csv` (which has diamond counts, $2^{|C|}$-sums,
and $|C|_{\max}$ for each), to check directly whether propagation time tracks diamond count/
conditioning-state count rather than node/edge count — with steps held fixed, this isolates
exactly the $2^{|C_d|}$-enumeration factor the corrected mechanism above predicts should dominate
across networks at a common discretisation level. This turns the mechanism from "derived from
source code" into "also shown empirically, across networks." Results, once complete, land in
`../data/pbox_cost_vs_diamonds/`. If the correlation with diamond count/conditioning-state count is
clean, it's worth citing alongside the paragraph; if it is not clean, that would mean either the
per-diamond cost isn't the dominant term at steps=50 for these networks, or there's a further
effect (e.g. caching/reuse behaviour differing from the exact/interval case) worth understanding
before the paragraph above goes in the paper.
