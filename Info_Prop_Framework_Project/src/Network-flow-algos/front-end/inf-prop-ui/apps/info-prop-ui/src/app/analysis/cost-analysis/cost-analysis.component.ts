import { Component, OnInit, computed, signal, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';

import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { FileManagerService } from '../../shared/services/file-manager.service';
import { CpmAnalysisService } from '../../shared/services/cpm-analysis.service';
import { NetworkSessionService } from '../../shared/services/network-session.service';
import { ScenarioAwareComponent } from '../../shared/interfaces/analysis-component.interface';
import { ScenarioInfo, MultiScenarioCpmResults, CpmScenario, NetworkStructure, AnalysisResponse } from '../../shared/models/network-analysis.models';

interface CostScenarioInfo {
  name: string;
  path: string;
  displayName: string;
  description: string;
  networkPath: string | undefined;
  cpmInputsFile: any;
}

interface CostResult {
  nodeId: number;
  costValue: number;
  isOnCriticalPath: boolean;
  budgetAllocation: number;
  costOptimization: number;
  variance: number;
  nodeType: string;
}

interface CostMetrics {
  totalNodes: number;
  criticalPathCost: number;
  criticalPathLength: number;
  averageNodeCost: number;
  totalBudget: number;
  budgetUtilization: number;
  computationTime: number;
  sourceNodes: number;
  targetNodes: number;
  criticalNodesCount: number;
}

/**
 * Network Cost Analysis Component (CPM Cost Analysis)
 * 
 * Professional component for critical path method cost analysis including:
 * - Critical path cost calculation and budget optimization
 * - Node cost values and resource allocation analysis
 * - Multi-scenario cost-based comparison support
 * - Budget optimization and cost performance visualization
 */
@Component({
  selector: 'app-cost-analysis',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatTableModule,
    MatChipsModule,
    MatProgressBarModule,
    MatDividerModule,
    MatTooltipModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatExpansionModule,
    MatProgressSpinnerModule,
    MatBadgeModule,
    MatSlideToggleModule,
    MatPaginatorModule
  ],
  templateUrl: './cost-analysis.component.html',
  styleUrl: './cost-analysis.component.scss'
})
export class CostAnalysisComponent implements OnInit, ScenarioAwareComponent {

  // **NEW: Inject services using modern Angular pattern**
  private analysisStateService = inject(AnalysisStateService);
  private fileManagerService = inject(FileManagerService);
  private cpmAnalysisService = inject(CpmAnalysisService);
  private sessionService = inject(NetworkSessionService);
  private cdr = inject(ChangeDetectorRef);

  // **ENHANCED: ScenarioAwareComponent implementation**
  networkData: NetworkStructure | null = null;
  analysisResults: AnalysisResponse | null = null;
  isLoading = false;
  error: string | null = null;
  
  // **NEW: Multi-scenario state management**
  availableScenarios: ScenarioInfo[] = [];
  currentScenario: string | null = null;
  scenarioResults: Map<string, any> = new Map();
  
  // **COST-SPECIFIC: Keep existing signals for cost analysis**
  selectedScenario = signal<CostScenarioInfo | null>(null);
  costResults = signal<CostResult[]>([]);
  costMetrics = signal<CostMetrics | null>(null);
  isComputing = signal(false);
  errorMessage = signal<string | null>(null);
  
  // **COST-SPECIFIC: Get scenarios from FileManagerService CPM groups**
  availableScenariosComputed = computed(() => {
    const cpmGroups = this.fileManagerService.analysisGroups().cpm;
    
    return cpmGroups
      .map((group, index) => ({
        name: group.scenarioName || `cpm-cost-${index}`, // Use scenarioName as unique identifier
        displayName: group.scenarioName ? 
          `${group.scenarioName} (Cost Analysis)` : 
          'Cost Analysis',
        path: group.cpmInputsFile?.path || '',
        networkPath: group.networkPath,
        cpmInputsFile: group.cpmInputsFile,
        description: 'Critical Path Method cost-based budget optimization and resource allocation analysis'
      }));
  });

  // Network structure information for context
  networkInfo = computed(() => {
    const networkStructure = this.analysisStateService.networkData();
    if (!networkStructure) return null;
    
    return {
      totalNodes: networkStructure.total_nodes || 0,
      totalEdges: networkStructure.total_edges || 0,
      sourceNodes: networkStructure.source_nodes || [],
      joinNodes: networkStructure.join_nodes || [],
      forkNodes: networkStructure.fork_nodes || [],
      sinkNodes: networkStructure.sink_nodes || []
    };
  });

  // **NEW: Access parsed data for actual CPM values**
  parsedData = computed(() => this.analysisStateService.parsedData());

  // **COST-SPECIFIC: Enhanced network context with budget metrics**
  networkComplexity = computed(() => {
    const networkInfo = this.networkInfo();
    if (!networkInfo) return 'Unknown';
    
    const totalNodes = networkInfo.totalNodes;
    const totalEdges = networkInfo.totalEdges;
    const edgeNodeRatio = totalEdges / totalNodes;
    
    if (edgeNodeRatio < 1.2) return 'Simple Budget (Linear Cost Structure)';
    if (edgeNodeRatio < 1.8) return 'Moderate Budget (Resource Dependencies)';
    if (edgeNodeRatio < 2.5) return 'Complex Budget (Multi-Resource Allocation)';
    return 'Very Complex Budget (High Resource Interdependence)';
  });

  // **COST-SPECIFIC: Filtered results based on search and critical path filters**
  filteredCostResults = computed(() => {
    const results = this.costResults();
    const search = this.searchTerm().toLowerCase();
    const selectedTypes = this.selectedNodeTypes();
    const showOnlyCritical = this.showOnlyCriticalPath();
    const networkInfo = this.networkInfo();
    
    if (!networkInfo) return results;
    
    return results.filter(result => {
      // Search filter
      const matchesSearch = !search || result.nodeId.toString().includes(search);
      
      // Node type filter
      let matchesType = selectedTypes.length === 0;
      if (!matchesType) {
        const nodeType = this.getNodeType(result.nodeId, networkInfo);
        matchesType = selectedTypes.some(type => nodeType.includes(type));
      }
      
      // Critical path filter
      const matchesCriticalFilter = !showOnlyCritical || result.isOnCriticalPath;
      
      return matchesSearch && matchesType && matchesCriticalFilter;
    });
  });

  // **COST-SPECIFIC: Paginated results**
  paginatedCostResults = computed(() => {
    const filtered = this.filteredCostResults();
    const pageSize = this.pageSize();
    const pageIndex = this.pageIndex();
    const start = pageIndex * pageSize;
    return filtered.slice(start, start + pageSize);
  });

  // Table columns for results display
  displayedColumns: string[] = ['nodeId', 'costValue', 'budgetShare', 'criticalPath', 'nodeType'];
  
  // **COST-SPECIFIC: Pagination and filtering state**
  pageSize = signal(25);
  pageIndex = signal(0);
  searchTerm = signal('');
  selectedNodeTypes = signal<string[]>([]);
  showOnlyCriticalPath = signal(false);

  ngOnInit(): void {
    console.log('💰 CostAnalysisComponent initializing...');
    this.loadScenarios();
    this.loadData();
  }

  // **NEW: ScenarioAwareComponent interface implementation**
  loadScenarios(): void {
    const cpmGroups = this.fileManagerService.analysisGroups().cpm;
    this.availableScenarios = cpmGroups
      .map((group: any, index: number) => ({
        name: group.scenarioName || `cpm-cost-${index}`,
        dataType: 'cpm' as any,
        path: group.cpmInputsFile?.path || '',
        displayName: group.scenarioName ?
          `${group.scenarioName} (Cost Analysis)` :
          'Cost Analysis',
        analysisType: 'cpm' as const,
        description: 'Critical Path Method cost-based budget optimization and resource allocation analysis'
      }));

    // Auto-select first scenario if available
    if (this.availableScenarios.length > 0 && !this.currentScenario) {
      this.setCurrentScenario(this.availableScenarios[0].name);
    }
  }

  setCurrentScenario(scenarioName: string): void {
    this.currentScenario = scenarioName;
    const scenario = this.availableScenarios.find(s => s.name === scenarioName);
    if (scenario) {
      // Convert ScenarioInfo to CostScenarioInfo for backward compatibility
      const cpmGroups = this.fileManagerService.analysisGroups().cpm;
      const matchingGroup = cpmGroups.find(group =>
        group.scenarioName === scenario.name
      );
      
      if (matchingGroup) {
        const costScenario: CostScenarioInfo = {
          name: scenario.name,
          path: scenario.path,
          displayName: scenario.displayName || scenario.name,
          description: scenario.description || '',
          networkPath: matchingGroup.networkPath,
          cpmInputsFile: matchingGroup.cpmInputsFile
        };
        this.selectedScenario.set(costScenario);
        
        // **FIX: Auto-execute analysis when scenario changes via dropdown**
        console.log('💰 Current cost analysis scenario set to:', scenarioName);
        console.log('🔄 Auto-executing cost analysis for new scenario selection');
        this.executeCostAnalysis();
      }
    }
  }

  loadScenarioData(scenarioName: string): void {
    this.setCurrentScenario(scenarioName);
    
    // **FIX: Clear previous results before loading new scenario**
    this.costResults.set([]);
    this.costMetrics.set(null);
    this.errorMessage.set(null);
    
    // **FIX: Force UI update after clearing**
    this.cdr.markForCheck();
    this.cdr.detectChanges();
    
    // Trigger cost analysis execution for the selected scenario
    this.executeCostAnalysis();
  }

  loadData(): void {
    this.networkData = this.analysisStateService.networkData();
    this.analysisResults = this.analysisStateService.analysisResults();
    this.isLoading = this.analysisStateService.isLoading();
    this.error = this.analysisStateService.error();
  }

  clearScenarioData(): void {
    this.scenarioResults.clear();
    this.costResults.set([]);
    this.costMetrics.set(null);
    this.errorMessage.set(null);
    console.log('🧹 Cost analysis scenario data cleared');
  }

  /**
   * Execute network cost analysis using CPM
   */
  async executeCostAnalysis(): Promise<void> {
    const scenario = this.selectedScenario();
    if (!scenario) {
      this.errorMessage.set('No scenario selected');
      return;
    }

    // **FIX: Prevent duplicate executions with state guard**
    if (this.isComputing()) {
      console.log('⚠️ Cost analysis already in progress, skipping duplicate execution');
      return;
    }

    this.isComputing.set(true);
    this.errorMessage.set(null);
    
    try {
      // Use networkPath from scenario if available, otherwise from session
      let networkPath = scenario.networkPath;
      if (!networkPath) {
        const currentSession = this.sessionService.getCurrentSession();
        networkPath = currentSession?.networkPath;
      }
      
      if (!networkPath) {
        throw new Error('No network path available');
      }

      console.log(`💰 Executing cost analysis for scenario: ${scenario.displayName}`);
      console.log(`📂 Network path: ${networkPath}`);
      console.log(`💸 CPM inputs path: ${scenario.path}`);
      console.log(`🔗 CPM inputs file path: ${scenario.cpmInputsFile?.path}`);

      // Check that scenario has all required file paths
      if (!scenario.cpmInputsFile?.path) {
        throw new Error('Missing required CPM inputs file for cost analysis. Please upload CPM files first.');
      }
      
      // Validate paths are not empty
      if (!scenario.cpmInputsFile.path.trim()) {
        throw new Error('CPM inputs file path cannot be empty. Please check uploaded files.');
      }
      
      // Get edges file path from the CPM group
      const cpmGroups = this.fileManagerService.analysisGroups().cpm;
      const matchingGroup = cpmGroups.find(group => 
        group.scenarioName === scenario.name
      );
      
      if (!matchingGroup) {
        throw new Error(`Could not find matching CPM group for scenario: ${scenario.name}`);
      }
      
      // **FIXED: Construct edges file path correctly**
      const edgesNetworkName = matchingGroup.networkPath?.split('/').pop() || 'network';
      let edgesFilePath = matchingGroup.edgesFile?.path || `${edgesNetworkName}.EDGES`;
      
      // **CRITICAL FIX: Remove any network path prefix from edges file path**
      if (edgesFilePath.includes('/')) {
        edgesFilePath = edgesFilePath.split('/').pop() || `${edgesNetworkName}.EDGES`;
      }
      
      console.log(`📊 Final edges file path: ${edgesFilePath}`);
      
      // **IMPROVED: Use session network path for consistency with backend expectations**
      const sessionNetworkPath = this.sessionService.getCurrentSession()?.networkPath;
      const baseNetworkPath = sessionNetworkPath || matchingGroup.networkPath;
      
      if (!baseNetworkPath) {
        throw new Error('No valid network path available for analysis');
      }
      
      // **IMPROVED: Construct relative paths for backend compatibility**
      const fullNetworkPath = baseNetworkPath.replace(/\\/g, '/');
      
      // Make paths relative to the network directory
      let relativeCpmPath = scenario.cpmInputsFile.path;
      
      // **FIXED: Improved path stripping logic to preserve folder structure**
      const networkName = baseNetworkPath.split('/').pop() || '';
      
      // Only remove the network name prefix if it exists at the start
      if (networkName && relativeCpmPath.startsWith(networkName + '/')) {
        relativeCpmPath = relativeCpmPath.substring(networkName.length + 1);
      }
      
      // **DEBUG: Log path transformation for debugging**
      console.log('🔧 COST ANALYSIS PATH TRANSFORMATION DEBUG:');
      console.log(`  networkName: '${networkName}'`);
      console.log(`  original cmpPath: '${scenario.cpmInputsFile.path}'`);
      console.log(`  transformed cpmPath: '${relativeCpmPath}'`);
      
      // Validate all paths are non-empty
      if (!fullNetworkPath.trim()) {
        throw new Error('Network path is empty');
      }
      if (!edgesFilePath.trim()) {
        throw new Error('Edges file path is empty');
      }
      if (!relativeCpmPath.trim()) {
        throw new Error('CPM inputs path is empty');
      }
      
      // **COST-SPECIFIC: Call CPM analysis service**
      const results = await this.cpmAnalysisService.analyzeCpm({
        networkPath: fullNetworkPath,
        edgesFilePath: edgesFilePath,
        cpmPath: relativeCpmPath
      }).toPromise();

      // **ENHANCED: Add comprehensive result logging for debugging**
      console.log('🔍 COST ANALYSIS API RESPONSE DEBUG:');
      console.log('  Full response:', JSON.stringify(results, null, 2));
      console.log('  Response type:', typeof results);
      console.log('  Response keys:', results ? Object.keys(results) : 'null');
      
      if (results?.cmp_result) {
        console.log('  cmp_result keys:', Object.keys(results.cmp_result));
        const cmpResult = results.cmp_result as any;
        if (cmpResult.cost_result) {
          console.log('  cost_result keys:', Object.keys(cmpResult.cost_result));
          console.log('  node_values count:', cmpResult.cost_result.node_values ? Object.keys(cmpResult.cost_result.node_values).length : 'none');
          console.log('  critical_nodes count:', cmpResult.cost_result.critical_nodes ? cmpResult.cost_result.critical_nodes.length : 'none');
        }
      }

      // **COST-SPECIFIC: Store results in scenario-aware map**
      if (results?.cmp_result) {
        this.scenarioResults.set(scenario.name, results.cmp_result);
      }

      // Process and format results for display (COST-FOCUSED)
      const processedResults = this.processCostResults(results);
      const metrics = this.calculateCostMetrics(results, processedResults);
      
      // **ENHANCED: Update signals and trigger change detection**
      this.costResults.set(processedResults);
      this.costMetrics.set(metrics);
      
      // **FIX: Force change detection to ensure UI updates**
      this.cdr.markForCheck();
      this.cdr.detectChanges();
      
      // **FIX: Additional UI update trigger after a short delay**
      setTimeout(() => {
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      }, 100);
      
      console.log(`✅ Cost analysis completed for scenario "${scenario.name}": ${processedResults.length} nodes analyzed`);
      console.log(`💸 Computation time: ${metrics.computationTime.toFixed(3)}s`);
      console.log(`🎯 Critical path cost: ${this.formatCurrency(metrics.criticalPathCost)}`);
      console.log(`📊 Critical path nodes: ${metrics.criticalNodesCount}`);
      console.log(`🔄 UI update triggered for ${processedResults.length} cost results`);
      
    } catch (error) {
      console.error('❌ Cost analysis execution failed:', error);
      this.errorMessage.set(error instanceof Error ? error.message : 'Cost analysis execution failed');
    } finally {
      this.isComputing.set(false);
    }
  }

  /**
   * Process raw CPM results into structured cost data (COST-FOCUSED)
   * **ENHANCED: Handle multiple API response formats and add comprehensive error handling**
   */
  private processCostResults(results: any): CostResult[] {
    console.log('🔧 Processing cost results...');
    
    // **FIX: Handle multiple possible response structures**
    let costResult = null;
    
    // Try different possible response structures
    if (results?.cmp_result?.cost_result) {
      costResult = results.cmp_result.cost_result;
      console.log('✅ Found cmp_result.cost_result in response');
    } else if (results?.cpm_result?.cost_result) {
      costResult = results.cpm_result.cost_result;
      console.log('✅ Found cpm_result.cost_result in response (alternative structure)');
    } else if (results?.result?.cost_result) {
      costResult = results.result.cost_result;
      console.log('✅ Found result.cost_result in response (alternative structure)');
    } else if (results?.cost_result) {
      costResult = results.cost_result;
      console.log('✅ Found direct cost_result in response');
    } else if (results && typeof results === 'object' && (results.node_values || results.critical_nodes)) {
      costResult = results;
      console.log('✅ Using direct response as cost result');
    } else {
      console.warn('⚠️ No cost results found in CPM response structure:', Object.keys(results || {}));
      return [];
    }

    const networkInfo = this.networkInfo();
    if (!networkInfo) {
      console.error('❌ No network info available for processing cost results');
      return [];
    }
    
    const criticalNodesSet = new Set(costResult.critical_nodes || []);
    const nodeValues = costResult.node_values || {};
    const criticalValue = costResult.critical_value || 0;
    
    console.log(`📊 Processing cost data for ${Object.keys(nodeValues).length} nodes`);
    console.log(`🎯 Critical nodes: ${criticalNodesSet.size}, Critical value: ${criticalValue}`);
    
    const processedResults: CostResult[] = [];
    
    // **ENHANCED: Calculate total budget with error handling**
    let totalBudget = 0;
    try {
      totalBudget = Object.values(nodeValues).reduce((sum: number, value) => {
        const numValue = typeof value === 'number' ? value : parseFloat(value as string) || 0;
        return sum + numValue;
      }, 0);
      console.log(`💰 Total budget calculated: ${totalBudget}`);
    } catch (error) {
      console.error('❌ Error calculating total budget:', error);
    }
    
    // **ENHANCED: Process all nodes with cost values with better error handling**
    Object.entries(nodeValues).forEach(([nodeIdStr, costValue]) => {
      try {
        const nodeId = parseInt(nodeIdStr);
        if (isNaN(nodeId)) {
          console.warn(`⚠️ Invalid node ID in cost values: ${nodeIdStr}`);
          return;
        }
        
        const isOnCriticalPath = criticalNodesSet.has(nodeId);
        const costValueNum = typeof costValue === 'number' ? costValue : parseFloat(costValue as string) || 0;
        
        // Calculate budget allocation percentage
        const budgetAllocation = totalBudget > 0 ? (costValueNum / totalBudget) * 100 : 0;
        
        // Calculate cost optimization potential (variance from critical path)
        const costOptimization = isOnCriticalPath ? 0 : Math.max(0, criticalValue - costValueNum);
        
        // Calculate cost variance
        const averageCost = totalBudget / Object.keys(nodeValues).length;
        const variance = Math.abs(costValueNum - averageCost);
        
        processedResults.push({
          nodeId,
          costValue: costValueNum,
          isOnCriticalPath,
          budgetAllocation,
          costOptimization,
          variance,
          nodeType: this.getNodeType(nodeId, networkInfo)
        });
      } catch (error) {
        console.error(`❌ Error processing cost data for node ${nodeIdStr}:`, error);
      }
    });
    
    console.log(`✅ Processed ${processedResults.length} cost results`);
    return processedResults.sort((a, b) => a.nodeId - b.nodeId);
  }

  /**
   * Calculate comprehensive cost performance metrics
   */
  private calculateCostMetrics(results: any, processedResults: CostResult[]): CostMetrics {
    const networkInfo = this.networkInfo();
    
    // **FIX: Handle multiple possible response structures for cost result**
    let costResult = null;
    let computationTime = 0;
    
    if (results?.cmp_result?.cost_result) {
      costResult = results.cmp_result.cost_result;
      computationTime = results.cmp_result.computation_time || 0;
    } else if (results?.cpm_result?.cost_result) {
      costResult = results.cpm_result.cost_result;
      computationTime = results.cpm_result.computation_time || 0;
    } else if (results?.cost_result) {
      costResult = results.cost_result;
      computationTime = results.computation_time || 0;
    }
    
    const criticalPathCost = costResult?.critical_value || 0;
    const criticalNodesCount = costResult?.critical_nodes?.length || 0;
    const totalCostValues = processedResults.reduce((sum, result) => sum + result.costValue, 0);
    const averageNodeCost = processedResults.length > 0
      ? totalCostValues / processedResults.length
      : 0;
    
    const totalBudget = totalCostValues;
    const budgetUtilization = criticalPathCost > 0 ? (criticalPathCost / totalBudget) * 100 : 0;
    
    const sourceNodes = networkInfo?.sourceNodes.length || 0;
    const targetNodes = networkInfo?.sinkNodes.length || 0;
    
    console.log(`💰 Cost metrics calculated: Critical path cost: £${criticalPathCost}, Total budget: £${totalBudget}`);
    
    return {
      totalNodes: processedResults.length,
      criticalPathCost,
      criticalPathLength: criticalNodesCount,
      averageNodeCost,
      totalBudget,
      budgetUtilization,
      computationTime,
      sourceNodes,
      targetNodes,
      criticalNodesCount
    };
  }

  /**
   * Format currency values for display (using British Pounds)
   */
  formatCurrency(costValue: number): string {
    if (costValue >= 1000000) {
      return `£${(costValue / 1000000).toFixed(1)}M`;
    } else if (costValue >= 1000) {
      return `£${(costValue / 1000).toFixed(1)}K`;
    } else {
      return `£${costValue.toFixed(2)}`;
    }
  }

  /**
   * Format budget percentage for display
   */
  formatBudgetShare(percentage: number): string {
    return `${percentage.toFixed(1)}%`;
  }

  /**
   * Get CSS class for critical path visualization
   */
  getCriticalPathColorClass(isOnCriticalPath: boolean): string {
    return isOnCriticalPath ? 'critical-path' : 'non-critical-path';
  }

  /**
   * Get tooltip text for critical path status
   */
  getCriticalPathTooltip(isOnCriticalPath: boolean): string {
    return isOnCriticalPath 
      ? 'Critical Path - affects total project cost'
      : 'Non-Critical Path - has cost optimization potential';
  }

  /**
   * Clear current results and reset component state
   */
  clearResults(): void {
    this.costResults.set([]);
    this.costMetrics.set(null);
    this.errorMessage.set(null);
    this.clearScenarioData();
    console.log('🧹 Cleared cost analysis results');
  }

  // **NEW: Check if scenario has results**
  hasScenarioResults(scenarioName: string): boolean {
    return this.scenarioResults.has(scenarioName);
  }

  /**
   * Get node type based on network structure from AnalysisStateService
   */
  getNodeType(nodeId: number, networkInfo: any): string {
    const types: string[] = [];
    
    if (networkInfo.sourceNodes.includes(nodeId)) types.push('Source');
    if (networkInfo.sinkNodes.includes(nodeId)) types.push('Sink');
    if (networkInfo.forkNodes.includes(nodeId)) types.push('Fork');
    if (networkInfo.joinNodes.includes(nodeId)) types.push('Join');
    
    return types.length > 0 ? types.join(' + ') : 'Regular';
  }

  /**
   * Event handlers for pagination and filtering
   */
  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  onSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchTerm.set(target.value);
    this.pageIndex.set(0); // Reset to first page
  }

  onNodeTypeFilter(types: string[]): void {
    this.selectedNodeTypes.set(types);
    this.pageIndex.set(0); // Reset to first page
  }

  onCriticalPathFilter(showOnly: boolean): void {
    this.showOnlyCriticalPath.set(showOnly);
    this.pageIndex.set(0); // Reset to first page
  }
}