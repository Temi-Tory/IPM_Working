# Phase 2: Parameter Management & State Tracking - Component Implementation Plan

## Overview
Implement parameter change tracking and stale analysis detection to improve user workflow. Work with one component at a time for clear progress tracking.

---

## Component 1: Graph State Service Enhancement
**File:** `site/info-prop-frmwrk/apps/info-prop-frmwrk-ui/src/app/services/graph-state-service.ts`

### □ Task 1.1: Add Parameter Tracking Signals (30 minutes)
- [ ] Add `parametersLastModified = signal<Date | null>(null)` property (line ~26)
- [ ] Add `lastAnalysisRun = signal<Date | null>(null)` property (line ~27)
- [ ] Add `isAnalysisStale = computed(() => {...})` property that compares timestamps
- [ ] Test: Verify signals are properly initialized

### □ Task 1.2: Add Parameter Change Method (15 minutes)
- [ ] Add `markParametersChanged()` method that updates `parametersLastModified` signal
- [ ] Update `loadedAt` timestamp when analysis completes
- [ ] Test: Call method and verify signal updates

### □ Task 1.3: Update Analysis Methods (15 minutes)
- [ ] Update `runFullAnalysis()` method to set `lastAnalysisRun` on success (line ~191)
- [ ] Update `runStructureAnalysis()` method to set `lastAnalysisRun` on success (line ~251)
- [ ] Update `runDiamondAnalysis()` method to set `lastAnalysisRun` on success (line ~307)
- [ ] Test: Run analysis and verify timestamps update

**Success Criteria:**
- [ ] Parameter change tracking signals exist
- [ ] `isAnalysisStale` computed works correctly
- [ ] Analysis methods update timestamps

---

## Component 2: Parameters Component Logic
**File:** `site/info-prop-frmwrk/apps/info-prop-frmwrk-ui/src/app/pages/parameters/parameters.ts`

### □ Task 2.1: Add Stale Detection Properties (15 minutes)
- [ ] Add `readonly isAnalysisStale = computed(() => this.graphState.isAnalysisStale())` (line ~113)
- [ ] Add `readonly hasRunAnalysis = computed(() => this.graphState.lastAnalysisRun() !== null)`
- [ ] Test: Verify computed properties work

### □ Task 2.2: Add Dynamic Button Text Method (20 minutes)
- [ ] Add `getAnalysisButtonText()` method with logic:
  - [ ] Return "Run Analysis" if no previous analysis
  - [ ] Return "Parameters Changed - Re-run Analysis" if stale
  - [ ] Return "Re-run Analysis" if up to date
- [ ] Test: Verify button text changes correctly

### □ Task 2.3: Add Form Change Listeners (30 minutes)
- [ ] Add `basicForm.valueChanges.subscribe()` in constructor to call `markParametersChanged()`
- [ ] Update `setNodeOverride()` method to call `this.graphState.markParametersChanged()` (line ~375)
- [ ] Update `setEdgeOverride()` method to call `this.graphState.markParametersChanged()` (line ~427)
- [ ] Test: Form changes trigger stale state

### □ Task 2.4: Update Analysis Success Handling (10 minutes)
- [ ] Update `runAnalysis()` method to reset stale state on successful completion (line ~192)
- [ ] Test: Successful analysis clears stale state

**Success Criteria:**
- [ ] Form changes mark analysis as stale
- [ ] Button text updates dynamically
- [ ] Individual parameter overrides trigger stale state
- [ ] Successful analysis clears stale state

---

## Component 3: Parameters Template Updates
**File:** `site/info-prop-frmwrk/apps/info-prop-frmwrk-ui/src/app/pages/parameters/parameters.html`

### □ Task 3.1: Add Stale Analysis Warning Card (20 minutes)
- [ ] Add warning card after line 51 (before Parameter Configuration card):
```html
@if (isAnalysisStale()) {
  <mat-card class="page-card warning-card">
    <mat-card-content>
      <div class="warning-content">
        <mat-icon>warning</mat-icon>
        <span>Parameters have been modified since last analysis. Results may be outdated.</span>
      </div>
    </mat-card-content>
  </mat-card>
}
```
- [ ] Test: Warning appears when parameters change

### □ Task 3.2: Update Run Analysis Button (10 minutes)
- [ ] Replace static "Run Analysis" text with `{{ getAnalysisButtonText() }}` (line ~343)
- [ ] Test: Button text changes based on state

### □ Task 3.3: Add CSS Styling (15 minutes)
- [ ] Add CSS for `.warning-card` and `.warning-content` in parameters.scss
- [ ] Style warning icon and message appropriately
- [ ] Test: Warning card displays correctly

**Success Criteria:**
- [ ] Warning card shows when analysis is stale
- [ ] Button text updates dynamically
- [ ] Warning styling is clear and noticeable

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