// file-manager.js - Enhanced file handling with parameter integration
import { UIUtils } from '../utils/ui-utils.js';
import { AppState } from '../main.js';

export class FileManager {
    constructor(domManager, parameterManager = null) {
        this.dom = domManager;
        this.parameterManager = parameterManager;
    }

    initializeEventListeners() {
        // File input handler
        this.dom.safeAddEventListener('fileInput', 'change', (event) => {
            this.handleFileUpload(event);
        });
        
        // Initialize parameter controls
        UIUtils.setupParameterControls(this.dom);
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        this.dom.hideElements(['results', 'error', 'diamondAnalysis']);
        
        if (!file) {
            AppState.currentFile = null;
            this.dom.setElementDisabled('analyzeBtn', true);
            this.dom.updateFileStatus('No file selected', 'file-error');
            this.updateParameterEditingAvailability();
            return;
        }
        
        if (!file.name.toLowerCase().endsWith('.csv')) {
            AppState.currentFile = null;
            this.dom.setElementDisabled('analyzeBtn', true);
            this.dom.updateFileStatus('Please select a CSV file', 'file-error');
            this.updateParameterEditingAvailability();
            return;
        }
        
        AppState.currentFile = file;
        this.dom.setElementDisabled('analyzeBtn', false);
        this.dom.updateFileStatus(
            `File loaded: ${file.name} (${UIUtils.formatFileSize(file.size)})`, 
            'file-success'
        );
        
        // Update parameter editing availability
        this.updateParameterEditingAvailability();
        
        console.log('File loaded:', file.name);
    }

    updateParameterEditingAvailability() {
        // Update parameter editing buttons based on file availability
        if (this.parameterManager) {
            this.parameterManager.updateParameterEditingAvailability();
        }
    }

    getCurrentFile() {
        return AppState.currentFile;
    }

    async readCurrentFileAsText() {
        if (!AppState.currentFile) {
            throw new Error('No file selected');
        }
        return await UIUtils.readFileAsText(AppState.currentFile);
    }

    getAnalysisRequestData() {
        const baseData = {
            csvContent: null, // Will be set by the caller
            nodePrior: this.dom.getElementValue('nodePriorSlider') ? 
                parseFloat(this.dom.getElementValue('nodePriorSlider')) : 1.0,
            edgeProb: this.dom.getElementValue('edgeProbSlider') ? 
                parseFloat(this.dom.getElementValue('edgeProbSlider')) : 0.9,
            overrideNodePrior: this.dom.isElementChecked('overrideNodePrior'),
            overrideEdgeProb: this.dom.isElementChecked('overrideEdgeProb'),
            includeClassification: this.dom.isElementChecked('includeClassification'),
            enableMonteCarlo: this.dom.isElementChecked('enableMonteCarlo')
        };

        // Add individual parameter overrides if parameter manager is available
        if (this.parameterManager) {
            const individualNodePriors = this.parameterManager.getIndividualNodePriorOverrides();
            const individualEdgeProbs = this.parameterManager.getIndividualEdgeProbabilityOverrides();
            
            // Only include individual overrides if we have any
            if (Object.keys(individualNodePriors).length > 0 || Object.keys(individualEdgeProbs).length > 0) {
                baseData.individualNodePriors = individualNodePriors;
                baseData.individualEdgeProbabilities = individualEdgeProbs;
                baseData.useIndividualOverrides = true;
                
                console.log('Including individual parameter overrides:', {
                    nodeOverrides: Object.keys(individualNodePriors).length,
                    edgeOverrides: Object.keys(individualEdgeProbs).length
                });
            }
        }

        return baseData;
    }

    getDiamondAnalysisRequestData() {
        const baseData = {
            overrideNodePrior: this.dom.isElementChecked('pathOverrideNodes'),
            overrideEdgeProb: this.dom.isElementChecked('pathOverrideEdges'),
            nodePrior: parseFloat(this.dom.getElementValue('pathNodePrior') || '1.0'),
            edgeProb: parseFloat(this.dom.getElementValue('pathEdgeProb') || '0.9')
        };

        // Add diamond-specific individual parameter overrides
        if (this.parameterManager) {
            const diamondNodePriors = this.parameterManager.getDiamondIndividualNodePriorOverrides();
            const diamondEdgeProbs = this.parameterManager.getDiamondIndividualEdgeProbabilityOverrides();
            
            if (Object.keys(diamondNodePriors).length > 0 || Object.keys(diamondEdgeProbs).length > 0) {
                baseData.individualNodePriors = diamondNodePriors;
                baseData.individualEdgeProbabilities = diamondEdgeProbs;
                baseData.useIndividualOverrides = true;
                
                console.log('Including diamond individual parameter overrides:', {
                    nodeOverrides: Object.keys(diamondNodePriors).length,
                    edgeOverrides: Object.keys(diamondEdgeProbs).length
                });
            }
        }

        return baseData;
    }

    isFileLoaded() {
        return AppState.currentFile !== null;
    }

    getFileName() {
        return AppState.currentFile ? AppState.currentFile.name : null;
    }

    getFileSize() {
        return AppState.currentFile ? AppState.currentFile.size : 0;
    }

    // Clear individual parameter overrides when new file is loaded
    clearParameterOverrides() {
        if (this.parameterManager) {
            this.parameterManager.clearIndividualOverrides();
        }
        
        // Clear from global state
        if (AppState.individualParameterOverrides) {
            AppState.individualParameterOverrides.clear();
        }
    }

    // Get summary of parameter customizations
    getParameterCustomizationSummary() {
        let summary = {
            hasGlobalOverrides: false,
            hasIndividualOverrides: false,
            nodeOverrideCount: 0,
            edgeOverrideCount: 0,
            diamondNodeOverrideCount: 0,
            diamondEdgeOverrideCount: 0
        };

        // Check global overrides
        summary.hasGlobalOverrides = this.dom.isElementChecked('overrideNodePrior') || 
                                   this.dom.isElementChecked('overrideEdgeProb');

        // Check individual overrides
        if (this.parameterManager) {
            summary.nodeOverrideCount = this.parameterManager.getModifiedCount('nodes');
            summary.edgeOverrideCount = this.parameterManager.getModifiedCount('edges');
            summary.diamondNodeOverrideCount = this.parameterManager.getModifiedCount('diamond-nodes');
            summary.diamondEdgeOverrideCount = this.parameterManager.getModifiedCount('diamond-edges');
            
            summary.hasIndividualOverrides = summary.nodeOverrideCount > 0 || 
                                           summary.edgeOverrideCount > 0 ||
                                           summary.diamondNodeOverrideCount > 0 ||
                                           summary.diamondEdgeOverrideCount > 0;
        }

        return summary;
    }
}