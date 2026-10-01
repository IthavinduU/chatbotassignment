import { Component, input } from '@angular/core';

/** fabulari logo: three chat bubbles in the app's red, yellow and blue. */
@Component({
  selector: 'app-logo',
  template: `
    <span class="logo" [class.logo-small]="small()">
      <svg viewBox="0 0 64 40" aria-hidden="true" focusable="false">
        <path d="M4 4h18a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H12l-6 5v-5H4a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z" fill="#d62839" />
        <path d="M24 12h18a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H32l-6 5v-5h-2a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4z" fill="#f4b400" />
        <path d="M42 4h18a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4h-2v5l-6-5H42a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z" fill="#1f5aa6" />
      </svg>
      <span class="logo-word">fabulari</span>
    </span>
  `,
  styles: `
    .logo { display: inline-flex; align-items: center; gap: 0.6rem; font-weight: 800; font-size: 1.6rem; letter-spacing: -0.02em; color: var(--ink); }
    .logo svg { width: 64px; height: 40px; }
    .logo-small { font-size: 1.15rem; gap: 0.45rem; }
    .logo-small svg { width: 38px; height: 24px; }
  `,
})
export class Logo {
  readonly small = input(false);
}
