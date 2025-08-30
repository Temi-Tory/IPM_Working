import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fileInfo?: {
    name: string;
    size: number;
    type: string;
  };
}

@Injectable({ providedIn: 'root' })
export class NetworkValidationService {

  validateNetworkFiles(files: FileList): Observable<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      results.push(this.validateSingleFile(file));
    }

    return of(results);
  }

  private validateSingleFile(file: File): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      fileInfo: {
        name: file.name,
        size: file.size,
        type: file.type
      }
    };

    // File size validation (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      result.errors.push('File size exceeds 50MB limit');
      result.isValid = false;
    }

    // File extension validation
    const allowedExtensions = ['.json', '.csv', '.edges', '.txt'];
    const fileExtension = this.getFileExtension(file.name).toLowerCase();
    
    if (!allowedExtensions.includes(fileExtension)) {
      result.errors.push(`Unsupported file type: ${fileExtension}. Allowed types: ${allowedExtensions.join(', ')}`);
      result.isValid = false;
    }

    // Network-specific validations
    if (file.name.includes('.EDGES') || file.name.endsWith('.edges')) {
      this.validateEdgesFile(file, result);
    } else if (file.name.includes('nodepriors') || file.name.includes('node-priors')) {
      this.validateNodePriorsFile(file, result);
    } else if (file.name.includes('linkprob') || file.name.includes('link-prob')) {
      this.validateLinkProbabilitiesFile(file, result);
    } else if (file.name.includes('capacit')) {
      this.validateCapacitiesFile(file, result);
    }

    return result;
  }

  private validateEdgesFile(file: File, result: ValidationResult): void {
    // Basic EDGES file validation
    if (!file.name.toUpperCase().includes('.EDGES')) {
      result.warnings.push('Edge files should have .EDGES extension');
    }
  }

  private validateNodePriorsFile(file: File, result: ValidationResult): void {
    if (!file.name.endsWith('.json')) {
      result.errors.push('Node priors files must be JSON format');
      result.isValid = false;
    }
  }

  private validateLinkProbabilitiesFile(file: File, result: ValidationResult): void {
    if (!file.name.endsWith('.json')) {
      result.errors.push('Link probabilities files must be JSON format');
      result.isValid = false;
    }
  }

  private validateCapacitiesFile(file: File, result: ValidationResult): void {
    const validExtensions = ['.json', '.csv'];
    const extension = this.getFileExtension(file.name);
    
    if (!validExtensions.includes(extension)) {
      result.errors.push('Capacity files must be JSON or CSV format');
      result.isValid = false;
    }
  }

  private getFileExtension(filename: string): string {
    return filename.substring(filename.lastIndexOf('.'));
  }

  validateNetworkPath(path: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    if (!path || path.trim().length === 0) {
      result.errors.push('Network path cannot be empty');
      result.isValid = false;
    }

    if (path.includes('..')) {
      result.errors.push('Network path cannot contain ".." for security reasons');
      result.isValid = false;
    }

    return result;
  }

  validateAnalysisConfiguration(config: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    if (!config.exactInference && !config.diamondAnalysis && !config.flowAnalysis && !config.criticalPath) {
      result.warnings.push('No analysis types selected. At least one analysis type should be enabled.');
    }

    return result;
  }
}