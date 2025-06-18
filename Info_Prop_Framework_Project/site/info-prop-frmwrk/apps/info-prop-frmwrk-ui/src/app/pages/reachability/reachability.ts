// site/info-prop-frmwrk/apps/info-prop-frmwrk-ui/src/app/pages/reachability/reachability.ts

import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { Subject, takeUntil } from 'rxjs';

import { GraphStateService } from '../../services/graph-state-service';
import { MainServerService } from '../../services/main-server-service';
import { FullAnalysisResponse, MonteCarloResult, EnhancedAnalysisRequest } from '../../shared/models/main-sever-interface';

interface ReachabilityResult {
  node: number;
  probability: number;
  monteCarloValue?: number;
  difference?: number;
  nodeType?: string;
}

interface NodeReachabilityDetails {
  nodeId: number;
  priorProbability: number;
  reachabilityValue: number;
  incomingEdges: number[];
  outgoingEdges: number[];
  nodeType: string;
}

interface ReachabilityComparison {
  analysisName: string;
  timestamp: Date;
  results: { [nodeId: string]: number };
  parameters: {
    nodePrior: number;
    edgeProb: number;
    enableMonteCarlo: boolean;
    monteCarloSamples: number;
  };
}

@Component({
  selector: 'app-reachability',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTabsModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatExpansionModule,
    MatDividerModule,
    MatTooltipModule,
    MatChipsModule,
    MatBadgeModule
  ],
  templateUrl: './reachability.html',
  styleUrl: './reachability.scss',
})
export class ReachabilityComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Injected services
  private readonly graphState = inject(GraphStateService);
  private readonly mainServerService = inject(MainServerService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  // Task 5.1: Component state signals
  isRunningReachabilityAnalysis = signal(false);
  reachabilityResults = signal<FullAnalysisResponse | null>(null);
  analysisProgress = signal(0);
  analysisStep = signal<string>('');

  // Task 5.3: Monte Carlo options moved from Parameters page
  enableMonteCarlo = signal(false);
  monteCarloSamples = signal(10000);

  // Task 5.4: Results display state
  processedResults = signal<ReachabilityResult[]>([]);
  selectedNodeDetails = signal<NodeReachabilityDetails | null>(null);
  showMonteCarloValidation = signal(false);

  // Task 5.5: Comparison functionality
  savedComparisons = signal<ReachabilityComparison[]>([]);
  comparisonMode = signal(false);
  selectedComparisons = signal<string[]>([]);

  // Display configuration
  displayedColumns = ['node', 'probability', 'monteCarlo', 'difference', 'actions'];
  resultsPerPage = signal(25);
  currentPage = signal(0);

  // Computed properties
  readonly isGraphLoaded = computed(() => this.graphState.isGraphLoaded());
  readonly hasResults = computed(() => this.reachabilityResults() !== null);
  readonly nodeCount = computed(() => this.graphState.nodeCount());
  readonly edgeCount = computed(() => this.graphState.edgeCount());
  readonly graphStructure = computed(() => this.graphState.graphStructure());
  readonly sourceNodes = computed(() => this.graphState.graphStructure()?.source_nodes || []);
  readonly hasDiamonds = computed(() => this.graphState.hasDiamonds());
  readonly isAnalysisStale = computed(() => this.graphState.isAnalysisStale());

  readonly reachabilityButtonText = computed(() => {
    if (this.isRunningReachabilityAnalysis()) {
      return this.analysisStep() || 'Running Analysis...';
    }
    
    if (!this.hasResults()) {
      return 'Run Reachability Analysis';
    }
    
    if (this.isAnalysisStale()) {
      return 'Run for Current Values';
    }
    
    return 'Rerun Analysis';
  });

  readonly canRunAnalysis = computed(() => {
    return this.isGraphLoaded() && this.hasDiamonds() && !this.isRunningReachabilityAnalysis();
  });

  readonly monteCarloResultsCount = computed(() => {
    const results = this.processedResults();
    return results.filter(r => r.monteCarloValue !== undefined).length;
  });

  readonly averageDifference = computed(() => {
    const results = this.processedResults();
    const withMonteCarlo = results.filter(r => r.difference !== undefined);
    if (withMonteCarlo.length === 0) return 0;
    
    const sum = withMonteCarlo.reduce((acc, r) => acc + (r.difference || 0), 0);
    return sum / withMonteCarlo.length;
  });

  readonly maxDifference = computed(() => {
    const results = this.processedResults();
    const differences = results.map(r => r.difference || 0);
    return differences.length > 0 ? Math.max(...differences) : 0;
  });

  ngOnInit(): void {
    // Load saved comparisons from localStorage equivalent (in-memory storage)
    this.loadSavedComparisons();
    
    // Listen for graph state changes - lastResults is a signal, not an observable
    // We'll handle this differently by watching for changes in the effect
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Task 5.2: Run Reachability Analysis method
  async runReachabilityAnalysis(): Promise<void> {
    if (!this.isGraphLoaded()) {
      this.snackBar.open('Please load a graph first', 'Close', { duration: 3000 });
      return;
    }

    this.isRunningReachabilityAnalysis.set(true);
    this.analysisProgress.set(0);
    this.analysisStep.set('Initializing reachability analysis...');

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        this.analysisProgress.update(current => {
          const newValue = Math.min(current + 5, 90);
          
          // Update step based on progress
          if (newValue < 30) {
            this.analysisStep.set('Analyzing network structure...');
          } else if (newValue < 60) {
            this.analysisStep.set('Computing node reachabilities...');
          } else if (newValue < 80 && this.enableMonteCarlo()) {
            this.analysisStep.set('Running Monte Carlo validation...');
          } else {
            this.analysisStep.set('Finalizing results...');
          }
          
          return newValue;
        });
      }, 200);

      // Get current parameters from graph state
      const structure = this.graphStructure();
      if (!structure) {
        throw new Error('No graph structure available');
      }

      // Calculate average parameters from current structure
      const nodePriors = Object.values(structure.node_priors || {});
      const edgeProbs = Object.values(structure.edge_probabilities || {});
      
      const avgNodePrior = nodePriors.length > 0 
        ? nodePriors.reduce((sum, p) => sum + p, 0) / nodePriors.length 
        : 0.5;
      
      const avgEdgeProb = edgeProbs.length > 0 
        ? edgeProbs.reduce((sum, p) => sum + p, 0) / edgeProbs.length 
        : 0.5;

      // Task 5.3: Include Monte Carlo options in analysis request
      const enhancedOptions = {
        includeClassification: true,
        enableMonteCarlo: this.enableMonteCarlo(),
        monteCarloSamples: this.monteCarloSamples(),
        useIndividualOverrides: true,
        individualNodePriors: structure.node_priors || {},
        individualEdgeProbabilities: structure.edge_probabilities || {}
      };

      const basicParams = {
        nodePrior: avgNodePrior,
        edgeProb: avgEdgeProb,
        overrideNodePrior: false,
        overrideEdgeProb: false
      };

      const result = await this.graphState.runFullAnalysis(
        basicParams,
        enhancedOptions,
        {
          message: 'Running reachability analysis...',
          showCancelButton: true
        }
      );

      clearInterval(progressInterval);
      this.analysisProgress.set(100);
      this.analysisStep.set('Analysis complete!');

      if (result.success && result.result) {
        this.reachabilityResults.set(result.result);
        this.processAnalysisResults(result.result);
        
        const message = this.enableMonteCarlo()
          ? `Reachability analysis complete with Monte Carlo validation (${this.monteCarloSamples()} samples)!`
          : 'Reachability analysis complete!';
        
        this.snackBar.open(message, 'Close', { duration: 4000 });
      } else {
        throw new Error(result.error || 'Analysis failed');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Analysis failed due to an unexpected error';
      this.snackBar.open(`Reachability analysis failed: ${errorMessage}`, 'Close', { duration: 5000 });
      console.error('Reachability analysis error:', error);
    } finally {
      this.isRunningReachabilityAnalysis.set(false);
      setTimeout(() => {
        this.analysisProgress.set(0);
        this.analysisStep.set('');
      }, 2000);
    }
  }

  // Task 5.4: Process and display results
  private processAnalysisResults(results: FullAnalysisResponse): void {
    if (!results || !results.results) {
      this.processedResults.set([]);
      return;
    }

    const structure = this.graphStructure();
    const reachabilityData: ReachabilityResult[] = [];

    // Process main reachability results - results is AnalysisResult[]
    if (Array.isArray(results.results)) {
      results.results.forEach((analysisResult) => {
        const result: ReachabilityResult = {
          node: analysisResult.node,
          probability: analysisResult.probability,
          nodeType: this.getNodeType(analysisResult.node, structure)
        };

        // Add Monte Carlo data if available
        if (results.monteCarloResults) {
          const mcResult = results.monteCarloResults.find(mc => mc.node === analysisResult.node);
          if (mcResult) {
            result.monteCarloValue = mcResult.monteCarloValue;
            result.difference = mcResult.difference;
          }
        }

        reachabilityData.push(result);
      });
    }

    // Sort by probability (descending)
    reachabilityData.sort((a, b) => b.probability - a.probability);
    
    this.processedResults.set(reachabilityData);
    this.showMonteCarloValidation.set(!!results.monteCarloResults);
  }

  private getNodeType(nodeId: number, structure: any): string {
    if (!structure) return 'Unknown';
    
    // Determine node type based on structure
    const hasIncoming = structure.incoming_index && structure.incoming_index[nodeId] && structure.incoming_index[nodeId].length > 0;
    const hasOutgoing = structure.outgoing_index && structure.outgoing_index[nodeId] && structure.outgoing_index[nodeId].length > 0;
    
    if (!hasIncoming && hasOutgoing) return 'Source';
    if (hasIncoming && !hasOutgoing) return 'Terminal';
    if (hasIncoming && hasOutgoing) return 'Intermediate';
    return 'Isolated';
  }

  // Task 5.4: Show node details on hover or click
  showNodeDetails(nodeId: number): void {
    const structure = this.graphStructure();
    const results = this.reachabilityResults();
    
    if (!structure || !results) return;

    // Find the result for this node
    const nodeResult = Array.isArray(results.results)
      ? results.results.find(r => r.node === nodeId)
      : null;

    const details: NodeReachabilityDetails = {
      nodeId: nodeId,
      priorProbability: structure.node_priors?.[nodeId] || 0,
      reachabilityValue: nodeResult?.probability || 0,
      incomingEdges: structure.incoming_index?.[nodeId] || [],
      outgoingEdges: structure.outgoing_index?.[nodeId] || [],
      nodeType: this.getNodeType(nodeId, structure)
    };

    this.selectedNodeDetails.set(details);
  }

  clearNodeDetails(): void {
    this.selectedNodeDetails.set(null);
  }

  // Task 5.5: Comparison functionality
  saveCurrentAnalysis(): void {
    const results = this.reachabilityResults();
    const structure = this.graphStructure();
    
    if (!results || !structure) {
      this.snackBar.open('No analysis results to save', 'Close', { duration: 3000 });
      return;
    }

    const analysisName = `Analysis_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}`;
    
    // Calculate current parameters
    const nodePriors = Object.values(structure.node_priors || {});
    const edgeProbs = Object.values(structure.edge_probabilities || {});
    
    const avgNodePrior = nodePriors.length > 0 
      ? nodePriors.reduce((sum, p) => sum + p, 0) / nodePriors.length 
      : 0.5;
    
    const avgEdgeProb = edgeProbs.length > 0 
      ? edgeProbs.reduce((sum, p) => sum + p, 0) / edgeProbs.length 
      : 0.5;

    // Convert AnalysisResult[] to { [nodeId: string]: number }
    const resultsMap: { [nodeId: string]: number } = {};
    if (Array.isArray(results.results)) {
      results.results.forEach(result => {
        resultsMap[result.node.toString()] = result.probability;
      });
    }

    const comparison: ReachabilityComparison = {
      analysisName,
      timestamp: new Date(),
      results: resultsMap,
      parameters: {
        nodePrior: avgNodePrior,
        edgeProb: avgEdgeProb,
        enableMonteCarlo: this.enableMonteCarlo(),
        monteCarloSamples: this.monteCarloSamples()
      }
    };

    this.savedComparisons.update(comparisons => [...comparisons, comparison]);
    this.saveBrowserSession();
    
    this.snackBar.open(`Analysis saved as ${analysisName}`, 'Close', { duration: 3000 });
  }

  deleteComparison(analysisName: string): void {
    this.savedComparisons.update(comparisons => 
      comparisons.filter(comp => comp.analysisName !== analysisName)
    );
    this.saveBrowserSession();
    
    this.snackBar.open('Analysis deleted', 'Close', { duration: 2000 });
  }

  toggleComparisonMode(): void {
    this.comparisonMode.update(current => !current);
    if (!this.comparisonMode()) {
      this.selectedComparisons.set([]);
    }
  }

  toggleComparisonSelection(analysisName: string): void {
    this.selectedComparisons.update(selected => {
      const index = selected.indexOf(analysisName);
      if (index === -1) {
        return [...selected, analysisName];
      } else {
        return selected.filter(name => name !== analysisName);
      }
    });
  }

  compareSelectedAnalyses(): void {
    const selected = this.selectedComparisons();
    if (selected.length < 2) {
      this.snackBar.open('Please select at least 2 analyses to compare', 'Close', { duration: 3000 });
      return;
    }

    // Implementation for comparison visualization would go here
    // For now, just show a message
    this.snackBar.open(`Comparing ${selected.length} analyses...`, 'Close', { duration: 3000 });
  }

  // Export functionality
  exportResults(): void {
    const results = this.processedResults();
    if (results.length === 0) {
      this.snackBar.open('No results to export', 'Close', { duration: 3000 });
      return;
    }

    const csvContent = this.generateCSV(results);
    this.downloadCSV(csvContent, 'reachability_results.csv');
    
    this.snackBar.open('Results exported successfully', 'Close', { duration: 3000 });
  }

  private generateCSV(results: ReachabilityResult[]): string {
    const headers = ['Node', 'Reachability Probability', 'Monte Carlo Value', 'Difference', 'Node Type'];
    const rows = results.map(result => [
      result.node.toString(),
      result.probability.toFixed(6),
      result.monteCarloValue?.toFixed(6) || 'N/A',
      result.difference?.toFixed(6) || 'N/A',
      result.nodeType || 'Unknown'
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private downloadCSV(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  // Monte Carlo validation methods
  validateMonteCarlo(): void {
    if (!this.enableMonteCarlo()) {
      this.snackBar.open('Monte Carlo validation is not enabled', 'Close', { duration: 3000 });
      return;
    }

    const avgDiff = this.averageDifference();
    const maxDiff = this.maxDifference();
    const resultCount = this.monteCarloResultsCount();

    const message = `Monte Carlo Validation: ${resultCount} nodes validated. ` +
                   `Average difference: ${(avgDiff * 100).toFixed(3)}%, ` +
                   `Maximum difference: ${(maxDiff * 100).toFixed(3)}%`;

    this.snackBar.open(message, 'Close', { duration: 8000 });
  }

  // Session management (in-memory storage)
  private savedComparisonsStorage: ReachabilityComparison[] = [];

  private saveBrowserSession(): void {
    // Store in memory since localStorage is not available
    this.savedComparisonsStorage = [...this.savedComparisons()];
  }

  private loadSavedComparisons(): void {
    // Load from memory storage
    this.savedComparisons.set([...this.savedComparisonsStorage]);
  }

  // Utility methods
  formatPercentage(value: number): string {
    return `${(value * 100).toFixed(2)}%`;
  }

  formatLargeNumber(value: number): string {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  }

  formatDifference(value: number | undefined): string {
    if (value === undefined) return 'N/A';
    return `${(value * 100).toFixed(3)}%`;
  }

  // Navigation helpers
  goToParameters(): void {
    this.router.navigate(['/parameters']);
  }

  goToVisualization(): void {
    this.router.navigate(['/visualization']);
  }

  goToDiamondAnalysis(): void {
    this.router.navigate(['/diamond-analysis']);
  }

  // Task 5.4: Support for sensitivity analysis (future enhancement)
  redirectToSensitivityAnalysis(nodeIds: number[]): void {
    // Store selected nodes for sensitivity analysis
    // This would integrate with a future sensitivity analysis component
    console.log('Redirecting to sensitivity analysis for nodes:', nodeIds);
    
    this.snackBar.open(
      `Sensitivity analysis for ${nodeIds.length} nodes (feature coming soon)`, 
      'Close', 
      { duration: 3000 }
    );
  }

  // Add Object property to make it available in template
  Object = Object;
}