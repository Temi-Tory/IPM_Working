// visualization-manager.js - Enhanced network visualization with three-tier analysis support
import { AppState } from '../main.js';
import { UIUtils } from '../utils/ui-utils.js';

export class VisualizationManager {
    constructor(domManager) {
        this.dom = domManager;
        this.networkInstance = null;
        this.currentData = null;
        this.currentAnalysisMode = null; // 'structure', 'diamond', 'full'
        this.visualizationMode = 'structure'; // Default to structure-only
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
        // Determine what data we have available and set visualization mode
        this.detectAnalysisMode();
        
        if (!this.hasVisualizableData()) {
            this.showEmptyState();
            return;
        }
        
        console.log(`Updating visualization in ${this.currentAnalysisMode} mode`);
        this.createNetworkVisualization();
        this.updateNodeDetails();
        this.displayVisualizationStatistics();
        
        // Also update the main statistics displays if we're in structure or diamond mode
        if (this.currentAnalysisMode === 'structure' || this.currentAnalysisMode === 'diamond') {
            this.updateMainStatisticsDisplay();
        }
    }

    detectAnalysisMode() {
        // Determine current analysis mode based on available data
        if (AppState.analysisResults && AppState.analysisResults.results) {
            this.currentAnalysisMode = 'full';
            this.visualizationMode = 'full';
        } else if (AppState.diamondData && AppState.diamondData.diamondClassifications) {
            this.currentAnalysisMode = 'diamond';
            this.visualizationMode = 'diamond';
        } else if (AppState.networkData || AppState.structureData) {
            this.currentAnalysisMode = 'structure';
            this.visualizationMode = 'structure';
        } else {
            this.currentAnalysisMode = null;
            this.visualizationMode = null;
        }
        
        console.log(`Detected analysis mode: ${this.currentAnalysisMode}`);
    }

    hasVisualizableData() {
        const networkData = this.getNetworkData();
        return networkData && networkData.nodes && Array.isArray(networkData.nodes) && networkData.nodes.length > 0;
    }

    getNetworkData() {
        // Get network data from the appropriate source based on analysis mode
        if (AppState.networkData) {
            return AppState.networkData;
        } else if (AppState.structureData && AppState.structureData.networkData) {
            return AppState.structureData.networkData;
        }
        return null;
    }

    showEmptyState() {
        const networkGraph = this.dom.elements.networkGraph;
        if (!networkGraph) return;
        
        const emptyStateContent = this.getEmptyStateContent();
        networkGraph.innerHTML = emptyStateContent;
    }

    getEmptyStateContent() {
        const tabManager = window.AppManagers?.tab;
        const currentMode = tabManager?.getCurrentAnalysisMode();
        
        switch (currentMode) {
            case null:
                return `
                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666; font-size: 16px; text-align: center;">
                        <div>
                            ${UIUtils.createIcon('network', 32)}<br>
                            No network data available<br>
                            <small>Upload a CSV file and run analysis</small>
                        </div>
                    </div>
                `;
            case 'structure':
                return `
                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666; font-size: 16px; text-align: center;">
                        <div>
                            ${UIUtils.createIcon('network', 32)}<br>
                            Structure analysis available<br>
                            <small>Switch to visualization tab to view network</small>
                        </div>
                    </div>
                `;
            default:
                return `
                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666; font-size: 16px; text-align: center;">
                        <div>
                            ${UIUtils.createIcon('network', 32)}<br>
                            Network visualization loading...<br>
                            <small>Please wait</small>
                        </div>
                    </div>
                `;
        }
    }

    createNetworkVisualization() {
        const networkGraph = this.dom.elements.networkGraph;
        if (!networkGraph) {
            console.error('Network graph element not found');
            return;
        }
        
        const networkData = this.getNetworkData();
        if (!networkData || !networkData.nodes || !Array.isArray(networkData.nodes)) {
            console.error('Invalid network data:', networkData);
            this.showEmptyState();
            return;
        }

        console.log(`Creating network visualization with ${networkData.nodes.length} nodes in ${this.currentAnalysisMode} mode`);
        
        try {
            // Clear previous content
            networkGraph.innerHTML = '';
            
            // Create vis.js nodes with mode-appropriate styling
            const visNodes = networkData.nodes.map(nodeId => {
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
                
                // Add mode-appropriate tooltip
                node.title = this.createNodeTooltip(nodeId);
                
                // Add special styling for different analysis modes
                if (this.currentAnalysisMode === 'full') {
                    node.borderWidth = 3; // Thicker borders for full analysis
                } else if (this.currentAnalysisMode === 'diamond') {
                    // Special styling for diamond mode
                    if (this.isNodeInDiamond(nodeId)) {
                        node.borderColor = '#fd79a8';
                        node.borderWidth = 3;
                    }
                }
                
                return node;
            });
            
            // Create vis.js edges
            const visEdges = (networkData.edges || []).map((edge, index) => {
                if (!Array.isArray(edge) || edge.length !== 2) {
                    console.warn('Invalid edge format:', edge);
                    return null;
                }
                
                return {
                    id: index,
                    from: edge[0],
                    to: edge[1],
                    arrows: 'to',
                    color: this.getEdgeColor(edge),
                    width: this.getEdgeWidth(edge),
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
            
            // Configure options based on analysis mode
            const options = this.getVisualizationOptions();
            
            // Create network
            this.networkInstance = new vis.Network(networkGraph, data, options);
            this.currentData = data;
            
            // Set up event handlers
            this.setupNetworkEventHandlers();
            
            // Make globally available for other functions
            window.networkInstance = this.networkInstance;
            
            console.log(`Network visualization created successfully in ${this.currentAnalysisMode} mode`);
            
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

    getVisualizationOptions() {
        const baseOptions = {
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

        // Mode-specific options
        if (this.currentAnalysisMode === 'structure') {
            // Structure mode: emphasize structural elements
            baseOptions.nodes.font = { ...baseOptions.nodes.font, size: 14 };
            baseOptions.physics.stabilization.iterations = 150;
        } else if (this.currentAnalysisMode === 'diamond') {
            // Diamond mode: emphasize diamond structures
            baseOptions.edges.width = 3;
            baseOptions.nodes.borderWidth = 3;
        } else if (this.currentAnalysisMode === 'full') {
            // Full mode: emphasize probability-based sizing
            baseOptions.nodes.scaling = {
                min: 10,
                max: 30,
                label: {
                    enabled: true,
                    min: 12,
                    max: 16
                }
            };
        }

        return baseOptions;
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
        const networkData = this.getNetworkData();
        if (!networkData) return `<strong>Node: ${nodeId}</strong>`;
        
        let tooltip = `<strong>Node: ${nodeId}</strong><br/>`;
        
        // Add type information (available in all modes)
        const nodeType = this.getNodeType(nodeId);
        tooltip += `Type: ${nodeType}<br/>`;
        
        // Add iteration information if available
        const iteration = this.getNodeIteration(nodeId);
        if (iteration !== 'N/A') {
            tooltip += `Iteration: ${iteration}<br/>`;
        }
        
        // Add mode-specific information
        switch (this.currentAnalysisMode) {
            case 'structure':
                tooltip += this.createStructureTooltip(nodeId);
                break;
            case 'diamond':
                tooltip += this.createDiamondTooltip(nodeId);
                break;
            case 'full':
                tooltip += this.createFullAnalysisTooltip(nodeId);
                break;
        }
        
        return tooltip;
    }

    createStructureTooltip(nodeId) {
        const networkData = this.getNetworkData();
        let tooltip = '';
        
        // Add degree information
        const inDegree = networkData.highIndegreeNodes?.find(n => n.node === nodeId)?.degree || 0;
        const outDegree = networkData.highOutdegreeNodes?.find(n => n.node === nodeId)?.degree || 0;
        
        if (inDegree > 0 || outDegree > 0) {
            tooltip += `In-degree: ${inDegree}, Out-degree: ${outDegree}<br/>`;
        }
        
        // Add structural role
        if (networkData.sourceNodes?.includes(nodeId)) {
            tooltip += `Role: Network entry point<br/>`;
        } else if (networkData.sinkNodes?.includes(nodeId)) {
            tooltip += `Role: Network endpoint<br/>`;
        } else if (networkData.forkNodes?.includes(nodeId)) {
            tooltip += `Role: Decision/branching point<br/>`;
        } else if (networkData.joinNodes?.includes(nodeId)) {
            tooltip += `Role: Convergence point<br/>`;
        }
        
        return tooltip;
    }

    createDiamondTooltip(nodeId) {
        let tooltip = this.createStructureTooltip(nodeId);
        
        // Add diamond membership
        const isDiamondMember = this.isNodeInDiamond(nodeId);
        tooltip += `Diamond Member: ${isDiamondMember ? 'Yes' : 'No'}<br/>`;
        
        if (isDiamondMember) {
            const diamondManager = window.AppManagers?.diamond;
            const joinNodes = diamondManager?.getNodeDiamondJoinNodes(nodeId) || [];
            if (joinNodes.length > 0) {
                tooltip += `Diamonds: ${joinNodes.join(', ')}<br/>`;
            }
        }
        
        return tooltip;
    }

    createFullAnalysisTooltip(nodeId) {
        let tooltip = this.createDiamondTooltip(nodeId);
        
        // Add probability information
        const analysisManager = window.AppManagers?.analysis;
        if (analysisManager) {
            const prior = analysisManager.getNodePrior(nodeId);
            const calculated = analysisManager.getNodeProbability(nodeId);
            
            tooltip += `Prior: ${prior}<br/>`;
            tooltip += `Calculated: ${calculated}<br/>`;
        }
        
        return tooltip;
    }

    getNodeColor(nodeId) {
        const colors = {
            source: '#ff6b6b',
            sink: '#4ecdc4',
            fork: '#45b7d1',
            join: '#96ceb4',
            diamond: '#fd79a8',
            regular: '#74b9ff',
            highProbability: '#28a745',
            mediumProbability: '#ffc107',
            lowProbability: '#dc3545'
        };
        
        try {
            const networkData = this.getNetworkData();
            if (!networkData) return colors.regular;
            
            // Mode-specific coloring
            if (this.currentAnalysisMode === 'full') {
                // Full mode: color by probability if available
                const analysisManager = window.AppManagers?.analysis;
                if (analysisManager) {
                    const probability = analysisManager.getNodeProbabilityValue(nodeId);
                    if (probability !== null && !isNaN(probability)) {
                        if (probability > 0.7) return colors.highProbability;
                        if (probability > 0.3) return colors.mediumProbability;
                        return colors.lowProbability;
                    }
                }
            }
            
            // Diamond highlighting (high priority in diamond and full modes)
            if ((this.currentAnalysisMode === 'diamond' || this.currentAnalysisMode === 'full') && 
                this.dom.isElementChecked('showDiamonds') && this.isNodeInDiamond(nodeId)) {
                return colors.diamond;
            }
            
            // Specific node type highlighting
            if (this.dom.isElementChecked('showSourceNodes') && networkData.sourceNodes?.includes(nodeId)) {
                return colors.source;
            }
            if (this.dom.isElementChecked('showSinkNodes') && networkData.sinkNodes?.includes(nodeId)) {
                return colors.sink;
            }
            if (this.dom.isElementChecked('showForkNodes') && networkData.forkNodes?.includes(nodeId)) {
                return colors.fork;
            }
            if (this.dom.isElementChecked('showJoinNodes') && networkData.joinNodes?.includes(nodeId)) {
                return colors.join;
            }
            
            // Iteration-based coloring
            if (this.dom.isElementChecked('showIterations') && networkData.iterationSets) {
                const iterationColors = ['#e17055', '#fdcb6e', '#6c5ce7', '#a29bfe', '#fd79a8'];
                for (let i = 0; i < networkData.iterationSets.length; i++) {
                    if (networkData.iterationSets[i].includes(nodeId)) {
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
            const baseSize = 15;
            
            if (this.currentAnalysisMode === 'full') {
                // Full mode: size by probability
                const analysisManager = window.AppManagers?.analysis;
                if (analysisManager) {
                    const probability = analysisManager.getNodeProbabilityValue(nodeId);
                    if (probability !== null && !isNaN(probability)) {
                        return Math.max(10, baseSize + (probability * 20));
                    }
                }
            } else if (this.currentAnalysisMode === 'diamond') {
                // Diamond mode: larger size for diamond members
                if (this.isNodeInDiamond(nodeId)) {
                    return baseSize + 5;
                }
            } else if (this.currentAnalysisMode === 'structure') {
                // Structure mode: size by degree
                const networkData = this.getNetworkData();
                if (networkData) {
                    const highIn = networkData.highIndegreeNodes?.find(n => n.node === nodeId);
                    const highOut = networkData.highOutdegreeNodes?.find(n => n.node === nodeId);
                    
                    if (highIn || highOut) {
                        const maxDegree = Math.max(highIn?.degree || 0, highOut?.degree || 0);
                        return baseSize + Math.min(10, maxDegree * 2);
                    }
                }
            }
            
            return baseSize;
        } catch (error) {
            console.warn('Error getting node size for node', nodeId, ':', error);
            return 15;
        }
    }

    getEdgeColor(edge) {
        const defaultColor = { color: '#666', highlight: '#667eea' };
        
        if (this.currentAnalysisMode === 'diamond' && this.isEdgeInDiamond(edge)) {
            return { color: '#fd79a8', highlight: '#fd79a8' };
        }
        
        return defaultColor;
    }

    getEdgeWidth(edge) {
        if (this.currentAnalysisMode === 'diamond' && this.isEdgeInDiamond(edge)) {
            return 3;
        }
        return 2;
    }

    isEdgeInDiamond(edge) {
        // Check if edge is part of any diamond structure
        if (!AppState.diamondData || !AppState.diamondData.diamondStructures) return false;
        
        try {
            for (const [joinNode, structure] of Object.entries(AppState.diamondData.diamondStructures)) {
                if (structure.diamond) {
                    for (const group of structure.diamond) {
                        if (group.edgelist) {
                            for (const diamondEdge of group.edgelist) {
                                if (Array.isArray(diamondEdge) && diamondEdge.length === 2 &&
                                    diamondEdge[0] === edge[0] && diamondEdge[1] === edge[1]) {
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('Error checking if edge is in diamond:', error);
        }
        
        return false;
    }

    displayVisualizationStatistics() {
        // Display mode-appropriate statistics in the node details panel or elsewhere
        const networkData = this.getNetworkData();
        if (!networkData) return;
        
        switch (this.currentAnalysisMode) {
            case 'structure':
                this.displayStructureStatistics(networkData);
                break;
            case 'diamond':
                this.displayDiamondStatistics(networkData);
                break;
            case 'full':
                this.displayFullAnalysisStatistics(networkData);
                break;
        }
    }

    displayStructureStatistics(networkData) {
        const stats = AppState.structureData?.statistics;
        if (!stats) return;
        
        // Update the main structure statistics in the UI
        const basicStats = stats.basic || {};
        this.dom.setElementText('structureNodes', basicStats.nodes || 0);
        this.dom.setElementText('structureEdges', basicStats.edges || 0);
        this.dom.setElementText('structureDensity', (basicStats.density || 0).toFixed(3));
        this.dom.setElementText('structureDepth', basicStats.maxDepth || 0);
        
        console.log('Structure Statistics Updated:', {
            nodes: basicStats.nodes || 0,
            edges: basicStats.edges || 0,
            density: basicStats.density || 0,
            maxDepth: basicStats.maxDepth || 0,
            nodeTypes: stats.nodeTypes || {},
            diamonds: stats.structural?.diamonds || 0
        });
    }

    displayDiamondStatistics(networkData) {
        const diamondData = AppState.diamondData;
        if (!diamondData) return;
        
        const diamondCount = diamondData.diamondClassifications?.length || 0;
        const complexDiamonds = diamondData.diamondClassifications?.filter(d => d.complexity_score > 10).length || 0;
        const avgComplexity = diamondCount > 0 ?
            diamondData.diamondClassifications.reduce((sum, d) => sum + (d.complexity_score || 0), 0) / diamondCount : 0;
        const maxPathCount = diamondCount > 0 ?
            Math.max(...diamondData.diamondClassifications.map(d => d.path_count || 0)) : 0;
        
        // Update the diamond statistics in the UI
        this.dom.setElementText('totalDiamonds', diamondCount);
        this.dom.setElementText('complexDiamonds', complexDiamonds);
        this.dom.setElementText('averageComplexity', avgComplexity.toFixed(1));
        this.dom.setElementText('maxPathCount', maxPathCount);
        
        console.log('Diamond Statistics Updated:', {
            totalDiamonds: diamondCount,
            complexDiamonds: complexDiamonds,
            avgComplexity: avgComplexity.toFixed(1),
            maxPathCount: maxPathCount,
            diamondDensity: networkData && networkData.nodes ? (diamondCount / networkData.nodes.length).toFixed(3) : 0
        });
    }

    displayFullAnalysisStatistics(networkData) {
        const results = AppState.analysisResults;
        if (!results) return;
        
        const probabilities = results.results.map(r => r.probability);
        const avgProbability = probabilities.reduce((a, b) => a + b, 0) / probabilities.length;
        const maxProbability = Math.max(...probabilities);
        const minProbability = Math.min(...probabilities);
        
        console.log('Full Analysis Statistics:', {
            avgProbability: avgProbability.toFixed(4),
            maxProbability: maxProbability.toFixed(4),
            minProbability: minProbability.toFixed(4),
            totalNodes: results.results.length
        });
    }

    // Method to update main statistics display (called from updateVisualization)
    updateMainStatisticsDisplay() {
        const networkData = this.getNetworkData();
        if (!networkData) return;
        
        // Update structure statistics in the main UI
        if (this.currentAnalysisMode === 'structure' || this.currentAnalysisMode === 'diamond') {
            this.displayStructureStatistics(networkData);
        }
        
        // Update diamond statistics in the main UI
        if (this.currentAnalysisMode === 'diamond') {
            this.displayDiamondStatistics(networkData);
        }
    }

    // Enhanced node details for different analysis modes
    updateNodeDetails() {
        const selectedNodeInfo = this.dom.elements.selectedNodeInfo;
        if (!selectedNodeInfo) return;
        
        if (!AppState.selectedNode) {
            selectedNodeInfo.innerHTML = this.getDefaultNodeDetailsContent();
            return;
        }
        
        try {
            const content = this.createNodeDetailsContent(AppState.selectedNode);
            selectedNodeInfo.innerHTML = content;
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

    getDefaultNodeDetailsContent() {
        const modeText = this.currentAnalysisMode ? 
            `${this.currentAnalysisMode.charAt(0).toUpperCase() + this.currentAnalysisMode.slice(1)} mode active` :
            'Click a node to see details';
            
        return `
            <div style="text-align: center; color: #666; padding: 20px;">
                ${UIUtils.createIcon('network', 24)}<br>
                ${modeText}
            </div>
        `;
    }

    createNodeDetailsContent(nodeId) {
        const networkData = this.getNetworkData();
        if (!networkData) return `<div>No network data available</div>`;
        
        let content = `
            <div class="node-detail-item">
                <strong>Node:</strong> ${nodeId}
            </div>
        `;
        
        // Add common details available in all modes
        content += this.addCommonNodeDetails(nodeId);
        
        // Add mode-specific details
        switch (this.currentAnalysisMode) {
            case 'structure':
                content += this.addStructureNodeDetails(nodeId);
                break;
            case 'diamond':
                content += this.addDiamondNodeDetails(nodeId);
                break;
            case 'full':
                content += this.addFullAnalysisNodeDetails(nodeId);
                break;
        }
        
        // Add interaction buttons
        content += this.addNodeInteractionButtons(nodeId);
        
        return content;
    }

    addCommonNodeDetails(nodeId) {
        const nodeType = this.getNodeType(nodeId);
        const iteration = this.getNodeIteration(nodeId);
        
        return `
            <div class="node-detail-item">
                <strong>Type:</strong> ${nodeType}
            </div>
            <div class="node-detail-item">
                <strong>Iteration Set:</strong> ${iteration}
            </div>
        `;
    }

    addStructureNodeDetails(nodeId) {
        const networkData = this.getNetworkData();
        const isDiamondMember = this.isNodeInDiamond(nodeId);
        
        let content = `
            <div class="node-detail-item">
                <strong>Diamond Member:</strong> ${UIUtils.getBooleanIcon(isDiamondMember)} ${isDiamondMember ? 'Yes' : 'No'}
            </div>
        `;
        
        // Add degree information if available
        const highIn = networkData.highIndegreeNodes?.find(n => n.node === nodeId);
        const highOut = networkData.highOutdegreeNodes?.find(n => n.node === nodeId);
        
        if (highIn || highOut) {
            content += `
                <div class="node-detail-item">
                    <strong>Connectivity:</strong> In: ${highIn?.degree || 0}, Out: ${highOut?.degree || 0}
                </div>
            `;
        }
        
        return content;
    }

    addDiamondNodeDetails(nodeId) {
        let content = this.addStructureNodeDetails(nodeId);
        
        const isDiamondMember = this.isNodeInDiamond(nodeId);
        if (isDiamondMember) {
            const diamondManager = window.AppManagers?.diamond;
            const joinNodes = diamondManager?.getNodeDiamondJoinNodes(nodeId) || [];
            
            if (joinNodes.length > 0) {
                content += `
                    <div class="diamond-membership">
                        <h6>Diamond Memberships</h6>
                        <div class="diamond-join-nodes">
                            ${joinNodes.map(joinNode => 
                                `<button class="diamond-join-btn" onclick="showDiamondForJoin(${joinNode})">${joinNode}</button>`
                            ).join('')}
                        </div>
                    </div>
                `;
            }
        }
        
        return content;
    }

    addFullAnalysisNodeDetails(nodeId) {
        let content = this.addDiamondNodeDetails(nodeId);
        
        const analysisManager = window.AppManagers?.analysis;
        if (analysisManager) {
            const prior = analysisManager.getNodePrior(nodeId);
            const calculated = analysisManager.getNodeProbability(nodeId);
            
            content += `
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
            `;
        }
        
        return content;
    }

    addNodeInteractionButtons(nodeId) {
        return `
            <div style="margin-top: 15px; display: flex; gap: 8px; flex-wrap: wrap;">
                <button onclick="highlightAncestors('${nodeId}')" style="flex: 1; min-width: 120px; padding: 6px 10px; font-size: 12px; background: #ffeaa7; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">Ancestors</button>
                <button onclick="highlightDescendants('${nodeId}')" style="flex: 1; min-width: 120px; padding: 6px 10px; font-size: 12px; background: #fd79a8; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; color: white;">Descendants</button>
            </div>
        `;
    }

    // Rest of the methods remain the same but with enhanced error handling
    selectNode(nodeId) {
        console.log('Selecting node:', nodeId);
        AppState.selectedNode = nodeId;
        this.updateNodeDetails();
        this.highlightNodeConnections(nodeId);
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
        const networkData = this.getNetworkData();
        if (!networkData?.ancestors || !this.networkInstance || !this.currentData) return;
        
        try {
            const ancestors = networkData.ancestors[nodeId] || [];
            const nodes = this.currentData.nodes;
            
            // Update node colors
            const updates = networkData.nodes.map(id => ({
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
        const networkData = this.getNetworkData();
        if (!networkData?.descendants || !this.networkInstance || !this.currentData) return;
        
        try {
            const descendants = networkData.descendants[nodeId] || [];
            const nodes = this.currentData.nodes;
            
            // Update node colors
            const updates = networkData.nodes.map(id => ({
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
                    const networkData = this.getNetworkData();
                    if (networkData) {
                        const updates = networkData.nodes.map(id => ({
                            id: id,
                            color: this.getNodeColor(id),
                            borderWidth: 2
                        }));
                        this.currentData.nodes.update(updates);
                    }
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

    // Utility methods (enhanced with better error handling)
    isNodeInDiamond(nodeId) {
        if (!AppState.diamondData || !AppState.diamondData.diamondStructures) return false;
        
        try {
            for (const [joinNode, structure] of Object.entries(AppState.diamondData.diamondStructures)) {
                if (structure.diamond && Array.isArray(structure.diamond)) {
                    for (const group of structure.diamond) {
                        if (group.relevant_nodes && Array.isArray(group.relevant_nodes) && 
                            group.relevant_nodes.includes(parseInt(nodeId))) {
                            return true;
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('Error checking if node is in diamond:', error);
        }
        
        return false;
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

    getNodeIteration(nodeId) {
        const networkData = this.getNetworkData();
        if (!networkData?.iterationSets) return 'N/A';
        
        for (let i = 0; i < networkData.iterationSets.length; i++) {
            if (networkData.iterationSets[i].includes(nodeId)) {
                return i + 1;
            }
        }
        return 'N/A';
    }

    // State queries
    isVisualizationReady() {
        return this.networkInstance !== null && this.hasVisualizableData();
    }

    getCurrentAnalysisMode() {
        return this.currentAnalysisMode;
    }

    // Cleanup
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