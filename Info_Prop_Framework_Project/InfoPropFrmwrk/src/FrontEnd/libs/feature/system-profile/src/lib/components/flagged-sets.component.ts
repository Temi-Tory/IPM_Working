import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { IconComponent } from '@inf-prop/shared/ui';
import { ScenarioRun } from '@inf-prop/shared/data-access';
import { OverlayRef, TOOLKIT_LABEL, collectOverlays } from '../model/profile-view';

/**
 * The "hotspot alerts" idea, kept only in the form the framework licenses: a
 * plain index of the node / edge sets the analyses THEMSELVES identified —
 * bottlenecks, single points of failure, critical-path nodes, diamond
 * conditioning nodes, ... — read straight from `ScenarioRun.overlays`.
 *
 * Every alert type the old page invented — utilisation over 90%, more than N
 * bottlenecks, efficiency loss over 20%, mean belief under 0.5, and the rest —
 * was a UI-side threshold with a UI-assigned severity, and is gone. There is no
 * severity here and no threshold: just what each toolkit's own output marked on
 * the network, and how many, because the interface is a window, not a second
 * implementation.
 */
@Component({
  selector: 'ipf-sp-flagged-sets',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <h3 class="head">
      <ipf-icon name="target" [size]="18" />
      Result sets from the analyses
    </h3>

    @if (overlays().length === 0) {
      <p class="empty">
        No analysis has identified a node or edge set on these scenarios yet.
        Bottlenecks, single points of failure, critical-path nodes and diamond
        conditioning nodes appear here once a Flow, Schedule or Reliability run
        produces them. This view marks nothing of its own.
      </p>
    } @else {
      <ul class="list">
        @for (ref of overlays(); track ref.key) {
          <li>
            <button
              type="button"
              class="row"
              [class.active]="ref.key === selectedKey()"
              (click)="overlaySelect.emit(ref.key)"
            >
              <span class="label">{{ ref.overlay.label }}</span>
              <span class="counts">
                @if (ref.nodeCount) {
                  <span>{{ ref.nodeCount }} node{{ ref.nodeCount === 1 ? '' : 's' }}</span>
                }
                @if (ref.edgeCount) {
                  <span>{{ ref.edgeCount }} edge{{ ref.edgeCount === 1 ? '' : 's' }}</span>
                }
              </span>
              <span class="src"
                >{{ ref.run.scenarioName }} scenario · {{ toolkitLabel(ref) }} ·
                {{ ref.run.valueType }}</span
              >
              <ipf-icon name="eye" [size]="15" />
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .head {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 var(--spacingVerticalM, 12px);
        font-size: var(--fontSizeBase400, 16px);
        font-weight: var(--fontWeightSemibold, 600);
        color: var(--colorNeutralForeground1);
      }
      .empty {
        margin: 0;
        font-size: var(--fontSizeBase300, 14px);
        color: var(--colorNeutralForeground2);
        max-width: 68ch;
      }
      .list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--spacingVerticalXS, 4px);
      }
      .row {
        display: flex;
        align-items: center;
        gap: var(--spacingHorizontalM, 12px);
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--colorNeutralStroke2);
        border-radius: var(--borderRadiusMedium, 4px);
        background: var(--colorNeutralBackground1);
        color: var(--colorNeutralForeground1);
        font: inherit;
        font-size: var(--fontSizeBase300, 14px);
        text-align: left;
        cursor: pointer;
      }
      .row:hover {
        border-color: var(--colorNeutralStroke1);
        background: var(--colorNeutralBackground1Hover, var(--colorNeutralBackground2));
      }
      .row.active {
        border-color: var(--colorBrandStroke1);
        background: var(--colorBrandBackground2);
      }
      .label {
        font-weight: var(--fontWeightSemibold, 600);
      }
      .counts {
        display: flex;
        gap: 8px;
        color: var(--colorNeutralForeground2);
        font-size: var(--fontSizeBase200, 12px);
      }
      .src {
        margin-left: auto;
        color: var(--colorNeutralForeground3);
        font-size: var(--fontSizeBase200, 12px);
      }
    `,
  ],
})
export class FlaggedSetsComponent {
  readonly runs = input.required<ScenarioRun[]>();
  readonly selectedKey = input<string | null>(null);
  readonly overlaySelect = output<string>();

  protected readonly overlays = computed<OverlayRef[]>(() =>
    collectOverlays(this.runs()),
  );

  protected toolkitLabel(ref: OverlayRef): string {
    return TOOLKIT_LABEL[ref.run.toolkit];
  }
}
