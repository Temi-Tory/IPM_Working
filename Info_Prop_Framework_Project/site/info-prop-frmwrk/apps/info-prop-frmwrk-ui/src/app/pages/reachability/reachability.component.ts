import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-reachability',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  template: `
    <div class="page-container">
      <mat-card class="page-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>timeline</mat-icon>
            Reachability Analysis
          </mat-card-title>
          <mat-card-subtitle>Analyze network reachability and connectivity</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <p>This page will provide reachability analysis for network nodes and paths.</p>
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
export class ReachabilityComponent {}