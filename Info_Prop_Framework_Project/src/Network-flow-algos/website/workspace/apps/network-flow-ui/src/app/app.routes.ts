import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: '/network-setup',
    pathMatch: 'full'
  },
  {
    path: 'network-setup',
    loadComponent: () => import('./pages/network-setup/network-setup.component').then(m => m.NetworkSetupComponent)
  },
  {
    path: 'visualization',
    loadComponent: () => import('./pages/visualization/visualization.component').then(m => m.VisualizationComponent)
  }
];
