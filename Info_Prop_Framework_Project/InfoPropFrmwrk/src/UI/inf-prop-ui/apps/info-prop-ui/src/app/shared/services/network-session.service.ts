import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { NetworkStructure, AnalysisResponse, FileManagerState } from '../models/network-analysis.models';

export interface SessionData {
  sessionId: string;
  uploadId?: string;
  networkName?: string;
  timestamp: number;
  networkPath: string;
  networkData: NetworkStructure | null;
  analysisResults: AnalysisResponse | null;
  analysisHistory: AnalysisResponse[];
  parsedData?: any; // Raw parsed data from uploaded files
  fileManagerState?: FileManagerState; // NEW: File manager state
}

@Injectable({ providedIn: 'root' })
export class NetworkSessionService {
  private readonly API_BASE = 'http://localhost:8080';
  private readonly STORAGE_KEY = 'network-analysis-sessions';
  private readonly sessionsSubject = new BehaviorSubject<SessionData[]>([]);
  private currentSessionSubject = new BehaviorSubject<SessionData | null>(null);
  private http: HttpClient;
  
  readonly currentSession$: Observable<SessionData | null> = this.currentSessionSubject.asObservable();
  readonly sessions$: Observable<SessionData[]> = this.sessionsSubject.asObservable();

  constructor(http: HttpClient) {
    this.http = http;
  }

  createNewSession(networkPath: string, networkName?: string, sessionId?: string): SessionData {
    const sessionData: SessionData = {
      sessionId: sessionId || this.generateSessionId(),
      uploadId: sessionId,
      networkName,
      timestamp: Date.now(),
      networkPath,
      networkData: null,
      analysisResults: null,
      analysisHistory: []
    };

    this.currentSessionSubject.next(sessionData);
    this.saveSessionToStorage(sessionData);
    
    return sessionData;
  }

  updateSession(updates: Partial<SessionData>): void {
    const currentSession = this.currentSessionSubject.value;
    if (!currentSession) {
      console.warn('No active session to update');
      return;
    }

    const updatedSession = { ...currentSession, ...updates, timestamp: Date.now() };
    
    // Add to analysis history if we have new results
    if (updates.analysisResults && 
        updates.analysisResults !== currentSession.analysisResults) {
      updatedSession.analysisHistory = [...currentSession.analysisHistory, updates.analysisResults];
    }

    this.currentSessionSubject.next(updatedSession);
    this.saveSessionToStorage(updatedSession);
    this.persistSessionToBackend(updatedSession);
  }

  loadSession(sessionId: string): Observable<SessionData | null> {
    return this.http.get<any>(`${this.API_BASE}/sessions/${encodeURIComponent(sessionId)}`).pipe(
      map(response => {
        if (!response?.success || !response.session) {
          return null;
        }
        console.log('📥 LOADING SESSION FROM BACKEND:');
        console.log('  Session ID:', sessionId);
        console.log('  Raw backend response keys:', Object.keys(response.session));
        console.log('  file_manager_state in response:', !!response.session.file_manager_state);
        if (response.session.file_manager_state) {
          console.log('    - Type:', typeof response.session.file_manager_state);
          console.log('    - analysisGroups:', !!response.session.file_manager_state.analysisGroups);
          if (response.session.file_manager_state.analysisGroups) {
            console.log('      - reachability count:', response.session.file_manager_state.analysisGroups.reachability?.length ?? 0);
            console.log('      - capacity count:', response.session.file_manager_state.analysisGroups.capacity?.length ?? 0);
            console.log('      - cpm count:', response.session.file_manager_state.analysisGroups.cpm?.length ?? 0);
          }
        } else {
          console.warn('⚠️ file_manager_state NOT in backend response!');
        }
        const mapped = this.mapBackendSession(response.session);
        console.log('  Mapped fileManagerState:', !!mapped.fileManagerState);
        return mapped;
      }),
      tap(session => {
        if (session) {
          this.currentSessionSubject.next(session);
          this.saveSessionToStorage(session);
        }
      }),
      catchError(error => {
        console.error('Error loading backend session, falling back to local storage:', error);
        const fallback = this.getAllSessionsSync().find(s => s.sessionId === sessionId) || null;
        if (fallback) {
          this.currentSessionSubject.next(fallback);
        }
        return of(fallback);
      })
    );
  }

  getAllSessions(): Observable<SessionData[]> {
    return this.http.get<any>(`${this.API_BASE}/sessions`).pipe(
      map(response => {
        const rawSessions = response?.sessions || [];
        return rawSessions.map((item: any) => this.mapBackendSessionSummary(item));
      }),
      tap(sessions => {
        this.sessionsSubject.next(sessions);
        this.saveAllSessionsToStorage(sessions);
      }),
      catchError(error => {
        console.error('Error loading backend sessions, falling back to local storage:', error);
        const fallback = this.getAllSessionsSync();
        this.sessionsSubject.next(fallback);
        return of(fallback);
      })
    );
  }

  deleteSession(sessionId: string): Observable<boolean> {
    return this.http.delete<any>(`${this.API_BASE}/sessions/${encodeURIComponent(sessionId)}`).pipe(
      map(response => !!response?.success),
      tap((success) => {
        if (!success) return;
        const sessions = this.getAllSessionsSync().filter(s => s.sessionId !== sessionId);
        this.saveAllSessionsToStorage(sessions);
        this.sessionsSubject.next(sessions);

        const currentSession = this.currentSessionSubject.value;
        if (currentSession && currentSession.sessionId === sessionId) {
          this.currentSessionSubject.next(null);
        }
      }),
      catchError(error => {
        console.error('Error deleting backend session:', error);
        return of(false);
      })
    );
  }

  clearCurrentSession(): void {
    this.currentSessionSubject.next(null);
  }

  exportSession(sessionId?: string): string {
    const session = sessionId ? 
      this.getAllSessionsSync().find(s => s.sessionId === sessionId) :
      this.currentSessionSubject.value;

    if (!session) {
      throw new Error('No session found to export');
    }

    return JSON.stringify(session, null, 2);
  }

  importSession(sessionData: string): SessionData {
    try {
      const session: SessionData = JSON.parse(sessionData);
      
      // Generate new session ID to avoid conflicts
      session.sessionId = this.generateSessionId();
      session.timestamp = Date.now();
      
      this.saveSessionToStorage(session);
      this.currentSessionSubject.next(session);
      
      return session;
    } catch (error) {
      throw new Error('Invalid session data format');
    }
  }

  private saveSessionToStorage(session: SessionData): void {
    try {
      const sessions = this.getAllSessionsSync();
      const existingIndex = sessions.findIndex(s => s.sessionId === session.sessionId);
      
      if (existingIndex >= 0) {
        sessions[existingIndex] = session;
      } else {
        sessions.push(session);
      }

      // Keep only the last 10 sessions to prevent storage bloat
      if (sessions.length > 10) {
        sessions.sort((a, b) => b.timestamp - a.timestamp);
        sessions.splice(10);
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessions));
      this.sessionsSubject.next(sessions);
    } catch (error) {
      console.error('Error saving session to storage:', error);
    }
  }

  private saveAllSessionsToStorage(sessions: SessionData[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error('Error saving sessions to storage:', error);
    }
  }

  private getAllSessionsSync(): SessionData[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading sessions from storage:', error);
      return [];
    }
  }

  private persistSessionToBackend(session: SessionData): void {
    const payload = {
      network_path: session.networkPath,
      network_name: session.networkName,
      network_data: session.networkData,
      analysis_results: session.analysisResults,
      analysis_history: session.analysisHistory,
      parsed_data: session.parsedData,
      file_manager_state: session.fileManagerState
    };

    console.log('📤 SAVING SESSION TO BACKEND:');
    console.log('  Session ID:', session.sessionId);
    console.log('  fileManagerState in session object:', !!session.fileManagerState);
    if (session.fileManagerState) {
      console.log('    - uploadedFiles count:', session.fileManagerState.uploadedFiles?.length ?? 0);
      console.log('    - analysisGroups.reachability:', session.fileManagerState.analysisGroups?.reachability?.length ?? 0);
      console.log('    - analysisGroups.capacity:', session.fileManagerState.analysisGroups?.capacity?.length ?? 0);
      console.log('    - analysisGroups.cpm:', session.fileManagerState.analysisGroups?.cpm?.length ?? 0);
    }
    console.log('  Payload keys:', Object.keys(payload));
    console.log('  Full payload fileManagerState:', payload.file_manager_state);

    this.http.put<any>(`${this.API_BASE}/sessions/${encodeURIComponent(session.sessionId)}`, payload).pipe(
      tap((response) => {
        console.log('✅ PUT /sessions response:', response);
        if (response?.session?.file_manager_state) {
          console.log('✅ Backend confirmed fileManagerState saved:', {
            reachability: response.session.file_manager_state.analysisGroups?.reachability?.length,
            capacity: response.session.file_manager_state.analysisGroups?.capacity?.length,
            cpm: response.session.file_manager_state.analysisGroups?.cpm?.length
          });
        }
      }),
      catchError(error => {
        console.error('Error persisting session to backend:', error);
        return of(null);
      })
    ).subscribe();
  }

  private mapBackendSessionSummary(item: any): SessionData {
    return {
      sessionId: item.session_id || item.upload_id,
      uploadId: item.upload_id || item.session_id,
      networkName: item.network_name,
      timestamp: Date.parse(item.timestamp || '') || Date.now(),
      networkPath: item.network_path || '',
      networkData: null,
      analysisResults: null,
      analysisHistory: []
    };
  }

  private mapBackendSession(item: any): SessionData {
    const mapped: SessionData = {
      sessionId: item.session_id || item.upload_id,
      uploadId: item.upload_id || item.session_id,
      networkName: item.network_name,
      timestamp: Date.parse(item.updated_at || item.created_at || '') || Date.now(),
      networkPath: item.network_path || '',
      networkData: item.network_data ?? null,
      analysisResults: item.analysis_results ?? null,
      analysisHistory: item.analysis_history ?? [],
      parsedData: item.parsed_data,
      fileManagerState: item.file_manager_state
    };
    
    console.log('  mapBackendSession mapping:');
    console.log('    - session_id:', item.session_id);
    console.log('    - file_manager_state from item:', !!item.file_manager_state);
    console.log('    - mapped.fileManagerState:', !!mapped.fileManagerState);
    
    return mapped;
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getCurrentSession(): SessionData | null {
    return this.currentSessionSubject.value;
  }

  hasActiveSession(): boolean {
    return this.currentSessionSubject.value !== null;
  }
}