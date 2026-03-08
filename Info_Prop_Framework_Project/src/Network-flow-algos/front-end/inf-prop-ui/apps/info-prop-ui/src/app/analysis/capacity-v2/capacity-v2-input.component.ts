import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { CapacityV2Store } from './capacity-v2.store';
import { CapacityV2InputRow } from './capacity-v2.models';

@Component({
  selector: 'app-capacity-v2-input',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatExpansionModule
  ],
  templateUrl: './capacity-v2-input.component.html',
  styleUrl: './capacity-v2-input.component.scss'
})
export class CapacityV2InputComponent {
  readonly store = inject(CapacityV2Store);

  onTargetNodesChange(value: number[]): void {
    this.store.setTargetNodes(value);
  }

  updateDeterministic(row: CapacityV2InputRow, value: string, type: 'node' | 'edge' | 'source', index: number): void {
    const parsed = this.parseNumber(value, row.deterministic);
    const updated: CapacityV2InputRow = { ...row, deterministic: parsed };
    this.pushRow(type, index, updated);
  }

  updateIntervalMin(row: CapacityV2InputRow, value: string, type: 'node' | 'edge' | 'source', index: number): void {
    const parsed = this.parseNumber(value, row.interval.min);
    const updated: CapacityV2InputRow = {
      ...row,
      interval: {
        min: Math.min(parsed, row.interval.max),
        max: Math.max(parsed, row.interval.max)
      }
    };
    this.pushRow(type, index, updated);
  }

  updateIntervalMax(row: CapacityV2InputRow, value: string, type: 'node' | 'edge' | 'source', index: number): void {
    const parsed = this.parseNumber(value, row.interval.max);
    const updated: CapacityV2InputRow = {
      ...row,
      interval: {
        min: Math.min(row.interval.min, parsed),
        max: Math.max(row.interval.min, parsed)
      }
    };
    this.pushRow(type, index, updated);
  }

  toggleOption(key: 'computeAllMinCuts' | 'enumerateCriticalPaths' | 'computeUpgradePriorities' | 'includeClassicalComparison', checked: boolean): void {
    this.store.setOptions({ [key]: checked });
  }

  trackByRow(_: number, row: CapacityV2InputRow): string {
    return row.key;
  }

  private pushRow(type: 'node' | 'edge' | 'source', index: number, row: CapacityV2InputRow): void {
    if (type === 'node') {
      this.store.updateNodeCapacity(index, row);
      return;
    }

    if (type === 'edge') {
      this.store.updateEdgeCapacity(index, row);
      return;
    }

    this.store.updateSourceRate(index, row);
  }

  private parseNumber(value: string, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}
