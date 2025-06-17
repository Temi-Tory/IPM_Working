import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SpinnerService, SpinnerInstance } from './spinner-service/spinner-service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-spinner',
  standalone: true,
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './spinner.html',
  styleUrl: './spinner.scss',
})
export class Spinner implements OnInit, OnDestroy {
  activeSpinners: SpinnerInstance[] = [];
  private destroy$ = new Subject<void>();
  private spinnerService = inject(SpinnerService);

  ngOnInit(): void {
    this.spinnerService.getActiveSpinners()
      .pipe(takeUntil(this.destroy$))
      .subscribe(spinners => {
        this.activeSpinners = spinners;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onCancelSpinner(spinnerId: string): void {
    this.spinnerService.cancel(spinnerId);
  }

  onBackdropClick(event: MouseEvent, spinner: SpinnerInstance): void {
    // Only handle backdrop clicks if allowed in config
    if (spinner.config.allowBackdropClick) {
      // Check if the click was on the backdrop (not on the spinner container)
      const target = event.target as HTMLElement;
      if (target.classList.contains('spinner-overlay')) {
        this.spinnerService.cancel(spinner.id);
      }
    }
  }

  // Prevent clicks from propagating to backdrop when clicking on spinner container
  onSpinnerContainerClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  // Handle keyboard events on backdrop
  onBackdropKeydown(event: KeyboardEvent, spinner: SpinnerInstance): void {
    if (event.key === 'Escape' && spinner.config.allowBackdropClick) {
      this.spinnerService.cancel(spinner.id);
    }
  }

  // Prevent keyboard events from propagating to backdrop when on spinner container
  onSpinnerContainerKeydown(event: KeyboardEvent): void {
    event.stopPropagation();
  }

  // Track by function for ngFor performance
  trackBySpinnerId(index: number, spinner: SpinnerInstance): string {
    return spinner.id;
  }
}
