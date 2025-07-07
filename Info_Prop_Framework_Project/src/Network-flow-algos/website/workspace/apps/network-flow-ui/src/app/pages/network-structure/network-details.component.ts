import { CommonModule } from '@angular/common';
import { Component, inject, signal, computed, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import {
  GlobalStateService,
  NetworkAnalysisService,
  NetworkGraph,
  NetworkNode,
  NetworkEdge
} from '../../../../../../libs/network-core/src';

// Sigma.js and Graphology types
declare global {
  interface Window {
    Sigma: any;
    Graph: any;
    graphology: any;
  }
}

@Component({
  selector: 'app-network-details',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './network-details.component.html',
  styleUrl: './network-details.component.scss'
})
export class NetworkDetailsComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('sigmaContainer', { static: false }) sigmaContainer!: ElementRef<HTMLDivElement>;

  private readonly globalState = inject(GlobalStateService);
  private readonly networkService = inject(NetworkAnalysisService);
  private readonly router = inject(Router);

  // Sigma.js instance
  private sigmaInstance: any = null;
  private graphInstance: any = null;

  // Component state
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedNode = signal<NetworkNode | null>(null);
  readonly selectedEdge = signal<NetworkEdge | null>(null);
  readonly showNodeDetails = signal(false);
  readonly showEdgeDetails = signal(false);

  // Global state signals
  readonly networkGraph = this.globalState.networkGraph;
  readonly sessionId = this.globalState.sessionId;
  readonly hasSession = this.globalState.hasSession;
  readonly networkSummary = this.globalState.networkSummary;

  // Computed properties
  readonly hasNetworkData = computed(() => this.networkGraph() !== null);
  readonly nodeCount = computed(() => this.networkGraph()?.nodes.length || 0);
  readonly edgeCount = computed(() => this.networkGraph()?.edges.length || 0);
  readonly isDirected = computed(() => this.networkGraph()?.directed || false);
  readonly networkDensity = computed(() => {
    const nodes = this.nodeCount();
    const edges = this.edgeCount();
    if (nodes <= 1) return 0;
    const maxEdges = this.isDirected() ? nodes * (nodes - 1) : (nodes * (nodes - 1)) / 2;
    return (edges / maxEdges) * 100;
  });

  readonly networkStats = computed(() => {
    const graph = this.networkGraph();
    if (!graph) return null;

    // Calculate degree statistics
    const inDegrees = new Map<string, number>();
    const outDegrees = new Map<string, number>();
    
    // Initialize degrees
    graph.nodes.forEach(node => {
      inDegrees.set(node.id, 0);
      outDegrees.set(node.id, 0);
    });

    // Count degrees
    graph.edges.forEach(edge => {
      outDegrees.set(edge.source, (outDegrees.get(edge.source) || 0) + 1);
      inDegrees.set(edge.target, (inDegrees.get(edge.target) || 0) + 1);
    });

    const inDegreeValues = Array.from(inDegrees.values());
    const outDegreeValues = Array.from(outDegrees.values());

    return {
      avgInDegree: inDegreeValues.reduce((a, b) => a + b, 0) / inDegreeValues.length,
      avgOutDegree: outDegreeValues.reduce((a, b) => a + b, 0) / outDegreeValues.length,
      maxInDegree: Math.max(...inDegreeValues),
      maxOutDegree: Math.max(...outDegreeValues),
      minInDegree: Math.min(...inDegreeValues),
      minOutDegree: Math.min(...outDegreeValues)
    };
  });

  ngOnInit(): void {
    // Load network data if we have a session but no graph data
    if (this.hasSession() && !this.hasNetworkData()) {
      this.loadNetworkStructure();
    }
  }

  ngAfterViewInit(): void {
    // Initialize Sigma.js visualization after view is ready
    if (this.hasNetworkData()) {
      setTimeout(() => this.initializeVisualization(), 100);
    }
  }

  ngOnDestroy(): void {
    this.destroyVisualization();
  }

  // Network data loading
  async loadNetworkStructure(): Promise<void> {
    const sessionId = this.sessionId();
    if (!sessionId) {
      this.error.set('No active session found');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      await this.networkService.getNetworkStructure(sessionId).toPromise();
      // Data is automatically stored in global state by the service
      setTimeout(() => this.initializeVisualization(), 100);
    } catch (error) {
      this.error.set(`Failed to load network structure: ${error}`);
    } finally {
      this.isLoading.set(false);
    }
  }

  // Sigma.js visualization methods
  private initializeVisualization(): void {
    if (!this.sigmaContainer?.nativeElement || !this.hasNetworkData()) return;

    try {
      this.destroyVisualization();

      // Check if Sigma is available
      console.log('🔍 Checking library availability:', {
        windowDefined: typeof window !== 'undefined',
        Sigma: typeof window.Sigma,
        Graph: typeof window.Graph,
        graphology: typeof window.graphology
      });

      if (typeof window !== 'undefined' && window.Sigma && (window.Graph || window.graphology)) {
        console.log('✅ Libraries already loaded, creating visualization');
        this.createSigmaVisualization();
      } else {
        console.log('📦 Loading libraries dynamically...');
        // Load Sigma.js dynamically
        this.loadSigmaJS().then(() => {
          console.log('✅ Libraries loaded successfully, creating visualization');
          this.createSigmaVisualization();
        }).catch(error => {
          console.error('❌ Failed to load Sigma.js:', error);
          this.error.set('Failed to load visualization library');
        });
      }
    } catch (error) {
      console.error('Failed to initialize visualization:', error);
      this.error.set('Failed to initialize network visualization');
    }
  }

  private async loadSigmaJS(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Load Graphology first (required for Sigma.js v2.x)
      const graphologyScript = document.createElement('script');
      graphologyScript.src = 'https://unpkg.com/graphology@0.25.1/dist/graphology.umd.min.js';
      graphologyScript.onload = () => {
        console.log('✅ Graphology loaded successfully');
        console.log('Available on window:', {
          graphology: typeof window.graphology,
          Graph: typeof (window as any).graphology?.Graph
        });
        
        // Load Sigma.js after Graphology
        const sigmaScript = document.createElement('script');
        sigmaScript.src = 'https://unpkg.com/sigma@2.4.0/build/sigma.min.js';
        sigmaScript.onload = () => {
          console.log('✅ Sigma.js loaded successfully');
          console.log('Available on window:', {
            Sigma: typeof window.Sigma,
            Graph: typeof window.Graph
          });
          resolve();
        };
        sigmaScript.onerror = () => reject(new Error('Failed to load Sigma.js'));
        document.head.appendChild(sigmaScript);
      };
      graphologyScript.onerror = () => reject(new Error('Failed to load Graphology'));
      document.head.appendChild(graphologyScript);
    });
  }

  private createSigmaVisualization(): void {
    const networkData = this.networkGraph();
    if (!networkData || !this.sigmaContainer?.nativeElement) return;

    console.log('🔍 Creating Sigma visualization...');
    console.log('Available globals:', {
      Sigma: typeof window.Sigma,
      Graph: typeof window.Graph,
      graphology: typeof window.graphology,
      graphologyGraph: typeof (window as any).graphology?.Graph
    });

    // Create graph instance using correct API
    try {
      if (window.graphology && (window as any).graphology.Graph) {
        console.log('✅ Using Graphology.Graph constructor');
        this.graphInstance = new (window as any).graphology.Graph();
      } else if (window.Graph) {
        console.log('⚠️ Falling back to window.Graph constructor');
        this.graphInstance = new window.Graph();
      } else {
        throw new Error('No Graph constructor available');
      }
    } catch (error) {
      console.error('❌ Failed to create graph instance:', error);
      throw error;
    }

    // Add nodes
    networkData.nodes.forEach(node => {
      this.graphInstance.addNode(node.id, {
        label: node.label || node.id,
        x: node.x || Math.random() * 100,
        y: node.y || Math.random() * 100,
        size: 10,
        color: this.getNodeColor(node)
      });
    });

    // Add edges - using correct Graphology API
    networkData.edges.forEach(edge => {
      try {
        this.graphInstance.addEdge(edge.source, edge.target, {
          key: edge.id,  // Edge ID goes in attributes for Graphology
          size: edge.weight ? Math.max(1, edge.weight * 5) : 2,
          color: this.getEdgeColor(edge),
          weight: edge.weight || 1
        });
      } catch (error) {
        console.warn(`Failed to add edge ${edge.id}:`, error);
      }
    });

    // Create Sigma instance
    this.sigmaInstance = new window.Sigma(this.graphInstance, this.sigmaContainer.nativeElement, {
      renderLabels: true,
      renderEdgeLabels: false,
      defaultNodeColor: '#3b82f6',
      defaultEdgeColor: '#9ca3af',
      labelFont: 'Arial',
      labelSize: 12,
      labelWeight: 'normal',
      zoomToSizeRatioFunction: (x: number) => x,
      minCameraRatio: 0.1,
      maxCameraRatio: 10
    });

    // Add event listeners
    this.sigmaInstance.on('clickNode', (event: any) => {
      const nodeId = event.node;
      const node = networkData.nodes.find(n => n.id === nodeId);
      if (node) {
        this.selectedNode.set(node);
        this.showNodeDetails.set(true);
        this.showEdgeDetails.set(false);
      }
    });

    this.sigmaInstance.on('clickEdge', (event: any) => {
      const edgeId = event.edge;
      const edge = networkData.edges.find(e => e.id === edgeId);
      if (edge) {
        this.selectedEdge.set(edge);
        this.showEdgeDetails.set(true);
        this.showNodeDetails.set(false);
      }
    });

    this.sigmaInstance.on('clickStage', () => {
      this.selectedNode.set(null);
      this.selectedEdge.set(null);
      this.showNodeDetails.set(false);
      this.showEdgeDetails.set(false);
    });

    // Auto-layout if nodes don't have positions
    if (networkData.nodes.every(n => !n.x || !n.y)) {
      this.applyForceLayout();
    }
  }

  private destroyVisualization(): void {
    try {
      if (this.sigmaInstance) {
        console.log('🧹 Destroying Sigma instance');
        this.sigmaInstance.kill();
        this.sigmaInstance = null;
      }
      if (this.graphInstance) {
        console.log('🧹 Clearing graph instance');
        this.graphInstance.clear();
        this.graphInstance = null;
      }
    } catch (error) {
      console.warn('Error during visualization cleanup:', error);
      // Force cleanup even if there are errors
      this.sigmaInstance = null;
      this.graphInstance = null;
    }
  }

  private getNodeColor(node: NetworkNode): string {
    // Color nodes based on degree or other properties
    return node.metadata?.['color'] || '#3b82f6';
  }

  private getEdgeColor(edge: NetworkEdge): string {
    // Color edges based on weight or probability
    if (edge.probability) {
      const intensity = Math.floor(edge.probability * 255);
      return `rgb(${255 - intensity}, ${intensity}, 100)`;
    }
    return edge.metadata?.['color'] || '#9ca3af';
  }

  private applyForceLayout(): void {
    // Simple force-directed layout
    const nodes = this.networkGraph()?.nodes || [];
    const edges = this.networkGraph()?.edges || [];
    
    // Initialize positions randomly
    nodes.forEach(node => {
      if (!this.graphInstance) return;
      this.graphInstance.setNodeAttribute(node.id, 'x', Math.random() * 100);
      this.graphInstance.setNodeAttribute(node.id, 'y', Math.random() * 100);
    });

    // Simple spring layout simulation
    for (let i = 0; i < 100; i++) {
      this.simulateForces(nodes, edges);
    }

    if (this.sigmaInstance) {
      this.sigmaInstance.refresh();
    }
  }

  private simulateForces(nodes: NetworkNode[], edges: NetworkEdge[]): void {
    if (!this.graphInstance) return;

    const forces = new Map<string, { x: number; y: number }>();
    
    // Initialize forces
    nodes.forEach(node => {
      forces.set(node.id, { x: 0, y: 0 });
    });

    // Repulsive forces between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];
        
        try {
          const x1 = this.graphInstance.getNodeAttribute(node1.id, 'x') || 0;
          const y1 = this.graphInstance.getNodeAttribute(node1.id, 'y') || 0;
          const x2 = this.graphInstance.getNodeAttribute(node2.id, 'x') || 0;
          const y2 = this.graphInstance.getNodeAttribute(node2.id, 'y') || 0;
          
          const dx = x2 - x1;
          const dy = y2 - y1;
          const distance = Math.sqrt(dx * dx + dy * dy) || 0.1;
          
          const force = 10 / (distance * distance);
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          
          const force1 = forces.get(node1.id)!;
          const force2 = forces.get(node2.id)!;
          
          force1.x -= fx;
          force1.y -= fy;
          force2.x += fx;
          force2.y += fy;
        } catch (error) {
          console.warn(`Error calculating forces for nodes ${node1.id}, ${node2.id}:`, error);
        }
      }
    }

    // Attractive forces for connected nodes
    edges.forEach(edge => {
      try {
        const x1 = this.graphInstance.getNodeAttribute(edge.source, 'x') || 0;
        const y1 = this.graphInstance.getNodeAttribute(edge.source, 'y') || 0;
        const x2 = this.graphInstance.getNodeAttribute(edge.target, 'x') || 0;
        const y2 = this.graphInstance.getNodeAttribute(edge.target, 'y') || 0;
        
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy) || 0.1;
        
        const force = distance * 0.01;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        
        const force1 = forces.get(edge.source)!;
        const force2 = forces.get(edge.target)!;
        
        if (force1 && force2) {
          force1.x += fx;
          force1.y += fy;
          force2.x -= fx;
          force2.y -= fy;
        }
      } catch (error) {
        console.warn(`Error calculating forces for edge ${edge.id}:`, error);
      }
    });

    // Apply forces
    nodes.forEach(node => {
      try {
        const force = forces.get(node.id)!;
        const currentX = this.graphInstance.getNodeAttribute(node.id, 'x') || 0;
        const currentY = this.graphInstance.getNodeAttribute(node.id, 'y') || 0;
        
        this.graphInstance.setNodeAttribute(node.id, 'x', currentX + force.x * 0.1);
        this.graphInstance.setNodeAttribute(node.id, 'y', currentY + force.y * 0.1);
      } catch (error) {
        console.warn(`Error applying forces to node ${node.id}:`, error);
      }
    });
  }

  // Navigation methods
  proceedToAnalysis(): void {
    this.globalState.markStepCompleted('network-structure');
    this.router.navigate(['/diamond-analysis']);
  }

  // Utility methods
  formatNumber(value: number): string {
    return value.toFixed(2);
  }

  formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  closeDetails(): void {
    this.selectedNode.set(null);
    this.selectedEdge.set(null);
    this.showNodeDetails.set(false);
    this.showEdgeDetails.set(false);
  }

  refreshVisualization(): void {
    this.initializeVisualization();
  }

  exportNetworkData(): void {
    const networkData = this.networkGraph();
    if (!networkData) return;

    const dataStr = JSON.stringify(networkData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `network-structure-${Date.now()}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
  }
}