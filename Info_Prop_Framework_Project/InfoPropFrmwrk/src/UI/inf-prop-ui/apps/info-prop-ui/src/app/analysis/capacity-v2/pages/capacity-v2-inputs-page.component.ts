import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { CapacityV2InputComponent } from '../capacity-v2-input.component';
import { CapacityV2Store } from '../capacity-v2.store';

@Component({
  selector: 'app-capacity-v2-inputs-page',
  standalone: true,
  imports: [CommonModule, MatCardModule, CapacityV2InputComponent],
  template: `
    <div class="inputs-page">
      <app-capacity-v2-input />
    </div>
  `,
  styles: [`
    .inputs-page {
      max-width: 1400px;
    }

    ::ng-deep app-capacity-v2-input .input-container {
      max-width: none;
    }
  `]
})
export class CapacityV2InputsPageComponent {
  readonly store = inject(CapacityV2Store);
}
