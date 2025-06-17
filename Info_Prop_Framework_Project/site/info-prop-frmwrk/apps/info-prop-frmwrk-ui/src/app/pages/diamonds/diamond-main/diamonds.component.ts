import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { Subject, takeUntil } from 'rxjs';

import { DataService, NetworkData, DiamondData } from '../../../services/data.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-diamonds',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule
  ],
    templateUrl: './diamonds.component.html',
    styleUrls: ['./diamonds.component.scss']
})
export class DiamondsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private dataService = inject(DataService);
  private router = inject(Router);

  networkData: NetworkData | null = null;
  diamondData: DiamondData | null = null;
  isLoading = false;

  ngOnInit(): void {
    this.dataService.networkData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.networkData = data;
      });

    this.dataService.diamondData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.diamondData = data;
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

  navigateToStructure(): void {
    this.router.navigate(['/structure']);
  }

  navigateToVisualization(): void {
    this.router.navigate(['/visualization']);
  }

  navigateToReachability(): void {
    this.router.navigate(['/reachability']);
  }

  runPlaceholderAnalysis(): void {
    // Placeholder for future diamond analysis
    console.log('Diamond analysis placeholder - will be implemented in Phase 5');
  }
}