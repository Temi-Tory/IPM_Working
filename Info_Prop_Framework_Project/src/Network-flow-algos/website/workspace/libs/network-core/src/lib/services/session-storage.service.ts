import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of, throwError } from 'rxjs';
import {
  NetworkSession,
  NetworkGraph,
  DiamondAnalysisResult,
  ReachabilityResult,
  MonteCarloResult,
  WorkflowStep
} from '../models/network.models';

/**
 * Service for managing session data persistence across browser refreshes
 * Handles localStorage operations with error handling and data validation
 */
@Injectable({
  providedIn: 'root'
})
export class SessionStorageService {
  private readonly STORAGE_KEYS = {
    SESSION: 'network-analysis-session',
    WORKFLOW_STATE: 'network-analysis-workflow',
    USER_PREFERENCES: 'network-analysis-preferences',
    TEMP_DATA: 'network-analysis-temp'
  } as const;

  private readonly sessionSubject = new BehaviorSubject<NetworkSession | null>(null);
  private readonly storageAvailable: boolean;

  constructor() {
    this.storageAvailable = this.checkStorageAvailability();
    this.initializeSession();
  }

  /**
   * Get current session as observable
   */
  get session$(): Observable<NetworkSession | null> {
    return this.sessionSubject.asObservable();
  }

  /**
   * Get current session synchronously
   */
  get currentSession(): NetworkSession | null {
    return this.sessionSubject.value;
  }

  /**
   * Save complete session data
   */
  saveSession(session: NetworkSession): Observable<boolean> {
    if (!this.storageAvailable) {
      return throwError(() => new Error('Storage not available'));
    }

    try {
      const serializedSession = this.serializeSession(session);
      localStorage.setItem(this.STORAGE_KEYS.SESSION, serializedSession);
      this.sessionSubject.next(session);
      return of(true);
    } catch (error) {
      console.error('Failed to save session:', error);
      return throwError(() => error);
    }
  }

  /**
   * Load session from storage
   */
  loadSession(): Observable<NetworkSession | null> {
    if (!this.storageAvailable) {
      return of(null);
    }

    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.SESSION);
      if (!stored) {
        return of(null);
      }

      const session = this.deserializeSession(stored);
      if (this.isSessionValid(session)) {
        this.sessionSubject.next(session);
        return of(session);
      } else {
        this.clearSession();
        return of(null);
      }
    } catch (error) {
      console.error('Failed to load session:', error);
      this.clearSession();
      return of(null);
    }
  }

  /**
   * Update specific parts of the session
   */
  updateSession(updates: Partial<NetworkSession>): Observable<boolean> {
    const current = this.currentSession;
    if (!current) {
      return throwError(() => new Error('No active session to update'));
    }

    const updated: NetworkSession = {
      ...current,
      ...updates,
      lastAccessed: new Date()
    };

    return this.saveSession(updated);
  }

  /**
   * Clear session from storage
   */
  clearSession(): Observable<boolean> {
    try {
      if (this.storageAvailable) {
        localStorage.removeItem(this.STORAGE_KEYS.SESSION);
        localStorage.removeItem(this.STORAGE_KEYS.WORKFLOW_STATE);
        localStorage.removeItem(this.STORAGE_KEYS.TEMP_DATA);
      }
      this.sessionSubject.next(null);
      return of(true);
    } catch (error) {
      console.error('Failed to clear session:', error);
      return throwError(() => error);
    }
  }

  /**
   * Save workflow state separately for quick access
   */
  saveWorkflowState(currentStep: WorkflowStep, completedSteps: WorkflowStep[]): Observable<boolean> {
    if (!this.storageAvailable) {
      return of(false);
    }

    try {
      const workflowState = {
        currentStep,
        completedSteps,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(this.STORAGE_KEYS.WORKFLOW_STATE, JSON.stringify(workflowState));
      return of(true);
    } catch (error) {
      console.error('Failed to save workflow state:', error);
      return throwError(() => error);
    }
  }

  /**
   * Load workflow state
   */
  loadWorkflowState(): Observable<{ currentStep: WorkflowStep; completedSteps: WorkflowStep[] } | null> {
    if (!this.storageAvailable) {
      return of(null);
    }

    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.WORKFLOW_STATE);
      if (!stored) {
        return of(null);
      }

      const workflowState = JSON.parse(stored);
      return of({
        currentStep: workflowState.currentStep,
        completedSteps: workflowState.completedSteps
      });
    } catch (error) {
      console.error('Failed to load workflow state:', error);
      return of(null);
    }
  }

  /**
   * Save user preferences
   */
  saveUserPreferences(preferences: Record<string, any>): Observable<boolean> {
    if (!this.storageAvailable) {
      return of(false);
    }

    try {
      localStorage.setItem(this.STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(preferences));
      return of(true);
    } catch (error) {
      console.error('Failed to save user preferences:', error);
      return throwError(() => error);
    }
  }

  /**
   * Load user preferences
   */
  loadUserPreferences(): Observable<Record<string, any>> {
    if (!this.storageAvailable) {
      return of({});
    }

    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.USER_PREFERENCES);
      return of(stored ? JSON.parse(stored) : {});
    } catch (error) {
      console.error('Failed to load user preferences:', error);
      return of({});
    }
  }

  /**
   * Save temporary data (for form state, etc.)
   */
  saveTempData(key: string, data: any): Observable<boolean> {
    if (!this.storageAvailable) {
      return of(false);
    }

    try {
      const tempData = this.getTempDataStore();
      tempData[key] = {
        data,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(this.STORAGE_KEYS.TEMP_DATA, JSON.stringify(tempData));
      return of(true);
    } catch (error) {
      console.error('Failed to save temp data:', error);
      return throwError(() => error);
    }
  }

  /**
   * Load temporary data
   */
  loadTempData(key: string): Observable<any> {
    if (!this.storageAvailable) {
      return of(null);
    }

    try {
      const tempData = this.getTempDataStore();
      const item = tempData[key];
      
      if (!item) {
        return of(null);
      }

      // Check if data is not too old (1 hour)
      const timestamp = new Date(item.timestamp);
      const now = new Date();
      const hoursSince = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60);
      
      if (hoursSince > 1) {
        this.clearTempData(key);
        return of(null);
      }

      return of(item.data);
    } catch (error) {
      console.error('Failed to load temp data:', error);
      return of(null);
    }
  }

  /**
   * Clear specific temporary data
   */
  clearTempData(key: string): Observable<boolean> {
    if (!this.storageAvailable) {
      return of(false);
    }

    try {
      const tempData = this.getTempDataStore();
      delete tempData[key];
      localStorage.setItem(this.STORAGE_KEYS.TEMP_DATA, JSON.stringify(tempData));
      return of(true);
    } catch (error) {
      console.error('Failed to clear temp data:', error);
      return throwError(() => error);
    }
  }

  /**
   * Get storage usage information
   */
  getStorageInfo(): Observable<{ used: number; available: boolean; quota?: number }> {
    if (!this.storageAvailable) {
      return of({ used: 0, available: false });
    }

    try {
      let used = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          used += key.length + (value?.length || 0);
        }
      }

      return of({ used, available: true });
    } catch (error) {
      return of({ used: 0, available: false });
    }
  }

  /**
   * Clean up old or invalid data
   */
  cleanup(): Observable<boolean> {
    if (!this.storageAvailable) {
      return of(false);
    }

    try {
      // Clean up old temp data
      const tempData = this.getTempDataStore();
      const now = new Date();
      let cleaned = false;

      Object.keys(tempData).forEach(key => {
        const item = tempData[key];
        if (item.timestamp) {
          const timestamp = new Date(item.timestamp);
          const hoursSince = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60);
          
          if (hoursSince > 24) {
            delete tempData[key];
            cleaned = true;
          }
        }
      });

      if (cleaned) {
        localStorage.setItem(this.STORAGE_KEYS.TEMP_DATA, JSON.stringify(tempData));
      }

      // Check session validity
      const session = this.currentSession;
      if (session && !this.isSessionValid(session)) {
        this.clearSession();
      }

      return of(true);
    } catch (error) {
      console.error('Failed to cleanup storage:', error);
      return throwError(() => error);
    }
  }

  // Private helper methods

  private checkStorageAvailability(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  private initializeSession(): void {
    this.loadSession().subscribe({
      next: (session) => {
        if (session) {
          console.log('Session restored from storage');
        }
      },
      error: (error) => {
        console.error('Failed to initialize session:', error);
      }
    });
  }

  private serializeSession(session: NetworkSession): string {
    return JSON.stringify({
      ...session,
      createdAt: session.createdAt.toISOString(),
      lastAccessed: session.lastAccessed.toISOString()
    });
  }

  private deserializeSession(data: string): NetworkSession {
    const parsed = JSON.parse(data);
    return {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
      lastAccessed: new Date(parsed.lastAccessed)
    };
  }

  private isSessionValid(session: NetworkSession): boolean {
    // Check if session is not too old (24 hours)
    const now = new Date();
    const hoursSinceAccess = (now.getTime() - session.lastAccessed.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceAccess > 24) {
      return false;
    }

    // Check required fields
    if (!session.sessionId || !session.networkId) {
      return false;
    }

    return true;
  }

  private getTempDataStore(): Record<string, any> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.TEMP_DATA);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }
}