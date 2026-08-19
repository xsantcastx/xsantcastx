/**
 * celebration-sound-toggle.component.ts — the switch for the fanfare.
 *
 * Small on purpose. It exists because the celebration audio defaults to off
 * and a preference nobody can find is a preference nobody has: a thunderclap
 * that only ever plays if you know to open a console is a feature that does not
 * ship.
 *
 * Prerendered in its off state and hydrated from localStorage, so the button is
 * in the SSR HTML at the right size and the row does not move when the
 * preference arrives. `aria-pressed` rather than a checkbox because it is a
 * toggle button, not a form field, and screen readers announce the state
 * without needing a label change.
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';

import { CelebrationAudioService } from './celebration-audio.service';

@Component({
  selector: 'app-celebration-sound-toggle',
  standalone: true,
  imports: [AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="gf-sound"
      [class.gf-sound--on]="audio.enabled$ | async"
      [attr.aria-pressed]="(audio.enabled$ | async) ? 'true' : 'false'"
      [attr.aria-label]="(audio.enabled$ | async) ? 'Celebration sound on' : 'Celebration sound off'"
      (click)="toggle()">
      <span class="gf-sound__icon" aria-hidden="true">{{ (audio.enabled$ | async) ? '♫' : '♪' }}</span>
      <span class="gf-sound__label">{{ (audio.enabled$ | async) ? 'Sound on' : 'Sound off' }}</span>
    </button>
  `,
  styles: [`
    /* 44px minimum on the standalone control, per the site's own mobile rule. */
    .gf-sound {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      min-height: 44px;
      padding: 0.35rem 0.85rem;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(10, 6, 26, 0.55);
      color: rgba(233, 232, 245, 0.62);
      font: inherit;
      font-size: 0.78rem;
      letter-spacing: 0.04em;
      cursor: pointer;
      transition: color 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
    }

    .gf-sound:hover { color: rgba(233, 232, 245, 0.92); border-color: rgba(0, 255, 204, 0.35); }

    .gf-sound--on {
      color: #4dffe0;
      border-color: rgba(0, 255, 204, 0.45);
      box-shadow: 0 0 18px -6px rgba(0, 255, 204, 0.6);
    }

    .gf-sound__icon { font-size: 1rem; line-height: 1; }
  `],
})
export class CelebrationSoundToggleComponent {
  readonly audio = inject(CelebrationAudioService);

  toggle(): void {
    // Turning it on inside the click is what lets the AudioContext be created
    // in a gesture, so the very next celebration is audible rather than the one
    // after it.
    this.audio.toggle();
  }
}
