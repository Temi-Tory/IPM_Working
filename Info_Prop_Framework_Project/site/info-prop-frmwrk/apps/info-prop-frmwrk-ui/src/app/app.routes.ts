import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  { path: '', redirectTo: '/upload', pathMatch: 'full' },
  { path: 'upload', loadComponent: () => import('./pages/upload/upload.component',).then(m => m.UploadComponent) },
  { path: 'parameters', loadComponent: () => import('./pages/parameters/parameters.component').then(m => m.ParametersComponent) },
  { path: 'network-structure', loadComponent: () => import('./pages/network-structure/network-structure.component').then(m => m.NetworkStructureComponent) },
  { path: 'visualization', loadComponent: () => import('./pages/visualization/visualization.component').then(m => m.VisualizationComponent) },
  { path: 'diamond-analysis', loadComponent: () => import('./pages/diamond-analysis/diamond-analysis.component').then(m => m.DiamondAnalysisComponent) },
  { path: 'reachability', loadComponent: () => import('./pages/reachability/reachability.component').then(m => m.ReachabilityComponent) },
  { path: 'critical-path', loadComponent: () => import('./pages/critical-path/critical-path.component').then(m => m.CriticalPathComponent) },
  { path: '**', redirectTo: '/upload' }
];
