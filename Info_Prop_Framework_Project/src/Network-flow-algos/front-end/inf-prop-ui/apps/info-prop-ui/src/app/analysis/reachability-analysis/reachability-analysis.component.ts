import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { FormsModule } from '@angular/forms';

import { NetworkVisualizationComponent, NodeClickInfo, FilterConfig } from '../network-visualization/network-visualization.component';

import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { BeliefValue, IntervalData, PboxData } from '../../shared/models/network-analysis.models';

@Component({
  selector: 'app-reachability-analysis',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatProgressBarModule,
    MatTabsModule,
    MatButtonToggleModule,
    MatSelectModule,
    MatSliderModule,
    FormsModule,
    NetworkVisualizationComponent
  ],
  templateUrl: './reachability-analysis.component.html',
  styleUrls: ['./reachability-analysis.component.scss']
})
export class ReachabilityAnalysisComponent {
  private analysisState = inject(AnalysisStateService);

  networkData = computed(() => this.analysisState.networkData());
  analysisResults = computed(() => this.analysisState.analysisResults());
  isLoading = computed(() => this.analysisState.isLoading());
  error = computed(() => this.analysisState.error());

  // View mode and state
  viewMode = signal<'dashboard' | 'visual'>('dashboard');
  selectedScenario = signal<string>('');
  
  // Visual view filters
  beliefRangeMin = signal<number>(0);
  beliefRangeMax = signal<number>(1);
  selectedNodeTypes = signal<string[]>(['source', 'sink', 'fork', 'join', 'regular']);
  
  // Table columns
  displayedColumns: string[] = ['metric', 'value'];
  beliefsDisplayedColumns: string[] = ['node', 'belief'];
  
  // Node type options for filtering
  nodeTypeOptions = ['source', 'sink', 'fork', 'join', 'regular'];

  getReachabilityScenarios() {
    const results = this.analysisResults();
    if (!results?.results?.reachability_scenarios) return [];

    return Object.entries(results.results.reachability_scenarios)
      .filter(([_, scenario]) => scenario.exact_inference)
      .map(([name, scenario]) => ({
        name,
        scenario
      }));
  }

  getInferenceMetrics(inference: any): { metric: string; value: string | number }[] {
    if (!inference) return [];

    return [
      { metric: 'Total Nodes Processed', value: inference.total_nodes_processed },
      { metric: 'Computation Time', value: `${inference.computation_time.toFixed(4)}s` },
      { metric: 'Mean Belief', value: inference.belief_statistics.mean.toFixed(4) },
      { metric: 'Min Belief', value: inference.belief_statistics.min.toFixed(4) },
      { metric: 'Max Belief', value: inference.belief_statistics.max.toFixed(4) }
    ];
  }

  // Utility methods for handling different belief value types
  private getNumericValue(beliefValue: BeliefValue): number {
    if (typeof beliefValue === 'number') {
      return beliefValue;
    } else if ('lower' in beliefValue && 'upper' in beliefValue) {
      // Interval: use midpoint
      return (beliefValue.lower + beliefValue.upper) / 2;
    } else if ('mean_lower' in beliefValue && 'mean_upper' in beliefValue) {
      // Pbox: use midpoint of mean bounds
      return (beliefValue.mean_lower + beliefValue.mean_upper) / 2;
    }
    return 0;
  }

  private formatBeliefValue(beliefValue: BeliefValue): string {
    if (typeof beliefValue === 'number') {
      return beliefValue.toFixed(4);
    } else if ('lower' in beliefValue && 'upper' in beliefValue) {
      return `[${beliefValue.lower.toFixed(3)}, ${beliefValue.upper.toFixed(3)}]`;
    } else if ('mean_lower' in beliefValue && 'mean_upper' in beliefValue) {
      return `Pbox(μ:[${beliefValue.mean_lower.toFixed(3)}, ${beliefValue.mean_upper.toFixed(3)}])`;
    }
    return 'Unknown';
  }

  getBeliefsData(beliefs: Record<string, BeliefValue>): { node: string; belief: BeliefValue; numericValue: number; displayValue: string }[] {
    return Object.entries(beliefs)
      .map(([node, belief]) => ({ 
        node, 
        belief,
        numericValue: this.getNumericValue(belief),
        displayValue: this.formatBeliefValue(belief)
      }))
      .sort((a, b) => b.numericValue - a.numericValue); // Sort by numeric value descending
  }

  getBeliefLevel(beliefValue: BeliefValue): 'high' | 'medium' | 'low' {
    const numericValue = this.getNumericValue(beliefValue);
    if (numericValue >= 0.7) return 'high';
    if (numericValue >= 0.4) return 'medium';
    return 'low';
  }

  getTopBeliefs(beliefs: Record<string, BeliefValue>, count: number = 10) {
    return this.getBeliefsData(beliefs).slice(0, count);
  }

  getBottomBeliefs(beliefs: Record<string, BeliefValue>, count: number = 10) {
    const sorted = this.getBeliefsData(beliefs);
    return sorted.slice(-count).reverse();
  }

  // View mode handlers
  onViewModeChange(mode: 'dashboard' | 'visual'): void {
    this.viewMode.set(mode);
  }

  onScenarioChange(scenarioName: string): void {
    this.selectedScenario.set(scenarioName);
  }

  // Get current scenario data
  getCurrentScenario() {
    const scenarios = this.getReachabilityScenarios();
    const selectedName = this.selectedScenario();
    
    if (!selectedName || !scenarios.length) {
      return scenarios[0] || null;
    }
    
    return scenarios.find(s => s.name === selectedName) || scenarios[0];
  }

  // Visual view handlers
  onNodeClick(nodeInfo: NodeClickInfo): void {
    console.log('Node clicked:', nodeInfo);
  }

  onBeliefRangeChange(): void {
    // Filter update is handled by template binding
  }

  onNodeTypeFilterChange(): void {
    // Filter update is handled by template binding
  }

  // Get filter config for visualization
  getVisualizationFilters(): FilterConfig {
    return {
      nodeTypeFilters: this.selectedNodeTypes(),
      valueRange: {
        min: this.beliefRangeMin(),
        max: this.beliefRangeMax()
      }
    };
  }

  // Get belief distribution statistics
  getBeliefDistribution(beliefs: Record<string, BeliefValue>) {
    if (!beliefs) return null;
    
    const numericValues = Object.values(beliefs).map(v => this.getNumericValue(v));
    const sorted = numericValues.sort((a, b) => a - b);
    const length = numericValues.length;
    
    return {
      count: length,
      median: length % 2 === 0 
        ? (sorted[length / 2 - 1] + sorted[length / 2]) / 2 
        : sorted[Math.floor(length / 2)],
      q1: sorted[Math.floor(length * 0.25)],
      q3: sorted[Math.floor(length * 0.75)],
      highCount: numericValues.filter(v => v >= 0.7).length,
      mediumCount: numericValues.filter(v => v >= 0.4 && v < 0.7).length,
      lowCount: numericValues.filter(v => v < 0.4).length
    };
  }

  onBeliefRangeMinChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.beliefRangeMin.set(+target.value);
    this.onBeliefRangeChange();
  }

  onBeliefRangeMaxChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.beliefRangeMax.set(+target.value);
    this.onBeliefRangeChange();
  }

  // Initialize selected scenario on data load
  ngOnInit(): void {
    const scenarios = this.getReachabilityScenarios();
    if (scenarios.length > 0 && !this.selectedScenario()) {
      this.selectedScenario.set(scenarios[0].name);
    }
  }
}