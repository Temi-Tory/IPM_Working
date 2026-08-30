import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { IconComponent } from '../icon/icon.component';

export interface BulkValueItem {
  /** stable key emitted in the values map — a node id as a string, or an
   *  edge key such as `"u-v"` */
  key: string;
  /** what the row shows — `"7"` for a node, `"3 → 9"` for an edge */
  label: string;
}

const PAGE_SIZE = 50;

/**
 * A node-list or edge-list turned into an editable value table, for building
 * an analysis-input file by hand rather than uploading one. Three ways to
 * fill it in, matching how a real dataset actually gets authored:
 *
 *  - **uniform** — one value, applied to every item at once (a first pass
 *    a user can then hand-tune);
 *  - **apply to selected** — one value, applied only to the checked rows;
 *  - **per-row** — edit any single cell directly.
 *
 * Emits the current values on every change so the caller can gate its own
 * "complete" state; nothing here uploads or validates against the network —
 * it only turns a list plus numbers into a plain `Record<string, number>`.
 */
@Component({
  selector: 'ipf-bulk-value-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="toolbar">
      <label class="bulk-field">
        <span>Value</span>
        <input
          type="number"
          [attr.min]="min() ?? null"
          [attr.max]="max() ?? null"
          step="any"
          [value]="bulkValue()"
          (input)="onBulkInput($event)"
        />
      </label>
      <button
        type="button"
        class="btn"
        [disabled]="bulkValue() === null"
        (click)="applyToAll()"
      >
        Apply to all ({{ items().length }})
      </button>
      <button
        type="button"
        class="btn"
        [disabled]="bulkValue() === null || !checked().size"
        (click)="applyToSelected()"
      >
        Apply to selected ({{ checked().size }})
      </button>
      <span class="count">{{ filledCount() }} of {{ items().length }} set</span>
    </div>

    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th class="check">
              <input
                type="checkbox"
                [checked]="allChecked()"
                (change)="toggleAll()"
                aria-label="Select all rows"
              />
            </th>
            <th>{{ itemLabel() }}</th>
            <th class="v">Value</th>
          </tr>
        </thead>
        <tbody>
          @for (row of pageRows(); track row.key) {
            <tr>
              <td class="check">
                <input
                  type="checkbox"
                  [checked]="checked().has(row.key)"
                  (change)="toggleOne(row.key)"
                />
              </td>
              <td>{{ row.label }}</td>
              <td class="v">
                <input
                  type="number"
                  [attr.min]="min() ?? null"
                  [attr.max]="max() ?? null"
                  step="any"
                  [value]="valueOf(row.key)"
                  (input)="onRowInput(row.key, $event)"
                />
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="3" class="empty">Nothing to fill in.</td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (pageCount() > 1) {
      <div class="pager">
        <button
          type="button"
          (click)="goToPage(-1)"
          [disabled]="clampedPage() === 0"
          aria-label="Previous page"
        >
          <ipf-icon name="arrow-left" [size]="14" />
        </button>
        <span class="page-of">{{ clampedPage() + 1 }} / {{ pageCount() }}</span>
        <button
          type="button"
          (click)="goToPage(1)"
          [disabled]="clampedPage() >= pageCount() - 1"
          aria-label="Next page"
        >
          <ipf-icon name="arrow-right" [size]="14" />
        </button>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--spacingHorizontalM, 12px);
        margin-bottom: var(--spacingVerticalM, 12px);
      }
      .bulk-field {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground2);
      }
      .bulk-field input {
        width: 9ch;
      }
      input[type='number'] {
        font: inherit;
        font-size: var(--fontSizeBase300, 14px);
        padding: 5px 8px;
        border: 1px solid var(--colorNeutralStroke1);
        border-radius: var(--borderRadiusMedium, 4px);
        background: var(--colorNeutralBackground1);
        color: var(--colorNeutralForeground1);
      }
      .btn {
        font: inherit;
        font-size: var(--fontSizeBase200, 12px);
        padding: 6px 12px;
        border: 1px solid var(--colorNeutralStroke1);
        border-radius: var(--borderRadiusMedium, 4px);
        background: var(--colorNeutralBackground1);
        color: var(--colorNeutralForeground2);
        cursor: pointer;
      }
      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .count {
        margin-left: auto;
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground3);
        font-variant-numeric: tabular-nums;
      }
      .scroll {
        overflow-x: auto;
        border: 1px solid var(--colorNeutralStroke2);
        border-radius: var(--borderRadiusMedium, 4px);
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--fontSizeBase300, 14px);
      }
      th,
      td {
        padding: 6px 10px;
        text-align: left;
        border-bottom: 1px solid var(--colorNeutralStroke2);
      }
      th {
        font-size: var(--fontSizeBase200, 12px);
        font-weight: var(--fontWeightSemibold, 600);
        color: var(--colorNeutralForeground2);
        text-transform: uppercase;
        letter-spacing: 0.03em;
        position: sticky;
        top: 0;
        background: var(--colorNeutralBackground1);
      }
      th.check,
      td.check {
        width: 32px;
      }
      th.v,
      td.v {
        text-align: right;
      }
      td.v input {
        width: 10ch;
      }
      tbody tr:last-child td {
        border-bottom: none;
      }
      .empty {
        text-align: center;
        color: var(--colorNeutralForeground3);
        padding: var(--spacingVerticalL, 16px);
      }
      .pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-top: var(--spacingVerticalS, 8px);
        font-size: var(--fontSizeBase200, 12px);
      }
      .pager button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border: 1px solid var(--colorNeutralStroke1);
        border-radius: var(--borderRadiusMedium, 4px);
        background: var(--colorNeutralBackground1);
        color: var(--colorNeutralForeground2);
        cursor: pointer;
      }
      .pager button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .page-of {
        font-variant-numeric: tabular-nums;
        min-width: 4ch;
        text-align: center;
      }
    `,
  ],
})
export class BulkValueEditorComponent {
  readonly items = input.required<BulkValueItem[]>();
  /** "Node" / "Edge" — the item column header */
  readonly itemLabel = input('Item');
  readonly min = input<number | null>(null);
  readonly max = input<number | null>(null);
  /** seed every row with this value once, on first load (e.g. 0 for edge
   *  delays, where "no delay" is a sensible universal default) */
  readonly defaultValue = input<number | null>(null);

  /** current values, numeric entries only — fires on every edit */
  readonly changed = output<Record<string, number>>();

  protected readonly values = signal<Record<string, number>>({});
  protected readonly bulkValue = signal<number | null>(null);
  protected readonly checked = signal<Set<string>>(new Set());
  protected readonly page = signal(0);

  protected readonly filledCount = computed(
    () => Object.keys(this.values()).length,
  );

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.items().length / PAGE_SIZE)),
  );
  protected readonly clampedPage = computed(() =>
    Math.min(this.page(), this.pageCount() - 1),
  );
  protected readonly pageRows = computed(() => {
    const start = this.clampedPage() * PAGE_SIZE;
    return this.items().slice(start, start + PAGE_SIZE);
  });
  protected readonly allChecked = computed(
    () => this.items().length > 0 && this.checked().size === this.items().length,
  );

  constructor() {
    let seeded = false;
    effect(() => {
      const list = this.items();
      const def = this.defaultValue();
      if (!list.length || seeded || def === null) return;
      seeded = true;
      const seed: Record<string, number> = {};
      for (const item of list) seed[item.key] = def;
      this.values.set(seed);
      this.changed.emit(seed);
    });
  }

  /** the cell's current value, or `''` when unset — a plain index lookup
   *  reads as always-present to the compiler, which isn't true at runtime. */
  protected valueOf(key: string): number | '' {
    const map: Record<string, number | undefined> = this.values();
    return map[key] ?? '';
  }

  protected onBulkInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.bulkValue.set(raw === '' ? null : Number(raw));
  }

  protected onRowInput(key: string, event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.values.update((cur) => {
      const next = { ...cur };
      if (raw === '') delete next[key];
      else next[key] = Number(raw);
      return next;
    });
    this.changed.emit(this.values());
  }

  protected applyToAll(): void {
    const v = this.bulkValue();
    if (v === null) return;
    const next: Record<string, number> = {};
    for (const item of this.items()) next[item.key] = v;
    this.values.set(next);
    this.changed.emit(next);
  }

  protected applyToSelected(): void {
    const v = this.bulkValue();
    const targets = this.checked();
    if (v === null || !targets.size) return;
    this.values.update((cur) => {
      const next = { ...cur };
      for (const key of targets) next[key] = v;
      return next;
    });
    this.changed.emit(this.values());
  }

  protected toggleOne(key: string): void {
    this.checked.update((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  protected toggleAll(): void {
    this.checked.set(
      this.allChecked() ? new Set() : new Set(this.items().map((i) => i.key)),
    );
  }

  protected goToPage(delta: number): void {
    this.page.set(
      Math.min(Math.max(this.clampedPage() + delta, 0), this.pageCount() - 1),
    );
  }
}
