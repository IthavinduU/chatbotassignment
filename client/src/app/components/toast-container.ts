import { Component, inject } from '@angular/core';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-toasts',
  template: `
    <div class="toasts" role="status" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast" [class]="'toast toast-' + t.kind">
          <span>{{ t.text }}</span>
          <button type="button" (click)="toast.dismiss(t.id)" aria-label="Dismiss">×</button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts { position: fixed; right: 1rem; top: 1rem; display: grid; gap: 0.5rem; z-index: 100; max-width: min(360px, calc(100vw - 2rem)); }
    .toast { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: 10px; background: var(--ink); color: #fff; box-shadow: 0 6px 20px rgb(0 0 0 / 0.18); }
    .toast-success { background: #1e7a3d; }
    .toast-error { background: #b3261e; }
    .toast span { flex: 1; }
    .toast button { background: none; border: 0; color: inherit; font-size: 1.25rem; cursor: pointer; line-height: 1; }
  `,
})
export class ToastContainer {
  protected readonly toast = inject(ToastService);
}
