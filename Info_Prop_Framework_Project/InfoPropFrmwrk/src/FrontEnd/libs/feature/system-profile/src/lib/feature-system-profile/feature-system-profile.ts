import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  CardComponent,
  EmptyStateComponent,
  IconComponent,
  PageHeaderComponent,
  StatTileComponent,
} from '@inf-prop/shared/ui';
import { IconName } from '@inf-prop/shared/ui';
import {
  NetworkContextService,
  ScenarioCacheService,
} from '@inf-prop/shared/data-access';
import { MetricsComparisonComponent } from '../components/metrics-comparison.component';
import { FlaggedSetsComponent } from '../components/flagged-sets.component';
import { NetworkLensComponent } from '../components/network-lens.component';
import {
  TOOLKIT_LABEL,
  TOOLKIT_ROUTE,
  distinctToolkits,
  totalComputationMs,
} from '../model/profile-view';

interface ToolkitPointer {
  label: string;
  route: string;
  icon: IconName;
  unlocked: boolean;
}

/**
 * Track 4 — the cross-scenario profile view (Front-End chapter, §The Interface).
 *
 * "Sets the scenarios of one network side by side, which is where the
 * comparative questions — what the interval inputs do to the answer, which
 * design carries the risk — get answered without exporting anything to a
 * spreadsheet." It reads `ScenarioCacheService.runs()` (written by the
 * Reliability, Flow and Schedule views) and juxtaposes them. Before there are
 * results to compare it shows a real empty-state that names the dependency and
 * points back to those views.
 *
 * "The interface is a window, not a second implementation": it computes no
 * score, ranking or recommendation. `buildCapacityRecommendation` and
 * `capacityOptimizations` from the old page do not exist here and must not be
 * reintroduced — cross-scenario ranking, if it is ever wanted, has to come from
 * a real Julia endpoint.
 */
@Component({
  selector: 'ipf-feature-system-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageHeaderComponent,
    EmptyStateComponent,
    CardComponent,
    StatTileComponent,
    IconComponent,
    MetricsComparisonComponent,
    FlaggedSetsComponent,
    NetworkLensComponent,
  ],
  template: `
    <ipf-page-header
      title="Cross-scenario profile"
      description="The scenarios of this network, set side by side — where comparative questions like what the interval inputs do to the answer, or which design carries the risk, get answered without exporting anything to a spreadsheet. A window onto the Reliability, Flow and Schedule results: it runs no analysis and adds no score or recommendation of its own."
    />

    @if (runs().length === 0) {
      <ipf-empty-state
        icon="system-profile"
        title="No results to compare yet"
        [message]="emptyMessage()"
      >
        <div slot="actions" class="pointers">
          @for (t of toolkitPointers(); track t.route) {
            @if (t.unlocked) {
              <a class="pointer" [routerLink]="t.route">
                <ipf-icon [name]="t.icon" [size]="16" />
                <span>{{ t.label }}</span>
              </a>
            } @else {
              <span
                class="pointer disabled"
                [title]="t.label + ' needs its input files on this network'"
              >
                <ipf-icon [name]="t.icon" [size]="16" />
                <span>{{ t.label }}</span>
              </span>
            }
          }
        </div>
      </ipf-empty-state>
    } @else {
      <div class="stats">
        <ipf-stat-tile label="Scenarios" icon="list">{{ runs().length }}</ipf-stat-tile>
        <ipf-stat-tile label="Toolkits covered" icon="target"
          >{{ toolkitsCovered().length }} / 3</ipf-stat-tile
        >
        <ipf-stat-tile label="Total compute" icon="run" [caption]="computeCaption()">{{
          computeValue()
        }}</ipf-stat-tile>
      </div>

      @if (otherNetworkCount() > 0) {
        <p class="scope-note">
          Showing the {{ runs().length }} scenario run(s) on
          <strong>{{ networkName() }}</strong>. {{ otherNetworkCount() }} run(s)
          on other networks are held separately — load that network to compare
          them.
        </p>
      }

      <section class="block">
        <h2>Scenarios side by side</h2>
        <ipf-sp-metrics-comparison [runs]="runs()" />
      </section>

      <section class="block">
        <h2>A result on the network</h2>
        <p class="lead">
          The layered drawing of this network — along the iteration sets, node
          roles distinguished — with one analysis's own result set on it. A view
          of results that already exist; nothing here is computed.
        </p>
        <ipf-card>
          <ipf-sp-flagged-sets
            [runs]="runs()"
            [selectedKey]="selectedOverlayKey()"
            (overlaySelect)="selectedOverlayKey.set($event)"
          />
        </ipf-card>
        <ipf-card class="lens-card">
          <ipf-sp-network-lens
            [runs]="runs()"
            [structure]="structure()"
            [structureLoading]="structureLoading()"
            [selectedKey]="selectedOverlayKey()"
            (reloadStructure)="reloadStructure()"
          />
        </ipf-card>
      </section>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        max-width: 1180px;
      }
      .pointers {
        display: flex;
        gap: var(--spacingHorizontalS, 8px);
        flex-wrap: wrap;
        justify-content: center;
      }
      .pointer {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border: 1px solid var(--colorNeutralStroke1);
        border-radius: var(--borderRadiusMedium, 4px);
        font-size: var(--fontSizeBase300, 14px);
        text-decoration: none;
        color: var(--colorBrandForegroundLink);
      }
      .pointer.disabled {
        color: var(--colorNeutralForegroundDisabled);
        border-style: dashed;
        border-color: var(--colorNeutralStroke2);
      }
      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: var(--spacingHorizontalM, 12px);
        margin-bottom: var(--spacingVerticalL, 16px);
      }
      .scope-note {
        margin: 0 0 var(--spacingVerticalL, 16px);
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground3);
      }
      .block {
        margin-top: var(--spacingVerticalXL, 20px);
      }
      .block h2 {
        margin: 0 0 var(--spacingVerticalS, 8px);
        font-size: var(--fontSizeBase500, 20px);
        font-weight: var(--fontWeightSemibold, 600);
        color: var(--colorNeutralForeground1);
      }
      .lead {
        margin: 0 0 var(--spacingVerticalM, 12px);
        font-size: var(--fontSizeBase300, 14px);
        color: var(--colorNeutralForeground2);
      }
      .lens-card {
        margin-top: var(--spacingVerticalM, 12px);
      }
    `,
  ],
})
export class FeatureSystemProfile implements OnInit {
  private readonly cache = inject(ScenarioCacheService);
  private readonly ctx = inject(NetworkContextService);

  protected readonly structure = this.ctx.structure;
  protected readonly structureLoading = this.ctx.structureLoading;

  protected readonly selectedOverlayKey = signal<string | null>(null);

  protected readonly activeNetworkPath = computed(
    () => this.ctx.context()?.networkPath ?? null,
  );

  protected readonly networkName = computed(
    () => this.ctx.context()?.networkName ?? 'this network',
  );

  protected readonly runs = computed(() => {
    const path = this.activeNetworkPath();
    return path ? this.cache.runsForNetwork(path) : [];
  });

  protected readonly otherNetworkCount = computed(
    () => this.cache.count() - this.runs().length,
  );

  protected readonly toolkitsCovered = computed(() =>
    distinctToolkits(this.runs()),
  );

  protected readonly computeValue = computed(() => {
    const ms = totalComputationMs(this.runs());
    return ms >= 1000 ? (ms / 1000).toFixed(2) : String(Math.round(ms));
  });

  protected readonly computeCaption = computed(() => {
    const ms = totalComputationMs(this.runs());
    return ms >= 1000 ? 'seconds, summed' : 'milliseconds, summed';
  });

  protected readonly emptyMessage = computed(() => {
    const others = this.cache.count();
    const base =
      'This is the comparison step of the pipeline — structure first, then analysis, then comparison. Run a scenario under Reliability, Flow or Schedule and its results appear here to set side by side. This view produces none of its own.';
    return others > 0
      ? `${base} You have ${others} scenario run(s) held on other networks; load one of those to compare them here.`
      : base;
  });

  protected readonly toolkitPointers = computed<ToolkitPointer[]>(() => {
    const unlocked = this.ctx.unlockedToolkits();
    return [
      {
        label: TOOLKIT_LABEL.reliability,
        route: TOOLKIT_ROUTE.reliability,
        icon: 'reliability',
        unlocked: unlocked.reliability,
      },
      {
        label: TOOLKIT_LABEL.flow,
        route: TOOLKIT_ROUTE.flow,
        icon: 'flow',
        unlocked: unlocked.flow,
      },
      {
        label: TOOLKIT_LABEL.schedule,
        route: TOOLKIT_ROUTE.schedule,
        icon: 'schedule',
        unlocked: unlocked.schedule,
      },
    ];
  });

  ngOnInit(): void {
    // The network drawing needs the graph structure; the side-by-side tables do
    // not. Only fetch it when there is a result to show on the network and it
    // is not already loaded.
    if (
      this.ctx.isLoaded() &&
      this.runs().length > 0 &&
      !this.ctx.structure() &&
      !this.ctx.structureLoading()
    ) {
      this.loadStructure();
    }
  }

  protected reloadStructure(): void {
    if (!this.ctx.structureLoading()) this.loadStructure();
  }

  private loadStructure(): void {
    try {
      this.ctx.loadStructure().subscribe({ error: () => undefined });
    } catch {
      /* no context — nothing to load */
    }
  }
}
