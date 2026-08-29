import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { NetworkContextService } from '@inf-prop/shared/data-access';

/**
 * A toolkit route needs a loaded network. If none is loaded, send the user to
 * upload rather than showing a broken page. This is the only gate — everything
 * past it is freely navigable.
 */
export const networkLoadedGuard: CanActivateFn = () => {
  const ctx = inject(NetworkContextService);
  const router = inject(Router);
  return ctx.isLoaded() ? true : router.createUrlTree(['/upload']);
};
