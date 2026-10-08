# Viva opening: full speaker script

One section per presented slide (the backup slides are in `SPEAKER_NOTES.md`). About 1,220
words: roughly 9.5 minutes at a steady 130 words a minute, nearer 9 at the pace most people
speak when nervous. Learn the shape of each section and
its key numbers, not every word: the examiners will hear it as a talk, not a recital.
*Italic lines* are stage directions, not to be said.

---

## Slide 1: Title (about 10 seconds)

Thank you for having me. My thesis is on information propagation methods for reliability,
reachability and flow analysis in directed acyclic process networks. I will take about ten
minutes to set out what it does, who it is for, and where its limits are.

---

## Slide 2: Who it is for, and the problem (about 1 minute)

Consider the engineer responsible for a process system, for example a water treatment works and
the distribution network it feeds. They ask many questions of that system, and this thesis
addresses three of them. Will supply reach each point when components can fail? How much can the
system deliver, and what limits it? And if it is damaged, how long will it take to restore, and
which tasks are critical?

Each question has its own method and its own software, so the same topology is entered three
times and kept consistent by hand.

*Point to the right-hand column.*

There is a second problem. What the engineer knows is rarely a single number: a failure
probability from three recorded failures, a capacity with a tolerance, a duration given as a
range. The exact methods in common use take one number per input, so that uncertainty is collapsed
before the analysis runs. And the model is often sensitive, so it should stay on the engineer's
machine.

---

## Slide 3: One model, three interpretations (about 1 minute)

The framework starts from one observation. Once the direction of flow is fixed, a process
system of this kind is a directed acyclic graph: components are nodes and dependencies are edges.
The topology is the same for all three questions. What changes is the meaning of the value on a
component: a failure probability, a throughput limit or a duration.

*Point to the figure.*

So the thesis builds one graph object, once, and three toolkits read it. A further analysis would
read the same object.

That leads to the five research questions on the slide: one model for three analyses;
reconvergence identified once; exact reliability under intervals and probability boxes, and its
cost; exact schedule quantities under interval durations; and delivery to an engineer who does
not program. The rest of the talk answers them in turn.

---

## Slide 4: What the engineer does with it (about 1 minute)

Before the methods, here is what using it looks like.

*Run a finger along the workflow strip, left to right.*

The engineer uploads the files they already have, an edge list and one input file per analysis,
inspects the structure, and runs whichever analyses they need. They write no code.

Two rules hold throughout. A result keeps the form its inputs were given in, so an interval comes
back as an interval. And every result names its method, exact, sound or conservative enclosure,
so the engineer knows what kind of answer they are holding. It all runs on their own machine, and
the same methods are a registered Julia package for scripted use.

---

## Slide 5: Will supply reach each point? (about 1 minute 15 seconds)

The reliability question is hard for one reason, and it is the same thing that makes a system
robust: redundancy. Redundant routes split and then rejoin, and they share whatever is upstream of
the split.

*Point to the diamond.*

Here every component works with probability 0.9. If the two routes into node 5 are treated as
independent, the answer is 0.749. The exact answer is 0.675. The simple update overstates
reliability, and on a network built from redundancy it always errs in that direction.

The fix is to condition on the shared fork. If the fork is reached, the two routes really are
independent and the calculation is simple. If it is not, nothing arrives. Weighting the two cases
gives the exact value, 0.675462, from two small sub-problems instead of all two-to-the-nine
states of the uncertain components.

On a real network these diamonds nest and overlap. The Network Decomposition Module finds every one
of them once, with its conditioning set, and I prove that the identification is complete,
deterministic and terminating. This is the core of the thesis.

---

## Slide 6: How sure can the engineer be? (about 1 minute)

The propagation makes one pass over the network, conditioning at each join, and answers in the
form the inputs were given: the exact reliability for numbers, the exact range for intervals,
because reliability is monotone in every input, and sound bounds on the distribution for
probability boxes.

*Point to the figure.*

Here the toolkit's band brackets the Monte Carlo distribution. For point inputs, the results agree
with a decision-diagram oracle to within 10 to the minus 16 across 129 graphs.

I want to be direct about cost. The method is exponential in the largest conditioning set, which
is the same structural width a decision diagram pays. So the gain is not speed. The gain is that
the uncertainty is carried through the analysis instead of being collapsed at the start.

---

## Slide 7: How much can it deliver? (about 40 seconds)

*Left, then the figure.*

For capacity, the toolkit finds the throughput and every minimum cut from one solve, together with
saturated edges, single points of failure and degradation thresholds. Here two designs deliver the
same 37 units, but one has four minimum cuts and the other has one. Throughput alone does not tell
them apart; where they bind, and so what to reinforce, does. The bars show it: in design A fifteen
edges matter if they fail, in design B only three.

---

## Slide 8: How long to restore it, and what is critical? (about 50 seconds)

For schedule, with interval durations the completion time is exact from two runs. The hard
question is which activities are critical whatever the durations turn out to be. In general that
is NP-hard. The domination split varies only the durations that can route around each activity:
on a thirty-activity benchmark, about fifty thousand runs instead of a billion. It found three
activities critical whatever happens, which the fast conservative method could not confirm, and
cleared seven it had flagged. *Point to the figure: the points at zero are critical in every case.*

---

## Slide 9: One water network, three questions (about 1 minute 15 seconds)

To show the claim of one model for three analyses, I took EPANET Net3, a public water network of
97 nodes and 119 edges, and oriented it by its own hydraulic simulation. It was converted once and
analysed by all three toolkits.

Supply reaches the worst-served junction with probability 0.81, and within 0.35 to 0.99 when
every input carries five per cent uncertainty. At baseline the network meets its whole demand of
680 litres per second. Restoration takes 74 days along 28 activities, and between 59 and 89 days
under interval durations.

*Before moving to the figure, give the correction in a steady voice.*

I should say that this result was corrected after submission. The edges from the demand junctions
to the super-sink were missing from the graph the flow analysis was given, so the reported
throughput was above the total demand. The algorithms were correct for the graph they received;
the error was in the inputs and in the interface layer, which did not report the missing edges.
Corrected, and checked against an independent max-flow computation, the network meets its full
demand, and with the river pump out it delivers 43 litres per second. The details are on the
errata sheet.

*Point to the red edge.*

The engineering point is this. The river pump is in every minimum cut of the degraded network, and
it is also on the restoration critical chain. Reinstating it is the step both analyses point to,
and neither shows that alone.

---

## Slide 10: Answers, contributions and limits (about 50 seconds)

So, to the five questions: yes, on the model's stated assumptions; yes, for the probabilistic
interpretation; exact for numbers and intervals and sound for probability boxes, at a cost set by
conditioning width; the completion time in two runs and the floats at a cost set by bypass width;
and yes, through a registered package and a local interface.

*Right column.*

The limits are in the thesis: conditioning width up to about eighteen (roughly fifty nodes of moderate reconvergence), probability boxes on
small networks only, point-valued capacity, one operating snapshot, and an interface not yet
studied with engineers in use. The next steps follow from them, and a public demonstration is
running at the address on the slide.

---

## Slide 11: Thank you (about 5 seconds)

Thank you. I am happy to take your questions.

---

## Delivery notes

- If you are running long, shorten slide 4, since the examiners have read the interface chapter.
  Do not shorten slide 5.
- The correction on slide 9 is said once, plainly, and then you move on. Do not apologise, and
  do not go into the server or interface detail unless asked.
- Numbers to have exact: 0.749 and 0.675; 129 graphs; 37 units, four cuts and one; about fifty
  thousand runs against a billion, three found and seven cleared; 680 and 43 litres per second;
  74 days, 59 to 89.
