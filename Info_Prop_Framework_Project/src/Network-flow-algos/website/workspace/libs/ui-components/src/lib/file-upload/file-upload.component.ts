import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';

export interface FileUploadEvent {
  file: File;
  fileType: 'dag' | 'nodeProbabilities' | 'edgeProbabilities';
}

@Component({
  selector: 'lib-file-upload',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatChipsModule
  ],
  template: `
    <mat-card class="file-upload-card" 
              [class.drag-over]="isDragOver()"
              [class.has-file]="uploadedFile()"
              (dragover)="onDragOver($event)"
              (dragleave)="onDragLeave($event)"
              (drop)="onDrop($event)">
      
      <mat-card-header>
        <mat-card-title>
          <mat-icon>{{ getFileTypeIcon() }}</mat-icon>
          {{ getFileTypeLabel() }}
        </mat-card-title>
        <mat-card-subtitle>{{ getFileTypeDescription() }}</mat-card-subtitle>
      </mat-card-header>

      <mat-card-content>
        @if (!uploadedFile()) {
          <!-- Upload Area -->
          <div class="upload-area"
               (click)="triggerFileInput()"
               (keydown.enter)="triggerFileInput()"
               (keydown.space)="triggerFileInput()"
               tabindex="0"
               role="button"
               [attr.aria-label]="'Upload ' + getFileTypeLabel().toLowerCase() + ' file'">
            <mat-icon class="upload-icon">cloud_upload</mat-icon>
            <p class="upload-text">
              Drop {{ getFileTypeLabel().toLowerCase() }} file here or click to browse
            </p>
            <p class="upload-hint">
              Supported formats: {{ acceptedTypes.join(', ') }}
            </p>
          </div>
        } @else {
          <!-- File Info -->
          <div class="file-info">
            <div class="file-details">
              <mat-icon class="file-icon">description</mat-icon>
              <div class="file-meta">
                <span class="file-name">{{ uploadedFile()!.name }}</span>
                <span class="file-size">{{ formatFileSize(uploadedFile()!.size) }}</span>
              </div>
            </div>
            
            @if (isValidFile()) {
              <mat-chip color="accent" selected>
                <mat-icon>check_circle</mat-icon>
                Valid
              </mat-chip>
            } @else {
              <mat-chip color="warn" selected>
                <mat-icon>error</mat-icon>
                Invalid
              </mat-chip>
            }
          </div>

          <!-- Validation Messages -->
          @if (validationErrors().length > 0) {
            <div class="validation-messages error">
              <h4>Errors:</h4>
              <ul>
                @for (error of validationErrors(); track error) {
                  <li>{{ error }}</li>
                }
              </ul>
            </div>
          }

          @if (validationWarnings().length > 0) {
            <div class="validation-messages warning">
              <h4>Warnings:</h4>
              <ul>
                @for (warning of validationWarnings(); track warning) {
                  <li>{{ warning }}</li>
                }
              </ul>
            </div>
          }
        }

        <!-- Progress Bar -->
        @if (isUploading()) {
          <mat-progress-bar mode="indeterminate" class="upload-progress"></mat-progress-bar>
        }
      </mat-card-content>

      <mat-card-actions>
        @if (!uploadedFile()) {
          <button mat-raised-button color="primary" (click)="triggerFileInput()" [disabled]="isUploading()">
            <mat-icon>folder_open</mat-icon>
            Choose File
          </button>
        } @else {
          <button mat-button (click)="clearFile()">
            <mat-icon>clear</mat-icon>
            Remove
          </button>
          <button mat-raised-button color="primary" (click)="triggerFileInput()">
            <mat-icon>swap_horiz</mat-icon>
            Replace
          </button>
        }
      </mat-card-actions>

      <!-- Hidden File Input -->
      <input #fileInput
             type="file"
             [accept]="acceptedTypes.join(',')"
             (change)="onFileSelected($event)"
             style="display: none;">
    </mat-card>
  `,
  styles: [`
    .file-upload-card {
      margin: 16px 0;
      transition: all 0.3s ease;
      border: 2px dashed transparent;
      
      &.drag-over {
        border-color: var(--mdc-theme-primary);
        background-color: rgba(var(--mdc-theme-primary-rgb), 0.05);
        transform: scale(1.02);
      }
      
      &.has-file {
        border-color: var(--mdc-theme-accent);
      }
    }

    .upload-area {
      text-align: center;
      padding: 40px 20px;
      cursor: pointer;
      border-radius: 8px;
      transition: background-color 0.3s ease;
      
      &:hover {
        background-color: rgba(0, 0, 0, 0.04);
      }
    }

    .upload-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: var(--mdc-theme-primary);
      margin-bottom: 16px;
    }

    .upload-text {
      font-size: 16px;
      font-weight: 500;
      margin: 0 0 8px 0;
      color: var(--mdc-theme-on-surface);
    }

    .upload-hint {
      font-size: 14px;
      color: var(--mdc-theme-on-surface-variant);
      margin: 0;
    }

    .file-info {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      background-color: rgba(0, 0, 0, 0.02);
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .file-details {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .file-icon {
      color: var(--mdc-theme-primary);
    }

    .file-meta {
      display: flex;
      flex-direction: column;
    }

    .file-name {
      font-weight: 500;
      color: var(--mdc-theme-on-surface);
    }

    .file-size {
      font-size: 12px;
      color: var(--mdc-theme-on-surface-variant);
    }

    .validation-messages {
      margin: 16px 0;
      padding: 12px;
      border-radius: 4px;
      
      &.error {
        background-color: rgba(244, 67, 54, 0.1);
        border-left: 4px solid #f44336;
      }
      
      &.warning {
        background-color: rgba(255, 152, 0, 0.1);
        border-left: 4px solid #ff9800;
      }
      
      h4 {
        margin: 0 0 8px 0;
        font-size: 14px;
        font-weight: 500;
      }
      
      ul {
        margin: 0;
        padding-left: 20px;
        
        li {
          font-size: 13px;
          margin-bottom: 4px;
        }
      }
    }

    .upload-progress {
      margin-top: 16px;
    }

    mat-card-actions {
      display: flex;
      gap: 8px;
    }
  `]
})
export class FileUploadComponent {
  @Input() fileType: 'dag' | 'nodeProbabilities' | 'edgeProbabilities' = 'dag';
  @Input() acceptedTypes: string[] = ['.csv', '.txt', '.json'];
  @Input() maxFileSize: number = 50 * 1024 * 1024; // 50MB
  @Input() disabled = false;

  @Output() fileSelected = new EventEmitter<FileUploadEvent>();
  @Output() fileCleared = new EventEmitter<void>();

  // Component state
  private _uploadedFile = signal<File | null>(null);
  private _isDragOver = signal(false);
  private _isUploading = signal(false);
  private _validationErrors = signal<string[]>([]);
  private _validationWarnings = signal<string[]>([]);

  // Public readonly signals
  readonly uploadedFile = this._uploadedFile.asReadonly();
  readonly isDragOver = this._isDragOver.asReadonly();
  readonly isUploading = this._isUploading.asReadonly();
  readonly validationErrors = this._validationErrors.asReadonly();
  readonly validationWarnings = this._validationWarnings.asReadonly();

  // Computed signals
  readonly isValidFile = computed(() => 
    this._uploadedFile() !== null && this._validationErrors().length === 0
  );

  // File type configurations
  private fileTypeConfig = {
    dag: {
      icon: 'account_tree',
      label: 'DAG File',
      description: 'Network structure file (CSV format with source,target columns)'
    },
    nodeProbabilities: {
      icon: 'scatter_plot',
      label: 'Node Probabilities',
      description: 'Node probability values (CSV or JSON format)'
    },
    edgeProbabilities: {
      icon: 'timeline',
      label: 'Edge Probabilities', 
      description: 'Edge probability values (CSV or JSON format)'
    }
  };

  getFileTypeIcon(): string {
    return this.fileTypeConfig[this.fileType].icon;
  }

  getFileTypeLabel(): string {
    return this.fileTypeConfig[this.fileType].label;
  }

  getFileTypeDescription(): string {
    return this.fileTypeConfig[this.fileType].description;
  }

  // Drag and drop handlers
  onDragOver(event: DragEvent): void {
    if (this.disabled) return;
    
    event.preventDefault();
    event.stopPropagation();
    this._isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    if (this.disabled) return;
    
    event.preventDefault();
    event.stopPropagation();
    this._isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    if (this.disabled) return;
    
    event.preventDefault();
    event.stopPropagation();
    this._isDragOver.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  // File input handlers
  triggerFileInput(): void {
    if (this.disabled) return;
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fileInput?.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  // File processing
  private handleFile(file: File): void {
    this._isUploading.set(true);
    this._validationErrors.set([]);
    this._validationWarnings.set([]);

    // Validate file
    const validation = this.validateFile(file);
    
    this._validationErrors.set(validation.errors);
    this._validationWarnings.set(validation.warnings);
    
    if (validation.isValid) {
      this._uploadedFile.set(file);
      this.fileSelected.emit({ file, fileType: this.fileType });
    }

    this._isUploading.set(false);
  }

  private validateFile(file: File): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!file) {
      errors.push('No file provided');
      return { isValid: false, errors, warnings };
    }

    // File size validation
    if (file.size > this.maxFileSize) {
      errors.push(`File size (${this.formatFileSize(file.size)}) exceeds maximum allowed size (${this.formatFileSize(this.maxFileSize)})`);
    }

    if (file.size === 0) {
      errors.push('File is empty');
    }

    // File extension validation
    const extension = this.getFileExtension(file.name);
    if (!this.acceptedTypes.includes(extension)) {
      errors.push(`Unsupported file extension: ${extension}. Supported: ${this.acceptedTypes.join(', ')}`);
    }

    // File type specific validation
    switch (this.fileType) {
      case 'dag':
        if (!file.name.toLowerCase().includes('dag') && !file.name.toLowerCase().includes('network')) {
          warnings.push('DAG file name should typically contain "dag" or "network"');
        }
        break;
      case 'nodeProbabilities':
        if (!file.name.toLowerCase().includes('node') && !file.name.toLowerCase().includes('prob')) {
          warnings.push('Node probabilities file name should typically contain "node" or "prob"');
        }
        break;
      case 'edgeProbabilities':
        if (!file.name.toLowerCase().includes('edge') && !file.name.toLowerCase().includes('prob')) {
          warnings.push('Edge probabilities file name should typically contain "edge" or "prob"');
        }
        break;
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  // Utility methods
  clearFile(): void {
    this._uploadedFile.set(null);
    this._validationErrors.set([]);
    this._validationWarnings.set([]);
    this.fileCleared.emit();
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private getFileExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    return lastDot === -1 ? '' : fileName.substring(lastDot).toLowerCase();
  }
}