# 🚀 Network Analysis Application Implementation Plan

## 📋 Project Overview

Building a sophisticated Angular network analysis application with:
- **NgRx** for robust state management
- **Angular Material** with custom muted purple/pink theming
- **Cytoscape.js** for interactive network visualization
- **Nx workspace** with reusable libraries
- **Desktop-first responsive design** (network analysis is primarily desktop work)

## 🎯 Implementation Phases

### Phase 1: Foundation Setup (Week 1)

#### 1.1 Dependencies Installation
```bash
# Navigate to workspace
cd website/workspace

# Install core dependencies
npm install @ngrx/store @ngrx/effects @ngrx/store-devtools @ngrx/router-store
npm install @angular/material @angular/cdk @angular/animations
npm install cytoscape @types/cytoscape
npm install rxjs

# Install additional utilities
npm install lodash @types/lodash
npm install uuid @types/uuid
```

#### 1.2 Nx Libraries Creation
```bash
# Generate shared libraries
nx generate @nx/angular:library ui-components --directory=libs/ui-components --importPath=@network-analysis/ui-components
nx generate @nx/angular:library network-core --directory=libs/network-core --importPath=@network-analysis/network-core
nx generate @nx/angular:library visualization --directory=libs/visualization --importPath=@network-analysis/visualization
```

#### 1.3 Angular Material Setup
```bash
# Add Angular Material to main app
nx generate @angular/material:ng-add --project=network-flow-ui
```

### Phase 2: Core Architecture (Week 2)

#### 2.1 NgRx Store Foundation
```bash
# Generate NgRx feature stores
nx generate @ngrx/schematics:feature --name=network --project=network-flow-ui --module=app.module.ts
nx generate @ngrx/schematics:feature --name=ui --project=network-flow-ui --module=app.module.ts
```

#### 2.2 Main Layout Components
```bash
# Generate layout components
nx generate @nx/angular:component main-layout --project=network-flow-ui --style=scss
nx generate @nx/angular:component header --project=network-flow-ui --style=scss
nx generate @nx/angular:component sidebar --project=network-flow-ui --style=scss
```

#### 2.3 Shared UI Components Library
```bash
# Generate shared components
nx generate @nx/angular:component button --project=ui-components --export
nx generate @nx/angular:component card --project=ui-components --export
nx generate @nx/angular:component loading-spinner --project=ui-components --export
nx generate @nx/angular:component file-upload --project=ui-components --export
```

### Phase 3: Core Features (Week 3-4)

#### 3.1 Network Setup Module
```bash
# Generate network setup feature
nx generate @nx/angular:component network-setup --project=network-flow-ui --style=scss
nx generate @nx/angular:component network-preview --project=network-flow-ui --style=scss
nx generate @nx/angular:service network-setup --project=network-flow-ui
```

#### 3.2 Visualization Module
```bash
# Generate visualization components in lib
nx generate @nx/angular:component network-viewer --project=visualization --export
nx generate @nx/angular:component layout-controls --project=visualization --export
nx generate @nx/angular:service cytoscape --project=visualization
```

#### 3.3 API Integration
```bash
# Generate API services
nx generate @nx/angular:service api --project=network-flow-ui
nx generate @nx/angular:service file-handler --project=network-flow-ui
```

## 🎨 Design System Specifications

### Color Palette (Muted & Professional)
```scss
// Primary Colors
$primary-purple: #6B5B95;        // Muted purple
$secondary-pink: #D4A5A5;        // Dusty pink
$accent-lavender: #B8A9C9;       // Soft lavender

// Neutral Colors
$background-primary: #FAFAFA;     // Warm white
$background-secondary: #F5F5F5;   // Light gray
$surface-primary: #FFFFFF;        // Pure white
$surface-secondary: #F8F8F8;      // Off white

// Text Colors
$text-primary: #2C2C2C;          // Charcoal
$text-secondary: #5A5A5A;        // Medium gray
$text-disabled: #9E9E9E;         // Light gray

// Status Colors
$success: #7CB342;               // Muted green
$warning: #FFB74D;               // Muted orange
$error: #E57373;                 // Muted red
$info: #64B5F6;                  // Muted blue
```

### Typography Scale
```scss
// Font Families
$font-primary: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
$font-mono: 'JetBrains Mono', 'Consolas', 'Monaco', monospace;

// Font Sizes (Desktop-first)
$font-size-h1: 2.5rem;    // 40px
$font-size-h2: 2rem;      // 32px
$font-size-h3: 1.5rem;    // 24px
$font-size-h4: 1.25rem;   // 20px
$font-size-body: 1rem;    // 16px
$font-size-small: 0.875rem; // 14px
$font-size-caption: 0.75rem; // 12px
```

### Responsive Breakpoints (Desktop-first)
```scss
// Desktop-first breakpoints
$breakpoint-xl: 1440px;   // Large desktop
$breakpoint-lg: 1200px;   // Desktop
$breakpoint-md: 992px;    // Small desktop/large tablet
$breakpoint-sm: 768px;    // Tablet
$breakpoint-xs: 576px;    // Large mobile
```

## 🏗️ Architecture Structure

### Nx Workspace Structure
```
website/workspace/
├── apps/
│   └── network-flow-ui/           # Main Angular application
├── libs/
│   ├── ui-components/             # Shared UI components
│   │   ├── src/lib/
│   │   │   ├── button/
│   │   │   ├── card/
│   │   │   ├── loading-spinner/
│   │   │   ├── file-upload/
│   │   │   └── index.ts
│   ├── network-core/              # Data models and business logic
│   │   ├── src/lib/
│   │   │   ├── models/
│   │   │   │   ├── network.models.ts
│   │   │   │   ├── analysis.models.ts
│   │   │   │   └── api.models.ts
│   │   │   ├── interfaces/
│   │   │   ├── types/
│   │   │   └── index.ts
│   └── visualization/             # Cytoscape components
│       ├── src/lib/
│       │   ├── network-viewer/
│       │   ├── layout-controls/
│       │   ├── services/
│       │   │   └── cytoscape.service.ts
│       │   └── index.ts
```

### NgRx State Architecture
```typescript
interface AppState {
  network: NetworkState;
  ui: UIState;
  router: RouterReducerState;
}

interface NetworkState {
  // Core network data
  data: NetworkData | null;
  adjacencyMatrix: number[][];
  edgeList: Edge[];
  nodeList: Node[];
  
  // File management
  uploadedFiles: {
    dag?: File;
    nodeProbabilities?: File;
    edgeProbabilities?: File;
  };
  
  // Processing state
  isLoading: boolean;
  isProcessing: boolean;
  error: string | null;
  
  // Analysis results
  analysisResults: AnalysisResults | null;
  analysisHistory: AnalysisHistoryItem[];
}

interface UIState {
  // Layout state
  sidenavOpen: boolean;
  sidenavMode: 'over' | 'side';
  
  // Theme and preferences
  theme: 'light' | 'dark';
  compactMode: boolean;
  
  // Navigation
  currentRoute: string;
  breadcrumbs: BreadcrumbItem[];
  
  // Loading states
  globalLoading: boolean;
  loadingMessage: string;
}
```

### Component Hierarchy
```
AppComponent
├── MainLayoutComponent
│   ├── HeaderComponent
│   │   ├── LogoComponent (ui-components)
│   │   ├── NavigationComponent
│   │   └── UserMenuComponent (ui-components)
│   ├── SidebarComponent
│   │   ├── NavigationMenuComponent
│   │   └── QuickActionsComponent
│   └── MainContentComponent
│       └── RouterOutlet
│           ├── NetworkSetupComponent
│           │   ├── FileUploadComponent (ui-components)
│           │   ├── NetworkPreviewComponent
│           │   └── UploadProgressComponent (ui-components)
│           └── VisualizationComponent
│               ├── NetworkViewerComponent (visualization)
│               ├── LayoutControlsComponent (visualization)
│               ├── ZoomControlsComponent (visualization)
│               └── NetworkStatsComponent
```

## 📱 Responsive Design Strategy (Desktop-first)

### Layout Approach
- **Primary Target**: Desktop users (1200px+) for network analysis
- **Secondary**: Tablet landscape (992px+) for review and presentation
- **Minimal**: Mobile support for basic viewing only

### Navigation Strategy
```scss
// Desktop (1200px+)
.sidebar {
  width: 280px;
  position: fixed;
  left: 0;
}

.main-content {
  margin-left: 280px;
  padding: 24px;
}

// Tablet (768px - 1199px)
@media (max-width: 1199px) {
  .sidebar {
    width: 240px;
  }
  
  .main-content {
    margin-left: 240px;
    padding: 16px;
  }
}

// Mobile (< 768px)
@media (max-width: 767px) {
  .sidebar {
    transform: translateX(-100%);
    transition: transform 0.3s ease;
    
    &.open {
      transform: translateX(0);
    }
  }
  
  .main-content {
    margin-left: 0;
    padding: 12px;
  }
}
```

### Visualization Responsiveness
```typescript
// Cytoscape responsive configuration
const cytoscapeConfig = {
  desktop: {
    minZoom: 0.1,
    maxZoom: 3,
    wheelSensitivity: 0.1,
    panningEnabled: true,
    boxSelectionEnabled: true
  },
  tablet: {
    minZoom: 0.2,
    maxZoom: 2,
    wheelSensitivity: 0.2,
    panningEnabled: true,
    boxSelectionEnabled: false
  },
  mobile: {
    minZoom: 0.3,
    maxZoom: 1.5,
    wheelSensitivity: 0.3,
    panningEnabled: true,
    boxSelectionEnabled: false,
    touchTapThreshold: 8,
    desktopTapThreshold: 4
  }
};
```

## 🔧 Technical Implementation Details

### Angular Material Theme Configuration
```scss
// apps/network-flow-ui/src/styles.scss
@use '@angular/material' as mat;

// Define custom palettes
$custom-purple: (
  50: #f3f1f7,
  100: #e1dceb,
  200: #cdc4dd,
  300: #b8abcf,
  400: #a898c5,
  500: #9885bb,  // Base purple
  600: #8f7db5,
  700: #8472ac,
  800: #7a68a4,
  900: #6b5b95,  // Primary purple
  A100: #ffffff,
  A200: #f5f3ff,
  A400: #d1c7ff,
  A700: #beb1ff,
  contrast: (
    50: rgba(black, 0.87),
    100: rgba(black, 0.87),
    200: rgba(black, 0.87),
    300: rgba(black, 0.87),
    400: rgba(black, 0.87),
    500: white,
    600: white,
    700: white,
    800: white,
    900: white,
    A100: rgba(black, 0.87),
    A200: rgba(black, 0.87),
    A400: rgba(black, 0.87),
    A700: white,
  )
);

$custom-pink: (
  50: #faf7f7,
  100: #f2ebeb,
  200: #eadddd,
  300: #e1cfcf,
  400: #dac5c5,
  500: #d4a5a5,  // Base pink
  600: #cf9d9d,
  700: #c99393,
  800: #c38a8a,
  900: #b97979,
  A100: #ffffff,
  A200: #ffffff,
  A400: #ffd6d6,
  A700: #ffbdbd,
  contrast: (
    50: rgba(black, 0.87),
    100: rgba(black, 0.87),
    200: rgba(black, 0.87),
    300: rgba(black, 0.87),
    400: rgba(black, 0.87),
    500: rgba(black, 0.87),
    600: rgba(black, 0.87),
    700: rgba(black, 0.87),
    800: rgba(black, 0.87),
    900: rgba(black, 0.87),
    A100: rgba(black, 0.87),
    A200: rgba(black, 0.87),
    A400: rgba(black, 0.87),
    A700: rgba(black, 0.87),
  )
);

// Create theme
$primary: mat.define-palette($custom-purple, 900);
$accent: mat.define-palette($custom-pink, 500);
$warn: mat.define-palette(mat.$red-palette);

$theme: mat.define-light-theme((
  color: (
    primary: $primary,
    accent: $accent,
    warn: $warn,
  ),
  typography: mat.define-typography-config(
    $font-family: 'Inter, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
  ),
  density: 0,
));

@include mat.all-component-themes($theme);
```

### NgRx Store Configuration
```typescript
// apps/network-flow-ui/src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { provideRouterStore } from '@ngrx/router-store';

import { networkReducer } from './store/network/network.reducer';
import { uiReducer } from './store/ui/ui.reducer';
import { NetworkEffects } from './store/network/network.effects';

export const appConfig: ApplicationConfig = {
  providers: [
    provideStore({
      network: networkReducer,
      ui: uiReducer,
    }),
    provideEffects([NetworkEffects]),
    provideStoreDevtools({
      maxAge: 25,
      logOnly: false,
      autoPause: true,
    }),
    provideRouterStore(),
    // ... other providers
  ],
};
```

## 🚀 Implementation Timeline

### Week 1: Foundation
- [ ] Install all dependencies
- [ ] Create Nx libraries structure
- [ ] Set up Angular Material theming
- [ ] Configure NgRx store foundation
- [ ] Create basic routing structure

### Week 2: Core Architecture
- [ ] Implement main layout components
- [ ] Create shared UI components library
- [ ] Set up responsive navigation
- [ ] Implement basic state management
- [ ] Create service layer foundation

### Week 3: Network Setup
- [ ] Build file upload functionality
- [ ] Implement network data parsing
- [ ] Create network preview component
- [ ] Add validation and error handling
- [ ] Integrate with Julia API endpoints

### Week 4: Visualization
- [ ] Integrate Cytoscape.js
- [ ] Create network viewer component
- [ ] Implement layout controls
- [ ] Add zoom and pan functionality
- [ ] Create responsive visualization

### Week 5: Polish & Testing
- [ ] Implement loading states
- [ ] Add error boundaries
- [ ] Create comprehensive tests
- [ ] Optimize performance
- [ ] Final UI/UX refinements

## 🎯 Success Criteria

### Functional Requirements
- ✅ Professional desktop-first responsive design
- ✅ Muted purple/pink theme with sophisticated styling
- ✅ File upload with drag & drop support
- ✅ Interactive network visualization with Cytoscape.js
- ✅ NgRx state management for complex data flows
- ✅ Modular Nx library structure for reusability
- ✅ Integration with Julia backend API

### Technical Requirements
- ✅ TypeScript strict mode compliance
- ✅ Angular best practices and style guide
- ✅ Responsive design with smooth animations
- ✅ Accessibility (WCAG 2.1 AA compliance)
- ✅ Performance optimization (< 3s load time)
- ✅ Comprehensive error handling

### User Experience Requirements
- ✅ Intuitive navigation and workflow
- ✅ Professional, academic-appropriate design
- ✅ Smooth, non-jarring animations
- ✅ Clear visual hierarchy and typography
- ✅ Consistent interaction patterns

This implementation plan provides a solid foundation for building your sophisticated network analysis application with the professional quality required for PhD-level work.