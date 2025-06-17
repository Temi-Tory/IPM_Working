import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule } from '@angular/material/tabs';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { DataService, AnalysisProgress } from '../../services/data.service';
import { FilePreviewComponent } from '../file-preview/file-preview.component';
import { ParameterControlComponent } from '../parameter-control/parameter-control.component';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FormsModule } from '@angular/forms';


export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fileInfo: {
    size: number;
    rows: number;
    columns: number;
    encoding: string;
  };
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatDividerModule,
    MatTabsModule,
    MatExpansionModule,
    MatSnackBarModule,
    ParameterControlComponent,
    FilePreviewComponent,
      MatSlideToggleModule,
    FormsModule,
  ],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Injected services
  private dataService = inject(DataService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  // Component state
  currentFile: File | null = null;
  isLoading = false;
  error: string | null = null;
  analysisProgress: AnalysisProgress = {
    tier1Complete: false,
    tier2Complete: false,
    tier3Complete: false,
    currentTier: 0
  };
  
  // File upload state
  isDragOver = false;
  fileValidation: FileValidationResult | null = null;
  fileContent = '';
  showAdvancedOptions = false;
  
  // File processing options
  processingOptions = {
    autoStartStructureAnalysis: true,
    validateDataTypes: true,
    createBackup: true,
    compressionEnabled: true
  };

  // Sample files configuration
  sampleFiles = [
    {
      type: 'small',
      name: 'Small Network',
      description: 'Simple 16-node network for testing basic functionality',
      nodes: 16,
      complexity: 'Low',
      icon: 'scatter_plot'
    },
    {
      type: 'medium',
      name: 'Power Grid Network',
      description: 'Pacific Gas & Electric power distribution network',
      nodes: 50,
      complexity: 'Medium',
      icon: 'electrical_services'
    },
    {
      type: 'large',
      name: 'Transportation Network',
      description: 'Metro system with complex diamond structures',
      nodes: 100,
      complexity: 'High',
      icon: 'train'
    },
    {
      type: 'complex',
      name: 'Bayesian Network',
      description: 'Munin probabilistic network with dependencies',
      nodes: 189,
      complexity: 'Very High',
      icon: 'psychology'
    }
  ];

  // Validation configuration
  validationConfig = {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    supportedExtensions: ['.csv', '.tsv', '.txt'],
    maxRows: 10000,
    maxColumns: 1000,
    requiredColumns: 2
  };

  ngOnInit(): void {
    // Subscribe to data service observables
    this.dataService.currentFile$
      .pipe(takeUntil(this.destroy$))
      .subscribe(file => {
        this.currentFile = file;
        if (file && !this.fileValidation) {
          this.performFileValidation(file);
        }
      });

    this.dataService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        this.isLoading = loading;
      });

    this.dataService.error$
      .pipe(takeUntil(this.destroy$))
      .subscribe(error => {
        this.error = error;
        if (error) {
          this.showErrorSnackBar(error);
        }
      });

    this.dataService.analysisProgress$
      .pipe(takeUntil(this.destroy$))
      .subscribe(progress => {
        this.analysisProgress = progress;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Enhanced file upload handlers
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFileUpload(input.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.handleFileUpload(event.dataTransfer.files[0]);
    }
  }

  private async handleFileUpload(file: File): Promise<void> {
    try {
      this.dataService.setLoading(true);
      this.dataService.clearError();
      
      // Perform comprehensive file validation
      const validation = await this.performFileValidation(file);
      this.fileValidation = validation;
      
      if (!validation.isValid) {
        const errorMessage = `File validation failed: ${validation.errors.join(', ')}`;
        this.dataService.setError(errorMessage);
        return;
      }
      
      // Show warnings if any
      if (validation.warnings.length > 0) {
        this.showWarningSnackBar(`Warnings: ${validation.warnings.join(', ')}`);
      }
      
      // Store file and read content
      this.dataService.setCurrentFile(file);
      this.fileContent = await this.readFileAsText(file);
      
      // Auto-start structure analysis if enabled
      if (this.processingOptions.autoStartStructureAnalysis) {
        await this.processFile(file);
      }
      
      this.showSuccessSnackBar(`File "${file.name}" loaded successfully!`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process file';
      this.dataService.setError(errorMessage);
    } finally {
      this.dataService.setLoading(false);
    }
  }

  private async performFileValidation(file: File): Promise<FileValidationResult> {
    const result: FileValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      fileInfo: {
        size: file.size,
        rows: 0,
        columns: 0,
        encoding: 'UTF-8'
      }
    };

    // File extension validation
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!this.validationConfig.supportedExtensions.includes(extension)) {
      result.errors.push(`Unsupported file type. Supported: ${this.validationConfig.supportedExtensions.join(', ')}`);
      result.isValid = false;
    }

    // File size validation
    if (file.size === 0) {
      result.errors.push('File is empty');
      result.isValid = false;
    } else if (file.size > this.validationConfig.maxFileSize) {
      result.errors.push(`File too large. Maximum size: ${this.formatFileSize(this.validationConfig.maxFileSize)}`);
      result.isValid = false;
    }

    // Content validation (if file passes basic checks)
    if (result.isValid) {
      try {
        const content = await this.readFileAsText(file);
        const lines = content.split('\n').filter(line => line.trim().length > 0);
        result.fileInfo.rows = lines.length;
        
        if (lines.length === 0) {
          result.errors.push('File contains no data rows');
          result.isValid = false;
        } else {
          // Check first row for column count
          const firstRow = lines[0].split(',');
          result.fileInfo.columns = firstRow.length;
          
          if (result.fileInfo.columns < this.validationConfig.requiredColumns) {
            result.errors.push(`Insufficient columns. Required: ${this.validationConfig.requiredColumns}, Found: ${result.fileInfo.columns}`);
            result.isValid = false;
          }
          
          // Check for too many rows/columns
          if (result.fileInfo.rows > this.validationConfig.maxRows) {
            result.warnings.push(`Large file (${result.fileInfo.rows} rows). Processing may be slow.`);
          }
          
          if (result.fileInfo.columns > this.validationConfig.maxColumns) {
            result.warnings.push(`Many columns (${result.fileInfo.columns}). Consider data preprocessing.`);
          }
          
          // Validate data format - check for proper numeric values
          const sampleRows = lines.slice(0, Math.min(5, lines.length));
          for (let i = 0; i < sampleRows.length; i++) {
            const cells = sampleRows[i].split(',');
            const nonNumericCells = cells.filter((cell, index) => {
              const trimmed = cell.trim();
              return trimmed !== '' && isNaN(Number(trimmed));
            });
            
            if (nonNumericCells.length > 0) {
              result.warnings.push(`Row ${i + 1} contains non-numeric values. Ensure proper CSV format.`);
            }
          }
        }
      } catch (contentError) {
        result.errors.push('Failed to read file content. Check file encoding.');
        result.isValid = false;
      }
    }

    return result;
  }

  private async processFile(file: File): Promise<void> {
    try {
      this.dataService.setLoading(true);
      
      // Read file content
      const csvContent = await this.readFileAsText(file);
      
      // Create processing payload
      const payload = {
        csvContent,
        processingOptions: this.processingOptions,
        timestamp: Date.now()
      };
      
      // Call structure analysis API (Tier 1)
      const response = await fetch('http://localhost:8080/api/parse-structure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to process file');
      }

      // Store analysis results
      this.dataService.setNetworkData(result.networkData);
      this.dataService.setOriginalData(result.originalData);
      
      // Create file session backup if enabled
      if (this.processingOptions.createBackup) {
        this.createFileSession(file, result);
      }
      
      this.showSuccessSnackBar('Structure analysis completed!');

      // Auto-navigate to structure tab
      setTimeout(() => {
        this.router.navigate(['/structure']);
      }, 1500);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process file';
      this.dataService.setError(errorMessage);
    } finally {
      this.dataService.setLoading(false);
    }
  }

  private createFileSession(file: File, analysisResult: any): void {
    try {
      const sessionData = {
        fileName: file.name,
        fileSize: file.size,
        uploadTime: new Date().toISOString(),
        fileHash: this.generateFileHash(file.name, file.size, file.lastModified),
        analysisResult: {
          tier1: analysisResult,
          processingOptions: this.processingOptions
        }
      };
      
      localStorage.setItem(`ipa-session-${sessionData.fileHash}`, JSON.stringify(sessionData));
      this.showInfoSnackBar('File session saved for quick reload');
    } catch (error) {
      console.warn('Failed to create file session:', error);
    }
  }

  private generateFileHash(name: string, size: number, modified: number): string {
    return btoa(`${name}-${size}-${modified}`).replace(/[/+=]/g, '');
  }

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  // File management actions
  clearFile(): void {
    this.dataService.clearAllData();
    this.fileValidation = null;
    this.fileContent = '';
    this.error = null;
    
    // Reset file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
    
    this.showInfoSnackBar('File cleared. Ready for new upload.');
  }

  reprocessFile(): void {
    if (this.currentFile) {
      this.processFile(this.currentFile);
    }
  }

  exportFileValidation(): void {
    if (this.fileValidation) {
      const exportData = {
        fileName: this.currentFile?.name,
        timestamp: new Date().toISOString(),
        validation: this.fileValidation,
        processingOptions: this.processingOptions
      };
      
      this.downloadJSON(exportData, `validation-report-${Date.now()}.json`);
    }
  }

  // Sample file management
  downloadSampleFile(sampleType: string): void {
    const samples = {
      small: this.generateSampleCSV(16, 'Small Network'),
      medium: this.generateSampleCSV(50, 'Medium Network'),
      large: this.generateSampleCSV(100, 'Large Network'),
      complex: this.generateSampleCSV(189, 'Complex Bayesian Network')
    };
    
    const csvContent = samples[sampleType as keyof typeof samples];
    this.downloadCSV(csvContent, `sample-${sampleType}-network.csv`);
    this.showInfoSnackBar(`Downloaded ${sampleType} network sample`);
  }

  previewSample(sampleType: string): void {
    const sampleData = this.generateSampleCSV(16, `${sampleType} Preview`);
    const lines = sampleData.split('\n').slice(1, 6); // Skip header, show first 5 rows
    
    let preview = `Sample ${sampleType} network format:\n\n`;
    preview += 'Row 1: 0.8,0.0,0.3,0.0,0.2,0.0...\n';
    preview += 'Row 2: 0.9,0.0,0.0,0.7,0.0,0.1...\n';
    preview += 'Row 3: 0.1,0.5,0.0,0.2,0.0,0.0...\n';
    preview += '\nFirst column: Node priors\nOther columns: Edge probabilities';
    
    // Show in a simple alert for now - in a real app you'd use a dialog
    alert(preview);
  }

  // Parameter change handling
  onParametersChanged(parameters: any): void {
    console.log('Parameters changed:', parameters);
    // This will trigger re-analysis when parameters are modified
    // The actual implementation will be handled by the data service
  }

  private generateSampleCSV(nodeCount: number, description: string): string {
    const header = `# ${description} (${nodeCount} nodes)\n`;
    let csv = header;
    
    // Generate adjacency matrix with random probabilities
    for (let i = 1; i <= nodeCount; i++) {
      const row = [Math.random().toFixed(3)]; // Node prior
      
      for (let j = 1; j <= nodeCount; j++) {
        if (i === j) {
          row.push('0'); // No self-loops
        } else {
          // Random edge with 20% probability, varying by node type
          const edgeProb = this.generateEdgeProbability(i, j, nodeCount);
          row.push(edgeProb);
        }
      }
      
      csv += row.join(',') + '\n';
    }
    
    return csv;
  }

  private generateEdgeProbability(from: number, to: number, totalNodes: number): string {
    // Create more realistic network structures
    const distance = Math.abs(from - to);
    const maxDistance = Math.floor(totalNodes / 4);
    
    // Higher probability for nearby nodes
    if (distance <= 2) {
      return Math.random() < 0.4 ? (0.3 + Math.random() * 0.6).toFixed(3) : '0';
    } else if (distance <= maxDistance) {
      return Math.random() < 0.2 ? (0.1 + Math.random() * 0.4).toFixed(3) : '0';
    } else {
      return Math.random() < 0.05 ? (0.1 + Math.random() * 0.2).toFixed(3) : '0';
    }
  }

  // Utility methods
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private downloadCSV(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
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

  private showWarningSnackBar(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 4000,
      panelClass: ['warning-snackbar']
    });
  }

  private showInfoSnackBar(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 2000,
      panelClass: ['info-snackbar']
    });
  }

  // Navigation helpers
  navigateToStructure(): void {
    if (this.analysisProgress.tier1Complete) {
      this.router.navigate(['/structure']);
    }
  }

  navigateToVisualization(): void {
    if (this.analysisProgress.tier1Complete) {
      this.router.navigate(['/visualization']);
    }
  }

  // Analysis progress helpers
  getTierStatus(tier: number): 'complete' | 'current' | 'pending' {
    switch (tier) {
      case 1:
        return this.analysisProgress.tier1Complete ? 'complete' : 
               this.analysisProgress.currentTier === 1 ? 'current' : 'pending';
      case 2:
        return this.analysisProgress.tier2Complete ? 'complete' : 
               this.analysisProgress.currentTier === 2 ? 'current' : 'pending';
      case 3:
        return this.analysisProgress.tier3Complete ? 'complete' : 
               this.analysisProgress.currentTier === 3 ? 'current' : 'pending';
      default:
        return 'pending';
    }
  }

  getProgressPercentage(): number {
    let completed = 0;
    if (this.analysisProgress.tier1Complete) completed += 33;
    if (this.analysisProgress.tier2Complete) completed += 33;
    if (this.analysisProgress.tier3Complete) completed += 34;
    return completed;
  }
}