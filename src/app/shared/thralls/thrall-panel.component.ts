/**
 * thrall-panel.component.ts — the shift, as the Keeper manages it.
 *
 * Mounted on /sanctum under the roster. Lists every bound Thrall, opens one at
 * a time to show stamina, gear and its own tally, and carries the two controls
 * that are not purchases: assign, and equip.
 *
 * Deliberately does *not* sell Thralls. Recruiting is a Market row — it is a
 * Gold purchase priced out of a catalogue, and a second Bind button here that
 * took a different code path would be a second set of rules about what a
 * Thrall costs. This panel says who is bound and what they are doing.
 *
 * SSR: renders the empty roster from the service's empty snapshot, with every
 * control disabled until `snap.live` says the browser has hydrated.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { ThrallService, ThrallSnapshot } from './thrall.service';
import { GameItem, rarityColor, rarityLabel } from '../rpg/item.model';
import { formatCompact } from '../economy/economy.model';
import {
  MAX_THRALLS,
  THRALL_ROLL_COST,
  Thrall,
  ThrallLogEntry,
  thrallTier,
  xpToNext,
  THRALL_MAX_LEVEL,
  RUNE_TIER_COLOURS,
} from './thrall.model';

@Component({
  selector: 'app-thrall-panel',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="tp" [class.tp--compact]="compact">
      <header class="tp__head">
        <p class="tp__eyebrow"><span class="tp__pulse"></span> The Shift</p>
        <h3 class="tp__title">{{ heading }}</h3>
        <p class="tp__tagline">bound hands that pull the lever while yours is elsewhere</p>
      </header>

      <!-- ── Squad overview ─────────────────────────────────────────────── -->
      <dl class="tp__squad">
        <div><dt>Bound</dt><dd>{{ snap.owned }}/{{ maxThralls }}</dd></div>
        <div><dt>At the anvil</dt><dd>{{ snap.working }}/{{ snap.slots }}</dd></div>
        <div><dt>Gold/hour</dt><dd>{{ compactGold(snap.goldPerHour) }}</dd></div>
        <div><dt>Found today</dt><dd>{{ snap.foundToday }}</dd></div>
      </dl>

      @if (!snap.thralls.length) {
        <p class="tp__empty">
          nobody bound yet — the anvil rings only when you are holding it.
          <a routerLink="/market" [queryParams]="{ category: 'thrall' }">Bind one in the Market</a>.
        </p>
      }

      <ul class="tp__list">
        @for (t of snap.thralls; track t.id) {
          <li
            class="tp__card"
            [class.tp__card--open]="open === t.id"
            [attr.data-status]="t.status"
            [style.--star-color]="tierColor(t)"
            [style.--star-glow]="tierGlow(t)"
          >
            <button type="button" class="tp__face" (click)="toggle(t.id)"
                    [attr.aria-expanded]="open === t.id">
              <span class="tp__orb" aria-hidden="true"></span>
              <span class="tp__ident">
                <span class="tp__name">{{ t.name }}</span>
                <span class="tp__tier">{{ tierLabel(t) }} · Lv {{ t.level }}</span>
              </span>
              <span class="tp__state" [attr.data-status]="t.status">{{ statusLabel(t) }}</span>
            </button>

            <!-- Stamina reads outside the fold: it is the number that decides
                 whether a Thrall is doing anything, so it should not be behind
                 a click. -->
            <p class="tp__bar" role="img"
               [attr.aria-label]="t.name + ': ' + t.stamina + ' of ' + t.maxStamina + ' stamina'">
              <span class="tp__fill" [style.width.%]="staminaPct(t)"></span>
            </p>

            @if (open === t.id) {
              <div class="tp__body">
                <dl class="tp__stats">
                  <div><dt>Stamina</dt><dd>{{ t.stamina }}/{{ t.maxStamina }}</dd></div>
                  <div><dt>Every</dt><dd>{{ t.rollInterval / 1000 }}s</dd></div>
                  <div><dt>Magic Find</dt><dd>{{ liveMagicFind(t) }}%</dd></div>
                  <div><dt>Rolls</dt><dd>{{ t.totalRolls }}</dd></div>
                </dl>

                <p class="tp__xp">
                  @if (t.level >= maxLevel) {
                    <span>Level {{ maxLevel }} — nothing left to learn.</span>
                  } @else {
                    <span>{{ t.xp }} / {{ nextLevelXp(t) }} XP to level {{ t.level + 1 }}</span>
                  }
                </p>

                <!-- Their two wells -->
                <div class="tp__kit">
                  <p class="tp__kit-title">Carrying</p>
                  <ul class="tp__worn">
                    @for (item of worn(t); track item.id) {
                      <li [style.--star-color]="colorOf(item)">
                        <button type="button" class="tp__worn-btn"
                                [disabled]="!snap.live"
                                (click)="takeBack(t, item)"
                                [attr.aria-label]="'Take ' + item.name + ' back from ' + t.name">
                          {{ item.name }} <span aria-hidden="true">×</span>
                        </button>
                      </li>
                    }
                    @if (!worn(t).length) {
                      <li class="tp__worn-empty">nothing — bare hands and a debt</li>
                    }
                  </ul>

                  @if (assignable.length && worn(t).length < 2) {
                    <label class="tp__give">
                      <span class="tp__give-label">Hand them something</span>
                      <select class="tp__select" [disabled]="!snap.live"
                              (change)="give(t, $any($event.target).value); $any($event.target).value = ''">
                        <option value="">— choose —</option>
                        @for (item of assignable; track item.id) {
                          <option [value]="item.id">
                            {{ item.name }} ({{ rarityOf(item) }})
                          </option>
                        }
                      </select>
                    </label>
                  }
                </div>

                <div class="tp__actions">
                  @if (t.status === 'idle') {
                    <button type="button" class="tp__act"
                            [disabled]="!snap.live || snap.working >= snap.slots"
                            (click)="assign(t, true)">
                      Send to the anvil
                    </button>
                  } @else {
                    <button type="button" class="tp__act tp__act--ghost"
                            [disabled]="!snap.live"
                            (click)="assign(t, false)">
                      Stand down
                    </button>
                  }
                  <button type="button" class="tp__act tp__act--danger"
                          [disabled]="!snap.live"
                          (click)="release(t)">
                    Release
                  </button>
                </div>
              </div>
            }
          </li>
        }
      </ul>

      @if (snap.thralls.length) {
        <p class="tp__cost">
          Every pull costs <b>{{ compactGold(rollCost) }}</b> Gold — a hundred times your own.
          They pause the moment this tab goes behind another.
        </p>
      }

      <!-- ── The log ────────────────────────────────────────────────────── -->
      @if (snap.log.length) {
        <div class="tp__log">
          <p class="tp__log-title">Activity</p>
          <ul>
            @for (line of snap.log.slice(0, logLines); track line.id) {
              <li [style.--star-color]="logColor(line)">
                <span class="tp__log-time">{{ clock(line.at) }}</span>
                <span class="tp__log-text">{{ line.text }}</span>
              </li>
            }
          </ul>
        </div>
      }
    </section>
  `,
  styles: [`
    .tp {
      position: relative;
      display: grid;
      gap: 0.9rem;
      padding: 1.1rem;
      border-radius: 16px;
      background:
        radial-gradient(ellipse 60% 50% at 20% 30%, rgba(255, 154, 90, 0.05), transparent 65%),
        radial-gradient(ellipse 50% 45% at 80% 70%, rgba(123, 97, 255, 0.06), transparent 65%),
        rgba(10, 6, 26, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.06);
    }
    .tp::before {
      content: ''; position: absolute; top: -1px; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255, 154, 90, 0.45) 50%, transparent);
    }
    .tp__head { display: grid; gap: 0.25rem; }
    .tp__eyebrow {
      display: inline-flex; align-items: center; gap: 0.45rem;
      margin: 0; font-size: 0.68rem; letter-spacing: 0.16em; text-transform: uppercase;
      color: rgba(255, 200, 160, 0.8);
    }
    .tp__pulse {
      width: 6px; height: 6px; border-radius: 50%;
      background: #ff9a5a; box-shadow: 0 0 8px rgba(255, 154, 90, 0.8);
      animation: tpPulse 3s ease-in-out infinite;
    }
    @keyframes tpPulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
    .tp__title { margin: 0; font-size: 1.05rem; }
    .tp__tagline { margin: 0; font-size: 0.8rem; opacity: 0.62; }

    .tp__squad {
      /* 74px is what lets all four tiles sit on one row at 375px rather than
         stranding "Found today" alone underneath the other three. */
      display: grid; grid-template-columns: repeat(auto-fit, minmax(74px, 1fr));
      gap: 0.4rem; margin: 0;
    }
    .tp__squad div {
      padding: 0.45rem 0.5rem; border-radius: 10px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .tp__squad dt { font-size: 0.62rem; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.55; }
    .tp__squad dd { margin: 0.15rem 0 0; font-weight: 700; font-size: 0.95rem; }

    .tp__empty { margin: 0; font-size: 0.84rem; opacity: 0.68; }
    .tp__empty a { color: #ff9a5a; }

    .tp__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
    .tp__card {
      border-radius: 12px; overflow: hidden;
      background: rgba(255, 255, 255, 0.025);
      border: 1px solid rgba(255, 255, 255, 0.06);
      transition: border-color 180ms ease, box-shadow 180ms ease;
    }
    .tp__card--open { border-color: var(--star-glow); box-shadow: 0 0 24px -10px var(--star-glow); }
    .tp__card[data-status='idle'] { opacity: 0.72; }

    .tp__face {
      display: flex; align-items: center; gap: 0.6rem; width: 100%;
      min-height: 44px; padding: 0.55rem 0.7rem;
      background: none; border: 0; color: inherit; text-align: left; cursor: pointer;
      font: inherit;
    }
    .tp__orb {
      flex: none; width: 22px; height: 22px; border-radius: 50%;
      background:
        radial-gradient(circle at 32% 28%, #fff, rgba(255,255,255,0) 46%),
        radial-gradient(circle at 50% 50%, var(--star-color) 0%, rgba(8,3,24,0.92) 88%);
      box-shadow: 0 0 10px var(--star-glow);
    }
    .tp__ident { display: grid; flex: 1 1 auto; min-width: 0; }
    .tp__name { font-weight: 600; font-size: 0.9rem; }
    .tp__tier { font-size: 0.7rem; opacity: 0.6; }
    .tp__state {
      flex: none; font-size: 0.66rem; letter-spacing: 0.1em; text-transform: uppercase;
      padding: 0.2rem 0.45rem; border-radius: 999px;
      background: rgba(255, 255, 255, 0.06);
    }
    .tp__state[data-status='working'] { color: #7fd5a3; }
    .tp__state[data-status='resting'] { color: #e8c898; }

    .tp__bar {
      margin: 0 0.7rem 0.55rem; height: 4px; border-radius: 999px;
      background: rgba(255, 255, 255, 0.08); overflow: hidden;
    }
    .tp__fill {
      display: block; height: 100%; border-radius: 999px;
      background: linear-gradient(90deg, var(--star-color), rgba(255,255,255,0.7));
      transition: width 400ms ease;
    }

    .tp__body { display: grid; gap: 0.65rem; padding: 0 0.7rem 0.75rem; }
    .tp__stats {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
      gap: 0.4rem; margin: 0;
    }
    .tp__stats dt { font-size: 0.6rem; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.5; }
    .tp__stats dd { margin: 0; font-size: 0.85rem; font-weight: 600; }
    .tp__xp { margin: 0; font-size: 0.74rem; opacity: 0.66; }

    .tp__kit-title, .tp__log-title {
      margin: 0 0 0.3rem; font-size: 0.62rem; letter-spacing: 0.12em;
      text-transform: uppercase; opacity: 0.5;
    }
    .tp__worn { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .tp__worn-btn {
      /* 44px, not the 32 a chip wants to be. This is a standalone control —
         tapping it takes the item back — and the mobile audit that fixed the
         drawer set 44 as the floor for every one of those. */
      min-height: 44px; padding: 0.25rem 0.7rem; border-radius: 999px; cursor: pointer;
      font: inherit; font-size: 0.74rem;
      color: var(--star-color);
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--star-color);
    }
    .tp__worn-btn[disabled] { opacity: 0.5; cursor: default; }
    .tp__worn-empty { font-size: 0.74rem; opacity: 0.45; }

    .tp__give { display: grid; gap: 0.25rem; margin-top: 0.5rem; }
    .tp__give-label { font-size: 0.62rem; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.5; }
    .tp__select {
      min-height: 44px; padding: 0 0.6rem; border-radius: 10px; font: inherit; font-size: 0.8rem;
      color: inherit; background: rgba(8, 4, 20, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.12);
    }

    .tp__actions { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .tp__act {
      min-height: 44px; padding: 0 0.85rem; border-radius: 10px; cursor: pointer;
      font: inherit; font-size: 0.78rem; font-weight: 600;
      color: #08040f; background: var(--star-color); border: 1px solid var(--star-color);
    }
    .tp__act--ghost { color: var(--star-color); background: transparent; }
    .tp__act--danger {
      color: #ff8fa3; background: transparent; border-color: rgba(255, 143, 163, 0.45);
    }
    .tp__act[disabled] { opacity: 0.45; cursor: default; }

    .tp__cost { margin: 0; font-size: 0.74rem; opacity: 0.6; }

    .tp__log ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.2rem; }
    .tp__log li {
      display: flex; gap: 0.5rem; font-size: 0.74rem;
      padding: 0.2rem 0.4rem; border-radius: 6px;
      border-left: 2px solid var(--star-color);
      background: rgba(255, 255, 255, 0.02);
    }
    .tp__log-time { flex: none; opacity: 0.45; font-variant-numeric: tabular-nums; }
    .tp__log-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .tp--compact .tp__tagline, .tp--compact .tp__cost { display: none; }

    @media (prefers-reduced-motion: reduce) {
      .tp__pulse { animation: none; opacity: 0.85; }
      .tp__fill { transition: none; }
    }
  `],
})
export class ThrallPanelComponent implements OnInit, OnDestroy {
  private readonly thralls = inject(ThrallService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly subs = new Subscription();

  /** Set on the Sanctum, where the column already has a heading of its own. */
  @Input() heading = 'Forge Thralls';
  @Input() compact = false;
  /** How many log lines to draw. The service keeps forty. */
  @Input() logLines = 8;

  snap: ThrallSnapshot = this.thralls.snapshot;

  readonly maxThralls = MAX_THRALLS;
  readonly maxLevel = THRALL_MAX_LEVEL;
  readonly rollCost = THRALL_ROLL_COST;

  /** Which card is expanded. One at a time — the cards are tall. */
  open: string | null = null;

  ngOnInit(): void {
    this.thralls.init();
    this.subs.add(this.thralls.snapshot$.subscribe(s => {
      this.snap = s;
      this.cdr.markForCheck();
    }));
  }

  ngOnDestroy(): void {
    // The subscription goes; the shift does not. A Thrall is supposed to keep
    // working while the Keeper walks to another route in the same tab.
    this.subs.unsubscribe();
  }

  toggle(id: string): void {
    this.open = this.open === id ? null : id;
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  tierColor(t: Thrall): string { return thrallTier(t.rarity).color; }
  tierGlow(t: Thrall): string { return thrallTier(t.rarity).glow; }
  tierLabel(t: Thrall): string { return thrallTier(t.rarity).label; }

  statusLabel(t: Thrall): string {
    if (t.status === 'working') return 'working';
    if (t.status === 'resting') return 'resting';
    return 'idle';
  }

  staminaPct(t: Thrall): number {
    if (t.maxStamina <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((t.stamina / t.maxStamina) * 100)));
  }

  nextLevelXp(t: Thrall): number { return xpToNext(t.level); }

  /** Their live Magic Find, which moves with the Keeper's own build. */
  liveMagicFind(t: Thrall): number {
    return Math.round(this.thralls.magicFindOf(t.id));
  }

  worn(t: Thrall): GameItem[] { return this.thralls.wornItems(t.id); }

  get assignable(): GameItem[] { return this.thralls.assignable(); }

  colorOf(item: GameItem): string { return rarityColor(item.rarity); }
  rarityOf(item: GameItem): string { return rarityLabel(item.rarity); }

  logColor(line: ThrallLogEntry): string {
    return RUNE_TIER_COLOURS[line.tier] ?? '#8f98a8';
  }

  clock(at: number): string {
    const d = new Date(at);
    return `${`${d.getHours()}`.padStart(2, '0')}:${`${d.getMinutes()}`.padStart(2, '0')}`;
  }

  compactGold(value: number): string { return formatCompact(value); }

  // ── Writes ─────────────────────────────────────────────────────────────────

  assign(t: Thrall, working: boolean): void {
    this.thralls.setWorking(t.id, working);
  }

  give(t: Thrall, itemId: string): void {
    if (!itemId) return;
    this.thralls.equip(t.id, itemId);
  }

  takeBack(t: Thrall, item: GameItem): void {
    this.thralls.unequip(t.id, item.id);
  }

  release(t: Thrall): void {
    this.thralls.release(t.id);
    if (this.open === t.id) this.open = null;
  }
}
