# Capacity V2 Analysis - Comprehensive Investigation & Enhancement Plan

## Critical Bug: Utilization Display Always Shows 0%

### Problem Statement
All edges and nodes show 0% utilization in the UI, despite backend payload containing valid utilization data.

### Example Backend Payload Evidence
```json
"edge_utilization": {
  "(9,10)": { "utilization": 0.5192634792383615, "flow": 3.738, "capacity": 7.2 },
  "(15,16)": { "utilization": 1.0, "flow": 6.5, "capacity": 6.5 },
  "(6,7)": { "utilization": 0.8322628454608082, "flow": 6.991, "capacity": 8.4 }
},
"bottlenecks": {
  "utilization_by_component": {
    "16": 0.8525641025641026,
    "7": 0.579569657391492,
    "(15,16)": 1.0,
    "(12,16)": 1.0
  }
}
```

### Investigation Tasks

**Task 1.1: Backend Data Structure Validation**
- Location: `src/Network-flow-algos/backend_server.jl`
- Search for: capacity analysis endpoint handling
- Verify: Response JSON structure matches frontend expectations
- Check: Field names (utilization vs current_utilization), nesting levels, data types
- Keywords to search: `edge_utilization`, `node_flows`, `bottlenecks`, `utilization_by_component`

**Task 1.2: Frontend Data Parsing**
- Location: `src/Network-flow-algos/front-end/inf-prop-ui/libs/capacity-analysis/`
- Files to examine:
  - Store: `capacity-v2.store.ts` - computed signals for utilization data
  - Service: Look for HTTP service handling capacity analysis responses
  - Components: `capacity-v2-flows-page`, `capacity-v2-bottlenecks-page`, `capacity-v2-visualization-page`
- Check for:
  - How `edge_utilization` object is accessed and transformed
  - Whether utilization percentages are multiplied by 100 for display
  - Edge key format matching: `"(9,10)"` vs `"(9, 10)"` vs tuple formats
  - Node key format: string vs number

**Task 1.3: UI Display Logic**
- Search all Capacity V2 component templates for:
  - `utilization` field bindings
  - Percentage pipe usage: `{{ value | percent }}`
  - Any filters or computed values that might reset to 0
  - Conditional rendering that might hide valid data

**Task 1.4: Example Payload to Test Against**
- Use provided payload structure as reference
- Target flows always have values: `"target_flows": { "4": 7.276, "16": 13.3 }`
- Edge flows always populated in `edge_flows` object
- Utilization nested in multiple places: `edge_utilization`, `bottlenecks.utilization_by_component`

---

## Missing Feature: Comparison Mode

### Background
There was a comparison mode feature to compare 2+ scenarios side-by-side. This has been lost/forgotten in V2 refactor.

### Investigation Tasks

**Task 2.1: Find Original Implementation**
- Search workspace for: `comparison`, `compare scenarios`, `scenario comparison`
- Look in old capacity view files (non-V2)
- Check: `dialog-interfaces-and-components.md`, capacity analysis planning docs
- Find: Original UI design, data structure, state management approach

**Task 2.2: Identify V2 Integration Points**
- Where should comparison mode live in new navigation structure?
- Separate tab or mode toggle within existing views?
- Store design: How to hold multiple scenario results simultaneously?
- Signal architecture: Computed comparisons between scenarios

**Task 2.3: Design Specification**
- Create detailed design for comparison mode in V2 architecture
- Consider: Side-by-side tables, overlay visualizations, diff highlighting
- Store pattern: Array of scenario results with selection state
- UI pattern: Comparison selector, metric delta display, visual overlays

---

## Styling & UX Issues

### Issue 3.1: Dark/Light Mode with Solarized Theme

**Investigation:**
- Verify all Capacity V2 components use CSS custom properties
- Files: All `*.component.scss` in `capacity-v2/` folder
- Check for hardcoded colors: hex values, rgb(), named colors
- Ensure all use: `var(--surface-container)`, `var(--text-primary)`, etc.
- Test: Previous fixes to visualization-page and uncertainty-page are applied

### Issue 3.2: "Run Again" vs "Run All" Buttons

**Investigation:**
- Find pattern in other analysis views
- Search for: `run again`, `run all` in dialog analysis components
- Location: `src/Network-flow-algos/front-end/inf-prop-ui/libs/dialog-analysis/`
- Pattern to replicate: Button placement, state management, loading indicators
- Apply to: Capacity V2 input page, summary page header

### Issue 3.3: Header and Page Titles

**Investigation:**
- Compare headers across analysis views
- Files: 
  - Dialog: `dialog-*-page.component.html` files
  - Capacity V2: `capacity-v2-*-page.component.html` files
- Check for: Consistent title hierarchy, mat-card headers, description sections
- Pattern: Title + subtitle + description/help text structure

### Issue 3.4: Grey Dead Zone When Sidenav Closed

**Investigation:**
- File: `capacity-v2-sidenav-shell.component.html` and `.scss`
- Check: mat-sidenav-content flex layout, width calculations
- Look for: Static widths, missing flex-grow, padding that doesn't adapt
- Compare with: Dialog sidenav shell or other multi-view layouts
- Fix: Dynamic flex layout that spreads content when sidenav collapses

### Issue 3.5: Active Nav Item Highlighting

**Investigation:**
- File: `capacity-v2-sidenav-shell.component.html` nav template
- Look for: RouterLinkActive directive, active class binding
- Check: CSS for `.active` or `[aria-current="page"]` styling
- SCSS: Ensure active state has distinct background/border/text color
- Pattern: `[routerLinkActive]="['active']"` + `.active { background: var(--primary-container); }`

---

## Visualization Enhancements

### Issue 4.1: More Reactive and Intuitive Visualization

**Investigation:**
- Current: `capacity-v2-visualization-page.component.ts`
- Check: Graph rendering library (D3? Cytoscape? Canvas?)
- Features to add:
  - Zoom/pan controls
  - Node drag-and-drop repositioning
  - Click to select node/edge → show details panel
  - Hover tooltips with flow/capacity/utilization
  - Visual indicators: Color by utilization (green → yellow → red)
  - Edge thickness proportional to flow

**Task 4.2: Variable Options While Scenario Selected**
- Add controls without re-running analysis:
  - Toggle node labels
  - Toggle edge labels (flow, capacity, utilization)
  - Filter by utilization threshold (show only >50%, >80%, etc.)
  - Highlight critical path
  - Highlight bottlenecks
  - Layout algorithm selection (force-directed, hierarchical, circular)

---

## Summary Tab Design Issues

### Issue 5: Summary Content Should Be Redesigned

**Investigation:**
- Current: `capacity-v2-summary-page.component.ts/html`
- Problem: While selected scenario is dynamic, summary stuff is not
- Should be dropped in favor of analysis tabs design
- Alternative design: Quick metrics + navigation to detailed tabs
- Pattern: Card-based layout with key metrics, clicking card opens relevant tab
  - Total flow card → opens flows page
  - Bottlenecks card → opens bottlenecks page
  - Critical paths card → opens paths page
  - Upgrade priorities card → opens upgrades page

---

## Saving Previous Runs & Run History

### Issue 6: No History of Previous Analysis Runs

**Investigation:**
- Feature needed: Save results of each capacity analysis run
- Store design: Add `analysisHistory: Signal<CapacityResult[]>`
- Display: New "History" or "Previous Runs" tab
- UI: Table/list of previous runs with timestamp, scenario name, max flow, bottlenecks count
- Action: Click to load previous result (no re-computation)
- Persistence: LocalStorage or IndexedDB for cross-session persistence

**Task 6.1: Backend Integration**
- Check if backend already saves results: search for file writing in `backend_server.jl`
- If not: Add endpoint to list previous analysis results from `temp_uploads/` directory

**Task 6.2: Frontend Implementation**
- Store: Add history array signal, add result to history on each successful run
- UI: New history tab with table of runs
- Actions: Load, compare, delete previous runs

---

## Learn from Old Capacity Views

### Task 7: Comprehensive Comparison with V1 Capacity Views

**Investigation:**
- Find old capacity view components: search for files without `-v2` suffix
- Compare features present in old views but missing in V2:
  - Layout patterns
  - Tooltips and help text
  - Explanation sections for mathematical concepts
  - Export functionality
  - Filter/search patterns
  - Data grouping/aggregation options

**Files to Search:**
- `grep_search`: `"capacity.*component"` excluding `-v2` files
- Look for: Old capacity dialogs, analysis pages, visualization components

**Task 7.1: Tooltips & Help Text**
- Find: MatTooltip usage in old views
- Pattern: Icon buttons with help text explaining metrics
- Apply to: All tables showing mathematical concepts (utilization, spare capacity, priority scores)

**Task 7.2: Explanation Sections**
- Find: Expandable panels or info cards explaining algorithms
- Pattern: Mat-expansion-panel with "How is this calculated?"
- Apply to: Summary page, bottlenecks page (explain min-cut, max-flow)

---

## Store & Signals Architecture Enhancement

### Issue 8: Profile View Integration

**Problem:**
- Profile view doesn't consider Capacity V2 because store isn't set up for cross-feature consumption
- Need: General overview of all scenarios run across all features
- Solution: Shared state/signals for scenario metadata

**Task 8.1: Store Refactoring**
- File: `capacity-v2.store.ts`
- Add: Public signals for scenario metadata that profile can consume
  - `readonly allRunScenarios: Signal<ScenarioMetadata[]>`
  - `readonly recentCapacityAnalyses: Signal<CapacityAnalysisSummary[]>`
- Structure:
```typescript
interface ScenarioMetadata {
  id: string;
  label: string;
  timestamp: Date;
  analysisType: 'capacity' | 'dialog' | 'uncertainty';
  key_metrics: Record<string, number>;
}
```

**Task 8.2: Profile View Enhancement**
- File: Search for profile component
- Add: Capacity analysis section consuming shared store
- Display: Cards showing recent capacity runs, max flows, bottlenecks identified

**Task 8.3: Scenario Overview Page**
- New page: "All Scenarios Overview"
- Shows: Table of all scenarios across all analysis types
- Columns: Name, type, date run, key metrics, actions (view, compare, delete)
- Integration point: Top-level navigation or profile section

---

## Capacity Analysis Plan Review

### Task 9: Strategic Design Review

**Files to Review:**
- `CAPACITY_V2_MIGRATION_PLAN.md`
- `CAPACITY_V2_DETAILED_EXECUTION_PLAN.md`
- `CAPACITY_ANALYSIS_REFACTOR_PLAN.md`
- `capacity-v2.mapping.md`
- `COMPONENT_REDESIGN_PLAN.md`

**Review Focus:**
- Original goals vs current implementation
- What features were planned but not implemented?
- What user workflows were envisioned?
- How do users actually want to interact with capacity analysis?

**Task 9.1: User Workflow Analysis**
- Define primary user journeys:
  1. Quick capacity check for single scenario
  2. Compare multiple network configurations
  3. Identify and prioritize upgrades
  4. Historical trend analysis
  5. Export results for reporting

**Task 9.2: Feature Gap Analysis**
- Create matrix: Planned features vs Implemented features
- Identify: High-value missing features
- Prioritize: Based on user workflow importance

**Task 9.3: Enhancement Roadmap**
- Short term (immediate fixes): Utilization display bug, styling issues, active nav highlighting
- Medium term (next sprint): Comparison mode, history/previous runs, improved visualization
- Long term (strategic): Profile integration, cross-feature scenario management, advanced filtering

---

## Investigation Execution Plan

### Phase 1: Critical Bug Fix (Immediate)
1. Debug utilization display issue (Tasks 1.1-1.4)
2. Fix active nav highlighting (Task 3.5)
3. Fix grey dead zone layout (Task 3.4)

### Phase 2: Styling & UX Consistency (Week 1)
1. Verify dark/light mode coverage (Task 3.1)
2. Add run again/run all buttons (Task 3.2)
3. Standardize headers and titles (Task 3.3)
4. Add tooltips and help text (Task 7.1)

### Phase 3: Missing Features (Week 2)
1. Implement comparison mode (Tasks 2.1-2.3)
2. Add run history/previous results (Task 6.1-6.2)
3. Enhance visualization interactivity (Task 4.1-4.2)

### Phase 4: Integration & Enhancement (Week 3)
1. Store refactoring for cross-feature consumption (Task 8.1)
2. Profile view integration (Task 8.2)
3. Scenario overview page (Task 8.3)
4. Summary page redesign (Task 5)

### Phase 5: Strategic Review (Week 4)
1. Review capacity analysis plans (Task 9)
2. Learn from old capacity views (Task 7)
3. Create comprehensive enhancement roadmap (Task 9.3)

---

## Key File Locations Reference

### Backend
- **Main Server**: `src/Network-flow-algos/backend_server.jl`
- **Capacity Module**: Search workspace for Julia files with "capacity" in name

### Frontend - Capacity V2
- **Store**: `src/Network-flow-algos/front-end/inf-prop-ui/libs/capacity-analysis/src/lib/capacity-v2.store.ts`
- **Shell**: `src/Network-flow-algos/front-end/inf-prop-ui/libs/capacity-analysis/src/lib/capacity-v2-sidenav-shell/`
- **Pages**: `src/Network-flow-algos/front-end/inf-prop-ui/libs/capacity-analysis/src/lib/capacity-v2-*-page/`

### Frontend - Other Analysis Views (for reference)
- **Dialog Analysis**: `src/Network-flow-algos/front-end/inf-prop-ui/libs/dialog-analysis/`
- **Profile View**: Search for profile components

### Planning Documents
- `CAPACITY_V2_MIGRATION_PLAN.md`
- `CAPACITY_V2_DETAILED_EXECUTION_PLAN.md`
- `capacity-v2.mapping.md`
- `dialog-interfaces-and-components.md`

---

## Search Keywords for Investigation

### For Utilization Bug
- `edge_utilization`, `node_flows`, `utilization_by_component`
- `current_utilization`, `percent`, `toFixed`
- Edge key formats: search for regex `\(\d+,\s?\d+\)`

### For Comparison Mode
- `comparison`, `compare.*scenario`, `multi.*scenario`
- `selected.*scenarios`, `scenario.*selector`

### For Styling Patterns
- `var\(--`, hardcoded colors: `#[0-9a-f]{3,6}`, `rgb\(`, `rgba\(`
- `routerLinkActive`, `.active`, `[aria-current]`

### For Old Capacity Views
- Files without `-v2`: `capacity.*component` exclude `v2`
- `MatTooltip`, `mat-expansion-panel`, `explanation`

---

## Success Criteria

### Must Fix (P0)
- ✅ Utilization displays correctly (not 0%) for all edges and nodes
- ✅ Active nav item highlights in capacity analysis navigation
- ✅ Layout spreads properly when sidenav closed (no grey dead zone)
- ✅ All components respect dark/light mode theme

### Should Have (P1)
- ✅ Comparison mode functional for 2+ scenarios
- ✅ Run history/previous results accessible
- ✅ Headers and titles consistent with other analysis views
- ✅ Basic visualization interactivity (zoom, pan, tooltips)

### Nice to Have (P2)
- ✅ Advanced visualization features (drag-drop, variable display options)
- ✅ Profile view shows capacity analysis data
- ✅ Scenario overview page across all analysis types
- ✅ Explanation sections for mathematical concepts
- ✅ Comprehensive tooltips throughout

---

## Agent Coordination

This investigation requires multiple specialized subagents:

1. **Bug Investigation Agent**: Focus on utilization display bug (Phase 1, Task 1)
2. **Styling Agent**: Handle all CSS/theming issues (Phase 2, Tasks 3.1-3.5)
3. **Feature Discovery Agent**: Find old capacity view patterns (Phase 2, Task 7)
4. **Feature Implementation Agent**: Build comparison mode, history (Phase 3)
5. **Architecture Agent**: Store refactoring, cross-feature integration (Phase 4)
6. **Strategic Planning Agent**: Review plans, create roadmap (Phase 5)

Each agent should report findings before implementation to coordinate architectural decisions.
