import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () =>
  inject(AuthService).isLoggedIn() || inject(Router).createUrlTree(['/login']);

export const guestGuard: CanActivateFn = () =>
  !inject(AuthService).isLoggedIn() || inject(Router).createUrlTree(['/']);

/** The chat area is for members and group admins. Super admins go to /admin. */
export const memberAreaGuard: CanActivateFn = () =>
  !inject(AuthService).isSuperAdmin() || inject(Router).createUrlTree(['/admin']);

export const superGuard: CanActivateFn = () =>
  inject(AuthService).isSuperAdmin() || inject(Router).createUrlTree(['/app']);

/** "/" sends people to the right place for their role. */
export const homeRedirect: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return router.createUrlTree(['/login']);
  return router.createUrlTree([auth.isSuperAdmin() ? '/admin' : '/app']);
};
