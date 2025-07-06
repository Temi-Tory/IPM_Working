import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: '/network-setup',
    pathMatch: 'full'
  },
  {
    path: 'network-setup',
    loadComponent: () => import('./pages/network-setup/network-upload.component').then(m => m.NetworkUploadComponent),
    data: { 
      title: 'Network Setup',
      description: 'Upload and configure your network data'
    }
  },
  {
    path: 'network-details',
    loadComponent: () => import('./pages/network-structure/network-details.component').then(m => m.NetworkDetailsComponent),
    data: { 
      title: 'Network Structure',
      description: 'View and analyze your network structure'
    }
  },
  {
    path: 'diamond-analysis',
    loadComponent: () => import('./pages/diamond-analysis/diamond-analysis.component').then(m => m.DiamondAnalysisComponent),
    data: { 
      title: 'Diamond Analysis',
      description: 'Perform diamond structure identification and classification'
    }
  },
  {
    path: 'reachability-analysis',
    loadComponent: () => import('./pages/reachability-analysis/reachability-analysis.component').then(m => m.ReachabilityAnalysisComponent),
    data: { 
      title: 'Reachability Analysis',
      description: 'Analyze node reachability with belief propagation'
    }
  },
  {
    path: 'monte-carlo',
    loadComponent: () => import('./pages/monte-carlo/monte-carlo.component').then(m => m.MonteCarloComponent),
    data: { 
      title: 'Monte Carlo Analysis',
      description: 'Perform Monte Carlo validation analysis'
    }
  },
  {
    path: 'results',
    loadComponent: () => import('./pages/results/results.component').then(m => m.ResultsComponent),
    data: { 
      title: 'Analysis Results',
      description: 'View and export analysis results'
    }
  },
  {
    path: '**',
    redirectTo: '/network-setup'
  }
];
