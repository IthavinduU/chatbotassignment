import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { SERVER_URL } from '../core/config';
import { Message } from '../core/models';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

interface Ack {
  ok: boolean;
  error?: string;
}

/** A user entering or leaving a chatroom. */
export interface RoomPresenceEvent {
  channelId: string;
  username: string;
}

/** One Socket.io connection per signed-in user. Connects and disconnects automatically with the session. */
@Injectable({ providedIn: 'root' })
export class SocketService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  private socket: Socket | null = null;
  private currentRoom: string | null = null;

  readonly connected = signal(false);
  readonly online = signal<Set<string>>(new Set());

  readonly messages$ = new Subject<Message>();
  readonly userJoined$ = new Subject<RoomPresenceEvent>();
  readonly userLeft$ = new Subject<RoomPresenceEvent>();
  readonly roomDeleted$ = new Subject<{ channelId: string }>();
  readonly groupsChanged$ = new Subject<void>();
  readonly requestsChanged$ = new Subject<void>();
  readonly bansChanged$ = new Subject<void>();

  constructor() {
    effect(() => {
      const token = this.auth.token();
      untracked(() => (token ? this.connect(token) : this.disconnect()));
    });
  }

  /** Opens a chatroom so this user receives its live messages. */
  joinRoom(channelId: string): Promise<Ack> {
    this.currentRoom = channelId;
    return this.emit('room:join', { channelId });
  }

  /** Closes a chatroom; the others in it are told this user left. */
  leaveRoom(channelId: string): void {
    if (this.currentRoom === channelId) this.currentRoom = null;
    this.socket?.emit('room:leave', { channelId });
  }

  /** Sends a text and/or image message to a chatroom. */
  sendMessage(channelId: string, text: string | null, imageUrl: string | null): Promise<Ack> {
    return this.emit('message:send', { channelId, text, imageUrl });
  }

  /** Emits an event and waits up to 5 seconds for the server's acknowledgement. */
  private emit(event: string, data: unknown): Promise<Ack> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) return resolve({ ok: false, error: 'Not connected to the chat server' });
      this.socket.timeout(5000).emit(event, data, (err: Error | null, ack: Ack) =>
        resolve(err ? { ok: false, error: 'The chat server did not respond' } : ack),
      );
    });
  }

  /** Opens the socket with the user's token and wires every server event to a stream or signal. */
  private connect(token: string): void {
    this.disconnect();
    const s = io(SERVER_URL, { auth: { token } });
    this.socket = s;

    s.on('connect', () => {
      this.connected.set(true);
      if (this.currentRoom) s.emit('room:join', { channelId: this.currentRoom }, () => {});
    });
    s.on('disconnect', () => this.connected.set(false));
    s.on('presence', (ids: string[]) => this.online.set(new Set(ids)));

    s.on('message:new', (m: Message) => this.messages$.next(m));
    s.on('room:userJoined', (e: RoomPresenceEvent) => this.userJoined$.next(e));
    s.on('room:userLeft', (e: RoomPresenceEvent) => this.userLeft$.next(e));
    s.on('room:deleted', (e) => this.roomDeleted$.next(e));
    s.on('groups:changed', () => this.groupsChanged$.next());
    s.on('requests:changed', () => this.requestsChanged$.next());
    s.on('bans:changed', () => this.bansChanged$.next());
    s.on('account:changed', () => this.auth.refreshMe().subscribe({ error: () => {} }));
    s.on('account:banned', ({ reason }: { reason: string }) => this.signOutWith(`Your account has been banned: ${reason}`, 'error'));
    s.on('account:deleted', () => this.signOutWith('Your account has been deleted', 'info'));
  }

  /** Signs the user out with a message, e.g. after a ban or account deletion. */
  private signOutWith(message: string, kind: 'info' | 'error'): void {
    this.toast.show(message, kind, 8000);
    this.auth.clearSession();
    this.router.navigate(['/login']);
  }

  /** Closes the socket and clears connection state. */
  private disconnect(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.currentRoom = null;
    this.connected.set(false);
    this.online.set(new Set());
  }
}