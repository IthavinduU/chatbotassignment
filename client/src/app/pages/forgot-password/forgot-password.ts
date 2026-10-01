import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Logo } from '../../components/logo';
import { errorMessage } from '../../core/error';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password-page',
  imports: [FormsModule, RouterLink, Logo],
  template: `
    <main class="auth-page">
      <section class="auth-card">
        <h1>Reset your password</h1>
        <p class="muted">Enter the email you signed up with and we'll send you a reset link.</p>
        <form (ngSubmit)="submit()" class="stack">
          <label class="field">
            <span>Email</span>
            <input type="email" name="email" [(ngModel)]="email" required autocomplete="email" />
          </label>
          @if (error()) { <p class="form-error" role="alert">{{ error() }}</p> }
          @if (message()) { <p class="notice" role="status">{{ message() }}</p> }
          @if (devLink()) {
            <p class="notice">
              Development mode (no email server): <a [routerLink]="'/reset-password'" [queryParams]="{ token: devToken() }">open your reset link</a>.
              The link is also printed in the server terminal.
            </p>
          }
          <button class="btn btn-primary btn-block" [disabled]="busy() || !email.trim()">Send reset link</button>
        </form>
        <p class="auth-links"><a routerLink="/login">Back to sign in</a></p>
        <div class="auth-logo"><app-logo /></div>
      </section>
    </main>
  `,
})
export class ForgotPasswordPage {
  private readonly auth = inject(AuthService);
  protected email = '';
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly devLink = signal<string | null>(null);
  protected readonly devToken = () => (this.devLink() ? new URL(this.devLink()!).searchParams.get('token') : null);

  submit(): void {
    this.busy.set(true);
    this.error.set('');
    this.auth.forgotPassword(this.email.trim()).subscribe({
      next: (res) => {
        this.message.set(res.message);
        this.devLink.set(res.devResetUrl ?? null);
        this.busy.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.busy.set(false);
      },
    });
  }
}
