import { Component, OnInit, computed, signal, ChangeDetectorRef, inject } from '@angular/core';
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
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';

import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { FileManagerService } from '../../shared/services/file-manager.service';
import { CpmAnalysisService } from '../../shared/services/cpm-analysis.service';
import { NetworkSessionService } from '../../shared/services/network-session.service';
import { ScenarioAwareComponent } from '../../shared/interfaces/analysis-component.interface';
import { ScenarioInfo, MultiScenarioCpmResults, CpmScenario, NetworkStructure, AnalysisResponse } from '../../shared/models/network-analysis.models';

interface TimeScenarioInfo {
  name: string;
  path: string;
  displayName: string;
  description: string;
  networkPath: string | undefined;
  cpmInputsFile: any;
}

interface TimeResult {
  nodeId: number;
  timeValue: number;
  isOnCriticalPath: boolean;
  earliestStart: number;
  latestStart: number;
  slack: number;
  nodeType: string;
}

interface TimeMetrics {
  totalNodes: number;
  criticalPathDuration: number;
  criticalPathLength: number;
  averageNodeTime: number;
  maxSlackTime: number;
  minSlackTime: number;
  computationTime: number;
  sourceNodes: number;
  targetNodes: number;
  criticalNodesCount: number;
}

/**
 * Network Time Analysis Component (CPM Time Analysis)
 * 
 * Professional component for critical path method time analysis including:
 * - Critical path duration calculation and path identification
 * - Node time values and slack time analysis
 * - Multi-scenario time-based comparison support
 * - Schedule optimization and time performance visualization
 */
@Component({
  selector: 'app-time-analysis',
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
    MatPaginatorModule
  ],
  templateUrl: './time-analysis.component.html',
  styleUrl: './time-analysis.component.scss'
})
export class TimeAnalysisComponent implements OnInit, ScenarioAwareComponent {

  // **NEW: Inject services using modern Angular pattern**
  private analysisStateService = inject(AnalysisStateService);
  private fileManagerService = inject(FileManagerService);
  private cpmAnalysisService = inject(CpmAnalysisService);
  private sessionService = inject(NetworkSessionService);
  private cdr = inject(ChangeDetectorRef);

  // **ENHANCED: ScenarioAwareComponent implementation**
  networkData: NetworkStructure | null = null;
  analysisResults: AnalysisResponse | null = null;
  isLoading = false;
  error: string | null = null;
  
  // **NEW: Multi-scenario state management**
  availableScenarios: ScenarioInfo[] = [];
  currentScenario: string | null = null;
  scenarioResults: Map<string, any> = new Map();
  
  // **TIME-SPECIFIC: Keep existing signals for time analysis**
  selectedScenario = signal<TimeScenarioInfo | null>(null);
  timeResults = signal<TimeResult[]>([]);
  timeMetrics = signal<TimeMetrics | null>(null);
  isComputing = signal(false);
  errorMessage = signal<string | null>(null);
  
  // **TIME-SPECIFIC: Get scenarios from FileManagerService CPM groups**
  availableScenariosComputed = computed(() => {
    const cpmGroups = this.fileManagerService.analysisGroups().cpm;
    
    return cpmGroups
      .map((group, index) => ({
        name: group.scenarioName || `cpm-time-${index}`, // Use scenarioName as unique identifier
        displayName: group.scenarioName ? 
          `${group.scenarioName} (Time Analysis)` : 
          'Time Analysis',
        path: group.cpmInputsFile?.path || '',
        networkPath: group.networkPath,
        cpmInputsFile: group.cpmInputsFile,
        description: 'Critical Path Method time-based scheduling analysis with duration optimization'
      }));
  });

  // Network structure information for context
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

  // **NEW: Access parsed data for actual CPM values**
  parsedData = computed(() => this.analysisStateService.parsedData());

  // **TIME-SPECIFIC: Enhanced network context with schedule metrics**
  networkComplexity = computed(() => {
    const networkInfo = this.networkInfo();
    if (!networkInfo) return 'Unknown';
    
    const totalNodes = networkInfo.totalNodes;
    const totalEdges = networkInfo.totalEdges;
    const edgeNodeRatio = totalEdges / totalNodes;
    
    if (edgeNodeRatio < 1.2) return 'Simple Schedule (Linear Process)';
    if (edgeNodeRatio < 1.8) return 'Moderate Schedule (Parallel Tasks)';
    if (edgeNodeRatio < 2.5) return 'Complex Schedule (Multiple Dependencies)';
    return 'Very Complex Schedule (Highly Interdependent)';
  });

  // **TIME-SPECIFIC: Filtered results based on search and critical path filters**
  filteredTimeResults = computed(() => {
    const results = this.timeResults();
    const search = this.searchTerm().toLowerCase();
    const selectedTypes = this.selectedNodeTypes();
    const showOnlyCritical = this.showOnlyCriticalPath();
    const networkInfo = this.networkInfo();
    
    if (!networkInfo) return results;
    
    return results.filter(result => {
      // Search filter
      const matchesSearch = !search || result.nodeId.toString().includes(search);
      
      // Node type filter
      let matchesType = selectedTypes.length === 0;
      if (!matchesType) {
        const nodeType = this.getNodeType(result.nodeId, networkInfo);
        matchesType = selectedTypes.some(type => nodeType.includes(type));
      }
      
      // Critical path filter
      const matchesCriticalFilter = !showOnlyCritical || result.isOnCriticalPath;
      
      return matchesSearch && matchesType && matchesCriticalFilter;
    });
  });

  // **TIME-SPECIFIC: Paginated results**
  paginatedTimeResults = computed(() => {
    const filtered = this.filteredTimeResults();
    const pageSize = this.pageSize();
    const pageIndex = this.pageIndex();
    const start = pageIndex * pageSize;
    return filtered.slice(start, start + pageSize);
  });

  // Table columns for results display
  displayedColumns: string[] = ['nodeId', 'timeValue', 'slack', 'criticalPath', 'nodeType'];
  
  // **TIME-SPECIFIC: Pagination and filtering state**
  pageSize = signal(25);
  pageIndex = signal(0);
  searchTerm = signal('');
  selectedNodeTypes = signal<string[]>([]);
  showOnlyCriticalPath = signal(false);

  ngOnInit(): void {
    console.log('⏰ TimeAnalysisComponent initializing...');
    this.loadScenarios();
    this.loadData();
  }

  // **NEW: ScenarioAwareComponent interface implementation**
  loadScenarios(): void {
    const cpmGroups = this.fileManagerService.analysisGroups().cpm;
    this.availableScenarios = cpmGroups
      .map((group, index) => ({
        name: group.scenarioName || `cpm-time-${index}`,
        dataType: 'cpm' as any,
        path: group.cpmInputsFile?.path || '',
        displayName: group.scenarioName ?
          `${group.scenarioName} (Time Analysis)` :
          'Time Analysis',
        analysisType: 'cpm' as const,
        description: 'Critical Path Method time-based scheduling analysis with duration optimization'
      }));

    // Auto-select first scenario if available
    if (this.availableScenarios.length > 0 && !this.currentScenario) {
      this.setCurrentScenario(this.availableScenarios[0].name);
    }
  }

  setCurrentScenario(scenarioName: string): void {
    this.currentScenario = scenarioName;
    const scenario = this.availableScenarios.find(s => s.name === scenarioName);
    if (scenario) {
      // Convert ScenarioInfo to TimeScenarioInfo for backward compatibility
      const cpmGroups = this.fileManagerService.analysisGroups().cpm;
      const matchingGroup = cpmGroups.find(group =>
        group.scenarioName === scenario.name
      );
      
      if (matchingGroup) {
        const timeScenario: TimeScenarioInfo = {
          name: scenario.name,
          path: scenario.path,
          displayName: scenario.displayName || scenario.name,
          description: scenario.description || '',
          networkPath: matchingGroup.networkPath,
          cpmInputsFile: matchingGroup.cpmInputsFile
        };
        this.selectedScenario.set(timeScenario);
        
        // **FIX: Auto-execute analysis when scenario changes via dropdown**
        console.log('⏰ Current time analysis scenario set to:', scenarioName);
        console.log('🔄 Auto-executing time analysis for new scenario selection');
        this.executeTimeAnalysis();
      }
    }
  }

  loadScenarioData(scenarioName: string): void {
    this.setCurrentScenario(scenarioName);
    
    // **FIX: Clear previous results before loading new scenario**
    this.timeResults.set([]);
    this.timeMetrics.set(null);
    this.errorMessage.set(null);
    
    // **FIX: Force UI update after clearing**
    this.cdr.markForCheck();
    this.cdr.detectChanges();
    
    // Trigger time analysis execution for the selected scenario
    this.executeTimeAnalysis();
  }

  loadData(): void {
    this.networkData = this.analysisStateService.networkData();
    this.analysisResults = this.analysisStateService.analysisResults();
    this.isLoading = this.analysisStateService.isLoading();
    this.error = this.analysisStateService.error();
  }

  clearScenarioData(): void {
    this.scenarioResults.clear();
    this.timeResults.set([]);
    this.timeMetrics.set(null);
    this.errorMessage.set(null);
    console.log('🧹 Time analysis scenario data cleared');
  }

  /**
   * Execute network time analysis using CPM
   */
  async executeTimeAnalysis(): Promise<void> {
    const scenario = this.selectedScenario();
    if (!scenario) {
      this.errorMessage.set('No scenario selected');
      return;
    }

    // **FIX: Prevent duplicate executions with state guard**
    if (this.isComputing()) {
      console.log('⚠️ Time analysis already in progress, skipping duplicate execution');
      return;
    }

    this.isComputing.set(true);
    this.errorMessage.set(null);
    
    try {
      // Use networkPath from scenario if available, otherwise from session
      let networkPath = scenario.networkPath;
      if (!networkPath) {
        const currentSession = this.sessionService.getCurrentSession();
        networkPath = currentSession?.networkPath;
      }
      
      if (!networkPath) {
        throw new Error('No network path available');
      }

      console.log(`⏰ Executing time analysis for scenario: ${scenario.displayName}`);
      console.log(`📂 Network path: ${networkPath}`);
      console.log(`⏱️ CPM inputs path: ${scenario.path}`);
      console.log(`🔗 CPM inputs file path: ${scenario.cpmInputsFile?.path}`);

      // Check that scenario has all required file paths
      if (!scenario.cpmInputsFile?.path) {
        throw new Error('Missing required CPM inputs file for time analysis. Please upload CPM files first.');
      }
      
      // Validate paths are not empty
      if (!scenario.cpmInputsFile.path.trim()) {
        throw new Error('CPM inputs file path cannot be empty. Please check uploaded files.');
      }
      
      // Get edges file path from the CPM group
      const cpmGroups = this.fileManagerService.analysisGroups().cpm;
      const matchingGroup = cpmGroups.find(group => 
        group.scenarioName === scenario.name
      );
      
      if (!matchingGroup) {
        throw new Error(`Could not find matching CPM group for scenario: ${scenario.name}`);
      }
      
      // **FIXED: Construct edges file path correctly**
      const edgesNetworkName = matchingGroup.networkPath?.split('/').pop() || 'network';
      let edgesFilePath = matchingGroup.edgesFile?.path || `${edgesNetworkName}.EDGES`;
      
      // **CRITICAL FIX: Remove any network path prefix from edges file path**
      if (edgesFilePath.includes('/')) {
        edgesFilePath = edgesFilePath.split('/').pop() || `${edgesNetworkName}.EDGES`;
      }
      
      console.log(`📊 Final edges file path: ${edgesFilePath}`);
      
      // **IMPROVED: Use session network path for consistency with backend expectations**
      const sessionNetworkPath = this.sessionService.getCurrentSession()?.networkPath;
      const baseNetworkPath = sessionNetworkPath || matchingGroup.networkPath;
      
      if (!baseNetworkPath) {
        throw new Error('No valid network path available for analysis');
      }
      
      // **IMPROVED: Construct relative paths for backend compatibility**
      const fullNetworkPath = baseNetworkPath.replace(/\\/g, '/');
      
      // Make paths relative to the network directory
      let relativeCpmPath = scenario.cpmInputsFile.path;
      
      // **FIXED: Improved path stripping logic to preserve folder structure**
      const networkName = baseNetworkPath.split('/').pop() || '';
      
      // Only remove the network name prefix if it exists at the start
      if (networkName && relativeCpmPath.startsWith(networkName + '/')) {
        relativeCpmPath = relativeCpmPath.substring(networkName.length + 1);
      }
      
      // **DEBUG: Log path transformation for debugging**
      console.log('🔧 TIME ANALYSIS PATH TRANSFORMATION DEBUG:');
      console.log(`  networkName: '${networkName}'`);
      console.log(`  original cpmPath: '${scenario.cpmInputsFile.path}'`);
      console.log(`  transformed cpmPath: '${relativeCpmPath}'`);
      
      // Validate all paths are non-empty
      if (!fullNetworkPath.trim()) {
        throw new Error('Network path is empty');
      }
      if (!edgesFilePath.trim()) {
        throw new Error('Edges file path is empty');
      }
      if (!relativeCpmPath.trim()) {
        throw new Error('CPM inputs path is empty');
      }
      
      // **TIME-SPECIFIC: Call CPM analysis service**
      const results = await this.cpmAnalysisService.analyzeCpm({
        networkPath: fullNetworkPath,
        edgesFilePath: edgesFilePath,
        cpmPath: relativeCpmPath
      }).toPromise();

      // **ENHANCED: Add comprehensive result logging for debugging**
      console.log('🔍 TIME ANALYSIS API RESPONSE DEBUG:');
      console.log('  Full response:', JSON.stringify(results, null, 2));
      console.log('  Response type:', typeof results);
      console.log('  Response keys:', results ? Object.keys(results) : 'null');
      
      if (results?.cmp_result) {
        console.log('  cmp_result keys:', Object.keys(results.cmp_result));
        const cmpResult = results.cmp_result as any;
        if (cmpResult.time_result) {
          console.log('  time_result keys:', Object.keys(cmpResult.time_result));
          console.log('  node_values count:', cmpResult.time_result.node_values ? Object.keys(cmpResult.time_result.node_values).length : 'none');
          console.log('  critical_nodes count:', cmpResult.time_result.critical_nodes ? cmpResult.time_result.critical_nodes.length : 'none');
        }
      }

      // **TIME-SPECIFIC: Store results in scenario-aware map**
      if (results?.cmp_result) {
        this.scenarioResults.set(scenario.name, results.cmp_result);
      }

      // Process and format results for display (TIME-FOCUSED)
      const processedResults = this.processTimeResults(results);
      const metrics = this.calculateTimeMetrics(results, processedResults);
      
      // **ENHANCED: Update signals and trigger change detection**
      this.timeResults.set(processedResults);
      this.timeMetrics.set(metrics);
      
      // **FIX: Force change detection to ensure UI updates**
      this.cdr.markForCheck();
      this.cdr.detectChanges();
      
      // **FIX: Additional UI update trigger after a short delay**
      setTimeout(() => {
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      }, 100);
      
      console.log(`✅ Time analysis completed for scenario "${scenario.name}": ${processedResults.length} nodes analyzed`);
      console.log(`⏱️ Computation time: ${metrics.computationTime.toFixed(3)}s`);
      console.log(`🎯 Critical path duration: ${metrics.criticalPathDuration.toFixed(2)} time units`);
      console.log(`📊 Critical path nodes: ${metrics.criticalNodesCount}`);
      console.log(`🔄 UI update triggered for ${processedResults.length} time results`);
      
    } catch (error) {
      console.error('❌ Time analysis execution failed:', error);
      this.errorMessage.set(error instanceof Error ? error.message : 'Time analysis execution failed');
    } finally {
      this.isComputing.set(false);
    }
  }

  /**
   * Process raw CPM results into structured time data (TIME-FOCUSED)
   * **ENHANCED: Handle multiple API response formats and add comprehensive error handling**
   */
  private processTimeResults(results: any): TimeResult[] {
    console.log('🔧 Processing time results...');
    
    // **FIX: Handle multiple possible response structures**
    let timeResult = null;
    
    // Try different possible response structures
    if (results?.cmp_result?.time_result) {
      timeResult = results.cmp_result.time_result;
      console.log('✅ Found cmp_result.time_result in response');
    } else if (results?.cpm_result?.time_result) {
      timeResult = results.cpm_result.time_result;
      console.log('✅ Found cpm_result.time_result in response (alternative structure)');
    } else if (results?.result?.time_result) {
      timeResult = results.result.time_result;
      console.log('✅ Found result.time_result in response (alternative structure)');
    } else if (results?.time_result) {
      timeResult = results.time_result;
      console.log('✅ Found direct time_result in response');
    } else if (results && typeof results === 'object' && (results.node_values || results.critical_nodes)) {
      timeResult = results;
      console.log('✅ Using direct response as time result');
    } else {
      console.warn('⚠️ No time results found in CPM response structure:', Object.keys(results || {}));
      return [];
    }

    const networkInfo = this.networkInfo();
    if (!networkInfo) {
      console.error('❌ No network info available for processing time results');
      return [];
    }
    
    const criticalNodesSet = new Set(timeResult.critical_nodes || []);
    const nodeValues = timeResult.node_values || {};
    const criticalValue = timeResult.critical_value || 0;
    
    console.log(`📊 Processing time data for ${Object.keys(nodeValues).length} nodes`);
    console.log(`🎯 Critical nodes: ${criticalNodesSet.size}, Critical value: ${criticalValue}`);
    
    const processedResults: TimeResult[] = [];
    
    // **ENHANCED: Process all nodes with time values with better error handling**
    Object.entries(nodeValues).forEach(([nodeIdStr, timeValue]) => {
      try {
        const nodeId = parseInt(nodeIdStr);
        if (isNaN(nodeId)) {
          console.warn(`⚠️ Invalid node ID in time values: ${nodeIdStr}`);
          return;
        }
        
        const isOnCriticalPath = criticalNodesSet.has(nodeId);
        const timeValueNum = typeof timeValue === 'number' ? timeValue : parseFloat(timeValue as string) || 0;
        
        // Calculate slack time (0 for critical path nodes, positive for non-critical)
        const slack = isOnCriticalPath ? 0 : Math.max(0, criticalValue - timeValueNum);
        
        processedResults.push({
          nodeId,
          timeValue: timeValueNum,
          isOnCriticalPath,
          earliestStart: timeValueNum, // Simplified - in full CPM this would be calculated
          latestStart: timeValueNum + slack,
          slack,
          nodeType: this.getNodeType(nodeId, networkInfo)
        });
      } catch (error) {
        console.error(`❌ Error processing time data for node ${nodeIdStr}:`, error);
      }
    });
    
    console.log(`✅ Processed ${processedResults.length} time results`);
    return processedResults.sort((a, b) => a.nodeId - b.nodeId);
  }

  /**
   * Calculate comprehensive time performance metrics
   */
  private calculateTimeMetrics(results: any, processedResults: TimeResult[]): TimeMetrics {
    const networkInfo = this.networkInfo();
    
    // **FIX: Handle multiple possible response structures for time result**
    let timeResult = null;
    let computationTime = 0;
    
    if (results?.cmp_result?.time_result) {
      timeResult = results.cmp_result.time_result;
      computationTime = results.cmp_result.computation_time || 0;
    } else if (results?.cpm_result?.time_result) {
      timeResult = results.cpm_result.time_result;
      computationTime = results.cpm_result.computation_time || 0;
    } else if (results?.time_result) {
      timeResult = results.time_result;
      computationTime = results.computation_time || 0;
    }
    
    const criticalPathDuration = timeResult?.critical_value || 0;
    const criticalNodesCount = timeResult?.critical_nodes?.length || 0;
    const totalTimeValues = processedResults.reduce((sum, result) => sum + result.timeValue, 0);
    const averageNodeTime = processedResults.length > 0
      ? totalTimeValues / processedResults.length
      : 0;
    
    const slackTimes = processedResults.map(r => r.slack).filter(s => s > 0);
    const maxSlackTime = slackTimes.length > 0 ? Math.max(...slackTimes) : 0;
    const minSlackTime = slackTimes.length > 0 ? Math.min(...slackTimes) : 0;
    
    const sourceNodes = networkInfo?.sourceNodes.length || 0;
    const targetNodes = networkInfo?.sinkNodes.length || 0;
    
    console.log(`⏰ Time metrics calculated: Critical path duration: ${criticalPathDuration}, Critical nodes: ${criticalNodesCount}`);
    
    return {
      totalNodes: processedResults.length,
      criticalPathDuration,
      criticalPathLength: criticalNodesCount,
      averageNodeTime,
      maxSlackTime,
      minSlackTime,
      computationTime,
      sourceNodes,
      targetNodes,
      criticalNodesCount
    };
  }

  /**
   * Format time value for display
   */
  formatTime(timeValue: number): string {
    if (timeValue >= 1000) {
      return (timeValue / 1000).toFixed(1) + 'K';
    } else {
      return timeValue.toFixed(1);
    }
  }

  /**
   * Format slack time for display
   */
  formatSlack(slack: number): string {
    return slack.toFixed(1);
  }

  /**
   * Get CSS class for critical path visualization
   */
  getCriticalPathColorClass(isOnCriticalPath: boolean): string {
    return isOnCriticalPath ? 'critical-path' : 'non-critical-path';
  }

  /**
   * Get tooltip text for critical path status
   */
  getCriticalPathTooltip(isOnCriticalPath: boolean): string {
    return isOnCriticalPath 
      ? 'Critical Path - any delay affects project duration'
      : 'Non-Critical Path - has slack time available';
  }

  /**
   * Clear current results and reset component state
   */
  clearResults(): void {
    this.timeResults.set([]);
    this.timeMetrics.set(null);
    this.errorMessage.set(null);
    this.clearScenarioData();
    console.log('🧹 Cleared time analysis results');
  }

  // **NEW: Check if scenario has results**
  hasScenarioResults(scenarioName: string): boolean {
    return this.scenarioResults.has(scenarioName);
  }

  /**
   * Get node type based on network structure from AnalysisStateService
   */
  getNodeType(nodeId: number, networkInfo: any): string {
    const types: string[] = [];
    
    if (networkInfo.sourceNodes.includes(nodeId)) types.push('Source');
    if (networkInfo.sinkNodes.includes(nodeId)) types.push('Sink');
    if (networkInfo.forkNodes.includes(nodeId)) types.push('Fork');
    if (networkInfo.joinNodes.includes(nodeId)) types.push('Join');
    
    return types.length > 0 ? types.join(' + ') : 'Regular';
  }

  /**
   * Event handlers for pagination and filtering
   */
  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  onSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchTerm.set(target.value);
    this.pageIndex.set(0); // Reset to first page
  }

  onNodeTypeFilter(types: string[]): void {
    this.selectedNodeTypes.set(types);
    this.pageIndex.set(0); // Reset to first page
  }

  onCriticalPathFilter(showOnly: boolean): void {
    this.showOnlyCriticalPath.set(showOnly);
    this.pageIndex.set(0); // Reset to first page
  }
}