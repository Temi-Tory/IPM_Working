import { Component, inject, computed, signal, OnInit, ViewChild, ElementRef, AfterViewInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule, MatButtonToggleChange } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';

import { AnalysisStateService } from '../../shared/services/analysis-state.service';
import { DiamondAnalysisResponse, RootDiamondStructure, UniqueDiamondStructure } from '../../shared/models/network-analysis.models';

interface HierarchyNode {
  id: string;
  label: string;
  type: 'root' | 'unique' | 'conditioning' | 'join';
  level: number;
  nodeCount: number;
  pathCount: number;
  riskScore: number;
  children: HierarchyNode[];
  parent?: HierarchyNode;
  diamond: RootDiamondStructure | UniqueDiamondStructure;
  x?: number;
  y?: number;
  expanded?: boolean;
}

interface HierarchyLink {
  source: HierarchyNode;
  target: HierarchyNode;
  type: 'parent-child' | 'conditioning' | 'bridge';
  strength: number;
}

interface HierarchyStats {
  totalDiamonds: number;
  maxDepth: number;
  totalNodes: number;
  averagePathCount: number;
  complexityScore: number;
  criticalPaths: number;
}

@Component({
  selector: 'app-hierarchy-builder',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSliderModule,
    MatTooltipModule,
    MatChipsModule,
    MatExpansionModule,
    MatBadgeModule,
    MatDialogModule,
    FormsModule
  ],
  templateUrl: './hierarchy-builder.component.html',
  styleUrls: ['./hierarchy-builder.component.scss']
})
export class HierarchyBuilderComponent implements OnInit, AfterViewInit {
  @ViewChild('hierarchyCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('hierarchyContainer', { static: false }) containerRef!: ElementRef<HTMLDivElement>;

  private analysisState = inject(AnalysisStateService);
  private dialogRef = inject(MatDialogRef<HierarchyBuilderComponent>);
  private dialogData = inject<{ diamondId?: string }>(MAT_DIALOG_DATA);

  // Core data signals
  diamondAnalysis = computed(() => this.analysisState.diamondAnalysis());
  isLoading = computed(() => this.analysisState.isLoading());
  error = computed(() => this.analysisState.error());

  // Component state
  currentView = signal<'tree' | 'graph' | 'matrix' | 'timeline'>('tree');
  layoutType = signal<'vertical' | 'horizontal' | 'radial' | 'force'>('vertical');
  zoomLevel = signal<number>(1);
  selectedNode = signal<HierarchyNode | null>(null);
  hoveredNode = signal<HierarchyNode | null>(null);
  
  // Visualization settings
  showLabels = signal<boolean>(true);
  showMetrics = signal<boolean>(true);
  showConditioningNodes = signal<boolean>(true);
  animateTransitions = signal<boolean>(true);
  nodeSize = signal<number>(50);
  linkStrength = signal<number>(0.5);

  // Filter settings
  minPathCount = signal<number>(0);
  maxDepth = signal<number>(10);
  riskLevelFilter = signal<string[]>([]);

  // Canvas and rendering
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationId: number | null = null;

  ngOnInit() {
    // Initialize hierarchy data based on dialog input
    if (this.dialogData?.diamondId) {
      // Focus on specific diamond if provided
      this.focusOnDiamond(this.dialogData.diamondId);
    }
  }

  ngAfterViewInit() {
    if (this.canvasRef) {
      this.canvas = this.canvasRef.nativeElement;
      this.ctx = this.canvas.getContext('2d');
      this.setupCanvas();
      this.startRenderLoop();
    }
  }

  ngOnDestroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  // Computed hierarchy data
  hierarchyData = computed((): HierarchyNode[] => {
    const analysis = this.diamondAnalysis();
    if (!analysis) return [];

    return this.buildHierarchyTree(analysis);
  });

  // Hierarchy statistics
  hierarchyStats = computed((): HierarchyStats => {
    const nodes = this.hierarchyData();
    if (nodes.length === 0) {
      return {
        totalDiamonds: 0,
        maxDepth: 0,
        totalNodes: 0,
        averagePathCount: 0,
        complexityScore: 0,
        criticalPaths: 0
      };
    }

    const totalDiamonds = this.countAllNodes(nodes);
    const maxDepth = this.calculateMaxDepth(nodes);
    const totalNodes = nodes.reduce((sum, node) => sum + node.nodeCount, 0);
    const totalPaths = nodes.reduce((sum, node) => sum + node.pathCount, 0);
    const averagePathCount = totalDiamonds > 0 ? totalPaths / totalDiamonds : 0;
    const complexityScore = this.calculateComplexityScore(nodes);
    const criticalPaths = this.countCriticalPaths(nodes);

    return {
      totalDiamonds,
      maxDepth,
      totalNodes,
      averagePathCount,
      complexityScore,
      criticalPaths
    };
  });

  // Filtered hierarchy data
  filteredHierarchyData = computed(() => {
    const nodes = this.hierarchyData();
    const minPaths = this.minPathCount();
    const maxDepth = this.maxDepth();
    const riskFilters = this.riskLevelFilter();

    return this.filterNodes(nodes, minPaths, maxDepth, riskFilters);
  });

  // Helper methods for building hierarchy
  private buildHierarchyTree(analysis: DiamondAnalysisResponse): HierarchyNode[] {
    const rootNodes: HierarchyNode[] = [];
    const nodeMap = new Map<string, HierarchyNode>();

    // Process root diamonds
    if (analysis.diamond_analysis.raw_root_diamonds) {
      Object.entries(analysis.diamond_analysis.raw_root_diamonds).forEach(([id, diamond]) => {
        const node: HierarchyNode = {
          id,
          label: `Root Diamond ${id}`,
          type: 'root',
          level: 0,
          nodeCount: diamond.diamond.node_count,
          pathCount: this.estimatePathCount(diamond),
          riskScore: this.calculateRiskScore(diamond),
          children: [],
          diamond,
          expanded: true
        };
        
        nodeMap.set(id, node);
        rootNodes.push(node);
      });
    }

    // Process unique diamonds and establish relationships
    if (analysis.diamond_analysis.raw_unique_diamonds) {
      Object.entries(analysis.diamond_analysis.raw_unique_diamonds).forEach(([id, diamond]) => {
        const node: HierarchyNode = {
          id,
          label: `Unique Diamond ${id}`,
          type: 'unique',
          level: 1, // Will be adjusted based on actual hierarchy
          nodeCount: diamond.node_count,
          pathCount: this.estimatePathCount(diamond),
          riskScore: this.calculateRiskScore(diamond),
          children: [],
          diamond,
          expanded: false
        };
        
        nodeMap.set(id, node);
        
        // Try to establish parent-child relationships
        // This is simplified - in reality, you'd need more sophisticated logic
        if (rootNodes.length > 0) {
          const parentNode = rootNodes[0]; // Simplified assignment
          node.parent = parentNode;
          node.level = parentNode.level + 1;
          parentNode.children.push(node);
        }
      });
    }

    return rootNodes;
  }

  private estimatePathCount(diamond: RootDiamondStructure | UniqueDiamondStructure): number {
    if ('diamond' in diamond) {
      return diamond.diamond.node_count * 2; // Simplified estimation
    } else {
      return diamond.node_count * 1.5; // Simplified estimation
    }
  }

  private calculateRiskScore(diamond: RootDiamondStructure | UniqueDiamondStructure): number {
    // Simplified risk calculation based on structure
    const nodeCount = 'diamond' in diamond ? diamond.diamond.node_count : diamond.node_count;
    const conditioningCount = 'diamond' in diamond ? diamond.diamond.conditioning_nodes.length : 0;
    
    // Higher node count and conditioning nodes increase risk
    const baseRisk = Math.min(nodeCount / 100, 0.5);
    const conditioningRisk = Math.min(conditioningCount / 10, 0.3);
    
    return Math.min(baseRisk + conditioningRisk, 1.0);
  }

  private countAllNodes(nodes: HierarchyNode[]): number {
    return nodes.reduce((count, node) => {
      return count + 1 + this.countAllNodes(node.children);
    }, 0);
  }

  private calculateMaxDepth(nodes: HierarchyNode[]): number {
    if (nodes.length === 0) return 0;
    
    return Math.max(...nodes.map(node => {
      return 1 + this.calculateMaxDepth(node.children);
    }));
  }

  private calculateComplexityScore(nodes: HierarchyNode[]): number {
    const totalNodes = this.countAllNodes(nodes);
    const maxDepth = this.calculateMaxDepth(nodes);
    const avgChildren = nodes.length > 0 ? 
      nodes.reduce((sum, node) => sum + node.children.length, 0) / nodes.length : 0;
    
    return (totalNodes * 0.4) + (maxDepth * 0.3) + (avgChildren * 0.3);
  }

  private countCriticalPaths(nodes: HierarchyNode[]): number {
    return nodes.reduce((count, node) => {
      const isCritical = node.riskScore > 0.7;
      return count + (isCritical ? 1 : 0) + this.countCriticalPaths(node.children);
    }, 0);
  }

  private filterNodes(nodes: HierarchyNode[], minPaths: number, maxDepth: number, riskFilters: string[]): HierarchyNode[] {
    return nodes.filter(node => {
      // Path count filter
      if (node.pathCount < minPaths) return false;
      
      // Depth filter
      if (node.level > maxDepth) return false;
      
      // Risk level filter
      if (riskFilters.length > 0) {
        const riskLevel = this.getRiskLevel(node.riskScore);
        if (!riskFilters.includes(riskLevel)) return false;
      }
      
      return true;
    }).map(node => ({
      ...node,
      children: this.filterNodes(node.children, minPaths, maxDepth, riskFilters)
    }));
  }

  // Canvas setup and rendering
  private setupCanvas(): void {
    if (!this.canvas || !this.containerRef) return;

    const container = this.containerRef.nativeElement;
    const rect = container.getBoundingClientRect();
    
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    
    // Handle canvas interactions
    this.canvas.addEventListener('click', this.onCanvasClick.bind(this));
    this.canvas.addEventListener('mousemove', this.onCanvasMouseMove.bind(this));
    this.canvas.addEventListener('wheel', this.onCanvasWheel.bind(this));
  }

  private startRenderLoop(): void {
    const render = () => {
      this.renderHierarchy();
      this.animationId = requestAnimationFrame(render);
    };
    render();
  }

  private renderHierarchy(): void {
    if (!this.ctx || !this.canvas) return;

    const nodes = this.filteredHierarchyData();
    if (nodes.length === 0) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Calculate layout
    this.calculateLayout(nodes);

    // Render based on current view
    switch (this.currentView()) {
      case 'tree':
        this.renderTreeView(nodes);
        break;
      case 'graph':
        this.renderGraphView(nodes);
        break;
      case 'matrix':
        this.renderMatrixView(nodes);
        break;
      case 'timeline':
        this.renderTimelineView(nodes);
        break;
    }
  }

  private calculateLayout(nodes: HierarchyNode[]): void {
    const layoutType = this.layoutType();
    const canvasWidth = this.canvas?.width || 800;
    const canvasHeight = this.canvas?.height || 600;

    switch (layoutType) {
      case 'vertical':
        this.calculateVerticalLayout(nodes, canvasWidth, canvasHeight);
        break;
      case 'horizontal':
        this.calculateHorizontalLayout(nodes, canvasWidth, canvasHeight);
        break;
      case 'radial':
        this.calculateRadialLayout(nodes, canvasWidth, canvasHeight);
        break;
      case 'force':
        this.calculateForceLayout(nodes, canvasWidth, canvasHeight);
        break;
    }
  }

  private calculateVerticalLayout(nodes: HierarchyNode[], width: number, height: number): void {
    const levelHeight = height / (this.hierarchyStats().maxDepth + 1);
    
    const processLevel = (levelNodes: HierarchyNode[], level: number) => {
      const nodeWidth = width / (levelNodes.length + 1);
      
      levelNodes.forEach((node, index) => {
        node.x = nodeWidth * (index + 1);
        node.y = levelHeight * (level + 1);
        
        if (node.children.length > 0) {
          processLevel(node.children, level + 1);
        }
      });
    };
    
    processLevel(nodes, 0);
  }

  private calculateHorizontalLayout(nodes: HierarchyNode[], width: number, height: number): void {
    const levelWidth = width / (this.hierarchyStats().maxDepth + 1);
    
    const processLevel = (levelNodes: HierarchyNode[], level: number) => {
      const nodeHeight = height / (levelNodes.length + 1);
      
      levelNodes.forEach((node, index) => {
        node.x = levelWidth * (level + 1);
        node.y = nodeHeight * (index + 1);
        
        if (node.children.length > 0) {
          processLevel(node.children, level + 1);
        }
      });
    };
    
    processLevel(nodes, 0);
  }

  private calculateRadialLayout(nodes: HierarchyNode[], width: number, height: number): void {
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) / 2 - 50;
    
    const processLevel = (levelNodes: HierarchyNode[], level: number, startAngle: number, endAngle: number) => {
      const radius = (level + 1) * (maxRadius / (this.hierarchyStats().maxDepth + 1));
      const angleStep = (endAngle - startAngle) / levelNodes.length;
      
      levelNodes.forEach((node, index) => {
        const angle = startAngle + angleStep * (index + 0.5);
        node.x = centerX + radius * Math.cos(angle);
        node.y = centerY + radius * Math.sin(angle);
        
        if (node.children.length > 0) {
          const childStartAngle = startAngle + angleStep * index;
          const childEndAngle = startAngle + angleStep * (index + 1);
          processLevel(node.children, level + 1, childStartAngle, childEndAngle);
        }
      });
    };
    
    processLevel(nodes, 0, 0, 2 * Math.PI);
  }

  private calculateForceLayout(nodes: HierarchyNode[], width: number, height: number): void {
    // Simplified force-directed layout
    // In a real implementation, you'd use a proper force simulation
    nodes.forEach((node, index) => {
      node.x = Math.random() * width;
      node.y = Math.random() * height;
    });
  }

  private renderTreeView(nodes: HierarchyNode[]): void {
    if (!this.ctx) return;

    // Render connections first
    this.renderConnections(nodes);
    
    // Render nodes
    this.renderNodes(nodes);
    
    // Render labels if enabled
    if (this.showLabels()) {
      this.renderLabels(nodes);
    }
  }

  private renderGraphView(nodes: HierarchyNode[]): void {
    // Similar to tree view but with different connection styling
    this.renderTreeView(nodes);
  }

  private renderMatrixView(nodes: HierarchyNode[]): void {
    if (!this.ctx || !this.canvas) return;

    // Render adjacency matrix representation
    const allNodes = this.flattenNodes(nodes);
    const size = allNodes.length;
    const cellSize = Math.min(this.canvas.width, this.canvas.height) / size;

    allNodes.forEach((sourceNode, i) => {
      allNodes.forEach((targetNode, j) => {
        const x = j * cellSize;
        const y = i * cellSize;
        
        // Check if there's a connection
        const hasConnection = this.hasConnection(sourceNode, targetNode);
        
        this.ctx!.fillStyle = hasConnection ? 
          this.getRiskColor(sourceNode.riskScore) : 
          'rgba(200, 200, 200, 0.1)';
        this.ctx!.fillRect(x, y, cellSize - 1, cellSize - 1);
      });
    });
  }

  private renderTimelineView(nodes: HierarchyNode[]): void {
    if (!this.ctx || !this.canvas) return;

    // Render timeline based on hierarchy levels
    const maxLevel = this.hierarchyStats().maxDepth;
    const timelineWidth = this.canvas.width - 100;
    const timelineHeight = 50;
    const startY = 100;

    for (let level = 0; level <= maxLevel; level++) {
      const y = startY + level * 80;
      const levelNodes = this.getNodesAtLevel(nodes, level);
      
      // Draw timeline bar
      this.ctx.fillStyle = 'rgba(100, 100, 100, 0.2)';
      this.ctx.fillRect(50, y, timelineWidth, timelineHeight);
      
      // Draw level label
      this.ctx.fillStyle = '#333';
      this.ctx.font = '14px Arial';
      this.ctx.fillText(`Level ${level}`, 10, y + 25);
      
      // Draw nodes on timeline
      levelNodes.forEach((node, index) => {
        const x = 50 + (index + 1) * (timelineWidth / (levelNodes.length + 1));
        this.renderTimelineNode(node, x, y + timelineHeight / 2);
      });
    }
  }

  private renderConnections(nodes: HierarchyNode[]): void {
    if (!this.ctx) return;

    const renderNodeConnections = (node: HierarchyNode) => {
      node.children.forEach(child => {
        if (node.x !== undefined && node.y !== undefined && 
            child.x !== undefined && child.y !== undefined) {
          
          this.ctx!.strokeStyle = this.getConnectionColor(node, child);
          this.ctx!.lineWidth = this.getConnectionWidth(node, child);
          this.ctx!.beginPath();
          this.ctx!.moveTo(node.x, node.y);
          this.ctx!.lineTo(child.x, child.y);
          this.ctx!.stroke();
        }
        
        renderNodeConnections(child);
      });
    };

    nodes.forEach(renderNodeConnections);
  }

  private renderNodes(nodes: HierarchyNode[]): void {
    if (!this.ctx) return;

    const renderNode = (node: HierarchyNode) => {
      if (node.x === undefined || node.y === undefined) return;

      const size = this.nodeSize() * this.zoomLevel();
      const isSelected = this.selectedNode() === node;
      const isHovered = this.hoveredNode() === node;

      // Node background
      this.ctx!.fillStyle = this.getNodeColor(node);
      this.ctx!.beginPath();
      this.ctx!.arc(node.x, node.y, size / 2, 0, 2 * Math.PI);
      this.ctx!.fill();

      // Node border
      if (isSelected || isHovered) {
        this.ctx!.strokeStyle = isSelected ? '#007bff' : '#666';
        this.ctx!.lineWidth = isSelected ? 3 : 2;
        this.ctx!.stroke();
      }

      // Node icon
      this.renderNodeIcon(node, node.x, node.y, size);

      // Render children
      node.children.forEach(renderNode);
    };

    nodes.forEach(renderNode);
  }

  private renderLabels(nodes: HierarchyNode[]): void {
    if (!this.ctx) return;

    const renderNodeLabel = (node: HierarchyNode) => {
      if (node.x === undefined || node.y === undefined) return;

      const size = this.nodeSize() * this.zoomLevel();
      
      this.ctx!.fillStyle = '#333';
      this.ctx!.font = `${12 * this.zoomLevel()}px Arial`;
      this.ctx!.textAlign = 'center';
      this.ctx!.fillText(node.label, node.x, node.y + size / 2 + 15);

      if (this.showMetrics()) {
        this.ctx!.font = `${10 * this.zoomLevel()}px Arial`;
        this.ctx!.fillStyle = '#666';
        this.ctx!.fillText(
          `Nodes: ${node.nodeCount} | Paths: ${node.pathCount}`,
          node.x,
          node.y + size / 2 + 30
        );
      }

      node.children.forEach(renderNodeLabel);
    };

    nodes.forEach(renderNodeLabel);
  }

  private renderNodeIcon(node: HierarchyNode, x: number, y: number, size: number): void {
    if (!this.ctx) return;

    this.ctx.fillStyle = 'white';
    this.ctx.font = `${size / 3}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    const icon = this.getNodeIcon(node.type);
    this.ctx.fillText(icon, x, y);
  }

  private renderTimelineNode(node: HierarchyNode, x: number, y: number): void {
    if (!this.ctx) return;

    const size = 20;
    
    this.ctx.fillStyle = this.getNodeColor(node);
    this.ctx.beginPath();
    this.ctx.arc(x, y, size / 2, 0, 2 * Math.PI);
    this.ctx.fill();

    this.ctx.fillStyle = 'white';
    this.ctx.font = '10px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(this.getNodeIcon(node.type), x, y);
  }

  // Helper methods for rendering
  private getNodeColor(node: HierarchyNode): string {
    return this.getRiskColor(node.riskScore);
  }

  private getRiskColor(riskScore: number): string {
    if (riskScore >= 0.8) return '#dc3545'; // Critical - Red
    if (riskScore >= 0.6) return '#fd7e14'; // High - Orange
    if (riskScore >= 0.4) return '#ffc107'; // Medium - Yellow
    return '#28a745'; // Low - Green
  }

  private getConnectionColor(source: HierarchyNode, target: HierarchyNode): string {
    const avgRisk = (source.riskScore + target.riskScore) / 2;
    return this.getRiskColor(avgRisk);
  }

  private getConnectionWidth(source: HierarchyNode, target: HierarchyNode): number {
    const strength = Math.min(source.pathCount, target.pathCount) / 1000;
    return Math.max(1, Math.min(5, strength * 10));
  }

  private getNodeIcon(type: string): string {
    switch (type) {
      case 'root': return '◆';
      case 'unique': return '◇';
      case 'conditioning': return '●';
      case 'join': return '▲';
      default: return '○';
    }
  }

  getRiskLevel(riskScore: number): string {
    if (riskScore >= 0.8) return 'critical';
    if (riskScore >= 0.6) return 'high';
    if (riskScore >= 0.4) return 'medium';
    return 'low';
  }

  // Expose Math for template use
  Math = Math;

  // Utility methods
  private flattenNodes(nodes: HierarchyNode[]): HierarchyNode[] {
    const result: HierarchyNode[] = [];
    
    const flatten = (nodeList: HierarchyNode[]) => {
      nodeList.forEach(node => {
        result.push(node);
        flatten(node.children);
      });
    };
    
    flatten(nodes);
    return result;
  }

  private hasConnection(source: HierarchyNode, target: HierarchyNode): boolean {
    return source.children.includes(target) || target.children.includes(source);
  }

  private getNodesAtLevel(nodes: HierarchyNode[], targetLevel: number): HierarchyNode[] {
    const result: HierarchyNode[] = [];
    
    const collectAtLevel = (nodeList: HierarchyNode[], currentLevel: number) => {
      nodeList.forEach(node => {
        if (currentLevel === targetLevel) {
          result.push(node);
        }
        collectAtLevel(node.children, currentLevel + 1);
      });
    };
    
    collectAtLevel(nodes, 0);
    return result;
  }

  // Event handlers
  private onCanvasClick(event: MouseEvent): void {
    const rect = this.canvas?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const clickedNode = this.findNodeAtPosition(x, y);
    this.selectedNode.set(clickedNode);
  }

  private onCanvasMouseMove(event: MouseEvent): void {
    const rect = this.canvas?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const hoveredNode = this.findNodeAtPosition(x, y);
    this.hoveredNode.set(hoveredNode);
  }

  private onCanvasWheel(event: WheelEvent): void {
    event.preventDefault();
    
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(3, this.zoomLevel() * zoomFactor));
    this.zoomLevel.set(newZoom);
  }

  private findNodeAtPosition(x: number, y: number): HierarchyNode | null {
    const nodes = this.flattenNodes(this.filteredHierarchyData());
    const size = this.nodeSize() * this.zoomLevel();

    for (const node of nodes) {
      if (node.x !== undefined && node.y !== undefined) {
        const distance = Math.sqrt(
          Math.pow(x - node.x, 2) + Math.pow(y - node.y, 2)
        );
        
        if (distance <= size / 2) {
          return node;
        }
      }
    }

    return null;
  }

  // Component event handlers
  switchView(event: MatButtonToggleChange): void {
    this.currentView.set(event.value as 'tree' | 'graph' | 'matrix' | 'timeline');
  }

  switchLayout(event: MatButtonToggleChange): void {
    this.layoutType.set(event.value as 'vertical' | 'horizontal' | 'radial' | 'force');
  }

  onZoomChange(event: any): void {
    const value = event.target ? parseFloat(event.target.value) : event.value;
    this.zoomLevel.set(value);
  }

  onNodeSizeChange(event: any): void {
    const value = event.target ? parseInt(event.target.value) : event.value;
    this.nodeSize.set(value);
  }

  onLinkStrengthChange(event: any): void {
    const value = event.target ? parseFloat(event.target.value) : event.value;
    this.linkStrength.set(value);
  }

  onMinPathCountChange(event: any): void {
    const value = event.target ? parseInt(event.target.value) : event.value;
    this.minPathCount.set(value);
  }

  onMaxDepthChange(event: any): void {
    const value = event.target ? parseInt(event.target.value) : event.value;
    this.maxDepth.set(value);
  }

  toggleLabels(): void {
    this.showLabels.set(!this.showLabels());
  }

  toggleMetrics(): void {
    this.showMetrics.set(!this.showMetrics());
  }

  toggleConditioningNodes(): void {
    this.showConditioningNodes.set(!this.showConditioningNodes());
  }

  toggleAnimations(): void {
    this.animateTransitions.set(!this.animateTransitions());
  }

  resetView(): void {
    this.zoomLevel.set(1);
    this.selectedNode.set(null);
    this.hoveredNode.set(null);
  }

  exportHierarchy(): void {
    const hierarchyData = {
      nodes: this.filteredHierarchyData(),
      stats: this.hierarchyStats(),
      settings: {
        view: this.currentView(),
        layout: this.layoutType(),
        zoom: this.zoomLevel()
      }
    };

    const dataStr = JSON.stringify(hierarchyData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'diamond-hierarchy.json';
    link.click();
    
    URL.revokeObjectURL(url);
  }

  retryAnalysis(): void {
    // Reload the current analysis
    console.log('Retrying hierarchy analysis...');
  }

  // Dialog-specific methods
  focusOnDiamond(diamondId: string): void {
    // Find and highlight the specific diamond in the hierarchy
    const hierarchyData = this.filteredHierarchyData();
    const targetNode = this.findNodeById(hierarchyData, diamondId);
    
    if (targetNode) {
      this.selectedNode.set(targetNode);
      // Center the view on the selected node
      this.centerViewOnNode(targetNode);
    }
  }

  closeDialog(): void {
    this.dialogRef.close();
  }

  private findNodeById(nodes: HierarchyNode[], id: string): HierarchyNode | null {
    for (const node of nodes) {
      if (node.id === id) {
        return node;
      }
      const found = this.findNodeById(node.children, id);
      if (found) {
        return found;
      }
    }
    return null;
  }

  private centerViewOnNode(node: HierarchyNode): void {
    if (node.x !== undefined && node.y !== undefined && this.canvas) {
      // Calculate zoom and pan to center on the node
      const canvasRect = this.canvas.getBoundingClientRect();
      const centerX = canvasRect.width / 2;
      const centerY = canvasRect.height / 2;
      
      // Simple centering - could be enhanced with smooth animation
      this.zoomLevel.set(1.5);
    }
  }
}