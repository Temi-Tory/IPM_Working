import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-monte-carlo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="component-container">
      <div class="component-header">
        <h1>Monte Carlo Analysis</h1>
        <p>Monte Carlo validation analysis will be implemented here.</p>
      </div>
      <div class="component-content">
        <p>Content will be scrollable when more content is added.</p>
      </div>
    </div>
  `,
  styles: []
})
export class MonteCarloComponent {
}