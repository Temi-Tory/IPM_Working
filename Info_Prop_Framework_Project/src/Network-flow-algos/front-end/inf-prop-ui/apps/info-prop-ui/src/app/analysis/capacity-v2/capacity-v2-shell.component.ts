import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { FileManagerService } from '../../shared/services/file-manager.service';
import { NetworkSessionService } from '../../shared/services/network-session.service';
import { CapacityV2Store } from './capacity-v2.store';
import { CapacityV2InputComponent } from './capacity-v2-input.component';
import { CapacityV2SummaryComponent } from './capacity-v2-summary.component';
import { CapacityV2TabsComponent } from './capacity-v2-tabs.component';
import { CapacityV2VizComponent } from './capacity-v2-viz.component';
import { CapacityV2ExportComponent } from './capacity-v2-export.component';

@Component({
  selector: 'app-capacity-v2-shell',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    CapacityV2InputComponent,
    CapacityV2SummaryComponent,
    CapacityV2TabsComponent,
    CapacityV2VizComponent,
    CapacityV2ExportComponent
  ],
  templateUrl: './capacity-v2-shell.component.html',
  styleUrl: './capacity-v2-shell.component.scss'
})
export class CapacityV2ShellComponent implements OnInit {
  private readonly analysisState = inject(AnalysisStateService);
  private readonly fileManager = inject(FileManagerService);
  private readonly sessionService = inject(NetworkSessionService);
  readonly store = inject(CapacityV2Store);

  isBootstrapping = true;

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

    console.log('🏗️ CAPACITY V2 SHELL INITIALIZATION:');
    console.log('  Session networkPath:', sessionNetworkPath);
    console.log('  Analysis networkPath:', analysisNetworkPath);
    console.log('  Preferred networkPath:', preferredNetworkPath);
    console.log('  Capacity groups count:', capacityGroups.length);
    if (capacityGroups.length > 0) {
      console.log('  First group networkPath:', capacityGroups[0]?.networkPath);
      console.log('  First group scenarioName:', capacityGroups[0]?.scenarioName);
    }

    this.store.initializeFromSession(networkData, parsedData, capacityGroups, preferredNetworkPath);

    this.isBootstrapping = false;
  }
}
