/**
 * PotionService — drinking from the belt and buying at Edrin Kade's counter (potions.model.ts holds the rules).
 *
 * Every write goes through a ledger that already owns the thing:
 *  - drink  InventoryService.consumeStacks under `potion:drink:<id>:<n>` (a fresh id per sip), after the shared
 *           cooldown; the play view hands the effect to the engine (drinkPotion).
 *  - buy    InventoryService.grantStack under `potion:buy:<press id>`, then EconomyService.spendGold in the same
 *           tick (the Slate's order: a crash in between is a free potion, never a charged player). A retry of the
 *           same press is a replay.
 *
 * The cooldown is a moment of play, not saved state: a reload starts ready.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { InventoryService } from '../rpg/inventory.service';
import { EconomyService } from '../economy/economy.service';
import { POTION_COOLDOWN, bestPotion, potionById, potionCooldownLeft, type PotionDef } from './potions.model';

export type DrinkCode = 'ok' | 'none' | 'cooldown' | 'failed' | 'ssr';
export type PotionBuyCode = 'ok' | 'replayed' | 'unknown' | 'funds' | 'failed' | 'ssr';

/** One belt slot as the HUD shows it. */
export interface BeltSlot { kind: 'health' | 'mana'; key: string; potion: PotionDef | null; count: number; left: number }

@Injectable({ providedIn: 'root' })
export class PotionService {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly inventory = inject(InventoryService);
  private readonly economy = inject(EconomyService);
  private lastAt: number | null = null;
  private sips = 0;

  private readonly qty = (id: string): number => this.inventory.stackOf(id);

  /** The two belt slots: what Q and R would drink now, how many of it, and the cooldown left (0–1). */
  belt(now: number): BeltSlot[] {
    const left = potionCooldownLeft(this.lastAt, now) / POTION_COOLDOWN;
    return (['health', 'mana'] as const).map(kind => {
      const potion = this.browser ? bestPotion(kind, this.qty) : null;
      return { kind, key: kind === 'health' ? 'Q' : 'R', potion, count: potion ? this.qty(potion.id) : 0, left };
    });
  }

  /** Drink the best potion of a kind. `now` in seconds. */
  drink(kind: 'health' | 'mana', now: number): { code: DrinkCode; potion: PotionDef | null } {
    if (!this.browser) return { code: 'ssr', potion: null };
    const potion = bestPotion(kind, this.qty);
    if (!potion) return { code: 'none', potion: null };
    if (potionCooldownLeft(this.lastAt, now) > 0) return { code: 'cooldown', potion };
    const res = this.inventory.consumeStacks(`potion:drink:${potion.id}:${Date.now().toString(36)}:${++this.sips}`, [{ id: potion.id, count: 1 }]);
    if (!res.ok) return { code: 'failed', potion };
    this.lastAt = now;
    return { code: 'ok', potion };
  }

  /** Buy `n` of a potion from the counter. `pressId` names the press: a retry of the same press is a replay. */
  buy(id: string, n: number, pressId: string): PotionBuyCode {
    if (!this.browser) return 'ssr';
    const potion = potionById(id);
    const count = Math.floor(n);
    if (!potion || potion.price <= 0 || !(count >= 1)) return 'unknown';
    const grantId = `potion:buy:${pressId}`;
    if (this.inventory.hasStackOp(grantId)) return 'replayed';
    const total = potion.price * count;
    if (this.economy.snapshot.gold < total) return 'funds';
    if (!this.inventory.grantStack(grantId, potion.id, count)) return 'failed';
    if (!this.economy.spendGold(total, grantId)) {
      // Unreachable (affordability was checked this tick): take the potions back rather than give them away.
      this.inventory.consumeStacks(`${grantId}:undo`, [{ id: potion.id, count }]);
      return 'failed';
    }
    return 'ok';
  }
}
