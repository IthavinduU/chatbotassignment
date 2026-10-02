import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { errorMessage } from '../../core/error';
import { ChatRequest, REQUEST_LABELS } from '../../core/models';
import { RequestService } from '../../services/request.service';
import { ToastService } from '../../services/toast.service';

/** Requests the user has sent and what happened to them. */
@Component({
  selector: 'app-my-requests-page',
  imports: [DatePipe, TitleCasePipe],
  template: `
    <div class="page">
      <header class="page-head">
        <h1>My requests</h1>
        <p class="muted">Requests you've sent and what happened to them.</p>
      </header>
      <ul class="rows">
        @for (r of requests.mine(); track r._id) {
          <li class="row">
            <div class="grow">
              <strong>{{ labels[r.type] }}</strong>
              <div class="small">{{ summary(r) }}</div>
              <div class="muted small">
                Sent {{ r.createdAt | date: 'MMM d, h:mm a' }}
                @if (r.handledByName) { · {{ r.status }} by {{ r.handledByName }} }
              </div>
            </div>
            <span class="tag" [class]="'tag tag-' + r.status">{{ r.status | titlecase }}</span>
            @if (r.status === 'pending') {
              <button type="button" class="btn btn-quiet btn-sm" (click)="cancel(r)">Cancel</button>
            }
          </li>
        } @empty {
          <li class="row muted">You haven't sent any requests.</li>
        }
      </ul>
    </div>
  `,
  styles: `.grow { flex: 1; }`,
})
export class MyRequestsPage implements OnInit {
  protected readonly requests = inject(RequestService);
  private readonly toast = inject(ToastService);
  protected readonly labels = REQUEST_LABELS;

  ngOnInit(): void {
    this.requests.loadMine().subscribe();
  }

  /** Short description of what the request was for. */
  summary(r: ChatRequest): string {
    switch (r.type) {
      case 'createChannel': return `#${r.name} in ${r.groupName}`;
      case 'deleteChannel': return `#${r.channelName} in ${r.groupName}`;
      case 'createGroup': return `"${r.name}"${r.ageLimit ? `, age ${r.ageLimit}+` : ''}`;
      case 'promoteMember': return `${r.targetName} in ${r.groupName}`;
      default: return r.groupName ?? '';
    }
  }

  /** Cancels a pending request. */
  cancel(r: ChatRequest): void {
    this.requests.cancel(r._id).subscribe({ error: (err) => this.toast.show(errorMessage(err), 'error') });
  }
}