import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Logo } from '../../components/logo';
import { errorMessage } from '../../core/error';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink, Logo],
  template: `
    <main class="auth-page">
      <section class="auth-card">
        <h1>Sign in</h1>
        <form [formGroup]="form" (ngSubmit)="submit()" class="stack" novalidate>
          <label class="field">
            <span>Username or email</span>
            <input formControlName="login" autocomplete="username" autocapitalize="off" />
          </label>
          <label class="field">
            <span>Password</span>
            <input type="password" formControlName="password" autocomplete="current-password" />
          </label>
          @if (error()) { <p class="form-error" role="alert">{{ error() }}</p> }
          <button class="btn btn-primary btn-block" [disabled]="busy()">{{ busy() ? 'Signing in…' : 'Sign in' }}</button>
        </form>
        <p class="auth-links">
          <a routerLink="/forgot-password">Forgot your password?</a>
          <a routerLink="/register">Create an account</a>
        </p>
        <p class="hint">Demo accounts: super, groupadmin, user1, user2. Password: 123</p>
        <div class="auth-logo"><app-logo /></div>
      </section>
    </main>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    login: ['', Validators.required],
    password: ['', Validators.required],
  });

  submit(): void {
    if (this.form.invalid) return this.error.set('Enter your username or email and your password');
    const { login, password } = this.form.getRawValue();
    this.busy.set(true);
    this.error.set('');
    this.auth.login(login.trim(), password).subscribe({
      next: () => this.router.navigate(['/']),
      error: (err) => {
        this.error.set(errorMessage(err));
        this.busy.set(false);
      },
    });
  }
}
