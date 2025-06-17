import { Component, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
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
}

interface LoadResult {
  success: boolean;
  message: string;
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
  }

  // Upload functionality - just validate and store file content
  async uploadFile(): Promise<void> {
    const file = this.selectedFile();
    if (!file) return;

    console.log('Starting upload for file:', file.name);
    this.isUploading.set(true);
    this.uploadResult.set(null);
    this.loadResult.set(null);

    try {
      // Read file content
      const csvContent = await this.readFileContent(file);
      console.log('File content read, length:', csvContent.length);
      
      // Validate CSV format
      const isValid = this.validateCsvFormat(csvContent);
      console.log('Validation result:', isValid);
      
      if (!isValid) {
        console.log('Validation failed');
        this.uploadResult.set({
          success: false,
          message: 'Invalid adjacency matrix format. Please ensure the file contains a square matrix with node priors in the first column and edge probabilities in the remaining columns.'
        });
        return;
      }

      // Store CSV content for later processing
      this.csvContent.set(csvContent);
      console.log('CSV content stored');
      
      const result = {
        success: true,
        message: `File "${file.name}" validated successfully! Click "Load into Framework" to proceed.`
      };
      
      this.uploadResult.set(result);
      console.log('Upload result set:', result);

      this.snackBar.open('File validated and ready to load!', 'Load Now', {
        duration: 4000
      }).onAction().subscribe(() => {
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
      console.log('Upload process completed');
    }
  }

  // Load graph into framework - separate step
  async loadGraphIntoFramework(): Promise<void> {
    const csvContent = this.csvContent();
    if (!csvContent) return;

    this.isLoadingGraph.set(true);
    this.loadResult.set(null);

    try {
      // Load graph using GraphStateService
      const result = await this.graphState.loadGraphFromCsv(csvContent, {
        message: 'Loading and analyzing graph structure...',
        showCancelButton: true
      });

      if (result.success) {
        this.loadResult.set({
          success: true,
          message: `Graph loaded into framework! Found ${this.graphState.nodeCount()} nodes and ${this.graphState.edgeCount()} edges.`
        });

        // Show success message with action
        this.snackBar.open('Graph loaded successfully!', 'Configure Parameters', {
          duration: 5000
        }).onAction().subscribe(() => {
          // Navigation will be handled by the template button
        });
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
    }
  }

  // Clear selected file and all state
  clearFile(): void {
    this.selectedFile.set(null);
    this.resetUploadState();
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
    
    this.snackBar.open('File cleared - ready for new upload', 'Close', {
      duration: 2000
    });
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

  private validateCsvFormat(content: string): boolean {
    console.log('Validating CSV content:', content.substring(0, 200) + '...');
    
    const lines = content.trim().split('\n');
    console.log('Number of lines:', lines.length);
    
    // Must have at least 1 row for a valid adjacency matrix
    if (lines.length < 1) {
      console.log('Validation failed: no lines');
      return false;
    }
    
    // Check first row to determine matrix dimensions
    const firstRow = lines[0].trim();
    const firstRowParts = firstRow.split(',');
    console.log('First row parts:', firstRowParts.length, firstRowParts);
    
    // Must have at least 2 columns (node prior + at least 1 adjacency column)
    if (firstRowParts.length < 2) {
      console.log('Validation failed: less than 2 columns');
      return false;
    }
    
    const matrixSize = firstRowParts.length;
    console.log('Matrix size (columns):', matrixSize);
    
    // Validate that all rows have the same number of columns
    for (let i = 0; i < lines.length; i++) {
      const rowParts = lines[i].trim().split(',');
      if (rowParts.length !== matrixSize) {
        console.log(`Validation failed: row ${i} has ${rowParts.length} columns, expected ${matrixSize}`);
        return false;
      }
      
      // Check if all values can be parsed as numbers
      for (const part of rowParts) {
        const value = parseFloat(part.trim());
        if (isNaN(value)) {
          console.log(`Validation failed: invalid number "${part}" in row ${i}`);
          return false;
        }
      }
    }
    
    // For adjacency matrix: number of rows should equal number of nodes
    // The matrix columns are: [node_prior, adj_1, adj_2, ..., adj_n]
    // So matrixSize = n + 1, and we should have n rows
    const expectedRows = matrixSize - 1;
    console.log(`Expected rows: ${expectedRows}, actual rows: ${lines.length}`);
    
    if (lines.length !== expectedRows) {
      console.log('Validation failed: row count mismatch');
      return false;
    }
    
    console.log('Validation passed!');
    return true;
  }

  // Sample data generation
  generateSampleData(): void {
    const sampleCsv = `1,0,0.9,0,0.9,0,0,0,0,0
1,0,0,0,0,0.9,0,0,0,0
1,0,0.9,0,0,0,0.9,0,0,0
1,0,0,0,0,0.9,0,0.9,0,0
1,0,0,0,0,0,0.9,0,0,0
1,0,0,0,0,0,0,0,0,0
1,0,0,0,0,0,0,0,0.9,0
1,0,0,0,0,0.9,0,0,0,0
1,0,0,0,0,0,0,0.9,0,0`;

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
}