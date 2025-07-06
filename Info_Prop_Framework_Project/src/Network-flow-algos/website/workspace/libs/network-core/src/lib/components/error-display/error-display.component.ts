import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-error-display',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="error-container" [class]="'error-' + type">
      <div class="error-icon">
        <span *ngIf="type === 'error'">⚠️</span>
        <span *ngIf="type === 'warning'">⚠️</span>
        <span *ngIf="type === 'info'">ℹ️</span>
      </div>
      <div class="error-content">
        <h4 *ngIf="title" class="error-title">{{ title }}</h4>
        <p class="error-message">{{ message }}</p>
        <div *ngIf="details" class="error-details">
          <button 
            class="details-toggle" 
            (click)="showDetails = !showDetails"
            type="button">
            {{ showDetails ? 'Hide' : 'Show' }} Details
          </button>
          <pre *ngIf="showDetails" class="details-content">{{ details }}</pre>
        </div>
      </div>
      <div class="error-actions">
        <button 
          *ngIf="showRetry" 
          class="retry-button" 
          (click)="onRetry()"
          type="button">
          Retry
        </button>
        <button 
          *ngIf="showDismiss" 
          class="dismiss-button" 
          (click)="onDismiss()"
          type="button">
          ×
        </button>
      </div>
    </div>
  `,
  styles: [`
    .error-container {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      padding: 1rem;
      border-radius: 8px;
      margin: 1rem 0;
      border-left: 4px solid;
    }

    .error-error {
      background-color: #fef2f2;
      border-left-color: #ef4444;
      color: #991b1b;
    }

    .error-warning {
      background-color: #fffbeb;
      border-left-color: #f59e0b;
      color: #92400e;
    }

    .error-info {
      background-color: #eff6ff;
      border-left-color: #3b82f6;
      color: #1e40af;
    }

    .error-icon {
      font-size: 1.5rem;
      flex-shrink: 0;
    }

    .error-content {
      flex: 1;
    }

    .error-title {
      margin: 0 0 0.5rem 0;
      font-size: 1.1rem;
      font-weight: 600;
    }

    .error-message {
      margin: 0;
      line-height: 1.5;
    }

    .error-details {
      margin-top: 1rem;
    }

    .details-toggle {
      background: none;
      border: 1px solid currentColor;
      color: inherit;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.875rem;
    }

    .details-toggle:hover {
      background-color: rgba(0, 0, 0, 0.05);
    }

    .details-content {
      margin-top: 0.5rem;
      padding: 0.75rem;
      background-color: rgba(0, 0, 0, 0.05);
      border-radius: 4px;
      font-size: 0.875rem;
      overflow-x: auto;
      white-space: pre-wrap;
    }

    .error-actions {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .retry-button, .dismiss-button {
      padding: 0.5rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.875rem;
    }

    .retry-button {
      background-color: currentColor;
      color: white;
    }

    .retry-button:hover {
      opacity: 0.9;
    }

    .dismiss-button {
      background: none;
      color: inherit;
      font-size: 1.25rem;
      padding: 0.25rem;
      width: 2rem;
      height: 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .dismiss-button:hover {
      background-color: rgba(0, 0, 0, 0.1);
    }
  `]
})
export class ErrorDisplayComponent {
  @Input() type: 'error' | 'warning' | 'info' = 'error';
  @Input() title = '';
  @Input() message = '';
  @Input() details = '';
  @Input() showRetry = false;
  @Input() showDismiss = true;

  @Output() retry = new EventEmitter<void>();
  @Output() dismiss = new EventEmitter<void>();

  showDetails = false;

  onRetry() {
    this.retry.emit();
  }

  onDismiss() {
    this.dismiss.emit();
  }
}