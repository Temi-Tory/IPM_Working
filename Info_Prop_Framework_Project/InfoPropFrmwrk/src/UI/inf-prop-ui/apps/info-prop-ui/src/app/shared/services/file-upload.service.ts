import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { UploadResponse } from '../models/network-analysis.models';

@Injectable({
  providedIn: 'root'
})
export class FileUploadService {
  private readonly API_BASE = 'http://localhost:8080';
  private http: HttpClient = inject(HttpClient);

  /**
   * Upload files to backend - ONLY uploads, no analysis
   */
  uploadFiles(files: FileList): Observable<UploadResponse> {
    console.log('📤 Uploading files to backend:', Array.from(files).map(f => f.name));
    
    const formData = new FormData();
    
    // Add all files to form data
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    return this.http.post<UploadResponse>(`${this.API_BASE}/upload`, formData).pipe(
      tap(response => {
        console.log('📤 Upload response:', response.success ? 'SUCCESS' : 'FAILED');
        if (response.success) {
          console.log('📁 Network path:', response.network_path);
          console.log('📄 Uploaded files:', response.uploaded_files.length);
          console.log('🔗 Edges files:', response.edges_files.length);
        } else {
          console.error('❌ Upload failed:', response.message);
        }
      }),
      catchError(error => {
        console.error('📤 Upload error:', error.message || error);
        throw error;
      })
    );
  }

  /**
   * Check if backend is available
   */
  checkBackendHealth(): Observable<{ status: string }> {
    return this.http.get<{ status: string }>(`${this.API_BASE}/health`).pipe(
      tap(response => {
        console.log('🏥 Backend health:', response.status);
      }),
      catchError(error => {
        console.error('🏥 Backend health check failed:', error);
        throw error;
      })
    );
  }
}