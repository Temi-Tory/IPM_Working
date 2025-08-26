import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', loadComponent: () => import('./home/home.component').then(m => m.HomeComponent) },
  { path: 'upload', loadComponent: () => import('./upload/upload-network.component').then(m => m.UploadNetworkComponent) },
  // Analysis components
  { path: 'structure', loadComponent: () => import('./analysis/network-structure/network-structure.component').then(m => m.NetworkStructureComponent) },
  { path: 'diamonds', redirectTo: '/upload' },
  { path: 'reachability', redirectTo: '/upload' },
  { path: 'inference', redirectTo: '/upload' },
  { path: 'flow', redirectTo: '/upload' },
  { path: 'critical-path', redirectTo: '/upload' },
  { path: 'system-profile', redirectTo: '/upload' },
];
