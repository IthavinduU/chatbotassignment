import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { API_URL } from '../core/config';
import { Channel, DiscoverGroup, Group, Members, Message, Theme } from '../core/models';
import { AuthService } from './auth.service';
import { SocketService } from './socket.service';

/** The user's groups, the selected group and its members, plus group and chatroom actions. */
@Injectable({ providedIn: 'root' })
export class GroupService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly socket = inject(SocketService);

  readonly groups = signal<Group[]>([]);
  readonly loaded = signal(false);

  readonly selectedId = signal<string | null>(null);
  readonly selected = computed(() => this.groups().find((g) => g._id === this.selectedId()) ?? null);
  readonly members = signal<Members>({ current: [] });

  readonly onlineMembers = computed(() => {
    const online = this.socket.online();
    return this.members().current.filter((m) => online.has(m._id));
  });

  constructor() {
    this.socket.groupsChanged$.subscribe(() => {
      this.load().subscribe();
      const id = this.selectedId();
      if (id) this.loadMembers(id);
    });
  }

  /** True when the signed-in user administers this group. */
  isAdmin(group: Group | null): boolean {
    const me = this.auth.user();
    return !!group && !!me && me.role !== 'user' && group.adminIds.includes(me._id);
  }

  /** Loads the user's groups with their chatrooms. */
  load() {
    return this.http.get<Group[]>(`${API_URL}/groups/mine`).pipe(
      tap((groups) => {
        this.groups.set(groups);
        this.loaded.set(true);
      }),
    );
  }

  /** Loads the members of a group into `members`. */
  loadMembers(groupId: string): void {
    this.http.get<Members>(`${API_URL}/groups/${groupId}/members`).subscribe({
      next: (m) => this.members.set(m),
      error: () => this.members.set({ current: [] }),
    });
  }

  /** Every group, with this user's status for each. */
  discover() {
    return this.http.get<DiscoverGroup[]>(`${API_URL}/groups/discover`);
  }

  /** Saves group settings, then reloads the groups. */
  update(groupId: string, changes: { name?: string; theme?: Theme; ageLimit?: number | null }) {
    return this.http
      .patch<{ group: Group; removedForAge: string[] }>(`${API_URL}/groups/${groupId}`, changes)
      .pipe(tap(() => this.load().subscribe()));
  }

  /** Makes a member an admin of the group. */
  promote(groupId: string, userId: string) {
    return this.http.post(`${API_URL}/groups/${groupId}/admins`, { userId });
  }

  /** Removes a member's admin rights for the group; they stay a member. */
  demote(groupId: string, userId: string) {
    return this.http.delete(`${API_URL}/groups/${groupId}/admins/${userId}`);
  }

  /** Bans a member from the group for good. */
  ban(groupId: string, userId: string, reason: string) {
    return this.http.post(`${API_URL}/groups/${groupId}/bans`, { userId, reason });
  }

  /** Creates a chatroom (group admins). */
  createChannel(groupId: string, name: string) {
    return this.http.post<Channel>(`${API_URL}/groups/${groupId}/channels`, { name });
  }

  /** Deletes a chatroom (group admins). */
  deleteChannel(channelId: string) {
    return this.http.delete<void>(`${API_URL}/channels/${channelId}`);
  }

  /** Message history for a chatroom. */
  messages(channelId: string) {
    return this.http.get<Message[]>(`${API_URL}/channels/${channelId}/messages`);
  }

  /** Uploads an image to send in chat and returns its URL. */
  uploadImage(file: File) {
    const form = new FormData();
    form.append('image', file);
    return this.http.post<{ url: string }>(`${API_URL}/uploads`, form);
  }
}