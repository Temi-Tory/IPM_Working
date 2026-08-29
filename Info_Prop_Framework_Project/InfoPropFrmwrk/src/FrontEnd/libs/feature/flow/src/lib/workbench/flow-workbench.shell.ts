import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  ErrorBannerComponent,
  IconComponent,
  IconName,
  PageHeaderComponent,
} from '@inf-prop/shared/ui';
import { FlowWorkbenchStore } from '../data/flow-workbench.store';

interface FlowTab {
  path: string;
  label: string;
  icon: IconName;
  needsResult: boolean;
}

/**
 * The flow/capacity workbench: one page, sub-views for configure, summary,
 * bottlenecks, visualization and scenarios — the v3 workbench structure,
 * reskinned in Fluent, against the live `/flow-analysis` endpoint. Float64
 * capacities only.
 */
@Component({
  selector: 'ipf-flow-workbench',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    PageHeaderComponent,
    ErrorBannerComponent,
    IconComponent,
  ],
  template: `
    <ipf-page-header
      title="Flow"
      description="Maximum deliverable throughput from a source set to a sink set under the active edge (and, when modelled, node) capacity constraints — with minimum-cut diagnostics, structural fragility, flow sensitivity, failure impact and parametric thresholds. Float64 capacities only; multi-source / multi-sink and node capacities are handled internally."
    >
      <div slot="actions" class="run-controls">
        @if (store.selectedScenario(); as scenario) {
          <span class="scenario" [title]="scenario.capacitiesPath">
            <ipf-icon name="folder" [size]="14" />
            {{ scenario.name }}
          </span>
        }
        <button
          type="button"
          class="run"
          [disabled]="!store.canRun()"
          (click)="store.run()"
        >
          @if (store.isRunning()) {
            <fluent-spinner size="tiny"></fluent-spinner>
            <span>Running…</span>
          } @else {
            <ipf-icon name="run" [size]="16" />
            <span>Run analysis</span>
          }
        </button>
      </div>
    </ipf-page-header>

    @if (store.error(); as message) {
      <ipf-error-banner
        [message]="message"
        [retryable]="store.hasScenarios()"
        (retry)="store.run()"
        (dismiss)="store.clearError()"
      />
    }

    <nav class="tabs" aria-label="Flow analysis views">
      @for (tab of tabs; track tab.path) {
        <a
          [routerLink]="tab.path"
          routerLinkActive="active"
          [class.pending]="tab.needsResult && !store.hasResult()"
        >
          <ipf-icon [name]="tab.icon" [size]="16" />
          <span>{{ tab.label }}</span>
        </a>
      }
    </nav>

    <div class="view">
      <router-outlet />
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        max-width: 1180px;
      }
      .run-controls {
        display: flex;
        align-items: center;
        gap: var(--spacingHorizontalM, 12px);
      }
      .scenario {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground2);
      }
      .run {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        border: none;
        border-radius: var(--borderRadiusMedium, 4px);
        background: var(--colorBrandBackground);
        color: var(--colorNeutralForegroundOnBrand, #fff);
        font: inherit;
        font-size: var(--fontSizeBase300, 14px);
        font-weight: var(--fontWeightSemibold, 600);
        cursor: pointer;
      }
      .run:hover:not(:disabled) {
        background: var(--colorBrandBackgroundHover);
      }
      .run:disabled {
        background: var(--colorNeutralBackgroundDisabled);
        color: var(--colorNeutralForegroundDisabled);
        cursor: not-allowed;
      }
      .tabs {
        display: flex;
        gap: var(--spacingHorizontalXS, 4px);
        flex-wrap: wrap;
        border-bottom: 1px solid var(--colorNeutralStroke2);
        margin-bottom: var(--spacingVerticalL, 16px);
      }
      .tabs a {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
        text-decoration: none;
        font-size: var(--fontSizeBase300, 14px);
        color: var(--colorNeutralForeground2);
      }
      .tabs a:hover {
        color: var(--colorNeutralForeground1);
      }
      .tabs a.active {
        color: var(--colorBrandForeground1);
        border-bottom-color: var(--colorBrandStroke1);
        font-weight: var(--fontWeightSemibold, 600);
      }
      .tabs a.pending span {
        opacity: 0.55;
      }
      .view {
        min-height: 200px;
      }
    `,
  ],
})
export class FlowWorkbenchShell {
  protected readonly store = inject(FlowWorkbenchStore);

  protected readonly tabs: readonly FlowTab[] = [
    { path: 'config', label: 'Configure', icon: 'settings', needsResult: false },
    { path: 'summary', label: 'Summary', icon: 'target', needsResult: true },
    {
      path: 'bottlenecks',
      label: 'Bottlenecks',
      icon: 'warning',
      needsResult: true,
    },
    {
      path: 'visualization',
      label: 'Visualization',
      icon: 'visualization',
      needsResult: true,
    },
    { path: 'scenarios', label: 'Scenarios', icon: 'list', needsResult: false },
  ];
}
