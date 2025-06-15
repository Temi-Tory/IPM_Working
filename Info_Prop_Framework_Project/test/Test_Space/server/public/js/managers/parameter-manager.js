// parameter-manager.js - Individual parameter control management
import { AppState } from '../main.js';
import { UIUtils } from '../utils/ui-utils.js';

export class ParameterManager {
    constructor(domManager) {
        this.dom = domManager;
        this.currentMode = null; // 'nodes', 'edges', 'diamond-nodes', 'diamond-edges'
        this.currentData = [];
        this.modifiedValues = new Map();
        this.originalValues = new Map();
        this.isDiamondMode = false;
        this.selectedRows = new Set();
    }

    initializeEventListeners() {
        console.log('Initializing Parameter Manager event listeners');

        // Main analysis parameter editor buttons
        this.dom.safeAddEventListener('editNodePriorsBtn', 'click', () => {
            this.openParameterEditor('nodes');
        });

        this.dom.safeAddEventListener('editEdgeProbsBtn', 'click', () => {
            this.openParameterEditor('edges');
        });

        // Diamond analysis parameter editor buttons
        this.dom.safeAddEventListener('editDiamondNodePriorsBtn', 'click', () => {
            this.openParameterEditor('diamond-nodes');
        });

        this.dom.safeAddEventListener('editDiamondEdgeProbsBtn', 'click', () => {
            this.openParameterEditor('diamond-edges');
        });

        // Parameter editor modal controls
        this.setupParameterEditorControls();

        console.log('Parameter Manager event listeners initialized');
    }

    setupParameterEditorControls() {
        // Search functionality
        document.addEventListener('input', (event) => {
            if (event.target.id === 'parameterSearch') {
                this.filterParameterTable(event.target.value);
            }
        });

        // Batch operations
        document.addEventListener('click', (event) => {
            switch (event.target.id) {
                case 'batchSetSelected':
                    this.batchSetSelected();
                    break;
                case 'batchSetAll':
                    this.batchSetAll();
                    break;
                case 'batchResetSelected':
                    this.batchResetSelected();
                    break;
                case 'resetAllParameters':
                    this.resetAllParameters();
                    break;
                case 'cancelParameterEdit':
                    this.closeParameterEditor();
                    break;
                case 'saveParameters':
                    this.saveParameterChanges();
                    break;
            }
        });

        // Row selection and input changes
        document.addEventListener('change', (event) => {
            if (event.target.classList.contains('param-row-checkbox')) {
                this.handleRowSelection(event.target);
            } else if (event.target.classList.contains('param-input')) {
                this.handleParameterValueChange(event.target);
            }
        });

        // Reset individual parameter buttons
        document.addEventListener('click', (event) => {
            if (event.target.classList.contains('param-reset-btn')) {
                this.resetIndividualParameter(event.target);
            }
        });
    }

    // Check if parameter editing is available
    updateParameterEditingAvailability() {
        const hasNetworkData = AppState.networkData || AppState.structureData?.networkData;
        const hasDiamondData = AppState.currentDiamondData;

        // Main analysis buttons
        this.dom.setElementDisabled('editNodePriorsBtn', !hasNetworkData);
        this.dom.setElementDisabled('editEdgeProbsBtn', !hasNetworkData);

        // Diamond analysis buttons
        this.dom.setElementDisabled('editDiamondNodePriorsBtn', !hasDiamondData);
        this.dom.setElementDisabled('editDiamondEdgeProbsBtn', !hasDiamondData);

        // Update status displays
        this.updateParameterStatus();
    }

    updateParameterStatus() {
        const statusDiv = document.getElementById('individualParamsStatus');
        const diamondStatusDiv = document.getElementById('diamondIndividualParamsStatus');

        if (statusDiv) {
            const hasModifications = this.hasGlobalModifications();
            statusDiv.style.display = hasModifications ? 'block' : 'none';

            if (hasModifications) {
                const nodeCount = this.getModifiedCount('nodes');
                const edgeCount = this.getModifiedCount('edges');

                document.getElementById('modifiedNodesCount').textContent = nodeCount;
                document.getElementById('modifiedEdgesCount').textContent = edgeCount;
                document.getElementById('usingIndividualValues').textContent = (nodeCount > 0 || edgeCount > 0) ? 'Yes' : 'No';
            }
        }

        if (diamondStatusDiv) {
            const hasDiamondModifications = this.hasDiamondModifications();
            diamondStatusDiv.style.display = hasDiamondModifications ? 'block' : 'none';

            if (hasDiamondModifications) {
                const nodeCount = this.getModifiedCount('diamond-nodes');
                const edgeCount = this.getModifiedCount('diamond-edges');

                document.getElementById('modifiedDiamondNodesCount').textContent = nodeCount;
                document.getElementById('modifiedDiamondEdgesCount').textContent = edgeCount;
            }
        }
    }

    openParameterEditor(mode) {
        console.log('Opening parameter editor for mode:', mode);
        
        this.currentMode = mode;
        this.isDiamondMode = mode.startsWith('diamond-');
        this.selectedRows.clear();

        // Load data based on mode
        this.loadParameterData(mode);

        // Setup modal appearance
        this.setupModalForMode(mode);

        // Show modal
        const modal = document.getElementById('parameterEditorModal');
        if (modal) {
            modal.style.display = 'block';
            
            // Focus search input
            setTimeout(() => {
                const searchInput = document.getElementById('parameterSearch');
                if (searchInput) searchInput.focus();
            }, 100);
        }
    }

    loadParameterData(mode) {
        this.currentData = [];
        
        try {
            if (mode === 'nodes' || mode === 'diamond-nodes') {
                this.currentData = this.loadNodePriorData(mode === 'diamond-nodes');
            } else if (mode === 'edges' || mode === 'diamond-edges') {
                this.currentData = this.loadEdgeProbabilityData(mode === 'diamond-edges');
            }
            
            console.log(`Loaded ${this.currentData.length} items for mode ${mode}`);
        } catch (error) {
            console.error('Error loading parameter data:', error);
            this.currentData = [];
        }
    }

    loadNodePriorData(isDiamond = false) {
        const nodes = [];
        
        if (isDiamond) {
            // Load diamond-specific nodes
            if (!AppState.currentDiamondData) return [];
            
            const structure = AppState.currentDiamondData.structure;
            const diamondNodes = new Set();
            
            // Collect diamond nodes
            if (structure.diamond && Array.isArray(structure.diamond)) {
                structure.diamond.forEach(group => {
                    if (group.relevant_nodes) {
                        group.relevant_nodes.forEach(node => diamondNodes.add(parseInt(node)));
                    }
                    if (group.highest_nodes) {
                        group.highest_nodes.forEach(node => diamondNodes.add(parseInt(node)));
                    }
                });
            }
            
            // Add join node
            diamondNodes.add(parseInt(AppState.currentDiamondData.joinNode));
            
            // Add non-diamond parents
            if (structure.non_diamond_parents) {
                structure.non_diamond_parents.forEach(node => diamondNodes.add(parseInt(node)));
            }
            
            // Create node data
            diamondNodes.forEach(nodeId => {
                const originalValue = this.getOriginalNodePrior(nodeId);
                const modifiedValue = this.getModifiedValue(`diamond-nodes-${nodeId}`);
                
                nodes.push({
                    id: nodeId,
                    originalValue: originalValue,
                    currentValue: modifiedValue !== null ? modifiedValue : originalValue,
                    isModified: modifiedValue !== null,
                    type: this.getNodeType(nodeId)
                });
            });
        } else {
            // Load all network nodes
            const networkData = this.getNetworkData();
            if (!networkData || !networkData.nodes) return [];
            
            networkData.nodes.forEach(nodeId => {
                const originalValue = this.getOriginalNodePrior(nodeId);
                const modifiedValue = this.getModifiedValue(`nodes-${nodeId}`);
                
                nodes.push({
                    id: nodeId,
                    originalValue: originalValue,
                    currentValue: modifiedValue !== null ? modifiedValue : originalValue,
                    isModified: modifiedValue !== null,
                    type: this.getNodeType(nodeId)
                });
            });
        }
        
        return nodes.sort((a, b) => a.id - b.id);
    }

    loadEdgeProbabilityData(isDiamond = false) {
        const edges = [];
        
        if (isDiamond) {
            // Load diamond-specific edges
            if (!AppState.currentDiamondData) return [];
            
            const structure = AppState.currentDiamondData.structure;
            const diamondEdges = [];
            
            // Collect diamond edges
            if (structure.diamond && Array.isArray(structure.diamond)) {
                structure.diamond.forEach(group => {
                    if (group.edgelist && Array.isArray(group.edgelist)) {
                        group.edgelist.forEach(edge => {
                            if (Array.isArray(edge) && edge.length === 2) {
                                diamondEdges.push([parseInt(edge[0]), parseInt(edge[1])]);
                            }
                        });
                    }
                });
            }
            
            // Create edge data
            diamondEdges.forEach(([from, to]) => {
                const edgeKey = `${from}-${to}`;
                const originalValue = this.getOriginalEdgeProbability(from, to);
                const modifiedValue = this.getModifiedValue(`diamond-edges-${edgeKey}`);
                
                edges.push({
                    id: edgeKey,
                    from: from,
                    to: to,
                    originalValue: originalValue,
                    currentValue: modifiedValue !== null ? modifiedValue : originalValue,
                    isModified: modifiedValue !== null
                });
            });
        } else {
            // Load all network edges
            const networkData = this.getNetworkData();
            if (!networkData || !networkData.edges) return [];
            
            networkData.edges.forEach(edge => {
                if (Array.isArray(edge) && edge.length === 2) {
                    const [from, to] = edge;
                    const edgeKey = `${from}-${to}`;
                    const originalValue = this.getOriginalEdgeProbability(from, to);
                    const modifiedValue = this.getModifiedValue(`edges-${edgeKey}`);
                    
                    edges.push({
                        id: edgeKey,
                        from: from,
                        to: to,
                        originalValue: originalValue,
                        currentValue: modifiedValue !== null ? modifiedValue : originalValue,
                        isModified: modifiedValue !== null
                    });
                }
            });
        }
        
        return edges.sort((a, b) => a.id.localeCompare(b.id, undefined, {numeric: true}));
    }

    setupModalForMode(mode) {
        const header = document.getElementById('parameterEditorHeader');
        const title = document.getElementById('parameterEditorTitle');
        const tableContainer = document.getElementById('parameterTableContainer');
        
        if (mode.includes('nodes')) {
            header.className = 'param-editor-header';
            title.textContent = mode.includes('diamond') ? 'Edit Diamond Node Priors' : 'Edit Node Priors';
        } else {
            header.className = 'param-editor-header edges';
            title.textContent = mode.includes('diamond') ? 'Edit Diamond Edge Probabilities' : 'Edit Edge Probabilities';
        }
        
        // Create parameter table
        this.createParameterTable();
        
        // Update search placeholder
        const searchInput = document.getElementById('parameterSearch');
        if (searchInput) {
            searchInput.placeholder = mode.includes('edges') ? 'Search by edge ID (e.g., 1-2)...' : 'Search by node ID...';
            searchInput.value = '';
        }
        
        // Update stats
        this.updateParameterEditorStats();
    }

    createParameterTable() {
        const container = document.getElementById('parameterTableContainer');
        if (!container) return;
        
        if (this.currentData.length === 0) {
            container.innerHTML = `
                <div class="param-no-data">
                    <h4>No Data Available</h4>
                    <p>No ${this.currentMode.includes('nodes') ? 'nodes' : 'edges'} found for editing.</p>
                </div>
            `;
            return;
        }
        
        const isEdgeMode = this.currentMode.includes('edges');
        const isDiamondMode = this.currentMode.includes('diamond');
        
        const tableHtml = `
            <table class="param-table ${isEdgeMode ? 'edges' : ''}">
                <thead>
                    <tr>
                        <th>
                            <input type="checkbox" id="selectAllParams" title="Select all">
                        </th>
                        <th>${isEdgeMode ? 'Edge' : 'Node'} ID</th>
                        ${!isEdgeMode ? '<th>Type</th>' : ''}
                        <th>Original</th>
                        <th>Current</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.currentData.map((item, index) => this.createParameterRow(item, index)).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = tableHtml;
        
        // Setup select all checkbox
        const selectAllCheckbox = document.getElementById('selectAllParams');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                this.selectAllRows(e.target.checked);
            });
        }
    }

    createParameterRow(item, index) {
        const isEdgeMode = this.currentMode.includes('edges');
        const rowId = `param-row-${index}`;
        
        return `
            <tr id="${rowId}" class="${item.isModified ? 'modified-row' : ''}">
                <td>
                    <input type="checkbox" class="param-row-checkbox" data-index="${index}">
                </td>
                <td>
                    <span class="${isEdgeMode ? 'param-edge-id' : 'param-node-id'}">${item.id}</span>
                </td>
                ${!isEdgeMode ? `<td><span class="node-type ${item.type.toLowerCase().replace(/[^a-z]/g, '')}">${item.type}</span></td>` : ''}
                <td>
                    <span class="param-original-value">${item.originalValue.toFixed(3)}</span>
                </td>
                <td>
                    <input type="number" 
                           class="param-input ${isEdgeMode ? 'edges' : ''} ${item.isModified ? 'modified' : ''}" 
                           value="${item.currentValue.toFixed(3)}" 
                           min="0" 
                           max="1" 
                           step="0.001"
                           data-index="${index}"
                           data-original="${item.originalValue}">
                </td>
                <td>
                    <button class="param-reset-btn" data-index="${index}" title="Reset to original value">
                        Reset
                    </button>
                </td>
            </tr>
        `;
    }

    filterParameterTable(searchTerm) {
        const tbody = document.querySelector('.param-table tbody');
        if (!tbody) return;
        
        const rows = tbody.querySelectorAll('tr');
        searchTerm = searchTerm.toLowerCase().trim();
        
        rows.forEach(row => {
            const idElement = row.querySelector('.param-node-id, .param-edge-id');
            if (idElement) {
                const idText = idElement.textContent.toLowerCase();
                const shouldShow = searchTerm === '' || idText.includes(searchTerm);
                row.style.display = shouldShow ? '' : 'none';
            }
        });
        
        this.updateParameterEditorStats();
    }

    handleRowSelection(checkbox) {
        const index = parseInt(checkbox.dataset.index);
        
        if (checkbox.checked) {
            this.selectedRows.add(index);
        } else {
            this.selectedRows.delete(index);
        }
        
        // Update select all checkbox state
        const selectAllCheckbox = document.getElementById('selectAllParams');
        if (selectAllCheckbox) {
            const allCheckboxes = document.querySelectorAll('.param-row-checkbox');
            const visibleCheckboxes = Array.from(allCheckboxes).filter(cb => 
                cb.closest('tr').style.display !== 'none'
            );
            const checkedVisible = visibleCheckboxes.filter(cb => cb.checked);
            
            selectAllCheckbox.indeterminate = checkedVisible.length > 0 && checkedVisible.length < visibleCheckboxes.length;
            selectAllCheckbox.checked = checkedVisible.length === visibleCheckboxes.length && visibleCheckboxes.length > 0;
        }
        
        this.updateParameterEditorStats();
    }

    selectAllRows(checked) {
        const checkboxes = document.querySelectorAll('.param-row-checkbox');
        
        checkboxes.forEach(checkbox => {
            // Only select visible rows
            if (checkbox.closest('tr').style.display !== 'none') {
                checkbox.checked = checked;
                const index = parseInt(checkbox.dataset.index);
                
                if (checked) {
                    this.selectedRows.add(index);
                } else {
                    this.selectedRows.delete(index);
                }
            }
        });
        
        this.updateParameterEditorStats();
    }

    handleParameterValueChange(input) {
        const index = parseInt(input.dataset.index);
        const originalValue = parseFloat(input.dataset.original);
        const newValue = parseFloat(input.value);
        const item = this.currentData[index];
        
        if (isNaN(newValue) || newValue < 0 || newValue > 1) {
            input.value = item.currentValue.toFixed(3);
            return;
        }
        
        // Update data
        item.currentValue = newValue;
        item.isModified = Math.abs(newValue - originalValue) > 0.001;
        
        // Update UI
        input.classList.toggle('modified', item.isModified);
        input.closest('tr').classList.toggle('modified-row', item.isModified);
        
        // Store modification
        const key = this.getModificationKey(item);
        if (item.isModified) {
            this.modifiedValues.set(key, newValue);
        } else {
            this.modifiedValues.delete(key);
        }
        
        this.updateParameterEditorStats();
    }

    resetIndividualParameter(button) {
        const index = parseInt(button.dataset.index);
        const item = this.currentData[index];
        const input = document.querySelector(`.param-input[data-index="${index}"]`);
        
        if (input) {
            input.value = item.originalValue.toFixed(3);
            this.handleParameterValueChange(input);
        }
    }

    batchSetSelected() {
        const batchValue = parseFloat(document.getElementById('batchValue').value);
        if (isNaN(batchValue) || batchValue < 0 || batchValue > 1) {
            alert('Please enter a valid value between 0 and 1');
            return;
        }
        
        this.selectedRows.forEach(index => {
            const input = document.querySelector(`.param-input[data-index="${index}"]`);
            if (input) {
                input.value = batchValue.toFixed(3);
                this.handleParameterValueChange(input);
            }
        });
    }

    batchSetAll() {
        const batchValue = parseFloat(document.getElementById('batchValue').value);
        if (isNaN(batchValue) || batchValue < 0 || batchValue > 1) {
            alert('Please enter a valid value between 0 and 1');
            return;
        }
        
        const inputs = document.querySelectorAll('.param-input');
        inputs.forEach(input => {
            // Only set visible inputs
            if (input.closest('tr').style.display !== 'none') {
                input.value = batchValue.toFixed(3);
                this.handleParameterValueChange(input);
            }
        });
    }

    batchResetSelected() {
        this.selectedRows.forEach(index => {
            const button = document.querySelector(`.param-reset-btn[data-index="${index}"]`);
            if (button) {
                this.resetIndividualParameter(button);
            }
        });
    }

    resetAllParameters() {
        if (confirm('Are you sure you want to reset all parameters to their original values?')) {
            const buttons = document.querySelectorAll('.param-reset-btn');
            buttons.forEach(button => {
                this.resetIndividualParameter(button);
            });
        }
    }

    saveParameterChanges() {
        console.log('Saving parameter changes for mode:', this.currentMode);
        
        // Update global state with modifications
        const prefix = this.isDiamondMode ? 
            (this.currentMode.includes('nodes') ? 'diamond-nodes' : 'diamond-edges') :
            (this.currentMode.includes('nodes') ? 'nodes' : 'edges');
            
        this.currentData.forEach(item => {
            const key = this.getModificationKey(item);
            if (item.isModified) {
                this.modifiedValues.set(key, item.currentValue);
            } else {
                this.modifiedValues.delete(key);
            }
        });
        
        // Store in global state
        if (!AppState.individualParameterOverrides) {
            AppState.individualParameterOverrides = new Map();
        }
        
        // Merge modifications
        this.modifiedValues.forEach((value, key) => {
            AppState.individualParameterOverrides.set(key, value);
        });
        
        // Update parameter status displays
        this.updateParameterStatus();
        
        // Close modal
        this.closeParameterEditor();
        
        console.log(`Saved ${this.modifiedValues.size} parameter modifications`);
    }

    closeParameterEditor() {
        const modal = document.getElementById('parameterEditorModal');
        if (modal) {
            modal.style.display = 'none';
            
            // Force hide with important style to override any conflicting CSS
            modal.style.setProperty('display', 'none', 'important');
        }
        
        // Reset state
        this.currentMode = null;
        this.currentData = [];
        this.selectedRows.clear();
        this.isDiamondMode = false;
        
        console.log('Parameter editor modal closed and state reset');
    }

    updateParameterEditorStats() {
        const statsElement = document.getElementById('parameterStats');
        if (!statsElement) return;
        
        const totalItems = this.currentData.length;
        const modifiedItems = this.currentData.filter(item => item.isModified).length;
        const selectedItems = this.selectedRows.size;
        
        // Count visible items
        const visibleRows = document.querySelectorAll('.param-table tbody tr[style=""], .param-table tbody tr:not([style])');
        const visibleCount = visibleRows.length;
        
        let statsText = `${visibleCount} visible`;
        if (visibleCount !== totalItems) {
            statsText += ` of ${totalItems}`;
        }
        statsText += ` • ${modifiedItems} modified`;
        if (selectedItems > 0) {
            statsText += ` • ${selectedItems} selected`;
        }
        
        statsElement.textContent = statsText;
    }

    // Utility methods
    getModificationKey(item) {
        const prefix = this.isDiamondMode ? 
            (this.currentMode.includes('nodes') ? 'diamond-nodes' : 'diamond-edges') :
            (this.currentMode.includes('nodes') ? 'nodes' : 'edges');
        return `${prefix}-${item.id}`;
    }

    getModifiedValue(key) {
        if (AppState.individualParameterOverrides && AppState.individualParameterOverrides.has(key)) {
            return AppState.individualParameterOverrides.get(key);
        }
        if (this.modifiedValues.has(key)) {
            return this.modifiedValues.get(key);
        }
        return null;
    }

    getModifiedCount(type) {
        if (!AppState.individualParameterOverrides) return 0;
        
        let count = 0;
        AppState.individualParameterOverrides.forEach((value, key) => {
            if (key.startsWith(type + '-')) {
                count++;
            }
        });
        return count;
    }

    hasGlobalModifications() {
        return this.getModifiedCount('nodes') > 0 || this.getModifiedCount('edges') > 0;
    }

    hasDiamondModifications() {
        return this.getModifiedCount('diamond-nodes') > 0 || this.getModifiedCount('diamond-edges') > 0;
    }

    getNetworkData() {
        return AppState.networkData || AppState.structureData?.networkData;
    }

    getOriginalNodePrior(nodeId) {
        if (AppState.originalNodePriors && AppState.originalNodePriors[nodeId] !== undefined) {
            return AppState.originalNodePriors[nodeId];
        }
        return 1.0; // Default value
    }

    getOriginalEdgeProbability(from, to) {
        const edgeKey = `(${from}, ${to})`;
        if (AppState.originalEdgeProbabilities && AppState.originalEdgeProbabilities[edgeKey] !== undefined) {
            return AppState.originalEdgeProbabilities[edgeKey];
        }
        return 0.9; // Default value
    }

    getNodeType(nodeId) {
        const networkData = this.getNetworkData();
        if (!networkData) return 'Unknown';
        
        const types = [];
        if (networkData.sourceNodes?.includes(nodeId)) types.push('Source');
        if (networkData.sinkNodes?.includes(nodeId)) types.push('Sink');
        if (networkData.forkNodes?.includes(nodeId)) types.push('Fork');
        if (networkData.joinNodes?.includes(nodeId)) types.push('Join');
        
        return types.length > 0 ? types.join(', ') : 'Regular';
    }

    // Public methods for integration with analysis workflow
    getIndividualNodePriorOverrides() {
        const overrides = {};
        if (!AppState.individualParameterOverrides) return overrides;
        
        AppState.individualParameterOverrides.forEach((value, key) => {
            if (key.startsWith('nodes-')) {
                const nodeId = parseInt(key.substring(6));
                overrides[nodeId] = value;
            }
        });
        
        return overrides;
    }

    getIndividualEdgeProbabilityOverrides() {
        const overrides = {};
        if (!AppState.individualParameterOverrides) return overrides;
        
        AppState.individualParameterOverrides.forEach((value, key) => {
            if (key.startsWith('edges-')) {
                const edgeKey = key.substring(6);
                const [from, to] = edgeKey.split('-').map(x => parseInt(x));
                overrides[`(${from}, ${to})`] = value;
            }
        });
        
        return overrides;
    }

    getDiamondIndividualNodePriorOverrides() {
        const overrides = {};
        if (!AppState.individualParameterOverrides) return overrides;
        
        AppState.individualParameterOverrides.forEach((value, key) => {
            if (key.startsWith('diamond-nodes-')) {
                const nodeId = parseInt(key.substring(14));
                overrides[nodeId] = value;
            }
        });
        
        return overrides;
    }

    getDiamondIndividualEdgeProbabilityOverrides() {
        const overrides = {};
        if (!AppState.individualParameterOverrides) return overrides;
        
        AppState.individualParameterOverrides.forEach((value, key) => {
            if (key.startsWith('diamond-edges-')) {
                const edgeKey = key.substring(14);
                const [from, to] = edgeKey.split('-').map(x => parseInt(x));
                overrides[`(${from}, ${to})`] = value;
            }
        });
        
        return overrides;
    }

    clearIndividualOverrides(type = 'all') {
        if (!AppState.individualParameterOverrides) return;
        
        if (type === 'all') {
            AppState.individualParameterOverrides.clear();
        } else {
            const keysToDelete = [];
            AppState.individualParameterOverrides.forEach((value, key) => {
                if (key.startsWith(type + '-')) {
                    keysToDelete.push(key);
                }
            });
            keysToDelete.forEach(key => AppState.individualParameterOverrides.delete(key));
        }
        
        this.updateParameterStatus();
    }

    hasIndividualOverrides() {
        return AppState.individualParameterOverrides && AppState.individualParameterOverrides.size > 0;
    }
}

// Global functions for HTML onclick handlers
window.openParameterEditor = function(mode) {
    if (window.AppManagers?.parameter) {
        window.AppManagers.parameter.openParameterEditor(mode);
    }
};

window.closeParameterEditor = function() {
    if (window.AppManagers?.parameter) {
        window.AppManagers.parameter.closeParameterEditor();
    }
};