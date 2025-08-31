import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { AnalysisStateService } from '../shared/services/analysis-state.service';
import { NetworkBackendService } from '../shared/services/network-backend.service';
import { NetworkSessionService } from '../shared/services/network-session.service';

@Component({
  selector: 'app-home',
  imports: [
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

  protected backendHealthy = false;
  protected hasSavedSessions = false;
  protected recentSessions: any[] = [];

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
    const session = this.sessionService.loadSession(sessionId);
    if (session) {
      // Restore analysis state
      if (session.networkData) {
        this.analysisState.setNetworkData(session.networkData);
      }
      if (session.analysisResults) {
        this.analysisState.setAnalysisResults(session.analysisResults);
      }
      if (session.networkPath) {
        this.analysisState.setCurrentNetworkPath(session.networkPath);
      }

      this.snackBar.open('Session loaded successfully', 'Close', { duration: 3000 });
      
      // Navigate to appropriate page based on session state
      if (session.analysisResults) {
        this.router.navigate(['/visualization']);
      } else if (session.networkData) {
        this.router.navigate(['/visualization']);
      } else {
        this.router.navigate(['/upload']);
      }
    } else {
      this.snackBar.open('Failed to load session', 'Close', { duration: 3000 });
    }
  }

  deleteSession(sessionId: string): void {
    this.sessionService.deleteSession(sessionId);
    this.loadRecentSessions();
    this.snackBar.open('Session deleted', 'Close', { duration: 3000 });
  }

  private loadRecentSessions(): void {
    this.recentSessions = this.sessionService.getAllSessions()
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
    this.hasSavedSessions = this.recentSessions.length > 0;
  }

  getSessionDisplayName(networkPath: string): string {
    if (!networkPath) return 'Unknown Network';
    const parts = networkPath.split('/');
    return parts[parts.length - 1] || 'Network Analysis';
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }
}