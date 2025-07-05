# 🚀 Angular 20 Diamond Analysis Implementation Plan

## 📋 Project Overview

This implementation plan transforms the current Angular 20 application with D3.js visualization into a comprehensive diamond analysis platform. The plan focuses on actionable implementation steps organized into independent, deliverable phases that build upon the existing signal-based architecture.

### Current Foundation ✅
- **Angular 20 + Native Signals**: Complete state management system
- **D3.js + GraphViz Visualization**: Functional interactive network visualization
- **Professional UI**: Working network setup and visualization pages
- **Modular Architecture**: Nx workspace with 3 libraries (network-core, ui-components, visualization)
- **Julia API Ready**: Service layer prepared for backend integration

---

## 🎯 Implementation Strategy

### Development Approach
- **Incremental Enhancement**: Build upon existing working components
- **Signal-First**: Leverage Angular 20 native signals throughout
- **API-Driven**: Integrate Julia backend for diamond analysis
- **Visualization-Enhanced**: Extend D3.js with diamond-specific features
- **Test-Driven**: Comprehensive testing for each deliverable

### Success Metrics
- Diamond detection accuracy > 95%
- Visualization performance: 60fps for networks < 1000 nodes
- Analysis response time < 2 seconds for typical networks
- User interaction responsiveness < 100ms

---

## 📅 Implementation Phases

## Phase 1: Diamond Detection Foundation (Week 1-2)

### 1.1 Diamond Models & Types
**Deliverable**: Complete diamond data models and TypeScript interfaces

**Files to Create/Modify**:
- `libs/network-core/src/lib/models/diamond.models.ts`
- `libs/network-core/src/lib/models/api.models.ts` (extend)

**Implementation Tasks**:
```typescript
// Diamond structure interfaces
export interface DiamondStructure {
  id: string;
  nodes: number[];
  sourceNode: number;
  forkNodes: number[];
  joinNodes: number[];
  sinkNode: number;
  level: number;
  parentDiamondId?: string;
  childDiamondIds: string[];
  
  // Analysis properties
  propagationProbability: number;
  criticalPath: number[];
  redundancyFactor: number;
  
  // Geometric properties
  depth: number;
  width: number;
  complexity: DiamondComplexity;
}

export interface DiamondClassification {
  diamondId: string;
  type: DiamondType;
  subtype: DiamondSubtype;
  confidence: number;
  characteristics: DiamondCharacteristics;
}

export type DiamondType = 'simple' | 'nested' | 'overlapping' | 'cascade' | 'parallel';
export type AnalysisLevel = 'global' | 'subgraph' | 'local' | 'nested';
```

**Acceptance Criteria**:
- [ ] All diamond interfaces defined with proper TypeScript types
- [ ] Export barrel updated in `libs/network-core/src/index.ts`
- [ ] Models support serialization/deserialization
- [ ] Unit tests for model validation

### 1.2 Diamond State Service
**Deliverable**: Signal-based diamond state management service

**Files to Create**:
- `libs/network-core/src/lib/services/diamond-state.service.ts`

**Implementation**:
```typescript
@Injectable({ providedIn: 'root' })
export class DiamondStateService {
  // Private signals
  private _diamondStructures = signal<DiamondStructure[]>([]);
  private _classifications = signal<DiamondClassification[]>([]);
  private _analysisLevel = signal<AnalysisLevel>('global');
  private _isAnalyzing = signal(false);
  private _analysisProgress = signal(0);
  
  // Public readonly signals
  readonly diamondStructures = this._diamondStructures.asReadonly();
  readonly classifications = this._classifications.asReadonly();
  readonly analysisLevel = this._analysisLevel.asReadonly();
  readonly isAnalyzing = this._isAnalyzing.asReadonly();
  readonly analysisProgress = this._analysisProgress.asReadonly();
  
  // Computed signals
  readonly diamondCount = computed(() => this._diamondStructures().length);
  readonly classificationSummary = computed(() => 
    this._classifications().reduce((acc, c) => {
      acc[c.type] = (acc[c.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  );
  
  readonly canAnalyze = computed(() => 
    !this._isAnalyzing() && this.networkState.isNetworkLoaded()
  );
  
  constructor(private networkState: NetworkStateService) {
    // Effects for coordination
    effect(() => {
      const structures = this._diamondStructures();
      if (structures.length > 0) {
        this.notifyVisualizationUpdate(structures);
      }
    });
  }
  
  // State mutation methods
  async detectDiamonds(): Promise<void> {
    if (!this.canAnalyze()) return;
    
    this._isAnalyzing.set(true);
    this._analysisProgress.set(0);
    
    try {
      const networkData = this.networkState.networkData();
      if (!networkData) throw new Error('No network data available');
      
      // Call Julia API for diamond detection
      const diamonds = await this.apiService.detectDiamonds(networkData);
      this._diamondStructures.set(diamonds);
      this._analysisProgress.set(100);
      
    } catch (error) {
      console.error('Diamond detection failed:', error);
      this.uiState.showError('Diamond Detection Failed', error.message);
    } finally {
      this._isAnalyzing.set(false);
    }
  }
}
```

**Acceptance Criteria**:
- [ ] Service integrates with existing NetworkStateService
- [ ] All signals properly typed and reactive
- [ ] Error handling with UI notifications
- [ ] Progress tracking for long-running operations
- [ ] Service exported in barrel file

### 1.3 Julia API Integration
**Deliverable**: Diamond-specific API endpoints integration

**Files to Modify**:
- `libs/network-core/src/lib/services/api.service.ts`

**Implementation Tasks**:
```typescript
// Add to existing ApiService
export class ApiService {
  // ... existing methods ...
  
  // Diamond detection endpoints
  detectDiamonds(networkData: NetworkData): Observable<DiamondStructure[]> {
    return this.http.post<DiamondStructure[]>(`${this.baseUrl}/diamonds/detect`, {
      adjacency_matrix: networkData.adjacencyMatrix,
      node_probabilities: networkData.nodeProbabilities,
      edge_probabilities: networkData.edgeProbabilities
    }).pipe(
      timeout(30000), // 30 second timeout
      retry(2),
      catchError(this.handleError)
    );
  }
  
  classifyDiamonds(diamonds: DiamondStructure[]): Observable<DiamondClassification[]> {
    return this.http.post<DiamondClassification[]>(`${this.baseUrl}/diamonds/classify`, {
      diamond_structures: diamonds
    }).pipe(
      timeout(15000),
      retry(2),
      catchError(this.handleError)
    );
  }
  
  performMultiLevelAnalysis(
    networkData: NetworkData, 
    level: AnalysisLevel
  ): Observable<MultiLevelAnalysis> {
    return this.http.post<MultiLevelAnalysis>(`${this.baseUrl}/diamonds/multi-level`, {
      network_data: networkData,
      analysis_level: level,
      include_nested: true,
      include_propagation: true
    }).pipe(
      timeout(60000), // Longer timeout for complex analysis
      retry(1),
      catchError(this.handleError)
    );
  }
}
```

**Acceptance Criteria**:
- [ ] All diamond API endpoints implemented
- [ ] Proper error handling and retry logic
- [ ] Request/response type safety
- [ ] Timeout handling for long operations
- [ ] Integration tests with mock responses

---

## Phase 2: Visualization Enhancement (Week 3-4)

### 2.1 Diamond Visualization Service
**Deliverable**: Diamond-specific visualization enhancements for D3.js

**Files to Create**:
- `libs/visualization/src/lib/services/diamond-visualization.service.ts`

**Implementation**:
```typescript
@Injectable({ providedIn: 'root' })
export class DiamondVisualizationService {
  private readonly visualizationState = inject(VisualizationStateService);
  
  // Diamond color palette
  private readonly diamondColors = {
    simple: '#4CAF50',
    nested: '#2196F3', 
    overlapping: '#FF9800',
    cascade: '#9C27B0',
    parallel: '#F44336'
  };
  
  highlightDiamondStructures(diamonds: DiamondStructure[]): void {
    diamonds.forEach((diamond, index) => {
      const color = this.diamondColors[diamond.type] || '#666';
      
      // Highlight diamond nodes with specific styling
      this.visualizationState.highlightNodes(diamond.nodes, color);
      
      // Highlight diamond edges
      const diamondEdges = this.getDiamondEdges(diamond);
      this.visualizationState.highlightEdges(diamondEdges, color);
    });
  }
  
  generateDiamondEnhancedDot(
    networkData: NetworkData, 
    diamonds: DiamondStructure[]
  ): string {
    let dot = `digraph G {\n`;
    dot += `  layout=dot;\n`;
    dot += `  rankdir=TB;\n`;
    dot += `  compound=true;\n\n`;
    
    // Create subgraphs for each diamond
    diamonds.forEach((diamond, index) => {
      dot += `  subgraph cluster_diamond_${index} {\n`;
      dot += `    label="Diamond ${index + 1} (${diamond.type})";\n`;
      dot += `    style=filled;\n`;
      dot += `    fillcolor="${this.diamondColors[diamond.type]}";\n`;
      dot += `    alpha=0.2;\n`;
      
      diamond.nodes.forEach(nodeId => {
        const node = networkData.nodes.find(n => n.id === nodeId);
        if (node) {
          dot += `    "${nodeId}" [${this.getDiamondNodeStyle(node, diamond)}];\n`;
        }
      });
      
      dot += `  }\n\n`;
    });
    
    // Add remaining nodes and edges
    this.addRegularNodesAndEdges(dot, networkData, diamonds);
    
    dot += '}\n';
    return dot;
  }
  
  private getDiamondNodeStyle(node: any, diamond: DiamondStructure): string {
    let style = 'style=filled, ';
    
    if (node.id === diamond.sourceNode) {
      style += 'shape=triangle, fillcolor=lightgreen';
    } else if (node.id === diamond.sinkNode) {
      style += 'shape=invtriangle, fillcolor=lightcoral';
    } else if (diamond.forkNodes.includes(node.id)) {
      style += 'shape=diamond, fillcolor=orange';
    } else if (diamond.joinNodes.includes(node.id)) {
      style += 'shape=pentagon, fillcolor=plum';
    } else {
      style += 'fillcolor=lightblue';
    }
    
    return style;
  }
}
```

**Acceptance Criteria**:
- [ ] Diamond structures visually highlighted in D3.js
- [ ] Different diamond types have distinct colors
- [ ] Node shapes indicate diamond roles (source, fork, join, sink)
- [ ] Smooth transitions when highlighting changes
- [ ] Performance optimized for multiple diamonds

### 2.2 Enhanced Visualization Component
**Deliverable**: Update existing visualization component with diamond features

**Files to Modify**:
- `apps/network-flow-ui/src/app/pages/visualization/visualization.component.ts`
- `apps/network-flow-ui/src/app/pages/visualization/visualization.component.html`

**Key Enhancements**:
```typescript
export class VisualizationComponent {
  // Add diamond-specific services
  private readonly diamondState = inject(DiamondStateService);
  private readonly diamondViz = inject(DiamondVisualizationService);
  
  // Add diamond-specific signals
  readonly diamondStructures = this.diamondState.diamondStructures;
  readonly diamondCount = this.diamondState.diamondCount;
  readonly isAnalyzingDiamonds = this.diamondState.isAnalyzing;
  
  constructor() {
    // ... existing effects ...
    
    // Effect: Update visualization when diamonds change
    effect(() => {
      const diamonds = this.diamondStructures();
      if (diamonds.length > 0 && this.graphvizRenderer) {
        this.renderNetworkWithDiamonds(diamonds);
      }
    });
  }
  
  private renderNetworkWithDiamonds(diamonds: DiamondStructure[]): void {
    if (!this.graphvizRenderer) return;
    
    const networkData = this.networkData();
    if (!networkData) return;
    
    try {
      const enhancedDot = this.diamondViz.generateDiamondEnhancedDot(
        networkData, 
        diamonds
      );
      this.graphvizRenderer.renderDot(enhancedDot);
      
      // Add interactive diamond features
      this.setupDiamondInteractions(diamonds);
      
    } catch (error) {
      console.error('Failed to render diamonds:', error);
    }
  }
  
  // Diamond-specific control methods
  async detectDiamonds(): Promise<void> {
    await this.diamondState.detectDiamonds();
  }
  
  toggleDiamondHighlights(): void {
    const diamonds = this.diamondStructures();
    if (diamonds.length > 0) {
      this.diamondViz.highlightDiamondStructures(diamonds);
    }
  }
}
```

**Template Enhancements**:
```html
<!-- Add to existing controls panel -->
<div class="card">
  <h3>💎 Diamond Analysis</h3>
  
  <div class="diamond-stats">
    <div class="stat-item">
      <span class="stat-value">{{ diamondCount() }}</span>
      <span class="stat-label">Diamonds Found</span>
    </div>
  </div>
  
  <div class="diamond-controls">
    <button
      class="btn-primary"
      [disabled]="isAnalyzingDiamonds() || !isNetworkLoaded()"
      (click)="detectDiamonds()">
      @if (isAnalyzingDiamonds()) {
        🔄 Detecting Diamonds...
      } @else {
        💎 Detect Diamonds
      }
    </button>
    
    @if (diamondCount() > 0) {
      <button
        class="btn-secondary"
        (click)="toggleDiamondHighlights()">
        🎨 Toggle Highlights
      </button>
    }
  </div>
</div>
```

**Acceptance Criteria**:
- [ ] Diamond detection button integrated into UI
- [ ] Diamond count displayed in statistics
- [ ] Diamond highlighting toggle functionality
- [ ] Progress indication during analysis
- [ ] Responsive design maintained

---

## Phase 3: Diamond Analysis Dashboard (Week 5-6)

### 3.1 Diamond Analysis Page
**Deliverable**: Dedicated page for comprehensive diamond analysis

**Files to Create**:
- `apps/network-flow-ui/src/app/pages/diamond-analysis/`
  - `diamond-analysis.component.ts`
  - `diamond-analysis.component.html`
  - `diamond-analysis.component.scss`

**Implementation**:
```typescript
@Component({
  selector: 'app-diamond-analysis',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="diamond-analysis-page">
      <div class="page-header">
        <h1>💎 Diamond Structure Analysis</h1>
        <p class="subtitle">Comprehensive analysis and classification of network diamond structures</p>
      </div>
      
      <div class="analysis-layout">
        <div class="analysis-controls">
          <!-- Analysis level selection -->
          <div class="card">
            <h3>Analysis Configuration</h3>
            
            <div class="control-group">
              <label>Analysis Level</label>
              <select [value]="selectedLevel()" (change)="onLevelChange($event)">
                <option value="global">Global Analysis</option>
                <option value="subgraph">Subgraph Analysis</option>
                <option value="local">Local Analysis</option>
                <option value="nested">Nested Analysis</option>
              </select>
            </div>
            
            <button 
              class="btn-primary"
              [disabled]="!canRunAnalysis()"
              (click)="runComprehensiveAnalysis()">
              🚀 Run Analysis
            </button>
          </div>
          
          <!-- Classification summary -->
          @if (classificationSummary(); as summary) {
            <div class="card">
              <h3>Classification Summary</h3>
              
              @for (item of summary | keyvalue; track item.key) {
                <div class="classification-item">
                  <span class="type">{{ item.key | titlecase }}</span>
                  <span class="count">{{ item.value }}</span>
                </div>
              }
            </div>
          }
        </div>
        
        <div class="analysis-results">
          @if (isAnalyzing()) {
            <div class="analysis-progress">
              <app-progress-indicator 
                [progress]="analysisProgress()"
                [message]="'Analyzing diamond structures...'" />
            </div>
          }
          
          @if (diamondStructures().length > 0) {
            <div class="diamond-grid">
              @for (diamond of diamondStructures(); track diamond.id) {
                <app-diamond-card 
                  [diamond]="diamond"
                  [classification]="getClassification(diamond.id)"
                  (explore)="exploreDiamond($event)"
                  (highlight)="highlightDiamond($event)" />
              }
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class DiamondAnalysisComponent {
  protected readonly diamondState = inject(DiamondStateService);
  protected readonly analysisState = inject(AnalysisStateService);
  
  // Component signals
  readonly selectedLevel = signal<AnalysisLevel>('global');
  
  // Computed signals
  readonly diamondStructures = this.diamondState.diamondStructures;
  readonly classifications = this.diamondState.classifications;
  readonly isAnalyzing = this.diamondState.isAnalyzing;
  readonly analysisProgress = this.diamondState.analysisProgress;
  
  readonly classificationSummary = this.diamondState.classificationSummary;
  readonly canRunAnalysis = this.diamondState.canAnalyze;
  
  // Methods
  async runComprehensiveAnalysis(): Promise<void> {
    await this.diamondState.performMultiLevelAnalysis(this.selectedLevel());
  }
  
  onLevelChange(event: Event): void {
    const level = (event.target as HTMLSelectElement).value as AnalysisLevel;
    this.selectedLevel.set(level);
    this.diamondState.setAnalysisLevel(level);
  }
  
  getClassification(diamondId: string): DiamondClassification | undefined {
    return this.classifications().find(c => c.diamondId === diamondId);
  }
  
  exploreDiamond(diamond: DiamondStructure): void {
    // Navigate to detailed diamond exploration
    this.router.navigate(['/diamond-explorer', diamond.id]);
  }
  
  highlightDiamond(diamond: DiamondStructure): void {
    // Highlight specific diamond in visualization
    this.diamondViz.highlightSingleDiamond(diamond);
  }
}
```

**Acceptance Criteria**:
- [ ] Dedicated diamond analysis page created
- [ ] Analysis level selection functionality
- [ ] Classification summary display
- [ ] Diamond grid with individual cards
- [ ] Navigation integration with routing

### 3.2 Diamond Card Component
**Deliverable**: Reusable component for displaying diamond information

**Files to Create**:
- `libs/ui-components/src/lib/diamond-card/diamond-card.component.ts`

**Implementation**:
```typescript
@Component({
  selector: 'app-diamond-card',
  standalone: true,
  template: `
    <div class="diamond-card" [class]="'diamond-' + diamond.type">
      <div class="diamond-header">
        <h4>Diamond {{ diamond.id }}</h4>
        <span class="diamond-type">{{ diamond.type | titlecase }}</span>
      </div>
      
      <div class="diamond-stats">
        <div class="stat">
          <label>Nodes:</label>
          <span>{{ diamond.nodes.length }}</span>
        </div>
        <div class="stat">
          <label>Depth:</label>
          <span>{{ diamond.depth }}</span>
        </div>
        <div class="stat">
          <label>Probability:</label>
          <span>{{ diamond.propagationProbability | percent:'1.2-2' }}</span>
        </div>
      </div>
      
      @if (classification) {
        <div class="classification-info">
          <span class="subtype">{{ classification.subtype | titlecase }}</span>
          <span class="confidence">{{ classification.confidence | percent:'1.1-1' }}</span>
        </div>
      }
      
      <div class="diamond-actions">
        <button class="btn-small" (click)="explore.emit(diamond)">
          🔍 Explore
        </button>
        <button class="btn-small" (click)="highlight.emit(diamond)">
          🎨 Highlight
        </button>
      </div>
    </div>
  `
})
export class DiamondCardComponent {
  @Input({ required: true }) diamond!: DiamondStructure;
  @Input() classification?: DiamondClassification;
  
  @Output() explore = new EventEmitter<DiamondStructure>();
  @Output() highlight = new EventEmitter<DiamondStructure>();
}
```

**Acceptance Criteria**:
- [ ] Diamond information clearly displayed
- [ ] Classification data integration
- [ ] Action buttons for explore/highlight
- [ ] Responsive card design
- [ ] Type-specific styling

---

## Phase 4: Multi-Level Analysis (Week 7-8)

### 4.1 Multi-Level Analysis Service
**Deliverable**: Comprehensive multi-level diamond analysis

**Files to Create**:
- `libs/network-core/src/lib/services/multi-level-analysis.service.ts`

**Implementation**:
```typescript
@Injectable({ providedIn: 'root' })
export class MultiLevelAnalysisService {
  private readonly diamondState = inject(DiamondStateService);
  private readonly apiService = inject(ApiService);
  private readonly networkState = inject(NetworkStateService);
  
  async performComprehensiveAnalysis(
    level: AnalysisLevel
  ): Promise<MultiLevelAnalysis> {
    const networkData = this.networkState.networkData();
    if (!networkData) throw new Error('No network data available');
    
    this.diamondState.setAnalyzing(true);
    this.diamondState.setProgress(0);
    
    try {
      // Phase 1: Global Analysis (25%)
      const globalResults = await this.performGlobalAnalysis(networkData);
      this.diamondState.setProgress(25);
      
      // Phase 2: Subgraph Analysis (50%)
      const subgraphResults = await this.performSubgraphAnalysis(
        networkData, 
        globalResults.diamonds
      );
      this.diamondState.setProgress(50);
      
      // Phase 3: Local Analysis (75%)
      const localResults = await this.performLocalAnalysis(
        networkData,
        globalResults.diamonds
      );
      this.diamondState.setProgress(75);
      
      // Phase 4: Nested Analysis (100%)
      const nestedResults = await this.performNestedAnalysis(
        globalResults.diamonds,
        subgraphResults
      );
      this.diamondState.setProgress(100);
      
      // Integration
      const integratedResults = this.integrateResults({
        global: globalResults,
        subgraph: subgraphResults,
        local: localResults,
        nested: nestedResults
      });
      
      // Update state
      this.diamondState.setDiamondStructures(integratedResults.allDiamonds);
      this.diamondState.setClassifications(integratedResults.allClassifications);
      
      return integratedResults;
      
    } finally {
      this.diamondState.setAnalyzing(false);
    }
  }
  
  private async performGlobalAnalysis(
    networkData: NetworkData
  ): Promise<GlobalAnalysisResults> {
    const diamonds = await firstValueFrom(
      this.apiService.detectDiamonds(networkData)
    );
    
    const classifications = await firstValueFrom(
      this.apiService.classifyDiamonds(diamonds)
    );
    
    return { diamonds, classifications };
  }
  
  private async performSubgraphAnalysis(
    networkData: NetworkData,
    globalDiamonds: DiamondStructure[]
  ): Promise<SubgraphAnalysisResults[]> {
    // Decompose network into subgraphs based on global diamonds
    const subgraphs = this.decomposeIntoSubgraphs(networkData, globalDiamonds);
    
    // Analyze each subgraph independently
    const results = await Promise.all(
      subgraphs.map(async (subgraph) => {
        const diamonds = await firstValueFrom(
          this.apiService.detectDiamonds(subgraph.networkData)
        );
        
        const classifications = await firstValueFrom(
          this.apiService.classifyDiamonds(diamonds)
        );
        
        return {
          subgraphId: subgraph.id,
          diamonds,
          classifications,
          parentDiamonds: subgraph.parentDiamonds
        };
      })
    );
    
    return results;
  }
}
```

**Acceptance Criteria**:
- [ ] Multi-phase analysis with progress tracking
- [ ] Global, subgraph, local, and nested analysis
- [ ] Results integration and state updates
- [ ] Error handling and recovery
- [ ] Performance optimization for large networks

### 4.2 Diamond Explorer Page
**Deliverable**: Detailed exploration interface for individual diamonds

**Files to Create**:
- `apps/network-flow-ui/src/app/pages/diamond-explorer/`

**Key Features**:
- Detailed diamond structure visualization
- Hierarchical relationship display
- Propagation path analysis
- Interactive node/edge exploration
- Export capabilities

**Acceptance Criteria**:
- [ ] Individual diamond detailed view
- [ ] Hierarchical navigation
- [ ] Propagation visualization
- [ ] Export functionality
- [ ] Responsive design

---

## Phase 5: Advanced Features (Week 9-10)

### 5.1 Diamond Comparison Tool
**Deliverable**: Side-by-side diamond comparison interface

### 5.2 Analysis History & Sessions
**Deliverable**: Save/load analysis sessions with results

### 5.3 Export & Reporting
**Deliverable**: Comprehensive export capabilities (JSON, CSV, PDF reports)

### 5.4 Performance Optimization
**Deliverable**: Optimization for large networks and complex analyses

---

## 🧪 Testing Strategy

### Unit Testing
- **Services**: All signal-based services with comprehensive test coverage
- **Components**: Component logic and signal integration
- **Models**: Data model validation and serialization

### Integration Testing
- **API Integration**: Mock Julia backend responses
- **Visualization**: D3.js rendering with diamond enhancements
- **State Management**: Cross-service signal coordination

### E2E Testing
- **User Workflows**: Complete diamond analysis workflows
- **Performance**: Large network handling
- **Error Scenarios**: Network failures and recovery

---

## 📊 Success Criteria

### Functional Requirements
- [ ] Diamond detection with >95% accuracy
- [ ] Multi-level analysis (global, subgraph, local, nested)
- [ ] Interactive visualization with diamond highlighting
- [ ] Classification system with confidence metrics
- [ ] Export capabilities for analysis results

### Performance Requirements
- [ ] Analysis completion <2 seconds for networks <1000 nodes
- [ ] Visualization rendering at 60fps
- [ ] Memory usage <500MB for typical sessions
- [ ] Responsive UI interactions <100ms

### Quality Requirements
- [ ] >90% test coverage for core functionality
- [ ] Zero critical accessibility issues
- [ ] Cross-browser compatibility (Chrome, Firefox, Safari)
- [ ] Mobile-friendly responsive design

This implementation plan provides clear, actionable steps to transform the existing Angular 20 application into a comprehensive diamond analysis platform while maintaining the modern signal-based architecture and building upon the existing D3.js visualization system.