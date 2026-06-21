import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FlowWorkbenchStore } from '../flow-workbench.store';
import { FlowWorkbenchOptions } from '../flow-workbench.models';

@Component({
  selector: 'app-flow-config-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule
  ],
  templateUrl: './flow-config-page.component.html',
  styleUrl: './flow-config-page.component.scss'
})
export class FlowConfigPageComponent {
  readonly store = inject(FlowWorkbenchStore);

  readonly nodeBatchMode = signal<'set' | 'scale'>('set');
  readonly edgeBatchMode = signal<'set' | 'scale'>('set');
  readonly sourceBatchMode = signal<'set' | 'scale'>('set');
  readonly nodeBatchValue = signal(0);
  readonly edgeBatchValue = signal(0);
  readonly sourceBatchValue = signal(1);

  setNumberOption(key: keyof FlowWorkbenchOptions, value: unknown): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    this.store.setOptionPatch({ [key]: parsed } as any);
  }

  runBatch(type: 'node' | 'edge' | 'source'): void {
    if (type === 'node') {
      this.store.applyBatch('node', this.nodeBatchMode(), this.nodeBatchValue());
      return;
    }
    if (type === 'edge') {
      this.store.applyBatch('edge', this.edgeBatchMode(), this.edgeBatchValue());
      return;
    }
    this.store.applyBatch('source', this.sourceBatchMode(), this.sourceBatchValue());
  }
}
