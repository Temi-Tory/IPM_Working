import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-spinner',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule],
  template: `
    <div class="spinner-container" [ngClass]="containerClass">
      <div class="spinner-wrapper" *ngIf="isLoading">
        <mat-spinner 
          [diameter]="diameter" 
          [strokeWidth]="strokeWidth"
          [color]="color">
        </mat-spinner>
        <p class="spinner-text" *ngIf="message">{{ message }}</p>
      </div>
    </div>
  `,
  styleUrls: ['./spinner.component.scss']
})
export class SpinnerComponent {
  @Input() isLoading = true;
  @Input() diameter = 50;
  @Input() strokeWidth = 4;
  @Input() color: 'primary' | 'accent' | 'warn' = 'primary';
  @Input() message = '';
  @Input() containerClass = '';
}