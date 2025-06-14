// Global variables
let currentFile = null;
let analysisResults = null;
let networkData = null; // Store the network structure data
let selectedNode = null;

// DOM elements
const fileInput = document.getElementById('fileInput');
const fileStatus = document.getElementById('fileStatus');
const analyzeBtn = document.getElementById('analyzeBtn');
const loading = document.getElementById('loading');
const results = document.getElementById('results');
const error = document.getElementById('error');
const nodePriorSlider = document.getElementById('nodePrior');
const edgeProbSlider = document.getElementById('edgeProb');
const nodeValueSpan = document.getElementById('nodeValue');
const edgeValueSpan = document.getElementById('edgeValue');
const includeClassification = document.getElementById('includeClassification');
const overrideNodePrior = document.getElementById('overrideNodePrior');
const overrideEdgeProb = document.getElementById('overrideEdgeProb');

// Tab elements
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Visualization elements
const showSourceNodes = document.getElementById('showSourceNodes');
const showSinkNodes = document.getElementById('showSinkNodes');
const showForkNodes = document.getElementById('showForkNodes');
const showJoinNodes = document.getElementById('showJoinNodes');
const showIterations = document.getElementById('showIterations');
const layoutSelect = document.getElementById('layoutSelect');
const resetZoomBtn = document.getElementById('resetZoom');
const fitToScreenBtn = document.getElementById('fitToScreen');
const exportDotBtn = document.getElementById('exportDot');
const networkGraph = document.getElementById('network-graph');
const selectedNodeInfo = document.getElementById('selected-node-info');

// Initialize event listeners
document.addEventListener('DOMContentLoaded', function() {
    console.log('Network Analysis Tool loaded');
    
    // File input handler
    fileInput.addEventListener('change', handleFileUpload);
    
    // Analyze button handler
    analyzeBtn.addEventListener('click', runAnalysis);
    
    // Slider handlers
    nodePriorSlider.addEventListener('input', function() {
        nodeValueSpan.textContent = this.value;
    });
    
    edgeProbSlider.addEventListener('input', function() {
        edgeValueSpan.textContent = this.value;
    });
    
    // Classification checkbox handler
    includeClassification.addEventListener('change', function() {
        const classificationDiv = document.getElementById('classification');
        if (analysisResults && classificationDiv) {
            classificationDiv.style.display = this.checked ? 'block' : 'none';
        }
    });
    
    // Override checkbox handlers
    overrideNodePrior.addEventListener('change', function() {
        nodePriorSlider.disabled = !this.checked;
        nodeValueSpan.style.opacity = this.checked ? '1' : '0.5';
        console.log('Override node prior:', this.checked);
    });
    
    overrideEdgeProb.addEventListener('change', function() {
        edgeProbSlider.disabled = !this.checked;
        edgeValueSpan.style.opacity = this.checked ? '1' : '0.5';
        console.log('Override edge prob:', this.checked);
    });
    
    // Tab navigation handlers
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetTab = this.dataset.tab;
            switchTab(targetTab);
        });
    });
    
    // Visualization control handlers
    showSourceNodes.addEventListener('change', updateVisualization);
    showSinkNodes.addEventListener('change', updateVisualization);
    showForkNodes.addEventListener('change', updateVisualization);
    showJoinNodes.addEventListener('change', updateVisualization);
    showIterations.addEventListener('change', updateVisualization);
    layoutSelect.addEventListener('change', updateVisualization);
    
    resetZoomBtn.addEventListener('click', resetVisualization);
    fitToScreenBtn.addEventListener('click', fitVisualizationToScreen);
    exportDotBtn.addEventListener('click', exportGraphAsDot);
});

// Handle file upload
function handleFileUpload(event) {
    const file = event.target.files[0];
    hideElements([results, error]);
    
    if (!file) {
        currentFile = null;
        analyzeBtn.disabled = true;
        updateFileStatus('No file selected', 'file-error');
        return;
    }
    
    if (!file.name.toLowerCase().endsWith('.csv')) {
        currentFile = null;
        analyzeBtn.disabled = true;
        updateFileStatus('Please select a CSV file', 'file-error');
        return;
    }
    
    currentFile = file;
    analyzeBtn.disabled = false;
    updateFileStatus(`File loaded: ${file.name} (${formatFileSize(file.size)})`, 'file-success');
    
    console.log('File loaded:', file.name);
}

// Update file status display
function updateFileStatus(message, className = '') {
    fileStatus.textContent = message;
    fileStatus.className = className;
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
    
    console.log('Starting analysis...');
    
    // Show loading, hide other sections
    hideElements([results, error]);
    showElement(loading);
    analyzeBtn.disabled = true;
    
    try {
        // Read file content
        const csvContent = await readFileAsText(currentFile);
        
        // Get parameters
        const nodePrior = parseFloat(nodePriorSlider.value);
        const edgeProb = parseFloat(edgeProbSlider.value);
        const overrideNodePriorValue = overrideNodePrior.checked;
        const overrideEdgeProbValue = overrideEdgeProb.checked;
        
        console.log('Parameters:', { 
            nodePrior, 
            edgeProb, 
            overrideNodePrior: overrideNodePriorValue,
            overrideEdgeProb: overrideEdgeProbValue
        });
        
        // Make API request
        const requestData = {
            csvContent: csvContent,
            nodePrior: nodePrior,
            edgeProb: edgeProb,
            overrideNodePrior: overrideNodePriorValue,
            overrideEdgeProb: overrideEdgeProbValue
        };
        
        const response = await fetch('/api/analyze', {
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
        
        console.log('Analysis complete:', result);
        
        // Store results and display
        analysisResults = result;
        networkData = result.networkData; // Store network structure for visualization
        displayResults(result);
        
        // Enable visualization tab if we have network data
        if (networkData) {
            enableVisualizationTab();
        }
        
    } catch (err) {
        console.error('Analysis error:', err);
        showError(`Analysis failed: ${err.message}`);
    } finally {
        hideElements([loading]);
        analyzeBtn.disabled = false;
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

// Display analysis results
function displayResults(result) {
    hideElements([error]);
    showElement(results);
    
    // Display summary
    displaySummary(result.summary);
    
    // Display results table
    displayResultsTable(result.results);
    
    // Handle classification display
    const classificationDiv = document.getElementById('classification');
    if (includeClassification.checked && classificationDiv) {
        classificationDiv.style.display = 'block';
        displayClassification(result);
    }
    
    console.log('Results displayed');
}

// Display summary
function displaySummary(summary) {
    const summaryDiv = document.getElementById('summary');
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

// Display results table
function displayResultsTable(results) {
    const tbody = document.querySelector('#resultsTable tbody');
    tbody.innerHTML = '';
    
    results.forEach((result) => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td><code>${result.node}</code></td>
            <td>${result.probability.toFixed(6)}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// Display classification results (placeholder)
function displayClassification(result) {
    const classificationResults = document.getElementById('classificationResults');
    
    if (result.summary.diamonds > 0) {
        classificationResults.innerHTML = `
            <div class="diamond-group">
                <h5>Diamond Structures Found</h5>
                <p><strong>${result.summary.diamonds}</strong> diamond structures identified in the network.</p>
                <p><em>Detailed classification analysis would be displayed here.</em></p>
            </div>
        `;
    } else {
        classificationResults.innerHTML = `
            <div class="diamond-group">
                <h5>No Diamond Structures</h5>
                <p>No diamond structures were found in this network.</p>
            </div>
        `;
    }
}

// Show error message
function showError(message) {
    hideElements([results, loading]);
    error.textContent = `Error: ${message}`;
    showElement(error);
    console.error('Error:', message);
}

// Utility function to format numbers
function formatNumber(num, decimals = 2) {
    return parseFloat(num).toFixed(decimals);
}

// Tab Management Functions
function switchTab(tabName) {
    // Remove active class from all tabs and content
    tabBtns.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    // Add active class to selected tab and content
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // If switching to visualization tab and we have data, update visualization
    if (tabName === 'visualization' && networkData) {
        setTimeout(() => updateVisualization(), 100); // Small delay to ensure DOM is ready
    }
}

function enableVisualizationTab() {
    const vizTab = document.querySelector('[data-tab="visualization"]');
    vizTab.disabled = false;
    vizTab.style.opacity = '1';
    console.log('Visualization tab enabled');
}

// Visualization Functions
function updateVisualization() {
    if (!networkData) {
        console.log('No network data available for visualization');
        return;
    }
    
    console.log('Updating visualization with options:', {
        showSource: showSourceNodes.checked,
        showSink: showSinkNodes.checked,
        showFork: showForkNodes.checked,
        showJoin: showJoinNodes.checked,
        showIterations: showIterations.checked,
        layout: layoutSelect.value
    });
    
    // Create network visualization (placeholder for now)
    createNetworkVisualization();
}

function createNetworkVisualization() {
    // Clear existing visualization
    networkGraph.innerHTML = '';
    
    if (!networkData || !networkData.nodes) {
        networkGraph.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666;">No network data available</div>';
        return;
    }
    
    // Prepare nodes for vis.js
    const visNodes = networkData.nodes.map(nodeId => {
        const node = {
            id: nodeId,
            label: nodeId.toString(),
            color: getNodeColor(nodeId),
            font: { color: 'white', size: 12 },
            size: 15,
            borderWidth: 2,
            borderColor: '#333'
        };
        
        // Add node type information as title (tooltip)
        node.title = `Node: ${nodeId}<br>Type: ${getNodeType(nodeId)}<br>Probability: ${getNodeProbability(nodeId)}`;
        
        return node;
    });
    
    // Prepare edges for vis.js
    const visEdges = networkData.edges.map((edge, index) => ({
        id: index,
        from: edge[0],
        to: edge[1],
        arrows: 'to',
        color: { color: '#333', highlight: '#667eea' },
        width: 1,
        smooth: { type: 'dynamic' }
    }));
    
    // Create dataset
    const data = {
        nodes: new vis.DataSet(visNodes),
        edges: new vis.DataSet(visEdges)
    };
    
    // Configure visualization options
    const options = {
        layout: getLayoutOptions(),
        physics: {
            enabled: layoutSelect.value === 'force',
            stabilization: { iterations: 100 }
        },
        interaction: {
            hover: true,
            selectConnectedEdges: true
        },
        edges: {
            smooth: true,
            arrows: { to: { enabled: true, scaleFactor: 0.8 } }
        },
        nodes: {
            chosen: {
                node: function(values, id, selected, hovering) {
                    values.shadowColor = '#667eea';
                    values.shadowSize = 10;
                }
            }
        }
    };
    
    // Create network
    const network = new vis.Network(networkGraph, data, options);
    
    // Add event listeners
    network.on('selectNode', function(event) {
        if (event.nodes.length > 0) {
            selectNode(event.nodes[0]);
        }
    });
    
    network.on('deselectNode', function() {
        selectedNode = null;
        updateNodeDetails();
    });
    
    // Store network instance for zoom/fit functions
    window.networkInstance = network;
    
    console.log('Network visualization created with', visNodes.length, 'nodes and', visEdges.length, 'edges');
}

function getNodeColor(nodeId) {
    const colors = {
        source: '#ff6b6b',    // Red for source nodes
        sink: '#4ecdc4',      // Teal for sink nodes  
        fork: '#45b7d1',      // Blue for fork nodes
        join: '#96ceb4',      // Green for join nodes
        regular: '#74b9ff'    // Light blue for regular nodes
    };
    
    // Priority order for coloring
    if (showSourceNodes.checked && networkData.sourceNodes?.includes(nodeId)) {
        return colors.source;
    }
    if (showSinkNodes.checked && networkData.sinkNodes?.includes(nodeId)) {
        return colors.sink;
    }
    if (showForkNodes.checked && networkData.forkNodes?.includes(nodeId)) {
        return colors.fork;
    }
    if (showJoinNodes.checked && networkData.joinNodes?.includes(nodeId)) {
        return colors.join;
    }
    
    // Color by iteration sets if enabled
    if (showIterations.checked && networkData.iterationSets) {
        const iterationColors = ['#e17055', '#fdcb6e', '#6c5ce7', '#a29bfe', '#fd79a8'];
        for (let i = 0; i < networkData.iterationSets.length; i++) {
            if (networkData.iterationSets[i].includes(nodeId)) {
                return iterationColors[i % iterationColors.length];
            }
        }
    }
    
    return colors.regular;
}

function getLayoutOptions() {
    switch (layoutSelect.value) {
        case 'hierarchical':
            return {
                hierarchical: {
                    enabled: true,
                    direction: 'UD',
                    sortMethod: 'directed',
                    levelSeparation: 100,
                    nodeSpacing: 100
                }
            };
        case 'circular':
            return {
                randomSeed: 2
            };
        case 'force':
        default:
            return {
                randomSeed: 2
            };
    }
}

function resetVisualization() {
    console.log('Resetting visualization');
    selectedNode = null;
    updateNodeDetails();
    
    if (window.networkInstance) {
        // Reset selection and highlighting
        window.networkInstance.unselectAll();
        window.networkInstance.setSelection({ nodes: [], edges: [] });
    }
    
    // Recreate visualization to reset colors and states
    updateVisualization();
}

function fitVisualizationToScreen() {
    console.log('Fitting visualization to screen');
    if (window.networkInstance) {
        window.networkInstance.fit({
            animation: {
                duration: 1000,
                easingFunction: 'easeInOutQuad'
            }
        });
    }
}

function selectNode(nodeId) {
    selectedNode = nodeId;
    updateNodeDetails();
    highlightNodeConnections(nodeId);
}

function updateNodeDetails() {
    if (!selectedNode || !networkData) {
        selectedNodeInfo.innerHTML = 'Click a node to see details';
        return;
    }
    
    // Display node details (placeholder)
    selectedNodeInfo.innerHTML = `
        <div><strong>Node:</strong> ${selectedNode}</div>
        <div><strong>Type:</strong> ${getNodeType(selectedNode)}</div>
        <div><strong>Probability:</strong> ${getNodeProbability(selectedNode)}</div>
        <div><strong>Iteration Set:</strong> ${getNodeIteration(selectedNode)}</div>
        <div style="margin-top: 15px;">
            <button onclick="highlightAncestors('${selectedNode}')" style="margin-right: 5px; padding: 5px 10px; font-size: 12px;">Show Ancestors</button>
            <button onclick="highlightDescendants('${selectedNode}')" style="padding: 5px 10px; font-size: 12px;">Show Descendants</button>
        </div>
    `;
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

function getNodeProbability(nodeId) {
    if (!analysisResults?.results) return 'N/A';
    
    const nodeResult = analysisResults.results.find(r => r.node === nodeId);
    return nodeResult ? nodeResult.probability.toFixed(4) : 'N/A';
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
    console.log(`Highlighting connections for node ${nodeId}`);
    
    if (!window.networkInstance) return;
    
    // Get connected nodes
    const connectedNodes = window.networkInstance.getConnectedNodes(nodeId);
    const connectedEdges = window.networkInstance.getConnectedEdges(nodeId);
    
    // Highlight the selected node and its connections
    window.networkInstance.setSelection({
        nodes: [nodeId, ...connectedNodes],
        edges: connectedEdges
    }, { highlightEdges: true });
}

function highlightAncestors(nodeId) {
    console.log(`Highlighting ancestors of node ${nodeId}`);
    
    if (!networkData?.ancestors || !window.networkInstance) return;
    
    const ancestors = networkData.ancestors[nodeId] || [];
    const nodes = window.networkInstance.body.data.nodes;
    
    // Update node colors to highlight ancestors
    nodes.update(networkData.nodes.map(id => ({
        id: id,
        color: ancestors.includes(id) ? '#ffeaa7' : getNodeColor(id)
    })));
    
    // Select the ancestors
    window.networkInstance.setSelection({ 
        nodes: [nodeId, ...ancestors], 
        edges: [] 
    });
}

function highlightDescendants(nodeId) {
    console.log(`Highlighting descendants of node ${nodeId}`);
    
    if (!networkData?.descendants || !window.networkInstance) return;
    
    const descendants = networkData.descendants[nodeId] || [];
    const nodes = window.networkInstance.body.data.nodes;
    
    // Update node colors to highlight descendants
    nodes.update(networkData.nodes.map(id => ({
        id: id,
        color: descendants.includes(id) ? '#fd79a8' : getNodeColor(id)
    })));
    
    // Select the descendants
    window.networkInstance.setSelection({ 
        nodes: [nodeId, ...descendants], 
        edges: [] 
    });
}

// Export functions
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
                showSourceNodes: showSourceNodes.checked,
                showSinkNodes: showSinkNodes.checked,
                showForkNodes: showForkNodes.checked,
                showJoinNodes: showJoinNodes.checked,
                showIterations: showIterations.checked
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Download the DOT file
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