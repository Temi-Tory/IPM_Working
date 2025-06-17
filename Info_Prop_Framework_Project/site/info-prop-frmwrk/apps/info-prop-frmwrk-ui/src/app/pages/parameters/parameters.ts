import { Component, inject, signal, computed } from '@angular/core';
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

import { GraphStateService } from '../../services/graph-state.service';
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

    // Redirect if no graph is loaded
    if (!this.isGraphLoaded()) {
      this.router.navigate(['/upload']);
    }
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

      const result = await this.graphState.runFullAnalysis(
        basicParams,
        advancedOptions,
        {
          message: 'Running full analysis with your parameters...',
          showCancelButton: true
        }
      );

      clearInterval(progressInterval);
      this.analysisProgress.set(100);

      if (result.success) {
        this.lastAnalysisResult.set(result.result);
        this.snackBar.open('Analysis completed successfully!', 'View Results', {
          duration: 5000
        }).onAction().subscribe(() => {
          this.router.navigate(['/reachability']);
        });
      } else {
        this.snackBar.open(`Analysis failed: ${result.error}`, 'Close', {
          duration: 5000
        });
      }

    } catch (error) {
      this.snackBar.open('Analysis failed due to an unexpected error', 'Close', {
        duration: 5000
      });
    } finally {
      this.isRunningAnalysis.set(false);
      setTimeout(() => this.analysisProgress.set(0), 2000);
    }
  }

  resetToDefaults(): void {
    this.basicForm.reset({
      nodePrior: 0.85,
      edgeProb: 0.90,
      overrideNodePrior: true,
      overrideEdgeProb: true
    });

    this.advancedForm.reset({
      includeClassification: true,
      enableMonteCarlo: false,
      useIndividualOverrides: false,
      monteCarloSamples: 10000
    });

    this.snackBar.open('Parameters reset to defaults', 'Close', {
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
}