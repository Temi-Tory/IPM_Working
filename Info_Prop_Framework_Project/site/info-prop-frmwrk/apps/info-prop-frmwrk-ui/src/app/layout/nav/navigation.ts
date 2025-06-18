import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { GraphStateService } from '../../services/graph-state-service';

export interface NavItem {
  label: string;
  icon: string;
  route?: string;
  action?: () => void;
  children?: NavItem[];
  disabled?: boolean;
  requiresGraph?: boolean;
  requiresAnalysis?: boolean;
  disabledReason?: string;
}

@Component({
  selector: 'app-navigation',
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatToolbarModule,
    MatTooltipModule
  ],
  templateUrl: './navigation.html',
  styleUrl: './navigation.scss',
})
export class Navigation {
  // Inject graph state service
  private readonly graphState = inject(GraphStateService);
  
  isExpanded = true;

  // Computed properties for navigation state
  readonly isGraphLoaded = computed(() => this.graphState.isGraphLoaded());
  readonly hasAnalysisResults = computed(() => this.graphState.lastResults() !== null);
  readonly lastAnalysisType = computed(() => this.graphState.lastAnalysisType());
  readonly hasDiamonds = computed(() => this.graphState.hasDiamonds());

  // Base navigation items configuration
  private readonly baseNavItems: Omit<NavItem, 'disabled' | 'disabledReason'>[] = [
    {
      label: 'Upload File',
      icon: 'cloud_upload',
      route: '/upload',
      requiresGraph: false
    },
    {
      label: 'Modify Input Parameters',
      icon: 'settings',
      route: '/parameters',
      requiresGraph: true
    },
    {
      label: 'Network Structure',
      icon: 'hub',
      route: '/network-structure',
      requiresGraph: true
    },
    {
      label: 'Network Visualization',
      icon: 'scatter_plot',
      route: '/visualization',
      requiresGraph: true
    },
    {
      label: 'Diamond Analysis',
      icon: 'auto_awesome',
      route: '/diamond-analysis',
      requiresGraph: true
    },
    {
      label: 'Reachability Analysis',
      icon: 'share',
      route: '/reachability',
      requiresGraph: true,
      requiresAnalysis: true
    },
    {
      label: 'Critical Path Analysis',
      icon: 'alt_route',
      route: '/critical-path',
      requiresGraph: true,
      requiresAnalysis: true
    }
  ];

  // Computed property for navigation items with state-based enabling/disabling
  readonly navItems = computed((): NavItem[] => {
    const isGraphLoaded = this.isGraphLoaded();
    const hasAnalysis = this.hasAnalysisResults();
    const analysisType = this.lastAnalysisType();
    const hasDiamonds = this.hasDiamonds();

    return this.baseNavItems.map(item => {
      let disabled = false;
      let disabledReason = '';

      // Check graph requirements
      if (item.requiresGraph && !isGraphLoaded) {
        disabled = true;
        disabledReason = 'Please upload a graph file first';
      }

      // Check analysis requirements
      if (item.requiresAnalysis && (!hasAnalysis || analysisType === 'structure')) {
        disabled = true;
        disabledReason = 'Please run full analysis first';
      }

      // Special case for Diamond Analysis
      if (item.route === '/diamond-analysis' && isGraphLoaded && !hasDiamonds) {
        disabled = true;
        disabledReason = 'No diamond structures found in current graph';
      }

      // Special case for Visualization - allow if structure analysis done
      if (item.route === '/visualization' && isGraphLoaded) {
        disabled = false; // Visualization works with just structure
        disabledReason = '';
      }

      return {
        ...item,
        disabled,
        disabledReason
      };
    });
  });

  toggleSidebar(): void {
    this.isExpanded = !this.isExpanded;
  }

  onNavItemClick(item: NavItem): void {
    // Prevent navigation if item is disabled
    if (item.disabled) {
      return;
    }

    if (item.action) {
      item.action();
    }
    // Navigation will be handled by routerLink in template
  }

  // Helper method to get tooltip text for nav items
  getTooltipText(item: NavItem): string {
    if (item.disabled && item.disabledReason) {
      return item.disabledReason;
    }
    return item.label;
  }

  // Helper method to check if item should show as disabled
  isItemDisabled(item: NavItem): boolean {
    return item.disabled || false;
  }
}