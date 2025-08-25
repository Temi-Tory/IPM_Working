import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';

import { 
  DetectedNetworkStructure, 
  AnalysisConfiguration, 
  NetworkAnalysisRequest,
  UploadProgress,
  DataType,
  ValidationResult
} from '../shared/models/network-analysis.models';
import { NetworkValidationService } from '../shared/services/network-validation.service';
import { NetworkSessionService } from '../shared/services/network-session.service';
import { NetworkBackendService } from '../shared/services/network-backend.service';

@Component({
  selector: 'app-upload-network',
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatSelectModule,
    MatProgressBarModule,
    MatDividerModule,
    MatChipsModule,
    MatSnackBarModule
  ],
  templateUrl: './upload-network.component.html',
  styleUrl: './upload-network.component.scss'
})
export class UploadNetworkComponent {
  // Signals for reactive state management
  detectedStructure = signal<DetectedNetworkStructure | null>(null);
  analysisConfig = signal<AnalysisConfiguration>({
    basicStructure: true,
    diamondAnalysis: true,
    exactInference: false,
    flowAnalysis: false,
    criticalPathAnalysis: false,
    nodeVisualization: true, // Always true - we'll use mapping if available
    inferenceDataType: 'float',
    criticalPathOptions: {
      enableTime: true,
      enableCost: true
    }
  });
  uploadProgress = signal<UploadProgress>({
    uploading: false,
    progress: 0,
    message: ''
  });

  isDragOver = signal(false);
  isValidating = signal(false);

  constructor(
    private validationService: NetworkValidationService,
    public sessionService: NetworkSessionService, // Make public for template access
    private snackBar: MatSnackBar,
    private backendService: NetworkBackendService
  ) {
    // Disable session loading for now - require fresh uploads
    // this.loadExistingSession();
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    const items = event.dataTransfer?.items;
    if (items) {
      this.handleDroppedItems(items);
    }
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (files && files.length > 0) {
      this.handleSelectedFiles(files);
    }
  }

  private async handleDroppedItems(items: DataTransferItemList) {
    this.isValidating.set(true);
    
    try {
      const files: File[] = [];
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      
      if (files.length === 0) {
        this.snackBar.open('No files detected. Please try again.', 'Close', { duration: 3000 });
        return;
      }

      await this.validateNetworkFiles(files);
    } catch (error) {
      this.snackBar.open('Error processing files: ' + error, 'Close', { duration: 5000 });
    } finally {
      this.isValidating.set(false);
    }
  }

  private async handleSelectedFiles(files: FileList) {
    this.isValidating.set(true);
    
    try {
      const fileArray = Array.from(files);
      await this.validateNetworkFiles(fileArray);
    } catch (error) {
      this.snackBar.open('Error processing files: ' + error, 'Close', { duration: 5000 });
    } finally {
      this.isValidating.set(false);
    }
  }

  private async validateNetworkFiles(files: File[]) {
    const result = await this.validationService.validateNetworkStructure(files);
    
    if (result.isValid && result.structure) {
      this.detectedStructure.set(result.structure);
      this.updateAnalysisConfigBasedOnStructure(result.structure);
      this.snackBar.open(`Network "${result.networkName}" detected successfully!`, 'Close', { duration: 3000 });
    } else {
      this.snackBar.open(`Validation failed: ${result.errors.join(', ')}`, 'Close', { duration: 5000 });
    }
  }

  private updateAnalysisConfigBasedOnStructure(structure: DetectedNetworkStructure) {
    const config = this.analysisConfig();
    
    // Update available options based on detected files
    const updatedConfig: AnalysisConfiguration = {
      ...config,
      basicStructure: structure.hasEdgesFile,
      diamondAnalysis: structure.hasEdgesFile,
      exactInference: false, // Let user choose
      flowAnalysis: false,   // Let user choose  
      criticalPathAnalysis: false, // Let user choose
      nodeVisualization: true, // Always true - use mapping if available
      inferenceDataType: structure.availableDataTypes[0] || 'float'
    };

    this.analysisConfig.set(updatedConfig);
  }

  updateAnalysisConfig(updates: Partial<AnalysisConfiguration>) {
    this.analysisConfig.update(config => ({ ...config, ...updates }));
  }

  updateCriticalPathOption(option: 'enableTime' | 'enableCost', value: boolean) {
    const config = this.analysisConfig();
    const currentOptions = config.criticalPathOptions || { enableTime: true, enableCost: true };
    const updatedOptions = {
      ...currentOptions,
      [option]: value
    };
    this.analysisConfig.update(c => ({ 
      ...c, 
      criticalPathOptions: updatedOptions 
    }));
  }

  onBrowseClick() {
    const input = document.getElementById('fileInput') as HTMLInputElement;
    input?.click();
  }

  private loadExistingSession() {
    if (this.sessionService.hasActiveSession()) {
      const session = this.sessionService.getCurrentNetwork();
      if (session) {
        // Restore structure and config from session
        this.detectedStructure.set(session.structure);
        this.analysisConfig.set(session.analysisConfig);
        
        this.snackBar.open(`Restored session: ${session.networkName}`, 'Close', { 
          duration: 3000 
        });
      }
    }
  }

  canEnableInference(): boolean {
    const structure = this.detectedStructure();
    return !!(structure?.availableDataTypes.length);
  }

  canEnableFlowAnalysis(): boolean {
    const structure = this.detectedStructure();
    return !!(structure?.hasCapacityData);
  }

  canEnableCriticalPath(): boolean {
    const structure = this.detectedStructure();
    return !!(structure?.hasCPMData);
  }

  hasValidFilesForAnalysis(): boolean {
    const structure = this.detectedStructure();
    return !!(structure?.detectedFiles.edges?.file);
  }


  async uploadNetwork() {
    const structure = this.detectedStructure();
    const config = this.analysisConfig();
    
    if (!structure) {
      this.snackBar.open('No network detected. Please upload files first.', 'Close', { duration: 3000 });
      return;
    }

    // Check if this is a restored session without actual file objects
    if (!structure.detectedFiles.edges?.file) {
      this.snackBar.open('Files are no longer available in memory. Please upload the network files again.', 'Close', { 
        duration: 5000 
      });
      return;
    }

    try {
      this.uploadProgress.update(p => ({ ...p, uploading: true, progress: 0, message: 'Preparing upload...' }));

      const request = await this.buildAnalysisRequest(structure, config);
      
      // Disabled session storage for now - keep it simple
      // this.sessionService.saveNetworkSession(structure, config, request.files);
      
      this.uploadProgress.update(p => ({ ...p, progress: 20, message: 'Uploading to backend...' }));
      
      // Send to backend API
      this.backendService.uploadAndAnalyzeNetwork(request).subscribe({
        next: (response) => {
          this.uploadProgress.update(p => ({ ...p, progress: 100, message: 'Analysis complete!' }));
          
          // Disabled session storage for now - keep it simple
          // this.sessionService.saveAnalysisResults(response);
          
          this.snackBar.open(`Network "${structure.networkName}" analyzed successfully!`, 'Close', { duration: 3000 });
          
          // Log results for debugging
          console.log('Backend Analysis Results:', response);
          
          // TODO: Navigate to network structure view to show results
          
        },
        error: (error: any) => {
          this.uploadProgress.update(p => ({ 
            ...p, 
            error: error.error || 'Analysis failed', 
            uploading: false,
            progress: 0,
            message: 'Analysis failed'
          }));
          this.snackBar.open('Analysis failed: ' + (error.error || error.message), 'Close', { duration: 5000 });
          console.error('Backend error:', error);
        }
      });
      
    } catch (error) {
      this.uploadProgress.update(p => ({ ...p, error: error as string, uploading: false }));
      this.snackBar.open('Upload failed: ' + error, 'Close', { duration: 5000 });
    }
  }

  private async buildAnalysisRequest(
    structure: DetectedNetworkStructure, 
    config: AnalysisConfiguration
  ): Promise<NetworkAnalysisRequest> {
    
    const request: NetworkAnalysisRequest = {
      networkName: structure.networkName,
      files: {
        edges: structure.detectedFiles.edges!.file
      },
      analysesToRun: config
    };

    // Add optional files based on availability (always include if available)
    if (structure.detectedFiles.nodeMapping) {
      request.files.nodeMapping = structure.detectedFiles.nodeMapping.file;
    }

    if (config.exactInference && config.inferenceDataType && structure.detectedFiles.inference?.[config.inferenceDataType]) {
      const inferenceFiles = structure.detectedFiles.inference[config.inferenceDataType];
      if (inferenceFiles?.nodepriors && inferenceFiles?.linkprobabilities) {
        request.files.inference = {
          dataType: config.inferenceDataType,
          nodepriors: inferenceFiles.nodepriors.file,
          linkprobabilities: inferenceFiles.linkprobabilities.file
        };
      }
    }

    if (config.flowAnalysis && structure.detectedFiles.capacity) {
      request.files.capacity = {
        capacities: structure.detectedFiles.capacity.file
      };
    }

    if (config.criticalPathAnalysis && structure.detectedFiles.criticalPath && config.criticalPathOptions) {
      request.files.criticalPath = {
        enableTime: config.criticalPathOptions.enableTime,
        enableCost: config.criticalPathOptions.enableCost,
        cpmInputs: structure.detectedFiles.criticalPath.file
      };
    }

    return request;
  }

  resetUpload() {
    // Disabled session storage for now - keep it simple
    // this.sessionService.clearSession();
    
    this.detectedStructure.set(null);
    this.analysisConfig.set({
      basicStructure: true,
      diamondAnalysis: true,
      exactInference: false,
      flowAnalysis: false,
      criticalPathAnalysis: false,
      nodeVisualization: true, // Always true
      inferenceDataType: 'float',
      criticalPathOptions: {
        enableTime: true,
        enableCost: true
      }
    });
    this.uploadProgress.set({
      uploading: false,
      progress: 0,
      message: ''
    });
    
    this.snackBar.open('Upload cleared', 'Close', { duration: 2000 });
  }
}