import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonToggleModule, MatButtonToggleChange } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';

import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { DiamondAnalysisResult, RootDiamondStructure, UniqueDiamondStructure, BeliefValue } from '../../shared/models/network-analysis.models';
import { RootDiamondDialogComponent } from './root-diamond-dialog.component';
import { UniqueDiamondDialogComponent } from './unique-diamond-dialog.component';

interface RootDiamondRow {
  joinNode: number;
  conditioningNodes: number[];
  relevantNodes: number[];
  edgeCount: number;
  nodeCount: number;
  nonDiamondParents: number[];
  diamondData: RootDiamondStructure;
}

interface UniqueDiamondRow {
  diamondHash: string;
  isRootDiamond: boolean;
  nodeCount: number;
  subSources: number[];
  subForkNodes: number[];
  subJoinNodes: number[];
  iterationSetsCount: number;
  diamondData: UniqueDiamondStructure;
}

@Component({
  selector: 'app-diamond-analysis',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatTabsModule,
    MatButtonToggleModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatPaginatorModule,
    MatTooltipModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatDividerModule,
    FormsModule
  ],
  templateUrl: './diamond-analysis.component.html',
  styleUrls: ['./diamond-analysis.component.scss']
})
export class DiamondAnalysisComponent {
  private analysisState = inject(AnalysisStateService);
  private dialog = inject(MatDialog);

  // Core data signals
  diamondAnalysis = computed(() => {
    const response = this.analysisState.diamondAnalysis();
    return response?.diamond_analysis || null;
  });
  isLoading = computed(() => this.analysisState.isLoading());
  error = computed(() => this.analysisState.error());

  // View state
  currentView = signal<'overview' | 'root-diamonds' | 'unique-diamonds' | 'network'>('overview');
  
  // Selection state
  selectedDiamondId = signal<string | null>(null);
  
  // Pagination for root diamonds
  rootDiamondPageSize = signal(25);
  rootDiamondPageIndex = signal(0);
  
  // Pagination for unique diamonds
  uniqueDiamondPageSize = signal(25);
  uniqueDiamondPageIndex = signal(0);

  // Filters
  rootDiamondSearchTerm = signal('');
  uniqueDiamondSearchTerm = signal('');
  selectedRootFilters = signal<string[]>([]);
  selectedUniqueFilters = signal<string[]>([]);

  // Table columns
  rootDiamondColumns = ['joinNode', 'nodeCount', 'edgeCount', 'conditioningNodes', 'actions'];
  uniqueDiamondColumns = ['diamondHash', 'nodeCount', 'isRoot', 'subComponents', 'actions'];

  // Computed properties for dashboard
  diamondSummary = computed(() => {
    const data = this.diamondAnalysis();
    if (!data) return null;

    return {
      rootDiamondsCount: data.root_diamonds_count,
      uniqueDiamondsCount: data.unique_diamonds_count,
      joinNodesWithDiamonds: data.join_nodes_with_diamonds?.length || 0,
      diamondEfficiency: data.diamond_efficiency,
      totalComputationTime: data.total_computation_time,
      rootComputationTime: data.root_computation_time,
      uniqueComputationTime: data.unique_computation_time
    };
  });

  // Network statistics
  networkStats = computed(() => {
    const data = this.diamondAnalysis();
    if (!data) return null;

    return {
      totalNodes: data.join_nodes_with_diamonds?.length || 0,
      totalEdges: data.root_diamonds_count || 0,
      totalDiamonds: data.root_diamonds_count || 0,
      diamondCoverage: data.diamond_efficiency || 0,
      computationTime: data.total_computation_time || 0
    };
  });

  // Visualization state
  hasVisualizationData = computed(() => {
    const data = this.diamondAnalysis();
    return !!data && (data.root_diamonds_count > 0 || data.unique_diamonds_count > 0);
  });

  // Visualization toggles
  showRootDiamonds = signal(true);
  showUniqueDiamonds = signal(true);
  highlightConditioningNodes = signal(false);

  // Diamond insights
  diamondInsights = computed(() => {
    const data = this.diamondAnalysis();
    if (!data) return [];

    const insights: Array<{type: 'info' | 'warning' | 'success', message: string, detail: string}> = [];
    
    const rootCount = data.root_diamonds_count;
    const uniqueCount = data.unique_diamonds_count;
    const efficiency = data.diamond_efficiency;
    const joinNodes = data.join_nodes_with_diamonds?.length || 0;

    // Diamond efficiency analysis
    if (efficiency > 0.8) {
      insights.push({
        type: 'success',
        message: `High Diamond Efficiency (${(efficiency * 100).toFixed(1)}%)`,
        detail: 'Excellent diamond structure optimization - significant computational savings expected'
      });
    } else if (efficiency > 0.5) {
      insights.push({
        type: 'info',
        message: `Moderate Diamond Efficiency (${(efficiency * 100).toFixed(1)}%)`,
        detail: 'Good diamond structure - reasonable computational optimization'
      });
    } else if (efficiency < 0.3) {
      insights.push({
        type: 'warning',
        message: `Low Diamond Efficiency (${(efficiency * 100).toFixed(1)}%)`,
        detail: 'Limited diamond optimization - consider network restructuring'
      });
    }

    // Root vs unique diamonds ratio
    const reusabilityRatio = rootCount > 0 ? uniqueCount / rootCount : 0;
    if (reusabilityRatio < 0.5) {
      insights.push({
        type: 'success',
        message: 'High Diamond Reusability',
        detail: `${rootCount} root diamonds share ${uniqueCount} unique structures - excellent optimization`
      });
    } else if (reusabilityRatio > 1.5) {
      insights.push({
        type: 'info',
        message: 'Low Diamond Reusability',
        detail: `Many unique diamond structures - less sharing than optimal`
      });
    }

    // Join node coverage
    if (joinNodes === 0) {
      insights.push({
        type: 'warning',
        message: 'No Diamond Structures Found',
        detail: 'Network lacks diamond patterns - sequential analysis only'
      });
    } else if (joinNodes < 5) {
      insights.push({
        type: 'info',
        message: `Limited Diamond Coverage (${joinNodes} join nodes)`,
        detail: 'Few diamond structures found - mostly linear network topology'
      });
    } else {
      insights.push({
        type: 'success',
        message: `Good Diamond Coverage (${joinNodes} join nodes)`,
        detail: 'Multiple diamond structures available for optimization'
      });
    }

    return insights;
  });

  // Root diamond details for table
  rootDiamondDetails = computed(() => {
    const data = this.diamondAnalysis();
    if (!data?.raw_root_diamonds) return [];

    return Object.entries(data.raw_root_diamonds).map(([key, diamond]) => ({
      joinNode: diamond.join_node,
      conditioningNodes: diamond.diamond.conditioning_nodes,
      relevantNodes: diamond.diamond.relevant_nodes,
      edgeCount: diamond.diamond.edge_count,
      nodeCount: diamond.diamond.node_count,
      nonDiamondParents: diamond.non_diamond_parents,
      diamondData: diamond
    } as RootDiamondRow)).sort((a, b) => a.joinNode - b.joinNode);
  });

  // Unique diamond details for table
  uniqueDiamondDetails = computed(() => {
    const data = this.diamondAnalysis();
    if (!data?.raw_unique_diamonds) return [];

    return Object.entries(data.raw_unique_diamonds).map(([hash, diamond]) => ({
      diamondHash: hash,
      isRootDiamond: diamond.is_root_diamond,
      nodeCount: diamond.node_count,
      subSources: diamond.sub_sources,
      subForkNodes: diamond.sub_fork_nodes,
      subJoinNodes: diamond.sub_join_nodes,
      iterationSetsCount: diamond.sub_iteration_sets_count,
      diamondData: diamond
    } as UniqueDiamondRow)).sort((a, b) => a.nodeCount - b.nodeCount);
  });

  // Filtered and paginated data for root diamonds
  filteredRootDiamondDetails = computed(() => {
    const diamonds = this.rootDiamondDetails();
    const searchTerm = this.rootDiamondSearchTerm().toLowerCase();
    const selectedFilters = this.selectedRootFilters();

    return diamonds.filter(diamond => {
      const matchesSearch = !searchTerm || 
        diamond.joinNode.toString().includes(searchTerm) ||
        diamond.conditioningNodes.some(n => n.toString().includes(searchTerm));
      
      const matchesFilter = selectedFilters.length === 0 || 
        (selectedFilters.includes('large') && diamond.nodeCount > 10) ||
        (selectedFilters.includes('small') && diamond.nodeCount <= 10) ||
        (selectedFilters.includes('complex') && diamond.edgeCount > diamond.nodeCount * 1.5) ||
        (selectedFilters.includes('simple') && diamond.edgeCount <= diamond.nodeCount * 1.5);
        
      return matchesSearch && matchesFilter;
    });
  });

  paginatedRootDiamondDetails = computed(() => {
    const filtered = this.filteredRootDiamondDetails();
    const pageSize = this.rootDiamondPageSize();
    const pageIndex = this.rootDiamondPageIndex();
    const start = pageIndex * pageSize;
    return filtered.slice(start, start + pageSize);
  });

  // Filtered and paginated data for unique diamonds
  filteredUniqueDiamondDetails = computed(() => {
    const diamonds = this.uniqueDiamondDetails();
    const searchTerm = this.uniqueDiamondSearchTerm().toLowerCase();
    const selectedFilters = this.selectedUniqueFilters();

    return diamonds.filter(diamond => {
      const matchesSearch = !searchTerm || 
        diamond.diamondHash.toLowerCase().includes(searchTerm) ||
        diamond.subSources.some(n => n.toString().includes(searchTerm));
      
      const matchesFilter = selectedFilters.length === 0 || 
        (selectedFilters.includes('root') && diamond.isRootDiamond) ||
        (selectedFilters.includes('derived') && !diamond.isRootDiamond) ||
        (selectedFilters.includes('large') && diamond.nodeCount > 10) ||
        (selectedFilters.includes('small') && diamond.nodeCount <= 10);
        
      return matchesSearch && matchesFilter;
    });
  });

  paginatedUniqueDiamondDetails = computed(() => {
    const filtered = this.filteredUniqueDiamondDetails();
    const pageSize = this.uniqueDiamondPageSize();
    const pageIndex = this.uniqueDiamondPageIndex();
    const start = pageIndex * pageSize;
    return filtered.slice(start, start + pageSize);
  });

  // Event handlers
  switchView(event: MatButtonToggleChange): void {
    this.currentView.set(event.value as 'overview' | 'root-diamonds' | 'unique-diamonds' | 'network');
  }

  onRootDiamondPageChange(event: PageEvent): void {
    this.rootDiamondPageIndex.set(event.pageIndex);
    this.rootDiamondPageSize.set(event.pageSize);
  }

  onUniqueDiamondPageChange(event: PageEvent): void {
    this.uniqueDiamondPageIndex.set(event.pageIndex);
    this.uniqueDiamondPageSize.set(event.pageSize);
  }

  onRootDiamondSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.rootDiamondSearchTerm.set(target.value);
    this.rootDiamondPageIndex.set(0);
  }

  onUniqueDiamondSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.uniqueDiamondSearchTerm.set(target.value);
    this.uniqueDiamondPageIndex.set(0);
  }

  onRootDiamondFilter(filters: string[]): void {
    this.selectedRootFilters.set(filters);
    this.rootDiamondPageIndex.set(0);
  }

  onUniqueDiamondFilter(filters: string[]): void {
    this.selectedUniqueFilters.set(filters);
    this.uniqueDiamondPageIndex.set(0);
  }

  // Dialog methods
  openRootDiamondDialog(diamond: RootDiamondRow): void {
    const dialogRef = this.dialog.open(RootDiamondDialogComponent, {
      width: '800px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: {
        diamond: diamond.diamondData,
        joinNode: diamond.joinNode
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.navigateToNode) {
        // Could implement navigation to network structure if needed
        console.log('Navigate to node:', result.navigateToNode);
      }
    });
  }

  openUniqueDiamondDialog(diamond: UniqueDiamondRow): void {
    const dialogRef = this.dialog.open(UniqueDiamondDialogComponent, {
      width: '1200px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: {
        diamond: diamond.diamondData,
        diamondHash: diamond.diamondHash
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.navigateToDiamond) {
        // Recursive navigation - open another unique diamond dialog
        const targetDiamond = this.uniqueDiamondDetails().find(d => 
          d.diamondHash === result.navigateToDiamond
        );
        if (targetDiamond) {
          this.openUniqueDiamondDialog(targetDiamond);
        }
      }
    });
  }

  // Helper methods
  formatDiamondHash(hash: string): string {
    return hash.substring(0, 8) + '...';
  }

  formatNodeList(nodes: number[]): string {
    if (nodes.length <= 3) {
      return nodes.join(', ');
    }
    return `${nodes.slice(0, 3).join(', ')} (+${nodes.length - 3} more)`;
  }

  retryAnalysis(): void {
    console.log('Retrying diamond analysis...');
    
    const currentNetworkPath = this.analysisState.currentNetworkPath();
    if (currentNetworkPath) {
      // Try to reload diamond analysis using individual endpoint
      this.analysisState.loadDiamondAnalysis(currentNetworkPath, true).subscribe({
        next: () => {
          console.log('✅ Diamond analysis retry successful');
        },
        error: (error) => {
          console.error('❌ Diamond analysis retry failed:', error);
        }
      });
    } else {
      console.warn('⚠️ No current network path available for retry');
    }
  }

  getEfficiencyColor(efficiency: number): string {
    if (efficiency > 0.8) return 'success';
    if (efficiency > 0.5) return 'primary';
    return 'warn';
  }

  getEfficiencyIcon(efficiency: number): string {
    if (efficiency > 0.8) return 'verified';
    if (efficiency > 0.5) return 'check_circle';
    return 'warning';
  }

  // Visualization toggle methods
  toggleRootDiamonds(): void {
    this.showRootDiamonds.update(value => !value);
  }

  toggleUniqueDiamonds(): void {
    this.showUniqueDiamonds.update(value => !value);
  }

  toggleConditioningHighlight(): void {
    this.highlightConditioningNodes.update(value => !value);
  }

  // Visualization control methods
  centerGraph(): void {
    console.log('Center graph visualization');
    // Implementation would center the graph visualization
  }

  restartSimulation(): void {
    console.log('Restart simulation');
    // Implementation would restart the force simulation
  }
}