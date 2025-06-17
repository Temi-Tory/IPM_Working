import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-visualization',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  template: `
    <div class="page-container">
      <mat-card class="page-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>visibility</mat-icon>
            Network Visualization
          </mat-card-title>
          <mat-card-subtitle>Visualize network graphs and data</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <p>This page will display interactive network visualizations.</p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-container {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .page-card {
      margin-bottom: 24px;
    }
    
    mat-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `]
})
export class VisualizationComponent {}