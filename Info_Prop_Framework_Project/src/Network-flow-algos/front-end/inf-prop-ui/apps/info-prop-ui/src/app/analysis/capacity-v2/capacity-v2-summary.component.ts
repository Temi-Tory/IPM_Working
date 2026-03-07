import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { CapacityV2Store } from './capacity-v2.store';

@Component({
  selector: 'app-capacity-v2-summary',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatChipsModule, MatButtonToggleModule],
  templateUrl: './capacity-v2-summary.component.html',
  styleUrl: './capacity-v2-summary.component.scss'
})
export class CapacityV2SummaryComponent {
  readonly store = inject(CapacityV2Store);

  onDetailSourceChange(event: MatButtonToggleChange): void {
    const source = event.value as 'worst' | 'best';
    this.store.setDetailSource(source);
  }
}
