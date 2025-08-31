import { Component, inject, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';

import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';

import { AnalysisStateService } from '../shared/services/analysis-state.service';
import { NetworkBackendService } from '../shared/services/network-backend.service';
import { NetworkValidationService, ValidationResult } from '../shared/services/network-validation.service';
import { NetworkSessionService } from '../shared/services/network-session.service';
import { FileCategorizationService, NetworkFolder, CategorizedFile } from '../shared/services/file-categorization.service';
import { AnalysisRequest, UploadResponse } from '../shared/models/network-analysis.models';

@Component({
  selector: 'app-upload-network',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatCheckboxModule,
    MatStepperModule,
    MatTabsModule,
    MatChipsModule,
    MatExpansionModule,
    MatTableModule,
    MatSelectModule
],
  templateUrl: './upload-network.component.html',
  styleUrls: ['./upload-network.component.scss']
})
export class UploadNetworkComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('folderInput') folderInput!: ElementRef<HTMLInputElement>;

  private router = inject(Router);
  private formBuilder = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  private analysisState = inject(AnalysisStateService);
  private networkBackend = inject(NetworkBackendService);
  private validationService = inject(NetworkValidationService);
  private sessionService = inject(NetworkSessionService);
  private fileCategorizationService = inject(FileCategorizationService);

  analysisConfigForm: FormGroup;
  
  isAnalyzing = false;
  isProcessingFiles = false;
  
  categorizedNetworks: NetworkFolder[] = [];
  selectedNetwork: NetworkFolder | null = null;
  private originalFiles: FileList | null = null;
  private normalizedPathMap: Map<string, string> = new Map(); // Map original paths to normalized paths
  fileDisplayColumns = ['file', 'category', 'scenario', 'confidence'];

  constructor() {
    this.analysisConfigForm = this.formBuilder.group({
      exactInference: [true],
      diamondAnalysis: [true],
      flowAnalysis: [false],
      criticalPath: [false]
    });
  }

  ngOnInit(): void {
    // Component initialization
  }

  get folderStructureGuide(): string {
    return this.fileCategorizationService.getRecommendedFolderStructure();
  }

  async onFolderSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    this.isProcessingFiles = true;
    try {
      // Use the new normalization method
      const { networks, normalizedFiles, pathMap } = await this.fileCategorizationService.normalizeAndCategorizeFiles(input.files);
      
      // Store normalized files for upload instead of original files
      this.originalFiles = this.createFileList(normalizedFiles);
      this.categorizedNetworks = networks;
      this.normalizedPathMap = pathMap;
      
      if (this.categorizedNetworks.length === 0) {
        this.snackBar.open('No valid network files found', 'Close', { duration: 5000 });
      } else if (this.categorizedNetworks.length === 1) {
        this.selectedNetwork = this.categorizedNetworks[0];
        this.snackBar.open(`Network "${this.selectedNetwork.name}" detected and normalized`, 'Close', { duration: 3000 });
      } else {
        this.snackBar.open(`${this.categorizedNetworks.length} networks detected. Please select one.`, 'Close', { duration: 3000 });
      }
      
    } catch (error) {
      this.snackBar.open('Error processing files', 'Close', { duration: 5000 });
    } finally {
      this.isProcessingFiles = false;
    }
  }

  private createFileList(files: File[]): FileList {
    // Create a FileList-like object from an array of Files
    const fileList = {
      length: files.length,
      item: (index: number) => files[index] || null,
      [Symbol.iterator]: function* () {
        for (const file of files) {
          yield file;
        }
      }
    };
    
    // Add indexed properties
    files.forEach((file, index) => {
      (fileList as any)[index] = file;
    });
    
    return fileList as FileList;
  }

  selectNetwork(network: NetworkFolder): void {
    this.selectedNetwork = network;
    this.snackBar.open(`Selected network: ${network.name}`, 'Close', { duration: 2000 });
  }


  hasAnalysisSelected(): boolean {
    const config = this.analysisConfigForm.value;
    return config.exactInference || config.diamondAnalysis || 
           config.flowAnalysis || config.criticalPath;
  }

  getNetworkSummary(network: NetworkFolder): string {
    const parts = [];
    if (network.edgesFile) parts.push('Structure');
    
    const reachScenarios = Object.keys(network.reachabilityScenarios).length;
    if (reachScenarios > 0) parts.push(`${reachScenarios} Reachability`);
    
    const capScenarios = Object.keys(network.capacityScenarios).length;
    if (capScenarios > 0) parts.push(`${capScenarios} Capacity`);
    
    const cpmScenarios = Object.keys(network.cpmScenarios).length;
    if (cpmScenarios > 0) parts.push(`${cpmScenarios} CPM`);
    
    return parts.join(' • ') || 'No scenarios';
  }

  getAllFiles(network: NetworkFolder): CategorizedFile[] {
    const files: CategorizedFile[] = [];
    
    if (network.edgesFile) files.push(network.edgesFile);
    
    Object.values(network.reachabilityScenarios).forEach(scenario => {
      if (scenario.nodepriors) files.push(scenario.nodepriors);
      if (scenario.linkprobs) files.push(scenario.linkprobs);
    });
    
    Object.values(network.capacityScenarios).forEach(scenario => {
      if (scenario.capacities) files.push(scenario.capacities);
    });
    
    Object.values(network.cpmScenarios).forEach(scenario => {
      if (scenario.cpm) files.push(scenario.cpm);
    });
    
    files.push(...network.unknownFiles);
    
    return files;
  }

  canProceed(): boolean {
    return this.selectedNetwork !== null && !!this.selectedNetwork.edgesFile;
  }

  private async uploadNetworkFiles(): Promise<UploadResponse> {
    if (!this.originalFiles) {
      throw new Error('No files selected for upload');
    }

    return new Promise((resolve, reject) => {
      this.networkBackend.uploadNetworkFiles(this.originalFiles!).subscribe({
        next: (response) => {
          resolve(response);
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  }

  startAnalysis(): void {
    if (!this.hasAnalysisSelected()) {
      this.snackBar.open('Please select at least one analysis type', 'Close', { duration: 3000 });
      return;
    }

    if (!this.selectedNetwork || !this.selectedNetwork.edgesFile) {
      this.snackBar.open('Please select a valid network with structure file', 'Close', { duration: 3000 });
      return;
    }

    this.isAnalyzing = true;
    this.snackBar.open('Uploading network files...', 'Close', { duration: 2000 });

    // Step 1: Upload all files to backend
    this.uploadNetworkFiles()
      .then(uploadResponse => {
        if (uploadResponse.success && uploadResponse.network_path) {
          // Step 2: Use uploaded files path for analysis
          const request: AnalysisRequest = {
            networkPath: uploadResponse.network_path,
            reachabilityScenarios: this.buildReachabilityScenarios(),
            capacityScenarios: this.buildCapacityScenarios(),
            cpmScenarios: this.buildCpmScenarios(),
            analysisConfig: this.analysisConfigForm.value
          };

          this.snackBar.open('Files uploaded, starting analysis...', 'Close', { duration: 2000 });
          this.executeAnalysis(request);
        } else {
          throw new Error(uploadResponse.message || 'Upload failed');
        }
      })
      .catch(error => {
        console.error('File upload failed:', error);
        this.snackBar.open(`Upload failed: ${error.message}`, 'Close', { duration: 5000 });
        this.isAnalyzing = false;
      });
  }


  private buildReachabilityScenarios(): any[] {
    if (!this.selectedNetwork) return [];

    return Object.entries(this.selectedNetwork.reachabilityScenarios)
      .filter(([_, scenario]) => scenario.nodepriors && scenario.linkprobs)
      .map(([name, scenario]) => ({
        name: name,
        nodepriors_path: this.normalizedPathMap.get(scenario.nodepriors?.relativePath || '') || '',
        linkprobs_path: this.normalizedPathMap.get(scenario.linkprobs?.relativePath || '') || ''
      }));
  }

  private buildCapacityScenarios(): any[] {
    if (!this.selectedNetwork) return [];

    return Object.entries(this.selectedNetwork.capacityScenarios)
      .filter(([_, scenario]) => scenario.capacities)
      .map(([name, scenario]) => ({
        name: name,
        capacities_path: this.normalizedPathMap.get(scenario.capacities?.relativePath || '') || ''
      }));
  }

  private buildCpmScenarios(): any[] {
    if (!this.selectedNetwork) return [];

    return Object.entries(this.selectedNetwork.cpmScenarios)
      .filter(([_, scenario]) => scenario.cpm)
      .map(([name, scenario]) => ({
        name: name,
        cpm_path: this.normalizedPathMap.get(scenario.cpm?.relativePath || '') || ''
      }));
  }

  private executeAnalysis(request: AnalysisRequest): void {
    const session = this.sessionService.createNewSession(request.networkPath);
    this.analysisState.setCurrentNetworkPath(request.networkPath);

    // Load network structure immediately and navigate
    this.analysisState.loadNetworkStructure(request.networkPath).subscribe({
      next: () => {
        console.log('Network structure loaded successfully');
        
        this.isAnalyzing = false;
        this.analysisState.markTabCompleted('upload');
        
        this.sessionService.updateSession({
          networkData: this.analysisState.networkData()
        });
        
        this.snackBar.open('Network structure loaded successfully!', 'Close', { duration: 3000 });
        this.router.navigate(['/visualization']);
      },
      error: (error) => {
        this.isAnalyzing = false;
        this.snackBar.open(`Analysis failed: ${error.message}`, 'Close', { duration: 5000 });
      }
    });
  }
}