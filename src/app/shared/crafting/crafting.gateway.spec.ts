/**
 * crafting.gateway.spec.ts — one craft, across four ledgers.
 *
 * The invariants worth a test are the ones that cost a player something when
 * they break: materials consumed without an item arriving, Gold taken twice for
 * one strike, a recipe that mints a second copy on a retry, or a ladder that
 * ticks for a craft that never happened.
 */
import { TestBed } from '@angular/core/testing';

import { CollectionService } from '../collection/collection.service';
import { EconomyService } from '../economy/economy.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { InventoryService } from '../rpg/inventory.service';
import { CraftingGateway } from './crafting.gateway';
import { CraftingService } from './crafting.service';
import {
  CRAFTING_RECIPES,
  MASTERY_THRESHOLD,
  craftXpFor,
  craftingRecipeById,
  recipeCollectionId,
  xpToReach,
} from './crafting.model';

class MemoryGateway {
  private readonly bag = new Map<string, string>();
  write(key: string, value: unknown): void { this.bag.set(key, JSON.stringify(value)); }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
  read(key: string): unknown {
    const raw = this.bag.get(key);
    if (raw == null) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  remove(key: string): void { this.bag.delete(key); }
}

/** The cheapest recipe on the bench: level 1, hand-gatherable, two ingredients. */
const RECIPE = craftingRecipeById('craft-health-elixir')!;

let mutation = 0;
function nextMutation(): string { return `spec-craft-${++mutation}`; }

describe('CraftingGateway', () => {
  let memory: MemoryGateway;
  let gateway: CraftingGateway;
  let inventory: InventoryService;
  let economy: EconomyService;
  let crafting: CraftingService;
  let collection: CollectionService;

  /** Put `multiple` full sets of this recipe's inputs in the bag. */
  function stock(multiple = 1): void {
    for (const ing of RECIPE.ingredients) {
      inventory.grantStack(`spec-grant-${ing.materialId}-${multiple}`, ing.materialId, ing.count * multiple);
    }
  }

  beforeEach(() => {
    memory = new MemoryGateway();
    TestBed.configureTestingModule({
      providers: [
        CraftingGateway,
        CraftingService,
        InventoryService,
        EconomyService,
        CollectionService,
        LocalSaveRegistry,
        { provide: GameStateGateway, useValue: memory },
      ],
    });
    gateway = TestBed.inject(CraftingGateway);
    inventory = TestBed.inject(InventoryService);
    economy = TestBed.inject(EconomyService);
    crafting = TestBed.inject(CraftingService);
    collection = TestBed.inject(CollectionService);
    gateway.init();
    collection.init();
    economy.earnGold(5_000_000, 'spec');
  });

  it('consumes the inputs, mints the output and takes the Gold, once', () => {
    stock(1);
    const goldBefore = economy.snapshot.gold;
    const result = gateway.craft(RECIPE.id, nextMutation());

    expect(result.ok).withContext(JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    expect(result.items.length).toBe(RECIPE.output.count);
    for (const ing of RECIPE.ingredients) expect(inventory.stackOf(ing.materialId)).toBe(0);
    expect(economy.snapshot.gold).toBe(goldBefore - RECIPE.goldCost);
    expect(inventory.itemById(result.items[0].id)).toBeTruthy();
  });

  it('mints against the definition, not a placeholder', () => {
    stock(1);
    const result = gateway.craft(RECIPE.id, nextMutation());
    if (!result.ok) { fail('craft refused'); return; }
    for (const item of result.items) {
      expect(item.definitionId).toBe(RECIPE.output.itemId);
      expect(item.rarity).toBe(RECIPE.rarity);
      expect(item.equipped).toBe(false);
    }
  });

  it('replays the same mutation id instead of crafting twice', () => {
    stock(1);
    const id = nextMutation();
    const first = gateway.craft(RECIPE.id, id);
    const goldAfterFirst = economy.snapshot.gold;
    const second = gateway.craft(RECIPE.id, id);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.replayed).toBe(true);
    expect(second.goldSpent).toBe(0);
    expect(economy.snapshot.gold).toBe(goldAfterFirst);
    expect(second.items.map(i => i.id)).toEqual(first.items.map(i => i.id));
    expect(crafting.craftedCount(RECIPE.id)).toBe(1);
  });

  it('refuses when a material is short, and spends nothing', () => {
    const goldBefore = economy.snapshot.gold;
    const result = gateway.craft(RECIPE.id, nextMutation());
    expect(result).toEqual({ ok: false, code: 'missing' });
    expect(economy.snapshot.gold).toBe(goldBefore);
    expect(crafting.xp()).toBe(0);
  });

  it('refuses when the Gold is short, and consumes nothing', () => {
    stock(1);
    economy.spendGold(economy.snapshot.gold, 'spec-drain');
    const result = gateway.craft(RECIPE.id, nextMutation());
    expect(result).toEqual({ ok: false, code: 'funds' });
    for (const ing of RECIPE.ingredients) {
      expect(inventory.stackOf(ing.materialId)).toBe(ing.count);
    }
  });

  it('refuses a recipe above the crafting level', () => {
    const gated = CRAFTING_RECIPES.find(r => (r.requiredLevel ?? 1) > 1)!;
    expect(gateway.craft(gated.id, nextMutation())).toEqual({ ok: false, code: 'level' });
    expect(gateway.blocker(gated)).toBe('level');
  });

  it('refuses a recipe that is not on the bench', () => {
    expect(gateway.craft('craft-nothing', nextMutation())).toEqual({ ok: false, code: 'unknown-recipe' });
  });

  it('pays XP and advances the ladder', () => {
    stock(1);
    const result = gateway.craft(RECIPE.id, nextMutation());
    if (!result.ok) { fail('craft refused'); return; }
    expect(crafting.xp()).toBe(craftXpFor(RECIPE));
    expect(result.progress?.xpGained).toBe(craftXpFor(RECIPE));
    expect(result.progress?.discovered).toBe(true);
  });

  it('reports discovery once and never again', () => {
    stock(2);
    const first = gateway.craft(RECIPE.id, nextMutation());
    const second = gateway.craft(RECIPE.id, nextMutation());
    if (!first.ok || !second.ok) { fail('craft refused'); return; }
    expect(first.progress?.discovered).toBe(true);
    expect(second.progress?.discovered).toBe(false);
  });

  it('writes the recipe into the Collection Log the first time it is crafted', () => {
    stock(1);
    const logId = recipeCollectionId(RECIPE.id);
    expect(collection.has(logId)).toBe(false);
    gateway.craft(RECIPE.id, nextMutation());
    expect(collection.has(logId)).toBe(true);
  });

  it('masters a recipe on the tenth craft and rolls better after it', () => {
    stock(MASTERY_THRESHOLD + 1);
    let masteredOn = 0;
    for (let n = 1; n <= MASTERY_THRESHOLD; n++) {
      const result = gateway.craft(RECIPE.id, nextMutation());
      if (!result.ok) { fail(`craft ${n} refused`); return; }
      expect(result.masteryBonus).toBe(0);
      if (result.progress?.masteredNow) masteredOn = n;
    }
    expect(masteredOn).toBe(MASTERY_THRESHOLD);

    const after = gateway.craft(RECIPE.id, nextMutation());
    if (!after.ok) { fail('post-mastery craft refused'); return; }
    expect(after.masteryBonus).toBeGreaterThan(0);
  });

  it('rolls a mastered craft strictly better than the same seed unmastered', () => {
    // Same fixed RNG both times, so the only difference is the bonus.
    stock(MASTERY_THRESHOLD + 2);
    const seed = () => 0.4;
    const plain = gateway.craft(RECIPE.id, nextMutation(), seed);
    if (!plain.ok) { fail('craft refused'); return; }

    for (let n = 1; n < MASTERY_THRESHOLD; n++) gateway.craft(RECIPE.id, nextMutation(), seed);
    const mastered = gateway.craft(RECIPE.id, nextMutation(), seed);
    if (!mastered.ok) { fail('mastered craft refused'); return; }

    expect(mastered.quality ?? 0).toBeGreaterThan(plain.quality ?? 0);
  });

  it('names the first thing standing in the way and nothing after it', () => {
    const ready = craftingRecipeById(RECIPE.id)!;
    expect(gateway.blocker(ready)).toBe('missing');
    stock(1);
    expect(gateway.blocker(ready)).toBeNull();
  });

  it('lists exactly what is short', () => {
    const missing = gateway.missing(RECIPE);
    expect(missing.length).toBe(RECIPE.ingredients.length);
    stock(1);
    expect(gateway.missing(RECIPE)).toEqual([]);
  });

  it('survives a reload: the ladder and the counts come back off the blob', () => {
    stock(1);
    gateway.craft(RECIPE.id, nextMutation());
    const xp = crafting.xp();

    // A fresh injector over the same store is what a page reload looks like.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [CraftingService, LocalSaveRegistry, { provide: GameStateGateway, useValue: memory }],
    });
    const fresh = TestBed.inject(CraftingService);
    fresh.init();
    expect(fresh.xp()).toBe(xp);
    expect(fresh.craftedCount(RECIPE.id)).toBe(1);
  });

  it('climbs a real level when enough XP has been earned', () => {
    const dear = CRAFTING_RECIPES.find(r => (r.requiredLevel ?? 1) === 1 && r.rarity === 'uncommon')!;
    const needed = Math.ceil(xpToReach(2) / craftXpFor(dear));
    for (const ing of dear.ingredients) {
      inventory.grantStack(`spec-bulk-${ing.materialId}`, ing.materialId, ing.count * (needed + 1));
    }
    for (let n = 0; n < needed; n++) gateway.craft(dear.id, nextMutation());
    expect(crafting.level()).toBeGreaterThanOrEqual(2);
  });
});
