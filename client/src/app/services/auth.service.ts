import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { API_URL } from '../core/config';
import { AuthResponse, User } from '../core/models';

const TOKEN_KEY = 'fabulari.token';
const USER_KEY = 'fabulari.user';

/** Reads the signed-in user saved in the browser, if any. */
function readStoredUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null');
  } catch {
    return null;
  }
}

/** Details for a new account. The username is optional: the server can make one from the email. */
export interface NewAccount {
  username?: string;
  email: string;
  password: string;
  birthdate: string;
}

/** Holds the signed-in user and token, and talks to the sign-in endpoints. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private readonly _user = signal<User | null>(readStoredUser());

  readonly token = this._token.asReadonly();
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._token() && !!this._user());
  readonly isSuperAdmin = computed(() => this._user()?.role === 'superAdmin');
  readonly isGroupAdmin = computed(() => this._user()?.role === 'groupAdmin');

  /** Signs in with a username or email and a password. */
  login(login: string, password: string) {
    return this.http.post<AuthResponse>(`${API_URL}/auth/login`, { login, password }).pipe(tap((r) => this.setSession(r)));
  }

  /** FormData with username (optional), email, password, birthdate and optional avatar. */
  register(form: FormData) {
    return this.http.post<AuthResponse>(`${API_URL}/auth/register`, form).pipe(tap((r) => this.setSession(r)));
  }

  /** Asks the server whether the super admin still needs to be set up. */
  bootstrapStatus() {
    return this.http.get<{ needed: boolean }>(`${API_URL}/auth/bootstrap`);
  }

  /** Creates the first super admin on a brand new install and signs them in. */
  bootstrap(details: NewAccount) {
    return this.http.post<AuthResponse>(`${API_URL}/auth/bootstrap`, details).pipe(tap((r) => this.setSession(r)));
  }

  /** Asks for a password reset link for this email. */
  forgotPassword(email: string) {
    return this.http.post<{ message: string; devResetUrl?: string }>(`${API_URL}/auth/forgot-password`, { email });
  }

  /** Sets a new password using the token from a reset link. */
  resetPassword(token: string, password: string) {
    return this.http.post<{ message: string }>(`${API_URL}/auth/reset-password`, { token, password });
  }

  /** Reloads the signed-in user from the server (e.g. after their role changes). */
  refreshMe() {
    return this.http.get<User>(`${API_URL}/auth/me`).pipe(tap((u) => this.setUser(u)));
  }

  /** Uploads a new profile picture. */
  updateAvatar(file: File) {
    const form = new FormData();
    form.append('avatar', file);
    return this.http.patch<User>(`${API_URL}/users/me`, form).pipe(tap((u) => this.setUser(u)));
  }

  /** Deletes the signed-in user's own account, then signs out. */
  deleteAccount() {
    return this.http.delete<void>(`${API_URL}/users/me`).pipe(tap(() => this.clearSession()));
  }

  /** Signs out. */
  logout(): void {
    this.clearSession();
  }

  /** Forgets the token and user, here and in the browser's storage. */
  clearSession(): void {
    this._token.set(null);
    this._user.set(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  /** Saves a new session after signing in or up. */
  private setSession({ token, user }: AuthResponse): void {
    this._token.set(token);
    localStorage.setItem(TOKEN_KEY, token);
    this.setUser(user);
  }

  /** Saves the signed-in user here and in the browser's storage. */
  private setUser(user: User): void {
    this._user.set(user);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}