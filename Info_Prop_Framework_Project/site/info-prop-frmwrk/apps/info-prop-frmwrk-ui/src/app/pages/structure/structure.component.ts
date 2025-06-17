import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatGridListModule } from '@angular/material/grid-list';
import { Subject, takeUntil } from 'rxjs';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

import { DataService, NetworkData } from '../../services/data.service';
import { Router } from '@angular/router';

// Register Chart.js components
Chart.register(...registerables);

interface NodeTypeStatistic {
  type: string;
  count: number;
  percentage: number;
  color: string;
  description: string;
  icon: string;
}

interface NetworkMetric {
  name: string;
  value: string | number;
  description: string;
  icon: string;
  category: 'basic' | 'advanced' | 'topology';
}

interface ConnectivityAnalysis {
  averageDegree: number;
  maxDegree: number;
  minDegree: number;
  degreeVariance: number;
  isolatedNodes: number;
  stronglyConnectedComponents: number;
}

@Component({
  selector: 'app-structure',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatTooltipModule,
    MatTabsModule,
    MatGridListModule
  ],
  templateUrl: './structure.component.html',
  styleUrls: ['./structure.component.scss']
})
export class StructureComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('nodeTypeChart') nodeTypeChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('connectivityChart') connectivityChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('degreeDistributionChart') degreeDistributionChartRef!: ElementRef<HTMLCanvasElement>;

  private destroy$ = new Subject<void>();
  private dataService = inject(DataService);
  private router = inject(Router);

  // Chart instances
  private nodeTypeChart: Chart | null = null;
  private connectivityChart: Chart | null = null;
  private degreeDistributionChart: Chart | null = null;

  // Component state
  networkData: NetworkData | null = null;
  isLoading = false;
  error: string | null = null;

  // Enhanced display data
  nodeTypeStatistics: NodeTypeStatistic[] = [];
  networkMetrics: NetworkMetric[] = [];
  connectivityAnalysis: ConnectivityAnalysis | null = null;

  // Display properties for tables
  displayedMetricColumns: string[] = ['name', 'value', 'description'];
  displayedNodeColumns: string[] = ['type', 'count', 'percentage', 'description'];

  ngOnInit(): void {
    // Subscribe to data service observables
    this.dataService.networkData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.networkData = data;
        if (data) {
          this.prepareEnhancedDisplayData();
          this.setupCharts();
        }
      });

    this.dataService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        this.isLoading = loading;
      });

    this.dataService.error$
      .pipe(takeUntil(this.destroy$))
      .subscribe(error => {
        this.error = error;
      });

    // If no network data, try to trigger structure analysis
    if (!this.networkData && this.dataService.hasFile()) {
      this.runStructureAnalysis();
    }
  }

  ngAfterViewInit(): void {
    // Setup charts after view initialization
    if (this.networkData) {
      setTimeout(() => this.setupCharts(), 100);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Cleanup chart instances
    if (this.nodeTypeChart) {
      this.nodeTypeChart.destroy();
    }
    if (this.connectivityChart) {
      this.connectivityChart.destroy();
    }
    if (this.degreeDistributionChart) {
      this.degreeDistributionChart.destroy();
    }
  }

  private prepareEnhancedDisplayData(): void {
    if (!this.networkData) return;

    const totalNodes = this.networkData.nodeCount;
    
    // Enhanced node type statistics
    this.nodeTypeStatistics = [
      {
        type: 'Source Nodes',
        count: this.networkData.sourceNodes?.length || 0,
        percentage: this.calculatePercentage(this.networkData.sourceNodes?.length || 0, totalNodes),
        color: '#4caf50',
        description: 'Entry points with no incoming edges - information originators',
        icon: 'input'
      },
      {
        type: 'Sink Nodes', 
        count: this.networkData.sinkNodes?.length || 0,
        percentage: this.calculatePercentage(this.networkData.sinkNodes?.length || 0, totalNodes),
        color: '#f44336',
        description: 'Terminal points with no outgoing edges - information consumers',
        icon: 'output'
      },
      {
        type: 'Fork Nodes',
        count: this.networkData.forkNodes?.length || 0,
        percentage: this.calculatePercentage(this.networkData.forkNodes?.length || 0, totalNodes),
        color: '#ff9800',
        description: 'Branching points distributing information to multiple paths',
        icon: 'call_split'
      },
      {
        type: 'Join Nodes',
        count: this.networkData.joinNodes?.length || 0,
        percentage: this.calculatePercentage(this.networkData.joinNodes?.length || 0, totalNodes),
        color: '#9c27b0',
        description: 'Convergence points collecting information from multiple sources',
        icon: 'call_merge'
      },
      {
        type: 'Intermediate Nodes',
        count: this.calculateIntermediateNodes(),
        percentage: this.calculatePercentage(this.calculateIntermediateNodes(), totalNodes),
        color: '#607d8b',
        description: 'Standard nodes with single input and output connections',
        icon: 'radio_button_unchecked'
      }
    ];

    // Enhanced network metrics
    this.networkMetrics = [
      {
        name: 'Total Nodes',
        value: this.networkData.nodeCount,
        description: 'Total number of nodes in the network',
        icon: 'scatter_plot',
        category: 'basic'
      },
      {
        name: 'Total Edges',
        value: this.networkData.edgeCount,
        description: 'Total number of directed edges connecting nodes',
        icon: 'polyline',
        category: 'basic'
      },
      {
        name: 'Graph Density',
        value: `${this.getGraphDensity()}%`,
        description: 'Ratio of actual edges to maximum possible edges',
        icon: 'density_medium',
        category: 'topology'
      },
      {
        name: 'Average Connectivity',
        value: this.getAverageConnectivity(),
        description: 'Average number of edges per node',
        icon: 'hub',
        category: 'topology'
      },
      {
        name: 'Network Complexity',
        value: this.getComplexityScore(),
        description: 'Overall complexity assessment based on structure',
        icon: 'psychology',
        category: 'advanced'
      },
      {
        name: 'Max Path Depth',
        value: this.networkData.maxIterationDepth || 'N/A',
        description: 'Maximum possible iteration depth for propagation',
        icon: 'layers',
        category: 'advanced'
      },
      {
        name: 'Branching Factor',
        value: this.getBranchingFactor(),
        description: 'Average number of outgoing connections from fork nodes',
        icon: 'account_tree',
        category: 'topology'
      },
      {
        name: 'Convergence Factor',
        value: this.getConvergenceFactor(),
        description: 'Average number of incoming connections to join nodes',
        icon: 'merge_type',
        category: 'topology'
      }
    ];

    // Connectivity analysis
    this.connectivityAnalysis = this.calculateConnectivityAnalysis();
  }

  private setupCharts(): void {
    if (!this.networkData || !this.nodeTypeStatistics.length) return;

    // Setup node type distribution chart
    this.setupNodeTypeChart();
    
    // Setup connectivity analysis chart
    this.setupConnectivityChart();
    
    // Setup degree distribution chart
    this.setupDegreeDistributionChart();
  }

  private setupNodeTypeChart(): void {
    if (!this.nodeTypeChartRef || this.nodeTypeChart) return;

    const ctx = this.nodeTypeChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const config: ChartConfiguration = {
      type: 'doughnut',
      data: {
        labels: this.nodeTypeStatistics.map(stat => stat.type),
        datasets: [{
          data: this.nodeTypeStatistics.map(stat => stat.count),
          backgroundColor: this.nodeTypeStatistics.map(stat => stat.color),
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              usePointStyle: true
            }
          },
          tooltip: {
            callbacks: {
              label: (context: { dataIndex: string | number; }) => {
                const stat = this.nodeTypeStatistics[Number(context.dataIndex)];
                return `${stat.type}: ${stat.count} (${stat.percentage}%)`;
              }
            }
          }
        }
      }
    };

    this.nodeTypeChart = new Chart(ctx, config);
  }

  private setupConnectivityChart(): void {
    if (!this.connectivityChartRef || this.connectivityChart) return;

    const ctx = this.connectivityChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const config: ChartConfiguration = {
      type: 'radar',
      data: {
        labels: ['Density', 'Avg Connectivity', 'Branching', 'Convergence', 'Complexity'],
        datasets: [{
          label: 'Network Characteristics',
          data: [
            this.getGraphDensity() / 2, // Scale density down for visibility
            this.getAverageConnectivity() * 10, // Scale up connectivity
            this.getBranchingFactor() * 10,
            this.getConvergenceFactor() * 10,
            this.getComplexityNumericScore()
          ],
          backgroundColor: 'rgba(33, 150, 243, 0.2)',
          borderColor: 'rgba(33, 150, 243, 1)',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            beginAtZero: true,
            max: 100
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    };

    this.connectivityChart = new Chart(ctx, config);
  }

  private setupDegreeDistributionChart(): void {
    if (!this.degreeDistributionChartRef || this.degreeDistributionChart) return;

    const ctx = this.degreeDistributionChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Calculate degree distribution
    const degreeDistribution = this.calculateDegreeDistribution();

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: Object.keys(degreeDistribution).map(d => `Degree ${d}`),
        datasets: [{
          label: 'Number of Nodes',
          data: Object.values(degreeDistribution),
          backgroundColor: 'rgba(156, 39, 176, 0.6)',
          borderColor: 'rgba(156, 39, 176, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of Nodes'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Node Degree'
            }
          }
        }
      }
    };

    this.degreeDistributionChart = new Chart(ctx, config);
  }

  // Enhanced utility methods
  private calculatePercentage(count: number, total: number): number {
    return total > 0 ? Math.round((count / total) * 100) : 0;
  }

  private calculateIntermediateNodes(): number {
    if (!this.networkData) return 0;
    const specialNodes = (this.networkData.sourceNodes?.length || 0) + 
                        (this.networkData.sinkNodes?.length || 0) + 
                        (this.networkData.forkNodes?.length || 0) + 
                        (this.networkData.joinNodes?.length || 0);
    return Math.max(0, this.networkData.nodeCount - specialNodes);
  }

  private calculateConnectivityAnalysis(): ConnectivityAnalysis {
    if (!this.networkData) {
      return {
        averageDegree: 0,
        maxDegree: 0,
        minDegree: 0,
        degreeVariance: 0,
        isolatedNodes: 0,
        stronglyConnectedComponents: 1
      };
    }

    const avgDegree = this.getAverageConnectivity();
    
    return {
      averageDegree: avgDegree,
      maxDegree: Math.max(this.networkData.forkNodes?.length || 0, this.networkData.joinNodes?.length || 0),
      minDegree: 0, // Source and sink nodes have 0 in/out degree respectively
      degreeVariance: this.calculateDegreeVariance(),
      isolatedNodes: this.calculateIsolatedNodes(),
      stronglyConnectedComponents: this.estimateStronglyConnectedComponents()
    };
  }

  private calculateDegreeDistribution(): { [degree: number]: number } {
    if (!this.networkData) return {};

    const distribution: { [degree: number]: number } = {};
    
    // Simplified degree calculation based on node types
    const sourceCount = this.networkData.sourceNodes?.length || 0;
    const sinkCount = this.networkData.sinkNodes?.length || 0;
    const forkCount = this.networkData.forkNodes?.length || 0;
    const joinCount = this.networkData.joinNodes?.length || 0;
    const intermediateCount = this.calculateIntermediateNodes();

    if (sourceCount > 0) distribution[1] = sourceCount; // Sources have out-degree 1+
    if (sinkCount > 0) distribution[1] = (distribution[1] || 0) + sinkCount; // Sinks have in-degree 1+
    if (intermediateCount > 0) distribution[2] = intermediateCount; // Intermediate nodes typically have degree 2
    if (forkCount > 0) distribution[3] = forkCount; // Fork nodes have higher out-degree
    if (joinCount > 0) distribution[3] = (distribution[3] || 0) + joinCount; // Join nodes have higher in-degree

    return distribution;
  }

  private calculateDegreeVariance(): number {
    // Simplified variance calculation
    const avgDegree = this.getAverageConnectivity();
    return Math.round(avgDegree * 0.5 * 100) / 100; // Approximation
  }

  private calculateIsolatedNodes(): number {
    // Nodes that are neither sources, sinks, forks, nor joins might be isolated
    return 0; // In a connected graph, this should typically be 0
  }

  private estimateStronglyConnectedComponents(): number {
    // Simplified estimation based on structure
    const hasMultipleSources = (this.networkData?.sourceNodes?.length || 0) > 1;
    const hasMultipleSinks = (this.networkData?.sinkNodes?.length || 0) > 1;
    
    if (hasMultipleSources || hasMultipleSinks) {
      return Math.max(2, Math.ceil(this.networkData?.nodeCount || 0 / 10));
    }
    return 1;
  }

  // Enhanced calculation methods
  getGraphDensity(): number {
    if (!this.networkData) return 0;
    const maxPossibleEdges = this.networkData.nodeCount * (this.networkData.nodeCount - 1);
    return maxPossibleEdges > 0 ? Math.round((this.networkData.edgeCount / maxPossibleEdges) * 10000) / 100 : 0;
  }

  getAverageConnectivity(): number {
    if (!this.networkData || this.networkData.nodeCount === 0) return 0;
    return Math.round((this.networkData.edgeCount / this.networkData.nodeCount) * 100) / 100;
  }

  getBranchingFactor(): number {
    if (!this.networkData) return 0;
    const forkCount = this.networkData.forkNodes?.length || 0;
    if (forkCount === 0) return 0;
    // Approximate branching factor (simplified calculation)
    return Math.round((this.networkData.edgeCount / Math.max(forkCount, 1)) * 100) / 100;
  }

  getConvergenceFactor(): number {
    if (!this.networkData) return 0;
    const joinCount = this.networkData.joinNodes?.length || 0;
    if (joinCount === 0) return 0;
    // Approximate convergence factor (simplified calculation)
    return Math.round((this.networkData.edgeCount / Math.max(joinCount, 1)) * 100) / 100;
  }

  hasComplexStructure(): boolean {
    if (!this.networkData) return false;
    const forkCount = this.networkData.forkNodes?.length || 0;
    const joinCount = this.networkData.joinNodes?.length || 0;
    return forkCount > 0 && joinCount > 0;
  }

  getComplexityScore(): string {
    if (!this.networkData) return 'Unknown';
    
    const density = this.getGraphDensity();
    const hasComplex = this.hasComplexStructure();
    
    if (density < 5 && !hasComplex) return 'Simple';
    if (density < 15 && hasComplex) return 'Moderate';
    if (density < 30) return 'Complex';
    return 'Very Complex';
  }

  getComplexityNumericScore(): number {
    const complexity = this.getComplexityScore();
    switch (complexity) {
      case 'Simple': return 25;
      case 'Moderate': return 50;
      case 'Complex': return 75;
      case 'Very Complex': return 100;
      default: return 0;
    }
  }

  // Navigation methods
  navigateToUpload(): void {
    this.router.navigate(['/upload']);
  }

  navigateToVisualization(): void {
    this.router.navigate(['/visualization']);
  }

  navigateToDiamonds(): void {
    this.router.navigate(['/diamonds']);
  }

  // Analysis methods
  private async runStructureAnalysis(): Promise<void> {
    const currentFile = this.dataService.getCurrentFile();
    if (!currentFile) {
      this.router.navigate(['/upload']);
      return;
    }

    try {
      this.dataService.setLoading(true);
      this.dataService.clearError();

      const csvContent = await this.readFileAsText(currentFile);
      
      const response = await fetch('http://localhost:8080/api/parse-structure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ csvContent })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to process file');
      }

      this.dataService.setNetworkData(result.networkData);
      this.dataService.setOriginalData(result.originalData);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to run structure analysis';
      this.dataService.setError(errorMessage);
    } finally {
      this.dataService.setLoading(false);
    }
  }

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  // Export functionality
  exportStructureData(): void {
    if (!this.networkData) return;

    const exportData = {
      timestamp: new Date().toISOString(),
      analysis: 'Enhanced Structure Analysis (Tier 1)',
      networkStatistics: {
        nodeCount: this.networkData.nodeCount,
        edgeCount: this.networkData.edgeCount,
        graphDensity: this.getGraphDensity(),
        averageConnectivity: this.getAverageConnectivity(),
        complexityScore: this.getComplexityScore(),
        branchingFactor: this.getBranchingFactor(),
        convergenceFactor: this.getConvergenceFactor()
      },
      nodeTypeStatistics: this.nodeTypeStatistics,
      networkMetrics: this.networkMetrics,
      connectivityAnalysis: this.connectivityAnalysis,
      structuralElements: {
        sourceNodes: this.networkData.sourceNodes,
        sinkNodes: this.networkData.sinkNodes,
        forkNodes: this.networkData.forkNodes,
        joinNodes: this.networkData.joinNodes
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enhanced-structure-analysis-${Date.now()}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  exportChartImages(): void {
    const charts = [
      { chart: this.nodeTypeChart, name: 'node-type-distribution' },
      { chart: this.connectivityChart, name: 'connectivity-analysis' },
      { chart: this.degreeDistributionChart, name: 'degree-distribution' }
    ];

    charts.forEach(({ chart, name }) => {
      if (chart) {
        const url = chart.toBase64Image();
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}-${Date.now()}.png`;
        a.click();
      }
    });
  }
}