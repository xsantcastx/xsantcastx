/**
 * material-vendor.model.ts — the Seamworks Material Vendor's buyback counter:
 * what it takes, what it pays, and the one sale routine.
 *
 * Pure data and pure functions. Type-only imports plus the economy curve
 * (itself import-free), so the node harness and the Karma spec can both load
 * it, and it is safe on the server.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PLAYERS RUN THE ECONOMY. NPCs ARE SINKS.
 * ─────────────────────────────────────────────────────────────────────────────
 * Economy v3 (owner amendment to the rebalance spec): no NPC sells anything a
 * player can produce. The player auction house is the market; the Vendor used
 * to sell the nine expedition materials for Gold, and now it only BUYS. It is
 * the floor under the market, not the market:
 *
 *   buyback price = max(1, floor(base worth × VENDOR_BUYBACK_FRACTION))
 *   base worth    = the material's v2 anchor × ρ (ITEM_ECONOMY_SCALE, 0.06)
 *
 * with VENDOR_BUYBACK_FRACTION = 0.08. The anchors are the Grand Exchange's
 * material base prices (the spec asserts the table below matches
 * `EXCHANGE_CATALOGUE` × ρ) and, for the expedition-only materials the
 * Exchange does not list, the v2 shelf prices (6k regional, 9k deep, 12k
 * universal). 8% of base worth is under even the Exchange's floor quote (10%
 * of base), so it is well under anything a player market will clear at, so the counter is where surplus and junk go to become a
 * little Gold — never a way to print it, because the Vendor sells nothing back.
 */
import { ITEM_ECONOMY_SCALE, VENDOR_BUYBACK_FRACTION } from '../economy/economy-curve';

export type VendorTier = 'gathered' | 'regional' | 'deep' | 'universal';

/** One row on the buyback board. */
export interface VendorListing {
  materialId: string;
  /** Base worth in v3 Gold (v2 anchor × ρ). What the market is anchored on. */
  worth: number;
  /** Gold the counter pays per unit. Whole Gold, ≥ 1. */
  price: number;
  tier: VendorTier;
  /**
   * The expedition that brings it home, for the expedition-only rows. Empty
   * for gathered materials (the Codex's found-in index already places those).
   */
  source: string;
}

/** The buyback price for a base worth. */
export function buybackPrice(worth: number): number {
  if (!(worth > 0)) return 0;
  return Math.max(1, Math.floor(worth * VENDOR_BUYBACK_FRACTION));
}

/** v2 anchors (Gold). Times ρ is the v3 base worth. */
const V2_SHELF_ANCHOR: Readonly<Record<Exclude<VendorTier, 'gathered'>, number>> = {
  regional: 6_000,
  deep: 9_000,
  universal: 12_000,
};

const row = (materialId: string, tier: VendorTier, source: string, v2Anchor: number): VendorListing => {
  const worth = Math.round(v2Anchor * ITEM_ECONOMY_SCALE);
  return { materialId, tier, source, worth, price: buybackPrice(worth) };
};
const expedition = (materialId: string, tier: Exclude<VendorTier, 'gathered'>, source: string) =>
  row(materialId, tier, source, V2_SHELF_ANCHOR[tier]);

/**
 * What the counter takes. Gathered materials first (the surplus a Keeper
 * actually piles up), then the expedition-only materials. The `v2Anchor` of a
 * gathered row is the Exchange base price.
 */
export const VENDOR_SHELF: readonly VendorListing[] = [
  row('slag-fragment', 'gathered', '', 260),
  row('cinder-ore', 'gathered', '', 420),
  row('thornroot', 'gathered', '', 1_400),
  row('ember-residue', 'gathered', '', 1_800),
  row('sunbloom', 'gathered', '', 2_600),
  row('nightbloom', 'gathered', '', 2_900),
  row('verdant-sap', 'gathered', '', 4_200),
  row('starlight-herb', 'gathered', '', 6_500),
  row('umbral-ink', 'gathered', '', 9_000),
  row('luminous-prism', 'gathered', '', 14_000),
  row('celestial-alloy', 'gathered', '', 26_000),
  expedition('pyrite-dust', 'regional', 'Nexus expeditions'),
  expedition('emberheart-ore', 'deep', 'Nexus expeditions'),
  expedition('world-root-bark', 'regional', 'Verge expeditions'),
  expedition('shadowthread-silk', 'regional', 'Umbral expeditions'),
  expedition('solar-resin', 'regional', 'Luminous expeditions'),
  expedition('moonpetal-herb', 'regional', 'Archivum expeditions'),
  expedition('celestial-quartz', 'deep', 'Archivum expeditions'),
  expedition('orichalcum-ore', 'universal', 'Every realm, rarely'),
  expedition('godforge-slag', 'universal', 'Every realm, rarely'),
];

/** Most units one sale can carry. A crate, not a warehouse. */
export const VENDOR_MAX_QTY = 99;

export function vendorListing(materialId: string): VendorListing | undefined {
  return VENDOR_SHELF.find(listing => listing.materialId === materialId);
}

/** A whole quantity in [1, max]. Garbage (NaN, negatives, fractions) lands on 1 or is floored. */
export function clampQuantity(quantity: number, max = VENDOR_MAX_QTY): number {
  const ceiling = Math.max(1, Math.floor(max));
  const n = Math.floor(Number.isFinite(quantity) ? quantity : 1);
  return Math.min(ceiling, Math.max(1, n));
}

/** Gold paid for `quantity` units. No volume bonus: the counter price is the price. */
export function vendorTotal(listing: Pick<VendorListing, 'price'>, quantity: number): number {
  return listing.price * Math.max(0, Math.floor(quantity));
}

// ─────────────────────────────────────────────────────────────────────────────
// "Keep enough for <recipe>"
// ─────────────────────────────────────────────────────────────────────────────

/** The slice of a crafting recipe the vendor reads. `CraftingRecipe` fits. */
export interface RecipeLike {
  id: string;
  name: string;
  requiredLevel?: number;
  ingredients: readonly { materialId: string; count: number }[];
}

export interface RecipeNeed {
  recipeId: string;
  recipeName: string;
  /** Units the recipe takes. */
  need: number;
  /** Units still missing given what is held. 0 = covered. */
  short: number;
  requiredLevel: number;
}

/**
 * The recipes that consume `materialId`, the ones the Keeper is short for
 * first, then the lowest level, then by name. `limit` rows at most. The
 * counter shows them so a Keeper does not sell what the bench wants.
 */
export function recipeNeeds(
  materialId: string,
  recipes: readonly RecipeLike[],
  held: number,
  limit = 3,
): RecipeNeed[] {
  const have = Math.max(0, held);
  const rows: RecipeNeed[] = [];
  for (const recipe of recipes) {
    const need = recipe.ingredients
      .filter(ingredient => ingredient.materialId === materialId)
      .reduce((sum, ingredient) => sum + ingredient.count, 0);
    if (need <= 0) continue;
    rows.push({
      recipeId: recipe.id,
      recipeName: recipe.name,
      need,
      short: Math.max(0, need - have),
      requiredLevel: recipe.requiredLevel ?? 1,
    });
  }
  rows.sort((a, b) =>
    (b.short > 0 ? 1 : 0) - (a.short > 0 ? 1 : 0)
    || a.requiredLevel - b.requiredLevel
    || a.recipeName.localeCompare(b.recipeName));
  return rows.slice(0, Math.max(0, limit));
}

/** Every recipe that consumes the material, counted. For "used in N recipes". */
export function recipeCount(materialId: string, recipes: readonly RecipeLike[]): number {
  return recipes.filter(recipe => recipe.ingredients.some(row => row.materialId === materialId)).length;
}

/**
 * Units that are surplus: what is held beyond the largest single recipe that
 * wants it. Everything when no recipe does. The quantity the counter suggests.
 */
export function surplusOf(materialId: string, recipes: readonly RecipeLike[], held: number): number {
  const have = Math.max(0, Math.floor(held));
  let keep = 0;
  for (const recipe of recipes) {
    const need = recipe.ingredients
      .filter(ingredient => ingredient.materialId === materialId)
      .reduce((sum, ingredient) => sum + ingredient.count, 0);
    keep = Math.max(keep, need);
  }
  return Math.max(0, have - keep);
}

// ─────────────────────────────────────────────────────────────────────────────
// The sale
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The two ledgers a sale touches, as functions. The service hands in
 * EconomyService and InventoryService; the spec hands in fakes.
 */
export interface VendorLedger {
  /** Units of a material held. */
  held(materialId: string): number;
  /**
   * InventoryService.consumeStacks: idempotent by `mutationId`. `replayed`
   * means this exact sale already took the goods (a retry after a reload).
   */
  consume(mutationId: string, materialId: string, quantity: number): { ok: boolean; replayed: boolean };
  /** EconomyService.earnGold: the counter's payment. */
  payGold(amount: number, reason: string): void;
}

export interface VendorIntent {
  /** One intentional sale. Reuse it only to retry that same sale. */
  mutationId: string;
  materialId: string;
  quantity: number;
  /** The unit price the Keeper was shown. A different live price is refused as stale. */
  expectedUnitPrice: number;
}

export type VendorCode = 'ok' | 'replay' | 'unknown' | 'bad-quantity' | 'stale' | 'short' | 'delivery';

export interface VendorReceipt {
  ok: boolean;
  code: VendorCode;
  mutationId: string;
  materialId: string;
  quantity: number;
  /** Gold paid. */
  total: number;
  /** The inventory consume id, `vendor-sell:<mutationId>`. */
  consumeId: string;
}

/** The inventory consume id for a sale. Stable per mutation id, so a retried consume lands once. */
export function vendorConsumeId(mutationId: string): string {
  return `vendor-sell:${mutationId}`;
}

/**
 * Sell. Same order of operations as the Exchange:
 *
 *   1. A mutation id that already settled returns its first receipt as a
 *      `replay` and touches nothing — a double-submit is one sale.
 *   2. Validate: known material, sane quantity, the price the Keeper saw.
 *   3. Enough held.
 *   4. Take the goods under `vendor-sell:<mutationId>` (idempotent).
 *   5. Pay. A consume that reports `replayed` was already paid for by the
 *      session that took the goods; it is not paid twice. (Across a crash
 *      between 4 and 5 that costs the Keeper one payment — the counter is a
 *      sink, and it errs toward taking, never toward minting.)
 */
export function sellToVendor(
  ledger: VendorLedger,
  intent: VendorIntent,
  settled: Map<string, VendorReceipt>,
): VendorReceipt {
  const prior = intent.mutationId ? settled.get(intent.mutationId) : undefined;
  if (prior) return { ...prior, code: 'replay' };

  const listing = vendorListing(intent.materialId);
  const quantity = Math.floor(intent.quantity);
  const consumeId = vendorConsumeId(intent.mutationId);
  const receipt = (code: VendorCode, total = 0): VendorReceipt => ({
    ok: code === 'ok', code, mutationId: intent.mutationId, materialId: intent.materialId, quantity, total, consumeId,
  });

  if (!intent.mutationId || !listing) return receipt('unknown');
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > VENDOR_MAX_QTY || quantity !== intent.quantity) {
    return receipt('bad-quantity');
  }
  if (listing.price !== intent.expectedUnitPrice) return receipt('stale');
  if (ledger.held(listing.materialId) < quantity) return receipt('short');

  const total = vendorTotal(listing, quantity);
  const taken = ledger.consume(consumeId, listing.materialId, quantity);
  if (!taken.ok) return receipt('delivery');
  if (taken.replayed) {
    const done = receipt('replay', total);
    settled.set(intent.mutationId, done);
    return done;
  }
  ledger.payGold(total, 'material-vendor');

  const done = receipt('ok', total);
  settled.set(intent.mutationId, done);
  return done;
}

/** A fresh mutation id. `random` is injectable so tests are deterministic. */
export function newVendorMutationId(materialId: string, now: number, random: () => number = Math.random): string {
  return `${materialId}:${now.toString(36)}:${random().toString(36).slice(2, 10)}`;
}
