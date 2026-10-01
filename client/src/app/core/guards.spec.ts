import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { authGuard, guestGuard, homeRedirect, memberAreaGuard, superGuard } from './guards';
import { Role } from './models';

/** Sets up a fake signed-in user with the given role, or a signed-out visitor for null. */
function signInAs(role: Role | null): void {
  const fakeAuth = {
    isLoggedIn: signal(role !== null),
    isSuperAdmin: signal(role === 'superAdmin'),
  };
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthService, useValue: fakeAuth }],
  });
}

/** Runs a guard and returns true, or the URL it redirects to. */
function check(guard: CanActivateFn): string | boolean {
  const result = TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
  return result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : (result as boolean);
}

describe('Route guards', () => {
  it('authGuard lets signed-in users through', () => {
    signInAs('user');
    expect(check(authGuard)).toBeTrue();
  });

  it('authGuard sends signed-out visitors to the sign-in page', () => {
    signInAs(null);
    expect(check(authGuard)).toBe('/login');
  });

  it('guestGuard sends signed-in users away from the sign-in page', () => {
    signInAs('user');
    expect(check(guestGuard)).toBe('/');
  });

  it('memberAreaGuard lets members into the chat area', () => {
    signInAs('groupAdmin');
    expect(check(memberAreaGuard)).toBeTrue();
  });

  it('memberAreaGuard sends super admins to the admin console', () => {
    signInAs('superAdmin');
    expect(check(memberAreaGuard)).toBe('/admin');
  });

  it('superGuard keeps members out of the admin console', () => {
    signInAs('user');
    expect(check(superGuard)).toBe('/app');
  });

  it('homeRedirect sends signed-out visitors to sign in', () => {
    signInAs(null);
    expect(check(homeRedirect)).toBe('/login');
  });

  it('homeRedirect sends super admins to the admin console', () => {
    signInAs('superAdmin');
    expect(check(homeRedirect)).toBe('/admin');
  });

  it('homeRedirect sends members to the chat area', () => {
    signInAs('groupAdmin');
    expect(check(homeRedirect)).toBe('/app');
  });
});