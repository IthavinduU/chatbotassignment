import { Component, computed, input } from '@angular/core';
import { fileUrl } from '../core/config';

/** Profile picture, or the first letter of the username when there isn't one. */
@Component({
  selector: 'app-avatar',
  template: `
    @if (src()) {
      <img class="avatar" [src]="src()" alt="" [style.width.px]="size()" [style.height.px]="size()" />
    } @else {
      <span class="avatar avatar-letter" aria-hidden="true" [style.width.px]="size()" [style.height.px]="size()"
            [style.font-size.px]="size() * 0.45">{{ letter() }}</span>
    }
  `,
  styles: `
    :host { display: inline-flex; flex-shrink: 0; }
    .avatar { border-radius: 50%; object-fit: cover; }
    .avatar-letter { display: inline-grid; place-items: center; background: var(--accent-soft); color: var(--accent-ink); font-weight: 800; }
  `,
})
export class Avatar {
  readonly username = input.required<string>();
  readonly avatarUrl = input<string | null>(null);
  readonly size = input(32);

  protected readonly src = computed(() => fileUrl(this.avatarUrl()));
  protected readonly letter = computed(() => this.username().charAt(0).toUpperCase());
}
