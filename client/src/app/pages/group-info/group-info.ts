import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { Avatar } from '../../components/avatar';
import { errorMessage } from '../../core/error';
import { Channel, Member, Theme, THEMES } from '../../core/models';
import { AuthService } from '../../services/auth.service';
import { GroupService } from '../../services/group.service';
import { RequestService } from '../../services/request.service';
import { SocketService } from '../../services/socket.service';
import { ToastService } from '../../services/toast.service';

/** Group details for members; full management tools for the group's admins. */
@Component({
  selector: 'app-group-info-page',
  imports: [FormsModule, RouterLink, Avatar],
  templateUrl: './group-info.html',
  styleUrl: './group-info.css',
})
export class GroupInfoPage {
  protected readonly groups = inject(GroupService);
  private readonly requests = inject(RequestService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly online = inject(SocketService).online;

  readonly gid = input.required<string>();

  protected readonly themes = THEMES;
  protected readonly group = computed(() => this.groups.groups().find((g) => g._id === this.gid()) ?? null);
  protected readonly isAdmin = computed(() => this.groups.isAdmin(this.group()));
  protected readonly me = this.auth.user;
  protected readonly busy = signal(false);

  // Settings form
  protected name = '';
  protected theme: Theme = 'blue';
  protected ageLimit: number | null = null;

  protected newRoom = '';
  protected readonly banTarget = signal<string | null>(null);
  protected banReason = '';

  constructor() {
    // Fill the settings form from the group (again after each save or remote change).
    effect(() => {
      const g = this.group();
      if (!g) return;
      untracked(() => {
        this.name = g.name;
        this.theme = g.theme;
        this.ageLimit = g.ageLimit;
      });
    });
  }

  saveSettings(): void {
    const g = this.group();
    if (!g) return;
    this.run(this.groups.update(g._id, { name: this.name, theme: this.theme, ageLimit: this.ageLimit || null }), (res) => {
      const removed = (res as { removedForAge: string[] }).removedForAge;
      this.toast.show('Group settings saved', 'success');
      if (removed.length) this.toast.show(`Removed for being under the age limit: ${removed.join(', ')}`);
    });
  }

  addRoom(): void {
    const name = this.newRoom.trim();
    if (!name) return;
    if (this.isAdmin()) {
      this.run(this.groups.createChannel(this.gid(), name), () => {
        this.toast.show('Chatroom created', 'success');
        this.newRoom = '';
      });
    } else {
      this.run(this.requests.create({ type: 'createChannel', groupId: this.gid(), name }), () => {
        this.toast.show('Request sent to the group admins', 'success');
        this.newRoom = '';
      });
    }
  }

  deleteRoom(c: Channel): void {
    if (confirm(`Delete #${c.name} and all of its messages?`)) {
      this.run(this.groups.deleteChannel(c._id), () => this.toast.show('Chatroom deleted', 'success'));
    }
  }

  requestLeave(): void {
    if (confirm('Ask the group admins to remove you from this group?')) {
      this.run(this.requests.create({ type: 'leaveGroup', groupId: this.gid() }), () =>
        this.toast.show('Leave request sent to the group admins', 'success'),
      );
    }
  }

  openBan(m: Member): void {
    this.banTarget.set(m._id);
    this.banReason = '';
  }

  confirmBan(m: Member): void {
    this.run(this.groups.ban(this.gid(), m._id, this.banReason), () => {
      this.toast.show(`${m.username} was banned and can't rejoin`, 'success');
      this.banTarget.set(null);
    });
  }

  requestPromotion(m: Member): void {
    if (confirm(`Ask the super admin to make ${m.username} an admin of this group?`)) {
      this.run(this.requests.create({ type: 'promoteMember', groupId: this.gid(), targetUserId: m._id }), () =>
        this.toast.show('Promotion request sent to the super admin', 'success'),
      );
    }
  }

  requestDeletion(): void {
    if (confirm('Ask the super admin to delete this group and all of its chatrooms?')) {
      this.run(this.requests.create({ type: 'deleteGroup', groupId: this.gid() }), () =>
        this.toast.show('Deletion request sent to the super admin', 'success'),
      );
    }
  }

  isOnline(id: string): boolean {
    return this.online().has(id);
  }

  private run(request: Observable<unknown>, done: (res: unknown) => void): void {
    this.busy.set(true);
    request.subscribe({
      next: (res) => {
        this.busy.set(false);
        done(res);
      },
      error: (err) => {
        this.busy.set(false);
        this.toast.show(errorMessage(err), 'error', 6000);
      },
    });
  }
}
