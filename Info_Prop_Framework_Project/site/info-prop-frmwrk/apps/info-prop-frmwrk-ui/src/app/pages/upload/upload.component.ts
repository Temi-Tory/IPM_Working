import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <div class="page-container">
      <mat-card class="page-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>upload_file</mat-icon>
            Upload File
          </mat-card-title>
          <mat-card-subtitle>Upload your network data files</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <p>This page will allow you to upload network data files for analysis.</p>
          <div class="upload-area">
            <mat-icon class="upload-icon">cloud_upload</mat-icon>
            <p>Drag and drop files here or click to browse</p>
            <button mat-raised-button color="primary">
              <mat-icon>folder_open</mat-icon>
              Browse Files
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-container {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .page-card {
      margin-bottom: 24px;
    }
    
    .upload-area {
      border: 2px dashed #cbd5e1;
      border-radius: 8px;
      padding: 48px;
      text-align: center;
      margin: 24px 0;
      background: #f8fafc;
      transition: all 0.2s ease;
    }
    
    .upload-area:hover {
      border-color: #3b82f6;
      background: #f1f5f9;
    }
    
    .upload-area p {
      color: #64748b !important;
      font-size: 16px;
      margin: 16px 0;
    }
    
    .upload-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #94a3b8;
      margin-bottom: 16px;
    }
    
    mat-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #1e293b !important;
    }
    
    mat-card-subtitle {
      color: #64748b !important;
    }
  `]
})
export class UploadComponent {}