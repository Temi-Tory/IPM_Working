import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';
import {
  CapacityAnalysisResponse,
  CapacityScenario,
} from '../models/network-analysis.models';
import { CapacityAnalysisService } from './capacity-analysis.service';

/**
 * Represents a single upgrade recommendation for a node or edge
 */
export interface UpgradeRecommendation {
  nodeOrEdgeId: string;
  currentCapacity: number;
  recommendedCapacity: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedImpact: number; // Percentage improvement
  reason: string;
  rationale?: string;
}

/**
 * Validation result for upgrade recommendations
 */
export interface UpgradeValidationResult {
  isValid: boolean;
  feasibility: 'feasible' | 'partially_feasible' | 'infeasible';
  totalUpgradeCost?: number;
  upgradeCostBreakdown?: Record<string, number>;
  expectedUtilizationReduction?: number;
  affectedNodes: number[];
  conflictingUpgrades?: string[];
  warnings: string[];
  computationTime: number;
}

/**
 * Projected metrics after a local upgrade calculation
 */
export interface ProjectedMetrics {
  nodeId: number;
  newUtilization: number;
  currentUtilization: number;
  utilizationReduction: number;
  affectedNodes: number[];
  downstreamImpact: {
    [nodeId: number]: {
      utilizationChange: number;
      flowChange: number;
    };
  };
  projectionConfidence: number; // 0-1, based on available data
}

/**
 * Node metrics for local impact calculation
 */
export interface NodeMetric {
  nodeId: number;
  capacity: number;
  flow: number;
  utilization: number;
  downstreamNodes: number[];
}

/**
 * Backend request for upgrade scenario analysis
 */
interface UpgradeScenarioRequest {
  nodeOrEdgeId: string;
  newCapacity: number;
  capacitiesPath: string;
  networkPath: string;
}

/**
 * Backend request for validating multiple upgrades
 */
interface ValidateUpgradesRequest {
  recommendations: UpgradeRecommendation[];
  capacitiesPath: string;
  networkPath: string;
}

/**
 * Service for managing capacity upgrade and what-if analysis scenarios
 * Provides methods to simulate upgrades and validate their impacts
 */
@Injectable({
  providedIn: 'root'
})
export class CapacityUpgradeService {
  private readonly API_BASE = 'http://localhost:8080';
  private http: HttpClient = inject(HttpClient);
  private capacityService: CapacityAnalysisService = inject(CapacityAnalysisService);

  /**
   * Cache for what-if scenario results
   * Maps scenario key to analysis response
   */
  whatIfCacheSignal = signal<Map<string, CapacityAnalysisResponse>>(new Map());

  /**
   * Get upgrade scenario analysis from backend
   * Computes what-if scenario with specified upgrade to understand downstream impact
   * 
   * @param nodeOrEdgeId - ID of node or edge to upgrade
   * @param newCapacity - New capacity value for the upgrade
   * @param capacitiesPath - Path to capacities data file
   * @param networkPath - Path to network structure file
   * @returns Observable of capacity analysis response after upgrade
   */
  getUpgradeScenario(
    nodeOrEdgeId: string,
    newCapacity: number,
    capacitiesPath: string,
    networkPath: string
  ): Observable<CapacityAnalysisResponse> {
    const cacheKey = `${nodeOrEdgeId}_${newCapacity}`;
    const cachedResult = this.whatIfCacheSignal().get(cacheKey);

    console.log('🔧 UPGRADE SERVICE DEBUG:');
    console.log(`  Upgrade scenario for: ${nodeOrEdgeId} → ${newCapacity}`);
    console.log(`  Cache hit: ${cachedResult ? 'YES' : 'NO'}`);

    if (cachedResult) {
      console.log('✅ Returning cached what-if scenario');
      return of(cachedResult);
    }

    const request: UpgradeScenarioRequest = {
      nodeOrEdgeId,
      newCapacity,
      capacitiesPath,
      networkPath
    };

    console.log('📤 Sending upgrade scenario request:', request);

    return this.http.post<CapacityAnalysisResponse>(
      `${this.API_BASE}/capacity-analysis/upgrade-scenario`,
      request
    ).pipe(
      tap(response => {
        console.log('📊 Upgrade scenario response received:', response.success ? 'SUCCESS' : 'FAILED');
        if (response.success) {
          // Update cache with new result
          this.whatIfCacheSignal.update(cache => new Map(cache).set(cacheKey, response));
          console.log(`📦 Cached upgrade scenario for: ${cacheKey}`);
          
          if (response.capacity_result) {
            console.log('📈 New capacity metrics:', {
              utilization: response.capacity_result.network_utilization,
              totalOutput: response.capacity_result.total_target_output,
              computationTime: response.capacity_result.computation_time
            });
          }
        } else {
          console.error('❌ Upgrade scenario analysis failed:', response.message);
        }
      }),
      catchError(error => {
        console.error('❌ Error fetching upgrade scenario:', error);
        return of({
          success: false,
          message: `Error analyzing upgrade: ${error.message}`,
          network_name: '',
          timestamp: new Date().toISOString(),
          capacity_result: {
            computation_time: 0,
            network_utilization: 0,
            total_source_input: 0,
            total_target_output: 0,
            target_flows: {},
            active_sources: [],
            target_nodes: [],
            node_capacities_count: 0,
            edge_capacities_count: 0,
            input_files: { capacities_path: capacitiesPath }
          }
        } as CapacityAnalysisResponse);
      })
    );
  }

  /**
   * Validate multiple upgrade recommendations
   * Checks feasibility and estimates combined impact of multiple upgrades
   * 
   * @param recommendations - Array of upgrade recommendations to validate
   * @param capacitiesPath - Path to capacities data file
   * @param networkPath - Path to network structure file
   * @returns Observable of validation results with feasibility assessment
   */
  validateUpgradeImpact(
    recommendations: UpgradeRecommendation[],
    capacitiesPath: string,
    networkPath: string
  ): Observable<UpgradeValidationResult> {
    console.log('✅ VALIDATE UPGRADES DEBUG:');
    console.log(`  Validating ${recommendations.length} recommendations`);
    recommendations.forEach(rec => {
      console.log(`    - ${rec.nodeOrEdgeId}: ${rec.currentCapacity} → ${rec.recommendedCapacity} [${rec.priority}]`);
    });

    const request: ValidateUpgradesRequest = {
      recommendations,
      capacitiesPath,
      networkPath
    };

    console.log('📤 Sending validation request to backend');

    return this.http.post<UpgradeValidationResult>(
      `${this.API_BASE}/capacity-analysis/validate-upgrades`,
      request
    ).pipe(
      tap(result => {
        console.log('✅ Validation result received:', {
          feasibility: result.feasibility,
          affectedNodesCount: result.affectedNodes.length,
          warningCount: result.warnings.length,
          computationTime: result.computationTime
        });
        
        if (result.warnings.length > 0) {
          console.warn('⚠️ Validation warnings:', result.warnings);
        }
        
        if (result.upgradeCostBreakdown) {
          console.log('💰 Upgrade cost breakdown:', result.upgradeCostBreakdown);
        }
      }),
      catchError(error => {
        console.error('❌ Error validating upgrades:', error);
        return of({
          isValid: false,
          feasibility: 'infeasible',
          affectedNodes: [],
          warnings: [`Validation error: ${error.message}`],
          computationTime: 0
        } as UpgradeValidationResult);
      })
    );
  }

  /**
   * Calculate local upgrade impact without backend call
   * Uses frontend heuristics for instant feedback on upgrade scenarios
   * 
   * Applies multiplier heuristic: upgrading a bottleneck node by X% 
   * results in approximately X/2 to X/1.5 reduction in downstream node utilization
   * 
   * @param nodeId - ID of node to upgrade
   * @param newCapacity - New capacity for the node
   * @param currentMetrics - Array of current node metrics for the network
   * @returns Projected metrics showing estimated impact
   */
  calculateLocalUpgradeImpact(
    nodeId: number,
    newCapacity: number,
    currentMetrics: NodeMetric[]
  ): ProjectedMetrics {
    console.log('🧮 LOCAL IMPACT CALCULATION:');
    console.log(`  Node ${nodeId}: calculating impact of upgrade to ${newCapacity}`);

    const nodeMetric = currentMetrics.find(m => m.nodeId === nodeId);
    if (!nodeMetric) {
      console.warn(`⚠️ Node ${nodeId} not found in metrics`);
      return {
        nodeId,
        newUtilization: 0,
        currentUtilization: 0,
        utilizationReduction: 0,
        affectedNodes: [],
        downstreamImpact: {},
        projectionConfidence: 0
      };
    }

    // Calculate upgrade impact
    const capacityIncrease = newCapacity - nodeMetric.capacity;
    const capacityIncreasePercent = (capacityIncrease / nodeMetric.capacity) * 100;
    
    // Current utilization
    const currentUtilization = (nodeMetric.flow / nodeMetric.capacity) * 100;
    
    // New utilization (flow stays same initially)
    const newUtilization = (nodeMetric.flow / newCapacity) * 100;
    const utilizationReduction = currentUtilization - newUtilization;

    console.log('  Upgrade metrics:', {
      currentCapacity: nodeMetric.capacity,
      newCapacity,
      capacityIncreasePercent: capacityIncreasePercent.toFixed(2) + '%',
      currentUtilization: currentUtilization.toFixed(2) + '%',
      newUtilization: newUtilization.toFixed(2) + '%',
      utilizationReduction: utilizationReduction.toFixed(2) + '%'
    });

    // Calculate downstream impacts using multiplier heuristic
    const downstreamImpact: { [nodeId: number]: { utilizationChange: number; flowChange: number } } = {};
    const affectedNodes: number[] = [];

    if (nodeMetric.downstreamNodes && nodeMetric.downstreamNodes.length > 0) {
      // Heuristic: downstream utilization drops by ~50-66% of the upgrade percentage
      const downstreamMultiplier = capacityIncreasePercent * 0.55; // 55% of upstream upgrade

      nodeMetric.downstreamNodes.forEach(downNodeId => {
        const downMetric = currentMetrics.find(m => m.nodeId === downNodeId);
        if (downMetric) {
          const flowReduction = (capacityIncrease * 0.3); // ~30% of capacity increase benefits downstream
          const utilizationChange = (flowReduction / downMetric.capacity) * 100;

          downstreamImpact[downNodeId] = {
            utilizationChange: -utilizationChange, // Negative = improvement
            flowChange: -flowReduction
          };

          affectedNodes.push(downNodeId);
          console.log(`  Downstream node ${downNodeId}: utilization change = ${utilizationChange.toFixed(2)}%`);
        }
      });
    }

    // Confidence score based on how many downstream metrics we have
    const expectedDownstreamCount = nodeMetric.downstreamNodes?.length || 0;
    const actualDownstreamMetrics = Object.keys(downstreamImpact).length;
    const projectionConfidence = expectedDownstreamCount > 0 
      ? (actualDownstreamMetrics / expectedDownstreamCount) 
      : 1.0;

    console.log('✅ Projection complete:', {
      affectedNodesCount: affectedNodes.length,
      projectionConfidence: (projectionConfidence * 100).toFixed(0) + '%'
    });

    return {
      nodeId,
      newUtilization: Math.max(0, newUtilization),
      currentUtilization: Math.max(0, currentUtilization),
      utilizationReduction: Math.max(0, utilizationReduction),
      affectedNodes,
      downstreamImpact,
      projectionConfidence
    };
  }

  /**
   * Clear what-if cache
   * Useful when scenarios have changed or need fresh analysis
   */
  clearWhatIfCache(): void {
    this.whatIfCacheSignal.set(new Map());
    console.log('🧹 What-if scenario cache cleared');
  }

  /**
   * Get cache size for debugging
   * @returns Number of cached scenarios
   */
  getCacheSize(): number {
    return this.whatIfCacheSignal().size;
  }
}
