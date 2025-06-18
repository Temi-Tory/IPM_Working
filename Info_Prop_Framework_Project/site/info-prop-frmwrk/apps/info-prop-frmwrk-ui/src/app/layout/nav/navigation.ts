import { Component, inject, computed, signal, OnInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

// Angular Material imports using latest syntax
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatRippleModule } from '@angular/material/core';

import { GraphStateService } from '../../services/graph-state-service';

export interface NavItem {
  readonly label: string;
  readonly icon: string;
  readonly route?: string;
  readonly action?: () => void;
  readonly children?: readonly NavItem[];
  readonly disabled?: boolean;
  readonly requiresGraph?: boolean;
  readonly requiresAnalysis?: boolean;
  readonly disabledReason?: string;
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
    MatTooltipModule,
    MatRippleModule
  ],
  templateUrl: './navigation.html',
  styleUrl: './navigation.scss',
})
export class Navigation implements OnInit {
  // Dependency injection
  private readonly graphState = inject(GraphStateService);
  private readonly destroyRef = inject(DestroyRef);
  
  // Component state using signals
  readonly isExpanded = signal(true);

  // Computed properties for navigation state
  readonly isGraphLoaded = computed(() => this.graphState.isGraphLoaded());
  readonly hasAnalysisResults = computed(() => this.graphState.lastResults() !== null);
  readonly lastAnalysisType = computed(() => this.graphState.lastAnalysisType());
  readonly hasDiamonds = computed(() => this.graphState.hasDiamonds());

  // Base navigation items configuration - immutable data
  private readonly baseNavItems: readonly Omit<NavItem, 'disabled' | 'disabledReason'>[] = [
    {
      label: 'Upload File',
      icon: 'cloud_upload',
      route: '/upload',
      requiresGraph: false
    },
    {
      label: 'Modify Input Parameters',
      icon: 'tune',
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
      requiresGraph: true
    },
    {
      label: 'Critical Path Analysis',
      icon: 'alt_route',
      route: '/critical-path',
      requiresGraph: true
    }
  ] as const;

  // Computed property for navigation items with state-based enabling/disabling
  readonly navItems = computed((): readonly NavItem[] => {
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
      } as NavItem;
    });
  });

  ngOnInit(): void {
    // Set up any subscriptions or initialization logic here
    // Example: Listen to window resize events for responsive behavior
    this.handleResponsiveDesign();
  }

  /**
   * Toggles the sidebar expanded/collapsed state
   */
  toggleSidebar(): void {
    this.isExpanded.update(expanded => !expanded);
  }

  /**
   * Handles navigation item clicks
   * @param item - The navigation item that was clicked
   */
  onNavItemClick(item: NavItem): void {
    // Prevent navigation if item is disabled
    if (item.disabled) {
      return;
    }

    // Execute custom action if defined
    if (item.action) {
      item.action();
    }
    
    // Navigation will be handled by routerLink in template
    // We could add analytics tracking here if needed
    this.trackNavigation(item);
  }

  /**
   * Gets the appropriate tooltip text for a navigation item
   * @param item - The navigation item
   * @returns The tooltip text to display
   */
  getTooltipText(item: NavItem): string {
    if (item.disabled && item.disabledReason) {
      return item.disabledReason;
    }
    return item.label;
  }

  /**
   * Checks if a navigation item should be disabled
   * @param item - The navigation item to check
   * @returns True if the item should be disabled
   */
  isItemDisabled(item: NavItem): boolean {
    return item.disabled || false;
  }

  /**
   * Gets the ARIA label for a navigation item
   * @param item - The navigation item
   * @returns The ARIA label text
   */
  getAriaLabel(item: NavItem): string {
    const baseLabel = item.label;
    if (item.disabled && item.disabledReason) {
      return `${baseLabel}, disabled: ${item.disabledReason}`;
    }
    return baseLabel;
  }

  /**
   * Handles keyboard navigation
   * @param event - The keyboard event
   * @param item - The navigation item
   */
  onKeyDown(event: KeyboardEvent, item: NavItem): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.onNavItemClick(item);
    }
  }

  /**
   * Private method to handle responsive design
   */
  private handleResponsiveDesign(): void {
    // Check if we're on mobile and auto-collapse if needed
    if (typeof window !== 'undefined') {
      const checkWidth = () => {
        if (window.innerWidth < 768) {
          this.isExpanded.set(false);
        }
      };

      // Initial check
      checkWidth();

      // Listen for resize events
      window.addEventListener('resize', checkWidth);
      
      // Clean up listener on destroy
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('resize', checkWidth);
      });
    }
  }

  /**
   * Private method to track navigation for analytics
   * @param item - The navigation item that was clicked
   */
  private trackNavigation(item: NavItem): void {
    // Add analytics tracking here if needed
    console.debug('Navigation:', item.label, item.route);
  }

  /**
   * Gets the router link for an item, ensuring disabled items don't navigate
   * @param item - The navigation item
   * @returns The router link or null if disabled
   */
  getRouterLink(item: NavItem): string | null {
    return this.isItemDisabled(item) ? null : (item.route || null);
  }

  /**
   * Gets the tab index for accessibility
   * @param item - The navigation item
   * @returns The appropriate tab index
   */
  getTabIndex(item: NavItem): number {
    return this.isItemDisabled(item) ? -1 : 0;
  }
}