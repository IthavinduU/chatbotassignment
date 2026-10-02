import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL } from '../core/config';
import { AuditEntry, Role, User } from '../core/models';

export interface AuditQuery {
  type?: string;
  order?: 'asc' | 'desc';
  from?: string;
  to?: string;
}

/** Super admin actions: users, bans, deleting accounts and the audit log. */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/admin`;

  /** Every user account. */
  users() {
    return this.http.get<User[]>(`${this.url}/users`);
  }

  /** Changes a user's role between member and group admin. */
  setRole(userId: string, role: Exclude<Role, 'superAdmin'>) {
    return this.http.patch<User>(`${this.url}/users/${userId}/role`, { role });
  }

  /** Hard bans a user: no sign-in, removed from every group. */
  hardBan(userId: string, reason: string) {
    return this.http.post(`${this.url}/users/${userId}/hardban`, { reason });
  }

  /** Lifts a hard ban. */
  liftBan(userId: string) {
    return this.http.delete(`${this.url}/users/${userId}/hardban`);
  }

  /** Deletes a user's account. */
  deleteUser(userId: string) {
    return this.http.delete(`${this.url}/users/${userId}`);
  }

  /** Hard-banned users and the log of all bans. */
  bans() {
    return this.http.get<{ hardBanned: User[]; log: AuditEntry[] }>(`${this.url}/bans`);
  }

  /** Audit log entries matching the filters. */
  audit(query: AuditQuery) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) if (value) params = params.set(key, value);
    return this.http.get<{ types: string[]; entries: AuditEntry[] }>(`${this.url}/audit`, { params });
  }
}