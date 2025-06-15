// diamond-manager.js - Enhanced diamond analysis with individual parameter support
import { AppState } from '../main.js';
import { UIUtils } from '../utils/ui-utils.js';

export class DiamondManager {
    constructor(domManager, parameterManager = null) {
        this.dom = domManager;
        this.parameterManager = parameterManager;
        this.pathNetworkInstance = null;
    }

    initializeEventListeners() {
        console.log('Initializing Diamond Manager event listeners');
        
        // Diamond analysis control handlers
        this.dom.safeAddEventListener('diamondTypeFilter', 'change', () => {
            this.updateDiamondList();
        });
        
        this.dom.safeAddEventListener('forkStructureFilter', 'change', () => {
            this.updateDiamondList();
        });
        
        this.dom.safeAddEventListener('diamondSortSelect', 'change', () => {
            this.updateDiamondList();
        });
        
        // Path analysis control handlers
        this.initializePathAnalysisControls();
        
        // Modal close handlers
        this.initializeModalHandlers();
        
        console.log('Diamond Manager event listeners initialized');
    }

    initializePathAnalysisControls() {
        // Path parameter controls
        this.dom.safeAddEventListener('pathOverrideNodes', 'change', function() {
            const pathNodePrior = document.getElementById('pathNodePrior');
            if (pathNodePrior) pathNodePrior.disabled = !this.checked;
            UIUtils.updateCheckboxState(this);
        });
        
        this.dom.safeAddEventListener('pathOverrideEdges', 'change', function() {
            const pathEdgeProb = document.getElementById('pathEdgeProb');
            if (pathEdgeProb) pathEdgeProb.disabled = !this.checked;
            UIUtils.updateCheckboxState(this);
        });
        
        this.dom.safeAddEventListener('pathNodePrior', 'input', function() {
            const pathNodeValue = document.getElementById('pathNodeValue');
            if (pathNodeValue) pathNodeValue.textContent = this.value;
        });
        
        this.dom.safeAddEventListener('pathEdgeProb', 'input', function() {
            const pathEdgeValue = document.getElementById('pathEdgeValue');
            if (pathEdgeValue) pathEdgeValue.textContent = this.value;
        });
        
        // Path analysis action buttons
        this.dom.safeAddEventListener('runPathAnalysis', 'click', () => {
            this.runDiamondSubsetAnalysis();
        });
        
        this.dom.safeAddEventListener('resetPathParams', 'click', () => {
            this.resetPathParameters();
        });
    }

    initializeModalHandlers() {
        // Close button handlers for all modals
        document.addEventListener('click', (event) => {
            if (event.target.classList.contains('close')) {
                const modal = event.target.closest('.modal');
                if (modal) {
                    this.closeModal(modal.id);
                }
            }
        });
        
        // Click outside modal to close
        document.addEventListener('click', (event) => {
            if (event.target.classList.contains('modal')) {
                this.closeModal(event.target.id);
            }
        });
        
        // Escape key to close modals
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                const openModals = document.querySelectorAll('.modal[style*="block"]');
                openModals.forEach(modal => this.closeModal(modal.id));
            }
        });
    }

    displayDiamondAnalysis() {
        if (!AppState.diamondData) {
            console.warn('No diamond data available for display');
            return;
        }
        
        console.log('Displaying diamond analysis:', AppState.diamondData);
        
        try {
            this.updateDiamondSummary();
            this.populateFocusDiamondSelect();
            this.updateDiamondList();
            console.log('Diamond analysis displayed successfully');
        } catch (error) {
            console.error('Error displaying diamond analysis:', error);
        }
    }

    updateDiamondSummary() {
        if (!AppState.diamondData?.diamondClassifications) {
            console.warn('No diamond classifications available');
            return;
        }
        
        try {
            const classifications = AppState.diamondData.diamondClassifications;
            const totalDiamonds = classifications.length;
            const complexDiamonds = classifications.filter(d => d.complexity_score > 10).length;
            const avgComplexity = totalDiamonds > 0 ?
                classifications.reduce((sum, d) => sum + d.complexity_score, 0) / totalDiamonds : 0;
            const maxPathCount = totalDiamonds > 0 ?
                Math.max(...classifications.map(d => d.path_count || 0)) : 0;
            
            console.log('Attempting to update diamond summary with values:', {totalDiamonds, complexDiamonds, avgComplexity, maxPathCount});
            
            // Check if elements exist before setting
            const totalElement = document.getElementById('totalDiamonds');
            const complexElement = document.getElementById('complexDiamonds');
            const avgElement = document.getElementById('averageComplexity');
            const maxElement = document.getElementById('maxPathCount');
            
            console.log('DOM elements found:', {
                totalElement: !!totalElement,
                complexElement: !!complexElement,
                avgElement: !!avgElement,
                maxElement: !!maxElement
            });
            
            if (totalElement) {
                totalElement.textContent = totalDiamonds;
                console.log('Set totalDiamonds to:', totalDiamonds);
            } else {
                console.error('totalDiamonds element not found!');
            }
            
            if (complexElement) {
                complexElement.textContent = complexDiamonds;
                console.log('Set complexDiamonds to:', complexDiamonds);
            } else {
                console.error('complexDiamonds element not found!');
            }
            
            if (avgElement) {
                avgElement.textContent = avgComplexity.toFixed(1);
                console.log('Set averageComplexity to:', avgComplexity.toFixed(1));
            } else {
                console.error('averageComplexity element not found!');
            }
            
            if (maxElement) {
                maxElement.textContent = maxPathCount;
                console.log('Set maxPathCount to:', maxPathCount);
            } else {
                console.error('maxPathCount element not found!');
            }
            
            console.log('Diamond summary update completed');
        } catch (error) {
            console.error('Error updating diamond summary:', error);
        }
    }

    updateDiamondList() {
        if (!AppState.diamondData?.diamondClassifications) {
            console.warn('No diamond classifications available for list');
            return;
        }
        
        const diamondList = this.dom.elements.diamondList;
        if (!diamondList) {
            console.error('Diamond list element not found');
            return;
        }
        
        try {
            let diamonds = [...AppState.diamondData.diamondClassifications];
            
            // Apply filters
            const typeFilter = this.dom.getElementValue('diamondTypeFilter') || 'all';
            if (typeFilter !== 'all') {
                diamonds = diamonds.filter(d => d.internal_structure === typeFilter);
            }
            
            const forkFilter = this.dom.getElementValue('forkStructureFilter') || 'all';
            if (forkFilter !== 'all') {
                diamonds = diamonds.filter(d => d.fork_structure === forkFilter);
            }
            
            // Apply sorting
            const sortBy = this.dom.getElementValue('diamondSortSelect') || 'complexity';
            diamonds.sort((a, b) => {
                switch (sortBy) {
                    case 'complexity':
                        return (b.complexity_score || 0) - (a.complexity_score || 0);
                    case 'joinNode':
                        return (a.join_node || 0) - (b.join_node || 0);
                    case 'size':
                        return (b.subgraph_size || 0) - (a.subgraph_size || 0);
                    case 'pathCount':
                        return (b.path_count || 0) - (a.path_count || 0);
                    default:
                        return 0;
                }
            });
            
            // Generate HTML
            const listHtml = diamonds.map((diamond, index) => {
                const safeJoinNode = diamond.join_node || 'unknown';
                const safeComplexity = diamond.complexity_score || 0;
                const safeForkStructure = diamond.fork_structure || 'Unknown';
                const safeInternalStructure = diamond.internal_structure || 'Unknown';
                const safePathTopology = diamond.path_topology || 'Unknown';
                const safeSubgraphSize = diamond.subgraph_size || 0;
                const safePathCount = diamond.path_count || 0;
                
                return `
                    <div class="diamond-card" data-join-node="${safeJoinNode}" data-diamond-index="${index}">
                        <div class="diamond-header">
                            <h5>Diamond at Join Node ${safeJoinNode}</h5>
                            <span class="complexity-badge">${safeComplexity.toFixed(1)}</span>
                        </div>
                        <div class="diamond-details">
                            <div class="diamond-detail-row">
                                <span class="detail-label">Fork Structure:</span>
                                <span class="detail-value">${safeForkStructure}</span>
                            </div>
                            <div class="diamond-detail-row">
                                <span class="detail-label">Internal Structure:</span>
                                <span class="detail-value">${safeInternalStructure}</span>
                            </div>
                            <div class="diamond-detail-row">
                                <span class="detail-label">Path Topology:</span>
                                <span class="detail-value">${safePathTopology}</span>
                            </div>
                            <div class="diamond-detail-row">
                                <span class="detail-label">Size:</span>
                                <span class="detail-value">${safeSubgraphSize} nodes, ${safePathCount} paths</span>
                            </div>
                            <div class="diamond-actions">
                                <button class="action-btn detail-btn" onclick="showDiamondDetail('${safeJoinNode}', ${index})">Details</button>
                                <button class="action-btn visualize-btn" onclick="focusOnDiamondInViz('${safeJoinNode}')">Visualize</button>
                                <button class="action-btn analyze-btn" onclick="analyzeDiamondPaths('${safeJoinNode}')">Analyze Paths</button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            diamondList.innerHTML = listHtml;
            console.log('Diamond list updated with', diamonds.length, 'diamonds');
            
        } catch (error) {
            console.error('Error updating diamond list:', error);
            diamondList.innerHTML = '<div class="error">Error loading diamond list</div>';
        }
    }

    showDiamondDetail(joinNode, diamondIndex) {
        console.log('=== DEBUGGING DIAMOND DETAIL ===');
        console.log('Join Node:', joinNode, 'Index:', diamondIndex);
        console.log('AppState.diamondData:', AppState.diamondData);
        
        if (!AppState.diamondData) {
            alert('No diamond data available in AppState');
            return;
        }
        
        if (!AppState.diamondData.diamondClassifications) {
            alert('No diamond classifications available');
            console.log('Available keys in diamondData:', Object.keys(AppState.diamondData));
            return;
        }
        
        console.log('Available classifications:', AppState.diamondData.diamondClassifications.length);
        console.log('Requested index:', diamondIndex);
        
        try {
            const diamond = AppState.diamondData.diamondClassifications[diamondIndex];
            console.log('Found diamond:', diamond);
            
            if (!diamond) {
                alert(`Diamond not found at index ${diamondIndex}`);
                console.log('Available diamonds:', AppState.diamondData.diamondClassifications);
                return;
            }
            
            const diamondStructure = AppState.diamondData.diamondStructures?.[joinNode];
            console.log('Diamond structure:', diamondStructure);
            
            // Set modal title
            this.dom.setElementText('diamondDetailTitle', `Diamond at Join Node ${joinNode}`);
            
            // Generate content
            console.log('Generating modal content...');
            const modalContent = this.createDiamondDetailContent(diamond, diamondStructure);
            console.log('Generated content length:', modalContent.length);
            console.log('Generated content preview:', modalContent.substring(0, 200));
            
            // Set content
            const contentElement = document.getElementById('diamondDetailContent');
            if (!contentElement) {
                alert('diamondDetailContent element not found!');
                return;
            }
            
            contentElement.innerHTML = modalContent;
            console.log('Content set successfully');
            
            // Show modal
            this.dom.showElement('diamondDetailModal');
            console.log('Modal displayed');
            
        } catch (error) {
            console.error('Error showing diamond detail:', error);
            console.error('Stack trace:', error.stack);
            
            // Show fallback content
            const contentElement = document.getElementById('diamondDetailContent');
            if (contentElement) {
                contentElement.innerHTML = `
                    <div class="error-content">
                        <h3>Error Loading Diamond Details</h3>
                        <p><strong>Error:</strong> ${error.message}</p>
                        <p><strong>Join Node:</strong> ${joinNode}</p>
                        <p><strong>Index:</strong> ${diamondIndex}</p>
                        <details>
                            <summary>Debug Information</summary>
                            <pre>${JSON.stringify({
                                hasData: !!AppState.diamondData,
                                hasClassifications: !!AppState.diamondData?.diamondClassifications,
                                classificationsLength: AppState.diamondData?.diamondClassifications?.length || 0,
                                requestedIndex: diamondIndex,
                                availableKeys: AppState.diamondData ? Object.keys(AppState.diamondData) : []
                            }, null, 2)}</pre>
                        </details>
                    </div>
                `;
            }
            
            this.dom.showElement('diamondDetailModal');
        }
    }

    createDiamondDetailContent(diamond, diamondStructure) {
        console.log('=== CREATING DIAMOND DETAIL CONTENT ===');
        console.log('Diamond object:', diamond);
        console.log('Diamond structure:', diamondStructure);
        
        if (!diamond) {
            return '<div class="error">No diamond data provided</div>';
        }
        
        const safeGet = (obj, key, defaultValue = 'N/A') => {
            const value = obj && obj[key] !== undefined && obj[key] !== null ? obj[key] : defaultValue;
            console.log(`safeGet(${key}):`, value);
            return value;
        };
        
        try {
            const content = `
                <div class="diamond-detail-full">
                    <div class="detail-section">
                        <h6>Classification Details</h6>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <label>Fork Structure:</label>
                                <span>${safeGet(diamond, 'fork_structure')}</span>
                            </div>
                            <div class="detail-item">
                                <label>Internal Structure:</label>
                                <span>${safeGet(diamond, 'internal_structure')}</span>
                            </div>
                            <div class="detail-item">
                                <label>Path Topology:</label>
                                <span>${safeGet(diamond, 'path_topology')}</span>
                            </div>
                            <div class="detail-item">
                                <label>Join Structure:</label>
                                <span>${safeGet(diamond, 'join_structure')}</span>
                            </div>
                            <div class="detail-item">
                                <label>External Connectivity:</label>
                                <span>${safeGet(diamond, 'external_connectivity')}</span>
                            </div>
                            <div class="detail-item">
                                <label>Degeneracy:</label>
                                <span>${safeGet(diamond, 'degeneracy')}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h6>Metrics</h6>
                        <div class="metrics-grid">
                            <div class="metric-item">
                                <span class="metric-value">${safeGet(diamond, 'fork_count', 0)}</span>
                                <span class="metric-label">Fork Count</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-value">${safeGet(diamond, 'subgraph_size', 0)}</span>
                                <span class="metric-label">Subgraph Size</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-value">${safeGet(diamond, 'internal_forks', 0)}</span>
                                <span class="metric-label">Internal Forks</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-value">${safeGet(diamond, 'internal_joins', 0)}</span>
                                <span class="metric-label">Internal Joins</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-value">${safeGet(diamond, 'path_count', 0)}</span>
                                <span class="metric-label">Path Count</span>
                            </div>
                            <div class="metric-item">
                                <span class="metric-value">${parseFloat(safeGet(diamond, 'complexity_score', 0)).toFixed(2)}</span>
                                <span class="metric-label">Complexity Score</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h6>Optimization Insights</h6>
                        <div class="insight-item">
                            <label>Optimization Potential:</label>
                            <span class="insight-value">${safeGet(diamond, 'optimization_potential')}</span>
                        </div>
                        <div class="insight-item">
                            <label>Bottleneck Risk:</label>
                            <span class="insight-value ${(safeGet(diamond, 'bottleneck_risk', '')).toLowerCase()}">${safeGet(diamond, 'bottleneck_risk')}</span>
                        </div>
                    </div>
                    
                    ${diamondStructure ? this.createStructureDetailsSection(diamondStructure) : '<div class="detail-section"><h6>Structure Details</h6><p>No structure data available</p></div>'}
                    
                    <div class="detail-section">
                        <h6>Raw Data (Debug)</h6>
                        <details>
                            <summary>Show raw diamond data</summary>
                            <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px; overflow-x: auto;">${JSON.stringify(diamond, null, 2)}</pre>
                        </details>
                    </div>
                </div>
            `;
            
            console.log('Generated content successfully, length:', content.length);
            return content;
            
        } catch (error) {
            console.error('Error generating diamond detail content:', error);
            return `
                <div class="error-content">
                    <h3>Error Generating Content</h3>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <details>
                        <summary>Available Diamond Properties</summary>
                        <pre>${JSON.stringify(Object.keys(diamond || {}), null, 2)}</pre>
                    </details>
                    <details>
                        <summary>Full Diamond Object</summary>
                        <pre>${JSON.stringify(diamond, null, 2)}</pre>
                    </details>
                </div>
            `;
        }
    }

    createStructureDetailsSection(diamondStructure) {
        try {
            const nonDiamondParents = Array.isArray(diamondStructure.non_diamond_parents) ? 
                diamondStructure.non_diamond_parents : [];
            const diamonds = Array.isArray(diamondStructure.diamond) ? 
                diamondStructure.diamond : [];
                
            return `
                <div class="detail-section">
                    <h6>Structure Details</h6>
                    <div class="structure-details">
                        <p><strong>Non-Diamond Parents:</strong> ${nonDiamondParents.join(', ') || 'None'}</p>
                        <div class="diamond-groups">
                            ${diamonds.map((group, i) => {
                                const highestNodes = Array.isArray(group.highest_nodes) ? group.highest_nodes : [];
                                const relevantNodes = Array.isArray(group.relevant_nodes) ? group.relevant_nodes : [];
                                const edgeCount = Array.isArray(group.edgelist) ? group.edgelist.length : 0;
                                
                                return `
                                    <div class="diamond-group-detail">
                                        <h7>Diamond Group ${i + 1}</h7>
                                        <p><strong>Highest Nodes:</strong> ${highestNodes.join(', ') || 'None'}</p>
                                        <p><strong>Relevant Nodes:</strong> ${relevantNodes.join(', ') || 'None'}</p>
                                        <p><strong>Edges:</strong> ${edgeCount} edges</p>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error creating structure details section:', error);
            return '<div class="detail-section"><h6>Structure Details</h6><p>Error loading structure details</p></div>';
        }
    }

    populateFocusDiamondSelect() {
        const focusDiamondSelect = this.dom.elements.focusDiamondSelect;
        if (!focusDiamondSelect) {
            console.warn('Focus diamond select element not found');
            return;
        }
        
        try {
            focusDiamondSelect.innerHTML = '<option value="none">None</option>';
            
            if (AppState.diamondData?.diamondClassifications) {
                AppState.diamondData.diamondClassifications.forEach(diamond => {
                    const joinNode = diamond.join_node || 'unknown';
                    const option = document.createElement('option');
                    option.value = joinNode;
                    option.textContent = `Diamond at Join ${joinNode}`;
                    focusDiamondSelect.appendChild(option);
                });
                
                console.log('Focus diamond select populated with', AppState.diamondData.diamondClassifications.length, 'options');
            }
        } catch (error) {
            console.error('Error populating focus diamond select:', error);
        }
    }

    // Navigation and interaction methods
    showNodeDiamonds(nodeId) {
        const joinNodes = this.getNodeDiamondJoinNodes(nodeId);
        if (joinNodes.length > 0) {
            window.AppManagers.tab.switchTab('diamonds');
            setTimeout(() => {
                joinNodes.forEach(joinNode => {
                    const diamondCard = this.dom.querySelector(`[data-join-node="${joinNode}"]`);
                    if (diamondCard) {
                        diamondCard.classList.add('highlighted');
                        diamondCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                });
            }, 200);
        } else {
            console.log('Node', nodeId, 'is not a member of any diamonds');
        }
    }

    focusOnDiamondInViz(joinNode) {
        console.log('Focusing on diamond in visualization:', joinNode);
        window.AppManagers.tab.switchTab('visualization');
        const focusDiamondSelect = this.dom.elements.focusDiamondSelect;
        if (focusDiamondSelect) {
            focusDiamondSelect.value = joinNode;
            setTimeout(() => {
                if (window.AppManagers?.visualization) {
                    window.AppManagers.visualization.focusOnDiamond();
                }
            }, 200);
        }
    }

    showDiamondForJoin(joinNode) {
        console.log('Showing diamond for join node:', joinNode);
        window.AppManagers.tab.switchTab('diamonds');
        setTimeout(() => {
            const diamondCard = this.dom.querySelector(`[data-join-node="${joinNode}"]`);
            if (diamondCard) {
                diamondCard.classList.add('highlighted');
                diamondCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Remove highlight after animation
                setTimeout(() => {
                    diamondCard.classList.remove('highlighted');
                }, 3000);
            }
        }, 200);
    }

    // Enhanced diamond path analysis methods with parameter support
    analyzeDiamondPaths(joinNode) {
        console.log('Analyzing paths for diamond at join node:', joinNode);
        
        if (!AppState.diamondData?.diamondStructures?.[joinNode]) {
            alert('No diamond data available for this join node');
            return;
        }
        
        try {
            // Store current diamond data
            AppState.currentDiamondData = {
                joinNode: joinNode,
                structure: AppState.diamondData.diamondStructures[joinNode],
                classification: AppState.diamondData.diamondClassifications?.find(d => d.join_node == joinNode)
            };
            
            // Update parameter manager availability for diamond-specific controls
            if (this.parameterManager) {
                this.parameterManager.updateParameterEditingAvailability();
            }
            
            // Set modal title
            this.dom.setElementText('diamondPathTitle', `Diamond Path Analysis - Join Node ${joinNode}`);
            
            // Reset parameters
            this.resetPathParameters();
            
            // Create diamond subgraph visualization
            this.createDiamondSubgraphVisualization();
            
            // Show modal
            this.dom.showElement('diamondPathModal');
            
            console.log('Diamond path analysis modal opened');
            
        } catch (error) {
            console.error('Error analyzing diamond paths:', error);
            alert('Error opening path analysis');
        }
    }

    createDiamondSubgraphVisualization() {
        if (!AppState.currentDiamondData) {
            console.error('No current diamond data for visualization');
            return;
        }
        
        const pathNetworkGraph = this.dom.elements.pathNetworkGraph;
        if (!pathNetworkGraph) {
            console.error('Path network graph element not found');
            return;
        }
        
        try {
            const structure = AppState.currentDiamondData.structure;
            const joinNode = AppState.currentDiamondData.joinNode;
            
            // Collect all nodes in the diamond
            const diamondNodes = new Set();
            diamondNodes.add(parseInt(joinNode)); // Add join node
            
            // Add all nodes from diamond groups
            if (structure.diamond && Array.isArray(structure.diamond)) {
                structure.diamond.forEach(group => {
                    if (group.relevant_nodes && Array.isArray(group.relevant_nodes)) {
                        group.relevant_nodes.forEach(node => diamondNodes.add(parseInt(node)));
                    }
                    if (group.highest_nodes && Array.isArray(group.highest_nodes)) {
                        group.highest_nodes.forEach(node => diamondNodes.add(parseInt(node)));
                    }
                });
            }
            
            // Add non-diamond parents
            if (structure.non_diamond_parents && Array.isArray(structure.non_diamond_parents)) {
                structure.non_diamond_parents.forEach(node => diamondNodes.add(parseInt(node)));
            }
            
            // Collect all edges
            const diamondEdges = [];
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
            
            console.log('Diamond subgraph:', {
                nodes: Array.from(diamondNodes),
                edges: diamondEdges,
                joinNode: joinNode
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
                    if (structure.diamond && Array.isArray(structure.diamond)) {
                        structure.diamond.forEach(group => {
                            if (group.highest_nodes && group.highest_nodes.includes(nodeId)) {
                                isHighest = true;
                            }
                        });
                    }
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
            this.pathNetworkInstance = new vis.Network(pathNetworkGraph, data, options);
            AppState.pathNetworkInstance = this.pathNetworkInstance;
            
            console.log('Diamond subgraph created with', visNodes.length, 'nodes and', visEdges.length, 'edges');
            
        } catch (error) {
            console.error('Error creating diamond subgraph visualization:', error);
            pathNetworkGraph.innerHTML = '<div style="color: red; padding: 20px;">Error creating visualization</div>';
        }
    }

    resetPathParameters() {
        this.dom.setElementChecked('pathOverrideNodes', false);
        this.dom.setElementDisabled('pathNodePrior', true);
        this.dom.setElementValue('pathNodePrior', '1.0');
        this.dom.setElementText('pathNodeValue', '1.0');
        
        this.dom.setElementChecked('pathOverrideEdges', false);
        this.dom.setElementDisabled('pathEdgeProb', true);
        this.dom.setElementValue('pathEdgeProb', '0.9');
        this.dom.setElementText('pathEdgeValue', '0.9');
        
        // Update checkbox states
        const pathOverrideNodes = document.getElementById('pathOverrideNodes');
        const pathOverrideEdges = document.getElementById('pathOverrideEdges');
        if (pathOverrideNodes) UIUtils.updateCheckboxState(pathOverrideNodes);
        if (pathOverrideEdges) UIUtils.updateCheckboxState(pathOverrideEdges);
        
        // Clear any individual diamond parameter overrides
        if (this.parameterManager) {
            this.parameterManager.clearIndividualOverrides('diamond-nodes');
            this.parameterManager.clearIndividualOverrides('diamond-edges');
        }
        
        // Hide results
        this.dom.hideElements(['pathResults']);
        
        console.log('Path parameters reset');
    }

    async runDiamondSubsetAnalysis() {
        if (!AppState.currentDiamondData) {
            alert('No diamond data available for analysis');
            return;
        }
        
        console.log('Running diamond subset analysis...');
        
        try {
            // Get request data with individual parameter support
            const fileManager = window.AppManagers?.file;
            const baseRequestData = fileManager ? fileManager.getDiamondAnalysisRequestData() : {
                overrideNodePrior: this.dom.isElementChecked('pathOverrideNodes'),
                overrideEdgeProb: this.dom.isElementChecked('pathOverrideEdges'),
                nodePrior: parseFloat(this.dom.getElementValue('pathNodePrior') || '1.0'),
                edgeProb: parseFloat(this.dom.getElementValue('pathEdgeProb') || '0.9')
            };
            
            // Prepare request data
            const requestData = {
                diamondData: AppState.currentDiamondData,
                ...baseRequestData
            };
            
            // Log parameter information for debugging
            if (requestData.useIndividualOverrides) {
                console.log('Running diamond subset analysis with individual parameter overrides:', {
                    nodeOverrides: Object.keys(requestData.individualNodePriors || {}).length,
                    edgeOverrides: Object.keys(requestData.individualEdgeProbabilities || {}).length
                });
            }
            
            // Show loading state
            this.dom.setElementDisabled('runPathAnalysis', true);
            this.dom.setElementText('runPathAnalysis', 'Analyzing...');
            
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
            this.displayPathAnalysisResults(result.results, result.summary);
            
        } catch (err) {
            console.error('Subset analysis error:', err);
            alert(`Subset analysis failed: ${err.message}`);
        } finally {
            // Reset button state
            this.dom.setElementDisabled('runPathAnalysis', false);
            this.dom.setElementText('runPathAnalysis', 'Run Analysis');
        }
    }

    displayPathAnalysisResults(results, summary) {
        if (!results || results.length === 0) {
            this.dom.setElementHTML('pathResultsTable', '<p>No results available</p>');
            this.dom.showElement('pathResults');
            return;
        }
        
        try {
            // Sort results by node ID
            results.sort((a, b) => (a.node || 0) - (b.node || 0));
            
            // Create results HTML
            const summaryHtml = summary ? `
                <div class="path-summary">
                    <h6>Analysis Summary</h6>
                    <p>Nodes: ${summary.nodes || 0}, Edges: ${summary.edges || 0}, Sources: ${summary.sources || 0}</p>
                    ${this.parameterManager && this.parameterManager.hasDiamondModifications() ? 
                        '<p class="parameter-info">🎛️ Using individual parameter overrides</p>' : ''}
                </div>
            ` : '';
            
            const resultsHtml = results.map(result => `
                <div class="path-result-item">
                    <span class="path-result-node">Node ${result.node || 'N/A'}</span>
                    <span class="path-result-prob">${(result.probability || 0).toFixed(6)}</span>
                </div>
            `).join('');
            
            this.dom.setElementHTML('pathResultsTable', summaryHtml + resultsHtml);
            this.dom.showElement('pathResults');
            
            console.log('Path analysis results displayed for', results.length, 'nodes');
            
        } catch (error) {
            console.error('Error displaying path analysis results:', error);
            this.dom.setElementHTML('pathResultsTable', '<p>Error displaying results</p>');
            this.dom.showElement('pathResults');
        }
    }

    // Utility methods
    getNodeDiamondJoinNodes(nodeId) {
        const joinNodes = [];
        if (!AppState.diamondData?.diamondStructures) return joinNodes;
        
        try {
            for (const [joinNode, structure] of Object.entries(AppState.diamondData.diamondStructures)) {
                if (structure.diamond && Array.isArray(structure.diamond)) {
                    for (const group of structure.diamond) {
                        if (group.relevant_nodes && Array.isArray(group.relevant_nodes) && 
                            group.relevant_nodes.includes(parseInt(nodeId))) {
                            joinNodes.push(parseInt(joinNode));
                            break;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error getting node diamond join nodes:', error);
        }
        
        return joinNodes;
    }

    closeModal(modalId) {
        console.log('Closing modal:', modalId);
        
        if (modalId === 'diamondPathModal') {
            this.closeDiamondPathModal();
        } else if (modalId === 'diamondDetailModal') {
            this.dom.hideElements(['diamondDetailModal']);
            // Force hide with important style
            const modal = document.getElementById('diamondDetailModal');
            if (modal) {
                modal.style.setProperty('display', 'none', 'important');
            }
        } else {
            // Generic modal close
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.style.display = 'none';
                modal.style.setProperty('display', 'none', 'important');
            }
        }
    }

    closeDiamondPathModal() {
        this.dom.hideElements(['diamondPathModal']);
        
        // Force hide with important style
        const modal = document.getElementById('diamondPathModal');
        if (modal) {
            modal.style.setProperty('display', 'none', 'important');
        }
        
        // Clean up network instance
        if (this.pathNetworkInstance) {
            try {
                this.pathNetworkInstance.destroy();
                this.pathNetworkInstance = null;
            } catch (error) {
                console.error('Error destroying path network instance:', error);
            }
        }
        
        // Clear global state
        AppState.currentDiamondData = null;
        AppState.pathNetworkInstance = null;
        
        // Update parameter manager availability
        if (this.parameterManager) {
            this.parameterManager.updateParameterEditingAvailability();
        }
        
        // Clear DOM elements
        const pathNetworkGraph = this.dom.elements.pathNetworkGraph;
        if (pathNetworkGraph) pathNetworkGraph.innerHTML = '';
        
        this.dom.hideElements(['pathResults']);
        
        console.log('Diamond path modal closed and cleaned up');
    }

    // Handle modal clicks from global event handler
    handleModalClicks(event) {
        const diamondDetailModal = this.dom.elements.diamondDetailModal;
        const diamondPathModal = this.dom.elements.diamondPathModal;
        
        if (event.target === diamondDetailModal) {
            this.closeModal('diamondDetailModal');
        }
        if (event.target === diamondPathModal) {
            this.closeModal('diamondPathModal');
        }
    }
}