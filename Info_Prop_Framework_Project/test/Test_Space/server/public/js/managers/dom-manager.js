// dom-manager.js - Complete enhanced DOM element management with parameter editor support
export class DOMManager {
    constructor() {
        this.elements = this.getElements();
        this.elementCache = new Map();
        this.eventListeners = new Map();
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
            
            // Individual parameter control elements
            editNodePriorsBtn: document.getElementById('editNodePriorsBtn'),
            editEdgeProbsBtn: document.getElementById('editEdgeProbsBtn'),
            editDiamondNodePriorsBtn: document.getElementById('editDiamondNodePriorsBtn'),
            editDiamondEdgeProbsBtn: document.getElementById('editDiamondEdgeProbsBtn'),
            individualParamsStatus: document.getElementById('individualParamsStatus'),
            diamondIndividualParamsStatus: document.getElementById('diamondIndividualParamsStatus'),
            modifiedNodesCount: document.getElementById('modifiedNodesCount'),
            modifiedEdgesCount: document.getElementById('modifiedEdgesCount'),
            modifiedDiamondNodesCount: document.getElementById('modifiedDiamondNodesCount'),
            modifiedDiamondEdgesCount: document.getElementById('modifiedDiamondEdgesCount'),
            usingIndividualValues: document.getElementById('usingIndividualValues'),
            
            // Parameter editor modal elements
            parameterEditorModal: document.getElementById('parameterEditorModal'),
            parameterEditorHeader: document.getElementById('parameterEditorHeader'),
            parameterEditorTitle: document.getElementById('parameterEditorTitle'),
            parameterEditorBody: document.querySelector('.param-editor-body'),
            parameterSearch: document.getElementById('parameterSearch'),
            parameterTableContainer: document.getElementById('parameterTableContainer'),
            parameterStats: document.getElementById('parameterStats'),
            
            // Parameter editor controls
            batchValue: document.getElementById('batchValue'),
            batchSetSelected: document.getElementById('batchSetSelected'),
            batchSetAll: document.getElementById('batchSetAll'),
            batchResetSelected: document.getElementById('batchResetSelected'),
            resetAllParameters: document.getElementById('resetAllParameters'),
            cancelParameterEdit: document.getElementById('cancelParameterEdit'),
            saveParameters: document.getElementById('saveParameters'),
            selectAllParams: document.getElementById('selectAllParams'),
            
            // Tab elements
            tabBtns: document.querySelectorAll('.tab-btn'),
            tabContents: document.querySelectorAll('.tab-content'),
            
            // Results elements
            topNodesSelect: document.getElementById('topNodesSelect'),
            sortSelect: document.getElementById('sortSelect'),
            exportResultsBtn: document.getElementById('exportResultsBtn'),
            resultsTable: document.getElementById('resultsTable'),
            
            // Structure analysis elements
            structureAnalysis: document.getElementById('structureAnalysis'),
            structureNodes: document.getElementById('structureNodes'),
            structureEdges: document.getElementById('structureEdges'),
            structureDensity: document.getElementById('structureDensity'),
            structureDepth: document.getElementById('structureDepth'),
            nodeTypeStats: document.getElementById('nodeTypeStats'),
            connectivityStats: document.getElementById('connectivityStats'),
            structuralProperties: document.getElementById('structuralProperties'),
            structureDiamonds: document.getElementById('structureDiamonds'),
            
            // Diamond analysis elements
            diamondAnalysis: document.getElementById('diamondAnalysis'),
            totalDiamonds: document.getElementById('totalDiamonds'),
            complexDiamonds: document.getElementById('complexDiamonds'),
            averageComplexity: document.getElementById('averageComplexity'),
            maxPathCount: document.getElementById('maxPathCount'),
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
        
        // Check for parameter editor elements
        const parameterElements = [
            'editNodePriorsBtn', 'editEdgeProbsBtn', 'parameterEditorModal',
            'parameterSearch', 'parameterTableContainer'
        ];
        
        const missingParameterElements = [];
        parameterElements.forEach(elementKey => {
            if (!this.elements[elementKey]) {
                missingParameterElements.push(elementKey);
            }
        });
        
        if (missingParameterElements.length > 0) {
            console.warn('Missing parameter editor elements:', missingParameterElements);
        }
        
        return missingElements.length === 0;
    }

    // Enhanced event listener management with cleanup
    safeAddEventListener(elementKey, event, handler, options = {}) {
        const element = this.elements[elementKey];
        if (element) {
            // Remove existing listener if it exists
            this.safeRemoveEventListener(elementKey, event);
            
            // Add new listener
            element.addEventListener(event, handler, options);
            
            // Store listener for cleanup
            const listenerKey = `${elementKey}-${event}`;
            this.eventListeners.set(listenerKey, { element, event, handler, options });
            
            return true;
        } else {
            console.warn(`Element not found for event listener: ${elementKey} -> ${event}`);
            return false;
        }
    }

    safeRemoveEventListener(elementKey, event) {
        const listenerKey = `${elementKey}-${event}`;
        const listenerInfo = this.eventListeners.get(listenerKey);
        
        if (listenerInfo) {
            listenerInfo.element.removeEventListener(listenerInfo.event, listenerInfo.handler, listenerInfo.options);
            this.eventListeners.delete(listenerKey);
            return true;
        }
        return false;
    }

    // Element visibility management
    hideElements(elementKeys) {
        elementKeys.forEach(key => {
            const element = this.elements[key];
            if (element) element.style.display = 'none';
        });
    }

    showElement(elementKey, displayType = 'block') {
        const element = this.elements[elementKey];
        if (element) element.style.display = displayType;
    }

    setElementVisibility(elementKey, visible, displayType = 'block') {
        const element = this.elements[elementKey];
        if (element) {
            element.style.display = visible ? displayType : 'none';
        }
    }

    toggleElementVisibility(elementKey, displayType = 'block') {
        const element = this.elements[elementKey];
        if (element) {
            const isVisible = element.style.display !== 'none';
            element.style.display = isVisible ? 'none' : displayType;
        }
    }

    // Status and messaging
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

    showSuccess(message, duration = 3000) {
        this.createNotification(message, 'success', duration);
    }

    showWarning(message, duration = 4000) {
        this.createNotification(message, 'warning', duration);
    }

    createNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${this.getNotificationColor(type)};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-weight: 600;
            max-width: 400px;
            animation: slideInRight 0.3s ease-out;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.3s ease-out forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    }

    getNotificationColor(type) {
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        return colors[type] || colors.info;
    }

    // Element state management
    setElementDisabled(elementKey, disabled) {
        const element = this.elements[elementKey];
        if (element) {
            element.disabled = disabled;
            if (disabled) {
                element.classList.add('disabled-state');
            } else {
                element.classList.remove('disabled-state');
            }
        }
    }

    setMultipleElementsDisabled(elementKeys, disabled) {
        elementKeys.forEach(key => {
            this.setElementDisabled(key, disabled);
        });
    }

    // Value management
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

    setMultipleElementsValue(elementValuePairs) {
        elementValuePairs.forEach(pair => {
            this.setElementValue(pair.element, pair.value);
        });
    }

    // Checkbox management
    isElementChecked(elementKey) {
        const element = this.elements[elementKey];
        return element ? element.checked : false;
    }

    setElementChecked(elementKey, checked) {
        const element = this.elements[elementKey];
        if (element) {
            element.checked = checked;
            // Trigger change event to update UI
            element.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    // Content management
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

    appendElementHTML(elementKey, html) {
        const element = this.elements[elementKey];
        if (element) {
            element.insertAdjacentHTML('beforeend', html);
        }
    }

    prependElementHTML(elementKey, html) {
        const element = this.elements[elementKey];
        if (element) {
            element.insertAdjacentHTML('afterbegin', html);
        }
    }

    clearElement(elementKey) {
        const element = this.elements[elementKey];
        if (element) {
            element.innerHTML = '';
        }
    }

    // DOM querying
    querySelector(selector) {
        return document.querySelector(selector);
    }

    querySelectorAll(selector) {
        return document.querySelectorAll(selector);
    }

    getElementByKey(elementKey) {
        return this.elements[elementKey];
    }

    // Class management
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

    toggleElementClass(elementKey, className, force = null) {
        const element = this.elements[elementKey];
        if (element) {
            if (force !== null) {
                element.classList.toggle(className, force);
            } else {
                element.classList.toggle(className);
            }
        }
    }

    hasElementClass(elementKey, className) {
        const element = this.elements[elementKey];
        return element ? element.classList.contains(className) : false;
    }

    // Attribute management
    getElementAttribute(elementKey, attribute) {
        const element = this.elements[elementKey];
        return element ? element.getAttribute(attribute) : null;
    }

    setElementAttribute(elementKey, attribute, value) {
        const element = this.elements[elementKey];
        if (element) {
            element.setAttribute(attribute, value);
        }
    }

    removeElementAttribute(elementKey, attribute) {
        const element = this.elements[elementKey];
        if (element) {
            element.removeAttribute(attribute);
        }
    }

    // Style management
    setElementStyle(elementKey, styleProperty, value) {
        const element = this.elements[elementKey];
        if (element) {
            element.style[styleProperty] = value;
        }
    }

    setElementStyles(elementKey, styles) {
        const element = this.elements[elementKey];
        if (element) {
            Object.assign(element.style, styles);
        }
    }

    // Scrolling and positioning
    scrollElementIntoView(elementKey, options = { behavior: 'smooth', block: 'center' }) {
        const element = this.elements[elementKey];
        if (element) {
            element.scrollIntoView(options);
        }
    }

    scrollToTop(elementKey = null) {
        if (elementKey) {
            const element = this.elements[elementKey];
            if (element) {
                element.scrollTop = 0;
            }
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    // Parameter editor specific methods
    showParameterEditorModal() {
        this.showElement('parameterEditorModal');
        document.body.classList.add('modal-open');
        
        // Focus search input if available
        const searchInput = this.elements.parameterSearch;
        if (searchInput) {
            setTimeout(() => searchInput.focus(), 100);
        }
    }

    hideParameterEditorModal() {
        this.hideElements(['parameterEditorModal']);
        document.body.classList.remove('modal-open');
    }

    updateParameterEditorStats(text) {
        this.setElementText('parameterStats', text);
    }

    clearParameterTable() {
        const container = this.elements.parameterTableContainer;
        if (container) {
            container.innerHTML = '';
        }
    }

    setParameterEditorMode(mode) {
        const header = this.elements.parameterEditorHeader;
        const title = this.elements.parameterEditorTitle;
        
        if (header && title) {
            if (mode.includes('nodes')) {
                header.className = 'param-editor-header';
                title.textContent = mode.includes('diamond') ? 'Edit Diamond Node Priors' : 'Edit Node Priors';
            } else {
                header.className = 'param-editor-header edges';
                title.textContent = mode.includes('diamond') ? 'Edit Diamond Edge Probabilities' : 'Edit Edge Probabilities';
            }
        }
    }

    // Individual parameter status management
    updateIndividualParameterStatus(nodeCount, edgeCount, isActive) {
        const statusDiv = this.elements.individualParamsStatus;
        if (statusDiv) {
            statusDiv.style.display = isActive ? 'block' : 'none';
            
            if (isActive) {
                this.setElementText('modifiedNodesCount', nodeCount.toString());
                this.setElementText('modifiedEdgesCount', edgeCount.toString());
                this.setElementText('usingIndividualValues', (nodeCount > 0 || edgeCount > 0) ? 'Yes' : 'No');
            }
        }
    }

    updateDiamondIndividualParameterStatus(nodeCount, edgeCount, isActive) {
        const statusDiv = this.elements.diamondIndividualParamsStatus;
        if (statusDiv) {
            statusDiv.style.display = isActive ? 'block' : 'none';
            
            if (isActive) {
                this.setElementText('modifiedDiamondNodesCount', nodeCount.toString());
                this.setElementText('modifiedDiamondEdgesCount', edgeCount.toString());
            }
        }
    }

    // Modal management helpers
    getOpenModals() {
        return document.querySelectorAll('.modal[style*="block"], .param-editor-modal[style*="block"]');
    }

    closeAllModals() {
        const openModals = this.getOpenModals();
        openModals.forEach(modal => {
            modal.style.display = 'none';
        });
        document.body.classList.remove('modal-open');
    }

    // Form validation helpers
    validateNumericInput(elementKey, min = 0, max = 1, required = true) {
        const element = this.elements[elementKey];
        if (!element) return false;
        
        const value = element.value.trim();
        
        // Check if required
        if (required && value === '') {
            element.classList.add('invalid-input');
            this.setElementAttribute(elementKey, 'aria-invalid', 'true');
            return false;
        }
        
        // Check if numeric and within range
        const numValue = parseFloat(value);
        if (value !== '' && (isNaN(numValue) || numValue < min || numValue > max)) {
            element.classList.add('invalid-input');
            this.setElementAttribute(elementKey, 'aria-invalid', 'true');
            return false;
        }
        
        // Valid
        element.classList.remove('invalid-input');
        this.removeElementAttribute(elementKey, 'aria-invalid');
        return true;
    }

    validateRequiredField(elementKey) {
        const element = this.elements[elementKey];
        if (!element) return false;
        
        const isEmpty = !element.value || element.value.trim() === '';
        element.classList.toggle('required-field-empty', isEmpty);
        this.setElementAttribute(elementKey, 'aria-invalid', isEmpty ? 'true' : 'false');
        return !isEmpty;
    }

    // Loading state management
    setLoadingState(elementKey, isLoading, loadingText = 'Loading...') {
        const element = this.elements[elementKey];
        if (element) {
            const originalText = element.dataset.originalText || element.textContent;
            
            if (isLoading) {
                element.dataset.originalText = originalText;
                element.textContent = loadingText;
                element.disabled = true;
                element.classList.add('loading-state');
            } else {
                element.textContent = originalText;
                element.disabled = false;
                element.classList.remove('loading-state');
                delete element.dataset.originalText;
            }
        }
    }

    setGlobalLoadingState(isLoading, message = 'Processing...') {
        if (isLoading) {
            this.showElement('loading');
            this.setElementText('loading', message);
        } else {
            this.hideElements(['loading']);
        }
    }

    // Animation helpers
    animateElement(elementKey, animationClass, duration = 300) {
        const element = this.elements[elementKey];
        if (element) {
            element.classList.add(animationClass);
            setTimeout(() => {
                element.classList.remove(animationClass);
            }, duration);
        }
    }

    highlightElement(elementKey, duration = 2000) {
        this.animateElement(elementKey, 'highlight-flash', duration);
    }

    // Accessibility helpers
    setElementAriaLabel(elementKey, label) {
        const element = this.elements[elementKey];
        if (element) {
            element.setAttribute('aria-label', label);
        }
    }

    setElementRole(elementKey, role) {
        const element = this.elements[elementKey];
        if (element) {
            element.setAttribute('role', role);
        }
    }

    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.style.cssText = 'position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;';
        announcement.textContent = message;
        
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            if (announcement.parentNode) {
                document.body.removeChild(announcement);
            }
        }, 1000);
    }

    // Enhanced checkbox state management
    updateCheckboxGroup(checkboxKeys, updateFunction) {
        checkboxKeys.forEach(key => {
            const checkbox = this.elements[key];
            if (checkbox) {
                updateFunction(checkbox);
            }
        });
    }

    // Batch operations for parameter editing
    selectAllParameterRows(checked) {
        const checkboxes = document.querySelectorAll('.param-row-checkbox');
        checkboxes.forEach(checkbox => {
            if (checkbox.closest('tr').style.display !== 'none') {
                checkbox.checked = checked;
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }

    getSelectedParameterRows() {
        const selectedCheckboxes = document.querySelectorAll('.param-row-checkbox:checked');
        return Array.from(selectedCheckboxes).map(cb => parseInt(cb.dataset.index));
    }

    updateSelectAllCheckbox() {
        const selectAllCheckbox = this.elements.selectAllParams;
        if (selectAllCheckbox) {
            const allCheckboxes = document.querySelectorAll('.param-row-checkbox');
            const visibleCheckboxes = Array.from(allCheckboxes).filter(cb => 
                cb.closest('tr').style.display !== 'none'
            );
            const checkedVisible = visibleCheckboxes.filter(cb => cb.checked);
            
            selectAllCheckbox.indeterminate = checkedVisible.length > 0 && checkedVisible.length < visibleCheckboxes.length;
            selectAllCheckbox.checked = checkedVisible.length === visibleCheckboxes.length && visibleCheckboxes.length > 0;
        }
    }

    // Performance optimization
    batchDOMUpdates(updates) {
        // Use document fragment for batch DOM updates
        const fragment = document.createDocumentFragment();
        updates.forEach(update => {
            if (typeof update === 'function') {
                update(fragment);
            }
        });
        return fragment;
    }

    // Debug helpers
    logElementState(elementKey) {
        const element = this.elements[elementKey];
        if (element) {
            console.log(`Element ${elementKey}:`, {
                exists: true,
                visible: element.style.display !== 'none',
                disabled: element.disabled,
                value: element.value,
                checked: element.checked,
                classList: Array.from(element.classList),
                innerHTML: element.innerHTML.substring(0, 100) + (element.innerHTML.length > 100 ? '...' : '')
            });
        } else {
            console.log(`Element ${elementKey}: does not exist`);
        }
    }

    logAllElementStates() {
        console.log('=== DOM Manager Element States ===');
        Object.keys(this.elements).forEach(key => {
            this.logElementState(key);
        });
    }

    // Utility methods
    refreshElementReferences() {
        this.elements = this.getElements();
        console.log('DOM element references refreshed');
    }

    cleanup() {
        // Remove all event listeners
        this.eventListeners.forEach((listenerInfo, key) => {
            listenerInfo.element.removeEventListener(listenerInfo.event, listenerInfo.handler, listenerInfo.options);
        });
        this.eventListeners.clear();
        
        // Clear cache
        this.elementCache.clear();
        
        console.log('DOM Manager cleaned up');
    }

    // Element existence checks
    elementExists(elementKey) {
        return !!this.elements[elementKey];
    }

    waitForElement(elementKey, timeout = 5000) {
        return new Promise((resolve, reject) => {
            if (this.elements[elementKey]) {
                resolve(this.elements[elementKey]);
                return;
            }
            
            const observer = new MutationObserver(() => {
                this.refreshElementReferences();
                if (this.elements[elementKey]) {
                    observer.disconnect();
                    resolve(this.elements[elementKey]);
                }
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            
            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element ${elementKey} not found within ${timeout}ms`));
            }, timeout);
        });
    }

    // Enhanced parameter editor integration
    setupParameterEditorEventListeners() {
        // Search functionality
        this.safeAddEventListener('parameterSearch', 'input', (event) => {
            if (window.AppManagers?.parameter) {
                window.AppManagers.parameter.filterParameterTable(event.target.value);
            }
        });

        // Batch operations
        this.safeAddEventListener('batchSetSelected', 'click', () => {
            if (window.AppManagers?.parameter) {
                window.AppManagers.parameter.batchSetSelected();
            }
        });

        this.safeAddEventListener('batchSetAll', 'click', () => {
            if (window.AppManagers?.parameter) {
                window.AppManagers.parameter.batchSetAll();
            }
        });

        this.safeAddEventListener('batchResetSelected', 'click', () => {
            if (window.AppManagers?.parameter) {
                window.AppManagers.parameter.batchResetSelected();
            }
        });

        // Modal controls
        this.safeAddEventListener('resetAllParameters', 'click', () => {
            if (window.AppManagers?.parameter) {
                window.AppManagers.parameter.resetAllParameters();
            }
        });

        this.safeAddEventListener('cancelParameterEdit', 'click', () => {
            if (window.AppManagers?.parameter) {
                window.AppManagers.parameter.closeParameterEditor();
            }
        });

        this.safeAddEventListener('saveParameters', 'click', () => {
            if (window.AppManagers?.parameter) {
                window.AppManagers.parameter.saveParameterChanges();
            }
        });
    }
}