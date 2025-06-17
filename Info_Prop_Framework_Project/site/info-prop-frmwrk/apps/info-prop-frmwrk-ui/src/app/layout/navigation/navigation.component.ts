import { Component, ViewChild, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable, Subject } from 'rxjs';
import { map, shareReplay, takeUntil, filter } from 'rxjs/operators';

import { DataService } from '../../services/data.service';

export interface NavigationItem {
  label: string;
  icon: string;
  route: string;
  disabled?: boolean;
  requiresFile?: boolean;
  requiresStructure?: boolean;
  requiresReachability?: boolean;
  badge?: number;
  tier?: number;
}

export interface AnalysisProgress {
  tier1Complete: boolean;
  tier2Complete: boolean;
  tier3Complete: boolean;
  currentTier: number;
}

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatBadgeModule,
    MatTooltipModule,
    MatDividerModule,
    MatProgressBarModule,
    MatChipsModule
  ],
  templateUrl: './navigation.component.html',
  styleUrls: ['./navigation.component.scss']
})
export class NavigationComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private breakpointObserver = inject(BreakpointObserver);
  private router = inject(Router);
  private dataService = inject(DataService);

  @ViewChild('drawer') drawer: MatSidenav | undefined;

  // Responsive layout
  isHandset$: Observable<boolean> = this.breakpointObserver.observe(Breakpoints.Handset)
    .pipe(
      map(result => result.matches),
      shareReplay()
    );

  // Navigation items for analysis tabs
  navigationItems: NavigationItem[] = [
    {
      label: 'File Upload',
      icon: 'upload_file',
      route: '/upload',
      tier: 0
    },
    {
      label: 'Structure Analysis',
      icon: 'account_tree',
      route: '/structure',
      requiresFile: true,
      tier: 1
    },
    {
      label: 'Network Visualization',
      icon: 'bubble_chart',
      route: '/visualization',
      requiresFile: true,
      tier: 1
    },
    {
      label: 'Diamond Analysis',
      icon: 'diamond',
      route: '/diamonds',
      requiresFile: true,
      requiresStructure: true,
      tier: 2
    },
    {
      label: 'Reachability Analysis',
      icon: 'psychology',
      route: '/reachability',
      requiresFile: true,
      requiresStructure: true,
      tier: 3
    },
    {
      label: 'Monte Carlo Comparison',
      icon: 'compare_arrows',
      route: '/comparison',
      requiresFile: true,
      requiresReachability: true,
      tier: 3
    }
  ];

  // User menu items
  userMenuItems = [
    { label: 'Settings', icon: 'settings', action: 'settings' },
    { label: 'Export Data', icon: 'download', action: 'export' },
    { label: 'Help', icon: 'help', action: 'help' },
    { label: 'About', icon: 'info', action: 'about' }
  ];

  // Component state
  currentRoute = '';
  currentFile: File | null = null;
  isLoading = false;
  error: string | null = null;
  analysisProgress: AnalysisProgress = {
    tier1Complete: false,
    tier2Complete: false,
    tier3Complete: false,
    currentTier: 0
  };

  ngOnInit() {
    // Subscribe to router events to track current route
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        map(event => (event as NavigationEnd).url),
        takeUntil(this.destroy$)
      )
      .subscribe(url => {
        this.currentRoute = url;
        this.updateNavigationState();
      });

    // Subscribe to data service observables
    this.dataService.currentFile$
      .pipe(takeUntil(this.destroy$))
      .subscribe(file => {
        this.currentFile = file;
        this.updateNavigationState();
      });

    this.dataService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        this.isLoading = loading;
      });

    this.dataService.error$
      .pipe(takeUntil(this.destroy$))
      .subscribe(error => {
        this.error = error;
      });

    // Subscribe to analysis progress (will be implemented in enhanced data service)
    this.dataService.analysisProgress$
      .pipe(takeUntil(this.destroy$))
      .subscribe(progress => {
        this.analysisProgress = progress;
        this.updateNavigationState();
      });

    // Set initial navigation state
    this.currentRoute = this.router.url;
    this.updateNavigationState();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleDrawer() {
    if (this.drawer) {
      this.drawer.toggle();
    }
  }

  navigateTo(route: string) {
    if (route && this.isRouteAccessible(route)) {
      this.router.navigate([route]);
      
      // Close drawer on mobile after navigation
      this.isHandset$.pipe(takeUntil(this.destroy$)).subscribe(isHandset => {
        if (isHandset && this.drawer) {
          this.drawer.close();
        }
      });
    }
  }

  onUserMenuAction(action: string) {
    switch (action) {
      case 'settings':
        // Navigate to settings (future implementation)
        console.log('Settings clicked');
        break;
      case 'export':
        this.exportCurrentData();
        break;
      case 'help':
        // Open help dialog (future implementation)
        console.log('Help clicked');
        break;
      case 'about':
        // Open about dialog (future implementation)
        console.log('About clicked');
        break;
    }
  }

  clearCurrentFile() {
    this.dataService.clearAllData();
    this.router.navigate(['/upload']);
  }

  private updateNavigationState() {
    // Update disabled state for navigation items based on current analysis state
    this.navigationItems.forEach(item => {
      item.disabled = !this.isRouteAccessible(item.route);
    });
  }

  private isRouteAccessible(route: string): boolean {
    const item = this.navigationItems.find(nav => nav.route === route);
    if (!item) return true;

    // Always allow access to upload page
    if (route === '/upload') return true;

    // Check file requirement
    if (item.requiresFile && !this.currentFile) return false;

    // Check structure analysis requirement (Tier 1)
    if (item.requiresStructure && !this.analysisProgress.tier1Complete) return false;

    // Check reachability analysis requirement (Tier 3)
    if (item.requiresReachability && !this.analysisProgress.tier3Complete) return false;

    return true;
  }

  private exportCurrentData() {
    // Export current analysis data (basic implementation)
    if (!this.currentFile) {
      console.log('No data to export');
      return;
    }

    // This will be enhanced in later phases
    const data = {
      filename: this.currentFile.name,
      analysisProgress: this.analysisProgress,
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analysis-export-${Date.now()}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  // Helper methods for template
  getProgressPercentage(): number {
    let completed = 0;
    if (this.analysisProgress.tier1Complete) completed += 33;
    if (this.analysisProgress.tier2Complete) completed += 33;
    if (this.analysisProgress.tier3Complete) completed += 34;
    return completed;
  }

  getProgressText(): string {
    if (!this.currentFile) return 'No file loaded';
    if (this.analysisProgress.tier3Complete) return 'Analysis complete';
    if (this.analysisProgress.tier2Complete) return 'Tier 2 complete';
    if (this.analysisProgress.tier1Complete) return 'Tier 1 complete';
    return 'Analysis pending';
  }

  getCurrentFileName(): string {
    return this.currentFile ? this.currentFile.name : 'No file selected';
  }

  getFileSize(): string {
    if (!this.currentFile) return '';
    const bytes = this.currentFile.size;
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  trackByFn(index: number, item: NavigationItem): string {
    return item.route;
  }
}