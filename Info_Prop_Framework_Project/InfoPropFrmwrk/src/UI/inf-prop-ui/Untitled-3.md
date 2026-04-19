this is essentially "what story will the data tell?" Let me walk through what each analysis view should reveal for each scenario, and then what the cross-scenario profile should highlight.

Per-Analysis Insights
Exact Inference (Reachability)
Normal Operations: Baseline reference. Source nodes have low beliefs (0.10-0.30). As you move through the 4 time layers, beliefs increase at hub nodes (CBODD = nodes 11, 19, 27) because 5+ paths converge there. The diamond correction matters most at these hubs — naive tree propagation would overestimate their beliefs. Final layer beliefs should range 0.20-0.55.

Storm Event: Everything lights up. Source priors jump to 0.45-0.80. Cross-variable edge probs increase. The user should see a uniform elevation across all nodes — the heatmap goes from cool to hot everywhere. CBODD hubs hit 0.80+. This shows: "when the system is overwhelmed, contamination reaches everywhere."

Nitrification Failure — the interesting one: This creates a split pattern:

CBODD nodes (var 2): beliefs similar to Normal — BOD treatment is fine
CKNN nodes (var 6): beliefs spike — nitrogen accumulating untreated
CNON nodes (var 7): beliefs drop below Normal — no nitrification product being generated
CKND nodes (var 3): beliefs spike — untreated nitrogen reaching discharge
The visualization should show a clear two-tone pattern: half the network looks normal, half is degraded. This is the framework's strongest demo — it pinpoints which subsystem failed from the reachability results alone.

Winter Operations: All results are intervals — every node shows a range [lower, upper] instead of a point value. The key insight: nitrogen pathway nodes have the widest intervals (most uncertain) because nitrification is the most temperature-sensitive process. CBODD nodes have moderate-width intervals. Self-temporal connections have tight intervals. The user sees: "we're uncertain, and here's specifically WHERE we're most uncertain."

Capacity Analysis
Normal Operations: Healthy network. Source input (C_NI=8, CKNI=10) flows through comfortably. Utilization ~60-70%. No bottlenecks. This is the "design spec" state.

Storm Event: Source input 2.5-3x higher (22, 25) but node/edge capacities reduced. This creates visible bottlenecks — demand exceeds what the hub nodes (CBODD) can process. Utilization approaches or exceeds 100%. The bottleneck map should light up the CBODD nodes and the input-to-bod edges. Insight: "the treatment hub is the first thing to overflow in a storm."

Nitrification Failure: Overall utilization looks similar to Normal, BUT nitrogen pathway edges (nitrogen_chain=7, reverse_nitrogen=5.5, vs normal 14, 11) are at half capacity. The bottleneck map should show a localized cluster around CKNN/CNON nodes and nitrogen edges. BOD pathway edges show no stress. Insight: "nitrogen processing is the bottleneck, everything else has spare capacity."

Winter Operations: All capacities are intervals. Network utilization is an interval, e.g. [0.55, 0.82]. The bottleneck identification now shows conditional bottlenecks — "this edge is a bottleneck if flow is at the upper end of the range." This shows the framework handling uncertainty in capacity analysis.

Time Analysis (CPM)
Normal Operations: Critical path runs through the CBODD hub nodes (duration=4.0h, the longest). Project duration ~19-22 hours through 4 layers. Hub nodes show zero slack (on critical path). Source/sink nodes have positive slack.

Storm Event: Durations decrease 40% (expedited processing). Project duration ~12-14 hours. The critical path might shift — with shortened hub processing, other paths might become critical. Insight: "rushing the treatment shifts the bottleneck."

Nitrification Failure: This is where it gets interesting for CPM. CKNN/CNON nodes now take 80% longer (5.4h, 5.0h). Nitrogen edges delayed 80-100%. The critical path may shift from the CBODD hub pathway to the nitrogen pathway. A node that had slack in Normal Operations is now on the critical path. Insight: "process failure doesn't just affect quality — it changes the schedule."

Winter Operations: All durations and delays are intervals. Critical path duration is an interval, e.g. [18.5, 28.2] hours. Slack values are intervals — a node with slack [0.0, 3.5] means "might be on the critical path, or might have 3.5h to spare." The user can see which nodes are definitely critical (upper slack = 0) vs conditionally critical (lower slack = 0 but upper > 0).

Cost Analysis (CPM)
Normal vs Storm: Storm costs ~40% more across the board. The total cost comparison quantifies the financial impact of emergency operations.

Nitrification Failure: Total cost elevated but concentrated in nitrogen pathway. CKNN/CNON nodes 60% more expensive, nitrogen edges 50% more expensive. The cost-critical path may differ from the time-critical path — great for showing the framework separates time and cost. Insight: "the most expensive path to fix isn't always the longest path."

Winter: Cost as intervals. Total project cost might be [£4,200, £6,800]. Decision-makers can see their budget range.

System Profile (Cross-Scenario Dashboard)
This is where it all comes together. The profile should highlight:

1. Scenario Comparison Heatmap
A nodes × scenarios matrix showing beliefs. The user instantly sees:

Normal: moderate blue/green across the board
Storm: hot red everywhere (uniform elevation)
Nitrification Failure: striped — some rows hot (CKNN, CKND), some cool (CNON), some normal (CBODD). This is the visually striking one
Winter: shown as ranges/bars rather than single values
2. Hotspot Alerts
Nodes that appear degraded across multiple scenarios:

CBODD (nodes 11, 19, 27): hotspot in Storm Event (overwhelmed) but fine in Nitrification Failure — it's a scenario-specific vulnerability
CKNN (nodes 15, 23, 31): hotspot in Nitrification Failure AND Winter — it's a structural vulnerability (nitrogen processing is the weakest link)
Insight: "CKNN is the system's Achilles heel — it degrades in 2 out of 4 scenarios"
3. Capacity Stress Comparison
Normal: all green (within spec)
Storm: widespread red (system-wide overload)
Nitrification: localized yellow/red (nitrogen pathway only)
Winter: orange ranges (uncertain but generally stressed)
4. Critical Path Shift
The most powerful cross-scenario insight: the critical path changes depending on the scenario:

Normal + Storm: critical path goes through CBODD hubs
Nitrification Failure: critical path shifts to nitrogen pathway
This is something a static analysis can't show — you need multi-scenario comparison