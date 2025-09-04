import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { NetworkStructure, AnalysisResponse, FileManagerState } from '../models/network-analysis.models';

export interface SessionData {
  sessionId: string;
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
  private readonly STORAGE_KEY = 'network-analysis-sessions';
  private currentSessionSubject = new BehaviorSubject<SessionData | null>(null);
  
  readonly currentSession$: Observable<SessionData | null> = this.currentSessionSubject.asObservable();

  createNewSession(networkPath: string): SessionData {
    const sessionData: SessionData = {
      sessionId: this.generateSessionId(),
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
  }

  loadSession(sessionId: string): SessionData | null {
    const sessions = this.getAllSessions();
    const session = sessions.find(s => s.sessionId === sessionId);
    
    if (session) {
      this.currentSessionSubject.next(session);
    }
    
    return session || null;
  }

  getAllSessions(): SessionData[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading sessions from storage:', error);
      return [];
    }
  }

  deleteSession(sessionId: string): void {
    const sessions = this.getAllSessions().filter(s => s.sessionId !== sessionId);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessions));

    // Clear current session if it's the one being deleted
    const currentSession = this.currentSessionSubject.value;
    if (currentSession && currentSession.sessionId === sessionId) {
      this.currentSessionSubject.next(null);
    }
  }

  clearCurrentSession(): void {
    this.currentSessionSubject.next(null);
  }

  exportSession(sessionId?: string): string {
    const session = sessionId ? 
      this.getAllSessions().find(s => s.sessionId === sessionId) :
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
      const sessions = this.getAllSessions();
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
    } catch (error) {
      console.error('Error saving session to storage:', error);
    }
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