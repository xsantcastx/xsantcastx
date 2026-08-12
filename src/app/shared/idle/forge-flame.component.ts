/**
 * forge-flame.component.ts — the ambient forge, made visible.
 *
 * A small flame beside the XP bar. It breathes while idle XP is accruing,
 * brightens on a tool page where the rate is higher, dims to an ember when the
 * tab is hidden, and settles when the day's allowance is spent. Striking it
 * pays XP directly.
 *
 * The flame is drawn in CSS rather than as an emoji so it can actually change
 * state — an emoji cannot be dimmed, filled to a percentage, or made to flicker
 * at a rate that means something.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { IdleService, IdleSnapshot } from './idle.service';

interface Spark {
  id: number;
  angle: number;
}

@Component({
  selector: 'app-forge-flame',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ff" [attr.data-state]="snap.state">
      <button
        type="button"
        class="ff__btn"
        (click)="onStrike()"
        (mouseenter)="hover = true"
        (mouseleave)="hover = false"
        (focus)="hover = true"
        (blur)="hover = false"
        [class.ff__btn--hit]="hit"
        [attr.aria-label]="ariaLabel">

        <!-- Fill ring: how far through the current minute. -->
        <span class="ff__ring" aria-hidden="true" [style.--toward]="snap.toward"></span>

        <span class="ff__flame" aria-hidden="true">
          <span class="ff__inner"></span>
        </span>

        @for (s of sparks; track s.id) {
          <span class="ff__spark" aria-hidden="true" [style.--a.deg]="s.angle"></span>
        }
      </button>

      @if (hover) {
        <div class="ff__tip" role="tooltip">
          <p class="ff__tip-label">{{ snap.label }}</p>
          <p class="ff__tip-note">{{ snap.note }}</p>
          <dl class="ff__tip-stats">
            <div><dt>Idle XP</dt><dd>{{ snap.idleXp }}</dd></div>
            <div><dt>Strikes</dt><dd>{{ snap.strikes }}</dd></div>
          </dl>
          <p class="ff__tip-hint">Strike the flame for +1 XP</p>
        </div>
      }

      @if (century) {
        <span class="ff__century" role="status">Century Strike! +10 XP</span>
      }
    </div>
  `,
  styles: [`
    .ff { position: relative; display: inline-flex; }

    .ff__btn {
      position: relative;
      display: grid; place-items: center;
      width: 44px; height: 44px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(10, 6, 26, 0.55);
      cursor: pointer;
      transition: border-color .25s ease, box-shadow .25s ease, transform .12s ease;
    }
    .ff__btn:hover { border-color: rgba(255, 154, 90, 0.5); }
    /* The strike itself: a fast press, not a bounce. */
    .ff__btn--hit { transform: scale(.9); }

    /* ── The flame ─────────────────────────────────────────────────────────── */
    .ff__flame {
      position: relative;
      width: 13px; height: 18px;
      border-radius: 50% 50% 50% 50% / 62% 62% 38% 38%;
      /* Teardrop, point up. */
      clip-path: polygon(50% 0%, 82% 38%, 100% 72%, 78% 100%, 22% 100%, 0% 72%, 18% 38%);
      background: linear-gradient(180deg, #ffd9a0 0%, #ff9a5a 45%, #ff5a3c 100%);
      transition: opacity .4s ease, filter .4s ease, transform .4s ease;
    }
    .ff__inner {
      position: absolute; left: 50%; bottom: 12%;
      width: 5px; height: 8px;
      transform: translateX(-50%);
      border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
      background: linear-gradient(180deg, #fffdf5, #ffe9b8);
      opacity: .9;
    }

    /* ── The fill ring ─────────────────────────────────────────────────────── */
    .ff__ring {
      position: absolute; inset: 2px;
      border-radius: 50%;
      /* --toward is 0-1; the conic sweep is the minute in progress. */
      background: conic-gradient(
        rgba(255, 154, 90, 0.75) calc(var(--toward, 0) * 360deg),
        transparent 0
      );
      -webkit-mask: radial-gradient(circle, transparent 62%, #000 64%);
      mask: radial-gradient(circle, transparent 62%, #000 64%);
      transition: background .8s linear;
    }

    /* ── States ────────────────────────────────────────────────────────────── */

    /* Hidden tab: an ember. No motion, no glow — the forge is not working. */
    .ff[data-state="cooled"] .ff__flame { opacity: .3; filter: saturate(.25) brightness(.6); }
    .ff[data-state="cooled"] .ff__ring { opacity: .2; }

    /* Visible: a slow breath. */
    .ff[data-state="warming"] .ff__flame { animation: ffBreathe 3.2s ease-in-out infinite; }
    .ff[data-state="warming"] .ff__btn { box-shadow: 0 0 16px -8px rgba(255, 154, 90, .8); }

    /* On a tool page: faster, brighter, with a halo. */
    .ff[data-state="burning"] .ff__flame { animation: ffBreathe 1.9s ease-in-out infinite; filter: brightness(1.18); }
    .ff[data-state="burning"] .ff__btn {
      border-color: rgba(255, 154, 90, .55);
      box-shadow: 0 0 22px -6px rgba(255, 140, 60, .9);
    }

    /* Allowance spent: lit, steady, no glow. Still strikeable. */
    .ff[data-state="banked"] .ff__flame { opacity: .55; filter: saturate(.7); }

    @keyframes ffBreathe {
      0%, 100% { transform: scaleY(1)    translateY(0); }
      50%      { transform: scaleY(1.14) translateY(-1px); }
    }

    /* Rekindle: one warm pulse when the tab comes back. */
    .ff[data-state="warming"] .ff__btn,
    .ff[data-state="burning"] .ff__btn { animation: ffRekindle .7s ease-out 1; }
    @keyframes ffRekindle {
      0%   { box-shadow: 0 0 0 0 rgba(255, 154, 90, .55); }
      45%  { box-shadow: 0 0 26px 3px rgba(255, 154, 90, .55); }
      100% { box-shadow: 0 0 16px -8px rgba(255, 154, 90, .8); }
    }

    /* ── Sparks ────────────────────────────────────────────────────────────── */
    .ff__spark {
      position: absolute; left: 50%; top: 50%;
      width: 3px; height: 3px; border-radius: 50%;
      background: #ffd9a0;
      pointer-events: none;
      animation: ffSpark .62s ease-out forwards;
    }
    @keyframes ffSpark {
      from { transform: translate(-50%, -50%) rotate(var(--a)) translateY(0) scale(1); opacity: 1; }
      to   { transform: translate(-50%, -50%) rotate(var(--a)) translateY(-26px) scale(.2); opacity: 0; }
    }

    /* ── Tooltip ───────────────────────────────────────────────────────────── */
    .ff__tip {
      position: absolute; top: calc(100% + 8px); right: 0; z-index: 60;
      width: max-content; max-width: min(260px, calc(100vw - 32px));
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(255, 154, 90, 0.25);
      background: rgba(6, 4, 18, 0.96);
      box-shadow: 0 16px 40px -18px rgba(0, 0, 0, .9);
      pointer-events: none;
    }
    .ff__tip-label { margin: 0 0 3px; font: 600 12px/1.3 'Orbitron', system-ui, sans-serif; color: #ffb27a; }
    .ff__tip-note  { margin: 0 0 8px; font-size: 11px; color: #9fb4ae; }
    .ff__tip-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 0 0 6px; }
    .ff__tip-stats dt { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: #7d918c; }
    .ff__tip-stats dd { margin: 2px 0 0; font: 600 13px/1 'Orbitron', system-ui, sans-serif; color: #eafff9; }
    .ff__tip-hint { margin: 0; font-size: 10px; font-style: italic; color: #6d817c; }

    .ff__century {
      position: absolute; top: calc(100% + 8px); right: 0; z-index: 61;
      white-space: nowrap;
      padding: 7px 12px;
      border-radius: 999px;
      border: 1px solid #C9A84C;
      background: rgba(6, 4, 18, 0.96);
      font: 700 11px/1 'Orbitron', system-ui, sans-serif;
      color: #C9A84C;
      animation: ffCentury 1.9s ease-out forwards;
    }
    @keyframes ffCentury {
      0%   { opacity: 0; transform: translateY(-4px); }
      12%  { opacity: 1; transform: none; }
      80%  { opacity: 1; }
      100% { opacity: 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .ff__flame, .ff__btn { animation: none !important; }
      .ff__ring { transition: none; }
      .ff__spark { display: none; }
      .ff__century { animation: none; opacity: 1; }
    }
  `],
})
export class ForgeFlameComponent implements OnInit, OnDestroy {
  private readonly idle = inject(IdleService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly subs = new Subscription();
  private timers: Array<ReturnType<typeof setTimeout>> = [];
  private sparkSeq = 0;

  snap: IdleSnapshot = this.idle.snapshot;
  hover = false;
  hit = false;
  century = false;
  sparks: Spark[] = [];

  ngOnInit(): void {
    this.idle.init();

    this.subs.add(this.idle.snapshot$.subscribe(s => {
      this.snap = s;
      this.cdr.markForCheck();
    }));

    this.subs.add(this.idle.strike$.subscribe(e => {
      if (e.spark) this.throwSparks();
      if (e.century) this.showCentury();
      this.cdr.markForCheck();
    }));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    for (const t of this.timers) clearTimeout(t);
  }

  get ariaLabel(): string {
    return `Ambient forge. ${this.snap.label} ${this.snap.idleXp} idle XP earned, ${this.snap.strikes} forge strikes. Activate to strike the forge for XP.`;
  }

  onStrike(): void {
    // A strike inside the cooldown returns false and gets no feedback at all —
    // the button must not flash for an input that earned nothing.
    if (!this.idle.strike()) return;
    if (!this.isBrowser) return;

    this.hit = true;
    this.timers.push(setTimeout(() => {
      this.hit = false;
      this.cdr.markForCheck();
    }, 120));
  }

  /** Six sparks on a fanned arc, cleaned up after the animation. */
  private throwSparks(): void {
    const batch: Spark[] = Array.from({ length: 6 }, (_, i) => ({
      id: this.sparkSeq++,
      angle: -60 + i * 24,
    }));
    this.sparks = [...this.sparks, ...batch];

    const ids = new Set(batch.map(s => s.id));
    this.timers.push(setTimeout(() => {
      this.sparks = this.sparks.filter(s => !ids.has(s.id));
      this.cdr.markForCheck();
    }, 700));
  }

  private showCentury(): void {
    this.century = true;
    this.timers.push(setTimeout(() => {
      this.century = false;
      this.cdr.markForCheck();
    }, 1900));
  }
}
