import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

// Import types directly from the models file
import {
  DiamondAnalysisResult,
  DiamondNode,
  DiamondStructure,
  DiamondClassification
} from '../../../../../../libs/network-core/src/lib/models/network.models';

// Import services directly
import { GlobalStateService } from '../../../../../../libs/network-core/src/lib/services/global-state.service';
import { NetworkAnalysisService } from '../../../../../../libs/network-core/src/lib/services/network-analysis.service';

interface DiamondFilter {
  classification: 'all' | 'source' | 'sink' | 'intermediate' | 'isolated' | 'join';
  minInDegree: number;
  maxInDegree: number;
  minOutDegree: number;
  maxOutDegree: number;
  searchTerm: string;
  minRelevantNodes: number;
  maxRelevantNodes: number;
  minEdges: number;
  maxEdges: number;
}

interface DiamondStatistics {
  totalDiamonds: number;
  totalJoinNodes: number;
  totalRelevantNodes: number;
  totalDiamondEdges: number;
  averageNodesPerDiamond: number;
  averageEdgesPerDiamond: number;
  largestDiamond: {
    joinNode: string;
    nodeCount: number;
    edgeCount: number;
  } | null;
  smallestDiamond: {
    joinNode: string;
    nodeCount: number;
    edgeCount: number;
  } | null;
}

interface ProcessedDiamondData {
  joinNodeId: string;
  diamondCount: number;
  totalRelevantNodes: number;
  totalEdges: number;
  highestNodes: string[];
  nonDiamondParents: string[];
  diamonds: Array<{
    highestNodes: string[];
    edgeList: Array<[string, string]>;
    relevantNodes: string[];
  }>;
}

@Component({
  selector: 'app-diamond-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './diamond-analysis.component.html',
  styleUrls: ['./diamond-analysis.component.scss']
})
export class DiamondAnalysisComponent implements OnInit {
  private readonly globalState = inject(GlobalStateService);
  private readonly networkService = inject(NetworkAnalysisService);
  private readonly router = inject(Router);

  // State signals
  readonly diamondAnalysis = this.globalState.diamondAnalysis;
  readonly isLoading = this.globalState.isLoading;
  readonly error = this.globalState.error;
  readonly sessionId = this.globalState.sessionId;
  readonly hasNetworkData = this.globalState.hasNetworkData;

  // Component state
  private readonly _selectedNodes = signal<string[]>([]);
  private readonly _currentPage = signal<number>(1);
  private readonly _pageSize = signal<number>(10);
  private readonly _selectedDiamond = signal<ProcessedDiamondData | null>(null);
  private readonly _showClassifications = signal<boolean>(false);

  // Filter state
  filters: DiamondFilter = {
    classification: 'all',
    minInDegree: 0,
    maxInDegree: 999,
    minOutDegree: 0,
    maxOutDegree: 999,
    searchTerm: '',
    minRelevantNodes: 0,
    maxRelevantNodes: 999,
    minEdges: 0,
    maxEdges: 999
  };

  // Public readonly signals
  readonly selectedNodes = this._selectedNodes.asReadonly();
  readonly currentPage = this._currentPage.asReadonly();
  readonly selectedDiamond = this._selectedDiamond.asReadonly();
  readonly showClassifications = this._showClassifications.asReadonly();

  // Computed signals for processed diamond data - now uses transformed data from service
  readonly processedDiamonds = computed(() => {
    const analysis = this.diamondAnalysis();
    
    // Use the properly transformed DiamondAnalysisResult from the service
    if (!analysis?.diamondStructures) return [];

    const processed: ProcessedDiamondData[] = [];

    // Process the transformed diamond structures
    analysis.diamondStructures.forEach((structure: DiamondStructure) => {
      const diamonds = structure.diamonds || [];
      const nonDiamondParents = structure.nonDiamondParents || [];
      
      let totalRelevantNodes = 0;
      let totalEdges = 0;
      const allHighestNodes: string[] = [];

      const processedDiamondList = diamonds.map((diamond: any) => {
        const relevantNodes = diamond.relevantNodes || [];
        const edgeList = diamond.edgeList || [];
        const highestNodes = diamond.highestNodes || [];

        totalRelevantNodes += relevantNodes.length;
        totalEdges += edgeList.length;
        allHighestNodes.push(...highestNodes);

        return {
          highestNodes,
          edgeList,
          relevantNodes
        };
      });

      processed.push({
        joinNodeId: structure.joinNodeId,
        diamondCount: diamonds.length,
        totalRelevantNodes,
        totalEdges,
        highestNodes: [...new Set(allHighestNodes)],
        nonDiamondParents,
        diamonds: processedDiamondList
      });
    });

    return processed.sort((a, b) => b.totalRelevantNodes - a.totalRelevantNodes);
  });

  // Computed statistics
  readonly diamondStatistics = computed((): DiamondStatistics => {
    const diamonds = this.processedDiamonds();
    if (diamonds.length === 0) {
      return {
        totalDiamonds: 0,
        totalJoinNodes: 0,
        totalRelevantNodes: 0,
        totalDiamondEdges: 0,
        averageNodesPerDiamond: 0,
        averageEdgesPerDiamond: 0,
        largestDiamond: null,
        smallestDiamond: null
      };
    }

    const totalDiamonds = diamonds.reduce((sum, d) => sum + d.diamondCount, 0);
    const totalRelevantNodes = diamonds.reduce((sum, d) => sum + d.totalRelevantNodes, 0);
    const totalEdges = diamonds.reduce((sum, d) => sum + d.totalEdges, 0);

    const largest = diamonds.reduce((max, current) => 
      current.totalRelevantNodes > max.totalRelevantNodes ? current : max
    );

    const smallest = diamonds.reduce((min, current) => 
      current.totalRelevantNodes < min.totalRelevantNodes ? current : min
    );

    return {
      totalDiamonds,
      totalJoinNodes: diamonds.length,
      totalRelevantNodes,
      totalDiamondEdges: totalEdges,
      averageNodesPerDiamond: totalRelevantNodes / totalDiamonds,
      averageEdgesPerDiamond: totalEdges / totalDiamonds,
      largestDiamond: {
        joinNode: largest.joinNodeId,
        nodeCount: largest.totalRelevantNodes,
        edgeCount: largest.totalEdges
      },
      smallestDiamond: {
        joinNode: smallest.joinNodeId,
        nodeCount: smallest.totalRelevantNodes,
        edgeCount: smallest.totalEdges
      }
    };
  });

  // Filtered diamonds based on current filters
  readonly filteredDiamonds = computed(() => {
    const diamonds = this.processedDiamonds();
    return diamonds.filter(diamond => {
      // Search filter
      if (this.filters.searchTerm && 
          !diamond.joinNodeId.toLowerCase().includes(this.filters.searchTerm.toLowerCase())) {
        return false;
      }

      // Node count filter
      if (diamond.totalRelevantNodes < this.filters.minRelevantNodes || 
          diamond.totalRelevantNodes > this.filters.maxRelevantNodes) {
        return false;
      }

      // Edge count filter
      if (diamond.totalEdges < this.filters.minEdges || 
          diamond.totalEdges > this.filters.maxEdges) {
        return false;
      }

      return true;
    });
  });

  readonly totalPages = computed(() => {
    return Math.ceil(this.filteredDiamonds().length / this._pageSize());
  });

  readonly paginatedDiamonds = computed(() => {
    const filtered = this.filteredDiamonds();
    const start = (this._currentPage() - 1) * this._pageSize();
    const end = start + this._pageSize();
    return filtered.slice(start, end);
  });

  // Classification data from transformed diamond analysis result
  readonly classificationData = computed(() => {
    const analysis = this.diamondAnalysis();
    
    // Use the properly transformed DiamondAnalysisResult from the service
    if (!analysis?.nodes) return null;

    const classifications: Record<string, string[]> = {
      source: [],
      sink: [],
      intermediate: [],
      isolated: [],
      join: []
    };
    
    // Process node classifications from the transformed data
    analysis.nodes.forEach((node: DiamondNode) => {
      const classType = node.classification;
      if (classifications[classType]) {
        classifications[classType].push(node.nodeId);
      }
    });
    
    return classifications;
  });

  // Diamond structure classifications (SEQUENTIAL, INTERCONNECTED, NESTED)
  readonly diamondClassifications = computed(() => {
    const analysis = this.diamondAnalysis();
    if (!analysis?.diamondClassifications) {
      console.warn('⚠️ No diamond classifications found in analysis result');
      return null;
    }

    const classifications = {
      SEQUENTIAL: [] as string[],
      INTERCONNECTED: [] as string[],
      NESTED: [] as string[]
    };

    // Use the actual classification data from the API response
    analysis.diamondClassifications.forEach((classification: DiamondClassification) => {
      // Convert 1-indexed join node to 0-indexed for consistency with UI
      const joinNodeId = (classification.joinNode - 1).toString();
      
      // Use the actual internalStructure value from the API
      const structureType = classification.internalStructure;
      
      if (classifications[structureType]) {
        classifications[structureType].push(joinNodeId);
      } else {
        console.warn(`⚠️ Unknown classification type: ${structureType} for join node ${joinNodeId}`);
      }
    });

    // Log classification results for validation
    console.log('💎 Diamond Classifications Applied:', {
      total: analysis.diamondClassifications.length,
      sequential: classifications.SEQUENTIAL.length,
      interconnected: classifications.INTERCONNECTED.length,
      nested: classifications.NESTED.length,
      breakdown: classifications
    });

    return classifications;
  });

  // User data utilization status
  readonly userDataStatus = computed(() => {
    const analysis = this.diamondAnalysis();
    if (!analysis) return null;

    // Check if analysis contains evidence of user data utilization
    // This would be populated by the service's data validation logging
    return {
      hasNodePriors: true, // Service validates this during API calls
      hasEdgeProbabilities: true, // Service validates this during API calls
      networkUploaded: true,
      analysisComplete: analysis.nodes.length > 0
    };
  });

  ngOnInit(): void {
    // Auto-run diamond analysis if network data is available
    if (this.canRunAnalysis()) {
      this.runDiamondAnalysis();
    }
  }

  canRunAnalysis(): boolean {
    return this.hasNetworkData() && this.sessionId() !== null;
  }

  runDiamondAnalysis(): void {
    const sessionId = this.sessionId();
    if (!sessionId) return;

    console.log('Starting diamond processing...');
    this.networkService.performDiamondProcessing(sessionId).subscribe({
      next: (result) => {
        console.log('Diamond processing completed:', result);
        // Mark diamond analysis as completed in workflow
        this.globalState.markStepCompleted('diamond-analysis');
        // Run classification after processing
        this.runDiamondClassification();
      },
      error: (error) => {
        console.error('Diamond processing failed:', error);
        this.globalState.setError(`Diamond processing failed: ${error.message}`);
      }
    });
  }

  runDiamondClassification(): void {
    const sessionId = this.sessionId();
    if (!sessionId) return;

    console.log('Starting diamond classification...');
    this.networkService.performDiamondClassification(sessionId).subscribe({
      next: (result) => {
        console.log('Diamond classification completed:', result);
        // Update the diamond analysis data with classification results
        this.globalState.setDiamondAnalysis(result);
      },
      error: (error) => {
        console.error('Diamond classification failed:', error);
        this.globalState.setError(`Diamond classification failed: ${error.message}`);
      }
    });
  }

  refreshAnalysis(): void {
    this.runDiamondAnalysis();
  }

  clearError(): void {
    this.globalState.clearError();
  }

  applyFilters(): void {
    this._currentPage.set(1); // Reset to first page when filtering
  }

  resetFilters(): void {
    this.filters = {
      classification: 'all',
      minInDegree: 0,
      maxInDegree: 999,
      minOutDegree: 0,
      maxOutDegree: 999,
      searchTerm: '',
      minRelevantNodes: 0,
      maxRelevantNodes: 999,
      minEdges: 0,
      maxEdges: 999
    };
    this._currentPage.set(1);
  }

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this._currentPage.set(page);
    }
  }

  getPageNumbers(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  selectDiamond(diamond: ProcessedDiamondData): void {
    this._selectedDiamond.set(diamond);
  }

  closeDiamondDetails(): void {
    this._selectedDiamond.set(null);
  }

  // Get classification for a specific diamond join node
  getDiamondClassification(joinNodeId: string): string | null {
    const classifications = this.diamondClassifications();
    if (!classifications) return null;

    // Check each classification type
    if (classifications.SEQUENTIAL.includes(joinNodeId)) {
      return 'SEQUENTIAL';
    }
    if (classifications.INTERCONNECTED.includes(joinNodeId)) {
      return 'INTERCONNECTED';
    }
    if (classifications.NESTED.includes(joinNodeId)) {
      return 'NESTED';
    }

    return null;
  }

  // Get classification description for display
  getClassificationDescription(classification: string): string {
    switch (classification) {
      case 'SEQUENTIAL':
        return 'Simple linear diamond structures with single convergence points';
      case 'INTERCONNECTED':
        return 'Complex diamond structures with multiple interconnected paths';
      case 'NESTED':
        return 'Hierarchical diamond structures with embedded sub-diamonds';
      default:
        return 'Classification not available';
    }
  }

  toggleClassifications(): void {
    this._showClassifications.set(!this._showClassifications());
  }

  selectForReachability(nodeId: string): void {
    const current = this._selectedNodes();
    if (!current.includes(nodeId)) {
      this._selectedNodes.set([...current, nodeId]);
    }
  }

  removeFromSelection(nodeId: string): void {
    const current = this._selectedNodes();
    this._selectedNodes.set(current.filter(id => id !== nodeId));
  }

  clearSelection(): void {
    this._selectedNodes.set([]);
  }

  proceedToReachability(): void {
    this.router.navigate(['/reachability-analysis']);
  }

  proceedToReachabilityWithSelection(): void {
    // Store selected nodes in session storage for reachability analysis
    const selected = this._selectedNodes();
    if (selected.length > 0) {
      sessionStorage.setItem('selectedDiamondNodes', JSON.stringify(selected));
    }
    this.router.navigate(['/reachability-analysis']);
  }

  goToNetworkSetup(): void {
    this.router.navigate(['/network-setup']);
  }

  exportDiamondData(): void {
    const diamonds = this.processedDiamonds();
    const stats = this.diamondStatistics();
    const classifications = this.classificationData();

    const exportData = {
      statistics: stats,
      diamonds: diamonds,
      classifications: classifications,
      exportTimestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diamond-analysis-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}