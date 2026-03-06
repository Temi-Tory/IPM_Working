# Per-View End-User UX Plan

Date: 2026-03-02
Audience: Researchers, engineers, domain experts (non-programmers)
Goal: Make backend-rich analysis understandable, trustworthy, and actionable without clutter.

---

## 0) Product Principles (applies to every view)

1. **Insight-first, data-second**
   - Top area answers: *What happened? Why? What should I do next?*
   - Detailed tables/charts are supporting evidence.

2. **Never misrepresent uncertainty**
   - Float: single value.
   - Interval: show `[lower, upper]` (never midpoint-only as primary display).
   - Pbox: show bounded summary (e.g., mean range + bounds summary), with optional detail tooltip/panel.

3. **Separate “measured fact” vs “derived scalar”**
   - If midpoint/proxy is used for ranking or color scale, label it explicitly: “ranking uses representative midpoint”.

4. **Reduce noise, increase contrast**
   - Avoid repeating the same warning 10 times.
   - Group repeated conditions into one synthesized insight with scenario differences.

5. **Progressive disclosure**
   - Summary cards + key insights first.
   - Expanders/charts/tables next.
   - Raw payload details last.

---

## 1) Exact Inference View (Reachability)

## Core user questions
- Which subsystem/pathway is degraded vs normal?
- Is degradation global or localized?
- How uncertain are these beliefs, and where?

## Must-have UX outputs
1. **Scenario insight headline**
   - “Global elevation”, “Split-pattern degradation”, “Localized nitrogen-path stress”, etc.

2. **Pattern summary block**
   - Top 3 node clusters most changed from baseline.
   - Explicit positive/negative deltas by domain groups (e.g., CKNN up, CNON down).

3. **Data-type aware belief rendering**
   - Float: `0.5321`
   - Interval: `[0.21, 0.58]`
   - Pbox: bounded summary + optional tooltip details

4. **Uncertainty localization panel (interval/pbox)**
   - “Top widest-uncertainty nodes”
   - “Uncertainty concentrated in pathway X”

5. **Cross-scenario node drill-down**
   - Keep per-node trajectory across all scenarios with uncertainty-aware display.

## Anti-misinterpretation rule
- Any chart/table sorting on uncertainty data must disclose representative scalar method.

---

## 2) Capacity Analysis View

## Core user questions
- Where does capacity fail first?
- Is stress system-wide or localized?
- Which bottlenecks are definite vs conditional under uncertainty?

## Must-have UX outputs
1. **Capacity stress story card**
   - “Healthy / Localized stress / System overload” classification.

2. **Bottleneck quality upgrade**
   - Replace raw count inflation with categories:
     - **Definite bottleneck**
     - **Conditional bottleneck** (for interval ranges)
     - **Not bottleneck**
   - Show counts by category, not just one inflated total.

3. **Interval-aware utilization display**
   - Show `[lo%, hi%]` for interval utilization.
   - Do not show midpoint-only `587.9%` as primary value.

4. **Pathway-focused bottleneck map**
   - Summarize bottlenecks by pathway/subsystem, not only by node list.

5. **Upgrade priorities interpretation layer**
   - Translate to domain wording: “highest impact intervention points”.

## Anti-misinterpretation rule
- If bounds are overly conservative (interval arithmetic dependency issue), annotate as: “conservative bound; interpret alongside pathway-level evidence”.

---

## 3) CPM Time View

## Core user questions
- What controls schedule duration?
- Which activities are definitely critical vs maybe critical under uncertainty?
- How does scenario change the critical path?

## Must-have UX outputs
1. **Critical-path shift summary**
   - “Critical path moved from CBODD hub route to nitrogen route”.

2. **Criticality classes (uncertainty-aware)**
   - **Definitely critical**: upper slack = 0
   - **Conditionally critical**: lower slack = 0, upper > 0
   - **Non-critical**: lower slack > 0

3. **Slack interpretation panel**
   - Not just values; include scheduling risk meaning.

4. **Scenario-to-baseline change callouts**
   - Duration delta, critical-node turnover, near-critical expansion.

5. **Timeline/Gantt remains but with uncertainty cues**
   - Interval bars or uncertainty whiskers for interval scenarios.

---

## 4) CPM Cost View

## Core user questions
- What drives cost-critical behavior?
- Is cost risk concentrated in specific pathway(s)?
- How does cost-critical path differ from time-critical path?

## Must-have UX outputs
1. **Cost concentration summary**
   - Top cost-driving nodes/edges/pathways.

2. **Cost-vs-time divergence card**
   - Explicitly show where cost-critical differs from time-critical.

3. **Uncertainty-aware budget outputs**
   - Float: single total.
   - Interval: `[budget_low, budget_high]`.

4. **Action framing**
   - “Most expensive to optimize” vs “most schedule-impactful to optimize”.

---

## 5) Should CPM Time + Cost be Combined?

## Recommendation: **Hybrid structure (not fully merged)**

- Keep **two primary tabs** for clarity:
  - CPM Time
  - CPM Cost
- Add a **shared CPM comparison workspace** inside both tabs (or a third lightweight “CPM Compare” panel) showing:
  - path overlap/difference
  - time-cost tradeoff nodes
  - scenario-dependent path shifts

## Why this is best for your users
- Domain experts think in both dimensions, but mixing all fields into one giant screen creates cognitive overload.
- Separate primary views preserve clarity and trust.
- Shared compare panel still exposes cross-dimension intelligence.

---

## 6) System Profile View (true profile, not summary clone)

## Core user questions
- What is this system’s behavioral signature across scenarios?
- Which vulnerabilities persist vs scenario-specific?
- What decisions should we prioritize?

## Must-have UX outputs
1. **Scenario signature matrix**
   - Global elevation vs split degradation vs localized stress vs uncertainty-dominant.

2. **Persistent vulnerability detector**
   - Nodes/pathways degraded in multiple scenarios (e.g., “2/4 scenarios”).

3. **Alert deduplication & synthesis**
   - One grouped alert per theme with scenario contrast:
     - “Utilization severe only in Storm”
     - “Nitrogen pathway repeatedly stressed in Failure + Winter”

4. **Critical path shift tracker**
   - per-scenario path fingerprint and transitions.

5. **Uncertainty visibility**
   - Interval scenarios shown as ranges/bands in profile metrics, not scalar-only.

---

## 7) Information Architecture per Analysis Page

Each page should follow this layout:
1. **Top strip**: scenario selector + data type chip + run status
2. **Insight cards**: 2–4 plain-language findings
3. **Decision aids**: risk class, bottleneck class, recommended focus
4. **Evidence panels**: charts/expanders
5. **Detailed table**: filter/sort/export
6. **Raw diagnostics (optional)**

---

## 8) Data-Type Respect Rules (Implementation Contract)

1. No midpoint-only primary rendering for interval/pbox.
2. Midpoint may be used only for:
   - sorting
   - color scaling
   - simple ranking
   and must be labeled.
3. Any thresholding with intervals must support certainty classes:
   - definitely true
   - possibly true
   - definitely false
4. Exports should preserve raw interval/pbox fields.

---

## 9) Phase Execution Protocol (mark-as-done workflow)

Use this protocol for every phase so we can mark progress cleanly and avoid moving forward too early.

### Status keys
- `[ ]` Not started
- `[-]` In progress
- `[x]` Completed

### Completion gate (must all be true before `[x]`)
1. **Build/Run check passed** for touched view.
2. **Exactly what was done** is written in the phase log.
3. **Final view snapshot** is written (what user now sees, top-to-bottom).
4. **Scenario validation notes** added (Normal / Storm / Nitrification Failure / Winter).

---

## 10) Phase Tracker (Per View)

## Phase A — Capacity first (highest pain now)
**Status:** `[-]` *(In Progress)*

### Checklist
- [x] Interval-safe formatting in cards/tables (`[lo, hi]`, no midpoint-only primary display)
- [x] Bottleneck classification rework (Definite / Conditional / Not)
- [x] Summary text updated to uncertainty semantics
- [x] Pathway-focused bottleneck summary added/updated
- [ ] Validation across 4 scenarios completed

### Exactly what was done (fill when working)
- Code changes:
  - Added `ValueLike` type and `BottleneckClass` type ('definite'|'conditional'|'not')
  - Extended `CapacityNodeResult`, `CapacityEdgeResult`, `CapacityMetrics` interfaces with raw interval fields and bottleneck classification
  - Created `formatValueSafe()` and `formatUtilizationSafe()` formatters that show `[lower, upper]` for intervals, single value for floats
  - Created `classifyBottleneck()` function: checks if lower >= 0.95 (definite), upper >= 0.95 (conditional), else not
  - Created `computeIntervalUtilization()` for interval-aware utilization calculation
  - Updated `processNodeResults()` to preserve raw values and classify bottlenecks by certainty
  - Updated `processEdgeResults()` to preserve raw values and classify bottlenecks
  - Updated `calculateMetrics()` to track definite vs conditional bottleneck counts separately
  - Updated `crossScenarioSummary()` to report definite bottlenecks distinctly and flag conditional ones as info
- UI changes:
  - Metrics cards now display interval ranges for network utilization, source input, target output
  - Bottleneck count card shows breakdown: "X definite + Y conditional"
  - Node table: added "Bottleneck" column with chips (Definite/Conditional/—)
  - Edge table: added "Bottleneck" column with chips (Definite/Conditional/—)
  - All capacity/flow/utilization cells now use interval-safe formatters showing ranges
  - Comparison summary cards updated to show interval ranges
- Logic changes:
  - Bottleneck detection now certainty-class aware, not just binary threshold
  - Summary observations distinguish persistent definite bottlenecks from conditional ones
  - Interval arithmetic preserved through processing pipeline
- Files touched:
  - `capacity-analysis.component.ts` (~150 lines changed/added)
  - `capacity-analysis.component.html` (~40 lines changed)
  - `capacity-analysis.component.scss` (~35 lines added)

### Final view snapshot (required before completion)
- Top strip now shows:
  - Standard scenario selector and run controls (unchanged)
- Insight cards now show:
  - Network Utilization displays as `[X%, Y%]` for interval scenarios, with optional midpoint note
  - Bottleneck count displays total, with breakdown line "X definite + Y conditional" (when conditional > 0)
  - Source Input and Target Output show interval ranges when applicable
- Decision aids now show:
  - Summary observations distinguish "Definite bottlenecks: N definite (Scenario)" vs "Conditional bottlenecks under uncertainty: M (Scenario)"
  - Persistent bottleneck edge warnings now only count definite recurrences
- Evidence panels now show:
  - Node table: new "Bottleneck" column with color-coded chips (red "Definite", yellow "Conditional", gray "—")
  - Edge table: same bottleneck classification column
  - All Capacity, Max Flow, Flow cells display `[lower, upper]` when interval, single value when float
  - All Utilization cells display `[X%, Y%]` when interval, `Z%` when float
  - Rows with definite bottlenecks have darker red left border; conditional have lighter border
- Detailed table now shows:
  - All original columns plus new Bottleneck classification
  - Values are no longer misleading midpoint-only for interval scenarios
- What was removed/simplified:
  - Removed midpoint-only display as primary presentation for uncertain values
  - Replaced inflated bottleneck counts (from interval dependency bloat) with certainty-classified counts

### Scenario validation notes
- Normal: *Testing required - need to run capacity analysis on Normal scenario and verify interval display*
- Storm: *Testing required - need to run and verify bottleneck classification works correctly*
- Nitrification Failure: *Testing required - validate interval utilization calculations*
- Winter: *Testing required - confirm no regressions, all features work*

**Next step:** User should test by running capacity analysis on all four scenarios in the UI and verify:
1. Intervals display as ranges, not misleading midpoints
2. Bottleneck chips show correct classification (definite/conditional/none)
3. Summary cards show breakdown counts
4. No 587.9% style anomalies
5. Bottleneck totals are reasonable (not inflated)

### Exit decision
- [ ] Mark Phase A complete (after validation testing)

---

## Phase B — CPM time/cost uncertainty correctness
**Status:** `[ ]`

### Checklist
- [ ] Slack/criticality certainty classes added (definite/conditional/non-critical)
- [ ] Time and cost views render ranges correctly for interval cases
- [ ] Critical-path shift insights added
- [ ] Time-vs-cost divergence card verified
- [ ] Validation across 4 scenarios completed

### Exactly what was done (fill when working)
- Code changes:
- UI changes:
- Logic changes:
- Files touched:

### Final view snapshot (required before completion)
- CPM Time now looks like:
- CPM Cost now looks like:
- Shared compare panel now shows:
- What was removed/simplified:

### Scenario validation notes
- Normal:
- Storm:
- Nitrification Failure:
- Winter:

### Exit decision
- [ ] Mark Phase B complete

---

## Phase C — Reachability narrative enrichment
**Status:** `[ ]`

### Checklist
- [ ] Scenario insight headline upgraded
- [ ] Split-pattern detector implemented/verified
- [ ] Pathway-level comparative summaries added
- [ ] Uncertainty localization panel improved
- [ ] Validation across 4 scenarios completed

### Exactly what was done (fill when working)
- Code changes:
- UI changes:
- Logic changes:
- Files touched:

### Final view snapshot (required before completion)
- Top story card now states:
- Pattern summary now shows:
- Uncertainty panel now shows:
- Node drill-down now shows:
- What was removed/simplified:

### Scenario validation notes
- Normal:
- Storm:
- Nitrification Failure:
- Winter:

### Exit decision
- [ ] Mark Phase C complete

---

## Phase D — System Profile transformation
**Status:** `[ ]`

### Checklist
- [ ] Alert deduplication & synthesis implemented
- [ ] Persistent vulnerability detector implemented
- [ ] Scenario signature matrix implemented
- [ ] Critical path shift tracker implemented
- [ ] Validation across 4 scenarios completed

### Exactly what was done (fill when working)
- Code changes:
- UI changes:
- Logic changes:
- Files touched:

### Final view snapshot (required before completion)
- Profile header now shows:
- Signature matrix now shows:
- Alerts section now shows:
- Vulnerability section now shows:
- What was removed/simplified:

### Scenario validation notes
- Normal:
- Storm:
- Nitrification Failure:
- Winter:

### Exit decision
- [ ] Mark Phase D complete

---

## 11) Acceptance Criteria (User-facing)

1. A non-coder domain expert can explain scenario differences from insight cards alone.
2. Interval/pbox values are never presented as a single definitive number unless explicitly marked representative.
3. Alerts are concise and non-repetitive (grouped by root theme).
4. Profile highlights persistent vs scenario-specific vulnerabilities.
5. Time and cost analyses clearly show when critical path behavior diverges.

---

## 12) Immediate Next Step

Start **Phase A (Capacity)** in this tracker format:
- Set Status to `[-]`
- Fill “Exactly what was done” as edits happen
- Fill “Final view snapshot” before marking `[x]`
