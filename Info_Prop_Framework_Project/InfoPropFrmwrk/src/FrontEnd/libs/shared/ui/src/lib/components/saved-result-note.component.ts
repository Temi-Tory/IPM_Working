import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

/**
 * Shown beside an analysis result that the server read back from a saved
 * result instead of computing for this request. "Run fresh" asks the page to
 * re-run with `forceRecompute`, which also replaces the saved result.
 * Renders nothing for a freshly computed result.
 */
@Component({
  selector: 'ipf-saved-result-note',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, IconComponent],
  template: `
    @if (info()?.hit) {
      <p class="note">
        <ipf-icon name="info" [size]="14" />
        <span>Saved result from {{ info()!.computed_at | date: 'd MMM y, HH:mm' }}.</span>
        <button type="button" class="link" [disabled]="busy()" (click)="refresh.emit()">
          <ipf-icon name="refresh" [size]="14" />
          <span>Run fresh</span>
        </button>
      </p>
    }
  `,
  styles: `
    .note {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      margin: var(--spacingVerticalS, 8px) 0 0;
      font-size: var(--fontSizeBase200, 12px);
      color: var(--colorNeutralForeground3);
    }
    .link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border: none;
      background: none;
      padding: 0;
      font: inherit;
      color: var(--colorBrandForeground1, var(--colorNeutralForeground2));
      cursor: pointer;
    }
    .link:hover:not([disabled]) {
      text-decoration: underline;
    }
    .link[disabled] {
      opacity: 0.5;
      cursor: default;
    }
  `,
})
export class SavedResultNoteComponent {
  /** The response's `result_cache` block (shape mirrors `ResultCacheInfo` in shared/api-client). */
  readonly info = input<{ hit: boolean; computed_at: string } | null | undefined>(null);
  /** Disable "Run fresh" while a run is in flight. */
  readonly busy = input(false);
  readonly refresh = output<void>();
}
