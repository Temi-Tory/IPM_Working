import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  CardComponent,
  EmptyStateComponent,
  IconComponent,
  ScenarioComparisonTableComponent,
} from '@inf-prop/shared/ui';
import { FlowWorkbenchStore } from '../data/flow-workbench.store';

/**
 * Compare sub-view: every capacities scenario on this network, checked
 * scenarios run selected (chained), and the checked-and-run scenarios laid
 * side by side in the shared comparison table — the same pattern as
 * Reliability's Compare tab. No best/worst highlighting: the framework's own
 * rule (see `ScenarioCacheService`) is that this cache holds labelled real
 * outputs, never an invented ranking — the reader draws the conclusion.
 */
@Component({
  selector: 'ipf-flow-scenarios-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    CardComponent,
    EmptyStateComponent,
    IconComponent,
    ScenarioComparisonTableComponent,
  ],
  template: `
    @if (store.scenarios().length === 0) {
      <ipf-empty-state
        icon="list"
        title="No capacities scenarios on this network"
        message="The flow toolkit needs a *-capacities.json input. Add one and re-upload."
      >
        <a slot="actions" routerLink="/upload">Go to upload</a>
      </ipf-empty-state>
    } @else {
      <ipf-card>
        <div class="toolbar">
          <div class="checks" role="group" aria-label="Scenarios to compare">
            @for (s of store.scenarios(); track s.id) {
              <label class="check">
                <input
                  type="checkbox"
                  [checked]="isChecked(s.id)"
                  (change)="toggle(s.id)"
                />
                {{ s.name }}
                @if (!store.hasRun(s.name)) {
                  <span class="unran">not run</span>
                }
              </label>
            }
          </div>
          <div class="actions">
            <button type="button" class="link" (click)="selectAll()">All</button>
            <button type="button" class="link" (click)="selectNone()">None</button>
            <button
              type="button"
              class="btn"
              [disabled]="store.runningSelected() || !pending().length"
              (click)="runSelected()"
            >
              <ipf-icon name="run" [size]="16" />
              @if (store.runSelectedProgress(); as p) {
                Running {{ p.done + 1 }} of {{ p.total }}…
              } @else {
                Run selected ({{ pending().length }})
              }
            </button>
          </div>
        </div>
        <p class="muted">
          Every run of this network's capacities scenarios this session. These
          same runs feed the cross-toolkit System Profile.
        </p>
      </ipf-card>

      <ipf-scenario-comparison-table
        [runs]="comparedRuns()"
        emptyMessage="Check at least one scenario with a completed run, or run selected above."
      />
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .toolbar {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--spacingHorizontalXL, 20px);
        flex-wrap: wrap;
        margin-bottom: var(--spacingVerticalS, 8px);
      }
      .checks {
        display: flex;
        flex-wrap: wrap;
        gap: 10px 16px;
        max-width: 60ch;
      }
      .check {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: var(--fontSizeBase300, 14px);
        color: var(--colorNeutralForeground1);
        cursor: pointer;
      }
      .check input {
        cursor: pointer;
      }
      .unran {
        font-size: var(--fontSizeBase100, 10px);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 1px 6px;
        border-radius: var(--borderRadiusSmall, 3px);
        background: var(--colorNeutralBackground3);
        color: var(--colorNeutralForeground3);
      }
      .actions {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        flex: none;
      }
      .link {
        font: inherit;
        font-size: var(--fontSizeBase200, 12px);
        padding: 2px;
        border: none;
        background: none;
        color: var(--colorBrandForeground1);
        cursor: pointer;
        text-decoration: underline;
      }
      .btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font: inherit;
        font-size: var(--fontSizeBase300, 14px);
        padding: 8px 16px;
        border-radius: var(--borderRadiusMedium, 4px);
        border: 1px solid var(--colorNeutralStroke1);
        background: var(--colorNeutralBackground1);
        color: var(--colorNeutralForeground1);
        cursor: pointer;
        flex: none;
      }
      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .muted {
        margin: 0;
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground3);
      }
      ipf-scenario-comparison-table {
        display: block;
      }
    `,
  ],
})
export class FlowScenariosPage {
  protected readonly store = inject(FlowWorkbenchStore);

  /** independent of the Configure page's single selected scenario — this is
   *  "which scenarios do I want juxtaposed here", not "which one runs next
   *  from Configure". Defaults to every scenario once, on first load. */
  private readonly compareSelection = signal<Set<string>>(new Set());
  private rehydrated = false;

  protected readonly comparedRuns = computed(() => {
    const ids = this.compareSelection();
    return this.store.recordedRuns().filter((r) => {
      const scenario = this.store.scenarios().find((s) => s.name === r.scenarioName);
      return scenario ? ids.has(scenario.id) : false;
    });
  });

  protected readonly pending = computed(() => {
    const ids = this.compareSelection();
    return this.store
      .scenarios()
      .filter((s) => ids.has(s.id) && !this.store.hasRun(s.name));
  });

  constructor() {
    effect(() => {
      const list = this.store.scenarios();
      if (!list.length || this.rehydrated) return;
      untracked(() => {
        this.rehydrated = true;
        this.compareSelection.set(new Set(list.map((s) => s.id)));
      });
    });
  }

  protected isChecked(id: string): boolean {
    return this.compareSelection().has(id);
  }

  protected toggle(id: string): void {
    this.compareSelection.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected selectAll(): void {
    this.compareSelection.set(new Set(this.store.scenarios().map((s) => s.id)));
  }

  protected selectNone(): void {
    this.compareSelection.set(new Set());
  }

  protected runSelected(): void {
    this.store.runSelected([...this.compareSelection()]);
  }
}
