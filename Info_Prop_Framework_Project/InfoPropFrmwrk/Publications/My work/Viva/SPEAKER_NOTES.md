# Viva opening, speaker notes

Target: 9 minutes, leaving a minute of slack. The examiners have read the thesis, so the job
is the contribution and its limits, not a chapter-by-chapter retelling.

| Slide | Time | Say |
|---|---|---|
| Title | 0:15 | Name, title, thank them. |
| 1 The problem | 1:00 | Three questions of one system; three models, topology entered three times; uncertainty collapsed to a number. Reconvergence is why exact reliability is hard, and the naive update always overstates. |
| 2 One model | 1:15 | One DAG, one graph object, three toolkits reading it. Read the five questions briefly; say the rest of the talk answers them in order. |
| 3 Reconvergence | 1:30 | The worked diamond: 0.749 naive against 0.675 exact. Conditioning on the fork gives the exact value from two sub-problems. The decomposition module finds every diamond once, proved complete, deterministic, terminating. This is the core contribution, so take the time here. |
| 4 Probability | 1:15 | Exact for points, exact range for intervals by monotonicity, sound p-box bounds. Validated against a BDD to 1e-16. Be direct on cost: same structural width as a decision diagram, no asymptotic win; the case is native interval and p-box propagation. |
| 5 Capacity and schedule | 1:15 | Flow: the min-cut lattice, and the A/B example (same throughput, different cut structure). CPM: generalised modes; interval floats are NP-hard, the domination split enumerates only the bypass sets; the PSPLIB numbers. |
| 6 Net3 | 1:15 | One network, three analyses, the three headline results. Then the correction, in your own words (script below). End on the river pump appearing in both analyses. |
| 7 Answers | 1:00 | One line per question. Name the limits yourself. Point to the package and the demo. |
| Thanks | 0:05 | |

## The correction, about 30 seconds (slide 6)

"Since submission I found and corrected an error in the Net3 flow analysis. The 58 demand
edges to the super-sink were missing from the graph the flow toolkit was given, so the
reported throughput was above the total demand. Corrected, and checked against an independent
max-flow computation, the network meets its whole demand of 680 litres per second, and with the
river pump out it delivers 43. The reliability and schedule results are unchanged. I also
corrected a statement in Chapter 6: there are at most, not exactly, 2^|F| minimum cuts; no
number changes. Both are on the errata sheet."

Say it plainly and move on. Do not go into the server or interface bugs unless asked.

## Questions to expect, with short answers

- **How did the error happen?** The server read the edge list and silently ignored capacity
  entries for edges it did not contain, so the super-sink edges were dropped. It now refuses
  such a file and names the missing edges.
- **How do you know the corrected numbers are right?** An independent Edmonds-Karp
  computation in a separate implementation gives 680.14 and 43.34, and the corrected run
  reproduces them exactly. Total demand is 680.14, so baseline is bounded by demand, as
  expected.
- **Why is the degraded flow so low?** With the river pump out, the lake pump and the
  discharging tank reach only six junctions in the snapshot orientation. Physically, flow could
  reverse in some pipes; the oriented model cannot represent that, which is the
  operating-snapshot limitation. A degraded state needs its own orientation (backup slide).
- **Does the Chapter 6 correction change any result?** No. Configuration A still has four
  minimum cuts and B one; RTS-24's free zone is empty. Only the stated theory changes.
- **What would you do differently?** Orient degraded states separately; replace the fixed
  interval threshold for the domination split with its own cost estimate (Net3 hit it).
- **The thesis says no data leaves the user's machine, but there is a website.** The site is
  a public demonstration of the same interface with example networks. The design, and the
  thesis claim, is the local deployment: the package runs as a loopback server on the user's
  own machine.

## Backup slides

1. Corrections since submission (table, submitted vs corrected).
2. Why the degraded flow is so low.
3. The domination split (figure).
4. Cost against decision diagrams (figure).
