/**
 * Registers every Fluent 2 Web Component custom element exactly once, for the
 * whole app. Imported for side effects from `provideFluent()` (which the shell's
 * `main.ts` calls before `bootstrapApplication`).
 *
 * This is the ONLY place components are registered. Feature libs use
 * `<fluent-*>` elements directly in templates (with `CUSTOM_ELEMENTS_SCHEMA` on
 * the component) — they do not re-register.
 *
 * Fluent 2 web-components v3 has NO data-grid / card / table component. Use a
 * native `<table>` styled with Fluent design tokens, or `<fluent-tree>`, and the
 * `ipf-*` composed components in this lib.
 */

import '@fluentui/web-components/accordion/define.js';
import '@fluentui/web-components/accordion-item/define.js';
import '@fluentui/web-components/anchor-button/define.js';
import '@fluentui/web-components/avatar/define.js';
import '@fluentui/web-components/badge/define.js';
import '@fluentui/web-components/button/define.js';
import '@fluentui/web-components/checkbox/define.js';
import '@fluentui/web-components/compound-button/define.js';
import '@fluentui/web-components/counter-badge/define.js';
import '@fluentui/web-components/dialog/define.js';
import '@fluentui/web-components/dialog-body/define.js';
import '@fluentui/web-components/divider/define.js';
import '@fluentui/web-components/drawer/define.js';
import '@fluentui/web-components/drawer-body/define.js';
import '@fluentui/web-components/dropdown/define.js';
import '@fluentui/web-components/field/define.js';
import '@fluentui/web-components/image/define.js';
import '@fluentui/web-components/label/define.js';
import '@fluentui/web-components/link/define.js';
import '@fluentui/web-components/listbox/define.js';
import '@fluentui/web-components/menu/define.js';
import '@fluentui/web-components/menu-button/define.js';
import '@fluentui/web-components/menu-item/define.js';
import '@fluentui/web-components/menu-list/define.js';
import '@fluentui/web-components/message-bar/define.js';
import '@fluentui/web-components/option/define.js';
import '@fluentui/web-components/progress-bar/define.js';
import '@fluentui/web-components/radio/define.js';
import '@fluentui/web-components/radio-group/define.js';
import '@fluentui/web-components/rating-display/define.js';
import '@fluentui/web-components/slider/define.js';
import '@fluentui/web-components/spinner/define.js';
import '@fluentui/web-components/switch/define.js';
import '@fluentui/web-components/tab/define.js';
import '@fluentui/web-components/tablist/define.js';
import '@fluentui/web-components/text/define.js';
import '@fluentui/web-components/text-input/define.js';
import '@fluentui/web-components/textarea/define.js';
import '@fluentui/web-components/toggle-button/define.js';
import '@fluentui/web-components/tooltip/define.js';
import '@fluentui/web-components/tree/define.js';
import '@fluentui/web-components/tree-item/define.js';

/** No-op marker so bundlers keep this module and callers have something to call. */
export function registerFluentComponents(): void {
  /* side-effect imports above do the work */
}
