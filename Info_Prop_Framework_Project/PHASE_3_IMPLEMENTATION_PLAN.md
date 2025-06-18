
---

## Component 3: Network Structure Page Enhancement
**Files:** `site/info-prop-frmwrk/apps/info-prop-frmwrk-ui/src/app/pages/network-structure/network-structure.ts an dits html and scss`

### □ Task 3.1: Add Structure Analysis Button (30 minutes)
- [ ] Add `isRunningStructureAnalysis = signal(false)` state (line ~61)
- [ ] Add `structureAnalysisResult = signal<any>(null)` (line ~62)
- [ ] Implement `runStructureAnalysis()` method using `graphState.runStructureAnalysis()`
- [ ] Add analysis progress tracking
- [ ] Test: Structure analysis button triggers dedicated analysis

### □ Task 3.2: Add Re-run Functionality (20 minutes)
- [ ] Add `getStructureAnalysisButtonText()` method with dynamic text:
  - [ ] "Run Structure Analysis" (never run)
  - [ ] "Re-run Structure Analysis" (previously run)
  - [ ] "Structure Analysis Running..." (in progress)
- [ ] Track last analysis timestamp
- [ ] Test: Button text updates correctly based on analysis state

### □ Task 3.3: Enable Visualization Capabilities (15 minutes)
- [ ] Add `navigateToVisualization()` method with structure focus
- [ ] Add "Visualize Structure" button that becomes available after analysis
- [ ] Pass structure-specific highlighting to visualization page
- [ ] Test: Visualization opens with structure-focused view

### □ Task 3.4: Add Progress Indicators (15 minutes)
- [ ] Add progress bar component for structure analysis
- [ ] Show analysis steps: "Analyzing topology..." → "Computing metrics..." → "Complete!"
- [ ] Display analysis completion time and results summary
- [ ] Test: Progress indicators work during analysis

**Success Criteria:**
- [ ] Clear "Run Structure Analysis" button added
- [ ] Re-run functionality with dynamic button text
- [ ] Direct visualization access with structure focus
- [ ] Comprehensive progress indicators

---

## Component 4: Diamond Analysis Page Enhancement
**File:** `site/info-prop-frmwrk/apps/info-prop-frmwrk-ui/src/app/pages/diamond-analysis/diamond-analysis.ts`

### □ Task 4.1: Add Diamond Analysis Button (25 minutes)
- [ ] Add `isRunningDiamondAnalysis = signal(false)` state (line ~54)
- [ ] Add `diamondAnalysisResult = signal<any>(null)` (line ~55)
- [ ] Implement `runDiamondAnalysis()` method using `graphState.runDiamondAnalysis()`
- [ ] Add analysis state tracking with timestamps
- [ ] Test: Diamond analysis button triggers dedicated analysis

### □ Task 4.2: Implement Analysis State Tracking (20 minutes)
- [ ] Add `getDiamondAnalysisButtonText()` method with dynamic text:
  - [ ] "Run Diamond Analysis" (never run)
  - [ ] "Re-run Diamond Analysis" (previously run)
  - [ ] "Diamond Analysis Running..." (in progress)
- [ ] Track analysis completion and results
- [ ] Test: Button state management works correctly

### □ Task 4.3: Enhanced Diamond Classifications Display (25 minutes)
- [ ] Update diamond list to show analysis timestamps
- [ ] Add analysis result summary (total diamonds found, complexity distribution)
- [ ] Implement diamond classification filtering based on fresh analysis
- [ ] Test: Diamond classifications update after new analysis

### □ Task 4.4: Add Detailed Structure Results (20 minutes)
- [ ] Show analysis metadata (analysis time, parameters used)
- [ ] Add diamond structure statistics in results summary
- [ ] Display analysis confidence and completeness metrics
- [ ] Test: Detailed results display correctly

**Success Criteria:**
- [ ] "Run Diamond Analysis" button with state tracking
- [ ] Dynamic button text based on analysis state
- [ ] Enhanced diamond classification display
- [ ] Detailed analysis results and metadata

---

## Component 5: Reachability Page Implementation
**File:** `site/info-prop-frmwrk/apps/info-prop-frmwrk-ui/src/app/pages/reachability/reachability.ts`

### □ Task 5.1: Complete Reachability Component Implementation (45 minutes)
- [ ] Add full component structure with imports and services (currently minimal)
- [ ] Inject `GraphStateService` and `MainServerService`
- [ ] Add `isRunningReachabilityAnalysis = signal(false)` state
- [ ] Add `reachabilityResults = signal<any>(null)` state
- [ ] Test: Component properly initialized with required services

### □ Task 5.2: Add Reachability Analysis Button (30 minutes)
- [ ] Implement `runReachabilityAnalysis()` method
- [ ] Add analysis progress tracking and state management
- [ ] Implement `getReachabilityAnalysisButtonText()` method
- [ ] Add analysis completion handling
- [ ] Test: Reachability analysis button works correctly

### □ Task 5.3: Move Monte Carlo Option Here (35 minutes)
- [ ] Add `enableMonteCarlo = signal(false)` checkbox control
- [ ] Add `monteCarloSamples = signal(10000)` input field
- [ ] Integrate Monte Carlo options into reachability analysis request
- [ ] Add Monte Carlo validation results display
- [ ] Test: Monte Carlo options work in reachability context

### □ Task 5.4: Implement Probability Results Display (40 minutes)
- [ ] Add reachability probability tables and charts
- [ ] Display node-to-node reachability probabilities
- [ ] Show Monte Carlo validation results when enabled
- [ ] After reacibility calulated, also show node prior probabilities and reachability values in node dteials on hover orc lcik in visualization
- [ ] Add export functionality for reachability results
- [ ] Test: Results display correctly with and without Monte Carlo

### □ Task 5.5: Add Comparison Functionality (25 minutes)
- [ ] Add ability to compare different parameter sets
- [ ] Show reachability differences between analyses
- [ ] Add comparison visualization options
- [ ] Test: Comparison functionality works correctly

**Success Criteria:**
- [ ] Complete reachability component implementation
- [ ] "Run Reachability Analysis" button with state tracking
- [ ] Monte Carlo options moved from Parameters page
- [ ] Comprehensive probability results display
- [ ] Analysis comparison functionality

---

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

---

## Template Updates Required

### □ Upload Page Template (15 minutes)
**File:** `site/info-prop-frmwrk/apps/info-prop-frmwrk-ui/src/app/pages/upload/upload.html`
- [ ] Add detailed validation feedback display
- [ ] Update loading indicators with progression steps
- [ ] Add framework loading status messages

### □ Network Structure Page Template (20 minutes)
**File:** `site/info-prop-frmwrk/apps/info-prop-frmwrk-ui/src/app/pages/network-structure/network-structure.html`
- [ ] Add "Run Structure Analysis" button with dynamic text
- [ ] Add progress indicators for analysis
- [ ] Add "Visualize Structure" button

### □ Diamond Analysis Page Template (20 minutes)
**File:** `site/info-prop-frmwrk/apps/info-prop-frmwrk-ui/src/app/pages/diamond-analysis/diamond-analysis.html`
- [ ] Add "Run Diamond Analysis" button with state management
- [ ] Update results display with analysis metadata
- [ ] Add analysis progress indicators

### □ Reachability Page Template (30 minutes)
**File:** `site/info-prop-frmwrk/apps/info-prop-frmwrk-ui/src/app/pages/reachability/reachability.html`
- [ ] Create complete template with analysis button
- [ ] Add Monte Carlo options section
- [ ] Add results display tables and charts
- [ ] Add comparison functionality UI

### □ Navigation Template (10 minutes)
**File:** `site/info-prop-frmwrk/apps/info-prop-frmwrk-ui/src/app/layout/nav/navigation.html`
- [ ] Add state-based disabled styling
- [ ] Add state indicator badges
- [ ] Add tooltips for disabled items

---

## Testing & Validation Checklist

### □ End-to-End Workflow Testing
- [ ] Upload file → Parameters unlocked
- [ ] Configure parameters → All analysis pages available
- [ ] Run structure analysis → Visualization unlocked
- [ ] Run diamond analysis → Results display correctly
- [ ] Run reachability analysis → Monte Carlo options work
- [ ] Navigate between pages → State preserved correctly

### □ Page-Specific Analysis Testing
- [ ] Each analysis page has focused "Run [Type] Analysis" button
- [ ] Button text updates based on analysis state
- [ ] Progress indicators work during analysis
- [ ] Results display correctly after completion
- [ ] Re-run functionality works properly

### □ Navigation Flow Testing
- [ ] Navigation items enable/disable correctly
- [ ] Visual indicators show page availability
- [ ] Tooltips explain disabled states
- [ ] Page access control works properly

---

## Implementation Order
1. **Component 1** (Upload Page) - Foundation for workflow
2. **Component 2** (Parameters Page) - Remove Monte Carlo, focus parameters
3. **Component 7** (Navigation) - Enable state-based flow control
4. **Component 3** (Network Structure) - First analysis page
5. **Component 4** (Diamond Analysis) - Second analysis page  
6. **Component 5** (Reachability) - Most complex, includes Monte Carlo
7. **Component 6** (Visualization) - Final integration point

## Estimated Timeline
- **Component 1:** 1 hour
- **Component 2:** 45 minutes
- **Component 3:** 1.25 hours
- **Component 4:** 1.5 hours
- **Component 5:** 2.25 hours (most complex)
- **Component 6:** 1.25 hours
- **Component 7:** 1 hour
- **Template Updates:** 1.5 hours
- **Testing:** 1 hour

**Total: ~11 hours for complete Phase 3 implementation**

---

## Success Criteria Summary
✅ Each page has focused analysis functionality  
✅ Clear "Run [Type] Analysis" buttons with state tracking  
✅ Monte Carlo moved to Reachability page  
✅ Navigation flow controls page access based on state  
✅ Upload → Parameters → Analysis pages workflow established  
✅ Visualization requires structure analysis completion  
✅ All analysis results display with proper metadata  
✅ Re-run functionality works across all analysis types