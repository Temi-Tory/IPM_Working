import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-parameters',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  template: `
    <div class="page-container">
      <mat-card class="page-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>tune</mat-icon>
            Modify Input Parameters
          </mat-card-title>
          <mat-card-subtitle>Configure analysis parameters</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <p>This page will allow you to modify input parameters for your analysis.</p>
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
export class ParametersComponent {}