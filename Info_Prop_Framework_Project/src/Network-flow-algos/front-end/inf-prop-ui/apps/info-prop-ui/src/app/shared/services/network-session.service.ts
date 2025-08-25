import { Injectable, signal } from '@angular/core';
import { 
  NetworkAnalysisRequest,
  DetectedNetworkStructure,
  AnalysisConfiguration,
  NetworkAnalysisResponse
} from '../models/network-analysis.models';

export interface NetworkSession {
  networkName: string;
  structure: DetectedNetworkStructure;
  analysisConfig: AnalysisConfiguration;
  uploadedAt: string;
  // Store file references as serializable data
  fileData: {
    edgesFileName: string;
    nodeMappingFileName?: string;
    inferenceFiles?: {
      dataType: string;
      nodepriorFileName: string;
      linkprobabilitiesFileName: string;
    };
    capacityFileName?: string;
    criticalPathFileName?: string;
  };
  // For development - store actual files (not serializable to session storage)
  files?: {
    edges: File;
    nodeMapping?: File;
    inference?: {
      nodepriors: File;
      linkprobabilities: File;
    };
    capacity?: File;
    criticalPath?: File;
  };
  // Analysis results from backend
  analysisResults?: NetworkAnalysisResponse;
  analysisCompletedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NetworkSessionService {
  private readonly SESSION_KEY = 'ipf_network_session';
  
  // Signal for reactive state management
  currentNetwork = signal<NetworkSession | null>(null);
  
  constructor() {
    // Load from session storage on service initialization
    this.loadFromSessionStorage();
  }

  saveNetworkSession(
    structure: DetectedNetworkStructure,
    analysisConfig: AnalysisConfiguration,
    files: NetworkAnalysisRequest['files']
  ): void {
    
    const session: NetworkSession = {
      networkName: structure.networkName,
      structure: {
        ...structure,
        // Don't store actual File objects in structure
        detectedFiles: {
          edges: structure.detectedFiles.edges ? {
            ...structure.detectedFiles.edges,
            file: undefined as any // Remove file reference
          } : undefined,
          nodeMapping: structure.detectedFiles.nodeMapping ? {
            ...structure.detectedFiles.nodeMapping,
            file: undefined as any
          } : undefined,
          // Handle inference files
          inference: structure.detectedFiles.inference ? 
            Object.fromEntries(
              Object.entries(structure.detectedFiles.inference).map(([key, value]) => [
                key,
                value ? {
                  nodepriors: value.nodepriors ? { ...value.nodepriors, file: undefined as any } : undefined,
                  linkprobabilities: value.linkprobabilities ? { ...value.linkprobabilities, file: undefined as any } : undefined
                } : undefined
              ])
            ) : undefined,
          capacity: structure.detectedFiles.capacity ? {
            ...structure.detectedFiles.capacity,
            file: undefined as any
          } : undefined,
          criticalPath: structure.detectedFiles.criticalPath ? {
            ...structure.detectedFiles.criticalPath,
            file: undefined as any
          } : undefined
        }
      },
      analysisConfig,
      uploadedAt: new Date().toISOString(),
      fileData: {
        edgesFileName: files.edges.name,
        nodeMappingFileName: files.nodeMapping?.name,
        inferenceFiles: files.inference ? {
          dataType: files.inference.dataType,
          nodepriorFileName: files.inference.nodepriors.name,
          linkprobabilitiesFileName: files.inference.linkprobabilities.name
        } : undefined,
        capacityFileName: files.capacity?.capacities.name,
        criticalPathFileName: files.criticalPath?.cpmInputs.name
      },
      // Store actual files for runtime use (won't be serialized)
      files: {
        edges: files.edges,
        nodeMapping: files.nodeMapping,
        inference: files.inference ? {
          nodepriors: files.inference.nodepriors,
          linkprobabilities: files.inference.linkprobabilities
        } : undefined,
        capacity: files.capacity?.capacities,
        criticalPath: files.criticalPath?.cpmInputs
      }
    };

    // Update signal
    this.currentNetwork.set(session);
    
    // Save to session storage (without files)
    const serializable = { ...session };
    delete serializable.files; // Remove non-serializable files
    
    try {
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(serializable));
    } catch (error) {
      console.warn('Failed to save network session to storage:', error);
    }
  }

  getCurrentNetwork(): NetworkSession | null {
    return this.currentNetwork();
  }

  hasActiveSession(): boolean {
    return !!this.currentNetwork();
  }

  clearSession(): void {
    this.currentNetwork.set(null);
    try {
      sessionStorage.removeItem(this.SESSION_KEY);
    } catch (error) {
      console.warn('Failed to clear network session:', error);
    }
  }

  private loadFromSessionStorage(): void {
    try {
      const stored = sessionStorage.getItem(this.SESSION_KEY);
      if (stored) {
        const session: NetworkSession = JSON.parse(stored);
        // Restore the session (without files - those need to be re-uploaded)
        this.currentNetwork.set(session);
      }
    } catch (error) {
      console.warn('Failed to load network session from storage:', error);
      // Clear corrupted data
      sessionStorage.removeItem(this.SESSION_KEY);
    }
  }

  // Helper methods for UI
  getNetworkName(): string | null {
    return this.currentNetwork()?.networkName || null;
  }

  canRunAnalysis(analysisType: keyof AnalysisConfiguration): boolean {
    const session = this.currentNetwork();
    if (!session) return false;

    switch (analysisType) {
      case 'exactInference':
        return session.structure.availableDataTypes.length > 0;
      case 'flowAnalysis':
        return session.structure.hasCapacityData;
      case 'criticalPathAnalysis':
        return session.structure.hasCPMData;
      case 'basicStructure':
      case 'diamondAnalysis':
        return session.structure.hasEdgesFile;
      default:
        return false;
    }
  }

  getEnabledAnalyses(): string[] {
    const session = this.currentNetwork();
    if (!session) return [];

    const enabled: string[] = [];
    
    if (session.analysisConfig.basicStructure) enabled.push('Network Structure');
    if (session.analysisConfig.diamondAnalysis) enabled.push('Diamond Analysis');
    if (session.analysisConfig.exactInference) enabled.push('Exact Inference');
    if (session.analysisConfig.flowAnalysis) enabled.push('Flow Analysis');
    if (session.analysisConfig.criticalPathAnalysis) enabled.push('Critical Path Analysis');
    
    return enabled;
  }

  saveAnalysisResults(results: NetworkAnalysisResponse): void {
    const currentSession = this.currentNetwork();
    if (!currentSession) {
      console.warn('Cannot save analysis results: no active session');
      return;
    }

    const updatedSession: NetworkSession = {
      ...currentSession,
      analysisResults: results,
      analysisCompletedAt: new Date().toISOString()
    };

    // Update signal
    this.currentNetwork.set(updatedSession);
    
    // Save to session storage (without files)
    const serializable = { ...updatedSession };
    delete serializable.files; // Remove non-serializable files
    
    try {
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(serializable));
    } catch (error) {
      console.warn('Failed to save analysis results to storage:', error);
    }
  }

  hasAnalysisResults(): boolean {
    const session = this.currentNetwork();
    return !!(session?.analysisResults?.success);
  }

  getAnalysisResults(): NetworkAnalysisResponse | null {
    return this.currentNetwork()?.analysisResults || null;
  }

  // For debugging - get session info
  getSessionInfo(): any {
    const session = this.currentNetwork();
    if (!session) return null;
    
    return {
      networkName: session.networkName,
      uploadedAt: session.uploadedAt,
      analysisCompletedAt: session.analysisCompletedAt,
      hasFiles: !!session.files,
      hasAnalysisResults: this.hasAnalysisResults(),
      enabledAnalyses: this.getEnabledAnalyses(),
      structure: {
        hasEdges: session.structure.hasEdgesFile,
        hasMapping: session.structure.hasNodeMapping,
        dataTypes: session.structure.availableDataTypes,
        hasCapacity: session.structure.hasCapacityData,
        hasCPM: session.structure.hasCPMData
      }
    };
  }
}