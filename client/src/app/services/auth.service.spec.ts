import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../core/config';
import { User } from '../core/models';
import { AuthService } from './auth.service';

const groupAdmin: User = { _id: 'u1', username: 'groupadmin', avatarUrl: null, role: 'groupAdmin' };

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear(); // start every test signed out
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  /** Signs in as the demo group admin through a faked server response. */
  function signIn(): void {
    service.login('groupadmin', '123').subscribe();
    http.expectOne(`${API_URL}/auth/login`).flush({ token: 'abc', user: groupAdmin });
  }

  it('starts signed out', () => {
    expect(service.isLoggedIn()).toBeFalse();
    expect(service.user()).toBeNull();
  });

  it('signs in with the username and password', () => {
    service.login('groupadmin', '123').subscribe();
    const req = http.expectOne(`${API_URL}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ login: 'groupadmin', password: '123' });
    req.flush({ token: 'abc', user: groupAdmin });

    expect(service.isLoggedIn()).toBeTrue();
    expect(service.token()).toBe('abc');
    expect(service.isGroupAdmin()).toBeTrue();
    expect(service.isSuperAdmin()).toBeFalse();
  });

  it('remembers the session after a page reload', () => {
    signIn();
    const reloaded = TestBed.runInInjectionContext(() => new AuthService());
    expect(reloaded.isLoggedIn()).toBeTrue();
    expect(reloaded.user()?.username).toBe('groupadmin');
  });

  it('forgets the session after signing out', () => {
    signIn();
    service.logout();
    expect(service.isLoggedIn()).toBeFalse();
    const reloaded = TestBed.runInInjectionContext(() => new AuthService());
    expect(reloaded.isLoggedIn()).toBeFalse();
  });

  it('stays signed out when the password is wrong', () => {
    service.login('groupadmin', 'wrong').subscribe({ error: () => {} });
    http.expectOne(`${API_URL}/auth/login`).flush(
      { error: 'Username, email or password is incorrect' },
      { status: 401, statusText: 'Unauthorized' },
    );
    expect(service.isLoggedIn()).toBeFalse();
  });

  it('sends sign-up details as form data and signs straight in', () => {
    const form = new FormData();
    form.append('username', 'newbie');
    service.register(form).subscribe();
    const req = http.expectOne(`${API_URL}/auth/register`);
    expect(req.request.body).toBe(form);
    req.flush({ token: 'xyz', user: { ...groupAdmin, username: 'newbie', role: 'user' } });

    expect(service.isLoggedIn()).toBeTrue();
    expect(service.isGroupAdmin()).toBeFalse();
  });
});
