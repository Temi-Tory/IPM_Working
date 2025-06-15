// dom-manager.js - DOM element management and utilities
export class DOMManager {
    constructor() {
        this.elements = this.getElements();
    }

    getElements() {
        return {
            // File input elements
            fileInput: document.getElementById('fileInput'),
            fileStatus: document.getElementById('fileStatus'),
            analyzeBtn: document.getElementById('analyzeBtn'),
            loading: document.getElementById('loading'),
            results: document.getElementById('results'),
            error: document.getElementById('error'),
            
            // Parameter controls
            nodePriorSlider: document.getElementById('nodePrior'),
            edgeProbSlider: document.getElementById('edgeProb'),
            nodeValueSpan: document.getElementById('nodeValue'),
            edgeValueSpan: document.getElementById('edgeValue'),
            includeClassification: document.getElementById('includeClassification'),
            enableMonteCarlo: document.getElementById('enableMonteCarlo'),
            overrideNodePrior: document.getElementById('overrideNodePrior'),
            overrideEdgeProb: document.getElementById('overrideEdgeProb'),
            
            // Tab elements
            tabBtns: document.querySelectorAll('.tab-btn'),
            tabContents: document.querySelectorAll('.tab-content'),
            
            // Results elements
            topNodesSelect: document.getElementById('topNodesSelect'),
            sortSelect: document.getElementById('sortSelect'),
            exportResultsBtn: document.getElementById('exportResultsBtn'),
            
            // Diamond analysis elements
            diamondAnalysis: document.getElementById('diamondAnalysis'),
            diamondTypeFilter: document.getElementById('diamondTypeFilter'),
            forkStructureFilter: document.getElementById('forkStructureFilter'),
            diamondSortSelect: document.getElementById('diamondSortSelect'),
            diamondList: document.getElementById('diamondList'),
            diamondDetailModal: document.getElementById('diamondDetailModal'),
            diamondPathModal: document.getElementById('diamondPathModal'),
            
            // Path analysis elements
            pathOverrideNodes: document.getElementById('pathOverrideNodes'),
            pathOverrideEdges: document.getElementById('pathOverrideEdges'),
            pathNodePrior: document.getElementById('pathNodePrior'),
            pathEdgeProb: document.getElementById('pathEdgeProb'),
            pathNodeValue: document.getElementById('pathNodeValue'),
            pathEdgeValue: document.getElementById('pathEdgeValue'),
            runPathAnalysis: document.getElementById('runPathAnalysis'),
            resetPathParams: document.getElementById('resetPathParams'),
            pathNetworkGraph: document.getElementById('pathNetworkGraph'),
            pathResults: document.getElementById('pathResults'),
            pathResultsTable: document.getElementById('pathResultsTable'),
            
            // Visualization elements
            showSourceNodes: document.getElementById('showSourceNodes'),
            showSinkNodes: document.getElementById('showSinkNodes'),
            showForkNodes: document.getElementById('showForkNodes'),
            showJoinNodes: document.getElementById('showJoinNodes'),
            showIterations: document.getElementById('showIterations'),
            showDiamonds: document.getElementById('showDiamonds'),
            layoutSelect: document.getElementById('layoutSelect'),
            focusDiamondSelect: document.getElementById('focusDiamondSelect'),
            resetZoom: document.getElementById('resetZoom'),
            fitToScreen: document.getElementById('fitToScreen'),
            exportDot: document.getElementById('exportDot'),
            networkGraph: document.getElementById('network-graph'),
            selectedNodeInfo: document.getElementById('selected-node-info')
        };
    }

    verifyElements() {
        const criticalElements = [
            'fileInput', 'analyzeBtn', 'loading', 'results', 'error',
            'nodePriorSlider', 'edgeProbSlider', 'nodeValueSpan', 'edgeValueSpan'
        ];
        
        const missingElements = [];
        criticalElements.forEach(elementKey => {
            if (!this.elements[elementKey]) {
                missingElements.push(elementKey);
            }
        });
        
        if (missingElements.length > 0) {
            console.warn('Missing critical DOM elements:', missingElements);
        }
        
        return missingElements.length === 0;
    }

    safeAddEventListener(elementKey, event, handler) {
        const element = this.elements[elementKey];
        if (element) {
            element.addEventListener(event, handler);
            return true;
        } else {
            console.warn(`Element not found for event listener: ${elementKey} -> ${event}`);
            return false;
        }
    }

    hideElements(elementKeys) {
        elementKeys.forEach(key => {
            const element = this.elements[key];
            if (element) element.style.display = 'none';
        });
    }

    showElement(elementKey) {
        const element = this.elements[elementKey];
        if (element) element.style.display = 'block';
    }

    updateFileStatus(message, className = '') {
        const fileStatus = this.elements.fileStatus;
        if (fileStatus) {
            fileStatus.textContent = message;
            fileStatus.className = className;
        }
    }

    showError(message) {
        this.hideElements(['results', 'loading', 'diamondAnalysis']);
        const errorElement = this.elements.error;
        if (errorElement) {
            errorElement.textContent = `Error: ${message}`;
            this.showElement('error');
        }
        console.error('Error:', message);
    }

    setElementDisabled(elementKey, disabled) {
        const element = this.elements[elementKey];
        if (element) {
            element.disabled = disabled;
        }
    }

    setElementValue(elementKey, value) {
        const element = this.elements[elementKey];
        if (element) {
            element.value = value;
        }
    }

    getElementValue(elementKey) {
        const element = this.elements[elementKey];
        return element ? element.value : null;
    }

    isElementChecked(elementKey) {
        const element = this.elements[elementKey];
        return element ? element.checked : false;
    }

    setElementChecked(elementKey, checked) {
        const element = this.elements[elementKey];
        if (element) {
            element.checked = checked;
        }
    }

    setElementHTML(elementKey, html) {
        const element = this.elements[elementKey];
        if (element) {
            element.innerHTML = html;
        }
    }

    setElementText(elementKey, text) {
        const element = this.elements[elementKey];
        if (element) {
            element.textContent = text;
        }
    }

    querySelector(selector) {
        return document.querySelector(selector);
    }

    querySelectorAll(selector) {
        return document.querySelectorAll(selector);
    }

    addClassToElement(elementKey, className) {
        const element = this.elements[elementKey];
        if (element) {
            element.classList.add(className);
        }
    }

    removeClassFromElement(elementKey, className) {
        const element = this.elements[elementKey];
        if (element) {
            element.classList.remove(className);
        }
    }

    scrollElementIntoView(elementKey, options = { behavior: 'smooth', block: 'center' }) {
        const element = this.elements[elementKey];
        if (element) {
            element.scrollIntoView(options);
        }
    }
}