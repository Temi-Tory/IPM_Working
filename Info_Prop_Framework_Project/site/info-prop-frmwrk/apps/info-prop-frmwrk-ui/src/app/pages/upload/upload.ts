import { Component, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { GraphStateService } from '../../services/graph-state.service';

interface UploadResult {
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

    this.selectedFile.set(file);
    this.uploadResult.set(null);
  }

  // Upload functionality
  async uploadFile(): Promise<void> {
    const file = this.selectedFile();
    if (!file) return;

    this.isUploading.set(true);
    this.uploadResult.set(null);

    try {
      // Read file content
      const csvContent = await this.readFileContent(file);
      
      // Validate CSV format
      if (!this.validateCsvFormat(csvContent)) {
        this.uploadResult.set({
          success: false,
          message: 'Invalid adjacency matrix format. Please ensure the file contains a square matrix with node priors in the first column and edge probabilities in the remaining columns.'
        });
        return;
      }

      // Load graph using GraphStateService
      const result = await this.graphState.loadGraphFromCsv(csvContent, {
        message: 'Loading and analyzing graph structure...',
        showCancelButton: true
      });

      if (result.success) {
        this.uploadResult.set({
          success: true,
          message: `Graph loaded successfully! Found ${this.graphState.nodeCount()} nodes and ${this.graphState.edgeCount()} edges.`
        });

        // Show success message with action
        this.snackBar.open('Graph loaded successfully!', 'Configure Parameters', {
          duration: 5000
        }).onAction().subscribe(() => {
          // Navigation will be handled by the template button
        });
      } else {
        this.uploadResult.set({
          success: false,
          message: result.error || 'Failed to load graph'
        });
      }

    } catch (error) {
      this.uploadResult.set({
        success: false,
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      });
    } finally {
      this.isUploading.set(false);
    }
  }

  // Clear selected file
  clearFile(): void {
    this.selectedFile.set(null);
    this.uploadResult.set(null);
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
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

  private validateCsvFormat(content: string): boolean {
    const lines = content.trim().split('\n');
    
    // Must have at least 2 rows for a valid adjacency matrix
    if (lines.length < 2) return false;
    
    // Check first row to determine matrix dimensions
    const firstRow = lines[0].trim();
    const firstRowParts = firstRow.split(',');
    
    // Must have at least 2 columns (node prior + at least 1 adjacency column)
    if (firstRowParts.length < 2) return false;
    
    const matrixSize = firstRowParts.length;
    
    // Validate that all rows have the same number of columns
    for (let i = 0; i < lines.length; i++) {
      const rowParts = lines[i].trim().split(',');
      if (rowParts.length !== matrixSize) {
        return false;
      }
      
      // Check if all values can be parsed as numbers
      for (const part of rowParts) {
        const value = parseFloat(part.trim());
        if (isNaN(value)) {
          return false;
        }
      }
    }
    
    // Matrix should be square (n rows for n-1 adjacency columns + 1 prior column)
    return lines.length === matrixSize - 1;
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