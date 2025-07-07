import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

// Import services and models
import { GlobalStateService } from '../../../../../../libs/network-core/src/lib/services/global-state.service';
import { NetworkAnalysisService } from '../../../../../../libs/network-core/src/lib/services/network-analysis.service';
import { 
  ReachabilityQuery, 
  ReachabilityResult, 
  ReachabilityPath, 
  ProbabilityValue,
  ProbabilityType,
  IntervalProbability,
  PBoxProbability
} from '../../../../../../libs/network-core/src/lib/models/network.models';

interface UserDataStatus {
  hasNetworkData: boolean;
  hasNodePriors: boolean;
  hasEdgeProbabilities: boolean;
  analysisComplete: boolean;
  probabilityType: ProbabilityType;
}

interface ReachabilityStatistics {
  totalPaths: number;
  averagePathLength: number;
  maxPathLength: number;
  minPathLength: number;
  averageProbability: number;
  executionTime: number;
  nodesAnalyzed: number;
  totalNodes: number;
}

interface FilterState {
  searchTerm: string;
  analysisType: string;
  minLength: number | null;
  maxLength: number | null;
  minProbability: number | null;
  maxProbability: number | null;
}

@Component({
  selector: 'app-reachability-analysis',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './reachability-analysis.component.html',
  styleUrls: ['./reachability-analysis.component.scss']
})
export class ReachabilityAnalysisComponent implements OnInit {
  private router = inject(Router);
  private globalState = inject(GlobalStateService);
  private networkService = inject(NetworkAnalysisService);

  // Global state signals
  readonly sessionId = this.globalState.sessionId;
  readonly hasNetworkData = this.globalState.hasNetworkData;
  readonly diamondAnalysis = this.globalState.diamondAnalysis;
  readonly isGlobalLoading = this.globalState.isLoading;
  readonly globalError = this.globalState.error;

  // Component state signals
  isLoading = signal(false);
  error = signal<string | null>(null);
  reachabilityResults = signal<ReachabilityResult[]>([]);
  showBuilder = signal(false);
  
  // Query form signals
  sourceNodesInput = signal('');
  targetNodesInput = signal('');
  analysisType = signal<'forward' | 'backward' | 'bidirectional'>('forward');
  maxDepth = signal(5);
  newSourceNode = signal('');
  newTargetNode = signal('');
  
  // Selected nodes from diamond analysis
  preselectedNodes = signal<string[]>([]);
  
  // Filter signals
  filterState = signal<FilterState>({
    searchTerm: '',
    analysisType: 'all',
    minLength: null,
    maxLength: null,
    minProbability: null,
    maxProbability: null
  });
  
  // Sorting signals
  sortField = signal<string>('probability');
  sortDirection = signal<'asc' | 'desc'>('desc');
  
  // Pagination signals
  currentPage = signal(1);
  itemsPerPage = signal(10);

  // User data utilization status
  userDataStatus = computed((): UserDataStatus => {
    const probabilityType = this.globalState.probabilityType();
    return {
      hasNetworkData: this.hasNetworkData(),
      hasNodePriors: true, // Service validates this during API calls
      hasEdgeProbabilities: true, // Service validates this during API calls
      analysisComplete: this.reachabilityResults().length > 0,
      probabilityType: probabilityType || 'float'
    };
  });

  // Computed properties
  sourceNodes = computed(() => {
    const input = this.sourceNodesInput().trim();
    return input ? input.split(',').map(n => n.trim()).filter(n => n) : [];
  });

  targetNodes = computed(() => {
    const input = this.targetNodesInput().trim();
    return input ? input.split(',').map(n => n.trim()).filter(n => n) : [];
  });

  currentQuery = computed(() => ({
    sourceNodes: this.sourceNodes(),
    targetNodes: this.targetNodes(),
    analysisType: this.analysisType(),
    maxDepth: this.maxDepth()
  }));

  allPaths = computed(() => {
    return this.reachabilityResults().flatMap(result => result.paths);
  });

  filteredPaths = computed(() => {
    const paths = this.allPaths();
    const filter = this.filterState();
    
    return paths.filter(path => {
      // Search term filter
      if (filter.searchTerm) {
        const searchLower = filter.searchTerm.toLowerCase();
        const pathString = path.path.join(' → ').toLowerCase();
        const sourceNode = path.path[0]?.toLowerCase() || '';
        const targetNode = path.path[path.path.length - 1]?.toLowerCase() || '';
        
        if (!pathString.includes(searchLower) && 
            !sourceNode.includes(searchLower) &&
            !targetNode.includes(searchLower)) {
          return false;
        }
      }
      
      // Length filters
      if (filter.minLength !== null && path.length < filter.minLength) return false;
      if (filter.maxLength !== null && path.length > filter.maxLength) return false;
      
      // Probability filters (handle different probability types)
      const probValue = this.extractProbabilityValue(path.probability);
      if (filter.minProbability !== null && probValue < filter.minProbability) return false;
      if (filter.maxProbability !== null && probValue > filter.maxProbability) return false;
      
      return true;
    });
  });

  sortedPaths = computed(() => {
    const paths = [...this.filteredPaths()];
    const field = this.sortField();
    const direction = this.sortDirection();
    
    return paths.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (field) {
        case 'source':
          aVal = a.path[0] || '';
          bVal = b.path[0] || '';
          break;
        case 'target':
          aVal = a.path[a.path.length - 1] || '';
          bVal = b.path[b.path.length - 1] || '';
          break;
        case 'length':
          aVal = a.length;
          bVal = b.length;
          break;
        case 'probability':
          aVal = this.extractProbabilityValue(a.probability);
          bVal = this.extractProbabilityValue(b.probability);
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  });

  paginatedPaths = computed(() => {
    const paths = this.sortedPaths();
    const page = this.currentPage();
    const perPage = this.itemsPerPage();
    const start = (page - 1) * perPage;
    const end = start + perPage;
    
    return paths.slice(start, end);
  });

  totalPages = computed(() => {
    return Math.ceil(this.filteredPaths().length / this.itemsPerPage());
  });

  overallStatistics = computed(() => {
    const results = this.reachabilityResults();
    if (results.length === 0) return null;
    
    const allPaths = results.flatMap(r => r.paths);
    const totalExecutionTime = results.reduce((sum, r) => sum + r.processingTime, 0);
    
    return {
      totalPaths: allPaths.length,
      averagePathLength: allPaths.length > 0 ? 
        allPaths.reduce((sum, p) => sum + p.length, 0) / allPaths.length : 0,
      maxPathLength: allPaths.length > 0 ? Math.max(...allPaths.map(p => p.length)) : 0,
      minPathLength: allPaths.length > 0 ? Math.min(...allPaths.map(p => p.length)) : 0,
      averageProbability: allPaths.length > 0 ? 
        allPaths.reduce((sum, p) => sum + this.extractProbabilityValue(p.probability), 0) / allPaths.length : 0,
      executionTime: totalExecutionTime,
      nodesAnalyzed: (results[0] as any)?.metadata?.nodesAnalyzed || 0,
      totalNodes: (results[0] as any)?.metadata?.totalNodes || 0
    };
  });

  totalPaths = computed(() => this.allPaths().length);
  averagePathLength = computed(() => this.overallStatistics()?.averagePathLength || 0);
  totalProcessingTime = computed(() => this.overallStatistics()?.executionTime || 0);

  probabilityDistribution = computed(() => {
    const paths = this.filteredPaths();
    if (paths.length === 0) return [];
    
    // Create probability buckets
    const buckets = [
      { min: 0, max: 0.2, label: '0-20%', count: 0, range: '0-20%' },
      { min: 0.2, max: 0.4, label: '20-40%', count: 0, range: '20-40%' },
      { min: 0.4, max: 0.6, label: '40-60%', count: 0, range: '40-60%' },
      { min: 0.6, max: 0.8, label: '60-80%', count: 0, range: '60-80%' },
      { min: 0.8, max: 1.0, label: '80-100%', count: 0, range: '80-100%' }
    ];
    
    paths.forEach(path => {
      const probValue = this.extractProbabilityValue(path.probability);
      const bucket = buckets.find(b => probValue >= b.min && probValue <= b.max);
      if (bucket) bucket.count++;
    });
    
    const maxCount = Math.max(...buckets.map(b => b.count));
    
    return buckets.map(bucket => ({
      ...bucket,
      percentage: maxCount > 0 ? (bucket.count / maxCount) * 100 : 0
    }));
  });

  canRunAnalysis = computed(() => {
    return !this.isLoading() &&
           !this.isGlobalLoading() &&
           this.hasNetworkData() &&
           this.sessionId() !== null;
  });

  hasResults = computed(() => this.reachabilityResults().length > 0);

  // Check if diamond analysis is available for node selection
  hasDiamondData = computed(() => this.diamondAnalysis() !== null);

  // Computed for template compatibility
  filters = computed(() => this.filterState());
  preSelectedNodes = computed(() => this.preselectedNodes());
  isQueryValid = computed(() => this.canRunAnalysis());

  // Individual filter properties for two-way binding
  get searchTerm() { return this.filterState().searchTerm; }
  set searchTerm(value: string) { this.updateFilter('searchTerm', value); }

  get pathType() { return this.filterState().analysisType; }
  set pathType(value: string) { this.updateFilter('analysisType', value); }

  get minLength() { return this.filterState().minLength; }
  set minLength(value: number | null) { this.updateFilter('minLength', value); }

  get maxLength() { return this.filterState().maxLength; }
  set maxLength(value: number | null) { this.updateFilter('maxLength', value); }

  get minProbability() { return this.filterState().minProbability; }
  set minProbability(value: number | null) { this.updateFilter('minProbability', value); }

  get maxProbability() { return this.filterState().maxProbability; }
  set maxProbability(value: number | null) { this.updateFilter('maxProbability', value); }

  ngOnInit() {
    this.loadPreselectedNodes();
    this.loadSavedResults();
  }

  // Helper method to extract numeric value from ProbabilityValue
  extractProbabilityValue(probability: ProbabilityValue): number {
    if (typeof probability === 'number') {
      return probability;
    } else if (typeof probability === 'object' && probability !== null) {
      // Handle interval probability
      if ('lower' in probability && 'upper' in probability) {
        return (probability.lower + probability.upper) / 2; // Use midpoint
      }
      // Handle pbox probability
      if ('bounds' in probability && 'weights' in probability) {
        const bounds = probability.bounds;
        const weights = probability.weights;
        if (bounds.length > 0 && weights.length > 0) {
          // Calculate weighted average
          let sum = 0;
          let totalWeight = 0;
          for (let i = 0; i < Math.min(bounds.length, weights.length); i++) {
            sum += bounds[i] * weights[i];
            totalWeight += weights[i];
          }
          return totalWeight > 0 ? sum / totalWeight : bounds[0];
        }
        return bounds[0] || 0;
      }
    }
    return 0;
  }

  // Helper method to format probability values for display
  formatProbabilityValue(probability: ProbabilityValue): string {
    if (typeof probability === 'number') {
      return (probability * 100).toFixed(2) + '%';
    } else if (typeof probability === 'object' && probability !== null) {
      // Handle interval probability
      if ('lower' in probability && 'upper' in probability) {
        return `[${(probability.lower * 100).toFixed(2)}%, ${(probability.upper * 100).toFixed(2)}%]`;
      }
      // Handle pbox probability
      if ('bounds' in probability && 'weights' in probability) {
        const bounds = probability.bounds;
        if (bounds.length >= 2) {
          return `P-box: [${(bounds[0] * 100).toFixed(2)}%, ${(bounds[bounds.length - 1] * 100).toFixed(2)}%]`;
        } else if (bounds.length === 1) {
          return (bounds[0] * 100).toFixed(2) + '%';
        }
      }
    }
    return '0.00%';
  }

  // Helper method to get source node from path
  getSourceNode(path: ReachabilityPath): string {
    return path.path[0] || '';
  }

  // Helper method to get target node from path
  getTargetNode(path: ReachabilityPath): string {
    return path.path[path.path.length - 1] || '';
  }

  private loadPreselectedNodes() {
    // Load nodes selected from diamond analysis from localStorage or global state
    try {
      const selectedDiamondNodes = localStorage.getItem('selectedDiamondNodes');
      if (selectedDiamondNodes) {
        const nodes = JSON.parse(selectedDiamondNodes);
        this.preselectedNodes.set(nodes);
        // Auto-populate source nodes with preselected nodes
        this.sourceNodesInput.set(nodes.join(', '));
      } else {
        // Try to get join nodes from diamond analysis if available
        const diamondData = this.diamondAnalysis();
        if (diamondData) {
          // Extract join nodes from diamond analysis
          const joinNodes = this.extractJoinNodesFromDiamondData(diamondData);
          if (joinNodes.length > 0) {
            this.preselectedNodes.set(joinNodes);
            this.sourceNodesInput.set(joinNodes.slice(0, 3).join(', ')); // Use first 3 as sources
            if (joinNodes.length > 3) {
              this.targetNodesInput.set(joinNodes.slice(3, 6).join(', ')); // Use next 3 as targets
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load preselected nodes:', error);
    }
  }

  private extractJoinNodesFromDiamondData(diamondData: any): string[] {
    try {
      // Check if we have the raw API response structure
      const rawData = (diamondData as any)?.data;
      if (rawData?.diamondData?.diamondStructures) {
        // Extract join node IDs from the diamond structures
        return Object.keys(rawData.diamondData.diamondStructures);
      }
      
      // Fallback to basic network data
      if (rawData?.networkData?.joinNodes) {
        return rawData.networkData.joinNodes.map((id: number) => id.toString());
      }
      
      return [];
    } catch (error) {
      console.warn('Failed to extract join nodes from diamond data:', error);
      return [];
    }
  }

  private loadSavedResults() {
    // Load any previously saved reachability results from localStorage
    try {
      const savedResults = localStorage.getItem('reachabilityResults');
      if (savedResults) {
        const results = JSON.parse(savedResults);
        this.reachabilityResults.set(results);
      }
    } catch (error) {
      console.warn('Failed to load saved results:', error);
    }
  }

  showQueryBuilder() {
    this.showBuilder.set(true);
  }

  cancelQuery() {
    this.showBuilder.set(false);
  }

  addSourceNode() {
    const node = this.newSourceNode().trim();
    if (node && !this.sourceNodes().includes(node)) {
      const current = this.sourceNodes();
      this.sourceNodesInput.set([...current, node].join(', '));
      this.newSourceNode.set('');
    }
  }

  addTargetNode() {
    const node = this.newTargetNode().trim();
    if (node && !this.targetNodes().includes(node)) {
      const current = this.targetNodes();
      this.targetNodesInput.set([...current, node].join(', '));
      this.newTargetNode.set('');
    }
  }

  removeSourceNode(node: string) {
    const current = this.sourceNodes().filter(n => n !== node);
    this.sourceNodesInput.set(current.join(', '));
  }

  removeTargetNode(node: string) {
    const current = this.targetNodes().filter(n => n !== node);
    this.targetNodesInput.set(current.join(', '));
  }

  async runReachabilityAnalysis() {
    if (!this.canRunAnalysis()) return;
    
    const sessionId = this.sessionId();
    if (!sessionId) {
      this.error.set('No active session. Please upload network data first.');
      return;
    }
    
    this.isLoading.set(true);
    this.error.set(null);
    
    try {
      console.log('Starting reachability analysis (runs on all nodes)');
      
      // Call the actual API - no query needed as it runs on all nodes
      this.networkService.performReachabilityAnalysis(sessionId).subscribe({
        next: (result) => {
          console.log('Reachability analysis completed:', result);
          
          // Store the result directly from the service
          const currentResults = this.reachabilityResults();
          this.reachabilityResults.set([...currentResults, result]);
          
          // Save to localStorage
          localStorage.setItem('reachabilityResults', JSON.stringify(this.reachabilityResults()));
          
          this.showBuilder.set(false);
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Reachability analysis failed:', error);
          this.error.set(error.message || 'Reachability analysis failed');
          this.isLoading.set(false);
        }
      });
      
    } catch (error) {
      console.error('Reachability analysis failed:', error);
      this.error.set(error instanceof Error ? error.message : 'Analysis failed');
      this.isLoading.set(false);
    }
  }

  clearResults() {
    this.reachabilityResults.set([]);
    localStorage.removeItem('reachabilityResults');
  }

  clearFilters() {
    this.filterState.set({
      searchTerm: '',
      analysisType: 'all',
      minLength: null,
      maxLength: null,
      minProbability: null,
      maxProbability: null
    });
    this.currentPage.set(1);
  }

  clearError() {
    this.error.set(null);
  }

  updateFilter(field: keyof FilterState, value: any) {
    this.filterState.update(current => ({
      ...current,
      [field]: value
    }));
    this.currentPage.set(1); // Reset to first page when filtering
  }

  sort(field: string) {
    if (this.sortField() === field) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDirection.set('desc');
    }
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  usePreSelectedNodes() {
    const nodes = this.preselectedNodes();
    if (nodes.length > 0) {
      this.sourceNodesInput.set(nodes.slice(0, Math.ceil(nodes.length / 2)).join(', '));
      this.targetNodesInput.set(nodes.slice(Math.ceil(nodes.length / 2)).join(', '));
    }
  }

  exportResults() {
    const results = this.reachabilityResults();
    const stats = this.overallStatistics();
    
    const exportData = {
      results,
      statistics: stats,
      exportTimestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reachability-analysis-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  proceedToResults() {
    this.router.navigate(['/results']);
  }

  visualizePath(path: ReachabilityPath) {
    // TODO: Implement path visualization
    console.log('Visualizing path:', path);
  }

  formatExecutionTime(time: number): string {
    if (time < 1000) {
      return `${time.toFixed(0)}ms`;
    } else {
      return `${(time / 1000).toFixed(2)}s`;
    }
  }

  formatProbability(probability: ProbabilityValue): string {
    return this.formatProbabilityValue(probability);
  }

  getNodeTypeClass(node: string): string {
    // TODO: Implement node type classification based on diamond analysis
    return 'node-default';
  }

  getPaginationPages(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  refreshAnalysis() {
    this.runReachabilityAnalysis();
  }
}