# Viva opening, speaker notes

Target: 9 minutes, leaving a minute of slack. The examiners have read the thesis, so the job
is the contribution and its limits, not a chapter-by-chapter retelling.

Every technical term below is followed by a short plain-English explanation in brackets the
first time it appears in each section. Use the plain version aloud if a question comes from
outside your own field; use the technical term when the examiner uses it. A one-page glossary
is at the end.

| Slide | Time | Say |
|---|---|---|
| Title | 0:10 | Name, title, thank them. |
| 2 Who it is for | 1:00 | The engineer responsible for a water works and its network. Three questions, three tools, and the layout of the system (the topology: what connects to what) is typed in three times. What they actually know is a range, but every exact method takes one number. And the model should stay on their own machine. |
| 3 One model | 1:00 | One DAG (directed acyclic graph: a network of components with one-way links and no loops), one graph object (the single data structure holding that network), three toolkits (three sets of analysis methods); only the meaning of the value on each component changes. Read the five questions briefly; the rest of the talk answers them. |
| 4 What the engineer does | 1:00 | The workflow strip, left to right. Their own files, no code; every result keeps its value form (a number stays a number, a range stays a range) and names its method; all on their machine; the same methods are also a registered Julia package (a software library anyone can install). |
| 5 Will supply reach? | 1:15 | Redundancy is reconvergence (two routes that split and later rejoin, sharing what is upstream of the split). 0.749 if you wrongly treat the routes as independent, 0.675 exact; conditioning on the fork (working out the answer separately for "the shared component works" and "it fails", then weighting the two) fixes it with two small sub-problems. The decomposition module finds every such diamond (a split-and-rejoin pattern) once. Core contribution: take the time here. |
| 6 How sure? | 1:00 | Exact for numbers, exact range for intervals (a value known only as "between a and b"), sound bounds for p-boxes (a value known only as a band around a probability curve); agreement of 1e-16 (a sixteen-decimal-place match) with a BDD (binary decision diagram: the standard exact method we check against). Be direct on cost: it grows with the same width as a decision diagram; the gain is carrying the uncertainty through, not speed. |
| 7 Deliver | 0:40 | Capacity: every minimum cut (every smallest set of links whose loss limits the flow), and the A and B designs with the same throughput but different places to reinforce (15 links matter in A, 3 in B). |
| 8 Restore | 0:50 | Schedule: completion time from two runs; "necessarily" and "possibly" critical activities (critical in every case, or only in some) found by the domination split (a method that only tries the uncertain durations that can route around an activity); the PSPLIB numbers (a standard benchmark project network). |
| 9 Net3 | 1:15 | Three headline results, then the correction (script below). End on the river pump: it is in every degraded minimum cut and on the restoration critical chain (the longest sequence of jobs); reinstating it is the step both analyses point to. |
| 10 Answers | 0:50 | One line per question. Name the limits yourself. Point to the demo. |
| Thanks | 0:05 | |

Total about 9:15. If running long, shorten slide 4 (the examiners have seen the interface
chapter) rather than slide 5.

**Backup slides** (19 pages in all; slides 12 to 19) are not presented. Each is titled as the
question it answers, so you can jump to it when that question comes: 12 getting a network in,
13 what would you do next, 14 what changed since submission, 15 why Net3 delivers so little
with the river pump out, 16 exact interval floats despite NP-hardness (NP-hard: no known fast
method for every case), 17 how p-boxes are combined at a diamond, 18 is the p-box result sound,
19 speed against a decision diagram.

## The correction, about 30 seconds (slide 9)

"Since submission I found and corrected an error in the Net3 flow analysis. The 58 demand
edges to the super-sink (a single artificial end point that all the demand junctions drain into,
so total deliverable flow can be read off) were missing from the graph the flow toolkit was
given, so the reported throughput was above the total demand. Corrected, and checked against an
independent max-flow computation (a separate program that finds the largest possible flow), the
network meets its whole demand of 680 litres per second, and with the river pump out it
delivers 43. The reliability and schedule results are unchanged. I also corrected a statement in
Chapter 6: there are at most, not exactly, 2^|F| minimum cuts (|F| is the number of nodes that
could sit on either side of a cut; not every choice of them gives a valid cut); no number
changes. Both are on the errata sheet."

Say it plainly and move on. Do not go into the server or interface bugs unless asked.

## Questions to expect, with short answers

### About the mathematics

- **Are the p-box results sound?** (Backup slides "how are p-boxes combined" and "is the p-box
  result sound".) "Sound" means the true answer is always inside the reported bounds. There are
  two ways to combine the two branches (the two cases "shared component works" and "fails").
  The Fréchet–Hoeffding bound (a classical result that holds whatever the dependence between the
  branches) is sound by a known theorem, but can be wide. The default assumes positive
  dependence (when one branch is high, the other tends to be high too), because both branches
  rise with the same upstream reliabilities. That version is tighter and had no violation in 50
  test configurations against Monte Carlo (checking by random simulation), but it is not
  proved. No theorem covers "positively dependent but otherwise unknown", and the natural proof
  route fails because the two distributions cross (neither is always above the other). So where
  a claim must rest on proof, use Fréchet. Say "not proved" plainly; it is in the thesis as an
  open question.
- **Why not just convolve?** (Convolution: combining two uncertain quantities as if they were
  unrelated.) The weight W and 1−W are one quantity, not two, and the two branches share
  upstream components. Convolving as if independent pushes probability mass outside the range
  0 to 1, by up to 0.34 on the benchmark grid, which is meaningless for a probability.
- **Why did the exact split clear 7 activities the conservative enclosure flagged?** (The
  enclosure is the quick bound from two runs; it is sound, meaning it never misses a critical
  activity, but it is not exact.) It bounds the float (the slack: how far an activity can slip
  without delaying the project) using the lowest project length from one run and the highest
  length through the activity from another run. Those two extremes are generally not reached by
  the same set of durations, so its lower bound on the float can reach zero when no real
  combination of durations makes it zero. Those activities get flagged "possibly critical" but
  always keep some slack. The split tries real combinations, so it gives the exact range and
  removes them. Checked: 50,000 random Monte Carlo samples within the allowed ranges gave no
  violation of the exact bounds (Chapter 7, PSPLIB section).
- **Is it faster than a decision diagram?** No, and the thesis says so. Both cost grows with
  the same structural width (how tangled the shared routes are). For plain numbers neither wins
  across the board. The gain is that ranges and p-boxes are carried through natively, which the
  diagram cannot do. For a one-off interval answer it was faster on all eight families tested,
  because it does not have to build the diagram first.
- **Why not compare with a treewidth or junction-tree method?** (Treewidth: a measure of how
  tree-like a network is. Junction tree: a standard exact method that is exponential in that
  measure.) The width this method pays is a cutset-conditioning width (the number of shared
  nodes you must fix to untangle the routes), and the RESS paper positions it against treewidth
  and junction trees analytically: all are exponential in some width of the graph. The thesis
  benchmarks against a sifted decision diagram (one with its variable order tuned), the standard
  exact reference with a mature software library. A head-to-head against a junction-tree
  program has not been done, and the thesis does not claim to beat treewidth methods.
- **The "about fifty nodes" limit, but you report 97, 242 and 306 nodes?** The limit is the
  conditioning width (the number of nodes that have to be fixed at once), about 18, not the node
  count. Sparse networks of hundreds of nodes are fine; dense or deeply tangled ones are not.
- **Is your result for the published power network wrong?** (Chapter 5, Table 5.3.) At a link
  reliability of 0.99 it matches every published digit; at 0.9 and 0.3 ours is higher by 0.0018
  and 0.0005. The difference is not in our computation: the decision-diagram oracle (an
  independent exact program we check against) agrees to 1e-16, and an exhaustive enumeration of
  all 2^27 combinations of working and failed links (a third, independent check, made after
  submission) gives the same values. The cause on the published side is unresolved; say
  "unresolved", not "transcription".

### About the Net3 case study and the correction

- **How did the error happen?** The server read the edge list and silently ignored capacity
  entries for links that were not in it, so the super-sink links were dropped. It now refuses
  such a file and names the missing links.
- **How do you know the corrected numbers are right?** An independent Edmonds–Karp
  computation (a classical, separate maximum-flow program) gives 680.14 and 43.34, and the
  corrected run reproduces them exactly. Total demand is 680.14, so the baseline is bounded by
  demand, as expected.
- **Why is the degraded flow so low?** With the river pump out, the only sources left are the
  lake pump and one discharging tank, and in the snapshot orientation (each pipe given one fixed
  flow direction, taken from one moment of a hydraulic simulation) they reach only six
  junctions. Physically, water could flow backwards in some pipes; the one-way model cannot
  show that. This is the operating-snapshot limitation: a degraded state needs its own
  orientation (backup slide 15).
- **Is a baseline of "whole demand" evidence that the network is hydraulically adequate?** No.
  It is a capacity bound, with each pipe's capacity taken as an assumed 1.5 metres per second
  through its diameter. It ignores head loss and pressure (the energy and force needed to push
  water through). It says only that nothing binds at this demand; the informative results are
  the degraded case and the structure.
- **Is the 74 days a forecast?** No. It is the longest chain in a model where each pipe is
  recommissioned only after the pipes upstream of it, with the standard disinfection holds
  (waiting periods) dominating. The finding is where that chain runs, not the number.
- **Does the Chapter 6 correction change any result?** No. Configuration A still has four
  minimum cuts and B one; for the 24-bus power system (RTS-24) the free zone (the set of nodes
  that could sit on either side of a cut) is empty. Only the stated theory changes.
- **What would you do differently?** Give degraded states their own orientation; replace the
  fixed cut-off on the number of uncertain inputs (which decides whether the domination split is
  even attempted) with an estimate of the split's own cost (Net3 hit that cut-off).
- **The thesis says no data leaves the user's machine, but there is a website.** The site is
  a public demonstration of the same interface with example networks. The design, and the thesis
  claim, is the local deployment: the package runs as a loopback server (a program that only
  accepts connections from the same computer) on the user's own machine.

## Backup slides

12 Getting a network in. 13 What next. 14 What changed since submission (table, submitted vs
corrected). 15 Why the degraded flow is so low. 16 The domination split (figure). 17 How
p-boxes are combined. 18 Is the p-box result sound. 19 Cost against decision diagrams (figure).

## One-page glossary (plain English)

- **DAG (directed acyclic graph):** components joined by one-way links, with no way to loop
  back to where you started.
- **Topology:** which components connect to which.
- **Graph object:** the single data structure the three toolkits all read.
- **Toolkit:** one family of analysis methods (reliability, capacity, schedule).
- **Fork / join:** a component that feeds two or more others / one fed by two or more.
- **Reconvergence, diamond:** two routes that split at a fork and rejoin at a join, so they
  share whatever is upstream of the fork.
- **Conditioning, conditioning set:** solving the problem separately for each state (working or
  failed) of the shared components, then weighting the answers; the set is those shared
  components.
- **Conditioning width:** the size of the largest conditioning set; the cost doubles with each
  extra shared component.
- **Exact / sound / conservative enclosure:** exact means the reported bounds are actually
  reached; sound means the truth is always inside them; a conservative enclosure is a quick
  bound that is sound but may be wider than needed.
- **Interval:** a value known only to lie between two numbers.
- **p-box (probability box):** a probability distribution known only to lie between two curves.
- **Monotone:** always moves the same way when an input rises (here: reliability never falls
  when a component gets more reliable).
- **Decision diagram (BDD):** a compact exact encoding of a yes/no system; the standard exact
  reference method.
- **Oracle:** an independent program whose answer we trust, used to check ours.
- **Monte Carlo:** estimating an answer by many random trials.
- **Fréchet–Hoeffding bound:** a classical bound on how two quantities can be combined whatever
  their dependence.
- **Maximum flow, minimum cut:** the most that can be delivered, and the smallest set of links
  whose loss limits it; they are always equal.
- **Free zone:** nodes that can sit on either side of a minimum cut without changing its size.
- **Saturated edge:** a link carrying exactly its capacity.
- **Single point of failure:** one component whose loss stops everything.
- **Float (slack):** how far an activity can slip without delaying the whole project.
- **Necessarily / possibly critical:** critical for every allowed duration / for at least one.
- **Domination split:** a method that only tries the uncertain durations that can route around
  an activity, instead of all of them.
- **PSPLIB:** a standard library of benchmark project-scheduling problems.
- **NP-hard:** no known method that is fast on every instance.
- **Net3 / EPANET:** a public example water-distribution network and the software it comes
  with.
- **Snapshot orientation:** fixing each pipe's flow direction from one moment of operation.
- **Loopback server:** a program reachable only from the computer it runs on.
