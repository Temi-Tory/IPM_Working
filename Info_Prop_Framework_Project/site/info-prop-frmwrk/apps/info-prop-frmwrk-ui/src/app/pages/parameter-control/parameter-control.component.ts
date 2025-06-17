import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { Subject, takeUntil, debounceTime } from 'rxjs';

import { DataService, ParameterOverrides, NetworkData } from '../../services/data.service';

interface ParameterValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface NodeParameterEdit {
  nodeId: string;
  currentValue: number;
  originalValue: number;
  isModified: boolean;
}

interface EdgeParameterEdit {
  edgeKey: string;
  fromNode: number;
  toNode: number;
  currentValue: number;
  originalValue: number;
  isModified: boolean;
}

@Component({
  selector: 'app-parameter-control',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSliderModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatTabsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatChipsModule,
    MatExpansionModule
  ],
  templateUrl: './parameter-control.component.html',
  styleUrls: ['./parameter-control.component.scss']
})
export class ParameterControlComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private formBuilder = inject(FormBuilder);
  private dataService = inject(DataService);
  private snackBar = inject(MatSnackBar);

  @Input() showAdvanced = false;
  @Input() allowBulkEdit = true;
  @Output() parametersChanged = new EventEmitter<ParameterOverrides>();

  // Form groups
  globalParametersForm: FormGroup;
  
  // Component state
  networkData: NetworkData | null = null;
  originalData: any = null;
  currentOverrides: ParameterOverrides;
  
  // Individual parameter editing
  nodeParameters: NodeParameterEdit[] = [];
  edgeParameters: EdgeParameterEdit[] = [];
  
  // Table display columns
  nodeDisplayedColumns = ['nodeId', 'originalValue', 'currentValue', 'actions'];
  edgeDisplayedColumns = ['edge', 'originalValue', 'currentValue', 'actions'];
  
  // Validation state
  parameterValidation: ParameterValidation = {
    isValid: true,
    errors: [],
    warnings: []
  };
  
  // UI state
  selectedTabIndex = 0;
  showNodeSearch = false;
  showEdgeSearch = false;
  nodeSearchTerm = '';
  edgeSearchTerm = '';

  constructor() {
    // Initialize forms
    this.globalParametersForm = this.formBuilder.group({
      useGlobalNodePrior: [false],
      globalNodePrior: [1.0],
      useGlobalEdgeProb: [false],
      globalEdgeProb: [0.9],
      useIndividualOverrides: [false]
    });

    // Initialize current overrides
    this.currentOverrides = {
      useGlobalNodePrior: false,
      globalNodePrior: 1.0,
      useGlobalEdgeProb: false,
      globalEdgeProb: 0.9,
      useIndividualOverrides: false,
      individualNodePriors: {},
      individualEdgeProbabilities: {}
    };
  }

  ngOnInit(): void {
    // Subscribe to network data
    this.dataService.networkData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.networkData = data;
        if (data) {
          this.initializeParameterTables();
        }
      });

    // Subscribe to original data
    this.dataService.originalData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.originalData = data;
        if (data && this.networkData) {
          this.initializeParameterTables();
        }
      });

    // Subscribe to current parameter overrides
    this.dataService.parameterOverrides$
      .pipe(takeUntil(this.destroy$))
      .subscribe(overrides => {
        this.currentOverrides = overrides;
        this.updateFormValues();
      });

    // Watch for form changes with debouncing
    this.globalParametersForm.valueChanges
      .pipe(
        debounceTime(300),
        takeUntil(this.destroy$)
      )
      .subscribe(values => {
        this.onGlobalParametersChange(values);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeParameterTables(): void {
    if (!this.networkData || !this.originalData) return;

    // Initialize node parameters
    this.nodeParameters = [];
    if (this.originalData.nodePriors) {
      for (const [nodeId, originalValue] of Object.entries(this.originalData.nodePriors)) {
        const currentValue = this.currentOverrides.individualNodePriors[nodeId] ?? originalValue as number;
        this.nodeParameters.push({
          nodeId,
          currentValue,
          originalValue: originalValue as number,
          isModified: currentValue !== originalValue
        });
      }
    }

    // Initialize edge parameters
    this.edgeParameters = [];
    if (this.originalData.edgeProbabilities) {
      for (const [edgeKey, originalValue] of Object.entries(this.originalData.edgeProbabilities)) {
        const [fromStr, toStr] = edgeKey.replace(/[()]/g, '').split(',');
        const currentValue = this.currentOverrides.individualEdgeProbabilities[edgeKey] ?? originalValue as number;
        this.edgeParameters.push({
          edgeKey,
          fromNode: parseInt(fromStr.trim()),
          toNode: parseInt(toStr.trim()),
          currentValue,
          originalValue: originalValue as number,
          isModified: currentValue !== originalValue
        });
      }
    }
  }

  private updateFormValues(): void {
    this.globalParametersForm.patchValue(this.currentOverrides, { emitEvent: false });
  }

  // Global parameter handlers
  private onGlobalParametersChange(values: any): void {
    const updatedOverrides: ParameterOverrides = {
      ...this.currentOverrides,
      ...values
    };

    this.validateParameters(updatedOverrides);
    this.dataService.updateParameterOverrides(updatedOverrides);
    this.parametersChanged.emit(updatedOverrides);
  }

  // Individual parameter handlers
  onNodeParameterChange(nodeParam: NodeParameterEdit, newValue: number): void {
    if (newValue < 0 || newValue > 1) {
      this.showErrorSnackBar('Node prior must be between 0 and 1');
      return;
    }

    nodeParam.currentValue = newValue;
    nodeParam.isModified = newValue !== nodeParam.originalValue;

    // Update data service
    this.dataService.setIndividualNodePrior(nodeParam.nodeId, newValue);
    
    // Enable individual overrides if not already enabled
    if (!this.currentOverrides.useIndividualOverrides) {
      this.globalParametersForm.patchValue({ useIndividualOverrides: true });
    }

    this.showInfoSnackBar(`Node ${nodeParam.nodeId} prior updated to ${newValue.toFixed(3)}`);
  }

  onEdgeParameterChange(edgeParam: EdgeParameterEdit, newValue: number): void {
    if (newValue < 0 || newValue > 1) {
      this.showErrorSnackBar('Edge probability must be between 0 and 1');
      return;
    }

    edgeParam.currentValue = newValue;
    edgeParam.isModified = newValue !== edgeParam.originalValue;

    // Update data service
    this.dataService.setIndividualEdgeProbability(edgeParam.fromNode, edgeParam.toNode, newValue);
    
    // Enable individual overrides if not already enabled
    if (!this.currentOverrides.useIndividualOverrides) {
      this.globalParametersForm.patchValue({ useIndividualOverrides: true });
    }

    this.showInfoSnackBar(`Edge ${edgeParam.fromNode}→${edgeParam.toNode} probability updated to ${newValue.toFixed(3)}`);
  }

  // Bulk operations
  resetNodeParameter(nodeParam: NodeParameterEdit): void {
    this.onNodeParameterChange(nodeParam, nodeParam.originalValue);
  }

  resetEdgeParameter(edgeParam: EdgeParameterEdit): void {
    this.onEdgeParameterChange(edgeParam, edgeParam.originalValue);
  }

  resetAllNodeParameters(): void {
    let resetCount = 0;
    this.nodeParameters.forEach(nodeParam => {
      if (nodeParam.isModified) {
        this.onNodeParameterChange(nodeParam, nodeParam.originalValue);
        resetCount++;
      }
    });
    
    if (resetCount > 0) {
      this.showInfoSnackBar(`Reset ${resetCount} node parameters to original values`);
    }
  }

  resetAllEdgeParameters(): void {
    let resetCount = 0;
    this.edgeParameters.forEach(edgeParam => {
      if (edgeParam.isModified) {
        this.onEdgeParameterChange(edgeParam, edgeParam.originalValue);
        resetCount++;
      }
    });
    
    if (resetCount > 0) {
      this.showInfoSnackBar(`Reset ${resetCount} edge parameters to original values`);
    }
  }

  resetAllParameters(): void {
    // Clear individual overrides by updating parameter overrides
    this.dataService.updateParameterOverrides({
      useGlobalNodePrior: false,
      globalNodePrior: 1.0,
      useGlobalEdgeProb: false,
      globalEdgeProb: 0.9,
      useIndividualOverrides: false,
      individualNodePriors: {},
      individualEdgeProbabilities: {}
    });
    
    this.globalParametersForm.reset({
      useGlobalNodePrior: false,
      globalNodePrior: 1.0,
      useGlobalEdgeProb: false,
      globalEdgeProb: 0.9,
      useIndividualOverrides: false
    });
    
    this.initializeParameterTables();
    this.showInfoSnackBar('All parameters reset to original values');
  }

  // Bulk editing operations
  setAllNodePriors(value: number): void {
    if (value < 0 || value > 1) {
      this.showErrorSnackBar('Node prior must be between 0 and 1');
      return;
    }

    let updateCount = 0;
    this.nodeParameters.forEach(nodeParam => {
      this.onNodeParameterChange(nodeParam, value);
      updateCount++;
    });
    
    this.showInfoSnackBar(`Set ${updateCount} node priors to ${value.toFixed(3)}`);
  }

  setAllEdgeProbabilities(value: number): void {
    if (value < 0 || value > 1) {
      this.showErrorSnackBar('Edge probability must be between 0 and 1');
      return;
    }

    let updateCount = 0;
    this.edgeParameters.forEach(edgeParam => {
      this.onEdgeParameterChange(edgeParam, value);
      updateCount++;
    });
    
    this.showInfoSnackBar(`Set ${updateCount} edge probabilities to ${value.toFixed(3)}`);
  }

  // Search and filtering
  getFilteredNodeParameters(): NodeParameterEdit[] {
    if (!this.nodeSearchTerm) return this.nodeParameters;
    
    return this.nodeParameters.filter(param =>
      param.nodeId.toLowerCase().includes(this.nodeSearchTerm.toLowerCase())
    );
  }

  getFilteredEdgeParameters(): EdgeParameterEdit[] {
    if (!this.edgeSearchTerm) return this.edgeParameters;
    
    return this.edgeParameters.filter(param =>
      param.edgeKey.toLowerCase().includes(this.edgeSearchTerm.toLowerCase()) ||
      param.fromNode.toString().includes(this.edgeSearchTerm) ||
      param.toNode.toString().includes(this.edgeSearchTerm)
    );
  }

  // Import/Export functionality
  exportParameters(): void {
    const exportData = {
      timestamp: new Date().toISOString(),
      fileName: 'parameter-overrides',
      globalParameters: {
        useGlobalNodePrior: this.currentOverrides.useGlobalNodePrior,
        globalNodePrior: this.currentOverrides.globalNodePrior,
        useGlobalEdgeProb: this.currentOverrides.useGlobalEdgeProb,
        globalEdgeProb: this.currentOverrides.globalEdgeProb
      },
      individualParameters: {
        nodeCount: Object.keys(this.currentOverrides.individualNodePriors).length,
        edgeCount: Object.keys(this.currentOverrides.individualEdgeProbabilities).length,
        nodePriors: this.currentOverrides.individualNodePriors,
        edgeProbabilities: this.currentOverrides.individualEdgeProbabilities
      },
      originalData: this.originalData
    };

    this.downloadJSON(exportData, `parameter-overrides-${Date.now()}.json`);
    this.showInfoSnackBar('Parameters exported successfully');
  }

  async importParameters(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    try {
      const content = await this.readFileAsText(file);
      const importData = JSON.parse(content);

      // Validate import data structure
      if (!this.validateImportData(importData)) {
        this.showErrorSnackBar('Invalid parameter file format');
        return;
      }

      // Apply global parameters
      if (importData.globalParameters) {
        this.globalParametersForm.patchValue(importData.globalParameters);
      }

      // Apply individual parameters
      if (importData.individualParameters) {
        const { nodePriors, edgeProbabilities } = importData.individualParameters;
        
        // Update node priors
        for (const [nodeId, value] of Object.entries(nodePriors || {})) {
          this.dataService.setIndividualNodePrior(nodeId, value as number);
        }
        
        // Update edge probabilities
        for (const [edgeKey, value] of Object.entries(edgeProbabilities || {})) {
          const [fromStr, toStr] = edgeKey.replace(/[()]/g, '').split(',');
          const fromNode = parseInt(fromStr.trim());
          const toNode = parseInt(toStr.trim());
          this.dataService.setIndividualEdgeProbability(fromNode, toNode, value as number);
        }
      }

      this.initializeParameterTables();
      this.showSuccessSnackBar('Parameters imported successfully');
      
    } catch (error) {
      this.showErrorSnackBar('Failed to import parameters: Invalid file format');
    }
    
    // Reset file input
    input.value = '';
  }

  private validateImportData(data: any): boolean {
    return data && 
           typeof data === 'object' &&
           (data.globalParameters || data.individualParameters);
  }

  // Parameter validation
  private validateParameters(overrides: ParameterOverrides): void {
    const validation: ParameterValidation = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Validate global parameters
    if (overrides.useGlobalNodePrior) {
      if (overrides.globalNodePrior < 0 || overrides.globalNodePrior > 1) {
        validation.errors.push('Global node prior must be between 0 and 1');
        validation.isValid = false;
      }
    }

    if (overrides.useGlobalEdgeProb) {
      if (overrides.globalEdgeProb < 0 || overrides.globalEdgeProb > 1) {
        validation.errors.push('Global edge probability must be between 0 and 1');
        validation.isValid = false;
      }
    }

    // Validate individual parameters
    for (const [nodeId, value] of Object.entries(overrides.individualNodePriors)) {
      if (value < 0 || value > 1) {
        validation.errors.push(`Node ${nodeId} prior (${value}) must be between 0 and 1`);
        validation.isValid = false;
      }
    }

    for (const [edgeKey, value] of Object.entries(overrides.individualEdgeProbabilities)) {
      if (value < 0 || value > 1) {
        validation.errors.push(`Edge ${edgeKey} probability (${value}) must be between 0 and 1`);
        validation.isValid = false;
      }
    }

    // Check for conflicts
    if (overrides.useGlobalNodePrior && overrides.useIndividualOverrides) {
      const nodeOverrideCount = Object.keys(overrides.individualNodePriors).length;
      if (nodeOverrideCount > 0) {
        validation.warnings.push(`Global node prior will override ${nodeOverrideCount} individual node settings`);
      }
    }

    if (overrides.useGlobalEdgeProb && overrides.useIndividualOverrides) {
      const edgeOverrideCount = Object.keys(overrides.individualEdgeProbabilities).length;
      if (edgeOverrideCount > 0) {
        validation.warnings.push(`Global edge probability will override ${edgeOverrideCount} individual edge settings`);
      }
    }

    this.parameterValidation = validation;
  }

  // Utility methods
  getModifiedParametersCount(): number {
    const nodeCount = this.nodeParameters.filter(p => p.isModified).length;
    const edgeCount = this.edgeParameters.filter(p => p.isModified).length;
    return nodeCount + edgeCount;
  }

  hasGlobalOverrides(): boolean {
    return this.currentOverrides.useGlobalNodePrior || this.currentOverrides.useGlobalEdgeProb;
  }

  hasIndividualOverrides(): boolean {
    return Object.keys(this.currentOverrides.individualNodePriors).length > 0 ||
           Object.keys(this.currentOverrides.individualEdgeProbabilities).length > 0;
  }

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  private downloadJSON(data: any, filename: string): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  // Snackbar notifications
  private showSuccessSnackBar(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['success-snackbar']
    });
  }

  private showErrorSnackBar(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: ['error-snackbar']
    });
  }

  private showInfoSnackBar(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 2000,
      panelClass: ['info-snackbar']
    });
  }
}