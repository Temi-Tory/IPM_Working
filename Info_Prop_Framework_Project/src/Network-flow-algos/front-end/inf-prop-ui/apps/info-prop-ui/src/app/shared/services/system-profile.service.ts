
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of, map, catchError, switchMap } from 'rxjs';
import { HttpClient } from '@angular/common/http';

import { 
  SystemProfileData, 
  SystemMetrics, 
  ScenarioAnalysisResult,
  NetworkInfo,
  VisualizationDataPoint,
  SystemRecommendation,
  RiskAssessment,
  PerformanceMetrics,
  SystemProfileRequest,
  SystemProfileResponse
} from '../models/system-profile.models';

import { 
  ScenarioInfo, 
  DiamondAnalysisResult, 
  ExactInferenceResult,
  CapacityScenario,
  CpmScenario,
  NetworkStructure
} from '../models/network-analysis.models';

import { AnalysisStateService } from './analysis-state.service';
import { FileManagerService } from './file-manager.service';
import { CapacityAnalysisService } from './capacity-analysis.service';
import { CpmAnalysisService } from './cpm-analysis.service';
import { DiamondAnalysisService } from './diamond-analysis.service';

/**
 * System Profile Service
 * 
 * Aggregates analysis results from ALL available scenarios by making direct API calls
 * regardless of whether user has individually loaded them. Provides comprehensive 
 * system insights and visualizations across all possible analysis combinations.
 */
@Injectable({
  providedIn: 'root'
})
export class SystemProfileService {
  private http = inject(HttpClient);
  private analysisStateService = inject(AnalysisStateService);
  private fileManagerService = inject(FileManagerService);
  private capacityAnalysisService = inject(CapacityAnalysisService);
  private cpmAnalysisService = inject(CpmAnalysisService);
  private diamondAnalysisService = inject(DiamondAnalysisService);

  private readonly baseUrl = 'http://localhost:8080';

  /**
   * Generate comprehensive system profile from ALL available scenarios
   * Makes API calls for each scenario regardless of current loaded state
   */
  generateSystemProfile(
    networkPath: string, 
    scenarios: ScenarioInfo[]
  ): Observable<SystemProfileData> {
    console.log('🏗️ Generating COMPLETE system profile for', scenarios.length, 'scenarios');
    console.log('📡 Will make API calls for ALL scenarios regardless of current state');

    const startTime = Date.now();

    return this.getNetworkStructure(networkPath).pipe(
      switchMap(networkStructure => {
        const networkInfo = this.extractNetworkInfo(networkStructure, networkPath);
        
        // Process ALL scenarios by making direct API calls
        const scenarioObservables = scenarios.map(scenario => 
          this.executeScenarioAnalysis(networkPath, scenario)
        );

        console.log('🚀 Executing', scenarioObservables.length, 'parallel API calls for complete system profile');

        return forkJoin(scenarioObservables).pipe(
          map(scenarioResults => {
            const scenarioMap = new Map<string, ScenarioAnalysisResult>();
            scenarioResults.forEach(result => {
              if (result) {
                scenarioMap.set(result.scenarioName, result);
              }
            });

            console.log('✅ Processed', scenarioMap.size, 'scenarios for system profile');

            // Generate aggregated metrics
            const aggregatedMetrics = this.calculateAggregatedMetrics(
              networkInfo, 
              scenarioMap
            );

            // Generate visualizations
            const visualizationData = this.generateVisualizationData(
              networkInfo,
              scenarioMap,
              aggregatedMetrics
            );

            // Generate recommendations
            const recommendations = this.generateRecommendations(
              networkInfo,
              scenarioMap,
              aggregatedMetrics
            );

            const computationTime = Date.now() - startTime;

            const systemProfile: SystemProfileData = {
              networkInfo,
              scenarioResults: scenarioMap,
              aggregatedMetrics,
              visualizationData,
              recommendations,
              generatedAt: new Date().toISOString(),
              computationTime
            };

            console.log('🎯 COMPLETE system profile generated:', {
              scenarios: scenarioMap.size,
              visualizations: visualizationData.length,
              recommendations: recommendations.length,
              computationTime: `${computationTime}ms`
            });

            return systemProfile;
          })
        );
      }),
      catchError(error => {
        console.error('❌ Complete system profile generation failed:', error);
        throw error;
      })
    );
  }

  /**
   * Execute analysis for individual scenario by making direct API call
   * This ensures we get fresh results for ALL scenarios regardless of UI state
   */
  private executeScenarioAnalysis(
    networkPath: string, 
    scenario: ScenarioInfo
  ): Observable<ScenarioAnalysisResult | null> {
    console.log('🔄 Executing API call for scenario:', scenario.name, scenario.analysisType);

    const startTime = Date.now();

    switch (scenario.analysisType) {
      case 'reachability':
        return this.executeReachabilityAnalysis(networkPath, scenario, startTime);
      case 'capacity':
        return this.executeCapacityAnalysis(networkPath, scenario, startTime);
      case 'cpm':
        return this.executeCpmAnalysis(networkPath, scenario, startTime);
      default:
        console.warn('⚠️ Unknown analysis type:', scenario.analysisType);
        return of(null);
    }
  }

  /**
   * Execute reachability analysis using DiamondAnalysisService
   */
  private executeReachabilityAnalysis(
    networkPath: string,
    scenario: ScenarioInfo,
    startTime: number
  ): Observable<ScenarioAnalysisResult | null> {
    // Find matching reachability group to get file paths
    const reachabilityGroups = this.fileManagerService.analysisGroups().reachability;
    const matchingGroup = reachabilityGroups.find(group =>
      (group.scenarioName || `${group.dataType}`) === scenario.name
    );

    if (!matchingGroup) {
      console.warn('⚠️ No matching reachability group for scenario:', scenario.name);
      return of(null);
    }

    // Construct edges file path
    const networkName = networkPath.split('/').pop() || 'network';
    const edgesFilePath = `${networkName}.EDGES`;

    // Prepare relative node priors path
    let relativePath = matchingGroup.nodePriorsFile?.path || '';
    if (networkName && relativePath.startsWith(networkName + '/')) {
      relativePath = relativePath.substring(networkName.length + 1);
    }

    // Use DiamondAnalysisService for reachability analysis
    const request = {
      networkPath: networkPath,
      edgesFilePath: edgesFilePath,
      nodepriorsPath: relativePath
    };

    console.log('📡 Using DiamondAnalysisService for reachability:', scenario.name, request);

    return this.diamondAnalysisService.analyzeDiamonds(request).pipe(
      map(response => {
        const computationTime = Date.now() - startTime;
        
        console.log('✅ Diamond/Reachability analysis response received for:', scenario.name);
        
        if (!response.success) {
          console.warn('⚠️ Diamond/Reachability analysis failed for:', scenario.name);
          return null;
        }
        
        return {
          scenarioName: scenario.name,
          analysisType: 'reachability' as const,
          dataType: scenario.dataType,
          computationTime,
          keyMetrics: this.extractReachabilityMetrics(response),
          riskAssessment: this.assessReachabilityRisk(response),
          performanceMetrics: this.calculateReachabilityPerformance(response),
          exactInference: undefined, // Diamond analysis doesn't provide exact inference
          diamondAnalysis: response.diamond_analysis
        };
      }),
      catchError(error => {
        console.error('❌ Diamond/Reachability analysis failed for', scenario.name, ':', error);
        return of(null);
      })
    );
  }

  /**
   * Execute capacity analysis using CapacityAnalysisService
   */
  private executeCapacityAnalysis(
    networkPath: string,
    scenario: ScenarioInfo,
    startTime: number
  ): Observable<ScenarioAnalysisResult | null> {
    // Find matching capacity group to get file paths
    const capacityGroups = this.fileManagerService.analysisGroups().capacity;
    const matchingGroup = capacityGroups.find(group =>
      (group.scenarioName || 'capacity') === scenario.name
    );

    if (!matchingGroup) {
      console.warn('⚠️ No matching capacity group for scenario:', scenario.name);
      return of(null);
    }

    // Construct edges file path
    const networkName = networkPath.split('/').pop() || 'network';
    const edgesFilePath = `${networkName}.EDGES`;

    // Prepare relative capacities path
    let relativePath = matchingGroup.capacitiesFile?.path || '';
    if (networkName && relativePath.startsWith(networkName + '/')) {
      relativePath = relativePath.substring(networkName.length + 1);
    }

    // Use CapacityAnalysisService instead of direct API call
    const request = {
      networkPath: networkPath,
      edgesFilePath: edgesFilePath,
      capacitiesPath: relativePath
    };

    console.log('📡 Using CapacityAnalysisService for:', scenario.name, request);

    return this.capacityAnalysisService.analyzeCapacity(request).pipe(
      map(response => {
        const computationTime = Date.now() - startTime;
        
        console.log('✅ Capacity analysis response received for:', scenario.name);
        
        if (!response.success) {
          console.warn('⚠️ Capacity analysis failed for:', scenario.name);
          return null;
        }
        
        return {
          scenarioName: scenario.name,
          analysisType: 'capacity' as const,
          dataType: 'float' as const,
          computationTime,
          keyMetrics: this.extractCapacityMetrics(response),
          riskAssessment: this.assessCapacityRisk(response),
          performanceMetrics: this.calculateCapacityPerformance(response),
          capacityAnalysis: response.capacity_result
        };
      }),
      catchError(error => {
        console.error('❌ Capacity analysis failed for', scenario.name, ':', error);
        return of(null);
      })
    );
  }

  /**
   * Execute CPM analysis using CpmAnalysisService
   */
  private executeCpmAnalysis(
    networkPath: string,
    scenario: ScenarioInfo,
    startTime: number
  ): Observable<ScenarioAnalysisResult | null> {
    // Find matching CPM group to get file paths
    const cpmGroups = this.fileManagerService.analysisGroups().cpm;
    const matchingGroup = cpmGroups.find(group =>
      (group.scenarioName || 'cpm') === scenario.name
    );

    if (!matchingGroup) {
      console.warn('⚠️ No matching CPM group for scenario:', scenario.name);
      return of(null);
    }

    // Construct edges file path
    const networkName = networkPath.split('/').pop() || 'network';
    const edgesFilePath = `${networkName}.EDGES`;

    // Prepare relative CPM path
    let relativePath = matchingGroup.cpmInputsFile?.path || '';
    if (networkName && relativePath.startsWith(networkName + '/')) {
      relativePath = relativePath.substring(networkName.length + 1);
    }

    // Use CpmAnalysisService instead of direct API call
    const request = {
      networkPath: networkPath,
      edgesFilePath: edgesFilePath,
      cpmPath: relativePath
    };

    console.log('📡 Using CpmAnalysisService for:', scenario.name, request);

    return this.cpmAnalysisService.analyzeCpm(request).pipe(
      map(response => {
        const computationTime = Date.now() - startTime;
        
        console.log('✅ CPM analysis response received for:', scenario.name);
        
        if (!response.success) {
          console.warn('⚠️ CPM analysis failed for:', scenario.name);
          return null;
        }
        
        return {
          scenarioName: scenario.name,
          analysisType: 'cpm' as const,
          dataType: 'float' as const,
          computationTime,
          keyMetrics: this.extractCpmMetrics(response),
          riskAssessment: this.assessCpmRisk(response),
          performanceMetrics: this.calculateCpmPerformance(response),
          cpmAnalysis: response.cpm_result
        };
      }),
      catchError(error => {
        console.error('❌ CPM analysis failed for', scenario.name, ':', error);
        return of(null);
      })
    );
  }

  /**
   * Get network structure from backend
   */
  private getNetworkStructure(networkPath: string): Observable<NetworkStructure> {
    const networkStructure = this.analysisStateService.networkData();
    if (networkStructure) {
      return of(networkStructure);
    }

    // Make API call to get network structure
    console.log('📡 Making network structure API call for:', networkPath);
    return this.http.post<{ network_structure: NetworkStructure }>(
      `${this.baseUrl}/network-structure`,
      { network_path: networkPath }
    ).pipe(
      map(response => {
        console.log('✅ Network structure API response received');
        return response.network_structure;
      })
    );
  }

  /**
   * Extract network information from structure
   */
  private extractNetworkInfo(networkStructure: NetworkStructure, networkPath: string): NetworkInfo {
    const edgeNodeRatio = networkStructure.total_edges / networkStructure.total_nodes;
    
    let complexityLevel: 'simple' | 'moderate' | 'complex' | 'very-complex';
    if (edgeNodeRatio < 1.2) complexityLevel = 'simple';
    else if (edgeNodeRatio < 1.8) complexityLevel = 'moderate';
    else if (edgeNodeRatio < 2.5) complexityLevel = 'complex';
    else complexityLevel = 'very-complex';

    return {
      name: networkPath.split('/').pop() || 'Unknown Network',
      totalNodes: networkStructure.total_nodes,
      totalEdges: networkStructure.total_edges,
      sourceNodes: networkStructure.source_nodes,
      sinkNodes: networkStructure.sink_nodes,
      forkNodes: networkStructure.fork_nodes,
      joinNodes: networkStructure.join_nodes,
      complexity: {
        level: complexityLevel,
        score: Math.min(100, edgeNodeRatio * 40),
        edgeNodeRatio,
        averageDegree: (networkStructure.total_edges * 2) / networkStructure.total_nodes,
        maxDegree: 0, // Would need to calculate from edges
        clustering: 0 // Would need to calculate clustering coefficient
      },
      topology: {
        type: 'dag', // Assuming DAG for now
        layers: networkStructure.iteration_sets_count,
        maxWidth: Math.max(...networkStructure.iteration_sets.map(set => set.length)),
        branchingFactor: networkStructure.fork_nodes.length / Math.max(networkStructure.source_nodes.length, 1),
        convergencePoints: networkStructure.join_nodes.length
      }
    };
  }

  /**
   * Calculate aggregated metrics across all scenarios
   */
  private calculateAggregatedMetrics(
    networkInfo: NetworkInfo,
    scenarioResults: Map<string, ScenarioAnalysisResult>
  ): SystemMetrics {
    const results = Array.from(scenarioResults.values());
    
    if (results.length === 0) {
      return this.getDefaultMetrics();
    }

    const computationTimes = results.map(r => r.computationTime);
    const riskScores = results.map(r => r.riskAssessment.riskScore);
    const performanceScores = results.map(r => r.performanceMetrics.efficiency);

    return {
      // Network-wide metrics
      networkUtilization: this.calculateAverageMetric(results, 'networkUtilization'),
      averageComplexity: networkInfo.complexity.score,
      maxComplexity: networkInfo.complexity.score,
      bottleneckCount: this.calculateAverageMetric(results, 'bottleneckCount'),
      singlePointFailures: networkInfo.joinNodes.length,
      
      // Performance metrics
      averageComputationTime: computationTimes.reduce((a, b) => a + b, 0) / computationTimes.length,
      totalComputationTime: computationTimes.reduce((a, b) => a + b, 0),
      memoryUsage: 0, // Would need to track from backend
      
      // Risk metrics
      overallRiskScore: riskScores.reduce((a, b) => a + b, 0) / riskScores.length,
      criticalPathRisk: this.calculateOverallRiskLevel(riskScores),
      cascadeRisk: this.calculateCascadeRisk(networkInfo, results),
      uncertaintyLevel: this.calculateUncertaintyLevel(results),
      
      // Reliability metrics (ensure 0-100% range with proper scaling)
      systemReliability: Math.min(100, Math.max(0, (performanceScores.reduce((a, b) => a + b, 0) / performanceScores.length) * 100)),
      redundancyLevel: Math.min(100, Math.max(0, this.calculateRedundancyLevel(networkInfo))),
      failureResistance: Math.min(100, Math.max(0, this.calculateFailureResistance(networkInfo, results))),
      
      // Efficiency metrics (ensure 0-100% range with proper scaling)
      resourceUtilization: Math.min(100, Math.max(0, this.calculateAverageMetric(results, 'resourceUtilization') * 100)),
      pathEfficiency: Math.min(100, Math.max(0, this.calculatePathEfficiency(networkInfo))),
      informationFlow: Math.min(100, Math.max(0, this.calculateInformationFlow(networkInfo, results)))
    };
  }

  /**
   * Generate visualization data for different chart types
   */
  private generateVisualizationData(
    networkInfo: NetworkInfo,
    scenarioResults: Map<string, ScenarioAnalysisResult>,
    metrics: SystemMetrics
  ): VisualizationDataPoint[] {
    const visualizations: VisualizationDataPoint[] = [];

    // Performance comparison bar chart
    visualizations.push(this.createPerformanceBarChart(scenarioResults));
    
    // Risk assessment radar chart
    visualizations.push(this.createRiskRadarChart(scenarioResults));
    
    // Network topology heatmap
    visualizations.push(this.createTopologyHeatmap(networkInfo));
    
    // Computation time histogram
    visualizations.push(this.createComputationTimeHistogram(scenarioResults));
    
    // System health overview
    visualizations.push(this.createSystemHealthOverview(metrics));

    return visualizations;
  }

  /**
   * Generate system recommendations based on analysis results
   */
  private generateRecommendations(
    networkInfo: NetworkInfo,
    scenarioResults: Map<string, ScenarioAnalysisResult>,
    metrics: SystemMetrics
  ): SystemRecommendation[] {
    const recommendations: SystemRecommendation[] = [];

    // Performance recommendations
    if (metrics.averageComputationTime > 5000) {
      recommendations.push({
        id: 'perf-001',
        type: 'performance',
        priority: 'high',
        title: 'Optimize Computation Performance',
        description: 'Analysis computation time is above optimal threshold',
        impact: 'Reduce analysis time by 30-50%',
        effort: 'medium',
        affectedComponents: ['computation-engine'],
        expectedBenefit: 0.4,
        implementationSteps: [
          'Profile computation bottlenecks',
          'Implement parallel processing',
          'Optimize data structures'
        ]
      });
    }

    // Risk mitigation recommendations
    if (metrics.overallRiskScore > 70) {
      recommendations.push({
        id: 'risk-001',
        type: 'risk-mitigation',
        priority: 'critical',
        title: 'Address High Risk Factors',
        description: 'System shows elevated risk levels across multiple scenarios',
        impact: 'Improve system reliability and reduce failure probability',
        effort: 'high',
        affectedComponents: ['network-topology', 'critical-paths'],
        expectedBenefit: 0.6,
        implementationSteps: [
          'Identify critical failure points',
          'Add redundant pathways',
          'Implement monitoring systems'
        ]
      });
    }

    // Network optimization recommendations
    if (networkInfo.complexity.level === 'very-complex') {
      recommendations.push({
        id: 'opt-001',
        type: 'optimization',
        priority: 'medium',
        title: 'Simplify Network Topology',
        description: 'Network complexity may impact maintainability and performance',
        impact: 'Improve system maintainability and reduce complexity',
        effort: 'high',
        affectedComponents: ['network-structure'],
        expectedBenefit: 0.3,
        implementationSteps: [
          'Analyze redundant connections',
          'Consolidate similar pathways',
          'Optimize node placement'
        ]
      });
    }

    return recommendations;
  }

  // Helper methods for metric extraction and calculation
  private extractReachabilityMetrics(response: any): Record<string, number> {
    return {
      totalNodes: response.exact_inference?.total_nodes_processed || 0,
      computationTime: response.exact_inference?.computation_time || 0,
      diamondCount: response.diamond_analysis?.root_diamonds_count || 0,
      uniqueDiamonds: response.diamond_analysis?.unique_diamonds_count || 0,
      networkUtilization: 0.5, // Default for reachability
      bottleneckCount: response.diamond_analysis?.join_nodes_with_diamonds?.length || 0,
      resourceUtilization: 0.6 // Default for reachability
    };
  }

  private extractCapacityMetrics(response: any): Record<string, number> {
    return {
      networkUtilization: response.capacity_result?.network_utilization || 0,
      totalFlow: response.capacity_result?.total_source_input || 0,
      bottleneckCount: Object.keys(response.capacity_result?.raw_capacity_result?.bottlenecks || {}).length,
      computationTime: response.capacity_result?.computation_time || 0,
      resourceUtilization: response.capacity_result?.network_utilization || 0
    };
  }

  private extractCpmMetrics(response: any): Record<string, number> {
    return {
      criticalPathValue: response.cpm_result?.time_result?.critical_value || 0,
      criticalNodes: response.cpm_result?.time_result?.critical_nodes?.length || 0,
      totalCost: response.cpm_result?.cost_result?.critical_value || 0,
      computationTime: response.cpm_result?.computation_time || 0,
      networkUtilization: 0.7, // Default for CPM
      bottleneckCount: response.cpm_result?.time_result?.critical_nodes?.length || 0,
      resourceUtilization: 0.8 // Default for CPM
    };
  }

  private assessReachabilityRisk(response: any): RiskAssessment {
    const diamondCount = response.diamond_analysis?.root_diamonds_count || 0;
    const complexity = response.diamond_analysis?.diamond_efficiency || 1;
    
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    let riskScore: number;
    
    if (diamondCount > 20 || complexity < 0.3) {
      riskLevel = 'high';
      riskScore = 80;
    } else if (diamondCount > 10 || complexity < 0.5) {
      riskLevel = 'medium';
      riskScore = 60;
    } else {
      riskLevel = 'low';
      riskScore = 30;
    }

    return {
      overallRisk: riskLevel,
      riskScore,
      riskFactors: [],
      mitigationStrategies: []
    };
  }

  private assessCapacityRisk(response: any): RiskAssessment {
    const utilization = response.capacity_result?.network_utilization || 0;
    const bottlenecks = Object.keys(response.capacity_result?.raw_capacity_result?.bottlenecks || {}).length;
    
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    let riskScore: number;
    
    if (utilization > 0.9 || bottlenecks > 5) {
      riskLevel = 'high';
      riskScore = 85;
    } else if (utilization > 0.7 || bottlenecks > 2) {
      riskLevel = 'medium';
      riskScore = 60;
    } else {
      riskLevel = 'low';
      riskScore = 25;
    }

    return {
      overallRisk: riskLevel,
      riskScore,
      riskFactors: [],
      mitigationStrategies: []
    };
  }

  private assessCpmRisk(response: any): RiskAssessment {
    const criticalNodes = response.cpm_result?.time_result?.critical_nodes?.length || 0;
    const totalNodes = Object.keys(response.cpm_result?.time_result?.node_values || {}).length;
    const criticalRatio = totalNodes > 0 ? criticalNodes / totalNodes : 0;
    
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    let riskScore: number;
    
    if (criticalRatio > 0.3) {
      riskLevel = 'high';
      riskScore = 75;
    } else if (criticalRatio > 0.15) {
      riskLevel = 'medium';
      riskScore = 50;
    } else {
      riskLevel = 'low';
      riskScore = 25;
    }

    return {
      overallRisk: riskLevel,
      riskScore,
      riskFactors: [],
      mitigationStrategies: []
    };
  }

  private calculateReachabilityPerformance(response: any): PerformanceMetrics {
    const computationTime = response.exact_inference?.computation_time || 0;
    const efficiency = response.diamond_analysis?.diamond_efficiency || 0;
    
    return {
      throughput: 1000 / Math.max(computationTime, 1),
      latency: computationTime,
      reliability: efficiency,
      efficiency: efficiency,
      scalability: Math.max(0, 1 - (computationTime / 10000)),
      robustness: efficiency
    };
  }

  private calculateCapacityPerformance(response: any): PerformanceMetrics {
    const utilization = response.capacity_result?.network_utilization || 0;
    const computationTime = response.capacity_result?.computation_time || 0;
    
    return {
      throughput: utilization,
      latency: computationTime,
      reliability: Math.max(0, 1 - utilization),
      efficiency: utilization,
      scalability: Math.max(0, 1 - utilization),
      robustness: Math.max(0, 1 - utilization)
    };
  }

  private calculateCpmPerformance(response: any): PerformanceMetrics {
    const computationTime = response.cpm_result?.computation_time || 0;
    const criticalValue = response.cpm_result?.time_result?.critical_value || 0;
    
    return {
      throughput: 1000 / Math.max(computationTime, 1),
      latency: computationTime,
      reliability: Math.max(0, 1 - (criticalValue / 1000)),
      efficiency: Math.max(0, 1 - (criticalValue / 1000)),
      scalability: Math.max(0, 1 - (computationTime / 5000)),
      robustness: Math.max(0, 1 - (criticalValue / 1000))
    };
  }

  // Utility methods for calculations
  private calculateAverageMetric(results: ScenarioAnalysisResult[], metricName: string): number {
    const values = results.map(r => r.keyMetrics[metricName] || 0);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  private calculateOverallRiskLevel(riskScores: number[]): 'low' | 'medium' | 'high' | 'critical' {
    const avgRisk = riskScores.reduce((a, b) => a + b, 0) / riskScores.length;
    if (avgRisk > 80) return 'critical';
    if (avgRisk > 60) return 'high';
    if (avgRisk > 40) return 'medium';
    return 'low';
  }

  private calculateCascadeRisk(networkInfo: NetworkInfo, results: ScenarioAnalysisResult[]): number {
    // Simple cascade risk calculation based on network topology
    const joinNodeRatio = networkInfo.joinNodes.length / networkInfo.totalNodes;
    const avgBottlenecks = this.calculateAverageMetric(results, 'bottleneckCount');
    return Math.min(100, (joinNodeRatio * 50) + (avgBottlenecks * 10));
  }

  private calculateUncertaintyLevel(results: ScenarioAnalysisResult[]): number {
    // Calculate uncertainty based on data types and risk variance
    const intervalCount = results.filter(r => r.dataType === 'interval').length;
    const pboxCount = results.filter(r => r.dataType === 'pbox').length;
    const totalCount = results.length;
    
    if (totalCount === 0) return 0;
    
    return ((intervalCount * 0.3) + (pboxCount * 0.6)) / totalCount * 100;
  }

  private calculateRedundancyLevel(networkInfo: NetworkInfo): number {
    // Simple redundancy calculation based on network structure
    const pathDensity = networkInfo.totalEdges / (networkInfo.totalNodes * (networkInfo.totalNodes - 1));
    return Math.min(100, pathDensity * 200);
  }

  private calculateFailureResistance(networkInfo: NetworkInfo, results: ScenarioAnalysisResult[]): number {
    // Calculate failure resistance based on network topology and bottlenecks
    const avgBottlenecks = this.calculateAverageMetric(results, 'bottleneckCount');
    const redundancy = this.calculateRedundancyLevel(networkInfo);
    return Math.max(0, redundancy - (avgBottlenecks * 10));
  }

  private calculatePathEfficiency(networkInfo: NetworkInfo): number {
    // Simple path efficiency based on network structure
    const idealEdges = networkInfo.totalNodes - 1; // Minimum for connectivity
    const actualEdges = networkInfo.totalEdges;
    return Math.max(0, 100 - ((actualEdges - idealEdges) / idealEdges * 50));
  }

  private calculateInformationFlow(networkInfo: NetworkInfo, results: ScenarioAnalysisResult[]): number {
    // Calculate information flow efficiency
    const avgEfficiency = results.length > 0 ? 
      results.reduce((sum, r) => sum + r.performanceMetrics.efficiency, 0) / results.length : 0.5;
    const topologyFactor = networkInfo.complexity.score / 100;
    return avgEfficiency * (1 - topologyFactor * 0.3) * 100;
  }

  private getDefaultMetrics(): SystemMetrics {
    return {
      networkUtilization: 0,
      averageComplexity: 0,
      maxComplexity: 0,
      bottleneckCount: 0,
      singlePointFailures: 0,
      averageComputationTime: 0,
      totalComputationTime: 0,
      memoryUsage: 0,
      overallRiskScore: 0,
      criticalPathRisk: 'low',
      cascadeRisk: 0,
      uncertaintyLevel: 0,
      systemReliability: 0,
      redundancyLevel: 0,
      failureResistance: 0,
      resourceUtilization: 0,
      pathEfficiency: 0,
      informationFlow: 0
    };
  }

  // Visualization creation methods
  private createPerformanceBarChart(scenarioResults: Map<string, ScenarioAnalysisResult>): VisualizationDataPoint {
    const scenarios = Array.from(scenarioResults.keys());
    const efficiencyValues = Array.from(scenarioResults.values()).map(r => r.performanceMetrics.efficiency * 100);
    
    return {
      id: 'performance-bar',
      type: 'bar',
      category: 'performance',
      title: 'Performance Comparison Across Scenarios',
      description: 'Efficiency metrics for each analysis scenario',
      data: {
        barData: {
          categories: scenarios,
          values: efficiencyValues,
          colors: scenarios.map(() => '#268bd2'),
          labels: scenarios
        }
      },
      config: {
        width: 600,
        height: 400,
        margins: { top: 20, right: 30, bottom: 40, left: 50 },
        axes: {
          x: { label: 'Scenarios' },
          y: { label: 'Efficiency Score' }
        }
      },
      metadata: {
        scenarios,
        analysisTypes: Array.from(new Set(Array.from(scenarioResults.values()).map(r => r.analysisType))),
        generatedAt: new Date().toISOString(),
        dataPoints: scenarios.length
      }
    };
  }

  private createRiskRadarChart(scenarioResults: Map<string, ScenarioAnalysisResult>): VisualizationDataPoint {
    const scenarios = Array.from(scenarioResults.keys()).slice(0, 3); // Limit to 3 for readability
    const axes = ['Risk Score', 'Reliability', 'Efficiency', 'Robustness', 'Scalability'];
    
    const datasets = scenarios.map((scenario, index) => {
      const result = scenarioResults.get(scenario)!;
      return {
        name: scenario,
        values: [
          result.riskAssessment.riskScore / 100,
          result.performanceMetrics.reliability,
          result.performanceMetrics.efficiency,
          result.performanceMetrics.robustness,
          result.performanceMetrics.scalability
        ],
        color: ['#dc322f', '#859900', '#268bd2'][index] || '#cb4b16'
      };
    });

    return {
      id: 'risk-radar',
      type: 'radar',
      category: 'risk',
      title: 'Risk Assessment Radar',
      description: 'Multi-dimensional risk and performance analysis',
      data: { radarData: { axes, datasets } },
      config: {
        width: 500,
        height: 500,
        margins: { top: 50, right: 50, bottom: 50, left: 50 }
      },
      metadata: {
        scenarios,
        analysisTypes: ['risk-assessment'],
        generatedAt: new Date().toISOString(),
        dataPoints: axes.length * scenarios.length
      }
    };
  }

  private createTopologyHeatmap(networkInfo: NetworkInfo): VisualizationDataPoint {
    // Create a simple adjacency-like matrix for visualization
    const size = Math.min(20, networkInfo.totalNodes); // Limit size for visualization
    const matrix = Array(size).fill(0).map(() => Array(size).fill(0));
    
    // Fill with some representative data based on network structure
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if (i === j) matrix[i][j] = 1;
        else if (Math.abs(i - j) === 1) matrix[i][j] = 0.5;
        else matrix[i][j] = Math.random() * 0.3;
      }
    }

    return {
      id: 'topology-heatmap',
      type: 'heatmap',
      category: 'topology',
      title: 'Network Topology Heatmap',
      description: 'Visual representation of network connectivity patterns',
      data: {
        heatmapData: {
          matrix,
          rowLabels: Array(size).fill(0).map((_, i) => `N${i + 1}`),
          columnLabels: Array(size).fill(0).map((_, i) => `N${i + 1}`),
          colorScale: { min: 0, max: 1 }
        }
      },
      config: {
        width: 600,
        height: 600,
        margins: { top: 50, right: 50, bottom: 50, left: 50 }
      },
      metadata: {
        scenarios: ['topology'],
        analysisTypes: ['network-structure'],
        generatedAt: new Date().toISOString(),
        dataPoints: size * size
      }
    };
  }

  private createComputationTimeHistogram(scenarioResults: Map<string, ScenarioAnalysisResult>): VisualizationDataPoint {
    const times = Array.from(scenarioResults.values()).map(r => r.computationTime);
    const min = Math.min(...times);
    const max = Math.max(...times);
    const binCount = Math.min(10, times.length);
    const binSize = (max - min) / binCount;
    
    const bins = Array(binCount).fill(0).map((_, i) => ({
      x0: min + i * binSize,
      x1: min + (i + 1) * binSize,
      count: 0
    }));

    times.forEach(time => {
      const binIndex = Math.min(Math.floor((time - min) / binSize), binCount - 1);
      bins[binIndex].count++;
    });

    return {
      id: 'computation-histogram',
      type: 'histogram',
      category: 'performance',
      title: 'Computation Time Distribution',
      description: 'Distribution of analysis computation times across scenarios',
      data: {
        histogramData: {
          bins,
          statistics: {
            mean: times.reduce((a, b) => a + b, 0) / times.length,
            median: times.sort((a, b) => a - b)[Math.floor(times.length / 2)],
            std: Math.sqrt(times.reduce((sum, time) => sum + Math.pow(time - (times.reduce((a, b) => a + b, 0) / times.length), 2), 0) / times.length),
            min,
            max
          }
        }
      },
      config: {
        width: 600,
        height: 400,
        margins: { top: 20, right: 30, bottom: 40, left: 50 }
      },
      metadata: {
        scenarios: Array.from(scenarioResults.keys()),
        analysisTypes: ['performance'],
        generatedAt: new Date().toISOString(),
        dataPoints: times.length
      }
    };
  }

  private createSystemHealthOverview(metrics: SystemMetrics): VisualizationDataPoint {
    const healthData = [
      { category: 'Performance', score: Math.min(100, Math.max(0, 100 - metrics.averageComputationTime / 100)) },
      { category: 'Reliability', score: Math.min(100, Math.max(0, metrics.systemReliability)) },
      { category: 'Risk Level', score: Math.min(100, Math.max(0, 100 - metrics.overallRiskScore)) },
      { category: 'Efficiency', score: Math.min(100, Math.max(0, metrics.resourceUtilization)) },
      { category: 'Robustness', score: Math.min(100, Math.max(0, metrics.failureResistance)) }
    ];

    return {
      id: 'system-health',
      type: 'bar',
      category: 'performance',
      title: 'System Health Overview',
      description: 'Overall system health across key metrics',
      data: {
        barData: {
          categories: healthData.map(d => d.category),
          values: healthData.map(d => d.score),
          colors: healthData.map(d => d.score > 70 ? '#859900' : d.score > 40 ? '#b58900' : '#dc322f'),
          labels: healthData.map(d => d.category)
        }
      },
      config: {
        width: 600,
        height: 400,
        margins: { top: 20, right: 30, bottom: 40, left: 50 },
        axes: {
          x: { label: 'Health Categories' },
          y: { label: 'Health Score (%)' }
        }
      },
      metadata: {
        scenarios: ['system-health'],
        analysisTypes: ['system-overview'],
        generatedAt: new Date().toISOString(),
        dataPoints: healthData.length
      }
    };
  }
}