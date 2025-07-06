import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

// Import types directly from the models file
import { 
  ReachabilityResult, 
  ReachabilityQuery,
  ReachabilityPath,
  ProbabilityValue
} from '../../../../../../libs/network-core/src/lib/models/network.models';

// Import services directly
import { GlobalStateService } from '../../../../../../libs/network-core/src/lib/services/global-state.service';
import { NetworkAnalysisService } from '../../../../../../libs/network-core/src/lib/services/network-analysis.service';

interface ReachabilityFilter {
  pathType: 'all' | 'diamond' | 'regular';
  minLength: number;
  maxLength: number;
  minProbability: number;
  maxProbability: number;
  searchTerm: string;
}

@Component({
  selector: 'app-reachability-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="component-container">
      <!-- Header Section -->
      <div class="component-header">
        <div class="header-content">
          <h1 class="page-title">
            <span class="icon-reachability">🔗</span>
            Reachability Analysis
          </h1>
          <p class="page-description">
            Comprehensive reachability analysis with advanced filtering and visualization
          </p>
        </div>
        
        <div class="action-buttons">
          <button 
            class="btn btn-primary"
            (click)="showQueryBuilder()"
            [disabled]="!canRunAnalysis()">
            <span class="icon-plus">+</span>
            New Analysis
          </button>
          
          @if (reachabilityResults().length > 0) {
            <button 
              class="btn btn-secondary"
              (click)="exportResults()">
              <span class="icon-download">⬇</span>
              Export Results
            </button>
            
            <button 
              class="btn btn-success"
              (click)="proceedToResults()">
              <span class="icon-arrow-right">→</span>
              View All Results
            </button>
          }
        </div>
      </div>

      <!-- Scrollable Content -->
      <div class="component-content">
        <!-- Query Builder -->
        @if (showBuilder()) {
        <div class="query-builder">
          <h3>Configure Reachability Query</h3>
          <div class="query-form">
            <div class="form-row">
              <div class="form-group">
                <label>Source Nodes</label>
                <div class="node-input-container">
                  <input 
                    type="text" 
                    [(ngModel)]="newSourceNode"
                    placeholder="Enter node ID..."
                    (keyup.enter)="addSourceNode()">
                  <button class="btn btn-sm btn-outline" (click)="addSourceNode()">Add</button>
                </div>
                <div class="selected-nodes">
                  @for (nodeId of currentQuery.sourceNodes; track nodeId) {
                    <span class="node-tag">
                      {{ nodeId }}
                      <button (click)="removeSourceNode(nodeId)">×</button>
                    </span>
                  }
                </div>
              </div>
              
              <div class="form-group">
                <label>Target Nodes</label>
                <div class="node-input-container">
                  <input 
                    type="text" 
                    [(ngModel)]="newTargetNode"
                    placeholder="Enter node ID..."
                    (keyup.enter)="addTargetNode()">
                  <button class="btn btn-sm btn-outline" (click)="addTargetNode()">Add</button>
                </div>
                <div class="selected-nodes">
                  @for (nodeId of currentQuery.targetNodes; track nodeId) {
                    <span class="node-tag">
                      {{ nodeId }}
                      <button (click)="removeTargetNode(nodeId)">×</button>
                    </span>
                  }
                </div>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>Max Path Depth</label>
                <input 
                  type="number" 
                  [(ngModel)]="currentQuery.maxDepth"
                  placeholder="Optional max depth"
                  min="1"
                  max="20">
              </div>
              
              <div class="form-group">
                <label>Analysis Type</label>
                <select [(ngModel)]="analysisType">
                  <option value="reachability">Reachability Analysis</option>
                  <option value="pathEnum">Path Enumeration</option>
                </select>
              </div>
            </div>
            
            <div class="query-actions">
              <button class="btn btn-outline" (click)="cancelQuery()">Cancel</button>
              <button class="btn btn-primary" (click)="runReachabilityAnalysis()" [disabled]="!isQueryValid()">
                <span class="icon-play">▶</span>
                Run Analysis
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Loading State -->
      @if (isLoading()) {
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <p>Processing reachability analysis...</p>
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
      @if (reachabilityResults().length > 0 && !isLoading()) {
        <div class="analysis-results">
          <!-- Results Summary -->
          <div class="summary-section">
            <h2>Analysis Results Summary</h2>
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-value">{{ reachabilityResults().length }}</div>
                <div class="stat-label">Total Analyses</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{{ totalPaths() }}</div>
                <div class="stat-label">Total Paths Found</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{{ averagePathLength().toFixed(1) }}</div>
                <div class="stat-label">Avg Path Length</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">{{ totalProcessingTime().toFixed(0) }}ms</div>
                <div class="stat-label">Total Processing Time</div>
              </div>
            </div>
          </div>

          <!-- Filters Section -->
          <div class="filters-section">
            <h3>Filter Results</h3>
            <div class="filters-grid">
              <div class="filter-group">
                <label>Path Type</label>
                <select [(ngModel)]="filters.pathType" (ngModelChange)="applyFilters()">
                  <option value="all">All Paths</option>
                  <option value="diamond">Diamond Paths</option>
                  <option value="regular">Regular Paths</option>
                </select>
              </div>
              
              <div class="filter-group">
                <label>Path Length Range</label>
                <div class="range-inputs">
                  <input 
                    type="number" 
                    [(ngModel)]="filters.minLength" 
                    (ngModelChange)="applyFilters()"
                    placeholder="Min"
                    min="1">
                  <span>to</span>
                  <input 
                    type="number" 
                    [(ngModel)]="filters.maxLength" 
                    (ngModelChange)="applyFilters()"
                    placeholder="Max"
                    min="1">
                </div>
              </div>
              
              <div class="filter-group">
                <label>Probability Range</label>
                <div class="range-inputs">
                  <input 
                    type="number" 
                    [(ngModel)]="filters.minProbability" 
                    (ngModelChange)="applyFilters()"
                    placeholder="Min"
                    min="0"
                    max="1"
                    step="0.01">
                  <span>to</span>
                  <input 
                    type="number" 
                    [(ngModel)]="filters.maxProbability" 
                    (ngModelChange)="applyFilters()"
                    placeholder="Max"
                    min="0"
                    max="1"
                    step="0.01">
                </div>
              </div>
              
              <div class="filter-group">
                <label>Search Paths</label>
                <input 
                  type="text" 
                  [(ngModel)]="filters.searchTerm" 
                  (ngModelChange)="applyFilters()"
                  placeholder="Search by node ID..."
                  class="search-input">
              </div>
            </div>
            
            <div class="filter-actions">
              <button class="btn btn-outline" (click)="resetFilters()">
                Reset Filters
              </button>
              <span class="results-count">
                Showing {{ filteredPaths().length }} paths from {{ totalPaths() }} total
              </span>
            </div>
          </div>

          <!-- Results Table -->
          <div class="results-section">
            <h3>Reachability Paths</h3>
            <div class="table-container">
              <table class="results-table">
                <thead>
                  <tr>
                    <th (click)="sortBy('length')" class="sortable">
                      Path Length
                      <span class="sort-icon" [class.active]="sortField() === 'length'">↕</span>
                    </th>
                    <th (click)="sortBy('probability')" class="sortable">
                      Probability
                      <span class="sort-icon" [class.active]="sortField() === 'probability'">↕</span>
                    </th>
                    <th>Path</th>
                    <th>Source Analysis</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (pathData of paginatedPaths(); track pathData.id) {
                    <tr>
                      <td class="length-value">{{ pathData.path.length }}</td>
                      <td class="probability-value">
                        {{ formatProbability(pathData.path.probability) }}
                      </td>
                      <td class="path-display">
                        <div class="path-nodes">
                          @for (nodeId of pathData.path.path; track $index) {
                            <span class="path-node">{{ nodeId }}</span>
                            @if ($index < pathData.path.path.length - 1) {
                              <span class="path-arrow">→</span>
                            }
                          }
                        </div>
                      </td>
                      <td class="analysis-info">
                        <div class="analysis-details">
                          <div>Sources: {{ pathData.result.query.sourceNodes.join(', ') }}</div>
                          <div>Targets: {{ pathData.result.query.targetNodes.join(', ') }}</div>
                        </div>
                      </td>
                      <td class="actions">
                        <button 
                          class="btn btn-sm btn-outline"
                          (click)="visualizePath(pathData.path)">
                          Visualize
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            @if (totalPathPages() > 1) {
              <div class="pagination">
                <button 
                  class="btn btn-outline"
                  [disabled]="currentPathPage() === 1"
                  (click)="setPathPage(currentPathPage() - 1)">
                  Previous
                </button>
                
                @for (page of getPathPageNumbers(); track page) {
                  <button 
                    class="btn"
                    [class.btn-primary]="page === currentPathPage()"
                    [class.btn-outline]="page !== currentPathPage()"
                    (click)="setPathPage(page)">
                    {{ page }}
                  </button>
                }
                
                <button 
                  class="btn btn-outline"
                  [disabled]="currentPathPage() === totalPathPages()"
                  (click)="setPathPage(currentPathPage() + 1)">
                  Next
                </button>
              </div>
            }
          </div>

          <!-- Probability Distribution Chart -->
          <div class="chart-section">
            <h3>Probability Distribution</h3>
            <div class="chart-container">
              <div class="probability-chart">
                @for (bucket of probabilityDistribution(); track $index) {
                  <div class="chart-bar" [style.height.%]="bucket.percentage">
                    <div class="bar-label">{{ bucket.range }}</div>
                    <div class="bar-value">{{ bucket.count }}</div>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      }

      <!-- No Analysis State -->
      @if (reachabilityResults().length === 0 && !isLoading() && !error()) {
        <div class="no-analysis-container">
          <div class="no-analysis-content">
            <span class="icon-reachability-large">🔗</span>
            <h2>No Reachability Analysis</h2>
            <p>Configure and run reachability analysis to explore path connectivity and probabilities.</p>
            
            <!-- Pre-selected Diamond Nodes -->
            @if (preSelectedNodes().length > 0) {
              <div class="preselected-section">
                <h3>Diamond Nodes Available</h3>
                <p>The following nodes were selected from diamond analysis:</p>
                <div class="preselected-nodes">
                  @for (nodeId of preSelectedNodes(); track nodeId) {
                    <span class="node-tag">{{ nodeId }}</span>
                  }
                </div>
                <button class="btn btn-outline" (click)="usePreSelectedNodes()">
                  Use These Nodes
                </button>
              </div>
            }
            
            <div class="analysis-info">
              <h3>What is Reachability Analysis?</h3>
              <ul>
                <li><strong>Path Discovery:</strong> Find all possible paths between source and target nodes</li>
                <li><strong>Probability Calculation:</strong> Calculate path probabilities using belief propagation</li>
                <li><strong>Diamond Integration:</strong> Leverage diamond structure analysis for enhanced results</li>
                <li><strong>Advanced Filtering:</strong> Filter results by length, probability, and path characteristics</li>
              </ul>
            </div>
            
            @if (canRunAnalysis()) {
              <button class="btn btn-primary btn-large" (click)="showQueryBuilder()">
                <span class="icon-play">▶</span>
                Start Reachability Analysis
              </button>
            } @else {
              <div class="prerequisite-warning">
                <span class="icon-warning">⚠</span>
                <p>Please upload and process a network first before running reachability analysis.</p>
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

    .query-builder {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      border-left: 4px solid #3498db;
    }

    .query-builder h3 {
      margin: 0 0 1.5rem 0;
      color: #2c3e50;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      margin-bottom: 1.5rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
    }

    .form-group label {
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 0.5rem;
    }

    .form-group input,
    .form-group select {
      padding: 0.75rem;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      font-size: 1rem;
    }

    .node-input-container {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .node-input-container input {
      flex: 1;
    }

    .selected-nodes {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      min-height: 2rem;
    }

    .node-tag {
      background: #3498db;
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      font-size: 0.8rem;
      font-family: monospace;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .node-tag button {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      font-size: 1rem;
      line-height: 1;
    }

    .query-actions {
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
      padding-top: 1rem;
      border-top: 1px solid #e0e0e0;
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
    }

    .stat-card {
      background: linear-gradient(135deg, #f8f9fa, #e9ecef);
      border-radius: 8px;
      padding: 1.5rem;
      text-align: center;
      border-left: 4px solid #3498db;
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

    .range-inputs {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .range-inputs input {
      flex: 1;
    }

    .range-inputs span {
      color: #7f8c8d;
      font-weight: 500;
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

    .results-section {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    .results-section h3 {
      margin: 0 0 1.5rem 0;
      color: #2c3e50;
    }

    .table-container {
      overflow-x: auto;
      margin-bottom: 1rem;
    }

    .results-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }

    .results-table th,
    .results-table td {
      padding: 1rem;
      text-align: left;
      border-bottom: 1px solid #e0e0e0;
    }

    .results-table th {
      background: #f8f9fa;
      font-weight: 600;
      color: #2c3e50;
    }

    .results-table th.sortable {
      cursor: pointer;
      user-select: none;
    }

    .results-table th.sortable:hover {
      background: #e9ecef;
    }

    .sort-icon {
      margin-left: 0.5rem;
      opacity: 0.3;
    }

    .sort-icon.active {
      opacity: 1;
    }

    .length-value,
    .probability-value {
      font-weight: 600;
      text-align: center;
    }

    .path-display {
      font-family: monospace;
    }

    .path-nodes {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .path-node {
      background: #e9ecef;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.8rem;
    }

    .path-arrow {
      color: #7f8c8d;
      font-weight: bold;
    }

    .analysis-info {
      font-size: 0.8rem;
      color: #7f8c8d;
    }

    .analysis-details div {
      margin-bottom: 0.25rem;
    }

    .actions {
      text-align: center;
    }

    .pagination {
      display: flex;
      justify-content: center;
      gap: 0.5rem;
      margin-top: 1rem;
    }

    .chart-section {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    .chart-section h3 {
      margin: 0 0 1.5rem 0;
      color: #2c3e50;
    }

    .chart-container {
      height: 300px;
      display: flex;
      align-items: end;
      justify-content: center;
    }

    .probability-chart {
      display: flex;
      align-items: end;
      gap: 0.5rem;
      height: 100%;
      width: 100%;
      max-width: 600px;
    }

    .chart-bar {
      flex: 1;
      background: linear-gradient(to top, #3498db, #5dade2);
      border-radius: 4px 4px 0 0;
      position: relative;
      min-height: 20px;
      display: flex;
      flex-direction: column;
      justify-content: end;
      align-items: center;
      color: white;
      font-size: 0.8rem;
      padding: 0.5rem 0.25rem;
    }

    .bar-label {
      position: absolute;
      bottom: -25px;
      font-size: 0.7rem;
      color: #7f8c8d;
      transform: rotate(-45deg);
      transform-origin: center;
    }

    .bar-value {
      font-weight: 600;
    }

    .no-analysis-container {
      text-align: center;
      padding: 4rem 2rem;
    }

    .no-analysis-content {
      max-width: 600px;
      margin: 0 auto;
    }

    .icon-reachability-large {
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

    .preselected-section {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      text-align: left;
    }

    .preselected-section h3 {
      margin: 0 0 1rem 0;
      color: #2c3e50;
    }

    .preselected-nodes {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin: 1rem 0;
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
      .reachability-analysis-container {
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

      .form-row {
        grid-template-columns: 1fr;
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

      .results-table {
        font-size: 0.8rem;
      }

      .results-table th,
      .results-table td {
        padding: 0.5rem;
      }

      .path-nodes {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.25rem;
      }
    }
  `]
})
export class ReachabilityAnalysisComponent implements OnInit {
  private readonly globalState = inject(GlobalStateService);
  private readonly networkService = inject(NetworkAnalysisService);
  private readonly router = inject(Router);

  // State signals
  readonly reachabilityResults = this.globalState.reachabilityResults;
  readonly isLoading = this.globalState.isLoading;
  readonly error = this.globalState.error;
  readonly sessionId = this.globalState.sessionId;
  readonly hasNetworkData = this.globalState.hasNetworkData;

  // Component state
  private readonly _showBuilder = signal<boolean>(false);
  private readonly _currentPathPage = signal<number>(1);
  private readonly _pathPageSize = signal<number>(10);
  private readonly _sortField = signal<'length' | 'probability'>('length');
  private readonly _sortDirection = signal<'asc' | 'desc'>('asc');
  private readonly _preSelectedNodes = signal<string[]>([]);

  // Form state
  currentQuery: ReachabilityQuery = {
    sourceNodes: [],
    targetNodes: [],
    maxDepth: undefined
  };

  newSourceNode = '';
  newTargetNode = '';
  analysisType: 'reachability' | 'pathEnum' = 'reachability';

  // Filter state
  filters: ReachabilityFilter = {
    pathType: 'all',
    minLength: 1,
    maxLength: 20,
    minProbability: 0,
    maxProbability: 1,
    searchTerm: ''
  };

  // Public readonly signals
  readonly showBuilder = this._showBuilder.asReadonly();
  readonly currentPathPage = this._currentPathPage.asReadonly();
  readonly sortField = this._sortField.asReadonly();
  readonly preSelectedNodes = this._preSelectedNodes.asReadonly();

  // Computed signals
  readonly totalPaths = computed(() => {
    return this.reachabilityResults().reduce((total, result) => total + result.paths.length, 0);
  });

  readonly averagePathLength = computed(() => {
    const results = this.reachabilityResults();
    if (results.length === 0) return 0;
    
    const totalLength = results.reduce((sum, result) =>
      sum + result.paths.reduce((pathSum, path) => pathSum + path.length, 0), 0);
    const totalPaths = this.totalPaths();
    
    return totalPaths > 0 ? totalLength / totalPaths : 0;
  });

  readonly totalProcessingTime = computed(() => {
    return this.reachabilityResults().reduce((total, result) => total + result.processingTime, 0);
  });

  readonly allPaths = computed(() => {
    const results = this.reachabilityResults();
    const paths: Array<{id: string, path: ReachabilityPath, result: ReachabilityResult}> = [];
    
    results.forEach((result, resultIndex) => {
      result.paths.forEach((path, pathIndex) => {
        paths.push({
          id: `${resultIndex}-${pathIndex}`,
          path,
          result
        });
      });
    });
    
    return paths;
  });

  readonly filteredPaths = computed(() => {
    return this.allPaths().filter(pathData => {
      const path = pathData.path;
      
      // Length filter
      if (path.length < this.filters.minLength || path.length > this.filters.maxLength) {
        return false;
      }
      
      // Probability filter
      const prob = this.extractProbabilityValue(path.probability);
      if (prob < this.filters.minProbability || prob > this.filters.maxProbability) {
        return false;
      }
      
      // Search filter
      if (this.filters.searchTerm) {
        const searchTerm = this.filters.searchTerm.toLowerCase();
        const pathString = path.path.join(' ').toLowerCase();
        if (!pathString.includes(searchTerm)) {
          return false;
        }
      }
      
      return true;
    });
  });

  readonly sortedPaths = computed(() => {
    const filtered = this.filteredPaths();
    const field = this._sortField();
    const direction = this._sortDirection();
    
    return [...filtered].sort((a, b) => {
      let aVal: number, bVal: number;
      
      if (field === 'length') {
        aVal = a.path.length;
        bVal = b.path.length;
      } else {
        aVal = this.extractProbabilityValue(a.path.probability);
        bVal = this.extractProbabilityValue(b.path.probability);
      }
      
      const result = aVal - bVal;
      return direction === 'asc' ? result : -result;
    });
  });

  readonly totalPathPages = computed(() => {
    return Math.ceil(this.filteredPaths().length / this._pathPageSize());
  });

  readonly paginatedPaths = computed(() => {
    const sorted = this.sortedPaths();
    const start = (this._currentPathPage() - 1) * this._pathPageSize();
    const end = start + this._pathPageSize();
    return sorted.slice(start, end);
  });

  readonly probabilityDistribution = computed(() => {
    const paths = this.filteredPaths();
    const buckets = Array(10).fill(0);
    
    paths.forEach(pathData => {
      const prob = this.extractProbabilityValue(pathData.path.probability);
      const bucketIndex = Math.min(Math.floor(prob * 10), 9);
      buckets[bucketIndex]++;
    });
    
    const maxCount = Math.max(...buckets);
    
    return buckets.map((count, index) => ({
      range: `${(index * 0.1).toFixed(1)}-${((index + 1) * 0.1).toFixed(1)}`,
      count,
      percentage: maxCount > 0 ? (count / maxCount) * 100 : 0
    }));
  });

  ngOnInit(): void {
    // Check for pre-selected diamond nodes
    const stored = sessionStorage.getItem('selectedDiamondNodes');
    if (stored) {
      try {
        const nodes = JSON.parse(stored);
        this._preSelectedNodes.set(nodes);
        sessionStorage.removeItem('selectedDiamondNodes');
      } catch (error) {
        console.warn('Failed to parse stored diamond nodes:', error);
      }
    }
  }

  canRunAnalysis(): boolean {
    return this.hasNetworkData() && this.sessionId() !== null;
  }

  showQueryBuilder(): void {
    this._showBuilder.set(true);
  }

  cancelQuery(): void {
    this._showBuilder.set(false);
    this.resetQuery();
  }

  resetQuery(): void {
    this.currentQuery = {
      sourceNodes: [],
      targetNodes: [],
      maxDepth: undefined
    };
    this.newSourceNode = '';
    this.newTargetNode = '';
    this.analysisType = 'reachability';
  }

  addSourceNode(): void {
    if (this.newSourceNode.trim() && !this.currentQuery.sourceNodes.includes(this.newSourceNode.trim())) {
      this.currentQuery.sourceNodes.push(this.newSourceNode.trim());
      this.newSourceNode = '';
    }
  }

  removeSourceNode(nodeId: string): void {
    this.currentQuery.sourceNodes = this.currentQuery.sourceNodes.filter(id => id !== nodeId);
  }

  addTargetNode(): void {
    if (this.newTargetNode.trim() && !this.currentQuery.targetNodes.includes(this.newTargetNode.trim())) {
      this.currentQuery.targetNodes.push(this.newTargetNode.trim());
      this.newTargetNode = '';
    }
  }

  removeTargetNode(nodeId: string): void {
    this.currentQuery.targetNodes = this.currentQuery.targetNodes.filter(id => id !== nodeId);
  }

  isQueryValid(): boolean {
    return this.currentQuery.sourceNodes.length > 0 && this.currentQuery.targetNodes.length > 0;
  }

  runReachabilityAnalysis(): void {
    const sessionId = this.sessionId();
    if (!sessionId || !this.isQueryValid()) return;

    const analysisMethod = this.analysisType === 'reachability'
      ? this.networkService.performReachabilityAnalysis(sessionId, this.currentQuery)
      : this.networkService.performPathEnumeration(sessionId, this.currentQuery);

    analysisMethod.subscribe({
      next: (result) => {
        console.log('Reachability analysis completed:', result);
        this._showBuilder.set(false);
        this.resetQuery();
      },
      error: (error) => {
        console.error('Reachability analysis failed:', error);
      }
    });
  }

  clearError(): void {
    this.globalState.clearError();
  }

  applyFilters(): void {
    this._currentPathPage.set(1);
  }

  resetFilters(): void {
    this.filters = {
      pathType: 'all',
      minLength: 1,
      maxLength: 20,
      minProbability: 0,
      maxProbability: 1,
      searchTerm: ''
    };
    this._currentPathPage.set(1);
  }

  sortBy(field: 'length' | 'probability'): void {
    if (this._sortField() === field) {
      this._sortDirection.set(this._sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this._sortField.set(field);
      this._sortDirection.set('asc');
    }
  }

  setPathPage(page: number): void {
    if (page >= 1 && page <= this.totalPathPages()) {
      this._currentPathPage.set(page);
    }
  }

  getPathPageNumbers(): number[] {
    const total = this.totalPathPages();
    const current = this.currentPathPage();
    const pages: number[] = [];
    
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  usePreSelectedNodes(): void {
    const nodes = this._preSelectedNodes();
    if (nodes.length > 0) {
      // Use first half as sources, second half as targets
      const mid = Math.ceil(nodes.length / 2);
      this.currentQuery.sourceNodes = nodes.slice(0, mid);
      this.currentQuery.targetNodes = nodes.slice(mid);
      this._showBuilder.set(true);
    }
  }

  visualizePath(path: ReachabilityPath): void {
    // Store path data for visualization
    sessionStorage.setItem('visualizePath', JSON.stringify(path));
    // Could navigate to a visualization component or show modal
    console.log('Visualizing path:', path);
  }

  exportResults(): void {
    const results = this.reachabilityResults();
    const dataStr = JSON.stringify(results, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `reachability-results-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  }

  proceedToResults(): void {
    this.router.navigate(['/results']);
  }

  goToNetworkSetup(): void {
    this.router.navigate(['/network-setup']);
  }

  formatProbability(prob: ProbabilityValue): string {
    if (typeof prob === 'number') {
      return prob.toFixed(4);
    } else if (typeof prob === 'object' && 'lower' in prob) {
      return `[${prob.lower.toFixed(3)}, ${prob.upper.toFixed(3)}]`;
    } else if (typeof prob === 'object' && 'bounds' in prob) {
      return `PBox(${prob.bounds.length} points)`;
    }
    return 'Unknown';
  }

  private extractProbabilityValue(prob: ProbabilityValue): number {
    if (typeof prob === 'number') {
      return prob;
    } else if (typeof prob === 'object' && 'lower' in prob) {
      return (prob.lower + prob.upper) / 2;
    } else if (typeof prob === 'object' && 'bounds' in prob) {
      return prob.bounds.reduce((sum, val) => sum + val, 0) / prob.bounds.length;
    }
    return 0;
  }
}