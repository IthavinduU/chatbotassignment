import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Logo } from '../../components/logo';
import { errorMessage } from '../../core/error';
import { AuthService } from '../../services/auth.service';

/** First start: creates the super admin account. Only reachable while no super admin exists. */
@Component({
  selector: 'app-bootstrap-page',
  imports: [ReactiveFormsModule, Logo],
  template: `
    <main class="auth-page">
      <section class="auth-card">
        <h1>Set up Fabulari</h1>
        <p class="muted">This is the first time Fabulari has started. Create the super admin account to manage it.</p>
        <form [formGroup]="form" (ngSubmit)="submit()" class="stack" novalidate>
          <label class="field">
            <span>Username</span>
            <input formControlName="username" autocomplete="username" autocapitalize="off" />
            <small class="hint">3–20 letters, numbers, dots, dashes or underscores</small>
          </label>
          <label class="field">
            <span>Email</span>
            <input type="email" formControlName="email" autocomplete="email" />
          </label>
          <label class="field">
            <span>Password</span>
            <input type="password" formControlName="password" autocomplete="new-password" />
          </label>
          <label class="field">
            <span>Date of birth</span>
            <input type="date" formControlName="birthdate" [max]="today" />
          </label>
          @if (error()) { <p class="form-error" role="alert">{{ error() }}</p> }
          <button class="btn btn-primary btn-block" [disabled]="busy()">{{ busy() ? 'Setting up…' : 'Create super admin' }}</button>
        </form>
        <div class="auth-logo"><app-logo /></div>
      </section>
    </main>
  `,
})
export class BootstrapPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly today = new Date().toISOString().slice(0, 10);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    username: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9_.-]{3,20}$/)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(3)]],
    birthdate: ['', Validators.required],
  });

  /** Checks the form, creates the super admin and opens the admin console. */
  submit(): void {
    if (this.form.invalid) {
      const c = this.form.controls;
      this.error.set(
        c.username.invalid ? 'Choose a username of 3–20 letters, numbers, dots, dashes or underscores'
        : c.email.invalid ? 'Enter a valid email address'
        : c.password.invalid ? 'Use a password of at least 3 characters'
        : 'Enter your date of birth',
      );
      return;
    }
    const { username, email, password, birthdate } = this.form.getRawValue();
    this.busy.set(true);
    this.error.set('');
    this.auth.bootstrap({ username: username.trim(), email: email.trim(), password, birthdate }).subscribe({
      next: () => this.router.navigate(['/admin']),
      error: (err) => {
        this.error.set(errorMessage(err));
        this.busy.set(false);
      },
    });
  }
}