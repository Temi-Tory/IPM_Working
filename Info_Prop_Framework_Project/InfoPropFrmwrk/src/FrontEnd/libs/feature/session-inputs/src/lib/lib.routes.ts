import { Route } from '@angular/router';
import { FeatureSessionInputs } from './feature-session-inputs/feature-session-inputs';

export const featureSessionInputsRoutes: Route[] = [
  { path: '', pathMatch: 'full', redirectTo: 'reliability' },
  { path: ':kind', component: FeatureSessionInputs, title: 'Add inputs' },
];
