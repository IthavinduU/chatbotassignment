import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Logo } from '../../components/logo';
import { errorMessage } from '../../core/error';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-reset-password-page',
  imports: [FormsModule, RouterLink, Logo],
  template: `
    <main class="auth-page">
      <section class="auth-card">
        <h1>Choose a new password</h1>
        @if (done()) {
          <p class="notice" role="status">{{ done() }}</p>
          <a class="btn btn-primary btn-block" routerLink="/login">Sign in</a>
        } @else if (!token()) {
          <p class="form-error">This link is missing its reset code. <a routerLink="/forgot-password">Request a new link</a>.</p>
        } @else {
          <form (ngSubmit)="submit()" class="stack">
            <label class="field">
              <span>New password</span>
              <input type="password" name="password" [(ngModel)]="password" autocomplete="new-password" />
            </label>
            <label class="field">
              <span>Confirm new password</span>
              <input type="password" name="confirm" [(ngModel)]="confirm" autocomplete="new-password" />
            </label>
            @if (error()) { <p class="form-error" role="alert">{{ error() }}</p> }
            <button class="btn btn-primary btn-block" [disabled]="busy()">Save new password</button>
          </form>
        }
        <div class="auth-logo"><app-logo /></div>
      </section>
    </main>
  `,
})
export class ResetPasswordPage {
  private readonly auth = inject(AuthService);
  /** ?token= from the reset link */
  readonly token = input<string>();
  protected password = '';
  protected confirm = '';
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly done = signal('');

  submit(): void {
    if (this.password.length < 3) return this.error.set('Use a password of at least 3 characters');
    if (this.password !== this.confirm) return this.error.set('The two passwords do not match');
    this.busy.set(true);
    this.error.set('');
    this.auth.resetPassword(this.token()!, this.password).subscribe({
      next: (res) => this.done.set(res.message),
      error: (err) => {
        this.error.set(errorMessage(err));
        this.busy.set(false);
      },
    });
  }
}
