/**
 * forge-effects-toggle.component.ts — "Reduce effects", in the footer.
 *
 * The WebGL forge is the most expensive thing the site draws, so the visitor
 * gets a switch for it. It lives in the footer rather than behind a settings
 * route for two reasons: there is no settings route to put it behind, and a
 * performance escape hatch that requires a navigation to reach is one a
 * struggling device cannot comfortably get to.
 *
 * Rendered only where there is something to reduce — no canvas on the server,
 * none in an embedded tool, and none on a machine with no WebGL at all. It
 * deliberately keeps rendering once the visitor has switched effects *off*,
 * which is the only way back.
 */
import { ChangeDetectionStrategy, Component, PLATFORM_ID, inject } from '@angular/core';
import { AsyncPipe, isPlatformBrowser } from '@angular/common';

import { TranslationService } from '../../translation.service';
import { EmbedService } from '../embed.service';
import { ForgeEffectsService } from './forge-effects.service';

@Component({
  selector: 'app-forge-effects-toggle',
  standalone: true,
  imports: [AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (available) {
      <button
        type="button"
        class="gfx-toggle"
        role="switch"
        [attr.aria-checked]="(effects.reduced$ | async) ? 'true' : 'false'"
        (click)="effects.toggle()">
        <span class="gfx-toggle__track" aria-hidden="true">
          <span class="gfx-toggle__knob"></span>
        </span>
        <span class="gfx-toggle__label">{{ t('gfx.reduce') }}</span>
      </button>
    }
  `,
  styles: [`
    :host { display: block; }

    /* 44px of height with the label inside it, per the shell's touch rule —
       the visible track is smaller than the target, which is the point. */
    .gfx-toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.55rem;
      min-height: 44px;
      padding: 0.25rem 0.6rem;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      font-size: 0.78rem;
      letter-spacing: 0.05em;
      opacity: 0.62;
      cursor: pointer;
      transition: opacity 0.2s ease;
    }
    .gfx-toggle:hover,
    .gfx-toggle:focus-visible { opacity: 1; }
    .gfx-toggle:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; border-radius: 8px; }

    .gfx-toggle__track {
      position: relative;
      width: 30px;
      height: 16px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.22);
      background: rgba(255, 255, 255, 0.06);
      flex: none;
      transition: background 0.2s ease, border-color 0.2s ease;
    }
    .gfx-toggle__knob {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: currentColor;
      transition: transform 0.2s ease;
    }
    .gfx-toggle[aria-checked='true'] .gfx-toggle__track {
      background: rgba(255, 122, 24, 0.28);
      border-color: rgba(255, 179, 71, 0.6);
    }
    .gfx-toggle[aria-checked='true'] .gfx-toggle__knob { transform: translateX(14px); }

    @media (prefers-reduced-motion: reduce) {
      .gfx-toggle,
      .gfx-toggle__track,
      .gfx-toggle__knob { transition: none; }
    }
  `],
})
export class ForgeEffectsToggleComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly i18n = inject(TranslationService);
  private readonly embed = inject(EmbedService);
  readonly effects = inject(ForgeEffectsService);

  /** Nothing to offer where there was never going to be a scene. */
  readonly available =
    this.isBrowser && !this.embed.isEmbed && this.effects.webglSupported();

  t(key: string): string { return this.i18n.translate(key); }
}
