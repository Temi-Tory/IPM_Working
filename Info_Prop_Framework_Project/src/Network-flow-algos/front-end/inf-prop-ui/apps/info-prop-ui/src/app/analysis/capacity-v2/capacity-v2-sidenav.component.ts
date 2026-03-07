import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule, MatButtonToggleChange } from '@angular/material/button-toggle';
import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { FileManagerService } from '../../shared/services/file-manager.service';
import { NetworkSessionService } from '../../shared/services/network-session.service';
import { CapacityV2Store } from './capacity-v2.store';
import { CapacityV2DeterministicEntity } from './capacity-v2.models';
import { CapacityV2ExportComponent } from './capacity-v2-export.component';
import { CapacityV2OverviewComponent } from './capacity-v2-overview.component';
import { CapacityV2InputComponent } from './capacity-v2-input.component';
import { CapacityV2VizComponent } from './capacity-v2-viz.component';

type ViewId = 'overview' | 'inputs' | 'visualization' | 'bottlenecks' | 'upgrades' | 
              'critical-paths' | 'components' | 'uncertainty' | 'validation' | 'performance' | 'export';

interface NavItem {
  id: ViewId;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-capacity-v2-sidenav',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
    CapacityV2OverviewComponent,
    CapacityV2InputComponent,
    CapacityV2VizComponent,
    CapacityV2ExportComponent
  ],
  templateUrl: './capacity-v2-sidenav.component.html',
  styleUrl: './capacity-v2-sidenav.component.scss'
})
export class CapacityV2SidenavComponent implements OnInit {
  private readonly analysisState = inject(AnalysisStateService);
  private readonly fileManager = inject(FileManagerService);
  private readonly sessionService = inject(NetworkSessionService);
  readonly store = inject(CapacityV2Store);

  isBootstrapping = true;
  sidenavCollapsed = false;
  activeView = signal<ViewId>('overview');

  readonly navItems: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'inputs', label: 'Inputs', icon: 'input' },
    { id: 'visualization', label: 'Visualization', icon: 'account_tree' },
    { id: 'bottlenecks', label: 'Bottlenecks', icon: 'report_problem' },
    { id: 'upgrades', label: 'Upgrade Priorities', icon: 'trending_up' },
    { id: 'critical-paths', label: 'Critical Paths', icon: 'route' },
    { id: 'components', label: 'Component Details', icon: 'view_list' },
    { id: 'uncertainty', label: 'Uncertainty Analysis', icon: 'analytics' },
    { id: 'validation', label: 'Validation', icon: 'fact_check' },
    { id: 'performance', label: 'Performance', icon: 'speed' },
    { id: 'export', label: 'Export', icon: 'download' }
  ];

  readonly currentNetworkName = computed(() => {
    const networkPath = this.sessionService.getCurrentSession()?.networkPath || 
                        this.analysisState.currentNetworkPath() || 
                        'Unknown Network';
    const parts = networkPath.split('/');
    return parts[parts.length - 1] || networkPath;
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

    // Default to inputs view if no results, overview if results exist
    if (this.store.result()) {
      this.activeView.set('overview');
    } else {
      this.activeView.set('inputs');
    }

    this.isBootstrapping = false;
  }

  navigateToView(viewId: ViewId): void {
    this.activeView.set(viewId);
  }

  toggleSidenav(): void {
    this.sidenavCollapsed = !this.sidenavCollapsed;
  }

  onDetailSourceChange(event: MatButtonToggleChange): void {
    const source = event.value as 'worst' | 'best';
    this.store.setDetailSource(source);
  }

  bottleneckCount(detail: CapacityV2DeterministicEntity): number {
    return (detail.bottlenecks.saturatedEdges.length || 0) + 
           (detail.bottlenecks.saturatedNodes.length || 0);
  }

  rerunAnalysis(): void {
    // Navigate to inputs and trigger re-run
    this.activeView.set('inputs');
    // The input component will handle the actual re-run
  }
}
