import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, ElementRef, inject, input, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Avatar } from '../../components/avatar';
import { fileUrl } from '../../core/config';
import { errorMessage } from '../../core/error';
import { Message } from '../../core/models';
import { AuthService } from '../../services/auth.service';
import { GroupService } from '../../services/group.service';
import { RequestService } from '../../services/request.service';
import { SocketService } from '../../services/socket.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-room-page',
  imports: [FormsModule, DatePipe, Avatar],
  templateUrl: './room.html',
  styleUrl: './room.css',
})
export class RoomPage {
  private readonly auth = inject(AuthService);
  protected readonly groups = inject(GroupService);
  private readonly socket = inject(SocketService);
  private readonly requests = inject(RequestService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** Route parameters */
  readonly gid = input.required<string>();
  readonly cid = input.required<string>();

  private readonly log = viewChild<ElementRef<HTMLElement>>('log');
  private openedRoom: string | null = null;

  protected readonly messages = signal<Message[]>([]);
  protected readonly loading = signal(true);
  protected readonly sending = signal(false);
  protected readonly error = signal('');
  protected readonly image = signal<File | null>(null);
  protected readonly preview = signal<string | null>(null);
  protected draft = '';

  protected readonly me = this.auth.user;
  protected readonly group = computed(() => this.groups.groups().find((g) => g._id === this.gid()) ?? null);
  protected readonly channel = computed(() => this.group()?.channels.find((c) => c._id === this.cid()) ?? null);
  protected readonly isAdmin = computed(() => this.groups.isAdmin(this.group()));
  protected readonly fileUrl = fileUrl;

  constructor() {
    effect(() => {
      const cid = this.cid();
      untracked(() => this.open(cid));
    });

    this.socket.messages$.pipe(takeUntilDestroyed()).subscribe((m) => {
      if (m.channelId !== this.cid()) return;
      this.messages.update((list) => (list.some((x) => x._id === m._id) ? list : [...list, m]));
      this.scrollToBottom();
    });

    // Toast when someone new opens this chatroom.
    this.socket.userJoined$.pipe(takeUntilDestroyed()).subscribe((e) => {
      if (e.channelId === this.cid()) this.toast.show(`${e.username} joined #${this.channel()?.name ?? 'the chatroom'}`);
    });

    this.socket.roomDeleted$.pipe(takeUntilDestroyed()).subscribe((e) => {
      if (e.channelId !== this.cid()) return;
      this.toast.show('This chatroom was deleted');
      this.router.navigate(['/app']);
    });

    inject(DestroyRef).onDestroy(() => this.openedRoom && this.socket.leaveRoom(this.openedRoom));
  }

  private async open(cid: string): Promise<void> {
    if (this.openedRoom && this.openedRoom !== cid) this.socket.leaveRoom(this.openedRoom);
    this.openedRoom = cid;
    this.messages.set([]);
    this.error.set('');
    this.loading.set(true);

    // Join the live room first so no message is missed while history loads.
    const ack = await this.socket.joinRoom(cid);
    if (!ack.ok && this.socket.connected()) this.error.set(ack.error ?? 'Could not open this chatroom');

    this.groups.messages(cid).subscribe({
      next: (history) => {
        if (this.cid() !== cid) return;
        this.messages.update((live) => [...history, ...live.filter((m) => !history.some((h) => h._id === m._id))]);
        this.loading.set(false);
        this.scrollToBottom();
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }

  isMine(m: Message): boolean {
    return m.userId === this.me()?._id;
  }

  pickImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return this.error.set('Choose a PNG, JPG, GIF or WebP image');
    if (file.size > 5 * 1024 * 1024) return this.error.set('Images must be 5 MB or smaller');
    this.error.set('');
    this.image.set(file);
    this.preview.set(URL.createObjectURL(file));
  }

  clearImage(): void {
    this.image.set(null);
    this.preview.set(null);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  async send(): Promise<void> {
    const text = this.draft.trim();
    const file = this.image();
    if ((!text && !file) || this.sending()) return;

    this.sending.set(true);
    this.error.set('');
    try {
      const imageUrl = file ? (await firstValueFrom(this.groups.uploadImage(file))).url : null;
      const ack = await this.socket.sendMessage(this.cid(), text || null, imageUrl);
      if (!ack.ok) throw new Error(ack.error ?? 'Message not sent');
      this.draft = '';
      this.clearImage();
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.sending.set(false);
    }
  }

  requestDeletion(): void {
    const c = this.channel();
    if (!c || !confirm(`Ask the group admins to delete #${c.name}?`)) return;
    this.requests.create({ type: 'deleteChannel', groupId: this.gid(), channelId: c._id }).subscribe({
      next: () => this.toast.show('Request sent to the group admins', 'success'),
      error: (err) => this.toast.show(errorMessage(err), 'error'),
    });
  }

  deleteRoom(): void {
    const c = this.channel();
    if (!c || !confirm(`Delete #${c.name} and all of its messages?`)) return;
    this.groups.deleteChannel(c._id).subscribe({
      next: () => this.router.navigate(['/app']),
      error: (err) => this.toast.show(errorMessage(err), 'error'),
    });
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.log()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
