import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { NetworkStructure } from '@inf-prop/shared/api-client';
import {
  IconComponent,
  LoadingStateComponent,
  ValueDisplayComponent,
} from '@inf-prop/shared/ui';
import { ScenarioRun } from '@inf-prop/shared/data-access';
import { LensGraphComponent } from './lens-graph.component';
import { OverlayRef, TOOLKIT_LABEL, collectOverlays } from '../model/profile-view';

/**
 * Renders the network — the same unified graph object, laid out along the
 * iteration sets — with one analysis's own result set on it: the nodes / edges
 * that analysis identified (bottlenecks, critical-path nodes, diamond
 * conditioning nodes, ...). A view of results that already exist; it derives
 * nothing of its own.
 *
 * An optional second, "compare with" result set can be drawn alongside the
 * first, in its own colour, with the overlap between the two called out both
 * on the drawing (a third colour) and as a count — the comparative question
 * the Front-End chapter names ("which design carries the risk") is usually
 * "where do two of these agree", not just "what did one analysis find".
 */
@Component({
  selector: 'ipf-sp-network-lens',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconComponent,
    LoadingStateComponent,
    ValueDisplayComponent,
    LensGraphComponent,
  ],
  template: `
    @if (structureLoading()) {
      <ipf-loading-state label="Loading the network structure…" />
    } @else if (!structure()) {
      <div class="need-structure">
        <p>
          The drawing is built from the structure input processing derived. It
          loads with the Network view.
        </p>
        <button type="button" class="btn" (click)="reloadStructure.emit()">
          <ipf-icon name="refresh" [size]="15" />
          Load the network structure
        </button>
      </div>
    } @else if (overlayRefs().length === 0) {
      <p class="muted">
        These scenarios produced no result sets, so there is nothing to show on
        the network yet.
      </p>
    } @else if (!current()) {
      <p class="muted">Choose a result set above to see it on the network.</p>
    } @else {
      @let ref = current()!;
      <div class="caption">
        <span class="label">{{ ref.overlay.label }}</span>
        <span class="src"
          >from the {{ ref.run.scenarioName }} scenario · {{ toolkitLabel(ref) }} ·
          {{ ref.run.valueType }}</span
        >
      </div>

      @if (compareOptions().length > 0) {
        <div class="compare-row">
          <label for="sp-compare-with">Compare with</label>
          <select
            id="sp-compare-with"
            [value]="compareKey() ?? ''"
            (change)="onCompareChange($event)"
          >
            <option value="">— none —</option>
            @for (opt of compareOptions(); track opt.key) {
              <option [value]="opt.key">
                {{ opt.overlay.label }} ({{ opt.run.scenarioName }} ·
                {{ toolkitLabel(opt) }})
              </option>
            }
          </select>
          @if (overlap(); as ov) {
            <span class="overlap-counts">
              <i class="swatch hl-both"></i> {{ ov.both }} in both ·
              <i class="swatch hl"></i> {{ ov.onlyPrimary }} only in
              {{ ref.overlay.label }} ·
              <i class="swatch hl2"></i> {{ ov.onlyCompare }} only in
              {{ compareRef()!.overlay.label }}
            </span>
          }
        </div>
      }

      <ipf-sp-lens-graph
        [structure]="structure()!"
        [highlightNodes]="ref.overlay.nodeIds ?? []"
        [highlightEdges]="ref.overlay.edges ?? []"
        [compareNodes]="compareRef()?.overlay?.nodeIds ?? []"
        [compareEdges]="compareRef()?.overlay?.edges ?? []"
        [selectedNode]="selectedNode()"
        (nodeSelect)="onNode($event)"
      />

      @if (selectedNode() !== null) {
        <div class="detail">
          <div class="detail-head">
            <span>Node <strong>{{ selectedNode() }}</strong></span>
            <button
              type="button"
              class="btn ghost"
              (click)="selectedNode.set(null)"
            >
              Clear
            </button>
          </div>
          <dl>
            <div>
              <dt>In {{ ref.overlay.label }}</dt>
              <dd>{{ nodeInSet() ? 'yes' : 'no' }}</dd>
            </div>
            @if (nodeValue(); as v) {
              <div>
                <dt>{{ ref.overlay.label }} value</dt>
                <dd><ipf-value [value]="v" [compact]="false" /></dd>
              </div>
            }
            @if (compareRef(); as cmp) {
              <div>
                <dt>In {{ cmp.overlay.label }}</dt>
                <dd>{{ nodeInCompareSet() ? 'yes' : 'no' }}</dd>
              </div>
              @if (compareNodeValue(); as v) {
                <div>
                  <dt>{{ cmp.overlay.label }} value</dt>
                  <dd><ipf-value [value]="v" [compact]="false" /></dd>
                </div>
              }
            }
          </dl>
          @if (!nodeValue()) {
            <p class="muted">
              This result set carries no per-node value; it lists membership
              only.
            </p>
          }
        </div>
      }

      <ul class="legend">
        <li><i class="swatch hl"></i> in {{ ref.overlay.label }}</li>
        @if (compareRef(); as cmp) {
          <li><i class="swatch hl2"></i> in {{ cmp.overlay.label }}</li>
          <li><i class="swatch hl-both"></i> in both</li>
        }
        <li><i class="swatch src"></i> source</li>
        <li><i class="swatch sink"></i> sink</li>
        <li><i class="swatch fork"></i> fork</li>
        <li><i class="swatch join"></i> join</li>
      </ul>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .muted {
        color: var(--colorNeutralForeground3);
        font-size: var(--fontSizeBase300, 14px);
        margin: 0;
      }
      .need-structure {
        display: flex;
        flex-direction: column;
        gap: var(--spacingVerticalM, 12px);
        align-items: flex-start;
      }
      .need-structure p {
        margin: 0;
        color: var(--colorNeutralForeground2);
        font-size: var(--fontSizeBase300, 14px);
      }
      .btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border: 1px solid var(--colorNeutralStroke1);
        border-radius: var(--borderRadiusMedium, 4px);
        background: var(--colorNeutralBackground1);
        color: var(--colorNeutralForeground1);
        font: inherit;
        font-size: var(--fontSizeBase300, 14px);
        cursor: pointer;
      }
      .btn.ghost {
        border-color: transparent;
        color: var(--colorNeutralForeground2);
      }
      .caption {
        display: flex;
        align-items: baseline;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: var(--spacingVerticalS, 8px);
      }
      .caption .label {
        font-weight: var(--fontWeightSemibold, 600);
        color: var(--colorNeutralForeground1);
      }
      .caption .src {
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground3);
      }
      .compare-row {
        display: flex;
        align-items: center;
        gap: var(--spacingHorizontalM, 12px);
        flex-wrap: wrap;
        margin-bottom: var(--spacingVerticalM, 12px);
        padding: 8px 10px;
        border: 1px dashed var(--colorNeutralStroke2);
        border-radius: var(--borderRadiusMedium, 4px);
      }
      .compare-row label {
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground2);
      }
      .compare-row select {
        font: inherit;
        font-size: var(--fontSizeBase200, 12px);
        padding: 4px 6px;
        border: 1px solid var(--colorNeutralStroke1);
        border-radius: var(--borderRadiusMedium, 4px);
        background: var(--colorNeutralBackground1);
        color: var(--colorNeutralForeground1);
        max-width: 260px;
      }
      .overlap-counts {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground2);
      }
      .detail {
        margin-top: var(--spacingVerticalM, 12px);
        padding: var(--spacingVerticalM, 12px) var(--spacingHorizontalM, 12px);
        border: 1px solid var(--colorNeutralStroke2);
        border-radius: var(--borderRadiusMedium, 4px);
        background: var(--colorNeutralBackground2);
      }
      .detail-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--spacingVerticalS, 8px);
      }
      dl {
        margin: 0;
        display: grid;
        gap: 4px;
      }
      dl > div {
        display: flex;
        gap: 10px;
      }
      dt {
        color: var(--colorNeutralForeground3);
        font-size: var(--fontSizeBase200, 12px);
        min-width: 120px;
      }
      dd {
        margin: 0;
        color: var(--colorNeutralForeground1);
        font-size: var(--fontSizeBase300, 14px);
      }
      .legend {
        list-style: none;
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        margin: var(--spacingVerticalM, 12px) 0 0;
        padding: 0;
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground3);
      }
      .legend li {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }
      .swatch {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        display: inline-block;
        background: var(--colorNeutralForeground3);
      }
      .swatch.hl {
        background: var(--colorBrandBackground, #0f6cbd);
      }
      .swatch.hl2 {
        background: var(--colorPaletteTealForeground2, #00695c);
      }
      .swatch.hl-both {
        background: var(--colorPaletteRedForeground1, #b10e1c);
      }
      .swatch.src {
        background: var(--colorPaletteGreenForeground1, #0e700e);
      }
      .swatch.sink {
        background: var(--colorPaletteBlueForeground2, #0f6cbd);
      }
      .swatch.fork {
        background: var(--colorPaletteDarkOrangeForeground1, #bc4b09);
      }
      .swatch.join {
        background: var(--colorPalettePurpleForeground2, #6b3fa0);
      }
    `,
  ],
})
export class NetworkLensComponent {
  readonly runs = input.required<ScenarioRun[]>();
  readonly structure = input<NetworkStructure | null>(null);
  readonly structureLoading = input(false);
  readonly selectedKey = input<string | null>(null);

  readonly reloadStructure = output<void>();

  protected readonly selectedNode = signal<number | null>(null);
  protected readonly compareKey = signal<string | null>(null);

  protected readonly overlayRefs = computed<OverlayRef[]>(() =>
    collectOverlays(this.runs()),
  );

  protected readonly current = computed<OverlayRef | null>(() => {
    const key = this.selectedKey();
    const refs = this.overlayRefs();
    if (refs.length === 0) return null;
    return refs.find((r) => r.key === key) ?? null;
  });

  /** every other result set — what "compare with" can be set to. */
  protected readonly compareOptions = computed<OverlayRef[]>(() => {
    const primary = this.selectedKey();
    return this.overlayRefs().filter((r) => r.key !== primary);
  });

  protected readonly compareRef = computed<OverlayRef | null>(() => {
    const key = this.compareKey();
    if (!key) return null;
    return this.overlayRefs().find((r) => r.key === key) ?? null;
  });

  protected readonly nodeInSet = computed<boolean>(() => {
    const node = this.selectedNode();
    const ref = this.current();
    if (node === null || !ref) return false;
    return (ref.overlay.nodeIds ?? []).includes(node);
  });

  protected readonly nodeValue = computed(() => {
    const node = this.selectedNode();
    const ref = this.current();
    if (node === null || !ref?.overlay.nodeValues) return null;
    return ref.overlay.nodeValues[String(node)] ?? null;
  });

  protected readonly nodeInCompareSet = computed<boolean>(() => {
    const node = this.selectedNode();
    const ref = this.compareRef();
    if (node === null || !ref) return false;
    return (ref.overlay.nodeIds ?? []).includes(node);
  });

  protected readonly compareNodeValue = computed(() => {
    const node = this.selectedNode();
    const ref = this.compareRef();
    if (node === null || !ref?.overlay.nodeValues) return null;
    return ref.overlay.nodeValues[String(node)] ?? null;
  });

  /** how much the primary and compared result sets agree, by node. */
  protected readonly overlap = computed(() => {
    const primary = this.current();
    const cmp = this.compareRef();
    if (!primary || !cmp) return null;
    const a = new Set(primary.overlay.nodeIds ?? []);
    const b = new Set(cmp.overlay.nodeIds ?? []);
    let both = 0;
    for (const n of a) if (b.has(n)) both++;
    return { both, onlyPrimary: a.size - both, onlyCompare: b.size - both };
  });

  constructor() {
    // Comparing a result set against itself is meaningless — if the primary
    // selection moves onto whatever "compare with" was set to, drop it rather
    // than silently rendering an empty comparison.
    effect(() => {
      if (this.compareKey() !== null && this.compareKey() === this.selectedKey()) {
        this.compareKey.set(null);
      }
    });
  }

  protected toolkitLabel(ref: OverlayRef): string {
    return TOOLKIT_LABEL[ref.run.toolkit];
  }

  protected onNode(id: number): void {
    this.selectedNode.update((cur) => (cur === id ? null : id));
  }

  protected onCompareChange(ev: Event): void {
    const value = (ev.target as HTMLSelectElement).value;
    this.compareKey.set(value || null);
  }
}
