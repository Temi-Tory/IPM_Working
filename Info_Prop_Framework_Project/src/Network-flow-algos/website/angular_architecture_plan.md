# Angular Network Analysis Application Architecture

## 📋 Executive Summary

This document outlines the comprehensive architecture for an Angular-based network analysis application that integrates with the existing Julia Information Propagation Analysis (IPA) Framework. The application provides sophisticated multi-level diamond analysis capabilities with advanced state management, interactive visualizations, and seamless API integration.

### Key Features
- **Multi-Level Analysis**: Global, Subgraph, Local, and Nested Diamond analysis modes
- **Interactive Visualization**: Cytoscape.js-powered network graphs with drill-down capabilities
- **Advanced State Management**: NgRx-based state architecture with persistence
- **Hierarchical Tab System**: Multi-level navigation with independent analysis contexts
- **Comprehensive File Handling**: Drag & drop support for DAG, node, and edge probability files
- **Real-time Parameter Management**: Dynamic override capabilities with easy revert functionality

---

## 🏗️ Architecture Overview

```mermaid
graph TB
    subgraph "Angular Frontend"
        UI[User Interface Layer]
        COMP[Component Layer]
        SERV[Service Layer]
        STATE[NgRx State Management]
        VIZ[Cytoscape.js Visualization]
    end
    
    subgraph "Julia Backend"
        API[API Endpoints]
        CORE[IPA Framework Core]
        ALG[Analysis Algorithms]
    end
    
    subgraph "Data Flow"
        FILES[File Uploads]
        PARAMS[Parameter Overrides]
        RESULTS[Analysis Results]
    end
    
    UI --> COMP
    COMP --> SERV
    SERV --> STATE
    STATE --> VIZ
    SERV --> API
    API --> CORE
    CORE --> ALG
    FILES --> SERV
    PARAMS --> STATE
    RESULTS --> VIZ
```

### Technology Stack
- **Frontend**: Angular 20, NgRx 18, RxJS 7.8, TypeScript 5.8
- **Visualization**: Cytoscape.js 3.x
- **Build System**: Nx 21.2.2
- **Styling**: SCSS, Angular Material
- **Backend Integration**: Julia IPA Framework v2.0
- **Storage**: IndexedDB, LocalStorage

---

## 📁 Complete Project Structure

```
website/workspace/
├── apps/
│   └── network-flow-ui/                    # Main Angular Application
│       ├── src/
│       │   ├── app/
│       │   │   ├── core/                   # Core Services & Guards
│       │   │   │   ├── services/
│       │   │   │   │   ├── api.service.ts
│       │   │   │   │   ├── file-handler.service.ts
│       │   │   │   │   ├── session-manager.service.ts
│       │   │   │   │   └── notification.service.ts
│       │   │   │   ├── guards/
│       │   │   │   │   ├── network-loaded.guard.ts
│       │   │   │   │   └── analysis-ready.guard.ts
│       │   │   │   └── interceptors/
│       │   │   │       ├── api.interceptor.ts
│       │   │   │       └── error.interceptor.ts
│       │   │   ├── shared/                 # Shared Components & Utilities
│       │   │   │   ├── components/
│       │   │   │   │   ├── file-upload/
│       │   │   │   │   ├── parameter-editor/
│       │   │   │   │   ├── loading-spinner/
│       │   │   │   │   └── confirmation-dialog/
│       │   │   │   ├── pipes/
│       │   │   │   │   ├── format-probability.pipe.ts
│       │   │   │   │   └── format-node-id.pipe.ts
│       │   │   │   └── models/
│       │   │   │       ├── network.models.ts
│       │   │   │       ├── analysis.models.ts
│       │   │   │       └── api.models.ts
│       │   │   ├── features/               # Feature Modules
│       │   │   │   ├── network-setup/
│       │   │   │   │   ├── components/
│       │   │   │   │   │   ├── network-upload/
│       │   │   │   │   │   ├── test-networks/
│       │   │   │   │   │   └── network-preview/
│       │   │   │   │   ├── services/
│       │   │   │   │   │   └── network-setup.service.ts
│       │   │   │   │   └── network-setup.module.ts
│       │   │   │   ├── visualization/
│       │   │   │   │   ├── components/
│       │   │   │   │   │   ├── cytoscape-viewer/
│       │   │   │   │   │   ├── network-controls/
│       │   │   │   │   │   ├── layout-selector/
│       │   │   │   │   │   └── zoom-controls/
│       │   │   │   │   ├── services/
│       │   │   │   │   │   ├── cytoscape.service.ts
│       │   │   │   │   │   └── layout.service.ts
│       │   │   │   │   └── visualization.module.ts
│       │   │   │   ├── analysis/
│       │   │   │   │   ├── components/
│       │   │   │   │   │   ├── analysis-panel/
│       │   │   │   │   │   ├── parameter-panel/
│       │   │   │   │   │   ├── results-viewer/
│       │   │   │   │   │   └── diamond-explorer/
│       │   │   │   │   ├── services/
│       │   │   │   │   │   ├── analysis.service.ts
│       │   │   │   │   │   └── diamond.service.ts
│       │   │   │   │   └── analysis.module.ts
│       │   │   │   ├── tabs/
│       │   │   │   │   ├── components/
│       │   │   │   │   │   ├── tab-manager/
│       │   │   │   │   │   ├── tab-header/
│       │   │   │   │   │   └── tab-content/
│       │   │   │   │   ├── services/
│       │   │   │   │   │   └── tab-manager.service.ts
│       │   │   │   │   └── tabs.module.ts
│       │   │   │   └── session/
│       │   │   │       ├── components/
│       │   │   │       │   ├── session-manager/
│       │   │   │       │   ├── export-dialog/
│       │   │   │       │   └── import-dialog/
│       │   │   │       ├── services/
│       │   │   │       │   └── session.service.ts
│       │   │   │       └── session.module.ts
│       │   │   ├── store/                  # NgRx State Management
│       │   │   │   ├── network/
│       │   │   │   │   ├── network.actions.ts
│       │   │   │   │   ├── network.reducer.ts
│       │   │   │   │   ├── network.effects.ts
│       │   │   │   │   ├── network.selectors.ts
│       │   │   │   │   └── network.models.ts
│       │   │   │   ├── analysis/
│       │   │   │   │   ├── analysis.actions.ts
│       │   │   │   │   ├── analysis.reducer.ts
│       │   │   │   │   ├── analysis.effects.ts
│       │   │   │   │   ├── analysis.selectors.ts
│       │   │   │   │   └── analysis.models.ts
│       │   │   │   ├── tabs/
│       │   │   │   │   ├── tabs.actions.ts
│       │   │   │   │   ├── tabs.reducer.ts
│       │   │   │   │   ├── tabs.effects.ts
│       │   │   │   │   ├── tabs.selectors.ts
│       │   │   │   │   └── tabs.models.ts
│       │   │   │   ├── ui/
│       │   │   │   │   ├── ui.actions.ts
│       │   │   │   │   ├── ui.reducer.ts
│       │   │   │   │   ├── ui.selectors.ts
│       │   │   │   │   └── ui.models.ts
│       │   │   │   ├── app.state.ts
│       │   │   │   └── index.ts
│       │   │   ├── layouts/                # Application Layouts
│       │   │   │   ├── main-layout/
│       │   │   │   └── analysis-layout/
│       │   │   ├── app.component.ts
│       │   │   ├── app.config.ts
│       │   │   ├── app.routes.ts
│       │   │   └── app.module.ts
│       │   ├── assets/
│       │   │   ├── test-networks/          # Sample Network Files
│       │   │   ├── icons/
│       │   │   └── styles/
│       │   ├── environments/
│       │   │   ├── environment.ts
│       │   │   └── environment.prod.ts
│       │   └── main.ts
│       ├── project.json
│       └── tsconfig.json
├── libs/                                   # Shared Libraries
│   ├── network-analysis-core/              # Core Analysis Logic
│   ├── cytoscape-extensions/               # Custom Cytoscape Extensions
│   └── api-client/                         # Julia API Client
├── package.json
├── nx.json
└── tsconfig.base.json
```

---

## 🗄️ State Management (NgRx) Details

### State Architecture

```mermaid
graph TB
    subgraph "NgRx Store"
        NS[Network State]
        AS[Analysis State]
        TS[Tabs State]
        US[UI State]
    end
    
    subgraph "Network State"
        ND[Network Data]
        NP[Node Probabilities]
        EP[Edge Probabilities]
        DS[Diamond Structures]
    end
    
    subgraph "Analysis State"
        AR[Analysis Results]
        AP[Analysis Parameters]
        AH[Analysis History]
        AC[Analysis Cache]
    end
    
    subgraph "Tabs State"
        TL[Tab List]
        AT[Active Tab]
        TH[Tab Hierarchy]
        TC[Tab Context]
    end
    
    NS --> ND
    NS --> NP
    NS --> EP
    NS --> DS
    AS --> AR
    AS --> AP
    AS --> AH
    AS --> AC
    TS --> TL
    TS --> AT
    TS --> TH
    TS --> TC
```

### Network State Interface

```typescript
interface NetworkState {
  // Core Network Data
  adjacencyMatrix: number[][];
  edgeList: Edge[];
  nodeList: Node[];
  
  // Network Structure
  sourceNodes: number[];
  forkNodes: number[];
  joinNodes: number[];
  outgoingIndex: Record<number, number[]>;
  incomingIndex: Record<number, number[]>;
  
  // Probabilities
  nodeProbabilities: Record<number, number>;
  edgeProbabilities: Record<string, number>;
  originalNodeProbabilities: Record<number, number>;
  originalEdgeProbabilities: Record<string, number>;
  
  // Diamond Structures
  diamondStructures: DiamondStructure[];
  diamondClassifications: DiamondClassification[];
  
  // File Management
  uploadedFiles: {
    dag?: File;
    nodeProbabilities?: File;
    edgeProbabilities?: File;
  };
  
  // State Flags
  isLoaded: boolean;
  isProcessing: boolean;
  error: string | null;
}
```

### Analysis State Interface

```typescript
interface AnalysisState {
  // Current Analysis
  currentAnalysis: {
    type: AnalysisType;
    parameters: AnalysisParameters;
    results: AnalysisResults | null;
    status: 'idle' | 'running' | 'completed' | 'error';
  };
  
  // Analysis History
  analysisHistory: AnalysisHistoryItem[];
  
  // Parameter Overrides
  parameterOverrides: {
    global: {
      nodePrior?: number;
      edgeProb?: number;
      overrideNodePrior: boolean;
      overrideEdgeProb: boolean;
    };
    individual: {
      nodeOverrides: Record<number, number>;
      edgeOverrides: Record<string, number>;
    };
  };
  
  // Cache
  resultsCache: Record<string, AnalysisResults>;
  
  // UI State
  selectedNodes: number[];
  selectedEdges: string[];
  highlightedPaths: Path[];
}
```

### Tabs State Interface

```typescript
interface TabsState {
  tabs: Tab[];
  activeTabId: string;
  tabHierarchy: TabHierarchy;
  maxTabs: number;
}

interface Tab {
  id: string;
  title: string;
  type: 'global' | 'subgraph' | 'local';
  parentTabId?: string;
  level: number;
  
  // Tab-specific network context
  networkContext: {
    subgraph?: SubgraphData;
    diamondId?: string;
    analysisMode: AnalysisMode;
  };
  
  // Tab state
  isActive: boolean;
  isDirty: boolean;
  canClose: boolean;
  
  // Navigation
  breadcrumb: BreadcrumbItem[];
  
  // Timestamps
  createdAt: Date;
  lastAccessedAt: Date;
}
```

---

## 🧩 Component Hierarchy

### Main Application Structure

```mermaid
graph TB
    APP[AppComponent]
    
    subgraph "Layout Components"
        ML[MainLayoutComponent]
        AL[AnalysisLayoutComponent]
    end
    
    subgraph "Feature Components"
        NS[NetworkSetupComponent]
        VIZ[VisualizationComponent]
        AN[AnalysisComponent]
        TM[TabManagerComponent]
    end
    
    subgraph "Shared Components"
        FU[FileUploadComponent]
        PE[ParameterEditorComponent]
        RV[ResultsViewerComponent]
        LS[LoadingSpinnerComponent]
    end
    
    APP --> ML
    APP --> AL
    ML --> NS
    ML --> VIZ
    AL --> AN
    AL --> TM
    NS --> FU
    AN --> PE
    AN --> RV
    VIZ --> LS
```

### Component Responsibilities

#### Core Layout Components

**AppComponent**
- Root application component
- Route management and navigation
- Global error handling
- Theme management

**MainLayoutComponent**
- Primary application layout
- Header, sidebar, and main content areas
- Responsive design handling
- Global navigation

**AnalysisLayoutComponent**
- Analysis-focused layout
- Tab management integration
- Split-pane views for visualization and analysis
- Context-sensitive toolbars

#### Feature Components

**NetworkSetupComponent**
```typescript
@Component({
  selector: 'app-network-setup',
  templateUrl: './network-setup.component.html',
  styleUrls: ['./network-setup.component.scss']
})
export class NetworkSetupComponent implements OnInit {
  @Input() allowedFileTypes: string[] = ['.csv', '.txt'];
  @Output() networkLoaded = new EventEmitter<NetworkData>();
  @Output() fileUploaded = new EventEmitter<File>();
  
  // Component logic for network initialization
  uploadNetwork(file: File): void;
  selectTestNetwork(networkId: string): void;
  validateNetworkStructure(data: any): boolean;
}
```

**VisualizationComponent**
```typescript
@Component({
  selector: 'app-visualization',
  templateUrl: './visualization.component.html',
  styleUrls: ['./visualization.component.scss']
})
export class VisualizationComponent implements OnInit, OnDestroy {
  @Input() networkData: NetworkData;
  @Input() analysisResults: AnalysisResults;
  @Output() nodeSelected = new EventEmitter<number>();
  @Output() diamondClicked = new EventEmitter<DiamondStructure>();
  
  private cytoscape: cytoscape.Core;
  
  // Cytoscape integration and interaction handling
  initializeCytoscape(): void;
  updateVisualization(data: NetworkData): void;
  highlightPath(path: Path): void;
  enableDiamondDrillDown(): void;
}
```

**AnalysisComponent**
```typescript
@Component({
  selector: 'app-analysis',
  templateUrl: './analysis.component.html',
  styleUrls: ['./analysis.component.scss']
})
export class AnalysisComponent implements OnInit {
  @Input() analysisType: AnalysisType;
  @Input() networkContext: NetworkContext;
  @Output() analysisStarted = new EventEmitter<AnalysisParameters>();
  @Output() parametersChanged = new EventEmitter<ParameterOverrides>();
  
  // Analysis execution and parameter management
  runAnalysis(type: AnalysisType, params: AnalysisParameters): void;
  updateParameters(overrides: ParameterOverrides): void;
  exportResults(format: 'json' | 'csv' | 'pdf'): void;
}
```

---

## 🔧 Service Architecture

### Core Services

#### ApiService
```typescript
@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly baseUrl = environment.apiUrl;
  
  // Network Processing
  processInput(csvContent: string): Observable<ProcessInputResponse>;
  
  // Diamond Analysis
  processDiamonds(csvContent: string): Observable<DiamondProcessingResponse>;
  classifyDiamonds(csvContent: string): Observable<DiamondClassificationResponse>;
  
  // Analysis Endpoints
  runReachabilityAnalysis(request: ReachabilityRequest): Observable<ReachabilityResponse>;
  enumeratePaths(request: PathEnumRequest): Observable<PathEnumResponse>;
  runMonteCarloAnalysis(request: MonteCarloRequest): Observable<MonteCarloResponse>;
  
  // Error handling and retry logic
  private handleError<T>(operation = 'operation', result?: T);
  private retryWithBackoff<T>(source: Observable<T>, maxRetries = 3);
}
```

#### FileHandlerService
```typescript
@Injectable({
  providedIn: 'root'
})
export class FileHandlerService {
  // File Upload and Validation
  validateFile(file: File, allowedTypes: string[]): ValidationResult;
  parseCSVFile(file: File): Observable<string[][]>;
  parseProbabilityFile(file: File): Observable<Record<string, number>>;
  
  // File Management
  saveFileToIndexedDB(file: File, key: string): Promise<void>;
  loadFileFromIndexedDB(key: string): Promise<File | null>;
  clearStoredFiles(): Promise<void>;
  
  // Export Functionality
  exportToCSV(data: any[], filename: string): void;
  exportToJSON(data: any, filename: string): void;
  exportToPDF(content: string, filename: string): void;
}
```

#### SessionManagerService
```typescript
@Injectable({
  providedIn: 'root'
})
export class SessionManagerService {
  // Session Persistence
  saveSession(session: AnalysisSession): Promise<void>;
  loadSession(sessionId: string): Promise<AnalysisSession | null>;
  listSessions(): Promise<SessionSummary[]>;
  deleteSession(sessionId: string): Promise<void>;
  
  // Auto-save functionality
  enableAutoSave(intervalMs: number = 30000): void;
  disableAutoSave(): void;
  
  // Session export/import
  exportSession(sessionId: string): Promise<Blob>;
  importSession(file: File): Promise<AnalysisSession>;
}
```

---

## 🔄 Multi-Level Analysis System

### Analysis Modes

```mermaid
graph TB
    subgraph "Analysis Modes"
        GM[Global Mode]
        SM[Subgraph Mode]
        LM[Local Mode]
        NM[Nested Mode]
    end
    
    subgraph "Global Mode"
        GD[Global DAG]
        GA[Global Analysis]
        GS[Global State]
    end
    
    subgraph "Subgraph Mode"
        SD[Diamond Subgraph]
        SA[Subgraph Analysis]
        SS[Affects Global State]
    end
    
    subgraph "Local Mode"
        LD[Diamond Subgraph]
        LA[Local Analysis]
        LS[Temporary State]
    end
    
    GM --> GD
    GM --> GA
    GM --> GS
    SM --> SD
    SM --> SA
    SM --> SS
    LM --> LD
    LM --> LA
    LM --> LS
```

### Mode Implementation

#### Global Mode
- **Purpose**: Analysis on the complete DAG structure
- **State Impact**: All changes affect the global network state
- **Use Cases**: Initial network analysis, comprehensive reachability studies
- **Navigation**: Root level, no parent context

#### Subgraph Mode
- **Purpose**: Drill-down analysis on diamond structures as independent DAGs
- **State Impact**: Changes propagate back to global state
- **Use Cases**: Detailed diamond analysis, structural modifications
- **Navigation**: Child tabs with parent context

#### Local Mode
- **Purpose**: Temporary analysis without affecting global state
- **State Impact**: Isolated analysis context
- **Use Cases**: What-if scenarios, parameter experimentation
- **Navigation**: Temporary tabs with revert capability

#### Nested Diamond Mode
- **Purpose**: Unlimited drill-down into diamonds within diamonds
- **State Impact**: Hierarchical state management
- **Use Cases**: Complex network exploration, multi-level optimization
- **Navigation**: Deep hierarchical tab structure

### Analysis Mode Service

```typescript
@Injectable({
  providedIn: 'root'
})
export class AnalysisModeService {
  // Mode Management
  switchMode(mode: AnalysisMode, context: AnalysisContext): void;
  getCurrentMode(): AnalysisMode;
  canSwitchMode(targetMode: AnalysisMode): boolean;
  
  // Context Management
  createAnalysisContext(mode: AnalysisMode, data: any): AnalysisContext;
  updateContext(context: AnalysisContext): void;
  revertToParentContext(): void;
  
  // State Propagation
  propagateChangesToGlobal(changes: StateChanges): void;
  isolateLocalChanges(changes: StateChanges): void;
  mergeContexts(parent: AnalysisContext, child: AnalysisContext): AnalysisContext;
}
```

---

## 📑 Tab Management System

### Tab Architecture

```mermaid
graph TB
    subgraph "Tab Hierarchy"
        RT[Root Tab - Global]
        ST1[Subgraph Tab 1]
        ST2[Subgraph Tab 2]
        LT1[Local Tab 1]
        NT1[Nested Tab 1]
        NT2[Nested Tab 2]
    end
    
    RT --> ST1
    RT --> ST2
    ST1 --> LT1
    ST1 --> NT1
    NT1 --> NT2
    
    subgraph "Tab Context"
        TC[Tab Context]
        NC[Network Context]
        AC[Analysis Context]
        UC[UI Context]
    end
    
    ST1 --> TC
    TC --> NC
    TC --> AC
    TC --> UC
```

### Tab Manager Implementation

```typescript
@Injectable({
  providedIn: 'root'
})
export class TabManagerService {
  private tabs$ = new BehaviorSubject<Tab[]>([]);
  private activeTabId$ = new BehaviorSubject<string>('');
  
  // Tab Creation
  createGlobalTab(): Tab;
  createSubgraphTab(parentId: string, diamond: DiamondStructure): Tab;
  createLocalTab(parentId: string, context: AnalysisContext): Tab;
  
  // Tab Navigation
  activateTab(tabId: string): void;
  closeTab(tabId: string): void;
  closeTabsToRight(tabId: string): void;
  closeAllTabs(): void;
  
  // Tab Hierarchy
  getTabHierarchy(): TabHierarchy;
  getParentTab(tabId: string): Tab | null;
  getChildTabs(tabId: string): Tab[];
  getBreadcrumb(tabId: string): BreadcrumbItem[];
  
  // Tab State Management
  saveTabState(tabId: string, state: TabState): void;
  restoreTabState(tabId: string): TabState | null;
  markTabDirty(tabId: string): void;
  canCloseTab(tabId: string): boolean;
}
```

### Tab Component

```typescript
@Component({
  selector: 'app-tab-manager',
  templateUrl: './tab-manager.component.html',
  styleUrls: ['./tab-manager.component.scss']
})
export class TabManagerComponent implements OnInit, OnDestroy {
  tabs$ = this.tabManager.tabs$;
  activeTabId$ = this.tabManager.activeTabId$;
  
  // Tab Actions
  onTabClick(tabId: string): void;
  onTabClose(tabId: string): void;
  onTabContextMenu(event: MouseEvent, tabId: string): void;
  
  // Drag and Drop
  onTabDragStart(event: DragEvent, tabId: string): void;
  onTabDrop(event: DragEvent, targetTabId: string): void;
  
  // Keyboard Navigation
  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void;
}
```

---

## 📁 File Handling Strategy

### File Types and Processing

```mermaid
graph TB
    subgraph "File Types"
        DAG[DAG Files - CSV/TXT]
        NP[Node Probabilities - CSV/JSON]
        EP[Edge Probabilities - CSV/JSON]
        SESSION[Session Files - JSON]
    end
    
    subgraph "Processing Pipeline"
        UPLOAD[File Upload]
        VALIDATE[Validation]
        PARSE[Parsing]
        STORE[Storage]
        PROCESS[Processing]
    end
    
    DAG --> UPLOAD
    NP --> UPLOAD
    EP --> UPLOAD
    SESSION --> UPLOAD
    UPLOAD --> VALIDATE
    VALIDATE --> PARSE
    PARSE --> STORE
    STORE --> PROCESS
```

### File Handler Implementation

```typescript
@Injectable({
  providedIn: 'root'
})
export class FileHandlerService {
  // File Upload with Drag & Drop
  setupDragAndDrop(element: HTMLElement): Observable<FileList>;
  handleFileSelect(files: FileList): void;
  
  // File Validation
  validateDAGFile(file: File): ValidationResult;
  validateProbabilityFile(file: File): ValidationResult;
  validateSessionFile(file: File): ValidationResult;
  
  // File Parsing
  parseDAGFile(file: File): Observable<AdjacencyMatrix>;
  parseNodeProbabilities(file: File): Observable<Record<number, number>>;
  parseEdgeProbabilities(file: File): Observable<Record<string, number>>;
  
  // File Storage (IndexedDB)
  storeFile(file: File, category: FileCategory): Promise<string>;
  retrieveFile(fileId: string): Promise<File>;
  listStoredFiles(category?: FileCategory): Promise<StoredFile[]>;
  deleteStoredFile(fileId: string): Promise<void>;
  
  // Export Functionality
  exportNetworkData(data: NetworkData, format: ExportFormat): void;
  exportAnalysisResults(results: AnalysisResults, format: ExportFormat): void;
  exportSession(session: AnalysisSession): void;
}
```

### File Upload Component

```typescript
@Component({
  selector: 'app-file-upload',
  templateUrl: './file-upload.component.html',
  styleUrls: ['./file-upload.component.scss']
})
export class FileUploadComponent implements OnInit {
  @Input() acceptedTypes: string[] = [];
  @Input() maxFileSize: number = 10 * 1024 * 1024; // 10MB
  @Input() multiple: boolean = false;
  @Output() filesSelected = new EventEmitter<File[]>();
  @Output() uploadProgress = new EventEmitter<number>();
  
  isDragOver = false;
  uploadProgress$ = new BehaviorSubject<number>(0);
  
  // Drag and Drop Handlers
  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent): void;
  
  @HostListener('dragleave', ['$event'])
  onDragLeave(event: DragEvent): void;
  
  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void;
  
  // File Selection
  onFileSelect(event: Event): void;
  validateFiles(files: FileList): File[];
  processFiles(files: File[]): void;
}
```

---

## 🔌 Julia API Integration

### API Client Architecture

```mermaid
graph TB
    subgraph "Angular Services"
        API[ApiService]
        HTTP[HttpClient]
        INT[Interceptors]
    end
    
    subgraph "Julia API Endpoints"
        PI[/api/processinput]
        DP[/api/diamondprocessing]
        DC[/api/diamondclassification]
        RM[/api/reachabilitymodule]
        PE[/api/pathenum]
        MC[/api/montecarlo]
    end
    
    API --> HTTP
    HTTP --> INT
    INT --> PI
    INT --> DP
    INT --> DC
    INT --> RM
    INT --> PE
    INT --> MC
```

### API Service Implementation

```typescript
@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly baseUrl = environment.apiUrl;
  
  constructor(private http: HttpClient) {}
  
  // Process Input Endpoint
  processInput(request: ProcessInputRequest): Observable<ProcessInputResponse> {
    return this.http.post<ProcessInputResponse>(`${this.baseUrl}/api/processinput`, request)
      .pipe(
        retry(3),
        catchError(this.handleError<ProcessInputResponse>('processInput'))
      );
  }
  
  // Diamond Processing
  processDiamonds(request: DiamondProcessingRequest): Observable<DiamondProcessingResponse> {
    return this.http.post<DiamondProcessingResponse>(`${this.baseUrl}/api/diamondprocessing`, request)
      .pipe(
        retry(3),
        catchError(this.handleError<DiamondProcessingResponse>('processDiamonds'))
      );
  }
  
  // Diamond Classification
  classifyDiamonds(request: DiamondClassificationRequest): Observable<Diamon
dClassificationResponse> {
    return this.http.post<DiamondClassificationResponse>(`${this.baseUrl}/api/diamondclassification`, request)
      .pipe(
        retry(3),
        catchError(this.handleError<DiamondClassificationResponse>('classifyDiamonds'))
      );
  }
  
  // Reachability Analysis
  runReachabilityAnalysis(request: ReachabilityRequest): Observable<ReachabilityResponse> {
    return this.http.post<ReachabilityResponse>(`${this.baseUrl}/api/reachabilitymodule`, request)
      .pipe(
        timeout(30000), // 30 second timeout
        retry(2),
        catchError(this.handleError<ReachabilityResponse>('runReachabilityAnalysis'))
      );
  }
  
  // Path Enumeration
  enumeratePaths(request: PathEnumRequest): Observable<PathEnumResponse> {
    return this.http.post<PathEnumResponse>(`${this.baseUrl}/api/pathenum`, request)
      .pipe(
        timeout(60000), // 60 second timeout for path enumeration
        retry(2),
        catchError(this.handleError<PathEnumResponse>('enumeratePaths'))
      );
  }
  
  // Monte Carlo Analysis
  runMonteCarloAnalysis(request: MonteCarloRequest): Observable<MonteCarloResponse> {
    return this.http.post<MonteCarloResponse>(`${this.baseUrl}/api/montecarlo`, request)
      .pipe(
        timeout(120000), // 2 minute timeout for Monte Carlo
        retry(1),
        catchError(this.handleError<MonteCarloResponse>('runMonteCarloAnalysis'))
      );
  }
  
  // Error handling
  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(`${operation} failed:`, error);
      return of(result as T);
    };
  }
}
```

### API Request/Response Models

```typescript
// Process Input
export interface ProcessInputRequest {
  csvContent: string;
}

export interface ProcessInputResponse {
  edgelist: number[][];
  outgoingIndex: Record<number, number[]>;
  incomingIndex: Record<number, number[]>;
  sourceNodes: number[];
  nodePriors: Record<number, number>;
  edgeProbabilities: Record<string, number>;
  forkNodes: number[];
  joinNodes: number[];
  iterationSets: number[][];
  ancestors: Record<number, number[]>;
  descendants: Record<number, number[]>;
}

// Diamond Processing
export interface DiamondProcessingRequest {
  csvContent: string;
}

export interface DiamondProcessingResponse {
  diamondStructures: DiamondStructure[];
  diamondStatistics: {
    totalDiamonds: number;
    averageSize: number;
    maxDepth: number;
  };
}

// Reachability Analysis
export interface ReachabilityRequest {
  csvContent: string;
  nodePrior?: number;
  edgeProb?: number;
  overrideNodePrior?: boolean;
  overrideEdgeProb?: boolean;
  useIndividualOverrides?: boolean;
  individualNodePriors?: Record<string, number>;
  individualEdgeProbabilities?: Record<string, number>;
}

export interface ReachabilityResponse {
  results: Record<number, number>;
  parameterModifications: {
    appliedNodeOverrides: Record<number, number>;
    appliedEdgeOverrides: Record<string, number>;
  };
  resultStatistics: {
    averageProbability: number;
    maxProbability: number;
    minProbability: number;
  };
}
```

---

## 🎨 Visualization System (Cytoscape.js)

### Cytoscape Integration Architecture

```mermaid
graph TB
    subgraph "Cytoscape Service"
        CS[CytoscapeService]
        LS[LayoutService]
        IS[InteractionService]
    end
    
    subgraph "Visualization Features"
        NR[Node Rendering]
        ER[Edge Rendering]
        DR[Diamond Highlighting]
        PR[Path Rendering]
    end
    
    subgraph "User Interactions"
        NC[Node Click]
        DC[Diamond Click]
        ZC[Zoom Controls]
        LC[Layout Controls]
    end
    
    CS --> NR
    CS --> ER
    CS --> DR
    CS --> PR
    IS --> NC
    IS --> DC
    IS --> ZC
    IS --> LC
```

### Cytoscape Service Implementation

```typescript
@Injectable({
  providedIn: 'root'
})
export class CytoscapeService {
  private cy: cytoscape.Core | null = null;
  
  // Initialization
  initializeCytoscape(container: HTMLElement, options?: cytoscape.CytoscapeOptions): cytoscape.Core {
    this.cy = cytoscape({
      container,
      style: this.getDefaultStyles(),
      layout: { name: 'dagre', rankDir: 'TB' },
      ...options
    });
    
    this.setupEventHandlers();
    return this.cy;
  }
  
  // Data Management
  loadNetworkData(networkData: NetworkData): void {
    if (!this.cy) return;
    
    const elements = this.convertToElements(networkData);
    this.cy.elements().remove();
    this.cy.add(elements);
    this.cy.layout({ name: 'dagre', rankDir: 'TB' }).run();
  }
  
  // Diamond Highlighting
  highlightDiamonds(diamonds: DiamondStructure[]): void {
    if (!this.cy) return;
    
    diamonds.forEach(diamond => {
      const diamondNodes = this.cy!.nodes().filter(node => 
        diamond.nodes.includes(node.id())
      );
      diamondNodes.addClass('diamond-node');
      
      // Add diamond boundary
      this.addDiamondBoundary(diamond);
    });
  }
  
  // Path Visualization
  highlightPath(path: Path): void {
    if (!this.cy) return;
    
    // Clear previous highlights
    this.cy.elements().removeClass('path-highlight');
    
    // Highlight path nodes and edges
    path.nodes.forEach(nodeId => {
      this.cy!.getElementById(nodeId).addClass('path-highlight');
    });
    
    path.edges.forEach(edgeId => {
      this.cy!.getElementById(edgeId).addClass('path-highlight');
    });
  }
  
  // Layout Management
  applyLayout(layoutName: string, options?: any): void {
    if (!this.cy) return;
    
    const layoutOptions = {
      name: layoutName,
      ...this.getLayoutDefaults(layoutName),
      ...options
    };
    
    this.cy.layout(layoutOptions).run();
  }
  
  // Event Handling
  private setupEventHandlers(): void {
    if (!this.cy) return;
    
    // Node click events
    this.cy.on('tap', 'node', (event) => {
      const node = event.target;
      this.onNodeClick(node);
    });
    
    // Diamond click events
    this.cy.on('tap', '.diamond-node', (event) => {
      const node = event.target;
      this.onDiamondClick(node);
    });
  }
  
  // Styling
  private getDefaultStyles(): cytoscape.Stylesheet[] {
    return [
      {
        selector: 'node',
        style: {
          'background-color': '#3498db',
          'label': 'data(id)',
          'text-valign': 'center',
          'text-halign': 'center',
          'color': '#2c3e50',
          'font-size': '12px',
          'width': '30px',
          'height': '30px'
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 2,
          'line-color': '#95a5a6',
          'target-arrow-color': '#95a5a6',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier'
        }
      },
      {
        selector: '.diamond-node',
        style: {
          'background-color': '#e74c3c',
          'border-width': 3,
          'border-color': '#c0392b'
        }
      },
      {
        selector: '.path-highlight',
        style: {
          'background-color': '#f39c12',
          'line-color': '#f39c12',
          'target-arrow-color': '#f39c12',
          'width': 4
        }
      }
    ];
  }
}
```

### Layout Service

```typescript
@Injectable({
  providedIn: 'root'
})
export class LayoutService {
  private availableLayouts = [
    { name: 'dagre', label: 'Hierarchical (Dagre)' },
    { name: 'breadthfirst', label: 'Breadth First' },
    { name: 'circle', label: 'Circle' },
    { name: 'grid', label: 'Grid' },
    { name: 'random', label: 'Random' },
    { name: 'cose', label: 'Force Directed (CoSE)' }
  ];
  
  getAvailableLayouts() {
    return this.availableLayouts;
  }
  
  getLayoutDefaults(layoutName: string): any {
    const defaults: Record<string, any> = {
      dagre: {
        rankDir: 'TB',
        nodeSep: 50,
        rankSep: 100,
        edgeSep: 10
      },
      breadthfirst: {
        directed: true,
        spacingFactor: 1.5
      },
      circle: {
        radius: 200,
        spacingFactor: 1.2
      },
      cose: {
        nodeRepulsion: 400000,
        nodeOverlap: 10,
        idealEdgeLength: 100,
        edgeElasticity: 100
      }
    };
    
    return defaults[layoutName] || {};
  }
}
```

---

## 📊 Data Flow Diagrams

### User Workflow Data Flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as UI Components
    participant S as Services
    participant Store as NgRx Store
    participant API as Julia API
    
    U->>UI: Upload DAG File
    UI->>S: FileHandlerService.parseDAGFile()
    S->>Store: NetworkActions.loadNetwork()
    Store->>API: ApiService.processInput()
    API-->>Store: ProcessInputResponse
    Store->>UI: Network State Updated
    UI->>U: Network Visualization
    
    U->>UI: Click Diamond
    UI->>Store: TabActions.createSubgraphTab()
    Store->>S: AnalysisModeService.switchMode()
    S->>Store: AnalysisActions.setContext()
    Store->>UI: New Tab Created
    UI->>U: Diamond Subgraph View
    
    U->>UI: Run Analysis
    UI->>Store: AnalysisActions.startAnalysis()
    Store->>API: ApiService.runReachabilityAnalysis()
    API-->>Store: ReachabilityResponse
    Store->>UI: Analysis Results
    UI->>U: Results Visualization
```

### State Management Data Flow

```mermaid
graph TB
    subgraph "User Actions"
        UA[User Actions]
        FC[File Changes]
        PC[Parameter Changes]
        AC[Analysis Commands]
    end
    
    subgraph "NgRx Flow"
        ACT[Actions]
        EFF[Effects]
        RED[Reducers]
        SEL[Selectors]
    end
    
    subgraph "External Services"
        API[API Service]
        FS[File Service]
        SS[Session Service]
    end
    
    subgraph "UI Updates"
        COMP[Components]
        VIZ[Visualization]
        TABS[Tab Manager]
    end
    
    UA --> ACT
    FC --> ACT
    PC --> ACT
    AC --> ACT
    
    ACT --> EFF
    EFF --> API
    EFF --> FS
    EFF --> SS
    
    API --> EFF
    FS --> EFF
    SS --> EFF
    
    EFF --> RED
    RED --> SEL
    SEL --> COMP
    SEL --> VIZ
    SEL --> TABS
```

### Multi-Level Analysis Flow

```mermaid
graph TB
    subgraph "Global Level"
        GL[Global DAG]
        GA[Global Analysis]
        GS[Global State]
    end
    
    subgraph "Diamond Level 1"
        D1[Diamond 1]
        D1A[Diamond 1 Analysis]
        D1S[Diamond 1 State]
    end
    
    subgraph "Diamond Level 2"
        D2[Nested Diamond]
        D2A[Nested Analysis]
        D2S[Nested State]
    end
    
    subgraph "State Propagation"
        SP[State Propagation]
        SC[State Consolidation]
        SR[State Revert]
    end
    
    GL --> D1
    D1 --> D2
    
    GA --> D1A
    D1A --> D2A
    
    GS --> D1S
    D1S --> D2S
    
    D2S --> SP
    D1S --> SP
    SP --> SC
    SC --> GS
    
    SR --> D1S
    SR --> GS
```

---

## 🔧 Technical Specifications

### Performance Requirements

| Metric | Target | Measurement |
|--------|--------|-------------|
| Initial Load Time | < 3 seconds | Time to interactive |
| File Upload Processing | < 5 seconds | For files up to 10MB |
| Network Visualization | < 2 seconds | For networks up to 1000 nodes |
| Analysis Execution | < 30 seconds | Reachability analysis |
| Tab Switching | < 500ms | Between analysis contexts |
| State Persistence | < 1 second | Save/load operations |

### Browser Compatibility

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Chrome | 90+ | Full feature support |
| Firefox | 88+ | Full feature support |
| Safari | 14+ | Limited IndexedDB support |
| Edge | 90+ | Full feature support |

### Memory Management

```typescript
// Memory optimization strategies
export class MemoryManager {
  private static readonly MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB
  private static readonly MAX_TABS = 10;
  private static readonly CLEANUP_INTERVAL = 300000; // 5 minutes
  
  // Automatic cleanup of unused resources
  static setupMemoryManagement(): void {
    setInterval(() => {
      this.cleanupUnusedTabs();
      this.cleanupAnalysisCache();
      this.cleanupVisualizationData();
    }, this.CLEANUP_INTERVAL);
  }
  
  // Tab memory management
  private static cleanupUnusedTabs(): void {
    // Close tabs that haven't been accessed in 30 minutes
    // Keep only essential tabs open
  }
  
  // Analysis cache management
  private static cleanupAnalysisCache(): void {
    // Remove cached results older than 1 hour
    // Implement LRU eviction policy
  }
  
  // Visualization memory management
  private static cleanupVisualizationData(): void {
    // Dispose of unused Cytoscape instances
    // Clear unused layout calculations
  }
}
```

### Security Considerations

```typescript
// Input validation and sanitization
export class SecurityService {
  // File upload validation
  static validateFileUpload(file: File): ValidationResult {
    // Check file type whitelist
    // Validate file size limits
    // Scan for malicious content
    // Validate CSV structure
    return { isValid: true, errors: [] };
  }
  
  // API request sanitization
  static sanitizeApiRequest(request: any): any {
    // Remove potentially dangerous properties
    // Validate parameter ranges
    // Escape special characters
    return request;
  }
  
  // Session data encryption
  static encryptSessionData(data: any): string {
    // Encrypt sensitive session data
    // Use browser's SubtleCrypto API
    return btoa(JSON.stringify(data));
  }
}
```

---

## 📋 Development Guidelines

### Code Organization Standards

```typescript
// File naming conventions
// Components: kebab-case.component.ts
// Services: kebab-case.service.ts
// Models: kebab-case.models.ts
// Interfaces: PascalCase interface names

// Component structure template
@Component({
  selector: 'app-feature-name',
  templateUrl: './feature-name.component.html',
  styleUrls: ['./feature-name.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FeatureNameComponent implements OnInit, OnDestroy {
  // Public properties first
  @Input() inputProperty: Type;
  @Output() outputEvent = new EventEmitter<Type>();
  
  // Private properties
  private destroy$ = new Subject<void>();
  
  // Constructor with dependency injection
  constructor(
    private service: SomeService,
    private store: Store<AppState>
  ) {}
  
  // Lifecycle hooks
  ngOnInit(): void {
    this.initializeComponent();
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  // Public methods
  public handleUserAction(): void {
    // Implementation
  }
  
  // Private methods
  private initializeComponent(): void {
    // Implementation
  }
}
```

### State Management Patterns

```typescript
// Action naming convention
export const NetworkActions = createActionGroup({
  source: 'Network',
  events: {
    // Command actions (imperative)
    'Load Network': props<{ file: File }>(),
    'Process Network': props<{ csvContent: string }>(),
    'Update Node Probabilities': props<{ probabilities: Record<number, number> }>(),
    
    // Event actions (past tense)
    'Network Loaded Successfully': props<{ networkData: NetworkData }>(),
    'Network Load Failed': props<{ error: string }>(),
    'Network Processing Completed': props<{ processedData: ProcessInputResponse }>()
  }
});

// Selector patterns
export const selectNetworkFeature = createFeatureSelector<NetworkState>('network');

export const selectNetworkData = createSelector(
  selectNetworkFeature,
  (state: NetworkState) => state.networkData
);

export const selectIsNetworkLoaded = createSelector(
  selectNetworkFeature,
  (state: NetworkState) => state.isLoaded && !state.isProcessing
);

// Complex selectors with memoization
export const selectDiamondsBySize = createSelector(
  selectNetworkFeature,
  (state: NetworkState) => {
    return state.diamondStructures
      .sort((a, b) => b.nodes.length - a.nodes.length)
      .slice(0, 10); // Top 10 largest diamonds
  }
);
```

### Testing Strategy

```typescript
// Component testing template
describe('FeatureNameComponent', () => {
  let component: FeatureNameComponent;
  let fixture: ComponentFixture<FeatureNameComponent>;
  let mockService: jasmine.SpyObj<SomeService>;
  let mockStore: MockStore<AppState>;
  
  beforeEach(async () => {
    const serviceSpy = jasmine.createSpyObj('SomeService', ['method1', 'method2']);
    
    await TestBed.configureTestingModule({
      declarations: [FeatureNameComponent],
      providers: [
        { provide: SomeService, useValue: serviceSpy },
        provideMockStore({ initialState: mockInitialState })
      ]
    }).compileComponents();
    
    fixture = TestBed.createComponent(FeatureNameComponent);
    component = fixture.componentInstance;
    mockService = TestBed.inject(SomeService) as jasmine.SpyObj<SomeService>;
    mockStore = TestBed.inject(MockStore);
  });
  
  it('should create', () => {
    expect(component).toBeTruthy();
  });
  
  it('should handle user action correctly', () => {
    // Arrange
    const expectedAction = NetworkActions.loadNetwork({ file: mockFile });
    
    // Act
    component.handleUserAction();
    
    // Assert
    expect(mockStore.dispatch).toHaveBeenCalledWith(expectedAction);
  });
});

// Service testing template
describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;
  
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ApiService]
    });
    
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });
  
  afterEach(() => {
    httpMock.verify();
  });
  
  it('should process input successfully', () => {
    const mockRequest: ProcessInputRequest = { csvContent: 'test' };
    const mockResponse: ProcessInputResponse = { /* mock data */ };
    
    service.processInput(mockRequest).subscribe(response => {
      expect(response).toEqual(mockResponse);
    });
    
    const req = httpMock.expectOne(`${environment.apiUrl}/api/processinput`);
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });
});
```

### Error Handling Patterns

```typescript
// Global error handler
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(
    private notificationService: NotificationService,
    private logger: LoggerService
  ) {}
  
  handleError(error: any): void {
    // Log error details
    this.logger.error('Global error occurred:', error);
    
    // Show user-friendly message
    if (error instanceof HttpErrorResponse) {
      this.handleHttpError(error);
    } else if (error instanceof TypeError) {
      this.handleTypeError(error);
    } else {
      this.handleGenericError(error);
    }
  }
  
  private handleHttpError(error: HttpErrorResponse): void {
    const message = this.getHttpErrorMessage(error.status);
    this.notificationService.showError(message);
  }
  
  private getHttpErrorMessage(status: number): string {
    const messages: Record<number, string> = {
      400: 'Invalid request. Please check your input.',
      401: 'Authentication required.',
      403: 'Access denied.',
      404: 'Service not found.',
      500: 'Server error. Please try again later.',
      503: 'Service temporarily unavailable.'
    };
    
    return messages[status] || 'An unexpected error occurred.';
  }
}
```

---

## 🚀 Deployment Strategy

### Build Configuration

```typescript
// Environment configurations
export const environment = {
  production: false,
  apiUrl: 'http://localhost:9090',
  enableDevTools: true,
  logLevel: 'debug',
  cacheTimeout: 300000, // 5 minutes
  maxFileSize: 10 * 1024 * 1024, // 10MB
  supportedFileTypes: ['.csv', '.txt', '.json'],
  features: {
    enableSessionPersistence: true,
    enableAnalyticsTracking: false,
    enablePerformanceMonitoring: true
  }
};

// Production environment
export const environment = {
  production: true,
  apiUrl: 'https://api.networkanalysis.com',
  enableDevTools: false,
  logLevel: 'error',
  cacheTimeout: 600000, // 10 minutes
  maxFileSize: 50 * 1024 * 1024, // 50MB
  supportedFileTypes: ['.csv', '.txt', '.json'],
  features: {
    enableSessionPersistence: true,
    enableAnalyticsTracking: true,
    enablePerformanceMonitoring: true
  }
};
```

### Docker Configuration

```dockerfile
# Multi-stage build for Angular application
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build:prod

# Production stage
FROM nginx:alpine

# Copy built application
COPY --from=builder /app/dist/network-flow-ui /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

### CI/CD Pipeline

```yaml
# GitHub Actions workflow
name: Build and Deploy

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run lint
      - run: npm run test:ci
      - run: npm run e2e:ci
      
      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run build:prod
      
      - name: Build Docker image
        run: docker build -t network-analysis-ui:${{ github.sha }} .
      
      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push network-analysis-ui:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: Deploy to production
        run: |
          # Deployment commands here
          echo "Deploying to production..."
```

### Performance Optimization

```typescript
// Lazy loading configuration
const routes: Routes = [
  {
    path: '',
    redirectTo: '/network-setup',
    pathMatch: 'full'
  },
  {
    path: 'network-setup',
    loadChildren: () => import('./features/network-setup/network-setup.module').then(m => m.NetworkSetupModule)
  },
  {
    path: 'analysis',
    loadChildren: () => import('./features/analysis/analysis.module').then(m => m.AnalysisModule),
    canActivate: [NetworkLoadedGuard]
  },
  {
    path: 'visualization',
    loadChildren: () => import('./features/visualization/visualization.module').then(m => m.VisualizationModule),
    canActivate: [NetworkLoadedGuard]
  }
];

// Bundle optimization
export const appConfig: ApplicationConfig = {
  providers: [
    // Preload strategy for better performance
    provideRouter(routes, withPreloading(PreloadAllModules)),
    
    // Service worker for caching
    provideServiceWorker('ngsw-worker.js', {
      enabled: environment.production,
      registrationStrategy: 'registerWhenStable:30000'
    }),
    
    // HTTP interceptors for caching
    provideHttpClient(
      withInterceptors([
        cacheInterceptor,
        errorInterceptor,
        loadingInterceptor
      ])
    )
  ]
};
```

### Monitoring and Analytics

```typescript
// Performance monitoring service
@Injectable({
  providedIn: 'root'
})
export class PerformanceMonitoringService {
  private performanceObserver: PerformanceObserver;
  
  constructor() {
    if (environment.features.enablePerformanceMonitoring) {
      this.initializeMonitoring();
    }
  }
  
  private initializeMonitoring(): void {
    // Monitor Core Web Vitals
    this.performanceObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        this.reportMetric(entry);
      });
    });
    
    this.performanceObserver.observe({ entryTypes: ['measure', 'navigation', 'paint'] });
  }
  
  // Custom performance tracking
  trackAnalysisPerformance(analysisType: string, duration: number): void {
    if (environment.features.enableAnalyticsTracking) {
      // Send to analytics service
      this.sendAnalyticsEvent('analysis_performance', {
        type: analysisType,
        duration,
        timestamp: Date.now()
      });
    }
  }
  
  private reportMetric(entry: PerformanceEntry): void {
    // Report to monitoring service
    console.log(`Performance metric: ${entry.name} - ${entry.duration}ms`);
  }
  
  private sendAnalyticsEvent(eventName: string, data: any): void {
    // Implementation for analytics tracking
  }
}
```

---

## 📚 Conclusion

This comprehensive architecture document provides a complete blueprint for implementing a sophisticated Angular network analysis application. The architecture emphasizes:

### Key Architectural Principles
- **Modularity**: Clean separation of concerns with feature-based modules
- **Scalability**: NgRx state management supporting complex multi-level analysis
- **Maintainability**: Well-defined service boundaries and consistent patterns
- **Performance**: Optimized for large network datasets and complex visualizations
- **User Experience**: Intuitive multi-tab interface with seamless navigation

### Implementation Priorities
1. **Phase 1**: Core infrastructure (NgRx store, API integration, basic visualization)
2. **Phase 2**: File handling and network setup functionality
3. **Phase 3**: Multi-level analysis system and tab management
4. **Phase 4**: Advanced visualization features and diamond drill-down
5. **Phase 5**: Session management and export capabilities
6. **Phase 6**: Performance optimization and production deployment

### Success Metrics
- **Functionality**: All 6 Julia API endpoints successfully integrated
- **Performance**: Sub-3-second load times for networks up to 1000 nodes
- **Usability**: Intuitive multi-level navigation with unlimited drill-down depth
- **Reliability**: Robust error handling and session persistence
- **Maintainability**: Comprehensive test coverage and clear documentation

This architecture serves as both a technical specification and implementation guide, ensuring the successful delivery of a powerful network analysis platform that meets all user requirements while maintaining high standards of code quality and system performance.

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Next Review**: March 2025