import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { DataService, AnalysisProgress } from '../../services/data.service';

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
    MatDividerModule
  ],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Injected services
  private dataService = inject(DataService);
  private router = inject(Router);

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
  fileStatus = '';
  fileStatusClass = '';

  ngOnInit(): void {
    // Subscribe to data service observables
    this.dataService.currentFile$
      .pipe(takeUntil(this.destroy$))
      .subscribe(file => {
        this.currentFile = file;
        if (file) {
          this.processFile(file);
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
          this.setFileStatus(error, 'error');
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

  // File upload handlers
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFileUpload(input.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.handleFileUpload(event.dataTransfer.files[0]);
    }
  }

  private handleFileUpload(file: File): void {
    // Validate file
    if (!file.name.toLowerCase().endsWith('.csv')) {
      this.setFileStatus('Please select a CSV file', 'error');
      return;
    }

    if (file.size === 0) {
      this.setFileStatus('File is empty', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      this.setFileStatus('File is too large (max 10MB)', 'error');
      return;
    }

    // File is valid, store it
    this.dataService.setCurrentFile(file);
    this.setFileStatus(`File loaded: ${file.name} (${this.formatFileSize(file.size)})`, 'success');
  }

  private async processFile(file: File): Promise<void> {
    try {
      this.dataService.setLoading(true);
      this.dataService.clearError();

      // Read file content
      const csvContent = await this.readFileAsText(file);
      
      // Call structure analysis API (Tier 1)
      const response = await fetch('http://localhost:8080/api/parse-structure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ csvContent })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to process file');
      }

      // Store network data and original data
      this.dataService.setNetworkData(result.networkData);
      this.dataService.setOriginalData(result.originalData);
      
      // Show success message
      this.setFileStatus('File processed successfully! Ready for analysis.', 'success');

      // Auto-navigate to structure tab after successful upload
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

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  private setFileStatus(message: string, type: 'success' | 'error' | 'warning'): void {
    this.fileStatus = message;
    this.fileStatusClass = `file-${type}`;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  clearFile(): void {
    this.dataService.clearAllData();
    this.fileStatus = '';
    this.fileStatusClass = '';
    // Reset file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  // Navigation helpers for quick access
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