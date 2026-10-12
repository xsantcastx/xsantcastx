/**
 * material-vendor.model.ts — the Seamworks Material Vendor's shelf, prices and
 * the one purchase routine.
 *
 * Pure data and pure functions. Type-only imports, so the node harness and the
 * Karma spec can both load it, and it is safe on the server.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IS ON THE SHELF, AND WHY ONLY THAT
 * ─────────────────────────────────────────────────────────────────────────────
 * Nine materials: the Art Bible materials that crafting recipes consume and
 * that NOTHING but an expedition hands over. They are the wall a new Keeper
 * hits at the Crafting Bench — every recipe from Briarvein Kris up asks for one
 * of them, and a player who has never sent an explorer out cannot get any.
 *
 * Deliberately NOT stocked:
 *   · Hand-gathered materials (Cinder Ore, Thornroot, Celestial Alloy, …).
 *     Mining, Foraging and Prospecting are the way to get those, and the
 *     Exchange already trades them. A fixed-price vendor beside a floating
 *     market is an arbitrage machine: the Exchange can quote up to
 *     PRICE_CEILING_MULT (5×) its base, so any vendor price under ~4.75× base
 *     lets a player buy here and sell there for free Gold forever. The spec
 *     fails if a shelf material is ever listed on the Exchange below that line.
 *   · Runes. The Rune Forge strikes them; a shelf price would delete the anvil.
 *   · Void Crystal, Void Shard. Legendary / mythic gates. Found, not bought.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HOW THE PRICES WERE SET
 * ─────────────────────────────────────────────────────────────────────────────
 * Drop rate: an expedition draw lands on the Art Bible band 6% of the time
 * (`ARTBIBLE_SHARE` in explorer.model), split across five to seven entries, so
 * any one of these is roughly a 1-in-100 draw. That is rarer than every
 * Exchange "rare" good, which sit at 6,500–14,000 Gold a unit (Starlight Herb,
 * Umbral Ink, Luminous Prism). So the shelf is anchored on that band:
 *
 *   regional    6,000  one realm's expedition material, feeding uncommon and
 *                      rare recipes (Pyrite Dust, World-Root Bark, …)
 *   deep        9,000  one realm's material that mostly gates EPIC recipes
 *                      (Emberheart Ore, Celestial Quartz)
 *   universal  12,000  Orichalcum Ore and Godforge Slag: every realm drops them,
 *                      but they are the spine of the epic → mythic recipes
 *
 * Checked against the bench (50 recipes use at least one shelf material):
 * buying a recipe's shelf ingredients costs a median 0.67× the recipe's own
 * Gold fee (Briarvein Kris: 2 bark = 12,000 against a 12,000 fee; Meridian
 * Longbow: 51,000 against 52,000; Godforge Tongs: 144,000 against 225,000).
 * The vendor makes a craft cost roughly 1.5–2× — a real shortcut for a Keeper
 * with Gold and no explorers, never cheaper than sending an expedition. The
 * outliers are the cheap Verdant consumables (Thornberry Elixir: 18,000 of
 * moonpetal against a 4,000 fee), where the fee is token and gathering is the
 * intended path; and the mythic tier, where the shelf share is tiny because
 * Void Crystal and the runes are not for sale.
 */

/** One row on the shelf. */
export interface VendorListing {
  materialId: string;
  /** Gold per unit. Whole Gold. */
  price: number;
  tier: VendorTier;
  /** Where the material is otherwise found, for the counter's "found in" line. */
  source: string;
}

export type VendorTier = 'regional' | 'deep' | 'universal';

export const VENDOR_TIER_PRICE: Readonly<Record<VendorTier, number>> = {
  regional: 6_000,
  deep: 9_000,
  universal: 12_000,
};

const row = (materialId: string, tier: VendorTier, source: string): VendorListing =>
  ({ materialId, tier, source, price: VENDOR_TIER_PRICE[tier] });

/** The shelf, Infernal goods first: this is the Seamworks' stall. */
export const VENDOR_SHELF: readonly VendorListing[] = [
  row('pyrite-dust', 'regional', 'Nexus expeditions'),
  row('emberheart-ore', 'deep', 'Nexus expeditions'),
  row('world-root-bark', 'regional', 'Verge expeditions'),
  row('shadowthread-silk', 'regional', 'Umbral expeditions'),
  row('solar-resin', 'regional', 'Luminous expeditions'),
  row('moonpetal-herb', 'regional', 'Archivum expeditions'),
  row('celestial-quartz', 'deep', 'Archivum expeditions'),
  row('orichalcum-ore', 'universal', 'Every realm, rarely'),
  row('godforge-slag', 'universal', 'Every realm, rarely'),
];

/** Most units one purchase can carry. A crate, not a warehouse. */
export const VENDOR_MAX_QTY = 25;

export function vendorListing(materialId: string): VendorListing | undefined {
  return VENDOR_SHELF.find(listing => listing.materialId === materialId);
}

/** A whole quantity in [1, max]. Garbage (NaN, negatives, fractions) lands on 1 or is floored. */
export function clampQuantity(quantity: number, max = VENDOR_MAX_QTY): number {
  const ceiling = Math.max(1, Math.floor(max));
  const n = Math.floor(Number.isFinite(quantity) ? quantity : 1);
  return Math.min(ceiling, Math.max(1, n));
}

/** Gold for `quantity` units. No volume discount: the shelf price is the price. */
export function vendorTotal(listing: Pick<VendorListing, 'price'>, quantity: number): number {
  return listing.price * Math.max(0, Math.floor(quantity));
}

/** How many units `gold` buys, capped at the crate size. 0 when not even one. */
export function maxAffordable(price: number, gold: number, cap = VENDOR_MAX_QTY): number {
  if (!(price > 0) || !(gold > 0)) return 0;
  return Math.min(Math.max(0, Math.floor(cap)), Math.floor(gold / price));
}

/** Gold still missing for `quantity` units. 0 when affordable. */
export function goldShort(listing: Pick<VendorListing, 'price'>, quantity: number, gold: number): number {
  return Math.max(0, vendorTotal(listing, quantity) - Math.max(0, Math.floor(gold)));
}

// ─────────────────────────────────────────────────────────────────────────────
// "You need X for <recipe>"
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
 * first, then the lowest level, then by name. `limit` rows at most.
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

/** The quantity worth suggesting: the first recipe's shortfall, else 1. */
export function suggestedQuantity(needs: readonly RecipeNeed[]): number {
  const first = needs.find(need => need.short > 0);
  return clampQuantity(first ? first.short : 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// The purchase
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The two ledgers a purchase touches, as functions. The service hands in
 * EconomyService and InventoryService; the spec hands in fakes.
 */
export interface VendorLedger {
  gold(): number;
  /** EconomyService.spendGold: false when unaffordable, never a partial debit, flushes before returning. */
  spendGold(amount: number, reason: string): boolean;
  /** Put Gold back after a debit whose goods could not be delivered. */
  refundGold(amount: number, reason: string): void;
  /** InventoryService.canAcceptStackGrant. */
  canAccept(materialId: string): boolean;
  /** InventoryService.grantStack: idempotent by grant id. */
  grantStack(grantId: string, materialId: string, quantity: number): boolean;
}

export interface VendorIntent {
  /** One intentional purchase. Reuse it only to retry that same purchase. */
  mutationId: string;
  materialId: string;
  quantity: number;
  /** The unit price the Keeper was shown. A different live price is refused as stale. */
  expectedUnitPrice: number;
}

export type VendorCode = 'ok' | 'replay' | 'unknown' | 'bad-quantity' | 'stale' | 'bag-full' | 'funds' | 'delivery';

export interface VendorReceipt {
  ok: boolean;
  code: VendorCode;
  mutationId: string;
  materialId: string;
  quantity: number;
  total: number;
  /** The inventory grant id, `vendor:<mutationId>`. */
  grantId: string;
}

/** The inventory grant id for a purchase. Stable per mutation id, so a retried grant lands once. */
export function vendorGrantId(mutationId: string): string {
  return `vendor:${mutationId}`;
}

/**
 * Buy. The Exchange's order of operations (exchange.service.ts header):
 *
 *   1. A mutation id that already settled returns its first receipt as a
 *      `replay` and touches nothing — a double-submit is one purchase.
 *   2. Validate: known listing, sane quantity, the price the Keeper saw.
 *   3. Room in the bag first. Debiting and then finding nowhere to put the
 *      goods takes the Gold and hands back nothing.
 *   4. Debit. If that fails nothing else has happened.
 *   5. Grant under `vendor:<mutationId>`. `grantStack` is idempotent by that
 *      id. If it refuses after the debit (the save failed, or the bag filled in
 *      between — effectively never) the Gold is refunded rather than
 *      swallowed.
 *
 * Only a settled outcome (ok) is remembered in `settled`. A refused purchase
 * may be retried with the same id once the Keeper has room or Gold.
 */
export function buyFromVendor(
  ledger: VendorLedger,
  intent: VendorIntent,
  settled: Map<string, VendorReceipt>,
): VendorReceipt {
  const prior = intent.mutationId ? settled.get(intent.mutationId) : undefined;
  if (prior) return { ...prior, code: 'replay' };

  const listing = vendorListing(intent.materialId);
  const quantity = Math.floor(intent.quantity);
  const grantId = vendorGrantId(intent.mutationId);
  const receipt = (code: VendorCode, total = 0): VendorReceipt => ({
    ok: code === 'ok', code, mutationId: intent.mutationId, materialId: intent.materialId, quantity, total, grantId,
  });

  if (!intent.mutationId || !listing) return receipt('unknown');
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > VENDOR_MAX_QTY || quantity !== intent.quantity) {
    return receipt('bad-quantity');
  }
  if (listing.price !== intent.expectedUnitPrice) return receipt('stale');

  const total = vendorTotal(listing, quantity);
  if (!ledger.canAccept(listing.materialId)) return receipt('bag-full', total);
  if (ledger.gold() < total || !ledger.spendGold(total, 'material-vendor')) return receipt('funds', total);

  if (!ledger.grantStack(grantId, listing.materialId, quantity)) {
    ledger.refundGold(total, 'material-vendor-refund');
    return receipt('delivery', total);
  }

  const done = receipt('ok', total);
  settled.set(intent.mutationId, done);
  return done;
}

/** A fresh mutation id. `random` is injectable so tests are deterministic. */
export function newVendorMutationId(materialId: string, now: number, random: () => number = Math.random): string {
  return `${materialId}:${now.toString(36)}:${random().toString(36).slice(2, 10)}`;
}
