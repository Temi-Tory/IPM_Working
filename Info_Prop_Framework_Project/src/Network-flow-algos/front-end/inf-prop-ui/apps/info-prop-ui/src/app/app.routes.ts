import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', loadComponent: () => import('./home/home.component').then(m => m.HomeComponent) },
  { path: 'upload', loadComponent: () => import('./upload/upload-network.component').then(m => m.UploadNetworkComponent) },
  // Placeholder routes for future components - redirect to home until implemented
  { path: 'structure', redirectTo: '/home' },
  { path: 'diamonds', redirectTo: '/home' },
  { path: 'inference', redirectTo: '/home' },
  { path: 'flow', redirectTo: '/home' },
  { path: 'critical-path', redirectTo: '/home' },
  { path: 'system-profile', redirectTo: '/home' },
];
