import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', loadComponent: () => import('./home/home.component').then(m => m.HomeComponent) },
  { path: 'upload', loadComponent: () => import('./upload/upload-network.component').then(m => m.UploadNetworkComponent) },
  // Analysis components - visualization appears first
  { path: 'visualization', loadComponent: () => import('./analysis/network-visualization/network-visualization.component').then(m => m.NetworkVisualizationComponent) },
  { path: 'structure', loadComponent: () => import('./analysis/network-structure/network-structure.component').then(m => m.NetworkStructureComponent) },
  { path: 'diamonds', loadComponent: () => import('./analysis/diamond-analysis/diamond-analysis.component').then(m => m.DiamondAnalysisComponent) },
  { path: 'exact-inference', loadComponent: () => import('./analysis/exact-inference/exact-inference.component').then(m => m.ExactInferenceComponent) },
  // Capacity, Time, and Cost Analysis components
  { path: 'capacity-analysis', loadComponent: () => import('./analysis/capacity-analysis/capacity-analysis.component').then(m => m.CapacityAnalysisComponent) },
  { path: 'time-analysis', loadComponent: () => import('./analysis/time-analysis/time-analysis.component').then(m => m.TimeAnalysisComponent) },
  { path: 'cost-analysis', loadComponent: () => import('./analysis/cost-analysis/cost-analysis.component').then(m => m.CostAnalysisComponent) },
  // System Profile - comprehensive analysis dashboard
  //{ path: 'system-profile', loadComponent: () => import('./analysis/system-profile/system-profile.component').then(m => m.SystemProfileComponent) }
]
