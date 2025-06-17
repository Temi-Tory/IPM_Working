// state-manager.js - Application state management
import { AppState } from '../main.js';

export class StateManager {
    constructor() {
        this.stateHistory = [];
        this.maxHistorySize = 10;
    }

    // Save current state to history
    saveState(description = '') {
        const currentState = {
            timestamp: new Date().toISOString(),
            description: description,
            analysisResults: AppState.analysisResults ? JSON.parse(JSON.stringify(AppState.analysisResults)) : null,
            networkData: AppState.networkData ? JSON.parse(JSON.stringify(AppState.networkData)) : null,
            diamondData: AppState.diamondData ? JSON.parse(JSON.stringify(AppState.diamondData)) : null,
            monteCarloResults: AppState.monteCarloResults ? JSON.parse(JSON.stringify(AppState.monteCarloResults)) : null,
            selectedNode: AppState.selectedNode,
            currentDiamondData: AppState.currentDiamondData ? JSON.parse(JSON.stringify(AppState.currentDiamondData)) : null
        };
        
        this.stateHistory.push(currentState);
        
        // Keep only the last N states
        if (this.stateHistory.length > this.maxHistorySize) {
            this.stateHistory.shift();
        }
        
        console.log(`State saved: ${description}`, currentState);
    }

    // Restore state from history
    restoreState(index = -1) {
        if (this.stateHistory.length === 0) {
            console.warn('No saved states available');
            return false;
        }
        
        const stateIndex = index < 0 ? this.stateHistory.length + index : index;
        if (stateIndex < 0 || stateIndex >= this.stateHistory.length) {
            console.warn('Invalid state index');
            return false;
        }
        
        const savedState = this.stateHistory[stateIndex];
        
        AppState.analysisResults = savedState.analysisResults;
        AppState.networkData = savedState.networkData;
        AppState.diamondData = savedState.diamondData;
        AppState.monteCarloResults = savedState.monteCarloResults;
        AppState.selectedNode = savedState.selectedNode;
        AppState.currentDiamondData = savedState.currentDiamondData;
        
        console.log(`State restored: ${savedState.description}`, savedState);
        return true;
    }

    // Get state history
    getStateHistory() {
        return this.stateHistory.map((state, index) => ({
            index: index,
            timestamp: state.timestamp,
            description: state.description,
            hasAnalysisResults: !!state.analysisResults,
            hasNetworkData: !!state.networkData,
            hasDiamondData: !!state.diamondData
        }));
    }

    // Clear all saved states
    clearHistory() {
        this.stateHistory = [];
        console.log('State history cleared');
    }

    // Clear current application state
    clearCurrentState() {
        AppState.currentFile = null;
        AppState.analysisResults = null;
        AppState.networkData = null;
        AppState.diamondData = null;
        AppState.monteCarloResults = null;
        AppState.selectedNode = null;
        AppState.originalNodePriors = null;
        AppState.originalEdgeProbabilities = null;
        AppState.currentDiamondData = null;
        AppState.pathNetworkInstance = null;
        
        console.log('Current application state cleared');
    }

    // Export current state
    exportState() {
        const stateData = {
            timestamp: new Date().toISOString(),
            version: '1.0',
            analysisResults: AppState.analysisResults,
            networkData: AppState.networkData,
            diamondData: AppState.diamondData,
            monteCarloResults: AppState.monteCarloResults,
            originalData: {
                nodePriors: AppState.originalNodePriors,
                edgeProbabilities: AppState.originalEdgeProbabilities
            }
        };
        
        return JSON.stringify(stateData, null, 2);
    }

    // Import state from JSON
    importState(jsonString) {
        try {
            const stateData = JSON.parse(jsonString);
            
            if (!stateData.version) {
                console.warn('Importing state without version information');
            }
            
            AppState.analysisResults = stateData.analysisResults || null;
            AppState.networkData = stateData.networkData || null;
            AppState.diamondData = stateData.diamondData || null;
            AppState.monteCarloResults = stateData.monteCarloResults || null;
            
            if (stateData.originalData) {
                AppState.originalNodePriors = stateData.originalData.nodePriors || null;
                AppState.originalEdgeProbabilities = stateData.originalData.edgeProbabilities || null;
            }
            
            console.log('State imported successfully', stateData);
            return true;
        } catch (err) {
            console.error('Failed to import state:', err);
            return false;
        }
    }

    // Validate current state
    validateState() {
        const validation = {
            isValid: true,
            issues: []
        };
        
        if (AppState.analysisResults && !AppState.networkData) {
            validation.isValid = false;
            validation.issues.push('Analysis results exist but network data is missing');
        }
        
        if (AppState.diamondData && !AppState.analysisResults) {
            validation.isValid = false;
            validation.issues.push('Diamond data exists but analysis results are missing');
        }
        
        if (AppState.monteCarloResults && !AppState.analysisResults) {
            validation.isValid = false;
            validation.issues.push('Monte Carlo results exist but analysis results are missing');
        }
        
        return validation;
    }

    // Get current state summary
    getStateSummary() {
        return {
            hasFile: !!AppState.currentFile,
            hasAnalysisResults: !!AppState.analysisResults,
            hasNetworkData: !!AppState.networkData,
            hasDiamondData: !!AppState.diamondData,
            hasMonteCarloResults: !!AppState.monteCarloResults,
            selectedNode: AppState.selectedNode,
            currentDiamondData: !!AppState.currentDiamondData,
            stateHistoryCount: this.stateHistory.length
        };
    }
}