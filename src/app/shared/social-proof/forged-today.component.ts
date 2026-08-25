/**
 * forged-today.component.ts — "N Keepers forged today", bottom-left.
 *
 * ─── POSITIONING ────────────────────────────────────────────────────────────
 * This is the fourth tenant of the bottom-left corner, after the NPC portrait,
 * the install banner and (full-width, so it overlaps every corner) the cookie
 * banner. The registry lives in `install-prompt.component.ts` and this is now
 * in it.
 *
 * It uses the mechanism that corner already agreed on rather than inventing a
 * fifth one: it publishes its own measured height as `--forged-lift` on <html>,
 * and the install banner adds that to its `bottom` the same way it already adds
 * `--npc-lift`. One-way — this never reads anything of the install banner's —
 * and the property is removed the moment the widget is not on screen, so the
 * `0px` default applies on every page without it.
 *
 * It sits *below* the NPC portrait in the stack rather than beside it: the NPC
 * is a character standing next to the page and this is a notice about the page,
 * so the notice is what moves. Concretely, this reads `--npc-lift` in its own
 * `bottom` and the install banner then clears both.
 *
 * Must be a sibling of <main> in app.component.html, never a child of a routed
 * component: routeFadeIn leaves a transform on every routed host, which makes
 * it a containing block, and `position: fixed` inside one is pinned to the page
 * rather than the viewport.
 *
 * ─── WHY THERE IS NO EMOJI IN IT ────────────────────────────────────────────
 * The brief asked for a flame emoji. The design system is explicit that emoji
 * are never icons, and `check-ds-adherence.js` fails the build on one in a
 * template. The mark below is an inline SVG ember drawn from the same `--ember`
 * token the Forge Flame and Kael use, which is what the emoji was standing in
 * for anyway.
 */
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  afterRenderEffect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { ForgedTodayService } from './forged-today.service';
import { TranslationService } from '../../translation.service';

@Component({
  selector: 'app-forged-today',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (count() !== null) {
      <aside class="ft" #root [attr.aria-label]="label()">
        <!-- The ember. Decorative: the count and its unit are both in the text
             beside it, and the whole widget carries an aria-label. -->
        <svg class="ft__mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path class="ft__flame"
                d="M12 2.5c.8 3.1-.6 4.6-2 6-1.7 1.7-3.4 3.3-3.4 6.2A5.4 5.4 0 0 0 12 20.2a5.4 5.4 0 0 0 5.4-5.5c0-2.4-1.1-3.8-2.2-5.2-.5.7-1.1 1.2-1.8 1.4.9-2.8-.2-6-1.4-8.4Z" />
          <path class="ft__core"
                d="M12 12.4c.6 1.4.2 2.2-.3 2.9-.5.7-1 1.3-1 2.2a2.3 2.3 0 0 0 4.6 0c0-1.4-1.3-2.4-2-3.4-.4-.6-.8-1.1-1.3-1.7Z" />
        </svg>
        <p class="ft__text">
          <span class="ft__count">{{ count() }}</span>
          <span class="ft__unit">{{ unit() }}</span>
        </p>
      </aside>
    }
  `,
  styles: [`
    /* The mobile tab bar (.gftabs) exists only below 961px — the same
       obstruction the NPC portrait and the install banner clear, cleared the
       same way and at the same breakpoint. */
    @media (max-width: 960px) {
      .ft { --ft-tabs-clear: var(--gftabs-h, 58px); }
    }
    /* Below 768px the Forge Flame moves to bottom-CENTRE and is 80px tall, so
       "opposite corners" stops being true on a phone. */
    @media (max-width: 768px) {
      .ft { --ft-tabs-clear: calc(var(--gftabs-h, 58px) + 18px + 80px + 12px); }
    }

    .ft {
      position: fixed;
      left: calc(var(--shell-sidebar-w, 0px) + clamp(12px, 3vw, 26px));
      bottom: calc(
        clamp(12px, 3vw, 26px)
        + env(safe-area-inset-bottom, 0px)
        + var(--npc-lift, 0px)
        + var(--ft-tabs-clear, 0px)
      );
      /* Below the Forge Flame (--z-flame) on purpose, for the reason the
         install banner is: if a future layout ever does bring them together,
         the flame — a primary interaction — must win the click. */
      z-index: var(--z-fx);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 0.7rem 0.4rem 0.55rem;
      border-radius: var(--radius-pill);
      border: 1px solid var(--edge-hairline);
      background: var(--veil-glass);
      backdrop-filter: blur(var(--blur-chip, 6px));
      color: var(--text-muted);
      font-family: var(--font-ui);
      font-size: var(--text-2xs);
      letter-spacing: var(--tracking-eyebrow);
      text-transform: uppercase;
      /* Non-intrusive means non-intrusive: it is a readout, not a control, and
         nothing behind it should stop being clickable because of it. */
      pointer-events: none;
      transition: bottom 220ms ease;
    }

    .ft__mark {
      width: 14px;
      height: 14px;
      flex: none;
    }
    .ft__flame { fill: var(--ember); opacity: 0.85; }
    .ft__core  { fill: var(--gold-bright); opacity: 0.9; }

    .ft__text {
      margin: 0;
      display: flex;
      align-items: baseline;
      gap: 0.35rem;
      white-space: nowrap;
    }

    /* The readout family, per the type scale's --type-readout role. */
    .ft__count {
      font-family: var(--font-system);
      color: var(--text-accent);
      font-weight: var(--weight-semibold);
      font-variant-numeric: tabular-nums;
    }

    /* The ember breathes so the widget reads as activity rather than as a
       static badge. Opacity only — no transform, no filter — so it composites
       on its own layer and costs nothing on a phone. */
    @media (prefers-reduced-motion: no-preference) {
      .ft__core {
        animation: ftBreathe 3.4s ease-in-out infinite;
      }
    }
    @keyframes ftBreathe {
      0%, 100% { opacity: 0.55; }
      50%      { opacity: 1; }
    }
  `],
})
export class ForgedTodayComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly doc = inject(DOCUMENT);
  private readonly forged = inject(ForgedTodayService);
  private readonly i18n = inject(TranslationService);

  private readonly root = viewChild<ElementRef<HTMLElement>>('root');
  private sub?: Subscription;

  /** null until a real number arrives. See the service on why 0 is not shown. */
  readonly count = signal<number | null>(null);

  constructor() {
    // Publish this widget's height so the install banner can sit above it —
    // the same one-way contract the NPC portrait already uses for `--npc-lift`.
    // afterRenderEffect rather than requestAnimationFrame: rAF inside a
    // subscription runs before Angular has written the view, so the query is
    // empty and every measurement is of nothing.
    afterRenderEffect(() => {
      this.count();
      this.measure();
    });
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.sub = this.forged.count$.subscribe(n => this.count.set(n));
    void this.forged.start();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.forged.stop();
    this.setLift(0);
  }

  /**
   * "Keeper" or "Keepers".
   *
   * A real plural rather than "Keeper(s)": this widget's entire job is to be
   * believable at small numbers, and the first thing that undermines a count of
   * 1 is copy that was clearly written expecting more.
   */
  unit(): string {
    return this.i18n.translate(
      this.count() === 1 ? 'social.forged.one' : 'social.forged.many',
    );
  }

  /** The whole widget as one string, for a screen reader. */
  label(): string {
    return `${this.count()} ${this.unit()}`;
  }

  private measure(): void {
    const el = this.root()?.nativeElement;
    this.setLift(el ? el.getBoundingClientRect().height + 12 : 0);
  }

  private setLift(px: number): void {
    if (!this.isBrowser) return;
    const root = this.doc.documentElement;
    if (px <= 0) root.style.removeProperty('--forged-lift');
    else root.style.setProperty('--forged-lift', `${Math.round(px)}px`);
  }
}
