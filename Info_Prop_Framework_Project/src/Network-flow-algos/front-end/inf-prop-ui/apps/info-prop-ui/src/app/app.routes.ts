import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', loadComponent: () => import('./home/home.component').then(m => m.HomeComponent) },
  { path: 'upload', loadComponent: () => import('./upload/upload-network.component').then(m => m.UploadNetworkComponent) },
  // Analysis components - visualization appears first
  { path: 'visualization', loadComponent: () => import('./analysis/network-visualization/network-visualization.component').then(m => m.NetworkVisualizationComponent) },
  { path: 'structure', loadComponent: () => import('./analysis/network-structure/network-structure.component').then(m => m.NetworkStructureComponent) },
/*   { path: 'diamonds', loadComponent: () => import('./analysis/diamond-analysis/diamond-analysis.component').then(m => m.DiamondAnalysisComponent) },
  { path: 'time-analysis', loadComponent: () => import('./analysis/critical-path-visualization/critical-path-visualization.component').then(m => m.CriticalPathVisualizationComponent) },
  { path: 'cost-analysis', loadComponent: () => import('./analysis/cost-analysis/cost-analysis.component').then(m => m.CostAnalysisComponent) },
  { path: 'exact-inference', loadComponent: () => import('./analysis/exact-inference/exact-inference.component').then(m => m.ExactInferenceComponent) },
  { path: 'flow', loadComponent: () => import('./analysis/flow-analysis/flow-analysis.component').then(m => m.FlowAnalysisComponent) }
 */]
