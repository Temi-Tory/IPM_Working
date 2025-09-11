import { Component, OnInit, computed, signal, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatCheckboxModule } from '@angular/material/checkbox';

import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { FileManagerService } from '../../shared/services/file-manager.service';
import { NetworkSessionService } from '../../shared/services/network-session.service';
import { ScenarioAwareComponent } from '../../shared/interfaces/analysis-component.interface';
import {
  ScenarioInfo,
  NetworkStructure,
  AnalysisResponse,
  ScenarioComparison
} from '../../shared/models/network-analysis.models';

import {
  SystemProfileData,
  SystemMetrics
} from '../../shared/models/system-profile.models';
import { SystemProfileService } from '../../shared/services/system-profile.service';

/**
 * System Profile Component
 * 
 * Comprehensive dashboard that aggregates all available analysis results
 * across multiple scenarios and provides unified system insights with
 * advanced D3.js visualizations.
 */
@Component({
  selector: 'app-system-profile',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatTableModule,
    MatChipsModule,
    MatProgressBarModule,
    MatDividerModule,
    MatTooltipModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatExpansionModule,
    MatProgressSpinnerModule,
    MatBadgeModule,
    MatSlideToggleModule,
    MatGridListModule,
    MatCheckboxModule
  ],
  templateUrl: './system-profile.component.html',
  styleUrl: './system-profile.component.scss'
})
export class SystemProfileComponent implements OnInit, ScenarioAwareComponent {

  // Service injections
  private systemProfileService = inject(SystemProfileService);
  private analysisStateService = inject(AnalysisStateService);
  private fileManagerService = inject(FileManagerService);
  private sessionService = inject(NetworkSessionService);
  private cdr = inject(ChangeDetectorRef);

  // ScenarioAwareComponent implementation
  networkData: NetworkStructure | null = null;
  analysisResults: AnalysisResponse | null = null;
  isLoading = false;
  error: string | null = null;
  availableScenarios: ScenarioInfo[] = [];
  currentScenario: string | null = null;
  scenarioResults: Map<string, any> = new Map();

  // System profile specific state
  systemProfile = signal<SystemProfileData | null>(null);
  systemMetrics = signal<SystemMetrics | null>(null);
  isGeneratingProfile = signal(false);
  profileError = signal<string | null>(null);
  selectedTab = signal(0);

  // Visualization state
  visualizationMode = signal<'overview' | 'detailed' | 'comparison'>('overview');
  selectedVisualizationType = signal<'bar' | 'histogram' | 'heatmap' | 'network' | 'radar'>('bar');
  comparisonScenarios = signal<string[]>([]);
  
  // Theme state
  isDarkTheme = signal(true);

  // Computed properties
  allAvailableScenarios = computed(() => {
    const reachabilityGroups = this.fileManagerService.analysisGroups().reachability;
    const capacityGroups = this.fileManagerService.analysisGroups().capacity;
    const cpmGroups = this.fileManagerService.analysisGroups().cpm;

    const scenarios: ScenarioInfo[] = [];

    // Add reachability scenarios
    reachabilityGroups.forEach((group, index) => {
      scenarios.push({
        name: group.scenarioName || `reachability-${group.dataType}-${index}`,
        dataType: group.dataType as 'float' | 'interval' | 'pbox',
        path: group.nodePriorsFile?.path || '',
        displayName: group.scenarioName ? 
          `${group.scenarioName} (${this.getDataTypeDisplayName(group.dataType)})` :
          `Reachability ${this.getDataTypeDisplayName(group.dataType)}`,
        analysisType: 'reachability',
        description: `Reachability analysis with ${group.dataType} uncertainty`
      });
    });

    // Add capacity scenarios
    capacityGroups.forEach((group, index) => {
      scenarios.push({
        name: group.scenarioName || `capacity-${index}`,
        dataType: 'float' as const,
        path: group.capacitiesFile?.path || '',
        displayName: group.scenarioName ?
          `${group.scenarioName} (Capacity)` :
          'Capacity Analysis',
        analysisType: 'capacity',
        description: 'Network capacity and flow analysis'
      });
    });

    // Add CPM scenarios
    cpmGroups.forEach((group, index) => {
      scenarios.push({
        name: group.scenarioName || `cpm-${index}`,
        dataType: 'float' as const,
        path: group.cpmInputsFile?.path || '',
        displayName: group.scenarioName ?
          `${group.scenarioName} (CPM)` :
          'Critical Path Analysis',
        analysisType: 'cpm',
        description: 'Critical path method analysis'
      });
    });

    this.availableScenarios = scenarios;
    return scenarios;
  });

  // Network information
  networkInfo = computed(() => {
    const networkStructure = this.analysisStateService.networkData();
    if (!networkStructure) return null;
    
    return {
      totalNodes: networkStructure.total_nodes || 0,
      totalEdges: networkStructure.total_edges || 0,
      sourceNodes: networkStructure.source_nodes || [],
      joinNodes: networkStructure.join_nodes || [],
      forkNodes: networkStructure.fork_nodes || [],
      sinkNodes: networkStructure.sink_nodes || []
    };
  });

  // System health assessment
  systemHealth = computed(() => {
    const profile = this.systemProfile();
    if (!profile) return null;

    const metrics = profile.aggregatedMetrics;
    let healthScore = 100;

    // Deduct points based on various factors
    if (metrics.networkUtilization > 0.9) healthScore -= 20;
    if (metrics.bottleneckCount > 5) healthScore -= 15;
    if (metrics.singlePointFailures > 3) healthScore -= 25;
    if (metrics.averageComplexity > 75) healthScore -= 10;
    if (metrics.criticalPathRisk === 'high') healthScore -= 20;

    if (healthScore >= 80) return { level: 'excellent', score: healthScore, color: 'success' };
    if (healthScore >= 60) return { level: 'good', score: healthScore, color: 'primary' };
    if (healthScore >= 40) return { level: 'fair', score: healthScore, color: 'warn' };
    return { level: 'poor', score: healthScore, color: 'error' };
  });

  ngOnInit(): void {
    console.log('🏗️ SystemProfileComponent initializing...');
    this.loadScenarios();
    this.loadData();
  }

  // ScenarioAwareComponent interface implementation
  loadScenarios(): void {
    const scenarios = this.allAvailableScenarios();
    console.log('📊 Loaded scenarios for system profile:', scenarios.length);
  }

  setCurrentScenario(scenarioName: string): void {
    this.currentScenario = scenarioName;
    console.log('🔄 System profile scenario changed to:', scenarioName);
  }

  loadScenarioData(scenarioName: string): void {
    this.setCurrentScenario(scenarioName);
  }

  loadData(): void {
    this.networkData = this.analysisStateService.networkData();
    this.analysisResults = this.analysisStateService.analysisResults();
    this.isLoading = this.analysisStateService.isLoading();
    this.error = this.analysisStateService.error();
  }

  clearScenarioData(): void {
    this.scenarioResults.clear();
    this.systemProfile.set(null);
    this.systemMetrics.set(null);
    this.profileError.set(null);
    console.log('🧹 System profile data cleared');
  }

  /**
   * Generate comprehensive system profile from all available analysis results
   */
  async generateSystemProfile(): Promise<void> {
    if (this.isGeneratingProfile()) {
      console.log('⚠️ System profile generation already in progress');
      return;
    }

    this.isGeneratingProfile.set(true);
    this.profileError.set(null);

    try {
      console.log('🏗️ Generating comprehensive system profile...');
      
      const networkPath = this.sessionService.getCurrentSession()?.networkPath;
      if (!networkPath) {
        throw new Error('No network path available for system profile generation');
      }

      // Get all available scenarios
      const scenarios = this.allAvailableScenarios();
      console.log('📊 Processing', scenarios.length, 'scenarios for system profile');

      // Generate system profile using the service
      const profile = await this.systemProfileService.generateSystemProfile(
        networkPath,
        scenarios
      ).toPromise() as SystemProfileData;

      if (profile) {
        this.systemProfile.set(profile);
        this.systemMetrics.set(profile.aggregatedMetrics);
        
        console.log('✅ System profile generated successfully');
        console.log('📈 Profile includes:', {
          scenarios: profile.scenarioResults.size,
          metrics: Object.keys(profile.aggregatedMetrics).length,
          visualizations: profile.visualizationData.length
        });
      }

    } catch (error) {
      console.error('❌ System profile generation failed:', error);
      this.profileError.set(error instanceof Error ? error.message : 'System profile generation failed');
    } finally {
      this.isGeneratingProfile.set(false);
    }
  }

  /**
   * Switch visualization mode
   */
  setVisualizationMode(mode: 'overview' | 'detailed' | 'comparison'): void {
    this.visualizationMode.set(mode);
    console.log('🎨 Visualization mode changed to:', mode);
  }

  /**
   * Set visualization type for current mode
   */
  setVisualizationType(type: 'bar' | 'histogram' | 'heatmap' | 'network' | 'radar'): void {
    this.selectedVisualizationType.set(type);
    console.log('📊 Visualization type changed to:', type);
  }

  /**
   * Toggle scenario for comparison
   */
  toggleComparisonScenario(scenarioName: string): void {
    const current = this.comparisonScenarios();
    const index = current.indexOf(scenarioName);
    
    if (index === -1) {
      // Add scenario
      if (current.length < 4) { // Limit to 4 scenarios for comparison
        this.comparisonScenarios.set([...current, scenarioName]);
      }
    } else {
      // Remove scenario
      this.comparisonScenarios.set(current.filter(s => s !== scenarioName));
    }
  }

  /**
   * Export system profile data
   */
  exportSystemProfile(): void {
    const profile = this.systemProfile();
    if (!profile) {
      console.warn('⚠️ No system profile data to export');
      return;
    }

    const exportData = {
      timestamp: new Date().toISOString(),
      networkInfo: this.networkInfo(),
      systemMetrics: profile.aggregatedMetrics,
      scenarioSummary: Array.from(profile.scenarioResults.entries()).map(([name, data]) => ({
        scenario: name,
        analysisType: data.analysisType,
        computationTime: data.computationTime,
        keyMetrics: data.keyMetrics
      })),
      systemHealth: this.systemHealth(),
      recommendations: profile.recommendations
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `system-profile-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);

    console.log('📁 System profile exported successfully');
  }

  /**
   * Refresh system profile with latest data
   */
  refreshSystemProfile(): void {
    console.log('🔄 Refreshing system profile...');
    this.clearScenarioData();
    this.loadData();
    this.generateSystemProfile();
  }

  /**
   * Get display name for data type
   */
  private getDataTypeDisplayName(dataType: string): string {
    switch (dataType) {
      case 'float': return 'Float';
      case 'interval': return 'Interval';
      case 'pbox': return 'P-Box';
      default: return dataType;
    }
  }

  /**
   * Get color for analysis type
   */
  getAnalysisTypeColor(analysisType: string): string {
    switch (analysisType) {
      case 'reachability': return 'primary';
      case 'capacity': return 'accent';
      case 'cpm': return 'warn';
      default: return 'basic';
    }
  }

  /**
   * Get icon for analysis type
   */
  getAnalysisTypeIcon(analysisType: string): string {
    switch (analysisType) {
      case 'reachability': return 'timeline';
      case 'capacity': return 'speed';
      case 'cpm': return 'route';
      default: return 'analytics';
    }
  }

  /**
   * Format duration in milliseconds to human readable
   */
  formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) return `${milliseconds.toFixed(0)}ms`;
    if (milliseconds < 60000) return `${(milliseconds / 1000).toFixed(1)}s`;
    return `${(milliseconds / 60000).toFixed(1)}min`;
  }

  /**
   * Format percentage
   */
  formatPercentage(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
  }

  /**
   * Get risk level color
   */
  getRiskLevelColor(riskLevel: string): string {
    switch (riskLevel) {
      case 'low': return 'success';
      case 'medium': return 'warn';
      case 'high': return 'error';
      case 'critical': return 'error';
      default: return 'basic';
    }
  }

  /**
   * Toggle theme between light and dark
   */
  toggleTheme(): void {
    this.isDarkTheme.set(!this.isDarkTheme());
  }

  /**
   * Get health icon based on level
   */
  getHealthIcon(level: string): string {
    switch (level) {
      case 'excellent': return 'check_circle';
      case 'good': return 'thumb_up';
      case 'fair': return 'warning';
      case 'poor': return 'error';
      default: return 'help';
    }
  }

  /**
   * Get health description
   */
  getHealthDescription(level: string): string {
    switch (level) {
      case 'excellent': return 'System is performing optimally';
      case 'good': return 'System is performing well';
      case 'fair': return 'System has some issues';
      case 'poor': return 'System needs attention';
      default: return 'Unknown status';
    }
  }

  /**
   * Get complexity description
   */
  getComplexityDescription(level: string): string {
    switch (level) {
      case 'simple': return 'Low complexity network';
      case 'moderate': return 'Moderate complexity network';
      case 'complex': return 'High complexity network';
      case 'very-complex': return 'Very high complexity network';
      default: return 'Unknown complexity';
    }
  }

  /**
   * Get priority color class
   */
  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'low': return 'success';
      case 'medium': return 'warn';
      case 'high': return 'error';
      case 'critical': return 'error';
      default: return 'basic';
    }
  }

  /**
   * Get recommendation icon
   */
  getRecommendationIcon(type: string): string {
    switch (type) {
      case 'performance': return 'speed';
      case 'risk-mitigation': return 'security';
      case 'optimization': return 'tune';
      case 'reliability': return 'verified';
      default: return 'lightbulb';
    }
  }

  /**
   * Get comparison data for table
   */
  getComparisonData(): any[] {
    const profile = this.systemProfile();
    if (!profile) return [];

    const scenarios = this.comparisonScenarios();
    const metrics = [
      'Computation Time',
      'Risk Score',
      'Efficiency',
      'Reliability'
    ];

    return metrics.map(metric => {
      const row: any = { metric };
      scenarios.forEach(scenarioName => {
        const scenarioData = profile.scenarioResults.get(scenarioName);
        if (scenarioData) {
          switch (metric) {
            case 'Computation Time':
              row[scenarioName] = this.formatDuration(scenarioData.computationTime);
              break;
            case 'Risk Score':
              row[scenarioName] = scenarioData.riskAssessment.riskScore.toFixed(1);
              break;
            case 'Efficiency':
              row[scenarioName] = this.formatPercentage(scenarioData.performanceMetrics.efficiency);
              break;
            case 'Reliability':
              row[scenarioName] = this.formatPercentage(scenarioData.performanceMetrics.reliability);
              break;
          }
        } else {
          row[scenarioName] = 'N/A';
        }
      });
      return row;
    });
  }

  /**
   * Get comparison table columns
   */
  getComparisonColumns(): string[] {
    return ['metric', ...this.comparisonScenarios()];
  }
}