# Thread 1 broadened findings — comparators outside the reliability/flow/schedule combination

Research-only run, 2026-08-25. No chapter LaTeX written, no `references.bib` entries added, per the
handover's hard stop. This file supplements `THREAD1_THREAD3_FINDINGS.md`; it does not replace it.

## Why this run exists

Temi flagged that the original Thread 1 search only looked for tools combining *this thesis's own
three specific analyses* (reliability/reachability, capacity/flow, schedule/CPM). The thesis's
actual architectural claim is broader: one shared network representation supporting more than one
*kind* of analysis, whatever those kinds happen to be. This run searched for that broader category,
regardless of which specific analyses a candidate combines.

## FLAGGED DECISION — read before anything else

**This search found a genuinely close comparator, and it is a stronger match to the broadened
question than anything in the original Thread 1 file.** It sits in a domain (electrical power
systems engineering software) neither the original Thread 1 search nor the chapter currently
discusses, so this is new ground, not a re-hit of existing material.

**`pandapower`** (Thurner, Scheidler, Schäfer, Menke, Dollichon, Meier, Meinecke, and Braun, 2018,
*IEEE Transactions on Power Systems* 33(6), DOI 10.1109/TPWRS.2018.2829021, open-access preprint
arXiv:1709.06743). Verified via CrossRef (existence, authors, venue, year, DOI) and by reading the
full abstract on arXiv (the authors' own preprint of the same paper). This is an open-source,
BSD-licensed Python power-system analysis tool. Its network model is an explicit discrete graph
object: buses, lines, transformers and switches, held in pandas tables, connected by topology, not
a continuum mesh. Against that one shared network object it runs **five analyses that are genuinely
different in kind, not variants of one algorithm**: power flow (forward steady-state simulation,
Newton-Raphson), optimal power flow (constrained optimisation over control variables), state
estimation (a statistical inverse problem, fitting network state to noisy measurements), topological
graph search (pure connectivity, no physics), and short-circuit calculation to IEC 60909 (a
different physical regime and equivalent-circuit model from normal load flow). This diversity of
analysis *paradigm*, simulation vs optimisation vs statistical estimation vs graph search vs fault
analysis, all against one shared network object, is the closest thing this run found anywhere to
the thesis's own "one network, several kinds of analysis" pattern. A follow-up search confirmed this
is not a one-off: it is a recognised convention in commercial power-system analysis software too
(DIgSILENT PowerFactory and, per its own product literature, PSS/E both bundle load flow, short
circuit, optimal power flow and dynamic/stability analysis against one grid model), so `pandapower`
is presented here as the clearest documented instance of an established software-category pattern,
not an isolated curiosity.

**The boundary, stated plainly:** no interval or p-box uncertainty support was found native to
`pandapower` in this search (a specialised p-box power-flow method exists in the *research
literature*, e.g. a 2022 paper in a different venue, but it is not part of the `pandapower` tool
itself). None of its five analyses is this thesis's reliability/reachability, capacity/flow, or
schedule/CPM computation in the specific senses this thesis uses those terms; "power flow" here is
the physics of Kirchhoff's laws over an AC/DC circuit, not combinatorial max-flow-style
capacity-constrained flow. So `pandapower` does not narrow the thesis's own three-analysis novelty
claim (already addressed in the original Thread 1 file). What it does do is undercut, at least
partially, any implicit suggestion that "one network representation, several kinds of analysis" is
itself a novel architectural pattern in engineering software generally: it demonstrably is not, in
at least one adjacent engineering discipline. Whether and how the chapter should acknowledge this is
Temi's call, per the handover's boundary on judgement calls that shape the novelty framing, not this
run's.

**Secondary, weaker comparators** worth Temi's awareness but not rising to the same strength (detail
and verification in the tables below): ArcGIS Utility Network (utility engineering, one shared
graph-based network model, eight distinct trace types, but the trace types are variants of graph
traversal under different rules rather than distinct analysis paradigms the way `pandapower`'s five
are) and the Cytoscape app ecosystem (one shared `CyNetwork` object, genuinely diverse analysis
types across independently authored apps, but the domain is molecular biology, not engineering, and
Cytoscape is already cited in `UI_Chapter_v2` for a different point, see below).

---

## Search terms actually used (log, in order run)

1. `Neo4j Graph Data Science library algorithms centrality community detection shortest path pathfinding`
2. `NetworkX igraph algorithms shortest path max flow centrality community detection same graph object`
3. `ANSYS multiphysics shared model structural thermal fluid electromagnetic simulation one mesh`
4. `COMSOL Multiphysics single model multiple physics interfaces coupled simulation`
5. `"object-oriented" interdependent infrastructure "generalized network-system analysis" author title abstract`
6. `Ouyang "generalized modeling framework" interdependencies infrastructure systems review flow-based topology-based`
7. `igraph R Python max_flow shortest_paths betweenness community_detection same graph object documentation`
8. `ArcGIS Network Analyst routing capacity analysis multiple analysis types same network dataset`
9. `interdependent infrastructure systems of systems modeling platform multiple analysis types shared network representation review`
10. `Sharma Gardoni 2022 "generalized flow network objects" interdependent infrastructure abstract Reliability Engineering System Safety DOI`
11. `web-GIS platform multiple analysis layers routing risk capacity demographic shared spatial network data model`
12. `"digital twin" network graph representation multiple analysis types infrastructure engineering explicit graph object`
13. `"Comprehensive digital twin for infrastructure" ontology graph-based modelling paradigm authors DOI Advanced Engineering Informatics abstract`
14. `"10.1016/j.aei.2024" "digital twin" infrastructure ontology graph-based modelling paradigm Tao Li DOI`
15. `networkx dag_longest_path critical path PERT CPM function documentation`
16. `Cytoscape apps network flow analysis pathway enrichment clustering different analysis types app store`
17. `FEMA Hazus multi-hazard loss estimation lifeline network module structural economic casualty analysis shared model`
18. `"network science" platform toolkit multiple analysis types domain-specific engineering review category comparison`
19. `Esri ArcGIS Utility Network trace analysis connectivity isolation capacity load flow shared network data model`
20. `Cytoscape "same network" apps operate shared graph object core data model documentation`
21. `FEMA Hazus transportation lifeline network connectivity analysis graph model methodology`
22. `Cytoscape CyNetwork "shared" apps API architecture Java Swing multiple apps same network instance`
23. `Ouyang Duenas-Osorio Min "multilayer infrastructure network" market interdependency multiple distinct analysis`
24. `Hazus GIS "transportation network" model graph nodes links analysis methodology technical manual highway bridges`
25. `"PSFC" "Pathway Signal Flow Calculator" Nersisyan F1000Research 2016 DOI`
26. `electric distribution network model graph based platform load flow analysis AND connectivity trace analysis same network model software`
27. `Gephi plugins marketplace shortest path centrality statistics different algorithms same graph`
28. `pandapower "power flow" "short circuit" "state estimation" "optimal power flow" one network object open source paper Thurner`
29. `pandapower interval uncertainty probabilistic power flow p-box native support`
30. `DIgSILENT PowerFactory OR PSS/E "load flow" "short circuit" "stability" "optimal power flow" one network model integrated suite`

Plus direct verification fetches: CrossRef API records for the Sharma & Gardoni and Thurner et al.
DOIs, the arXiv preprint abstract for the `pandapower` paper, Esri's own documentation
(`doc.esri.com`) for ArcGIS Network Analyst and the Utility Network trace framework, Cytoscape's own
javadoc API reference (`cytoscape.org/javadoc`) for the `CyNetwork`/`CyRootNetwork` shared-object
model, COMSOL's own product page, a RePEc/IDEAS mirror of the Sharma & Gardoni abstract (ScienceDirect
itself returned HTTP 403, the same pattern noted throughout the original Thread 1 file), PMC for the
PSFC paper, and Wikipedia plus an Ansys reseller/partner page for Ansys Workbench (Ansys's own site,
now under `ansys.synopsys.com` following the Synopsys acquisition, returned HTTP 403 to every fetch
attempted, both the redirect target and a direct product-page URL).

---

## Candidates found, verified, and their verdicts, by category

### Category 1: multiphysics / multi-domain engineering simulation platforms

| Candidate | What it actually does (verified) | Verdict |
|---|---|---|
| **ANSYS Workbench** | Genuinely runs structural, thermal, fluid, and electromagnetic physics solvers together, with "Direct Coupling" letting several physics share a single model and mesh for highly coupled cases (Joule heating, thermal-structural coupling). Confirmed consistently across Wikipedia, an Ansys channel-partner page (PDSVision), and an Ansys Elite Partner technical blog (PADT); Ansys's own site returned HTTP 403 to every automated fetch attempted, both `ansys.com` (which now 301-redirects to `ansys.synopsys.com`) and the redirect target directly, so this rests on independently consistent secondary sources rather than the vendor's own page, the same fallback pattern the original Thread 1 file used for ScienceDirect. | **Rejected as a network/graph-object comparator.** The shared representation is a continuum finite-element mesh and CAD geometry, not a discrete network/graph object of nodes and edges. Genuinely multi-analysis, wrong kind of "shared model." |
| **COMSOL Multiphysics** | Couples fluid flow, heat transfer, structural mechanics, acoustics, electromagnetics, chemical reactions, and user-defined equations, with "any number" of physics interfaces addable to one model. Verified directly on COMSOL's own product page (`comsol.com/comsol-multiphysics`), which fetched successfully: the modelling workflow is explicitly "Geometry and CAD... Meshing... Solvers," i.e. one shared geometric/mesh domain with physics layered on top. | **Rejected, same reason as ANSYS**, and more firmly verified since COMSOL's own page was directly readable. This is the clean, publisher-confirmed instance of the distinction the gameplan asked this run to capture: a real multi-analysis engineering platform whose "shared model" is a continuum mesh, not a graph. |

**Category conclusion**: the multiphysics category is a genuine, well-established pattern of "one
shared model, several distinct kinds of physics analysis," but it is architecturally a different
pattern from this thesis's network/graph-object representation. This is worth stating in the
chapter as a considered exclusion, not an oversight, if Temi decides the point is worth a sentence.

### Category 2: general graph-analytics platforms and libraries

| Candidate | What it actually does (verified) | Verdict |
|---|---|---|
| **NetworkX** | Confirmed via its own documentation (`networkx.org`): shortest paths, flows (including max-flow), centrality, community detection, connectivity, matching, cliques, cycles, traversal, isomorphism, planarity, and tree algorithms, all implemented against the same `Graph`/`DiGraph` class. Also has `dag_longest_path`, a generic longest-path-in-a-DAG function that *could* be pressed into service for critical-path computation but is not delivered as a CPM/PERT feature (no float, no slack, no activity-network semantics). | **Rejected as a new find**: already cited in this very chapter, `Background_Chapter.tex` \S2.6 ("Languages and Ecosystems for Network Computation"), via `hagberg2008networkx`, for a different point (single native numeric type, no interval/p-box support). The multi-algorithm facet verified here is real but additive to a citation already spent in this chapter for its stronger point; citing it twice for two different facets risks exactly the citation-dumping the handover warns against. Logged so this fact does not need rediscovering. |
| **igraph** (R and Python) | Confirmed via its own documentation and API reference: `shortest_paths`, `betweenness`, `max_flow` (with the max-flow min-cut relationship explicit in the docs), and `cluster_edge_betweenness` for community detection all operate on the same graph object. | **Rejected**: same reasoning as NetworkX, generic graph-theory algorithms, not domain-specific engineering analyses, and not previously cited anywhere in this chapter series so at least a clean negative finding rather than a duplicate. |
| **Neo4j Graph Data Science (GDS) library** | Confirmed via Neo4j's own documentation (`neo4j.com/docs/graph-data-science`): over 45 algorithms across centrality, community detection, similarity, path finding, DAG algorithms, node embeddings, and topological link prediction, all against one graph held in the database. | **Rejected**: same reasoning, generic graph-theory algorithm library (the vendor's own framing is "different problem classes" of graph algorithm, not domain-specific engineering analyses), applicable across arbitrary domains rather than built for one. |
| **NetworKit / EasyGraph / SNAP** | Surfaced repeatedly as high-performance, Python/C++ hybrid graph-analysis toolkits (connected components, clustering coefficients, community detection, centrality, graph generators). | **Rejected on the same grounds without individually re-verifying each one to citation depth**, per the handover's own preference for one strong characterisation over a list of narrow near-duplicates; logged here so a future pass does not need to rediscover that this whole sub-category shares the same profile as NetworkX/igraph/Neo4j GDS. |
| **Gephi** | Confirmed via its own documentation (`docs.gephi.org`): built-in Statistics panel computes average path length, betweenness and closeness centrality, connected components, degree, degree power law, diameter, eigenvector centrality, graph density, HITS, modularity, and PageRank, all against the loaded graph, with a plugin marketplace for additional metrics. | **Rejected as a new find**: already cited in `UI_Chapter_v2/Front_End_Chapter.tex` (`bastian2009gephi`) and explicitly described there as carrying "no quantitative reliability analysis." The Statistics panel's algorithms are the same generic graph-theory family as NetworkX/igraph, confirming that description remains accurate; this facet does not change or add to what Front-End already says. |
| **Cytoscape** (core platform) | Confirmed via Cytoscape's own Swing App API javadoc (`cytoscape.org/javadoc`): `CyNetwork` is the shared network/graph data-structure interface; `CyRootNetwork` provides shared node, edge, and network tables used by all subnetworks derived from it; third-party apps access and create networks through OSGi services (`CyNetworkFactory` etc.), confirming apps genuinely share one in-memory network object rather than each holding a private copy. | **Kept, flagged above.** Already cited in `UI_Chapter_v2/Front_End_Chapter.tex` (`shannon2003cytoscape`) for visualisation only, with the same "carry no quantitative reliability analysis" framing as Gephi. This run's finding is a genuinely different facet from that citation's point: Cytoscape's *app ecosystem*, not its core, delivers real distinct analyses over the shared `CyNetwork` object. Three concrete, independently authored app families confirm this: **PSFC** (Nersisyan et al., pathway signal-flow propagation, a topological/flow-style analysis, verified via PMC and CrossRef-adjacent PubMed record), **clusterMaker2 / AutoAnnotate** (graph clustering and cluster summarisation), and the **Functional Enrichment Collection** (stringApp, WikiPathways, ReactomeFI, statistical pathway-enrichment analysis, verified via the Cytoscape App Store's own listing page). These three are genuinely different analysis paradigms (signal propagation, graph partitioning, statistical enrichment testing), not three views of one algorithm, on the same shared network object. The domain is molecular biology and bioinformatics, not engineering, and no interval/p-box handling was found or expected in this ecosystem. |

**Category conclusion**: general graph-analytics libraries and platforms genuinely run many
algorithms against one shared graph object, but for the mainstream tools (NetworkX, igraph, Neo4j
GDS, Gephi, NetworKit and peers) those algorithms are generic graph-theory metrics, not
domain-specific engineering analyses, matching the rejection template the gameplan anticipated
almost exactly. Cytoscape is the one member of this category whose *app ecosystem* breaks that
pattern with real domain-specific analytical diversity, just in the wrong domain for this thesis.

### Category 3: GIS and utility-network multi-analysis platforms

| Candidate | What it actually does (verified) | Verdict |
|---|---|---|
| **ArcGIS Network Analyst** | Confirmed via Esri's own documentation (`doc.esri.com`): six distinct solvers, Route, Closest Facility, Service Area, Origin-Destination Cost Matrix, Location-Allocation, and Vehicle Routing Problem (which includes capacity constraints, matching vehicle capacity to order quantities), all run against one shared network dataset so an organisation does not need to maintain separate copies per analysis type. | **Kept as a category member, flagged above as the weaker of the two ArcGIS entries.** All six solvers belong to the transportation-routing/logistics-optimisation family (shortest-path variants under different constraints), not heterogeneous analysis domains the way `pandapower`'s five are. Real "one shared network object, several solvers" pattern, genuine engineering/logistics domain, but narrower diversity of analysis kind than the flagged comparators above it. |
| **ArcGIS Utility Network** | Confirmed via Esri's own documentation (`doc.esri.com`, both the trace-types reference page and Esri's own technical blog on the trace framework): models power, gas, and water networks as an explicit graph of features (junctions and edges) connected through topology, organised into domain networks and tiers. Supports eight to nine distinct trace types, connected, subnetwork, subnetwork controllers, upstream/downstream, loops, path (shortest path), isolation, and circuit (telecom), plus "functions" that compute engineering quantities (e.g. sum of traced wire length, aggregated load) along a trace. All traces run against one unified network topology. | **Kept, flagged above.** This is a genuine engineering domain (electric, gas, and water utility engineering) with an explicit discrete network/graph data model and multiple distinct analyses (isolation planning for outage management, loop/mesh detection for load-balance issues, subnetwork/tier discovery for protection-zone boundaries, connectivity verification) delivered as a real commercial product, not a research prototype. The honest limit: the trace types are variants of one underlying graph-traversal engine under different configuration rules, not distinct analysis *paradigms* the way `pandapower`'s power-flow/OPF/state-estimation/graph-search/short-circuit split is; no capacity-constrained flow computation, no probabilistic reliability computation, no schedule/CPM, and no interval/p-box handling found. |

**Category conclusion**: GIS/utility platforms are a real instance of "one shared network dataset,
several distinct solvers," strongest in the utility-engineering sub-case (ArcGIS Utility Network),
weaker in the general routing sub-case (ArcGIS Network Analyst) where the solvers are closer
variants of each other.

### Category 4: interdependent-infrastructure / systems-of-systems modelling platforms

| Candidate | What it actually does (verified) | Verdict |
|---|---|---|
| **Sharma, N. and Gardoni, P. (2022)**, "Mathematical modeling of interdependent infrastructure: An object-oriented approach for generalized network-system analysis," *Reliability Engineering & System Safety* 217, 108042, DOI 10.1016/j.ress.2021.108042 | Verified via CrossRef (title, authors, journal, volume, year, DOI) and via a RePEc/IDEAS abstract mirror (ScienceDirect itself returned HTTP 403). Models each infrastructure as a "generalized flow network object" and connects several such objects with dynamic interfaces to represent bilateral and looped interdependencies, "enabling infrastructure-specific multi-fidelity analyses." | **Rejected, on close reading of the abstract.** "Multi-fidelity" here means each infrastructure-specific network object can be modelled at a different *level of resolution/detail*, not that genuinely different *kinds* of analysis are run. Every object in the formulation is still a flow-network object; the paper's own framing (favouring "simpler models such as topological connectivity and maximum flow algorithm") confirms the analysis performed throughout is flow-family analysis, just federated across interdependent networks at variable fidelity. This is one analysis type applied at variable resolution, not several analysis types on one shared object, closer to Thread 2's territory than this run's. |
| **Zhang, P. and Peeta, S. / Ouyang, M.** multilayer-infrastructure-network line of work (market-based interdependency modelling via computable general equilibrium theory) | Confirmed via multiple independent search results (ScienceDirect abstracts, RePEc, ResearchGate, and a review paper on modelling and simulation of interdependent critical infrastructure) as a real, actively cited line of work modelling each infrastructure system as its own network layer, connected to others through market/economic interactions rather than physical interfaces. | **Rejected.** This is architecturally the opposite of what this run is searching for: each infrastructure gets its own separate network layer, analysed with essentially the same style of flow/equilibrium computation as every other layer, rather than one shared network object carrying multiple distinct analysis types. Matches the rejection template "combines analyses but each on a separate copy of the data, not one shared network object" precisely. |
| **FEMA Hazus** (multi-hazard loss-estimation software, current version Hazus 7.0, 2024) | Confirmed via FEMA's own technical manuals (`fema.gov`) and Wikipedia: a GIS-based platform that estimates direct and indirect losses (structural damage, casualties, economic loss, debris) across earthquake, flood, and hurricane hazard models, using a shared building/infrastructure inventory overlaid with hazard layers. Transportation and lifeline components (highways, bridges, rail, power, water) are present as classified inventory items with fragility/damage functions. Searched specifically for a formal network/graph connectivity or flow computation as Hazus's own native methodology; not confirmed in any manual or source read. One MDPI paper found (Bridge Network Seismic Risk Assessment Using ShakeMap/HAZUS with Dynamic Traffic Modeling) pairs Hazus's own damage/loss output with a *separate, external* traffic-network simulation tool to get network-level results, rather than Hazus performing that network analysis itself. | **Rejected.** Genuinely combines several distinct consequence analyses (structural damage, casualty estimation, economic loss, debris generation) over one shared spatial inventory, so it is a real multi-analysis platform in spirit, but (a) the shared representation found and confirmed is a GIS spatial/tabular inventory, not a confirmed graph/network object as its core analytical data structure, and (b) where genuine network-level analysis (e.g. traffic flow after bridge damage) is wanted, the documented pattern is pairing Hazus with a separate external tool, the same "separate tools stitched together" pattern already logged as out of scope in the original Thread 1 and Thread 3 files. Logged with the same "weaker, not independently confirmed at the right level" caveat the original Thread 1 file used for IN-CORE. |
| **Li, T., Rui, Y., Zhu, H., Lu, L., and Li, X. (2024)**, "Comprehensive digital twin for infrastructure: A novel ontology and graph-based modelling paradigm," *Advanced Engineering Informatics* 62(B), DOI 10.1016/j.aei.2024.102747 | Verified via CrossRef-adjacent search records and an OUCI mirror page (ScienceDirect itself not fetchable). Proposes an ontology of five elements (scenario, virtual model, physical entity, relation, component) and a graph-represented Infrastructure Digital Twin (IDT) paradigm "to integrate various types of data" for "multi-scale, multi-object, multi-professional, and cross-scenario infrastructure objects." | **Rejected, but flagged as unresolved rather than cleanly negative.** Every source read (search-engine summaries, the OUCI mirror, reference-list framing) describes this paper's contribution as data integration, interoperability, and semantic representation, not as a description of distinct analysis algorithms run over the graph. No source read confirmed or denied whether the paper's case studies actually execute multiple distinct engineering analyses against the graph, only that the paper's own emphasis, on every source available to this search, is representation and integration rather than analysis. The full text sits behind a paywall this session could not clear; if this line is ever chased further, the primary text itself needs reading before any claim is made either way. |

**Category conclusion**: the interdependent-infrastructure modelling literature that most closely
matches the title-level language of "generalized," "multi-fidelity," or "multi-professional"
network analysis, on close verification, turns out either to still be single-analysis-type work
federated across network layers (Sharma & Gardoni), architecturally the opposite pattern of separate
per-layer copies (Ouyang/Zhang & Peeta), a spatial-inventory tool rather than a confirmed
network/graph-object tool (Hazus), or unresolved pending full-text access (Li et al.). Nothing in
this category rises to the strength of the Category 3 or `pandapower` findings above.

---

## Full citations for anything worth citing from this run

- Thurner, L., Scheidler, A., Schäfer, F., Menke, J.-H., Dollichon, J., Meier, F., Meinecke, S., and
  Braun, M. (2018). "pandapower—An Open-Source Python Tool for Convenient Modeling, Analysis, and
  Optimization of Electric Power Systems." *IEEE Transactions on Power Systems*, 33(6). DOI:
  10.1109/TPWRS.2018.2829021. Open-access preprint: arXiv:1709.06743. Verified at CrossRef and by
  reading the authors' own preprint abstract in full.
- Nersisyan, L., Johnson, G., Riel-Mehan, M., Pico, A.R., and Arakelyan, A. (2015, revised 2017).
  "PSFC: a Pathway Signal Flow Calculator App for Cytoscape." *F1000Research*, 4:480. DOI:
  10.12688/f1000research.6706.2. Verified via PMC (PMC4706054) and cross-checked against PubMed and
  the paper's own F1000Research listing.
- ArcGIS Utility Network. Vendor documentation (Esri): trace types reference
  (https://doc.esri.com/en/arcgis-pro/latest/help/data/utility-network/utility-network-trace-types.html)
  and the Esri technical blog "Exploring the ArcGIS Utility Network Trace Framework"
  (https://www.esri.com/arcgis-blog/products/utility-network/data-management/exploring-the-arcgis-utility-network-trace-framework).
  Cite as a software product, not a paper, if used.
- ArcGIS Network Analyst. Vendor documentation (Esri):
  https://doc.esri.com/en/arcgis-pro/latest/help/analysis/networks/what-is-network-analyst-.html
- Cytoscape core platform, already cited in `UI_Chapter_v2` as `shannon2003cytoscape` (Shannon et
  al., 2003, *Genome Research*). If the app-ecosystem facet is ever cited separately from the
  visualisation facet, Cytoscape's own Swing App API javadoc
  (https://cytoscape.org/javadoc/current_release/org/cytoscape/model/CyNetwork.html) is the primary
  source for the shared-object architecture claim.
- COMSOL Multiphysics. Vendor product page: https://www.comsol.com/comsol-multiphysics
- Ansys Workbench. No vendor page was fetchable in this session (HTTP 403 throughout); if ever
  cited, re-attempt the vendor's own site first, since a channel-partner or reseller page is a
  weaker source than the vendor's own record.
- Sharma, N. and Gardoni, P. (2022). "Mathematical modeling of interdependent infrastructure: An
  object-oriented approach for generalized network-system analysis." *Reliability Engineering &
  System Safety*, 217, 108042. DOI: 10.1016/j.ress.2021.108042. Logged for completeness; rejected as
  a comparator, see table above, so not recommended as a citation for the multi-analysis claim, only
  worth citing if the chapter ever needs an example of federated flow-network interdependency
  modelling specifically (Thread 2 territory, not this thread's).

---

## Notes for Temi

- The strongest finding of this run, `pandapower` (and, more broadly, the power-system-analysis
  software category it belongs to alongside commercial tools like DIgSILENT PowerFactory), sits
  outside every category the original Thread 1 gameplan anticipated. It was found by following the
  GIS/interdependent-infrastructure search thread into electrical-engineering-specific software,
  not from the gameplan's own suggested search terms, worth knowing in case future passes want to
  search electrical, mechanical, or other single-engineering-discipline analysis suites more
  directly next time rather than finding them incidentally.
- Both Gephi and Cytoscape were re-examined here for a facet (multi-algorithm/multi-app capability)
  distinct from the facet they are already cited for in `UI_Chapter_v2` (visualisation only, no
  analysis). For Gephi, the new facet does not change anything, the algorithms are the same generic
  graph-theory family already implied by "no quantitative reliability analysis." For Cytoscape, the
  new facet is genuinely additive and is why Cytoscape appears in the flagged section above; whether
  it is worth a second, separately-scoped citation in the Background chapter alongside the existing
  Front-End citation, or a cross-reference between the two chapters, is a structural call for Temi,
  not this run's.
- ScienceDirect and Ansys's own site (`ansys.com`, now redirecting to `ansys.synopsys.com` following
  the Synopsys acquisition) both returned HTTP 403 to every automated fetch attempted in this
  session, the same blocking pattern the original Thread 1 file documented for ScienceDirect alone.
  Every claim resting on a source that blocked direct fetch was instead verified through an
  independent secondary source (CrossRef, a RePEc/IDEAS mirror, a channel-partner or reseller page
  cross-checked against Wikipedia) rather than left on a single unverified snippet.
- Categories searched and covered: multiphysics/multi-domain simulation platforms, general
  graph-analytics platforms and libraries, GIS and utility-network platforms,
  interdependent-infrastructure/systems-of-systems modelling platforms, and (folded into the
  interdependent-infrastructure category once it surfaced there) infrastructure digital-twin
  ontology work. No dedicated "scientific workflow toolkit for network science" category distinct
  from the general graph-analytics libraries already covered was found to exist as its own
  recognised thing; NetworKit, EasyGraph, and SNAP were checked and share the same generic-algorithm
  profile as NetworkX/igraph/Neo4j GDS rather than constituting a separate category.
