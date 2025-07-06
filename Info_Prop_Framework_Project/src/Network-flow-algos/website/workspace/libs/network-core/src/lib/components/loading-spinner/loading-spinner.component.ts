import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-loading-spinner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="loading-container" [class.overlay]="overlay">
      <div class="spinner-wrapper">
        <div class="spinner" [style.width.px]="size" [style.height.px]="size"></div>
        <p *ngIf="message" class="loading-message">{{ message }}</p>
      </div>
    </div>
  `,
  styles: [`
    .loading-container {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 2rem;
    }

    .loading-container.overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(255, 255, 255, 0.8);
      z-index: 9999;
    }

    .spinner-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .spinner {
      border: 3px solid #f3f3f3;
      border-top: 3px solid #3498db;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .loading-message {
      margin: 0;
      color: #666;
      font-size: 0.9rem;
    }
  `]
})
export class LoadingSpinnerComponent {
  @Input() size = 40;
  @Input() message = '';
  @Input() overlay = false;
}