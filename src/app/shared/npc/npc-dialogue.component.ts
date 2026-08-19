/**
 * npc-dialogue.component.ts — the portrait, the bubble, and the quest card.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHERE IT SITS, AND WHY THAT WAS THE HARD PART
 * ─────────────────────────────────────────────────────────────────────────────
 * A sibling of <main>, never inside a routed host: `routeFadeIn` leaves a
 * transform on every routed component, a transform makes a containing block, and
 * `position: fixed` inside one is pinned to the page rather than the viewport.
 * The flame, the quest drawer and the merge dialog are all mounted next to the
 * header for exactly this reason and this joins them.
 *
 * The corner it takes is bottom-left, which was already claimed by the install
 * prompt — the fourth widget in this repo's history to discover that the
 * viewport corners are a shared, unmanaged resource. Rather than a fifth silent
 * overlap, this writes `--npc-lift` on <html> with its own measured height and
 * the install prompt adds it to its `bottom`. One-way, one variable, and the
 * value is cleared the moment no NPC is on screen. The corner registry in
 * `install-prompt.component.ts` lists both.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE TYPEWRITER
 * ─────────────────────────────────────────────────────────────────────────────
 * Thirty characters a second, driven by one `setInterval` that is cleared on
 * every line change and on destroy. It runs outside Angular's zone and writes
 * the visible slice through a signal, so a forty-character line costs one
 * change-detection pass per frame in a component with no children rather than
 * thirteen application-wide ticks.
 *
 * Under `prefers-reduced-motion` the whole line is shown immediately. That is
 * the house rule — reduced motion means a static end state, never a missing one.
 */
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  NgZone,
  OnInit,
  PLATFORM_ID,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { artFor } from '../art/art';
import { formatCurrency, formatCurrencyExact } from '../economy/economy.model';
import { NpcPresence, NpcDialogueService } from './npc-dialogue.service';
import { NpcQuestService } from './npc-quest.service';

/** Characters a second. The spec's 30, spelled out so the spec can assert it. */
export const TYPE_CPS = 30;

@Component({
  selector: 'app-npc-dialogue',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (presence(); as p) {
      <div
        class="npc"
        #root
        [class.npc--open]="open()"
        [style.--npc-color]="p.npc.color"
        [style.--npc-glow]="p.npc.glow"
      >
        <button
          type="button"
          class="npc__portrait"
          [attr.aria-expanded]="open()"
          [attr.aria-label]="portraitLabel(p)"
          (click)="toggle()"
        >
          @if (art(); as a) {
            <img class="npc__art" [src]="a.src" [srcset]="a.srcset" alt="" width="80" height="80" />
          } @else {
            <span class="npc__monogram" aria-hidden="true">{{ p.npc.monogram }}</span>
          }

          @if (indicator(); as mark) {
            <span class="npc__mark" [class.npc__mark--turnin]="mark === '?'" aria-hidden="true">{{ mark }}</span>
          }
        </button>

        <div class="npc__body">
          <div class="npc__bubble">
            <p class="npc__who">
              <span class="npc__name">{{ p.npc.name }}</span>
              @if (p.npc.epithet) {
                <span class="npc__epithet">, {{ p.npc.epithet }}</span>
              }
            </p>
            <p class="npc__line">{{ typed() }}<span class="npc__caret" [class.npc__caret--done]="!typing()" aria-hidden="true"></span></p>

            @if (open()) {
              <p class="npc__role">{{ p.npc.role }}</p>

              @if (p.chain.active; as q) {
                <div class="npc__quest">
                  <p class="npc__quest-title">
                    {{ q.title }}
                    <span class="npc__quest-step">{{ p.chain.done + 1 }} / {{ p.chain.total }}</span>
                  </p>
                  <p class="npc__quest-lore">{{ q.loreText }}</p>
                  <p class="npc__quest-desc">{{ q.description }}</p>
                  <div
                    class="npc__bar"
                    role="progressbar"
                    [attr.aria-valuenow]="q.progress"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    [attr.aria-label]="q.title + ' progress'"
                  >
                    <span class="npc__bar-fill" [style.width.%]="q.progress"></span>
                  </div>
                  <!-- Compact on screen, exact to assistive technology. The
                       shell's rule is that a compact number is never the only
                       value exposed — 100K is fine on a 300px card and useless
                       to somebody checking whether they are 4 short. -->
                  <p class="npc__count" [attr.aria-label]="exact(q.observed) + ' of ' + exact(q.target)">
                    <span aria-hidden="true">{{ compact(q.observed) }} / {{ compact(q.target) }}</span>
                  </p>

                  @if (q.turnInReady) {
                    <button
                      type="button"
                      class="npc__claim"
                      [attr.aria-label]="'Claim ' + q.title + ' — ' + exact(q.reward.gold) + ' Gold'"
                      (click)="claim(q.id)"
                    >
                      <span aria-hidden="true">Claim — {{ compact(q.reward.gold) }} Gold</span>
                    </button>
                  }
                </div>
              } @else {
                <p class="npc__quest-done">Nothing more is asked of you here. For now.</p>
              }
            }
          </div>

          <button type="button" class="npc__close" aria-label="Dismiss" (click)="dismissNpc($event)">×</button>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: contents; }

    /* Bottom-left, cleared of the two things the Eclipse shell puts there.
       Above 961px that is the 236px sidebar, which the widget is pushed past
       rather than painted under; below 961px it is the .gftabs bottom tab bar,
       which the widget is lifted above. The two are the exact complement of
       each other on the same breakpoint, so the left offset reads
       --shell-sidebar-w unconditionally and only the bottom offset needs the
       query. */
    .npc {
      position: fixed;
      left: calc(var(--shell-sidebar-w, 0px) + clamp(12px, 3vw, 26px));
      bottom: calc(clamp(12px, 3vw, 26px) + env(safe-area-inset-bottom, 0px));
      /* Between the install prompt (930) and the forge flame (940). */
      z-index: 935;
      display: flex;
      align-items: flex-end;
      gap: 10px;
      max-width: min(380px, calc(100vw - var(--shell-sidebar-w, 0px) - 32px));
      pointer-events: none;
    }
    .npc > * { pointer-events: auto; }

    /* ── the portrait ─────────────────────────────────────────────────────── */
    .npc__portrait {
      position: relative;
      flex: 0 0 auto;
      width: 80px; height: 80px;
      border-radius: 50%;
      padding: 0;
      cursor: pointer;
      display: grid;
      place-items: center;
      border: 1px solid color-mix(in srgb, var(--npc-color) 45%, transparent);
      background:
        radial-gradient(circle at 32% 28%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 44%),
        radial-gradient(circle at 50% 55%, var(--npc-color) 0%, rgba(10, 6, 26, 0.94) 82%);
      box-shadow: 0 0 12px var(--npc-glow), 0 0 34px -8px var(--npc-glow), inset 0 0 10px rgba(0,0,0,0.45);
      animation: npcBreathe 6.5s ease-in-out infinite;
    }
    .npc__portrait:focus-visible {
      outline: 2px solid var(--npc-color);
      outline-offset: 3px;
    }
    .npc__art {
      width: 100%; height: 100%;
      border-radius: 50%;
      object-fit: cover;
    }
    .npc__monogram {
      font: 700 20px/1 'Orbitron', system-ui, sans-serif;
      letter-spacing: 0.06em;
      color: #f4f1ff;
      text-shadow: 0 0 8px rgba(0,0,0,0.6);
    }

    /* The ! / ? badge. Text, not colour alone — it reads on a mono display and
       through every form of colour blindness. */
    .npc__mark {
      position: absolute;
      top: -4px; right: -4px;
      min-width: 22px; height: 22px;
      border-radius: 11px;
      display: grid; place-items: center;
      font: 700 14px/1 'Orbitron', system-ui, sans-serif;
      color: #1b1226;
      background: #E8D44D;
      box-shadow: 0 0 10px rgba(232, 212, 77, 0.7);
      animation: npcMark 2.4s ease-in-out infinite;
    }
    .npc__mark--turnin { background: #6affe0; box-shadow: 0 0 10px rgba(106, 255, 224, 0.7); }

    /* ── the bubble ───────────────────────────────────────────────────────── */
    .npc__body { position: relative; min-width: 0; }

    .npc__bubble {
      position: relative;
      padding: 10px 30px 11px 13px;
      border-radius: 14px;
      /* Near-opaque rather than the 0.55 the glassy-panel pattern uses. That
         pattern leans on backdrop-filter to separate a panel from what is
         behind it, and backdrop-filter is switched off site-wide below 768px
         for the compositor budget — so on a phone a translucent bubble is just
         the page showing through the character's dialogue. Opacity is the only
         lever left, and this is the value at which the hero CTA behind it stops
         being legible through the text. */
      background: rgba(8, 5, 20, 0.97);
      border: 1px solid color-mix(in srgb, var(--npc-color) 26%, rgba(255,255,255,0.08));
      box-shadow: 0 0 26px -10px var(--npc-glow);
      color: #ddd7ee;
      max-height: min(58vh, 520px);
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    .npc--open .npc__bubble { background: rgba(8, 5, 20, 0.99); }

    .npc__who { margin: 0 0 2px; font-size: 11px; letter-spacing: 0.09em; text-transform: uppercase; }
    .npc__name { color: var(--npc-color); font-weight: 700; }
    .npc__epithet { color: #8b83a3; }
    .npc__line { margin: 0; font-size: 13.5px; line-height: 1.45; }
    .npc__role { margin: 9px 0 0; font-size: 12px; font-style: italic; color: #8b83a3; }

    .npc__caret {
      display: inline-block;
      width: 7px; height: 1em;
      margin-left: 2px;
      vertical-align: -2px;
      background: var(--npc-color);
      animation: npcCaret 1s steps(1) infinite;
    }
    .npc__caret--done { display: none; }

    /* ── the quest card ───────────────────────────────────────────────────── */
    .npc__quest { margin-top: 11px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.08); }
    .npc__quest-title {
      margin: 0; display: flex; justify-content: space-between; gap: 10px;
      font: 700 13px/1.3 'Orbitron', system-ui, sans-serif; color: var(--npc-color);
    }
    .npc__quest-step { color: #6f6885; font-weight: 500; font-size: 11px; white-space: nowrap; }
    .npc__quest-lore { margin: 6px 0 0; font-size: 12px; font-style: italic; color: #9d95b5; line-height: 1.45; }
    .npc__quest-desc { margin: 7px 0 0; font-size: 12.5px; }
    .npc__quest-done { margin: 10px 0 0; font-size: 12px; font-style: italic; color: #8b83a3; }

    .npc__bar {
      margin-top: 8px; height: 6px; border-radius: 3px;
      background: rgba(255,255,255,0.07); overflow: hidden;
    }
    .npc__bar-fill {
      display: block; height: 100%;
      background: linear-gradient(90deg, var(--npc-color), color-mix(in srgb, var(--npc-color) 40%, #7b61ff));
      transition: width 420ms ease;
    }
    .npc__count { margin: 5px 0 0; font-size: 11px; color: #8b83a3; }

    .npc__claim {
      margin-top: 10px; width: 100%;
      min-height: 44px;
      border-radius: 10px; cursor: pointer;
      border: 1px solid var(--npc-color);
      background: color-mix(in srgb, var(--npc-color) 16%, rgba(10,6,26,0.9));
      color: #fff;
      font: 700 13px/1 'Orbitron', system-ui, sans-serif;
      letter-spacing: 0.04em;
    }
    .npc__claim:hover { background: color-mix(in srgb, var(--npc-color) 28%, rgba(10,6,26,0.9)); }
    .npc__claim:focus-visible { outline: 2px solid var(--npc-color); outline-offset: 2px; }

    /* 44px hit area on a 22px glyph, per the mobile-rescue rule. */
    .npc__close {
      position: absolute; top: -2px; right: -2px;
      width: 44px; height: 44px;
      display: grid; place-items: center;
      background: none; border: 0; cursor: pointer;
      color: #6f6885; font-size: 20px; line-height: 1;
    }
    .npc__close:hover { color: #ddd7ee; }
    .npc__close:focus-visible { outline: 2px solid var(--npc-color); outline-offset: -6px; border-radius: 8px; }

    @keyframes npcBreathe {
      0%, 100% { transform: scale(1);    box-shadow: 0 0 12px var(--npc-glow), 0 0 34px -8px var(--npc-glow), inset 0 0 10px rgba(0,0,0,0.45); }
      50%      { transform: scale(1.04); box-shadow: 0 0 18px var(--npc-glow), 0 0 46px -6px var(--npc-glow), inset 0 0 10px rgba(0,0,0,0.45); }
    }
    @keyframes npcMark { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
    @keyframes npcCaret { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }

    /* Under 520px the bubble is the row, and the portrait shrinks out of the
       way of it — 380px of bubble beside an 80px portrait does not fit a 375px
       viewport, which is the width this site is checked at. */
    /* The tab bar renders only here. --gftabs-h is defined on :root. */
    @media (max-width: 960px) {
      .npc {
        bottom: calc(
          clamp(12px, 3vw, 26px)
          + env(safe-area-inset-bottom, 0px)
          + var(--gftabs-h, 58px)
        );
      }
    }

    /* At the phone breakpoint the forge flame stops being a bottom-right corner
       widget and becomes an 80px bottom-CENTRE target, sitting
       58px + safe-area + 18px up — so bottom-left at that height is no longer a
       free corner, it is directly beside the one thing on the page that is
       meant to be hit dozens of times in a row. The portrait stacks above the
       flame instead of beside it. The numbers below mirror the flame's own
       rules in forge-flame.component.ts; they are the flame's offset, its
       height, and a gap. */
    @media (max-width: 768px) {
      .npc {
        bottom: calc(
          env(safe-area-inset-bottom, 0px)
          + var(--gftabs-h, 58px)
          + 18px
          + 80px
          + 12px
        );
      }
    }

    @media (max-width: 520px) {
      .npc { max-width: calc(100vw - 24px); gap: 8px; }
      .npc__portrait { width: 56px; height: 56px; }
      .npc__monogram { font-size: 15px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .npc__portrait, .npc__mark, .npc__caret { animation: none; }
      .npc__bar-fill { transition: none; }
      .npc__caret { display: none; }
    }
  `],
})
export class NpcDialogueComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly doc = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogue = inject(NpcDialogueService);
  private readonly chains = inject(NpcQuestService);

  private readonly root = viewChild<ElementRef<HTMLElement>>('root');

  readonly presence = signal<NpcPresence | null>(null);
  readonly open = signal(false);
  /** Characters of the line revealed so far. */
  private readonly revealed = signal(0);

  readonly typed = computed(() => (this.presence()?.line ?? '').slice(0, this.revealed()));
  readonly typing = computed(() => this.revealed() < (this.presence()?.line.length ?? 0));

  readonly art = computed(() => artFor(this.presence()?.npc.artId));

  /** `!` when a step is on offer, `?` when one is ready to turn in, else null. */
  readonly indicator = computed<'!' | '?' | null>(() => {
    const c = this.presence()?.chain;
    if (!c) return null;
    if (c.turnInReady) return '?';
    return c.offerReady ? '!' : null;
  });

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    /*
     * Publish this widget's height as `--npc-lift` so the install banner, which
     * shares this corner, can sit above it.
     *
     * This was a `requestAnimationFrame` inside the presence subscription, and
     * it never once produced a value: the callback ran before Angular had
     * created the view, so the `#root` query was still empty and every
     * measurement was of nothing. `afterRenderEffect` is the version that
     * cannot have that bug — it runs after the DOM has been written, and it
     * re-runs by itself whenever one of the signals it reads changes.
     *
     * It reads `typing()` rather than `typed()` deliberately. `typed()` changes
     * thirty times a second while a line is being revealed, and depending on it
     * would mean a `getBoundingClientRect()` per frame — a synchronous layout
     * flush, on every page, for a number only one other widget reads.
     * `typing()` is a boolean that flips once, when the line finishes, which is
     * the measurement that is actually authoritative.
     */
    afterRenderEffect(() => {
      this.presence();
      this.open();
      this.typing();
      this.measure();
    });
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.dialogue.init();

    this.dialogue.presence$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(p => {
        const changed = p?.lineId !== this.presence()?.lineId;
        this.presence.set(p);
        if (!p) {
          this.open.set(false);
          this.setLift(0);
          return;
        }
        if (changed) {
          this.open.set(false);
          this.startTyping(p.line);
        }
      });

    this.destroyRef.onDestroy(() => {
      this.stopTyping();
      this.setLift(0);
    });
  }

  toggle(): void {
    const next = !this.open();
    this.open.set(next);
    // Reading the line is what counts as having heard it, and opening the card
    // is the strongest signal of that available. It also means a line skimmed
    // in passing can come round again, which is what keeps an idle pool feeling
    // like a character rather than a playlist.
    if (next) this.dialogue.markHeard();
  }

  dismissNpc(event: Event): void {
    event.stopPropagation();
    this.open.set(false);
    this.dialogue.dismiss();
  }

  claim(stepId: string): void {
    this.chains.claim(stepId);
  }

  /** The shell's shared compact formatter. Display only. */
  compact(n: number): string { return formatCurrency(n); }

  /** The same number in full, for the accessible label beside it. */
  exact(n: number): string { return formatCurrencyExact(n); }

  portraitLabel(p: NpcPresence): string {
    const who = p.npc.epithet ? `${p.npc.name}, ${p.npc.epithet}` : p.npc.name;
    const mark = this.indicator();
    const suffix = mark === '?' ? ' — a task is ready to turn in'
      : mark === '!' ? ' — a task is on offer'
      : '';
    return `${who}${suffix}. ${this.open() ? 'Collapse' : 'Expand'} dialogue.`;
  }

  /** Click anywhere outside collapses the expanded card. Never hides the NPC. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    const el = this.root()?.nativeElement;
    if (el && !el.contains(event.target as Node)) this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.open.set(false);
  }

  // ───────────────────────────────────────────────────────────────────────────

  private startTyping(line: string): void {
    this.stopTyping();
    if (this.prefersReducedMotion()) {
      this.revealed.set(line.length);
      return;
    }
    this.revealed.set(0);
    this.zone.runOutsideAngular(() => {
      this.timer = setInterval(() => {
        const next = this.revealed() + 1;
        // The signal write is what schedules the re-render; running the interval
        // outside the zone keeps it from also scheduling an application tick.
        this.zone.run(() => this.revealed.set(next));
        if (next >= line.length) this.stopTyping();
      }, 1000 / TYPE_CPS);
    });
  }

  private stopTyping(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private prefersReducedMotion(): boolean {
    return this.isBrowser
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** Publish this widget's height so the install prompt can sit above it. */
  private measure(): void {
    const el = this.root()?.nativeElement;
    this.setLift(el ? el.getBoundingClientRect().height + 12 : 0);
  }

  private setLift(px: number): void {
    if (!this.isBrowser) return;
    const root = this.doc.documentElement;
    if (px <= 0) root.style.removeProperty('--npc-lift');
    else root.style.setProperty('--npc-lift', `${Math.round(px)}px`);
  }
}
