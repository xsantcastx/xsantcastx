/**
 * explorer-roster-panel.component.ts — who works for you, and what they carry.
 *
 * Mounted on /sanctum beside the dispatch picker. Lists every hire, opens one
 * at a time to show their kit, and lets a charm be moved onto them from the bag.
 *
 * Deliberately does *not* own dispatch: the picker beside it already knows how
 * to arm a realm and a mission length, and a second dispatch button that took a
 * different code path would be a second set of rules about who is available.
 * This panel says who exists; `ExplorerService` says who is out.
 *
 * SSR: renders the empty roster from the service's empty snapshot.
 */
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import { ExplorerRosterService, RosterSnapshot } from './explorer-roster.service';
import { InventoryService, InventorySnapshot } from './inventory.service';
import { ExplorerService } from '../explorer/explorer.service';
import {
  RosterExplorer,
  explorerTier,
} from './explorer-roster.model';
import { GameItem, rarityColor, rarityGlow, rarityLabel } from './item.model';

@Component({
  selector: 'app-explorer-roster-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="rp">
      <header class="rp__head">
        <p class="rp__eyebrow"><span class="rp__pulse"></span> The Roster</p>
        <h3 class="rp__title">Who walks for you</h3>
        <p class="rp__tagline">every one of them came back at least once</p>
      </header>

      <p class="rp__empty" *ngIf="!snap.explorers.length">
        nobody yet — the realms are still unwalked
      </p>

      <ul class="rp__list">
        <li
          *ngFor="let e of snap.explorers; trackBy: trackExplorer"
          class="rp__card"
          [class.rp__card--open]="open === e.id"
          [class.rp__card--out]="isOut(e.id)"
          [style.--star-color]="tierColor(e)"
          [style.--star-glow]="tierGlow(e)"
        >
          <button type="button" class="rp__face" (click)="toggle(e.id)"
                  [attr.aria-expanded]="open === e.id">
            <span class="rp__orb" aria-hidden="true"></span>
            <span class="rp__ident">
              <span class="rp__name">{{ e.name }}</span>
              <span class="rp__tier">{{ tierLabel(e) }}</span>
            </span>
            <span class="rp__status" *ngIf="isOut(e.id)">out</span>
            <span class="rp__missions" *ngIf="!isOut(e.id)">{{ e.missions }} run</span>
          </button>

          <div class="rp__body" *ngIf="open === e.id">
            <ul class="rp__stats">
              <li><b>{{ tier(e).inventorySlots }}</b> item {{ tier(e).inventorySlots === 1 ? 'slot' : 'slots' }}</li>
              <li><b>{{ speedLabel(e) }}</b> speed</li>
              <li><b>+{{ lootBonus(e) }}%</b> loot</li>
              <li><b>{{ tier(e).maxEquipSlots }}</b> equip {{ tier(e).maxEquipSlots === 1 ? 'slot' : 'slots' }}</li>
            </ul>

            <!-- Their kit -->
            <div class="rp__kit" *ngIf="tier(e).maxEquipSlots > 0">
              <p class="rp__kit-title">Carrying</p>
              <ul class="rp__worn">
                <li *ngFor="let item of worn(e)"
                    [style.--star-color]="colorOf(item)">
                  <button type="button" class="rp__worn-btn"
                          (click)="takeBack(e, item)"
                          [attr.aria-label]="'Take ' + item.name + ' back'">
                    {{ item.name }} <span aria-hidden="true">×</span>
                  </button>
                </li>
                <li *ngIf="!worn(e).length" class="rp__worn-none">nothing</li>
              </ul>

              <div class="rp__give" *ngIf="worn(e).length < tier(e).maxEquipSlots && charms().length">
                <p class="rp__kit-title">Hand them something</p>
                <ul class="rp__offer">
                  <li *ngFor="let item of charms()" [style.--star-color]="colorOf(item)">
                    <button type="button" class="rp__offer-btn" (click)="give(e, item)">
                      {{ item.name }}
                    </button>
                  </li>
                </ul>
              </div>
              <p class="rp__kit-note" *ngIf="worn(e).length >= tier(e).maxEquipSlots">
                their hands are full
              </p>
            </div>
            <p class="rp__kit-note" *ngIf="tier(e).maxEquipSlots === 0">
              a Common carries nothing but what they find
            </p>

            <button
              type="button"
              class="rp__dismiss"
              *ngIf="!isOut(e.id) && snap.explorers.length > 1"
              (click)="dismiss(e)"
            >
              {{ confirmingDismiss === e.id ? 'Certain? They will not come back' : 'Let them go' }}
            </button>
          </div>
        </li>
      </ul>

      <p class="rp__foot" *ngIf="snap.explorers.length">
        {{ snap.found }} found · {{ snap.explorers.length }} on the books
        <span *ngIf="snap.full"> · the roster is full</span>
      </p>
    </section>
  `,
  styles: [`
    .rp {
      position: relative;
      background: rgba(10, 6, 26, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 16px;
      padding: 1rem;
    }

    .rp__head { margin-bottom: 0.8rem; }
    .rp__eyebrow {
      display: inline-flex; align-items: center; gap: 0.45rem;
      font-size: 0.64rem; letter-spacing: 0.18em; text-transform: uppercase;
      color: #ff9a5a; margin: 0 0 0.3rem;
    }
    .rp__pulse {
      width: 6px; height: 6px; border-radius: 50%;
      background: #ff9a5a; box-shadow: 0 0 8px rgba(255, 140, 60, 0.8);
      animation: rpPulse 3s ease-in-out infinite;
    }
    @keyframes rpPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%      { opacity: 0.45; transform: scale(0.7); }
    }
    .rp__title { margin: 0 0 0.25rem; font-size: 1rem; color: #eafff9; }
    .rp__tagline { margin: 0; font-size: 0.72rem; color: #7d8f8a; font-style: italic; }

    .rp__empty { margin: 0; font-size: 0.76rem; color: #7d8f8a; font-style: italic; }

    .rp__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }

    .rp__card {
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.07);
      background: rgba(8, 5, 20, 0.6);
      overflow: hidden;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .rp__card:hover, .rp__card--open {
      border-color: var(--star-glow);
      box-shadow: 0 0 22px -8px var(--star-glow);
    }
    .rp__card--out { opacity: 0.72; }

    .rp__face {
      display: flex; align-items: center; gap: 0.6rem; width: 100%;
      min-height: 52px; padding: 0.5rem 0.7rem;
      background: none; border: 0; cursor: pointer; text-align: left;
    }

    .rp__orb {
      position: relative; width: 26px; height: 26px; border-radius: 50%; flex: none;
      background:
        radial-gradient(circle at 32% 28%, #fff 0%, rgba(255,255,255,0.32) 18%, rgba(255,255,255,0) 42%),
        radial-gradient(circle at 50% 50%, var(--star-color) 0%, rgba(8,3,24,0.92) 88%);
      box-shadow: 0 0 10px var(--star-glow), 0 0 24px -6px var(--star-glow);
    }

    .rp__ident { display: grid; gap: 0.1rem; min-width: 0; }
    .rp__name {
      font-size: 0.84rem; color: #eafff9; font-weight: 600;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .rp__tier {
      font-size: 0.62rem; letter-spacing: 0.1em; text-transform: uppercase;
      color: var(--star-color);
    }

    .rp__status {
      margin-left: auto; font-size: 0.64rem; letter-spacing: 0.1em;
      text-transform: uppercase; color: #ffc669;
    }
    .rp__missions { margin-left: auto; font-size: 0.68rem; color: #7d8f8a; }

    .rp__body {
      padding: 0.2rem 0.75rem 0.75rem;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }

    .rp__stats {
      list-style: none; margin: 0.6rem 0; padding: 0;
      display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.3rem 0.6rem;
      font-size: 0.72rem; color: #9fb4ae;
    }
    .rp__stats b { color: var(--star-color); }

    .rp__kit-title {
      margin: 0.5rem 0 0.3rem; font-size: 0.64rem;
      letter-spacing: 0.12em; text-transform: uppercase; color: #6f8a84;
    }

    .rp__worn, .rp__offer {
      list-style: none; margin: 0; padding: 0;
      display: flex; flex-wrap: wrap; gap: 0.35rem;
    }
    .rp__worn-none { font-size: 0.72rem; color: #6f8a84; font-style: italic; }

    .rp__worn-btn, .rp__offer-btn {
      min-height: 34px; padding: 0 0.6rem; border-radius: 8px;
      font-size: 0.7rem; cursor: pointer;
      border: 1px solid var(--star-color);
      background: rgba(0, 0, 0, 0.35);
      color: var(--star-color);
    }
    .rp__worn-btn:hover, .rp__offer-btn:hover { background: rgba(255, 255, 255, 0.07); }

    .rp__kit-note { margin: 0.4rem 0 0; font-size: 0.68rem; color: #6f8a84; font-style: italic; }

    .rp__dismiss {
      margin-top: 0.7rem; min-height: 36px; width: 100%;
      border-radius: 8px; border: 1px solid rgba(255, 109, 143, 0.35);
      background: rgba(255, 109, 143, 0.06); color: #ff6d8f;
      font-size: 0.72rem; cursor: pointer;
    }
    .rp__dismiss:hover { background: rgba(255, 109, 143, 0.14); }

    .rp__foot { margin: 0.8rem 0 0; font-size: 0.68rem; color: #6f8a84; text-align: center; }

    @media (prefers-reduced-motion: reduce) { .rp__pulse { animation: none; } }
  `],
})
export class ExplorerRosterPanelComponent implements OnInit, OnDestroy {
  private readonly roster = inject(ExplorerRosterService);
  private readonly inventory = inject(InventoryService);
  private readonly expeditions = inject(ExplorerService);

  snap: RosterSnapshot = this.roster.snapshot;
  bag: InventorySnapshot = this.inventory.snapshot;

  /** Which card is expanded. One at a time — the column is 320px wide. */
  open: string | null = null;
  /** Dismissal is two clicks on the same button, not a modal. */
  confirmingDismiss: string | null = null;

  private subs = new Subscription();

  ngOnInit(): void {
    this.subs.add(this.roster.snapshot$.subscribe(s => (this.snap = s)));
    this.subs.add(this.inventory.snapshot$.subscribe(s => (this.bag = s)));
    this.roster.init();
    this.inventory.init();
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  // ───────────────────────────────────────────────────────────────────────────
  // Rendering
  // ───────────────────────────────────────────────────────────────────────────

  tier(e: RosterExplorer) { return explorerTier(e.rarity); }
  tierColor(e: RosterExplorer): string { return this.tier(e).color; }
  tierGlow(e: RosterExplorer): string { return this.tier(e).glow; }
  tierLabel(e: RosterExplorer): string { return this.tier(e).label; }

  /** "2× faster" reads better than "0.5", which nobody can rank at a glance. */
  speedLabel(e: RosterExplorer): string {
    const speed = this.tier(e).speed;
    if (speed >= 1) return 'normal';
    const times = Math.round((1 / speed) * 10) / 10;
    return `${times}× faster`;
  }

  lootBonus(e: RosterExplorer): number {
    return this.roster.lootBonusOf(e.id);
  }

  worn(e: RosterExplorer): GameItem[] {
    return this.inventory.itemsOnExplorer(e.id);
  }

  /**
   * What can be handed over: unequipped charms only.
   *
   * Charms are the only type offered because they are the only type whose stats
   * read the same on an explorer as on the player — a `goldPerSec` sigil worn by
   * somebody walking through Umbral would contribute nothing, and offering it
   * would be offering a slot that does nothing.
   */
  charms(): GameItem[] {
    return this.bag.bag.filter(i => i.type === 'charm');
  }

  colorOf(item: GameItem): string { return rarityColor(item.rarity); }
  glowOf(item: GameItem): string { return rarityGlow(item.rarity); }
  labelOf(item: GameItem): string { return rarityLabel(item.rarity); }

  isOut(id: string): boolean { return this.expeditions.isOut(id); }

  trackExplorer(_: number, e: RosterExplorer): string { return e.id; }

  // ───────────────────────────────────────────────────────────────────────────
  // Actions
  // ───────────────────────────────────────────────────────────────────────────

  toggle(id: string): void {
    this.open = this.open === id ? null : id;
    this.confirmingDismiss = null;
  }

  give(e: RosterExplorer, item: GameItem): void {
    this.roster.equipOn(e.id, item.id);
  }

  takeBack(e: RosterExplorer, item: GameItem): void {
    this.roster.unequipFrom(e.id, item.id);
  }

  /**
   * First click arms, second click fires.
   *
   * The button's own label carries the confirmation, so there is no dialog to
   * position and nothing to trap focus in — and the armed state is cleared by
   * closing the card, which is the natural way out.
   */
  dismiss(e: RosterExplorer): void {
    if (this.confirmingDismiss !== e.id) {
      this.confirmingDismiss = e.id;
      return;
    }
    this.roster.dismiss(e.id);
    this.confirmingDismiss = null;
    this.open = null;
  }
}
