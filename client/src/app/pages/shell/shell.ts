import { Component, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Avatar } from '../../components/avatar';
import { Logo } from '../../components/logo';
import { ROLE_LABELS } from '../../core/models';
import { AuthService } from '../../services/auth.service';
import { GroupService } from '../../services/group.service';
import { RequestService } from '../../services/request.service';
import { ToastService } from '../../services/toast.service';

/** Main layout for members: sidebar (groups, chatrooms, menus, profile), content, and online members. */
@Component({
  selector: 'app-shell-page',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Logo, Avatar],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class ShellPage implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly groups = inject(GroupService);
  protected readonly requests = inject(RequestService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly roleLabels = ROLE_LABELS;
  protected readonly menuOpen = signal(false);
  protected readonly adminMenuOpen = signal(false);
  protected readonly sidebarOpen = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map((e) => e.urlAfterRedirects)),
    { initialValue: this.router.url },
  );
  private readonly routeGroupId = computed(() => /\/app\/groups\/([a-f0-9]{24})/.exec(this.url())?.[1] ?? null);

  protected readonly selected = this.groups.selected;
  /** The selected group's theme colours the whole chat area, including every chatroom. */
  protected readonly theme = computed(() => this.selected()?.theme ?? 'blue');
  protected readonly adminGroups = computed(() => this.groups.groups().filter((g) => this.groups.isAdmin(g)));
  protected readonly counts = this.requests.incomingCounts;
  protected readonly pendingMine = computed(() => this.requests.mine().filter((r) => r.status === 'pending').length);

  constructor() {
    // The group in the URL becomes the selected group.
    effect(() => {
      const id = this.routeGroupId();
      if (id) untracked(() => this.groups.selectedId.set(id));
    });

    // Default to the first group; notice when the selected group disappears (left, removed, banned or deleted).
    effect(() => {
      if (!this.groups.loaded()) return;
      const list = this.groups.groups();
      const id = this.groups.selectedId();
      untracked(() => {
        if (id && !list.some((g) => g._id === id)) {
          this.groups.selectedId.set(null);
          if (this.routeGroupId() === id) {
            this.toast.show('You no longer have access to that group');
            this.router.navigate(['/app']);
          }
        } else if (!id && list.length) {
          this.groups.selectedId.set(list[0]._id);
        }
      });
    });

    // Load the member list whenever the selected group changes.
    effect(() => {
      const id = this.groups.selectedId();
      untracked(() => (id ? this.groups.loadMembers(id) : this.groups.members.set({ current: [] })));
    });

    // Close menus after navigating.
    effect(() => {
      this.url();
      untracked(() => {
        this.menuOpen.set(false);
        this.adminMenuOpen.set(false);
        this.sidebarOpen.set(false);
      });
    });
  }

  ngOnInit(): void {
    this.groups.load().subscribe();
    this.requests.loadMine().subscribe();
    if (this.requests.canApprove()) this.requests.loadIncoming();
  }

  selectGroup(id: string): void {
    const group = this.groups.groups().find((g) => g._id === id);
    if (!group) return;
    this.groups.selectedId.set(id);
    const first = group.channels[0];
    this.router.navigate(first ? ['/app/groups', id, 'rooms', first._id] : ['/app/groups', id, 'info']);
  }

  signOut(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
