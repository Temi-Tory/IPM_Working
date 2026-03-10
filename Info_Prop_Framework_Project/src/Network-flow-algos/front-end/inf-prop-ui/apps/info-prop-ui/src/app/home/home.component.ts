import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { AnalysisStateService } from '../shared/services/analysis-state.service';
import { NetworkBackendService } from '../shared/services/network-backend.service';
import { NetworkSessionService, SessionData } from '../shared/services/network-session.service';
import { FileManagerService } from '../shared/services/file-manager.service';

@Component({
  selector: 'app-home',
  imports: [
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatGridListModule,
    MatChipsModule,
    MatSnackBarModule
],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private analysisState = inject(AnalysisStateService);
  private networkBackend = inject(NetworkBackendService);
  private sessionService = inject(NetworkSessionService);
  private fileManager = inject(FileManagerService);

  protected backendHealthy = false;
  protected hasSavedSessions = false;
  protected recentSessions: SessionData[] = [];

  protected features = [
    {
      icon: 'account_tree',
      title: 'Network Structure',
      description: 'Analyze network topology including nodes, edges, sources, sinks, and iteration sets.',
      tags: ['Topology Analysis', 'Node Classification', 'Edge Mapping']
    },
    {
      icon: 'diamond',
      title: 'Diamond Analysis',
      description: 'Identify and analyze diamond structures for efficient belief propagation.',
      tags: ['Pattern Recognition', 'Optimization', 'Efficiency Metrics']
    },
    {
      icon: 'psychology',
      title: 'Exact Inference',
      description: 'Perform precise belief propagation with multiple scenario support.',
      tags: ['Belief Propagation', 'Multi-Scenario', 'Statistical Analysis']
    },
    {
      icon: 'trending_up',
      title: 'Flow Analysis',
      description: 'Calculate maximum flow capacity and network utilization metrics.',
      tags: ['Capacity Planning', 'Bottleneck Detection', 'Utilization Analysis']
    },
    {
      icon: 'route',
      title: 'Critical Path',
      description: 'Identify critical paths for time and cost optimization.',
      tags: ['Time Analysis', 'Cost Optimization', 'Path Finding']
    },
    {
      icon: 'assessment',
      title: 'System Profile',
      description: 'Comprehensive system analysis and performance profiling.',
      tags: ['Performance Metrics', 'System Overview', 'Reporting']
    }
  ];

  ngOnInit(): void {
    this.checkBackendHealth();
    this.loadRecentSessions();
  }

  checkBackendHealth(): void {
    this.networkBackend.checkHealth().subscribe({
      next: (response) => {
        this.backendHealthy = response.status === 'healthy';
        if (this.backendHealthy) {
          this.snackBar.open('Backend connected successfully', 'Close', { duration: 3000 });
        }
      },
      error: (error) => {
        this.backendHealthy = false;
        this.snackBar.open('Backend connection failed', 'Close', { duration: 5000 });
      }
    });
  }

  startNewAnalysis(): void {
    if (!this.backendHealthy) {
      this.snackBar.open('Backend server is not available', 'Close', { duration: 5000 });
      return;
    }

    // Clear any existing state
    this.analysisState.clearState();
    this.sessionService.clearCurrentSession();
    
    // Navigate to upload page
    this.router.navigate(['/upload']);
  }

  loadPreviousSession(): void {
    if (!this.hasSavedSessions) {
      this.snackBar.open('No saved sessions found', 'Close', { duration: 3000 });
      return;
    }

    // For now, load the most recent session
    // In a full implementation, this might open a dialog to select a session
    const mostRecent = this.recentSessions[0];
    if (mostRecent) {
      this.loadSession(mostRecent.sessionId);
    }
  }

  loadSession(sessionId: string): void {
    this.sessionService.loadSession(sessionId).subscribe(session => {
      if (!session) {
        this.snackBar.open('Failed to load session', 'Close', { duration: 3000 });
        return;
      }

      // IMPORTANT: Restore fileManagerState FIRST before clearing anything
      if (session.fileManagerState) {
        console.log('📁 Restoring file manager state with scenarios...');
        console.log('📊 FileManagerState exists:', !!session.fileManagerState);
        console.log('📊 FileManagerState contents:', session.fileManagerState);
        console.log('📊 Analysis groups:', session.fileManagerState.analysisGroups);
        if (session.fileManagerState.analysisGroups) {
          console.log('📊 Reachability scenarios:', session.fileManagerState.analysisGroups.reachability?.length ?? 0);
          console.log('📊 Capacity scenarios:', session.fileManagerState.analysisGroups.capacity?.length ?? 0);
          console.log('📊 CPM scenarios:', session.fileManagerState.analysisGroups.cpm?.length ?? 0);
        }
        this.fileManager.restoreFileManagerState(session.fileManagerState);
      } else {
        console.warn('⚠️ No fileManagerState in session - scenarios will be empty!');
        console.warn('  Session object keys:', Object.keys(session));
        console.warn('  Session:', session);
      }

      this.analysisState.clearState();

      if (session.networkPath) {
        this.analysisState.setCurrentNetworkPath(session.networkPath);
      }

      if (session.parsedData) {
        this.analysisState.setParsedData(session.parsedData);
      }

      if (session.analysisResults) {
        this.analysisState.setAnalysisResults(session.analysisResults);
      }

      if (session.networkData) {
        this.analysisState.setNetworkData(session.networkData);
        
        // Enable tabs after restoring network data
        this.analysisState.enableVisualizationTabs();
        if (session.parsedData) {
          this.analysisState.enableAnalysisTabsAfterVisualization();
        }
        
        this.snackBar.open('Session loaded successfully', 'Close', { duration: 3000 });
        this.router.navigate(['/visualization']);
        return;
      }

      if (session.networkPath) {
        this.analysisState.loadNetworkStructure(session.networkPath).subscribe({
          next: () => {
            // Enable tabs after network structure loads
            this.analysisState.enableVisualizationTabs();
            if (session.parsedData) {
              this.analysisState.enableAnalysisTabsAfterVisualization();
            }
            
            this.snackBar.open('Session loaded successfully', 'Close', { duration: 3000 });
            this.router.navigate(['/visualization']);
          },
          error: () => {
            this.snackBar.open('Session loaded, but failed to restore network structure', 'Close', { duration: 5000 });
            this.router.navigate(['/upload']);
          }
        });
        return;
      }

      this.snackBar.open('Session loaded, but no network was found', 'Close', { duration: 4000 });
      this.router.navigate(['/upload']);
    });
  }

  deleteSession(sessionId: string): void {
    this.sessionService.deleteSession(sessionId).subscribe(success => {
      if (!success) {
        this.snackBar.open('Failed to delete session', 'Close', { duration: 3000 });
        return;
      }
      this.loadRecentSessions();
      this.snackBar.open('Session deleted', 'Close', { duration: 3000 });
    });
  }

  private loadRecentSessions(): void {
    this.sessionService.getAllSessions().subscribe(sessions => {
      this.recentSessions = sessions
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5);
      this.hasSavedSessions = this.recentSessions.length > 0;
    });
  }

  getSessionDisplayName(session: SessionData): string {
    if (session.networkName && session.networkName.trim()) return session.networkName;
    if (session.networkPath) {
      const parts = session.networkPath.split('/');
      return parts[parts.length - 1] || 'Network Analysis';
    }
    return 'Unknown Network';
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }
}