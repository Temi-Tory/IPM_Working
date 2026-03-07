import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CapacityV2Interval } from '../capacity-v2.models';
import { MatCardModule } from '@angular/material/card';
import { CapacityV2Store } from '../capacity-v2.store';

@Component({
  selector: 'app-capacity-v2-uncertainty-page',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  templateUrl: './capacity-v2-uncertainty-page.component.html',
  styleUrl: './capacity-v2-uncertainty-page.component.scss'
})
export class CapacityV2UncertaintyPageComponent {
  readonly store = inject(CapacityV2Store);

  getThroughputValue(throughput: number | CapacityV2Interval): number {
    return typeof throughput === 'number' ? throughput : throughput.max;
  }
}
