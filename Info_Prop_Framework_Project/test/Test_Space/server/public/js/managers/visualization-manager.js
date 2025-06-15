// visualization-manager.js - Network visualization management
import { AppState } from '../main.js';
import { UIUtils } from '../utils/ui-utils.js';

export class VisualizationManager {
    constructor(domManager) {
        this.dom = domManager;
        this.networkInstance = null;
        this.currentData = null;
    }

    initializeEventListeners() {
        // Visualization control handlers
        const vizControls = [
            'showSourceNodes', 'showSinkNodes', 'showForkNodes', 
            'showJoinNodes', 'showIterations', 'showDiamonds'
        ];
        
        vizControls.forEach(controlKey => {
            this.dom.safeAddEventListener(controlKey, 'change', function() {
                UIUtils.updateCheckboxState(this);
                if (window.AppManagers && window.AppManagers.visualization) {
                    window.AppManagers.visualization.updateVisualization();
                }
            });
        });
        
        this.dom.safeAddEventListener('layoutSelect', 'change', () => {
            this.updateVisualization();
        });
        
        this.dom.safeAddEventListener('focusDiamondSelect', 'change', () => {
            this.focusOnDiamond();
        });
        
        this.dom.safeAddEventListener('resetZoom', 'click', () => {
            this.resetVisualization();
        });
        
        this.dom.safeAddEventListener('fitToScreen', 'click', () => {
            this.fitVisualizationToScreen();
        });
    }

    updateVisualization() {
        if (!AppState.networkData || !AppState.networkData.nodes) {
            this.showEmptyState();
            return;
        }
        
        console.log('Updating visualization with data:', AppState.networkData);
        this.createNetworkVisualization();
    }

    showEmptyState() {
        const networkGraph = this.dom.elements.networkGraph;
        if (!networkGraph) return;
        
        networkGraph.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666; font-size: 16px; text-align: center;">
                <div>
                    ${UIUtils.createIcon('network', 32)}<br>
                    No network data available<br>
                    <small>Run analysis first</small>
                </div>
            </div>
        `;
    }

    createNetworkVisualization() {
        const networkGraph = this.dom.elements.networkGraph;
        if (!networkGraph) {
            console.error('Network graph element not found');
            return;
        }
        
        // Clear previous content
        networkGraph.innerHTML = '';
        
        if (!AppState.networkData || !AppState.networkData.nodes || !Array.isArray(AppState.networkData.nodes)) {
            console.error('Invalid network data:', AppState.networkData);
            this.showEmptyState();
            return;
        }

        console.log('Creating network visualization with', AppState.networkData.nodes.length, 'nodes');
        
        try {
            // Create vis.js nodes
            const visNodes = AppState.networkData.nodes.map(nodeId => {
                const node = {
                    id: nodeId,
                    label: nodeId.toString(),
                    color: this.getNodeColor(nodeId),
                    font: { color: 'white', size: 12, face: 'Arial' },
                    size: this.getNodeSize(nodeId),
                    borderWidth: 2,
                    borderColor: '#333',
                    shadow: { enabled: true, color: 'rgba(0,0,0,0.1)', size: 5 }
                };
                
                // Add tooltip
                node.title = this.createNodeTooltip(nodeId);
                
                return node;
            });
            
            // Create vis.js edges
            const visEdges = (AppState.networkData.edges || []).map((edge, index) => {
                if (!Array.isArray(edge) || edge.length !== 2) {
                    console.warn('Invalid edge format:', edge);
                    return null;
                }
                
                return {
                    id: index,
                    from: edge[0],
                    to: edge[1],
                    arrows: 'to',
                    color: { color: '#666', highlight: '#667eea' },
                    width: 2,
                    smooth: { type: 'dynamic' },
                    shadow: { enabled: true, color: 'rgba(0,0,0,0.1)', size: 2 }
                };
            }).filter(edge => edge !== null);
            
            console.log('Created', visNodes.length, 'nodes and', visEdges.length, 'edges');
            
            // Create dataset
            const data = {
                nodes: new vis.DataSet(visNodes),
                edges: new vis.DataSet(visEdges)
            };
            
            // Configure options
            const options = {
                layout: this.getLayoutOptions(),
                physics: {
                    enabled: this.dom.getElementValue('layoutSelect') === 'force',
                    stabilization: { iterations: 100 },
                    barnesHut: { 
                        gravitationalConstant: -2000, 
                        springConstant: 0.001,
                        springLength: 200
                    }
                },
                interaction: {
                    hover: true,
                    selectConnectedEdges: true,
                    tooltipDelay: 200,
                    multiselect: true
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
            
            // Create network
            this.networkInstance = new vis.Network(networkGraph, data, options);
            this.currentData = data;
            
            // Set up event handlers
            this.setupNetworkEventHandlers();
            
            // Make globally available for other functions
            window.networkInstance = this.networkInstance;
            
            console.log('Network visualization created successfully');
            
        } catch (error) {
            console.error('Error creating network visualization:', error);
            networkGraph.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #dc3545; font-size: 16px; text-align: center;">
                    <div>
                        Error creating visualization<br>
                        <small>${error.message}</small>
                    </div>
                </div>
            `;
        }
    }

    setupNetworkEventHandlers() {
        if (!this.networkInstance) return;
        
        this.networkInstance.on('selectNode', (event) => {
            if (event.nodes.length > 0) {
                this.selectNode(event.nodes[0]);
            }
        });
        
        this.networkInstance.on('deselectNode', () => {
            AppState.selectedNode = null;
            this.updateNodeDetails();
        });
        
        this.networkInstance.on('doubleClick', (event) => {
            if (event.nodes.length > 0) {
                this.focusOnNode(event.nodes[0]);
            }
        });
        
        // Handle stabilization
        this.networkInstance.on('stabilizationIterationsDone', () => {
            console.log('Network stabilization complete');
        });
    }

    createNodeTooltip(nodeId) {
        const analysisManager = window.AppManagers?.analysis;
        if (!analysisManager) {
            return `<strong>Node: ${nodeId}</strong>`;
        }
        
        const prior = analysisManager.getNodePrior(nodeId);
        const calculated = analysisManager.getNodeProbability(nodeId);
        const nodeType = analysisManager.getNodeType(nodeId);
        const iteration = analysisManager.getNodeIteration(nodeId);
        const isDiamondMember = analysisManager.isNodeInDiamond(nodeId);
        
        return `<strong>Node: ${nodeId}</strong><br/>` +
               `Type: ${nodeType}<br/>` +
               `Prior: ${prior}<br/>` +
               `Calculated: ${calculated}<br/>` +
               `Iteration: ${iteration}<br/>` +
               `Diamond Member: ${isDiamondMember ? 'Yes' : 'No'}`;
    }

    getNodeColor(nodeId) {
        const colors = {
            source: '#ff6b6b',
            sink: '#4ecdc4',
            fork: '#45b7d1',
            join: '#96ceb4',
            diamond: '#fd79a8',
            regular: '#74b9ff'
        };
        
        try {
            const analysisManager = window.AppManagers?.analysis;
            
            // Diamond highlighting (highest priority)
            if (this.dom.isElementChecked('showDiamonds') && analysisManager?.isNodeInDiamond(nodeId)) {
                return colors.diamond;
            }
            
            // Specific node type highlighting
            if (this.dom.isElementChecked('showSourceNodes') && AppState.networkData.sourceNodes?.includes(nodeId)) {
                return colors.source;
            }
            if (this.dom.isElementChecked('showSinkNodes') && AppState.networkData.sinkNodes?.includes(nodeId)) {
                return colors.sink;
            }
            if (this.dom.isElementChecked('showForkNodes') && AppState.networkData.forkNodes?.includes(nodeId)) {
                return colors.fork;
            }
            if (this.dom.isElementChecked('showJoinNodes') && AppState.networkData.joinNodes?.includes(nodeId)) {
                return colors.join;
            }
            
            // Iteration-based coloring
            if (this.dom.isElementChecked('showIterations') && AppState.networkData.iterationSets) {
                const iterationColors = ['#e17055', '#fdcb6e', '#6c5ce7', '#a29bfe', '#fd79a8'];
                for (let i = 0; i < AppState.networkData.iterationSets.length; i++) {
                    if (AppState.networkData.iterationSets[i].includes(nodeId)) {
                        return iterationColors[i % iterationColors.length];
                    }
                }
            }
            
            return colors.regular;
        } catch (error) {
            console.warn('Error getting node color for node', nodeId, ':', error);
            return colors.regular;
        }
    }

    getNodeSize(nodeId) {
        try {
            const analysisManager = window.AppManagers?.analysis;
            if (!analysisManager) return 15;
            
            const probability = analysisManager.getNodeProbabilityValue(nodeId);
            if (probability !== null && !isNaN(probability)) {
                return Math.max(10, 15 + (probability * 20));
            }
            return 15;
        } catch (error) {
            console.warn('Error getting node size for node', nodeId, ':', error);
            return 15;
        }
    }

    getLayoutOptions() {
        const layoutValue = this.dom.getElementValue('layoutSelect') || 'hierarchical';
        
        switch (layoutValue) {
            case 'hierarchical':
                return {
                    hierarchical: {
                        enabled: true,
                        direction: 'UD',
                        sortMethod: 'directed',
                        levelSeparation: 120,
                        nodeSpacing: 120,
                        treeSpacing: 200,
                        blockShifting: true,
                        edgeMinimization: true,
                        parentCentralization: true
                    }
                };
            case 'circular':
                return { 
                    randomSeed: 2,
                    improvedLayout: true
                };
            case 'force':
            default:
                return { 
                    randomSeed: 2,
                    improvedLayout: true
                };
        }
    }

    selectNode(nodeId) {
        console.log('Selecting node:', nodeId);
        AppState.selectedNode = nodeId;
        this.updateNodeDetails();
        this.highlightNodeConnections(nodeId);
    }

    updateNodeDetails() {
        const selectedNodeInfo = this.dom.elements.selectedNodeInfo;
        if (!selectedNodeInfo) return;
        
        if (!AppState.selectedNode || !AppState.networkData) {
            selectedNodeInfo.innerHTML = `
                <div style="text-align: center; color: #666; padding: 20px;">
                    ${UIUtils.createIcon('network', 24)}<br>
                    Click a node to see details
                </div>
            `;
            return;
        }
        
        try {
            const analysisManager = window.AppManagers?.analysis;
            const diamondManager = window.AppManagers?.diamond;
            
            if (!analysisManager) {
                selectedNodeInfo.innerHTML = `
                    <div class="node-detail-item">
                        <strong>Node:</strong> ${AppState.selectedNode}
                    </div>
                    <div style="color: #666; font-style: italic;">
                        Run analysis to see detailed information
                    </div>
                `;
                return;
            }
            
            const prior = analysisManager.getNodePrior(AppState.selectedNode);
            const calculated = analysisManager.getNodeProbability(AppState.selectedNode);
            const nodeType = analysisManager.getNodeType(AppState.selectedNode);
            const iteration = analysisManager.getNodeIteration(AppState.selectedNode);
            const isDiamondMember = analysisManager.isNodeInDiamond(AppState.selectedNode);
            const diamondJoinNodes = diamondManager?.getNodeDiamondJoinNodes(AppState.selectedNode) || [];
            
            selectedNodeInfo.innerHTML = `
                <div class="node-detail-item">
                    <strong>Node:</strong> ${AppState.selectedNode}
                </div>
                <div class="node-detail-item">
                    <strong>Type:</strong> ${nodeType}
                </div>
                <div class="node-detail-item">
                    <strong>Iteration Set:</strong> ${iteration}
                </div>
                <div class="node-detail-item">
                    <strong>Diamond Member:</strong> ${UIUtils.getBooleanIcon(isDiamondMember)} ${isDiamondMember ? 'Yes' : 'No'}
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
                
                ${isDiamondMember && diamondJoinNodes.length > 0 ? `
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
                    <button onclick="highlightAncestors('${AppState.selectedNode}')" style="flex: 1; min-width: 120px; padding: 6px 10px; font-size: 12px; background: #ffeaa7; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">Ancestors</button>
                    <button onclick="highlightDescendants('${AppState.selectedNode}')" style="flex: 1; min-width: 120px; padding: 6px 10px; font-size: 12px; background: #fd79a8; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; color: white;">Descendants</button>
                </div>
            `;
        } catch (error) {
            console.error('Error updating node details:', error);
            selectedNodeInfo.innerHTML = `
                <div class="node-detail-item">
                    <strong>Node:</strong> ${AppState.selectedNode}
                </div>
                <div style="color: #dc3545;">
                    Error loading node details
                </div>
            `;
        }
    }

    focusOnNode(nodeId) {
        console.log('Focusing on node:', nodeId);
        
        // Switch to visualization tab if not already there
        if (window.AppManagers?.tab) {
            window.AppManagers.tab.switchTab('visualization');
        }
        
        setTimeout(() => {
            if (this.networkInstance) {
                try {
                    this.networkInstance.selectNodes([nodeId]);
                    this.networkInstance.focus(nodeId, {
                        scale: 1.5,
                        animation: { 
                            duration: 1000, 
                            easingFunction: 'easeInOutQuad' 
                        }
                    });
                    this.selectNode(nodeId);
                } catch (error) {
                    console.error('Error focusing on node:', error);
                }
            }
        }, 200);
    }

    focusOnDiamond() {
        const joinNode = this.dom.getElementValue('focusDiamondSelect');
        if (joinNode === 'none' || !this.networkInstance) return;
        
        try {
            // Get all nodes in the diamond
            const diamondNodes = [];
            if (AppState.diamondData?.diamondStructures?.[joinNode]) {
                const structure = AppState.diamondData.diamondStructures[joinNode];
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
                this.networkInstance.selectNodes(diamondNodes);
                this.networkInstance.fit({
                    nodes: diamondNodes,
                    animation: { 
                        duration: 1000, 
                        easingFunction: 'easeInOutQuad' 
                    }
                });
            }
        } catch (error) {
            console.error('Error focusing on diamond:', error);
        }
    }

    highlightNodeConnections(nodeId) {
        if (!this.networkInstance) return;
        
        try {
            const connectedNodes = this.networkInstance.getConnectedNodes(nodeId);
            const connectedEdges = this.networkInstance.getConnectedEdges(nodeId);
            
            this.networkInstance.setSelection({
                nodes: [nodeId, ...connectedNodes],
                edges: connectedEdges
            }, { highlightEdges: true });
        } catch (error) {
            console.error('Error highlighting node connections:', error);
        }
    }

    highlightAncestors(nodeId) {
        if (!AppState.networkData?.ancestors || !this.networkInstance || !this.currentData) return;
        
        try {
            const ancestors = AppState.networkData.ancestors[nodeId] || [];
            const nodes = this.currentData.nodes;
            
            // Update node colors
            const updates = AppState.networkData.nodes.map(id => ({
                id: id,
                color: ancestors.includes(id) ? '#ffeaa7' : this.getNodeColor(id),
                borderWidth: ancestors.includes(id) ? 4 : 2
            }));
            
            nodes.update(updates);
            
            this.networkInstance.setSelection({ 
                nodes: [nodeId, ...ancestors], 
                edges: [] 
            });
        } catch (error) {
            console.error('Error highlighting ancestors:', error);
        }
    }

    highlightDescendants(nodeId) {
        if (!AppState.networkData?.descendants || !this.networkInstance || !this.currentData) return;
        
        try {
            const descendants = AppState.networkData.descendants[nodeId] || [];
            const nodes = this.currentData.nodes;
            
            // Update node colors
            const updates = AppState.networkData.nodes.map(id => ({
                id: id,
                color: descendants.includes(id) ? '#fd79a8' : this.getNodeColor(id),
                borderWidth: descendants.includes(id) ? 4 : 2
            }));
            
            nodes.update(updates);
            
            this.networkInstance.setSelection({ 
                nodes: [nodeId, ...descendants], 
                edges: [] 
            });
        } catch (error) {
            console.error('Error highlighting descendants:', error);
        }
    }

    resetVisualization() {
        console.log('Resetting visualization');
        
        AppState.selectedNode = null;
        this.updateNodeDetails();
        
        if (this.networkInstance) {
            try {
                this.networkInstance.unselectAll();
                this.networkInstance.setSelection({ nodes: [], edges: [] });
                
                // Reset node colors and borders
                if (this.currentData?.nodes) {
                    const updates = AppState.networkData.nodes.map(id => ({
                        id: id,
                        color: this.getNodeColor(id),
                        borderWidth: 2
                    }));
                    this.currentData.nodes.update(updates);
                }
            } catch (error) {
                console.error('Error resetting visualization:', error);
            }
        }
        
        // Recreate visualization to ensure clean state
        this.updateVisualization();
    }

    fitVisualizationToScreen() {
        if (this.networkInstance) {
            try {
                this.networkInstance.fit({
                    animation: {
                        duration: 1000,
                        easingFunction: 'easeInOutQuad'
                    }
                });
            } catch (error) {
                console.error('Error fitting visualization to screen:', error);
            }
        }
    }

    // Utility method to check if visualization is ready
    isVisualizationReady() {
        return this.networkInstance !== null && AppState.networkData !== null;
    }

    // Method to destroy current network instance
    destroyVisualization() {
        if (this.networkInstance) {
            try {
                this.networkInstance.destroy();
                this.networkInstance = null;
                this.currentData = null;
                window.networkInstance = null;
                console.log('Visualization destroyed');
            } catch (error) {
                console.error('Error destroying visualization:', error);
            }
        }
    }
}