// Global variables
let currentFile = null;
let analysisResults = null;
let networkData = null;
let diamondData = null;
let monteCarloResults = null;
let selectedNode = null;
let originalNodePriors = null;
let originalEdgeProbabilities = null;

// ===== ICON UTILITY FUNCTIONS =====
// Using CSS-based icons instead of emojis for better cross-platform compatibility

function createIcon(type, size = 16) {
    return `<span class="icon icon-${type}" style="width: ${size}px; height: ${size}px; font-size: ${Math.round(size * 0.75)}px; line-height: ${size}px;"></span>`;
}

function getBooleanIcon(value) {
    return createIcon(value ? 'check' : 'cross');
}

// DOM elements with proper error handling
const fileInput = document.getElementById('fileInput');
const fileStatus = document.getElementById('fileStatus');
const analyzeBtn = document.getElementById('analyzeBtn');
const loading = document.getElementById('loading');
const results = document.getElementById('results');
const error = document.getElementById('error');
const nodePriorSlider = document.getElementById('nodePrior'); // Fixed ID
const edgeProbSlider = document.getElementById('edgeProb'); // Fixed ID
const nodeValueSpan = document.getElementById('nodeValue'); // Fixed ID
const edgeValueSpan = document.getElementById('edgeValue'); // Fixed ID
const includeClassification = document.getElementById('includeClassification');
const enableMonteCarlo = document.getElementById('enableMonteCarlo');
const overrideNodePrior = document.getElementById('overrideNodePrior');
const overrideEdgeProb = document.getElementById('overrideEdgeProb');

// Tab elements
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Results elements
const topNodesSelect = document.getElementById('topNodesSelect');
const sortSelect = document.getElementById('sortSelect');
const exportResultsBtn = document.getElementById('exportResultsBtn');

// Diamond analysis elements
const diamondAnalysis = document.getElementById('diamondAnalysis');
const diamondTypeFilter = document.getElementById('diamondTypeFilter');
const forkStructureFilter = document.getElementById('forkStructureFilter');
const diamondSortSelect = document.getElementById('diamondSortSelect');
const diamondList = document.getElementById('diamondList');
const diamondDetailModal = document.getElementById('diamondDetailModal');
const diamondPathModal = document.getElementById('diamondPathModal');

// Path analysis elements
const pathOverrideNodes = document.getElementById('pathOverrideNodes');
const pathOverrideEdges = document.getElementById('pathOverrideEdges');
const pathNodePrior = document.getElementById('pathNodePrior');
const pathEdgeProb = document.getElementById('pathEdgeProb');
const pathNodeValue = document.getElementById('pathNodeValue');
const pathEdgeValue = document.getElementById('pathEdgeValue');
const runPathAnalysis = document.getElementById('runPathAnalysis');
const resetPathParams = document.getElementById('resetPathParams');
const pathNetworkGraph = document.getElementById('pathNetworkGraph');
const pathResults = document.getElementById('pathResults');
const pathResultsTable = document.getElementById('pathResultsTable');

// Visualization elements
const showSourceNodes = document.getElementById('showSourceNodes');
const showSinkNodes = document.getElementById('showSinkNodes');
const showForkNodes = document.getElementById('showForkNodes');
const showJoinNodes = document.getElementById('showJoinNodes');
const showIterations = document.getElementById('showIterations');
const showDiamonds = document.getElementById('showDiamonds');
const layoutSelect = document.getElementById('layoutSelect');
const focusDiamondSelect = document.getElementById('focusDiamondSelect');
const resetZoomBtn = document.getElementById('resetZoom');
const fitToScreenBtn = document.getElementById('fitToScreen');
const exportDotBtn = document.getElementById('exportDot');
const networkGraph = document.getElementById('network-graph');
const selectedNodeInfo = document.getElementById('selected-node-info');

// Helper function to safely add event listener
function safeAddEventListener(element, event, handler) {
    if (element) {
        element.addEventListener(event, handler);
        return true;
    } else {
        console.warn(`Element not found for event listener: ${event}`);
        return false;
    }
}

// Current path analysis data
let currentDiamondData = null;
let pathNetworkInstance = null;

// Initialize event listeners
document.addEventListener('DOMContentLoaded', function() {
    console.log('Enhanced Network Analysis Tool loaded');
    
    // Verify critical DOM elements exist with CORRECT IDs
    const criticalElements = [
        'fileInput', 'analyzeBtn', 'loading', 'results', 'error',
        'nodePrior', 'edgeProb', 'nodeValue', 'edgeValue' // Fixed: correct element IDs
    ];
    
    const missingElements = [];
    criticalElements.forEach(id => {
        if (!document.getElementById(id)) {
            missingElements.push(id);
        }
    });
    
    if (missingElements.length > 0) {
        console.warn('Missing critical DOM elements:', missingElements);
    }
    
    // File input handler
    safeAddEventListener(fileInput, 'change', handleFileUpload);
    
    // Analyze button handler
    safeAddEventListener(analyzeBtn, 'click', runAnalysis);
    
    // Slider handlers with null checks
    safeAddEventListener(nodePriorSlider, 'input', function() {
        if (nodeValueSpan) nodeValueSpan.textContent = this.value;
    });
    
    safeAddEventListener(edgeProbSlider, 'input', function() {
        if (edgeValueSpan) edgeValueSpan.textContent = this.value;
    });
    
    // Override checkbox handlers with null checks
    safeAddEventListener(overrideNodePrior, 'change', function() {
        if (nodePriorSlider) nodePriorSlider.disabled = !this.checked;
        const paramGroup = this.closest('.parameter-group');
        
        if (this.checked) {
            if (nodeValueSpan) nodeValueSpan.classList.remove('span-disabled');
            if (paramGroup) paramGroup.classList.add('override-active');
        } else {
            if (nodeValueSpan) nodeValueSpan.classList.add('span-disabled');
            if (paramGroup) paramGroup.classList.remove('override-active');
        }
        
        updateCheckboxState(this);
    });
    
    safeAddEventListener(overrideEdgeProb, 'change', function() {
        if (edgeProbSlider) edgeProbSlider.disabled = !this.checked;
        const paramGroup = this.closest('.parameter-group');
        
        if (this.checked) {
            if (edgeValueSpan) edgeValueSpan.classList.remove('span-disabled');
            if (paramGroup) paramGroup.classList.add('override-active');
        } else {
            if (edgeValueSpan) edgeValueSpan.classList.add('span-disabled');
            if (paramGroup) paramGroup.classList.remove('override-active');
        }
        
        updateCheckboxState(this);
    });
    
    // Results control handlers
    safeAddEventListener(topNodesSelect, 'change', updateResultsTable);
    safeAddEventListener(sortSelect, 'change', updateResultsTable);
    safeAddEventListener(exportResultsBtn, 'click', exportResults);
    
    // Diamond analysis handlers
    safeAddEventListener(diamondTypeFilter, 'change', updateDiamondList);
    safeAddEventListener(forkStructureFilter, 'change', updateDiamondList);
    safeAddEventListener(diamondSortSelect, 'change', updateDiamondList);
    
    // Modal close handlers
    const closeButtons = document.querySelectorAll('.close');
    closeButtons.forEach(btn => {
        safeAddEventListener(btn, 'click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
                if (modal.id === 'diamondPathModal') {
                    closeDiamondPathModal();
                }
            }
        });
    });
    
    // Path analysis control handlers
    safeAddEventListener(pathOverrideNodes, 'change', function() {
        if (pathNodePrior) pathNodePrior.disabled = !this.checked;
        updateCheckboxState(this);
    });
    
    safeAddEventListener(pathOverrideEdges, 'change', function() {
        if (pathEdgeProb) pathEdgeProb.disabled = !this.checked;
        updateCheckboxState(this);
    });
    
    safeAddEventListener(pathNodePrior, 'input', function() {
        if (pathNodeValue) pathNodeValue.textContent = this.value;
    });
    
    safeAddEventListener(pathEdgeProb, 'input', function() {
        if (pathEdgeValue) pathEdgeValue.textContent = this.value;
    });
    
    safeAddEventListener(runPathAnalysis, 'click', runDiamondSubsetAnalysis);
    safeAddEventListener(resetPathParams, 'click', resetPathParameters);
    
    // Tab navigation handlers
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetTab = this.dataset.tab;
            switchTab(targetTab);
        });
    });
    
    // Visualization control handlers
    const vizControls = [showSourceNodes, showSinkNodes, showForkNodes, showJoinNodes, showIterations, showDiamonds];
    vizControls.forEach(control => {
        if (control) {
            control.addEventListener('change', function() {
                updateCheckboxState(this);
                updateVisualization();
            });
        }
    });
    
    safeAddEventListener(layoutSelect, 'change', updateVisualization);
    safeAddEventListener(focusDiamondSelect, 'change', focusOnDiamond);
    safeAddEventListener(resetZoomBtn, 'click', resetVisualization);
    safeAddEventListener(fitToScreenBtn, 'click', fitVisualizationToScreen);
    safeAddEventListener(exportDotBtn, 'click', exportGraphAsDot);
    
    // Initialize checkbox states
    updateAllCheckboxStates();
});

// Enhanced checkbox state management with null checks
function updateCheckboxState(checkbox) {
    if (!checkbox) return; // Safety check
    
    const label = checkbox.closest('label');
    if (!label) return; // Safety check
    
    if (checkbox.checked) {
        label.classList.add('active');
        if (!label.classList.contains('active-state-indicator')) {
            label.classList.add('active-state-indicator');
        }
    } else {
        label.classList.remove('active');
        label.classList.remove('active-state-indicator');
    }
}

function updateAllCheckboxStates() {
    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        updateCheckboxState(checkbox);
    });
    
    // Initialize disabled states safely
    if (overrideNodePrior && !overrideNodePrior.checked && nodeValueSpan) {
        nodeValueSpan.classList.add('span-disabled');
    }
    if (overrideEdgeProb && !overrideEdgeProb.checked && edgeValueSpan) {
        edgeValueSpan.classList.add('span-disabled');
    }
}

// Handle file upload
function handleFileUpload(event) {
    const file = event.target.files[0];
    hideElements([results, error, diamondAnalysis]);
    
    if (!file) {
        currentFile = null;
        if (analyzeBtn) analyzeBtn.disabled = true;
        updateFileStatus('No file selected', 'file-error');
        return;
    }
    
    if (!file.name.toLowerCase().endsWith('.csv')) {
        currentFile = null;
        if (analyzeBtn) analyzeBtn.disabled = true;
        updateFileStatus('Please select a CSV file', 'file-error');
        return;
    }
    
    currentFile = file;
    if (analyzeBtn) analyzeBtn.disabled = false;
    updateFileStatus(`File loaded: ${file.name} (${formatFileSize(file.size)})`, 'file-success');
    
    console.log('File loaded:', file.name);
}

// Update file status display
function updateFileStatus(message, className = '') {
    if (fileStatus) {
        fileStatus.textContent = message;
        fileStatus.className = className;
    }
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Hide multiple elements
function hideElements(elements) {
    elements.forEach(el => {
        if (el) el.style.display = 'none';
    });
}

// Show element
function showElement(element) {
    if (element) element.style.display = 'block';
}

// Run analysis
async function runAnalysis() {
    if (!currentFile) {
        showError('Please select a CSV file first');
        return;
    }
    
    console.log('Starting enhanced analysis...');
    
    hideElements([results, error, diamondAnalysis]);
    showElement(loading);
    if (analyzeBtn) analyzeBtn.disabled = true;
    
    try {
        const csvContent = await readFileAsText(currentFile);
        
        const requestData = {
            csvContent: csvContent,
            nodePrior: nodePriorSlider ? parseFloat(nodePriorSlider.value) : 1.0,
            edgeProb: edgeProbSlider ? parseFloat(edgeProbSlider.value) : 0.9,
            overrideNodePrior: overrideNodePrior ? overrideNodePrior.checked : false,
            overrideEdgeProb: overrideEdgeProb ? overrideEdgeProb.checked : false,
            includeClassification: includeClassification ? includeClassification.checked : true,
            enableMonteCarlo: enableMonteCarlo ? enableMonteCarlo.checked : false
        };
        
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
        
        // Store results
        analysisResults = result;
        networkData = result.networkData;
        diamondData = result.diamondData;
        monteCarloResults = result.monteCarloResults;
        
        if (result.originalData) {
            originalNodePriors = result.originalData.nodePriors;
            originalEdgeProbabilities = result.originalData.edgeProbabilities;
        }
        
        // Switch to results tab and display
        switchTab('results');
        displayResults(result);
        
        // Enable other tabs
        enableAllTabs();
        
    } catch (err) {
        console.error('Analysis error:', err);
        showError(`Analysis failed: ${err.message}`);
    } finally {
        hideElements([loading]);
        if (analyzeBtn) analyzeBtn.disabled = false;
    }
}

// Read file as text
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = e => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

// Display enhanced analysis results
function displayResults(result) {
    hideElements([error]);
    showElement(results);
    
    displaySummary(result.summary);
    updateResultsTable();
    
    if (monteCarloResults) {
        displayMonteCarloComparison();
    }
    
    if (diamondData) {
        showElement(diamondAnalysis);
        displayDiamondAnalysis();
    }
    
    console.log('Enhanced results displayed');
}

// Display summary
function displaySummary(summary) {
    const summaryDiv = document.getElementById('summary');
    if (summaryDiv) {
        summaryDiv.innerHTML = `
            <div class="summary-item">
                <span class="value">${summary.nodes}</span>
                <span class="label">Nodes</span>
            </div>
            <div class="summary-item">
                <span class="value">${summary.edges}</span>
                <span class="label">Edges</span>
            </div>
            <div class="summary-item">
                <span class="value">${summary.diamonds}</span>
                <span class="label">Diamonds</span>
            </div>
            <div class="summary-item">
                <span class="value">${summary.nodePrior}</span>
                <span class="label">Node Prior</span>
            </div>
            <div class="summary-item">
                <span class="value">${summary.edgeProbability}</span>
                <span class="label">Edge Probability</span>
            </div>
        `;
    }
}

// Update results table with filtering and sorting
function updateResultsTable() {
    if (!analysisResults) return;
    
    const tbody = document.querySelector('#resultsTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    let results = [...analysisResults.results];
    
    // Sort results
    const sortBy = sortSelect ? sortSelect.value : 'probability';
    results.sort((a, b) => {
        switch (sortBy) {
            case 'probability':
                return b.probability - a.probability;
            case 'node':
                return a.node - b.node;
            case 'type':
                return getNodeType(a.node).localeCompare(getNodeType(b.node));
            default:
                return 0;
        }
    });
    
    // Limit results
    const topCount = topNodesSelect ? topNodesSelect.value : 'all';
    if (topCount !== 'all') {
        results = results.slice(0, parseInt(topCount));
    }
    
    results.forEach((result, index) => {
        const row = document.createElement('tr');
        
        const prior = getNodePrior(result.node);
        const calculated = result.probability;
        const difference = calculated - (parseFloat(prior) || 0);
        const nodeType = getNodeType(result.node);
        const isDiamondMember = isNodeInDiamond(result.node);
        
        row.innerHTML = `
            <td><code class="node-id" data-node="${result.node}">${result.node}</code></td>
            <td><span class="node-type ${nodeType.toLowerCase().replace(/[^a-z]/g, '')}">${nodeType}</span></td>
            <td>${parseFloat(prior).toFixed(4)}</td>
            <td>${calculated.toFixed(6)}</td>
            <td class="${difference >= 0 ? 'positive-diff' : 'negative-diff'}">${difference.toFixed(6)}</td>
            <td>${getBooleanIcon(isDiamondMember)}</td>
            <td>
                <button class="action-btn visualize-btn" onclick="focusOnNode(${result.node})">View</button>
                ${isDiamondMember ? `<button class="action-btn diamond-btn" onclick="showNodeDiamonds(${result.node})">Diamonds</button>` : ''}
            </td>
        `;
        
        // Add rank styling
        if (index < 3) {
            row.classList.add(`rank-${index + 1}`);
        }
        
        tbody.appendChild(row);
    });
}

// Display Monte Carlo comparison
function displayMonteCarloComparison() {
    if (!monteCarloResults) return;
    
    const mcDiv = document.getElementById('monteCarloComparison');
    const mcResultsDiv = document.getElementById('mcResults');
    
    if (!mcDiv || !mcResultsDiv) return;
    
    showElement(mcDiv);
    
    let maxDiff = 0;
    let avgDiff = 0;
    let diffCount = 0;
    
    const comparisonHtml = monteCarloResults.map(result => {
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

// Display diamond analysis
function displayDiamondAnalysis() {
    if (!diamondData) return;
    
    updateDiamondSummary();
    populateFocusDiamondSelect();
    updateDiamondList();
}

// Update diamond summary
function updateDiamondSummary() {
    if (!diamondData.diamondClassifications) return;
    
    const classifications = diamondData.diamondClassifications;
    const totalDiamonds = classifications.length;
    const complexDiamonds = classifications.filter(d => d.complexity_score > 10).length;
    const avgComplexity = classifications.reduce((sum, d) => sum + d.complexity_score, 0) / totalDiamonds;
    const maxPathCount = Math.max(...classifications.map(d => d.path_count));
    
    const totalDiamondsEl = document.getElementById('totalDiamonds');
    const complexDiamondsEl = document.getElementById('complexDiamonds');
    const averageComplexityEl = document.getElementById('averageComplexity');
    const maxPathCountEl = document.getElementById('maxPathCount');
    
    if (totalDiamondsEl) totalDiamondsEl.textContent = totalDiamonds;
    if (complexDiamondsEl) complexDiamondsEl.textContent = complexDiamonds;
    if (averageComplexityEl) averageComplexityEl.textContent = avgComplexity.toFixed(1);
    if (maxPathCountEl) maxPathCountEl.textContent = maxPathCount;
}

// Update diamond list with filtering and sorting
function updateDiamondList() {
    if (!diamondData || !diamondData.diamondClassifications || !diamondList) return;
    
    let diamonds = [...diamondData.diamondClassifications];
    
    // Apply filters
    const typeFilter = diamondTypeFilter ? diamondTypeFilter.value : 'all';
    if (typeFilter !== 'all') {
        diamonds = diamonds.filter(d => d.internal_structure === typeFilter);
    }
    
    const forkFilter = forkStructureFilter ? forkStructureFilter.value : 'all';
    if (forkFilter !== 'all') {
        diamonds = diamonds.filter(d => d.fork_structure === forkFilter);
    }
    
    // Apply sorting
    const sortBy = diamondSortSelect ? diamondSortSelect.value : 'complexity';
    diamonds.sort((a, b) => {
        switch (sortBy) {
            case 'complexity':
                return b.complexity_score - a.complexity_score;
            case 'joinNode':
                return a.join_node - b.join_node;
            case 'size':
                return b.subgraph_size - a.subgraph_size;
            case 'pathCount':
                return b.path_count - a.path_count;
            default:
                return 0;
        }
    });
    
    const listHtml = diamonds.map((diamond, index) => `
        <div class="diamond-card" data-join-node="${diamond.join_node}" data-diamond-index="${index}">
            <div class="diamond-header">
                <h5>Diamond at Join Node ${diamond.join_node}</h5>
                <span class="complexity-badge">${diamond.complexity_score.toFixed(1)}</span>
            </div>
            <div class="diamond-details">
                <div class="diamond-detail-row">
                    <span class="detail-label">Fork Structure:</span>
                    <span class="detail-value">${diamond.fork_structure}</span>
                </div>
                <div class="diamond-detail-row">
                    <span class="detail-label">Internal Structure:</span>
                    <span class="detail-value">${diamond.internal_structure}</span>
                </div>
                <div class="diamond-detail-row">
                    <span class="detail-label">Path Topology:</span>
                    <span class="detail-value">${diamond.path_topology}</span>
                </div>
                <div class="diamond-detail-row">
                    <span class="detail-label">Size:</span>
                    <span class="detail-value">${diamond.subgraph_size} nodes, ${diamond.path_count} paths</span>
                </div>
                <div class="diamond-actions">
                    <button class="action-btn detail-btn" onclick="showDiamondDetail('${diamond.join_node}', ${index})">Details</button>
                    <button class="action-btn visualize-btn" onclick="focusOnDiamondInViz('${diamond.join_node}')">Visualize</button>
                    <button class="action-btn analyze-btn" onclick="analyzeDiamondPaths('${diamond.join_node}')">Analyze Paths</button>
                </div>
            </div>
        </div>
    `).join('');
    
    diamondList.innerHTML = listHtml;
}

// Rest of the functions remain the same but with added null checks...
// [Continuing with the rest of the functions with proper null checking]

// Show diamond detail modal
function showDiamondDetail(joinNode, diamondIndex) {
    if (!diamondData || !diamondData.diamondClassifications) return;
    
    const diamond = diamondData.diamondClassifications[diamondIndex];
    const diamondStructure = diamondData.diamondStructures[joinNode];
    
    const modalTitle = document.getElementById('diamondDetailTitle');
    const modalContent = document.getElementById('diamondDetailContent');
    
    if (!modalTitle || !modalContent || !diamondDetailModal) return;
    
    modalTitle.textContent = `Diamond at Join Node ${joinNode}`;
    
    modalContent.innerHTML = `
        <div class="diamond-detail-full">
            <div class="detail-section">
                <h6>Classification Details</h6>
                <div class="detail-grid">
                    <div class="detail-item">
                        <label>Fork Structure:</label>
                        <span>${diamond.fork_structure}</span>
                    </div>
                    <div class="detail-item">
                        <label>Internal Structure:</label>
                        <span>${diamond.internal_structure}</span>
                    </div>
                    <div class="detail-item">
                        <label>Path Topology:</label>
                        <span>${diamond.path_topology}</span>
                    </div>
                    <div class="detail-item">
                        <label>Join Structure:</label>
                        <span>${diamond.join_structure}</span>
                    </div>
                    <div class="detail-item">
                        <label>External Connectivity:</label>
                        <span>${diamond.external_connectivity}</span>
                    </div>
                    <div class="detail-item">
                        <label>Degeneracy:</label>
                        <span>${diamond.degeneracy}</span>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h6>Metrics</h6>
                <div class="metrics-grid">
                    <div class="metric-item">
                        <span class="metric-value">${diamond.fork_count}</span>
                        <span class="metric-label">Fork Count</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-value">${diamond.subgraph_size}</span>
                        <span class="metric-label">Subgraph Size</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-value">${diamond.internal_forks}</span>
                        <span class="metric-label">Internal Forks</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-value">${diamond.internal_joins}</span>
                        <span class="metric-label">Internal Joins</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-value">${diamond.path_count}</span>
                        <span class="metric-label">Path Count</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-value">${diamond.complexity_score.toFixed(2)}</span>
                        <span class="metric-label">Complexity Score</span>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h6>Optimization Insights</h6>
                <div class="insight-item">
                    <label>Optimization Potential:</label>
                    <span class="insight-value">${diamond.optimization_potential}</span>
                </div>
                <div class="insight-item">
                    <label>Bottleneck Risk:</label>
                    <span class="insight-value ${diamond.bottleneck_risk.toLowerCase()}">${diamond.bottleneck_risk}</span>
                </div>
            </div>
            
            ${diamondStructure ? `
            <div class="detail-section">
                <h6>Structure Details</h6>
                <div class="structure-details">
                    <p><strong>Non-Diamond Parents:</strong> ${Array.from(diamondStructure.non_diamond_parents || []).join(', ') || 'None'}</p>
                    <div class="diamond-groups">
                        ${diamondStructure.diamond.map((group, i) => `
                            <div class="diamond-group-detail">
                                <h7>Diamond Group ${i + 1}</h7>
                                <p><strong>Highest Nodes:</strong> ${Array.from(group.highest_nodes || []).join(', ')}</p>
                                <p><strong>Relevant Nodes:</strong> ${Array.from(group.relevant_nodes || []).join(', ')}</p>
                                <p><strong>Edges:</strong> ${group.edgelist ? group.edgelist.length : 0} edges</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            ` : ''}
        </div>
    `;
    
    showElement(diamondDetailModal);
}

// Utility functions with null checks
function isNodeInDiamond(nodeId) {
    if (!diamondData || !diamondData.diamondStructures) return false;
    
    for (const [joinNode, structure] of Object.entries(diamondData.diamondStructures)) {
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

function getNodeType(nodeId) {
    if (!networkData) return 'Unknown';
    
    const types = [];
    if (networkData.sourceNodes?.includes(nodeId)) types.push('Source');
    if (networkData.sinkNodes?.includes(nodeId)) types.push('Sink');
    if (networkData.forkNodes?.includes(nodeId)) types.push('Fork');
    if (networkData.joinNodes?.includes(nodeId)) types.push('Join');
    
    return types.length > 0 ? types.join(', ') : 'Regular';
}

function getNodePrior(nodeId) {
    if (originalNodePriors && originalNodePriors[nodeId] !== undefined) {
        return originalNodePriors[nodeId].toFixed(4);
    }
    return 'N/A';
}

// Tab management
function switchTab(tabName) {
    tabBtns.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);
    const targetContent = document.getElementById(`${tabName}-tab`);
    
    if (targetBtn) targetBtn.classList.add('active');
    if (targetContent) targetContent.classList.add('active');
    
    if (tabName === 'visualization' && networkData) {
        setTimeout(() => updateVisualization(), 100);
    }
}

function enableAllTabs() {
    tabBtns.forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1';
    });
}

// Enhanced visualization functions
function updateVisualization() {
    if (!networkData) return;
    
    createNetworkVisualization();
}

function createNetworkVisualization() {
    if (!networkGraph) return;
    
    networkGraph.innerHTML = '';
    
    if (!networkData || !networkData.nodes) {
        networkGraph.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666; font-size: 16px; text-align: center;"><div>${createIcon('network', 32)}<br>No network data available<br><small>Run analysis first</small></div></div>`;
        return;
    }
    
    const visNodes = networkData.nodes.map(nodeId => {
        const node = {
            id: nodeId,
            label: nodeId.toString(),
            color: getNodeColor(nodeId),
            font: { color: 'white', size: 12, face: 'Arial' },
            size: getNodeSize(nodeId),
            borderWidth: 2,
            borderColor: '#333',
            shadow: { enabled: true, color: 'rgba(0,0,0,0.1)', size: 5 }
        };
        
        const prior = getNodePrior(nodeId);
        const calculated = getNodeProbability(nodeId);
        const isDiamondMember = isNodeInDiamond(nodeId);
        
        node.title = `<strong>Node: ${nodeId}</strong><br/>` +
                    `Type: ${getNodeType(nodeId)}<br/>` +
                    `Prior: ${prior}<br/>` +
                    `Calculated: ${calculated}<br/>` +
                    `Iteration: ${getNodeIteration(nodeId)}<br/>` +
                    `Diamond Member: ${isDiamondMember ? 'Yes' : 'No'}`;
        
        return node;
    });
    
    const visEdges = networkData.edges.map((edge, index) => ({
        id: index,
        from: edge[0],
        to: edge[1],
        arrows: 'to',
        color: { color: '#666', highlight: '#667eea' },
        width: 2,
        smooth: { type: 'dynamic' },
        shadow: { enabled: true, color: 'rgba(0,0,0,0.1)', size: 2 }
    }));
    
    const data = {
        nodes: new vis.DataSet(visNodes),
        edges: new vis.DataSet(visEdges)
    };
    
    const options = {
        layout: getLayoutOptions(),
        physics: {
            enabled: layoutSelect ? layoutSelect.value === 'force' : false,
            stabilization: { iterations: 150 },
            barnesHut: { gravitationalConstant: -2000, springConstant: 0.001 }
        },
        interaction: {
            hover: true,
            selectConnectedEdges: true,
            tooltipDelay: 100
        },
        edges: {
            smooth: { type: 'continuous' },
            arrows: { to: { enabled: true, scaleFactor: 0.8 } }
        },
        nodes: {
            chosen: {
                node: function(values, id, selected, hovering) {
                    values.shadowColor = '#667eea';
                    values.shadowSize = 15;
                    values.borderWidth = 4;
                }
            }
        }
    };
    
    const network = new vis.Network(networkGraph, data, options);
    
    network.on('selectNode', function(event) {
        if (event.nodes.length > 0) {
            selectNode(event.nodes[0]);
        }
    });
    
    network.on('deselectNode', function() {
        selectedNode = null;
        updateNodeDetails();
    });
    
    window.networkInstance = network;
    
    console.log('Enhanced network visualization created');
}

// Rest of the functions with proper null checking...
function getNodeColor(nodeId) {
    const colors = {
        source: '#ff6b6b',
        sink: '#4ecdc4',
        fork: '#45b7d1',
        join: '#96ceb4',
        diamond: '#fd79a8',
        regular: '#74b9ff'
    };
    
    if (showDiamonds && showDiamonds.checked && isNodeInDiamond(nodeId)) {
        return colors.diamond;
    }
    
    if (showSourceNodes && showSourceNodes.checked && networkData.sourceNodes?.includes(nodeId)) {
        return colors.source;
    }
    if (showSinkNodes && showSinkNodes.checked && networkData.sinkNodes?.includes(nodeId)) {
        return colors.sink;
    }
    if (showForkNodes && showForkNodes.checked && networkData.forkNodes?.includes(nodeId)) {
        return colors.fork;
    }
    if (showJoinNodes && showJoinNodes.checked && networkData.joinNodes?.includes(nodeId)) {
        return colors.join;
    }
    
    if (showIterations && showIterations.checked && networkData.iterationSets) {
        const iterationColors = ['#e17055', '#fdcb6e', '#6c5ce7', '#a29bfe', '#fd79a8'];
        for (let i = 0; i < networkData.iterationSets.length; i++) {
            if (networkData.iterationSets[i].includes(nodeId)) {
                return iterationColors[i % iterationColors.length];
            }
        }
    }
    
    return colors.regular;
}

function getNodeSize(nodeId) {
    const probability = getNodeProbabilityValue(nodeId);
    if (probability !== null) {
        return 15 + (probability * 20);
    }
    return 15;
}

function getLayoutOptions() {
    if (!layoutSelect) return { randomSeed: 2 };
    
    switch (layoutSelect.value) {
        case 'hierarchical':
            return {
                hierarchical: {
                    enabled: true,
                    direction: 'UD',
                    sortMethod: 'directed',
                    levelSeparation: 120,
                    nodeSpacing: 120,
                    treeSpacing: 200
                }
            };
        case 'circular':
            return { randomSeed: 2 };
        case 'force':
        default:
            return { randomSeed: 2 };
    }
}

function selectNode(nodeId) {
    selectedNode = nodeId;
    updateNodeDetails();
    highlightNodeConnections(nodeId);
}

function updateNodeDetails() {
    if (!selectedNodeInfo) return;
    
    if (!selectedNode || !networkData) {
        selectedNodeInfo.innerHTML = `<div style="text-align: center; color: #666; padding: 20px;">${createIcon('network', 24)}<br>Click a node to see details</div>`;
        return;
    }
    
    const prior = getNodePrior(selectedNode);
    const calculated = getNodeProbability(selectedNode);
    const nodeType = getNodeType(selectedNode);
    const iteration = getNodeIteration(selectedNode);
    const isDiamondMember = isNodeInDiamond(selectedNode);
    const diamondJoinNodes = getNodeDiamondJoinNodes(selectedNode);
    
    selectedNodeInfo.innerHTML = `
        <div class="node-detail-item">
            <strong>Node:</strong> ${selectedNode}
        </div>
        <div class="node-detail-item">
            <strong>Type:</strong> ${nodeType}
        </div>
        <div class="node-detail-item">
            <strong>Iteration Set:</strong> ${iteration}
        </div>
        <div class="node-detail-item">
            <strong>Diamond Member:</strong> ${getBooleanIcon(isDiamondMember)} ${isDiamondMember ? 'Yes' : 'No'}
        </div>
        
        <div class="probability-comparison">
            <div class="prob-item prior">
                <span class="prob-value">${prior}</span>
                <div class="prob-label">Prior Probability</div>
            </div>
            <div class="prob-item calculated">
                <span class="prob-value">${calculated}</span>
                <div class="prob-label">Calculated Belief</div>
            </div>
        </div>
        
        ${isDiamondMember ? `
        <div class="diamond-membership">
            <h6>Diamond Memberships</h6>
            <div class="diamond-join-nodes">
                ${diamondJoinNodes.map(joinNode => 
                    `<button class="diamond-join-btn" onclick="showDiamondForJoin(${joinNode})">${joinNode}</button>`
                ).join('')}
            </div>
        </div>
        ` : ''}
        
        <div style="margin-top: 15px; display: flex; gap: 8px; flex-wrap: wrap;">
            <button onclick="highlightAncestors('${selectedNode}')" style="flex: 1; min-width: 120px; padding: 6px 10px; font-size: 12px; background: #ffeaa7; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">Ancestors</button>
            <button onclick="highlightDescendants('${selectedNode}')" style="flex: 1; min-width: 120px; padding: 6px 10px; font-size: 12px; background: #fd79a8; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; color: white;">Descendants</button>
        </div>
    `;
}

// Helper functions for diamond analysis
function getNodeDiamondJoinNodes(nodeId) {
    const joinNodes = [];
    if (!diamondData || !diamondData.diamondStructures) return joinNodes;
    
    for (const [joinNode, structure] of Object.entries(diamondData.diamondStructures)) {
        if (structure.diamond) {
            for (const group of structure.diamond) {
                if (group.relevant_nodes && group.relevant_nodes.includes(nodeId)) {
                    joinNodes.push(parseInt(joinNode));
                    break;
                }
            }
        }
    }
    return joinNodes;
}

function populateFocusDiamondSelect() {
    if (!diamondData || !focusDiamondSelect) return;
    
    focusDiamondSelect.innerHTML = '<option value="none">None</option>';
    
    if (diamondData.diamondClassifications) {
        diamondData.diamondClassifications.forEach(diamond => {
            const option = document.createElement('option');
            option.value = diamond.join_node;
            option.textContent = `Diamond at Join ${diamond.join_node}`;
            focusDiamondSelect.appendChild(option);
        });
    }
}

// Action functions
function focusOnNode(nodeId) {
    switchTab('visualization');
    setTimeout(() => {
        if (window.networkInstance) {
            window.networkInstance.selectNodes([nodeId]);
            window.networkInstance.focus(nodeId, {
                scale: 1.5,
                animation: { duration: 1000, easingFunction: 'easeInOutQuad' }
            });
        }
    }, 200);
}

function showNodeDiamonds(nodeId) {
    const joinNodes = getNodeDiamondJoinNodes(nodeId);
    if (joinNodes.length > 0) {
        switchTab('diamonds');
        setTimeout(() => {
            joinNodes.forEach(joinNode => {
                const diamondCard = document.querySelector(`[data-join-node="${joinNode}"]`);
                if (diamondCard) {
                    diamondCard.classList.add('highlighted');
                    diamondCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        }, 200);
    }
}

function focusOnDiamondInViz(joinNode) {
    switchTab('visualization');
    if (focusDiamondSelect) {
        focusDiamondSelect.value = joinNode;
        setTimeout(() => focusOnDiamond(), 200);
    }
}

function focusOnDiamond() {
    if (!focusDiamondSelect) return;
    
    const joinNode = focusDiamondSelect.value;
    if (joinNode === 'none' || !window.networkInstance) return;
    
    // Get all nodes in the diamond
    const diamondNodes = [];
    if (diamondData && diamondData.diamondStructures[joinNode]) {
        const structure = diamondData.diamondStructures[joinNode];
        if (structure.diamond) {
            structure.diamond.forEach(group => {
                if (group.relevant_nodes) {
                    diamondNodes.push(...group.relevant_nodes);
                }
            });
        }
        diamondNodes.push(parseInt(joinNode)); // Add join node
    }
    
    if (diamondNodes.length > 0) {
        window.networkInstance.selectNodes(diamondNodes);
        window.networkInstance.fit({
            nodes: diamondNodes,
            animation: { duration: 1000, easingFunction: 'easeInOutQuad' }
        });
    }
}

function showDiamondForJoin(joinNode) {
    switchTab('diamonds');
    setTimeout(() => {
        const diamondCard = document.querySelector(`[data-join-node="${joinNode}"]`);
        if (diamondCard) {
            diamondCard.classList.add('highlighted');
            diamondCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 200);
}

function analyzeDiamondPaths(joinNode) {
    console.log('Analyzing paths for diamond at join node:', joinNode);
    
    if (!diamondData || !diamondData.diamondStructures || !diamondData.diamondStructures[joinNode]) {
        alert('No diamond data available for this join node');
        return;
    }
    
    // Store current diamond data
    currentDiamondData = {
        joinNode: joinNode,
        structure: diamondData.diamondStructures[joinNode],
        classification: diamondData.diamondClassifications.find(d => d.join_node == joinNode)
    };
    
    // Set modal title
    const pathTitle = document.getElementById('diamondPathTitle');
    if (pathTitle) {
        pathTitle.textContent = `Diamond Path Analysis - Join Node ${joinNode}`;
    }
    
    // Reset parameters
    resetPathParameters();
    
    // Create diamond subgraph visualization
    createDiamondSubgraphVisualization();
    
    // Show modal
    showElement(diamondPathModal);
}

function createDiamondSubgraphVisualization() {
    if (!currentDiamondData || !pathNetworkGraph) return;
    
    const structure = currentDiamondData.structure;
    const joinNode = currentDiamondData.joinNode;
    
    // Collect all nodes in the diamond
    const diamondNodes = new Set();
    diamondNodes.add(parseInt(joinNode)); // Add join node
    
    // Add all nodes from diamond groups
    structure.diamond.forEach(group => {
        if (group.relevant_nodes) {
            group.relevant_nodes.forEach(node => diamondNodes.add(node));
        }
        if (group.highest_nodes) {
            group.highest_nodes.forEach(node => diamondNodes.add(node));
        }
    });
    
    // Add non-diamond parents
    if (structure.non_diamond_parents) {
        structure.non_diamond_parents.forEach(node => diamondNodes.add(node));
    }
    
    // Collect all edges in the diamond
    const diamondEdges = [];
    structure.diamond.forEach(group => {
        if (group.edgelist) {
            group.edgelist.forEach(edge => {
                if (Array.isArray(edge) && edge.length === 2) {
                    diamondEdges.push(edge);
                }
            });
        }
    });
    
    // Create vis.js nodes
    const visNodes = Array.from(diamondNodes).map(nodeId => {
        const node = {
            id: nodeId,
            label: nodeId.toString(),
            font: { color: 'white', size: 14, face: 'Arial' },
            size: 20,
            borderWidth: 2,
            borderColor: '#333',
            shadow: { enabled: true, color: 'rgba(0,0,0,0.1)', size: 3 }
        };
        
        // Color coding for diamond nodes
        if (nodeId == joinNode) {
            node.color = '#96ceb4'; // Join node - green
        } else if (structure.non_diamond_parents && structure.non_diamond_parents.includes(nodeId)) {
            node.color = '#ff6b6b'; // Non-diamond parent - red
        } else {
            // Check if it's a highest node (fork)
            let isHighest = false;
            structure.diamond.forEach(group => {
                if (group.highest_nodes && group.highest_nodes.includes(nodeId)) {
                    isHighest = true;
                }
            });
            node.color = isHighest ? '#45b7d1' : '#fd79a8'; // Fork - blue, Internal - pink
        }
        
        node.title = `<strong>Node: ${nodeId}</strong><br/>` +
                    `Role: ${nodeId == joinNode ? 'Join' : 
                            (structure.non_diamond_parents && structure.non_diamond_parents.includes(nodeId)) ? 'External Parent' : 'Diamond Member'}`;
        
        return node;
    });
    
    // Create vis.js edges
    const visEdges = diamondEdges.map((edge, index) => ({
        id: index,
        from: edge[0],
        to: edge[1],
        arrows: 'to',
        color: { color: '#666', highlight: '#6c5ce7' },
        width: 2,
        smooth: { type: 'dynamic' }
    }));
    
    // Create dataset
    const data = {
        nodes: new vis.DataSet(visNodes),
        edges: new vis.DataSet(visEdges)
    };
    
    // Configure options for smaller subgraph
    const options = {
        layout: {
            force: {
                enabled: true,
                direction: 'UD',
                sortMethod: 'directed',
                levelSeparation: 80,
                nodeSpacing: 80
            }
        },
        physics: {
            enabled: false
        },
        interaction: {
            hover: true,
            selectConnectedEdges: true,
            tooltipDelay: 100
        },
        edges: {
            smooth: { type: 'continuous' },
            arrows: { to: { enabled: true, scaleFactor: 0.8 } }
        }
    };
    
    // Clear and create network
    pathNetworkGraph.innerHTML = '';
    pathNetworkInstance = new vis.Network(pathNetworkGraph, data, options);
    
    console.log('Diamond subgraph created with', visNodes.length, 'nodes and', visEdges.length, 'edges');
}

function resetPathParameters() {
    if (pathOverrideNodes) {
        pathOverrideNodes.checked = false;
        if (pathNodePrior) pathNodePrior.disabled = true;
        if (pathNodePrior) pathNodePrior.value = '1.0';
        if (pathNodeValue) pathNodeValue.textContent = '1.0';
        updateCheckboxState(pathOverrideNodes);
    }
    
    if (pathOverrideEdges) {
        pathOverrideEdges.checked = false;
        if (pathEdgeProb) pathEdgeProb.disabled = true;
        if (pathEdgeProb) pathEdgeProb.value = '0.9';
        if (pathEdgeValue) pathEdgeValue.textContent = '0.9';
        updateCheckboxState(pathOverrideEdges);
    }
    
    // Hide results
    hideElements([pathResults]);
}

async function runDiamondSubsetAnalysis() {
    if (!currentDiamondData) return;
    
    console.log('Running diamond subset analysis...');
    
    try {
        // Prepare request data
        const requestData = {
            diamondData: currentDiamondData,
            overrideNodePrior: pathOverrideNodes ? pathOverrideNodes.checked : false,
            overrideEdgeProb: pathOverrideEdges ? pathOverrideEdges.checked : false,
            nodePrior: pathNodePrior ? parseFloat(pathNodePrior.value) : 1.0,
            edgeProb: pathEdgeProb ? parseFloat(pathEdgeProb.value) : 0.9
        };
        
        // Show loading state
        if (runPathAnalysis) {
            runPathAnalysis.disabled = true;
            runPathAnalysis.textContent = 'Analyzing...';
        }
        
        // Make API request
        const response = await fetch('/api/analyze-diamond-subset', {
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
            throw new Error(result.error || 'Subset analysis failed');
        }
        
        console.log('Subset analysis complete:', result);
        
        // Display results
        displayPathAnalysisResults(result.results);
        
    } catch (err) {
        console.error('Subset analysis error:', err);
        alert(`Subset analysis failed: ${err.message}`);
    } finally {
        // Reset button state
        if (runPathAnalysis) {
            runPathAnalysis.disabled = false;
            runPathAnalysis.textContent = 'Run Analysis';
        }
    }
}

function displayPathAnalysisResults(results) {
    if (!results || results.length === 0 || !pathResultsTable) {
        if (pathResultsTable) pathResultsTable.innerHTML = '<p>No results available</p>';
        return;
    }
    
    // Sort results by node ID
    results.sort((a, b) => a.node - b.node);
    
    // Create results HTML
    const resultsHtml = results.map(result => `
        <div class="path-result-item">
            <span class="path-result-node">Node ${result.node}</span>
            <span class="path-result-prob">${result.probability.toFixed(6)}</span>
        </div>
    `).join('');
    
    pathResultsTable.innerHTML = resultsHtml;
    showElement(pathResults);
    
    console.log('Path analysis results displayed');
}

function closeDiamondPathModal() {
    hideElements([diamondPathModal]);
    currentDiamondData = null;
    pathNetworkInstance = null;
    if (pathNetworkGraph) pathNetworkGraph.innerHTML = '';
    hideElements([pathResults]);
}

// Helper functions continued
function getNodeProbability(nodeId) {
    if (!analysisResults?.results) return 'N/A';
    
    const nodeResult = analysisResults.results.find(r => r.node === nodeId);
    return nodeResult ? nodeResult.probability.toFixed(4) : 'N/A';
}

function getNodeProbabilityValue(nodeId) {
    if (!analysisResults?.results) return null;
    
    const nodeResult = analysisResults.results.find(r => r.node === nodeId);
    return nodeResult ? nodeResult.probability : null;
}

function getNodeIteration(nodeId) {
    if (!networkData?.iterationSets) return 'N/A';
    
    for (let i = 0; i < networkData.iterationSets.length; i++) {
        if (networkData.iterationSets[i].includes(nodeId)) {
            return i + 1;
        }
    }
    return 'N/A';
}

function highlightNodeConnections(nodeId) {
    if (!window.networkInstance) return;
    
    const connectedNodes = window.networkInstance.getConnectedNodes(nodeId);
    const connectedEdges = window.networkInstance.getConnectedEdges(nodeId);
    
    window.networkInstance.setSelection({
        nodes: [nodeId, ...connectedNodes],
        edges: connectedEdges
    }, { highlightEdges: true });
}

function highlightAncestors(nodeId) {
    if (!networkData?.ancestors || !window.networkInstance) return;
    
    const ancestors = networkData.ancestors[nodeId] || [];
    const nodes = window.networkInstance.body.data.nodes;
    
    nodes.update(networkData.nodes.map(id => ({
        id: id,
        color: ancestors.includes(id) ? '#ffeaa7' : getNodeColor(id),
        borderWidth: ancestors.includes(id) ? 4 : 2
    })));
    
    window.networkInstance.setSelection({ 
        nodes: [nodeId, ...ancestors], 
        edges: [] 
    });
}

function highlightDescendants(nodeId) {
    if (!networkData?.descendants || !window.networkInstance) return;
    
    const descendants = networkData.descendants[nodeId] || [];
    const nodes = window.networkInstance.body.data.nodes;
    
    nodes.update(networkData.nodes.map(id => ({
        id: id,
        color: descendants.includes(id) ? '#fd79a8' : getNodeColor(id),
        borderWidth: descendants.includes(id) ? 4 : 2
    })));
    
    window.networkInstance.setSelection({ 
        nodes: [nodeId, ...descendants], 
        edges: [] 
    });
}

function resetVisualization() {
    selectedNode = null;
    updateNodeDetails();
    
    if (window.networkInstance) {
        window.networkInstance.unselectAll();
        window.networkInstance.setSelection({ nodes: [], edges: [] });
    }
    
    updateVisualization();
}

function fitVisualizationToScreen() {
    if (window.networkInstance) {
        window.networkInstance.fit({
            animation: {
                duration: 1000,
                easingFunction: 'easeInOutQuad'
            }
        });
    }
}

// Export functions
function exportResults() {
    if (!analysisResults) return;
    
    const csvContent = [
        ['Node', 'Type', 'Prior', 'Calculated', 'Difference', 'Diamond Member'].join(','),
        ...analysisResults.results.map(result => {
            const prior = parseFloat(getNodePrior(result.node)) || 0;
            const calculated = result.probability;
            const difference = calculated - prior;
            const isDiamondMember = isNodeInDiamond(result.node);
            
            return [
                result.node,
                getNodeType(result.node),
                prior.toFixed(6),
                calculated.toFixed(6),
                difference.toFixed(6),
                isDiamondMember ? 'Yes' : 'No'
            ].join(',');
        })
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'network_analysis_results.csv';
    a.click();
    URL.revokeObjectURL(url);
}

async function exportGraphAsDot() {
    if (!networkData) {
        alert('No network data available to export');
        return;
    }
    
    try {
        const response = await fetch('/api/export-dot', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                networkData: networkData,
                showSourceNodes: showSourceNodes ? showSourceNodes.checked : false,
                showSinkNodes: showSinkNodes ? showSinkNodes.checked : false,
                showForkNodes: showForkNodes ? showForkNodes.checked : false,
                showJoinNodes: showJoinNodes ? showJoinNodes.checked : false,
                showIterations: showIterations ? showIterations.checked : false,
                showDiamonds: showDiamonds ? showDiamonds.checked : false
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            const blob = new Blob([result.dotString], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'network_graph.dot';
            a.click();
            URL.revokeObjectURL(url);
            
            console.log('DOT file exported successfully');
        } else {
            throw new Error(result.error || 'Export failed');
        }
    } catch (err) {
        console.error('Export error:', err);
        alert(`Export failed: ${err.message}`);
    }
}

// Error handling
function showError(message) {
    hideElements([results, loading, diamondAnalysis]);
    if (error) {
        error.textContent = `Error: ${message}`;
        showElement(error);
    }
    console.error('Error:', message);
}

// Window click handler for modals
window.onclick = function(event) {
    if (event.target === diamondDetailModal) {
        hideElements([diamondDetailModal]);
    }
    if (event.target === diamondPathModal) {
        closeDiamondPathModal();
    }
}