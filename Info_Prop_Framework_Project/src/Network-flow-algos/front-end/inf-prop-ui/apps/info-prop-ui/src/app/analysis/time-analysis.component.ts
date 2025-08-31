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
import { MatDialogModule } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FormsModule } from '@angular/forms';

import { AnalysisStateService } from '../shared/services/analysis-state.service';
import { CpmScenario } from '../shared/models/network-analysis.models';

// Time unit conversion factors (all converted from base unit: microseconds)
const TIME_UNITS = {
  microseconds: { factor: 1, label: 'µs', symbol: 'µs' },
  milliseconds: { factor: 1000, label: 'ms', symbol: 'ms' },
  seconds: { factor: 1000000, label: 'sec', symbol: 's' },
  minutes: { factor: 60000000, label: 'min', symbol: 'm' },
  hours: { factor: 3600000000, label: 'hrs', symbol: 'h' },
  days: { factor: 86400000000, label: 'days', symbol: 'd' },
  weeks: { factor: 604800000000, label: 'weeks', symbol: 'w' }
} as const;

type TimeUnit = keyof typeof TIME_UNITS;

interface NodeTimeDetails {
  nodeId: number;
  completionTime: number;
  slack: number;
  isCritical: boolean;
  type: 'source' | 'sink' | 'fork' | 'join' | 'regular';
  duration?: number;
  earlyStart: number;
  lateStart: number;
}

interface CriticalPathAnalysis {
  totalDuration: number;
  criticalNodes: number[];
  completionTimes: Record<string, number>;
  slackTimes: Record<string, number>;
  criticalPathLength: number;
  nonCriticalActivities: number;
}

@Component({
  selector: 'app-time-analysis',
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
    MatSlideToggleModule,
    FormsModule
  ],
  templateUrl: './time-analysis.component.html',
  styleUrls: ['./time-analysis.component.scss']
})
export class TimeAnalysisComponent {
  private analysisState = inject(AnalysisStateService);

  // Core data signals
  analysisResults = computed(() => this.analysisState.analysisResults());
  networkData = computed(() => this.analysisState.networkData());
  isLoading = computed(() => this.analysisState.isLoading());
  error = computed(() => this.analysisState.error());

  // View state
  currentView = signal<'overview' | 'completion-times' | 'critical-path' | 'slack-analysis'>('overview');
  selectedTimeUnit = signal<TimeUnit>('seconds');
  
  // Pagination
  nodePageSize = signal(50);
  nodePageIndex = signal(0);

  // Filters
  nodeSearchTerm = signal('');
  showCriticalOnly = signal(false);
  selectedScenario = signal<string>('');

  // Table columns
  nodeTimeColumns = ['node', 'type', 'completionTime', 'slack', 'earlyStart', 'lateStart', 'status'];

  // Available time units for selection
  timeUnits = Object.keys(TIME_UNITS) as TimeUnit[];

  // Computed CPM scenarios
  cpmScenarios = computed(() => {
    const results = this.analysisResults();
    return results?.results?.cpm_scenarios || {};
  });

  // Available scenario names
  scenarioNames = computed(() => Object.keys(this.cpmScenarios()));

  // Selected scenario data
  selectedScenarioData = computed(() => {
    const scenarios = this.cpmScenarios();
    const scenarioName = this.selectedScenario();
    
    if (!scenarioName || !scenarios[scenarioName]) {
      // Auto-select first scenario if available
      const firstScenario = Object.keys(scenarios)[0];
      if (firstScenario) {
        this.selectedScenario.set(firstScenario);
        return scenarios[firstScenario];
      }
      return null;
    }
    
    return scenarios[scenarioName];
  });

  // Critical path analysis
  criticalPathAnalysis = computed((): CriticalPathAnalysis | null => {
    const scenario = this.selectedScenarioData();
    if (!scenario?.time_result) return null;

    const timeResult = scenario.time_result;
    const nodeValues = timeResult.node_values;
    const criticalNodes = timeResult.critical_nodes;
    const totalDuration = timeResult.critical_value;

    // Calculate slack times (Late Start - Early Start)
    const slackTimes: Record<string, number> = {};
    Object.keys(nodeValues).forEach(nodeId => {
      const completionTime = nodeValues[nodeId];
      // For critical path analysis, slack = total duration - completion time for critical path
      // For non-critical nodes, we need more complex calculation
      const isOnCriticalPath = criticalNodes.includes(parseInt(nodeId));
      slackTimes[nodeId] = isOnCriticalPath ? 0 : totalDuration - completionTime;
    });

    return {
      totalDuration,
      criticalNodes,
      completionTimes: nodeValues,
      slackTimes,
      criticalPathLength: criticalNodes.length,
      nonCriticalActivities: Object.keys(nodeValues).length - criticalNodes.length
    };
  });

  // Time-converted values
  convertedDuration = computed(() => {
    const analysis = this.criticalPathAnalysis();
    const unit = this.selectedTimeUnit();
    if (!analysis) return 0;
    return this.convertTime(analysis.totalDuration, unit);
  });

  // Project summary metrics
  projectSummary = computed(() => {
    const analysis = this.criticalPathAnalysis();
    const scenario = this.selectedScenarioData();
    if (!analysis || !scenario) return null;

    const unit = this.selectedTimeUnit();
    const convertedDuration = this.convertTime(analysis.totalDuration, unit);
    
    return {
      projectDuration: convertedDuration,
      criticalPathLength: analysis.criticalPathLength,
      totalActivities: Object.keys(analysis.completionTimes).length,
      criticalActivities: analysis.criticalNodes.length,
      nonCriticalActivities: analysis.nonCriticalActivities,
      computationTime: scenario.computation_time,
      timeUnit: TIME_UNITS[unit].symbol,
      networkUtilization: analysis.criticalPathLength / Object.keys(analysis.completionTimes).length
    };
  });

  // Node time details for table
  nodeTimeDetails = computed((): NodeTimeDetails[] => {
    const analysis = this.criticalPathAnalysis();
    const networkData = this.networkData();
    if (!analysis || !networkData) return [];

    return Object.keys(analysis.completionTimes).map(nodeId => {
      const nodeIdNum = parseInt(nodeId);
      const completionTime = analysis.completionTimes[nodeId];
      const slack = analysis.slackTimes[nodeId] || 0;
      const isCritical = analysis.criticalNodes.includes(nodeIdNum);
      const nodeType = this.getNodeType(nodeIdNum);

      // Calculate early/late start times
      const earlyStart = Math.max(0, completionTime - (slack > 0 ? slack : 0));
      const lateStart = earlyStart + slack;

      return {
        nodeId: nodeIdNum,
        completionTime,
        slack,
        isCritical,
        type: nodeType,
        earlyStart,
        lateStart
      };
    }).sort((a, b) => a.nodeId - b.nodeId);
  });

  // Filtered node details
  filteredNodeTimeDetails = computed(() => {
    const nodes = this.nodeTimeDetails();
    const searchTerm = this.nodeSearchTerm().toLowerCase();
    const showCriticalOnly = this.showCriticalOnly();

    return nodes.filter(node => {
      const matchesSearch = !searchTerm || node.nodeId.toString().includes(searchTerm);
      const matchesCritical = !showCriticalOnly || node.isCritical;
      return matchesSearch && matchesCritical;
    });
  });

  // Paginated node details
  paginatedNodeTimeDetails = computed(() => {
    const filtered = this.filteredNodeTimeDetails();
    const pageSize = this.nodePageSize();
    const pageIndex = this.nodePageIndex();
    const start = pageIndex * pageSize;
    return filtered.slice(start, start + pageSize);
  });

  // Time insights
  timeInsights = computed(() => {
    const analysis = this.criticalPathAnalysis();
    const summary = this.projectSummary();
    if (!analysis || !summary) return [];

    const insights: Array<{type: 'info' | 'warning' | 'success', message: string, detail: string}> = [];

    // Project efficiency
    if (summary.networkUtilization > 0.8) {
      insights.push({
        type: 'warning',
        message: 'High Network Utilization',
        detail: `${(summary.networkUtilization * 100).toFixed(1)}% of nodes are on critical path - limited scheduling flexibility`
      });
    } else if (summary.networkUtilization < 0.3) {
      insights.push({
        type: 'success',
        message: 'High Scheduling Flexibility',
        detail: `Only ${(summary.networkUtilization * 100).toFixed(1)}% of nodes are critical - good buffer for delays`
      });
    }

    // Critical path dominance
    const criticalRatio = summary.criticalActivities / summary.totalActivities;
    if (criticalRatio > 0.5) {
      insights.push({
        type: 'info',
        message: 'Critical Path Dominant',
        detail: `${summary.criticalActivities} of ${summary.totalActivities} activities are critical`
      });
    }

    // Project complexity
    if (summary.totalActivities > 100) {
      insights.push({
        type: 'info',
        message: 'Complex Project Network',
        detail: `${summary.totalActivities} activities require careful coordination`
      });
    }

    return insights;
  });

  // Helper methods
  private convertTime(timeValue: number, unit: TimeUnit): number {
    return timeValue / TIME_UNITS[unit].factor;
  }

  private getNodeType(nodeId: number): 'source' | 'sink' | 'fork' | 'join' | 'regular' {
    const networkData = this.networkData();
    if (!networkData) return 'regular';

    if (networkData.source_nodes.includes(nodeId)) return 'source';
    if (networkData.sink_nodes.includes(nodeId)) return 'sink';
    if (networkData.fork_nodes.includes(nodeId)) return 'fork';
    if (networkData.join_nodes.includes(nodeId)) return 'join';
    return 'regular';
  }

  formatTime(timeValue: number, unit: TimeUnit = this.selectedTimeUnit()): string {
    const converted = this.convertTime(timeValue, unit);
    const unitInfo = TIME_UNITS[unit];
    return `${converted.toFixed(2)} ${unitInfo.symbol}`;
  }

  // Event handlers
  switchView(event: MatButtonToggleChange): void {
    this.currentView.set(event.value as typeof this.currentView extends any ? any : never);
  }

  onTimeUnitChange(unit: TimeUnit): void {
    this.selectedTimeUnit.set(unit);
  }

  onScenarioChange(scenarioName: string): void {
    this.selectedScenario.set(scenarioName);
    // Reset pagination when switching scenarios
    this.nodePageIndex.set(0);
  }

  onNodePageChange(event: PageEvent): void {
    this.nodePageIndex.set(event.pageIndex);
    this.nodePageSize.set(event.pageSize);
  }

  onNodeSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.nodeSearchTerm.set(target.value);
    this.nodePageIndex.set(0);
  }

  onCriticalFilter(showCriticalOnly: boolean): void {
    this.showCriticalOnly.set(showCriticalOnly);
    this.nodePageIndex.set(0);
  }

  retryAnalysis(): void {
    console.log('Retrying CPM analysis...');
    // Could trigger re-analysis if needed
  }

  getNodeTypeIcon(type: string): string {
    const iconMap: Record<string, string> = {
      'source': 'play_arrow',
      'sink': 'stop',
      'fork': 'call_split',
      'join': 'call_merge',
      'regular': 'grain'
    };
    return iconMap[type] || 'grain';
  }

  getStatusIcon(isCritical: boolean): string {
    return isCritical ? 'priority_high' : 'schedule';
  }

  getStatusColor(isCritical: boolean): string {
    return isCritical ? 'warn' : 'primary';
  }
}