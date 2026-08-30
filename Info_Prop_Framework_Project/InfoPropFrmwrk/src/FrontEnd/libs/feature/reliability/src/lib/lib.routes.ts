import { Route } from '@angular/router';
import { FeatureReliability } from './feature-reliability/feature-reliability';
import { FeatureDiamonds } from './feature-diamonds/feature-diamonds';

export const featureReliabilityRoutes: Route[] = [
  { path: '', component: FeatureReliability },
];

/** Registered at the app's own `/diamonds` path — a separate nav destination
 *  from Reliability, though it's the same lib/scope and reuses everything
 *  Reliability already built for diamond decomposition. */
export const featureDiamondsRoutes: Route[] = [
  { path: '', component: FeatureDiamonds },
];
