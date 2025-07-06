import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

// Import types directly from the models file
import {
  DiamondAnalysisResult,
  DiamondNode,
  DiamondStructure
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
}

@Component({
  selector: 'app-diamond-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="component-container">
      <!-- Header Section -->
      <div class="component-header">
        <div class="header-content">
          <h1 class="page-title">
            <span class="icon-diamond">♦</span>
            Diamond Structure Analysis
          </h1>
          <p class="page-description">
            Identify and classify diamond structures within the network topology
          </p>
        </div>
        
        <div class="action-buttons">
          @if (!diamondAnalysis() && !isLoading()) {
            <button 
              class="btn btn-primary"
              (click)="runDiamondAnalysis()"
              [disabled]="!canRunAnalysis()">
              <span class="icon-play">▶</span>
              Run Diamond Analysis
            </button>
          }
          
          @if (diamondAnalysis()) {
            <button 
              class="btn btn-secondary"
              (click)="refreshAnalysis()">
              <span class="icon-refresh">↻</span>
              Refresh Analysis
            </button>
            
            <button 
              class="btn btn-success"
              (click)="proceedToReachability()">
              <span class="icon-arrow-right">→</span>
              Proceed to Reachability
            </button>
          }
        </div>
      </div>

      <!-- Scrollable Content -->
      <div class="component-content">
        <!-- Loading State -->
        @if (isLoading()) {
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <p>Processing diamond structures...</p>
        </div>
      }

      <!-- Error State -->
      @if (error()) {
        <div class="error-container">
          <div class="error-message">
            <span class="icon-error">⚠</span>
            <span>{{ error() }}</span>
          </div>
          <button class="btn btn-outline" (click)="clearError()">
            Dismiss
          </button>
        </div>
      }

      <!-- Analysis Results -->
      @if (diamondAnalysis() && !isLoading()) {
        <div class="analysis-results">
          
          <!-- Diamond Structures Overview -->
          <div class="diamond-structures-section">
            <h3>Diamond Structures Overview</h3>
            <div class="structures-grid">
              @for (structure of diamondAnalysis()!.diamondStructures; track structure.joinNodeId; let i = $index) {
                <div class="structure-card">
                  <div class="structure-header">
                    <h4>Diamond {{ i + 1 }}</h4>
                    <span class="join-node-badge">Join Node: {{ structure.joinNodeId }}</span>
                  </div>
                  <div class="structure-details">
                    <div class="detail-item">
                      <span class="label">Diamond Nodes:</span>
                      <span class="value">{{ structure.diamondNodes.length }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="label">Diamond Edges:</span>
                      <span class="value">{{ structure.diamondEdges.length }}</span>
                    </div>
                    @if (structure.diamondNodes.length <= 8) {
                      <div class="detail-item">
                        <span class="label">Nodes:</span>
                        <span class="value">{{ structure.diamondNodes.join(', ') }}</span>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          </div>

        </div>
      }

      <!-- No Analysis State -->
      @if (!diamondAnalysis() && !isLoading() && !error()) {
        <div class="no-analysis-container">
          <div class="no-analysis-content">
            <span class="icon-diamond-large">♦</span>
            <h2>Diamond Analysis Not Started</h2>
            <p>Run diamond structure analysis to identify and classify network nodes based on their connectivity patterns.</p>
            
            <div class="analysis-info">
              <h3>What is Diamond Analysis?</h3>
              <ul>
                <li><strong>Source Nodes:</strong> Nodes with outgoing connections but no incoming ones</li>
                <li><strong>Sink Nodes:</strong> Nodes with incoming connections but no outgoing ones</li>
                <li><strong>Intermediate Nodes:</strong> Nodes with both incoming and outgoing connections</li>
                <li><strong>Isolated Nodes:</strong> Nodes with no connections</li>
              </ul>
            </div>
            
            @if (canRunAnalysis()) {
              <button class="btn btn-primary btn-large" (click)="runDiamondAnalysis()">
                <span class="icon-play">▶</span>
                Start Diamond Analysis
              </button>
            } @else {
              <div class="prerequisite-warning">
                <span class="icon-warning">⚠</span>
                <p>Please upload and process a network first before running diamond analysis.</p>
                <button class="btn btn-outline" (click)="goToNetworkSetup()">
                  Go to Network Setup
                </button>
              </div>
            }
          </div>
        </div>
      }
      </div>
    </div>
  `,
  styles: [`
    .analysis-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .header-content {
      flex: 1;
    }

    .page-title {
      font-size: 2.5rem;
      font-weight: 700;
      color: #2c3e50;
      margin: 0 0 0.5rem 0;
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .page-description {
      font-size: 1.1rem;
      color: #7f8c8d;
      margin: 0;
    }

    .action-buttons {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
    }

    .btn-primary {
      background: linear-gradient(135deg, #3498db, #2980b9);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: linear-gradient(135deg, #2980b9, #1f5f8b);
      transform: translateY(-2px);
    }

    .btn-secondary {
      background: linear-gradient(135deg, #95a5a6, #7f8c8d);
      color: white;
    }

    .btn-success {
      background: linear-gradient(135deg, #27ae60, #229954);
      color: white;
    }

    .btn-info {
      background: linear-gradient(135deg, #17a2b8, #138496);
      color: white;
    }

    .btn-info:hover:not(:disabled) {
      background: linear-gradient(135deg, #138496, #0f6674);
      transform: translateY(-2px);
    }

    .btn-outline {
      background: transparent;
      border: 2px solid #bdc3c7;
      color: #2c3e50;
    }

    .btn-outline:hover:not(:disabled) {
      background: #bdc3c7;
      color: white;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .loading-container {
      text-align: center;
      padding: 4rem 2rem;
    }

    .loading-spinner {
      width: 50px;
      height: 50px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #3498db;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .error-container {
      background: #fee;
      border: 1px solid #fcc;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #c0392b;
    }

    .summary-section {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    .summary-section h2 {
      margin: 0 0 1.5rem 0;
      color: #2c3e50;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .stat-card {
      background: linear-gradient(135deg, #f8f9fa, #e9ecef);
      border-radius: 8px;
      padding: 1.5rem;
      text-align: center;
      border-left: 4px solid;
    }

    .stat-card.source { border-left-color: #27ae60; }
    .stat-card.sink { border-left-color: #e74c3c; }
    .stat-card.intermediate { border-left-color: #f39c12; }
    .stat-card.isolated { border-left-color: #95a5a6; }
    .stat-card.join { border-left-color: #9b59b6; }
    .stat-card.diamond { border-left-color: #3498db; }

    .diamond-structures-section {
      margin: 2rem 0;
    }

    .structures-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }

    .structure-card {
      background: linear-gradient(135deg, #f8f9fa, #e9ecef);
      border: 1px solid #dee2e6;
      border-radius: 12px;
      padding: 1rem;
      border-left: 4px solid #3498db;
    }

    .structure-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .structure-header h4 {
      margin: 0;
      color: #2c3e50;
      font-size: 1.1rem;
    }

    .join-node-badge {
      background: #9b59b6;
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .structure-details {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .detail-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .detail-item .label {
      font-weight: 600;
      color: #495057;
    }

    .detail-item .value {
      color: #2c3e50;
      font-family: monospace;
      font-size: 0.9rem;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: #2c3e50;
    }

    .stat-label {
      font-size: 0.9rem;
      color: #7f8c8d;
      margin-top: 0.5rem;
    }

    .processing-time {
      text-align: center;
      color: #7f8c8d;
      font-style: italic;
    }

    .filters-section {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    .filters-section h3 {
      margin: 0 0 1.5rem 0;
      color: #2c3e50;
    }

    .filters-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .filter-group label {
      display: block;
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 0.5rem;
    }

    .filter-group select,
    .filter-group input {
      width: 100%;
      padding: 0.75rem;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      font-size: 1rem;
    }

    .filter-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 1rem;
      border-top: 1px solid #e0e0e0;
    }

    .results-count {
      color: #7f8c8d;
      font-weight: 500;
    }

    .nodes-section {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    .nodes-section h3 {
      margin: 0 0 1.5rem 0;
      color: #2c3e50;
    }

    .table-container {
      overflow-x: auto;
      margin-bottom: 1rem;
    }

    .diamond-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }

    .diamond-table th,
    .diamond-table td {
      padding: 1rem;
      text-align: left;
      border-bottom: 1px solid #e0e0e0;
    }

    .diamond-table th {
      background: #f8f9fa;
      font-weight: 600;
      color: #2c3e50;
    }

    .node-id {
      font-family: monospace;
      font-weight: 600;
    }

    .classification-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .classification-badge.source {
      background: #d5f4e6;
      color: #27ae60;
    }

    .classification-badge.sink {
      background: #fadbd8;
      color: #e74c3c;
    }

    .classification-badge.intermediate {
      background: #fdeaa7;
      color: #f39c12;
    }

    .classification-badge.isolated {
      background: #e8e8e8;
      color: #95a5a6;
    }

    .degree-value {
      font-weight: 600;
      text-align: center;
    }

    .connections {
      text-align: center;
    }

    .connection-count {
      font-weight: 600;
      margin-right: 0.5rem;
    }

    .actions {
      text-align: center;
    }

    .btn-sm {
      padding: 0.5rem 1rem;
      font-size: 0.8rem;
    }

    .pagination {
      display: flex;
      justify-content: center;
      gap: 0.5rem;
      margin-top: 1rem;
    }

    .selected-section {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      border-left: 4px solid #3498db;
    }

    .selected-section h3 {
      margin: 0 0 1rem 0;
      color: #2c3e50;
    }

    .selected-nodes {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .selected-node {
      background: #3498db;
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-family: monospace;
    }

    .selected-node button {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      font-size: 1.2rem;
      line-height: 1;
    }

    .selected-actions {
      display: flex;
      gap: 1rem;
    }

    .no-analysis-container {
      text-align: center;
      padding: 4rem 2rem;
    }

    .no-analysis-content {
      max-width: 600px;
      margin: 0 auto;
    }

    .icon-diamond-large {
      font-size: 4rem;
      color: #bdc3c7;
      margin-bottom: 1rem;
      display: block;
    }

    .no-analysis-content h2 {
      color: #2c3e50;
      margin-bottom: 1rem;
    }

    .no-analysis-content p {
      color: #7f8c8d;
      font-size: 1.1rem;
      margin-bottom: 2rem;
    }

    .analysis-info {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      text-align: left;
    }

    .analysis-info h3 {
      margin: 0 0 1rem 0;
      color: #2c3e50;
    }

    .analysis-info ul {
      margin: 0;
      padding-left: 1.5rem;
    }

    .analysis-info li {
      margin-bottom: 0.5rem;
      color: #2c3e50;
    }

    .btn-large {
      padding: 1rem 2rem;
      font-size: 1.1rem;
    }

    .prerequisite-warning {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 8px;
      padding: 1.5rem;
      margin-top: 2rem;
    }

    .prerequisite-warning p {
      color: #856404;
      margin-bottom: 1rem;
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .diamond-analysis-container {
        padding: 1rem;
      }

      .analysis-header {
        flex-direction: column;
        gap: 1rem;
      }

      .action-buttons {
        width: 100%;
        justify-content: stretch;
      }

      .action-buttons .btn {
        flex: 1;
        justify-content: center;
      }

      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .filters-grid {
        grid-template-columns: 1fr;
      }

      .filter-actions {
        flex-direction: column;
        gap: 1rem;
        align-items: stretch;
      }

      .diamond-table {
        font-size: 0.8rem;
      }

      .diamond-table th,
      .diamond-table td {
        padding: 0.5rem;
      }
    }
  `]
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

  // Filter state
  filters: DiamondFilter = {
    classification: 'all',
    minInDegree: 0,
    maxInDegree: 999,
    minOutDegree: 0,
    maxOutDegree: 999,
    searchTerm: ''
  };

  // Public readonly signals
  readonly selectedNodes = this._selectedNodes.asReadonly();
  readonly currentPage = this._currentPage.asReadonly();

  // Computed signals
  readonly filteredNodes = computed(() => {
    const analysis = this.diamondAnalysis();
    if (!analysis) return [];

    return analysis.nodes.filter(node => {
      // Classification filter
      if (this.filters.classification !== 'all' && node.classification !== this.filters.classification) {
        return false;
      }

      // Search filter
      if (this.filters.searchTerm && !node.nodeId.toLowerCase().includes(this.filters.searchTerm.toLowerCase())) {
        return false;
      }

      return true;
    });
  });

  readonly totalPages = computed(() => {
    return Math.ceil(this.filteredNodes().length / this._pageSize());
  });

  readonly paginatedNodes = computed(() => {
    const filtered = this.filteredNodes();
    const start = (this._currentPage() - 1) * this._pageSize();
    const end = start + this._pageSize();
    return filtered.slice(start, end);
  });

  ngOnInit(): void {
    // Component initialization
  }

  canRunAnalysis(): boolean {
    return this.hasNetworkData() && this.sessionId() !== null;
  }

  runDiamondAnalysis(): void {
    const sessionId = this.sessionId();
    if (!sessionId) return;

    this.networkService.performDiamondProcessing(sessionId).subscribe({
      next: (result) => {
        console.log('Diamond analysis completed:', result);
      },
      error: (error) => {
        console.error('Diamond analysis failed:', error);
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
      searchTerm: ''
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

  showDiamondDetails(node: DiamondNode): void {
    // For now, just log the diamond details - could be expanded to show a modal
    console.log('Diamond details for node', node.nodeId, ':', node.diamondStructures);
    
    // Create detailed info about the diamonds
    const diamondCount = node.diamondStructures?.length || 0;
    const joinNodeInfo = node.isJoinNode ? ' (Join Node)' : '';
    
    let details = `Node ${node.nodeId}${joinNodeInfo} participates in ${diamondCount} diamond structure(s).\n\n`;
    
    if (node.diamondStructures && node.diamondStructures.length > 0) {
      node.diamondStructures.forEach((diamond, index) => {
        details += `Diamond ${index + 1}:\n`;
        details += `  - Join Node: ${diamond.joinNodeId}\n`;
        details += `  - Diamond Nodes: ${diamond.diamondNodes.length} nodes\n`;
        details += `  - Diamond Edges: ${diamond.diamondEdges.length} edges\n`;
        if (diamond.diamondNodes.length <= 10) {
          details += `  - Nodes: ${diamond.diamondNodes.join(', ')}\n`;
        }
        details += '\n';
      });
    }
    
    details += 'Check console for full details.';
    alert(details);
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
}