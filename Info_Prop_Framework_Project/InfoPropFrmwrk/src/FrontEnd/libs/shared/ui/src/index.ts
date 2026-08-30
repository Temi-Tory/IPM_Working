// Fluent design system wiring.
// `register-fluent` is intentionally NOT re-exported — it has ~40 custom-element
// side-effect imports and is loaded lazily by `provideFluent()` at bootstrap.
export * from './lib/fluent/provide-fluent';
export * from './lib/theme/theme.service';

// Icons
export * from './lib/icon/icon.component';
export * from './lib/icon/icon-registry';

// Composed components
export * from './lib/graph/network-graph.component';
export * from './lib/scenario/scenario-comparison-table.component';
export * from './lib/bulk-value-editor/bulk-value-editor.component';
export * from './lib/components/card.component';
export * from './lib/components/page-header.component';
export * from './lib/components/empty-state.component';
export * from './lib/components/loading-state.component';
export * from './lib/components/error-banner.component';
export * from './lib/components/stat-tile.component';

// Value-form honesty primitives
export * from './lib/value/value-format';
export * from './lib/value/value-display.component';
export * from './lib/value/value-type-selector.component';
