// analysis-manager.js - Analysis operations and results management
import { AppState } from '../main.js';
import { UIUtils } from '../utils/ui-utils.js';

export class AnalysisManager {
    constructor(domManager) {
        this.dom = domManager;
    }

    initializeEventListeners() {
        // Analyze button handler
        this.dom.safeAddEventListener('analyzeBtn', 'click', () => {
            this.runAnalysis();
        });
        
        // Results control handlers
        this.dom.safeAddEventListener('topNodesSelect', 'change', () => {
            this.updateResultsTable();
        });
        
        this.dom.safeAddEventListener('sortSelect', 'change', () => {
            this.updateResultsTable();
        });
    }

    async runAnalysis() {
        if (!AppState.currentFile) {
            this.dom.showError('Please select a CSV file first');
            return;
        }
        
        console.log('Starting enhanced analysis...');
        
        this.dom.hideElements(['results', 'error', 'diamondAnalysis']);
        this.dom.showElement('loading');
        this.dom.setElementDisabled('analyzeBtn', true);
        
        try {
            const fileManager = window.AppManagers.file;
            const csvContent = await fileManager.readCurrentFileAsText();
            
            const requestData = fileManager.getAnalysisRequestData();
            requestData.csvContent = csvContent;
            
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
            
            console.log('Enhanced analysis complete:', result);
            
            // Store results in global state
            AppState.analysisResults = result;
            AppState.networkData = result.networkData;
            AppState.diamondData = result.diamondData;
            AppState.monteCarloResults = result.monteCarloResults;
            
            if (result.originalData) {
                AppState.originalNodePriors = result.originalData.nodePriors;
                AppState.originalEdgeProbabilities = result.originalData.edgeProbabilities;
            }
            
            // Switch to results tab and display
            window.AppManagers.tab.switchTab('results');
            this.displayResults(result);
            
            // Enable other tabs
            window.AppManagers.tab.enableAllTabs();
            
        } catch (err) {
            console.error('Analysis error:', err);
            this.dom.showError(`Analysis failed: ${err.message}`);
        } finally {
            this.dom.hideElements(['loading']);
            this.dom.setElementDisabled('analyzeBtn', false);
        }
    }

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

    // Utility methods for node analysis
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

    getAnalysisResults() {
        return AppState.analysisResults;
    }

    getNetworkData() {
        return AppState.networkData;
    }

    getDiamondData() {
        return AppState.diamondData;
    }
}