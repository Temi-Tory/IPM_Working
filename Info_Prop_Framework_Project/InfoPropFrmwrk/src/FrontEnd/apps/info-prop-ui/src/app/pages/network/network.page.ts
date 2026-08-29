import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  computed,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  CardComponent,
  ErrorBannerComponent,
  IconComponent,
  LoadingStateComponent,
  PageHeaderComponent,
  StatTileComponent,
} from '@inf-prop/shared/ui';
import { IconName } from '@inf-prop/shared/ui';
import { NetworkContextService } from '@inf-prop/shared/data-access';
import { LayeredGraphComponent } from './layered-graph.component';

interface ToolkitLink {
  path: string;
  label: string;
  icon: IconName;
  enabled: boolean;
  reason: string;
}

@Component({
  selector: 'ipf-network-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    RouterLink,
    PageHeaderComponent,
    CardComponent,
    StatTileComponent,
    IconComponent,
    LoadingStateComponent,
    ErrorBannerComponent,
    LayeredGraphComponent,
  ],
  templateUrl: './network.page.html',
  styleUrl: './network.page.scss',
})
export class NetworkPage {
  private readonly ctx = inject(NetworkContextService);

  protected readonly context = this.ctx.context;
  protected readonly structure = this.ctx.structure;
  protected readonly loading = this.ctx.structureLoading;
  protected readonly scenarios = this.ctx.scenarios;

  protected readonly toolkits = computed<ToolkitLink[]>(() => {
    const u = this.ctx.unlockedToolkits();
    return [
      {
        path: '/reliability',
        label: 'Reliability',
        icon: 'reliability',
        enabled: u.reliability,
        reason: u.reliability
          ? 'Node priors and link probabilities found'
          : 'Add a nodepriors + linkprobabilities pair',
      },
      {
        path: '/flow',
        label: 'Flow',
        icon: 'flow',
        enabled: u.flow,
        reason: u.flow ? 'Capacities file found' : 'Add a capacities file',
      },
      {
        path: '/schedule',
        label: 'Schedule',
        icon: 'schedule',
        enabled: u.schedule,
        reason: u.schedule ? 'CPM inputs file found' : 'Add a CPM inputs file',
      },
    ];
  });

  protected retry(): void {
    this.ctx.loadStructure().subscribe({ error: () => void 0 });
  }
}
