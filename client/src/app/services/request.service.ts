import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { API_URL } from '../core/config';
import { ChatRequest, RequestType } from '../core/models';
import { AuthService } from './auth.service';
import { SocketService } from './socket.service';
import { ToastService } from './toast.service';

/** What can be sent when creating a request. */
export interface NewRequest {
  type: RequestType;
  groupId?: string;
  channelId?: string;
  targetUserId?: string;
  name?: string;
  ageLimit?: number | null;
  reason?: string;
}

/** Requests the user has sent, and requests waiting for them to decide. */
@Injectable({ providedIn: 'root' })
export class RequestService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly url = `${API_URL}/requests`;

  readonly mine = signal<ChatRequest[]>([]);
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

  /** True for group admins and super admins. */
  canApprove(): boolean {
    const role = this.auth.user()?.role;
    return role === 'groupAdmin' || role === 'superAdmin';
  }

  /** Loads the user's own requests. */
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

  /** Sends a new request, then refreshes the user's own list. */
  create(request: NewRequest) {
    return this.http.post<ChatRequest>(this.url, request).pipe(tap(() => this.loadMine().subscribe()));
  }

  /** Approves a request, then refreshes the waiting list. */
  approve(id: string) {
    return this.http.post(`${this.url}/${id}/approve`, {}).pipe(tap(() => this.loadIncoming()));
  }

  /** Rejects a request, then refreshes the waiting list. */
  reject(id: string) {
    return this.http.post(`${this.url}/${id}/reject`, {}).pipe(tap(() => this.loadIncoming()));
  }

  /** Cancels one of the user's own pending requests. */
  cancel(id: string) {
    return this.http.delete(`${this.url}/${id}`).pipe(tap(() => this.loadMine().subscribe()));
  }
}