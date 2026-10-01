import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { API_URL } from '../core/config';
import { ChatRequest, RequestType } from '../core/models';
import { AuthService } from './auth.service';
import { SocketService } from './socket.service';
import { ToastService } from './toast.service';

export interface NewRequest {
  type: RequestType;
  groupId?: string;
  channelId?: string;
  targetUserId?: string;
  name?: string;
  reason?: string;
}

@Injectable({ providedIn: 'root' })
export class RequestService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly url = `${API_URL}/requests`;

  /** Requests this user has sent. */
  readonly mine = signal<ChatRequest[]>([]);
  /** Pending requests this user can approve (group admins and super admins). */
  readonly incoming = signal<ChatRequest[]>([]);

  readonly incomingCounts = computed(() => {
    const counts: Partial<Record<RequestType, number>> = {};
    for (const r of this.incoming()) counts[r.type] = (counts[r.type] ?? 0) + 1;
    return counts;
  });

  constructor() {
    inject(SocketService).requestsChanged$.subscribe(() => {
      this.loadMine().subscribe();
      if (this.canApprove()) this.loadIncoming(true);
    });
  }

  canApprove(): boolean {
    const role = this.auth.user()?.role;
    return role === 'groupAdmin' || role === 'superAdmin';
  }

  loadMine() {
    return this.http.get<ChatRequest[]>(`${this.url}/mine`).pipe(tap((r) => this.mine.set(r)));
  }

  /** `notify` shows a toast when new requests have arrived. */
  loadIncoming(notify = false): void {
    const before = this.incoming().length;
    this.http.get<ChatRequest[]>(`${this.url}/incoming`).subscribe((list) => {
      this.incoming.set(list);
      if (notify && list.length > before) this.toast.show('You have a new request to review');
    });
  }

  create(request: NewRequest) {
    return this.http.post<ChatRequest>(this.url, request).pipe(tap(() => this.loadMine().subscribe()));
  }

  approve(id: string) {
    return this.http.post(`${this.url}/${id}/approve`, {}).pipe(tap(() => this.loadIncoming()));
  }

  reject(id: string) {
    return this.http.post(`${this.url}/${id}/reject`, {}).pipe(tap(() => this.loadIncoming()));
  }

  cancel(id: string) {
    return this.http.delete(`${this.url}/${id}`).pipe(tap(() => this.loadMine().subscribe()));
  }
}
