/**
 * stat-panel.component.ts — the five bars and the points waiting to be spent.
 *
 * Mounted on /forge-keeper, which is the character sheet. Owns no state: every
 * number is read off `PlayerStatsService` and every button is a call into it,
 * which is the same rule the rest of that page follows — a panel that keeps its
 * own copy of a total is a panel that can disagree with the service, and the
 * first time it does, the visitor believes the panel.
 *
 * SSR: the service returns an empty build on the server, so this prerenders as
 * five bars at zero with no unspent badge. Nothing here touches a browser API.
 */
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import { PlayerStatsService, StatsSnapshot } from './player-stats.service';
import {
  RESPEC_COST,
  STAT_DEFINITIONS,
  StatDefinition,
  StatId,
} from './player-stats.model';

@Component({
  selector: 'app-stat-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="sp" [class.sp--unspent]="snap.hasUnspent">
      <header class="sp__head">
        <p class="sp__eyebrow">
          <span class="sp__pulse"></span>
          Attributes
        </p>
        <h2 class="sp__title">What you have become</h2>
        <p class="sp__tagline">every rank pays three points, and nothing takes them back</p>
      </header>

      <div class="sp__bank" [class.sp__bank--has]="snap.hasUnspent">
        <span class="sp__bank-num">{{ snap.stats.unallocated }}</span>
        <span class="sp__bank-label">
          {{ snap.stats.unallocated === 1 ? 'point unspent' : 'points unspent' }}
        </span>
        <span class="sp__bank-total">{{ snap.spent }} of {{ snap.total }} spent</span>
      </div>

      <ul class="sp__list">
        <li
          *ngFor="let stat of stats"
          class="sp__stat"
          [style.--star-color]="stat.color"
          [style.--star-glow]="stat.glow"
        >
          <div class="sp__stat-head">
            <span class="sp__orb" aria-hidden="true"></span>
            <span class="sp__name">{{ stat.name }}</span>
            <span class="sp__points">{{ snap.stats[stat.id] }}</span>
          </div>

          <div class="sp__bar" role="presentation">
            <span class="sp__fill" [style.width.%]="fillOf(stat.id)"></span>
          </div>

          <p class="sp__effect">{{ stat.format(snap.stats[stat.id]) }}</p>
          <p class="sp__flavour">{{ stat.flavour }}</p>

          <div class="sp__actions">
            <button
              type="button"
              class="sp__add"
              [disabled]="!snap.hasUnspent"
              (click)="add(stat.id)"
              [attr.aria-label]="'Spend one point on ' + stat.name"
            >+1</button>
            <button
              type="button"
              class="sp__add sp__add--all"
              [disabled]="!snap.hasUnspent"
              (click)="addAll(stat.id)"
              [attr.aria-label]="'Spend every point on ' + stat.name"
            >all in</button>
          </div>
        </li>
      </ul>

      <footer class="sp__foot">
        <button
          type="button"
          class="sp__respec"
          [disabled]="!service.canRespec"
          (click)="respec()"
        >
          Unmake the build — {{ respecCost | number }} Gold
        </button>
        <p class="sp__respec-note" *ngIf="snap.respecs > 0">
          unmade {{ snap.respecs }} {{ snap.respecs === 1 ? 'time' : 'times' }} so far
        </p>
        <p class="sp__respec-note" *ngIf="!service.canRespec && snap.spent > 0">
          the Market wants {{ respecCost | number }} Gold to forget what you chose
        </p>
      </footer>
    </section>
  `,
  styles: [`
    .sp {
      position: relative;
      background:
        radial-gradient(ellipse 60% 50% at 20% 30%, rgba(0, 255, 204, 0.06), transparent 65%),
        radial-gradient(ellipse 50% 45% at 80% 70%, rgba(123, 97, 255, 0.07), transparent 65%),
        rgba(10, 6, 26, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 18px;
      padding: clamp(1.1rem, 3vw, 1.8rem);
    }
    .sp::before {
      content: '';
      position: absolute; left: 0; right: 0; top: -1px; height: 1px;
      background: linear-gradient(90deg, transparent, rgba(0, 255, 204, 0.5) 50%, transparent);
    }

    .sp__head { text-align: center; margin-bottom: 1.1rem; }
    .sp__eyebrow {
      display: inline-flex; align-items: center; gap: 0.5rem;
      font-size: 0.68rem; letter-spacing: 0.18em; text-transform: uppercase;
      color: #7fd5a3; margin: 0 0 0.4rem;
    }
    .sp__pulse {
      width: 7px; height: 7px; border-radius: 50%;
      background: #7fd5a3; box-shadow: 0 0 8px rgba(100, 220, 150, 0.8);
      animation: spPulse 3s ease-in-out infinite;
    }
    @keyframes spPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%      { opacity: 0.45; transform: scale(0.7); }
    }
    .sp__title {
      margin: 0 0 0.35rem;
      font-size: clamp(1.15rem, 3.4vw, 1.5rem);
      background: linear-gradient(92deg, #4dffe0, #a48bff 60%, #ff6dd7);
      -webkit-background-clip: text; background-clip: text; color: transparent;
    }
    .sp__tagline {
      display: inline-block; margin: 0;
      padding: 0.28rem 0.8rem; border-radius: 999px;
      background: rgba(0, 255, 204, 0.05);
      border: 1px solid rgba(0, 255, 204, 0.14);
      font-size: 0.76rem; color: #9fb4ae;
    }

    .sp__bank {
      display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.5rem;
      justify-content: center;
      padding: 0.7rem 1rem; margin-bottom: 1.2rem;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.07);
      background: rgba(5, 8, 18, 0.5);
      transition: border-color 0.3s ease, box-shadow 0.3s ease;
    }
    .sp__bank--has {
      border-color: rgba(127, 213, 163, 0.45);
      box-shadow: 0 0 26px -8px rgba(100, 220, 150, 0.6);
    }
    .sp__bank-num {
      font-size: 1.7rem; font-weight: 700; color: #7fd5a3;
      font-variant-numeric: tabular-nums;
    }
    .sp__bank--has .sp__bank-num { animation: spBankBreathe 2.4s ease-in-out infinite; }
    @keyframes spBankBreathe {
      0%, 100% { text-shadow: 0 0 10px rgba(100, 220, 150, 0.5); }
      50%      { text-shadow: 0 0 22px rgba(100, 220, 150, 0.95); }
    }
    .sp__bank-label { font-size: 0.85rem; color: #cfe6df; }
    .sp__bank-total { margin-left: auto; font-size: 0.72rem; color: #7d8f8a; }

    .sp__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.85rem; }

    .sp__stat {
      padding: 0.85rem 1rem;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.06);
      background: rgba(8, 5, 20, 0.55);
      transition: border-color 0.25s ease, box-shadow 0.25s ease;
    }
    .sp__stat:hover {
      border-color: var(--star-glow);
      box-shadow: 0 0 28px -8px var(--star-glow);
    }

    .sp__stat-head { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.55rem; }

    .sp__orb {
      position: relative; width: 15px; height: 15px; border-radius: 50%; flex: none;
      background:
        radial-gradient(circle at 32% 28%, #fff 0%, rgba(255,255,255,0.32) 18%, rgba(255,255,255,0) 42%),
        radial-gradient(circle at 50% 50%, var(--star-color) 0%, rgba(8,3,24,0.92) 88%);
      box-shadow: 0 0 10px var(--star-glow), 0 0 26px -6px var(--star-glow);
    }

    .sp__name { font-weight: 600; font-size: 0.92rem; color: #eafff9; }
    .sp__points {
      margin-left: auto; font-variant-numeric: tabular-nums;
      font-size: 1.05rem; font-weight: 700; color: var(--star-color);
    }

    .sp__bar {
      height: 6px; border-radius: 999px; overflow: hidden;
      background: rgba(255, 255, 255, 0.07);
      margin-bottom: 0.5rem;
    }
    .sp__fill {
      display: block; height: 100%; border-radius: 999px;
      background: linear-gradient(90deg, var(--star-color), var(--star-glow));
      box-shadow: 0 0 12px var(--star-glow);
      transition: width 0.45s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .sp__effect { margin: 0 0 0.3rem; font-size: 0.84rem; color: var(--star-color); font-weight: 600; }
    .sp__flavour { margin: 0 0 0.6rem; font-size: 0.75rem; color: #8b9c97; line-height: 1.45; }

    .sp__actions { display: flex; gap: 0.5rem; }

    .sp__add {
      min-height: 44px; min-width: 56px;
      padding: 0 0.9rem; border-radius: 10px;
      border: 1px solid var(--star-glow);
      background: rgba(0, 0, 0, 0.3);
      color: var(--star-color);
      font-weight: 700; font-size: 0.85rem;
      cursor: pointer;
      transition: background 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease;
    }
    .sp__add:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.06);
      box-shadow: 0 0 20px -6px var(--star-glow);
      transform: translateY(-1px);
    }
    .sp__add:disabled { opacity: 0.3; cursor: not-allowed; }
    .sp__add--all { font-size: 0.74rem; letter-spacing: 0.04em; }

    .sp__foot { margin-top: 1.1rem; text-align: center; }
    .sp__respec {
      min-height: 44px; padding: 0 1.2rem; border-radius: 10px;
      border: 1px solid rgba(255, 109, 215, 0.4);
      background: rgba(255, 109, 215, 0.06);
      color: #ff6dd7; font-weight: 600; font-size: 0.84rem;
      cursor: pointer;
      transition: background 0.2s ease, box-shadow 0.2s ease;
    }
    .sp__respec:hover:not(:disabled) {
      background: rgba(255, 109, 215, 0.12);
      box-shadow: 0 0 24px -8px rgba(255, 90, 210, 0.7);
    }
    .sp__respec:disabled { opacity: 0.35; cursor: not-allowed; }
    .sp__respec-note { margin: 0.5rem 0 0; font-size: 0.72rem; color: #7d8f8a; }

    @media (prefers-reduced-motion: reduce) {
      .sp__pulse, .sp__bank--has .sp__bank-num { animation: none; }
      .sp__fill { transition: none; }
    }
  `],
})
export class StatPanelComponent implements OnInit, OnDestroy {
  readonly service = inject(PlayerStatsService);

  readonly stats: StatDefinition[] = STAT_DEFINITIONS;
  readonly respecCost = RESPEC_COST;

  snap: StatsSnapshot = this.service.snapshot;

  private sub?: Subscription;

  ngOnInit(): void {
    this.sub = this.service.snapshot$.subscribe(s => (this.snap = s));
    this.service.init();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  /**
   * How full a stat's bar is, as a percentage of the largest investment.
   *
   * Relative to the biggest stat rather than to a fixed ceiling, because there
   * is no cap: a bar scaled against an arbitrary "100 points" would sit at 3%
   * for the first ten levels and tell the player nothing about their own build.
   * Scaled against their own maximum, the bars answer the question they are
   * actually being asked — where did my points go?
   */
  fillOf(id: StatId): number {
    const value = this.snap.stats[id];
    if (value <= 0) return 0;
    const max = Math.max(...this.stats.map(s => this.snap.stats[s.id]));
    return max <= 0 ? 0 : Math.round((value / max) * 100);
  }

  add(id: StatId): void { this.service.allocate(id); }

  addAll(id: StatId): void { this.service.allocateAll(id); }

  respec(): void { this.service.respec(); }
}
