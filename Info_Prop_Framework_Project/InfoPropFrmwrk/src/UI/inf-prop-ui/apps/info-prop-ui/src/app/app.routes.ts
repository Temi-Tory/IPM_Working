import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', loadComponent: () => import('./home/home.component').then(m => m.HomeComponent) },
  { path: 'upload', loadComponent: () => import('./upload/upload-network.component').then(m => m.UploadNetworkComponent) },
  // Analysis components - visualization appears first
  { path: 'visualization', loadComponent: () => import('./analysis/network-visualization/network-visualization.component').then(m => m.NetworkVisualizationComponent) },
  { path: 'structure', loadComponent: () => import('./analysis/network-structure/network-structure.component').then(m => m.NetworkStructureComponent) },
  { path: 'diamonds', loadComponent: () => import('./analysis/diamond-analysis/diamond-analysis.component').then(m => m.DiamondAnalysisComponent) },
  { path: 'exact-inference', redirectTo: '/probability-propagation', pathMatch: 'full' },
  { path: 'probability-propagation', loadComponent: () => import('./analysis/exact-inference/exact-inference.component').then(m => m.ExactInferenceComponent) },
  // Capacity, Time, and Cost Analysis components
  { 
    path: 'capacity-analysis', 
    loadComponent: () => import('./analysis/capacity-v3/flow-workbench-shell.component').then(m => m.FlowWorkbenchShellComponent),
    children: [
      { path: '', redirectTo: 'config', pathMatch: 'full' },
      { path: 'config', loadComponent: () => import('./analysis/capacity-v3/pages/flow-config-page.component').then(m => m.FlowConfigPageComponent) },
      { path: 'summary', loadComponent: () => import('./analysis/capacity-v3/pages/flow-summary-page.component').then(m => m.FlowSummaryPageComponent) },
      { path: 'bottlenecks', loadComponent: () => import('./analysis/capacity-v3/pages/flow-bottlenecks-page.component').then(m => m.FlowBottlenecksPageComponent) },
      { path: 'visualization', loadComponent: () => import('./analysis/capacity-v3/pages/flow-visualization-page.component').then(m => m.FlowVisualizationPageComponent) },
      { path: 'scenarios', loadComponent: () => import('./analysis/capacity-v3/pages/flow-scenarios-page.component').then(m => m.FlowScenariosPageComponent) }
    ]
  },
  {
    path: 'capacity-analysis-v2',
    loadComponent: () => import('./analysis/capacity-v2/capacity-v2-sidenav-shell.component').then(m => m.CapacityV2SidenavShellComponent)
  },
  { path: 'capacity-analysis-legacy', loadComponent: () => import('./analysis/capacity-analysis/capacity-analysis.component').then(m => m.CapacityAnalysisComponent) },
  { path: 'time-analysis', loadComponent: () => import('./analysis/time-analysis/time-analysis.component').then(m => m.TimeAnalysisComponent) },
  { path: 'cost-analysis', loadComponent: () => import('./analysis/cost-analysis/cost-analysis.component').then(m => m.CostAnalysisComponent) },
  // System Profile - comprehensive analysis dashboard
  { path: 'system-profile', loadComponent: () => import('./analysis/system-profile/system-profile.component').then(m => m.SystemProfileComponent) },
  // Documentation
  { path: 'docs', loadComponent: () => import('./analysis/documentation/documentation.component').then(m => m.DocumentationComponent) },
]
