import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  computed,
  input,
  model,
} from '@angular/core';
import {
  TOOLKIT_VALUE_TYPES,
  ToolkitKind,
  ValueType,
} from '@inf-prop/shared/api-client';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icon-registry';

interface Option {
  value: ValueType;
  label: string;
  icon: IconName;
  allowed: boolean;
  note: string;
}

const META: Record<ValueType, { label: string; icon: IconName }> = {
  float64: { label: 'Deterministic', icon: 'value-number' },
  interval: { label: 'Interval', icon: 'value-interval' },
  pbox: { label: 'Probability box', icon: 'value-pbox' },
};

const WHY_NOT: Record<ToolkitKind, Partial<Record<ValueType, string>>> = {
  reliability: {},
  flow: {
    interval: 'The flow toolkit computes with Float64 capacities only.',
    pbox: 'The flow toolkit computes with Float64 capacities only.',
  },
  schedule: {
    pbox: 'The schedule toolkit supports Float64 and Interval, not probability-box.',
  },
};

/**
 * A value-type selector whose options are a function of the toolkit about to
 * run — never a fixed global three. Disallowed types are shown, disabled, with
 * a plain reason, so the asymmetry is visible rather than hidden:
 *
 *   reliability -> Float64, Interval, p-box
 *   flow        -> Float64 only
 *   schedule    -> Float64, Interval
 */
@Component({
  selector: 'ipf-value-type-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [IconComponent],
  template: `
    <fieldset>
      <legend>{{ legend() }}</legend>
      <div class="opts">
        @for (opt of options(); track opt.value) {
          <label
            class="opt"
            [class.disabled]="!opt.allowed"
            [class.selected]="opt.allowed && value() === opt.value"
            [title]="opt.allowed ? '' : opt.note"
          >
            <input
              type="radio"
              name="value-type"
              [value]="opt.value"
              [checked]="value() === opt.value"
              [disabled]="!opt.allowed"
              (change)="select(opt)"
            />
            <ipf-icon [name]="opt.icon" [size]="16" />
            <span class="label">{{ opt.label }}</span>
            @if (!opt.allowed) {
              <span class="na">unavailable</span>
            }
          </label>
        }
      </div>
      @if (activeNote(); as note) {
        <p class="hint">{{ note }}</p>
      }
    </fieldset>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      fieldset {
        border: none;
        margin: 0;
        padding: 0;
      }
      legend {
        padding: 0;
        margin-bottom: var(--spacingVerticalXS, 4px);
        font-size: var(--fontSizeBase200, 12px);
        font-weight: var(--fontWeightSemibold, 600);
        color: var(--colorNeutralForeground2);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .opts {
        display: flex;
        gap: var(--spacingHorizontalS, 8px);
        flex-wrap: wrap;
      }
      .opt {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border: 1px solid var(--colorNeutralStroke1);
        border-radius: var(--borderRadiusMedium, 4px);
        font-size: var(--fontSizeBase300, 14px);
        color: var(--colorNeutralForeground1);
        cursor: pointer;
        user-select: none;
      }
      .opt input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
      }
      .opt.selected {
        border-color: var(--colorBrandStroke1);
        background: var(--colorBrandBackground2);
        color: var(--colorBrandForeground1);
      }
      .opt.disabled {
        cursor: not-allowed;
        color: var(--colorNeutralForegroundDisabled);
        border-style: dashed;
        border-color: var(--colorNeutralStroke2);
      }
      .na {
        font-size: var(--fontSizeBase100, 10px);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--colorNeutralForegroundDisabled);
      }
      .hint {
        margin: var(--spacingVerticalXS, 4px) 0 0;
        font-size: var(--fontSizeBase200, 12px);
        color: var(--colorNeutralForeground3);
      }
    `,
  ],
})
export class ValueTypeSelectorComponent {
  readonly toolkit = input.required<ToolkitKind>();
  readonly value = model.required<ValueType>();
  readonly legend = input('Value type');

  protected readonly options = computed<Option[]>(() => {
    const allowed = new Set(TOOLKIT_VALUE_TYPES[this.toolkit()]);
    const why = WHY_NOT[this.toolkit()];
    return (['float64', 'interval', 'pbox'] as ValueType[]).map((v) => ({
      value: v,
      label: META[v].label,
      icon: META[v].icon,
      allowed: allowed.has(v),
      note: why[v] ?? '',
    }));
  });

  protected readonly activeNote = computed(() => {
    const disallowed = this.options().filter((o) => !o.allowed && o.note);
    return disallowed.length ? disallowed[0].note : null;
  });

  protected select(opt: Option): void {
    if (opt.allowed) this.value.set(opt.value);
  }
}
