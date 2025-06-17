import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  { path: '', redirectTo: '/upload', pathMatch: 'full' },
  { path: 'upload', loadComponent: () => import('./pages/upload/upload',).then(m => m.UploadComponent) },
  { path: 'parameters', loadComponent: () => import('./pages/parameters/parameters').then(m => m.ParametersComponent) },
  { path: 'network-structure', loadComponent: () => import('./pages/network-structure/network-structure').then(m => m.NetworkStructureComponent) },
  { path: 'visualization', loadComponent: () => import('./pages/visualization/visualization').then(m => m.VisualizationComponent) },
  { path: 'diamond-analysis', loadComponent: () => import('./pages/diamond-analysis/diamond-analysis').then(m => m.DiamondAnalysisComponent) },
  { path: 'reachability', loadComponent: () => import('./pages/reachability/reachability').then(m => m.ReachabilityComponent) },
  { path: 'critical-path', loadComponent: () => import('./pages/critical-path/critical-path').then(m => m.CriticalPathComponent) },
  { path: '**', redirectTo: '/upload' }
];
