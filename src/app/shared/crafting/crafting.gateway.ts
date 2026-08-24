/**
 * crafting.gateway.ts — the sole writer of a bench craft.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY A GATEWAY AND NOT A METHOD ON THE COMPONENT
 * ─────────────────────────────────────────────────────────────────────────────
 * One craft touches four ledgers that nobody owns together: the bag consumes
 * materials and mints an item, the economy debits Gold, the crafting ladder
 * takes XP, and the Collection Log records the recipe. The master plan's
 * architecture rule is that a feature may only write through an owning service
 * or a documented gateway; this is the documented gateway, and the bench
 * component holds no write of its own.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ORDER, AND WHY IT IS THIS ORDER
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. refuse on anything knowable up front — level, materials, Gold, bag room
 *   2. `InventoryService.craftRecipe` — consume and mint in ONE ledger write
 *   3. `EconomyService.spendGold`
 *   4. `CraftingService.recordCraft` — XP and the mastery counter
 *   5. `CollectionService.discover` — the recipe's own log entry
 *
 * Gold is taken *after* the item exists rather than before, which is the
 * opposite of the Gambler's order, and the difference is what each step can
 * fail on. A box's cost buys a roll that has not happened yet, so it debits
 * first and refunds on a bad mint. A craft's inputs are materials that are
 * already gone the moment step 2 commits — there is nothing to refund them
 * with, and `earnGold` would credit a *multiplied* refund because it is the
 * global Gold mint. So affordability is checked in step 1 and taken in step 3,
 * and the two are the same synchronous tick with no await between them: nothing
 * can spend that Gold in between. In the impossible case that step 3 still
 * fails, the player keeps the item — a free craft is a strictly better bug than
 * a debited player with an empty bag.
 *
 * Steps 4 and 5 are bookkeeping and cannot fail the craft. A ladder that did
 * not tick is a visible, fixable annoyance; a rolled-back item is not.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { CollectionService } from '../collection/collection.service';
import { EconomyService } from '../economy/economy.service';
import { InventoryService, MAX_INVENTORY } from '../rpg/inventory.service';
import { itemDefinitionById, mintEquipment } from '../rpg/item-definition';
import { qualityOf } from '../rpg/item-quality';
import type { GameItem } from '../rpg/item.model';
import { CraftingService, type CraftingProgress } from './crafting.service';
import {
  type CraftingRecipe,
  craftingRecipeById,
  masteryRng,
  recipeCollectionId,
} from './crafting.model';

export type CraftReject =
  | 'ssr'
  | 'unknown-recipe'
  | 'level'
  | 'missing'
  | 'funds'
  | 'capacity'
  | 'mint'
  | 'persist';

export interface CraftSuccess {
  ok: true;
  recipe: CraftingRecipe;
  items: GameItem[];
  /** The best roll grade in the batch, 0..1. What the celebration is scaled to. */
  quality: number | null;
  goldSpent: number;
  /** Null only when the ladder refused to write, which cannot fail the craft. */
  progress: CraftingProgress | null;
  /** True when the same mutation id had already been settled. */
  replayed: boolean;
  /** The mastery bonus applied to this craft's rolls. 0 before mastery. */
  masteryBonus: number;
}

export type CraftResult = CraftSuccess | { ok: false; code: CraftReject };

@Injectable({ providedIn: 'root' })
export class CraftingGateway {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly inventory = inject(InventoryService);
  private readonly economy = inject(EconomyService);
  private readonly crafting = inject(CraftingService);
  private readonly collection = inject(CollectionService);

  init(): void {
    if (!this.isBrowser) return;
    this.inventory.init();
    this.economy.init();
    this.crafting.init();
  }

  /** What this recipe is still short of, for the bench's ingredient slots. */
  missing(recipe: CraftingRecipe): { id: string; need: number; have: number }[] {
    return this.inventory.missingInputs(
      recipe.ingredients.map(row => ({ id: row.materialId, count: row.count })),
    );
  }

  /**
   * Everything that would stop this craft, in the order the bench reports it.
   * Null when the anvil is ready.
   */
  blocker(recipe: CraftingRecipe): CraftReject | null {
    if (!this.isBrowser) return 'ssr';
    this.init();
    if (!this.crafting.meetsLevel(recipe)) return 'level';
    if (this.missing(recipe).length) return 'missing';
    if (this.economy.snapshot.gold < recipe.goldCost) return 'funds';
    if (!this.roomFor(recipe)) return 'capacity';
    return null;
  }

  craft(recipeId: string, mutationId: string, rng: () => number = Math.random, now = Date.now()): CraftResult {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };
    this.init();

    const recipe = craftingRecipeById(recipeId);
    if (!recipe) return { ok: false, code: 'unknown-recipe' };

    // Replay is checked before the pre-flight, and the order is load-bearing.
    // A settled craft has already eaten its materials, so `blocker` would report
    // `missing` and refuse the very craft it is being asked about — the retry
    // path would be unreachable and a dropped response would look like a lost
    // craft. A replay has already paid and already ticked the ladder, so it
    // charges nothing and records nothing.
    const already = this.inventory.craftedFor(mutationId, recipe.output.count);
    if (already) {
      return {
        ok: true,
        recipe,
        items: already,
        quality: bestQuality(already),
        goldSpent: 0,
        progress: null,
        replayed: true,
        masteryBonus: this.crafting.masteryBonus(recipe.id),
      };
    }

    const blocked = this.blocker(recipe);
    if (blocked) return { ok: false, code: blocked };

    const def = itemDefinitionById(recipe.output.itemId);
    if (!def) return { ok: false, code: 'mint' };

    const bonus = this.crafting.masteryBonus(recipe.id);
    const voidTouched = def.style === 'void' || def.style === 'void-touched';
    const rolls = masteryRng(rng, bonus, recipe.rarity, voidTouched);

    const crafted = this.inventory.craftRecipe(
      mutationId,
      recipe.ingredients.map(row => ({ id: row.materialId, count: row.count })),
      (itemId, _index, foundAt) => mintEquipment(def.id, recipe.rarity, rolls, foundAt, itemId),
      recipe.output.count,
      now,
    );
    if (!crafted.ok) {
      return { ok: false, code: crafted.code === 'clock' ? 'persist' : crafted.code };
    }

    // `craftRecipe` has a replay check of its own and it should be unreachable
    // from here — the one above already answered — but it is the bag's
    // invariant, not this gateway's, and a caller that reached it must not be
    // billed twice either.
    if (crafted.replayed) {
      return {
        ok: true,
        recipe,
        items: crafted.items,
        quality: bestQuality(crafted.items),
        goldSpent: 0,
        progress: null,
        replayed: true,
        masteryBonus: bonus,
      };
    }

    const paid = recipe.goldCost > 0 ? this.economy.spendGold(recipe.goldCost, 'crafting') : true;
    const progress = this.crafting.recordCraft(recipe);

    // The recipe's own Collection Log entry. The *item* is logged already —
    // `CollectionWiringService` watches `inventory.acquired$` — so recording it
    // here too would double-count the find.
    this.collection.discover(recipeCollectionId(recipe.id), 1, now);

    return {
      ok: true,
      recipe,
      items: crafted.items,
      quality: bestQuality(crafted.items),
      goldSpent: paid ? recipe.goldCost : 0,
      progress,
      replayed: false,
      masteryBonus: bonus,
    };
  }

  private roomFor(recipe: CraftingRecipe): boolean {
    // `canAcceptInstance` answers for one row, and a recipe that yields two
    // needs two. `usedRows` counts exactly what `craftRecipe`'s own capacity
    // check counts — inventory-source records, stacks included — so the bench's
    // greyed-out reason and the gateway's refusal cannot disagree.
    return this.inventory.snapshot.usedRows + recipe.output.count <= MAX_INVENTORY;
  }
}

function bestQuality(items: readonly GameItem[]): number | null {
  let best: number | null = null;
  for (const item of items) {
    const q = qualityOf(item);
    if (q == null) continue;
    best = best == null ? q : Math.max(best, q);
  }
  return best;
}
