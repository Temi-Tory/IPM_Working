import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { FileValidationResult } from '../landing/landing.component';

interface FilePreviewData {
  fileName: string;
  fileSize: number;
  fileType: string;
  lastModified: Date;
  encoding: string;
  rowCount: number;
  columnCount: number;
  previewRows: string[][];
  statistics: FileStatistics;
  validation: FileValidationResult;
}

interface FileStatistics {
  totalCells: number;
  numericCells: number;
  emptyCells: number;
  uniqueValues: number;
  dataTypes: { [type: string]: number };
  valueRanges: { min: number; max: number; avg: number };
}

@Component({
  selector: 'app-file-preview',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatTabsModule,
    MatChipsModule,
    MatExpansionModule
  ],
   templateUrl: './file-preview.component.html',
    styleUrls: ['./file-preview.component.scss']
})
export class FilePreviewComponent implements OnInit, OnChanges {
  @Input() file: File | null = null;
  @Input() fileContent = '';
  @Input() validationResult: FileValidationResult | null = null;

  previewData: FilePreviewData | null = null;

  ngOnInit(): void {
    this.generatePreview();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['file'] || changes['fileContent'] || changes['validationResult']) {
      this.generatePreview();
    }
  }

  private generatePreview(): void {
    if (!this.file || !this.fileContent) {
      this.previewData = null;
      return;
    }

    const lines = this.fileContent.split('\n').filter(line => line.trim().length > 0);
    const previewRows = lines.slice(0, 10).map(line => line.split(','));
    
    // Calculate statistics
    const statistics = this.calculateStatistics(lines);
    
    // Generate validation summary
    const validation = this.generateValidationSummary(lines);

    this.previewData = {
      fileName: this.file.name,
      fileSize: this.file.size,
      fileType: this.file.type || 'text/csv',
      lastModified: new Date(this.file.lastModified),
      encoding: 'UTF-8', // Assume UTF-8 for now
      rowCount: lines.length,
      columnCount: previewRows.length > 0 ? previewRows[0].length : 0,
      previewRows,
      statistics,
      validation
    };
  }

  private calculateStatistics(lines: string[]): FileStatistics {
    let totalCells = 0;
    let numericCells = 0;
    let emptyCells = 0;
    const uniqueValues = new Set<string>();
    const dataTypes: { [type: string]: number } = {};
    const numericValues: number[] = [];

    lines.forEach(line => {
      const cells = line.split(',');
      totalCells += cells.length;
      
      cells.forEach(cell => {
        const trimmed = cell.trim();
        
        if (trimmed === '') {
          emptyCells++;
          dataTypes['empty'] = (dataTypes['empty'] || 0) + 1;
        } else {
          uniqueValues.add(trimmed);
          
          if (!isNaN(Number(trimmed))) {
            numericCells++;
            numericValues.push(Number(trimmed));
            dataTypes['numeric'] = (dataTypes['numeric'] || 0) + 1;
          } else {
            dataTypes['text'] = (dataTypes['text'] || 0) + 1;
          }
        }
      });
    });

    const valueRanges = numericValues.length > 0 ? {
      min: Math.min(...numericValues),
      max: Math.max(...numericValues),
      avg: numericValues.reduce((a, b) => a + b, 0) / numericValues.length
    } : { min: 0, max: 0, avg: 0 };

    return {
      totalCells,
      numericCells,
      emptyCells,
      uniqueValues: uniqueValues.size,
      dataTypes,
      valueRanges
    };
  }

  private generateValidationSummary(lines: string[]): FileValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Basic format validation
    if (lines.length === 0) {
      errors.push('File is empty');
    }

    if (lines.length > 0) {
      const firstRowLength = lines[0].split(',').length;
      
      // Check for consistent column count
      const inconsistentRows = lines.filter((line, index) => {
        const cols = line.split(',').length;
        return cols !== firstRowLength;
      });
      
      if (inconsistentRows.length > 0) {
        errors.push(`Inconsistent column count in ${inconsistentRows.length} rows`);
      }

      // Check for square matrix (adjacency matrix requirement)
      if (firstRowLength !== lines.length) {
        warnings.push(`Matrix is not square (${lines.length}×${firstRowLength}). Expected square adjacency matrix.`);
      }

      // Check for proper probability values
      let invalidProbabilities = 0;
      lines.forEach((line, rowIndex) => {
        const cells = line.split(',');
        cells.forEach((cell, colIndex) => {
          const value = parseFloat(cell.trim());
          if (!isNaN(value) && (value < 0 || value > 1)) {
            invalidProbabilities++;
          }
        });
      });

      if (invalidProbabilities > 0) {
        errors.push(`${invalidProbabilities} values are outside valid probability range [0,1]`);
      }

      // Check diagonal for self-loops
      let selfLoops = 0;
      const minDim = Math.min(lines.length, firstRowLength - 1); // -1 for prior column
      for (let i = 0; i < minDim; i++) {
        const cells = lines[i].split(',');
        if (cells.length > i + 1) { // +1 to skip prior column
          const diagonalValue = parseFloat(cells[i + 1].trim());
          if (!isNaN(diagonalValue) && diagonalValue > 0) {
            selfLoops++;
          }
        }
      }

      if (selfLoops > 0) {
        warnings.push(`${selfLoops} potential self-loops detected (non-zero diagonal values)`);
      }

      // Generate recommendations
      if (lines.length > 100) {
        recommendations.push('Large network detected. Consider using structure analysis for performance insights.');
      }

      const totalCells = this.previewData?.statistics.totalCells || 0;
      if ((this.previewData?.statistics.emptyCells || 0) > totalCells * 0.1) {
        recommendations.push('Many empty cells detected. Verify this represents sparse connectivity.');
      }

      const numericRatio = (this.previewData?.statistics.numericCells || 0) / (this.previewData?.statistics.totalCells || 1);
      if (numericRatio < 0.9) {
        recommendations.push('Non-numeric values detected. Ensure all probabilities are numeric.');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      fileInfo: {
      size: this.file ? this.file.size : 0,
      rows: lines.length,
      columns: lines.length > 0 ? lines[0].split(',').length : 0,
      encoding: 'UTF-8'
      }
    };
  }

    // Returns the number of rows shown in the preview table
  getPreviewRowCount(): number {
    // If you have a previewData.previewRows or similar, use its length.
    // Otherwise, fallback to a default (e.g., 10) or the full rowCount.
    if (this.previewData && this.previewData.previewRows) {
      return this.previewData.previewRows.length;
    }
    // Fallback: show up to 10 rows or the total rowCount if less
    if (this.previewData && this.previewData.rowCount) {
      return Math.min(10, this.previewData.rowCount);
    }
    return 0;
  }
  
  // Template helper methods
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getTableDataSource(): any[] {
    if (!this.previewData) return [];
    return this.previewData.previewRows.map((row, index) => ({
      rowIndex: index + 1,
      ...row
    }));
  }

  getTableColumns(): string[] {
    if (!this.previewData || this.previewData.previewRows.length === 0) return [];
    return this.previewData.previewRows[0];
  }

  getColumnDefs(): string[] {
    if (!this.previewData || this.previewData.previewRows.length === 0) return [];
    return this.previewData.previewRows[0].map((_, index) => `col${index}`);
  }

  formatCellValue(value: string): string {
    const trimmed = value.trim();
    if (trimmed === '') return '(empty)';
    
    const numeric = parseFloat(trimmed);
    if (!isNaN(numeric)) {
      return numeric.toFixed(3);
    }
    
    return trimmed;
  }

  getCellClass(value: string): string {
    const trimmed = value.trim();
    if (trimmed === '') return 'cell-empty';
    
    const numeric = parseFloat(trimmed);
    if (!isNaN(numeric)) {
      if (numeric < 0 || numeric > 1) return 'cell-invalid';
      if (numeric === 0) return 'cell-zero';
      if (numeric === 1) return 'cell-one';
      return 'cell-probability';
    }
    
    return 'cell-text';
  }

  getDataTypes(): Array<{name: string, count: number}> {
    if (!this.previewData) return [];
    
    return Object.entries(this.previewData.statistics.dataTypes)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }
}