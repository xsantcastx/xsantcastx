/**
 * refine-ops.ts — C1 Refining: three of one ore tier become one of the next.
 *
 * The recipe table is *derived* from MINING_TIERS' adjacent pairs, not written
 * out again: cinder-ore → slag-fragment → infernal-heartstone. Add a fourth
 * tier to the ladder and it gains a refine recipe for free; the top tier never
 * has one. Nothing in here duplicates an ore id.
 *
 * Refining is a PURE INVENTORY TRANSFORM. It grants no XP, writes nothing to
 * the activity ledger, and never touches ActivityProgressionGateway. It is
 * also NOT gated by mining level: the point is that surplus low-tier ore
 * always converts up, so Cinder Ore keeps a permanent floor value. Holding
 * Slag at mining level 1 unlocks nothing that bypasses a level gate — the
 * material has no use that a level gate protects.
 *
 * Pure module: no Angular, no services. The one writer that applies a preview
 * to the ledger is InventoryService.refineStack.
 */
import { MINING_TIERS } from '../activity/activity.model';

/** How many of the lower tier one unit of the next tier costs. */
export const REFINE_RATIO = 3;

export interface RefineRecipe {
  from: string;
  to: string;
  ratio: number;
}

/**
 * One recipe per adjacent MINING_TIERS pair, in ladder order. The last tier
 * has nowhere to go and gets no entry.
 */
export const REFINE_RECIPES: readonly RefineRecipe[] = MINING_TIERS.slice(0, -1).map((tier, i) => ({
  from: tier.oreId,
  to: MINING_TIERS[i + 1].oreId,
  ratio: REFINE_RATIO,
}));

export function refineRecipeFor(fromOreId: string): RefineRecipe | undefined {
  return REFINE_RECIPES.find(recipe => recipe.from === fromOreId);
}

/** How many whole batches `have` units can fund. Never negative. */
export function maxRefineBatches(have: number, ratio = REFINE_RATIO): number {
  if (!Number.isFinite(have) || have <= 0) return 0;
  return Math.floor(have / ratio);
}

export type RefineReason = 'no-recipe' | 'insufficient' | 'bad-batches';

export interface RefinePreviewInput {
  fromOreId: string;
  /** Units of `fromOreId` currently held. */
  have: number;
  /** Whole batches requested. Defaults to 1. */
  batches?: number;
}

export interface RefinePreview {
  ok: boolean;
  from: string;
  /** Empty string when there is no recipe for `from`. */
  to: string;
  batches: number;
  /** Units of `from` the refine would consume: batches × ratio. */
  consume: number;
  /** Units of `to` the refine would grant: batches. */
  produce: number;
  reason?: RefineReason;
}

/**
 * Pure arithmetic for a refine — what it would consume and produce, or why it
 * cannot run. Bag capacity is not known here; InventoryService checks that
 * separately (and before it consumes anything).
 */
export function refinePreview(input: RefinePreviewInput): RefinePreview {
  const batches = input.batches ?? 1;
  const recipe = refineRecipeFor(input.fromOreId);
  if (!recipe) {
    return { ok: false, from: input.fromOreId, to: '', batches, consume: 0, produce: 0, reason: 'no-recipe' };
  }
  if (!Number.isInteger(batches) || batches < 1) {
    return { ok: false, from: recipe.from, to: recipe.to, batches, consume: 0, produce: 0, reason: 'bad-batches' };
  }
  const consume = batches * recipe.ratio;
  const produce = batches;
  const have = Number.isFinite(input.have) ? input.have : 0;
  if (have < consume) {
    return { ok: false, from: recipe.from, to: recipe.to, batches, consume, produce, reason: 'insufficient' };
  }
  return { ok: true, from: recipe.from, to: recipe.to, batches, consume, produce };
}

/**
 * Deterministic op ids for one refine, so a retry with the same mutation id
 * dedupes to exactly one consume and one grant in the stack-op log.
 */
export function refineOpIds(mutationId: string): { consume: string; grant: string } {
  return { consume: `${mutationId}:refine-consume`, grant: `${mutationId}:refine-grant` };
}
