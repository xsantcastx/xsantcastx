/**
 * currency-rail.component.ts — Gold and Essence in the header, next to the rank.
 *
 * Two instances are mounted, one per breakpoint, exactly as the XP bar and the
 * quest sword already are. They share one service, so whichever is visible is
 * always in sync.
 *
 * Essence appears only once there is some. A currency at zero that the visitor
 * has no route to earning yet is a question they cannot answer — the first
 * Essence arrives on the second rank, and the rail grows to meet it.
 *
 * Both chips are links into the Market rather than buttons that open a panel:
 * the Market is a full page with five tabs, and a popover would only ever be a
 * worse copy of it.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { EconomyService, EconomySnapshot } from './economy.service';
import { formatCurrency, formatRate } from './economy.model';

@Component({
  selector: 'app-currency-rail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="cr__chip cr__chip--gold"
       routerLink="/market"
       [class.cr__chip--tick]="goldTick"
       [attr.aria-label]="goldLabel">
      <span class="cr__icon" aria-hidden="true">&#129689;</span>
      <span class="cr__val">{{ gold }}</span>
    </a>

    @if (snap.essence > 0) {
      <a class="cr__chip cr__chip--essence"
         routerLink="/market"
         [class.cr__chip--tick]="essenceTick"
         [attr.aria-label]="essenceLabel">
        <span class="cr__icon" aria-hidden="true">&#9889;</span>
        <span class="cr__val">{{ essence }}</span>
      </a>
    }
  `,
  styles: [`
    :host { display: inline-flex; align-items: center; gap: 6px; }

    .cr__chip {
      display: inline-flex; align-items: center; gap: 5px;
      min-height: 44px; padding: 4px 11px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, .08);
      background: rgba(10, 6, 26, .55);
      text-decoration: none;
      transition: border-color .25s ease, box-shadow .25s ease, transform .18s ease;
    }
    .cr__icon { font-size: 13px; line-height: 1; }
    .cr__val {
      font: 700 12px/1 'Orbitron', system-ui, sans-serif;
      letter-spacing: .02em;
      /* Tabular figures: without them the chip resizes on every idle tick and
         nudges the whole header row a pixel left and right once a minute. */
      font-variant-numeric: tabular-nums;
    }

    .cr__chip--gold .cr__val { color: #ffd97a; }
    .cr__chip--gold:hover {
      border-color: rgba(232, 117, 42, .55);
      box-shadow: 0 0 20px -8px rgba(232, 117, 42, .8);
    }

    .cr__chip--essence .cr__val { color: #c48bff; }
    .cr__chip--essence:hover {
      border-color: rgba(164, 139, 255, .55);
      box-shadow: 0 0 20px -8px rgba(164, 139, 255, .8);
    }

    .cr__chip:focus-visible { outline: 2px solid #4dffe0; outline-offset: 3px; }

    /* One pulse when the number moves, so an idle tick is noticed without a
       standing animation running in the header forever. */
    .cr__chip--tick { animation: crTick .5s cubic-bezier(.22, 1, .36, 1); }
    @keyframes crTick {
      0%   { transform: scale(1); }
      35%  { transform: scale(1.11); }
      100% { transform: scale(1); }
    }

    @media (max-width: 720px) {
      .cr__chip { padding: 4px 8px; }
      .cr__val { font-size: 11px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .cr__chip--tick { animation: none; }
      .cr__chip { transition: none; }
    }
  `],
})
export class CurrencyRailComponent implements OnInit, OnDestroy {
  private readonly economy = inject(EconomyService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);
  private readonly subs = new Subscription();

  snap: EconomySnapshot = this.economy.snapshot;
  goldTick = false;
  essenceTick = false;

  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  ngOnInit(): void {
    this.economy.init();
    this.subs.add(this.economy.gain$.subscribe(g => {
      if (g.currency === 'gold') this.pulse('gold');
      else this.pulse('essence');
    }));
    this.subs.add(this.economy.snapshot$.subscribe(s => {
      this.snap = s;
      this.cdr.markForCheck();
    }));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.timers.forEach(t => clearTimeout(t));
    this.timers.clear();
  }

  get gold(): string { return formatCurrency(this.snap.gold); }
  get essence(): string { return formatCurrency(this.snap.essence); }

  get goldLabel(): string {
    return `${formatCurrency(this.snap.gold)} Gold, earning ${formatRate(this.snap.perMinute)} per minute. Open the Market.`;
  }

  get essenceLabel(): string {
    return `${formatCurrency(this.snap.essence)} Eclipse Essence. Open the Market.`;
  }

  /**
   * Restart the pulse. The class has to come off for a frame or the animation
   * will not replay on a chip that is already wearing it — two idle ticks in a
   * row would light the first and silently skip the second.
   */
  private pulse(which: 'gold' | 'essence'): void {
    const set = (on: boolean) => {
      if (which === 'gold') this.goldTick = on;
      else this.essenceTick = on;
      this.cdr.markForCheck();
    };

    set(false);
    this.zone.runOutsideAngular(() => {
      const id = setTimeout(() => {
        this.timers.delete(id);
        this.zone.run(() => {
          set(true);
          const off = setTimeout(() => {
            this.timers.delete(off);
            this.zone.run(() => set(false));
          }, 520);
          this.timers.add(off);
        });
      }, 20);
      this.timers.add(id);
    });
  }
}
