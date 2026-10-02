import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { RegisterPage } from './register';

describe('RegisterPage', () => {
  let fixture: ComponentFixture<RegisterPage>;
  let el: HTMLElement;
  let router: Router;
  let fakeAuth: { register: jasmine.Spy };

  beforeEach(() => {
    fakeAuth = { register: jasmine.createSpy('register') };
    TestBed.configureTestingModule({
      imports: [RegisterPage],
      providers: [provideRouter([]), { provide: AuthService, useValue: fakeAuth }],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(RegisterPage);
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  /** Types into a form field the way a user would. */
  function type(name: string, value: string): void {
    const input = el.querySelector(`input[formcontrolname=${name}]`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  /** Fills every field with valid details, then changes any given in `changes`. */
  function fillForm(changes: Record<string, string> = {}): void {
    const values = { username: 'newuser', email: 'newuser@test.com', password: 'abc', birthdate: '2000-01-01', ...changes };
    for (const [name, value] of Object.entries(values)) type(name, value);
  }

  /** Submits the form and updates the page. */
  function submit(): void {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('shows the logo at the very bottom of the sign-up card', () => {
    const card = el.querySelector('.auth-card')!;
    expect(card.lastElementChild?.classList).toContain('auth-logo');
    expect(card.lastElementChild?.textContent).toContain('Fabulari');
  });

  it('rejects an invalid username before contacting the server', () => {
    fillForm({ username: 'x' });
    submit();
    expect(el.querySelector('.form-error')?.textContent).toContain('Choose a username');
    expect(fakeAuth.register).not.toHaveBeenCalled();
  });

  it('rejects an invalid email before contacting the server', () => {
    fillForm({ email: 'not-an-email' });
    submit();
    expect(el.querySelector('.form-error')?.textContent).toContain('Enter a valid email address');
    expect(fakeAuth.register).not.toHaveBeenCalled();
  });

  it('sends every field to the server and opens Find groups', () => {
    fakeAuth.register.and.returnValue(of({ token: 't', user: {} }));
    fillForm();
    submit();
    const form = fakeAuth.register.calls.mostRecent().args[0] as FormData;
    expect(form.get('username')).toBe('newuser');
    expect(form.get('email')).toBe('newuser@test.com');
    expect(form.get('birthdate')).toBe('2000-01-01');
    expect(router.navigate).toHaveBeenCalledWith(['/app/discover']);
  });
});