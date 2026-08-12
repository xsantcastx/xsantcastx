/**
 * forge-flame.component.ts — the ember in the bottom-right corner.
 *
 * Mounted once, in AppComponent, next to the quest drawer and for the same
 * reason: `position: fixed` inside a routed host is not fixed at all. Every
 * routed component carries a `routeFadeIn` transform with `fill: forwards`,
 * which makes it a containing block, and a flame mounted inside one would be
 * pinned to the bottom-right of the *page* rather than the viewport, and would
 * disappear when you scrolled.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THE FLAME IS FOR
 * ─────────────────────────────────────────────────────────────────────────────
 * Three jobs, in order of how often they matter:
 *   1. It says how much Gold you have without being asked.
 *   2. It is the click target, at 1 Gold plus whatever the hammers add.
 *   3. It grows. Six tiers, driven by how many upgrades are owned, because a
 *      forge earning 40 Gold a minute that looks exactly like one earning 1 is
 *      the flattest possible reward for the money.
 *
 * Reduced motion keeps all three. The flame holds a static glow, the sparks do
 * not fire and the floaters appear and fade without travelling — but the button
 * is the same button and every strike still pays.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { EconomyService, EconomySnapshot } from './economy.service';
import { formatCurrency, formatRate } from './economy.model';
import { ForgeAudioService } from './forge-audio.service';

/** One "+5" rising off the flame. */
interface Floater {
  key: number;
  text: string;
  /** Random horizontal offset so a fast clicker does not get one stacked column. */
  dx: number;
  big: boolean;
}

/** One spark in a burst. Angle and distance are precomputed, CSS does the rest. */
interface Spark {
  key: number;
  x: number;
  y: number;
  delay: number;
}

/** A milestone banner. Century Strike and Millennium Forge share the shape. */
interface Banner {
  title: string;
  sub: string;
  grand: boolean;
}

@Component({
  selector: 'app-forge-flame',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="ff"
      [attr.data-tier]="snap.flameTier"
      [attr.data-hammer]="snap.hammerVisual"
      [class.ff--quake]="quaking">

      @if (banner) {
        <div class="ff__banner" [class.ff__banner--grand]="banner.grand" role="status">
          <strong>{{ banner.title }}</strong>
          <span>{{ banner.sub }}</span>
        </div>
      }

      <!-- The readout. A tooltip on a hover-only surface would be unreachable on
           a phone, so this is a real panel: hover opens it on a pointer device,
           and the long-press-free path is the Market link inside it. -->
      <div class="ff__hud" [class.ff__hud--open]="hudOpen" aria-hidden="true">
        <span class="ff__hud-gold">{{ gold }} <span class="ff__hud-coin">&#129689;</span></span>
        <span class="ff__hud-rate">+{{ rate }}/min</span>
        <span class="ff__hud-hint">Click to forge</span>
        @if (snap.essence > 0) {
          <span class="ff__hud-essence">&#9889; {{ essence }} Essence</span>
        }
        <a class="ff__hud-market" routerLink="/market">Open the Market &rarr;</a>
      </div>

      <button
        type="button"
        class="ff__btn"
        (click)="onStrike()"
        (pointerenter)="hudOpen = true"
        (pointerleave)="hudOpen = false"
        (focus)="hudOpen = true"
        (blur)="hudOpen = false"
        [attr.aria-label]="label">
        <span class="ff__core" aria-hidden="true"></span>
        <span class="ff__ring" aria-hidden="true"></span>
        <span class="ff__ring ff__ring--outer" aria-hidden="true"></span>
        <span class="ff__glyph" aria-hidden="true">&#128293;</span>

        @for (s of sparks; track s.key) {
          <span class="ff__spark"
                [style.--sx.px]="s.x"
                [style.--sy.px]="s.y"
                [style.animation-delay.ms]="s.delay"
                aria-hidden="true"></span>
        }
      </button>

      <!-- A live region so a screen reader hears the payout without the -->
      <!-- floaters, which are decoration and are hidden from it. -->
      <p class="ff__sr" aria-live="polite">{{ announcement }}</p>

      @for (f of floaters; track f.key) {
        <span class="ff__float" [class.ff__float--big]="f.big" [style.--dx.px]="f.dx" aria-hidden="true">
          {{ f.text }}
        </span>
      }
    </div>
  `,
  styles: [`
    /* Sits above the footer and below the header's 1000, so the mobile drawer
       and the quest panel both still cover it. */
    .ff {
      position: fixed;
      right: clamp(12px, 3vw, 26px);
      bottom: clamp(12px, 3vw, 26px);
      z-index: 940;
      display: grid;
      place-items: center;
      pointer-events: none;
    }
    .ff > * { pointer-events: auto; }

    /* ── The button ─────────────────────────────────────────────────────── */
    .ff__btn {
      position: relative;
      display: grid; place-items: center;
      width: 64px; height: 64px;
      padding: 0;
      border: none; border-radius: 50%;
      background: transparent;
      cursor: pointer;
      transition: transform .18s cubic-bezier(.22, 1, .36, 1);
      -webkit-tap-highlight-color: transparent;
    }
    .ff__btn:active { transform: scale(.9); }
    .ff__btn:focus-visible { outline: 2px solid #4dffe0; outline-offset: 6px; border-radius: 50%; }

    /* The ember itself. Warm gradient per the forge palette: #E8752A → #C9A84C. */
    .ff__core {
      position: absolute; inset: 8px;
      border-radius: 50%;
      background:
        radial-gradient(circle at 36% 30%, #fff3d6 0%, #C9A84C 22%, #E8752A 58%, #6d2a12 92%);
      box-shadow:
        0 0 18px rgba(232, 117, 42, .55),
        0 0 44px -8px rgba(201, 168, 76, .55),
        inset 0 -4px 10px rgba(0, 0, 0, .45);
      animation: ffBreathe 3.6s ease-in-out infinite;
    }
    @keyframes ffBreathe {
      0%, 100% { transform: scale(1);    filter: brightness(1); }
      50%      { transform: scale(1.06); filter: brightness(1.18); }
    }

    .ff__glyph { position: relative; font-size: 22px; line-height: 1; filter: drop-shadow(0 1px 2px rgba(0,0,0,.6)); }

    /* Orbital rings. Tier decides how many are visible — see the tier block. */
    .ff__ring {
      position: absolute; inset: 0;
      border-radius: 50%;
      border: 1px dashed rgba(232, 117, 42, .45);
      opacity: 0;
      animation: ffSpin 18s linear infinite;
    }
    .ff__ring--outer {
      inset: -8px;
      border-style: solid;
      border-color: rgba(201, 168, 76, .28);
      animation: ffSpin 30s linear infinite reverse;
    }
    @keyframes ffSpin { to { transform: rotate(360deg); } }

    /* ── Growth. Each tier is one more thing the forge is doing. ─────────── */
    .ff[data-tier="1"] .ff__btn { width: 68px; height: 68px; }
    .ff[data-tier="1"] .ff__ring { opacity: .5; }

    .ff[data-tier="2"] .ff__btn { width: 72px; height: 72px; }
    .ff[data-tier="2"] .ff__ring, .ff[data-tier="2"] .ff__ring--outer { opacity: .55; }
    .ff[data-tier="2"] .ff__glyph { font-size: 25px; }

    .ff[data-tier="3"] .ff__btn { width: 78px; height: 78px; }
    .ff[data-tier="3"] .ff__ring, .ff[data-tier="3"] .ff__ring--outer { opacity: .7; }
    .ff[data-tier="3"] .ff__glyph { font-size: 27px; }
    .ff[data-tier="3"] .ff__core { box-shadow: 0 0 26px rgba(232,117,42,.7), 0 0 64px -8px rgba(201,168,76,.7), inset 0 -4px 10px rgba(0,0,0,.45); }

    .ff[data-tier="4"] .ff__btn { width: 84px; height: 84px; }
    .ff[data-tier="4"] .ff__ring, .ff[data-tier="4"] .ff__ring--outer { opacity: .85; }
    .ff[data-tier="4"] .ff__glyph { font-size: 30px; }
    .ff[data-tier="4"] .ff__core {
      background: radial-gradient(circle at 36% 30%, #fffaf0 0%, #ffd97a 20%, #E8752A 55%, #7b1f4a 94%);
      box-shadow: 0 0 32px rgba(232,117,42,.8), 0 0 80px -10px rgba(255,109,215,.5), inset 0 -4px 12px rgba(0,0,0,.5);
    }

    .ff[data-tier="5"] .ff__btn { width: 90px; height: 90px; }
    .ff[data-tier="5"] .ff__ring, .ff[data-tier="5"] .ff__ring--outer { opacity: 1; border-color: rgba(255, 214, 122, .8); }
    .ff[data-tier="5"] .ff__glyph { font-size: 33px; }
    .ff[data-tier="5"] .ff__core {
      background: radial-gradient(circle at 36% 30%, #ffffff 0%, #ffe9a8 16%, #E8752A 50%, #7b61ff 96%);
      box-shadow: 0 0 40px rgba(255,214,122,.9), 0 0 110px -12px rgba(123,97,255,.6), inset 0 -5px 14px rgba(0,0,0,.5);
      animation: ffBreathe 2.4s ease-in-out infinite;
    }

    /* Hammer visuals, layered over whatever tier the forge is at. */
    .ff[data-hammer="shadow"] .ff__btn::after,
    .ff[data-hammer="quake"] .ff__btn::after {
      content: ''; position: absolute; inset: -6px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(123, 97, 255, .35), transparent 70%);
      filter: blur(8px);
      animation: ffShadow 5s ease-in-out infinite;
    }
    @keyframes ffShadow { 0%,100% { opacity: .35; transform: scale(1); } 50% { opacity: .8; transform: scale(1.15); } }

    /* ── Sparks ─────────────────────────────────────────────────────────── */
    .ff__spark {
      position: absolute; left: 50%; top: 50%;
      width: 4px; height: 4px; margin: -2px 0 0 -2px;
      border-radius: 50%;
      background: #ffd97a;
      box-shadow: 0 0 6px rgba(255, 217, 122, .9);
      animation: ffSpark .62s cubic-bezier(.2, .7, .3, 1) forwards;
    }
    @keyframes ffSpark {
      from { transform: translate(0, 0) scale(1); opacity: 1; }
      to   { transform: translate(var(--sx), var(--sy)) scale(.2); opacity: 0; }
    }

    /* ── Floaters ───────────────────────────────────────────────────────── */
    .ff__float {
      position: absolute; left: 50%; top: 6px;
      font: 700 14px/1 'Orbitron', system-ui, sans-serif;
      color: #ffd97a;
      text-shadow: 0 0 10px rgba(232, 117, 42, .8);
      white-space: nowrap;
      pointer-events: none;
      animation: ffFloat 1.1s cubic-bezier(.2, .8, .3, 1) forwards;
    }
    .ff__float--big { font-size: 18px; color: #fff3d6; }
    @keyframes ffFloat {
      from { transform: translate(calc(-50% + var(--dx)), 0) scale(.85); opacity: 0; }
      25%  { opacity: 1; }
      to   { transform: translate(calc(-50% + var(--dx)), -54px) scale(1.1); opacity: 0; }
    }

    /* ── Milestone banner ───────────────────────────────────────────────── */
    .ff__banner {
      position: absolute; bottom: calc(100% + 14px); right: 0;
      display: grid; gap: 2px;
      padding: 10px 14px;
      min-width: 178px;
      border-radius: 12px;
      border: 1px solid rgba(232, 117, 42, .55);
      background:
        radial-gradient(ellipse 80% 70% at 20% 0%, rgba(232, 117, 42, .16), transparent 65%),
        rgba(10, 6, 22, .95);
      box-shadow: 0 18px 44px -18px rgba(0, 0, 0, .9);
      animation: ffBanner .3s cubic-bezier(.22, 1, .36, 1);
    }
    .ff__banner strong { font: 700 13px/1.2 'Orbitron', system-ui, sans-serif; color: #ffd97a; }
    .ff__banner span   { font-size: 11px; color: #b9cdc7; }
    .ff__banner--grand { border-color: rgba(255, 45, 77, .7); }
    .ff__banner--grand strong { color: #ff8fa3; }
    @keyframes ffBanner { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

    /* ── HUD ────────────────────────────────────────────────────────────── */
    .ff__hud {
      position: absolute; bottom: calc(100% + 10px); right: 0;
      display: grid; gap: 3px;
      padding: 10px 12px;
      min-width: 172px;
      border-radius: 12px;
      border: 1px solid rgba(201, 168, 76, .32);
      background: rgba(8, 5, 18, .95);
      box-shadow: 0 16px 40px -18px rgba(0, 0, 0, .9);
      opacity: 0; visibility: hidden;
      transform: translateY(6px);
      transition: opacity .2s ease, transform .2s ease, visibility .2s;
    }
    .ff__hud--open { opacity: 1; visibility: visible; transform: none; }
    .ff__hud-gold { font: 700 15px/1 'Orbitron', system-ui, sans-serif; color: #ffd97a; }
    .ff__hud-coin { font-size: 12px; }
    .ff__hud-rate { font-size: 11px; color: #4dffe0; }
    .ff__hud-essence { font-size: 11px; color: #c48bff; }
    .ff__hud-hint { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: #7d918c; }
    .ff__hud-market {
      margin-top: 4px; padding-top: 6px;
      border-top: 1px solid rgba(255, 255, 255, .08);
      font-size: 11px; color: #4dffe0; text-decoration: none;
    }
    .ff__hud-market:hover { text-decoration: underline; }

    /* A banner and the HUD would otherwise occupy the same 10px above the
       button. The banner is the louder message, so it takes the slot. */
    .ff__banner ~ .ff__hud { display: none; }

    .ff__sr {
      position: absolute; width: 1px; height: 1px; margin: -1px;
      padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
    }

    /* Eclipse Hammer: the realm flinches. Shakes the flame, not the page —
       shaking the document would move every fixed element on the site. */
    .ff--quake .ff__btn { animation: ffQuake .34s ease-in-out; }
    @keyframes ffQuake {
      0%, 100% { transform: translate(0, 0); }
      20% { transform: translate(-3px, 2px); }
      40% { transform: translate(3px, -2px); }
      60% { transform: translate(-2px, -2px); }
      80% { transform: translate(2px, 2px); }
    }

    /* ── Mobile: smaller, and further from the thumb's resting arc so it does
         not sit on top of a tool's own controls. ─────────────────────────── */
    @media (max-width: 768px) {
      .ff { right: 10px; bottom: 76px; }
      .ff__btn { width: 52px !important; height: 52px !important; }
      .ff__glyph { font-size: 19px !important; }
      .ff__hud, .ff__banner { min-width: 154px; font-size: 11px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .ff__core, .ff__ring, .ff__ring--outer, .ff__btn::after { animation: none !important; }
      .ff__core { filter: brightness(1.1); }
      .ff__spark { display: none; }
      .ff--quake .ff__btn { animation: none; }
      .ff__banner, .ff__hud { animation: none; transition: none; }
      /* The floater still says what was earned; it just stops travelling. */
      .ff__float { animation: ffFloatStill 1s linear forwards; }
      @keyframes ffFloatStill { from { opacity: 1; } to { opacity: 0; } }
    }
  `],
})
export class ForgeFlameComponent implements OnInit, OnDestroy {
  private readonly economy = inject(EconomyService);
  private readonly audio = inject(ForgeAudioService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly subs = new Subscription();

  snap: EconomySnapshot = this.economy.snapshot;
  hudOpen = false;
  quaking = false;
  banner: Banner | null = null;
  announcement = '';

  floaters: Floater[] = [];
  sparks: Spark[] = [];

  private seq = 0;
  private reducedMotion = false;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  ngOnInit(): void {
    this.economy.init();
    this.subs.add(this.economy.snapshot$.subscribe(s => {
      this.snap = s;
      this.cdr.markForCheck();
    }));

    if (this.isBrowser) {
      this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.timers.forEach(t => clearTimeout(t));
    this.timers.clear();
  }

  get gold(): string { return formatCurrency(this.snap.gold); }
  get essence(): string { return formatCurrency(this.snap.essence); }
  get rate(): string { return formatRate(this.snap.perMinute); }

  get label(): string {
    return `The Forge Flame. ${formatCurrency(this.snap.gold)} Gold, earning ${this.rate} per minute. `
      + `Strike for ${this.snap.perClick} Gold.`;
  }

  onStrike(): void {
    const hit = this.economy.strike();
    // Inside the cooldown. Silently ignored rather than flashed — a held mouse
    // button would otherwise strobe the whole corner of the screen.
    if (!hit) return;

    this.announcement = `+${hit.gold} Gold. ${formatCurrency(this.snap.gold)} total.`;
    this.pushFloater(`+${hit.gold}`, hit.century || hit.millennium);

    if (hit.millennium) {
      this.showBanner({
        title: 'MILLENNIUM FORGE',
        sub: `${formatCurrency(hit.count)} strikes. The anvil remembers.`,
        grand: true,
      }, 4_600);
      this.audio.century();
      this.burst(22);
    } else if (hit.century) {
      this.showBanner({
        title: 'Century Strike!',
        sub: `${formatCurrency(hit.count)} strikes — +10 bonus Gold.`,
        grand: false,
      }, 3_000);
      this.audio.century();
      this.burst(16);
    } else if (hit.count % 10 === 0) {
      this.audio.strike();
      this.burst(10);
    } else {
      this.audio.strike();
      this.burst(4);
    }

    // The Eclipse Hammer's screen shake, scoped to the flame.
    if (this.snap.hammerVisual === 'quake' && !this.reducedMotion) {
      this.quaking = true;
      this.after(() => { this.quaking = false; this.cdr.markForCheck(); }, 360);
    }

    this.cdr.markForCheck();
  }

  // ───────────────────────────────────────────────────────────────────────────

  private pushFloater(text: string, big: boolean): void {
    const key = this.seq++;
    // Spread across ±18px so a fast clicker gets a scatter rather than a column.
    const dx = Math.round((Math.random() - 0.5) * 36);
    this.floaters = [...this.floaters, { key, text, dx, big }];
    this.after(() => {
      this.floaters = this.floaters.filter(f => f.key !== key);
      this.cdr.markForCheck();
    }, 1_150);
  }

  /**
   * Fire `count` sparks outward on random vectors.
   *
   * Skipped entirely under reduced motion — this is the one effect with no
   * meaningful static form. The floater and the payout both still happen.
   */
  private burst(count: number): void {
    if (this.reducedMotion) return;

    const made: Spark[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const dist = 26 + Math.random() * (count > 12 ? 46 : 20);
      made.push({
        key: this.seq++,
        x: Math.round(Math.cos(angle) * dist),
        y: Math.round(Math.sin(angle) * dist),
        delay: Math.round(Math.random() * 90),
      });
    }
    this.sparks = [...this.sparks, ...made];

    const keys = new Set(made.map(s => s.key));
    this.after(() => {
      this.sparks = this.sparks.filter(s => !keys.has(s.key));
      this.cdr.markForCheck();
    }, 780);
  }

  private showBanner(banner: Banner, ms: number): void {
    this.banner = banner;
    this.after(() => { this.banner = null; this.cdr.markForCheck(); }, ms);
  }

  /**
   * A tracked `setTimeout` outside the zone. Every one of these fires purely to
   * remove a decoration; letting zone.js schedule them would cost a full change
   * detection pass per spark, and there are twenty-two of them on a Millennium.
   */
  private after(fn: () => void, ms: number): void {
    this.zone.runOutsideAngular(() => {
      const id = setTimeout(() => {
        this.timers.delete(id);
        this.zone.run(fn);
      }, ms);
      this.timers.add(id);
    });
  }
}
