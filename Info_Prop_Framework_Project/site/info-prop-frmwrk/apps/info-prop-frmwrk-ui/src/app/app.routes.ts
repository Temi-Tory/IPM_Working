import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: '/upload',
    pathMatch: 'full'
  },
  {
    path: 'upload',
    loadComponent: () => import('./pages/landing/landing.component').then(m => m.LandingComponent),
    data: { title: 'File Upload', icon: 'upload_file' }
  },
  {
    path: 'structure',
    loadComponent: () => import('./pages/structure/structure.component').then(m => m.StructureComponent),
    data: { title: 'Structure Analysis', icon: 'account_tree', requiresFile: true }
  },
  {
    path: 'visualization',
    loadComponent: () => import('./pages/visualization/visualization.component').then(m => m.VisualizationComponent),
    data: { title: 'Network Visualization', icon: 'bubble_chart', requiresFile: true }
  },
  {
    path: 'diamonds',
    loadComponent: () => import('./pages/diamonds/diamond-main/diamonds.component').then(m => m.DiamondsComponent),
    data: { title: 'Diamond Analysis', icon: 'diamond', requiresFile: true, requiresStructure: true }
  },
  {
    path: 'reachability',
    loadComponent: () => import('./pages/reachability/reachability.component').then(m => m.ReachabilityComponent),
    data: { title: 'Reachability Analysis', icon: 'psychology', requiresFile: true, requiresStructure: true }
  },
  {
    path: 'comparison',
    loadComponent: () => import('./pages/comparison/comparison.component').then(m => m.ComparisonComponent),
    data: { title: 'Monte Carlo Comparison', icon: 'compare_arrows', requiresFile: true, requiresReachability: true }
  },
  {
    path: '**',
    redirectTo: '/upload'
  }
];