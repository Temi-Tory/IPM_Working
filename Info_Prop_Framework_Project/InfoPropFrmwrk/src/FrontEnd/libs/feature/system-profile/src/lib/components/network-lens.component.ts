import {
  ChangeDetectionStrategy,
  Component,
  computed,
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

      <ipf-sp-lens-graph
        [structure]="structure()!"
        [highlightNodes]="ref.overlay.nodeIds ?? []"
        [highlightEdges]="ref.overlay.edges ?? []"
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
              <dt>In this result set</dt>
              <dd>{{ nodeInSet() ? 'yes' : 'no' }}</dd>
            </div>
            @if (nodeValue(); as v) {
              <div>
                <dt>{{ ref.overlay.label }} value</dt>
                <dd><ipf-value [value]="v" [compact]="false" /></dd>
              </div>
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
        <li><i class="swatch hl"></i> in the selected result set</li>
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
        margin-bottom: var(--spacingVerticalM, 12px);
      }
      .caption .label {
        font-weight: var(--fontWeightSemibold, 600);
        color: var(--colorNeutralForeground1);
      }
      .caption .src {
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground3);
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

  protected readonly overlayRefs = computed<OverlayRef[]>(() =>
    collectOverlays(this.runs()),
  );

  protected readonly current = computed<OverlayRef | null>(() => {
    const key = this.selectedKey();
    const refs = this.overlayRefs();
    if (refs.length === 0) return null;
    return refs.find((r) => r.key === key) ?? null;
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

  protected toolkitLabel(ref: OverlayRef): string {
    return TOOLKIT_LABEL[ref.run.toolkit];
  }

  protected onNode(id: number): void {
    this.selectedNode.update((cur) => (cur === id ? null : id));
  }
}
