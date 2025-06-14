// Global variables
let currentFile = null;
let analysisResults = null;

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
        displayResults(result);
        
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