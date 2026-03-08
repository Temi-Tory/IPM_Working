import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { FileManagerService } from '../../shared/services/file-manager.service';
import { NetworkSessionService } from '../../shared/services/network-session.service';
import { CapacityV2Store } from './capacity-v2.store';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  badge?: string;
  hideWhen?: () => boolean;
}

@Component({
  selector: 'app-capacity-v2-sidenav-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatToolbarModule,
    MatProgressSpinnerModule,
    MatButtonToggleModule,
    MatChipsModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatSelectModule
  ],
  templateUrl: './capacity-v2-sidenav-shell.component.html',
  styleUrl: './capacity-v2-sidenav-shell.component.scss'
})
export class CapacityV2SidenavShellComponent implements OnInit {
  private static readonly NAV_COLLAPSED_STORAGE_KEY = 'capacity-v2-nav-collapsed';

  private readonly router = inject(Router);
  private readonly analysisState = inject(AnalysisStateService);
  private readonly fileManager = inject(FileManagerService);
  private readonly sessionService = inject(NetworkSessionService);
  readonly store = inject(CapacityV2Store);

  isBootstrapping = true;
  isSidenavCollapsed = signal(this.loadCollapsedPreference());

  readonly navItems: NavItem[] = [
    { label: 'Inputs', route: 'inputs', icon: 'input' },
    { label: 'Summary', route: 'summary', icon: 'summarize' },
    { label: 'Visualization', route: 'visualization', icon: 'hub', hideWhen: () => !this.store.hasAnyRunResults() },
    { label: 'Bottlenecks', route: 'bottlenecks', icon: 'warning', hideWhen: () => !this.store.hasAnyRunResults() },
    { label: 'Upgrade Priorities', route: 'upgrades', icon: 'trending_up', hideWhen: () => !this.store.hasAnyRunResults() },
    { label: 'Flow Distribution', route: 'flows', icon: 'water_drop', hideWhen: () => !this.store.hasAnyRunResults() },
    { label: 'Export', route: 'export', icon: 'download', hideWhen: () => !this.store.hasAnyRunResults() }
  ];

  readonly visibleNavItems = computed(() => {
    if (this.store.viewMode() !== 'single') {
      return [];
    }
    return this.navItems.filter(item => !item.hideWhen || !item.hideWhen());
  });

  readonly currentScenarioTitle = computed(() => {
    const option = this.store.selectedNetworkOption();
    return option ? option.label : 'Capacity Analysis';
  });

  readonly runActionLabel = computed(() =>
    this.store.runState() === 'success' ? 'Run Again' : 'Run Analysis'
  );
  readonly runAllLabel = computed(() =>
    this.store.completedCount() > 0 ? 'Re-run All Scenarios' : 'Run All Scenarios'
  );


  async ngOnInit(): Promise<void> {
    this.analysisState.loadParsedDataFromSession();

    if (!this.analysisState.networkData()) {
      this.analysisState.loadNetworkDataFromFileManager();
    }

    const hasExistingStoreState = this.store.networkOptions().length > 0;

    if (!hasExistingStoreState) {
      const networkData = this.analysisState.networkData();
      const parsedData = this.analysisState.parsedData();
      const capacityGroups = this.fileManager.analysisGroups().capacity;
      const sessionNetworkPath = this.sessionService.getCurrentSession()?.networkPath;
      const analysisNetworkPath = this.analysisState.currentNetworkPath();
      const preferredNetworkPath = sessionNetworkPath || analysisNetworkPath || undefined;

      this.store.initializeFromSession(networkData, parsedData, capacityGroups, preferredNetworkPath);
    }

    this.isBootstrapping = false;

    // Navigate to inputs by default if we're at the base capacity-analysis route
    const currentUrl = this.router.url;
    if (currentUrl === '/capacity-analysis' || currentUrl.endsWith('/capacity-analysis')) {
      this.router.navigate(['/capacity-analysis/summary']);
    }
  }

  toggleSidenav(): void {
    this.isSidenavCollapsed.update((collapsed) => {
      const next = !collapsed;
      localStorage.setItem(CapacityV2SidenavShellComponent.NAV_COLLAPSED_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  isActiveRoute(route: string): boolean {
    return this.router.url.includes(`/capacity-analysis/${route}`);
  }

  async runAnalysisFromHeader(): Promise<void> {
    await this.store.runAnalysis();

    if (this.store.runState() === 'success') {
      this.router.navigate(['/capacity-analysis/summary']);
    }
  }

  async runAllFromHeader(): Promise<void> {
    await this.store.runAllScenarios();
    this.router.navigate(['/capacity-analysis/summary']);
  }

  async runRemainingFromHeader(): Promise<void> {
    await this.store.runRemainingScenarios();
    this.router.navigate(['/capacity-analysis/summary']);
  }

  async onScenarioChange(event: MatSelectChange): Promise<void> {
    const scenarioName = event.value as string;
    if (!scenarioName) {
      return;
    }

    await this.store.selectScenarioByName(scenarioName);
  }

  onViewModeChange(mode: 'single' | 'all' | 'comparison'): void {
    this.store.setViewMode(mode);
    this.router.navigate(['/capacity-analysis/summary']);
  }

  private loadCollapsedPreference(): boolean {
    const raw = localStorage.getItem(CapacityV2SidenavShellComponent.NAV_COLLAPSED_STORAGE_KEY);
    if (!raw) {
      return false;
    }

    try {
      return Boolean(JSON.parse(raw));
    } catch {
      return false;
    }
  }

}
