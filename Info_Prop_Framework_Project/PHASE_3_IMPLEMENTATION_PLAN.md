

## Component 6: Visualization Page State Control
**File:** `site/info-prop-frmwrk/apps/info-prop-frmwrk-ui/src/app/pages/visualization/visualization.ts`

### □ Task 6.1: Add Structure Analysis Dependency (20 minutes)
- [ ] Add `readonly hasStructureAnalysis = computed(() => this.graphState.lastAnalysisType() !== null)` (line ~115)
- [ ] Add access control: visualization only available after structure analysis
- [ ] Update component initialization to check analysis state
- [ ] Test: Visualization requires prior structure analysis

### □ Task 6.2: Enhanced Interactive Graph Visualization (25 minutes)
- [ ] Add structure-aware highlighting options
- [ ] Implement analysis-based node coloring (based on completed analyses)
- [ ] Add analysis result overlays on visualization
- [ ] Test: Visualization reflects completed analysis results

### □ Task 6.3: Add Analysis-Based Highlighting Options (20 minutes)
- [ ] Add highlighting modes for different analysis types:
  - [ ] "Structure Analysis Results"
  - [ ] "Diamond Analysis Results"  
  - [ ] "Reachability Analysis Results"
- [ ] Update highlighting logic to use analysis results
- [ ] Test: Different analysis results create distinct visualizations

### □ Task 6.4: Ensure Topology Display Works (15 minutes)
- [ ] Verify topology rendering works with all analysis types
- [ ] Add topology validation and error handling
- [ ] Ensure layout algorithms work with analysis-enhanced data
- [ ] Test: Topology displays correctly for all analysis combinations

Task 6.5
- [ ] After reacibility calulated, also show node prior probabilities and reachability values in node dteials on hover orc lcik in visualization
shoudl show prior only when rechailityy notc ial shoudl aos ho otehr dteial and giev use roprion tigt edgs an dnode that are nactesor or decendnts or both and clear just a mor efeinly uix gpah 
generally learn a bit mroe flrom ststaic styele plus resxposinve materilas design 
**Success Criteria:**
- [ ] Visualization requires structure analysis completion
- [ ] Interactive graph reflects analysis results
- [ ] Analysis-based highlighting options available
- [ ] Topology display works reliably

---

## Component 7: Navigation Flow Control Updates
**File:** `site/info-prop-frmwrk/apps/info-prop-frmwrk-ui/src/app/layout/nav/navigation.ts`

### □ Task 7.1: Add State-Based Navigation Control (30 minutes)
- [ ] Inject `GraphStateService` (line ~32)
- [ ] Convert `navItems` to computed property based on graph and analysis state
- [ ] Implement navigation item availability logic:
  - [ ] Upload: Always enabled
  - [ ] Parameters: After graph loaded
  - [ ] Structure/Diamonds/Reachability: After graph loaded
  - [ ] Visualization: After structure analysis complete
- [ ] Test: Navigation items enable/disable correctly

### □ Task 7.2: Add Visual State Indicators (20 minutes)
- [ ] Add state indicators to navigation items (badges, icons)
- [ ] Show analysis completion status in navigation
- [ ] Add tooltips explaining why items are disabled
- [ ] Test: Visual indicators clearly show page availability

### □ Task 7.3: Update Navigation Template (15 minutes)
- [ ] Update navigation HTML to show state-based availability
- [ ] Add disabled styling for unavailable pages
- [ ] Include state indicator badges
- [ ] Test: Navigation template reflects state correctly

**Success Criteria:**
- [ ] Navigation items enable/disable based on application state
- [ ] Clear visual indicators show page availability
- [ ] Tooltips explain disabled states
- [ ] Navigation reflects analysis completion status
