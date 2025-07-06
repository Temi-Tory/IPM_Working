import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

// Import types directly from the models file
import { 
  NetworkSession,
  DiamondAnalysisResult,
  ReachabilityResult,
  MonteCarloResult,
  NetworkGraph
} from '../../../../../../libs/network-core/src/lib/models/network.models';

// Import services directly
import { GlobalStateService } from '../../../../../../libs/network-core/src/lib/services/global-state.service';
import { NetworkAnalysisService } from '../../../../../../libs/network-core/src/lib/services/network-analysis.service';

interface ExportOptions {
  includeNetworkData: boolean;
  includeDiamondAnalysis: boolean;
  includeReachabilityResults: boolean;
  includeMonteCarloResults: boolean;
  format: 'json' | 'csv';
}

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="component-container">
      <!-- Header Section -->
      <div class="component-header">
        <div class="header-content">
          <h1 class="page-title">
            <span class="icon-results">📊</span>
            Analysis Results Dashboard
          </h1>
          <p class="page-description">
            Comprehensive overview and export of all network analysis results
          </p>
        </div>
        
        <div class="action-buttons">
          <button 
            class="btn btn-primary"
            (click)="showExportOptions()"
            [disabled]="!hasAnyResults()">
            <span class="icon-export">📤</span>
            Export Results
          </button>
          
          <button 
            class="btn btn-secondary"
            (click)="clearAllData()"
            [disabled]="!hasAnyResults()">
            <span class="icon-clear">🗑️</span>
            Clear All Data
          </button>
          
          <button 
            class="btn btn-outline"
            (click)="refreshData()">
            <span class="icon-refresh">↻</span>
            Refresh
          </button>
        </div>
      </div>

      <!-- Scrollable Content -->
      <div class="component-content">
        <!-- Session Information -->
        @if (currentSession()) {
        <div class="session-info">
          <h2>Session Information</h2>
          <div class="session-details">
            <div class="detail-item">
              <label>Session ID:</label>
              <span class="monospace">{{ currentSession()!.sessionId }}</span>
            </div>
            <div class="detail-item">
              <label>Network ID:</label>
              <span class="monospace">{{ currentSession()!.networkId }}</span>
            </div>
            <div class="detail-item">
              <label>Created:</label>
              <span>{{ formatDate(currentSession()!.createdAt) }}</span>
            </div>
            <div class="detail-item">
              <label>Last Accessed:</label>
              <span>{{ formatDate(currentSession()!.lastAccessed) }}</span>
            </div>
            <div class="detail-item">
              <label>Probability Type:</label>
              <span class="probability-type">{{ currentSession()!.probabilityType | titlecase }}</span>
            </div>
          </div>
        </div>
      }

      <!-- Network Summary -->
      @if (networkSummary()) {
        <div class="network-summary">
          <h2>Network Summary</h2>
          <div class="summary-grid">
            <div class="summary-card">
              <div class="summary-value">{{ networkSummary()!.nodeCount }}</div>
              <div class="summary-label">Total Nodes</div>
            </div>
            <div class="summary-card">
              <div class="summary-value">{{ networkSummary()!.edgeCount }}</div>
              <div class="summary-label">Total Edges</div>
            </div>
            <div class="summary-card">
              <div class="summary-value">{{ networkSummary()!.isDirected ? 'Yes' : 'No' }}</div>
              <div class="summary-label">Directed Graph</div>
            </div>
            <div class="summary-card">
              <div class="summary-value">{{ networkSummary()!.name }}</div>
              <div class="summary-label">Network Name</div>
            </div>
          </div>
        </div>
      }

      <!-- Analysis Results Overview -->
      <div class="analysis-overview">
        <h2>Analysis Results Overview</h2>
        <div class="analysis-grid">
          <!-- Diamond Analysis Card -->
          <div class="analysis-card" [class.completed]="diamondAnalysis()">
            <div class="card-header">
              <span class="icon-diamond">♦</span>
              <h3>Diamond Analysis</h3>
              <span class="status-badge" [class.success]="diamondAnalysis()" [class.pending]="!diamondAnalysis()">
                {{ diamondAnalysis() ? 'Completed' : 'Not Run' }}
              </span>
            </div>
            @if (diamondAnalysis()) {
              <div class="card-content">
                <div class="result-stats">
                  <div class="stat">
                    <span class="stat-value">{{ diamondAnalysis()!.summary.sourceCount }}</span>
                    <span class="stat-label">Sources</span>
                  </div>
                  <div class="stat">
                    <span class="stat-value">{{ diamondAnalysis()!.summary.sinkCount }}</span>
                    <span class="stat-label">Sinks</span>
                  </div>
                  <div class="stat">
                    <span class="stat-value">{{ diamondAnalysis()!.summary.intermediateCount }}</span>
                    <span class="stat-label">Intermediate</span>
                  </div>
                  <div class="stat">
                    <span class="stat-value">{{ diamondAnalysis()!.summary.isolatedCount }}</span>
                    <span class="stat-label">Isolated</span>
                  </div>
                </div>
                <div class="processing-time">
                  Processed in {{ diamondAnalysis()!.processingTime.toFixed(2) }}ms
                </div>
              </div>
              <div class="card-actions">
                <button class="btn btn-sm btn-outline" (click)="viewDiamondAnalysis()">
                  View Details
                </button>
                <button class="btn btn-sm btn-outline" (click)="exportDiamondResults()">
                  Export
                </button>
              </div>
            } @else {
              <div class="card-content">
                <p>Diamond structure analysis has not been performed yet.</p>
              </div>
              <div class="card-actions">
                <button class="btn btn-sm btn-primary" (click)="runDiamondAnalysis()">
                  Run Analysis
                </button>
              </div>
            }
          </div>

          <!-- Reachability Analysis Card -->
          <div class="analysis-card" [class.completed]="reachabilityResults().length > 0">
            <div class="card-header">
              <span class="icon-reachability">🔗</span>
              <h3>Reachability Analysis</h3>
              <span class="status-badge" [class.success]="reachabilityResults().length > 0" [class.pending]="reachabilityResults().length === 0">
                {{ reachabilityResults().length > 0 ? reachabilityResults().length + ' Results' : 'Not Run' }}
              </span>
            </div>
            @if (reachabilityResults().length > 0) {
              <div class="card-content">
                <div class="result-stats">
                  <div class="stat">
                    <span class="stat-value">{{ totalReachabilityPaths() }}</span>
                    <span class="stat-label">Total Paths</span>
                  </div>
                  <div class="stat">
                    <span class="stat-value">{{ averageReachabilityPathLength().toFixed(1) }}</span>
                    <span class="stat-label">Avg Length</span>
                  </div>
                  <div class="stat">
                    <span class="stat-value">{{ totalReachabilityTime().toFixed(0) }}ms</span>
                    <span class="stat-label">Total Time</span>
                  </div>
                </div>
              </div>
              <div class="card-actions">
                <button class="btn btn-sm btn-outline" (click)="viewReachabilityAnalysis()">
                  View Details
                </button>
                <button class="btn btn-sm btn-outline" (click)="exportReachabilityResults()">
                  Export
                </button>
              </div>
            } @else {
              <div class="card-content">
                <p>Reachability analysis has not been performed yet.</p>
              </div>
              <div class="card-actions">
                <button class="btn btn-sm btn-primary" (click)="runReachabilityAnalysis()">
                  Run Analysis
                </button>
              </div>
            }
          </div>

          <!-- Monte Carlo Analysis Card -->
          <div class="analysis-card" [class.completed]="monteCarloResults().length > 0">
            <div class="card-header">
              <span class="icon-monte-carlo">🎲</span>
              <h3>Monte Carlo Analysis</h3>
              <span class="status-badge" [class.success]="monteCarloResults().length > 0" [class.pending]="monteCarloResults().length === 0">
                {{ monteCarloResults().length > 0 ? monteCarloResults().length + ' Results' : 'Not Run' }}
              </span>
            </div>
            @if (monteCarloResults().length > 0) {
              <div class="card-content">
                <div class="result-stats">
                  <div class="stat">
                    <span class="stat-value">{{ totalMonteCarloIterations() }}</span>
                    <span class="stat-label">Total Iterations</span>
                  </div>
                  <div class="stat">
                    <span class="stat-value">{{ averageMonteCarloConfidence().toFixed(3) }}</span>
                    <span class="stat-label">Avg Confidence</span>
                  </div>
                  <div class="stat">
                    <span class="stat-value">{{ totalMonteCarloTime().toFixed(0) }}ms</span>
                    <span class="stat-label">Total Time</span>
                  </div>
                </div>
              </div>
              <div class="card-actions">
                <button class="btn btn-sm btn-outline" (click)="viewMonteCarloAnalysis()">
                  View Details
                </button>
                <button class="btn btn-sm btn-outline" (click)="exportMonteCarloResults()">
                  Export
                </button>
              </div>
            } @else {
              <div class="card-content">
                <p>Monte Carlo validation has not been performed yet.</p>
              </div>
              <div class="card-actions">
                <button class="btn btn-sm btn-primary" (click)="runMonteCarloAnalysis()">
                  Run Analysis
                </button>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Export Options Modal -->
      @if (showExportModal()) {
        <div class="modal-overlay" (click)="hideExportOptions()">
          <div class="modal-content" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Export Options</h3>
              <button class="close-btn" (click)="hideExportOptions()">×</button>
            </div>
            <div class="modal-body">
              <div class="export-options">
                <h4>Select Data to Export</h4>
                <div class="checkbox-group">
                  <label class="checkbox-item">
                    <input type="checkbox" [(ngModel)]="exportOptions.includeNetworkData">
                    <span>Network Structure Data</span>
                  </label>
                  <label class="checkbox-item">
                    <input type="checkbox" [(ngModel)]="exportOptions.includeDiamondAnalysis" [disabled]="!diamondAnalysis()">
                    <span>Diamond Analysis Results</span>
                  </label>
                  <label class="checkbox-item">
                    <input type="checkbox" [(ngModel)]="exportOptions.includeReachabilityResults" [disabled]="reachabilityResults().length === 0">
                    <span>Reachability Analysis Results</span>
                  </label>
                  <label class="checkbox-item">
                    <input type="checkbox" [(ngModel)]="exportOptions.includeMonteCarloResults" [disabled]="monteCarloResults().length === 0">
                    <span>Monte Carlo Analysis Results</span>
                  </label>
                </div>
                
                <h4>Export Format</h4>
                <div class="radio-group">
                  <label class="radio-item">
                    <input type="radio" name="format" value="json" [(ngModel)]="exportOptions.format">
                    <span>JSON (Recommended)</span>
                  </label>
                  <label class="radio-item">
                    <input type="radio" name="format" value="csv" [(ngModel)]="exportOptions.format">
                    <span>CSV (Tabular Data)</span>
                  </label>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" (click)="hideExportOptions()">Cancel</button>
              <button class="btn btn-primary" (click)="performExport()" [disabled]="!isExportValid()">
                <span class="icon-download">⬇</span>
                Export Data
              </button>
            </div>
          </div>
        </div>
      }

      <!-- No Results State -->
      @if (!hasAnyResults()) {
        <div class="no-results-container">
          <div class="no-results-content">
            <span class="icon-empty">📋</span>
            <h2>No Analysis Results</h2>
            <p>Run network analysis to see comprehensive results and export options here.</p>
            
            <div class="quick-actions">
              <h3>Quick Actions</h3>
              <div class="action-buttons-grid">
                <button class="btn btn-primary" (click)="goToNetworkSetup()" [disabled]="!hasNetworkData()">
                  <span class="icon-upload">📁</span>
                  Upload Network
                </button>
                <button class="btn btn-outline" (click)="runDiamondAnalysis()" [disabled]="!hasNetworkData()">
                  <span class="icon-diamond">♦</span>
                  Diamond Analysis
                </button>
                <button class="btn btn-outline" (click)="runReachabilityAnalysis()" [disabled]="!hasNetworkData()">
                  <span class="icon-reachability">🔗</span>
                  Reachability Analysis
                </button>
                <button class="btn btn-outline" (click)="runMonteCarloAnalysis()" [disabled]="!hasNetworkData()">
                  <span class="icon-monte-carlo">🎲</span>
                  Monte Carlo Analysis
                </button>
              </div>
            </div>
          </div>
        </div>
      }
      </div>
    </div>
  `,
  styles: [`
    .results-header {
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

    .btn-sm {
      padding: 0.5rem 1rem;
      font-size: 0.8rem;
    }

    .session-info {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    .session-info h2 {
      margin: 0 0 1.5rem 0;
      color: #2c3e50;
    }

    .session-details {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
    }

    .detail-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .detail-item label {
      font-weight: 600;
      color: #7f8c8d;
      font-size: 0.9rem;
    }

    .detail-item span {
      color: #2c3e50;
      font-size: 1rem;
    }

    .monospace {
      font-family: monospace;
      background: #f8f9fa;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
    }

    .network-summary {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    .network-summary h2 {
      margin: 0 0 1.5rem 0;
      color: #2c3e50;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }

    .summary-card {
      background: linear-gradient(135deg, #f8f9fa, #e9ecef);
      border-radius: 8px;
      padding: 1.5rem;
      text-align: center;
      border-left: 4px solid #3498db;
    }

    .summary-value {
      font-size: 2rem;
      font-weight: 700;
      color: #2c3e50;
      margin-bottom: 0.5rem;
    }

    .summary-label {
      font-size: 0.9rem;
      color: #7f8c8d;
    }

    .analysis-overview {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    .analysis-overview h2 {
      margin: 0 0 1.5rem 0;
      color: #2c3e50;
    }

    .analysis-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 1.5rem;
    }

    .analysis-card {
      border: 2px solid #e0e0e0;
      border-radius: 12px;
      overflow: hidden;
      transition: all 0.3s ease;
    }

    .analysis-card.completed {
      border-color: #27ae60;
      box-shadow: 0 2px 8px rgba(39, 174, 96, 0.1);
    }

    .card-header {
      background: #f8f9fa;
      padding: 1rem 1.5rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      border-bottom: 1px solid #e0e0e0;
    }

    .card-header h3 {
      flex: 1;
      margin: 0;
      color: #2c3e50;
      font-size: 1.1rem;
    }

    .status-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .status-badge.success {
      background: #d5f4e6;
      color: #27ae60;
    }

    .status-badge.pending {
      background: #fdeaa7;
      color: #f39c12;
    }

    .card-content {
      padding: 1.5rem;
    }

    .result-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .stat {
      text-align: center;
    }

    .stat-value {
      display: block;
      font-size: 1.5rem;
      font-weight: 700;
      color: #2c3e50;
    }

    .stat-label {
      font-size: 0.8rem;
      color: #7f8c8d;
    }

    .processing-time {
      text-align: center;
      color: #7f8c8d;
      font-style: italic;
      font-size: 0.9rem;
    }

    .card-actions {
      padding: 1rem 1.5rem;
      background: #f8f9fa;
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: white;
      border-radius: 12px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    }

    .modal-header {
      padding: 1.5rem;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-header h3 {
      margin: 0;
      color: #2c3e50;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #7f8c8d;
    }

    .modal-body {
      padding: 1.5rem;
    }

    .export-options h4 {
      margin: 0 0 1rem 0;
      color: #2c3e50;
    }

    .checkbox-group,
    .radio-group {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }

    .checkbox-item,
    .radio-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
    }

    .checkbox-item input,
    .radio-item input {
      margin: 0;
    }

    .modal-footer {
      padding: 1.5rem;
      border-top: 1px solid #e0e0e0;
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
    }

    .no-results-container {
      text-align: center;
      padding: 4rem 2rem;
    }

    .no-results-content {
      max-width: 600px;
      margin: 0 auto;
    }

    .icon-empty {
      font-size: 4rem;
      color: #bdc3c7;
      margin-bottom: 1rem;
      display: block;
    }

    .no-results-content h2 {
      color: #2c3e50;
      margin-bottom: 1rem;
    }

    .no-results-content p {
      color: #7f8c8d;
      font-size: 1.1rem;
      margin-bottom: 2rem;
    }

    .quick-actions {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 1.5rem;
      text-align: left;
    }

    .quick-actions h3 {
      margin: 0 0 1rem 0;
      color: #2c3e50;
    }

    .action-buttons-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .results-container {
        padding: 1rem;
      }

      .results-header {
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

      .session-details {
        grid-template-columns: 1fr;
      }

      .summary-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .analysis-grid {
        grid-template-columns: 1fr;
      }

      .action-buttons-grid {
        grid-template-columns: 1fr;
      }

      .modal-content {
        width: 95%;
        margin: 1rem;
      }
    }
  `]
})
export class ResultsComponent implements OnInit {
  private readonly globalState = inject(GlobalStateService);
  private readonly networkService = inject(NetworkAnalysisService);
  private readonly router = inject(Router);

  // State signals
  readonly currentSession = this.globalState.currentSession;
  readonly networkSummary = this.globalState.networkSummary;
  readonly diamondAnalysis = this.globalState.diamondAnalysis;
  readonly reachabilityResults = this.globalState.reachabilityResults;
  readonly monteCarloResults = this.globalState.monteCarloResults;
  readonly hasNetworkData = this.globalState.hasNetworkData;
  readonly sessionId = this.globalState.sessionId;

  // Component state
  private readonly _showExportModal = signal<boolean>(false);

  // Export options
  exportOptions: ExportOptions = {
    includeNetworkData: true,
    includeDiamondAnalysis: true,
    includeReachabilityResults: true,
    includeMonteCarloResults: true,
    format: 'json'
  };

  // Public readonly signals
  readonly showExportModal = this._showExportModal.asReadonly();

  // Computed signals
  readonly hasAnyResults = computed(() => {
    return this.diamondAnalysis() !== null || 
           this.reachabilityResults().length > 0 || 
           this.monteCarloResults().length > 0;
  });

  readonly totalReachabilityPaths = computed(() => {
    return this.reachabilityResults().reduce((total, result) => total + result.paths.length, 0);
  });

  readonly averageReachabilityPathLength = computed(() => {
    const results = this.reachabilityResults();
    if (results.length === 0) return 0;
    
    const totalLength = results.reduce((sum, result) => 
      sum + result.paths.reduce((pathSum, path) => pathSum + path.length, 0), 0);
    const totalPaths = this.totalReachabilityPaths();
    
    return totalPaths > 0 ? totalLength / totalPaths : 0;
  });

  readonly totalReachabilityTime = computed(() => {
    return this.reachabilityResults().reduce((total, result) => total + result.processingTime, 0);
  });

  readonly totalMonteCarloIterations = computed(() => {
    return this.monteCarloResults().reduce((total, result) => total + result.results.actualIterations, 0);
  });

  readonly averageMonteCarloConfidence = computed(() => {
    const results = this.monteCarloResults();
    if (results.length === 0) return 0;
    
    const totalConfidence = results.reduce((sum, result) => 
      sum + (result.results.confidenceInterval.upper - result.results.confidenceInterval.lower), 0);
    
    return totalConfidence / results.length;
  });

  readonly totalMonteCarloTime = computed(() => {
    return this.monteCarloResults().reduce((total, result) => total + result.processingTime, 0);
  });

  ngOnInit(): void {
    // Component initialization
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  showExportOptions(): void {
    this._showExportModal.set(true);
  }

  hideExportOptions(): void {
    this._showExportModal.set(false);
  }

  isExportValid(): boolean {
    return this.exportOptions.includeNetworkData ||
           this.exportOptions.includeDiamondAnalysis ||
           this.exportOptions.includeReachabilityResults ||
           this.exportOptions.includeMonteCarloResults;
  }

  performExport(): void {
    const exportData: any = {};
    
    if (this.exportOptions.includeNetworkData && this.currentSession()) {
      exportData.networkData = {
        session: this.currentSession(),
        summary: this.networkSummary()
      };
    }
    
    if (this.exportOptions.includeDiamondAnalysis && this.diamondAnalysis()) {
      exportData.diamondAnalysis = this.diamondAnalysis();
    }
    
    if (this.exportOptions.includeReachabilityResults && this.reachabilityResults().length > 0) {
      exportData.reachabilityResults = this.reachabilityResults();
    }
    
    if (this.exportOptions.includeMonteCarloResults && this.monteCarloResults().length > 0) {
      exportData.monteCarloResults = this.monteCarloResults();
    }

    const timestamp = new Date().toISOString().split('T')[0];
    this.downloadJSON(exportData, `network-analysis-results-${timestamp}.json`);
    this.hideExportOptions();
  }

  exportDiamondResults(): void {
    const data = this.diamondAnalysis();
    if (data) {
      this.downloadJSON(data, `diamond-analysis-${new Date().toISOString().split('T')[0]}.json`);
    }
  }

  exportReachabilityResults(): void {
    const data = this.reachabilityResults();
    if (data.length > 0) {
      this.downloadJSON(data, `reachability-results-${new Date().toISOString().split('T')[0]}.json`);
    }
  }

  exportMonteCarloResults(): void {
    const data = this.monteCarloResults();
    if (data.length > 0) {
      this.downloadJSON(data, `monte-carlo-results-${new Date().toISOString().split('T')[0]}.json`);
    }
  }

  clearAllData(): void {
    if (confirm('Are you sure you want to clear all analysis data? This action cannot be undone.')) {
      this.globalState.clearSession();
      alert('All data cleared successfully!');
    }
  }

  refreshData(): void {
    console.log('Refreshing data...');
  }

  // Navigation methods
  viewDiamondAnalysis(): void {
    this.router.navigate(['/diamond-analysis']);
  }

  viewReachabilityAnalysis(): void {
    this.router.navigate(['/reachability-analysis']);
  }

  viewMonteCarloAnalysis(): void {
    this.router.navigate(['/monte-carlo']);
  }

  runDiamondAnalysis(): void {
    this.router.navigate(['/diamond-analysis']);
  }

  runReachabilityAnalysis(): void {
    this.router.navigate(['/reachability-analysis']);
  }

  runMonteCarloAnalysis(): void {
    this.router.navigate(['/monte-carlo']);
  }

  goToNetworkSetup(): void {
    this.router.navigate(['/network-setup']);
  }

  // Utility methods
  private downloadJSON(data: any, filename: string): void {
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = filename;
    link.click();
  }
}