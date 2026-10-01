import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { API_URL } from '../core/config';
import { AuthResponse, User } from '../core/models';

const TOKEN_KEY = 'fabulari.token';
const USER_KEY = 'fabulari.user';

function readStoredUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null');
  } catch {
    return null;
  }
}

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

  login(login: string, password: string) {
    return this.http.post<AuthResponse>(`${API_URL}/auth/login`, { login, password }).pipe(tap((r) => this.setSession(r)));
  }

  /** FormData with username, email, password, birthdate and optional avatar. */
  register(form: FormData) {
    return this.http.post<AuthResponse>(`${API_URL}/auth/register`, form).pipe(tap((r) => this.setSession(r)));
  }

  forgotPassword(email: string) {
    return this.http.post<{ message: string; devResetUrl?: string }>(`${API_URL}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, password: string) {
    return this.http.post<{ message: string }>(`${API_URL}/auth/reset-password`, { token, password });
  }

  refreshMe() {
    return this.http.get<User>(`${API_URL}/auth/me`).pipe(tap((u) => this.setUser(u)));
  }

  updateAvatar(file: File) {
    const form = new FormData();
    form.append('avatar', file);
    return this.http.patch<User>(`${API_URL}/users/me`, form).pipe(tap((u) => this.setUser(u)));
  }

  logout(): void {
    this.clearSession();
  }

  clearSession(): void {
    this._token.set(null);
    this._user.set(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  private setSession({ token, user }: AuthResponse): void {
    this._token.set(token);
    localStorage.setItem(TOKEN_KEY, token);
    this.setUser(user);
  }

  private setUser(user: User): void {
    this._user.set(user);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}
