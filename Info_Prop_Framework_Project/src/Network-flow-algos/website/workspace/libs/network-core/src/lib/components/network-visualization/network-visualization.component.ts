import { Component, Input, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NetworkGraph } from '../../models/network.models';

// Note: Sigma.js will be imported dynamically to avoid build issues
declare const Sigma: any;

@Component({
  selector: 'lib-network-visualization',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="network-container">
      <div #sigmaContainer class="sigma-container"></div>
      <div *ngIf="!networkData" class="no-data">
        <p>No network data available</p>
      </div>
    </div>
  `,
  styles: [`
    .network-container {
      position: relative;
      width: 100%;
      height: 500px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }

    .sigma-container {
      width: 100%;
      height: 100%;
    }

    .no-data {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #666;
      font-style: italic;
    }
  `]
})
export class NetworkVisualizationComponent implements AfterViewInit, OnDestroy {
  @ViewChild('sigmaContainer', { static: true }) sigmaContainer!: ElementRef<HTMLDivElement>;
  
  @Input() networkData: NetworkGraph | null = null;
  @Input() width = '100%';
  @Input() height = '500px';

  private sigmaInstance: any = null;

  ngAfterViewInit() {
    if (this.networkData) {
      this.initializeVisualization();
    }
  }

  ngOnDestroy() {
    if (this.sigmaInstance) {
      this.sigmaInstance.kill();
    }
  }

  private async initializeVisualization() {
    if (!this.networkData || !this.sigmaContainer?.nativeElement) {
      return;
    }

    try {
      // For now, create a simple visualization without Sigma.js
      // This can be enhanced once the dependencies are properly installed
      this.createSimpleVisualization();
    } catch (error) {
      console.error('Error initializing network visualization:', error);
    }
  }

  private createSimpleVisualization() {
    const container = this.sigmaContainer.nativeElement;
    container.innerHTML = `
      <div style="padding: 20px; text-align: center;">
        <h3>Network Visualization</h3>
        <p><strong>Nodes:</strong> ${this.networkData?.nodes.length || 0}</p>
        <p><strong>Edges:</strong> ${this.networkData?.edges.length || 0}</p>
        <p><strong>Type:</strong> ${this.networkData?.directed ? 'Directed' : 'Undirected'}</p>
        <p style="color: #666; font-style: italic;">
          Advanced visualization will be available once Sigma.js is properly configured.
        </p>
      </div>
    `;
  }

  updateNetwork(newData: NetworkGraph) {
    this.networkData = newData;
    if (this.sigmaInstance) {
      // Update existing visualization
      this.createSimpleVisualization();
    } else {
      this.initializeVisualization();
    }
  }
}