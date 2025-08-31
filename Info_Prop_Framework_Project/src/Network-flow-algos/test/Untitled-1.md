I'll help you with detailed research on using Angular with D3 for Directed Acyclic Graphs. Let me start by examining the resources you've provided and then conduct comprehensive research on this specific combination.# Comprehensive Research: Using Angular with D3 for Directed Acyclic Graphs

Based on detailed analysis of the provided resources and comprehensive research, here's an in-depth guide on implementing Directed Acyclic Graphs (DAGs) using Angular and D3.

## **Executive Summary**
D3.js stands as a powerful tool for creating dynamic and interactive data visualizations on the web. When combined with Angular, a popular framework for building single-page applications, D3.js becomes even more versatile, enabling seamless integration of data visualization components into Angular applications. For DAG visualizations specifically, d3-dag (Directed Acyclic Graph) exists. This module implements a data structure for manipulating DAGs and provides multiple layout algorithms optimized for different use cases.

## **Understanding D3-DAG for Angular Applications**

### **Core Library Overview**
d3-dag (Directed Acyclic Graph) exists. This module implements a data structure for manipulating DAGs. Old versions were designed to mimic d3-hierarchy's api as much as possible, newer versions have opted to use modern javascript conventions.

**Key Layout Algorithms Available:**
1. **Sugiyama Layout** - The sugiyama method is a way to render DAGs by assigning each node a layer, shuffling the layers to minimize edge crossings, and then aligning nodes within a layer to produce a pleasing DAG layout. This algorithm is the primary method to lay out DAGs in d3-dag.
2. **Zherebko Layout** - A linear topological layout
3. **Grid Layout** - A grid-based topological layout

### **Installation and Setup**
```bash
# Install D3 and d3-dag
npm install d3 d3-dag
npm install @types/d3 --save-dev

# Or use in HTML
<script src="https://unpkg.com/d3-dag@1.1.0"></script>
```

## **Angular Integration Strategies**

### **1. Component-Based Architecture**
Angular's component-based architecture makes it easy to encapsulate D3.js visualizations within Angular components. Create Angular components to encapsulate individual visualizations, providing a clean and modular structure to your application.

### **2. Lifecycle Hook Management**
**Critical Lifecycle Hooks for D3-DAG Integration:**

- **ngAfterViewInit**: A lifecycle hook that is called after Angular has fully initialized a component's view. Define an ngAfterViewInit() method to handle any additional initialization tasks. This is where D3 DOM manipulation should begin.
- **ngOnDestroy**: This lifecycle hook that is called when a directive, pipe, or service is destroyed. Use this for any custom cleanup that needs to occur when the instance is destroyed.

### **3. Proper Component Structure**
```typescript
import { Component, ElementRef, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import * as d3 from 'd3';
import * as d3dag from 'd3-dag';

@Component({
  selector: 'app-dag-component',
  template: '<div class="dag-container"></div>',
  styleUrls: ['./dag.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class DagComponent implements OnInit, AfterViewInit, OnDestroy {
  private svg: any;
  private dag: any;

  constructor(private elementRef: ElementRef) {}

  ngOnInit(): void {
    this.prepareData();
  }

  ngAfterViewInit(): void {
    this.createDAG();
  }

  ngOnDestroy(): void {
    // Clean up D3 elements
    if (this.svg) {
      this.svg.selectAll('*').remove();
    }
  }
}
```

## **Implementation Approaches**

### **Approach 1: Using d3-dag Library**
Based on the Stack Overflow solution found in the research, the correct approach is to create the dagConnector first, then modify it:

```typescript
// Correct d3-dag implementation
prepareData() {
  const linkPairs = [
    {source: "1", target: "3"},
    {source: "2", target: "3"},
    {source: "3", target: "4"},
    {source: "4", target: "5"}
  ];

  const dagConnect = d3dag.dagConnect()
    .sourceAccessor(l => l.source)
    .targetAccessor(l => l.target);
  
  this.dag = dagConnect(linkPairs);
}

createDAG() {
  const nodeRadius = 20;
  const layout = d3dag.sugiyama()
    .nodeSize((node) => [
      (node ? 3.6 : 0.25) * nodeRadius, 
      3 * nodeRadius
    ]);

  const { width, height } = layout(this.dag);

  this.svg = d3.select(this.elementRef.nativeElement)
    .select('.dag-container')
    .append('svg')
    .attr('viewBox', [0, 0, width, height].join(' '));

  this.renderNodes();
  this.renderEdges();
}
```

### **Approach 2: Angular-Specific DAG Libraries**

**@ngneat/dag**: @ngneat/dag is designed to assist in creating and managing a directed acycylic graph model in an Angular application. You can think of a DAG as a workflow where a user adds steps and based on given criteria continues on to the next step or steps.

```typescript
// Using @ngneat/dag
@Component({
  selector: 'app-workflow-builder',
  providers: [DagManagerService] // Important: Component-level provider
})
export class WorkflowBuilderComponent implements OnInit {
  constructor(private dagManager: DagManagerService<WorkflowItem>) {}

  ngOnInit() {
    const nextItemNumber = this.getMaxItemNumber(this.startingItems);
    this.dagManager.setNextNumber(nextItemNumber);
  }
}
```

**@swimlane/ngx-charts-dag**: A Directec Acyclic Graph visualization for angular! though this package appears to be outdated (8 years old).

### **Approach 3: Custom D3 Integration with Sugiyama Algorithm**

The sugiyama layout can be configured with different algorithms for each stage of the layout. For each stage there should be adequate choices for methods that balance speed and quality:

```typescript
createSugiyamaLayout() {
  const layout = d3dag.sugiyama()
    .decross(d3dag.decrossOpt()) // minimize crossings
    .coord(d3dag.coordSimplex()) // coordinate assignment
    .nodeSize((node) => [nodeWidth, nodeHeight]);

  layout(this.dag);
  
  // Render nodes
  this.svg.selectAll('circle')
    .data(this.dag.nodes())
    .enter()
    .append('circle')
    .attr('cx', d => d.x)
    .attr('cy', d => d.y)
    .attr('r', nodeRadius);

  // Render edges with curved paths
  const line = d3.line()
    .curve(d3.curveCatmullRom)
    .x(d => d.x)
    .y(d => d.y);

  this.svg.selectAll('path')
    .data(this.dag.links())
    .enter()
    .append('path')
    .attr('d', ({points}) => line(points));
}
```

## **Best Practices and Key Considerations**

### **1. Component Lifecycle Management**
Use Angular's lifecycle hooks such as ngOnInit and ngOnDestroy to initialize and clean up D3.js components.

**Critical Points:**
- Initialize D3 visualization in `ngAfterViewInit`, not `ngOnInit`
- Be careful not to set any variables bound to the template here. If you do, you'll receive the "Expression has changed after it was checked" error.
- Always clean up in `ngOnDestroy` to prevent memory leaks

### **2. Data Binding and Updates**
Leverage D3.js's powerful data binding and update patterns to efficiently manage data within your Angular application. Use Angular's data binding syntax to bind data between Angular components and D3.js visualizations seamlessly.

### **3. ViewEncapsulation Handling**
```typescript
@Component({
  encapsulation: ViewEncapsulation.None // Important for D3 CSS styling
})
```
Stops Angular from renaming class names in the CSS. D3 generates it's own HTML which Angular doesn't know about, so there is a mismatch between class names

### **4. Performance Optimization**
- This project started years ago with the intention of providing a rough framework for implementing or extending a sugiyama-style layout for small to medium sized static DAGs.
- Consider alternatives for large graphs: sigma - a graph layout library specifically targeted at large graphs.

## **Alternative Solutions**

### **1. Other JavaScript DAG Libraries**
dagre, a JS library for DAG graphs. If you want to use d3 for whatever reason, have a look at dagre-d3

### **2. ELK.js**
Elkjs supports layered graph layout and appears to still be actively maintained at this time.

### **3. React Flow (for comparison)**
react flow - an interactive flow chart react library. This focuses more interaction than layout, and has many more included features

## **Common Pitfalls and Solutions**

### **Problem 1: "No roots" Error**
Error: Uncaught (in promise): Error: no roots
**Solution**: Ensure your data structure has proper root nodes and the DAG is properly formed.

### **Problem 2: Incorrect dagConnect Usage**
**Wrong**: `d3dag.dagConnect(this.linkPairs)`
**Correct**: 
```typescript
const dagConnect = d3dag.dagConnect()
  .sourceAccessor(l => l.source)
  .targetAccessor(l => l.target);
const dag = dagConnect(this.linkPairs);
```

### **Problem 3: ViewEncapsulation Issues**
D3 generates it's own HTML which Angular doesn't know about, so there is a mismatch between class names
**Solution**: Use `ViewEncapsulation.None` or properly scope CSS selectors.

## **Complete Implementation Example**## **Recommendations and Next Steps**

### **1. Choose the Right Approach**
- **For simple DAG visualization**: Use pure D3 + d3-dag library
- **For complex workflow management**: Consider @ngneat/dag for data management + D3 for visualization
- **For large-scale graphs**: sigma - a graph layout library specifically targeted at large graphs

### **2. Performance Considerations**
- This project started years ago with the intention of providing a rough framework for implementing or extending a sugiyama-style layout for small to medium sized static DAGs.
- **Memory Management**: Always implement `ngOnDestroy` with proper cleanup
- **Change Detection**: Use `OnPush` change detection strategy for better performance
- **Lazy Loading**: Consider lazy loading for DAG components in large applications

### **3. Testing Strategy**
```typescript
// Unit testing considerations
describe('DagComponent', () => {
  it('should create DAG from valid data', () => {
    // Test DAG creation
  });
  
  it('should handle invalid data gracefully', () => {
    // Test error handling
  });
  
  it('should clean up resources on destroy', () => {
    // Test ngOnDestroy cleanup
  });
});
```

### **4. Accessibility Considerations**
- Add ARIA labels for screen readers
- Ensure keyboard navigation support
- Provide alternative text descriptions for complex graphs
- Use sufficient color contrast for nodes and edges

## **Conclusion**

This comprehensive research reveals that implementing DAGs in Angular with D3 requires careful consideration of several factors:

**Key Takeaways:**
1. **d3-dag library** provides the most robust solution for DAG layouts in JavaScript
2. **Proper Angular lifecycle management** is crucial for memory efficiency and performance
3. **Multiple layout algorithms** (Sugiyama, Zherebko, Grid) offer flexibility for different use cases
4. **Component encapsulation** enables reusable and maintainable DAG components
5. **Error handling and validation** are essential for production applications

The provided implementation examples demonstrate both basic and advanced usage patterns, offering a solid foundation for building production-ready DAG visualizations in Angular applications. The combination of Angular's component architecture with D3's powerful visualization capabilities, enhanced by the d3-dag library's specialized algorithms, creates a robust solution for complex data visualization requirements.

For teams starting new projects, I recommend beginning with the basic d3-dag approach and evolving toward more sophisticated solutions as requirements grow. The modular nature of the provided examples allows for incremental complexity increases while maintaining clean, maintainable code.



// app.module.ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';

import { AppComponent } from './app.component';
import { DagComponent } from './components/dag/dag.component';

@NgModule({
  declarations: [
    AppComponent,
    DagComponent
  ],
  imports: [
    BrowserModule,
    CommonModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }

// -------------------
// package.json dependencies
// -------------------
/*
{
  "dependencies": {
    "@angular/animations": "^17.0.0",
    "@angular/common": "^17.0.0",
    "@angular/compiler": "^17.0.0",
    "@angular/core": "^17.0.0",
    "@angular/platform-browser": "^17.0.0",
    "@angular/platform-browser-dynamic": "^17.0.0",
    "d3": "^7.8.5",
    "d3-dag": "^1.1.0"
  },
  "devDependencies": {
    "@types/d3": "^7.4.3",
    "typescript": "^5.2.0"
  }
}
*/

// -------------------
// parent.component.ts - Usage Example
// -------------------
import { Component, ViewChild, OnInit } from '@angular/core';
import { DagComponent } from './dag/dag.component';

interface WorkflowStep {
  source: string;
  target: string;
}

@Component({
  selector: 'app-parent',
  template: `
    <div class="workflow-builder">
      <h2>Workflow DAG Builder</h2>
      
      <div class="toolbar">
        <button (click)="loadSampleWorkflow()">Load Sample</button>
        <button (click)="clearWorkflow()">Clear</button>
        <button (click)="exportWorkflow()">Export</button>
        <input 
          type="file" 
          (change)="importWorkflow($event)"
          accept=".json"
          #fileInput
          style="display: none;"
        >
        <button (click)="fileInput.click()">Import</button>
      </div>

      <app-dag 
        #dagComponent
        (nodeClicked)="onNodeClicked($event)"
        (layoutChanged)="onLayoutChanged($event)">
      </app-dag>

      <div class="workflow-info" *ngIf="workflowInfo">
        <h3>Workflow Information</h3>
        <p>Nodes: {{ workflowInfo.nodeCount }}</p>
        <p>Edges: {{ workflowInfo.edgeCount }}</p>
        <p>Layers: {{ workflowInfo.layerCount }}</p>
      </div>
    </div>
  `,
  styleUrls: ['./parent.component.scss']
})
export class ParentComponent implements OnInit {
  @ViewChild('dagComponent') dagComponent!: DagComponent;
  
  workflowInfo: any = null;

  ngOnInit() {
    this.loadSampleWorkflow();
  }

  loadSampleWorkflow() {
    const sampleSteps: WorkflowStep[] = [
      { source: "start", target: "validate_input" },
      { source: "validate_input", target: "process_data" },
      { source: "validate_input", target: "log_error" },
      { source: "process_data", target: "transform" },
      { source: "process_data", target: "validate_schema" },
      { source: "transform", target: "aggregate" },
      { source: "validate_schema", target: "aggregate" },
      { source: "aggregate", target: "output" },
      { source: "log_error", target: "notify_admin" }
    ];

    this.dagComponent?.updateData(sampleSteps);
    this.updateWorkflowInfo();
  }

  clearWorkflow() {
    this.dagComponent?.updateData([]);
    this.workflowInfo = null;
  }

  exportWorkflow() {
    const dagData = this.dagComponent?.exportDAG();
    if (dagData) {
      const dataStr = JSON.stringify(dagData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `workflow_${new Date().toISOString().slice(0,10)}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    }
  }

  importWorkflow(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const workflowData = JSON.parse(e.target?.result as string);
          if (workflowData.links) {
            this.dagComponent?.updateData(workflowData.links);
            this.updateWorkflowInfo();
          }
        } catch (error) {
          console.error('Error importing workflow:', error);
          alert('Invalid workflow file format');
        }
      };
      reader.readAsText(file);
    }
  }

  onNodeClicked(nodeData: any) {
    console.log('Node clicked in parent:', nodeData);
    // Handle node selection, show properties panel, etc.
  }

  onLayoutChanged(layoutInfo: any) {
    this.updateWorkflowInfo();
  }

  private updateWorkflowInfo() {
    const dagData = this.dagComponent?.exportDAG();
    if (dagData) {
      this.workflowInfo = {
        nodeCount: dagData.nodes.length,
        edgeCount: dagData.links.length,
        layerCount: this.calculateLayers(dagData.nodes)
      };
    }
  }

  private calculateLayers(nodes: any[]): number {
    const yPositions = nodes.map(n => n.y);
    const uniqueYPositions = [...new Set(yPositions)];
    return uniqueYPositions.length;
  }
}

// -------------------
// Advanced DAG Service for Complex Workflows
// -------------------
import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';

export interface DAGNode {
  id: string;
  name: string;
  type: 'start' | 'process' | 'decision' | 'end';
  properties?: Record<string, any>;
}

export interface DAGEdge {
  source: string;
  target: string;
  condition?: string;
  weight?: number;
}

export interface DAGWorkflow {
  id: string;
  name: string;
  nodes: DAGNode[];
  edges: DAGEdge[];
  metadata?: Record<string, any>;
}

@Injectable({
  providedIn: 'root'
})
export class DAGWorkflowService {
  private workflowSubject = new BehaviorSubject<DAGWorkflow | null>(null);
  public workflow$ = this.workflowSubject.asObservable();

  constructor() {}

  createWorkflow(name: string): DAGWorkflow {
    const workflow: DAGWorkflow = {
      id: this.generateId(),
      name,
      nodes: [],
      edges: [],
      metadata: {
        createdAt: new Date().toISOString(),
        version: '1.0.0'
      }
    };
    
    this.workflowSubject.next(workflow);
    return workflow;
  }

  addNode(node: DAGNode): void {
    const currentWorkflow = this.workflowSubject.value;
    if (currentWorkflow) {
      currentWorkflow.nodes.push(node);
      this.workflowSubject.next({ ...currentWorkflow });
    }
  }

  addEdge(edge: DAGEdge): void {
    const currentWorkflow = this.workflowSubject.value;
    if (currentWorkflow) {
      // Validate edge doesn't create cycle
      if (this.wouldCreateCycle(currentWorkflow, edge)) {
        throw new Error('Adding this edge would create a cycle in the DAG');
      }
      
      currentWorkflow.edges.push(edge);
      this.workflowSubject.next({ ...currentWorkflow });
    }
  }

  removeNode(nodeId: string): void {
    const currentWorkflow = this.workflowSubject.value;
    if (currentWorkflow) {
      currentWorkflow.nodes = currentWorkflow.nodes.filter(n => n.id !== nodeId);
      currentWorkflow.edges = currentWorkflow.edges.filter(
        e => e.source !== nodeId && e.target !== nodeId
      );
      this.workflowSubject.next({ ...currentWorkflow });
    }
  }

  removeEdge(source: string, target: string): void {
    const currentWorkflow = this.workflowSubject.value;
    if (currentWorkflow) {
      currentWorkflow.edges = currentWorkflow.edges.filter(
        e => !(e.source === source && e.target === target)
      );
      this.workflowSubject.next({ ...currentWorkflow });
    }
  }

  validateDAG(workflow: DAGWorkflow): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check for cycles
    if (this.hasCycles(workflow)) {
      errors.push('Workflow contains cycles');
    }
    
    // Check for orphaned nodes
    const connectedNodes = new Set([
      ...workflow.edges.map(e => e.source),
      ...workflow.edges.map(e => e.target)
    ]);
    
    const orphanedNodes = workflow.nodes.filter(n => !connectedNodes.has(n.id));
    if (orphanedNodes.length > 0) {
      errors.push(`Orphaned nodes found: ${orphanedNodes.map(n => n.name).join(', ')}`);
    }
    
    // Check for multiple start nodes
    const startNodes = workflow.nodes.filter(n => n.type === 'start');
    if (startNodes.length === 0) {
      errors.push('No start node found');
    } else if (startNodes.length > 1) {
      errors.push('Multiple start nodes found');
    }
    
    // Check for unreachable end nodes
    const endNodes = workflow.nodes.filter(n => n.type === 'end');
    if (endNodes.length === 0) {
      errors.push('No end node found');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  exportWorkflow(): string {
    const workflow = this.workflowSubject.value;
    return workflow ? JSON.stringify(workflow, null, 2) : '';
  }

  importWorkflow(workflowJson: string): void {
    try {
      const workflow = JSON.parse(workflowJson) as DAGWorkflow;
      const validation = this.validateDAG(workflow);
      
      if (validation.isValid) {
        this.workflowSubject.next(workflow);
      } else {
        throw new Error(`Invalid workflow: ${validation.errors.join(', ')}`);
      }
    } catch (error) {
      throw new Error(`Failed to import workflow: ${error}`);
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private wouldCreateCycle(workflow: DAGWorkflow, newEdge: DAGEdge): boolean {
    // Simple cycle detection using DFS
    const edges = [...workflow.edges, newEdge];
    const adjacencyList = new Map<string, string[]>();
    
    // Build adjacency list
    edges.forEach(edge => {
      if (!adjacencyList.has(edge.source)) {
        adjacencyList.set(edge.source, []);
      }
      adjacencyList.get(edge.source)!.push(edge.target);
    });
    
    // DFS to detect cycle
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const hasCycleUtil = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);
      
      const neighbors = adjacencyList.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycleUtil(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }
      
      recursionStack.delete(node);
      return false;
    };
    
    for (const node of workflow.nodes.map(n => n.id)) {
      if (!visited.has(node)) {
        if (hasCycleUtil(node)) return true;
      }
    }
    
    return false;
  }

  private hasCycles(workflow: DAGWorkflow): boolean {
    return workflow.edges.some(edge => 
      this.wouldCreateCycle(
        { ...workflow, edges: workflow.edges.filter(e => e !== edge) }, 
        edge
      )
    );
  }
}

/* dag.component.scss */
.dag-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background-color: #f5f5f5;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.controls {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px;
  background: white;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);

  button {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    background-color: #2196F3;
    color: white;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.3s ease;

    &:hover {
      background-color: #1976D2;
    }

    &:active {
      background-color: #0D47A1;
    }
  }
}

.dag-visualization {
  flex: 1;
  background: white;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  overflow: hidden;

  svg {
    width: 100%;
    height: auto;
    display: block;
  }
}

/* D3 DAG Styles */
.node {
  cursor: pointer;
  transition: all 0.3s ease;

  circle {
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
    transition: all 0.3s ease;
  }

  text {
    font-family: 'Arial', sans-serif;
    user-select: none;
    pointer-events: none;
  }

  &:hover {
    circle {
      filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
    }
  }
}

.edge {
  transition: all 0.3s ease;
  
  &:hover {
    stroke: #2196F3;
    stroke-width: 3;
  }
}

.arrowhead {
  fill: #666;
  transition: fill 0.3s ease;
}

.edge:hover + .arrowhead {
  fill: #2196F3;
}

.error-message {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #d32f2f;
  font-size: 16px;
  text-align: center;

  p {
    margin: 0;
    padding: 20px;
    background-color: #ffebee;
    border: 1px solid #ffcdd2;
    border-radius: 4px;
  }
}

/* Responsive Design */
@media (max-width: 768px) {
  .controls {
    flex-direction: column;
    
    button {
      width: 100%;
    }
  }
  
  .dag-container {
    padding: 8px;
  }
}

/* Animation for node creation */
@keyframes nodeAppear {
  from {
    opacity: 0;
    transform: scale(0);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.node {
  animation: nodeAppear 0.5s ease-out;
}

/* Loading state */
.dag-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #2196F3;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Alternative node styles for different node types */
.node-start circle {
  fill: #4CAF50;
  stroke: #2E7D32;
}

.node-end circle {
  fill: #F44336;
  stroke: #C62828;
}

.node-process circle {
  fill: #2196F3;
  stroke: #1565C0;
}

.node-decision circle {
  fill: #FF9800;
  stroke: #E65100;
}

/* Edge styles for different types */
.edge-success {
  stroke: #4CAF50;
}

.edge-error {
  stroke: #F44336;
}

.edge-conditional {
  stroke: #FF9800;
  stroke-dasharray: 5,5;
}

// app.module.ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';

import { AppComponent } from './app.component';
import { DagComponent } from './components/dag/dag.component';

@NgModule({
  declarations: [
    AppComponent,
    DagComponent
  ],
  imports: [
    BrowserModule,
    CommonModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }

// -------------------
// package.json dependencies
// -------------------
/*
{
  "dependencies": {
    "@angular/animations": "^17.0.0",
    "@angular/common": "^17.0.0",
    "@angular/compiler": "^17.0.0",
    "@angular/core": "^17.0.0",
    "@angular/platform-browser": "^17.0.0",
    "@angular/platform-browser-dynamic": "^17.0.0",
    "d3": "^7.8.5",
    "d3-dag": "^1.1.0"
  },
  "devDependencies": {
    "@types/d3": "^7.4.3",
    "typescript": "^5.2.0"
  }
}
*/

// -------------------
// parent.component.ts - Usage Example
// -------------------
import { Component, ViewChild, OnInit } from '@angular/core';
import { DagComponent } from './dag/dag.component';

interface WorkflowStep {
  source: string;
  target: string;
}

@Component({
  selector: 'app-parent',
  template: `
    <div class="workflow-builder">
      <h2>Workflow DAG Builder</h2>
      
      <div class="toolbar">
        <button (click)="loadSampleWorkflow()">Load Sample</button>
        <button (click)="clearWorkflow()">Clear</button>
        <button (click)="exportWorkflow()">Export</button>
        <input 
          type="file" 
          (change)="importWorkflow($event)"
          accept=".json"
          #fileInput
          style="display: none;"
        >
        <button (click)="fileInput.click()">Import</button>
      </div>

      <app-dag 
        #dagComponent
        (nodeClicked)="onNodeClicked($event)"
        (layoutChanged)="onLayoutChanged($event)">
      </app-dag>

      <div class="workflow-info" *ngIf="workflowInfo">
        <h3>Workflow Information</h3>
        <p>Nodes: {{ workflowInfo.nodeCount }}</p>
        <p>Edges: {{ workflowInfo.edgeCount }}</p>
        <p>Layers: {{ workflowInfo.layerCount }}</p>
      </div>
    </div>
  `,
  styleUrls: ['./parent.component.scss']
})
export class ParentComponent implements OnInit {
  @ViewChild('dagComponent') dagComponent!: DagComponent;
  
  workflowInfo: any = null;

  ngOnInit() {
    this.loadSampleWorkflow();
  }

  loadSampleWorkflow() {
    const sampleSteps: WorkflowStep[] = [
      { source: "start", target: "validate_input" },
      { source: "validate_input", target: "process_data" },
      { source: "validate_input", target: "log_error" },
      { source: "process_data", target: "transform" },
      { source: "process_data", target: "validate_schema" },
      { source: "transform", target: "aggregate" },
      { source: "validate_schema", target: "aggregate" },
      { source: "aggregate", target: "output" },
      { source: "log_error", target: "notify_admin" }
    ];

    this.dagComponent?.updateData(sampleSteps);
    this.updateWorkflowInfo();
  }

  clearWorkflow() {
    this.dagComponent?.updateData([]);
    this.workflowInfo = null;
  }

  exportWorkflow() {
    const dagData = this.dagComponent?.exportDAG();
    if (dagData) {
      const dataStr = JSON.stringify(dagData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `workflow_${new Date().toISOString().slice(0,10)}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    }
  }

  importWorkflow(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const workflowData = JSON.parse(e.target?.result as string);
          if (workflowData.links) {
            this.dagComponent?.updateData(workflowData.links);
            this.updateWorkflowInfo();
          }
        } catch (error) {
          console.error('Error importing workflow:', error);
          alert('Invalid workflow file format');
        }
      };
      reader.readAsText(file);
    }
  }

  onNodeClicked(nodeData: any) {
    console.log('Node clicked in parent:', nodeData);
    // Handle node selection, show properties panel, etc.
  }

  onLayoutChanged(layoutInfo: any) {
    this.updateWorkflowInfo();
  }

  private updateWorkflowInfo() {
    const dagData = this.dagComponent?.exportDAG();
    if (dagData) {
      this.workflowInfo = {
        nodeCount: dagData.nodes.length,
        edgeCount: dagData.links.length,
        layerCount: this.calculateLayers(dagData.nodes)
      };
    }
  }

  private calculateLayers(nodes: any[]): number {
    const yPositions = nodes.map(n => n.y);
    const uniqueYPositions = [...new Set(yPositions)];
    return uniqueYPositions.length;
  }
}

// -------------------
// Advanced DAG Service for Complex Workflows
// -------------------
import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';

export interface DAGNode {
  id: string;
  name: string;
  type: 'start' | 'process' | 'decision' | 'end';
  properties?: Record<string, any>;
}

export interface DAGEdge {
  source: string;
  target: string;
  condition?: string;
  weight?: number;
}

export interface DAGWorkflow {
  id: string;
  name: string;
  nodes: DAGNode[];
  edges: DAGEdge[];
  metadata?: Record<string, any>;
}

@Injectable({
  providedIn: 'root'
})
export class DAGWorkflowService {
  private workflowSubject = new BehaviorSubject<DAGWorkflow | null>(null);
  public workflow$ = this.workflowSubject.asObservable();

  constructor() {}

  createWorkflow(name: string): DAGWorkflow {
    const workflow: DAGWorkflow = {
      id: this.generateId(),
      name,
      nodes: [],
      edges: [],
      metadata: {
        createdAt: new Date().toISOString(),
        version: '1.0.0'
      }
    };
    
    this.workflowSubject.next(workflow);
    return workflow;
  }

  addNode(node: DAGNode): void {
    const currentWorkflow = this.workflowSubject.value;
    if (currentWorkflow) {
      currentWorkflow.nodes.push(node);
      this.workflowSubject.next({ ...currentWorkflow });
    }
  }

  addEdge(edge: DAGEdge): void {
    const currentWorkflow = this.workflowSubject.value;
    if (currentWorkflow) {
      // Validate edge doesn't create cycle
      if (this.wouldCreateCycle(currentWorkflow, edge)) {
        throw new Error('Adding this edge would create a cycle in the DAG');
      }
      
      currentWorkflow.edges.push(edge);
      this.workflowSubject.next({ ...currentWorkflow });
    }
  }

  removeNode(nodeId: string): void {
    const currentWorkflow = this.workflowSubject.value;
    if (currentWorkflow) {
      currentWorkflow.nodes = currentWorkflow.nodes.filter(n => n.id !== nodeId);
      currentWorkflow.edges = currentWorkflow.edges.filter(
        e => e.source !== nodeId && e.target !== nodeId
      );
      this.workflowSubject.next({ ...currentWorkflow });
    }
  }

  removeEdge(source: string, target: string): void {
    const currentWorkflow = this.workflowSubject.value;
    if (currentWorkflow) {
      currentWorkflow.edges = currentWorkflow.edges.filter(
        e => !(e.source === source && e.target === target)
      );
      this.workflowSubject.next({ ...currentWorkflow });
    }
  }

  validateDAG(workflow: DAGWorkflow): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check for cycles
    if (this.hasCycles(workflow)) {
      errors.push('Workflow contains cycles');
    }
    
    // Check for orphaned nodes
    const connectedNodes = new Set([
      ...workflow.edges.map(e => e.source),
      ...workflow.edges.map(e => e.target)
    ]);
    
    const orphanedNodes = workflow.nodes.filter(n => !connectedNodes.has(n.id));
    if (orphanedNodes.length > 0) {
      errors.push(`Orphaned nodes found: ${orphanedNodes.map(n => n.name).join(', ')}`);
    }
    
    // Check for multiple start nodes
    const startNodes = workflow.nodes.filter(n => n.type === 'start');
    if (startNodes.length === 0) {
      errors.push('No start node found');
    } else if (startNodes.length > 1) {
      errors.push('Multiple start nodes found');
    }
    
    // Check for unreachable end nodes
    const endNodes = workflow.nodes.filter(n => n.type === 'end');
    if (endNodes.length === 0) {
      errors.push('No end node found');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  exportWorkflow(): string {
    const workflow = this.workflowSubject.value;
    return workflow ? JSON.stringify(workflow, null, 2) : '';
  }

  importWorkflow(workflowJson: string): void {
    try {
      const workflow = JSON.parse(workflowJson) as DAGWorkflow;
      const validation = this.validateDAG(workflow);
      
      if (validation.isValid) {
        this.workflowSubject.next(workflow);
      } else {
        throw new Error(`Invalid workflow: ${validation.errors.join(', ')}`);
      }
    } catch (error) {
      throw new Error(`Failed to import workflow: ${error}`);
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private wouldCreateCycle(workflow: DAGWorkflow, newEdge: DAGEdge): boolean {
    // Simple cycle detection using DFS
    const edges = [...workflow.edges, newEdge];
    const adjacencyList = new Map<string, string[]>();
    
    // Build adjacency list
    edges.forEach(edge => {
      if (!adjacencyList.has(edge.source)) {
        adjacencyList.set(edge.source, []);
      }
      adjacencyList.get(edge.source)!.push(edge.target);
    });
    
    // DFS to detect cycle
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const hasCycleUtil = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);
      
      const neighbors = adjacencyList.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycleUtil(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }
      
      recursionStack.delete(node);
      return false;
    };
    
    for (const node of workflow.nodes.map(n => n.id)) {
      if (!visited.has(node)) {
        if (hasCycleUtil(node)) return true;
      }
    }
    
    return false;
  }

  private hasCycles(workflow: DAGWorkflow): boolean {
    return workflow.edges.some(edge => 
      this.wouldCreateCycle(
        { ...workflow, edges: workflow.edges.filter(e => e !== edge) }, 
        edge
      )
    );
  }
}