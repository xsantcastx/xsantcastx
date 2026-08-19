import {
  CINDER_ORE_ID,
  INFERNAL_HEARTSTONE_ID,
  MINING_TIERS,
  SLAG_FRAGMENT_ID,
} from '../activity/activity.model';
import {
  REFINE_RATIO,
  REFINE_RECIPES,
  maxRefineBatches,
  refineOpIds,
  refinePreview,
  refineRecipeFor,
} from './refine-ops';

describe('C1 refine ops', () => {
  it('derives one 3:1 recipe per adjacent MINING_TIERS pair, in ladder order', () => {
    expect(REFINE_RATIO).toBe(3);
    expect(REFINE_RECIPES.length).toBe(MINING_TIERS.length - 1);
    expect(REFINE_RECIPES.map(r => `${r.ratio}:${r.from}->${r.to}`)).toEqual([
      `3:${CINDER_ORE_ID}->${SLAG_FRAGMENT_ID}`,
      `3:${SLAG_FRAGMENT_ID}->${INFERNAL_HEARTSTONE_ID}`,
    ]);
    expect(refineRecipeFor(CINDER_ORE_ID)?.to).toBe(SLAG_FRAGMENT_ID);
    expect(refineRecipeFor(SLAG_FRAGMENT_ID)?.to).toBe(INFERNAL_HEARTSTONE_ID);
    // The top of the ladder has nowhere to go.
    expect(refineRecipeFor(INFERNAL_HEARTSTONE_ID)).toBeUndefined();
  });

  it('previews 3 → 1 per batch and scales with the batch count', () => {
    const one = refinePreview({ fromOreId: CINDER_ORE_ID, have: 4 });
    expect(one).toEqual({ ok: true, from: CINDER_ORE_ID, to: SLAG_FRAGMENT_ID, batches: 1, consume: 3, produce: 1 });
    const two = refinePreview({ fromOreId: CINDER_ORE_ID, have: 6, batches: 2 });
    expect(two.ok).toBe(true);
    expect(two.consume).toBe(6);
    expect(two.produce).toBe(2);
  });

  it('refuses insufficient ore, an unknown source, and a bad batch count', () => {
    const short = refinePreview({ fromOreId: CINDER_ORE_ID, have: 2 });
    expect(short.ok).toBe(false);
    expect(short.reason).toBe('insufficient');
    expect(short.consume).toBe(3);

    const top = refinePreview({ fromOreId: INFERNAL_HEARTSTONE_ID, have: 99 });
    expect(top.ok).toBe(false);
    expect(top.reason).toBe('no-recipe');

    expect(refinePreview({ fromOreId: CINDER_ORE_ID, have: 9, batches: 0 }).reason).toBe('bad-batches');
    expect(refinePreview({ fromOreId: CINDER_ORE_ID, have: 9, batches: 1.5 }).reason).toBe('bad-batches');
    expect(refinePreview({ fromOreId: CINDER_ORE_ID, have: 9, batches: NaN }).reason).toBe('bad-batches');
    expect(refinePreview({ fromOreId: CINDER_ORE_ID, have: 9, batches: -1 }).reason).toBe('bad-batches');
  });

  it('counts whole batches only', () => {
    expect(maxRefineBatches(0)).toBe(0);
    expect(maxRefineBatches(2)).toBe(0);
    expect(maxRefineBatches(3)).toBe(1);
    expect(maxRefineBatches(8)).toBe(2);
    expect(maxRefineBatches(9)).toBe(3);
    expect(maxRefineBatches(-3)).toBe(0);
    expect(maxRefineBatches(NaN)).toBe(0);
  });

  it('derives stable op ids from the mutation id', () => {
    expect(refineOpIds('m1')).toEqual({ consume: 'm1:refine-consume', grant: 'm1:refine-grant' });
    expect(refineOpIds('m1')).toEqual(refineOpIds('m1'));
  });
});
