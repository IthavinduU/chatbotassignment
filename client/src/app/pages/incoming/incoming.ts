import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { errorMessage } from '../../core/error';
import { ChatRequest, describeRequest, REQUEST_LABELS, RequestType } from '../../core/models';
import { RequestService } from '../../services/request.service';
import { ToastService } from '../../services/toast.service';

const GROUP_ADMIN_TYPES: RequestType[] = ['joinGroup', 'createChannel', 'deleteChannel', 'leaveGroup'];

/** Group admins review requests from members of the groups they manage. */
@Component({
  selector: 'app-incoming-page',
  imports: [DatePipe],
  template: `
    <div class="page">
      <header class="page-head">
        <h1>Requests to review</h1>
      </header>

      <label class="field filter">
        <span>Show</span>
        <select (change)="setType($any($event.target).value)">
          <option value="" [selected]="!type()">All requests ({{ requests.incoming().length }})</option>
          @for (t of types; track t) {
            <option [value]="t" [selected]="t === type()">{{ labels[t] }} ({{ requests.incomingCounts()[t] ?? 0 }})</option>
          }
        </select>
      </label>

      <ul class="rows">
        @for (r of filtered(); track r._id) {
          <li class="row">
            <div class="grow">
              <strong>{{ labels[r.type] }}</strong>
              <div>{{ describe(r) }}</div>
              @if (r.reason) { <div class="muted small">Reason: {{ r.reason }}</div> }
              <div class="muted small">{{ r.createdAt | date: 'MMM d, h:mm a' }}</div>
            </div>
            <button type="button" class="btn btn-primary btn-sm" (click)="decide(r, true)" [disabled]="busy()">Approve</button>
            <button type="button" class="btn btn-quiet btn-sm" (click)="decide(r, false)" [disabled]="busy()">Reject</button>
          </li>
        } @empty {
          <li class="row muted">Nothing to review.</li>
        }
      </ul>
    </div>
  `,
  styles: `.grow { flex: 1; } .filter { max-width: 320px; margin-bottom: 1rem; }`,
})
export class IncomingPage implements OnInit {
  protected readonly requests = inject(RequestService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** ?type= from the requests menu */
  readonly type = input<string>();

  protected readonly types = GROUP_ADMIN_TYPES;
  protected readonly labels = REQUEST_LABELS;
  protected readonly describe = describeRequest;
  protected readonly busy = signal(false);
  protected readonly filtered = computed(() => {
    const t = this.type();
    return this.requests.incoming().filter((r) => !t || r.type === t);
  });

  ngOnInit(): void {
    this.requests.loadIncoming();
  }

  setType(type: string): void {
    this.router.navigate([], { queryParams: { type: type || null } });
  }

  decide(r: ChatRequest, approve: boolean): void {
    this.busy.set(true);
    (approve ? this.requests.approve(r._id) : this.requests.reject(r._id)).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show(approve ? 'Request approved' : 'Request rejected', 'success');
      },
      error: (err) => {
        this.busy.set(false);
        this.toast.show(errorMessage(err), 'error', 6000);
      },
    });
  }
}
