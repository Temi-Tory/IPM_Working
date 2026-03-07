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
    MatChipsModule
  ],
  templateUrl: './capacity-v2-sidenav-shell.component.html',
  styleUrl: './capacity-v2-sidenav-shell.component.scss'
})
export class CapacityV2SidenavShellComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly analysisState = inject(AnalysisStateService);
  private readonly fileManager = inject(FileManagerService);
  private readonly sessionService = inject(NetworkSessionService);
  readonly store = inject(CapacityV2Store);

  isBootstrapping = true;
  sidenavOpened = signal(true);

  readonly navItems: NavItem[] = [
    { label: 'Inputs', route: 'inputs', icon: 'input' },
    { label: 'Summary', route: 'summary', icon: 'summarize' },
    { label: 'Visualization', route: 'visualization', icon: 'hub', hideWhen: () => !this.store.result() },
    { label: 'Bottlenecks', route: 'bottlenecks', icon: 'warning', hideWhen: () => !this.store.result() },
    { label: 'Upgrade Priorities', route: 'upgrades', icon: 'trending_up', hideWhen: () => !this.store.result() },
    { label: 'Critical Paths', route: 'paths', icon: 'route', hideWhen: () => !this.store.result() },
    { label: 'Flow Distribution', route: 'flows', icon: 'water_drop', hideWhen: () => !this.store.result() },
    { label: 'Export', route: 'export', icon: 'download', hideWhen: () => !this.store.result() }
  ];

  readonly visibleNavItems = computed(() => {
    return this.navItems.filter(item => !item.hideWhen || !item.hideWhen());
  });

  readonly currentScenarioTitle = computed(() => {
    const option = this.store.selectedNetworkOption();
    return option ? option.label : 'Capacity Analysis';
  });


  async ngOnInit(): Promise<void> {
    this.analysisState.loadParsedDataFromSession();

    if (!this.analysisState.networkData()) {
      this.analysisState.loadNetworkDataFromFileManager();
    }

    const networkData = this.analysisState.networkData();
    const parsedData = this.analysisState.parsedData();
    const capacityGroups = this.fileManager.analysisGroups().capacity;
    const sessionNetworkPath = this.sessionService.getCurrentSession()?.networkPath;
    const analysisNetworkPath = this.analysisState.currentNetworkPath();
    const preferredNetworkPath = sessionNetworkPath || analysisNetworkPath || undefined;

    this.store.initializeFromSession(networkData, parsedData, capacityGroups, preferredNetworkPath);

    this.isBootstrapping = false;

    // Navigate to inputs by default if we're at the base capacity-analysis route
    const currentUrl = this.router.url;
    if (currentUrl === '/capacity-analysis' || currentUrl.endsWith('/capacity-analysis')) {
      this.router.navigate(['/capacity-analysis/inputs']);
    }
  }

  toggleSidenav(): void {
    this.sidenavOpened.update(open => !open);
  }

  isActiveRoute(route: string): boolean {
    return this.router.url.includes(`/capacity-analysis/${route}`);
  }

}
