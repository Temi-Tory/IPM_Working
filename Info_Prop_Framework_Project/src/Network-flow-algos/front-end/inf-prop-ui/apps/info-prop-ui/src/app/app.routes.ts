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
  { 
    path: 'capacity-analysis', 
    loadComponent: () => import('./analysis/capacity-v2/capacity-v2-sidenav-shell.component').then(m => m.CapacityV2SidenavShellComponent),
    children: [
      { path: '', redirectTo: 'inputs', pathMatch: 'full' },
      { path: 'overview', redirectTo: 'summary', pathMatch: 'full' },
      { path: 'inputs', loadComponent: () => import('./analysis/capacity-v2/pages/capacity-v2-inputs-page.component').then(m => m.CapacityV2InputsPageComponent) },
      { path: 'summary', loadComponent: () => import('./analysis/capacity-v2/pages/capacity-v2-performance-page.component').then(m => m.CapacityV2PerformancePageComponent) },
      { path: 'visualization', loadComponent: () => import('./analysis/capacity-v2/pages/capacity-v2-visualization-page.component').then(m => m.CapacityV2VisualizationPageComponent) },
      { path: 'bottlenecks', loadComponent: () => import('./analysis/capacity-v2/pages/capacity-v2-bottlenecks-page.component').then(m => m.CapacityV2BottlenecksPageComponent) },
      { path: 'upgrades', loadComponent: () => import('./analysis/capacity-v2/pages/capacity-v2-upgrades-page.component').then(m => m.CapacityV2UpgradesPageComponent) },
      { path: 'paths', loadComponent: () => import('./analysis/capacity-v2/pages/capacity-v2-paths-page.component').then(m => m.CapacityV2PathsPageComponent) },
      { path: 'flows', loadComponent: () => import('./analysis/capacity-v2/pages/capacity-v2-flows-page.component').then(m => m.CapacityV2FlowsPageComponent) },
      { path: 'export', loadComponent: () => import('./analysis/capacity-v2/pages/capacity-v2-export-page.component').then(m => m.CapacityV2ExportPageComponent) }
    ]
  },
  { path: 'capacity-analysis-legacy', loadComponent: () => import('./analysis/capacity-analysis/capacity-analysis.component').then(m => m.CapacityAnalysisComponent) },
  { path: 'time-analysis', loadComponent: () => import('./analysis/time-analysis/time-analysis.component').then(m => m.TimeAnalysisComponent) },
  { path: 'cost-analysis', loadComponent: () => import('./analysis/cost-analysis/cost-analysis.component').then(m => m.CostAnalysisComponent) },
  // System Profile - comprehensive analysis dashboard
  { path: 'system-profile', loadComponent: () => import('./analysis/system-profile/system-profile.component').then(m => m.SystemProfileComponent) },
  // Documentation
  { path: 'docs', loadComponent: () => import('./analysis/documentation/documentation.component').then(m => m.DocumentationComponent) },
]
