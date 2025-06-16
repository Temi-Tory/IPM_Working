// analysis-manager.js - Enhanced analysis operations with individual parameter support
import { AppState } from '../main.js';
import { UIUtils } from '../utils/ui-utils.js';

export class AnalysisManager {
    constructor(domManager, parameterManager = null) {
        this.dom = domManager;
        this.parameterManager = parameterManager;
        this.currentAnalysisMode = null; // 'structure', 'diamond', 'full'
        this.analysisHistory = [];
    }

    initializeEventListeners() {
        // NEW: Direct analysis type button handlers
        this.dom.safeAddEventListener('structureAnalysisBtn', 'click', () => {
            this.runStructureAnalysis();
        });
        
        this.dom.safeAddEventListener('diamondAnalysisBtn', 'click', () => {
            this.runDiamondAnalysis();
        });
        
        this.dom.safeAddEventListener('reachabilityAnalysisBtn', 'click', () => {
            this.runFullAnalysis();
        });
        
        
        // Results control handlers
        this.dom.safeAddEventListener('topNodesSelect', 'change', () => {
            this.updateResultsTable();
        });
        
        this.dom.safeAddEventListener('sortSelect', 'change', () => {
            this.updateResultsTable();
        });

        // Watch for parameter changes to update availability
        this.setupParameterChangeWatchers();
    }

    setupParameterChangeWatchers() {
        // Watch for when network data becomes available
        const originalSetNetworkData = (data) => {
            AppState.networkData = data;
            if (this.parameterManager) {
                this.parameterManager.updateParameterEditingAvailability();
            }
        };

        // Watch for when structure data becomes available
        const originalSetStructureData = (data) => {
            AppState.structureData = data;
            if (this.parameterManager) {
                this.parameterManager.updateParameterEditingAvailability();
            }
        };
    }

    showAnalysisOptionModal() {
        if (!AppState.currentFile) {
            this.dom.showError('Please select a CSV file first');
            return;
        }

        // Create modal for analysis options with parameter summary
        const modal = this.createAnalysisOptionsModal();
        document.body.appendChild(modal);
        modal.style.display = 'block';
    }

    createAnalysisOptionsModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'analysisOptionsModal';
        modal.style.cssText = 'display: none; z-index: 1000;';
        
        // Get parameter customization summary
        const fileManager = window.AppManagers?.file;
        const paramSummary = fileManager ? fileManager.getParameterCustomizationSummary() : {};
        
        // Create parameter status display
        const parameterStatusHtml = this.createParameterStatusDisplay(paramSummary);
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h4>Choose Analysis Type</h4>
                    <span class="close" onclick="closeModal('analysisOptionsModal')">&times;</span>
                </div>
                <div class="modal-body">
                    ${parameterStatusHtml}
                    
                    <div class="analysis-options">
                        <div class="analysis-option" data-mode="structure">
                            <div class="option-header">
                                <h5>${UIUtils.createIcon('network', 24)} Structure Analysis</h5>
                                <span class="tier-badge tier-1">Tier 1</span>
                            </div>
                            <p>Fast structural analysis without belief propagation. View network topology, identify diamonds, and explore graph properties.</p>
                            <ul class="feature-list">
                                <li>Network topology visualization</li>
                                <li>Diamond structure identification</li>
                                <li>Graph statistics and properties</li>
                                <li>No probability calculations</li>
                            </ul>
                            <button class="analysis-btn structure-btn" onclick="window.AppManagers.analysis.runStructureAnalysis()">
                                Run Structure Analysis
                            </button>
                        </div>
                        
                        <div class="analysis-option" data-mode="diamond">
                            <div class="option-header">
                                <h5>${UIUtils.createIcon('diamond', 24)} Diamond Analysis</h5>
                                <span class="tier-badge tier-2">Tier 2</span>
                            </div>
                            <p>Comprehensive diamond classification and structural analysis. Includes everything from Tier 1 plus detailed diamond insights.</p>
                            <ul class="feature-list">
                                <li>All Tier 1 features</li>
                                <li>Detailed diamond classification</li>
                                <li>Diamond complexity analysis</li>
                                <li>Structural optimization insights</li>
                            </ul>
                            <button class="analysis-btn diamond-btn" onclick="window.AppManagers.analysis.runDiamondAnalysis()">
                                Run Diamond Analysis
                            </button>
                        </div>
                        
                        <div class="analysis-option" data-mode="full">
                            <div class="option-header">
                                <h5>${UIUtils.createIcon('check', 24)} Full Analysis</h5>
                                <span class="tier-badge tier-3">Tier 3</span>
                            </div>
                            <p>Complete belief propagation analysis. Includes everything from Tiers 1 & 2 plus probability calculations.</p>
                            <ul class="feature-list">
                                <li>All Tier 1 & 2 features</li>
                                <li>Belief propagation calculations</li>
                                <li>Node probability results</li>
                                <li>Monte Carlo validation option</li>
                            </ul>
                            <button class="analysis-btn full-btn" onclick="window.AppManagers.analysis.runFullAnalysis()">
                                Run Full Analysis
                            </button>
                        </div>
                    </div>
                    
                    ${this.currentAnalysisMode ? `
                        <div class="current-analysis-info">
                            <h6>Current Analysis: ${this.currentAnalysisMode.toUpperCase()}</h6>
                            <p>You can upgrade to a higher tier analysis or rerun the current analysis with different parameters.</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        // Add CSS for the modal
        const style = document.createElement('style');
        style.textContent = `
            .analysis-options {
                display: grid;
                gap: 20px;
                margin-bottom: 20px;
            }
            
            .analysis-option {
                border: 2px solid #e0e0e0;
                border-radius: 12px;
                padding: 20px;
                transition: all 0.3s ease;
                background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
            }
            
            .analysis-option:hover {
                border-color: #667eea;
                box-shadow: 0 8px 25px rgba(102, 126, 234, 0.1);
                transform: translateY(-2px);
            }
            
            .option-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }
            
            .option-header h5 {
                margin: 0;
                color: #333;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .tier-badge {
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 11px;
                font-weight: bold;
                color: white;
            }
            
            .tier-1 { background: #28a745; }
            .tier-2 { background: #fd79a8; }
            .tier-3 { background: #667eea; }
            
            .analysis-option p {
                color: #666;
                margin-bottom: 15px;
                line-height: 1.5;
            }
            
            .feature-list {
                list-style: none;
                padding: 0;
                margin-bottom: 20px;
            }
            
            .feature-list li {
                padding: 4px 0;
                color: #555;
                position: relative;
                padding-left: 20px;
            }
            
            .feature-list li::before {
                content: "✓";
                position: absolute;
                left: 0;
                color: #28a745;
                font-weight: bold;
            }
            
            .analysis-btn {
                width: 100%;
                padding: 12px 20px;
                border: none;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                font-size: 14px;
            }
            
            .structure-btn {
                background: linear-gradient(45deg, #28a745, #20c997);
                color: white;
            }
            
            .diamond-btn {
                background: linear-gradient(45deg, #fd79a8, #fdcb6e);
                color: white;
            }
            
            .full-btn {
                background: linear-gradient(45deg, #667eea, #764ba2);
                color: white;
            }
            
            .analysis-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
            }
            
            .current-analysis-info {
                background: #e3f2fd;
                padding: 15px;
                border-radius: 8px;
                border-left: 4px solid #2196f3;
                margin-top: 20px;
            }
            
            .current-analysis-info h6 {
                margin: 0 0 8px 0;
                color: #1976d2;
                font-weight: 600;
            }
            
            .current-analysis-info p {
                margin: 0;
                color: #666;
                font-size: 14px;
            }

            .parameter-status-display {
                background: rgba(102, 126, 234, 0.08);
                border: 2px solid #667eea;
                border-radius: 12px;
                padding: 15px;
                margin-bottom: 20px;
            }

            .parameter-status-header {
                color: #667eea;
                font-weight: 600;
                margin-bottom: 10px;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .parameter-status-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 10px;
            }

            .parameter-status-item {
                background: rgba(255, 255, 255, 0.8);
                padding: 8px 12px;
                border-radius: 6px;
                border-left: 3px solid #667eea;
                font-size: 13px;
            }

            .parameter-status-label {
                font-weight: 600;
                color: #333;
            }

            .parameter-status-value {
                color: #667eea;
                font-weight: 500;
            }

            .no-parameter-customization {
                color: #666;
                font-style: italic;
                text-align: center;
                padding: 10px;
            }
        `;
        document.head.appendChild(style);

        return modal;
    }

    createParameterStatusDisplay(paramSummary) {
        if (!paramSummary.hasGlobalOverrides && !paramSummary.hasIndividualOverrides) {
            return `
                <div class="parameter-status-display">
                    <div class="parameter-status-header">
                        🎛️ Parameter Configuration
                    </div>
                    <div class="no-parameter-customization">
                        Using default parameter values from CSV file
                    </div>
                </div>
            `;
        }

        const statusItems = [];

        if (paramSummary.hasGlobalOverrides) {
            const globalOverrides = [];
            if (this.dom.isElementChecked('overrideNodePrior')) {
                globalOverrides.push(`Node Prior: ${this.dom.getElementValue('nodePrior')}`);
            }
            if (this.dom.isElementChecked('overrideEdgeProb')) {
                globalOverrides.push(`Edge Prob: ${this.dom.getElementValue('edgeProb')}`);
            }
            
            statusItems.push(`
                <div class="parameter-status-item">
                    <div class="parameter-status-label">Global Overrides:</div>
                    <div class="parameter-status-value">${globalOverrides.join(', ')}</div>
                </div>
            `);
        }

        if (paramSummary.hasIndividualOverrides) {
            const individualOverrides = [];
            if (paramSummary.nodeOverrideCount > 0) {
                individualOverrides.push(`${paramSummary.nodeOverrideCount} Node${paramSummary.nodeOverrideCount > 1 ? 's' : ''}`);
            }
            if (paramSummary.edgeOverrideCount > 0) {
                individualOverrides.push(`${paramSummary.edgeOverrideCount} Edge${paramSummary.edgeOverrideCount > 1 ? 's' : ''}`);
            }
            
            statusItems.push(`
                <div class="parameter-status-item">
                    <div class="parameter-status-label">Individual Overrides:</div>
                    <div class="parameter-status-value">${individualOverrides.join(', ')}</div>
                </div>
            `);
        }

        return `
            <div class="parameter-status-display">
                <div class="parameter-status-header">
                    🎛️ Active Parameter Customizations
                </div>
                <div class="parameter-status-grid">
                    ${statusItems.join('')}
                </div>
            </div>
        `;
    }

    // Tier 1: Structure-only analysis
    async runStructureAnalysis() {
        console.log('Starting Tier 1: Structure Analysis...');
        this.closeAnalysisModal();
        
        this.dom.hideElements(['results', 'error', 'diamondAnalysis']);
        this.dom.showElement('loading');
        this.dom.setElementDisabled('structureAnalysisBtn', true);
        
        try {
            const fileManager = window.AppManagers.file;
            const csvContent = await fileManager.readCurrentFileAsText();
            
            const requestData = {
                csvContent: csvContent
            };
            
            const response = await fetch('/api/parse-structure', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }
            
            if (!result.success) {
                throw new Error(result.error || 'Structure analysis failed');
            }
            
            console.log('Structure analysis complete:', result);
            
            // Store Tier 1 results in global state
            AppState.structureData = result;
            AppState.networkData = result.networkData;
            window.AppState = window.AppState || {};
            window.AppState.networkData = AppState.networkData;
            console.log('✅ Structure Analysis - AppState.networkData set to:', AppState.networkData);
            console.log('✅ Structure Analysis - window.AppState.networkData set to:', window.AppState?.networkData);
       
            AppState.diamondData = null; // Tier 1 has no diamond data
            AppState.analysisResults = null; // Tier 1 has no probability results
            AppState.monteCarloResults = null;
            AppState.originalNodePriors = result.originalData?.nodePriors;
            AppState.originalEdgeProbabilities = result.originalData?.edgeProbabilities;
            
            // Update parameter manager availability
            if (this.parameterManager) {
                this.parameterManager.updateParameterEditingAvailability();
            }
            
            // Update analysis mode
            this.currentAnalysisMode = 'structure';
            this.addToAnalysisHistory('structure', result.summary);
            
            // Enable structure tabs
            window.AppManagers.tab.setAnalysisMode('structure', result);
            
            // Display structure results
            this.displayStructureResults(result);
            
            // Ensure all modals are closed after successful analysis
            this.closeAllModals();
            
            console.log('✅ Structure analysis workflow complete');
            
        } catch (err) {
            console.error('Structure analysis error:', err);
            this.dom.showError(`Structure analysis failed: ${err.message}`);
        } finally {
            this.dom.hideElements(['loading']);
            this.dom.setElementDisabled('structureAnalysisBtn', false);
        }
    }

    // Tier 2: Diamond analysis (structure + enhanced diamond classification)
    async runDiamondAnalysis() {
        console.log('Starting Tier 2: Diamond Analysis...');
        this.closeAnalysisModal();
        
        this.dom.hideElements(['results', 'error']);
        this.dom.showElement('loading');
        this.dom.setElementDisabled('diamondAnalysisBtn', true);
        
        try {
            const fileManager = window.AppManagers.file;
            const csvContent = await fileManager.readCurrentFileAsText();
            
            const requestData = {
                csvContent: csvContent
            };
            
            // Call the correct Tier 2 endpoint
            const response = await fetch('/api/analyze-diamond', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }
            
            if (!result.success) {
                throw new Error(result.error || 'Diamond analysis failed');
            }
            
            console.log('Diamond analysis complete:', result);
            
            // Store Tier 2 results in global state
            AppState.structureData = result;
            AppState.networkData = result.networkData;
            window.AppState = window.AppState || {};
            window.AppState.networkData = AppState.networkData;
            console.log('✅ Diamond Analysis - AppState.networkData set to:', AppState.networkData);
            console.log('✅ Diamond Analysis - window.AppState.networkData set to:', window.AppState?.networkData);
      
            AppState.diamondData = result.diamondData; // NOW has diamond data with classifications
            AppState.analysisResults = null; // Tier 2 still has no probability results
            AppState.monteCarloResults = null;
            AppState.originalNodePriors = result.originalData?.nodePriors;
            AppState.originalEdgeProbabilities = result.originalData?.edgeProbabilities;
            
            // Update parameter manager availability
            if (this.parameterManager) {
                this.parameterManager.updateParameterEditingAvailability();
            }
            
            // Update analysis mode
            this.currentAnalysisMode = 'diamond';
            this.addToAnalysisHistory('diamond', result.summary);
            
            // Enable diamond tabs
            window.AppManagers.tab.setAnalysisMode('diamond', result);
            
            // Display diamond results
            this.displayDiamondResults(result);
            
            // Ensure all modals are closed after successful analysis
            this.closeAllModals();
            
            console.log('✅ Diamond analysis workflow complete');
            
        } catch (err) {
            console.error('Diamond analysis error:', err);
            this.dom.showError(`Diamond analysis failed: ${err.message}`);
        } finally {
            this.dom.hideElements(['loading']);
            this.dom.setElementDisabled('diamondAnalysisBtn', false);
        }
    }

    // Tier 3: Full analysis (everything + belief propagation)
    async runFullAnalysis() {
        console.log('Starting Tier 3: Full Analysis...');
        this.closeAnalysisModal();
        
        this.dom.hideElements(['results', 'error', 'diamondAnalysis']);
        this.dom.showElement('loading');
        this.dom.setElementDisabled('reachabilityAnalysisBtn', true);
        
        try {
            const fileManager = window.AppManagers.file;
            const csvContent = await fileManager.readCurrentFileAsText();
            
            const requestData = fileManager.getAnalysisRequestData();
            requestData.csvContent = csvContent;
            
            // Log parameter information for debugging
            if (requestData.useIndividualOverrides) {
                console.log('Running full analysis with individual parameter overrides:', {
                    nodeOverrides: Object.keys(requestData.individualNodePriors || {}).length,
                    edgeOverrides: Object.keys(requestData.individualEdgeProbabilities || {}).length
                });
            }
            
            const response = await fetch('/api/analyze-enhanced', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }
            
            if (!result.success) {
                throw new Error(result.error || 'Analysis failed');
            }
            
            console.log('Full analysis complete:', result);
            
            // Store Tier 3 results in global state
            AppState.structureData = result; // Keep structure data for compatibility
            AppState.analysisResults = result; // NOW has probability results
            AppState.networkData = result.networkData;
            window.AppState = window.AppState || {};
window.AppState.networkData = AppState.networkData;
            console.log('✅ Full Analysis - AppState.networkData set to:', AppState.networkData);
            console.log('✅ Full Analysis - window.AppState.networkData set to:', window.AppState?.networkData);
            AppState.diamondData = result.diamondData;
            AppState.monteCarloResults = result.monteCarloResults;
            
            if (result.originalData) {
                AppState.originalNodePriors = result.originalData.nodePriors;
                AppState.originalEdgeProbabilities = result.originalData.edgeProbabilities;
            }
            
            // Update parameter manager availability
            if (this.parameterManager) {
                this.parameterManager.updateParameterEditingAvailability();
            }
            
            // Update analysis mode
            this.currentAnalysisMode = 'full';
            this.addToAnalysisHistory('full', result.summary);
            
            // Enable all tabs
            window.AppManagers.tab.setAnalysisMode('full', result);
            
            // Display results
            this.displayResults(result);
            
            // Ensure all modals are closed after successful analysis
            this.closeAllModals();
            
            console.log('✅ Full analysis workflow complete');
            
        } catch (err) {
            console.error('Full analysis error:', err);
            this.dom.showError(`Full analysis failed: ${err.message}`);
        } finally {
            this.dom.hideElements(['loading']);
            this.dom.setElementDisabled('reachabilityAnalysisBtn', false);
        }
    }


    // Analysis workflow helpers
    canUpgradeAnalysis(targetMode) {
        const hierarchy = { 'structure': 1, 'diamond': 2, 'full': 3 };
        const currentLevel = hierarchy[this.currentAnalysisMode] || 0;
        const targetLevel = hierarchy[targetMode] || 0;
        
        return targetLevel > currentLevel;
    }

    getAnalysisUpgradeOptions() {
        const options = [];
        
        if (this.canUpgradeAnalysis('diamond')) {
            options.push('diamond');
        }
        if (this.canUpgradeAnalysis('full')) {
            options.push('full');
        }
        
        return options;
    }

    addToAnalysisHistory(mode, summary) {
        this.analysisHistory.push({
            mode: mode,
            timestamp: new Date().toISOString(),
            summary: summary,
            parameterOverrides: this.parameterManager ? this.parameterManager.hasIndividualOverrides() : false
        });
        
        // Keep only last 10 analyses
        if (this.analysisHistory.length > 10) {
            this.analysisHistory.shift();
        }
    }

    // Modal management
    closeAnalysisModal() {
        const modal = document.getElementById('analysisOptionsModal');
        if (modal) {
            modal.style.display = 'none';
            modal.remove();
        }
        
        // Also close any other open modals that might interfere
        this.closeAllModals();
    }

    closeAllModals() {
        // Use the global force close function for comprehensive modal cleanup
        if (window.forceCloseAllModals) {
            window.forceCloseAllModals();
        } else {
            // Fallback method if global function not available
            const modalIds = [
                'analysisOptionsModal',
                'diamondDetailModal',
                'diamondPathModal',
                'parameterEditorModal'
            ];
            
            modalIds.forEach(modalId => {
                const modal = document.getElementById(modalId);
                if (modal && modal.style.display !== 'none') {
                    console.log('Force closing modal:', modalId);
                    modal.style.display = 'none';
                    modal.style.setProperty('display', 'none', 'important');
                    
                    // Special cleanup for specific modals
                    if (modalId === 'parameterEditorModal' && window.AppManagers?.parameter) {
                        window.AppManagers.parameter.closeParameterEditor();
                    } else if (modalId === 'diamondPathModal' && window.AppManagers?.diamond) {
                        window.AppManagers.diamond.closeDiamondPathModal();
                    }
                    
                    // Remove dynamically created modals
                    if (modalId === 'analysisOptionsModal') {
                        modal.remove();
                    }
                }
            });
        }
    }

    // Display methods for different analysis tiers
    displayStructureResults(result) {
        console.log('Displaying Tier 1: Structure results');
        
        // Show structure analysis elements
        const structureAnalysis = document.getElementById('structureAnalysis');
        if (structureAnalysis) {
            structureAnalysis.style.display = 'block';
        }
        
        // Update structure summary
        console.log('Calling updateStructureSummary with statistics:', result.statistics);
        this.updateStructureSummary(result.statistics);
        
        // Update structure details
        this.updateStructureDetails(result.networkData, result.statistics);
        
        // Also explicitly call updateStructureSummary again to ensure statistics are updated
        console.log('Explicitly calling updateStructureSummary again...');
        this.updateStructureSummary(result.statistics);
        
        // Trigger visualization manager to update statistics
        if (window.AppManagers?.visualization) {
            window.AppManagers.visualization.updateVisualization();
        }
        
        console.log('Structure results displayed');
    }

    displayDiamondResults(result) {
        console.log('Displaying Tier 2: Diamond results');
        
        // Show structure analysis (Tier 2 includes Tier 1)
        this.displayStructureResults(result);
        
        // Show diamond analysis
        if (AppState.diamondData) {
            this.dom.showElement('diamondAnalysis');
            console.log('Calling diamond.displayDiamondAnalysis()...');
            window.AppManagers.diamond.displayDiamondAnalysis();
            
            // Also explicitly call updateDiamondSummary to ensure statistics are updated
            console.log('Explicitly calling diamond.updateDiamondSummary()...');
            window.AppManagers.diamond.updateDiamondSummary();
        }
        
        // Trigger visualization manager to update statistics
        if (window.AppManagers?.visualization) {
            window.AppManagers.visualization.updateVisualization();
        }
        
        console.log('Diamond results displayed');
    }

    updateStructureSummary(statistics) {
        if (!statistics) {
            console.warn('No statistics provided to updateStructureSummary');
            return;
        }
        
        try {
            // Update structure summary cards
            const basicStats = statistics.basic || {};
            const nodes = basicStats.nodes || 0;
            const edges = basicStats.edges || 0;
            const density = (basicStats.density || 0).toFixed(3);
            const maxDepth = basicStats.maxDepth || 0;
            
            console.log('Attempting to update structure summary with values:', {nodes, edges, density, maxDepth});
            console.log('Full statistics object:', statistics);
            
            // Check if elements exist before setting
            const nodesElement = document.getElementById('structureNodes');
            const edgesElement = document.getElementById('structureEdges');
            const densityElement = document.getElementById('structureDensity');
            const depthElement = document.getElementById('structureDepth');
            
            console.log('Structure DOM elements found:', {
                nodesElement: !!nodesElement,
                edgesElement: !!edgesElement,
                densityElement: !!densityElement,
                depthElement: !!depthElement
            });
            
            if (nodesElement) {
                nodesElement.textContent = nodes;
                console.log('Set structureNodes to:', nodes);
            } else {
                console.error('structureNodes element not found!');
            }
            
            if (edgesElement) {
                edgesElement.textContent = edges;
                console.log('Set structureEdges to:', edges);
            } else {
                console.error('structureEdges element not found!');
            }
            
            if (densityElement) {
                densityElement.textContent = density;
                console.log('Set structureDensity to:', density);
            } else {
                console.error('structureDensity element not found!');
            }
            
            if (depthElement) {
                depthElement.textContent = maxDepth;
                console.log('Set structureDepth to:', maxDepth);
            } else {
                console.error('structureDepth element not found!');
            }
            
            console.log('Structure summary update completed');
        } catch (error) {
            console.error('Error updating structure summary:', error);
        }
    }

    updateStructureDetails(networkData, statistics) {
        if (!networkData || !statistics) return;
        
        // Update node type statistics
        this.updateNodeTypeStats(statistics.nodeTypes || {});
        
        // Update connectivity analysis
        this.updateConnectivityStats(networkData);
        
        // Update structural properties
        this.updateStructuralProperties(statistics);
        
        // Update diamond preview (for Tier 1, this will show "Run diamond analysis")
        this.updateDiamondPreview(statistics.structural?.diamonds || 0);
    }

    updateNodeTypeStats(nodeTypes) {
        const statsElement = document.getElementById('nodeTypeStats');
        if (!statsElement) return;
        
        const statsHtml = Object.entries(nodeTypes).map(([type, count]) => {
            const percentage = nodeTypes.source + nodeTypes.sink + nodeTypes.fork + 
                             nodeTypes.join + nodeTypes.isolated + nodeTypes.regular > 0 ? 
                             ((count / (nodeTypes.source + nodeTypes.sink + nodeTypes.fork + 
                               nodeTypes.join + nodeTypes.isolated + nodeTypes.regular)) * 100).toFixed(1) : 0;
            
            return `
                <div class="stat-row">
                    <span class="stat-label">${type.charAt(0).toUpperCase() + type.slice(1)} Nodes:</span>
                    <span class="stat-value">${count} (${percentage}%)</span>
                </div>
            `;
        }).join('');
        
        statsElement.innerHTML = statsHtml;
    }

    updateConnectivityStats(networkData) {
        const statsElement = document.getElementById('connectivityStats');
        if (!statsElement) return;
        
        const highInCount = networkData.highIndegreeNodes?.length || 0;
        const highOutCount = networkData.highOutdegreeNodes?.length || 0;
        const isolatedCount = networkData.isolatedNodes?.length || 0;
        
        statsElement.innerHTML = `
            <div class="stat-row">
                <span class="stat-label">High In-Degree Nodes:</span>
                <span class="stat-value">${highInCount}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">High Out-Degree Nodes:</span>
                <span class="stat-value">${highOutCount}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Isolated Nodes:</span>
                <span class="stat-value">${isolatedCount}</span>
            </div>
        `;
    }

    updateStructuralProperties(statistics) {
        const propsElement = document.getElementById('structuralProperties');
        if (!propsElement) return;
        
        const structural = statistics.structural || {};
        const connectivity = statistics.connectivity || {};
        
        propsElement.innerHTML = `
            <div class="stat-row">
                <span class="stat-label">Iteration Sets:</span>
                <span class="stat-value">${structural.iterationSets || 0}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Avg Path Length:</span>
                <span class="stat-value">${(connectivity.avgPathLength || 0).toFixed(2)}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Has Isolated Nodes:</span>
                <span class="stat-value">${connectivity.hasIsolatedNodes ? 'Yes' : 'No'}</span>
            </div>
        `;
    }

    updateDiamondPreview(diamondCount) {
        const diamondElement = document.getElementById('structureDiamonds');
        if (!diamondElement) return;
        
        if (diamondCount > 0) {
            diamondElement.innerHTML = `
                <div class="diamond-preview-found">
                    <h5>💎 ${diamondCount} Diamond Structure${diamondCount > 1 ? 's' : ''} Found</h5>
                    <p>Run Diamond Analysis to see detailed classifications and complexity analysis.</p>
                    <button onclick="window.AppManagers.analysis.runDiamondAnalysis()" class="action-btn diamond-btn">
                        🔬 Analyze Diamonds
                    </button>
                </div>
            `;
        } else {
            diamondElement.innerHTML = `
                <div class="diamond-preview-none">
                    <h5>💎 No Diamond Structures Detected</h5>
                    <p>This network appears to have a simple branching structure without diamond patterns.</p>
                </div>
            `;
        }
    }

    // Original methods (enhanced for compatibility)
    displayResults(result) {
        this.dom.hideElements(['error']);
        this.dom.showElement('results');
        
        UIUtils.displaySummary(result.summary);
        this.updateResultsTable();
        
        if (AppState.monteCarloResults) {
            this.displayMonteCarloComparison();
        }
        
        if (AppState.diamondData) {
            this.dom.showElement('diamondAnalysis');
            window.AppManagers.diamond.displayDiamondAnalysis();
        }
        
        console.log('Enhanced results displayed');
    }

    updateResultsTable() {
        if (!AppState.analysisResults) return;
        
        const tbody = this.dom.querySelector('#resultsTable tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        let results = [...AppState.analysisResults.results];
        
        // Sort results
        const sortBy = this.dom.getElementValue('sortSelect') || 'probability';
        results.sort((a, b) => {
            switch (sortBy) {
                case 'probability':
                    return b.probability - a.probability;
                case 'node':
                    return a.node - b.node;
                case 'type':
                    return this.getNodeType(a.node).localeCompare(this.getNodeType(b.node));
                default:
                    return 0;
            }
        });
        
        // Limit results
        const topCount = this.dom.getElementValue('topNodesSelect') || 'all';
        if (topCount !== 'all') {
            results = results.slice(0, parseInt(topCount));
        }
        
        results.forEach((result, index) => {
            const row = document.createElement('tr');
            
            const prior = this.getNodePrior(result.node);
            const calculated = result.probability;
            const difference = calculated - (parseFloat(prior) || 0);
            const nodeType = this.getNodeType(result.node);
            const isDiamondMember = this.isNodeInDiamond(result.node);
            
            row.innerHTML = `
                <td><code class="node-id" data-node="${result.node}">${result.node}</code></td>
                <td><span class="node-type ${nodeType.toLowerCase().replace(/[^a-z]/g, '')}">${nodeType}</span></td>
                <td>${parseFloat(prior).toFixed(4)}</td>
                <td>${calculated.toFixed(6)}</td>
                <td class="${difference >= 0 ? 'positive-diff' : 'negative-diff'}">${difference.toFixed(6)}</td>
                <td>${UIUtils.getBooleanIcon(isDiamondMember)}</td>
                <td>
                    <button class="action-btn visualize-btn" onclick="focusOnNode(${result.node})">View</button>
                    ${isDiamondMember ? `<button class="action-btn diamond-btn" onclick="showNodeDiamonds(${result.node})">Diamonds</button>` : ''}
                </td>
            `;
            
            // Add rank styling
            UIUtils.addRowRankStyling(row, index);
            
            tbody.appendChild(row);
        });
    }

    displayMonteCarloComparison() {
        if (!AppState.monteCarloResults) return;
        
        const mcDiv = this.dom.querySelector('#monteCarloComparison');
        const mcResultsDiv = this.dom.querySelector('#mcResults');
        
        if (!mcDiv || !mcResultsDiv) return;
        
        mcDiv.style.display = 'block';
        
        let maxDiff = 0;
        let avgDiff = 0;
        let diffCount = 0;
        
        const comparisonHtml = AppState.monteCarloResults.map(result => {
            const diff = Math.abs(result.algorithmValue - result.monteCarloValue);
            maxDiff = Math.max(maxDiff, diff);
            avgDiff += diff;
            diffCount++;
            
            return `
                <div class="mc-comparison-row">
                    <span class="node-id">Node ${result.node}</span>
                    <span class="algo-value">Algorithm: ${result.algorithmValue.toFixed(6)}</span>
                    <span class="mc-value">Monte Carlo: ${result.monteCarloValue.toFixed(6)}</span>
                    <span class="diff-value ${diff > 0.01 ? 'high-diff' : 'low-diff'}">Diff: ${diff.toFixed(6)}</span>
                </div>
            `;
        }).join('');
        
        avgDiff /= diffCount;
        
        mcResultsDiv.innerHTML = `
            <div class="mc-summary">
                <div class="mc-stat">
                    <span class="mc-stat-value">${maxDiff.toFixed(6)}</span>
                    <span class="mc-stat-label">Max Difference</span>
                </div>
                <div class="mc-stat">
                    <span class="mc-stat-value">${avgDiff.toFixed(6)}</span>
                    <span class="mc-stat-label">Avg Difference</span>
                </div>
                <div class="mc-stat">
                    <span class="mc-stat-value">${diffCount}</span>
                    <span class="mc-stat-label">Nodes Compared</span>
                </div>
            </div>
            <div class="mc-comparison-list">
                ${comparisonHtml}
            </div>
        `;
    }

    // Utility methods for node analysis (unchanged from original)
    isNodeInDiamond(nodeId) {
        if (!AppState.diamondData || !AppState.diamondData.diamondStructures) return false;
        
        for (const [joinNode, structure] of Object.entries(AppState.diamondData.diamondStructures)) {
            if (structure.diamond) {
                for (const group of structure.diamond) {
                    if (group.relevant_nodes && group.relevant_nodes.includes(nodeId)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    getNodeType(nodeId) {
        if (!AppState.networkData) return 'Unknown';
        
        const types = [];
        if (AppState.networkData.sourceNodes?.includes(nodeId)) types.push('Source');
        if (AppState.networkData.sinkNodes?.includes(nodeId)) types.push('Sink');
        if (AppState.networkData.forkNodes?.includes(nodeId)) types.push('Fork');
        if (AppState.networkData.joinNodes?.includes(nodeId)) types.push('Join');
        
        return types.length > 0 ? types.join(', ') : 'Regular';
    }

    getNodePrior(nodeId) {
        if (AppState.originalNodePriors && AppState.originalNodePriors[nodeId] !== undefined) {
            return AppState.originalNodePriors[nodeId].toFixed(4);
        }
        return 'N/A';
    }

    getNodeProbability(nodeId) {
        if (!AppState.analysisResults?.results) return 'N/A';
        
        const nodeResult = AppState.analysisResults.results.find(r => r.node === nodeId);
        return nodeResult ? nodeResult.probability.toFixed(4) : 'N/A';
    }

    getNodeProbabilityValue(nodeId) {
        if (!AppState.analysisResults?.results) return null;
        
        const nodeResult = AppState.analysisResults.results.find(r => r.node === nodeId);
        return nodeResult ? nodeResult.probability : null;
    }

    getNodeIteration(nodeId) {
        if (!AppState.networkData?.iterationSets) return 'N/A';
        
        for (let i = 0; i < AppState.networkData.iterationSets.length; i++) {
            if (AppState.networkData.iterationSets[i].includes(nodeId)) {
                return i + 1;
            }
        }
        return 'N/A';
    }

    // Getters for state
    getAnalysisResults() {
        return AppState.analysisResults;
    }

    getNetworkData() {
        return AppState.networkData;
    }

    getDiamondData() {
        return AppState.diamondData;
    }

    getCurrentAnalysisMode() {
        return this.currentAnalysisMode;
    }

    getAnalysisHistory() {
        return this.analysisHistory;
    }
}