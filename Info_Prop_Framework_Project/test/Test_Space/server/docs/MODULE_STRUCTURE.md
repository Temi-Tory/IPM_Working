# Network Analysis Tool - Modular Structure

## Overview
The original `script.js` has been split into multiple focused modules for better maintainability, debugging, and organization.

## Module Structure

### Core Files

#### `main.js` - Main Entry Point
- Application initialization
- Global state management (`AppState`)
- Manager coordination
- Global function exports for HTML onclick handlers
- Modal click handling

#### `dom-manager.js` - DOM Management
- DOM element references and caching
- Safe event listener attachment
- Element manipulation utilities
- Error handling and validation
- Basic DOM operations (show/hide, set values, etc.)

#### `ui-utils.js` - UI Utilities
- Icon creation functions
- Checkbox state management
- File size formatting
- Parameter control setup
- Modal utilities
- Download functionality
- Display helpers

### Feature Managers

#### `file-manager.js` - File Operations
- File upload handling
- File validation (CSV check)
- File reading utilities
- Analysis request data preparation
- File status management

#### `analysis-manager.js` - Analysis Operations
- Main analysis execution
- Results processing and display
- Monte Carlo comparison
- Results table management
- Node utility functions (type, prior, probability)
- Analysis state management

#### `diamond-manager.js` - Diamond Analysis
- Diamond data processing
- Diamond list filtering and sorting
- Diamond detail modals
- Path analysis (subset analysis)
- Diamond subgraph visualization
- Diamond-specific utilities

#### `visualization-manager.js` - Network Visualization
- vis.js network creation and management
- Node coloring and sizing
- Layout options
- Node selection and highlighting
- Ancestor/descendant highlighting
- Visualization controls

#### `tab-manager.js` - Tab Navigation
- Tab switching logic
- Tab state management
- Tab enablement/disablement
- Active tab tracking

#### `export-manager.js` - Export Functionality
- Results export (CSV)
- DOT file export
- Diamond analysis export
- Monte Carlo export
- Network statistics export
- Full analysis export

#### `state-manager.js` - State Management
- Application state history
- State save/restore
- State validation
- State import/export
- State summary

## Global State (`AppState`)

Located in `main.js` and shared across all modules:

```javascript
export const AppState = {
    currentFile: null,
    analysisResults: null,
    networkData: null,
    diamondData: null,
    monteCarloResults: null,
    selectedNode: null,
    originalNodePriors: null,
    originalEdgeProbabilities: null,
    currentDiamondData: null,
    pathNetworkInstance: null
};
```

## Manager Communication

Managers communicate through:
1. **Global AppState** - Shared data
2. **window.AppManagers** - Cross-manager method calls
3. **Event system** - DOM events and callbacks

## HTML Integration

### Required Script Tags
```html
<script type="module" src="main.js"></script>
```

### Global Functions for onclick
The following functions are exposed globally for HTML onclick handlers:
- `focusOnNode(nodeId)`
- `showNodeDiamonds(nodeId)`
- `showDiamondDetail(joinNode, diamondIndex)`
- `focusOnDiamondInViz(joinNode)`
- `analyzeDiamondPaths(joinNode)`
- `showDiamondForJoin(joinNode)`
- `highlightAncestors(nodeId)`
- `highlightDescendants(nodeId)`

## Dependencies

### External Libraries
- **vis.js** - Network visualization
- **Browser APIs** - File reading, fetch, etc.

### Module Dependencies
```
main.js
├── dom-manager.js
├── file-manager.js
│   └── ui-utils.js
├── analysis-manager.js
│   └── ui-utils.js
├── diamond-manager.js
│   └── ui-utils.js
├── visualization-manager.js
│   └── ui-utils.js
├── tab-manager.js
├── export-manager.js
│   └── ui-utils.js
└── state-manager.js
```

## Benefits of Modular Structure

1. **Separation of Concerns** - Each module has a single responsibility
2. **Maintainability** - Easier to debug and modify specific features
3. **Reusability** - Modules can be reused or replaced independently
4. **Testing** - Individual modules can be tested in isolation
5. **Collaboration** - Multiple developers can work on different modules
6. **Code Organization** - Related functionality is grouped together
7. **Performance** - Modules can be loaded dynamically if needed

## Migration from Original script.js

All functionality from the original `script.js` has been preserved and distributed across the modules. The global variables are now in `AppState`, and all functions are organized into their respective manager classes.

To use the modular version, simply replace the script.js reference with main.js and ensure all module files are in the same directory.