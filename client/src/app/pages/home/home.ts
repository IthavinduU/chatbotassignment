import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { GroupService } from '../../services/group.service';

/** Front page: every chatroom the user can open, grouped by group. */
@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  template: `
    <div class="page">
      <h1>Hi {{ auth.user()?.username }}</h1>
      <p class="muted">Pick a chatroom to start chatting.</p>

      @if (!groups.loaded()) {
        <p class="muted">Loading…</p>
      } @else {
        @for (g of groups.groups(); track g._id) {
          <section class="panel group-card" [attr.data-theme]="g.theme">
            <h2>{{ g.name }}</h2>
            <div class="room-grid">
              @for (c of g.channels; track c._id) {
                <a class="room-tile" [routerLink]="['/app/groups', g._id, 'rooms', c._id]"># {{ c.name }}</a>
              } @empty {
                <p class="muted small">No chatrooms yet. <a [routerLink]="['/app/groups', g._id, 'info']">Request one</a>.</p>
              }
            </div>
          </section>
        } @empty {
          <section class="panel">
            <h2>You're not in any groups yet</h2>
            <p class="muted">Ask to join a group. A group admin will review your request.</p>
            <a class="btn btn-primary" routerLink="/app/discover">Find groups</a>
          </section>
        }
      }
    </div>
  `,
  styles: `
    .group-card { border-top: 5px solid var(--accent); }
    .room-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 0.6rem; }
    .room-tile { padding: 0.8rem 1rem; border-radius: 10px; background: var(--accent-soft); color: var(--accent-ink); font-weight: 700; text-decoration: none; }
    .room-tile:hover { background: var(--accent); color: var(--accent-contrast); }
  `,
})
export class HomePage {
  protected readonly auth = inject(AuthService);
  protected readonly groups = inject(GroupService);
}
