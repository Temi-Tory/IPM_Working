import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';

import { DataService, NetworkData } from '../../services/data.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-visualization',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatSliderModule,
    MatFormFieldModule,
    MatInputModule,
    MatToolbarModule,
    MatTooltipModule
  ],
  templateUrl: './visualization.component.html',
  styleUrls: ['./visualization.component.scss']
})
export class VisualizationComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private dataService = inject(DataService);
  private router = inject(Router);

  // Component state
  networkData: NetworkData | null = null;
  isLoading = false;
  error: string | null = null;

  // Visualization settings
  selectedLayout = 'force-directed';
  nodeSize = 10;
  edgeWidth = 2;
  showNodeLabels = true;
  showEdgeLabels = false;
  colorScheme = 'default';

  // Layout options
  layoutOptions = [
    { value: 'force-directed', label: 'Force-Directed', description: 'Physics-based layout' },
    { value: 'hierarchical', label: 'Hierarchical', description: 'Top-down tree layout' },
    { value: 'circular', label: 'Circular', description: 'Nodes arranged in circles' },
    { value: 'grid', label: 'Grid', description: 'Regular grid arrangement' }
  ];

  // Color scheme options
  colorSchemeOptions = [
    { value: 'default', label: 'Default', description: 'Standard node colors' },
    { value: 'type-based', label: 'Node Type', description: 'Color by node type' },
    { value: 'connectivity', label: 'Connectivity', description: 'Color by connection count' },
    { value: 'depth', label: 'Depth', description: 'Color by graph depth' }
  ];

  ngOnInit(): void {
    // Subscribe to data service observables
    this.dataService.networkData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.networkData = data;
        if (data) {
          this.initializeVisualization();
        }
      });

    this.dataService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        this.isLoading = loading;
      });

    this.dataService.error$
      .pipe(takeUntil(this.destroy$))
      .subscribe(error => {
        this.error = error;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeVisualization(): void {
    // This will be implemented with D3.js or Cytoscape.js in Phase 4
    console.log('Initializing visualization with data:', this.networkData);
  }

  // Visualization control methods
  onLayoutChange(): void {
    console.log('Layout changed to:', this.selectedLayout);
    // Implement layout change logic
  }

  onNodeSizeChange(): void {
    console.log('Node size changed to:', this.nodeSize);
    // Implement node size change logic
  }

  onEdgeWidthChange(): void {
    console.log('Edge width changed to:', this.edgeWidth);
    // Implement edge width change logic
  }

  onColorSchemeChange(): void {
    console.log('Color scheme changed to:', this.colorScheme);
    // Implement color scheme change logic
  }

  toggleNodeLabels(): void {
    this.showNodeLabels = !this.showNodeLabels;
    console.log('Node labels:', this.showNodeLabels);
    // Implement label toggle logic
  }

  toggleEdgeLabels(): void {
    this.showEdgeLabels = !this.showEdgeLabels;
    console.log('Edge labels:', this.showEdgeLabels);
    // Implement edge label toggle logic
  }

  // Utility methods
  zoomIn(): void {
    console.log('Zoom in');
    // Implement zoom in logic
  }

  zoomOut(): void {
    console.log('Zoom out');
    // Implement zoom out logic
  }

  resetZoom(): void {
    console.log('Reset zoom');
    // Implement reset zoom logic
  }

  centerGraph(): void {
    console.log('Center graph');
    // Implement center graph logic
  }

  exportVisualization(): void {
    console.log('Export visualization');
    // Implement export logic (PNG, SVG, etc.)
  }

  // Getter methods for template
  getCurrentLayoutLabel(): string {
    const layout = this.layoutOptions.find(l => l.value === this.selectedLayout);
    return layout ? layout.label : 'Unknown';
  }

  getCurrentLayoutDescription(): string {
    const layout = this.layoutOptions.find(l => l.value === this.selectedLayout);
    return layout ? layout.description : '';
  }

  getCurrentColorSchemeLabel(): string {
    const scheme = this.colorSchemeOptions.find(c => c.value === this.colorScheme);
    return scheme ? scheme.label : 'Unknown';
  }

  getCurrentColorSchemeDescription(): string {
    const scheme = this.colorSchemeOptions.find(c => c.value === this.colorScheme);
    return scheme ? scheme.description : '';
  }

  // Navigation methods
  navigateToUpload(): void {
    this.router.navigate(['/upload']);
  }

  navigateToStructure(): void {
    this.router.navigate(['/structure']);
  }

  navigateToDiamonds(): void {
    this.router.navigate(['/diamonds']);
  }
}