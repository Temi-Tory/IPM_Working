import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent, ThemeService } from '@inf-prop/shared/ui';
import { NetworkContextService } from '@inf-prop/shared/data-access';

/** Top bar: product name, the loaded network, and the light/dark toggle. */
@Component({
  selector: 'ipf-top-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="left">
      <span class="product">Information Propagation Framework</span>
      @if (ctx.context(); as c) {
        <a class="net" routerLink="/network" title="Go to network overview">
          <ipf-icon name="folder" [size]="14" />
          <span>{{ c.networkName }}</span>
        </a>
      }
    </div>
    <div class="right">
      <span class="local" title="Client and server run on this machine. No traffic leaves it.">
        <ipf-icon name="circle" [size]="8" />
        local
      </span>
      <button
        type="button"
        class="icon-btn"
        (click)="theme.toggle()"
        [attr.aria-label]="
          theme.resolved() === 'dark'
            ? 'Switch to light theme'
            : 'Switch to dark theme'
        "
      >
        <ipf-icon [name]="theme.resolved() === 'dark' ? 'sun' : 'moon'" [size]="18" />
      </button>
    </div>
  `,
  styleUrl: './top-bar.component.scss',
})
export class TopBarComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly ctx = inject(NetworkContextService);
}
