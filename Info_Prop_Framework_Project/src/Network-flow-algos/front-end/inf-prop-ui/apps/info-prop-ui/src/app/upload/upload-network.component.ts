import { Component, inject, ViewChild, ElementRef, computed } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';

import { NetworkSessionService } from '../shared/services/network-session.service';
import { FileManagerService } from '../shared/services/file-manager.service';
import { FileUploadService } from '../shared/services/file-upload.service';
import { CategorizedFile, AnalysisType } from '../shared/models/network-analysis.models';

@Component({
  selector: 'app-upload-network',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatChipsModule,
    MatExpansionModule
  ],
  templateUrl: './upload-network.component.html',
  styleUrls: ['./upload-network.component.scss']
})
export class UploadNetworkComponent {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('folderInput') folderInput!: ElementRef<HTMLInputElement>;

  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private sessionService = inject(NetworkSessionService);
  private fileManager = inject(FileManagerService);
  private fileUpload = inject(FileUploadService);

  // File manager state signals
  fileManagerState = this.fileManager.fileManagerState;
  uploadedFiles = this.fileManager.uploadedFiles;
  analysisGroups = this.fileManager.analysisGroups;
  isUploading = this.fileManager.isUploading;
  validationResults = this.fileManager.validationResults;
  
  // Computed properties for UI
  hasFiles = computed(() => this.uploadedFiles().length > 0);
  hasNetworkFiles = computed(() => this.analysisGroups().network.files.length > 0);
  canProceedToAnalysis = computed(() => {
    const groups = this.analysisGroups();
    return this.uploadedFiles().length > 0 && groups.network.files.length > 0;
  });

  constructor() {
    // Load state from session if available
    this.loadStateFromSession();
  }

  /**
   * Handle folder selection from input
   */
  async onFolderSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    try {
      // Upload files first
      await this.uploadFiles(input.files);
      
      // Then process and categorize them using FileManagerService
      this.fileManager.processUploadedFiles(input.files).subscribe({
        next: (categorizedFiles) => {
          // Save state to session
          this.saveStateToSession();
          
          const fileCount = input.files!.length;
          const networkFiles = this.analysisGroups().network.files.length;
          
          this.snackBar.open(
            `Uploaded ${fileCount} files. Found ${networkFiles} network files.`,
            'Close',
            { duration: 3000 }
          );
        },
        error: (error) => {
          console.error('Error processing files:', error);
          this.snackBar.open(`Error processing files: ${error.message}`, 'Close', { duration: 5000 });
        }
      });
      
    } catch (error: any) {
      console.error('Error processing files:', error);
      this.snackBar.open(`Error processing files: ${error.message}`, 'Close', { duration: 5000 });
    }
  }

  /**
   * Handle individual file selection
   */
  async onFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    try {
      // Upload files first
      await this.uploadFiles(input.files);
      
      // Then process and categorize them using FileManagerService
      this.fileManager.processUploadedFiles(input.files).subscribe({
        next: (categorizedFiles) => {
          // Save state to session
          this.saveStateToSession();
          
          const fileCount = input.files!.length;
          this.snackBar.open(`Added ${fileCount} files`, 'Close', { duration: 2000 });
        },
        error: (error) => {
          console.error('Error adding files:', error);
          this.snackBar.open(`Error adding files: ${error.message}`, 'Close', { duration: 5000 });
        }
      });
      
    } catch (error: any) {
      console.error('Error adding files:', error);
      this.snackBar.open(`Error adding files: ${error.message}`, 'Close', { duration: 5000 });
    }
  }

  /**
   * Upload files to backend
   */
  private async uploadFiles(files: FileList): Promise<void> {
    return new Promise((resolve, reject) => {
      this.fileUpload.uploadFiles(files).subscribe({
        next: (response) => {
          if (response.success) {
            resolve();
          } else {
            reject(new Error(response.message || 'Upload failed'));
          }
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  }

  /**
   * Reassign a file to a different category
   */
  reassignFile(file: CategorizedFile, newCategory: AnalysisType): void {
    // For now, we'll need to implement reassignment logic
    // This would require updating the FileManagerService to support reassignment
    this.snackBar.open(`File reassignment not yet implemented`, 'Close', { duration: 2000 });
  }

  /**
   * Remove a file from the manager
   */
  removeFile(file: CategorizedFile): void {
    this.fileManager.removeFile(file.id);
    this.saveStateToSession();
    this.snackBar.open('File removed', 'Close', { duration: 2000 });
  }

  /**
   * Clear all files
   */
  clearAllFiles(): void {
    this.fileManager.clearAllFiles();
    this.saveStateToSession();
    this.snackBar.open('All files cleared', 'Close', { duration: 2000 });
  }

  /**
   * Get validation status for analysis group
   */
  getGroupValidation(groupName: string): { isValid: boolean; message: string } {
    const groups = this.analysisGroups();
    switch (groupName) {
      case 'network':
        return {
          isValid: groups.network.isComplete,
          message: groups.network.missingFiles.join(', ')
        };
      case 'reachability': {
        const reachGroup = groups.reachability[0];
        return {
          isValid: reachGroup?.isComplete || false,
          message: reachGroup?.missingFiles.join(', ') || 'No reachability files'
        };
      }
      case 'capacity': {
        const capGroup = groups.capacity[0];
        return {
          isValid: capGroup?.isComplete || false,
          message: capGroup?.missingFiles.join(', ') || 'No capacity files'
        };
      }
      case 'cpm': {
        const cpmGroup = groups.cpm[0];
        return {
          isValid: cpmGroup?.isComplete || false,
          message: cpmGroup?.missingFiles.join(', ') || 'No CPM files'
        };
      }
      default:
        return { isValid: false, message: 'Unknown group' };
    }
  }

  /**
   * Get files for a specific analysis group
   */
  getGroupFiles(groupName: string): CategorizedFile[] {
    const groups = this.analysisGroups();
    switch (groupName) {
      case 'network':
        return groups.network.files;
      case 'reachability':
        // Return all files from all reachability scenarios
        return groups.reachability.flatMap(group => group.files);
      case 'capacity':
        return groups.capacity.flatMap(group => group.files);
      case 'cpm':
        return groups.cpm.flatMap(group => group.files);
      default:
        return [];
    }
  }

  /**
   * Get all scenarios for a specific analysis type
   */
  getScenarios(analysisType: string): any[] {
    const groups = this.analysisGroups();
    switch (analysisType) {
      case 'reachability':
        return groups.reachability;
      case 'capacity':
        return groups.capacity;
      case 'cpm':
        return groups.cpm;
      default:
        return [];
    }
  }

  /**
   * Get display name for data type
   */
  getDataTypeDisplayName(dataType: string): string {
    switch (dataType) {
      case 'float': return 'Float (Deterministic)';
      case 'interval': return 'Interval';
      case 'pbox': return 'P-Box';
      case 'capacity': return 'Capacity';
      case 'cpm': return 'CPM';
      default: return dataType.charAt(0).toUpperCase() + dataType.slice(1);
    }
  }

  /**
   * Get scenario display name
   */
  getScenarioDisplayName(scenario: any): string {
    if (scenario.analysisType === 'reachability') {
      return this.getDataTypeDisplayName(scenario.dataType);
    } else if (scenario.analysisType === 'cpm') {
      const parts = [];
      if (scenario.hasTimeAnalysis) parts.push('Time');
      if (scenario.hasCostAnalysis) parts.push('Cost');
      return parts.length > 0 ? `CPM (${parts.join(' + ')})` : 'CPM';
    } else {
      return scenario.analysisType.charAt(0).toUpperCase() + scenario.analysisType.slice(1);
    }
  }

  /**
   * Get total scenario count for analysis type
   */
  getScenarioCount(analysisType: string): number {
    return this.getScenarios(analysisType).length;
  }

  /**
   * Get available categories for reassignment
   */
  getAvailableCategories(): AnalysisType[] {
    return ['network', 'reachability', 'capacity', 'cpm', 'unknown'];
  }

  /**
   * Get confidence level display
   */
  getConfidenceDisplay(confidence: number): string {
    if (confidence >= 0.9) return 'High';
    if (confidence >= 0.7) return 'Medium';
    if (confidence >= 0.5) return 'Low';
    return 'Very Low';
  }

  /**
   * Get confidence color class
   */
  getConfidenceColor(confidence: number): string {
    if (confidence >= 0.9) return 'confidence-high';
    if (confidence >= 0.7) return 'confidence-medium';
    if (confidence >= 0.5) return 'confidence-low';
    return 'confidence-very-low';
  }

  /**
   * Proceed to analysis selection
   */
  proceedToAnalysis(): void {
    if (!this.canProceedToAnalysis()) {
      this.snackBar.open('Please upload network structure files first', 'Close', { duration: 3000 });
      return;
    }

    // Save current state to session
    this.saveStateToSession();
    
    // Navigate to analysis selection/configuration
    this.router.navigate(['/analysis']);
  }

  /**
   * Save current file manager state to session
   */
  private saveStateToSession(): void {
    const currentSession = this.sessionService.getCurrentSession();
    if (currentSession) {
      this.sessionService.updateSession({
        fileManagerState: this.fileManagerState()
      });
    } else {
      // Create new session with file manager state
      const session = this.sessionService.createNewSession('file-upload');
      this.sessionService.updateSession({
        fileManagerState: this.fileManagerState()
      });
    }
  }

  /**
   * Load state from session if available
   */
  private loadStateFromSession(): void {
    const currentSession = this.sessionService.getCurrentSession();
    if (currentSession?.fileManagerState) {
      // For now, we'll just note that state should be loaded
      // The FileManagerService would need a loadState method
      console.log('Loading file manager state from session');
    }
  }

  /**
   * Get summary of current file state
   */
  getFileSummary(): string {
    const groups = this.analysisGroups();
    const parts = [];
    
    if (groups.network.files.length > 0) {
      parts.push(`${groups.network.files.length} Network`);
    }
    if (groups.reachability.length > 0) {
      const totalReach = groups.reachability.reduce((sum, group) => sum + group.files.length, 0);
      parts.push(`${totalReach} Reachability`);
    }
    if (groups.capacity.length > 0) {
      const totalCap = groups.capacity.reduce((sum, group) => sum + group.files.length, 0);
      parts.push(`${totalCap} Capacity`);
    }
    if (groups.cpm.length > 0) {
      const totalCpm = groups.cpm.reduce((sum, group) => sum + group.files.length, 0);
      parts.push(`${totalCpm} CPM`);
    }
    
    return parts.join(' • ') || 'No files categorized';
  }

  /**
   * Trigger file input click
   */
  triggerFileInput(): void {
    this.fileInput.nativeElement.click();
  }

  /**
   * Trigger folder input click
   */
  triggerFolderInput(): void {
    this.folderInput.nativeElement.click();
  }
}