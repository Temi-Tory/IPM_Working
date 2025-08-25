import { Injectable } from '@angular/core';
import { 
  DetectedNetworkStructure, 
  ValidationResult, 
  NetworkFile,
  DataType 
} from '../models/network-analysis.models';

@Injectable({
  providedIn: 'root'
})
export class NetworkValidationService {

  async validateNetworkStructure(files: File[]): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // Group files by path structure
      const fileStructure = this.organizeFilesByStructure(files);
      
      // Detect network name from EDGES file or folder structure
      const networkName = this.detectNetworkName(fileStructure);
      
      if (!networkName) {
        errors.push('Could not determine network name. Ensure .EDGES file follows naming convention.');
        return { isValid: false, errors, warnings };
      }

      // Build detected structure
      const structure = await this.buildDetectedStructure(networkName, fileStructure, errors, warnings);
      
      // Validate minimum requirements
      if (!structure.hasEdgesFile) {
        errors.push(`Missing required ${networkName}.EDGES file`);
      }

      const isValid = errors.length === 0 && structure.hasEdgesFile;
      
      return {
        isValid,
        networkName,
        errors,
        warnings,
        structure: isValid ? structure : undefined
      };
      
    } catch (error) {
      errors.push(`Validation error: ${error}`);
      return { isValid: false, errors, warnings };
    }
  }

  private organizeFilesByStructure(files: File[]): Map<string, File[]> {
    const structure = new Map<string, File[]>();
    
    for (const file of files) {
      // Handle both folder structure and flat file uploads
      const pathParts = file.webkitRelativePath || file.name;
      const segments = pathParts.split('/').filter(s => s.length > 0);
      
      if (segments.length === 1) {
        // Flat file upload
        structure.set('root', [...(structure.get('root') || []), file]);
      } else {
        // Folder structure
        const folderName = segments[segments.length - 2] || 'root'; // Parent folder
        structure.set(folderName, [...(structure.get(folderName) || []), file]);
      }
    }
    
    return structure;
  }

  private detectNetworkName(fileStructure: Map<string, File[]>): string | null {
    // Look for .EDGES file to determine network name
    for (const [folder, files] of fileStructure.entries()) {
      for (const file of files) {
        if (file.name.endsWith('.EDGES')) {
          return file.name.replace('.EDGES', '');
        }
      }
    }
    
    // Fallback: use main folder name if no EDGES file found yet
    const mainFolders = Array.from(fileStructure.keys()).filter(k => k !== 'root');
    if (mainFolders.length === 1) {
      return mainFolders[0];
    }
    
    return null;
  }

  private async buildDetectedStructure(
    networkName: string, 
    fileStructure: Map<string, File[]>,
    errors: string[],
    warnings: string[]
  ): Promise<DetectedNetworkStructure> {
    
    const structure: DetectedNetworkStructure = {
      networkName,
      hasEdgesFile: false,
      hasNodeMapping: false,
      availableDataTypes: [],
      hasCapacityData: false,
      hasCPMData: false,
      detectedFiles: {
        inference: {}
      },
      errors,
      warnings
    };

    // Check all files across all folders
    for (const [folder, files] of fileStructure.entries()) {
      for (const file of files) {
        await this.processFile(file, folder, networkName, structure);
      }
    }

    return structure;
  }

  private async processFile(
    file: File, 
    folder: string, 
    networkName: string, 
    structure: DetectedNetworkStructure
  ): Promise<void> {
    
    const fileName = file.name;
    const expectedPrefix = networkName.replace(/_/g, '-'); // Handle underscore to hyphen conversion
    
    // Main EDGES file
    if (fileName === `${networkName}.EDGES`) {
      structure.hasEdgesFile = true;
      structure.detectedFiles.edges = {
        file,
        path: file.webkitRelativePath || fileName,
        isValid: true
      };
      return;
    }

    // Node mapping file
    if (fileName.includes('node-mapping.txt') && fileName.includes(expectedPrefix)) {
      structure.hasNodeMapping = true;
      structure.detectedFiles.nodeMapping = {
        file,
        path: file.webkitRelativePath || fileName,
        isValid: true
      };
      return;
    }

    // Data type folders (float, interval, pbox)
    const dataTypes: DataType[] = ['float', 'interval', 'pbox'];
    for (const dataType of dataTypes) {
      if (folder === dataType) {
        if (!structure.availableDataTypes.includes(dataType)) {
          structure.availableDataTypes.push(dataType);
          structure.detectedFiles.inference![dataType] = {};
        }

        if (fileName === `${expectedPrefix}-nodepriors.json`) {
          structure.detectedFiles.inference![dataType]!.nodepriors = {
            file,
            path: file.webkitRelativePath || fileName,
            isValid: true
          };
        }

        if (fileName === `${expectedPrefix}-linkprobabilities.json`) {
          structure.detectedFiles.inference![dataType]!.linkprobabilities = {
            file,
            path: file.webkitRelativePath || fileName,
            isValid: true
          };
        }
      }
    }

    // Capacity data
    if (folder === 'capacity' && fileName === `${expectedPrefix}-capacities.json`) {
      structure.hasCapacityData = true;
      structure.detectedFiles.capacity = {
        file,
        path: file.webkitRelativePath || fileName,
        isValid: true
      };
    }

    // CPM data
    if (folder === 'cpm' && fileName === `${expectedPrefix}-cpm-inputs.json`) {
      structure.hasCPMData = true;
      structure.detectedFiles.criticalPath = {
        file,
        path: file.webkitRelativePath || fileName,
        isValid: true
      };
    }
  }

  validateFileNaming(fileName: string, expectedPrefix: string, expectedSuffix: string): boolean {
    const expectedName = `${expectedPrefix}-${expectedSuffix}`;
    return fileName === expectedName;
  }

  getRequiredFilesForAnalysis(analysisType: string): string[] {
    switch (analysisType) {
      case 'basic':
        return ['.EDGES'];
      case 'inference':
        return ['.EDGES', 'nodepriors.json', 'linkprobabilities.json'];
      case 'capacity':
        return ['.EDGES', 'capacities.json'];
      case 'criticalPath':
        return ['.EDGES', 'cpm-inputs.json'];
      default:
        return ['.EDGES'];
    }
  }
}