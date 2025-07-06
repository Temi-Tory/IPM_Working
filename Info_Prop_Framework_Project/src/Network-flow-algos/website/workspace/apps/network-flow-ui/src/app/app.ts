import { Component, OnInit, inject, computed } from '@angular/core';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { GlobalStateService, WorkflowStep } from '../../../../libs/network-core/src';

@Component({
  imports: [RouterModule, CommonModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly globalState = inject(GlobalStateService);
  private readonly router = inject(Router);

  protected title = 'Information Propagation Framework';
  protected isSidebarCollapsed = false;
  protected isMobile = false;
  protected showMobileOverlay = false;

  // Global state signals
  readonly workflowState = this.globalState.workflowState;
  readonly hasSession = this.globalState.hasSession;
  readonly isLoading = this.globalState.isLoading;
  readonly error = this.globalState.error;

  // Current route information
  protected currentRoute = '';
  protected currentRouteData: any = {};

  // Computed breadcrumbs
  readonly breadcrumbs = computed(() => {
    const route = this.currentRoute;
    const workflowStep = this.workflowState().currentStep;
    
    const breadcrumbMap: Record<string, { label: string; path: string }[]> = {
      '/network-setup': [
        { label: 'Home', path: '/' },
        { label: 'Network Setup', path: '/network-setup' }
      ],
      '/network-details': [
        { label: 'Home', path: '/' },
        { label: 'Network Setup', path: '/network-setup' },
        { label: 'Network Structure', path: '/network-details' }
      ],
      '/diamond-analysis': [
        { label: 'Home', path: '/' },
        { label: 'Network Setup', path: '/network-setup' },
        { label: 'Network Structure', path: '/network-details' },
        { label: 'Diamond Analysis', path: '/diamond-analysis' }
      ],
      '/reachability-analysis': [
        { label: 'Home', path: '/' },
        { label: 'Network Setup', path: '/network-setup' },
        { label: 'Network Structure', path: '/network-details' },
        { label: 'Reachability Analysis', path: '/reachability-analysis' }
      ],
      '/monte-carlo': [
        { label: 'Home', path: '/' },
        { label: 'Network Setup', path: '/network-setup' },
        { label: 'Network Structure', path: '/network-details' },
        { label: 'Monte Carlo', path: '/monte-carlo' }
      ],
      '/results': [
        { label: 'Home', path: '/' },
        { label: 'Network Setup', path: '/network-setup' },
        { label: 'Network Structure', path: '/network-details' },
        { label: 'Results', path: '/results' }
      ]
    };
    
    return breadcrumbMap[route] || [{ label: 'Home', path: '/' }];
  });

  constructor() {
    this.checkScreenSize();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.checkScreenSize());
    }
  }

  ngOnInit(): void {
    // Track route changes for breadcrumbs
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.currentRoute = event.urlAfterRedirects;
      // Get route data if available
      const routeData = this.router.routerState.root.firstChild?.snapshot.data;
      this.currentRouteData = routeData || {};
    });

    // Set initial route
    this.currentRoute = this.router.url;
  }

  protected toggleSidebar(): void {
    if (this.isMobile) {
      this.showMobileOverlay = !this.showMobileOverlay;
    } else {
      this.isSidebarCollapsed = !this.isSidebarCollapsed;
    }
  }

  protected closeMobileMenu(): void {
    this.showMobileOverlay = false;
  }

  protected navigateToStep(path: string): void {
    this.router.navigate([path]);
    this.closeMobileMenu();
  }

  protected getWorkflowStep(path: string): WorkflowStep {
    const pathToStepMap: Record<string, WorkflowStep> = {
      '/network-setup': 'network-upload',
      '/network-details': 'network-structure',
      '/diamond-analysis': 'diamond-analysis',
      '/reachability-analysis': 'reachability-analysis',
      '/monte-carlo': 'monte-carlo',
      '/results': 'results'
    };
    return pathToStepMap[path] || 'network-upload';
  }

  protected clearError(): void {
    this.globalState.clearError();
  }

  private checkScreenSize(): void {
    if (typeof window !== 'undefined') {
      this.isMobile = window.innerWidth < 1024;
      if (!this.isMobile) {
        this.showMobileOverlay = false;
      }
    }
  }

  protected navigationItems = [
    {
      path: '/network-setup',
      label: 'Network Setup',
      icon: 'M4 7v10c0 2.21 3.79 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.79 4 8 4s8-1.79 8-4M4 7c0-2.21 3.79-4 8-4s8 1.79 8 4',
      description: 'Configure and upload network data'
    },
    {
      path: '/network-details',
      label: 'Network Structure',
      icon: 'M11 2a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM21 21l-4.35-4.35',
      description: 'View graph structure details'
    },
    {
      path: '/diamond-analysis',
      label: 'Diamond Analysis',
      icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
      description: 'Diamond structure identification'
    },
    {
      path: '/reachability-analysis',
      label: 'Reachability Analysis',
      icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
      description: 'Node reachability with belief propagation'
    },
    {
      path: '/monte-carlo',
      label: 'Monte Carlo',
      icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c-1.1 0-2 .9-2 2h18c0-1.1-.9-2-2-2V5c0-1.1-.9-2-2-2z',
      description: 'Monte Carlo validation analysis'
    },
    {
      path: '/results',
      label: 'Results',
      icon: 'M9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4zm2.5 2.25l1.41-1.41L15.5 12.5 13 15l-3.5-3.5L4 17h15.5v.25z',
      description: 'View and export analysis results'
    }
  ];
}