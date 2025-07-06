import { Injectable, inject } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable, map } from 'rxjs';
import { GlobalStateService } from '../services/global-state.service';
import { WorkflowStep } from '../models/network.models';

/**
 * Guard to control access to workflow steps based on completion state
 * Ensures users follow the proper sequence through the analysis workflow
 */
@Injectable({
  providedIn: 'root'
})
export class WorkflowGuard implements CanActivate {
  private readonly globalState = inject(GlobalStateService);
  private readonly router = inject(Router);

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    const targetStep = this.getStepFromRoute(route);
    
    if (!targetStep) {
      // If we can't determine the step, allow access
      return true;
    }

    const workflowState = this.globalState.workflowState();
    const canAccess = workflowState.isStepAccessible(targetStep);
    
    if (!canAccess) {
      // Redirect to the appropriate step
      const redirectStep = this.getRedirectStep(workflowState.completedSteps);
      this.router.navigate([`/${redirectStep}`]);
      return false;
    }

    return true;
  }

  /**
   * Extract the workflow step from the route
   */
  private getStepFromRoute(route: ActivatedRouteSnapshot): WorkflowStep | null {
    const path = route.routeConfig?.path;
    
    if (!path) return null;

    // Map route paths to workflow steps
    const routeStepMap: Record<string, WorkflowStep> = {
      'network-setup': 'network-upload',
      'network-upload': 'network-upload',
      'network-structure': 'network-structure',
      'network-details': 'network-structure',
      'diamond-analysis': 'diamond-analysis',
      'reachability-analysis': 'reachability-analysis',
      'monte-carlo': 'monte-carlo',
      'results': 'results'
    };

    return routeStepMap[path] || null;
  }

  /**
   * Determine where to redirect based on completed steps
   */
  private getRedirectStep(completedSteps: WorkflowStep[]): string {
    if (completedSteps.length === 0) {
      return 'network-setup';
    }

    // Find the next logical step
    const stepOrder: WorkflowStep[] = [
      'network-upload',
      'network-structure',
      'diamond-analysis',
      'reachability-analysis',
      'monte-carlo',
      'results'
    ];

    for (const step of stepOrder) {
      if (!completedSteps.includes(step)) {
        return this.getRouteFromStep(step);
      }
    }

    // If all steps are completed, go to results
    return 'results';
  }

  /**
   * Map workflow steps to route paths
   */
  private getRouteFromStep(step: WorkflowStep): string {
    const stepRouteMap: Record<WorkflowStep, string> = {
      'network-upload': 'network-setup',
      'network-structure': 'network-details',
      'diamond-analysis': 'diamond-analysis',
      'reachability-analysis': 'reachability-analysis',
      'monte-carlo': 'monte-carlo',
      'results': 'results'
    };

    return stepRouteMap[step] || 'network-setup';
  }
}

/**
 * Guard specifically for steps that require a network to be uploaded
 */
@Injectable({
  providedIn: 'root'
})
export class NetworkRequiredGuard implements CanActivate {
  private readonly globalState = inject(GlobalStateService);
  private readonly router = inject(Router);

  canActivate(): Observable<boolean> | Promise<boolean> | boolean {
    const hasNetwork = this.globalState.hasNetworkData();
    if (!hasNetwork) {
      this.router.navigate(['/network-setup']);
      return false;
    }
    return true;
  }
}

/**
 * Guard for steps that require an active session
 */
@Injectable({
  providedIn: 'root'
})
export class SessionRequiredGuard implements CanActivate {
  private readonly globalState = inject(GlobalStateService);
  private readonly router = inject(Router);

  canActivate(): Observable<boolean> | Promise<boolean> | boolean {
    const hasSession = this.globalState.hasSession();
    if (!hasSession) {
      this.router.navigate(['/network-setup']);
      return false;
    }
    return true;
  }
}

/**
 * Guard for analysis steps that require specific previous analyses
 */
@Injectable({
  providedIn: 'root'
})
export class AnalysisRequiredGuard implements CanActivate {
  private readonly globalState = inject(GlobalStateService);
  private readonly router = inject(Router);

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean> | Promise<boolean> | boolean {
    const requiredAnalysis = route.data?.['requiredAnalysis'] as string;
    
    if (!requiredAnalysis) {
      return true;
    }

    const workflowState = this.globalState.workflowState();
    const hasRequired = workflowState.completedSteps.includes(requiredAnalysis as WorkflowStep);
    
    if (!hasRequired) {
      // Redirect to the required analysis step
      this.router.navigate([`/${requiredAnalysis}`]);
      return false;
    }
    
    return true;
  }
}

/**
 * Utility functions for workflow navigation
 */
export class WorkflowNavigationHelper {
  constructor(
    private globalState: GlobalStateService,
    private router: Router
  ) {}

  /**
   * Navigate to the next available step in the workflow
   */
  navigateToNextStep(): void {
    const workflowState = this.globalState.workflowState();
    const nextStep = this.getNextAvailableStep(workflowState.completedSteps);
    
    if (nextStep) {
      const route = this.getRouteFromStep(nextStep);
      this.router.navigate([`/${route}`]);
    }
  }

  /**
   * Navigate to a specific step if accessible
   */
  navigateToStep(step: WorkflowStep): boolean {
    const workflowState = this.globalState.workflowState();
    
    if (workflowState.isStepAccessible(step)) {
      const route = this.getRouteFromStep(step);
      this.router.navigate([`/${route}`]);
      return true;
    }
    
    return false;
  }

  /**
   * Get the next available step
   */
  private getNextAvailableStep(completedSteps: WorkflowStep[]): WorkflowStep | null {
    const stepOrder: WorkflowStep[] = [
      'network-upload',
      'network-structure',
      'diamond-analysis',
      'reachability-analysis',
      'monte-carlo',
      'results'
    ];

    for (const step of stepOrder) {
      if (!completedSteps.includes(step)) {
        return step;
      }
    }

    return null;
  }

  /**
   * Map workflow steps to route paths
   */
  private getRouteFromStep(step: WorkflowStep): string {
    const stepRouteMap: Record<WorkflowStep, string> = {
      'network-upload': 'network-setup',
      'network-structure': 'network-details',
      'diamond-analysis': 'diamond-analysis',
      'reachability-analysis': 'reachability-analysis',
      'monte-carlo': 'monte-carlo',
      'results': 'results'
    };

    return stepRouteMap[step] || 'network-setup';
  }
}