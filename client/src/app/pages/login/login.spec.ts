import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { LoginPage } from './login';

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let el: HTMLElement;
  let router: Router;
  let fakeAuth: { login: jasmine.Spy };

  beforeEach(() => {
    fakeAuth = { login: jasmine.createSpy('login') };
    TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [provideRouter([]), { provide: AuthService, useValue: fakeAuth }],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  /** Types into a form field the way a user would. */
  function type(selector: string, value: string): void {
    const input = el.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  /** Submits the form and updates the page. */
  function submit(): void {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('shows the logo at the bottom of the card', () => {
    expect(el.querySelector('.auth-logo')?.textContent).toContain('Fabulari');
  });

  it('asks for both fields when they are empty', () => {
    submit();
    expect(el.querySelector('.form-error')?.textContent).toContain('Enter your username or email and your password');
    expect(fakeAuth.login).not.toHaveBeenCalled();
  });

  it('signs in and goes to the home page', () => {
    fakeAuth.login.and.returnValue(of({ token: 't', user: { _id: 'u1', username: 'groupadmin', avatarUrl: null, role: 'groupAdmin' } }));
    type('input[formcontrolname=login]', 'groupadmin');
    type('input[formcontrolname=password]', '123');
    submit();
    expect(fakeAuth.login).toHaveBeenCalledWith('groupadmin', '123');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('trims spaces around the username', () => {
    fakeAuth.login.and.returnValue(of({ token: 't', user: {} }));
    type('input[formcontrolname=login]', '  groupadmin  ');
    type('input[formcontrolname=password]', '123');
    submit();
    expect(fakeAuth.login).toHaveBeenCalledWith('groupadmin', '123');
  });

  it('shows the error the server sends back', () => {
    fakeAuth.login.and.returnValue(throwError(() =>
      new HttpErrorResponse({ status: 401, error: { error: 'Username, email or password is incorrect' } })));
    type('input[formcontrolname=login]', 'groupadmin');
    type('input[formcontrolname=password]', 'wrong');
    submit();
    expect(el.querySelector('.form-error')?.textContent).toContain('Username, email or password is incorrect');
    expect(router.navigate).not.toHaveBeenCalled();
  });
});