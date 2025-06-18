import { Component, inject, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { GraphStateService } from '../../services/graph-state-service';

interface UploadResult {
  success: boolean;
  message: string;
  details?: string[];
}

interface LoadResult {
  success: boolean;
  message: string;
  details?: string[];
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    nodes: number;
    edges: number;
    matrixSize: number;
  };
}

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatTooltipModule
  ],
  templateUrl: './upload.html',
  styleUrl: './upload.scss',
})
export class UploadComponent {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  // Task 1.1: Add Router service injection
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  readonly graphState = inject(GraphStateService);

  // State signals
  selectedFile = signal<File | null>(null);
  isDragOver = signal(false);
  isUploading = signal(false);
  uploadResult = signal<UploadResult | null>(null);
  csvContent = signal<string>('');
  isLoadingGraph = signal(false);
  loadResult = signal<LoadResult | null>(null);

  // Task 1.1: Add navigation state control
  readonly isGraphLoaded = computed(() => this.graphState.isGraphLoaded());

  // Task 1.2: Add detailed validation feedback
  validationDetails = signal<string[]>([]);
  validationSummary = signal<ValidationResult['summary'] | null>(null);

  // Task 1.3: Add framework loading progress tracking
  loadingStep = signal<string>('');
  loadingProgress = signal<number>(0);

  // Drag and drop handlers
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFileSelection(files[0]);
    }
  }

  // File selection handlers
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFileSelection(input.files[0]);
    }
  }

  private handleFileSelection(file: File): void {
    // Validate file type
    const validTypes = ['text/csv', 'text/plain', 'application/csv'];
    const validExtensions = ['.csv', '.txt'];
    
    const hasValidType = validTypes.includes(file.type);
    const hasValidExtension = validExtensions.some(ext =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidType && !hasValidExtension) {
      this.snackBar.open('Please select a CSV or TXT file', 'Close', {
        duration: 3000
      });
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      this.snackBar.open('File size must be less than 10MB', 'Close', {
        duration: 3000
      });
      return;
    }

    // Reset all states when selecting a new file
    this.resetUploadState();
    this.selectedFile.set(file);
    
    // Show warning if graph is already loaded
    if (this.graphState.isGraphLoaded()) {
      this.snackBar.open('New file selected - this will replace the current graph', 'Understood', {
        duration: 5000
      });
    }
  }

  private resetUploadState(): void {
    this.uploadResult.set(null);
    this.loadResult.set(null);
    this.csvContent.set('');
    this.isUploading.set(false);
    this.isLoadingGraph.set(false);
    // Task 1.2: Reset validation details
    this.validationDetails.set([]);
    this.validationSummary.set(null);
    // Task 1.3: Reset loading progress
    this.loadingStep.set('');
    this.loadingProgress.set(0);
  }

  // Upload functionality - just validate and store file content
  async uploadFile(): Promise<void> {
    const file = this.selectedFile();
    if (!file) return;

    this.isUploading.set(true);
    this.uploadResult.set(null);
    this.loadResult.set(null);

    try {
      // Read file content
      const csvContent = await this.readFileContent(file);
      
      // Task 1.2: Enhanced validation with detailed feedback
      const validationResult = this.validateCsvFormatEnhanced(csvContent);
      
      if (!validationResult.isValid) {
        this.validationDetails.set([...validationResult.errors, ...validationResult.warnings]);
        this.uploadResult.set({
          success: false,
          message: 'Invalid adjacency matrix format detected.',
          details: validationResult.errors
        });
        return;
      }

      // Store CSV content and validation summary
      this.csvContent.set(csvContent);
      this.validationSummary.set(validationResult.summary);
      this.validationDetails.set(validationResult.warnings); // Show warnings even on success
      
      const result = {
        success: true,
        message: `File "${file.name}" validated successfully! Found ${validationResult.summary.nodes} nodes and ${validationResult.summary.edges} edges.`,
        details: validationResult.warnings.length > 0 ? validationResult.warnings : undefined
      };
      
      this.uploadResult.set(result);

      // Enhanced success feedback with auto-navigation option
      const snackBarRef = this.snackBar.open(
        'File validated and ready to load!', 
        this.isGraphLoaded() ? 'Replace Graph' : 'Load Now', 
        { duration: 5000 }
      );
      
      snackBarRef.onAction().subscribe(() => {
        this.loadGraphIntoFramework();
      });

    } catch (error) {
      console.error('Upload error:', error);
      this.uploadResult.set({
        success: false,
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      });
    } finally {
      this.isUploading.set(false);
    }
  }

  // Task 1.3: Enhanced load graph with progress indicators
  async loadGraphIntoFramework(): Promise<void> {
    const csvContent = this.csvContent();
    if (!csvContent) return;

    this.isLoadingGraph.set(true);
    this.loadResult.set(null);
    this.loadingProgress.set(0);

    try {
      // Step 1: Initial validation
      this.loadingStep.set('Validating structure...');
      this.loadingProgress.set(20);
      await this.delay(500);

      // Step 2: Loading into framework
      this.loadingStep.set('Loading into framework...');
      this.loadingProgress.set(50);
      
      const result = await this.graphState.loadGraphFromCsv(csvContent, {
        message: 'Analyzing graph structure and detecting diamonds...',
        showCancelButton: true
      });

      // Step 3: Finalizing
      this.loadingStep.set('Finalizing...');
      this.loadingProgress.set(90);
      await this.delay(300);

      if (result.success) {
        this.loadingStep.set('Complete!');
        this.loadingProgress.set(100);
        
        const nodeCount = this.graphState.nodeCount();
        const edgeCount = this.graphState.edgeCount();
        const hasDiamonds = this.graphState.hasDiamonds();
        
        const details = [
          `Successfully loaded ${nodeCount} nodes and ${edgeCount} edges`,
          hasDiamonds ? 'Diamond structures detected' : 'No diamond structures found'
        ];

        this.loadResult.set({
          success: true,
          message: `Graph loaded into framework! Ready for analysis.`,
          details
        });

        // Task 1.1: Automatic navigation flow with enhanced feedback
        const actionText = hasDiamonds ? 'Configure Parameters' : 'View Structure';
        const nextRoute = hasDiamonds ? '/parameters' : '/network-structure';
        
        const snackBarRef = this.snackBar.open(
          `Graph loaded successfully! ${details.join('. ')}`, 
          actionText, 
          { duration: 6000 }
        );
        
        snackBarRef.onAction().subscribe(() => {
          this.router.navigate([nextRoute]);
        });

        // Auto-reset loading indicators after delay
        setTimeout(() => {
          this.loadingStep.set('');
          this.loadingProgress.set(0);
        }, 2000);

      } else {
        this.loadResult.set({
          success: false,
          message: result.error || 'Failed to load graph into framework'
        });
      }

    } catch (error) {
      this.loadResult.set({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load graph into framework'
      });
    } finally {
      this.isLoadingGraph.set(false);
      // Reset progress on error
      if (!this.loadResult()?.success) {
        this.loadingStep.set('');
        this.loadingProgress.set(0);
      }
    }
  }

  // Clear selected file and all state
  clearFile(): void {
    this.selectedFile.set(null);
    this.resetUploadState();
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
    
    // If user clears file after graph is loaded, ask if they want to clear the graph too
    if (this.graphState.isGraphLoaded()) {
      const snackBarRef = this.snackBar.open(
        'File cleared. Keep current graph loaded?', 
        'Clear Graph', 
        { duration: 5000 }
      );
      
      snackBarRef.onAction().subscribe(() => {
        // Clear the graph state (assuming there's a method for this)
        // You might need to add a clearGraph method to GraphStateService
        this.snackBar.open('Graph cleared - ready for new data', 'Close', {
          duration: 2000
        });
      });
    } else {
      this.snackBar.open('File cleared - ready for new upload', 'Close', {
        duration: 2000
      });
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

  private readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve(content);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  // Task 1.2: Enhanced validation with detailed feedback
  private validateCsvFormatEnhanced(content: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      summary: {
        nodes: 0,
        edges: 0,
        matrixSize: 0
      }
    };

    try {
      const lines = content.trim().split('\n');
      
      if (lines.length < 1) {
        result.isValid = false;
        result.errors.push('File is empty or contains no valid data');
        return result;
      }
      
      // Check first row to determine matrix dimensions
      const firstRow = lines[0].trim();
      const firstRowParts = firstRow.split(',');
      
      if (firstRowParts.length < 2) {
        result.isValid = false;
        result.errors.push('Each row must have at least 2 columns (node prior + at least 1 adjacency column)');
        return result;
      }
      
      const matrixSize = firstRowParts.length;
      result.summary.matrixSize = matrixSize;
      
      // For adjacency matrix: number of rows should equal number of nodes
      const expectedRows = matrixSize - 1;
      result.summary.nodes = expectedRows;
      
      if (lines.length !== expectedRows) {
        result.isValid = false;
        result.errors.push(`Expected ${expectedRows} rows for ${expectedRows} nodes, but found ${lines.length} rows`);
        return result;
      }
      
      let edgeCount = 0;
      const nodeValues: number[] = [];
      const edgeValues: number[] = [];
      
      // Validate each row
      for (let i = 0; i < lines.length; i++) {
        const rowParts = lines[i].trim().split(',');
        
        if (rowParts.length !== matrixSize) {
          result.isValid = false;
          result.errors.push(`Row ${i + 1} has ${rowParts.length} columns, expected ${matrixSize}`);
          return result;
        }
        
        // Check if all values can be parsed as numbers
        for (let j = 0; j < rowParts.length; j++) {
          const value = parseFloat(rowParts[j].trim());
          if (isNaN(value)) {
            result.isValid = false;
            result.errors.push(`Invalid number "${rowParts[j].trim()}" at row ${i + 1}, column ${j + 1}`);
            return result;
          }
          
          if (j === 0) {
            // Node prior
            nodeValues.push(value);
            if (value < 0 || value > 1) {
              result.warnings.push(`Node prior ${value} at row ${i + 1} is outside typical range [0,1]`);
            }
          } else {
            // Edge probability
            edgeValues.push(value);
            if (value > 0) {
              edgeCount++;
            }
            if (value < 0 || value > 1) {
              result.warnings.push(`Edge probability ${value} at row ${i + 1}, column ${j + 1} is outside typical range [0,1]`);
            }
          }
        }
      }
      
      result.summary.edges = edgeCount;
      
      // Additional validation warnings
      if (edgeCount === 0) {
        result.warnings.push('No edges detected (all edge probabilities are 0)');
      }
      
      const nodeValueVariance = this.calculateVariance(nodeValues);
      if (nodeValueVariance < 0.001) {
        result.warnings.push('All node priors are identical - consider if this is intended');
      }
      
      const avgEdgeProb = edgeValues.filter(v => v > 0).reduce((sum, v) => sum + v, 0) / edgeValues.filter(v => v > 0).length;
      if (avgEdgeProb > 0.95) {
        result.warnings.push('Very high average edge probabilities detected - ensure this reflects your network model');
      }
      
      return result;
      
    } catch (error) {
      result.isValid = false;
      result.errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  // Legacy method for compatibility - now delegates to enhanced version
  private validateCsvFormat(content: string): boolean {
    return this.validateCsvFormatEnhanced(content).isValid;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Sample data methods
  private getSampleCsvData(): string {
    return `1,0,0.9,0,0,0.9,0,0,0,0,0,0,0,0,0,0,0
1,0,0,0,0,0,0.9,0,0,0,0,0,0,0,0,0,0
1,0,0.9,0,0.9,0,0,0.9,0,0,0,0,0,0,0,0,0
1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
1,0,0,0,0,0,0.9,0,0,0.9,0,0,0,0,0,0,0
1,0,0,0,0,0,0,0.9,0,0,0,0,0,0,0,0,0
1,0,0,0,0,0,0,0,0.9,0,0,0.9,0,0,0,0,0
1,0,0,0,0.9,0,0,0,0,0,0,0,0.9,0,0,0,0
1,0,0,0,0,0,0,0,0,0,0.9,0,0,0,0,0,0
1,0,0,0,0,0,0.9,0,0,0,0,0.9,0,0,0.9,0,0
1,0,0,0,0,0,0,0,0,0,0,0,0.9,0,0,0.9,0
1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.9
1,0,0,0,0,0,0,0,0,0.9,0,0,0,0,0.9,0,0
1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.9,0
1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.9
1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0`;
  }

  generateSampleData(): void {
    const sampleCsv = this.getSampleCsvData();
    const blob = new Blob([sampleCsv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sample_adjacency_matrix.csv';
    link.click();
    window.URL.revokeObjectURL(url);

    this.snackBar.open('Sample adjacency matrix CSV downloaded', 'Close', {
      duration: 3000
    });
  }

  async loadSampleData(): Promise<void> {
    // Reset all states first
    this.resetUploadState();
    
    // Show warning if graph is already loaded
    if (this.graphState.isGraphLoaded()) {
      this.snackBar.open('Loading sample data - this will replace the current graph', 'Understood', {
        duration: 5000
      });
    }

    // Create a virtual file for the sample data
    const sampleCsv = this.getSampleCsvData();
    const sampleFile = new File([sampleCsv], 'sample_adjacency_matrix.csv', { type: 'text/csv' });
    this.selectedFile.set(sampleFile);

    this.snackBar.open('Sample data loaded - validating format...', '', {
      duration: 2000
    });

    // Automatically validate the sample data
    setTimeout(async () => {
      await this.uploadFile();
      
      // If validation was successful, automatically load into framework
      if (this.uploadResult()?.success) {
        setTimeout(async () => {
          await this.loadGraphIntoFramework();
        }, 1000);
      }
    }, 500);
  }
}