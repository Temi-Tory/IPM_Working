# Phase 2: Parameter Management & State Tracking - Component Implementation Plan

## Overview
Implement parameter change tracking and stale analysis detection to improve user workflow. Work with one component at a time for clear progress tracking.

---

## Component 1: Graph State Service Enhancement
✅ Task 1.1: Parameter Tracking Signals Added

parametersLastModified = signal<Date | null>(null) - Tracks when parameters were last changed
lastAnalysisRun = signal<Date | null>(null) - Tracks when analysis was last run
isAnalysisStale = computed(() => {...}) - Smart computed that determines if analysis is stale by comparing timestamps

✅ Task 1.2: Parameter Change Method Added

markParametersChanged() - Updates the parametersLastModified signal
Integrated into updateGlobalParameters() method for automatic tracking

✅ Task 1.3: Analysis Methods Updated

loadGraphFromCsv() - Sets lastAnalysisRun timestamp on successful completion
runFullAnalysis() - Sets lastAnalysisRun timestamp on successful completion
runStructureAnalysis() - Sets lastAnalysisRun timestamp on successful completion
runDiamondAnalysis() - Sets lastAnalysisRun timestamp on successful completion

---
I've implemented all the required changes for the Parameters component. Here's a summary of what was added:
✅ Task 2.1: Stale Detection Properties

Added readonly isAnalysisStale = computed(() => this.graphState.isAnalysisStale()) at line 113
Added readonly hasRunAnalysis = computed(() => this.graphState.lastAnalysisRun() !== null)

✅ Task 2.2: Dynamic Button Text Method

Added getAnalysisButtonText() method (lines 157-167) with conditional logic:

Returns "Run Analysis" if no previous analysis exists
Returns "Parameters Changed - Re-run Analysis" if analysis is stale
Returns "Re-run Analysis" if analysis is current



✅ Task 2.3: Form Change Listeners

Added basicForm.valueChanges.subscribe() and advancedForm.valueChanges.subscribe() in constructor (lines 135-141)
Updated setNodeOverride() method (line 415) to call this.graphState.markParametersChanged()
Updated setEdgeOverride() method (line 480) to call this.graphState.markParametersChanged()
Also added stale marking to the clear override methods for consistency

✅ Task 2.4: Analysis Success Handling

Updated runAnalysis() method (line 221) to call this.graphState.clearParametersChanged() on successful completion


## Component 3: Parameters Template Updates
**File:** `site/info-prop-frmwrk/apps/info-prop-frmwrk-ui/src/app/pages/parameters/parameters.html`

🗂️ Complete Files Updated:
1. parameters.component.ts ✅

Full TypeScript component with all required methods
Stale detection logic integrated with GraphStateService
Enhanced parameter tracking and analysis functionality

2. parameters.html ✅

Complete HTML template with Task 3.1 stale warning card added
Task 3.2 button text updated to use {{ getAnalysisButtonText() }}
All existing functionality preserved

3. parameters.scss ✅

Complete SCSS file with Task 3.3 warning card styling
Professional orange gradient warning design
Smooth animations and responsive mobile support
---

## Component 4: Navigation State Awareness (Optional Enhancement)
**File:** `site/info-prop-frmwrk/apps/info-prop-frmwrk-ui/src/app/layout/nav/navigation.ts`

### □ Task 4.1: Add Graph State Injection (10 minutes)
- [ ] Inject `GraphStateService` into Navigation component
- [ ] Add computed properties for navigation state
- [ ] Test: Navigation has access to graph state

### □ Task 4.2: Add State-Based Menu Items (20 minutes)
- [ ] Convert `navItems` to computed property based on graph state
- [ ] Disable/enable menu items based on:
  - [ ] Parameters: After graph loaded
  - [ ] Analysis pages: After graph loaded
  - [ ] Visualization: After structure analysis
- [ ] Test: Menu items enable/disable correctly

**Success Criteria:**
- [ ] Navigation reflects current application state
- [ ] Menu items appropriately enabled/disabled

---

## Testing & Validation Checklist

### □ End-to-End Testing
- [ ] Upload a graph file
- [ ] Verify Parameters page is accessible
- [ ] Change a basic parameter → Warning appears, button text changes
- [ ] Change individual node/edge override → Warning appears
- [ ] Run analysis → Warning disappears, button text updates
- [ ] Change parameter again → Warning reappears

### □ Edge Cases
- [ ] Test with no graph loaded
- [ ] Test with graph loaded but no analysis run
- [ ] Test rapid parameter changes
- [ ] Test form validation with stale state

### □ UI/UX Verification
- [ ] Warning card is visually clear
- [ ] Button text changes are intuitive
- [ ] No layout shifts when warning appears/disappears
- [ ] All interactions feel responsive

---

## Implementation Order
1. **Start with Component 1** (Graph State Service) - Foundation
2. **Move to Component 2** (Parameters Logic) - Core functionality  
3. **Update Component 3** (Template) - User interface
4. **Optional Component 4** (Navigation) - Enhancement

## Estimated Timeline
- **Component 1:** 1 hour
- **Component 2:** 1.25 hours  
- **Component 3:** 45 minutes
- **Component 4:** 30 minutes (optional)
- **Testing:** 30 minutes

**Total: ~3.5 hours for complete implementation**

---

## Success Criteria Summary
✅ Parameter changes trigger "stale analysis" state  
✅ Button text updates: "Run Analysis" → "Re-run Analysis" → "Parameters Changed - Re-run Analysis"  
✅ Warning UI shows when analysis is stale  
✅ Individual parameter overrides mark analysis as stale  
✅ Successful analysis clears stale state  
✅ User workflow is clear and intuitive