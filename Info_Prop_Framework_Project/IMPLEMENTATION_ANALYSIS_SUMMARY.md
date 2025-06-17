# Angular Enhancement: Implementation Checklist
chcek box as each process complete 
## Phase 1: Project Setup & Understanding

### □ 1.1 Project Analysis
- [ ] Review current Angular app structure (Port 4200)
- [ ] Understand existing file organization
- [ ] Identify key service files: `graph-state-service.ts`
- [ ] Locate parameters page: `apps/info-prop-frmwrk-ui/src/app/pages/parameters/parameters.ts`
- [ ] Map out current navigation structure

### □ 1.2 User Workflow Documentation Review
- [ ] Understand 5 application flow states:
  - [ ] Initial State (Upload only)
  - [ ] File Validated (Parameters unlocked)
  - [ ] Graph Loaded (All analysis available)  
  - [ ] Parameters Modified (Analysis stale)
  - [ ] Analysis Complete (Results available)

## Phase 2: Option A - Parameter Management & State Tracking (RECOMMENDED START)

### □ 2.1 Step 1: Add Parameter Change Tracking (1 hour)
- [ ] Open `graph-state-service.ts`
- [ ] Add `parametersLastModified` signal property
- [ ] Add `lastAnalysisRun` signal property  
- [ ] Implement `isAnalysisStale` computed property
- [ ] Add `markParametersChanged()` method
- [ ] Test signal implementation

### □ 2.2 Step 2: Add Stale Detection UI (1 hour)
- [ ] Open `parameters.ts`
- [ ] Add `isAnalysisStale` readonly property
- [ ] Implement `getAnalysisButtonText()` method with logic:
  - [ ] "Run Analysis" (no previous analysis)
  - [ ] "Parameters Changed - Re-run Analysis" (stale)
  - [ ] "Re-run Analysis" (up to date)
- [ ] Test button text changes

### □ 2.3 Step 3: Add Parameter Change Listeners (1-2 hours)
- [ ] Add form value change subscription to `basicForm.valueChanges`
- [ ] Update `setNodeOverride()` method to call `markParametersChanged()`
- [ ] Add change listeners to all parameter controls
- [ ] Test that parameter changes trigger stale state
- [ ] Verify individual node/edge overrides mark analysis as stale

### □ 2.4 Step 4: Add Warning UI Component (30 minutes)
- [ ] Open parameters HTML template
- [ ] Add warning card with conditional display (`@if (isAnalysisStale())`)
- [ ] Include warning icon and message
- [ ] Style warning card appropriately
- [ ] Test warning appears when parameters change

### □ 2.5 Option A Success Criteria Verification
- [ ] Parameter changes trigger "stale analysis" state
- [ ] Button text updates correctly: "Run" → "Re-run" → "Parameters Changed"
- [ ] Warning UI shows when analysis is stale
- [ ] Individual parameter overrides mark analysis as stale

## Phase 3: Page Structure Requirements (Future Implementation)

### □ 3.1 Upload Page Enhancement
- [ ] Ensure only available initially
- [ ] Implement file validation feedback
- [ ] Add framework loading indicators
- [ ] Unlock Parameters page on success

### □ 3.2 Parameters Page Refinement  
- [ ] Focus on edge/node parameter modification only
- [ ] Remove Monte Carlo option (move to Reachability)
- [ ] Implement comprehensive state tracking
- [ ] Add parameter change detection

### □ 3.3 Network Structure Page
- [ ] Add clear "Run Structure Analysis" button
- [ ] Implement re-run functionality
- [ ] Enable visualization capabilities
- [ ] Add progress indicators

### □ 3.4 Diamond Analysis Page
- [ ] Add "Run Diamond Analysis" button
- [ ] Implement analysis state tracking
- [ ] Display diamond classifications
- [ ] Add detailed structure results

### □ 3.5 Reachability Page
- [ ] Add "Run Reachability Analysis" button
- [ ] Move Monte Carlo option here (checkbox + sample count)
- [ ] Implement probability results display
- [ ] Add comparison functionality

### □ 3.6 Visualization Page
- [ ] Enable after structure analysis complete
- [ ] Implement interactive graph visualization
- [ ] Add highlighting options
- [ ] Ensure topology display works

## Phase 4: Navigation Flow Control (Option B - Medium Priority)

### □ 4.1 Navigation Guards Implementation
- [ ] Modify `navigation.ts` 
- [ ] Add state-based menu control with computed navItems
- [ ] Implement page availability logic:
  - [ ] Upload: Always enabled
  - [ ] Parameters: After graph loaded
  - [ ] Structure/Diamonds/Reachability: After graph loaded  
  - [ ] Visualization: After structure analysis
- [ ] Test navigation restrictions

### □ 4.2 Action Buttons on Analysis Pages
- [ ] Add focused action buttons to each analysis page
- [ ] Implement "Run Analysis" / "Re-run Analysis" logic
- [ ] Add clear headers for each analysis type
- [ ] Test button state management

### □ 4.3 Option B Success Criteria Verification
- [ ] Navigation menu items enable/disable based on state
- [ ] Upload → Parameters → Analysis pages flow works
- [ ] Each page has clear action buttons
- [ ] Page guards prevent access to unavailable features

## Phase 5: Advanced Analysis Actions (Option C - Lower Priority)

### □ 5.1 Network Structure Page Actions
- [ ] Create/modify `network-structure.ts`
- [ ] Add "Run Structure Analysis" button with header
- [ ] Implement analysis state tracking
- [ ] Add progress indicators and result displays

### □ 5.2 Diamond Analysis Page Actions  
- [ ] Create/modify `diamond-analysis.ts`
- [ ] Add "Run Diamond Analysis" button with header
- [ ] Implement analysis progress tracking
- [ ] Add result visualization

### □ 5.3 Reachability Page Actions
- [ ] Create/modify `reachability.ts` 
- [ ] Add "Run Reachability Analysis" button
- [ ] Move Monte Carlo option from Parameters page
- [ ] Implement checkbox "Include Monte Carlo Validation"
- [ ] Add sample count input
- [ ] Test Monte Carlo integration

### □ 5.4 Option C Success Criteria Verification
- [ ] Each analysis page has focused "Run [Type] Analysis" button
- [ ] Monte Carlo option moved to Reachability page
- [ ] Analysis state tracked per page type
- [ ] Clear progress indicators and result displays

## Phase 6: Final Integration & Testing

### □ 6.1 End-to-End Testing
- [ ] Test complete user workflow from upload to analysis
- [ ] Verify all state transitions work correctly
- [ ] Test parameter change detection across all scenarios
- [ ] Validate navigation flow control

### □ 6.2 Performance & UX Verification
- [ ] Test responsiveness of state changes
- [ ] Verify all UI components render correctly
- [ ] Check accessibility of new warning components
- [ ] Test on different screen sizes

### □ 6.3 Code Quality Review
- [ ] Review TypeScript types and interfaces
- [ ] Ensure proper error handling
- [ ] Verify signal/computed usage is optimal
- [ ] Add any missing documentation

## Current Recommendation: 
**Start with Phase 2 (Option A)** - Parameter tracking and stale detection forms the foundation for the entire user experience flow.

---
**Estimated Timeline:**
- Phase 2 (Option A): 2-3 days
- Phase 4 (Option B): 3-4 days  
- Phase 5 (Option C): 4-5 days