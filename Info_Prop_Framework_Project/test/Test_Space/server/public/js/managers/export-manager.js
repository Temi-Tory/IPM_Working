// export-manager.js - Export functionality
import { AppState } from '../main.js';
import { UIUtils } from '../utils/ui-utils.js';

export class ExportManager {
    constructor(domManager) {
        this.dom = domManager;
    }

    initializeEventListeners() {
        this.dom.safeAddEventListener('exportResultsBtn', 'click', () => {
            this.exportResults();
        });
        
        this.dom.safeAddEventListener('exportDot', 'click', () => {
            this.exportGraphAsDot();
        });
    }

    exportResults() {
        if (!AppState.analysisResults) {
            alert('No analysis results available to export');
            return;
        }
        
        const analysisManager = window.AppManagers.analysis;
        
        const csvContent = [
            ['Node', 'Type', 'Prior', 'Calculated', 'Difference', 'Diamond Member'].join(','),
            ...AppState.analysisResults.results.map(result => {
                const prior = parseFloat(analysisManager.getNodePrior(result.node)) || 0;
                const calculated = result.probability;
                const difference = calculated - prior;
                const isDiamondMember = analysisManager.isNodeInDiamond(result.node);
                
                return [
                    result.node,
                    analysisManager.getNodeType(result.node),
                    prior.toFixed(6),
                    calculated.toFixed(6),
                    difference.toFixed(6),
                    isDiamondMember ? 'Yes' : 'No'
                ].join(',');
            })
        ].join('\n');
        
        UIUtils.downloadFile(csvContent, 'network_analysis_results.csv', 'text/csv');
        console.log('Results exported successfully');
    }

    async exportGraphAsDot() {
        if (!AppState.networkData) {
            alert('No network data available to export');
            return;
        }
        
        try {
            const requestData = {
                networkData: AppState.networkData,
                showSourceNodes: this.dom.isElementChecked('showSourceNodes'),
                showSinkNodes: this.dom.isElementChecked('showSinkNodes'),
                showForkNodes: this.dom.isElementChecked('showForkNodes'),
                showJoinNodes: this.dom.isElementChecked('showJoinNodes'),
                showIterations: this.dom.isElementChecked('showIterations'),
                showDiamonds: this.dom.isElementChecked('showDiamonds')
            };
            
            const response = await fetch('/api/export-dot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                UIUtils.downloadFile(result.dotString, 'network_graph.dot', 'text/plain');
                console.log('DOT file exported successfully');
            } else {
                throw new Error(result.error || 'Export failed');
            }
        } catch (err) {
            console.error('Export error:', err);
            alert(`Export failed: ${err.message}`);
        }
    }

    exportDiamondAnalysis() {
        if (!AppState.diamondData || !AppState.diamondData.diamondClassifications) {
            alert('No diamond analysis data available to export');
            return;
        }
        
        const csvContent = [
            [
                'Join Node', 'Fork Structure', 'Internal Structure', 'Path Topology',
                'Join Structure', 'External Connectivity', 'Degeneracy', 'Fork Count',
                'Subgraph Size', 'Internal Forks', 'Internal Joins', 'Path Count',
                'Complexity Score', 'Optimization Potential', 'Bottleneck Risk'
            ].join(','),
            ...AppState.diamondData.diamondClassifications.map(diamond => {
                return [
                    diamond.join_node,
                    `"${diamond.fork_structure}"`,
                    `"${diamond.internal_structure}"`,
                    `"${diamond.path_topology}"`,
                    `"${diamond.join_structure}"`,
                    `"${diamond.external_connectivity}"`,
                    `"${diamond.degeneracy}"`,
                    diamond.fork_count,
                    diamond.subgraph_size,
                    diamond.internal_forks,
                    diamond.internal_joins,
                    diamond.path_count,
                    diamond.complexity_score.toFixed(2),
                    `"${diamond.optimization_potential}"`,
                    `"${diamond.bottleneck_risk}"`
                ].join(',');
            })
        ].join('\n');
        
        UIUtils.downloadFile(csvContent, 'diamond_analysis.csv', 'text/csv');
        console.log('Diamond analysis exported successfully');
    }

    exportMonteCarloComparison() {
        if (!AppState.monteCarloResults) {
            alert('No Monte Carlo results available to export');
            return;
        }
        
        const csvContent = [
            ['Node', 'Algorithm Value', 'Monte Carlo Value', 'Difference'].join(','),
            ...AppState.monteCarloResults.map(result => {
                const diff = Math.abs(result.algorithmValue - result.monteCarloValue);
                return [
                    result.node,
                    result.algorithmValue.toFixed(6),
                    result.monteCarloValue.toFixed(6),
                    diff.toFixed(6)
                ].join(',');
            })
        ].join('\n');
        
        UIUtils.downloadFile(csvContent, 'monte_carlo_comparison.csv', 'text/csv');
        console.log('Monte Carlo comparison exported successfully');
    }

    exportNetworkStatistics() {
        if (!AppState.networkData) {
            alert('No network data available to export');
            return;
        }
        
        const stats = {
            totalNodes: AppState.networkData.nodes?.length || 0,
            totalEdges: AppState.networkData.edges?.length || 0,
            sourceNodes: AppState.networkData.sourceNodes?.length || 0,
            sinkNodes: AppState.networkData.sinkNodes?.length || 0,
            forkNodes: AppState.networkData.forkNodes?.length || 0,
            joinNodes: AppState.networkData.joinNodes?.length || 0,
            iterationSets: AppState.networkData.iterationSets?.length || 0,
            totalDiamonds: AppState.diamondData?.diamondClassifications?.length || 0
        };
        
        const jsonContent = JSON.stringify(stats, null, 2);
        UIUtils.downloadFile(jsonContent, 'network_statistics.json', 'application/json');
        console.log('Network statistics exported successfully');
    }

    exportFullAnalysis() {
        if (!AppState.analysisResults) {
            alert('No analysis results available to export');
            return;
        }
        
        const fullAnalysis = {
            summary: AppState.analysisResults.summary,
            results: AppState.analysisResults.results,
            networkData: AppState.networkData,
            diamondData: AppState.diamondData,
            monteCarloResults: AppState.monteCarloResults,
            originalData: {
                nodePriors: AppState.originalNodePriors,
                edgeProbabilities: AppState.originalEdgeProbabilities
            },
            exportTimestamp: new Date().toISOString()
        };
        
        const jsonContent = JSON.stringify(fullAnalysis, null, 2);
        UIUtils.downloadFile(jsonContent, 'full_network_analysis.json', 'application/json');
        console.log('Full analysis exported successfully');
    }
}