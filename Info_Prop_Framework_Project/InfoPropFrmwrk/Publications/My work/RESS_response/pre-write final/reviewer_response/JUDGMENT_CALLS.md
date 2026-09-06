# Three flagged judgment calls — recommendations for sign-off

Prior sessions drafted full responses to these three points but flagged their own doubt about
them inline (quoted in the audit). Per the user's instruction, here is a recommendation for each,
clearly marked as a recommendation, not settled text. Accept, edit, or reject each independently.

---

## 1. Drone case study — "just another generated network that fits a story"?

**The risk**: reviewer #5 (first table) already criticised the original six-Pareto case study for
being disconnected from real reliability insight; a reviewer could look at the *rebuilt* three
proxy networks and suspect they were reverse-engineered to produce a flattering result.

**Recommendation: lean into full disclosure rather than minimising the construction.** The
rebuilt case study is, on the evidence gathered, the more defensible of the two options because
every input is either (a) taken directly from the source study's own numbers/rules, or (b) one
single, explicitly flagged extension (the weather-derating interval), not several invented
parameters as in the original six-Pareto version. The honest move is to say this plainly and
early in §5.4.1, not to let a reviewer discover the proxy nature and wonder what else was
shaped to fit:

> "The source study's optimised network layouts are not published (its own data-availability
> statement: 'available upon reasonable request'). We therefore do not reproduce them; we
> construct three configurations as explicit, labelled *proxies* for the qualitative character
> of three described trade-off points, built entirely from the source study's own stated rules
> and figures, with exactly one flagged extension. We report this construction in full (Table X)
> so that the proxy nature of the topology — as distinct from the reliability-model inputs, which
> are traceable — is not left implicit."

This is close to the wording already in `RESS_edit_proposals.md` EDIT 15 §5.4.2 — the
recommendation is to make sure this disclosure survives into the final draft verbatim and is not
softened, and to say the same thing again, briefly, in the reviewer response letter itself
(comment 5 and R2 comment 6 responses) rather than only in the manuscript. A reviewer who reads
"we built proxies and here is exactly how, because the real ones aren't public" is reassured, not
suspicious; a reviewer who has to infer it is not.

**One more thing worth doing** (small, not yet in the plan's task list — optional): add one
sentence noting that the *qualitative* redundancy finding (K=16 is where sifted/naive BDD both
fail while IPA still completes) does not depend on the proxy construction being exactly right —
it is a structural property of "how many alternate routes are provisioned," which would hold for
the real optimised topology too if it shared a similar order of redundancy. This decouples the
tractability finding from the proxy-fidelity question a reviewer might otherwise conflate.

---

## 2. BDD-vs-IPA comparison — is the environment fair?

**The risk**: reviewer #2 already caught one uncontrolled comparison (the 134× dPrPm figure); a
second comparison that turns out to be unfair (different language, different hardware, a cold vs.
warm timing asymmetry) would be far more damaging the second time.

**Recommendation: state the environment once, explicitly, as its own short paragraph, and reuse
it everywhere.** The ingredients are already scattered across the validation notes but not
consolidated into one manuscript-facing statement. Recommended text for the §5 preamble (this
already exists in `RESS_edit_proposals.md` EDIT 11 in part — extend it to name the BDD side too):

> "All decision-diagram comparisons in this section use CUDD, called from the same Julia process
> and the same machine as the proposed method, with dynamic variable reordering (sifting) enabled
> unless stated otherwise; a fixed-order (unsifted) build is additionally reported wherever it
> changes the conclusion. All runtimes, for both methods, were measured after a discarded warm-up
> run of the same computation, so that JIT/program-initialisation cost is excluded from every
> figure reported."

This one paragraph pre-empts the fairness question for every subsequent number (grid, corpus,
drone) rather than requiring a per-table caveat.

**WITHDRAWN (2026-09-06, on the author's correct pushback): do not narrate the near-miss in the
manuscript.** An earlier version of this note recommended disclosing, in §5.4.3, that an initial
unwarmed measurement briefly reversed the conclusion before the warm-up protocol caught it,
framed as "naming your own near-miss demonstrates rigour." The author correctly rejected this:
there is no standard-practice reason for a RESS manuscript to narrate the authors' own debugging
history — papers report the final, validated methodology and result, not the path to it. That is
lab-notebook material (already captured in this project's own validation notes), not journal-
article content. The fix stands (methods stated once, applied to the manuscript — see below); the
narrative about discovering the fix does not belong in the paper and has been dropped from this
recommendation entirely.

Also recommend keeping the scope sentence already drafted ("no claim is made... nor that the
crossover point has been located precisely") — it is the right level of honesty and should not be
strengthened into a general "BDD cannot handle drone-scale networks" claim.

---

## 3. "Broader applicability to Bayesian networks" (R3 comment 8) — safe to claim?

**The risk**: claiming the method "transfers" to Bayesian-network inference invites a PGM-literate
reviewer to ask why, if so, IPA isn't just cutset conditioning with extra steps — undermining the
novelty argument the manuscript makes elsewhere.

**CORRECTED (2026-09-06, in discussion with the author) — the version below fixes a real
imprecision in the first draft, not just a wording polish.** The original recommendation said "the
machinery transfers to source-to-node reachability queries on any directed acyclic probabilistic
model" — this overstates it, and the author's own pushback is the reason why: source-to-node
reachability is a *specific*, narrower computation (a monotone Boolean function — an OR of ANDs of
Bernoulli path indicators), not the general problem Bayesian-network inference solves (arbitrary
conditional probability tables over arbitrary discrete states, no monotonicity assumed). It is
`cutset conditioning itself` (the general method, Pearl 1988) that already applies to general PGM
inference — that is what it was invented for. What is specific to IPA is the *efficient
closed-form update rules built on top of cutset conditioning* (the noisy-OR combination, the
supernode caching keyed by conditioning context) — those are derived specifically for the monotone
reachability structure and would need to be re-derived, not merely reused, for arbitrary CPTs in a
general Bayesian network. IPA is therefore not a generalised PGM tool waiting to be pointed at
Bayesian networks; it is a specialised reachability method that borrows PGM's *strategy*
(condition, decompose, cache), and the imprecise-propagation capability is a further, separate
specialisation on top of that, specific to the monotone structure — not something a standard PGM
engine would get "for free" from sharing the same conditioning strategy. Recommended replacement
paragraph for §4.3/response to R3.8:

> "The relation to exact inference in probabilistic graphical models is with the *general method*
> the present approach specialises, not with a claim that the approach itself generalises to
> arbitrary probabilistic graphical models. Cutset conditioning (Pearl 1988) already applies to
> general Bayesian-network inference; the present method's contribution is a set of closed-form
> update rules — the noisy-OR combination of independent parent signals, and supernode caching
> keyed by conditioning context — derived specifically for the monotone reachability structure of
> the reliability problem, which do not directly carry over to a Bayesian network with arbitrary
> conditional probability tables. What is shared is the width-governed complexity class: the
> method's per-instance cost is exponential in the same structural parameter that governs
> junction-tree inference (Lauritzen and Spiegelhalter 1988) and well-ordered decision diagrams.
> The paper's second contribution, exact imprecise propagation, does not transfer to general PGM
> inference either, and for a stronger reason than scope: for classical (precise) Bayesian
> networks, bounded treewidth guarantees polynomial exact inference, but this guarantee is known
> not to survive the move to imprecise (credal) parameters — bounded-treewidth credal-network
> inference remains NP-hard in general (Mauá and Cozman 2020), and the only known tractable
> relaxation is an approximation scheme, not an exact one (Fagiuoli and Zaffalon 1998, for the
> polytree/binary-variable special case). The present method's width-governed *exact* imprecise
> result is specific to the arithmetic structure of the reachability problem and the explicit
> diamond-conditioning construction; it is not a free consequence of the shared conditioning
> strategy, and does not by itself imply that general credal-network inference could be made exact
> at the same cost."

This is a more precise and more defensible claim than either the original submission's silence on
this point or the first draft of this recommendation, because it correctly scopes IPA as a
specialised method borrowing a general strategy, not a general method being applied to a new
domain — and it still answers "why hasn't someone already done this for Bayesian networks" with a
citable, complexity-theoretic reason. Needs Fagiuoli & Zaffalon (1998) and Mauá & Cozman (2020)
added to the bibliography (see `literature/CITATION_STATUS.md`).

---

## Net effect if all three recommendations are accepted
- §5.4.1 gains a short, explicit "these are proxies, here is exactly how" disclosure (mostly
  already drafted, just needs to survive un-softened).
- §5 preamble gains one paragraph naming the shared BDD/IPA measurement environment; §5.4.3 gains
  one sentence disclosing the caught warm-up bug as evidence of rigour, not hiding it.
- §4.3 (and the R3.8 tracker entry) gains two new citations and a sharper, more defensible
  broader-applicability paragraph.
- Two new bibliography entries: Fagiuoli & Zaffalon (1998), Mauá & Cozman (2020).
