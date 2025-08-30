import { Component, Inject, OnInit, OnDestroy, signal, computed, ChangeDetectionStrategy } from '@angular/core';
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
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Subject, takeUntil } from 'rxjs';

import { NetworkDialogService } from '../../../services/network-dialog.service';
import { 
  EdgeDialogData, 
  EdgeDialogEvent 
} from '../../../interfaces/network-dialog.interfaces';

export interface EdgeDetailDialogData {
  sourceId: number;
  targetId: number;
  networkName?: string;
}

@Component({
  selector: 'app-edge-detail-dialog',
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
    MatBadgeModule
  ],
  templateUrl: './edge-detail-dialog.component.html',
  styleUrls: ['./edge-detail-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EdgeDetailDialogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Data signals
  edgeData = signal<EdgeDialogData | null>(null);
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);
  
  // UI state signals
  selectedTabIndex = signal<number>(0);
  
  // Responsive design
  isMobile = signal<boolean>(false);
  isTablet = signal<boolean>(false);
  
  // Computed properties
  dialogTitle = computed(() => {
    const data = this.edgeData();
    return data ? `Edge ${data.connection.sourceNodeId} → ${data.connection.targetNodeId}` : 'Edge Details';
  });
  
  connectionSummary = computed(() => {
    const data = this.edgeData();
    if (!data) return '';
    
    return `${data.connection.sourceType} → ${data.connection.targetType}`;
  });
  
  classificationChips = computed(() => {
    const data = this.edgeData();
    if (!data) return [];
    
    const chips: { label: string; color: string; icon?: string }[] = [];
    
    // Edge type
    chips.push({
      label: data.connection.edgeType,
      color: 'primary',
      icon: 'arrow_forward'
    });
    
    // Classifications
    const classification = data.classification;
    if (classification.isCriticalPath) {
      chips.push({ label: 'CRITICAL PATH', color: 'warn', icon: 'priority_high' });
    }
    if (classification.isBottleneck) {
      chips.push({ label: 'BOTTLENECK', color: 'warn', icon: 'warning' });
    }
    
    // Flow importance
    const importanceColor = classification.flowImportance === 'high' ? 'warn' : 
                           classification.flowImportance === 'medium' ? 'accent' : 'basic';
    chips.push({ 
      label: `${classification.flowImportance.toUpperCase()} FLOW`, 
      color: importanceColor,
      icon: 'trending_up'
    });
    
    // Structural role
    const roleColor = classification.structuralRole === 'critical' ? 'warn' :
                     classification.structuralRole === 'bridge' ? 'accent' : 'basic';
    chips.push({ 
      label: classification.structuralRole.toUpperCase(), 
      color: roleColor,
      icon: this.getStructuralRoleIcon(classification.structuralRole)
    });
    
    return chips;
  });

  constructor(
    public dialogRef: MatDialogRef<EdgeDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EdgeDetailDialogData,
    private dialogService: NetworkDialogService,
    private breakpointObserver: BreakpointObserver
  ) {
    this.setupResponsiveDesign();
  }

  ngOnInit(): void {
    this.loadEdgeData();
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

  async loadEdgeData(): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set(null);
      
      const edgeData = await this.dialogService.getEdgeDialogData(
        this.data.sourceId, 
        this.data.targetId
      );
      
      if (edgeData) {
        this.edgeData.set(edgeData);
      } else {
        this.error.set('Failed to load edge data');
      }
    } catch (error) {
      console.error('Error loading edge data:', error);
      this.error.set('An error occurred while loading edge data');
    } finally {
      this.isLoading.set(false);
    }
  }

  // Tab navigation
  onTabChange(index: number): void {
    this.selectedTabIndex.set(index);
    
    // Emit event for analytics/tracking
    this.emitDialogEvent('navigate', { tabIndex: index });
  }

  // Navigation actions
  navigateToSourceNode(): void {
    const data = this.edgeData();
    if (!data) return;
    
    this.emitDialogEvent('navigate', { targetNodeId: data.connection.sourceNodeId });
    this.dialogRef.close({ action: 'navigate', nodeId: data.connection.sourceNodeId });
  }

  navigateToTargetNode(): void {
    const data = this.edgeData();
    if (!data) return;
    
    this.emitDialogEvent('navigate', { targetNodeId: data.connection.targetNodeId });
    this.dialogRef.close({ action: 'navigate', nodeId: data.connection.targetNodeId });
  }

  navigateToRelatedEdge(sourceId: number, targetId: number): void {
    this.emitDialogEvent('navigate', { relatedEdge: { sourceId, targetId } });
    this.dialogRef.close({ 
      action: 'navigate', 
      edgeId: { sourceId, targetId }
    });
  }

  // Export functionality
  exportEdgeData(): void {
    const data = this.edgeData();
    if (!data) return;
    
    const exportData = {
      type: 'edge' as const,
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
    a.download = `edge_${data.connection.sourceNodeId}_${data.connection.targetNodeId}_details.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.emitDialogEvent('export', { format: 'json' });
  }

  // Helper methods
  getImportanceColor(importance: string): string {
    const colorMap: Record<string, string> = {
      'high': 'warn',
      'medium': 'accent',
      'low': 'basic'
    };
    return colorMap[importance] || 'basic';
  }

  getImportanceIcon(importance: string): string {
    const iconMap: Record<string, string> = {
      'high': 'trending_up',
      'medium': 'trending_flat',
      'low': 'trending_down'
    };
    return iconMap[importance] || 'trending_flat';
  }

  getStructuralRoleIcon(role: string): string {
    const iconMap: Record<string, string> = {
      'bridge': 'compare_arrows',
      'redundant': 'multiple_stop',
      'critical': 'priority_high',
      'normal': 'radio_button_unchecked'
    };
    return iconMap[role] || 'radio_button_unchecked';
  }

  getStructuralRoleColor(role: string): string {
    const colorMap: Record<string, string> = {
      'bridge': 'accent',
      'redundant': 'basic',
      'critical': 'warn',
      'normal': 'basic'
    };
    return colorMap[role] || 'basic';
  }

  private emitDialogEvent(type: EdgeDialogEvent['type'], data?: any): void {
    const edgeData = this.edgeData();
    if (!edgeData) return;
    
    const event: EdgeDialogEvent = {
      type,
      sourceId: edgeData.connection.sourceNodeId,
      targetId: edgeData.connection.targetNodeId,
      data
    };
    
    // Could emit to a service for analytics or other purposes
    console.log('Edge Dialog Event:', event);
  }

  // Utility methods for templates
  formatNumber(num: number): string {
    return num.toLocaleString();
  }

  formatPercentage(value: number): string {
    return (value * 100).toFixed(1) + '%';
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