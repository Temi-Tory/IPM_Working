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
import { FileManagerService } from '../../shared/services/file-manager.service';
import { NetworkSessionService } from '../../shared/services/network-session.service';
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
  private fileManagerService = inject(FileManagerService);
  private sessionService = inject(NetworkSessionService);
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
  
  // **FIXED: Get scenarios from FileManagerService reachability groups**
  availableScenarios = computed(() => {
    const reachabilityGroups = this.fileManagerService.analysisGroups().reachability;
    
    return reachabilityGroups
      .filter(group => group.dataType === 'float' || group.dataType === 'interval' || group.dataType === 'pbox')
      .map((group, index) => ({
        name: group.scenarioName || `${group.dataType}-${index}`, // Use scenarioName as unique identifier
        dataType: group.dataType as 'float' | 'interval' | 'pbox',
        displayName: group.scenarioName ? 
          `${group.scenarioName} (${this.getDataTypeDisplayName(group.dataType)})` : 
          this.getDataTypeDisplayName(group.dataType),
        path: group.nodePriorsFile?.path || '',
        networkPath: group.networkPath,
        nodePriorsFile: group.nodePriorsFile,
        linkProbabilitiesFile: group.linkProbabilitiesFile
      }));
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

  // **ENHANCED: Diamond summary with proper processing**
  diamondSummary = computed(() => {
    const currentResults = this.currentDiamondResults();
    const scenario = this.currentScenario();
    console.log('💎 Computing diamond summary for scenario:', scenario);
    
    if (!currentResults) return null;
    return this.diamondAnalysisService.processDiamondSummary(currentResults);
  });
  
  // **ENHANCED: Convergence insights with risk analysis**
  convergenceInsights = computed(() => {
    const currentResults = this.currentDiamondResults();
    const scenario = this.currentScenario();
    console.log('🔍 Computing convergence insights for scenario:', scenario);
    
    if (!currentResults) return [];
    return this.diamondAnalysisService.analyzeConvergencePatterns(currentResults);
  });
  
  // **ENHANCED: Coverage metrics**
  coverageMetrics = computed(() => {
    const currentResults = this.currentDiamondResults();
    const scenario = this.currentScenario();
    console.log('📊 Computing coverage metrics for scenario:', scenario);
    return this.calculateNetworkCoverage();
  });
  
  // **ENHANCED: Join node analysis**
  joinNodeAnalysis = computed(() => {
    const currentResults = this.currentDiamondResults();
    const scenario = this.currentScenario();
    console.log('🔗 Computing join node analysis for scenario:', scenario);
    
    if (!currentResults) return [];
    return this.diamondAnalysisService.analyzeJoinNodes(currentResults);
  });

  // **FIXED: Diamond patterns with proper identification**
  diamondPatterns = computed(() => {
    const currentResults = this.currentDiamondResults();
    const scenario = this.currentScenario();
    console.log('🔷 Computing diamond patterns for scenario:', scenario);
    
    if (!currentResults) return [];
    return this.diamondAnalysisService.extractDiamondPatterns(currentResults);
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
          case 'critical':
            return pattern.riskLevel === 'critical' || pattern.riskLevel === 'high';
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

  // **ENHANCED: Table configuration with meaningful columns**
  displayedColumns: string[] = ['displayId', 'nodeCount', 'isRoot', 'conditioningNodes', 'riskLevel', 'complexity', 'actions'];
  
  // **NEW: Track API calls to prevent duplicate requests**
  private hasCalledDiamondAPI = false;
  
  ngOnInit(): void {
    console.log('💎 DiamondAnalysisComponent initializing...');
    
    // Get network path and reachability scenarios
    const currentSession = this.sessionService.getCurrentSession();
    const networkPath = currentSession?.networkPath || this.analysisStateService.currentNetworkPath();
    const reachabilityGroups = this.fileManagerService.analysisGroups().reachability;
    
    if (networkPath && !this.hasCalledDiamondAPI) {
      if (reachabilityGroups.length === 0) {
        console.log('🔹 No reachability scenarios found - loading diamond analysis with default priors');
        this.loadDiamondWithDefaults(networkPath);
      } else if (reachabilityGroups.length === 1) {
        console.log('🔹 Single reachability scenario found - auto-selecting:', reachabilityGroups[0].dataType);
        this.setCurrentScenario(reachabilityGroups[0].dataType);
        this.loadDiamondWithScenario(networkPath, reachabilityGroups[0]);
      } else {
        console.log('🔹 Multiple reachability scenarios found - user needs to select:', reachabilityGroups.map(g => g.dataType));
        // Initialize with first scenario but don't auto-load until user selects
        this.setCurrentScenario(reachabilityGroups[0].dataType);
        this.showScenarioSelector(reachabilityGroups);
      }
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

  // **ENHANCED: Network coverage calculation**
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

  // **ENHANCED: UI Helper Methods with meaningful formatting**
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

  // **FIXED: Open diamond details with proper identification**
  openDiamondDetailsModal(pattern: DiamondPattern): void {
    console.log('Opening diamond details modal for:', {
      id: pattern.id,
      displayId: pattern.displayId,
      conditioningNodes: pattern.conditioningNodes,
      joinNode: pattern.joinNode
    });
    
    const dialogRef = this.dialog.open(DiamondDetailsComponent, {
      width: '90vw',
      height: '90vh',
      maxWidth: '1400px',
      maxHeight: '900px',
      data: { 
        diamondId: pattern.id,
        conditioningNodes: pattern.conditioningNodes,
        joinNode: pattern.joinNode,
        diamondHash: pattern.diamondHash
      },
      panelClass: 'diamond-details-dialog'
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      console.log('Diamond details dialog closed');
    });
  }
  
  // **ENHANCED: Filter Methods with meaningful options**
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
  
  // **ENHANCED: Risk Assessment Methods with proper analysis**
  getRiskLevel(pattern: DiamondPattern): string {
    // Use pattern's own risk level if available
    if (pattern.riskLevel) {
      return pattern.riskLevel;
    }
    
    // Otherwise calculate based on structure
    const riskScore = this.calculateRiskScore(pattern);
    if (riskScore >= 7) return 'high';
    if (riskScore >= 4) return 'medium';
    return 'low';
  }
  
  getRiskIcon(pattern: DiamondPattern): string {
    const riskLevel = pattern.riskLevel || this.getRiskLevel(pattern);
    switch (riskLevel) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'check_circle';
      default: return 'help';
    }
  }
  
  calculateRiskScore(pattern: DiamondPattern): number {
    let score = 0;
    
    // Single conditioning node = critical risk
    if (pattern.conditioningNodes.length === 1) score += 5;
    else if (pattern.conditioningNodes.length === 0) score += 3;
    
    // Node count factor (larger diamonds = higher complexity)
    score += Math.min(pattern.nodeCount / 10, 3);
    
    // Complexity factor
    score += Math.min(pattern.complexity / 20, 4);
    
    // Root diamond factor (root diamonds are more critical)
    if (pattern.isRoot) score += 2;
    
    // Join node density factor
    if (pattern.joinNodes.length > 0) {
      const joinNodeRatio = pattern.joinNodes.length / pattern.nodeCount;
      score += joinNodeRatio * 2;
    }
    
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
  
  // **ENHANCED: Pattern Analysis Methods with meaningful categorization**
  getPatternIcon(patternType: string): string {
    switch (patternType.toLowerCase()) {
      case 'convergent': return 'merge_type';
      case 'divergent': return 'call_split';
      case 'cascade': return 'waterfall_chart';
      case 'complex': return 'device_hub';
      case 'simple': return 'radio_button_unchecked';
      case 'nested': return 'account_tree';
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

  // **ENHANCED: Risk Pattern Methods with detailed structural analysis**
  getHighRiskPatterns(): Array<{
    id: string, 
    level: 'low' | 'medium' | 'high', 
    icon: string, 
    title: string, 
    description: string, 
    interpretation: string
  }> {
    const summary = this.diamondSummary();
    const results = this.currentDiamondResults();
    if (!summary || !results) return [];
    
    const riskPatterns: Array<{
      id: string, 
      level: 'low' | 'medium' | 'high', 
      icon: string, 
      title: string, 
      description: string,  
      interpretation: string
    }> = [];
    
    // Single conditioning node analysis
    const singleConditioningNodes = this.analyzeSingleConditioningNodes();
    if (singleConditioningNodes.count > 0) {
      riskPatterns.push({
        id: 'single-conditioning',
        level: 'high' as const,
        icon: 'error',
        title: 'Single Points of Failure',
        description: `${singleConditioningNodes.count} diamonds with single conditioning nodes`,
        interpretation: 'Complete failure if conditioning node fails - no redundancy available'
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
        interpretation: 'Deep nesting creates cascading failure chains - one failure can trigger multiple downstream failures'
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
        interpretation: 'High join node overlap creates system-wide bottlenecks affecting multiple diamonds'
      });
    }

    // Multiple conditioning nodes (positive indicator)
    const multipleConditioningNodes = this.analyzeMultipleConditioningNodes();
    if (multipleConditioningNodes.count > 0) {
      riskPatterns.push({
        id: 'multiple-conditioning',
        level: 'low' as const,
        icon: 'check_circle',
        title: 'Resilient Structures',
        description: `${multipleConditioningNodes.count} diamonds with multiple conditioning nodes`,
        interpretation: 'Multiple conditioning nodes provide redundancy and graceful degradation'
      });
    }
    
    return riskPatterns;
  }

  // **NEW: Detailed analysis methods for risk patterns**
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
  
  // **ENHANCED: Optimization Methods with structural insights**
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
        title: 'Well-Balanced Structures',
        description: `${symmetricDiamonds.count} symmetric diamonds detected`,
        interpretation: 'Symmetric diamonds provide good redundancy and balanced load distribution',
        count: symmetricDiamonds.count,
        recommendations: ['Maintain current structure', 'Monitor performance', 'Use as template for optimization']
      });
    }

    // Merge candidates analysis
    const mergeCandidates = this.analyzeMergeCandidates();
    if (mergeCandidates.count > 0) {
      insights.push({
        id: 'merge-candidates',
        type: 'merge',
        priority: 'medium',
        title: 'Diamond Consolidation Opportunities',
        description: `${mergeCandidates.count} diamond pairs with identical conditioning patterns`,
        interpretation: 'Diamonds with same conditioning nodes can be consolidated to reduce complexity',
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
        title: 'Critical Path Redundancy Needed',
        description: `${redundancyOpportunities.count} critical paths need backup mechanisms`,
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

  // **NEW: Structural analysis methods for optimization**
  private analyzeSymmetricDiamonds(): { count: number; diamonds: string[] } {
    const results = this.currentDiamondResults();
    if (!results?.raw_root_diamonds) return { count: 0, diamonds: [] };

    let count = 0;
    const diamonds: string[] = [];

    Object.entries(results.raw_root_diamonds).forEach(([key, diamond]) => {
      const conditioningNodes = diamond.diamond?.conditioning_nodes || [];
      const relevantNodes = diamond.diamond?.relevant_nodes || [];
      
      // Simple symmetry check: balanced distribution
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
    const patterns = this.diamondPatterns();
    const summary = this.diamondSummary();
    
    const exportData = {
      scenario: this.currentScenario(),
      summary,
      patterns: patterns.map(p => ({
        displayId: p.displayId,
        nodeCount: p.nodeCount,
        isRoot: p.isRoot,
        conditioningNodes: p.conditioningNodes,
        joinNodes: p.joinNodes,
        complexity: p.complexity,
        riskLevel: p.riskLevel || this.getRiskLevel(p)
      })),
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `diamond-analysis-${this.currentScenario()}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    console.log('✅ Diamond data exported successfully');
  }

  refreshAnalysis(): void {
    console.log('🔄 Refreshing diamond analysis...');
    this.loadMultiScenarioDiamondAnalysis();
  }

  hasInnerDiamonds(): boolean {
    const analysis = this.currentDiamondAnalysis();
    if (!analysis?.raw_unique_diamonds) return false;
    
    return Object.values(analysis.raw_unique_diamonds).some(diamond => 
      diamond.sub_diamond_structures && Object.keys(diamond.sub_diamond_structures).length > 0
    );
  }

  // **NEW: Helper methods for FileManagerService integration**
  private loadDiamondWithDefaults(networkPath: string): void {
    console.log('🔍 Loading diamond analysis with default node priors:', networkPath);
    this.hasCalledDiamondAPI = true;
    
    this.analysisStateService.loadDiamondAnalysis(networkPath).subscribe({
      next: () => {
        console.log('✅ Diamond analysis with defaults loaded successfully');
        this.updateFilterRanges();
      },
      error: (error) => {
        console.error('❌ Failed to load diamond analysis with defaults:', error);
        this.hasCalledDiamondAPI = false; // Reset on error to allow retry
      }
    });
  }

  private loadDiamondWithScenario(networkPath: string, scenario: any): void {
    console.log('🔍 Loading diamond analysis for scenario:', scenario.dataType, 'at path:', networkPath);
    this.hasCalledDiamondAPI = true;
    
    // **FIXED: Construct full paths for backend**
    // The session networkPath contains the full temp_uploads path
    // The scenario paths are relative, so we need to combine them properly
    
    // Extract the temp_uploads prefix from session network path
    const sessionNetworkPath = this.sessionService.getCurrentSession()?.networkPath || networkPath;
    console.log('📁 Session network path:', sessionNetworkPath);
    console.log('📁 Scenario network path:', scenario.networkPath);
    console.log('📁 NodePriors file path:', scenario.nodePriorsFile?.path);
    
    // **FIXED: Backend expects networkPath as full temp_uploads path and nodepriorsPath as relative**
    // Convert Windows backslashes to forward slashes for backend compatibility
    const fullNetworkPath = sessionNetworkPath.replace(/\\/g, '/');
    
    // Remove the network name prefix from nodepriors path to make it relative
    // e.g., "grid-graph/main scenario - float/file.json" → "main scenario - float/file.json"  
    let relativeNodePriorsPath = scenario.nodePriorsFile?.path || '';
    if (relativeNodePriorsPath.startsWith(scenario.networkPath + '/')) {
      relativeNodePriorsPath = relativeNodePriorsPath.substring(scenario.networkPath.length + 1);
    }
    
    console.log('🔍 Using full network path for backend:', fullNetworkPath);
    console.log('🔍 Using relative nodepriors path for backend:', relativeNodePriorsPath);
    console.log('🔍 Backend will construct full path as:', `${fullNetworkPath}/${relativeNodePriorsPath}`);
    
    // Call diamond analysis service with specific nodepriors path
    this.diamondAnalysisService.analyzeDiamonds({
      networkPath: fullNetworkPath,
      nodepriorsPath: relativeNodePriorsPath
    }).subscribe({
      next: (response) => {
        if (response.success) {
          // Update the analysis state with the diamond analysis result
          const currentState = this.analysisStateService as any;
          if (currentState.diamondAnalysisSignal) {
            currentState.diamondAnalysisSignal.set(response);
          }
          this.analysisStateService.markTabCompleted('diamonds');
          console.log('✅ Diamond analysis for scenario loaded successfully');
          this.updateFilterRanges();
        } else {
          console.error('❌ Diamond analysis failed:', response.message);
        }
      },
      error: (error) => {
        console.error('❌ Failed to load diamond analysis for scenario:', error);
        this.hasCalledDiamondAPI = false; // Reset on error to allow retry
      }
    });
  }

  private showScenarioSelector(scenarios: any[]): void {
    console.log('📋 Multiple scenarios available - user needs to select:', scenarios.map(s => s.dataType));
    // For now, auto-select first scenario - in future this could show a selection dialog
    if (scenarios.length > 0) {
      this.loadDiamondWithScenario(scenarios[0].networkPath!, scenarios[0]);
    }
  }

  private getDataTypeDisplayName(dataType: string): string {
    switch (dataType) {
      case 'float': return 'Float (Deterministic)';
      case 'interval': return 'Interval';
      case 'pbox': return 'P-Box';
      default: return dataType.charAt(0).toUpperCase() + dataType.slice(1);
    }
  }
}