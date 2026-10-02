import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Avatar } from '../../components/avatar';
import { errorMessage } from '../../core/error';
import { ROLE_LABELS } from '../../core/models';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

/** The signed-in user's details, profile picture and account deletion. */
@Component({
  selector: 'app-profile-page',
  imports: [DatePipe, Avatar],
  template: `
    <div class="page page-narrow">
      <h1>Profile</h1>
      @if (auth.user(); as me) {
        <section class="panel profile">
          <app-avatar [username]="me.username" [avatarUrl]="me.avatarUrl" [size]="88" />
          <div>
            <label class="btn btn-quiet">
              <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" class="visually-hidden" (change)="upload($event)" />
              {{ busy() ? 'Uploading…' : 'Change picture' }}
            </label>
          </div>
        </section>
        <section class="panel">
          <dl class="details">
            <div><dt>Username</dt><dd>{{ me.username }}</dd></div>
            <div><dt>Email</dt><dd>{{ me.email }}</dd></div>
            <div><dt>Date of birth</dt><dd>{{ me.birthdate | date: 'mediumDate' }}</dd></div>
            <div><dt>Role</dt><dd>{{ roles[me.role] }}</dd></div>
          </dl>
        </section>
        <button type="button" class="btn btn-quiet" (click)="signOut()">Sign out</button>

        <section class="panel danger-zone">
          <h2>Delete account</h2>
          <p class="muted">This removes you from every group and can't be undone.</p>
          <button type="button" class="btn btn-danger" (click)="deleteAccount()" [disabled]="busy()">Delete my account</button>
        </section>
      }
    </div>
  `,
  styles: `
    .profile { display: flex; align-items: center; gap: 1.25rem; }
    .danger-zone { margin-top: 2rem; border-color: var(--danger-soft); }
  `,
})
export class ProfilePage {
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly roles = ROLE_LABELS;
  protected readonly busy = signal(false);

  /** Uploads a new profile picture. */
  upload(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.busy.set(true);
    this.auth.updateAvatar(file).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show('Profile picture updated', 'success');
      },
      error: (err) => {
        this.busy.set(false);
        this.toast.show(errorMessage(err), 'error');
      },
    });
  }

  /** Signs out and returns to the sign-in page. */
  signOut(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  /** Deletes the user's own account after confirming. */
  deleteAccount(): void {
    if (!confirm('Delete your account? You will be removed from every group. This cannot be undone.')) return;
    this.busy.set(true);
    this.auth.deleteAccount().subscribe({
      next: () => this.router.navigate(['/login']),
      error: (err) => {
        this.busy.set(false);
        this.toast.show(errorMessage(err), 'error');
      },
    });
  }
}