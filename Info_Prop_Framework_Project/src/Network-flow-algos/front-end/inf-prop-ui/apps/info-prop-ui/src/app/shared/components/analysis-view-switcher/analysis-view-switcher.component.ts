import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ViewMode, AnalysisViewModes } from '../../interfaces/analysis-component.interface';

@Component({
  selector: 'app-analysis-view-switcher',
  imports: [
    CommonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatTooltipModule
  ],
  template: `
    <mat-button-toggle-group 
      class="view-switcher"
      [value]="currentMode()"
      (change)="onModeChange($event.value)">
      
      @if (availableModes().visual) {
        <mat-button-toggle 
          value="visual" 
          matTooltip="Interactive graph visualization">
          <mat-icon>bubble_chart</mat-icon>
          <span class="mode-label">Visual</span>
        </mat-button-toggle>
      }
      
      @if (availableModes().dashboard) {
        <mat-button-toggle 
          value="dashboard" 
          matTooltip="Dashboard with metrics and statistics">
          <mat-icon>dashboard</mat-icon>
          <span class="mode-label">Dashboard</span>
        </mat-button-toggle>
      }
    </mat-button-toggle-group>
  `,
  styles: [`
    .view-switcher {
      background-color: var(--surface-container);
      border: 1px solid var(--outline-variant);
      border-radius: 8px;
      
      .mat-button-toggle {
        border: none;
        color: var(--on-surface-variant);
        
        &.mat-button-toggle-checked {
          background-color: var(--primary-container);
          color: var(--on-primary-container);
          
          .mat-icon {
            color: var(--on-primary-container);
          }
        }
        
        .mat-icon {
          margin-right: 8px;
          font-size: 20px;
          width: 20px;
          height: 20px;
        }
        
        .mode-label {
          font-weight: 500;
          font-size: 14px;
        }
      }
    }
  `]
})
export class AnalysisViewSwitcherComponent {
  currentMode = input.required<ViewMode>();
  availableModes = input.required<AnalysisViewModes>();
  
  modeChange = output<ViewMode>();
  
  onModeChange(mode: ViewMode): void {
    this.modeChange.emit(mode);
  }
}