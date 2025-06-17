import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';

import { DataService, NetworkData } from '../../services/data.service';
import { Router } from '@angular/router';

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
    MatTooltipModule
  ],
  templateUrl: './structure.component.html',
  styleUrls: ['./structure.component.scss']
})
export class StructureComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private dataService = inject(DataService);
  private router = inject(Router);

  // Component state
  networkData: NetworkData | null = null;
  isLoading = false;
  error: string | null = null;

  // Display data for tables
  displayedNodeColumns: string[] = ['type', 'count', 'percentage'];
  nodeTypeData: {
    type: string;
    count: number;
    percentage: number;
    color: string;
  }[] = [];

  ngOnInit(): void {
    // Subscribe to data service observables
    this.dataService.networkData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.networkData = data;
        if (data) {
          this.prepareDisplayData();
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private prepareDisplayData(): void {
    if (!this.networkData) return;

    const totalNodes = this.networkData.nodeCount;
    
    this.nodeTypeData = [
      {
        type: 'Source Nodes',
        count: this.networkData.sourceNodes?.length || 0,
        percentage: this.calculatePercentage(this.networkData.sourceNodes?.length || 0, totalNodes),
        color: '#4caf50'
      },
      {
        type: 'Sink Nodes', 
        count: this.networkData.sinkNodes?.length || 0,
        percentage: this.calculatePercentage(this.networkData.sinkNodes?.length || 0, totalNodes),
        color: '#f44336'
      },
      {
        type: 'Fork Nodes',
        count: this.networkData.forkNodes?.length || 0,
        percentage: this.calculatePercentage(this.networkData.forkNodes?.length || 0, totalNodes),
        color: '#ff9800'
      },
      {
        type: 'Join Nodes',
        count: this.networkData.joinNodes?.length || 0,
        percentage: this.calculatePercentage(this.networkData.joinNodes?.length || 0, totalNodes),
        color: '#9c27b0'
      }
    ];
  }

  private calculatePercentage(count: number, total: number): number {
    return total > 0 ? Math.round((count / total) * 100) : 0;
  }

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
      const errorMessage = error instanceof Error ? error.message : 'Failed to analyze structure';
      this.dataService.setError(errorMessage);
    } finally {
      this.dataService.setLoading(false);
    }
  }

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  // Navigation methods
  navigateToUpload(): void {
    this.router.navigate(['/upload']);
  }

  navigateToVisualization(): void {
    this.router.navigate(['/visualization']);
  }

  async runDiamondAnalysis(): Promise<void> {
    const currentFile = this.dataService.getCurrentFile();
    if (!currentFile || !this.networkData) {
      return;
    }

    try {
      this.dataService.setLoading(true);
      
      const csvContent = await this.readFileAsText(currentFile);
      
      const response = await fetch('http://localhost:8080/api/analyze-diamond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ csvContent })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to run diamond analysis');
      }

      this.dataService.setDiamondData(result.diamondData);
      this.router.navigate(['/diamonds']);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to run diamond analysis';
      this.dataService.setError(errorMessage);
    } finally {
      this.dataService.setLoading(false);
    }
  }

  // Utility methods
  getGraphDensity(): number {
    if (!this.networkData) return 0;
    const maxPossibleEdges = this.networkData.nodeCount * (this.networkData.nodeCount - 1);
    return maxPossibleEdges > 0 ? Math.round((this.networkData.edgeCount / maxPossibleEdges) * 10000) / 100 : 0;
  }

  getAverageConnectivity(): number {
    if (!this.networkData || this.networkData.nodeCount === 0) return 0;
    return Math.round((this.networkData.edgeCount / this.networkData.nodeCount) * 100) / 100;
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

  exportStructureData(): void {
    if (!this.networkData) return;

    const exportData = {
      timestamp: new Date().toISOString(),
      analysis: 'Structure Analysis (Tier 1)',
      networkStatistics: {
        nodeCount: this.networkData.nodeCount,
        edgeCount: this.networkData.edgeCount,
        graphDensity: this.getGraphDensity(),
        averageConnectivity: this.getAverageConnectivity(),
        complexityScore: this.getComplexityScore()
      },
      nodeTypes: this.nodeTypeData,
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
    a.download = `structure-analysis-${Date.now()}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}