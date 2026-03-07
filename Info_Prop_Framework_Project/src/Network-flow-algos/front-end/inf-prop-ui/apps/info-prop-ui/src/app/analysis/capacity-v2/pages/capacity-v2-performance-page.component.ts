import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { CapacityV2Store } from '../capacity-v2.store';

@Component({
  selector: 'app-capacity-v2-performance-page',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatChipsModule],
  templateUrl: './capacity-v2-performance-page.component.html',
  styleUrl: './capacity-v2-performance-page.component.scss'
})
export class CapacityV2PerformancePageComponent {
  readonly store = inject(CapacityV2Store);

  hasMeaningfulEfficiencyLoss(value: number | null | undefined): boolean {
    return typeof value === 'number' && value > 0.0001;
  }
}
