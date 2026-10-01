import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Logo } from '../../components/logo';
import { errorMessage } from '../../core/error';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule, RouterLink, Logo],
  template: `
    <main class="auth-page">
      <section class="auth-card">
        <h1>Create your account</h1>
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
            <small class="hint">Some groups have age limits</small>
          </label>
          <div class="field">
            <span>Profile picture (optional)</span>
            <div class="avatar-pick">
              @if (preview()) { <img [src]="preview()" alt="Selected profile picture" /> }
              <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" (change)="pick($event)" />
            </div>
          </div>
          @if (error()) { <p class="form-error" role="alert">{{ error() }}</p> }
          <button class="btn btn-primary btn-block" [disabled]="busy()">{{ busy() ? 'Creating account…' : 'Sign up' }}</button>
        </form>
        <p class="auth-links"><span>Already have an account? <a routerLink="/login">Sign in</a></span></p>
        <div class="auth-logo"><app-logo /></div>
      </section>
    </main>
  `,
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly preview = signal<string | null>(null);
  protected readonly today = new Date().toISOString().slice(0, 10);
  private avatar: File | null = null;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    username: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9_.-]{3,20}$/)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(3)]],
    birthdate: ['', Validators.required],
  });

  pick(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    if (file && file.size > 5 * 1024 * 1024) {
      this.error.set('Profile pictures must be 5 MB or smaller');
      return;
    }
    this.avatar = file;
    this.preview.set(file ? URL.createObjectURL(file) : null);
  }

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
    const data = new FormData();
    for (const [key, value] of Object.entries(this.form.getRawValue())) data.append(key, value.trim());
    if (this.avatar) data.append('avatar', this.avatar);

    this.busy.set(true);
    this.error.set('');
    this.auth.register(data).subscribe({
      next: () => this.router.navigate(['/app/discover']),
      error: (err) => {
        this.error.set(errorMessage(err));
        this.busy.set(false);
      },
    });
  }
}
