/**
 * <app-win-celebration> — the payoff moment every game of chance shares.
 *
 * Set `win`, `bet` and bump `seq` once per result. A win of 10× the bet or
 * more gets a tier banner (Big ≥10×, Mega ≥50×, Eclipse Win ≥200×, see
 * rtp-sim WIN_TIERS), a pixel coin storm and a rolling counter; a smaller win
 * gets a short coin burst. Nothing is decided here: the Gold was paid before
 * this ever shows.
 *
 * Positioned over its PARENT (absolute, inset 0), never fixed: in-world panels
 * and routed hosts trap fixed overlays. Reduced motion: the final number and
 * the banner, no coins, no count.
 */
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { TranslationService } from '../../translation.service';
import { GAMES_I18N } from './games.i18n';
import { winTier, type WinTier } from './rtp-sim';

interface Coin { key: number; dx: number; dy: number; delay: number; spin: number }

@Component({
  selector: 'app-win-celebration',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="wc" [attr.data-tier]="tier() ?? 'small'" [class.wc--still]="still">
        <div class="wc__coins" aria-hidden="true">
          @for (c of coins(); track c.key) {
            <i class="wc__coin" [style.--dx.px]="c.dx" [style.--dy.px]="c.dy"
               [style.--delay.ms]="c.delay" [style.--spin.deg]="c.spin"></i>
          }
        </div>
        @if (tier(); as t) {
          <div class="wc__banner" role="status">
            <p class="wc__tier">{{ t === 'big' ? tBig : t === 'mega' ? tMega : top() === 'epic' ? tEpic : tEclipse }}</p>
            <p class="wc__gold">{{ goldLine() }}</p>
            <p class="wc__times">{{ timesLine() }}</p>
            <button type="button" class="wc__done" (click)="close()">{{ tDone }}</button>
          </div>
        }
      </div>
    }
  `,
  styleUrls: ['./win-celebration.component.css'],
})
export class WinCelebrationComponent implements OnDestroy {
  private readonly i18n = inject(TranslationService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly win = input(0);
  readonly bet = input(0);
  /** Bump once per result to play it. 0 = nothing yet. */
  readonly seq = input(0);
  /** What the top tier (≥200×) is called: the Eclipse win (the Reels) or the Epic win (the cascade machines). */
  readonly top = input<'eclipse' | 'epic'>('eclipse');
  readonly done = output<void>();

  readonly tier = computed<WinTier | null>(() => winTier(this.win(), this.bet()));
  readonly visible = signal(false);
  readonly coins = signal<Coin[]>([]);
  readonly shown = signal(0);
  readonly still: boolean;

  readonly tBig: string;
  readonly tMega: string;
  readonly tEclipse: string;
  readonly tEpic: string;
  readonly tDone: string;

  private timers: ReturnType<typeof setTimeout>[] = [];
  private raf = 0;

  constructor() {
    this.i18n.register(GAMES_I18N);
    this.tBig = this.t('games.win.big');
    this.tMega = this.t('games.win.mega');
    this.tEclipse = this.t('games.win.eclipse');
    this.tEpic = this.t('games.win.epic');
    this.tDone = this.t('games.win.done');
    this.still = this.isBrowser && typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    effect(() => {
      const seq = this.seq();
      const win = this.win();
      if (seq > 0 && win > 0) this.play(win);
      else this.reset();
    });
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }

  goldLine(): string { return this.t('games.win.gold', { n: this.shown().toLocaleString('en-US') }); }
  timesLine(): string {
    const x = this.bet() > 0 ? Math.round((this.win() / this.bet()) * 10) / 10 : 0;
    return this.t('games.win.times', { n: x });
  }

  close(): void {
    this.reset();
    this.done.emit();
  }

  private play(win: number): void {
    this.reset();
    this.visible.set(true);
    const tier = this.tier();
    if (this.still || !this.isBrowser) {
      this.shown.set(win);
      if (!tier) this.timers.push(setTimeout(() => this.close(), 1200));
      return;
    }
    const n = tier === 'eclipse' ? 48 : tier === 'mega' ? 36 : tier === 'big' ? 24 : 10;
    const coins: Coin[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (i % 3) * 0.3;
      const r = 70 + ((i * 37) % 90);
      coins.push({ key: i, dx: Math.round(Math.cos(a) * r), dy: Math.round(Math.sin(a) * r * 0.8 - 30), delay: (i % 8) * 40, spin: (i % 2 ? 1 : -1) * 360 });
    }
    this.coins.set(coins);
    // The counter rolls for a beat that grows with the tier; the final value is
    // set by a timer too, so a hidden tab (no animation frames) still lands it.
    const ms = tier === 'eclipse' ? 2600 : tier === 'mega' ? 2000 : tier ? 1400 : 500;
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      this.shown.set(Math.round(win * (1 - Math.pow(1 - k, 3))));
      if (k < 1) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
    this.timers.push(setTimeout(() => this.shown.set(win), ms + 50));
    if (!tier) this.timers.push(setTimeout(() => this.close(), 1400));
  }

  private reset(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.visible.set(false);
    this.coins.set([]);
    this.shown.set(0);
  }

  ngOnDestroy(): void { this.reset(); }
}
