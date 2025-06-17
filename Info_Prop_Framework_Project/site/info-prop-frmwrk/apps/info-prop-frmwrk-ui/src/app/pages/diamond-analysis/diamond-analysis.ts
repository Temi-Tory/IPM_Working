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
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { GraphStateService } from '../../services/graph-state-service';
import { MainServerService } from '../../services/main-server-service';
import { DiamondClassification, DiamondStructureData, DiamondGroup, DiamondSubsetAnalysisRequest } from '../../shared/models/main-sever-interface';
import { DiamondPathAnalysisModalComponent } from './diamond-modal';


interface DiamondSummary {
  totalDiamonds: number;
  complexDiamonds: number;
  averageComplexity: number;
  maxPathCount: number;
}

interface DiamondListItem extends DiamondClassification {
  diamondStructure: DiamondStructureData;
}

@Component({
  selector: 'app-diamond-analysis',
  standalone: true,
  imports: [
    CommonModule, MatCardModule, MatIconModule, MatButtonModule,
    MatSelectModule, MatCheckboxModule, MatSliderModule, MatTableModule,
    MatDialogModule, MatTabsModule, FormsModule, RouterModule
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

  // Signals
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
    // Open diamond detail modal
    console.log('Diamond details:', diamond);
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

  getRiskBadgeColor(risk: string): string {
    switch (risk.toLowerCase()) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': case 'very_high': return 'danger';
      default: return 'secondary';
    }
  }
}