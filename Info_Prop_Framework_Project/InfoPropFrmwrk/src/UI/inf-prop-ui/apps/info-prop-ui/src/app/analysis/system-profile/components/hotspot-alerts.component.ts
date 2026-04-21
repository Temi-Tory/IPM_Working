import { Component, input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HotspotAlert } from '../../../shared/models/system-profile.models';

@Component({
  selector: 'app-hotspot-alerts',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatTooltipModule],
  template: `
    <mat-card class="alerts-card">
      <mat-card-content>
        <h4 class="section-title">
          <mat-icon>notifications_active</mat-icon>
          Hotspot Alerts
          @if (alerts().length > 0) {
            <span class="alert-count" [class.has-critical]="hasCritical()">
              {{ alerts().length }}
            </span>
          }
        </h4>

        @if (alerts().length === 0) {
          <div class="no-alerts">
            <mat-icon class="all-clear-icon">verified</mat-icon>
            <span>No hotspots detected — all metrics within normal ranges</span>
          </div>
        } @else {
          <div class="alerts-list">
            @for (alert of alerts(); track alert.id) {
              <div class="alert-item" [class]="alert.severity"
                   (click)="drilldown(alert)" (keydown.enter)="drilldown(alert)" tabindex="0"
                   [matTooltip]="'Click to view in ' + routeLabel(alert.drilldownRoute)">
                <mat-icon class="alert-icon">
                  {{ alert.severity === 'critical' ? 'error' : alert.severity === 'warning' ? 'warning' : 'info' }}
                </mat-icon>
                <div class="alert-content">
                  <span class="alert-scenario">{{ alert.scenario }}</span>
                  <span class="alert-message">{{ alert.message }}</span>
                </div>
                <mat-icon class="drilldown-arrow">chevron_right</mat-icon>
              </div>
            }
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .alerts-card {
      background: var(--surface-container);
      border: 1px solid var(--outline-variant);
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 16px;
      font-size: 1rem;
      font-weight: 500;
      color: var(--text-primary);

      mat-icon { font-size: 20px; width: 20px; height: 20px; color: var(--primary-color); }
    }

    .alert-count {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 22px;
      height: 22px;
      padding: 0 6px;
      border-radius: 11px;
      font-size: 0.75rem;
      font-weight: 600;
      background: rgba(181, 137, 0, 0.2);
      color: #b58900;

      &.has-critical {
        background: rgba(220, 50, 47, 0.2);
        color: #dc322f;
      }
    }

    .no-alerts {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      color: #859900;
      font-size: 0.875rem;
    }

    .all-clear-icon {
      color: #859900;
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .alerts-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .alert-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover { filter: brightness(1.1); }
      &:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }

      &.critical {
        background: rgba(220, 50, 47, 0.08);
        border-left: 3px solid #dc322f;

        .alert-icon { color: #dc322f; }
      }

      &.warning {
        background: rgba(181, 137, 0, 0.08);
        border-left: 3px solid #b58900;

        .alert-icon { color: #b58900; }
      }

      &.info {
        background: rgba(38, 139, 210, 0.08);
        border-left: 3px solid #268bd2;

        .alert-icon { color: #268bd2; }
      }
    }

    .alert-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    .alert-content {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
    }

    .alert-scenario {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .alert-message {
      font-size: 0.85rem;
      color: var(--text-primary);
    }

    .drilldown-arrow {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--text-secondary);
      flex-shrink: 0;
    }
  `]
})
export class HotspotAlertsComponent {
  alerts = input.required<HotspotAlert[]>();
  private router = inject(Router);

  hasCritical(): boolean {
    return this.alerts().some(a => a.severity === 'critical');
  }

  drilldown(alert: HotspotAlert): void {
    this.router.navigate([alert.drilldownRoute], { queryParams: alert.drilldownParams });
  }

  routeLabel(route: string): string {
    switch (route) {
      case '/capacity-analysis': return 'Capacity Analysis';
      case '/time-analysis': return 'Time Analysis';
      case '/probability-propagation': return 'Probability Propagation';
      case '/diamonds': return 'Diamond Analysis';
      case '/cost-analysis': return 'Cost Analysis';
      default: return 'detail view';
    }
  }
}
