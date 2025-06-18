import { Component, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSliderModule } from '@angular/material/slider';
import { MatTableModule } from '@angular/material/table';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';

import { GraphStateService } from '../../services/graph-state-service';
import { MainServerService } from '../../services/main-server-service';
import { DiamondClassification, DiamondStructureData, DiamondAnalysisResponse } from '../../shared/models/main-sever-interface';
import { DiamondPathAnalysisModalComponent } from './diamond-modal';
import { DiamondDetailModalComponent } from './diamond-detail-modal';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';


interface DiamondSummary {
  totalDiamonds: number;
  complexDiamonds: number;
  averageComplexity: number;
  maxPathCount: number;
}

interface DiamondListItem extends DiamondClassification {
  diamondStructure: DiamondStructureData;
}

interface AnalysisMetadata {
  analysisTime: Date;
  nodeCount: number;
  edgeCount: number;
  processingTimeMs: number;
  confidenceScore: number;
  completenessPercentage: number;
}

@Component({
  selector: 'app-diamond-analysis',
  standalone: true,
  imports: [
    CommonModule, MatCardModule, MatIconModule, MatButtonModule,
    MatSelectModule, MatCheckboxModule, MatSliderModule, MatTableModule,
    MatDialogModule, MatTabsModule, MatProgressBarModule, MatProgressSpinnerModule,
    MatSnackBarModule, FormsModule, RouterModule, MatTooltipModule, MatChipsModule
  ],
  templateUrl: './diamond-analysis.html',
  styleUrl: './diamond-analysis.scss',
})
export class DiamondAnalysisComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private graphStateService = inject(GraphStateService);
  private mainServerService = inject(MainServerService);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  // Task 4.1: Add Diamond Analysis State
  isRunningDiamondAnalysis = signal(false);
  diamondAnalysisResult = signal<DiamondAnalysisResponse | null>(null);
  analysisProgress = signal(0);
  analysisStep = signal<string>('');
  lastDiamondAnalysisTime = signal<Date | null>(null);
  analysisMetadata = signal<AnalysisMetadata | null>(null);

  // Existing signals
  isLoading = signal(false);
  error = signal<string | null>(null);
  diamondSummary = signal<DiamondSummary>({ totalDiamonds: 0, complexDiamonds: 0, averageComplexity: 0, maxPathCount: 0 });
  diamondList = signal<DiamondListItem[]>([]);
  filteredDiamonds = signal<DiamondListItem[]>([]);
  
  // Filters
  typeFilter = signal('all');
  forkStructureFilter = signal('all');
  sortBy = signal('complexity');

  // Computed
  hasGraphData = computed(() => this.graphStateService.isGraphLoaded());
  hasDiamonds = computed(() => this.graphStateService.hasDiamonds());
  
  // Task 4.2: Analysis State Tracking
  hasRunDiamondAnalysis = computed(() => this.lastDiamondAnalysisTime() !== null);
  canRunDiamondAnalysis = computed(() => this.hasGraphData() && !this.isRunningDiamondAnalysis());

  // Task 4.3: Enhanced Diamond Analysis Results
  analysisResultsSummary = computed(() => {
    const result = this.diamondAnalysisResult();
    const metadata = this.analysisMetadata();
    
    if (!result || !metadata) return null;
    
    return {
      totalDiamondsFound: result.diamondData?.diamondClassifications?.length || 0,
      complexityDistribution: this.calculateComplexityDistribution(result.diamondData?.diamondClassifications || []),
      analysisCompleteness: metadata.completenessPercentage,
      confidenceScore: metadata.confidenceScore,
      processingTime: metadata.processingTimeMs
    };
  });

  // Expose Object and Math to template
  protected readonly Object = Object;
  protected readonly Math = Math;

  // Setup filter effects in constructor (injection context)
  constructor() {
    effect(() => {
      this.typeFilter();
      this.forkStructureFilter();
      this.sortBy();
      this.applyFilters();
    });
  }

  ngOnInit() {
    this.loadDiamondData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Task 4.1: Implement Diamond Analysis Method
  async runDiamondAnalysis(): Promise<void> {
    if (!this.canRunDiamondAnalysis()) {
      return;
    }

    this.isRunningDiamondAnalysis.set(true);
    this.analysisProgress.set(0);
    this.error.set(null);

    const startTime = Date.now();

    try {
      // Task 4.4: Progress indicators with steps
      this.analysisStep.set('Initializing diamond analysis...');
      this.analysisProgress.set(15);
      await this.delay(300);

      this.analysisStep.set('Analyzing diamond structures...');
      this.analysisProgress.set(40);

      const result = await this.graphStateService.runDiamondAnalysis({
        message: 'Running comprehensive diamond structure analysis...',
        showCancelButton: true
      });

      this.analysisStep.set('Processing classification data...');
      this.analysisProgress.set(75);
      await this.delay(200);

      if (result.success && result.result) {
        this.diamondAnalysisResult.set(result.result);
        this.lastDiamondAnalysisTime.set(new Date());
        
        // Task 4.4: Generate analysis metadata
        const endTime = Date.now();
        const processingTime = endTime - startTime;
        
        const metadata: AnalysisMetadata = {
          analysisTime: new Date(),
          nodeCount: this.graphStateService.nodeCount(),
          edgeCount: this.graphStateService.edgeCount(),
          processingTimeMs: processingTime,
          confidenceScore: this.calculateConfidenceScore(result.result),
          completenessPercentage: this.calculateCompletenessPercentage(result.result)
        };
        this.analysisMetadata.set(metadata);

        this.analysisStep.set('Analysis complete!');
        this.analysisProgress.set(100);

        // Update diamond data from fresh analysis
        this.updateDiamondDataFromAnalysis(result.result);

        // Task 4.3: Enhanced success feedback
        const diamondCount = result.result.diamondData?.diamondClassifications?.length || 0;
        const analysisTime = new Date().toLocaleTimeString();
        
        this.snackBar.open(
          `Diamond analysis completed! Found ${diamondCount} diamond structures at ${analysisTime}`,
          'View Details',
          { duration: 6000 }
        ).onAction().subscribe(() => {
          // Scroll to results or open detailed view
          const resultsElement = document.querySelector('.diamond-analysis-results');
          if (resultsElement) {
            resultsElement.scrollIntoView({ behavior: 'smooth' });
          }
        });

        // Reset progress after delay
        setTimeout(() => {
          this.analysisProgress.set(0);
          this.analysisStep.set('');
        }, 2000);

      } else {
        this.error.set(result.error || 'Diamond analysis failed');
        this.snackBar.open(`Diamond analysis failed: ${result.error}`, 'Close', {
          duration: 5000
        });
      }

    } catch (analysisError) {
      console.error('Diamond analysis error:', analysisError);
      this.error.set('Diamond analysis failed due to an unexpected error');
      this.snackBar.open('Diamond analysis failed due to an unexpected error', 'Close', {
        duration: 5000
      });
    } finally {
      this.isRunningDiamondAnalysis.set(false);
      setTimeout(() => {
        this.analysisProgress.set(0);
        this.analysisStep.set('');
      }, 1000);
    }
  }

  // Task 4.2: Dynamic Button Text Method
  getDiamondAnalysisButtonText(): string {
    if (this.isRunningDiamondAnalysis()) {
      return 'Diamond Analysis Running...';
    }
    
    if (this.hasRunDiamondAnalysis()) {
      return 'Re-run Diamond Analysis';
    }
    
    return 'Run Diamond Analysis';
  }

  // Task 4.3: Update Diamond Data from Fresh Analysis
  private updateDiamondDataFromAnalysis(result: DiamondAnalysisResponse): void {
    if (!result.diamondData) {
      this.diamondList.set([]);
      this.updateSummary([]);
      this.applyFilters();
      return;
    }

    const classifications = result.diamondData.diamondClassifications || [];
    const structures = result.diamondData.diamondStructures || {};

    // Build diamond list from fresh analysis
    const diamonds: DiamondListItem[] = classifications.map(classification => ({
      ...classification,
      diamondStructure: structures[classification.join_node.toString()]
    })).filter(item => item.diamondStructure);

    this.diamondList.set(diamonds);
    this.updateSummary(diamonds);
    this.applyFilters();
  }

  // Task 4.4: Calculate Analysis Metrics
  private calculateConfidenceScore(result: DiamondAnalysisResponse): number {
    // Calculate confidence based on data completeness and consistency
    if (!result.diamondData) return 0;
    
    const classifications = result.diamondData.diamondClassifications || [];
    const structures = result.diamondData.diamondStructures || {};
    
    // Base confidence on completeness of data
    let confidence = 0.7; // Base confidence
    
    // Boost confidence if all classifications have corresponding structures
    const structureCompleteness = classifications.length > 0 
      ? classifications.filter(c => structures[c.join_node.toString()]).length / classifications.length
      : 1;
    
    confidence += structureCompleteness * 0.3;
    
    return Math.round(confidence * 100);
  }

  private calculateCompletenessPercentage(result: DiamondAnalysisResponse): number {
    // Calculate how complete the analysis is based on expected vs found structures
    if (!result.diamondData) return 0;
    
    const nodeCount = this.graphStateService.nodeCount();
    const edgeCount = this.graphStateService.edgeCount();
    const joinNodeCount = this.graphStateService.joinNodeCount();
    const diamondCount = result.diamondData.diamondClassifications?.length || 0;
    
    // Estimate expected diamond structures based on network topology
    const expectedDiamonds = Math.min(joinNodeCount, Math.floor(nodeCount * 0.1));
    
    if (expectedDiamonds === 0) return 100;
    
    const completeness = Math.min(diamondCount / expectedDiamonds, 1) * 100;
    return Math.round(completeness);
  }

  private calculateComplexityDistribution(classifications: DiamondClassification[]): { [key: string]: number } {
    const distribution: { [key: string]: number } = {
      'Low (0-5)': 0,
      'Medium (5-10)': 0,
      'High (10+)': 0
    };

    classifications.forEach(diamond => {
      if (diamond.complexity_score < 5) {
        distribution['Low (0-5)']++;
      } else if (diamond.complexity_score < 10) {
        distribution['Medium (5-10)']++;
      } else {
        distribution['High (10+)']++;
      }
    });

    return distribution;
  }

  private loadDiamondData() {
    if (!this.hasGraphData()) {
      this.error.set('No graph data loaded. Please load a CSV file first.');
      return;
    }

    const structure = this.graphStateService.graphStructure();
    if (!structure?.diamond_structures) {
      this.error.set('No diamond structures found in current graph.');
      return;
    }

    const diamondData = structure.diamond_structures;
    const classifications = diamondData.diamondClassifications || [];
    const structures = diamondData.diamondStructures || {};

    // Build diamond list
    const diamonds: DiamondListItem[] = classifications.map(classification => ({
      ...classification,
      diamondStructure: structures[classification.join_node.toString()]
    })).filter(item => item.diamondStructure);

    this.diamondList.set(diamonds);
    this.updateSummary(diamonds);
    this.applyFilters();
  }

  private updateSummary(diamonds: DiamondListItem[]) {
    const total = diamonds.length;
    const complex = diamonds.filter(d => d.complexity_score > 10).length;
    const avgComplexity = total > 0 ? diamonds.reduce((sum, d) => sum + d.complexity_score, 0) / total : 0;
    const maxPaths = Math.max(...diamonds.map(d => d.path_count), 0);

    this.diamondSummary.set({
      totalDiamonds: total,
      complexDiamonds: complex,
      averageComplexity: Math.round(avgComplexity * 100) / 100,
      maxPathCount: maxPaths
    });
  }

  private applyFilters() {
    let filtered = [...this.diamondList()];

    // Type filter
    if (this.typeFilter() !== 'all') {
      filtered = filtered.filter(d => d.internal_structure === this.typeFilter());
    }

    // Fork structure filter
    if (this.forkStructureFilter() !== 'all') {
      filtered = filtered.filter(d => d.fork_structure === this.forkStructureFilter());
    }

    // Sort
    const sortBy = this.sortBy();
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'complexity':
          return b.complexity_score - a.complexity_score;
        case 'joinNode':
          return a.join_node - b.join_node;
        case 'size':
          return b.subgraph_size - a.subgraph_size;
        case 'pathCount':
          return b.path_count - a.path_count;
        default:
          return 0;
      }
    });

    this.filteredDiamonds.set(filtered);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  onTypeFilterChange(value: string) {
    this.typeFilter.set(value);
  }

  onForkStructureFilterChange(value: string) {
    this.forkStructureFilter.set(value);
  }

  onSortChange(value: string) {
    this.sortBy.set(value);
  }

  viewDiamondDetails(diamond: DiamondListItem) {
    const dialogRef = this.dialog.open(DiamondDetailModalComponent, {
      width: '90vw',
      maxWidth: '1000px',
      height: '85vh',
      data: {
        diamond: diamond
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'analyze') {
        // Open path analysis modal
        this.analyzeDiamondPath(diamond);
      }
    });
  }

  visualizeDiamond(diamond: DiamondListItem) {
    // Navigate to visualization tab with diamond highlighted
    this.router.navigate(['/visualization'], {
      queryParams: { focusDiamond: diamond.join_node }
    });
  }

  analyzeDiamondPath(diamond: DiamondListItem) {
    const dialogRef = this.dialog.open(DiamondPathAnalysisModalComponent, {
      width: '90vw',
      maxWidth: '1200px',
      height: '80vh',
      data: {
        diamond: diamond,
        graphStructure: this.graphStateService.graphStructure()
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        console.log('Diamond path analysis completed:', result);
      }
    });
  }

  getComplexityColor(score: number): string {
    if (score < 5) return 'green';
    if (score < 10) return 'orange';
    return 'red';
  }

  getRiskBadgeColor(risk: string | number | undefined): string {
    const riskStr = risk?.toString().toLowerCase() || 'low';
    switch (riskStr) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': case 'very_high': return 'danger';
      default: return 'secondary';
    }
  }
}