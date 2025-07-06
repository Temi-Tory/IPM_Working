import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

export interface SpinnerConfig {
  message?: string;
  showCancelButton?: boolean;
  cancelButtonText?: string;
  allowBackdropClick?: boolean;
}

export interface SpinnerInstance {
  id: string;
  config: SpinnerConfig;
  cancellationToken: Subject<void>;
}

@Injectable({
  providedIn: 'root'
})
export class SpinnerService {
  private activeSpinners = new BehaviorSubject<SpinnerInstance[]>([]);
  private spinnerCounter = 0;

  /**
   * Show a spinner with optional configuration
   * @param config Spinner configuration options
   * @returns Object with spinner ID and cancellation token
   */
  show(config: SpinnerConfig = {}): { id: string; cancellationToken: Observable<void> } {
    const spinnerId = `spinner-${++this.spinnerCounter}`;
    const cancellationToken = new Subject<void>();
    
    const defaultConfig: SpinnerConfig = {
      message: 'Loading...',
      showCancelButton: true,
      cancelButtonText: 'Cancel',
      allowBackdropClick: false,
      ...config
    };

    const spinnerInstance: SpinnerInstance = {
      id: spinnerId,
      config: defaultConfig,
      cancellationToken
    };

    const currentSpinners = this.activeSpinners.value;
    this.activeSpinners.next([...currentSpinners, spinnerInstance]);

    return {
      id: spinnerId,
      cancellationToken: cancellationToken.asObservable()
    };
  }

  /**
   * Hide a specific spinner by ID
   * @param spinnerId The ID of the spinner to hide
   */
  hide(spinnerId: string): void {
    const currentSpinners = this.activeSpinners.value;
    const spinnerToRemove = currentSpinners.find(s => s.id === spinnerId);
    
    if (spinnerToRemove) {
      // Complete the cancellation token
      spinnerToRemove.cancellationToken.complete();
      
      // Remove from active spinners
      const updatedSpinners = currentSpinners.filter(s => s.id !== spinnerId);
      this.activeSpinners.next(updatedSpinners);
    }
  }

  /**
   * Cancel a specific spinner (triggers cancellation token)
   * @param spinnerId The ID of the spinner to cancel
   */
  cancel(spinnerId: string): void {
    const currentSpinners = this.activeSpinners.value;
    const spinnerToCancel = currentSpinners.find(s => s.id === spinnerId);
    
    if (spinnerToCancel) {
      // Emit cancellation signal
      spinnerToCancel.cancellationToken.next();
      // Hide the spinner
      this.hide(spinnerId);
    }
  }

  /**
   * Hide all active spinners
   */
  hideAll(): void {
    const currentSpinners = this.activeSpinners.value;
    currentSpinners.forEach(spinner => {
      spinner.cancellationToken.complete();
    });
    this.activeSpinners.next([]);
  }

  /**
   * Cancel all active spinners (triggers all cancellation tokens)
   */
  cancelAll(): void {
    const currentSpinners = this.activeSpinners.value;
    currentSpinners.forEach(spinner => {
      spinner.cancellationToken.next();
      spinner.cancellationToken.complete();
    });
    this.activeSpinners.next([]);
  }

  /**
   * Get observable of active spinners
   */
  getActiveSpinners(): Observable<SpinnerInstance[]> {
    return this.activeSpinners.asObservable();
  }

  /**
   * Check if any spinner is currently active
   */
  isActive(): Observable<boolean> {
    return new Observable(observer => {
      this.activeSpinners.subscribe(spinners => {
        observer.next(spinners.length > 0);
      });
    });
  }

  /**
   * Get the count of active spinners
   */
  getActiveCount(): Observable<number> {
    return new Observable(observer => {
      this.activeSpinners.subscribe(spinners => {
        observer.next(spinners.length);
      });
    });
  }

  /**
   * Update the configuration of an active spinner
   * @param spinnerId The ID of the spinner to update
   * @param config New configuration to apply
   */
  updateConfig(spinnerId: string, config: Partial<SpinnerConfig>): void {
    const currentSpinners = this.activeSpinners.value;
    const spinnerIndex = currentSpinners.findIndex(s => s.id === spinnerId);
    
    if (spinnerIndex !== -1) {
      const updatedSpinners = [...currentSpinners];
      updatedSpinners[spinnerIndex] = {
        ...updatedSpinners[spinnerIndex],
        config: { ...updatedSpinners[spinnerIndex].config, ...config }
      };
      this.activeSpinners.next(updatedSpinners);
    }
  }
}
