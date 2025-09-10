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
import { ReachabilityAnalysisService } from '../../shared/services/reachability-analysis.service';
import { NetworkSessionService } from '../../shared/services/network-session.service';
import { ScenarioAwareComponent } from '../../shared/interfaces/analysis-component.interface';
import { ScenarioInfo, MultiScenarioReachabilityResults, ReachabilityScenario, NetworkStructure, AnalysisResponse, PboxData, IntervalData, BeliefValue } from '../../shared/models/network-analysis.models';

interface InferenceScenario {
  name: string;
  dataType: 'float' | 'interval' | 'pbox';
  path: string;
  displayName: string;
  description: string;
  networkPath: string | undefined;
  nodePriorsFile: any;
  linkProbabilitiesFile: any;
}

interface InferenceResult {
  nodeId: number;
  belief: BeliefValue;
  prior: BeliefValue;
  signalProbability: BeliefValue;
  inferenceMethod: 'Source Node' | 'Tree Propagation' | 'Inclusion-Exclusion' | 'Diamond Enumeration';
  methodColor: string;
  complexityLevel: 'Source' | 'Simple' | 'Moderate' | 'Complex';
}

interface InferenceMetrics {
  totalNodes: number;
  sourceNodes: number;
  joinNodes: number;
  diamondNodes: number;
  computationTime: number;
  averageBelief: number;
  uncertaintyRange?: { min: number; max: number };
  algorithmComplexity: string;
}

/**
 * Exact Probabilistic Reachability Inference Component
 * 
 * Professional component for exact belief propagation in DAG networks using:
 * - Mathematical Framework: Belief(N) = Prior(N) × P(N receives ≥1 signal | DAG)
 * - Inclusion-exclusion principle for join nodes: P(A ∪ B ∪ C) = S₁ + S₂ + S₃ - S₁S₂ - S₁S₃ - S₂S₃ + S₁S₂S₃
 * - Diamond-based conditional enumeration for complex dependency structures
 * - Multi-scenario support: Float64, Interval, P-box uncertainty quantification
 */
@Component({
  selector: 'app-exact-inference',
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
  templateUrl: './exact-inference.component.html',
  styleUrl: './exact-inference.component.scss'
})
export class ExactInferenceComponent implements OnInit, ScenarioAwareComponent {

  // **NEW: Inject services using modern Angular pattern**
  private analysisStateService = inject(AnalysisStateService);
  private fileManagerService = inject(FileManagerService);
  private reachabilityAnalysisService = inject(ReachabilityAnalysisService);
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
  
  // **NEW: UI state management signals**
  showScenarioComparison = signal(false);
  selectedScenariosForComparison = signal<string[]>([]);
  
  // **LEGACY: Keep existing signals for backward compatibility**
  selectedScenario = signal<InferenceScenario | null>(null);
  inferenceResults = signal<InferenceResult[]>([]);
  inferenceMetrics = signal<InferenceMetrics | null>(null);
  isComputing = signal(false);
  errorMessage = signal<string | null>(null);
  
  // **FIXED: Get scenarios from FileManagerService reachability groups**
  availableScenariosComputed = computed(() => {
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
        linkProbabilitiesFile: group.linkProbabilitiesFile,
        description: this.getScenarioDescription(group.dataType)
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

  // **NEW: Access parsed data for actual node priors**
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
  filteredInferenceResults = computed(() => {
    const results = this.inferenceResults();
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
  paginatedInferenceResults = computed(() => {
    const filtered = this.filteredInferenceResults();
    const pageSize = this.pageSize();
    const pageIndex = this.pageIndex();
    const start = pageIndex * pageSize;
    return filtered.slice(start, start + pageSize);
  });

  // Algorithm complexity assessment
  algorithmComplexity = computed(() => {
    const networkInfo = this.networkInfo();
    if (!networkInfo) return 'Unknown';
    
    const joinNodeCount = networkInfo.joinNodes.length;
    const totalNodes = networkInfo.totalNodes;
    
    if (joinNodeCount === 0) return 'Linear (Tree Structure)';
    if (joinNodeCount / totalNodes < 0.1) return 'Low (Few Join Nodes)';
    if (joinNodeCount / totalNodes < 0.3) return 'Moderate (Multiple Convergence)';
    return 'High (Complex Diamond Structures)';
  });

  // Table columns for results display (prior first, then signal probability, then nodeType last)
  displayedColumns: string[] = ['nodeId', 'prior', 'signalProbability', 'nodeType'];
  
  // **NEW: Pagination and filtering state**
  pageSize = signal(25);
  pageIndex = signal(0);
  searchTerm = signal('');
  selectedNodeTypes = signal<string[]>([]);

  ngOnInit(): void {
    console.log('🔍 ExactInferenceComponent initializing...');
    this.loadScenarios();
    this.loadData();
  }

  // **NEW: ScenarioAwareComponent interface implementation**
  loadScenarios(): void {
    const reachabilityGroups = this.fileManagerService.analysisGroups().reachability;
    this.availableScenarios = reachabilityGroups
      .filter(group => group.dataType === 'float' || group.dataType === 'interval' || group.dataType === 'pbox')
      .map((group, index) => ({
        name: group.scenarioName || `${group.dataType}-${index}`,
        dataType: group.dataType as 'float' | 'interval' | 'pbox',
        path: group.nodePriorsFile?.path || '',
        displayName: group.scenarioName ?
          `${group.scenarioName} (${this.getDataTypeDisplayName(group.dataType)})` :
          this.getDataTypeDisplayName(group.dataType),
        analysisType: 'reachability' as const,
        description: this.getScenarioDescription(group.dataType)
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
      // Convert ScenarioInfo to InferenceScenario for backward compatibility
      const reachabilityGroups = this.fileManagerService.analysisGroups().reachability;
      const matchingGroup = reachabilityGroups.find(group =>
        group.scenarioName === scenario.name && group.dataType === scenario.dataType
      );
      
      if (matchingGroup) {
        const inferenceScenario: InferenceScenario = {
          name: scenario.name,
          dataType: scenario.dataType,
          path: scenario.path,
          displayName: scenario.displayName || scenario.name,
          description: scenario.description || '',
          networkPath: matchingGroup.networkPath,
          nodePriorsFile: matchingGroup.nodePriorsFile,
          linkProbabilitiesFile: matchingGroup.linkProbabilitiesFile
        };
        this.selectedScenario.set(inferenceScenario);
      }
    }
    console.log('🎯 Current exact inference scenario set to:', scenarioName);
  }

  loadScenarioData(scenarioName: string): void {
    this.setCurrentScenario(scenarioName);
    // Trigger inference execution for the selected scenario
    this.executeInference();
  }

  loadData(): void {
    this.networkData = this.analysisStateService.networkData();
    this.analysisResults = this.analysisStateService.analysisResults();
    this.isLoading = this.analysisStateService.isLoading();
    this.error = this.analysisStateService.error();
  }

  clearScenarioData(): void {
    this.scenarioResults.clear();
    this.inferenceResults.set([]);
    this.inferenceMetrics.set(null);
    this.errorMessage.set(null);
    console.log('🧹 Exact inference scenario data cleared');
  }

  /**
   * Execute exact probabilistic reachability inference
   */
  async executeInference(): Promise<void> {
    const scenario = this.selectedScenario();
    if (!scenario) {
      this.errorMessage.set('No scenario selected');
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

      console.log(`🧮 Executing exact inference for scenario: ${scenario.displayName}`);
      console.log(`📂 Network path: ${networkPath}`);
      console.log(`📊 Data type: ${scenario.dataType}`);
      console.log(`🔗 Node priors path: ${scenario.path}`);
      console.log(`🔗 Link probabilities path: ${scenario.linkProbabilitiesFile?.path}`);
      console.log(`🔗 Node priors file path: ${scenario.nodePriorsFile?.path}`);

      // Check that scenario has all required file paths
      if (!scenario.linkProbabilitiesFile?.path || !scenario.nodePriorsFile?.path) {
        throw new Error('Missing required files for reachability analysis. Please upload network files first.');
      }
      
      // Validate paths are not empty
      if (!scenario.linkProbabilitiesFile.path.trim() || !scenario.nodePriorsFile.path.trim()) {
        throw new Error('File paths cannot be empty. Please check uploaded files.');
      }
      
      // Get edges file path from the reachability group (same pattern as analysis-state service)
      // Find the corresponding reachability group to get shared edges file
      const reachabilityGroups = this.fileManagerService.analysisGroups().reachability;
      const matchingGroup = reachabilityGroups.find(group => 
        group.scenarioName === scenario.name && group.dataType === scenario.dataType
      );
      
      if (!matchingGroup) {
        throw new Error(`Could not find matching reachability group for scenario: ${scenario.name}`);
      }
      
      // **FIXED: Construct edges file path correctly - should be just the filename, not include network path prefix**
      const edgesNetworkName = matchingGroup.networkPath?.split('/').pop() || 'network';
      let edgesFilePath = matchingGroup.edgesFile?.path || `${edgesNetworkName}.EDGES`;
      
      // **CRITICAL FIX: Remove any network path prefix from edges file path**
      // If edgesFilePath contains network path prefix, strip it to get just the filename
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
      // Convert Windows backslashes to forward slashes for backend compatibility
      const fullNetworkPath = baseNetworkPath.replace(/\\/g, '/');
      
      // Make paths relative to the network directory
      let relativeNodePriorsPath = scenario.nodePriorsFile.path;
      let relativeLinkProbsPath = scenario.linkProbabilitiesFile.path;
      
      // **FIXED: Improved path stripping logic to preserve folder structure**
      // Extract the network name from the base network path for consistent stripping
      const networkName = baseNetworkPath.split('/').pop() || '';
      
      // Only remove the network name prefix if it exists at the start, preserving folder structure
      if (networkName && relativeNodePriorsPath.startsWith(networkName + '/')) {
        relativeNodePriorsPath = relativeNodePriorsPath.substring(networkName.length + 1);
      }
      if (networkName && relativeLinkProbsPath.startsWith(networkName + '/')) {
        relativeLinkProbsPath = relativeLinkProbsPath.substring(networkName.length + 1);
      }
      
      // **ADDITIONAL FIX: Ensure paths don't have duplicate network name**
      // This handles cases where the path might still contain the network name
      const duplicatePrefix = networkName + '/' + networkName + '/';
      if (relativeNodePriorsPath.startsWith(duplicatePrefix)) {
        relativeNodePriorsPath = relativeNodePriorsPath.substring(networkName.length + 1);
      }
      if (relativeLinkProbsPath.startsWith(duplicatePrefix)) {
        relativeLinkProbsPath = relativeLinkProbsPath.substring(networkName.length + 1);
      }
      
      // **DEBUG: Log path transformation for debugging**
      console.log('🔧 PATH TRANSFORMATION DEBUG:');
      console.log(`  networkName: '${networkName}'`);
      console.log(`  original nodePriorsPath: '${scenario.nodePriorsFile.path}'`);
      console.log(`  original linkProbsPath: '${scenario.linkProbabilitiesFile.path}'`);
      console.log(`  transformed nodePriorsPath: '${relativeNodePriorsPath}'`);
      console.log(`  transformed linkProbsPath: '${relativeLinkProbsPath}'`);
      
      // 🐛 DEBUG: Final path validation before sending request
      console.log('🔍 FINAL PATH VALIDATION:');
      console.log(`  fullNetworkPath: '${fullNetworkPath}' (empty: ${!fullNetworkPath.trim()})`);
      console.log(`  edgesFilePath: '${edgesFilePath}' (empty: ${!edgesFilePath.trim()})`);
      console.log(`  relativeNodePriorsPath: '${relativeNodePriorsPath}' (empty: ${!relativeNodePriorsPath.trim()})`);
      console.log(`  relativeLinkProbsPath: '${relativeLinkProbsPath}' (empty: ${!relativeLinkProbsPath.trim()})`);
      
      // Validate all paths are non-empty
      if (!fullNetworkPath.trim()) {
        throw new Error('Network path is empty');
      }
      if (!edgesFilePath.trim()) {
        throw new Error('Edges file path is empty');
      }
      if (!relativeNodePriorsPath.trim()) {
        throw new Error('Node priors path is empty');
      }
      if (!relativeLinkProbsPath.trim()) {
        throw new Error('Link probabilities path is empty');
      }
      
      // 🐛 DEBUG: Log the complete request being sent with detailed analysis
      const request = {
        networkPath: fullNetworkPath,
        edgesFilePath: edgesFilePath,
        nodepriorsPath: relativeNodePriorsPath,
        linkprobsPath: relativeLinkProbsPath
      };
      console.log(`🔍 EXACT INFERENCE REQUEST DEBUG:`);
      console.log(`📋 Request object keys:`, Object.keys(request));
      console.log(`📋 Complete request:`, request);
      console.log(`🔍 DETAILED REQUEST ANALYSIS:`);
      console.log(`  networkPath: '${request.networkPath}' (type: ${typeof request.networkPath})`);
      console.log(`  edgesFilePath: '${request.edgesFilePath}' (type: ${typeof request.edgesFilePath})`);
      console.log(`  nodepriorsPath: '${request.nodepriorsPath}' (type: ${typeof request.nodepriorsPath})`);
      console.log(`  linkprobsPath: '${request.linkprobsPath}' (type: ${typeof request.linkprobsPath})`);
      
      // **ENHANCED: Call reachability analysis service with exact inference flag**
      const results = await this.reachabilityAnalysisService.analyzeReachability({
        networkPath: fullNetworkPath,
        edgesFilePath: edgesFilePath,
        nodepriorsPath: relativeNodePriorsPath,
        linkprobsPath: relativeLinkProbsPath,
        includeExactInference: true,
        includeDiamondAnalysis: false
      }).toPromise();

      // **NEW: Store results in scenario-aware map**
      if (results?.reachability_result) {
        this.scenarioResults.set(scenario.name, results.reachability_result);
      }

      // Process and format results for display
      const processedResults = this.processInferenceResults(results, scenario.dataType);
      const metrics = this.calculateInferenceMetrics(results, processedResults, scenario.dataType);
      
      this.inferenceResults.set(processedResults);
      this.inferenceMetrics.set(metrics);
      
      // **NEW: Update view after scenario change**
      this.cdr.detectChanges();
      
      console.log(`✅ Inference completed for scenario "${scenario.name}": ${processedResults.length} nodes computed`);
      console.log(`⏱️ Computation time: ${metrics.computationTime.toFixed(3)}s`);
      console.log(`📊 Data type: ${scenario.dataType}`);
      
    } catch (error) {
      console.error('❌ Inference execution failed:', error);
      this.errorMessage.set(error instanceof Error ? error.message : 'Inference execution failed');
    } finally {
      this.isComputing.set(false);
    }
  }

  /**
   * Process raw reachability results into structured inference data
   */
  private processInferenceResults(results: any, dataType: string): InferenceResult[] {
    if (!results?.reachability_result?.exact_inference?.beliefs) {
      console.warn('⚠️ No exact inference beliefs found in results');
      return [];
    }

    const beliefs = results.reachability_result.exact_inference.beliefs;
    const networkInfo = this.networkInfo();
    const parsedData = this.parsedData();
    
    if (!networkInfo) return [];
    
    const sourceNodesSet = new Set(networkInfo.sourceNodes);
    const joinNodesSet = new Set(networkInfo.joinNodes);
    
    // **ENHANCED: Get actual node priors from parsed data based on data type**
    const getActualNodePrior = (nodeId: number): BeliefValue => {
      if (!parsedData) {
        console.warn('⚠️ No parsed data available for node priors');
        return 0.5; // Default fallback
      }
      
      const nodeIdStr = nodeId.toString();
      
      console.log(`🔍 Looking for node ${nodeId} priors in parsed data:`, parsedData);
      console.log(`🔍 Data type: ${dataType}`);
      
      // Try to get priors from the appropriate data type section
      if (dataType === 'float' && parsedData.float?.node_priors?.nodes) {
        console.log(`🔍 Float node_priors.nodes:`, parsedData.float.node_priors.nodes);
        const prior = parsedData.float.node_priors.nodes[nodeIdStr];
        if (prior !== undefined) {
          console.log(`✅ Found float prior for node ${nodeId}: ${prior}`);
          return prior;
        }
      } else if (dataType === 'interval' && parsedData.interval?.node_priors?.nodes) {
        console.log(`🔍 Interval node_priors.nodes:`, parsedData.interval.node_priors.nodes);
        const prior = parsedData.interval.node_priors.nodes[nodeIdStr];
        if (prior !== undefined) {
          console.log(`✅ Found interval prior for node ${nodeId}:`, prior);
          return prior;
        }
      } else if (dataType === 'pbox' && parsedData.pbox?.node_priors?.nodes) {
        console.log(`🔍 Pbox node_priors.nodes:`, parsedData.pbox.node_priors.nodes);
        const prior = parsedData.pbox.node_priors.nodes[nodeIdStr];
        if (prior !== undefined) {
          console.log(`✅ Found pbox prior for node ${nodeId}:`, prior);
          return prior;
        }
      }
      
      // Fallback: try other data types if current one doesn't have priors
      console.log('🔍 Trying fallback data types...');
      if (parsedData.float?.node_priors?.nodes?.[nodeIdStr] !== undefined) {
        console.log(`✅ Found fallback float prior for node ${nodeId}:`, parsedData.float.node_priors.nodes[nodeIdStr]);
        return parsedData.float.node_priors.nodes[nodeIdStr];
      } else if (parsedData.interval?.node_priors?.nodes?.[nodeIdStr] !== undefined) {
        console.log(`✅ Found fallback interval prior for node ${nodeId}:`, parsedData.interval.node_priors.nodes[nodeIdStr]);
        return parsedData.interval.node_priors.nodes[nodeIdStr];
      } else if (parsedData.pbox?.node_priors?.nodes?.[nodeIdStr] !== undefined) {
        console.log(`✅ Found fallback pbox prior for node ${nodeId}:`, parsedData.pbox.node_priors.nodes[nodeIdStr]);
        return parsedData.pbox.node_priors.nodes[nodeIdStr];
      }
      
      console.warn(`⚠️ No prior found for node ${nodeId}, using fallback 0.5`);
      return 0.5; // Final fallback
    };
    
    // Process all node beliefs
    return Object.entries(beliefs).map(([nodeIdStr, belief]: [string, any]) => {
      const nodeId = parseInt(nodeIdStr);
      
      // **FIXED: Get the actual prior for this node from parsed data**
      const prior = getActualNodePrior(nodeId);
      
      // Determine inference method based on network structure
      let inferenceMethod: InferenceResult['inferenceMethod'];
      let methodColor: string;
      let complexityLevel: InferenceResult['complexityLevel'];
      
      if (sourceNodesSet.has(nodeId)) {
        inferenceMethod = 'Source Node';
        methodColor = 'source-method';
        complexityLevel = 'Source';
      } else if (joinNodesSet.has(nodeId)) {
        inferenceMethod = 'Inclusion-Exclusion';
        methodColor = 'inclusion-method';
        complexityLevel = this.getComplexityFromPaths(nodeId, networkInfo);
      } else {
        inferenceMethod = 'Tree Propagation';
        methodColor = 'tree-method';
        complexityLevel = 'Simple';
      }
      
      // Calculate signal probability: for source nodes it's 1.0, for others it's belief/prior
      let signalProbability: BeliefValue;
      if (sourceNodesSet.has(nodeId)) {
        signalProbability = dataType === 'float' ? 1.0 : belief;
      } else {
        // Signal probability = belief / prior (simplified for display)
        if (typeof belief === 'number' && typeof prior === 'number' && prior > 0) {
          signalProbability = belief / prior;
        } else {
          signalProbability = belief; // Fallback for complex data types
        }
      }
      
      return {
        nodeId,
        belief,
        prior,
        signalProbability,
        inferenceMethod,
        methodColor,
        complexityLevel
      };
    }).sort((a, b) => a.nodeId - b.nodeId); // Sort by node ID for consistent display
  }

  /**
   * Calculate comprehensive inference performance metrics
   */
  private calculateInferenceMetrics(results: any, processedResults: InferenceResult[], dataType: string): InferenceMetrics {
    const networkInfo = this.networkInfo();
    const computationTime = results?.reachability_result?.exact_inference?.computation_time || 0;
    
    // Calculate average belief for numeric values
    let averageBelief = 0;
    let numericCount = 0;
    let minBelief = Infinity;
    let maxBelief = -Infinity;
    
    for (const result of processedResults) {
      if (typeof result.belief === 'number') {
        averageBelief += result.belief;
        numericCount++;
        minBelief = Math.min(minBelief, result.belief);
        maxBelief = Math.max(maxBelief, result.belief);
      }
    }
    
    if (numericCount > 0) {
      averageBelief /= numericCount;
    }
    
    // Count nodes by inference method
    const sourceNodeCount = processedResults.filter(r => r.inferenceMethod === 'Source Node').length;
    const joinNodeCount = processedResults.filter(r => r.inferenceMethod === 'Inclusion-Exclusion').length;
    const diamondNodeCount = processedResults.filter(r => r.inferenceMethod === 'Diamond Enumeration').length;
    
    return {
      totalNodes: processedResults.length,
      sourceNodes: sourceNodeCount,
      joinNodes: joinNodeCount,
      diamondNodes: diamondNodeCount,
      computationTime,
      averageBelief,
      uncertaintyRange: dataType !== 'float' && minBelief !== Infinity ? 
        { min: minBelief, max: maxBelief } : undefined,
      algorithmComplexity: this.algorithmComplexity()
    };
  }

  /**
   * Determine complexity level based on network paths (simplified heuristic)
   */
  private getComplexityFromPaths(nodeId: number, networkInfo: any): InferenceResult['complexityLevel'] {
    const sourceCount = networkInfo.sourceNodes.length;
    const isJoin = networkInfo.joinNodes.includes(nodeId);
    
    if (!isJoin) return 'Simple';
    if (sourceCount <= 2) return 'Simple';
    if (sourceCount <= 5) return 'Moderate';
    return 'Complex';
  }

  /**
   * Get display name for scenario including uncertainty type
   */
  private getScenarioDisplayName(name: string, dataType: string): string {
    const typeLabel = this.getDataTypeLabel(dataType);
    return `${name} (${typeLabel})`;
  }

  /**
   * Get detailed description for each uncertainty type
   */
  private getScenarioDescription(dataType: string): string {
    switch (dataType) {
      case 'float':
        return 'Precise probabilistic inference with exact numerical values';
      case 'interval':
        return 'Interval arithmetic for bounded uncertainty propagation';
      case 'pbox':
        return 'Probability box (p-box) for comprehensive uncertainty quantification';
      default:
        return 'Probabilistic reachability analysis';
    }
  }

  /**
   * Get abbreviated data type label
   */
  private getDataTypeLabel(dataType: string): string {
    switch (dataType) {
      case 'float': return 'Precise';
      case 'interval': return 'Interval';
      case 'pbox': return 'P-box';
      default: return dataType.toUpperCase();
    }
  }

  /**
   * Get data type display name for UI (public for template access)
   */
  public getDataTypeDisplayName(dataType: string): string {
    switch (dataType) {
      case 'float': return 'Float (Precise)';
      case 'interval': return 'Interval (Bounded)';
      case 'pbox': return 'P-Box (Distributional)';
      default: return dataType.charAt(0).toUpperCase() + dataType.slice(1);
    }
  }

  /**
   * Format belief value for display based on data type
   */
  formatBelief(belief: BeliefValue): string {
    if (typeof belief === 'number') {
      return (belief * 100).toFixed(1) + '%';
    } else if (belief && typeof belief === 'object') {
      // Handle IntervalData
      if ('lower' in belief && 'upper' in belief && 'type' in belief && belief.type === 'interval') {
        return `[${(belief.lower * 100).toFixed(1)}%, ${(belief.upper * 100).toFixed(1)}%]`;
      }
      // Handle PboxData - check for scalar P-box with value property first
      else if ('type' in belief && belief.type === 'pbox') {
        const pbox = belief as any;
        // Handle scalar P-box (construction_type: 'scalar' with value property)
        if (pbox.construction_type === 'scalar' && typeof pbox.value === 'number') {
          return `P-box: ${(pbox.value * 100).toFixed(1)}%`;
        }
        // Handle complex P-box with bounds_summary
        else if (pbox.bounds_summary && pbox.mean_lower !== undefined && pbox.mean_upper !== undefined) {
          return `P-box: μ∈[${(pbox.mean_lower * 100).toFixed(1)}%, ${(pbox.mean_upper * 100).toFixed(1)}%], bounds:[${(pbox.bounds_summary.left_min * 100).toFixed(1)}%, ${(pbox.bounds_summary.right_max * 100).toFixed(1)}%]`;
        }
        // Fallback for other P-box structures
        else {
          return `P-box: ${JSON.stringify(pbox)}`;
        }
      }
      // Handle legacy interval format (backward compatibility)
      else if ('lower' in belief && 'upper' in belief) {
        return `[${((belief as any).lower * 100).toFixed(1)}%, ${((belief as any).upper * 100).toFixed(1)}%]`;
      }
    }
    return 'N/A';
  }

  /**
   * Format signal probability for display
   */
  formatSignalProbability(probability: BeliefValue): string {
    return this.formatBelief(probability);
  }

  /**
   * Get detailed P-box information for tooltip or expanded view
   */
  getPboxDetails(pbox: PboxData): string {
    return `Shape: ${pbox.shape}, Discretization: ${pbox.discretization_size}, ` +
           `Mean: [${(pbox.mean_lower * 100).toFixed(1)}%, ${(pbox.mean_upper * 100).toFixed(1)}%], ` +
           `Variance: [${pbox.var_lower.toFixed(3)}, ${pbox.var_upper.toFixed(3)}], ` +
           `Bounds: [${(pbox.bounds_summary.left_min * 100).toFixed(1)}%-${(pbox.bounds_summary.left_max * 100).toFixed(1)}%, ` +
           `${(pbox.bounds_summary.right_min * 100).toFixed(1)}%-${(pbox.bounds_summary.right_max * 100).toFixed(1)}%]`;
  }

  /**
   * Check if belief value is P-box data
   */
  isPboxData(belief: BeliefValue): boolean {
    return typeof belief === 'object' && belief !== null && 'type' in belief && belief.type === 'pbox';
  }

  /**
   * Check if belief value is interval data
   */
  isIntervalData(belief: BeliefValue): boolean {
    return typeof belief === 'object' && belief !== null &&
           (('type' in belief && belief.type === 'interval') ||
            ('lower' in belief && 'upper' in belief && !('type' in belief)));
  }

  /**
   * Get CSS class for inference method visualization
   */
  getMethodColorClass(method: string): string {
    switch (method) {
      case 'Source Node': return 'method-source';
      case 'Tree Propagation': return 'method-tree';
      case 'Inclusion-Exclusion': return 'method-inclusion';
      case 'Diamond Enumeration': return 'method-diamond';
      default: return 'method-default';
    }
  }

  /**
   * Get complexity badge color
   */
  getComplexityColor(level: string): string {
    switch (level) {
      case 'Source': return 'primary';
      case 'Simple': return 'accent';
      case 'Moderate': return 'warn';
      case 'Complex': return 'warn';
      default: return 'primary';
    }
  }

  /**
   * Get tooltip text for inference method
   */
  getMethodTooltip(method: string): string {
    switch (method) {
      case 'Source Node':
        return 'Source node - belief equals prior probability';
      case 'Tree Propagation':
        return 'Simple tree structure - direct signal propagation';
      case 'Inclusion-Exclusion':
        return 'Join node with multiple paths - uses inclusion-exclusion principle';
      case 'Diamond Enumeration':
        return 'Complex diamond structure - conditional enumeration over all states';
      default:
        return 'Unknown inference method';
    }
  }

  /**
   * Clear current results and reset component state
   */
  clearResults(): void {
    this.inferenceResults.set([]);
    this.inferenceMetrics.set(null);
    this.errorMessage.set(null);
    this.clearScenarioData();
    console.log('🧹 Cleared inference results');
  }

  // **NEW: Enhanced scenario comparison support**
  toggleScenarioComparison(): void {
    this.showScenarioComparison.update(show => !show);
  }

  addScenarioToComparison(scenarioName: string): void {
    this.selectedScenariosForComparison.update(scenarios => {
      if (!scenarios.includes(scenarioName)) {
        return [...scenarios, scenarioName];
      }
      return scenarios;
    });
  }

  removeScenarioFromComparison(scenarioName: string): void {
    this.selectedScenariosForComparison.update(scenarios =>
      scenarios.filter(s => s !== scenarioName)
    );
  }

  // **NEW: Get scenario results for comparison**
  getScenarioResult(scenarioName: string): ReachabilityScenario | null {
    return this.scenarioResults.get(scenarioName) || null;
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
   * Get node prior probability from parsed data
   */
  getNodePrior(nodeId: number): string {
    const parsedData = this.parsedData();
    const selectedScenario = this.selectedScenario();
    
    if (!parsedData || !selectedScenario) return 'N/A';
    
    const nodeIdStr = nodeId.toString();
    const dataType = selectedScenario.dataType;
    
    // Get prior from the appropriate data type section (accessing nodes property)
    let prior: BeliefValue | undefined;
    
    if (dataType === 'float' && parsedData.float?.node_priors?.nodes) {
      prior = parsedData.float.node_priors.nodes[nodeIdStr];
    } else if (dataType === 'interval' && parsedData.interval?.node_priors?.nodes) {
      prior = parsedData.interval.node_priors.nodes[nodeIdStr];
    } else if (dataType === 'pbox' && parsedData.pbox?.node_priors?.nodes) {
      prior = parsedData.pbox.node_priors.nodes[nodeIdStr];
    }
    
    // Fallback: try other data types if current one doesn't have priors
    if (prior === undefined) {
      if (parsedData.float?.node_priors?.nodes?.[nodeIdStr] !== undefined) {
        prior = parsedData.float.node_priors.nodes[nodeIdStr];
      } else if (parsedData.interval?.node_priors?.nodes?.[nodeIdStr] !== undefined) {
        prior = parsedData.interval.node_priors.nodes[nodeIdStr];
      } else if (parsedData.pbox?.node_priors?.nodes?.[nodeIdStr] !== undefined) {
        prior = parsedData.pbox.node_priors.nodes[nodeIdStr];
      }
    }
    
    return prior !== undefined ? this.formatBelief(prior) : 'N/A';
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