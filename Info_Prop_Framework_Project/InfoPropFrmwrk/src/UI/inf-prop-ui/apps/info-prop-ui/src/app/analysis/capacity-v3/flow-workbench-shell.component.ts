import { Component, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { FlowWorkbenchStore } from './flow-workbench.store';

@Component({
  selector: 'app-flow-workbench-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    FormsModule
  ],
  templateUrl: './flow-workbench-shell.component.html',
  styleUrl: './flow-workbench-shell.component.scss'
})
export class FlowWorkbenchShellComponent implements OnInit {
  private readonly router = inject(Router);
  readonly store = inject(FlowWorkbenchStore);

  readonly navItems = [
    { route: 'config', label: 'Configuration', icon: 'tune' },
    { route: 'summary', label: 'Summary', icon: 'insights' },
    { route: 'bottlenecks', label: 'Bottlenecks', icon: 'warning' },
    { route: 'visualization', label: 'Visualization', icon: 'hub' },
    { route: 'scenarios', label: 'Scenarios', icon: 'layers' }
  ];

  readonly hasResult = computed(() => Boolean(this.store.result()));

  ngOnInit(): void {
    this.store.initialize();
    if (this.router.url.endsWith('/capacity-analysis') || this.router.url.endsWith('/capacity-analysis/')) {
      this.router.navigate(['/capacity-analysis/config']);
    }
  }

  isActive(route: string): boolean {
    return this.router.url.includes(`/capacity-analysis/${route}`);
  }

  async run(): Promise<void> {
    await this.store.runSelectedScenario();
    if (this.store.runState() === 'success') {
      this.router.navigate(['/capacity-analysis/summary']);
    }
  }

  async runAll(): Promise<void> {
    await this.store.runAllScenarios();
    if (this.store.runState() === 'success') {
      this.router.navigate(['/capacity-analysis/summary']);
    }
  }
}
