/**
 * hearth.service.ts — the only writer of `godforge-hearth` (hearth-save.model.ts): the Cold Hearth and its blessings.
 *
 *  - light()  a hearth is lit by the Keeper's own hand: it joins the lit set and becomes the wake point
 *  - buy()    a Hearth Blessing at a capital's shrine, for Gold (hearth-rules.ts blessingPrice)
 *  - fall()   the Keeper fell: the purse share is left where they fell (LootService.fall, the corpse run), the Ember
 *             debt grows, and any blessings held are consumed. Under the grace level: nothing at all.
 *  - earn()   a kill's Hunting XP against the debt: half of it pays the debt while there is one
 *
 * Per character: the gateway maps the key onto the active character's storage (save/character-scope.ts).
 * Registered with LocalSaveRegistry, so a cloud merge lands in memory in the same tick. Nothing here touches
 * localStorage, and nothing ever takes an item, a level or a skill rank.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { EconomyService } from '../economy/economy.service';
import { LootService } from '../loot/loot.service';
import { keeperLevelForXp } from '../skills/keeper-level';
import { BLESSINGS, blessingPrice, fallCosts, fallDebt, fallScale, isBlessingId, payDebt, type BlessingId } from './hearth-rules';
import { HEARTH_KEY, coerceHearth, emptyHearth, isHearthId, type HearthSave } from './hearth-save.model';

/** What one fall cost, for the wake card. */
export interface FallSummary {
  /** Under the grace level: nothing was taken. */
  grace: boolean;
  /** Gold left where the Keeper fell (0: none, or the purse was empty, or all five blessings held). */
  gold: number;
  /** Ember debt this fall added, and the debt now. */
  debt: number;
  debtTotal: number;
  /** Blessings the fall consumed. */
  blessed: number;
}

export type BlessingBuy = 'ok' | 'held' | 'gold' | 'grace' | 'unknown';

@Injectable({ providedIn: 'root' })
export class HearthService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly economy = inject(EconomyService);
  private readonly loot = inject(LootService);
  private readonly subject = new BehaviorSubject<HearthSave>(emptyHearth());
  private hydrated = false;

  get state(): HearthSave { this.hydrate(); return this.subject.value; }
  get state$(): Observable<HearthSave> { this.hydrate(); return this.subject.asObservable(); }

  /** Light a hearth: it becomes the wake point. `first` when it had never been lit. */
  light(id: string, at = Date.now()): { first: boolean } {
    if (!this.isBrowser || !isHearthId(id)) return { first: false };
    const s = this.state;
    const first = !s.lit.includes(id);
    if (!first && s.wake === id) return { first };
    this.write({ ...s, lit: first ? [...s.lit, id].sort() : s.lit, wake: id, wakeAt: Math.max(at, s.wakeAt + 1) });
    return { first };
  }

  /** Buy one Hearth Blessing at `level`'s price. Gold first; the blessing is written in the same tick. */
  buy(id: string, level: number, at = Date.now()): BlessingBuy {
    if (!this.isBrowser || !isBlessingId(id)) return 'unknown';
    const s = this.state;
    if (s.blessings.includes(id)) return 'held';
    if (!fallCosts(level)) return 'grace';
    if (!this.economy.spendGold(blessingPrice(level), `blessing:${id}`)) return 'gold';
    const held = BLESSINGS.map(b => b.id).filter(b => b === id || s.blessings.includes(b)) as BlessingId[];
    this.write({ ...s, blessings: held, ledgerAt: Math.max(at, s.ledgerAt + 1) });
    return 'ok';
  }

  /**
   * The Keeper fell at (area, x, y) holding `xp` Hunting XP. Over the grace level the purse share (less the
   * blessings) is left there, the debt grows (less the blessings) and every blessing held is consumed.
   */
  fall(where: { area: string; x: number; y: number }, xp: number, at = Date.now()): FallSummary {
    const s = this.state;
    if (!this.isBrowser) return { grace: true, gold: 0, debt: 0, debtTotal: s.debt, blessed: 0 };
    if (!fallCosts(keeperLevelForXp(xp))) {
      this.write({ ...s, falls: s.falls + 1 });
      return { grace: true, gold: 0, debt: 0, debtTotal: s.debt, blessed: 0 };
    }
    const blessed = s.blessings.length;
    const gold = this.loot.fall(where.area, where.x, where.y, at, fallScale(blessed));
    const debt = fallDebt(xp, blessed, s.debt);
    const next: HearthSave = { ...s, debt: s.debt + debt, blessings: [], ledgerAt: Math.max(at, s.ledgerAt + 1), falls: s.falls + 1 };
    this.write(next);
    return { grace: false, gold, debt, debtTotal: next.debt, blessed };
  }

  /**
   * S5: a Lanternwright's Rekindle undid a fall (skills-100.md §3: it cancels the death's XP loss): the debt that fall
   * added is forgiven. Returns what was forgiven.
   */
  forgive(debt: number, at = Date.now()): number {
    const s = this.state, n = Math.max(0, Math.min(s.debt, Math.floor(debt || 0)));
    if (!this.isBrowser || n <= 0) return 0;
    this.write({ ...s, debt: s.debt - n, ledgerAt: Math.max(at, s.ledgerAt + 1) });
    return n;
  }

  /** A kill's Hunting XP: what is earned now, and what paid the debt. */
  earn(xp: number, at = Date.now()): { earned: number; paid: number } {
    const s = this.state;
    if (!this.isBrowser || s.debt <= 0) return { earned: Math.max(0, Math.floor(xp || 0)), paid: 0 };
    const r = payDebt(xp, s.debt);
    if (r.paid > 0) this.write({ ...s, debt: r.debt, ledgerAt: Math.max(at, s.ledgerAt + 1) });
    return { earned: r.earned, paid: r.paid };
  }

  private write(next: HearthSave): void {
    this.subject.next(next);
    if (this.isBrowser) this.store.write(HEARTH_KEY, next);
  }

  private hydrate(): void {
    if (this.hydrated || !this.isBrowser) return;
    this.hydrated = true;
    this.subject.next(coerceHearth(this.store.read(HEARTH_KEY)));
    this.saves.register(HEARTH_KEY, { rehydrate: () => this.subject.next(coerceHearth(this.store.read(HEARTH_KEY))) });
  }
}
