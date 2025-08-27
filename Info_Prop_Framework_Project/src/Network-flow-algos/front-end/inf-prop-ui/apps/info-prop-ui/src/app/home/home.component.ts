import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { AnalysisStateService } from '../shared/services/analysis-state.service';
import { NetworkStructureResult } from '../shared/models/network-analysis.models';

@Component({
  selector: 'app-home',
  imports: [
    CommonModule, 
    MatCardModule, 
    MatButtonModule, 
    MatIconModule, 
    RouterModule,
    MatChipsModule,
    MatDividerModule,
    MatProgressBarModule,
    MatTooltipModule
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
  protected analysisState = inject(AnalysisStateService);
  
  protected comprehensiveData: NetworkStructureResult | null = null;
  protected networkMetrics: any = null;
  protected dataAvailability: any = null;
  protected complexityIndicators: any = null;
  
  private subscription = new Subscription();
  
  ngOnInit() {
    // Subscribe to comprehensive structure data
    this.subscription.add(
      this.analysisState.comprehensiveNetworkStructure$.subscribe(data => {
        this.comprehensiveData = data;
        if (data) {
          this.calculateMetrics(data);
          this.assessDataAvailability(data);
          this.calculateComplexityIndicators(data);
        }
      })
    );

    // Load comprehensive data if available
    const existingData = this.analysisState.getComprehensiveStructureData();
    if (existingData) {
      this.comprehensiveData = existingData;
      this.calculateMetrics(existingData);
      this.assessDataAvailability(existingData);
      this.calculateComplexityIndicators(existingData);
    }
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  private calculateMetrics(data: NetworkStructureResult) {
    this.networkMetrics = {
      totalNodes: data.total_nodes,
      totalEdges: data.total_edges,
      sourceNodes: data.source_nodes.length,
      sinkNodes: data.sink_nodes.length,
      forkNodes: data.fork_nodes.length,
      joinNodes: data.join_nodes.length,
      networkDepth: data.iteration_sets_count,
      avgDegree: data.total_edges > 0 ? (2 * data.total_edges / data.total_nodes).toFixed(2) : 0,
      density: data.total_nodes > 1 ? ((data.total_edges / (data.total_nodes * (data.total_nodes - 1))) * 100).toFixed(1) : 0
    };
  }

  private assessDataAvailability(data: NetworkStructureResult) {
    this.dataAvailability = {
      hasNodePriors: !!data.node_priors,
      hasEdgeProbabilities: !!data.edge_probabilities,
      hasCpmData: !!data.cpm_data,
      hasCapacityData: !!data.capacity_data,
      nodePriorsCount: data.node_priors ? Object.keys(data.node_priors).length : 0,
      edgeProbsCount: data.edge_probabilities ? Object.keys(data.edge_probabilities).length : 0
    };
  }

  private calculateComplexityIndicators(data: NetworkStructureResult) {
    const branchingFactor = data.fork_nodes.length / Math.max(data.total_nodes, 1);
    const convergenceFactor = data.join_nodes.length / Math.max(data.total_nodes, 1);
    const structuralComplexity = (branchingFactor + convergenceFactor) * data.iteration_sets_count;
    
    this.complexityIndicators = {
      branchingFactor: (branchingFactor * 100).toFixed(1),
      convergenceFactor: (convergenceFactor * 100).toFixed(1),
      structuralComplexity: structuralComplexity.toFixed(2),
      dataRichness: this.calculateDataRichness(data),
      connectivityRatio: (data.total_edges / Math.max(data.total_nodes, 1)).toFixed(2)
    };
  }

  private calculateDataRichness(data: NetworkStructureResult): string {
    let richness = 0;
    if (data.node_priors) richness += 25;
    if (data.edge_probabilities) richness += 25;
    if (data.cpm_data) richness += 25;
    if (data.capacity_data) richness += 25;
    return richness.toString();
  }

  protected getStructuralRoleColor(roleType: string): string {
    const colors: Record<string, string> = {
      'sources': '#4CAF50',
      'sinks': '#F44336', 
      'forks': '#FF9800',
      'joins': '#2196F3'
    };
    return colors[roleType] || '#757575';
  }

  protected refreshStructureData() {
    if (this.analysisState.hasActiveAnalysis()) {
      this.analysisState.refreshComprehensiveStructure().subscribe({
        next: (data) => {
          console.log('Refreshed comprehensive structure data');
        },
        error: (error) => {
          console.error('Failed to refresh structure data:', error);
        }
      });
    }
  }
}