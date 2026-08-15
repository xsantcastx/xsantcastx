/**
 * gold-ticker.component.ts — the Gold count and the Gold/sec rate, in the header.
 *
 * This replaces the flat Gold pill the command bar used to carry. The pill was
 * honest and completely inert: it held a number that changed once a minute, by
 * a small amount, with no animation, which is the least persuasive way to
 * present an idle economy that anyone has yet devised. A forge that earns while
 * you read has to be *seen* earning, or the whole mechanic is a claim on a
 * shop page.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TWO NUMBERS, TWO JOBS
 * ─────────────────────────────────────────────────────────────────────────────
 *   • The count rolls. Every digit that changed this second is swapped through
 *     a two-layer slide — the old digit leaves upward, the new one arrives from
 *     below — so the number reads as an odometer rather than as a value that
 *     was quietly rewritten while you blinked.
 *   • The rate beats. One short pulse a second on the "+2.5 Gold/sec" chip,
 *     which is what makes the rate feel like a heartbeat instead of a label.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE COLUMNS ARE KEYED FROM THE RIGHT
 * ─────────────────────────────────────────────────────────────────────────────
 * `@for` needs a stable identity per column or every digit in the number is
 * destroyed and rebuilt on the tick that adds a thousands place, and the whole
 * row flashes instead of one column rolling. Position is therefore counted from
 * the *right*: the ones column is 0 forever, so 999 → 1,000 rolls three columns
 * and mounts two new ones, rather than renumbering all five.
 *
 * SSR: the server holds an empty ledger, so it renders a single "0" column and
 * a "0 Gold/sec" chip. Nothing here touches a browser API, and the first real
 * value arrives through the subscription after hydration, exactly as it does
 * for every other surface bound to the economy.
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
import { formatCompact, formatCurrency, formatCurrencyExact, formatRate } from './economy.model';

/**
 * One character of the rendered count.
 *
 * A comma is a `digit: null` cell — it is part of the number's shape and has to
 * occupy a position, or the columns either side of it would shuffle every time
 * the separator moved.
 */
interface Cell {
  /** Distance from the right-hand end. Stable across a growing number. */
  pos: number;
  /** The character, for separators. */
  char: string;
  /** 0-9, or null when this cell is a separator. */
  digit: number | null;
  /** The digit being replaced, for one animation frame. Null when unchanged. */
  prev: number | null;
}

/** How long the roll takes. Kept under a second so ticks never overlap. */
const ROLL_MS = 420;

@Component({
  selector: 'app-gold-ticker',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="gfpill gfpill--gold gt"
       routerLink="/market"
       [class.gt--rich]="snap.perSecond >= 1000"
       [attr.aria-label]="label">

      <img class="gfpill__icon gf-icon currency-icon"
           src="assets/icons/currencies/gold.png" alt="" aria-hidden="true"
           width="14" height="14" decoding="async" draggable="false">

      <!-- The count. Hidden from assistive tech: it is a decorative
           reconstruction of a number the link's own label already carries, and
           a per-digit DOM tree read aloud is nonsense. -->
      <span class="gfpill__val gt__odo" aria-hidden="true">
        @for (c of cells; track c.pos) {
          @if (c.digit === null) {
            <span class="gt__sep">{{ c.char }}</span>
          } @else {
            <span class="gt__col">
              @if (c.prev !== null) {
                <span class="gt__d gt__d--out">{{ c.prev }}</span>
              }
              <span class="gt__d" [class.gt__d--in]="c.prev !== null">{{ c.digit }}</span>
            </span>
          }
        }
      </span>

      <!-- The rate. The beat class is toggled off and on again around a frame
           so the animation actually replays — a CSS animation on an element
           that never leaves the DOM cannot be restarted by re-adding the class
           it is already wearing. -->
      <span class="gt__rate" [class.gt__rate--beat]="beat" aria-hidden="true">
        <span class="gt__caret">▲</span>
        <span class="gt__rate-num">{{ rateText }}</span>
        <span class="gt__rate-unit gt__rate-unit--long">Gold/sec</span>
        <span class="gt__rate-unit gt__rate-unit--short">/s</span>
      </span>
    </a>
  `,
  styles: [`
    :host { display: inline-flex; }

    /* .gfpill is a global class, so the shell here inherits the command bar's
       shape without this component reaching into the header's scoped sheet. */
    .gt { gap: 0.4rem; }

    /* ── The odometer ─────────────────────────────────────────────────── */
    .gt__odo {
      display: inline-flex;
      align-items: baseline;
      /* Tabular figures matter twice as much here as on a static pill: the
         columns are absolutely positioned inside a fixed-width box, and a
         proportional "1" would sit off-centre in it. */
      font-variant-numeric: tabular-nums;
    }
    .gt__sep { opacity: .55; padding: 0 .02em; }

    .gt__col {
      position: relative;
      display: inline-block;
      width: .62em;
      height: 1.1em;
      overflow: hidden;
      vertical-align: baseline;
    }
    .gt__d {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
    }
    /* Both halves of the roll. The outgoing digit is a real element for the
       length of one animation and is then dropped by the component — leaving
       it in place would stack a dead layer per tick, sixty an hour. */
    /* 420ms, matching ROLL_MS in the class below. Written out rather than
       interpolated: component metadata is statically analysed at build time,
       and a hardcoded duration cannot go wrong there. */
    .gt__d--in  { animation: gtIn 420ms cubic-bezier(.22, 1, .36, 1); }
    .gt__d--out { animation: gtOut 420ms cubic-bezier(.22, 1, .36, 1) forwards; }
    @keyframes gtIn {
      from { transform: translateY(105%); opacity: .25; }
      to   { transform: none;             opacity: 1; }
    }
    @keyframes gtOut {
      from { transform: none;              opacity: 1; }
      to   { transform: translateY(-105%); opacity: 0; }
    }

    /* ── The rate chip ────────────────────────────────────────────────── */
    .gt__rate {
      display: inline-flex;
      align-items: center;
      gap: .18rem;
      padding: 2px 6px;
      border-radius: 999px;
      border: 1px solid rgba(232, 117, 42, .28);
      background: rgba(232, 117, 42, .1);
      font: 700 .6rem/1 'Orbitron', system-ui, sans-serif;
      letter-spacing: .02em;
      color: #ffc98a;
      font-variant-numeric: tabular-nums;
    }
    .gt__caret { font-size: .5rem; color: #7fd5a3; }
    .gt__rate-unit { font-weight: 600; opacity: .72; }
    .gt__rate-unit--short { display: none; }

    /* Past a thousand a second the chip earns the brighter treatment. */
    .gt--rich .gt__rate {
      border-color: rgba(255, 217, 122, .5);
      background: rgba(255, 217, 122, .14);
      color: #ffe9a8;
    }

    .gt__rate--beat { animation: gtBeat .5s cubic-bezier(.22, 1, .36, 1); }
    @keyframes gtBeat {
      0%   { transform: scale(1);    box-shadow: 0 0 0 0 rgba(232, 117, 42, .5); }
      30%  { transform: scale(1.09); box-shadow: 0 0 12px 0 rgba(232, 117, 42, .55); }
      100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(232, 117, 42, 0); }
    }

    /* ── Mobile: the compact rate ─────────────────────────────────────────
       "2.5/s" rather than "2.5 Gold/sec". The pill shares a 375px row with a
       brand lockup, a rank chip and a burger, and the long unit costs 42px
       that row does not have. */
    @media (max-width: 720px) {
      .gt { gap: .28rem; }
      .gt__rate { padding: 2px 4px; font-size: .55rem; }
      .gt__rate-unit--long  { display: none; }
      .gt__rate-unit--short { display: inline; }
      .gt__caret { display: none; }
    }

    /* Below the smallest phones the count alone has to win the space. */
    @media (max-width: 380px) {
      .gt__rate-num { font-size: .54rem; }
    }

    /* ── Narrow, and only in the command bar: the count without the rate ──
       The rate pill is the reason this component replaced a static number, so
       dropping it is not done lightly. But the bar now carries the cloud save
       control as well, and below this width it has room for the count or the
       rate and not both — at which point the count is the number the visitor
       came for, and the alternative was shedding the whole pill from the bar.

       Scoped to the bar's own instance, not the viewport alone. The tome renders
       this component too, at the same viewport widths, in a full-width drawer
       with room to spare — a viewport-only media query here would have taken the
       rate out of there as well, to buy space that surface was never short of. */
    @media (max-width: 420px) {
      :host(.gt--bar) .gt__rate { display: none; }
    }

    @media (prefers-reduced-motion: reduce) {
      /* The number still changes and the rate is still correct; nothing
         travels. An odometer is decoration on top of a value, and the value is
         the part that was ever load-bearing. */
      .gt__d--in, .gt__d--out { animation: none; }
      .gt__d--out { display: none; }
      .gt__rate--beat { animation: none; }
    }
  `],
})
export class GoldTickerComponent implements OnInit, OnDestroy {
  private readonly economy = inject(EconomyService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly subs = new Subscription();

  snap: EconomySnapshot = this.economy.snapshot;
  cells: Cell[] = cellsFor('0', []);
  beat = false;

  /** The rendered count, so the next tick knows which columns actually moved. */
  private rendered = '0';
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  ngOnInit(): void {
    this.economy.init();
    this.subs.add(this.economy.snapshot$.subscribe(s => {
      this.snap = s;
      this.roll(formatCurrency(s.gold));
      this.cdr.markForCheck();
    }));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.timers.forEach(t => clearTimeout(t));
    this.timers.clear();
  }

  /** "2.5", "1.2K", "3.4M". */
  get rateText(): string {
    return formatCompact(this.snap.perSecond);
  }

  /**
   * The whole chip in one sentence, for a screen reader.
   *
   * Deliberately *not* a live region. This value changes once a second, and a
   * polite live region on it would queue an announcement every second for the
   * rest of the session — it would make the site unusable with a screen reader
   * on, to narrate a number nobody asked to hear. The label is here for when
   * the link is reached, which is when it is wanted.
   */
  get label(): string {
    const rate = formatRate(Math.round(this.snap.perSecond * 10) / 10);
    return `${formatCurrencyExact(this.snap.gold)} Gold, earning ${rate} a second. Open the Market.`;
  }

  /**
   * Swap in a new count, marking the columns that changed so they animate.
   *
   * The outgoing digits are dropped again after one animation's worth of time.
   * They have to be, and by a timer rather than an `animationend` handler:
   * `animationend` never fires under reduced motion or on a backgrounded tab,
   * and a dead layer that is never cleaned up is a leak that grows once a
   * second for as long as the tab is open.
   */
  private roll(next: string): void {
    if (next === this.rendered) return;
    const previous = this.cells;
    this.cells = cellsFor(next, previous);
    this.rendered = next;

    if (!this.isBrowser) return;
    this.pulse();

    this.zone.runOutsideAngular(() => {
      const id = setTimeout(() => {
        this.timers.delete(id);
        this.zone.run(() => {
          // Only clears the outgoing layer. A count that changed again inside
          // the window has already replaced these cells, and clearing `prev` on
          // the new ones would cut the roll that is currently running short.
          if (this.rendered !== next) return;
          this.cells = this.cells.map(c => (c.prev === null ? c : { ...c, prev: null }));
          this.cdr.markForCheck();
        });
      }, ROLL_MS + 30);
      this.timers.add(id);
    });
  }

  /** Restart the rate chip's beat. Same off-for-a-frame trick as the rail. */
  private pulse(): void {
    this.beat = false;
    this.zone.runOutsideAngular(() => {
      const on = setTimeout(() => {
        this.timers.delete(on);
        this.zone.run(() => {
          this.beat = true;
          this.cdr.markForCheck();
          const off = setTimeout(() => {
            this.timers.delete(off);
            this.zone.run(() => { this.beat = false; this.cdr.markForCheck(); });
          }, 520);
          this.timers.add(off);
        });
      }, 20);
      this.timers.add(on);
    });
  }
}

/**
 * Turn "1.2K" or "847" into right-anchored cells, carrying over which digits changed.
 *
 * Pure, and exported to nothing — it is the only part of this component worth
 * reasoning about on its own, and keeping it out of the class is what lets the
 * component's own state be two fields and a string.
 */
function cellsFor(text: string, previous: Cell[]): Cell[] {
  const byPos = new Map(previous.map(c => [c.pos, c]));
  const chars = text.split('');
  const cells: Cell[] = [];

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const pos = chars.length - 1 - i;
    const digit = char >= '0' && char <= '9' ? Number(char) : null;
    const was = byPos.get(pos);
    cells.push({
      pos,
      char,
      digit,
      // Only a digit replacing a *different* digit rolls. A column that has
      // just been mounted (the number grew) arrives without an animation,
      // because there is nothing behind it to roll away.
      prev: digit !== null && was && was.digit !== null && was.digit !== digit ? was.digit : null,
    });
  }

  return cells;
}
