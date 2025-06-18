// parameters.component.ts
import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterModule } from '@angular/router';

import { GraphStateService } from '../../services/graph-state-service';
import { MainServerService } from '../../services/main-server-service';

interface ParameterPreset {
  name: string;
  description: string;
  nodePrior: number;
  edgeProb: number;
  icon: string;
}

@Component({
  selector: 'app-parameters',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSliderModule,
    MatCheckboxModule,
    MatExpansionModule,
    MatTabsModule,
    MatSnackBarModule,
    MatProgressBarModule,
    MatDividerModule,
    MatTooltipModule,
    RouterModule
  ],
  templateUrl: './parameters.html',
  styleUrl: './parameters.scss',
})
export class ParametersComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  
  readonly graphState = inject(GraphStateService);
  readonly mainServerService = inject(MainServerService);

  // Form groups
  basicForm: FormGroup;
  advancedForm: FormGroup;

  // State signals
  isRunningAnalysis = signal(false);
  analysisProgress = signal(0);
  lastAnalysisResult = signal<any>(null);
  
  // Individual parameter overrides
  nodeOverrides = signal<{ [nodeId: string]: number }>({});
  edgeOverrides = signal<{ [edgeKey: string]: number }>({});

  // Parameter presets
  readonly presets: ParameterPreset[] = [
    {
      name: 'Conservative',
      description: 'Low risk, high reliability assumptions',
      nodePrior: 0.95,
      edgeProb: 0.98,
      icon: 'security'
    },
    {
      name: 'Balanced',
      description: 'Moderate assumptions for general analysis',
      nodePrior: 0.85,
      edgeProb: 0.90,
      icon: 'balance'
    },
    {
      name: 'Optimistic',
      description: 'High performance assumptions',
      nodePrior: 0.75,
      edgeProb: 0.85,
      icon: 'trending_up'
    },
    {
      name: 'Pessimistic',
      description: 'Conservative assumptions for worst-case analysis',
      nodePrior: 0.60,
      edgeProb: 0.70,
      icon: 'trending_down'
    }
  ];

  // Computed properties
  readonly isGraphLoaded = computed(() => this.graphState.isGraphLoaded());
  readonly nodeCount = computed(() => this.graphState.nodeCount());
  readonly edgeCount = computed(() => this.graphState.edgeCount());
  readonly hasDiamonds = computed(() => this.graphState.hasDiamonds());
  
  // Task 2.1: Add Stale Detection Properties
  readonly isAnalysisStale = computed(() => this.graphState.isAnalysisStale());
  readonly hasRunAnalysis = computed(() => this.graphState.lastAnalysisRun() !== null);

  constructor() {
    this.basicForm = this.fb.group({
      nodePrior: [0.85, [Validators.required, Validators.min(0.01), Validators.max(1.0)]],
      edgeProb: [0.90, [Validators.required, Validators.min(0.01), Validators.max(1.0)]],
      overrideNodePrior: [true],
      overrideEdgeProb: [true]
    });

    this.advancedForm = this.fb.group({
      includeClassification: [true],
      enableMonteCarlo: [false],
      useIndividualOverrides: [false],
      monteCarloSamples: [10000, [Validators.min(1000), Validators.max(1000000)]]
    });

    // Task 2.3: Add Form Change Listeners
    this.basicForm.valueChanges.subscribe(() => {
      this.graphState.markParametersChanged();
    });

    this.advancedForm.valueChanges.subscribe(() => {
      this.graphState.markParametersChanged();
    });

    // Initialize form values from loaded graph data
    this.initializeFromGraphData();

    // Redirect if no graph is loaded
    if (!this.isGraphLoaded()) {
      this.router.navigate(['/upload']);
    }

    // Watch for graph changes and reinitialize
    effect(() => {
      if (this.isGraphLoaded()) {
        this.initializeFromGraphData();
      }
    });
  }

  // Task 2.2: Add Dynamic Button Text Method
  getAnalysisButtonText(): string {
    if (!this.hasRunAnalysis()) {
      return 'Run Analysis';
    }
    
    if (this.isAnalysisStale()) {
      return 'Parameters Changed - Re-run Analysis';
    }
    
    return 'Re-run Analysis';
  }

  applyPreset(preset: ParameterPreset): void {
    this.basicForm.patchValue({
      nodePrior: preset.nodePrior,
      edgeProb: preset.edgeProb
    });
    
    this.snackBar.open(`Applied ${preset.name} preset`, 'Close', {
      duration: 2000
    });
  }

  async runAnalysis(): Promise<void> {
    if (!this.isGraphLoaded() || this.basicForm.invalid) {
      return;
    }

    this.isRunningAnalysis.set(true);
    this.analysisProgress.set(0);

    try {
      const basicParams = this.basicForm.value;
      const advancedOptions = this.advancedForm.value;

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        this.analysisProgress.update(current => Math.min(current + 10, 90));
      }, 200);

      // Include individual overrides in advanced options
      const enhancedAdvancedOptions = {
        ...advancedOptions,
        individualNodePriors: this.nodeOverrides(),
        individualEdgeProbabilities: this.edgeOverrides()
      };

      const result = await this.graphState.runFullAnalysis(
        basicParams,
        enhancedAdvancedOptions,
        {
          message: 'Running full analysis with your parameters...',
          showCancelButton: true
        }
      );

      clearInterval(progressInterval);
      this.analysisProgress.set(100);

      if (result.success) {
        this.lastAnalysisResult.set(result.result);
        
        // Sync current parameters to global state after successful analysis
        this.syncParametersToGlobalState();
        
        // Task 2.4: Reset stale state on successful completion
        this.graphState.clearParametersChanged();
        
        // Enhanced feedback with parameter modification details
        const mods = result.result?.parameterModifications;
        let message = 'Analysis completed successfully!';
        
        if (mods && (mods.totalNodesModified > 0 || mods.totalEdgesModified > 0)) {
          const nodeText = mods.totalNodesModified > 0 ? `${mods.totalNodesModified} nodes` : '';
          const edgeText = mods.totalEdgesModified > 0 ? `${mods.totalEdgesModified} edges` : '';
          const modifiedParts = [nodeText, edgeText].filter(Boolean).join(' and ');
          message = `Analysis complete! Modified ${modifiedParts} parameters.`;
        }
        
        this.snackBar.open(message, 'View Results', {
          duration: 5000
        }).onAction().subscribe(() => {
          this.router.navigate(['/reachability']);
        });
      } else {
        this.snackBar.open(`Analysis failed: ${result.error}`, 'Close', {
          duration: 5000
        });
      }

    } catch  {
      this.snackBar.open('Analysis failed due to an unexpected error', 'Close', {
        duration: 5000
      });
    } finally {
      this.isRunningAnalysis.set(false);
      setTimeout(() => this.analysisProgress.set(0), 2000);
    }
  }

  formatEdgeLabel(edgeKey: string): string {
    // Handle both "(1,2)" and "1-2" formats
    if (edgeKey.startsWith('(') && edgeKey.endsWith(')')) {
      const inner = edgeKey.slice(1, -1);
      const [from, to] = inner.split(',').map(s => s.trim());
      return `${from} → ${to}`;
    } else if (edgeKey.includes('-')) {
      const [from, to] = edgeKey.split('-');
      return `${from} → ${to}`;
    }
    return edgeKey; // Fallback
  }

  resetToDefaults(): void {
    // Reset to original file values, not hardcoded defaults
    this.initializeFromGraphData();

    this.advancedForm.reset({
      includeClassification: true,
      enableMonteCarlo: false,
      useIndividualOverrides: false,
      monteCarloSamples: 10000
    });

    this.snackBar.open('Parameters reset to original file values', 'Close', {
      duration: 2000
    });
  }

  formatSliderValue(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
  }

  getParameterDescription(param: string): string {
    const descriptions: { [key: string]: string } = {
      nodePrior: 'The prior probability that each node is functioning correctly',
      edgeProb: 'The probability that each edge (connection) is operational',
      includeClassification: 'Include diamond structure classification in the analysis',
      enableMonteCarlo: 'Run Monte Carlo simulation for validation',
      useIndividualOverrides: 'Allow individual node/edge parameter overrides'
    };
    return descriptions[param] || '';
  }

  private initializeFromGraphData(): void {
    const structure = this.graphState.graphStructure();
    if (!structure) {
      // Clear everything if no structure
      this.clearAllOverrides();
      return;
    }

    // Calculate average node prior from file data
    const nodePriors = Object.values(structure.node_priors || {});
    const avgNodePrior = nodePriors.length > 0
      ? nodePriors.reduce((sum, val) => sum + val, 0) / nodePriors.length
      : 0.85;

    // Calculate average edge probability from file data
    const edgeProbs = Object.values(structure.edge_probabilities || {});
    const avgEdgeProb = edgeProbs.length > 0
      ? edgeProbs.reduce((sum, val) => sum + val, 0) / edgeProbs.length
      : 0.90;

    // Update form with values from uploaded file
    this.basicForm.patchValue({
      nodePrior: avgNodePrior,
      edgeProb: avgEdgeProb
    });

    // CLEAR ALL EXISTING OVERRIDES FIRST - new file upload starts fresh
    this.clearAllOverrides();

    // Initialize individual overrides from file data
    if (structure.node_priors) {
      const nodeOverrides: { [nodeId: string]: number } = {};
      Object.entries(structure.node_priors).forEach(([nodeId, value]) => {
        // Only set as override if it differs from the average
        if (Math.abs(value - avgNodePrior) > 0.001) {
          nodeOverrides[nodeId] = value;
        }
      });
      this.nodeOverrides.set(nodeOverrides);
    }

    if (structure.edge_probabilities) {
      const edgeOverrides: { [edgeKey: string]: number } = {};
      Object.entries(structure.edge_probabilities).forEach(([edgeKey, value]) => {
        // Only set as override if it differs from the average
        if (Math.abs(value - avgEdgeProb) > 0.001) {
          edgeOverrides[edgeKey] = value;
        }
      });
      this.edgeOverrides.set(edgeOverrides);
    }

    // Show notification about loaded values
    const hasVariedValues = this.getNodeOverrideCount() > 0 || this.getEdgeOverrideCount() > 0;
    if (hasVariedValues) {
      this.snackBar.open(
        `New file loaded: ${this.getNodeOverrideCount()} node and ${this.getEdgeOverrideCount()} edge parameter variations detected`,
        'Close',
        { duration: 4000 }
      );
    } else {
      this.snackBar.open(
        `New file loaded with uniform parameters: ${this.formatSliderValue(avgNodePrior)} node prior, ${this.formatSliderValue(avgEdgeProb)} edge probability`,
        'Close',
        { duration: 3000 }
      );
    }
  }

  private clearAllOverrides(): void {
    this.nodeOverrides.set({});
    this.edgeOverrides.set({});
  }

  getOriginalFileValues(): { avgNodePrior: number; avgEdgeProb: number } {
    const structure = this.graphState.graphStructure();
    if (!structure) return { avgNodePrior: 0.85, avgEdgeProb: 0.90 };

    const nodePriors = Object.values(structure.node_priors || {});
    const avgNodePrior = nodePriors.length > 0
      ? nodePriors.reduce((sum, val) => sum + val, 0) / nodePriors.length
      : 0.85;

    const edgeProbs = Object.values(structure.edge_probabilities || {});
    const avgEdgeProb = edgeProbs.length > 0
      ? edgeProbs.reduce((sum, val) => sum + val, 0) / edgeProbs.length
      : 0.90;

    return { avgNodePrior, avgEdgeProb };
  }

  // Node override methods
  getNodeOverrideCount(): number {
    return Object.keys(this.nodeOverrides()).length;
  }

  getAvailableNodes(): number[] {
    const structure = this.graphState.graphStructure();
    if (!structure?.edgelist) return [];
    
    const nodes = new Set<number>();
    structure.edgelist.forEach(([from, to]) => {
      nodes.add(from);
      nodes.add(to);
    });
    return Array.from(nodes).sort((a, b) => a - b);
  }

  getNodeOverride(nodeId: number): number | null {
    return this.nodeOverrides()[nodeId.toString()] || null;
  }

  setNodeOverride(nodeId: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value);
    
    if (isNaN(value) || value === 0) {
      this.clearNodeOverride(nodeId);
      return;
    }

    if (value >= 0.01 && value <= 1.0) {
      this.nodeOverrides.update(overrides => ({
        ...overrides,
        [nodeId.toString()]: value
      }));
      
      // Task 2.3: Mark parameters as changed when individual overrides are updated
      this.graphState.markParametersChanged();
    }
  }

  clearNodeOverride(nodeId: number): void {
    this.nodeOverrides.update(overrides => {
      const updated = { ...overrides };
      delete updated[nodeId.toString()];
      return updated;
    });
    
    // Mark parameters as changed when overrides are cleared
    this.graphState.markParametersChanged();
  }

  clearAllNodeOverrides(): void {
    this.nodeOverrides.set({});
    this.graphState.markParametersChanged();
    this.snackBar.open('All node overrides cleared', 'Close', {
      duration: 2000
    });
  }

  // Edge override methods
  getEdgeOverrideCount(): number {
    return Object.keys(this.edgeOverrides()).length;
  }

  getAvailableEdges(): { key: string; from: number; to: number }[] {
    const structure = this.graphState.graphStructure();
    if (!structure?.edgelist) return [];
    
    return structure.edgelist.map(([from, to]) => ({
      key: `(${from},${to})`, // Match server expected format: "(1,2)"
      from,
      to
    }));
  }

  getEdgeOverride(edgeKey: string): number | null {
    return this.edgeOverrides()[edgeKey] || null;
  }

  setEdgeOverride(edgeKey: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value);
    
    if (isNaN(value) || value === 0) {
      this.clearEdgeOverride(edgeKey);
      return;
    }

    if (value >= 0.01 && value <= 1.0) {
      this.edgeOverrides.update(overrides => ({
        ...overrides,
        [edgeKey]: value
      }));
      
      // Task 2.3: Mark parameters as changed when individual overrides are updated
      this.graphState.markParametersChanged();
    }
  }

  clearEdgeOverride(edgeKey: string): void {
    this.edgeOverrides.update(overrides => {
      const updated = { ...overrides };
      delete updated[edgeKey];
      return updated;
    });
    
    // Mark parameters as changed when overrides are cleared
    this.graphState.markParametersChanged();
  }

  clearAllEdgeOverrides(): void {
    this.edgeOverrides.set({});
    this.graphState.markParametersChanged();
    this.snackBar.open('All edge overrides cleared', 'Close', {
      duration: 2000
    });
  }

  /**
   * Update global parameters when user makes changes
   * This ensures the global state stays in sync with user modifications
   */
  updateGlobalParametersFromOverrides(): void {
    const nodeOverrides = this.nodeOverrides();
    const edgeOverrides = this.edgeOverrides();
    
    if (Object.keys(nodeOverrides).length > 0 || Object.keys(edgeOverrides).length > 0) {
      this.graphState.updateGlobalParameters(
        Object.keys(nodeOverrides).length > 0 ? nodeOverrides : undefined,
        Object.keys(edgeOverrides).length > 0 ? edgeOverrides : undefined
      );
    }
  }

  /**
   * Called when analysis is complete to sync any parameter changes back to global state
   */
  private syncParametersToGlobalState(): void {
    // Update global state with current form values and overrides
    const basicParams = this.basicForm.value;
    const nodeOverrides = this.nodeOverrides();
    const edgeOverrides = this.edgeOverrides();

    // Build complete parameter sets
    const allNodePriors: { [nodeId: string]: number } = {};
    const allEdgeProbabilities: { [edgeKey: string]: number } = {};

    // Set global values for all nodes/edges first
    this.getAvailableNodes().forEach(nodeId => {
      allNodePriors[nodeId.toString()] = nodeOverrides[nodeId.toString()] || basicParams.nodePrior;
    });

    this.getAvailableEdges().forEach(edge => {
      allEdgeProbabilities[edge.key] = edgeOverrides[edge.key] || basicParams.edgeProb;
    });

    // Update global state
    this.graphState.updateGlobalParameters(allNodePriors, allEdgeProbabilities);
  }
}