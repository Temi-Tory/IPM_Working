import { Component, computed, inject, signal, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatExpansionModule } from '@angular/material/expansion';
import { FormsModule } from '@angular/forms';

import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { DiamondAnalysisService } from '../../shared/services/diamond-analysis.service';
import {
  ScenarioInfo,
  DiamondAnalysisResult,
  DiamondSummary,
  ConvergenceInsight,
  JoinNodeAnalysis,
  DiamondPattern
} from '../../shared/models/network-analysis.models';

import { DiamondDetailsComponent } from '../diamond-details/diamond-details.component';

@Component({
  selector: 'app-diamond-analysis',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatTabsModule,
    MatButtonToggleModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatPaginatorModule,
    MatTooltipModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatDividerModule,
    MatSortModule,
    MatExpansionModule,
    FormsModule
  ],
  templateUrl: './diamond-analysis.component.html',
  styleUrls: ['./diamond-analysis.component.scss']
})
export class DiamondAnalysisComponent implements OnInit, AfterViewInit {
  private analysisStateService = inject(AnalysisStateService);
  private diamondAnalysisService = inject(DiamondAnalysisService);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  // ViewChild references for table functionality
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  // State Management
  currentScenario = signal<string>('');
  selectedTab = signal<number>(0);
  
  // Hierarchy Visualizer State
  multipleHierarchiesMode = signal<boolean>(false);
  singleHierarchyMode = signal<boolean>(false);
  selectedHierarchiesCount = signal<number>(0);
  
  // Filter State - Dynamic based on actual data
  minNodeCount = signal<number>(0);
  maxNodeCount = signal<number>(100);
  selectedPatternType = signal<string>('');
  
  // Table data source
  dataSource = new MatTableDataSource<DiamondPattern>([]);
  
  // Data Processing - Computed Properties
  availableScenarios = computed(() => {
    // Get scenarios from parsed data
    const parsedData = this.analysisStateService.parsedData();
    if (!parsedData) return [];
    
    const scenarios: ScenarioInfo[] = [];
    
    // Extract scenarios from parsed data structure
    if (parsedData.float) scenarios.push({
      name: 'float',
      dataType: 'float',
      displayName: 'Float Analysis',
      path: 'float'
    });
    if (parsedData.interval) scenarios.push({
      name: 'interval',
      dataType: 'interval',
      displayName: 'Interval Analysis',
      path: 'interval'
    });
    if (parsedData.pbox) scenarios.push({
      name: 'pbox',
      dataType: 'pbox',
      displayName: 'P-Box Analysis',
      path: 'pbox'
    });
    
    return scenarios;
  });

  // Get multi-scenario diamond results or fallback to single analysis
  multiScenarioResults = computed(() => this.analysisStateService.multiScenarioDiamondResults());
  
  // Get current diamond analysis data - either from multi-scenario or single analysis
  currentDiamondResults = computed(() => {
    const multiResults = this.multiScenarioResults();
    const currentScenario = this.currentScenario();
    
    // Try multi-scenario first
    if (multiResults && currentScenario) {
      return multiResults.scenarios.get(currentScenario) || null;
    }
    
    // Fallback to single diamond analysis
    const diamondAnalysis = this.analysisStateService.diamondAnalysis();
    return diamondAnalysis?.diamond_analysis || null;
  });

  // Get the full current diamond analysis object for hierarchy visualization
  currentDiamondAnalysis = computed(() => {
    const multiResults = this.multiScenarioResults();
    const currentScenario = this.currentScenario();
    
    // Try multi-scenario first
    if (multiResults && currentScenario) {
      return multiResults.scenarios.get(currentScenario) || null;
    }
    
    // Fallback to single diamond analysis
    return this.analysisStateService.diamondAnalysis()?.diamond_analysis || null;
  });

  diamondSummary = computed(() => {
    // Ensure this recomputes when scenario changes
    const currentResults = this.currentDiamondResults();
    const scenario = this.currentScenario();
    console.log('🔄 Computing diamond summary for scenario:', scenario);
    return this.processDiamondSummary();
  });
  
  convergenceInsights = computed(() => {
    // Ensure this recomputes when scenario changes
    const currentResults = this.currentDiamondResults();
    const scenario = this.currentScenario();
    console.log('🔄 Computing convergence insights for scenario:', scenario);
    return this.analyzeConvergencePatterns();
  });
  
  coverageMetrics = computed(() => {
    // Ensure this recomputes when scenario changes
    const currentResults = this.currentDiamondResults();
    const scenario = this.currentScenario();
    console.log('🔄 Computing coverage metrics for scenario:', scenario);
    return this.calculateNetworkCoverage();
  });
  
  joinNodeAnalysis = computed(() => {
    // Ensure this recomputes when scenario changes
    const currentResults = this.currentDiamondResults();
    const scenario = this.currentScenario();
    console.log('🔄 Computing join node analysis for scenario:', scenario);
    return this.analyzeJoinNodes();
  });

  // Diamond patterns computed property for reactive updates
  diamondPatterns = computed(() => {
    const currentResults = this.currentDiamondResults();
    const scenario = this.currentScenario();
    console.log('🔄 Computing diamond patterns for scenario:', scenario);
    return this.getDiamondPatterns();
  });
  
  // Filtered diamond patterns
  filteredDiamondPatterns = computed(() => {
    const patterns = this.diamondPatterns();
    if (!patterns) return [];
    
    const minNodes = this.minNodeCount();
    const maxNodes = this.maxNodeCount();
    const patternType = this.selectedPatternType();
    
    const filtered = patterns.filter(pattern => {
      // Node count filter
      if (pattern.nodeCount < minNodes || pattern.nodeCount > maxNodes) {
        return false;
      }
      
      // Pattern type filter
      if (patternType) {
        switch (patternType) {
          case 'root':
            return pattern.isRoot;
          case 'nested':
            return !pattern.isRoot;
          case 'complex':
            return pattern.complexity > 50;
          default:
            return true;
        }
      }
      
      return true;
    });
    
    // Update data source when filters change
    setTimeout(() => this.updateDataSource(), 0);
    return filtered;
  });

  // UI State
  isLoading = computed(() => this.analysisStateService.isLoading());
  error = computed(() => this.analysisStateService.error());

  // Table configuration
  displayedColumns: string[] = ['nodeCount', 'isRoot',  'complexity', 'actions'];
  
  ngOnInit(): void {
    // Initialize with first available scenario
    const scenarios = this.availableScenarios();
    if (scenarios.length > 0 && !this.currentScenario()) {
      this.setCurrentScenario(scenarios[0].name);
    }
    
    // Load multi-scenario diamond analysis if we have scenarios but no multi-scenario data
    if (scenarios.length > 0 && !this.multiScenarioResults()) {
      this.loadMultiScenarioDiamondAnalysis();
    }
    
    // Initialize dynamic filter ranges
    this.updateFilterRanges();
  }

  ngAfterViewInit(): void {
    // Connect paginator and sort to data source
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    
    // Update data source when filtered patterns change
    this.updateDataSource();
  }

  private updateDataSource(): void {
    const patterns = this.filteredDiamondPatterns();
    this.dataSource.data = patterns || [];
  }

  private updateFilterRanges(): void {
    const patterns = this.diamondPatterns();
    if (patterns && patterns.length > 0) {
      const nodeCounts = patterns.map(p => p.nodeCount);
      const minNodes = Math.min(...nodeCounts);
      const maxNodes = Math.max(...nodeCounts);
      
      // Set dynamic ranges based on actual data
      this.minNodeCount.set(minNodes);
      this.maxNodeCount.set(maxNodes);
    }
  }

  // Scenario Management
  setCurrentScenario(scenarioName: string): void {
    console.log('🔄 Changing diamond analysis scenario from', this.currentScenario(), 'to', scenarioName);
    this.currentScenario.set(scenarioName);
    this.analysisStateService.setCurrentDiamondScenario(scenarioName);
    
    // Update filter ranges for new scenario data
    setTimeout(() => {
      this.updateFilterRanges();
      this.updateDataSource();
    }, 0);
    
    // Force recomputation by accessing computed properties
    const summary = this.diamondSummary();
    const patterns = this.diamondPatterns();
    const coverage = this.coverageMetrics();
    const insights = this.convergenceInsights();
    const joinAnalysis = this.joinNodeAnalysis();
    
    console.log('✅ Scenario change complete. New data:', {
      scenario: scenarioName,
      summaryExists: !!summary,
      patternsCount: patterns?.length || 0,
      coveragePercentage: coverage?.percentage || 0
    });
  }

  // Load multi-scenario diamond analysis
  private loadMultiScenarioDiamondAnalysis(): void {
    const networkPath = this.analysisStateService.currentNetworkPath();
    if (networkPath) {
      console.log('🔄 Loading multi-scenario diamond analysis for:', networkPath);
      this.analysisStateService.loadMultiScenarioDiamondAnalysis(networkPath).subscribe({
        next: () => {
          console.log('✅ Multi-scenario diamond analysis loaded successfully');
        },
        error: (error) => {
          console.error('❌ Failed to load multi-scenario diamond analysis:', error);
        }
      });
    }
  }

  getScenarioDisplayName(scenario: ScenarioInfo): string {
    return scenario.displayName || `${scenario.name} (${scenario.dataType.toUpperCase()})`;
  }

  getDataTypeColor(dataType: string): string {
    switch (dataType) {
      case 'float': return 'primary';
      case 'interval': return 'accent';
      case 'pbox': return 'warn';
      default: return 'primary';
    }
  }

  // Tab Management
  onTabChange(index: number): void {
    this.selectedTab.set(index);
  }

  // Data Processing Methods
  // These methods are now enhanced versions above
  // processDiamondSummary and analyzeConvergencePatterns are redefined above with enhancements

  private calculateNetworkCoverage(): { covered: number; total: number; percentage: number } {
    const results = this.currentDiamondResults();
    if (!results || !results.raw_unique_diamonds) {
      return { covered: 0, total: 0, percentage: 0 };
    }

    const uniqueDiamonds = results.raw_unique_diamonds;
    const totalNodesInDiamonds = Object.values(uniqueDiamonds)
      .reduce((sum: number, diamond: any) => sum + (diamond.node_count || 0), 0);
    
    // Approximate total network size (this would ideally come from network structure)
    const approximateNetworkSize = totalNodesInDiamonds + 50; // Rough estimate
    
    return {
      covered: totalNodesInDiamonds,
      total: approximateNetworkSize,
      percentage: approximateNetworkSize > 0 ? (totalNodesInDiamonds / approximateNetworkSize) * 100 : 0
    };
  }

  private analyzeJoinNodes(): JoinNodeAnalysis[] {
    const results = this.currentDiamondResults();
    if (!results) return [];

    return this.diamondAnalysisService.analyzeJoinNodes(results);
  }

  // Diamond Pattern Processing
  getDiamondPatterns(): DiamondPattern[] {
    const results = this.currentDiamondResults();
    if (!results) return [];

    const patterns: DiamondPattern[] = [];

    // Process root diamonds (DiamondsAtNode structures)
    if (results.raw_root_diamonds) {
      Object.entries(results.raw_root_diamonds).forEach(([joinNodeStr, diamondsAtNode]: [string, any]) => {
        patterns.push({
          id: `root-${joinNodeStr}`,
          nodeCount: diamondsAtNode.diamond?.node_count || 0,
          isRoot: true,
          complexity: this.calculateComplexity(diamondsAtNode.diamond),
          joinNodes: [diamondsAtNode.join_node],
          sourceNodes: diamondsAtNode.diamond?.conditioning_nodes || [],
          forkNodes: [], // Would need to be calculated from network structure
          // NEW: Proper diamond identification fields
          conditioningNodes: diamondsAtNode.diamond?.conditioning_nodes || [],
          joinNode: diamondsAtNode.join_node,
          relevantNodes: diamondsAtNode.diamond?.relevant_nodes || [],
          edgeList: diamondsAtNode.diamond?.edgelist || [],
          subDiamonds: []
        });
      });
    }

    // Process unique diamonds (DiamondComputationData structures)
    if (results.raw_unique_diamonds) {
      Object.entries(results.raw_unique_diamonds).forEach(([hash, diamond]: [string, any]) => {
        patterns.push({
          id: `unique-${hash}`,
          nodeCount: diamond.node_count || 0,
          isRoot: diamond.is_root_diamond || false,
          complexity: this.calculateComplexity(diamond),
          joinNodes: diamond.sub_join_nodes || [],
          sourceNodes: diamond.sub_sources || [],
          forkNodes: diamond.sub_fork_nodes || [],
          // NEW: Proper diamond identification fields - now available from backend
          conditioningNodes: diamond.diamond?.conditioning_nodes || [],
          diamondHash: hash,
          relevantNodes: diamond.diamond?.relevant_nodes || [],
          edgeList: diamond.diamond?.edgelist || [],
          subDiamonds: []
        });
      });
    }

    return patterns;
  }

  private calculateComplexity(diamond: any): number {
    // Simple complexity metric based on node count and structure
    const baseComplexity = diamond.node_count;
    const structuralComplexity = diamond.sub_iteration_sets_count || 1;
    return baseComplexity * structuralComplexity;
  }

  // UI Helper Methods
  formatNumber(value: number): string {
    return new Intl.NumberFormat().format(value);
  }

  formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${milliseconds.toFixed(0)}ms`;
    }
    return `${(milliseconds / 1000).toFixed(2)}s`;
  }

  
  
  openDiamondDetailsModal(pattern: DiamondPattern): void {
    console.log('Opening diamond details modal for:', pattern);
    const dialogRef = this.dialog.open(DiamondDetailsComponent, {
      width: '90vw',
      height: '90vh',
      maxWidth: '1400px',
      maxHeight: '900px',
      data: { diamondId: pattern.id },
      panelClass: 'diamond-details-dialog'
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      console.log('Diamond details dialog closed');
    });
  }
  
  
  
  // Filter Methods
  setMinNodeCount(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = Number(target.value);
    this.minNodeCount.set(Math.max(0, value));
  }
  
  setMaxNodeCount(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = Number(target.value);
    this.maxNodeCount.set(Math.max(1, value));
  }
  
  setPatternType(value: string): void {
    this.selectedPatternType.set(value);
  }
  
  applyFilters(): void {
    // Filters are automatically applied via computed properties
    this.updateDataSource();
    console.log('Filters applied - showing', this.filteredDiamondPatterns().length, 'diamonds');
  }
  
  clearFilters(): void {
    const patterns = this.diamondPatterns();
    if (patterns && patterns.length > 0) {
      const nodeCounts = patterns.map(p => p.nodeCount);
      this.minNodeCount.set(Math.min(...nodeCounts));
      this.maxNodeCount.set(Math.max(...nodeCounts));
    } else {
      this.minNodeCount.set(0);
      this.maxNodeCount.set(100);
    }
    this.selectedPatternType.set('');
  }
  
  // Risk Assessment Methods
  getRiskLevel(pattern: DiamondPattern): string {
    const riskScore = this.calculateRiskScore(pattern);
    if (riskScore >= 7) return 'high';
    if (riskScore >= 4) return 'medium';
    return 'low';
  }
  
  getRiskIcon(pattern: DiamondPattern): string {
    const riskLevel = this.getRiskLevel(pattern);
    switch (riskLevel) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'check_circle';
      default: return 'help';
    }
  }
  
  calculateRiskScore(pattern: DiamondPattern): number {
    let score = 0;
    
    // Node count factor (larger diamonds = higher complexity)
    score += Math.min(pattern.nodeCount / 10, 3);
    
    // Complexity factor
    score += Math.min(pattern.complexity / 20, 4);
    
    // Root diamond factor (root diamonds are more critical)
    if (pattern.isRoot) score += 2;
    
    // Join node density factor
    const joinNodeRatio = pattern.joinNodes.length / pattern.nodeCount;
    score += joinNodeRatio * 2;
    
    return Math.min(score, 10);
  }
  
  getMaxComplexity(): number {
    const patterns = this.diamondPatterns();
    if (!patterns || patterns.length === 0) return 100;
    return Math.max(...patterns.map(p => p.complexity));
  }
  
  getComplexityLevel(pattern: DiamondPattern): string {
    const maxComplexity = this.getMaxComplexity();
    const ratio = pattern.complexity / maxComplexity;
    if (ratio >= 0.7) return 'high';
    if (ratio >= 0.4) return 'medium';
    return 'low';
  }
  
  // Pattern Analysis Methods
  getPatternIcon(patternType: string): string {
    switch (patternType.toLowerCase()) {
      case 'convergent': return 'merge_type';
      case 'divergent': return 'call_split';
      case 'cascade': return 'waterfall_chart';
      case 'complex': return 'device_hub';
      default: return 'diamond';
    }
  }
  
  // Node Analysis Methods
  openNodeAnalysis(nodeId: number): void {
    console.log('Opening node analysis for:', nodeId);
    // TODO: Implement node analysis modal
  }
  
  viewNodeInContext(nodeId: number): void {
    console.log('Viewing node in context:', nodeId);
    // TODO: Implement context view
  }
  
  // Enhanced Risk Pattern Methods with Clearer Interpretation
  getHighRiskPatterns(): Array<{id: string, level: 'low' | 'medium' | 'high', icon: string, title: string, description: string, interpretation: string}> {
    const summary = this.diamondSummary();
    const results = this.currentDiamondResults();
    if (!summary || !results) return [];
    
    const riskPatterns: Array<{id: string, level: 'low' | 'medium' | 'high', icon: string, title: string, description: string,  interpretation: string}> = [];
    
    // Single conditioning node analysis
    const singleConditioningNodes = this.analyzeSingleConditioningNodes();
    if (singleConditioningNodes.count > 0) {
      riskPatterns.push({
        id: 'single-conditioning',
        level: 'high' as const,
        icon: 'error',
        title: 'Single Conditioning Node Risk',
        description: `${singleConditioningNodes.count} diamonds with single conditioning nodes`,
        interpretation: 'Complete failure if that node fails - no redundancy available',
        
      });
    }

    // Deep nesting analysis
    const deepNesting = this.analyzeDeepNesting();
    if (deepNesting.maxDepth >= 3) {
      riskPatterns.push({
        id: 'deep-nesting',
        level: deepNesting.maxDepth >= 4 ? 'high' as const : 'medium' as const,
        icon: 'waterfall_chart',
        title: 'Cascading Failure Chains',
        description: `Maximum nesting depth: ${deepNesting.maxDepth} levels`,
        interpretation: 'Deep nesting creates cascading failure chains - one failure can trigger multiple downstream failures',

      });
    }

    // High join node overlap
    const joinOverlap = this.analyzeJoinNodeOverlap();
    if (joinOverlap.overlapRatio > 0.6) {
      riskPatterns.push({
        id: 'join-overlap',
        level: 'medium' as const,
        icon: 'device_hub',
        title: 'System-wide Bottlenecks',
        description: `${Math.round(joinOverlap.overlapRatio * 100)}% of diamonds share join nodes`,
        interpretation: 'High join node overlap creates system-wide bottlenecks affecting multiple diamonds',

      });
    }

    // Multiple conditioning nodes (positive indicator)
    const multipleConditioningNodes = this.analyzeMultipleConditioningNodes();
    if (multipleConditioningNodes.count > 0) {
      riskPatterns.push({
        id: 'multiple-conditioning',
        level: 'low' as const,
        icon: 'check_circle',
        title: 'Partial Degradation Capability',
        description: `${multipleConditioningNodes.count} diamonds with multiple conditioning nodes`,
        interpretation: 'Multiple conditioning nodes allow partial degradation instead of complete failure',

      });
    }
    
    return riskPatterns;
  }

  // New analysis methods for risk interpretation
  private analyzeSingleConditioningNodes(): { count: number; diamonds: string[] } {
    const results = this.currentDiamondResults();
    if (!results?.raw_root_diamonds) return { count: 0, diamonds: [] };

    let count = 0;
    const diamonds: string[] = [];

    Object.entries(results.raw_root_diamonds).forEach(([key, diamond]) => {
      if (diamond.diamond?.conditioning_nodes?.length === 1) {
        count++;
        diamonds.push(key);
      }
    });

    return { count, diamonds };
  }

  private analyzeDeepNesting(): { maxDepth: number; deepDiamonds: string[] } {
    const results = this.currentDiamondResults();
    if (!results?.raw_unique_diamonds) return { maxDepth: 0, deepDiamonds: [] };

    let maxDepth = 0;
    const deepDiamonds: string[] = [];

    Object.entries(results.raw_unique_diamonds).forEach(([key, diamond]) => {
      const depth = diamond.sub_iteration_sets_count || 0;
      if (depth > maxDepth) {
        maxDepth = depth;
      }
      if (depth >= 3) {
        deepDiamonds.push(key);
      }
    });

    return { maxDepth, deepDiamonds };
  }

  private analyzeJoinNodeOverlap(): { overlapRatio: number; sharedNodes: number[] } {
    const results = this.currentDiamondResults();
    if (!results?.raw_root_diamonds) return { overlapRatio: 0, sharedNodes: [] };

    const joinNodeCounts = new Map<number, number>();
    const totalDiamonds = Object.keys(results.raw_root_diamonds).length;

    Object.values(results.raw_root_diamonds).forEach(diamond => {
      const joinNode = diamond.join_node;
      if (joinNode !== undefined) {
        joinNodeCounts.set(joinNode, (joinNodeCounts.get(joinNode) || 0) + 1);
      }
    });

    const sharedNodes = Array.from(joinNodeCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([node, _]) => node);

    const overlapRatio = totalDiamonds > 0 ? sharedNodes.length / totalDiamonds : 0;

    return { overlapRatio, sharedNodes };
  }

  private analyzeMultipleConditioningNodes(): { count: number; diamonds: string[] } {
    const results = this.currentDiamondResults();
    if (!results?.raw_root_diamonds) return { count: 0, diamonds: [] };

    let count = 0;
    const diamonds: string[] = [];

    Object.entries(results.raw_root_diamonds).forEach(([key, diamond]) => {
      if (diamond.diamond?.conditioning_nodes?.length > 1) {
        count++;
        diamonds.push(key);
      }
    });

    return { count, diamonds };
  }
  
  // Enhanced Optimization Methods with Diamond Structure Analysis
  getOptimizationInsights(): Array<{
    id: string;
    type: 'symmetry' | 'asymmetry' | 'isolation' | 'merge' | 'redundancy';
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    interpretation: string;
    count: number;
    recommendations: string[];
  }> {
    const results = this.currentDiamondResults();
    if (!results) return [];

    const insights: Array<{
      id: string;
      type: 'symmetry' | 'asymmetry' | 'isolation' | 'merge' | 'redundancy';
      priority: 'high' | 'medium' | 'low';
      title: string;
      description: string;
      interpretation: string;
      count: number;
      recommendations: string[];
    }> = [];

    // Symmetric diamonds analysis
    const symmetricDiamonds = this.analyzeSymmetricDiamonds();
    if (symmetricDiamonds.count > 0) {
      insights.push({
        id: 'symmetric-diamonds',
        type: 'symmetry',
        priority: 'low',
        title: 'Good Redundancy Patterns',
        description: `${symmetricDiamonds.count} symmetric diamonds detected`,
        interpretation: 'Symmetric diamonds provide good redundancy and lower risk',
        count: symmetricDiamonds.count,
        recommendations: ['Maintain current structure', 'Monitor performance', 'Consider as template for other areas']
      });
    }

    // Asymmetric diamonds analysis
    const asymmetricDiamonds = this.analyzeAsymmetricDiamonds();
    if (asymmetricDiamonds.count > 0) {
      insights.push({
        id: 'asymmetric-diamonds',
        type: 'asymmetry',
        priority: 'medium',
        title: 'Load Balancing Opportunities',
        description: `${asymmetricDiamonds.count} asymmetric diamonds with unbalanced load`,
        interpretation: 'Asymmetric diamonds indicate unbalanced load distribution and optimization opportunities',
        count: asymmetricDiamonds.count,
        recommendations: ['Balance conditioning node loads', 'Redistribute paths', 'Add parallel branches']
      });
    }

    // Isolated sub-diamonds analysis
    const isolatedSubDiamonds = this.analyzeIsolatedSubDiamonds();
    if (isolatedSubDiamonds.count > 0) {
      insights.push({
        id: 'isolated-sub-diamonds',
        type: 'isolation',
        priority: 'high',
        title: 'Modularization Candidates',
        description: `${isolatedSubDiamonds.count} isolated sub-diamonds can be modularized`,
        interpretation: 'Isolated sub-diamonds can be modularized independently for better maintainability',
        count: isolatedSubDiamonds.count,
        recommendations: ['Extract as independent modules', 'Create service boundaries', 'Implement separate deployment']
      });
    }

    // Merge candidates analysis
    const mergeCandidates = this.analyzeMergeCandidates();
    if (mergeCandidates.count > 0) {
      insights.push({
        id: 'merge-candidates',
        type: 'merge',
        priority: 'medium',
        title: 'Diamond Merge Opportunities',
        description: `${mergeCandidates.count} diamond pairs with identical conditioning nodes`,
        interpretation: 'Diamonds with same conditioning nodes are merge candidates for simplification',
        count: mergeCandidates.count,
        recommendations: ['Merge similar diamonds', 'Consolidate conditioning logic', 'Reduce structural complexity']
      });
    }

    // Redundancy opportunities
    const redundancyOpportunities = this.analyzeRedundancyOpportunities();
    if (redundancyOpportunities.count > 0) {
      insights.push({
        id: 'redundancy-opportunities',
        type: 'redundancy',
        priority: 'high',
        title: 'Critical Path Redundancy',
        description: `${redundancyOpportunities.count} critical paths need redundancy`,
        interpretation: 'Adding redundancy to critical paths will improve system resilience',
        count: redundancyOpportunities.count,
        recommendations: ['Add backup paths', 'Implement failover mechanisms', 'Create redundant conditioning nodes']
      });
    }

    return insights.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // Diamond structure analysis methods
  private analyzeSymmetricDiamonds(): { count: number; diamonds: string[] } {
    const results = this.currentDiamondResults();
    if (!results?.raw_root_diamonds) return { count: 0, diamonds: [] };

    let count = 0;
    const diamonds: string[] = [];

    Object.entries(results.raw_root_diamonds).forEach(([key, diamond]) => {
      const conditioningNodes = diamond.diamond?.conditioning_nodes || [];
      const relevantNodes = diamond.diamond?.relevant_nodes || [];
      
      // Simple symmetry check: even distribution of paths
      if (conditioningNodes.length >= 2 && relevantNodes.length > conditioningNodes.length * 2) {
        const avgPathLength = relevantNodes.length / conditioningNodes.length;
        const isSymmetric = conditioningNodes.length >= 2 && avgPathLength >= 2;
        
        if (isSymmetric) {
          count++;
          diamonds.push(key);
        }
      }
    });

    return { count, diamonds };
  }

  private analyzeAsymmetricDiamonds(): { count: number; diamonds: string[] } {
    const results = this.currentDiamondResults();
    if (!results?.raw_root_diamonds) return { count: 0, diamonds: [] };

    let count = 0;
    const diamonds: string[] = [];

    Object.entries(results.raw_root_diamonds).forEach(([key, diamond]) => {
      const conditioningNodes = diamond.diamond?.conditioning_nodes || [];
      const edgeList = diamond.diamond?.edgelist || [];
      
      if (conditioningNodes.length >= 2) {
        // Check for uneven edge distribution among conditioning nodes
        const edgeDistribution = new Map<number, number>();
        conditioningNodes.forEach(node => edgeDistribution.set(node, 0));
        
        edgeList.forEach(([source, _]) => {
          if (edgeDistribution.has(source)) {
            edgeDistribution.set(source, edgeDistribution.get(source)! + 1);
          }
        });
        
        const edgeCounts = Array.from(edgeDistribution.values());
        const maxEdges = Math.max(...edgeCounts);
        const minEdges = Math.min(...edgeCounts);
        
        // Consider asymmetric if there's significant imbalance
        if (maxEdges > minEdges * 1.5) {
          count++;
          diamonds.push(key);
        }
      }
    });

    return { count, diamonds };
  }

  private analyzeIsolatedSubDiamonds(): { count: number; diamonds: string[] } {
    const results = this.currentDiamondResults();
    if (!results?.raw_unique_diamonds) return { count: 0, diamonds: [] };

    let count = 0;
    const diamonds: string[] = [];

    Object.entries(results.raw_unique_diamonds).forEach(([key, diamond]) => {
      // Check if sub-diamond has minimal external dependencies
      const subSources = diamond.sub_sources || [];
      const subJoinNodes = diamond.sub_join_nodes || [];
      
      // Consider isolated if it has clear boundaries
      if (!diamond.is_root_diamond && subSources.length <= 2 && subJoinNodes.length === 1) {
        count++;
        diamonds.push(key);
      }
    });

    return { count, diamonds };
  }

  private analyzeMergeCandidates(): { count: number; pairs: Array<[string, string]> } {
    const results = this.currentDiamondResults();
    if (!results?.raw_root_diamonds) return { count: 0, pairs: [] };

    const conditioningNodeGroups = new Map<string, string[]>();
    const pairs: Array<[string, string]> = [];

    // Group diamonds by their conditioning nodes
    Object.entries(results.raw_root_diamonds).forEach(([key, diamond]) => {
      const conditioningNodes = diamond.diamond?.conditioning_nodes || [];
      const nodeKey = conditioningNodes.sort().join(',');
      
      if (!conditioningNodeGroups.has(nodeKey)) {
        conditioningNodeGroups.set(nodeKey, []);
      }
      conditioningNodeGroups.get(nodeKey)!.push(key);
    });

    // Find groups with multiple diamonds (merge candidates)
    conditioningNodeGroups.forEach(diamonds => {
      if (diamonds.length >= 2) {
        for (let i = 0; i < diamonds.length - 1; i++) {
          pairs.push([diamonds[i], diamonds[i + 1]]);
        }
      }
    });

    return { count: pairs.length, pairs };
  }

  private analyzeRedundancyOpportunities(): { count: number; criticalPaths: string[] } {
    const results = this.currentDiamondResults();
    if (!results?.raw_root_diamonds) return { count: 0, criticalPaths: [] };

    let count = 0;
    const criticalPaths: string[] = [];

    Object.entries(results.raw_root_diamonds).forEach(([key, diamond]) => {
      const conditioningNodes = diamond.diamond?.conditioning_nodes || [];
      const nonDiamondParents = diamond.non_diamond_parents || [];
      
      // Identify critical paths with single points of failure
      if (conditioningNodes.length === 1 || nonDiamondParents.length > 0) {
        count++;
        criticalPaths.push(key);
      }
    });

    return { count, criticalPaths };
  }

  // Legacy methods for backward compatibility
  getParallelizationOpportunities(): number {
    const insights = this.getOptimizationInsights();
    return insights.filter(i => i.type === 'isolation').reduce((sum, i) => sum + i.count, 0);
  }
  
  getSinglePointsCount(): number {
    const insights = this.getOptimizationInsights();
    return insights.filter(i => i.type === 'redundancy').reduce((sum, i) => sum + i.count, 0);
  }
  
  getModularizationOpportunities(): number {
    const insights = this.getOptimizationInsights();
    return insights.filter(i => i.type === 'isolation').reduce((sum, i) => sum + i.count, 0);
  }

  // Helper methods for template
  getOptimizationIcon(type: string): string {
    switch (type) {
      case 'symmetry': return 'balance';
      case 'asymmetry': return 'tune';
      case 'isolation': return 'widgets';
      case 'merge': return 'merge';
      case 'redundancy': return 'backup';
      default: return 'auto_fix_high';
    }
  }

  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'high': return 'warn';
      case 'medium': return 'accent';
      case 'low': return 'primary';
      default: return 'primary';
    }
  }

  exportDiamondData(): void {
    // TODO: Export diamond analysis data
    console.log('Exporting diamond data...');
  }

  refreshAnalysis(): void {
    console.log('🔄 Refreshing diamond analysis...');
    this.loadMultiScenarioDiamondAnalysis();
  }


  // Enhanced diamond summary processing
  private processDiamondSummary(): DiamondSummary | null {
    const results = this.currentDiamondResults();
    if (!results) return null;

    const processed = this.diamondAnalysisService.processDiamondSummary(results);
    if (!processed) return null;
    
    // Add additional risk metrics
    const patterns = this.getDiamondPatterns();
    const singlePointsOfFailure = this.calculateSinglePointsOfFailure(patterns);
    const cascadePotential = this.assessCascadePotential(patterns);
    
    return {
      ...processed,
      singlePointsOfFailure,
      cascadePotential
    };
  }
  
  private calculateSinglePointsOfFailure(patterns: DiamondPattern[]): number {
    if (!patterns) return 0;
    // Count join nodes that are single points of convergence
    const allJoinNodes = new Set<number>();
    patterns.forEach(pattern => {
      pattern.joinNodes.forEach(nodeId => allJoinNodes.add(nodeId));
    });
    return allJoinNodes.size;
  }
  
  private assessCascadePotential(patterns: DiamondPattern[]): string {
    if (!patterns || patterns.length === 0) return 'Low';
    
    const maxComplexity = Math.max(...patterns.map(p => p.complexity));
    const avgComplexity = patterns.reduce((sum, p) => sum + p.complexity, 0) / patterns.length;
    const rootPatterns = patterns.filter(p => p.isRoot).length;
    
    if (maxComplexity > 100 && avgComplexity > 50 && rootPatterns > 5) return 'High';
    if (maxComplexity > 50 || avgComplexity > 25 || rootPatterns > 3) return 'Medium';
    return 'Low';
  }
  
  // Enhanced convergence analysis
  private analyzeConvergencePatterns(): ConvergenceInsight[] {
    const results = this.currentDiamondResults();
    if (!results) return [];

    const baseInsights = this.diamondAnalysisService.analyzeConvergencePatterns(results);
    
    // Enhance insights with risk scoring and business impact
    return baseInsights.map(insight => ({
      ...insight,
      riskScore: this.calculatePatternRiskScore(insight),
      riskLevel: this.getPatternRiskLevel(insight),
      businessImpact: this.getBusinessImpact(insight)
    }));
  }
  
  private calculatePatternRiskScore(insight: ConvergenceInsight): number {
    let score = 0;
    
    // Frequency factor
    score += Math.min(insight.frequency / 5, 3);
    
    // Node count factor  
    score += Math.min(insight.averageNodeCount / 10, 3);
    
    // Pattern type factor
    switch (insight.patternType) {
      case 'convergent': score += 2; break;
      case 'cascade': score += 3; break;
      case 'complex': score += 4; break;
      default: score += 1;
    }
    
    return Math.min(score, 10);
  }
  
  private getPatternRiskLevel(insight: ConvergenceInsight): 'low' | 'medium' | 'high' {
    const score = this.calculatePatternRiskScore(insight);
    if (score >= 7) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
  }
  
  private getBusinessImpact(insight: ConvergenceInsight): string {
    switch (insight.patternType) {
      case 'convergent':
        return 'Multiple failure paths can compound at convergence points';
      case 'cascade':
        return 'Failures can propagate through nested diamond structures';
      case 'complex':
        return 'High complexity increases maintenance costs and failure risk';
      default:
        return 'Monitor for potential optimization opportunities';
    }
  }

  

  hasInnerDiamonds(): boolean {
    const analysis = this.currentDiamondAnalysis();
    if (!analysis?.raw_unique_diamonds) return false;
    
    return Object.values(analysis.raw_unique_diamonds).some(diamond => 
      diamond.sub_diamond_structures && Object.keys(diamond.sub_diamond_structures).length > 0
    );
  }

  
}