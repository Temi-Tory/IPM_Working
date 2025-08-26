import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', loadComponent: () => import('./home/home.component').then(m => m.HomeComponent) },
  { path: 'upload', loadComponent: () => import('./upload/upload-network.component').then(m => m.UploadNetworkComponent) },
  // Analysis components
  { path: 'structure', loadComponent: () => import('./analysis/network-structure/network-structure.component').then(m => m.NetworkStructureComponent) },
  { path: 'diamonds', loadComponent: () => import('./analysis/diamond-analysis/diamond-analysis.component').then(m => m.DiamondAnalysisComponent) },
  { path: 'exact-inference', loadComponent: () => import('./analysis/reachability-analysis/reachability-analysis.component').then(m => m.ReachabilityAnalysisComponent) },
  { path: 'flow', loadComponent: () => import('./analysis/flow-analysis/flow-analysis.component').then(m => m.FlowAnalysisComponent) },
  { path: 'critical-path', loadComponent: () => import('./analysis/critical-path/critical-path.component').then(m => m.CriticalPathComponent) },
  { path: 'system-profile', loadComponent: () => import('./analysis/system-profile/system-profile.component').then(m => m.SystemProfileComponent) },
];
