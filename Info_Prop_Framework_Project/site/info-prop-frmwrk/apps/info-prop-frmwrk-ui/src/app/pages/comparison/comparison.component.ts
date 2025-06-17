import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, takeUntil } from 'rxjs';

import { DataService, NetworkData, ReachabilityResults } from '../../services/data.service';
import { Router } from '@angular/router';
@Component({
  selector: 'app-reachability',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './comparison.component.html',
  styleUrls: ['./comparison.component.scss']
})
export class ComparisonComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private dataService = inject(DataService);
  private router = inject(Router);

  networkData: NetworkData | null = null;
  reachabilityResults: ReachabilityResults | null = null;
  isLoading = false;

  ngOnInit(): void {
    this.dataService.networkData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.networkData = data;
      });

    this.dataService.reachabilityResults$
      .pipe(takeUntil(this.destroy$))
      .subscribe(results => {
        this.reachabilityResults = results;
      });

    this.dataService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        this.isLoading = loading;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  navigateToReachability(): void {
    this.router.navigate(['/reachability']);
  }

  navigateToVisualization(): void {
    this.router.navigate(['/visualization']);
  }

  navigateToDiamonds(): void {
    this.router.navigate(['/diamonds']);
  }

  runPlaceholderComparison(): void {
    console.log('Monte Carlo comparison placeholder - will be implemented in Phase 6');
  }
}