# Viva drill: question, then answer

How to use: cover the answer, say yours aloud, then compare. Do each block until you can give the
answer in one breath. Technical terms have a plain-English version in brackets; use the plain
version if a question comes from outside your field. Numbers are from the corrected thesis.
Sources are in `VIVA_PREP_CHAPTER_REVIEW.md` (section and equation numbers there).

Order of priority: **1 p-box**, **2 Net3 and the correction**, **3 capacity**, **4 schedule (CPM)**,
**5 independence and common cause**, **6 "interval is just a decision diagram at corners"**.

---

## 1. The p-box default (the most likely hotspot)

**Q. Is your p-box result sound?** ("Sound": the true answer is always inside the reported bounds.)
A. With the Fréchet operator, yes, by the Fréchet–Hoeffding bounds (for any two quantities with
given distributions F and G, whatever their dependence, the joint distribution lies between
max(F+G−1, 0) and min(F, G)), applied to p-boxes by Williamson and Downs (1990).
With the default operator, it passed 50 test configurations against Monte Carlo (random
simulation) with no violation, but it is **not proved**. I say so in the thesis as an open question.

**Q. Why can't you prove it?**
A. No theorem covers "positively dependent but otherwise unknown". The natural route, ordering the
dependence between "independent" and "perfectly dependent", fails because the two resulting
distributions cross (neither is always above the other).

**Q. Then why is it the default?**
A. The Fréchet bound is often close to useless on tangled networks; the default is tight, both
branches rise with the same upstream reliabilities, and it has never been violated in testing.
Where a claim must rest on proof I use Fréchet.

**Q. Why not just convolve?** (Convolve: combine two uncertain quantities as if unrelated.)
A. The weight W and 1−W are one quantity, and the two branches share upstream components.
Treating them as independent pushes probability mass outside 0 to 1, by up to 0.34 on the grid.

**Q. What does a p-box buy over an interval?**
A. A bound on a *probability of failing a requirement*: for requirement 0.95 the violation
probability is certified to a band 0.02 to 0.12 wide from one run; simulation would need 267 to
9,604 samples and would only give an estimate.

**Q. What does it cost?**
A. Cost grows faster than the square of the discretisation level (about ×5 to ×8 per doubling).
Use levels 25 to 100, small networks only. KarlNetwork at the default level 200 ran 17 minutes;
at level 50 it took 546 seconds.

**Q. How tight is it?**
A. Band about 0.18 of the range with high reliability and weak tangling, about 0.70 with deep
tangling and broad uncertainty. Always sound, not always tight.

**Numbers:** 0.34 · 50 configurations · 0.18 / 0.70 · 267–9,604 · levels 25–100 · 17 min / 546 s.

---

## 2. Net3 and the correction

**Q. What went wrong and how do you know it is right now?**
A. The 58 demand links into the super-sink (one artificial end point all demand drains into) were
missing from the flow input, so throughput exceeded total demand. Corrected: 680.1 L/s baseline
(the whole demand), 43.3 L/s degraded (6.4%). Checked against an independent Edmonds–Karp
(a separate classical max-flow program), which gives 680.14 and 43.34. The server now refuses such
files. Reliability and schedule results were unaffected.

**Q. Why is the degraded flow only 6.4%?**
A. The snapshot orientation (each pipe fixed to one flow direction taken from one moment of the
simulation). With the river pump out, the lake pump and one discharging tank reach only six
junctions. In reality water could reverse in some pipes; the one-way model cannot show that. A
degraded state needs its own orientation.

**Q. The baseline equals the demand. What does that tell me?**
A. Only that nothing binds at this demand under the assumed pipe capacities (1.5 m/s through the
diameter). It is not a pressure or head check. The informative parts are the degraded case and the
structure (no single point of failure, 401 routes).

**Q. What is the finding?**
A. The river pump (nodes 95 to 97) is in all 24 degraded minimum cuts *and* on the restoration
critical chain (the longest sequence of jobs). Reinstating it is the step both analyses point to.

**Q. Is 74 days a forecast?**
A. No. It is the longest chain in a model where each pipe is recommissioned after the pipes
upstream, with disinfection holds dominating. The finding is where the chain runs.

**Q. What does a belief of 0.806 mean?**
A. Probability that supply reaches that junction with no pipe break in a year along a working
route, with independent breaks. A reliability over a year, not an availability (repairs are not
modelled).

**Q. Is ±5% a modest uncertainty?**
A. On a survival probability of 0.99 it moves the break probability from about 1% to about 6%.
It is a stress test, not a calibrated figure. It compounds along long chains of small pipes,
giving 0.806 → [0.354, 0.990].

**Q. Was Net3 validated?**
A. It is a demonstration of one model serving three analyses. The corrected flow numbers were
checked independently. Reliability and schedule results rest on the proofs and the corpus
validation, not an independent run on Net3 itself.

**Numbers:** 680.1 / 43.3 / 6.4% · 24 cuts · 58 demand edges · 98 nodes, 177 edges (119 + 58) ·
74 days (59–89) · 0.806 · [0.354, 0.990] · width 12, 21 maximal / 307 unique diamonds · 95, 97 and the
super-sink shared.

---

## 3. Capacity (flow) toolkit

**Q. Max-flow with Q = vA is not hydraulics.**
A. Agreed. It is an upper bound under stated capacities. In a real pipe network flow is set by
pressure and head, not chosen to maximise delivery. The toolkit finds which constraint binds and
which failures matter; it does not predict pressures.

**Q. Same for the power example: power does not route like flow.**
A. Right, power follows Kirchhoff's laws (it cannot be steered at will), so max-flow is again an
upper bound. The thesis says operational security (a remaining path overloading) is a separate
question. I oriented the network by the DC power flow at peak load.

**Q. State the minimum-cut result and what changed.** (Picard and Queyranne 1980.)
A. A partition S\* ∪ R is a minimum cut exactly when R is **closed under reachability in the
residual graph** (the graph of remaining spare capacity and reversible flow): if you move a node to
the source side, you must also move any node it can still push flow to. So there are **at most**
2^|F| minimum cuts, not exactly. The submitted text said "exactly"; no reported number changed.

**Q. What is the free zone?**
A. The nodes that can sit on either side of a minimum cut without changing its size. Empty free
zone means the minimum cut is unique.

**Q. What is a saturated edge, and why do you start from them?**
A. A link carrying exactly its capacity in the maximum flow (no spare room). Every minimum cut
consists only of saturated edges, so sensitivity and failure analyses start from them. The
converse is false: a saturated edge need not lie in any minimum cut. In Net3 two pipes (18→17 and
86→87) run full but are in no minimum cut, so they do not limit throughput. Flagship: 41 saturated
edges in design A, 35 in B.

**Q. Give a small example.**
A. Power network with every capacity at 60: free zone {19, 20, 21}, linked as a chain 19→20→21,
so only 4 of the 8 subsets are valid cuts (none, {21}, {20,21}, {19,20,21}).

**Q. Your enumerator is exponential even when there are few cuts.**
A. Yes. It checks all 2^|F| subsets and keeps those whose capacity equals the maximum flow. It
has a `cut_limit` and an `is_complete` flag. |F| was small in every reported case (0, 2, 3, 6). I
would remove the exponential by enumerating closed subsets directly (my reading: this is
possible in the literature; it is not in the thesis).

**Q. Are the 24 minimum cuts distinct as edge sets?**
A. They are distinct node partitions (24 valid out of 64 subsets of the six-node free zone). I did
not check distinctness as edge sets; the "in some" and "in every" edge sets are the edge-level
summaries.

**Q. Is the analysis exact?**
A. Exact on the evaluated candidates. Sensitivity and failure analyses look at saturated edges and
edges in some minimum cut. A small change to any other edge cannot matter, but a large enough one
can, and the k-edge failure search is exhaustive only over the candidates (it refuses above 10,000
combinations). I say this in the discussion.

**Q. How do the thresholds work, and are they exact?**
A. The maximum flow, as a function of one edge's capacity, is concave and piecewise linear (each
possible cut contributes a straight line). If the same cut is minimum at both ends of an interval,
the function is a straight line between them, so the threshold is solved exactly there; otherwise
split the interval. The thesis argues this in prose and validated it by bisection and by checking
just below and above the threshold. It is not a stated theorem. (The "proof" here is my sketch.)
In the interface only degradation thresholds are shown, not upgrade thresholds.

**Q. What is new, honestly?**
A. Not a new max-flow algorithm. The new part is having throughput, the full cut lattice,
sensitivities, failure analysis, thresholds, redundancy and single points of failure on one graph
object, every one checked.

**Q. Point-valued only?**
A. Yes. A best-case and a worst-case capacity are two separate solves. The flow value is monotone in
every capacity, so a range is direct for the value; the cut structure and thresholds are not
monotone and would need new work. Future work.

**Q. How was it validated?**
A. Twelve networks: the three solvers agree with each other and with an external library
(GraphsFlows.jl) exactly; every flow passes capacity, conservation and flow = cut checks; minimum
cuts checked against brute force on networks with up to 20 candidate edges; "in some / in every"
edge sets checked against the enumeration; single points of failure and single-edge failures by
removing each; thresholds by bisection. One error found: node-splitting identifiers collided when
only some nodes carry a capacity (found on the power example), fixed.

**Q. What did the power example (RTS-24) show?**
A. At peak load neither lines nor generators limit delivery: throughput 1,607 MW equals the net
import demand (the 1,243 MW served locally does not enter the network); no single point of
failure; no single line or generator loss reduces throughput. Four generators (buses 1, 2, 13,
16) sit at nameplate and line 7–8 has only 4 MVA headroom, so those bind first if demand grows.

**Q. The two designs A and B?**
A. Same maximum flow, 37.0. A has 41 saturated edges, free zone of 2, four minimum cuts, 15 edges
whose loss matters; B has 35, free zone 0, one cut, 3 edges that matter. Throughput alone cannot
tell them apart; where they bind, and so what to reinforce, can. In A the gateway edges are
upgrade-ineffective (upstream supply is already capped); in B a +1.0 upgrade helps.

**Q. Why report connectivity measures that are zero?**
A. On any DAG the whole-graph connectivity is zero (a sink has no outgoing edge). The module
computes exactly that definition; I left it, and the per-pair disjoint-route counts answer the
redundancy question.

**Q. Scale?**
A. Generated mesh networks up to 36,992 nodes and 107,644 links: the Dinic solver 0.657 s
(second call, one core), the external library 28.9 s. These are a directed variant of the standard
DIMACS family, and the comparison is of implementations on one machine.

**Numbers:** at most 2^|F| · 37.0 · 41/35 saturated · 4 vs 1 cuts · 15 vs 3 edges · 17.0 (≈46%) ·
two-edge worst 37 → 3 · node-capacitated 30.0 · RTS 2,850 / 1,607 / 1,243 · 12 networks ·
107,644 links, 0.657 s · Net3 680.14 / 43.34 / 24 of 64.

---

## 4. Schedule (critical path, CPM)

**Q. Why does the quick bound flag activities the exact method clears?**
A. It mixes two scenarios that cannot happen together: the shortest project from one run and the
longest route through the activity from another. The split uses only real, consistent scenarios.

**Q. The problem is NP-hard. What have you shown?**
A. Not that it is easy. The cost is 2Σ2^|H_v| (a sum over activities of 2 raised to the size of
that activity's bypass set), exponential in the bypass set. Instances with large bypass sets stay
hard; the 5×5 mesh shows it (3.9×10⁷ against 3.4×10⁷).

**Q. Prove the split is exact.**
A. A float is monotone in any one duration, so extremes sit at corners. A duration that cannot
route around the activity can be pushed to its upper bound without lowering the maximum; one that
always passes through the activity, to its lower bound. Both hold whatever the other durations
are, so move them one at a time. Only the bypass durations need enumerating.

**Q. In plain words, the bypass set?**
A. The durations that share a route with this activity and can also go around it.

**Q. Only LongestPath?**
A. Yes. The ShortestPath dual is not derived in full; the toolkit refuses the split for other modes.

**Q. Why no exact method on Net3?**
A. A fixed cut-off: the server tries the split only if there are 60 or fewer uncertain inputs;
Net3 has 122. The thesis names it and proposes pricing the split first.

**Q. Interval edges? p-box durations?**
A. Interval edges: reducible by splitting the edge with a node, not built. p-box durations: not
supported, the margins have the same dependence problem and no corner argument applies.

**Q. Validation?**
A. Path oracle (lists every route) on seven networks, agreement 3×10⁻¹⁴; three networks too big
for that (sampled 2,000 routes plus the accumulation sum, a weaker check); corner enumeration
agreed with the split wherever both ran; 50,000 Monte Carlo samples on the benchmark, no violation,
bounds reached at 30 of 32 nodes.

**Q. Why not just use Monte Carlo?**
A. It gives an estimate, not a certified bound, and can miss rare critical combinations. It is a
check, not the method.

**Q. The four modes and the "allowance"?**
A. Longest, shortest, max-scaling, accumulation. A backward pass exists only if the algebra
supports one. The accumulation "allowance" is headroom under a budget divided across routes, not a
slack against a deadline. Whether a new mode has a backward pass is not checked by the code.

**Q. Why was the earlier interval implementation withdrawn?**
A. The maximum of overlapping intervals describes no real route, and subtracting two dependent
quantities gave [−16, 16] where the true float was exactly 0.

**Q. (Civil) Where do the Net3 durations come from? Are resources modelled?**
A. AWWA disinfection procedure (2 h pressure test, flush, 24 h chlorination, 40 h sampling); one
hour isolation, 8 h pumps, 24 h tanks assumed. Resources are not modelled; the benchmark's resource
requirements are ignored and the precedence-only time (38) matches the recorded value.

**Numbers:** 50,524 vs 2³⁰ (≈21,000×, 4.2 s) · ±20% → [30.4, 45.6] · **5** necessarily critical
(two dummies + activities 23, 24, 30; the slide says 3 *activities*) · 19 possibly vs 26 by the
quick bound · 13 never critical · LongestPath 38, ShortestPath 18, accumulation 362.

---

## 5. Independence and common cause

**Q. Failures are not independent in real networks.**
A. Correct, this is assumption 1 and every result is conditional on it. A common cause (shared
power supply, trench, valve) is modelled as one shared upstream component feeding everything it
affects. Degraded states and reconfiguration are outside the model.

**Q. Components are binary (works or fails)?**
A. Under the reliability interpretation, yes. Partial degradation is available in the capacity
toolkit as a lowered capacity, a separate scenario, not a probability.

**Q. Static topology, one snapshot?**
A. Yes. Acyclicity is a property of one operating snapshot; flow reversal, diurnal demand and
recirculation are excluded. Changes over time are a sequence of separate analyses.

---

## 6. "The interval method is just a decision diagram evaluated at corners"

**Q.** A decision diagram with interval probabilities gives the exact range by evaluating at two
corners. So what is new?
A. For one query, agreed, and the thesis says the corner argument is classical (a monotone
function over a box peaks at its corners). What I offer is the range at **every node in one pass,
without building a diagram**: faster one-shot on all eight families tested (3.9 to 99.9 times), and
the same machinery carries p-boxes, which a diagram cannot. The advantage is for a one-off answer,
not repeated queries on a fixed network, which I did not test.

**Q. And the cost against a decision diagram generally?**
A. No asymptotic advantage for plain numbers. Both grow with the same width. The diagram wins on
dense tangled structure (mesh), they tie on independent structure.

**Q. Why exact for intervals?**
A. Reliability never falls when any input rises (monotone), so the extremes are at all-low and
all-high inputs. The propagation attains that because each uncertain value enters once, and the
weighted step is multilinear (its extremes sit at corners). Agreement with the corner runs was
within 2.8×10⁻¹⁶ on all 129 test networks.

---

## 7. Limits to name first (say before they ask)

Conditioning width about 18 (not "fifty nodes"); p-boxes on small networks only; capacity is
point-valued; exact schedule floats only for LongestPath; one operating snapshot; interface
demonstrated, not tested with engineers; p-box default not proved.

## 8. One-breath summaries

- **Contribution:** one network model, three analyses, with uncertainty carried through instead of
  collapsed to a number first.
- **Why hard:** redundancy means shared routes; treating them as independent gives 0.749 where the
  truth is 0.675.
- **Exact vs sound:** exact = bounds are reached; sound = the truth is inside them.
- **Cost:** exponential in how tangled the shared routes are; same as a decision diagram.
