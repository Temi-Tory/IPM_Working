# Tab map for the submitted thesis (30 August 2026 copy, 264 pages)

Page numbers are the printed numbers in `thesis_SUBMITTED_30Aug2026.pdf` (checked against that file).
Chapter starts: Ch.1 p.1 · Ch.2 p.11 · Ch.3 p.25 · Ch.4 p.38 · Ch.5 p.59 · Ch.6 p.92 · Ch.7 p.132 ·
Ch.8 p.152 · Ch.9 p.166 · Ch.10 p.181 · Ch.11 p.197 · App. A p.206 · App. B p.215.

**Pages marked ⚠ contain text corrected after submission.** In the room, say "that is on the errata
sheet" and point to the errata, not the page. In this copy there is **no** Picard–Queyranne theorem
(Ch. 6 §6.5.1 says "exactly 2^|F|") and Net3 still shows 1,837.9 and 954.6 L/s.

## Tabs to put on the pages

| Tab | Page | What it supports |
|---|---|---|
| Research questions | 4 (§1.2) | the five questions |
| **Contributions** | 6–7 (§1.4) | the six contributions: the spine of the viva |
| Assumptions | 36 (§3.8) | the four assumptions: independence, binary, static, snapshot |
| Layered order | 30 (Thm 3.4), 31 (Alg 1) | processing order and closures |
| Input contracts | 36 (Table 3.2) | what files each analysis takes |
| Diamond definitions | 41–43 (§4.4) | influencing set, diamond join, maximal, sub-diamond |
| **Algorithm 2** | 45 | recursive diamond identification |
| Thm 4.4 grouping | 45 | |
| Thm 4.5 disjointness, Thm 4.6 termination | 46 | |
| Lemma 4.7 edge isolation | 47 | |
| Prop 4.8 identity | 49 | why the key includes the context |
| **Thm 4.9 completeness** | 50 | |
| Thm 4.10 determinism | 51 | |
| Nested example | 54 (§4.8.3) | two maximal, three unique diamonds |
| Module limits | 57 (§4.9) | genericity untested |
| Monotonicity (Prop 5.1) | 62 | |
| Simple diamond | 63–65 (§5.4) | 0.749 vs 0.675462 (the "2^10" is on p.65; read it as 2^9) |
| Lemmas 5.2–5.5 | 65 (5.2), 66 (5.3, 5.4), 68 (5.5) | the exactness chain |
| Worked network | 69–71 (§5.6.1, Table 5.1) | |
| Table 5.2 | 72 | four named networks vs the oracle |
| Power network | 74 (Table 5.3) | the residual |
| Complexity | 74–76 (§5.8, Table 5.4) | 2k+1, mesh vs diagram |
| **Interval exactness** | 77–78 (§5.9.1, Prop 5.6) | |
| **p-box** | 79–83 (§5.10) | non-convolution (79), two bounds, one proved one open (81), tightness (81), certified bound Table 5.5 (83), cost Table 5.6 (84) |
| Drone case | 84–89 (§5.11, Table 5.7) | Islay [0.562, 0.722] |
| Discussion | 89 (§5.12) | |
| Super-terminal reduction | 97 (Prop 6.1) | |
| ⚠ Min-cut lattice | 104–106 (§6.5.1) | old "exactly 2^|F|" text; see errata |
| Thresholds | 111–113 (§6.5.5) | |
| ⚠ Table 6.2 | 114 | cost per task |
| Flow validation | 114 (§6.7) | twelve networks |
| A vs B designs | 117 (Table 6.3), 123 (Table 6.8) | |
| RTS-24 | 127–129 (§6.8.2, Table 6.9) | |
| Scale | 130 (Table 6.10) | |
| Flow limits | 130 (§6.9) | exact on candidates, point-valued |
| Modes | 135 (Table 7.1) | |
| Kernels | 137 (Alg 5), 138 (Alg 6) | |
| Interval durations | 139–140 (§7.5) | enclosure, exhaustive, split |
| **Split proof** | 141 (Prop 7.1, Lem 7.2, 7.3), 142 (Thm 7.4), 144 (Alg 7) | |
| CPM validation | 145 (§7.7) | |
| PSPLIB results | 146–148 (§7.8.1, Tables 7.2, 7.3) | |
| Boundary of the split | 149 (§7.8.2) | |
| CPM limits | 149 (§7.9) | |
| Package structure | 155 (Table 8.1) | |
| **Validation infrastructure** | 160–161 (§8.7) | the six errors |
| Distribution | 163 (§8.9) | version, DOIs |
| Package limits | 164 (§8.10) | |
| Interface rules | 175 (§9.4) | the four rules, the p-box level gap |
| Interface evaluation, limits | 179 (§9.7–9.8) | no user study |
| Net3 network | 182 (§10.2) | |
| Net3 inputs | 183–185 (§10.3) | ⚠ pages 183–184 mention the capacity input |
| Net3 reliability | 185–188 (§10.4) | node 95 sentence on p.186 (read "upstream") |
| ⚠ Net3 capacity | 189 (§10.5) | old flow numbers; see errata |
| Net3 schedule | 190 (§10.6) | |
| ⚠ Overlay | 192 (§10.7) | old "no node in common" |
| ⚠ Net3 lessons, summary | 194, 196 (§10.8–10.9) | |
| Answers to questions | 198 (§11.2) | |
| ⚠ Contributions, limitations | 201 | |
| Future work | 202 | |
| ⚠ Closing remark | 204 | |
| Networks at a glance | 208 (Table A.1) | |
| PSPLIB spec | 209 (§A.6) | says ±10%: read ±20% |
| Power-network reproduction table | 217 (Table B.1) | |
| Flow validation | 218 (Table B.2) | |
| CPM validation | 220 (Table B.4; also ±10% there: read ±20%) | |
| ⚠ Net3 headline | 220 (Table B.5) | old flow rows |

## Items that differ from the submitted text (all on the errata sheet)

Minimum cuts "at most 2^|F|" · Net3 680.1 / 43.3 L/s · "river pump on both" · PSPLIB ±20% · 2^9 ·
node 95 at the pump inlet · 1.5 m/s an assumed value · eleven names · nine projects · three folders ·
Table B.1 caption · Table B.5 label.
