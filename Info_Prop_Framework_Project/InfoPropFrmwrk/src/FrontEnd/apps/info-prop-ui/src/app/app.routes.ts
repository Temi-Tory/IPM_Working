import { Route } from '@angular/router';
import { networkLoadedGuard } from './core/network-loaded.guard';

/**
 * Guided but not gated: a toolkit route unlocks once a network is loaded (the
 * `networkLoadedGuard` redirects to /upload otherwise), but any unlocked route
 * is reachable directly and the router preserves scroll / view state across
 * navigation. The nav rail disables links that are not yet reachable rather
 * than hiding them.
 */
export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  {
    path: 'home',
    title: 'Information Propagation Framework',
    loadComponent: () =>
      import('./pages/home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'upload',
    title: 'Upload a network',
    loadComponent: () =>
      import('./pages/upload/upload.page').then((m) => m.UploadPage),
  },
  {
    path: 'network',
    title: 'Network',
    canActivate: [networkLoadedGuard],
    loadComponent: () =>
      import('./pages/network/network.page').then((m) => m.NetworkPage),
  },
  {
    path: 'docs',
    pathMatch: 'full',
    redirectTo: 'docs/overview',
  },
  {
    // No `networkLoadedGuard` — the manual has to open before a network is
    // loaded, not just after; that is the point of a manual.
    path: 'docs/:topic',
    title: 'Documentation',
    loadComponent: () =>
      import('./pages/docs/docs.page').then((m) => m.DocsPage),
  },
  {
    path: 'reliability',
    canActivate: [networkLoadedGuard],
    loadChildren: () =>
      import('@inf-prop/feature/reliability').then(
        (m) => m.featureReliabilityRoutes,
      ),
  },
  {
    path: 'diamonds',
    canActivate: [networkLoadedGuard],
    loadChildren: () =>
      import('@inf-prop/feature/reliability').then(
        (m) => m.featureDiamondsRoutes,
      ),
  },
  {
    path: 'flow',
    canActivate: [networkLoadedGuard],
    loadChildren: () =>
      import('@inf-prop/feature/flow').then((m) => m.featureFlowRoutes),
  },
  {
    path: 'schedule',
    canActivate: [networkLoadedGuard],
    loadChildren: () =>
      import('@inf-prop/feature/schedule').then((m) => m.featureScheduleRoutes),
  },
  {
    path: 'inputs',
    canActivate: [networkLoadedGuard],
    loadChildren: () =>
      import('@inf-prop/feature/session-inputs').then(
        (m) => m.featureSessionInputsRoutes,
      ),
  },
  {
    path: 'system-profile',
    canActivate: [networkLoadedGuard],
    loadChildren: () =>
      import('@inf-prop/feature/system-profile').then(
        (m) => m.featureSystemProfileRoutes,
      ),
  },
  { path: '**', redirectTo: 'home' },
];
