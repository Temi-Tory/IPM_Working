# Dialog Service and Performance Optimization

## Dialog Service Architecture

### NetworkDialogService Implementation

```typescript
@Injectable({
  providedIn: 'root'
})
export class NetworkDialogService {
  private currentNetworkData: NetworkStructure | null = null;
  private dialogCache = new Map<string, any>();
  
  constructor(
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) {}
  
  /**
   * Set the current network data for dialog operations
   */
  setNetworkData(networkData: NetworkStructure): void {
    this.currentNetworkData = networkData;
    this.clearCache(); // Clear cache when network changes
  }
  
  /**
   * Open node dialog with comprehensive data
   */
  openNodeDialog(nodeId: number): MatDialogRef<NetworkNodeDialogComponent> | null {
    if (!this.currentNetworkData) {
      console.error('No network data available for dialog');
      return null;
    }
    
    const dialogData = this.prepareNodeDialogData(nodeId);
    
    return this.dialog.open(NetworkNodeDialogComponent, {
      data: dialogData,
      width: '90vw',
      maxWidth: '800px',
      height: '90vh',
      maxHeight: '600px',
      panelClass: 'network-node-dialog',
      autoFocus: false, // Prevent auto-focus for better UX
      restoreFocus: true
    });
  }
  
  /**
   * Open edge dialog with comprehensive data
   */
  openEdgeDialog(sourceId: number, targetId: number): MatDialogRef<NetworkEdgeDialogComponent> | null {
    if (!this.currentNetworkData) {
      console.error('No network data available for dialog');
      return null;
    }
    
    const dialogData = this.prepareEdgeDialogData(sourceId, targetId);
    
    return this.dialog.open(NetworkEdgeDialogComponent, {
      data: dialogData,
      width: '90vw',
      maxWidth: '700px',
      height: '80vh',
      maxHeight: '500px',
      panelClass: 'network-edge-dialog',
      autoFocus: false,
      restoreFocus: true
    });
  }
  
  /**
   * Navigate from one dialog to another (close current, open new)
   */
  navigateToNode(nodeId: number, currentDialogRef?: MatDialogRef<any>): void {
    if (currentDialogRef) {
      currentDialogRef.close();
    }
    this.openNodeDialog(nodeId);
  }
  
  /**
   * Navigate to edge dialog
   */
  navigateToEdge(sourceId: number, targetId: number, currentDialogRef?: MatDialogRef<any>): void {
    if (currentDialogRef) {
      currentDialogRef.close();
    }
    this.openEdgeDialog(sourceId, targetId);
  }
  
  /**
   * Prepare node dialog data from NetworkStructure
   */
  private prepareNodeDialogData(nodeId: number): NodeDialogData {
    const cacheKey = `node-${nodeId}`;
    if (this.dialogCache.has(cacheKey)) {
      return this.dialogCache.get(cacheKey);
    }
    
    const networkData = this.currentNetworkData!;
    
    // Calculate basic node information
    const inDegree = this.calculateInDegree(nodeId);
    const outDegree = this.calculateOutDegree(nodeId);
    const totalDegree = inDegree + outDegree;
    
    // Get node types
    const types = this.getNodeTypes(nodeId);
    const type = types.join(' + ');
    
    // Get connectivity information
    const directParents = this.getDirectParents(nodeId);
    const directChildren = this.getDirectChildren(nodeId);
    const ancestors = (networkData.ancestors[nodeId.toString()] || [])
      .map(id => this.createNodeReference(id));
    const descendants = (networkData.descendants[nodeId.toString()] || [])
      .map(id => this.createNodeReference(id));
    
    // Get iteration set information
    const iterationSets = this.getNodeIterationSets(nodeId);
    const iterationSetDetails = iterationSets.map(setIndex => ({
      setIndex,
      totalNodesInSet: networkData.iteration_sets[setIndex - 1]?.length || 0
    }));
    
    // Calculate statistics
    const allNodes = networkData.nodes;
    const allDegrees = allNodes.map(id => ({
      id,
      inDegree: this.calculateInDegree(id),
      outDegree: this.calculateOutDegree(id),
      totalDegree: this.calculateInDegree(id) + this.calculateOutDegree(id)
    }));
    
    // Sort for rankings
    const sortedByInDegree = [...allDegrees].sort((a, b) => b.inDegree - a.inDegree);
    const sortedByOutDegree = [...allDegrees].sort((a, b) => b.outDegree - a.outDegree);
    const sortedByTotalDegree = [...allDegrees].sort((a, b) => b.totalDegree - a.totalDegree);
    
    const inDegreeRank = sortedByInDegree.findIndex(n => n.id === nodeId) + 1;
    const outDegreeRank = sortedByOutDegree.findIndex(n => n.id === nodeId) + 1;
    const totalDegreeRank = sortedByTotalDegree.findIndex(n => n.id === nodeId) + 1;
    
    // Calculate averages
    const avgInDegree = allDegrees.reduce((sum, n) => sum + n.inDegree, 0) / allDegrees.length;
    const avgOutDegree = allDegrees.reduce((sum, n) => sum + n.outDegree, 0) / allDegrees.length;
    const avgTotalDegree = allDegrees.reduce((sum, n) => sum + n.totalDegree, 0) / allDegrees.length;
    
    // Calculate percentiles
    const inDegreePercentile = ((allDegrees.length - inDegreeRank + 1) / allDegrees.length) * 100;
    const outDegreePercentile = ((allDegrees.length - outDegreeRank + 1) / allDegrees.length) * 100;
    const totalDegreePercentile = ((allDegrees.length - totalDegreeRank + 1) / allDegrees.length) * 100;
    
    // Compute classifications based on existing logic
    const computedClassifications = {
      connectivityLevel: this.getConnectivityLevel(totalDegree),
      isBottleneck: this.isBottleneckNode(nodeId, inDegree, outDegree),
      isHighConnectivity: totalDegree >= this.getHighConnectivityThreshold(),
      isOutlier: this.isOutlierNode(totalDegree, avgTotalDegree, allDegrees.map(n => n.totalDegree)),
      isBridge: inDegree === 1 && outDegree === 1,
      isHub: totalDegree >= this.getHubThreshold(allDegrees.map(n => n.totalDegree)),
      isSingleParent: inDegree === 1,
      isSingleChild: outDegree === 1,
      isOrphan: inDegree === 0 && outDegree === 0
    };
    
    const dialogData: NodeDialogData = {
      id: nodeId,
      type,
      types,
      inDegree,
      outDegree,
      totalDegree,
      directParents,
      directChildren,
      ancestors,
      descendants,
      iterationSets,
      iterationSetDetails,
      networkContext: {
        totalNodes: networkData.total_nodes,
        totalEdges: networkData.total_edges,
        networkName: networkData.network_name
      },
      statistics: {
        inDegreeRank,
        outDegreeRank,
        totalDegreeRank,
        networkAverages: {
          avgInDegree,
          avgOutDegree,
          avgTotalDegree
        },
        degreePercentiles: {
          inDegree: Math.round(inDegreePercentile),
          outDegree: Math.round(outDegreePercentile),
          total: Math.round(totalDegreePercentile)
        }
      },
      computedClassifications
    };
    
    // Cache the result
    this.dialogCache.set(cacheKey, dialogData);
    return dialogData;
  }
  
  /**
   * Prepare edge dialog data from NetworkStructure
   */
  private prepareEdgeDialogData(sourceId: number, targetId: number): EdgeDialogData {
    const cacheKey = `edge-${sourceId}-${targetId}`;
    if (this.dialogCache.has(cacheKey)) {
      return this.dialogCache.get(cacheKey);
    }
    
    const networkData = this.currentNetworkData!;
    
    // Create node references
    const source = this.createNodeReference(sourceId);
    const target = this.createNodeReference(targetId);
    
    // Get edge type
    const edgeType = this.getEdgeType(sourceId, targetId);
    
    // Get iteration set context
    const sourceIterationSets = this.getNodeIterationSets(sourceId);
    const targetIterationSets = this.getNodeIterationSets(targetId);
    const bridgesIterationSets = !sourceIterationSets.some(set => targetIterationSets.includes(set));
    
    let iterationSetJump;
    if (bridgesIterationSets && sourceIterationSets.length > 0 && targetIterationSets.length > 0) {
      const fromSet = Math.min(...sourceIterationSets);
      const toSet = Math.min(...targetIterationSets);
      iterationSetJump = {
        fromSet,
        toSet,
        levelDifference: Math.abs(toSet - fromSet)
      };
    }
    
    // Get related connections
    const sourceOutgoingEdges = networkData.edges
      .filter(([src, _]) => src === sourceId && _ !== targetId)
      .map(([_, tgt]) => ({
        target: tgt,
        targetType: this.getNodeTypes(tgt).join(' + ')
      }));
    
    const targetIncomingEdges = networkData.edges
      .filter(([_, tgt]) => tgt === targetId && _ !== sourceId)
      .map(([src, _]) => ({
        source: src,
        sourceType: this.getNodeTypes(src).join(' + ')
      }));
    
    // Compute edge properties
    const sourceTypes = this.getNodeTypes(sourceId);
    const targetTypes = this.getNodeTypes(targetId);
    
    const computedProperties = {
      structuralRole: this.getStructuralRole(sourceTypes, targetTypes),
      isFromHighDegreeNode: this.calculateOutDegree(sourceId) >= this.getHighDegreeThreshold(),
      isToHighDegreeNode: this.calculateInDegree(targetId) >= this.getHighDegreeThreshold(),
      connectsSpecialNodes: this.hasSpecialNodeTypes(sourceTypes) || this.hasSpecialNodeTypes(targetTypes),
      isMultiTypeConnection: sourceTypes.length > 1 || targetTypes.length > 1
    };
    
    const dialogData: EdgeDialogData = {
      source,
      target,
      edgeType,
      topologyContext: {
        sourceIterationSets,
        targetIterationSets,
        bridgesIterationSets,
        iterationSetJump
      },
      networkContext: {
        totalEdges: networkData.total_edges,
        networkName: networkData.network_name,
        edgeIndex: networkData.edges.findIndex(([s, t]) => s === sourceId && t === targetId) + 1
      },
      relatedConnections: {
        sourceOutgoingEdges,
        targetIncomingEdges,
        pathContext: {
          isOnlyPath: sourceOutgoingEdges.length === 0 && targetIncomingEdges.length === 0,
          alternativePathsExist: this.hasAlternativePaths(sourceId, targetId)
        }
      },
      computedProperties
    };
    
    // Cache the result
    this.dialogCache.set(cacheKey, dialogData);
    return dialogData;
  }
  
  // Helper methods (implementations of calculations used above)
  private calculateInDegree(nodeId: number): number {
    return this.currentNetworkData!.edges.filter(([_, target]) => target === nodeId).length;
  }
  
  private calculateOutDegree(nodeId: number): number {
    return this.currentNetworkData!.edges.filter(([source, _]) => source === nodeId).length;
  }
  
  private getNodeTypes(nodeId: number): string[] {
    const data = this.currentNetworkData!;
    const types: string[] = [];
    
    if (data.source_nodes.includes(nodeId)) types.push('Source');
    if (data.sink_nodes.includes(nodeId)) types.push('Sink');
    if (data.fork_nodes.includes(nodeId)) types.push('Fork');
    if (data.join_nodes.includes(nodeId)) types.push('Join');
    
    return types.length > 0 ? types : ['Regular'];
  }
  
  private createNodeReference(nodeId: number): NodeReference {
    const types = this.getNodeTypes(nodeId);
    return {
      id: nodeId,
      type: types.join(' + '),
      types,
      inDegree: this.calculateInDegree(nodeId),
      outDegree: this.calculateOutDegree(nodeId)
    };
  }
  
  private getDirectParents(nodeId: number): NodeReference[] {
    return this.currentNetworkData!.edges
      .filter(([_, target]) => target === nodeId)
      .map(([source, _]) => this.createNodeReference(source));
  }
  
  private getDirectChildren(nodeId: number): NodeReference[] {
    return this.currentNetworkData!.edges
      .filter(([source, _]) => source === nodeId)
      .map(([_, target]) => this.createNodeReference(target));
  }
  
  private getNodeIterationSets(nodeId: number): number[] {
    return this.currentNetworkData!.iteration_sets
      .map((set, index) => ({ set, index }))
      .filter(({ set }) => set.includes(nodeId))
      .map(({ index }) => index + 1);
  }
  
  private clearCache(): void {
    this.dialogCache.clear();
  }
  
  // Additional helper methods for classifications...
  private getConnectivityLevel(totalDegree: number): 'high' | 'medium' | 'low' | 'isolated' {
    if (totalDegree === 0) return 'isolated';
    if (totalDegree === 1) return 'low';
    if (totalDegree <= 3) return 'medium';
    return 'high';
  }
  
  private isBottleneckNode(nodeId: number, inDegree: number, outDegree: number): boolean {
    const ratio = inDegree > 0 ? outDegree / inDegree : Infinity;
    return (ratio < 0.5 && inDegree >= 2) || (ratio > 2 && outDegree >= 2);
  }
  
  // ... other helper methods
}
```

## Performance Optimization Strategies

### 1. Memory Management for Large DAGs

#### Lazy Loading Strategy
```typescript
/**
 * Service for handling large dataset operations
 */
@Injectable()
export class DialogPerformanceService {
  private readonly LARGE_LIST_THRESHOLD = 100;
  private readonly VIRTUAL_SCROLL_THRESHOLD = 500;
  
  /**
   * Determine if a list should use virtual scrolling
   */
  shouldUseVirtualScrolling(listSize: number): boolean {
    return listSize > this.VIRTUAL_SCROLL_THRESHOLD;
  }
  
  /**
   * Determine if a list should use pagination
   */
  shouldUsePagination(listSize: number): boolean {
    return listSize > this.LARGE_LIST_THRESHOLD;
  }
  
  /**
   * Create paginated data structure
   */
  createPaginatedList<T>(items: T[], pageSize: number = 25): PaginatedNodeList {
    return {
      items: items.slice(0, pageSize),
      totalCount: items.length,
      pageSize,
      currentPage: 0,
      hasMore: items.length > pageSize,
      isLoading: false
    };
  }
  
  /**
   * Get page of data
   */
  getPage<T>(allItems: T[], pageIndex: number, pageSize: number): T[] {
    const start = pageIndex * pageSize;
    return allItems.slice(start, start + pageSize);
  }
}
```

#### Component-Level Optimizations
```typescript
export class NetworkNodeDialogComponent implements OnInit, OnDestroy {
  // Use OnPush change detection
  changeDetection: ChangeDetectionStrategy.OnPush;
  
  // Signals for reactive data
  ancestorsPage = signal<number>(0);
  descendantsPage = signal<number>(0);
  ancestorSearchTerm = signal<string>('');
  
  // Computed properties with memoization
  filteredAncestors = computed(() => {
    const searchTerm = this.ancestorSearchTerm().toLowerCase();
    const ancestors = this.data.ancestors;
    
    if (!searchTerm) return ancestors;
    
    return ancestors.filter(ancestor => 
      ancestor.id.toString().includes(searchTerm) ||
      ancestor.type.toLowerCase().includes(searchTerm)
    );
  });
  
  // Track by functions for efficient list rendering
  trackByNodeId = (index: number, node: NodeReference): number => node.id;
  
  // Debounced search
  private searchSubject = new Subject<string>();
  
  ngOnInit(): void {
    // Set up debounced search
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(searchTerm => {
      this.ancestorSearchTerm.set(searchTerm);
    });
  }
  
  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchSubject.next(target.value);
  }
}
```

### 2. Virtual Scrolling Implementation

#### Large List Component
```typescript
@Component({
  selector: 'app-virtual-node-list',
  template: `
    <div class="list-header">
      <mat-form-field *ngIf="showSearch">
        <input matInput 
               placeholder="Search nodes..." 
               [value]="searchTerm()"
               (input)="onSearchInput($event)">
      </mat-form-field>
    </div>
    
    <cdk-virtual-scroll-viewport 
      itemSize="48" 
      class="virtual-scroll-viewport"
      [style.height.px]="viewportHeight">
      
      <div *cdkVirtualFor="let node of filteredNodes(); trackBy: trackByNodeId"
           class="virtual-node-item">
        <mat-chip (click)="onNodeClick(node.id)" 
                  class="node-chip">
          <span class="node-id">{{ node.id }}</span>
          <span class="node-type">({{ node.type }})</span>
          <span class="node-degree">{{ node.inDegree }}/{{ node.outDegree }}</span>
        </mat-chip>
      </div>
    </cdk-virtual-scroll-viewport>
    
    <div class="list-footer" *ngIf="showFooter">
      Showing {{ filteredNodes().length }} of {{ totalNodes }} nodes
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VirtualNodeListComponent {
  @Input() nodes: NodeReference[] = [];
  @Input() viewportHeight: number = 300;
  @Input() showSearch: boolean = true;
  @Input() showFooter: boolean = true;
  @Output() nodeClick = new EventEmitter<number>();
  
  searchTerm = signal<string>('');
  
  filteredNodes = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.nodes;
    
    return this.nodes.filter(node =>
      node.id.toString().includes(term) ||
      node.type.toLowerCase().includes(term)
    );
  });
  
  get totalNodes(): number {
    return this.nodes.length;
  }
  
  trackByNodeId = (index: number, node: NodeReference): number => node.id;
  
  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchTerm.set(target.value);
  }
  
  onNodeClick(nodeId: number): void {
    this.nodeClick.emit(nodeId);
  }
}
```

### 3. Caching Strategy

#### Dialog Data Cache
```typescript
/**
 * Cache service for dialog data with memory management
 */
@Injectable()
export class DialogCacheService {
  private cache = new Map<string, any>();
  private cacheTimestamps = new Map<string, number>();
  private readonly MAX_CACHE_SIZE = 100;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  set(key: string, data: any): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictOldest();
    }
    
    this.cache.set(key, data);
    this.cacheTimestamps.set(key, Date.now());
  }
  
  get(key: string): any | null {
    const timestamp = this.cacheTimestamps.get(key);
    
    // Check if cache entry is expired
    if (timestamp && Date.now() - timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
      return null;
    }
    
    return this.cache.get(key) || null;
  }
  
  has(key: string): boolean {
    return this.cache.has(key) && !this.isExpired(key);
  }
  
  clear(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }
  
  private isExpired(key: string): boolean {
    const timestamp = this.cacheTimestamps.get(key);
    return timestamp ? Date.now() - timestamp > this.CACHE_TTL : true;
  }
  
  private evictOldest(): void {
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [key, timestamp] of this.cacheTimestamps.entries()) {
      if (timestamp < oldestTime) {
        oldestTime = timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.cacheTimestamps.delete(oldestKey);
    }
  }
}
```

### 4. Bundle Size Optimization

#### Lazy Loading Dialog Modules
```typescript
// dialog.module.ts
@NgModule({
  declarations: [
    NetworkNodeDialogComponent,
    NetworkEdgeDialogComponent,
    VirtualNodeListComponent
  ],
  imports: [
    CommonModule,
    MatDialogModule,
    MatTabsModule,
    MatChipsModule,
    MatCardModule,
    MatListModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatExpansionModule,
    MatPaginatorModule,
    ScrollingModule, // For virtual scrolling
    FormsModule
  ],
  providers: [
    NetworkDialogService,
    DialogPerformanceService,
    DialogCacheService
  ]
})
export class NetworkDialogModule {}
```

#### Dynamic Import Strategy
```typescript
// In the main component
async openNodeDialog(nodeId: number): Promise<void> {
  // Dynamically import dialog module only when needed
  const { NetworkDialogModule } = await import('./shared/dialogs/dialog.module');
  
  // Use the dialog service
  this.dialogService.openNodeDialog(nodeId);
}
```

This performance-focused approach ensures that the dialog components can handle large DAGs efficiently while maintaining a responsive user experience.