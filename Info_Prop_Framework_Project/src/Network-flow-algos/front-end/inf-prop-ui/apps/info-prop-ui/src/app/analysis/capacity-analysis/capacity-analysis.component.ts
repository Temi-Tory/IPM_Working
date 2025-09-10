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
import { CapacityAnalysisService } from '../../shared/services/capacity-analysis.service';
import { NetworkSessionService } from '../../shared/services/network-session.service';
import { ScenarioAwareComponent } from '../../shared/interfaces/analysis-component.interface';
import { ScenarioInfo, MultiScenarioCapacityResults, CapacityScenario, NetworkStructure, AnalysisResponse } from '../../shared/models/network-analysis.models';

interface CapacityScenarioInfo {
  name: string;
  path: string;
  displayName: string;
  description: string;
  networkPath: string | undefined;
  capacitiesFile: any;
}

interface CapacityResult {
  nodeId: number;
  capacity: number;
  utilization: number;
  flow: number;
  isBottleneck: boolean;
  sourceInput: number;
  targetOutput: number;
  nodeType: string;
}

interface CapacityMetrics {
  totalNodes: number;
  totalCapacity: number;
  totalFlow: number;
  networkUtilization: number;
  computationTime: number;
  bottleneckCount: number;
  sourceNodes: number;
  targetNodes: number;
  averageUtilization: number;
  maxCapacityNode: number;
  minCapacityNode: number;
}

/**
 * Network Capacity Analysis Component
 * 
 * Professional component for network capacity analysis including:
 * - Network utilization analysis and bottleneck identification
 * - Source input and target output flow calculations
 * - Multi-scenario capacity comparison support
 * - Comprehensive capacity metrics and performance visualization
 */
@Component({
  selector: 'app-capacity-analysis',
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
  templateUrl: './capacity-analysis.component.html',
  styleUrl: './capacity-analysis.component.scss'
})
export class CapacityAnalysisComponent implements OnInit, ScenarioAwareComponent {

  // **NEW: Inject services using modern Angular pattern**
  private analysisStateService = inject(AnalysisStateService);
  private fileManagerService = inject(FileManagerService);
  private capacityAnalysisService = inject(CapacityAnalysisService);
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
  
  // **LEGACY: Keep existing signals for backward compatibility**
  selectedScenario = signal<CapacityScenarioInfo | null>(null);
  capacityResults = signal<CapacityResult[]>([]);
  capacityMetrics = signal<CapacityMetrics | null>(null);
  isComputing = signal(false);
  errorMessage = signal<string | null>(null);
  
  // **FIXED: Get scenarios from FileManagerService capacity groups**
  availableScenariosComputed = computed(() => {
    const capacityGroups = this.fileManagerService.analysisGroups().capacity;
    
    return capacityGroups
      .map((group, index) => ({
        name: group.scenarioName || `capacity-${index}`, // Use scenarioName as unique identifier
        displayName: group.scenarioName ? 
          `${group.scenarioName} (Capacity Analysis)` : 
          'Capacity Analysis',
        path: group.capacitiesFile?.path || '',
        networkPath: group.networkPath,
        capacitiesFile: group.capacitiesFile,
        description: 'Network capacity and flow analysis with bottleneck identification'
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

  // **NEW: Access parsed data for actual capacity values**
  parsedData = computed(() => this.analysisStateService.parsedData());

  // **NEW: Enhanced network context with node type classification**
  nodeTypeClassification = computed(() => {
    const networkInfo = this.networkInfo();
    if (!networkInfo) return null;
    
    const totalNodes = networkInfo.totalNodes;
    const sourceNodes = networkInfo.sourceNodes.length;
    const sinkNodes = networkInfo.sinkNodes.length;
    const forkNodes = networkInfo.forkNodes.length;
    const joinNodes = networkInfo.joinNodes.length;
    const regularNodes = totalNodes - sourceNodes - sinkNodes - forkNodes - joinNodes;
    
    return {
      source: { count: sourceNodes, percentage: (sourceNodes / totalNodes * 100).toFixed(1) },
      sink: { count: sinkNodes, percentage: (sinkNodes / totalNodes * 100).toFixed(1) },
      fork: { count: forkNodes, percentage: (forkNodes / totalNodes * 100).toFixed(1) },
      join: { count: joinNodes, percentage: (joinNodes / totalNodes * 100).toFixed(1) },
      regular: { count: regularNodes, percentage: (regularNodes / totalNodes * 100).toFixed(1) }
    };
  });

  // **NEW: Filtered results based on search and node type filters**
  filteredCapacityResults = computed(() => {
    const results = this.capacityResults();
    const search = this.searchTerm().toLowerCase();
    const selectedTypes = this.selectedNodeTypes();
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
      
      return matchesSearch && matchesType;
    });
  });

  // **NEW: Paginated results**
  paginatedCapacityResults = computed(() => {
    const filtered = this.filteredCapacityResults();
    const pageSize = this.pageSize();
    const pageIndex = this.pageIndex();
    const start = pageIndex * pageSize;
    return filtered.slice(start, start + pageSize);
  });

  // Network complexity assessment
  networkComplexity = computed(() => {
    const networkInfo = this.networkInfo();
    if (!networkInfo) return 'Unknown';
    
    const totalNodes = networkInfo.totalNodes;
    const totalEdges = networkInfo.totalEdges;
    const edgeNodeRatio = totalEdges / totalNodes;
    
    if (edgeNodeRatio < 1.2) return 'Simple (Sparse Network)';
    if (edgeNodeRatio < 1.8) return 'Moderate (Balanced Network)';
    if (edgeNodeRatio < 2.5) return 'Complex (Dense Network)';
    return 'Very Complex (Highly Dense Network)';
  });

  // Table columns for results display
  displayedColumns: string[] = ['nodeId', 'capacity', 'flow', 'utilization', 'nodeType'];
  
  // **NEW: Pagination and filtering state**
  pageSize = signal(25);
  pageIndex = signal(0);
  searchTerm = signal('');
  selectedNodeTypes = signal<string[]>([]);

  ngOnInit(): void {
    console.log('⚡ CapacityAnalysisComponent initializing...');
    this.loadScenarios();
    this.loadData();
  }

  // **NEW: ScenarioAwareComponent interface implementation**
  loadScenarios(): void {
    const capacityGroups = this.fileManagerService.analysisGroups().capacity;
    this.availableScenarios = capacityGroups
      .map((group, index) => ({
        name: group.scenarioName || `capacity-${index}`,
        dataType: 'capacity' as any,
        path: group.capacitiesFile?.path || '',
        displayName: group.scenarioName ?
          `${group.scenarioName} (Capacity Analysis)` :
          'Capacity Analysis',
        analysisType: 'capacity' as const,
        description: 'Network capacity and flow analysis with bottleneck identification'
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
      // Convert ScenarioInfo to CapacityScenarioInfo for backward compatibility
      const capacityGroups = this.fileManagerService.analysisGroups().capacity;
      const matchingGroup = capacityGroups.find(group =>
        group.scenarioName === scenario.name
      );
      
      if (matchingGroup) {
        const capacityScenario: CapacityScenarioInfo = {
          name: scenario.name,
          path: scenario.path,
          displayName: scenario.displayName || scenario.name,
          description: scenario.description || '',
          networkPath: matchingGroup.networkPath,
          capacitiesFile: matchingGroup.capacitiesFile
        };
        this.selectedScenario.set(capacityScenario);
        
        // **FIX: Auto-execute analysis when scenario changes via dropdown**
        console.log('⚡ Current capacity scenario set to:', scenarioName);
        console.log('🔄 Auto-executing analysis for new scenario selection');
        this.executeCapacityAnalysis();
      }
    }
  }

  loadScenarioData(scenarioName: string): void {
    this.setCurrentScenario(scenarioName);
    
    // **FIX: Clear previous results before loading new scenario**
    this.capacityResults.set([]);
    this.capacityMetrics.set(null);
    this.errorMessage.set(null);
    
    // **FIX: Force UI update after clearing**
    this.cdr.markForCheck();
    this.cdr.detectChanges();
    
    // Trigger capacity analysis execution for the selected scenario
    this.executeCapacityAnalysis();
  }

  loadData(): void {
    this.networkData = this.analysisStateService.networkData();
    this.analysisResults = this.analysisStateService.analysisResults();
    this.isLoading = this.analysisStateService.isLoading();
    this.error = this.analysisStateService.error();
  }

  clearScenarioData(): void {
    this.scenarioResults.clear();
    this.capacityResults.set([]);
    this.capacityMetrics.set(null);
    this.errorMessage.set(null);
    console.log('🧹 Capacity analysis scenario data cleared');
  }

  /**
   * Execute network capacity analysis
   */
  async executeCapacityAnalysis(): Promise<void> {
    const scenario = this.selectedScenario();
    if (!scenario) {
      this.errorMessage.set('No scenario selected');
      return;
    }

    // **FIX: Prevent duplicate executions with state guard**
    if (this.isComputing()) {
      console.log('⚠️ Capacity analysis already in progress, skipping duplicate execution');
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

      console.log(`⚡ Executing capacity analysis for scenario: ${scenario.displayName}`);
      console.log(`📂 Network path: ${networkPath}`);
      console.log(`📊 Capacities path: ${scenario.path}`);
      console.log(`🔗 Capacities file path: ${scenario.capacitiesFile?.path}`);

      // Check that scenario has all required file paths
      if (!scenario.capacitiesFile?.path) {
        throw new Error('Missing required capacity file for analysis. Please upload capacity files first.');
      }
      
      // Validate paths are not empty
      if (!scenario.capacitiesFile.path.trim()) {
        throw new Error('Capacity file path cannot be empty. Please check uploaded files.');
      }
      
      // Get edges file path from the capacity group
      const capacityGroups = this.fileManagerService.analysisGroups().capacity;
      const matchingGroup = capacityGroups.find(group => 
        group.scenarioName === scenario.name
      );
      
      if (!matchingGroup) {
        throw new Error(`Could not find matching capacity group for scenario: ${scenario.name}`);
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
      let relativeCapacitiesPath = scenario.capacitiesFile.path;
      
      // **FIXED: Improved path stripping logic to preserve folder structure**
      const networkName = baseNetworkPath.split('/').pop() || '';
      
      // Only remove the network name prefix if it exists at the start
      if (networkName && relativeCapacitiesPath.startsWith(networkName + '/')) {
        relativeCapacitiesPath = relativeCapacitiesPath.substring(networkName.length + 1);
      }
      
      // **DEBUG: Log path transformation for debugging**
      console.log('🔧 CAPACITY PATH TRANSFORMATION DEBUG:');
      console.log(`  networkName: '${networkName}'`);
      console.log(`  original capacitiesPath: '${scenario.capacitiesFile.path}'`);
      console.log(`  transformed capacitiesPath: '${relativeCapacitiesPath}'`);
      
      // Validate all paths are non-empty
      if (!fullNetworkPath.trim()) {
        throw new Error('Network path is empty');
      }
      if (!edgesFilePath.trim()) {
        throw new Error('Edges file path is empty');
      }
      if (!relativeCapacitiesPath.trim()) {
        throw new Error('Capacities path is empty');
      }
      
      // **ENHANCED: Call capacity analysis service**
      const results = await this.capacityAnalysisService.analyzeCapacity({
        networkPath: fullNetworkPath,
        edgesFilePath: edgesFilePath,
        capacitiesPath: relativeCapacitiesPath
      }).toPromise();

      // **ENHANCED: Add comprehensive result logging for debugging**
      console.log('🔍 CAPACITY ANALYSIS API RESPONSE DEBUG:');
      console.log('  Full response:', JSON.stringify(results, null, 2));
      console.log('  Response type:', typeof results);
      console.log('  Response keys:', results ? Object.keys(results) : 'null');
      
      if (results?.capacity_result) {
        console.log('  capacity_result keys:', Object.keys(results.capacity_result));
        const capacityResult = results.capacity_result as any;
        console.log('  source_flows:', capacityResult.source_flows ? Object.keys(capacityResult.source_flows).length : 'none');
        console.log('  target_flows:', capacityResult.target_flows ? Object.keys(capacityResult.target_flows).length : 'none');
      }

      // **NEW: Store results in scenario-aware map**
      if (results?.capacity_result) {
        this.scenarioResults.set(scenario.name, results.capacity_result);
      }

      // Process and format results for display
      const processedResults = this.processCapacityResults(results);
      const metrics = this.calculateCapacityMetrics(results, processedResults);
      
      // **ENHANCED: Update signals and trigger change detection**
      this.capacityResults.set(processedResults);
      this.capacityMetrics.set(metrics);
      
      // **FIX: Force change detection to ensure UI updates**
      this.cdr.markForCheck();
      this.cdr.detectChanges();
      
      // **FIX: Additional UI update trigger after a short delay**
      setTimeout(() => {
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      }, 100);
      
      console.log(`✅ Capacity analysis completed for scenario "${scenario.name}": ${processedResults.length} nodes analyzed`);
      console.log(`⏱️ Computation time: ${metrics.computationTime.toFixed(3)}s`);
      console.log(`⚡ Network utilization: ${(metrics.networkUtilization * 100).toFixed(1)}%`);
      console.log(`🔄 UI update triggered for ${processedResults.length} capacity results`);
      
    } catch (error) {
      console.error('❌ Capacity analysis execution failed:', error);
      this.errorMessage.set(error instanceof Error ? error.message : 'Capacity analysis execution failed');
    } finally {
      this.isComputing.set(false);
    }
  }

  /**
   * Process raw capacity results into structured capacity data
   * **ENHANCED: Handle multiple API response formats and add comprehensive error handling**
   */
  private processCapacityResults(results: any): CapacityResult[] {
    console.log('🔧 Processing capacity results...');
    
    // **FIX: Handle multiple possible response structures**
    let capacityResult = null;
    
    // Try different possible response structures
    if (results?.capacity_result) {
      capacityResult = results.capacity_result;
      console.log('✅ Found capacity_result in response');
    } else if (results?.result) {
      capacityResult = results.result;
      console.log('✅ Found result in response (alternative structure)');
    } else if (results?.data) {
      capacityResult = results.data;
      console.log('✅ Found data in response (alternative structure)');
    } else if (results && typeof results === 'object' && (results.source_flows || results.target_flows)) {
      capacityResult = results;
      console.log('✅ Using direct response as capacity result');
    } else {
      console.warn('⚠️ No capacity results found in response structure:', Object.keys(results || {}));
      return [];
    }

    const networkInfo = this.networkInfo();
    if (!networkInfo) {
      console.error('❌ No network info available for processing results');
      return [];
    }
    
    const sourceNodesSet = new Set(networkInfo.sourceNodes);
    const sinkNodesSet = new Set(networkInfo.sinkNodes);
    const processedResults: CapacityResult[] = [];
    
    console.log(`📊 Processing flows for ${networkInfo.totalNodes} total nodes`);
    console.log(`📊 Source nodes: ${sourceNodesSet.size}, Sink nodes: ${sinkNodesSet.size}`);
    
    // **FIX: Use node_max_flows from raw_capacity_result to show all nodes**
    const rawCapacityResult = capacityResult.raw_capacity_result;
    if (rawCapacityResult?.node_max_flows && typeof rawCapacityResult.node_max_flows === 'object') {
      console.log(`🔄 Processing ${Object.keys(rawCapacityResult.node_max_flows).length} node max flows`);
      
      Object.entries(rawCapacityResult.node_max_flows).forEach(([nodeIdStr, flow]) => {
        try {
          const nodeId = parseInt(nodeIdStr);
          if (isNaN(nodeId)) {
            console.warn(`⚠️ Invalid node ID in node max flows: ${nodeIdStr}`);
            return;
          }
          
          const flowValue = typeof flow === 'number' ? flow : parseFloat(flow as string) || 0;
          const capacity = this.getNodeCapacity(nodeId, flowValue, capacityResult);
          const utilization = capacity > 0 ? flowValue / capacity : 0;
          
          processedResults.push({
            nodeId,
            capacity,
            utilization,
            flow: flowValue,
            isBottleneck: utilization > 0.95,
            sourceInput: sourceNodesSet.has(nodeId) ? flowValue : 0,
            targetOutput: sinkNodesSet.has(nodeId) ? flowValue : 0,
            nodeType: this.getNodeType(nodeId, networkInfo)
          });
        } catch (error) {
          console.error(`❌ Error processing node max flow for node ${nodeIdStr}:`, error);
        }
      });
    } else if (capacityResult.source_flows && typeof capacityResult.source_flows === 'object') {
      console.log(`🔄 Processing ${Object.keys(capacityResult.source_flows).length} source flows (fallback)`);
      
      Object.entries(capacityResult.source_flows).forEach(([nodeIdStr, flow]) => {
        try {
          const nodeId = parseInt(nodeIdStr);
          if (isNaN(nodeId)) {
            console.warn(`⚠️ Invalid node ID in source flows: ${nodeIdStr}`);
            return;
          }
          
          const flowValue = typeof flow === 'number' ? flow : parseFloat(flow as string) || 0;
          const capacity = this.getNodeCapacity(nodeId, flowValue, capacityResult);
          const utilization = capacity > 0 ? flowValue / capacity : 0;
          
          processedResults.push({
            nodeId,
            capacity,
            utilization,
            flow: flowValue,
            isBottleneck: utilization > 0.95,
            sourceInput: sourceNodesSet.has(nodeId) ? flowValue : 0,
            targetOutput: 0,
            nodeType: this.getNodeType(nodeId, networkInfo)
          });
        } catch (error) {
          console.error(`❌ Error processing source flow for node ${nodeIdStr}:`, error);
        }
      });
    } else {
      console.log('ℹ️ No node_max_flows or source_flows found in capacity result');
    }
    
    // **ENHANCED: Process target flows with better error handling**
    if (capacityResult.target_flows && typeof capacityResult.target_flows === 'object') {
      console.log(`🔄 Processing ${Object.keys(capacityResult.target_flows).length} target flows`);
      
      Object.entries(capacityResult.target_flows).forEach(([nodeIdStr, flow]) => {
        try {
          const nodeId = parseInt(nodeIdStr);
          if (isNaN(nodeId)) {
            console.warn(`⚠️ Invalid node ID in target flows: ${nodeIdStr}`);
            return;
          }
          
          const existingResult = processedResults.find(r => r.nodeId === nodeId);
          const flowValue = typeof flow === 'number' ? flow : parseFloat(flow as string) || 0;
          
          if (existingResult) {
            existingResult.targetOutput = flowValue;
          } else {
            const capacity = this.getNodeCapacity(nodeId);
            const utilization = capacity > 0 ? flowValue / capacity : 0;
            
            processedResults.push({
              nodeId,
              capacity,
              utilization,
              flow: flowValue,
              isBottleneck: utilization > 0.95,
              sourceInput: 0,
              targetOutput: sinkNodesSet.has(nodeId) ? flowValue : 0,
              nodeType: this.getNodeType(nodeId, networkInfo)
            });
          }
        } catch (error) {
          console.error(`❌ Error processing target flow for node ${nodeIdStr}:`, error);
        }
      });
    } else {
      console.log('ℹ️ No target_flows found in capacity result');
    }
    
    // **ENHANCED: Add remaining nodes with capacity data but no flows**
    const processedNodeIds = new Set(processedResults.map(r => r.nodeId));
    let addedNodes = 0;
    
    for (let nodeId = 1; nodeId <= networkInfo.totalNodes; nodeId++) {
      if (!processedNodeIds.has(nodeId)) {
        const capacity = this.getNodeCapacity(nodeId);
        if (capacity > 0) {
          processedResults.push({
            nodeId,
            capacity,
            utilization: 0,
            flow: 0,
            isBottleneck: false,
            sourceInput: 0,
            targetOutput: 0,
            nodeType: this.getNodeType(nodeId, networkInfo)
          });
          addedNodes++;
        }
      }
    }
    
    console.log(`✅ Added ${addedNodes} nodes with capacity but no flow data`);
    console.log(`📊 Total processed results: ${processedResults.length} nodes`);
    
    return processedResults.sort((a, b) => a.nodeId - b.nodeId);
  }

  /**
   * Calculate comprehensive capacity performance metrics
   */
  private calculateCapacityMetrics(results: any, processedResults: CapacityResult[]): CapacityMetrics {
    const networkInfo = this.networkInfo();
    const capacityResult = results?.capacity_result;
    const computationTime = capacityResult?.computation_time || 0;
    
    const totalCapacity = processedResults.reduce((sum, result) => sum + result.capacity, 0);
    const totalFlow = processedResults.reduce((sum, result) => sum + result.flow, 0);
    const networkUtilization = capacityResult?.network_utilization || (totalCapacity > 0 ? totalFlow / totalCapacity : 0);
    const bottleneckCount = processedResults.filter(r => r.isBottleneck).length;
    const averageUtilization = processedResults.length > 0 
      ? processedResults.reduce((sum, result) => sum + result.utilization, 0) / processedResults.length 
      : 0;
    
    // Find max and min capacity nodes
    const maxCapacityResult = processedResults.reduce((max, result) => 
      result.capacity > max.capacity ? result : max, processedResults[0] || { capacity: 0, nodeId: 0 });
    const minCapacityResult = processedResults.reduce((min, result) => 
      result.capacity < min.capacity && result.capacity > 0 ? result : min, 
      processedResults.find(r => r.capacity > 0) || { capacity: 0, nodeId: 0 });
    
    const sourceNodes = networkInfo?.sourceNodes.length || 0;
    const targetNodes = networkInfo?.sinkNodes.length || 0;
    
    return {
      totalNodes: processedResults.length,
      totalCapacity,
      totalFlow,
      networkUtilization,
      computationTime,
      bottleneckCount,
      sourceNodes,
      targetNodes,
      averageUtilization,
      maxCapacityNode: maxCapacityResult.nodeId,
      minCapacityNode: minCapacityResult.nodeId
    };
  }

  /**
   * Get node capacity from current analysis results or parsed data
   */
  private getNodeCapacity(nodeId: number, maxFlow?: number, capacityResults?: any): number {
    // First try to get from current capacity analysis results (most reliable)
    if (capacityResults?.raw_capacity_result?.node_capacities) {
      const nodeIdStr = nodeId.toString();
      const nodeCapacity = capacityResults.raw_capacity_result.node_capacities[nodeIdStr];
      if (nodeCapacity && nodeCapacity > 0) {
        return nodeCapacity;
      }
    }
    
    // Try to get from parsed capacity data (node capacities)
    const parsedData = this.parsedData();
    if (parsedData?.capacity?.capacities?.nodes) {
      const nodeIdStr = nodeId.toString();
      const nodeCapacity = parsedData.capacity.capacities.nodes[nodeIdStr];
      if (nodeCapacity && nodeCapacity > 0) {
        return nodeCapacity;
      }
    }
    
    // Fallback: try to get from edge capacities if node capacities not available
    if (parsedData?.capacity?.capacities?.edges) {
      const nodeIdStr = nodeId.toString();
      const edgeCapacity = parsedData.capacity.capacities.edges[nodeIdStr];
      if (edgeCapacity && edgeCapacity > 0) {
        return edgeCapacity;
      }
    }
    
    // If we have max flow data, infer capacity as slightly higher than max flow
    // This is a reasonable assumption for capacity analysis
    if (maxFlow && maxFlow > 0) {
      return Math.ceil(maxFlow * 1.2); // Assume capacity is 20% higher than current max flow
    }
    
    // Final fallback: use a reasonable default
    return 50; // Default capacity for calculation purposes
  }

  /**
   * Format capacity value for display
   */
  formatCapacity(capacity: number): string {
    if (capacity >= 1000000) {
      return (capacity / 1000000).toFixed(1) + 'M';
    } else if (capacity >= 1000) {
      return (capacity / 1000).toFixed(1) + 'K';
    } else {
      return capacity.toFixed(1);
    }
  }

  /**
   * Format utilization percentage for display
   */
  formatUtilization(utilization: number): string {
    return (utilization * 100).toFixed(1) + '%';
  }

  /**
   * Get CSS class for utilization level visualization
   */
  getUtilizationColorClass(utilization: number): string {
    if (utilization >= 0.95) return 'utilization-critical';
    if (utilization >= 0.8) return 'utilization-high';
    if (utilization >= 0.6) return 'utilization-medium';
    if (utilization >= 0.3) return 'utilization-low';
    return 'utilization-minimal';
  }

  /**
   * Get tooltip text for utilization level
   */
  getUtilizationTooltip(utilization: number): string {
    if (utilization >= 0.95) return 'Critical utilization - potential bottleneck';
    if (utilization >= 0.8) return 'High utilization - monitor for congestion';
    if (utilization >= 0.6) return 'Medium utilization - normal operation';
    if (utilization >= 0.3) return 'Low utilization - underused capacity';
    return 'Minimal utilization - spare capacity available';
  }

  /**
   * Clear current results and reset component state
   */
  clearResults(): void {
    this.capacityResults.set([]);
    this.capacityMetrics.set(null);
    this.errorMessage.set(null);
    this.clearScenarioData();
    console.log('🧹 Cleared capacity analysis results');
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
}