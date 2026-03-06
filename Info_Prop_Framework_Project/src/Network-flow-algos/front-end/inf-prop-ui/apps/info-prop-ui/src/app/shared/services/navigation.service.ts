import { Injectable, inject, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AnalysisStateService } from './analysis-state.service';
import { FileManagerService } from './file-manager.service';

export interface NavigationStep {
  id: string;
  route: string;
  title: string;
  subtitle: string;
  icon: string;
  requiredData?: 'networkData' | 'analysisResults';
  order: number;
}

export interface ComponentNavigation {
  canGoNext: boolean;
  canGoPrevious: boolean;
  nextStep: NavigationStep | null;
  previousStep: NavigationStep | null;
  currentStep: NavigationStep | null;
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class NavigationService {
  private router = inject(Router);
  private analysisState = inject(AnalysisStateService);
  private fileManager = inject(FileManagerService);

  // Define the analysis pipeline flow
  private readonly analysisSteps: NavigationStep[] = [
    {
      id: 'home',
      route: '/home',
      title: 'Home',
      subtitle: 'Start your analysis',
      icon: 'home',
      order: 0
    },
    {
      id: 'upload',
      route: '/upload',
      title: 'Upload Network',
      subtitle: 'Import network files',
      icon: 'cloud_upload',
      order: 1
    },
    {
      id: 'network-visualization',
      route: '/visualization',
      title: 'Network Visualization',
      subtitle: 'Interactive graph visualization',
      icon: 'bubble_chart',
      requiredData: 'networkData',
      order: 2
    },
    {
      id: 'network-structure',
      route: '/structure',
      title: 'Network Structure',
      subtitle: 'Graph topology & analysis',
      icon: 'account_tree',
      requiredData: 'networkData',
      order: 3
    },
    {
      id: 'diamond-analysis',
      route: '/diamonds',
      title: 'Diamond Analysis',
      subtitle: 'Structural optimization patterns',
      icon: 'diamond',
      requiredData: 'networkData',
      order: 4
    },
    {
      id: 'exact-inference',
      route: '/exact-inference',
      title: 'Exact Inference',
      subtitle: 'Belief propagation analysis',
      icon: 'psychology',
      requiredData: 'networkData',
      order: 5
    },
    {
      id: 'capacity-analysis',
      route: '/capacity-analysis',
      title: 'Capacity Analysis',
      subtitle: 'Flow analysis & bottleneck detection',
      icon: 'timeline',
      requiredData: 'networkData',
      order: 6
    },
    {
      id: 'capacity-analysis-shell',
      route: '/capacity-analysis-shell',
      title: 'Capacity Analysis Shell',
      subtitle: 'Flow analysis & bottleneck detection',
      icon: 'timeline',
      requiredData: 'networkData',
      order: 6
    },
    {
      id: 'time-analysis',
      route: '/time-analysis',
      title: 'Time Analysis',
      subtitle: 'Schedule optimization & timing',
      icon: 'schedule',
      requiredData: 'networkData',
      order: 7
    },
    {
      id: 'cost-analysis',
      route: '/cost-analysis',
      title: 'Cost Analysis',
      subtitle: 'Resource allocation & cost optimization',
      icon: 'attach_money',
      requiredData: 'networkData',
      order: 8
    },
    {
      id: 'system-profile',
      route: '/system-profile',
      title: 'System Profile',
      subtitle: 'Complete analysis summary',
      icon: 'dashboard',
      requiredData: 'networkData',
      order: 9
    }
  ];

  private currentStepSignal = signal<NavigationStep | null>(null);

  // Computed navigation state
  readonly currentStep = computed(() => this.currentStepSignal());
  
  readonly navigationContext = computed((): ComponentNavigation => {
    const current = this.currentStepSignal();
    if (!current) {
      return {
        canGoNext: false,
        canGoPrevious: false,
        nextStep: null,
        previousStep: null,
        currentStep: null,
        progress: { current: 0, total: this.analysisSteps.length, percentage: 0 }
      };
    }

    const currentIndex = this.analysisSteps.findIndex(step => step.id === current.id);
    const nextStep = this.getNextAvailableStep(currentIndex);
    const previousStep = this.getPreviousAvailableStep(currentIndex);

    return {
      canGoNext: nextStep !== null,
      canGoPrevious: previousStep !== null,
      nextStep,
      previousStep,
      currentStep: current,
      progress: {
        current: currentIndex + 1,
        total: this.analysisSteps.length,
        percentage: ((currentIndex + 1) / this.analysisSteps.length) * 100
      }
    };
  });

  // Get all steps for navigation display
  getAllSteps(): NavigationStep[] {
    return [...this.analysisSteps].sort((a, b) => a.order - b.order);
  }

  // Set current step (called by components or route changes)
  setCurrentStep(stepId: string): void {
    const step = this.analysisSteps.find(s => s.id === stepId);
    if (step) {
      this.currentStepSignal.set(step);
    }
  }

  // Navigate to next available step
  goToNext(): void {
    const context = this.navigationContext();
    if (context.canGoNext && context.nextStep) {
      this.router.navigate([context.nextStep.route]);
    }
  }

  // Navigate to previous available step
  goToPrevious(): void {
    const context = this.navigationContext();
    if (context.canGoPrevious && context.previousStep) {
      this.router.navigate([context.previousStep.route]);
    }
  }

  // Navigate to specific step if available
  goToStep(stepId: string): void {
    const step = this.analysisSteps.find(s => s.id === stepId);
    if (step && this.isStepAvailable(step)) {
      this.router.navigate([step.route]);
    }
  }

  // Check if step is available based on required data and file manager state
  isStepAvailable(step: NavigationStep): boolean {
    if (!step.requiredData) return true;

    const hasUploadedFiles = this.fileManager.uploadedFiles().length > 0;

    switch (step.requiredData) {
      case 'networkData':
        // Network data steps are available if we have uploaded files OR existing network data
        return this.analysisState.networkData() !== null || hasUploadedFiles;
      case 'analysisResults':
        return this.analysisState.analysisResults() !== null;
      default:
        return true;
    }
  }

  // NEW: Check if specific analysis step is available based on file groups
  isAnalysisStepAvailable(stepId: string): boolean {
    const analysisGroups = this.fileManager.analysisGroups();
    
    switch (stepId) {
      case 'network-structure':
        return analysisGroups.network.canRunAnalysis;
      case 'diamond-analysis':
      case 'exact-inference':
        return analysisGroups.reachability.some(g => g.canRunAnalysis);
      case 'capacity-analysis':
        return analysisGroups.capacity.some(g => g.canRunAnalysis);
      case 'time-analysis':
      case 'cost-analysis':
        return analysisGroups.cpm.some(g => g.canRunAnalysis);
      case 'system-profile':
        return analysisGroups.network.canRunAnalysis ||
               analysisGroups.reachability.some(g => g.canRunAnalysis) ||
               analysisGroups.capacity.some(g => g.canRunAnalysis) ||
               analysisGroups.cpm.some(g => g.canRunAnalysis);
      default:
        return true;
    }
  }

  // Get step completion status
  getStepStatus(stepId: string): 'completed' | 'current' | 'available' | 'locked' {
    const current = this.currentStepSignal();
    
    // Check completion status from analysis state
    switch (stepId) {
      case 'upload':
        if (this.analysisState.uploadTab().completed) return 'completed';
        break;
      case 'network-structure':
        if (this.analysisState.networkStructureTab().completed) return 'completed';
        break;
      case 'diamond-analysis':
        if (this.analysisState.diamondAnalysisTab().completed) return 'completed';
        break;
      case 'exact-inference':
        if (this.analysisState.exactInferenceTab().completed) return 'completed';
        break;
      case 'capacity-analysis':
        if (this.analysisState.capacityAnalysisTab().completed) return 'completed';
        break;
      case 'time-analysis':
      case 'cost-analysis':
        if (this.analysisState.criticalPathTab().completed) return 'completed';
        break;
      case 'system-profile':
        if (this.analysisState.systemProfileTab().completed) return 'completed';
        break;
    }

    // Check if current step
    if (current && current.id === stepId) return 'current';

    // Check if available
    const step = this.analysisSteps.find(s => s.id === stepId);
    if (step && this.isStepAvailable(step)) return 'available';

    return 'locked';
  }

  private getNextAvailableStep(currentIndex: number): NavigationStep | null {
    for (let i = currentIndex + 1; i < this.analysisSteps.length; i++) {
      const step = this.analysisSteps[i];
      if (this.isStepAvailable(step)) {
        return step;
      }
    }
    return null;
  }

  private getPreviousAvailableStep(currentIndex: number): NavigationStep | null {
    for (let i = currentIndex - 1; i >= 0; i--) {
      const step = this.analysisSteps[i];
      // Previous steps are always available if they exist
      return step;
    }
    return null;
  }
}