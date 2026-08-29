import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '@inf-prop/shared/ui';
import { IconName } from '@inf-prop/shared/ui';
import { NetworkContextService } from '@inf-prop/shared/data-access';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  enabled: boolean;
  hint?: string;
}

/**
 * Left nav. Toolkit links are disabled (not hidden) until a network is loaded
 * and, for flow/schedule/reliability, until the inputs that toolkit needs are
 * present — the asymmetry stays visible.
 */
@Component({
  selector: 'ipf-nav-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  template: `
    <nav>
      <a class="brand" routerLink="/home" aria-label="Home">
        <ipf-icon name="diamond" [size]="22" />
      </a>
      <ul class="group">
        @for (item of primary(); track item.path) {
          <li>
            <a
              [routerLink]="item.path"
              routerLinkActive="active"
              [class.disabled]="!item.enabled"
              [attr.aria-disabled]="!item.enabled"
              [attr.tabindex]="item.enabled ? null : -1"
              [title]="item.enabled ? item.label : (item.hint ?? item.label)"
            >
              <ipf-icon [name]="item.icon" [size]="20" />
              <span>{{ item.label }}</span>
            </a>
          </li>
        }
      </ul>
      <div class="spacer"></div>
      <ul class="group">
        @for (item of toolkits(); track item.path) {
          <li>
            <a
              [routerLink]="item.enabled ? item.path : null"
              routerLinkActive="active"
              [class.disabled]="!item.enabled"
              [attr.aria-disabled]="!item.enabled"
              [attr.tabindex]="item.enabled ? null : -1"
              [title]="item.enabled ? item.label : (item.hint ?? item.label)"
            >
              <ipf-icon [name]="item.icon" [size]="20" />
              <span>{{ item.label }}</span>
            </a>
          </li>
        }
      </ul>
    </nav>
  `,
  styleUrl: './nav-rail.component.scss',
})
export class NavRailComponent {
  private readonly ctx = inject(NetworkContextService);

  protected readonly primary = computed<NavItem[]>(() => {
    const loaded = this.ctx.isLoaded();
    return [
      { path: '/home', label: 'Home', icon: 'home', enabled: true },
      { path: '/upload', label: 'Upload', icon: 'upload', enabled: true },
      {
        path: '/network',
        label: 'Network',
        icon: 'structure',
        enabled: loaded,
        hint: 'Upload a network first',
      },
    ];
  });

  protected readonly toolkits = computed<NavItem[]>(() => {
    const loaded = this.ctx.isLoaded();
    const u = this.ctx.unlockedToolkits();
    const hint = (has: boolean, need: string) =>
      !loaded ? 'Upload a network first' : has ? undefined : `Needs ${need}`;
    return [
      {
        path: '/reliability',
        label: 'Reliability',
        icon: 'reliability',
        enabled: loaded && u.reliability,
        hint: hint(u.reliability, 'node priors + link probabilities'),
      },
      {
        path: '/flow',
        label: 'Flow',
        icon: 'flow',
        enabled: loaded && u.flow,
        hint: hint(u.flow, 'a capacities file'),
      },
      {
        path: '/schedule',
        label: 'Schedule',
        icon: 'schedule',
        enabled: loaded && u.schedule,
        hint: hint(u.schedule, 'a CPM inputs file'),
      },
      {
        path: '/system-profile',
        label: 'Profile',
        icon: 'system-profile',
        enabled: loaded,
        hint: 'Upload a network first',
      },
    ];
  });
}
