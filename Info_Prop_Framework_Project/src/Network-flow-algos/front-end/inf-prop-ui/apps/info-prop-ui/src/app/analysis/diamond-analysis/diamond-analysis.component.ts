import { Component, computed, inject, signal, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

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
import { MatDialogModule } from '@angular/material/dialog';
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

  // ViewChild references for table functionality
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  // State Management
  currentScenario = signal<string>('');
  selectedTab = signal<number>(0);
  
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
  displayedColumns: string[] = ['nodeCount', 'isRoot', 'riskLevel', 'complexity', 'actions'];
  
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
    if (!results || !results.raw_unique_diamonds) return [];

    return Object.entries(results.raw_unique_diamonds).map(([hash, diamond]: [string, any]) => ({
      id: hash,
      nodeCount: diamond.node_count || 0,
      isRoot: diamond.is_root_diamond || false,
      complexity: this.calculateComplexity(diamond),
      joinNodes: diamond.sub_join_nodes || [],
      sourceNodes: diamond.sub_sources || [],
      forkNodes: diamond.sub_fork_nodes || [],
      subDiamonds: [] // TODO: Extract sub-diamonds if available
    }));
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

  // Action Methods
  openDiamondDetails(pattern: DiamondPattern): void {
    // TODO: Open diamond details modal
    console.log('Opening diamond details for:', pattern);
  }
  
  openDiamondDetailsModal(pattern: DiamondPattern): void {
    console.log('Opening diamond details modal for:', pattern);
    // TODO: Implement modal opening logic
  }
  
  exploreDiamondHierarchy(pattern: DiamondPattern): void {
    console.log('Exploring diamond hierarchy for:', pattern);
    // TODO: Implement hierarchy exploration
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
  
  // Risk Pattern Methods
  getHighRiskPatterns(): Array<{id: string, level: 'low' | 'medium' | 'high', icon: string, title: string, description: string, recommendations: string[]}> {
    const summary = this.diamondSummary();
    if (!summary) return [];
    
    const riskPatterns: Array<{id: string, level: 'low' | 'medium' | 'high', icon: string, title: string, description: string, recommendations: string[]}> = [];
    
    // Single points of failure
    if (summary.singlePointsOfFailure && summary.singlePointsOfFailure > 0) {
      riskPatterns.push({
        id: 'single-points',
        level: 'high' as const,
        icon: 'error',
        title: 'Single Points of Failure Detected',
        description: `${summary.singlePointsOfFailure} critical nodes with no redundancy`,
        recommendations: ['Add redundant paths', 'Implement failover mechanisms', 'Monitor critical nodes']
      });
    }
    
    // High convergence density
    const coverage = this.coverageMetrics();
    if (coverage && coverage.percentage > 80) {
      riskPatterns.push({
        id: 'high-convergence',
        level: 'medium' as const,
        icon: 'warning',
        title: 'High Convergence Density',
        description: 'Most system nodes are involved in convergence patterns',
        recommendations: ['Consider modular decomposition', 'Review system architecture', 'Add parallel processing']
      });
    }
    
    return riskPatterns;
  }
  
  // Optimization Methods
  getParallelizationOpportunities(): number {
    // Mock calculation - would analyze diamond patterns for parallel paths
    const patterns = this.diamondPatterns();
    if (!patterns) return 0;
    return patterns.filter(p => !p.isRoot && p.nodeCount > 5).length;
  }
  
  getSinglePointsCount(): number {
    const summary = this.diamondSummary();
    return summary?.singlePointsOfFailure || 0;
  }
  
  getModularizationOpportunities(): number {
    const patterns = this.diamondPatterns();
    if (!patterns) return 0;
    return patterns.filter(p => p.isRoot && p.complexity > 30).length;
  }

  exportDiamondData(): void {
    // TODO: Export diamond analysis data
    console.log('Exporting diamond data...');
  }

  refreshAnalysis(): void {
    console.log('🔄 Refreshing diamond analysis...');
    this.loadMultiScenarioDiamondAnalysis();
  }

  viewDiamondDetails(pattern: DiamondPattern): void {
    // Alias for openDiamondDetails to match template usage
    this.openDiamondDetails(pattern);
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
}