import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FlowWorkbenchStore } from '../flow-workbench.store';

@Component({
  selector: 'app-flow-scenarios-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './flow-scenarios-page.component.html',
  styleUrl: './flow-scenarios-page.component.scss'
})
export class FlowScenariosPageComponent {
  readonly store = inject(FlowWorkbenchStore);
  readonly draftName = signal('');
  readonly persistToSession = signal(true);

  save(): void {
    this.store.saveDraftScenario(this.draftName(), this.persistToSession());
    this.draftName.set('');
  }

  countKeys(value: Record<string, number>): number {
    return Object.keys(value ?? {}).length;
  }
}
