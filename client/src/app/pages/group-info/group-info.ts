import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
  protected readonly online = inject(SocketService).online;

  readonly gid = input.required<string>();

  protected readonly themes = THEMES;
  protected readonly group = computed(() => this.groups.groups().find((g) => g._id === this.gid()) ?? null);
  protected readonly isAdmin = computed(() => this.groups.isAdmin(this.group()));
  protected readonly me = this.auth.user;
  protected readonly busy = signal(false);

  protected name = '';
  protected theme: Theme = 'blue';
  protected ageLimit: number | null = null;

  protected newRoom = '';
  protected readonly banTarget = signal<string | null>(null);
  protected banReason = '';

  constructor() {
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

  /** Saves the name, theme and age limit, and reports anyone removed for age. */
  saveSettings(): void {
    const g = this.group();
    if (!g) return;
    this.run(this.groups.update(g._id, { name: this.name, theme: this.theme, ageLimit: this.ageLimit || null }), (res) => {
      const removed = (res as { removedForAge: string[] }).removedForAge;
      this.toast.show('Group settings saved', 'success');
      if (removed.length) this.toast.show(`Removed for being under the age limit: ${removed.join(', ')}`);
    });
  }

  /** Admins create a chatroom; members send a request for one. */
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

  /** Deletes a chatroom after confirming. */
  deleteRoom(c: Channel): void {
    if (confirm(`Delete #${c.name} and all of its messages?`)) {
      this.run(this.groups.deleteChannel(c._id), () => this.toast.show('Chatroom deleted', 'success'));
    }
  }

  /** Members ask the admins to remove them from the group. */
  requestLeave(): void {
    if (confirm('Ask the group admins to remove you from this group?')) {
      this.run(this.requests.create({ type: 'leaveGroup', groupId: this.gid() }), () =>
        this.toast.show('Leave request sent to the group admins', 'success'),
      );
    }
  }

  /** Makes a member an admin of this group. */
  makeAdmin(m: Member): void {
    if (confirm(`Make ${m.username} an admin of this group?`)) {
      this.run(this.groups.promote(this.gid(), m._id), () => this.toast.show(`${m.username} is now a group admin`, 'success'));
    }
  }

  /** Removes another admin's admin rights; they stay a member. */
  removeAdmin(m: Member): void {
    if (confirm(`Remove ${m.username}'s admin rights? They will stay a member of the group.`)) {
      this.run(this.groups.demote(this.gid(), m._id), () => this.toast.show(`${m.username} is no longer a group admin`, 'success'));
    }
  }

  /** Opens the ban form for a member. */
  openBan(m: Member): void {
    this.banTarget.set(m._id);
    this.banReason = '';
  }

  /** Bans the member with the given reason. */
  confirmBan(m: Member): void {
    this.run(this.groups.ban(this.gid(), m._id, this.banReason), () => {
      this.toast.show(`${m.username} was banned and can't rejoin`, 'success');
      this.banTarget.set(null);
    });
  }

  /** Asks the super admin to delete this group. */
  requestDeletion(): void {
    if (confirm('Ask the super admin to delete this group and all of its chatrooms?')) {
      this.run(this.requests.create({ type: 'deleteGroup', groupId: this.gid() }), () =>
        this.toast.show('Deletion request sent to the super admin', 'success'),
      );
    }
  }

  /** True when this member is connected right now. */
  isOnline(id: string): boolean {
    return this.online().has(id);
  }

  /** Runs a request with a busy state and an error toast. */
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