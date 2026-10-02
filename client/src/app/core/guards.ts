import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Only signed-in users. */
export const authGuard: CanActivateFn = () =>
  inject(AuthService).isLoggedIn() || inject(Router).createUrlTree(['/login']);

/** Only signed-out visitors (sign-in and sign-up pages). */
export const guestGuard: CanActivateFn = () =>
  !inject(AuthService).isLoggedIn() || inject(Router).createUrlTree(['/']);

/** The chat area is for members and group admins. Super admins go to /admin. */
export const memberAreaGuard: CanActivateFn = () =>
  !inject(AuthService).isSuperAdmin() || inject(Router).createUrlTree(['/admin']);

/** Only super admins. */
export const superGuard: CanActivateFn = () =>
  inject(AuthService).isSuperAdmin() || inject(Router).createUrlTree(['/app']);

/** sends people to the right place for their role. */
export const homeRedirect: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return router.createUrlTree(['/login']);
  return router.createUrlTree([auth.isSuperAdmin() ? '/admin' : '/app']);
};

/** On a brand new install, sign-in and sign-up send people to set up the super admin first. */
export const setupGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService).bootstrapStatus().pipe(
    map(({ needed }) => (needed ? router.createUrlTree(['/bootstrap']) : true)),
    catchError(() => of(true)),
  );
};

/** The setup page only exists until the super admin has been created. */
export const bootstrapPageGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService).bootstrapStatus().pipe(
    map(({ needed }) => (needed ? true : router.createUrlTree(['/login']))),
    catchError(() => of(true)),
  );
};