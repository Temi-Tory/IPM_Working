import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiRequestError } from '@inf-prop/shared/api-client';
import {
  NetworkContextService,
  SessionInputService,
  buildCapacitiesContent,
  buildCpmInputsContent,
  buildLinkProbabilitiesContent,
  buildNodePriorsContent,
  toUploadFile,
} from '@inf-prop/shared/data-access';
import {
  BulkValueEditorComponent,
  BulkValueItem,
  CardComponent,
  EmptyStateComponent,
  ErrorBannerComponent,
  IconComponent,
  LoadingStateComponent,
  PageHeaderComponent,
} from '@inf-prop/shared/ui';

export type InputKind = 'reliability' | 'flow' | 'schedule';

const KIND_TITLE: Record<InputKind, string> = {
  reliability: 'Reliability',
  flow: 'Flow',
  schedule: 'Schedule',
};

const KIND_ROUTE: Record<InputKind, string> = {
  reliability: '/reliability',
  flow: '/flow',
  schedule: '/schedule',
};

const KIND_DESCRIPTION: Record<InputKind, string> = {
  reliability:
    'Reliability needs a node-priors value (0–1) for every node and a link-probability value (0–1) for every edge.',
  flow: 'Flow needs an edge-capacity value (≥ 0) for every edge. Node capacities are optional.',
  schedule:
    'Schedule needs a duration value (≥ 0) for every node. Edge delays default to 0; costs are optional.',
};

/**
 * Author a scenario's analysis inputs by hand, when a network has none for a
 * given toolkit — the same file-convention shape an upload would carry
 * (`file-convention.ts`), built from values entered here instead of read
 * from a file. Values entered are Float64 only; the framework's interval and
 * p-box forms still need a real file (this editor doesn't invent multi-field
 * entry for a bound pair or a p-box summary).
 *
 * Saving re-uploads the WHOLE session (there is no "add to an existing
 * session" endpoint) — `SessionInputService` handles rebuilding what the
 * session already has so this only ever adds to it, never replaces it.
 */
@Component({
  selector: 'ipf-feature-session-inputs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageHeaderComponent,
    CardComponent,
    EmptyStateComponent,
    ErrorBannerComponent,
    LoadingStateComponent,
    IconComponent,
    BulkValueEditorComponent,
  ],
  templateUrl: './feature-session-inputs.html',
  styleUrl: './feature-session-inputs.scss',
})
export class FeatureSessionInputs {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly ctx = inject(NetworkContextService);
  private readonly sessionInputs = inject(SessionInputService);

  protected readonly kind = signal<InputKind>('reliability');
  protected readonly scenarioName = signal('float');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly title = computed(() => KIND_TITLE[this.kind()]);
  protected readonly toolkitRoute = computed(() => KIND_ROUTE[this.kind()]);
  protected readonly description = computed(() => KIND_DESCRIPTION[this.kind()]);

  protected readonly nodeItems = computed<BulkValueItem[]>(() => {
    const s = this.ctx.structure();
    if (!s) return [];
    return [...s.nodes].sort((a, b) => a - b).map((id) => ({
      key: String(id),
      label: String(id),
    }));
  });

  protected readonly edgeItems = computed<BulkValueItem[]>(() => {
    const s = this.ctx.structure();
    if (!s) return [];
    return s.edges.map(([u, v]) => ({ key: `${u}-${v}`, label: `${u} → ${v}` }));
  });

  // --- entered values, per possible field --------------------------------
  private readonly nodePriors = signal<Record<string, number>>({});
  private readonly linkProbs = signal<Record<string, number>>({});
  private readonly edgeCapacities = signal<Record<string, number>>({});
  protected readonly includeNodeCapacities = signal(false);
  private readonly nodeCapacities = signal<Record<string, number>>({});
  private readonly nodeDurations = signal<Record<string, number>>({});
  private readonly edgeDelays = signal<Record<string, number>>({});
  protected readonly includeCost = signal(false);
  private readonly nodeCosts = signal<Record<string, number>>({});
  private readonly edgeCosts = signal<Record<string, number>>({});

  protected onNodePriors(v: Record<string, number>): void {
    this.nodePriors.set(v);
  }
  protected onLinkProbs(v: Record<string, number>): void {
    this.linkProbs.set(v);
  }
  protected onEdgeCapacities(v: Record<string, number>): void {
    this.edgeCapacities.set(v);
  }
  protected onNodeCapacities(v: Record<string, number>): void {
    this.nodeCapacities.set(v);
  }
  protected onNodeDurations(v: Record<string, number>): void {
    this.nodeDurations.set(v);
  }
  protected onEdgeDelays(v: Record<string, number>): void {
    this.edgeDelays.set(v);
  }
  protected onNodeCosts(v: Record<string, number>): void {
    this.nodeCosts.set(v);
  }
  protected onEdgeCosts(v: Record<string, number>): void {
    this.edgeCosts.set(v);
  }

  /** how many required fields are still unset, per kind — the Save gate. */
  protected readonly missingCount = computed(() => {
    const nodes = this.nodeItems().length;
    const edges = this.edgeItems().length;
    switch (this.kind()) {
      case 'reliability':
        return (
          Math.max(0, nodes - Object.keys(this.nodePriors()).length) +
          Math.max(0, edges - Object.keys(this.linkProbs()).length)
        );
      case 'flow':
        return Math.max(0, edges - Object.keys(this.edgeCapacities()).length);
      case 'schedule':
        return Math.max(0, nodes - Object.keys(this.nodeDurations()).length);
    }
  });

  protected readonly canSave = computed(
    () =>
      !this.saving() &&
      this.scenarioName().trim().length > 0 &&
      (this.nodeItems().length > 0 || this.edgeItems().length > 0) &&
      this.missingCount() === 0,
  );

  constructor() {
    const kindParam = this.route.snapshot.paramMap.get('kind');
    if (kindParam === 'reliability' || kindParam === 'flow' || kindParam === 'schedule') {
      this.kind.set(kindParam);
    }
    if (this.ctx.context() && !this.ctx.structure()) {
      this.ctx.loadStructure().subscribe({ error: () => undefined });
    }
  }

  protected onScenarioName(event: Event): void {
    this.scenarioName.set((event.target as HTMLInputElement).value);
  }

  protected save(): void {
    const context = this.ctx.context();
    if (!context || !this.canSave()) return;
    const net = context.networkName;
    const scenario = this.scenarioName().trim();
    const description = `Manually entered ${KIND_TITLE[this.kind()]} inputs for ${net}`;
    const base = `${net}/${scenario}`;

    const files: File[] = [];
    if (this.kind() === 'reliability') {
      files.push(
        toUploadFile(
          `${base}/${net}-nodepriors.json`,
          buildNodePriorsContent(toNumberMap(this.nodePriors()), 'float64', description),
          'application/json',
        ),
        toUploadFile(
          `${base}/${net}-linkprobabilities.json`,
          buildLinkProbabilitiesContent(this.linkProbs(), 'float64', description),
          'application/json',
        ),
      );
    } else if (this.kind() === 'flow') {
      files.push(
        toUploadFile(
          `${base}/${net}-capacities.json`,
          buildCapacitiesContent(
            this.edgeCapacities(),
            this.includeNodeCapacities() ? toNumberMap(this.nodeCapacities()) : undefined,
            description,
          ),
          'application/json',
        ),
      );
    } else {
      files.push(
        toUploadFile(
          `${base}/${net}-cpm-inputs.json`,
          buildCpmInputsContent({
            valueType: 'float64',
            nodeDurations: toNumberMap(this.nodeDurations()),
            edgeDelays: this.edgeDelays(),
            nodeCosts: this.includeCost() ? toNumberMap(this.nodeCosts()) : undefined,
            edgeCosts: this.includeCost() ? this.edgeCosts() : undefined,
          }),
          'application/json',
        ),
      );
    }

    this.saving.set(true);
    this.error.set(null);
    this.sessionInputs.addScenario(files).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (!res.success) {
          this.error.set(res.message || 'Upload failed.');
          return;
        }
        this.router.navigateByUrl(this.toolkitRoute());
      },
      error: (e: ApiRequestError) => {
        this.saving.set(false);
        this.error.set(e.message);
      },
    });
  }
}

function toNumberMap(values: Record<string, number>): Record<number, number> {
  const out: Record<number, number> = {};
  for (const [k, v] of Object.entries(values)) out[Number(k)] = v;
  return out;
}
