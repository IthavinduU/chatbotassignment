import { Component, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { merge, Observable } from 'rxjs';
import { errorMessage } from '../../core/error';
import { DiscoverGroup } from '../../core/models';
import { AuthService } from '../../services/auth.service';
import { GroupService } from '../../services/group.service';
import { RequestService } from '../../services/request.service';
import { SocketService } from '../../services/socket.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-discover-page',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="page">
      <header class="page-head">
        <h1>Find groups</h1>
        <p class="muted">Ask to join a group. Its admins will review your request.</p>
      </header>

      @if (auth.isGroupAdmin()) {
        <form class="panel inline-form" (ngSubmit)="requestGroup()">
          <label class="field grow">
            <span>Request a new group (sent to the super admin)</span>
            <input name="newGroup" [(ngModel)]="newGroup" maxlength="40" placeholder="Group name" />
          </label>
          <button class="btn btn-primary" [disabled]="busy() || !newGroup.trim()">Send request</button>
        </form>
      }

      <ul class="rows">
        @for (g of list(); track g._id) {
          <li class="row" [attr.data-theme]="g.theme">
            <span class="theme-bar" aria-hidden="true"></span>
            <div class="grow">
              <strong>{{ g.name }}</strong>
              <div class="muted small">{{ g.memberCount }} {{ g.memberCount === 1 ? 'member' : 'members' }} @if (g.ageLimit) { · Age {{ g.ageLimit }}+ }</div>
            </div>
            @switch (g.status) {
              @case ('member') { <a class="btn btn-quiet btn-sm" [routerLink]="['/app/groups', g._id, 'info']">Open</a> }
              @case ('pending') { <span class="tag tag-pending">Request sent</span> }
              @case ('banned') { <span class="tag tag-danger">You're banned</span> }
              @case ('tooYoung') { <span class="tag">Age {{ g.ageLimit }}+ only</span> }
              @default { <button type="button" class="btn btn-primary btn-sm" (click)="join(g)" [disabled]="busy()">Ask to join</button> }
            }
          </li>
        } @empty {
          <li class="row muted">{{ loading() ? 'Loading…' : 'There are no groups yet.' }}</li>
        }
      </ul>
    </div>
  `,
  styles: `
    .theme-bar { width: 6px; align-self: stretch; border-radius: 3px; background: var(--accent); }
    .grow { flex: 1; }
  `,
})
export class DiscoverPage implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly groups = inject(GroupService);
  private readonly requests = inject(RequestService);
  private readonly toast = inject(ToastService);

  protected readonly list = signal<DiscoverGroup[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected newGroup = '';

  constructor() {
    const socket = inject(SocketService);
    merge(socket.groupsChanged$, socket.requestsChanged$).pipe(takeUntilDestroyed()).subscribe(() => this.refresh());
  }

  ngOnInit(): void {
    this.refresh();
  }

  join(g: DiscoverGroup): void {
    this.run(this.requests.create({ type: 'joinGroup', groupId: g._id }), `Request to join ${g.name} sent`);
  }

  requestGroup(): void {
    this.run(this.requests.create({ type: 'createGroup', name: this.newGroup.trim() }), 'Group request sent to the super admin', () => (this.newGroup = ''));
  }

  private refresh(): void {
    this.groups.discover().subscribe({
      next: (list) => {
        this.list.set(list);
        this.loading.set(false);
      },
      error: (err) => this.toast.show(errorMessage(err), 'error'),
    });
  }

  private run(req: Observable<unknown>, success: string, done?: () => void): void {
    this.busy.set(true);
    req.subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show(success, 'success');
        done?.();
        this.refresh();
      },
      error: (err) => {
        this.busy.set(false);
        this.toast.show(errorMessage(err), 'error', 6000);
      },
    });
  }
}
