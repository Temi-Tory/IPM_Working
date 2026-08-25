# Thread 1 and Thread 3 findings — literature and delivery-category search

Research-only run, 2026-08-25. No chapter LaTeX written, no `references.bib` created, per the
handover's hard stop. This file is the findings log for Temi to read, verify, and decide on before
any chapter text asserts a novelty claim.

## UPDATE, later 2026-08-25: full-text verification complete, flagged decision actioned

Temi reviewed the flagged decision below and approved the three-camp framing in substance (see
`INTEGRATION_NOTES.md` for the exact scoping instruction she gave). She also downloaded the three
PDFs this file could previously verify at abstract level only, to
`C:\Users\ohian\Downloads\literature\`, and all three have now been read in full:

- **`huang2020exact`** (Huang, Huang & Lin 2020, RESS): full text confirms the abstract-level
  characterisation below without correction. Enriched detail now in `references.bib`'s note field:
  the paper's own case study (13-activity manufacturing-line project, Chengdu, China; reported
  project reliability 0.906411 at a 135-day/118,000 CNY constraint pair, validated against full
  enumeration of over 28 million state vectors) and the confirmation that the paper's own
  introduction explicitly frames the "multi-state project network" as an application of the
  stochastic-flow-network concept (citing Lin's own prior manufacturing and social-network work)
  extended to project management, i.e. the crossover between the flow-reliability and
  scheduling-reliability literatures this file's Camp C entry already inferred is something the
  paper states about itself, not something inferred from outside.
- **`repetto2018windgis`** and **`abendroth2026democratization`**: full text confirms the
  abstract-level characterisation in the Thread 3 table below without correction. Abendroth's
  functional taxonomy (Section 8.2 of the paper) names ten system classes explicitly: standalone
  LCP/NCP, LCP integrated into ERP systems, multi-experience development platforms, business
  process automation, business process management suites, robotic process automation, document
  management systems, and iPaaS integration hubs, illustrated with concrete commercial products
  (Mendix, Salesforce, UiPath, Bizagi, Zapier, SAP Build, and others). None is an engineering or
  scientific analysis category. This is a stronger, now fully-verified basis for the chapter's
  claim than the abstract alone gave.

The Thread 1 section of the chapter is consequently now drafted (previously a placeholder), scoped
to the three camps below per Temi's instruction, with the explicit "here is what none of this
does" comparison against the thesis's own claim reserved for the chapter's closing Synthesis
section alone, not repeated as a per-section closing move. See `Background_Chapter.tex`.

Two additional literature sources were checked per Temi's instruction and found not to change any
finding below: her Zotero library export (`My Library zotero export.bib`, 194 entries) contained
one adjacent paper not already covered (Bulteau \& El Khadiri 1998, a Monte Carlo method for
stochastic-flow-network reliability in the same RAIRO lineage as Doulliez \& Jamoulle 1972,
logged in `THREAD2_4_5_6_7_FINDINGS.md`'s Thread 2 table but not adopted as a citation, since the
point it would support is already made once, using Doulliez \& Jamoulle, and Probability's own
chapter already draws the Monte-Carlo-vs-exact distinction for the connectivity-reliability side).
Her early-PhD reading folder (`Zotero Attachments/`, ~130 PDFs, mostly resilience-quantification
and Bayesian-network-reliability papers) surfaced nothing relevant to Threads 1 or 3 beyond
confirming `bruneau2003resilience` is a source she already had independently (a paper titled
identically to the citation already used sits in that folder).

## FLAGGED DECISION — read before anything else

Thread 1's search did not turn up any tool or method that combines all three of
reliability/reachability analysis, capacity/flow analysis, and schedule/CPM analysis in one model.
**But it did turn up several genuine two-of-three comparators, in two different camps, that need
your eyes before the chapter states the novelty claim.** None of them handle imprecise probability
(intervals or p-boxes). None combine all three. But "does it combine two of three" is the threshold
the handover set for flagging, and these clear it honestly.

**Camp A — commercial reliability suites that also do flow/throughput (reliability + flow, no
schedule, no imprecision):**
- **ReliaSoft BlockSim** (Hottinger Brüel & Kjær / formerly ReliaSoft). Core RBD/FTA/Markov
  reliability engine, plus a **Process Flow module** that models multi-flow-type throughput,
  bottleneck identification and capacity metrics on the same diagram set
  (https://www.reliasoft.com/products/reliability-analysis/blocksim/process-flow). No CPM/project
  schedule module found in product documentation. No mention of interval or p-box uncertainty
  anywhere in the product literature searched; inputs are classical life distributions (Weibull,
  exponential, etc.) with Monte Carlo or analytical solving.
- **Isograph Availability Workbench** (AvSim module). Predicts capacity and availability together,
  identifies bottlenecks in continuous/batch process systems
  (https://www.isograph.com/software/availability-workbench/). Same boundary as BlockSim: no
  schedule/CPM module found, no interval/p-box support found.
- **ITEM ToolKit** (ITEM Software). RBD/FTA/ETA/Markov/spares/maintainability suite that also
  includes a **"Capacity & flow model"** module with user-defined derating standards
  (https://www.itemsoftware.com/toolkit.html). Same boundary again: reliability + flow, no
  schedule module found, no imprecision support found.

  This is a real pattern, not a coincidence: the mainstream commercial RBD/FTA category has
  apparently standardised on bundling a flow/throughput module alongside reliability. None of the
  three products found evidence of a project-scheduling/CPM module, and none showed evidence of
  interval or p-box handling; all use classical probability distributions.

**Camp B — flow + restoration-scheduling resilience simulators (flow + schedule-like, no formal
reliability computation, no imprecision):**
- **InfraRisk** (Balakrishnan & Cassottana, 2022, *Sustainable Cities and Society* 83, 103963,
  DOI 10.1016/j.scs.2022.103963). Open-source Python platform. Verified by reading the full paper
  (not just the abstract). It genuinely does flow analysis in three domains at once (power flow via
  `pandapower`, water hydraulics via `wntr`, static traffic assignment for roads) **and** a
  restoration-scheduling module that computes repair-crew sequencing with real start/end timestamps,
  either via heuristics or model-predictive-control optimisation. It does **not** do a formal
  network reachability/reliability computation of the kind this thesis's Probability toolkit does;
  instead it runs disaster-scenario simulations and reports resilience metrics (equitable/prioritised
  consumer serviceability, equivalent outage hours) computed from the simulated performance
  time series. Its hazard module computes point-valued component failure probabilities
  (`p(failure) = p(hazard) × p(exposure|hazard) × p(failure|exposure)`) to drive Monte-Carlo-style
  scenario generation, not intervals or p-boxes.
- **Regional Resilience Assessment Platform** (Zhao, Blagojević, Naeimi, Cetiner, Han, McKenna,
  Stojadinović, DeJong; engrxiv preprint, 2026), linking SimCenter's R2D tool to `pyrecodes`.
  Same profile as InfraRisk at the abstract level (traffic flow + water delivery simulators,
  interdependent-system recovery simulation); a 2026 preprint, not independently verified beyond
  its abstract, and not confirmed to add anything InfraRisk doesn't already cover. Logged for
  completeness, not recommended as a separate citation over InfraRisk.

**Camp C — an academic algorithm family that does reliability + schedule (not flow, not a
delivered tool, no imprecision):**
- **Multi-state project network (MPN) reliability**, the line of work led by Yi-Kuei Lin and
  collaborators (e.g. Huang, D.-H., Huang, C.-F., Lin, Y.-K., 2020, "Exact project reliability for
  a multi-state project network subject to time and budget constraints," *Reliability Engineering
  & System Safety* 195, 106744, DOI 10.1016/j.ress.2019.106744, verified at CrossRef and via a
  RePEc-hosted mirror of the abstract). This treats a project's activity network as a multi-state
  system and computes "project reliability," the probability the project completes within a time
  constraint AND a budget constraint, using the same minimal-path/decomposition machinery this
  thesis's own Probability chapter surveys. It genuinely combines a reliability computation with a
  time constraint (schedule-like) and a budget constraint (capacity-like, but modelled as project
  cost, not edge flow capacity in the max-flow sense). It does **not** do classical CPM (no float,
  no critical-path identification over a precedence network), does **not** do true flow/capacity
  network analysis, uses **discrete multi-state probability distributions, not intervals or
  p-boxes**, and critically **is not a software tool or delivered framework** — it is a family of
  published algorithms with no associated general-purpose software product found. This is the
  closest thing found to "reliability computation applied to a schedule-shaped network," and it is
  worth Temi knowing this literature exists before the chapter frames CPM-style schedule reliability
  as something nobody has combined with reliability computation at all.

**What none of the above changes**: no candidate in either camp combines all three analyses on one
network model, and none combine even two of the three with native imprecise-probability
propagation across them. The honest gap the thesis can claim, once Temi has seen this, is narrower
and more specific than "nothing else does any of this": it is "nothing found combines reliability,
flow, and schedule together, and nothing found that combines any two of them also handles
imprecision natively across the combination." That is still a real claim. It should not be written
into chapter prose without Temi seeing the camps above first.

---

## Thread 1 — comparable multi-analysis frameworks

### Search terms actually used (log, in order run)

1. `"integrated infrastructure resilience framework" reliability flow schedule analysis software`
2. `"unified reliability and performance analysis" network tool`
3. `"multi-metric network assessment tool" infrastructure`
4. `"graph-based decision support" infrastructure reliability flow schedule`
5. `InfraRisk open-source simulation platform power water transport resilience reliability flow schedule`
6. `probabilistic risk assessment PRA software toolkit reliability schedule flow integrated nuclear`
7. `"digital twin" infrastructure resilience reliability flow critical path schedule software platform`
8. `reliability block diagram software fault tree flow network critical path integrated tool`
9. `"reliability" AND "capacity" AND "critical path" software tool combined analysis network`
10. `ReliaSoft BlockSim flow network capacity analysis critical path scheduling features`
11. `Isograph Reliability Workbench flow network capacity critical path project scheduling`
12. `project scheduling reliability analysis flow network single platform integrated uncertainty imprecise probability`
13. `"multi-state project network" reliability schedule budget constraints survey`
14. `Huang Huang Lin 2020 "project reliability" "multi-state project network" "time and budget" abstract Reliability Engineering System Safety`
15. `Yi-Kuei Lin "multi-state project network" origin concept reliability schedule "minimal path" review`
16. `OpenCossan toolbox scope critical path scheduling reliability flow capacity features`
17. `review survey "resilience assessment tools" infrastructure software comparison table reliability flow scheduling`
18. `GoldSim reliability block diagram network flow simulation software features`
19. `GoldSim "critical path" OR "project schedule" OR "PERT" module`
20. `IN-CORE interdependent networked community resilience modeling environment NIST reliability flow restoration schedule`
21. `"multi-hazard risk assessment" software platform reliability flow schedule review comparison`
22. `interdependent infrastructure restoration scheduling flow reliability integrated framework review paper`
23. `SAPHIRE NRC software scope fault tree event tree flow network schedule capabilities`
24. `"reliability analysis" "flow analysis" "schedule analysis" "single tool" OR "one platform" engineering network`
25. `process safety software reliability capacity critical path integrated platform imprecise probability interval`
26. `"review of" software tools infrastructure resilience quantification comparison table reliability restoration flow 2020..2026`
27. `network reliability flow capacity schedule "one framework" OR "single framework" imprecise probability p-box interval thesis`
28. `review "simulation platforms" interdependent infrastructure resilience comparison InfraRisk IN-CORE table`
29. `ITEM ToolKit reliability software flow network capacity throughput features scope`
30. `ReliaSoft BlockSim "interval" OR "p-box" OR "imprecise probability" uncertainty distribution parameters`
31. `Isograph "interval" OR "p-box" OR "imprecise" uncertainty reliability data`

Plus direct verification fetches: the InfraRisk paper's full PDF text (via ETH Zürich institutional
repository, both cover page and article), CrossRef API records for four DOIs, a RePEc/IDEAS mirror
of the Huang/Huang/Lin abstract, NIST's IN-CORE publication page, and the ReliaSoft BlockSim
Process Flow product page. `ScienceDirect` article pages returned HTTP 403 to WebFetch throughout
this session; where that happened, the citation was instead verified at CrossRef (metadata) and, for
InfraRisk, at the author's institutional repository mirror (full text, open access, CC BY-NC-ND).

### Candidates found, verified, and their verdicts

| Candidate | What it actually does (verified) | Verdict |
|---|---|---|
| **ReliaSoft BlockSim** | RBD/FTA/Markov reliability + Process Flow (throughput/capacity) module. No CPM/schedule module found. No interval/p-box found. | Rejected as a full comparator; **flagged above** as a 2-of-3 (reliability + flow) commercial pattern. |
| **Isograph Availability Workbench (AvSim)** | Reliability + capacity/availability prediction, bottleneck identification. No CPM/schedule module found. No interval/p-box found. | Rejected as a full comparator; **flagged above** as a 2-of-3 (reliability + flow) commercial pattern. |
| **ITEM ToolKit** | RBD/FTA/ETA/Markov/spares/maintainability + "Capacity & flow model" module. No CPM/schedule module found. No interval/p-box found. | Rejected as a full comparator; **flagged above** as a 2-of-3 (reliability + flow) commercial pattern. |
| **InfraRisk** (Balakrishnan & Cassottana 2022) | Flow analysis in 3 domains (power/water/traffic) + restoration-scheduling module with real repair-crew sequencing and timestamps. No formal reliability/reachability computation (resilience metrics from simulated performance loss instead). Point-valued probabilistic hazard model for Monte-Carlo-style scenario generation, no interval/p-box. | Rejected as a full comparator; **flagged above** as a 2-of-3 (flow + schedule-like) open-source research platform. |
| **Regional Resilience Assessment Platform** (Zhao et al. 2026 preprint) | Same profile as InfraRisk at abstract level (SimCenter R2D + `pyrecodes`, traffic + water flow simulators, interdependent recovery). Not independently verified beyond the abstract. | Rejected/logged only; same camp as InfraRisk, no independent added value confirmed. |
| **Multi-state project network (MPN) reliability**, esp. Huang, Huang & Lin (2020) | Reliability computation (decomposition/minimal-path methods) applied to a project network under time AND budget constraints. No CPM float/critical-path computation. No true edge-capacity flow network. Discrete multi-state probability, not imprecise. Not a software tool — a published algorithm family. | Rejected as a tool comparator (it isn't a tool); **flagged above** as a 2-of-3 (reliability + schedule-like) research literature line. |
| **IN-CORE** (NIST Center of Excellence, community resilience) | Integrates power/water/transport network models with social/economic layers; damage, functionality-loss, and recovery-time simulation with "uncertainty propagation through chained models." Public documentation found (NIST publication pages, GitHub README, in-core.org) does **not** confirm a formal network reachability/reliability computation, does **not** confirm an edge-capacity flow module distinct from component damage states, and does **not** confirm a CPM/schedule module (recovery is optimisation-based sequencing, not float/critical-path computation). Its "uncertainty propagation" reads as probabilistic (damage/fragility-function based), not interval/p-box, in every source checked. | Rejected: none of the three capabilities independently confirmed in the specific senses this thesis uses them, from publicly available documentation. Logged, not flagged, because the profile is weaker and less confirmed than InfraRisk's. |
| **SAPHIRE** (NRC/Idaho National Laboratory PRA tool) | Fault tree and event tree reliability analysis only, up to 64,000 basic events/gates. No flow network module found. No schedule/CPM module found. | Rejected: reliability only (1 of 3). |
| **GoldSim Reliability Module** | Component-level reliability and fault-tree simulation via Monte Carlo, within a general dynamic-systems simulator that can represent material/information "flows" as generic model quantities, not as a dedicated capacity-network analysis. No CPM/schedule module found. Monte Carlo only; no interval/p-box found. | Rejected: reliability-centred general simulator, not confirmed to do formal flow/capacity network analysis or schedule/CPM; no imprecision. |
| **OpenCossan** (already cited in Front-End chapter for the imprecise-probability software ecosystem) | Confirmed: reliability analysis, and genuine support for random variables, intervals, and both distributional and free p-boxes (this is real imprecision-native software). No flow/capacity network module found, no CPM/schedule module found. | Rejected for Thread 1 purposes: imprecision-native but only 1 of 3 analyses confirmed (reliability); already spent as a citation in the Front-End chapter for its actual purpose. |
| **Stochastic-flow network reliability** (Yi-Kuei Lin and collaborators' broader body of work, distinct from the MPN/project-network line above, e.g. multi-state network reliability with maximal/minimal capacity vectors) | Genuine reliability + capacity/flow analysis (arc capacities, demand thresholds) on physical-style networks. No schedule/CPM in this specific sub-line. | Not chased further: this is squarely Thread 2's territory (flow analysis under uncertainty), out of scope for this run. Logged here only so it isn't re-discovered as new next time; not independently verified to the citation-ready level in this session. |
| General IT/network-monitoring tools (PRTG, SolarWinds, ManageEngine OpManager, New Relic, Blue Planet Unified Assurance) | "Reliability" and "performance" here mean uptime/bandwidth/latency telemetry for IT networks, not structural or engineering-network reliability, flow-capacity, or CPM analysis. | Rejected: domain mismatch, not the same sense of "reliability" or "network" this thesis uses. |
| Generic digital-twin-for-infrastructure-resilience literature (reviews, conceptual papers) | Discusses the digital-twin paradigm's suitability for resilience broadly; no single named tool verified to combine reliability + flow + schedule. | Rejected: too generic to name as a comparator; no specific candidate tool surfaced beyond InfraRisk/IN-CORE, both logged separately above. |

### Conclusion — Thread 1

No existing tool or method found in this search combines reliability/reachability analysis,
capacity/flow analysis, and schedule/CPM analysis over one network model, and none of the
candidates found that combine any two of the three also handle imprecise probability (intervals or
p-boxes) natively across the combination; the closest cases split into three distinct, unconnected
camps (commercial RBD suites with a bolted-on flow module, disaster-resilience simulators with flow
plus restoration scheduling, and an academic reliability-computation-on-project-networks literature
with no associated software), each falling short of the thesis's combination in a different and
specific way, and this is a genuine search finding, not an assumption, so **it is logged above as
a flagged decision for Temi before any novelty claim is written**.

### Full citations for anything worth citing from Thread 1 (pending Temi's read of the flag above)

- Balakrishnan, S. and Cassottana, B. (2022). "InfraRisk: An open-source simulation platform for
  resilience analysis in interconnected power–water–transport networks." *Sustainable Cities and
  Society*, 83, 103963. DOI: 10.1016/j.scs.2022.103963. Open access (CC BY-NC-ND 4.0). Verified at
  CrossRef and by reading the full text via the ETH Zürich Research Collection mirror.
- Huang, D.-H., Huang, C.-F., and Lin, Y.-K. (2020). "Exact project reliability for a multi-state
  project network subject to time and budget constraints." *Reliability Engineering & System
  Safety*, 195, 106744. DOI: 10.1016/j.ress.2019.106744. Verified at CrossRef; abstract verified
  via a RePEc/IDEAS mirror of the publisher record (ScienceDirect itself returned HTTP 403 to
  automated fetch).
- ReliaSoft BlockSim, Process Flow module. Vendor product page (HBK/ReliaSoft):
  https://www.reliasoft.com/products/reliability-analysis/blocksim/process-flow — cite as a
  software product, not a paper, if used.
- Isograph Availability Workbench (AvSim module). Vendor page:
  https://www.isograph.com/software/availability-workbench/
- ITEM ToolKit. Vendor page: https://www.itemsoftware.com/toolkit.html
- SAPHIRE. NRC/OSTI technical report: *Systems Analysis Programs for Hands-on Integrated
  Reliability Evaluations (SAPHIRE): Summary Manual*, NUREG/CR-6952, Volume 1.
  https://nrc.gov/reading-rm/doc-collections/nuregs/contract/cr6952/v1

---

## Thread 3 — the software delivery category

### Search terms actually used (log, in order run)

1. `"no-code" engineering analysis web tool category survey`
2. `"low-code" reliability software engineering platform`
3. `"browser-based" risk assessment platform engineering no-code`
4. `"local-first software" scientific computing OR engineering data ownership`
5. `SimScale OnScale web-based no-code simulation engineering analysis cloud platform`
6. `"democratization" simulation engineering analysis software citizen engineer no-code low-code review paper`
7. `web-based risk assessment platform engineering infrastructure GIS no-code visual tool review academic`
8. `local-first software scientific research tools reproducibility offline desktop application discussion 2023 2024 2025`
9. `reliability engineering software GUI vs programming library survey barrier to adoption practitioners`
10. `"no-code" OR "low-code" infrastructure asset management reliability engineering platform review category 2024 2025`
11. `web-GIS platform wind risk assessment infrastructure "ScienceDirect" S096599781730159X authors title`
12. `Abendroth 2026 "democratization of software engineering" "ten system classes" OR "functional taxonomy" low-code no-code classes`
13. `"democratization of software engineering" low-code no-code Springer abstract "This study" OR "This paper" 2026`
14. `"Comprehensive Analysis of the Use of Web-GIS for Natural Hazard Management" Sustainability MDPI authors abstract systematic review`

Plus direct verification fetches: CrossRef API records for the Abendroth, Repetto et al., and Daud
et al. DOIs; Wikipedia's SimScale entry (cross-checked against SimScale's own product pages); a
Springer paywall redirect (abstract instead recovered via CrossRef + search-result mirrors, since
the full text sits behind institutional login); an MDPI article page that returned HTTP 403 to
WebFetch (abstract recovered the same way).

### Candidates found, verified, and their verdicts

| Candidate | What it actually is (verified) | Verdict |
|---|---|---|
| **SimScale** | Cloud-native, browser-based CAE platform (CFD, FEA, thermal, electromagnetics), founded 2012, launched 2013, ~600,000+ registered users as of Sept 2024, no local install required. Verified via Wikipedia (cross-checked against the vendor's own product pages). Not "no-code" in the drag-and-drop sense (still requires domain expertise in meshing/physics setup); not open-source or local-first (cloud SaaS, freemium/paid, proprietary + open-source solver backend). | **Kept.** Genuine example of the browser-based, no-local-install engineering-analysis delivery category at the category level, distinct in domain (continuum-mechanics simulation, not graph-based reliability/flow/schedule) but the right comparator for the *delivery model* question Thread 3 actually asks. |
| **Abendroth, A. (2026)**, "The democratization of software engineering: evolution, definition, and the future of low-code and no-code platforms," *Management Review Quarterly*. DOI 10.1007/s11301-026-00603-2. | Systematic literature review of 383 definitions across 306 publications (2014–2025) defining and taxonomising the no-code/low-code category itself (10 system classes, functional taxonomy). Confirmed via CrossRef. Full text is paywalled (Springer institutional login); abstract recovered via CrossRef and independent search-result mirrors, cross-checked for consistency. **The abstract and every mirror found describe a general business/citizen-developer software review (shadow IT, hyperautomation, app development); no source found confirms engineering or scientific analysis software is discussed among its taxonomy classes.** | **Kept, but narrowly**: cite only for defining what "no-code/low-code" means as a software-delivery category in general, never for a claim that the category already covers engineering-analysis tools, since that specific claim was not confirmed in any source read. |
| **Repetto, M.P., Burlando, M., Solari, G., De Gaetano, P., Pizzo, M., Tizzi, M. (2018)**, "A web-based GIS platform for the safe management and risk assessment of complex structural and infrastructural systems exposed to wind," *Advances in Engineering Software*, 117. DOI 10.1016/j.advengsoft.2017.03.002. | Verified via CrossRef (full author list, journal, volume, year). A genuine engineering-domain example: risk assessment for port/infrastructure assets delivered to operators through a web-based GIS interface, no local install or programming needed by the end user (numerical modelling happens upstream; the delivery layer is visual and web-based). | **Kept**: one concrete, citable, domain-specific example of the "web-based risk-assessment platform for infrastructure" pattern the gameplan's Thread 3 search terms asked for. |
| **Daud, M., Ugliotti, F.M., Osello, A. (2024)**, "Comprehensive Analysis of the Use of Web-GIS for Natural Hazard Management: A Systematic Review," *Sustainability*, 16(10), 4238. DOI 10.3390/su16104238. | Verified via CrossRef. A genuine PRISMA-based systematic review (65 articles from 1,775 screened, 2014–2023) of Web-GIS platforms for natural hazard management, with subtopics including visualisation/UI design and decision support systems. Confirms the *category* (web-delivered, visual, decision-support tooling for hazard/infrastructure risk) is a real and actively reviewed one. Does **not** confirm (not found in any source read) that the review specifically discusses no-code/low-code delivery terminology, or whether the platforms it covers handle uncertainty in any particular form; that level of detail sits behind the MDPI paywall this session's WebFetch could not clear (HTTP 403). | **Kept, per the "prefer one strong survey over many narrow papers" rule**, as the anchor citation for "this category of web-delivered risk/hazard analysis tooling is real and reviewed," with Repetto et al. as one concrete member of it. State only what is confirmed (the category exists and is reviewed); do not attribute a no-code/uncertainty-handling claim to it that was not verified. |
| Generic no-code/low-code business platforms (Mendix, OutSystems, Microsoft Power Apps, FlowForma, Onspring, LogicGate Risk Cloud) and market-analyst reports (Forrester Low-Code Wave, market-size figures) | Confirmed across multiple independent searches: this category, as covered in its own trade and market literature, is exclusively business-process, app-building, ITSM/ITAM, and GRC-compliance focused. No source found in this category discusses engineering or scientific analysis (reliability, flow, structural, CFD, FEA, etc.) as a no-code/low-code use case. | Rejected, but the rejection is itself the finding: it confirms, rather than assumes, that the mainstream no-code/low-code category as documented in its own literature does not include engineering-domain analysis tooling. |
| Commercial RBD/FTA GUI suites (BlockSim, Isograph, ITEM ToolKit, SAPHIRE) — same products found under Thread 1 | These genuinely are "no-code" in the strict sense (no programming required to build a model) and are engineering-domain (reliability). But all four are licensed desktop-install products, not web-based or browser-delivered, and no free/open equivalent was found. | Rejected as Thread 3 category members in the specific "web-based/no-code" sense the gameplan's search terms target, but logged as the boundary case: GUI-based, no-programming delivery already exists for reliability specifically, just not web-based, not open, and not combined with flow or schedule (see Thread 1's flagged section for the analytical-scope side of this same boundary). |
| Software Failure and Reliability Assessment Tool (SFRAT) | A free, GUI-based reliability tool found during the search. Checked and rejected on domain grounds: it performs software-reliability-growth modelling (predicting software defects from failure-count data), a different meaning of "reliability" entirely from the network/component-failure reliability this thesis addresses. | Rejected: domain mismatch (software engineering reliability, not systems/network reliability). |

### Conclusion — Thread 3

The mainstream no-code/low-code software category, as documented in its own trade and academic
literature, is built and marketed for business-process and application development, not
engineering or scientific analysis, and no source found in a genuine search names an
engineering-analysis exception to that; the engineering-domain equivalent of "no professional
programming required" instead exists as two separate, older patterns that never merged with the
no-code/low-code movement's own terminology: browser-delivered simulation-as-a-service platforms
for continuum-mechanics analysis (SimScale being the clearest verified example) and licensed
desktop GUI suites for reliability analysis specifically (BlockSim, Isograph, ITEM ToolKit, SAPHIRE,
all confirmed under Thread 1), neither of which is web-based, open, or local-first in combination
with the other's scope.

### Full citations for anything worth citing from Thread 3

- Abendroth, A. (2026). "The democratization of software engineering: evolution, definition, and
  the future of low-code and no-code platforms." *Management Review Quarterly*. DOI:
  10.1007/s11301-026-00603-2. Verified at CrossRef; full text paywalled, abstract cross-checked
  against multiple independent mirrors for consistency.
- Repetto, M.P., Burlando, M., Solari, G., De Gaetano, P., Pizzo, M., and Tizzi, M. (2018). "A
  web-based GIS platform for the safe management and risk assessment of complex structural and
  infrastructural systems exposed to wind." *Advances in Engineering Software*, 117. DOI:
  10.1016/j.advengsoft.2017.03.002. Verified at CrossRef.
- Daud, M., Ugliotti, F.M., and Osello, A. (2024). "Comprehensive Analysis of the Use of Web-GIS
  for Natural Hazard Management: A Systematic Review." *Sustainability*, 16(10), 4238. DOI:
  10.3390/su16104238. Verified at CrossRef.
- SimScale. Product/company facts verified via Wikipedia (https://en.wikipedia.org/wiki/SimScale),
  cross-checked against the vendor's own site (https://www.simscale.com/). Cite as a software
  product with the Wikipedia entry and/or vendor site as the stable reference, not as a journal
  article — no peer-reviewed paper about SimScale itself was located or needed for this claim.

---

## Notes for Temi

- Both ScienceDirect and one MDPI article page returned HTTP 403 to automated WebFetch throughout
  this session. Every citation drawn from a ScienceDirect or MDPI source in this file was instead
  verified at CrossRef (existence, authors, venue, year, DOI) and, where the abstract itself
  mattered, cross-checked against an independent mirror (RePEc/IDEAS, an institutional repository,
  or consistent search-result snippets from multiple engines). None of the citations above rest on
  an unverified abstract snippet alone.
- Springer's Management Review Quarterly article (Abendroth 2026) is genuinely paywalled past the
  abstract; if that source ends up load-bearing for a specific sentence in the chapter, it may be
  worth getting institutional access to read the full taxonomy before citing it for anything beyond
  the general definition.
- The "stochastic-flow network reliability" line of Yi-Kuei Lin's broader work (distinct from the
  multi-state-project-network line flagged above) surfaced repeatedly during Thread 1 searches and
  is squarely Thread 2's territory (flow analysis under uncertainty), not this run's scope. It is
  logged in the Thread 1 table only so a future pass on Thread 2 doesn't have to rediscover it, and
  it has not been verified to citation-ready depth here.
- Thread 1's flagged camps (A, B, C) are presented as three separate findings because they are
  structurally different (a commercial-software pattern, an open-source research-platform pattern,
  and an academic-algorithm pattern) and merging them into one paragraph would have hidden how
  different their gaps from this thesis's claim actually are. That structure is a judgement call
  about how to present the finding, not a judgement about what the novelty claim should say; that
  part is explicitly left to Temi per the handover's boundaries.
