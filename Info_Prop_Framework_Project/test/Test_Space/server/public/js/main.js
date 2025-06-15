// main.js - Main entry point and initialization
import { DOMManager } from './managers/dom-manager.js';
import { FileManager } from './managers/file-manager.js';
import { AnalysisManager } from './managers/analysis-manager.js';
import { DiamondManager } from './managers/diamond-manager.js';
import { VisualizationManager } from './managers/visualization-manager.js';
import { TabManager } from './managers/tab-manager.js';
import { ExportManager } from './managers/export-manager.js';
import { StateManager } from './managers/state-manager.js';
import { UIUtils } from './utils/ui-utils.js';

// Global state
export const AppState = {
    currentFile: null,
    analysisResults: null,
    networkData: null,
    diamondData: null,
    monteCarloResults: null,
    selectedNode: null,
    originalNodePriors: null,
    originalEdgeProbabilities: null,
    currentDiamondData: null,
    pathNetworkInstance: null
};

// Global managers reference
let managers = null;

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    console.log('Enhanced Network Analysis Tool loading...');
    
    try {
        // Initialize managers
        const domManager = new DOMManager();
        const fileManager = new FileManager(domManager);
        const analysisManager = new AnalysisManager(domManager);
        const diamondManager = new DiamondManager(domManager);
        const visualizationManager = new VisualizationManager(domManager);
        const tabManager = new TabManager(domManager);
        const exportManager = new ExportManager(domManager);
        const stateManager = new StateManager();
        
        // Store managers globally
        managers = {
            dom: domManager,
            file: fileManager,
            analysis: analysisManager,
            diamond: diamondManager,
            visualization: visualizationManager,
            tab: tabManager,
            export: exportManager,
            state: stateManager
        };
        
        // Verify critical DOM elements
        const elementsValid = domManager.verifyElements();
        if (!elementsValid) {
            console.warn('Some DOM elements are missing - functionality may be limited');
        }
        
        // Initialize all event listeners
        console.log('Initializing event listeners...');
        fileManager.initializeEventListeners();
        analysisManager.initializeEventListeners();
        diamondManager.initializeEventListeners();
        visualizationManager.initializeEventListeners();
        tabManager.initializeEventListeners();
        exportManager.initializeEventListeners();
        
        // Initialize UI states
        UIUtils.updateAllCheckboxStates();
        
        // Make managers globally available for cross-module communication
        window.AppManagers = managers;
        
        // Setup global functions for HTML onclick handlers
        setupGlobalFunctions();
        
        console.log('✅ All managers initialized successfully');
        console.log('🚀 Enhanced Network Analysis Tool ready');
        
    } catch (error) {
        console.error('❌ Error initializing application:', error);
        
        // Show error to user
        const container = document.querySelector('.container');
        if (container) {
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'background: #f8d7da; color: #721c24; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #f5c6cb;';
            errorDiv.innerHTML = `
                <h3>Initialization Error</h3>
                <p>Failed to initialize the application: ${error.message}</p>
                <p>Please refresh the page and try again.</p>
            `;
            container.insertBefore(errorDiv, container.firstChild);
        }
    }
});

// Setup global functions that need to be accessible from HTML onclick handlers
function setupGlobalFunctions() {
    console.log('Setting up global functions...');
    
    // Visualization functions
    window.focusOnNode = function(nodeId) {
        console.log('Global focusOnNode called for node:', nodeId);
        if (managers?.visualization) {
            managers.visualization.focusOnNode(nodeId);
        } else {
            console.error('Visualization manager not available');
        }
    };

    // Diamond analysis functions
    window.showNodeDiamonds = function(nodeId) {
        console.log('Global showNodeDiamonds called for node:', nodeId);
        if (managers?.diamond) {
            managers.diamond.showNodeDiamonds(nodeId);
        } else {
            console.error('Diamond manager not available');
        }
    };

    window.showDiamondDetail = function(joinNode, diamondIndex) {
        console.log('Global showDiamondDetail called for join node:', joinNode, 'index:', diamondIndex);
        if (managers?.diamond) {
            managers.diamond.showDiamondDetail(joinNode, diamondIndex);
        } else {
            console.error('Diamond manager not available');
        }
    };

    window.focusOnDiamondInViz = function(joinNode) {
        console.log('Global focusOnDiamondInViz called for join node:', joinNode);
        if (managers?.diamond) {
            managers.diamond.focusOnDiamondInViz(joinNode);
        } else {
            console.error('Diamond manager not available');
        }
    };

    window.analyzeDiamondPaths = function(joinNode) {
        console.log('Global analyzeDiamondPaths called for join node:', joinNode);
        if (managers?.diamond) {
            managers.diamond.analyzeDiamondPaths(joinNode);
        } else {
            console.error('Diamond manager not available');
        }
    };

    window.showDiamondForJoin = function(joinNode) {
        console.log('Global showDiamondForJoin called for join node:', joinNode);
        if (managers?.diamond) {
            managers.diamond.showDiamondForJoin(joinNode);
        } else {
            console.error('Diamond manager not available');
        }
    };

    // Ancestor/descendant highlighting functions
    window.highlightAncestors = function(nodeId) {
        console.log('Global highlightAncestors called for node:', nodeId);
        if (managers?.visualization) {
            managers.visualization.highlightAncestors(nodeId);
        } else {
            console.error('Visualization manager not available');
        }
    };

    window.highlightDescendants = function(nodeId) {
        console.log('Global highlightDescendants called for node:', nodeId);
        if (managers?.visualization) {
            managers.visualization.highlightDescendants(nodeId);
        } else {
            console.error('Visualization manager not available');
        }
    };

    // Modal control functions
    window.closeDiamondPathModal = function() {
        console.log('Global closeDiamondPathModal called');
        if (managers?.diamond) {
            managers.diamond.closeDiamondPathModal();
        } else {
            console.error('Diamond manager not available');
        }
    };

    window.closeDiamondDetailModal = function() {
        console.log('Global closeDiamondDetailModal called');
        if (managers?.diamond) {
            managers.diamond.closeModal('diamondDetailModal');
        } else {
            console.error('Diamond manager not available');
        }
    };

    // Generic modal close function
    window.closeModal = function(modalId) {
        console.log('Global closeModal called for:', modalId);
        if (managers?.diamond) {
            managers.diamond.closeModal(modalId);
        } else {
            console.error('Diamond manager not available');
            // Fallback - try to close modal directly
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.style.display = 'none';
            }
        }
    };

    // Export functions
    window.exportResults = function() {
        console.log('Global exportResults called');
        if (managers?.export) {
            managers.export.exportResults();
        } else {
            console.error('Export manager not available');
        }
    };

    window.exportDiamondAnalysis = function() {
        console.log('Global exportDiamondAnalysis called');
        if (managers?.export) {
            managers.export.exportDiamondAnalysis();
        } else {
            console.error('Export manager not available');
        }
    };

    // State management functions
    window.saveCurrentState = function(description) {
        console.log('Global saveCurrentState called');
        if (managers?.state) {
            managers.state.saveState(description || 'Manual save');
        } else {
            console.error('State manager not available');
        }
    };

    window.resetApplication = function() {
        console.log('Global resetApplication called');
        if (managers?.state) {
            managers.state.clearCurrentState();
            // Refresh the page or reset UI
            location.reload();
        } else {
            console.error('State manager not available');
        }
    };

    // Debug functions (useful for development)
    window.debugAppState = function() {
        console.log('=== Current Application State ===');
        console.log('AppState:', AppState);
        console.log('Managers:', managers);
        if (managers?.state) {
            console.log('State Summary:', managers.state.getStateSummary());
        }
        return AppState;
    };

    window.debugNetworkData = function() {
        console.log('=== Network Data Debug ===');
        console.log('Network Data:', AppState.networkData);
        console.log('Diamond Data:', AppState.diamondData);
        console.log('Analysis Results:', AppState.analysisResults);
        return {
            networkData: AppState.networkData,
            diamondData: AppState.diamondData,
            analysisResults: AppState.analysisResults
        };
    };

    console.log('✅ Global functions setup complete');
}

// Global modal click handler (fallback for any modal clicks not handled elsewhere)
window.onclick = function(event) {
    try {
        // Handle modal backdrop clicks
        if (event.target.classList.contains('modal')) {
            const modalId = event.target.id;
            if (modalId) {
                console.log('Modal backdrop clicked:', modalId);
                window.closeModal(modalId);
            }
        }
        
        // Handle close button clicks
        if (event.target.classList.contains('close')) {
            const modal = event.target.closest('.modal');
            if (modal) {
                console.log('Close button clicked for modal:', modal.id);
                window.closeModal(modal.id);
            }
        }
        
        // Let diamond manager handle its specific modal clicks too
        if (managers?.diamond) {
            managers.diamond.handleModalClicks(event);
        }
    } catch (error) {
        console.error('Error in global modal click handler:', error);
    }
};

// Global keyboard handler
document.addEventListener('keydown', function(event) {
    try {
        // Escape key closes any open modals
        if (event.key === 'Escape') {
            const openModals = document.querySelectorAll('.modal[style*="block"]');
            openModals.forEach(modal => {
                if (modal.id) {
                    console.log('Escape pressed - closing modal:', modal.id);
                    window.closeModal(modal.id);
                }
            });
        }
        
        // Ctrl+S saves current state (prevent default browser save)
        if (event.ctrlKey && event.key === 's') {
            event.preventDefault();
            window.saveCurrentState('Keyboard shortcut save');
        }
        
        // F5 or Ctrl+R - let default behavior happen but log it
        if (event.key === 'F5' || (event.ctrlKey && event.key === 'r')) {
            console.log('Page refresh triggered');
        }
        
    } catch (error) {
        console.error('Error in global keyboard handler:', error);
    }
});

// Global error handler
window.addEventListener('error', function(event) {
    console.error('Global error caught:', event.error);
    
    // Show user-friendly error for critical failures
    if (event.error && event.error.message) {
        const message = event.error.message;
        if (message.includes('vis') || message.includes('network') || message.includes('visualization')) {
            console.error('Visualization error - check vis.js library loading');
        }
    }
});

// Export managers for external access (useful for debugging)
export { managers };

// Development helper - expose AppState globally in development
if (typeof window !== 'undefined') {
    window.AppState = AppState;
}