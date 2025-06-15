// ui-utils.js - UI utility functions and helpers
export class UIUtils {
    // Icon utility functions
    static createIcon(type, size = 16) {
        return `<span class="icon icon-${type}" style="width: ${size}px; height: ${size}px; font-size: ${Math.round(size * 0.75)}px; line-height: ${size}px;"></span>`;
    }

    static getBooleanIcon(value) {
        return UIUtils.createIcon(value ? 'check' : 'cross');
    }

    // Format file size
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Enhanced checkbox state management
    static updateCheckboxState(checkbox) {
        if (!checkbox) return;
        
        const label = checkbox.closest('label');
        if (!label) return;
        
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

    static updateAllCheckboxStates() {
        document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            UIUtils.updateCheckboxState(checkbox);
        });
        
        // Initialize disabled states safely
        const overrideNodePrior = document.getElementById('overrideNodePrior');
        const nodeValueSpan = document.getElementById('nodeValue');
        const overrideEdgeProb = document.getElementById('overrideEdgeProb');
        const edgeValueSpan = document.getElementById('edgeValue');
        
        if (overrideNodePrior && !overrideNodePrior.checked && nodeValueSpan) {
            nodeValueSpan.classList.add('span-disabled');
        }
        if (overrideEdgeProb && !overrideEdgeProb.checked && edgeValueSpan) {
            edgeValueSpan.classList.add('span-disabled');
        }
    }

    // File reading utility
    static readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = e => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    // Display utilities
    static displaySummary(summary, summaryElementId = 'summary') {
        const summaryDiv = document.getElementById(summaryElementId);
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

    // Modal utilities
    static initializeModalCloseHandlers() {
        const closeButtons = document.querySelectorAll('.close');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const modal = this.closest('.modal');
                if (modal) {
                    modal.style.display = 'none';
                    if (modal.id === 'diamondPathModal') {
                        UIUtils.closeDiamondPathModal();
                    }
                }
            });
        });
    }

    static closeDiamondPathModal() {
        const diamondPathModal = document.getElementById('diamondPathModal');
        const pathNetworkGraph = document.getElementById('pathNetworkGraph');
        const pathResults = document.getElementById('pathResults');
        
        if (diamondPathModal) diamondPathModal.style.display = 'none';
        
        // Clear global state
        if (window.AppState) {
            window.AppState.currentDiamondData = null;
            window.AppState.pathNetworkInstance = null;
        }
        
        if (pathNetworkGraph) pathNetworkGraph.innerHTML = '';
        if (pathResults) pathResults.style.display = 'none';
    }

    // Parameter control utilities
    static setupParameterControls(domManager) {
        // Node prior slider handler
        domManager.safeAddEventListener('nodePriorSlider', 'input', function() {
            const nodeValueSpan = domManager.elements.nodeValueSpan;
            if (nodeValueSpan) nodeValueSpan.textContent = this.value;
        });
        
        // Edge probability slider handler
        domManager.safeAddEventListener('edgeProbSlider', 'input', function() {
            const edgeValueSpan = domManager.elements.edgeValueSpan;
            if (edgeValueSpan) edgeValueSpan.textContent = this.value;
        });
        
        // Override checkbox handlers
        domManager.safeAddEventListener('overrideNodePrior', 'change', function() {
            const nodePriorSlider = domManager.elements.nodePriorSlider;
            const nodeValueSpan = domManager.elements.nodeValueSpan;
            const paramGroup = this.closest('.parameter-group');
            
            if (nodePriorSlider) nodePriorSlider.disabled = !this.checked;
            
            if (this.checked) {
                if (nodeValueSpan) nodeValueSpan.classList.remove('span-disabled');
                if (paramGroup) paramGroup.classList.add('override-active');
            } else {
                if (nodeValueSpan) nodeValueSpan.classList.add('span-disabled');
                if (paramGroup) paramGroup.classList.remove('override-active');
            }
            
            UIUtils.updateCheckboxState(this);
        });
        
        domManager.safeAddEventListener('overrideEdgeProb', 'change', function() {
            const edgeProbSlider = domManager.elements.edgeProbSlider;
            const edgeValueSpan = domManager.elements.edgeValueSpan;
            const paramGroup = this.closest('.parameter-group');
            
            if (edgeProbSlider) edgeProbSlider.disabled = !this.checked;
            
            if (this.checked) {
                if (edgeValueSpan) edgeValueSpan.classList.remove('span-disabled');
                if (paramGroup) paramGroup.classList.add('override-active');
            } else {
                if (edgeValueSpan) edgeValueSpan.classList.add('span-disabled');
                if (paramGroup) paramGroup.classList.remove('override-active');
            }
            
            UIUtils.updateCheckboxState(this);
        });
    }

    // Path analysis parameter controls
    static setupPathParameterControls(domManager) {
        domManager.safeAddEventListener('pathOverrideNodes', 'change', function() {
            const pathNodePrior = domManager.elements.pathNodePrior;
            if (pathNodePrior) pathNodePrior.disabled = !this.checked;
            UIUtils.updateCheckboxState(this);
        });
        
        domManager.safeAddEventListener('pathOverrideEdges', 'change', function() {
            const pathEdgeProb = domManager.elements.pathEdgeProb;
            if (pathEdgeProb) pathEdgeProb.disabled = !this.checked;
            UIUtils.updateCheckboxState(this);
        });
        
        domManager.safeAddEventListener('pathNodePrior', 'input', function() {
            const pathNodeValue = domManager.elements.pathNodeValue;
            if (pathNodeValue) pathNodeValue.textContent = this.value;
        });
        
        domManager.safeAddEventListener('pathEdgeProb', 'input', function() {
            const pathEdgeValue = domManager.elements.pathEdgeValue;
            if (pathEdgeValue) pathEdgeValue.textContent = this.value;
        });
    }

    // Results table styling
    static addRowRankStyling(row, index) {
        if (index < 3) {
            row.classList.add(`rank-${index + 1}`);
        }
    }

    // Download utility
    static downloadFile(content, filename, contentType = 'text/plain') {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
}