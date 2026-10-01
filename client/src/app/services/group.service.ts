import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { API_URL } from '../core/config';
import { Channel, DiscoverGroup, Group, Members, Message, Theme } from '../core/models';
import { AuthService } from './auth.service';
import { SocketService } from './socket.service';

@Injectable({ providedIn: 'root' })
export class GroupService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly socket = inject(SocketService);

  /** Groups the signed-in user belongs to. */
  readonly groups = signal<Group[]>([]);
  readonly loaded = signal(false);

  /** The group shown in the sidebar, and its current members. */
  readonly selectedId = signal<string | null>(null);
  readonly selected = computed(() => this.groups().find((g) => g._id === this.selectedId()) ?? null);
  readonly members = signal<Members>({ current: [] });

  readonly onlineMembers = computed(() => {
    const online = this.socket.online();
    return this.members().current.filter((m) => online.has(m._id));
  });

  constructor() {
    // Server pushes "groups:changed" whenever membership, names, themes or chatrooms change.
    this.socket.groupsChanged$.subscribe(() => {
      this.load().subscribe();
      const id = this.selectedId();
      if (id) this.loadMembers(id);
    });
  }

  isAdmin(group: Group | null): boolean {
    const me = this.auth.user();
    return !!group && !!me && me.role !== 'user' && group.adminIds.includes(me._id);
  }

  load() {
    return this.http.get<Group[]>(`${API_URL}/groups/mine`).pipe(
      tap((groups) => {
        this.groups.set(groups);
        this.loaded.set(true);
      }),
    );
  }

  loadMembers(groupId: string): void {
    this.http.get<Members>(`${API_URL}/groups/${groupId}/members`).subscribe({
      next: (m) => this.members.set(m),
      error: () => this.members.set({ current: [] }),
    });
  }

  discover() {
    return this.http.get<DiscoverGroup[]>(`${API_URL}/groups/discover`);
  }

  update(groupId: string, changes: { name?: string; theme?: Theme; ageLimit?: number | null }) {
    return this.http
      .patch<{ group: Group; removedForAge: string[] }>(`${API_URL}/groups/${groupId}`, changes)
      .pipe(tap(() => this.load().subscribe()));
  }

  ban(groupId: string, userId: string, reason: string) {
    return this.http.post(`${API_URL}/groups/${groupId}/bans`, { userId, reason });
  }

  createChannel(groupId: string, name: string) {
    return this.http.post<Channel>(`${API_URL}/groups/${groupId}/channels`, { name });
  }

  deleteChannel(channelId: string) {
    return this.http.delete<void>(`${API_URL}/channels/${channelId}`);
  }

  messages(channelId: string) {
    return this.http.get<Message[]>(`${API_URL}/channels/${channelId}/messages`);
  }

  uploadImage(file: File) {
    const form = new FormData();
    form.append('image', file);
    return this.http.post<{ url: string }>(`${API_URL}/uploads`, form);
  }
}
