/**
 * discovery-toast.component.ts — "NEW DISCOVERY", once per thing, ever.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS NOT THE ACHIEVEMENT DROP
 * ─────────────────────────────────────────────────────────────────────────────
 * `AchievementDropComponent` already owns the bottom-right corner and already
 * escalates to a full-screen cinematic for the two rarest eggs. This is a
 * different event with a different meaning — an egg is something you *did*, a
 * discovery is something you now *have* — and stacking them in one corner would
 * put a Cinder Ore in the same slot the Singular egg takes over.
 *
 * So the reveal is centred and the card flips: it arrives face-down from below,
 * turns over to show what it is, throws a short sparkle, and leaves. The whole
 * thing is 2.6 seconds and it never blocks a click — `pointer-events` are on the
 * card alone, so a player mid-strike can keep striking through it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THERE IS A QUEUE
 * ─────────────────────────────────────────────────────────────────────────────
 * An expedition can come home with four new materials at once and the first
 * strike of a fresh save turns up a rune, a charm and sometimes a scroll. Four
 * overlapping centred cards is unreadable, so they are shown one after another,
 * and a queue that has run long is truncated: past four waiting the rest are
 * dropped and the log is where they are read. The alternative — twelve seconds
 * of cinematics after one expedition — is the thing that makes a player turn a
 * feature off.
 *
 * Reduced motion gets the same card with no flight, no flip and no sparkle: a
 * static reveal that holds for the same beat and then fades.
 *
 * SSR: renders nothing until a discovery arrives, which cannot happen on the
 * server. The subscription is browser-only.
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

import { RUNE_TIERS } from '../rune-forge/rune.model';
import { artFor, type ArtEntry } from '../art/art';
import { CollectionService, type CollectionDiscovery } from './collection.service';
import {
  collectionCategory,
  type CollectionReward,
} from './collection.model';

interface Reveal {
  kind: 'discovery' | 'reward';
  eyebrow: string;
  name: string;
  line: string;
  foot: string;
  glyph: string;
  color: string;
  glow: string;
  art: ArtEntry | null;
  /** 0–100 completion after the find, for the thread under the card. */
  percent: number;
}

/** How long a card holds the middle of the screen, in ms. */
const HOLD_MS = 2600;
/** Cards allowed to wait. Past this the log is where the rest are read. */
const QUEUE_CAP = 4;

@Component({
  selector: 'app-discovery-toast',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (reveal) {
      <div class="dt-stage" aria-hidden="true"></div>
      <div
        class="dt"
        [class.dt--on]="visible"
        [class.dt--flipped]="flipped"
        [class.dt--reward]="reveal.kind === 'reward'"
        [style.--tier]="reveal.color"
        [style.--tier-glow]="reveal.glow"
        role="status"
        aria-live="polite"
        (click)="dismiss()">

        <div class="dt__card">
          <!-- Face down. The catalogue mark, never the name. -->
          <div class="dt__face dt__face--back" aria-hidden="true">
            <span class="dt__seal">✦</span>
          </div>

          <div class="dt__face dt__face--front">
            <p class="dt__eyebrow">{{ reveal.eyebrow }}</p>
            <div class="dt__art">
              @if (reveal.art) {
                <img [src]="reveal.art.src" [attr.srcset]="reveal.art.srcset"
                     sizes="96px" alt="" aria-hidden="true"
                     width="96" height="96" decoding="async" draggable="false">
              } @else {
                <span class="dt__glyph" aria-hidden="true">{{ reveal.glyph }}</span>
              }
            </div>
            <h2 class="dt__name">{{ reveal.name }}</h2>
            <p class="dt__line">{{ reveal.line }}</p>
            <p class="dt__foot">{{ reveal.foot }}</p>
            <span class="dt__thread" aria-hidden="true">
              <span class="dt__thread-fill" [style.width.%]="reveal.percent"></span>
            </span>
          </div>
        </div>

        @if (sparkling) {
          <div class="dt__sparks" aria-hidden="true">
            @for (p of sparks; track p) {
              <span class="dt__spark" [style.--a.deg]="p * 30" [style.--d]="p"></span>
            }
          </div>
        }
      </div>
    }
  `,
  styles: [`
    /* A stage rather than a veil: the card is centred over the page and the
       page stays fully visible and fully clickable behind it. */
    .dt-stage {
      position: fixed; inset: 0; z-index: var(--z-toast);
      pointer-events: none;
      background: radial-gradient(ellipse 40% 30% at 50% 46%, rgba(0, 0, 0, 0.42), transparent 70%);
      opacity: 0; animation: dtStage 2.6s ease forwards;
    }
    @keyframes dtStage { 12% { opacity: 1; } 76% { opacity: 1; } 100% { opacity: 0; } }

    .dt {
      position: fixed; left: 50%; top: 46%; z-index: var(--z-toast);
      transform: translate(-50%, -50%);
      pointer-events: none;
      perspective: 900px;
      width: min(19rem, calc(100vw - 2.5rem));
    }

    .dt__card {
      position: relative;
      pointer-events: auto;
      cursor: pointer;
      min-height: 20rem;
      transform-style: preserve-3d;
      /* Arrives from below, face-down, and lands. */
      transform: translateY(38vh) scale(0.7) rotateY(180deg);
      opacity: 0;
      transition:
        transform 620ms cubic-bezier(0.22, 1, 0.36, 1),
        opacity 260ms ease;
    }
    .dt--on .dt__card { transform: translateY(0) scale(1) rotateY(180deg); opacity: 1; }
    .dt--on.dt--flipped .dt__card { transform: translateY(0) scale(1) rotateY(0deg); }

    .dt__face {
      position: absolute; inset: 0;
      display: flex; flex-direction: column; align-items: center;
      gap: 0.4rem;
      padding: 1.15rem 1.1rem 1.3rem;
      border-radius: 16px;
      backface-visibility: hidden;
      border: 1px solid var(--tier, #a48bff);
      background:
        radial-gradient(ellipse 90% 60% at 50% 0%, color-mix(in srgb, var(--tier) 18%, transparent), transparent 70%),
        rgba(9, 6, 22, 0.94);
      box-shadow:
        0 0 0 1px rgba(255, 255, 255, 0.05) inset,
        0 18px 48px -12px rgba(0, 0, 0, 0.8),
        0 0 34px -6px var(--tier-glow, rgba(140, 110, 255, 0.6));
    }

    .dt__face--back {
      transform: rotateY(180deg);
      justify-content: center;
      background:
        repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0 6px, transparent 6px 12px),
        rgba(9, 6, 22, 0.96);
    }
    .dt__seal {
      font-size: 3rem; line-height: 1;
      color: var(--tier, #a48bff);
      text-shadow: 0 0 18px var(--tier-glow, rgba(140, 110, 255, 0.6));
    }

    .dt__eyebrow {
      margin: 0;
      font-size: 0.62rem; letter-spacing: 0.18em; text-transform: uppercase;
      font-weight: 700;
      color: var(--tier, #a48bff);
    }

    .dt__art {
      display: grid; place-items: center;
      width: 96px; height: 96px; margin: 0.15rem 0 0.1rem;
    }
    .dt__art img { width: 96px; height: 96px; object-fit: contain; filter: drop-shadow(0 0 14px var(--tier-glow)); }
    .dt__glyph {
      font-size: 3rem; line-height: 1;
      color: var(--tier, #a48bff);
      text-shadow: 0 0 18px var(--tier-glow);
    }

    .dt__name {
      margin: 0; text-align: center;
      font-size: 1.05rem; font-weight: 700; line-height: 1.25;
      color: #f4f1ff;
    }
    .dt__line {
      margin: 0; text-align: center;
      font-size: 0.76rem; line-height: 1.45;
      color: rgba(226, 222, 245, 0.72);
    }
    .dt__foot {
      margin: 0.1rem 0 0; text-align: center;
      font-size: 0.66rem; letter-spacing: 0.06em;
      color: rgba(226, 222, 245, 0.5);
    }

    .dt__thread {
      display: block; width: 100%; height: 3px; margin-top: auto;
      border-radius: 999px; overflow: hidden;
      background: rgba(255, 255, 255, 0.08);
    }
    .dt__thread-fill {
      display: block; height: 100%;
      background: linear-gradient(90deg, var(--tier), color-mix(in srgb, var(--tier) 40%, #ffffff));
      box-shadow: 0 0 10px var(--tier-glow);
      transition: width 700ms ease 400ms;
    }

    /* Twelve shards thrown outward on custom-property angles — the same trick
       the achievement drop uses, at a third of the count. */
    .dt__sparks { position: absolute; inset: 0; pointer-events: none; }
    .dt__spark {
      position: absolute; left: 50%; top: 50%;
      width: 3px; height: 3px; border-radius: 50%;
      background: var(--tier, #a48bff);
      box-shadow: 0 0 8px var(--tier-glow);
      transform: rotate(var(--a)) translateX(0);
      animation: dtSpark 900ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
      animation-delay: calc(var(--d) * 14ms);
    }
    @keyframes dtSpark {
      0%   { opacity: 0; transform: rotate(var(--a)) translateX(20px) scale(0.4); }
      25%  { opacity: 1; }
      100% { opacity: 0; transform: rotate(var(--a)) translateX(148px) scale(1.1); }
    }

    .dt--reward .dt__face { border-width: 2px; }

    @media (max-width: 480px) {
      .dt { width: min(16.5rem, calc(100vw - 2rem)); }
      .dt__card { min-height: 18rem; }
    }

    /* The static path. Same card, same beat, no flight, no flip, no sparks —
       a reveal that is legible rather than absent. */
    @media (prefers-reduced-motion: reduce) {
      .dt-stage { animation: none; opacity: 1; }
      .dt__card,
      .dt--on .dt__card,
      .dt--on.dt--flipped .dt__card {
        transform: none;
        opacity: 0;
        transition: opacity 200ms ease;
      }
      .dt--on .dt__card { opacity: 1; }
      .dt__face--back { display: none; }
      .dt__thread-fill { transition: none; }
      .dt__spark { animation: none; display: none; }
    }
  `],
})
export class DiscoveryToastComponent implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly collection = inject(CollectionService);
  private readonly cdr = inject(ChangeDetectorRef);

  reveal: Reveal | null = null;
  visible = false;
  flipped = false;
  sparkling = false;
  readonly sparks = Array.from({ length: 12 }, (_, i) => i);

  private readonly subs: Subscription[] = [];
  private readonly queue: Reveal[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private running = false;

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.subs.push(this.collection.discovery$.subscribe(d => this.enqueue(this.fromDiscovery(d))));
    this.subs.push(this.collection.reward$.subscribe(r => this.enqueue(this.fromReward(r))));
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.clearTimers();
  }

  dismiss(): void {
    if (!this.running) return;
    this.clearTimers();
    this.finish();
  }

  // ── Queue ──────────────────────────────────────────────────────────────────

  private enqueue(reveal: Reveal): void {
    if (this.queue.length >= QUEUE_CAP) return;
    this.queue.push(reveal);
    if (!this.running) this.next();
  }

  private next(): void {
    const reveal = this.queue.shift();
    if (!reveal) { this.running = false; return; }

    this.running = true;
    this.reveal = reveal;
    this.visible = false;
    this.flipped = false;
    this.sparkling = false;
    this.cdr.markForCheck();

    // One frame face-down at rest, then the flight, then the flip. Split so the
    // browser has a paint to transition *from* — setting both in the same tick
    // makes the card appear already landed.
    this.timers.push(setTimeout(() => { this.visible = true; this.cdr.markForCheck(); }, 30));
    this.timers.push(setTimeout(() => { this.flipped = true; this.cdr.markForCheck(); }, 560));
    this.timers.push(setTimeout(() => { this.sparkling = true; this.cdr.markForCheck(); }, 900));
    this.timers.push(setTimeout(() => this.finish(), HOLD_MS));
  }

  private finish(): void {
    this.visible = false;
    this.cdr.markForCheck();
    this.timers.push(setTimeout(() => {
      this.reveal = null;
      this.sparkling = false;
      this.cdr.markForCheck();
      this.next();
    }, 300));
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  // ── Content ────────────────────────────────────────────────────────────────

  private fromDiscovery(d: CollectionDiscovery): Reveal {
    const tier = RUNE_TIERS[d.entry.rarity];
    const cat = collectionCategory(d.entry.category);
    return {
      kind: 'discovery',
      // A recipe is not a thing you found, it is a thing you now know how to
      // make, and the card reads wrong announcing it as a discovery.
      eyebrow: d.entry.category === 'recipe' ? 'New recipe discovered' : 'New discovery',
      name: d.entry.name,
      line: d.entry.lore,
      foot: `${tier.label} ${cat.label.replace(/s$/, '')} · ${d.completion.found}/${d.completion.total} collected`,
      glyph: cat.icon,
      color: tier.color,
      glow: tier.glow,
      art: artFor(d.entry.artId ?? d.entry.id),
      percent: d.completion.percent,
    };
  }

  private fromReward(r: CollectionReward): Reveal {
    return {
      kind: 'reward',
      eyebrow: `${r.at}% complete`,
      name: r.title,
      line: r.blurb,
      foot: `+${r.gold.toLocaleString()} Gold · title unlocked`,
      glyph: '✦',
      color: '#c89868',
      glow: 'rgba(200, 152, 104, 0.7)',
      art: r.item ? artFor(r.item) : null,
      percent: r.at,
    };
  }
}
