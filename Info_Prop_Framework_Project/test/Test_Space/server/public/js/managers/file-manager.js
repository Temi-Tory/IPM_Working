// file-manager.js - File handling operations
import { UIUtils } from '../utils/ui-utils.js';
import { AppState } from '../main.js';

export class FileManager {
    constructor(domManager) {
        this.dom = domManager;
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
            return;
        }
        
        if (!file.name.toLowerCase().endsWith('.csv')) {
            AppState.currentFile = null;
            this.dom.setElementDisabled('analyzeBtn', true);
            this.dom.updateFileStatus('Please select a CSV file', 'file-error');
            return;
        }
        
        AppState.currentFile = file;
        this.dom.setElementDisabled('analyzeBtn', false);
        this.dom.updateFileStatus(
            `File loaded: ${file.name} (${UIUtils.formatFileSize(file.size)})`, 
            'file-success'
        );
        
        console.log('File loaded:', file.name);
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
        return {
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
}