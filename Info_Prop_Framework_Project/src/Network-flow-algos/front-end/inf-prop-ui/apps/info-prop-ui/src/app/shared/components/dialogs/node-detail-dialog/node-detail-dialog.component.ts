import { Component, Inject, OnInit, OnDestroy, signal, computed, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Subject, takeUntil } from 'rxjs';

import { NetworkDialogService } from '../../../services/network-dialog.service';
import { 
  NodeDialogData, 
  VirtualScrollItem, 
  ResponsiveDialogConfig,
  NodeDialogEvent 
} from '../../../interfaces/network-dialog.interfaces';

export interface NodeDetailDialogData {
  nodeId: number;
  networkName?: string;
}

@Component({
  selector: 'app-node-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatTabsModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatButtonModule,
    MatListModule,
    MatExpansionModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDividerModule,
    MatBadgeModule,
    MatProgressBarModule,
    ScrollingModule
  ],
  templateUrl: './node-detail-dialog.component.html',
  styleUrls: ['./node-detail-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NodeDetailDialogComponent implements OnInit, OnDestroy {
  @ViewChild('ancestorsViewport') ancestorsViewport!: CdkVirtualScrollViewport;
  @ViewChild('descendantsViewport') descendantsViewport!: CdkVirtualScrollViewport;

  private destroy$ = new Subject<void>();
  
  // Data signals
  nodeData = signal<NodeDialogData | null>(null);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);
  
  // Virtual scrolling signals
  ancestorsItems = signal<VirtualScrollItem[]>([]);
  descendantsItems = signal<VirtualScrollItem[]>([]);
  ancestorsPage = signal<number>(0);
  descendantsPage = signal<number>(0);
  
  // UI state signals
  selectedTabIndex = signal<number>(0);
  expandedSections = signal<Set<string>>(new Set());
  
  // Responsive design
  isMobile = signal<boolean>(false);
  isTablet = signal<boolean>(false);
  
  // Virtual scrolling configuration
  readonly virtualScrollConfig = {
    itemSize: 48,
    bufferSize: 5,
    pageSize: 50
  };
  
  // Computed properties
  shouldUseVirtualScrolling = computed(() => {
    const data = this.nodeData();
    if (!data) return false;
    
    const performanceConfig = this.dialogService.getPerformanceConfig();
    return data.connectivity.ancestorCount > performanceConfig.virtualScrollingThreshold ||
           data.connectivity.descendantCount > performanceConfig.virtualScrollingThreshold;
  });
  
  dialogTitle = computed(() => {
    const data = this.nodeData();
    return data ? `${data.displayName} Details` : 'Node Details';
  });
  
  connectivitySummary = computed(() => {
    const data = this.nodeData();
    if (!data) return '';
    
    const { inDegree, outDegree, ancestorCount, descendantCount } = data.connectivity;
    return `${inDegree} parents, ${outDegree} children, ${ancestorCount} ancestors, ${descendantCount} descendants`;
  });
  
  classificationChips = computed(() => {
    const data = this.nodeData();
    if (!data) return [];
    
    const chips: { label: string; color: string; icon?: string }[] = [];
    
    // Primary type
    chips.push({
      label: data.classification.primaryType.toUpperCase(),
      color: this.getTypeColor(data.classification.primaryType),
      icon: this.getTypeIcon(data.classification.primaryType)
    });
    
    // Special classifications
    const special = data.classification.specialClassifications;
    if (special.isHub) chips.push({ label: 'HUB', color: 'accent', icon: 'hub' });
    if (special.isBridge) chips.push({ label: 'BRIDGE', color: 'warn', icon: 'compare_arrows' });
    if (special.isBottleneck) chips.push({ label: 'BOTTLENECK', color: 'warn', icon: 'warning' });
    if (special.isCriticalPath) chips.push({ label: 'CRITICAL', color: 'warn', icon: 'priority_high' });
    if (special.isOrphan) chips.push({ label: 'ORPHAN', color: 'basic', icon: 'block' });
    
    return chips;
  });

  constructor(
    public dialogRef: MatDialogRef<NodeDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: NodeDetailDialogData,
    private dialogService: NetworkDialogService,
    private breakpointObserver: BreakpointObserver
  ) {
    this.setupResponsiveDesign();
  }

  ngOnInit(): void {
    this.loadNodeData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupResponsiveDesign(): void {
    // Monitor breakpoints for responsive design
    this.breakpointObserver
      .observe([Breakpoints.HandsetPortrait, Breakpoints.HandsetLandscape])
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        this.isMobile.set(result.matches);
      });
      
    this.breakpointObserver
      .observe([Breakpoints.TabletPortrait, Breakpoints.TabletLandscape])
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        this.isTablet.set(result.matches);
      });
  }

  async loadNodeData(): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set(null);
      
      const nodeData = await this.dialogService.getNodeDialogData(this.data.nodeId);
      
      if (nodeData) {
        this.nodeData.set(nodeData);
        
        // Load initial virtual scroll data if needed
        if (this.shouldUseVirtualScrolling()) {
          await this.loadInitialVirtualScrollData();
        }
      } else {
        this.error.set('Failed to load node data');
      }
    } catch (error) {
      console.error('Error loading node data:', error);
      this.error.set('An error occurred while loading node data');
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadInitialVirtualScrollData(): Promise<void> {
    const data = this.nodeData();
    if (!data) return;
    
    // Load first page of ancestors if needed
    if (data.connectivity.ancestorCount > 0) {
      const ancestors = await this.dialogService.getPaginatedAncestors(
        data.nodeId, 
        0, 
        this.virtualScrollConfig.pageSize
      );
      this.ancestorsItems.set(ancestors);
    }
    
    // Load first page of descendants if needed
    if (data.connectivity.descendantCount > 0) {
      const descendants = await this.dialogService.getPaginatedDescendants(
        data.nodeId, 
        0, 
        this.virtualScrollConfig.pageSize
      );
      this.descendantsItems.set(descendants);
    }
  }

  // Tab navigation
  onTabChange(index: number): void {
    this.selectedTabIndex.set(index);
    
    // Emit event for analytics/tracking
    this.emitDialogEvent('navigate', { tabIndex: index });
  }

  // Section expansion
  toggleSection(sectionName: string): void {
    const expanded = this.expandedSections();
    const newExpanded = new Set(expanded);
    
    if (newExpanded.has(sectionName)) {
      newExpanded.delete(sectionName);
    } else {
      newExpanded.add(sectionName);
    }
    
    this.expandedSections.set(newExpanded);
    this.emitDialogEvent('expand', { section: sectionName, expanded: newExpanded.has(sectionName) });
  }

  isSectionExpanded(sectionName: string): boolean {
    return this.expandedSections().has(sectionName);
  }

  // Virtual scrolling handlers
  async onAncestorsScrolled(index: number): Promise<void> {
    const data = this.nodeData();
    if (!data) return;
    
    const page = Math.floor(index / this.virtualScrollConfig.pageSize);
    if (page !== this.ancestorsPage()) {
      this.ancestorsPage.set(page);
      
      const newItems = await this.dialogService.getPaginatedAncestors(
        data.nodeId,
        page,
        this.virtualScrollConfig.pageSize
      );
      
      // Append new items to existing ones
      const currentItems = this.ancestorsItems();
      const startIndex = page * this.virtualScrollConfig.pageSize;
      const updatedItems = [...currentItems];
      
      newItems.forEach((item, i) => {
        updatedItems[startIndex + i] = item;
      });
      
      this.ancestorsItems.set(updatedItems);
    }
  }

  async onDescendantsScrolled(index: number): Promise<void> {
    const data = this.nodeData();
    if (!data) return;
    
    const page = Math.floor(index / this.virtualScrollConfig.pageSize);
    if (page !== this.descendantsPage()) {
      this.descendantsPage.set(page);
      
      const newItems = await this.dialogService.getPaginatedDescendants(
        data.nodeId,
        page,
        this.virtualScrollConfig.pageSize
      );
      
      // Append new items to existing ones
      const currentItems = this.descendantsItems();
      const startIndex = page * this.virtualScrollConfig.pageSize;
      const updatedItems = [...currentItems];
      
      newItems.forEach((item, i) => {
        updatedItems[startIndex + i] = item;
      });
      
      this.descendantsItems.set(updatedItems);
    }
  }

  // Navigation actions
  navigateToNode(nodeId: number): void {
    this.emitDialogEvent('navigate', { targetNodeId: nodeId });
    
    // Close current dialog and open new one
    this.dialogRef.close({ action: 'navigate', nodeId });
  }

  // Export functionality
  exportNodeData(): void {
    const data = this.nodeData();
    if (!data) return;
    
    const exportData = {
      type: 'node' as const,
      format: 'json' as const,
      data,
      timestamp: new Date().toISOString(),
      networkName: this.data.networkName || 'Unknown Network'
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `node_${data.nodeId}_details.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.emitDialogEvent('export', { format: 'json' });
  }

  // Helper methods
  getTypeColor(type: string): string {
    const colorMap: Record<string, string> = {
      'source': 'primary',
      'sink': 'accent',
      'fork': 'warn',
      'join': 'warn',
      'regular': 'basic'
    };
    return colorMap[type] || 'basic';
  }

  private getTypeIcon(type: string): string {
    const iconMap: Record<string, string> = {
      'source': 'input',
      'sink': 'output',
      'fork': 'call_split',
      'join': 'call_merge',
      'regular': 'radio_button_unchecked'
    };
    return iconMap[type] || 'radio_button_unchecked';
  }

  private emitDialogEvent(type: NodeDialogEvent['type'], data?: any): void {
    const nodeData = this.nodeData();
    if (!nodeData) return;
    
    const event: NodeDialogEvent = {
      type,
      nodeId: nodeData.nodeId,
      data
    };
    
    // Could emit to a service for analytics or other purposes
    console.log('Node Dialog Event:', event);
  }

  // Utility methods for templates
  formatNumber(num: number): string {
    return num.toLocaleString();
  }

  formatScore(score: number): string {
    return (score * 100).toFixed(1) + '%';
  }

  getScoreColor(score: number): string {
    if (score >= 0.7) return 'warn';
    if (score >= 0.4) return 'accent';
    return 'primary';
  }

  // Dialog actions
  onClose(): void {
    this.dialogRef.close();
  }

  onMinimize(): void {
    // Could implement minimize functionality
    this.emitDialogEvent('navigate', { action: 'minimize' });
  }
}