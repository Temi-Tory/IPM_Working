import { Component, OnInit, computed, signal } from '@angular/core';
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
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatBadgeModule } from '@angular/material/badge';

import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { FileManagerService } from '../../shared/services/file-manager.service';
import { ReachabilityAnalysisService } from '../../shared/services/reachability-analysis.service';
import { NetworkSessionService } from '../../shared/services/network-session.service';

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
  belief: number | { lower: number; upper: number };
  prior: number | { lower: number; upper: number };
  signalProbability: number | { lower: number; upper: number };
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
    MatExpansionModule,
    MatProgressSpinnerModule,
    MatBadgeModule
  ],
  templateUrl: './exact-inference.component.html',
  styleUrl: './exact-inference.component.scss'
})
export class ExactInferenceComponent implements OnInit {

  // Reactive signals for modern Angular patterns
  selectedScenario = signal<InferenceScenario | null>(null);
  inferenceResults = signal<InferenceResult[]>([]);
  inferenceMetrics = signal<InferenceMetrics | null>(null);
  isComputing = signal(false);
  errorMessage = signal<string | null>(null);
  
  // **FIXED: Get scenarios from FileManagerService reachability groups like diamond analysis**
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

  // Table columns for results display
  displayedColumns: string[] = ['nodeId', 'belief', 'signalProbability', 'inferenceMethod', 'complexityLevel'];

  constructor(
    private analysisStateService: AnalysisStateService,
    private fileManagerService: FileManagerService,
    private reachabilityAnalysisService: ReachabilityAnalysisService,
    private sessionService: NetworkSessionService
  ) {}

  ngOnInit(): void {
    console.log('🔍 ExactInferenceComponent initializing...');
    
    // Auto-select first available scenario
    const scenarios = this.availableScenarios();
    if (scenarios.length > 0 && !this.selectedScenario()) {
      this.selectedScenario.set(scenarios[0]);
      console.log(`🎯 Auto-selected scenario: ${scenarios[0].displayName}`);
    }
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
      
      // Get edges file path from the reachability group (same pattern as analysis-state service)
      // Find the corresponding reachability group to get shared edges file
      const reachabilityGroups = this.fileManagerService.analysisGroups().reachability;
      const matchingGroup = reachabilityGroups.find(group => 
        group.scenarioName === scenario.name && group.dataType === scenario.dataType
      );
      
      if (!matchingGroup) {
        throw new Error(`Could not find matching reachability group for scenario: ${scenario.name}`);
      }
      
      // Use shared edges file path or construct base network path + edges file name
      const edgesFilePath = matchingGroup.edgesFile?.path || `${matchingGroup.networkPath}/${matchingGroup.networkPath?.split('/').pop()}.EDGES`;
      console.log(`📊 Edges file path: ${edgesFilePath}`);
      
      // Use the base network path from the matching group for consistency
      const baseNetworkPath = matchingGroup.networkPath;
      
      // Log the complete request being sent
      const request = {
        networkPath: baseNetworkPath,
        edgesFilePath: edgesFilePath,
        nodepriorsPath: scenario.nodePriorsFile.path,
        linkprobsPath: scenario.linkProbabilitiesFile.path
      };
      console.log(`🚀 Sending reachability analysis request:`, request);
      
      // Call reachability analysis service with exact inference flag
      const results = await this.reachabilityAnalysisService.analyzeReachability({
        networkPath: baseNetworkPath,
        edgesFilePath: edgesFilePath,
        nodepriorsPath: scenario.nodePriorsFile.path,
        linkprobsPath: scenario.linkProbabilitiesFile.path
      }).toPromise();

      // Process and format results for display
      const processedResults = this.processInferenceResults(results, scenario.dataType);
      const metrics = this.calculateInferenceMetrics(results, processedResults, scenario.dataType);
      
      this.inferenceResults.set(processedResults);
      this.inferenceMetrics.set(metrics);
      
      console.log(`✅ Inference completed: ${processedResults.length} nodes computed`);
      console.log(`⏱️ Computation time: ${metrics.computationTime.toFixed(3)}s`);
      
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
    
    if (!networkInfo) return [];
    
    const sourceNodesSet = new Set(networkInfo.sourceNodes);
    const joinNodesSet = new Set(networkInfo.joinNodes);
    
    // Process all node beliefs
    return Object.entries(beliefs).map(([nodeIdStr, belief]: [string, any]) => {
      const nodeId = parseInt(nodeIdStr);
      
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
      
      // For source nodes, belief = prior, so signal probability = 1
      // For other nodes, signal probability would need to be calculated from prior
      const signalProbability = sourceNodesSet.has(nodeId) ? 
        (dataType === 'float' ? 1.0 : belief) : belief; // Simplified
      
      return {
        nodeId,
        belief,
        prior: belief, // Simplified - would need actual priors from backend
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
   * Get data type display name for UI (same as diamond analysis)
   */
  private getDataTypeDisplayName(dataType: string): string {
    switch (dataType) {
      case 'float': return 'Float (Deterministic)';
      case 'interval': return 'Interval';
      case 'pbox': return 'P-Box';
      default: return dataType.charAt(0).toUpperCase() + dataType.slice(1);
    }
  }

  /**
   * Format belief value for display based on data type
   */
  formatBelief(belief: any): string {
    if (typeof belief === 'number') {
      return (belief * 100).toFixed(1) + '%';
    } else if (belief && typeof belief === 'object' && 'lower' in belief && 'upper' in belief) {
      return `[${(belief.lower * 100).toFixed(1)}%, ${(belief.upper * 100).toFixed(1)}%]`;
    }
    return 'N/A';
  }

  /**
   * Format signal probability for display
   */
  formatSignalProbability(probability: any): string {
    return this.formatBelief(probability);
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
    console.log('🧹 Cleared inference results');
  }
}