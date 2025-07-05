import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

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
    MatIconModule
  ],
  template: `
    <!-- FILE UPLOAD FUNCTIONALITY DISABLED -->
    <mat-card class="file-upload-card disabled">
      <mat-card-content>
        <div class="disabled-message">
          <mat-icon>block</mat-icon>
          <h3>File Upload Disabled</h3>
          <p>File upload functionality has been disabled.</p>
          <p>Please use the test networks instead.</p>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .file-upload-card.disabled {
      opacity: 0.6;
      pointer-events: none;
    }
    
    .disabled-message {
      text-align: center;
      padding: 40px 20px;
      color: #666;
    }
    
    .disabled-message mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
      color: #f44336;
    }
    
    .disabled-message h3 {
      margin: 16px 0 8px 0;
      color: #333;
    }
    
    .disabled-message p {
      margin: 4px 0;
      font-size: 14px;
    }
  `]
})
export class FileUploadComponent {
  @Input() fileType: 'dag' | 'nodeProbabilities' | 'edgeProbabilities' = 'dag';
  @Input() acceptedTypes: string[] = ['.csv', '.txt', '.json'];
  @Input() maxFileSize: number = 50 * 1024 * 1024; // 50MB
  @Input() disabled = true; // Always disabled

  @Output() fileSelected = new EventEmitter<FileUploadEvent>();
  @Output() fileCleared = new EventEmitter<void>();

  constructor() {
    console.log('🚫 FileUploadComponent: File upload functionality DISABLED - using test networks only');
  }
}