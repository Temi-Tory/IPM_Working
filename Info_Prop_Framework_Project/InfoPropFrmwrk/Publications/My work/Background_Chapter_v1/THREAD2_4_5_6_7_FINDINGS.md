# Threads 2, 4, 5, 6, 7 findings — literature search

Research-only log, 2026-08-25, continuing the same run as `THREAD1_THREAD3_FINDINGS.md`. Same
protocol: search, verify at publisher record, log kept and rejected candidates, prefer strong
surveys, foundational sources where the point is foundational, never fabricate.

Note on Thread 1/3 follow-ups requested alongside this pass: the Daud, Ugliotti & Osello (2024)
Web-GIS systematic review (Thread 3, `10.3390/su16104238`) was retried. MDPI's article page
returned HTTP 403 to every WebFetch attempt in this session (direct DOI resolution, the article
page, and the `/pdf` path all blocked), consistent with Temi's read that this is bot-blocking
rather than a real paywall, since Sustainability is fully open access. Full text was not obtained,
but the complete abstract was independently re-verified through a second, different route this
time (the RePEc/IDEAS mirror of the publisher record, cross-checked word-for-word against the
CrossRef-derived summary and multiple independent search snippets from the previous session): all
three now agree verbatim. The abstract confirms 1,775 articles screened, 65 included via PRISMA,
eight subtopics named in full, and explicitly does **not** mention no-code/low-code delivery,
programming requirements, or uncertainty handling in any reviewed platform, so the original
findings file's cautious phrasing (state only what the review's own coverage confirms) was already
correct and needs no revision, only this stronger verification note.

---

## Thread 2 — flow and capacity analysis under uncertainty

The code-level premise (`CapacityAnalysisKit.jl`'s `analyze_all` is `Float64`-only, zero
`Interval`/`pbox` handling) was verified in a prior session per the gameplan and was not
re-checked here; this thread is literature only, to frame that boundary against real prior work.

### Search terms actually used

1. `robust optimization network flow interval capacitated max-flow uncertainty survey`
2. `stochastic-flow network reliability survey message passing decomposition`
3. `"uncertainty theory" Liu uncertain network maximum flow uncertain variable belief degree distinct from probability`
4. `Doulliez Jamoulle 1972 transportation networks stochastic arc capacities foundational reliability`

Plus verification fetches: CrossRef records for the Bertsimas/Nasrabadi/Stiller DOI, and the
Numdam archive page for Doulliez & Jamoulle (no DOI exists for a 1972 RAIRO paper; Numdam is its
stable open-access host).

### Candidates found, verified, and verdicts

| Candidate | What it is (verified) | Verdict |
|---|---|---|
| Bertsimas, D., Nasrabadi, E., and Stiller, S. (2013). "Robust and Adaptive Network Flows." *Operations Research*, 61(5). DOI: 10.1287/opre.2013.1200. Verified at CrossRef. | Robust-optimization treatment of network flow when the network parameters (not just the objective) are uncertain; establishes complexity results (robust max-flow solvable in polynomial time, robust min-cut NP-hard). | **Kept**, as the anchor for the "robust optimization on network flow" side of the landscape the gameplan asked for. This is a worst-case/interval-style treatment, distinct from this thesis's probability-box propagation. |
| Doulliez, P. and Jamoulle, E. (1972). "Transportation networks with random arc capacities." *Revue française d'automatique, informatique, recherche opérationnelle. Recherche opérationnelle*, 6(V3), 45–59. No DOI (pre-DOI-era journal); stable host: Numdam, https://www.numdam.org/item/RO_1972__6_3_45_0/. Verified at the Numdam record. | The foundational paper of the stochastic-flow-network reliability sub-field: arc capacities are discrete random variables, network reliability is the probability the network can deliver a given demand. | **Kept**, as the foundational citation for this sub-field, the same role Ford & Fulkerson play for deterministic flow and Kelley & Walker for CPM elsewhere in this thesis. |
| The wider "stochastic-flow network" reliability literature (Yi-Kuei Lin and many co-authors; this is the same body of work noted adjacent to Thread 1's flagged Camp C, but here approached from its own core territory, not the project-network variant) | Genuine reliability + capacity/flow analysis on networks with multi-state arc capacities, evaluated via minimal-path/cut decomposition methods (state-space decomposition, boundary points, inclusion-exclusion). Point-valued (discrete multi-state) probabilities throughout every source read; no interval or p-box formulation found in this literature. | **Kept as a body of work, not itemised paper by paper** (per the "prefer one strong source over citation-dumping" rule; individual papers in this line were not each independently verified to citation-ready depth, since the point they support, "an established sub-field of decomposition-based flow-network reliability exists, using point probability," is carried adequately by Doulliez & Jamoulle as the founding citation without needing every descendant paper named). |
| Tong, Y. and Tien, I. (2019). "Probability Propagation Method for Reliability Assessment of Acyclic Directed Networks." *ASCE-ASME Journal of Risk and Uncertainty in Engineering Systems, Part A*, 5(3), 04019011. **Already cited in the Probability chapter's bib as `tong2019probability`.** | This directly answers the gameplan's specific question for Thread 2: "check whether stochastic-flow network reliability already cites the same message-passing/decomposition lineage Probability covers, which would let Background cross-reference instead of duplicating." It does. Tong & Tien's method is explicitly a message-passing/belief-propagation-style reliability computation (already surveyed in the Probability chapter alongside Pearl's cutset conditioning and Lauritzen & Spiegelhalter's junction trees), and Tong's own later PhD dissertation (see Thread 6 below) extends the identical method to flow-capacity reliability, showing the connectivity-reliability and flow-capacity-reliability literatures are not two separate lineages but one, at least in this line of work. | **Not re-cited independently here**; already spent in the Probability chapter. Background's Thread 2 section should point at it by cross-reference (`Chapter~\ref{ch:probability-toolkit}`), not duplicate the citation, per the gameplan's own instruction. |
| Liu, Baoding's "uncertainty theory" applied to network max-flow (multiple papers, e.g. "The maximum flow problem of uncertain network," *Information Sciences*, and "Chance distribution of the maximum flow of uncertain random network," *Journal of Uncertainty Analysis and Applications*, 2014) | A genuinely distinct uncertainty formalism from both classical probability and imprecise probability/p-boxes: arc capacities are "uncertain variables" governed by a belief-degree axiom system (Liu, 2007), motivated for cases with no usable frequency data, originally proposed to model **project scheduling** before being extended to network flow. | **Logged, not adopted as a citation-ready source in this pass** (no single paper in this line was independently verified past the abstract level; the point it supports, "the flow-under-uncertainty landscape includes formalisms besides probability and imprecise probability," is worth one sentence in the chapter but does not need a fully-verified individual citation to make that sentence, and forcing one would be citation-dumping for a single passing point). Worth flagging for Temi: Liu's uncertainty theory is yet another instance of a reliability-style computation originating in **project scheduling** before being ported to flow, a small third data point alongside Thread 1's Camp C (multi-state project networks) and Camp B (InfraRisk's restoration scheduling) that scheduling and reliability/flow computation keep independently converging on each other across different literatures, never as one framework. |
| A p-box-specific paper found during Thread 1 searches but properly belonging here: "A probability box representation method for power flow analysis considering both interval and probabilistic uncertainties," *Electric Power Systems Research* or similar (ScienceDirect, S0142061522003866) | Genuinely applies p-box representations to power flow analysis, i.e. imprecise probability propagated through an actual flow computation, in the power-systems domain specifically. | **Logged as a lead, not independently verified to citation-ready depth in this pass** (found via snippet only, full abstract not pulled, ScienceDirect 403 not worked around for this one). If Thread 2's chapter paragraph ends up wanting a concrete example of p-box methods actually reaching a flow computation (as opposed to only reliability computation), this is the lead to chase first; flagged here so it is not lost. |

### Conclusion — Thread 2

The literature on flow analysis under uncertainty is real and long-established, but it splits into
formalisms that do not overlap with each other or with this thesis's own approach: robust/worst-case
optimisation (Bertsimas, Nasrabadi & Stiller) treats capacities as adversarial intervals without a
probability measure at all; stochastic-flow network reliability (founded by Doulliez & Jamoulle,
carried forward by Yi-Kuei Lin's group and, in the connectivity-reliability variant, by Tong &
Tien's message-passing method already cited in the Probability chapter) treats capacities as
point-valued discrete random variables; and Liu's uncertainty theory treats them as belief-degree
"uncertain variables," a third formalism again distinct from probability. None of the three
formalisms found in this search is the interval/p-box treatment this thesis's Probability and CPM
toolkits already give to reliability and schedule, so the Capacity toolkit's current `Float64`-only
scope is a real, nameable gap against an active field, not an oversight next to the other two
toolkits, and not a gap nobody in the wider literature has approached in principle either, since
robust optimisation and Liu's uncertainty theory both represent capacity uncertainty in a
non-probabilistic form without going as far as an interval/p-box treatment specifically.

### Full citations for Thread 2

- Bertsimas, D., Nasrabadi, E., and Stiller, S. (2013). "Robust and Adaptive Network Flows."
  *Operations Research*, 61(5), 1218–1242. DOI: 10.1287/opre.2013.1200.
- Doulliez, P. and Jamoulle, E. (1972). "Transportation networks with random arc capacities."
  *Revue française d'automatique, informatique, recherche opérationnelle. Recherche
  opérationnelle*, 6(V3), 45–59. Stable host: https://www.numdam.org/item/RO_1972__6_3_45_0/.

---

## Thread 4 — Julia versus Python (and R)

### Search terms actually used

1. `Bezanson Edelman Karpinski Shah "Julia: A Fresh Approach to Numerical Computing" SIAM Review 2017 DOI`
2. `JuliaGraphs.jl ecosystem paper graph computation performance overview`
3. `multiple dispatch design pattern numerical generic programming literature Julia`
4. `Hagberg Schult Swart "Exploring network structure dynamics and function using NetworkX" 2008 SciPy DOI`
5. `Python package network reliability computation pgmpy reliability library exists`

Plus verification fetches: CrossRef records for the Bezanson et al. DOI.

### Candidates found, verified, and verdicts

| Candidate | What it is (verified) | Verdict |
|---|---|---|
| Bezanson, J., Edelman, A., Karpinski, S., and Shah, V.B. (2017). "Julia: A Fresh Approach to Numerical Computing." *SIAM Review*, 59(1), 65–98. DOI: 10.1137/141000671. Verified at CrossRef (title, authors, journal, volume, issue, pages, year, publisher all confirmed). | The canonical Julia language paper. Search for the multiple-dispatch design argument specifically (a separate search term per the gameplan) converged back on this same paper and its immediate commentary (e.g. Karpinski's 2013 Strange Loop talk "Julia: The Design Impact of Multiple Dispatch"), confirming the gameplan's own suspicion that the multiple-dispatch argument traces to this source rather than needing a second citation. | **Kept**, as the single anchor for both the language choice and the multiple-dispatch design argument, per the "prefer one strong source" rule. |
| Hagberg, A.A., Schult, D.A., and Swart, P.J. (2008). "Exploring Network Structure, Dynamics, and Function using NetworkX." *Proceedings of the 7th Python in Science Conference (SciPy2008)*, 11–15. DOI: 10.25080/TCWV9851. Verified via the SciPy Proceedings record. | The canonical NetworkX paper, Python's general graph-analysis package. | **Kept**, as the Python-ecosystem comparator at the language/ecosystem level (not the package-internals level the Input Module chapter already owns). |
| JuliaGraphs.jl / `Graphs.jl` ecosystem | Confirmed as the central Julia graph package (SimpleGraph/SimpleDiGraph plus an `AbstractGraph` extension API), with satellite packages for IO, weighted/property graphs, and bindings to external libraries (igraph, nauty). No single citable paper found describing the ecosystem as a whole (unlike NetworkX, which has one canonical paper); its own documentation is the primary source. | **Logged, not independently cited**: mention it in prose as the Julia-ecosystem counterpart to NetworkX, cited to its own documentation/site if the chapter needs a concrete reference, rather than inventing a paper citation that does not exist for it. |
| Python reliability-specific packages (searched directly: does a Python equivalent of the RBD/FTA/BDD reliability-computation tradition exist as a package, the way `Graphs.jl`/NetworkX exist for graphs generally) | No dedicated Python package for network reliability computation (path/cut-set, BDD, or message-passing style) was found. `pgmpy` (Ankan, 2015; JMLR 25, 2024, https://jmlr.org/papers/volume25/23-0487/23-0487.pdf) is a general Bayesian-network/probabilistic-graphical-model toolkit with belief propagation and structure/parameter learning; it is not purpose-built for network reliability and no source found describes it as a reliability tool. | **Logged as a negative finding, not a citation**: this is itself a small piece of evidence for Thread 1's conclusion (no readily available general-purpose reliability tool exists even at the library level in Python specifically), noted here because it surfaced during Thread 4's search, not chased further since a full package-ecosystem audit is out of this thread's scope. |
| R ecosystem equivalent | Not found. No search in this pass surfaced an R package for network reliability or imprecise-probability network computation comparable to Julia's `ProbabilityBoundsAnalysis.jl` (already cited in the Front-End chapter as `gray2021pbajulia`) or R's own `pba.r` (already cited there as `ferson2019pbar`, which per the gameplan's coverage map already IS the R-ecosystem citation Thread 4 would otherwise need). | **Not pursued further**: the R-ecosystem citation Thread 4 needs already exists in the Front-End chapter's bib (`ferson2019pbar`); Background can cross-reference it rather than re-search for a duplicate. |

### Conclusion — Thread 4

The language-level argument for Julia is carried by one source, Bezanson et al. (2017), which
both establishes Julia's design case for numerically generic scientific computing and grounds the
multiple-dispatch mechanism this framework's own generic propagation over `Float64`/`Interval`/
`pbox` depends on; NetworkX (Hagberg, Schult & Swart, 2008) is the citable Python-ecosystem
comparator at the same level, and no equivalent single paper exists for the Julia graph ecosystem
(`Graphs.jl`) or for a Python reliability-specific package, because no such package was found to
exist in Python at all, a small additional data point rather than this thread's main claim.

### Full citations for Thread 4

- Bezanson, J., Edelman, A., Karpinski, S., and Shah, V.B. (2017). "Julia: A Fresh Approach to
  Numerical Computing." *SIAM Review*, 59(1), 65–98. DOI: 10.1137/141000671.
- Hagberg, A.A., Schult, D.A., and Swart, P.J. (2008). "Exploring Network Structure, Dynamics, and
  Function using NetworkX." In *Proceedings of the 7th Python in Science Conference (SciPy2008)*,
  eds. G. Varoquaux, T. Vaught, J. Millman, 11–15. DOI: 10.25080/TCWV9851.

---

## Thread 5 — resilience/reliability terminology

### Search terms actually used

1. `resilience definition engineering infrastructure well-cited Bruneau OR Holling OR Hollnagel framework 2003`

### Candidates found, verified, and verdicts

| Candidate | What it is (verified) | Verdict |
|---|---|---|
| Bruneau, M., Chang, S.E., Eguchi, R.T., Lee, G.C., O'Rourke, T.D., Reinhorn, A.M., Shinozuka, M., Tierney, K., Wallace, W.A., and von Winterfeldt, D. (2003). "A Framework to Quantitatively Assess and Enhance the Seismic Resilience of Communities." *Earthquake Spectra*, 19(4), 733–752. DOI: 10.1193/1.1623497. Verified at CrossRef (all ten authors, journal, volume, issue, year confirmed). | The widely-cited "4R" (robustness, redundancy, resourcefulness, rapidity) framework for infrastructure/community resilience; the paper other resilience-definition papers in civil/infrastructure engineering consistently trace back to, per the sources read for this thread. | **Kept**, as the single definitional anchor the gameplan asked for ("check whether one well-cited definitional paper covers it cleanly rather than compiling several"). |
| Holling, C.S. (1973), the founding ecological-resilience paper | Confirmed as the origin of "resilience" as a formal concept, but in an ecological-systems context (ecosystem stability, not infrastructure), coining the engineering/ecological resilience distinction later authors use. | **Rejected for this thesis's specific use**: correct historically but the wrong domain to anchor an infrastructure-network resilience claim; Bruneau et al. is the domain-appropriate choice and single-source rule favours it alone. |
| Hollnagel, E. (2004 and later), "resilience engineering" | A distinct research programme (monitoring/responding/learning/adapting capacities under stress), more organisational/human-factors than structural-network. | **Rejected**: adjacent field, not the definitional anchor this thesis's source-to-node reachability formalisation needs; would add a second meaning where one already suffices, against the repetition law. |

### Conclusion — Thread 5

One well-cited definitional source covers this cleanly, as the gameplan hoped: Bruneau et al.
(2003) is the standard reference point for infrastructure and community resilience in this exact
sense (robustness and redundancy against component failure), and no second citation is needed for
a light, two-or-three-sentence definitional paragraph.

### Full citation for Thread 5

- Bruneau, M., Chang, S.E., Eguchi, R.T., Lee, G.C., O'Rourke, T.D., Reinhorn, A.M., Shinozuka, M.,
  Tierney, K., Wallace, W.A., and von Winterfeldt, D. (2003). "A Framework to Quantitatively
  Assess and Enhance the Seismic Resilience of Communities." *Earthquake Spectra*, 19(4), 733–752.
  DOI: 10.1193/1.1623497.

---

## Thread 6 — comparable theses

### Search terms actually used

1. `EThOS PhD thesis "diamond decomposition" reliability network imprecise probability`
2. `PhD thesis "imprecise probability" network reliability infrastructure propagation p-box`
3. `PhD thesis reliability "critical path" flow network integrated framework infrastructure "this thesis"`
4. `ethos.bl.uk thesis network reliability decomposition uncertainty engineering`
5. `"Tong" Georgia Tech PhD thesis "Infrastructure Flow Networks" Iris Tien reliability probability propagation dissertation`
6. `smartech.gatech.edu OR proquest "New Approaches for Modeling and Reliability Assessment of Infrastructure Flow Networks"`
7. `"Tong" "Tien" infrastructure flow network reliability connectivity capacity conference paper co-author dissertation Georgia Tech 2020 2021 2022`

### Candidates found, verified, and verdicts

**Worth surfacing prominently, not just logging**: a PhD dissertation was found that combines
network reliability (connectivity) and flow-capacity reliability in one piece of doctoral work, the
closest single comparable thesis found in this search.

- **Tong, Yanjie.** *New Approaches for Modeling and Reliability Assessment of Infrastructure Flow
  Networks.* PhD dissertation, Georgia Institute of Technology, defended 26 April 2021, advised by
  Iris Tien (committee: John E. Taylor, Samuel Coogan, Nagi Z. Gebraeel, Yao Xie). Confirmed via
  Georgia Tech's public thesis-defense announcement and repository metadata (the repository's own
  article page returned HTTP 403 to WebFetch; the title, author, advisor, committee, and defense
  date were independently corroborated across multiple search results, though the full text was
  not read). The dissertation "investigat[es] the reliability [of infrastructure networks] in terms
  of both connectivity and flow capacity" and proposes a "probability propagation method (PrPm)"
  and "directed probability propagation method (dPrPm)" for connectivity, plus a separate
  time-series (pairwise-GRU) approach elsewhere in the thesis.
  **Resolved connection (2026-08-25, Temi)**: the Probability chapter's existing citation,
  `tong2019probability`, is the same Tong. The given name discrepancy flagged in the first version
  of this file (`Yisha` in the Probability chapter's then-existing bib entry versus `Yanjie` in
  every Georgia Tech source found for the 2021 dissertation) was Temi's own error in that earlier
  bib entry, not a genuine ambiguity: she checked CrossRef's metadata for the paper's DOI
  (10.1061/AJRUA6.0001017, independently re-verified here) directly, confirmed the author is
  Yanjie Tong, and corrected `Probability_Chapter_v1/references.bib` herself. The 2019 journal
  paper and the 2021 Georgia Tech dissertation are accordingly the same author's work, not a
  tentative match.
  No schedule/CPM component was found described anywhere for this thesis. No source read describes
  it as using interval or p-box (imprecise) probability; the described methods (probability
  propagation, a GRU-based time-series approach) are point-valued/precise probability throughout.
- **Verdict**: **kept as the strongest comparable-thesis candidate found**, doing reliability
  (connectivity) and flow (capacity) together, i.e. two of the three analyses, in one piece of
  doctoral work, the thesis-level counterpart of Thread 1's Camp A/B commercial and open-source
  findings. Like every Thread 1 candidate, it does not add the third analysis (schedule) and does
  not use imprecise probability.
- Sartor, P. (2013). *Propriétés et méthodes de calcul de la fiabilité diamètre-bornée des
  réseaux* [Properties and computation methods for diameter-bounded network reliability], PhD
  thesis, Université de Rennes I / IRISA. Surfaced during the search for "diamond decomposition"
  network reliability theses (the title's apparent match to "diamond" is a false cognate: the
  French *diamètre* means "diameter," a distance-constrained reliability metric, unrelated to this
  thesis's diamond/reconvergence decomposition). **Rejected**: title collision only, wrong concept
  once checked, not independently verified further given the mismatch was already clear from the
  title's actual meaning.
- General EThOS/UK-specific searching did not surface a UK doctoral thesis matching Thread 1's
  combination as closely as Tong's Georgia Tech dissertation did; EThOS itself was not searched
  directly through its own interface (this session has no direct EThOS query tool; all EThOS-
  adjacent results came through general web search, which returned mostly unrelated common-cause-
  failure and evidential-network theses, e.g. one from the University of Liverpool on common-cause
  failure analysis, not independently verified further as it does not combine reliability with
  flow or schedule).

### Conclusion — Thread 6

One genuinely close comparable thesis was found, Tong's 2021 Georgia Tech dissertation, which
combines network connectivity reliability and flow-capacity reliability (two of the three analyses
this framework combines) using point-valued probability propagation, with no schedule/CPM
component and no imprecise-probability treatment. This is consistent with, not a contradiction of,
Thread 1's finding that no single tool or comparable body of work yet combines all three analyses
with native imprecision handling, and it is confirmed (see the resolved-connection note above) to
be doctoral work behind a paper this thesis already cites in its own Probability chapter.

### Full citation for Thread 6

- Tong, Yanjie. *New Approaches for Modeling and Reliability Assessment of Infrastructure Flow
  Networks.* PhD dissertation, Georgia Institute of Technology, 2021. (Full institutional-repository
  record and handle not independently confirmed past an access error in every session that tried
  it; locate via Georgia Tech's SMARTech/repository system before citing a page or handle number.
  Author identity confirmed against Tong, Yanjie and Tien, Iris, "Probability Propagation Method
  for Reliability Assessment of Acyclic Directed Networks," ASCE-ASME Journal of Risk and
  Uncertainty in Engineering Systems Part A, 5(3), 04019011, 2019, DOI 10.1061/AJRUA6.0001017.)

---

## Thread 7 — scientific software / reproducibility

Per the gameplan, this thread is a coordination point between Background and the not-yet-drafted
Julia package chapter (Chapter~9), not a blocking research item, and it overlaps Thread 4 more than
it needs its own independent literature base. Kept deliberately light.

### Search terms actually used

1. `reproducibility computational science software engineering practices research software citation foundational paper`
2. `"Software citation principles" Smith Katz Niemeyer PeerJ Computer Science 2016 published version`

### Candidate found, verified, and verdict

- Smith, A.M., Katz, D.S., Niemeyer, K.E., and the FORCE11 Software Citation Working Group (2016).
  "Software citation principles." *PeerJ Computer Science*, 2, e86. DOI: 10.7717/peerj-cs.86.
  Verified at the publisher record (peerj.com/articles/cs-86/) and cross-checked against the
  earlier PeerJ Preprints version to confirm it is the same work, later formally published.
  **Kept, conditionally**: usable if the chapter's synthesis section wants one sentence on why the
  framework's own software-engineering practice matters, but `hannay2009scientists` is already
  spent in the Front-End chapter for the adjacent "last mile" point, and stacking a second
  reproducibility citation here risks paying for a meaning (software practice matters) the thesis
  has already paid for once. **Recommendation: do not force a citation into Background for Thread
  7 unless the synthesis section specifically needs one**; leave the substantive reproducibility
  argument, if the chapter wants one, to whichever chapter ends up owning it once Chapter 9 is
  planned, per the gameplan's own open item.

### Conclusion — Thread 7

Genuinely not blocking, as the gameplan said. No new literature base was required beyond confirming
one citable source exists (Smith, Katz & Niemeyer 2016) if a future draft of either this chapter or
the Julia package chapter wants it; the split between the two chapters remains Temi's open decision,
unchanged by this pass.
