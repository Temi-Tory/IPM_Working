import { CommonModule } from '@angular/common';
import { Component, inject, signal, computed } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  GlobalStateService,
  NetworkAnalysisService,
  NetworkUploadRequest,
  ProbabilityType,
  FileValidationResult
} from '../../../../../../libs/network-core/src';

@Component({
  selector: 'app-network-upload',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './network-upload.component.html',
  styleUrl: './network-upload.component.scss'
})
export class NetworkUploadComponent {
  private readonly globalState = inject(GlobalStateService);
  private readonly networkService = inject(NetworkAnalysisService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  // Form and file state
  readonly uploadForm = this.fb.group({
    probabilityType: ['float' as ProbabilityType, Validators.required]
  });

  readonly selectedFiles = signal<{
    networkFile: File | null;
    nodePriorsFile: File | null;
    linkProbabilitiesFile: File | null;
  }>({
    networkFile: null,
    nodePriorsFile: null,
    linkProbabilitiesFile: null
  });

  readonly validationResults = signal<FileValidationResult | null>(null);
  readonly isValidating = signal(false);
  readonly dragStates = signal({
    network: false,
    nodepriors: false,
    linkprobs: false
  });

  // Computed properties
  readonly isUploading = this.globalState.isUploading;
  readonly uploadProgress = this.globalState.uploadProgress;
  readonly error = this.globalState.error;
  readonly hasNetworkFile = computed(() => this.selectedFiles().networkFile !== null);
  readonly canUpload = computed(() => {
    const files = this.selectedFiles();
    const form = this.uploadForm;
    return files.networkFile !== null && form.valid && !this.isUploading();
  });

  readonly probabilityTypes: { value: ProbabilityType; label: string; description: string }[] = [
    {
      value: 'float',
      label: 'Float',
      description: 'Standard floating-point probabilities (0.0 - 1.0)'
    },
    {
      value: 'interval',
      label: 'Interval',
      description: 'Interval-based probabilities with lower and upper bounds'
    },
    {
      value: 'pbox',
      label: 'P-Box',
      description: 'Probability box representation with bounds and weights'
    }
  ];

  // File upload methods
  onFileSelected(event: Event, fileType: 'network' | 'nodepriors' | 'linkprobs'): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.setFile(input.files[0], fileType);
    }
  }

  onFileDrop(event: DragEvent, fileType: 'network' | 'nodepriors' | 'linkprobs'): void {
    event.preventDefault();
    this.updateDragState(fileType, false);
    
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.setFile(event.dataTransfer.files[0], fileType);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDragEnter(event: DragEvent, fileType: 'network' | 'nodepriors' | 'linkprobs'): void {
    event.preventDefault();
    this.updateDragState(fileType, true);
  }

  onDragLeave(event: DragEvent, fileType: 'network' | 'nodepriors' | 'linkprobs'): void {
    event.preventDefault();
    this.updateDragState(fileType, false);
  }

  private setFile(file: File, fileType: 'network' | 'nodepriors' | 'linkprobs'): void {
    const currentFiles = this.selectedFiles();
    
    switch (fileType) {
      case 'network':
        this.selectedFiles.set({ ...currentFiles, networkFile: file });
        break;
      case 'nodepriors':
        this.selectedFiles.set({ ...currentFiles, nodePriorsFile: file });
        break;
      case 'linkprobs':
        this.selectedFiles.set({ ...currentFiles, linkProbabilitiesFile: file });
        break;
    }

    // Clear previous validation results when files change
    this.validationResults.set(null);
    this.globalState.clearError();
  }

  private updateDragState(fileType: 'network' | 'nodepriors' | 'linkprobs', isDragging: boolean): void {
    const current = this.dragStates();
    switch (fileType) {
      case 'network':
        this.dragStates.set({ ...current, network: isDragging });
        break;
      case 'nodepriors':
        this.dragStates.set({ ...current, nodepriors: isDragging });
        break;
      case 'linkprobs':
        this.dragStates.set({ ...current, linkprobs: isDragging });
        break;
    }
  }

  removeFile(fileType: 'network' | 'nodepriors' | 'linkprobs'): void {
    const currentFiles = this.selectedFiles();
    
    switch (fileType) {
      case 'network':
        this.selectedFiles.set({ ...currentFiles, networkFile: null });
        break;
      case 'nodepriors':
        this.selectedFiles.set({ ...currentFiles, nodePriorsFile: null });
        break;
      case 'linkprobs':
        this.selectedFiles.set({ ...currentFiles, linkProbabilitiesFile: null });
        break;
    }

    this.validationResults.set(null);
  }

  // Validation methods
  async validateFiles(): Promise<void> {
    const files = this.selectedFiles();
    if (!files.networkFile) return;

    this.isValidating.set(true);
    this.globalState.clearError();

    try {
      const result = await this.networkService.validateFiles({
        networkFile: files.networkFile,
        nodePriorsFile: files.nodePriorsFile || undefined,
        linkProbabilitiesFile: files.linkProbabilitiesFile || undefined
      }).toPromise();

      this.validationResults.set(result || null);
    } catch (error) {
      this.globalState.setError(`Validation failed: ${error}`);
    } finally {
      this.isValidating.set(false);
    }
  }

  // Upload methods
  async uploadNetwork(): Promise<void> {
    if (!this.canUpload()) return;

    const files = this.selectedFiles();
    const formValue = this.uploadForm.value;

    if (!files.networkFile || !formValue.probabilityType) return;

    const request: NetworkUploadRequest = {
      networkFile: files.networkFile,
      probabilityType: formValue.probabilityType,
      nodePriorsFile: files.nodePriorsFile || undefined,
      linkProbabilitiesFile: files.linkProbabilitiesFile || undefined
    };

    try {
      const response = await this.networkService.uploadNetwork(request).toPromise();
      
      if (response?.success) {
        // Navigate to network structure view
        await this.router.navigate(['/network-details']);
      }
    } catch (error) {
      // Error is handled by the service and stored in global state
      console.error('Upload failed:', error);
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

  getFileIcon(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'json':
        return 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8';
      case 'edge':
      case 'edges':
        return 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z';
      default:
        return 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6';
    }
  }
}