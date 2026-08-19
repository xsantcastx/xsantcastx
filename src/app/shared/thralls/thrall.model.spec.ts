/**
 * thrall.model.spec.ts — the arithmetic that decides whether automation is a
 * shortcut or a sink.
 *
 * Every test here is about a number that, if it drifted, would not throw and
 * would not show up in a screenshot: a share that quietly overtakes the tier
 * above, a stamina cost that rounds to zero, a rest tick that discards its own
 * remainder and never recovers anything.
 */
import {
  BASE_THRALL_SLOTS,
  MAX_STAMINA_COST,
  MAX_THRALLS,
  MAX_THRALL_SLOTS,
  MIN_STAMINA_COST,
  MINUTE_MS,
  RESUME_STAMINA_SHARE,
  THRALL_LOG_MAX,
  THRALL_MAX_LEVEL,
  THRALL_OFFERS,
  THRALL_RARITY_ORDER,
  THRALL_ROLL_COST,
  THRALL_ROLL_MULTIPLIER,
  THRALL_TIERS,
  Thrall,
  awardXp,
  magicFindShareFor,
  maxStaminaFor,
  mintThrall,
  recoverStamina,
  resumeStaminaFor,
  staminaCostFor,
  staminaReliefOf,
  thrallMagicFind,
  thrallTier,
  xpToNext,
} from './thrall.model';
import { STRIKE_COST } from '../rune-forge/rune.model';
import { GameItem } from '../rpg/item.model';
import { levelCap } from '../economy/economy.model';

function item(id: string, stats: GameItem['stats']): GameItem {
  return {
    id, name: id, type: 'charm', rarity: 'rare', stats,
    sellValue: 0, equipped: false, foundAt: '2026-01-01T00:00:00.000Z', soulbound: false,
  };
}

/** A deterministic sequence, so a 1-in-3 branch is reachable in a spec. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(values.length - 1, i++)];
}

describe('thrall.model — the ladder', () => {
  it('prices a pull at a hundred strikes', () => {
    expect(THRALL_ROLL_MULTIPLIER).toBe(100);
    expect(THRALL_ROLL_COST).toBe(STRIKE_COST * 100);
  });

  it('holds the five briefed tiers, and no rung above Legendary', () => {
    expect(THRALL_RARITY_ORDER).toEqual([
      'common', 'uncommon', 'rare', 'epic', 'legendary',
    ]);
  });

  it('walks price, stamina, luck and speed all one way', () => {
    let price = 0;
    let stamina = 0;
    let share = 0;
    let interval = Infinity;
    for (const rarity of THRALL_RARITY_ORDER) {
      const tier = THRALL_TIERS[rarity];
      expect(tier.price).toBeGreaterThan(price);
      expect(tier.baseStamina).toBeGreaterThan(stamina);
      expect(tier.magicFindShare).toBeGreaterThan(share);
      expect(tier.rollInterval).toBeLessThan(interval);
      price = tier.price; stamina = tier.baseStamina;
      share = tier.magicFindShare; interval = tier.rollInterval;
    }
  });

  it('ships the briefed numbers exactly', () => {
    expect(THRALL_TIERS.common).toEqual(jasmine.objectContaining({
      price: 50_000, baseStamina: 100, magicFindShare: 0.5, rollInterval: 30_000,
    }));
    expect(THRALL_TIERS.legendary).toEqual(jasmine.objectContaining({
      price: 25_000_000, baseStamina: 500, magicFindShare: 0.9, rollInterval: 5_000,
    }));
  });

  it('sells one row per tier, derived from the tier table', () => {
    expect(THRALL_OFFERS.length).toBe(THRALL_RARITY_ORDER.length);
    for (const offer of THRALL_OFFERS) {
      expect(offer.id).toBe(`thrall-${offer.rarity}`);
      expect(offer.price).toBe(THRALL_TIERS[offer.rarity].price);
    }
  });
});

describe('thrall.model — levelling', () => {
  it('never lets a capped tier overtake a fresh tier above it', () => {
    // This is the constraint MF_SHARE_PER_LEVEL is chosen against: twenty
    // levels of a Common must stay under a brand new Uncommon, or the ladder
    // stops being a ladder and buying up is a waste of Gold.
    for (let i = 0; i < THRALL_RARITY_ORDER.length - 1; i++) {
      const below = magicFindShareFor(THRALL_RARITY_ORDER[i], THRALL_MAX_LEVEL);
      const above = magicFindShareFor(THRALL_RARITY_ORDER[i + 1], 1);
      expect(below).toBeLessThan(above);
    }
  });

  it('grows max stamina with level and never shrinks it', () => {
    expect(maxStaminaFor('common', 1)).toBe(100);
    expect(maxStaminaFor('common', 20)).toBe(100 + 19 * 5);
    // Out-of-range levels clamp rather than producing a negative pool.
    expect(maxStaminaFor('common', 0)).toBe(100);
    expect(maxStaminaFor('common', 999)).toBe(maxStaminaFor('common', 20));
  });

  it('spends XP one rung at a time and keeps the remainder', () => {
    const fresh = mintThrall('common', () => 0.5, 1_000);
    const first = xpToNext(1);
    const settled = awardXp(fresh, first + 3);
    expect(settled.level).toBe(2);
    expect(settled.xp).toBe(3);
  });

  it('can climb more than one level on a single award', () => {
    const fresh = mintThrall('common', () => 0.5, 1_000);
    const settled = awardXp(fresh, xpToNext(1) + xpToNext(2) + xpToNext(3));
    expect(settled.level).toBeGreaterThanOrEqual(4);
  });

  it('hands the new stamina over on the level, not on the next rest', () => {
    const fresh = mintThrall('common', () => 0.5, 1_000);
    const tired = { ...fresh, stamina: 40 };
    const settled = awardXp(tired, xpToNext(1));
    expect(settled.maxStamina).toBe(105);
    expect(settled.stamina).toBe(45);
  });

  it('stops at the cap and banks no XP beyond it', () => {
    const fresh = mintThrall('legendary', () => 0.5, 1_000);
    const capped = awardXp(fresh, 10_000_000);
    expect(capped.level).toBe(THRALL_MAX_LEVEL);
    expect(capped.xp).toBe(0);
    // A further award changes nothing at all.
    expect(awardXp(capped, 500)).toBe(capped);
  });
});

describe('thrall.model — stamina', () => {
  it('costs between one and three before gear', () => {
    for (const roll of [0, 0.34, 0.67, 0.999]) {
      const cost = staminaCostFor(0, () => roll);
      expect(cost).toBeGreaterThanOrEqual(MIN_STAMINA_COST);
      expect(cost).toBeLessThanOrEqual(MAX_STAMINA_COST);
    }
  });

  it('never lets Ward make a pull free', () => {
    // Ten Ward is well past the cap; the cost still has to be a real point, or
    // a Thrall never rests and the Gold burn is unbounded.
    expect(staminaReliefOf(1_000)).toBe(0.5);
    for (const roll of [0, 0.5, 0.99]) {
      expect(staminaCostFor(1_000, () => roll)).toBeGreaterThanOrEqual(MIN_STAMINA_COST);
    }
  });

  it('treats a missing or nonsense Ward as none', () => {
    expect(staminaReliefOf(NaN)).toBe(0);
    expect(staminaReliefOf(-9)).toBe(0);
  });

  it('carries the leftover milliseconds rather than discarding them', () => {
    // The bug this exists to stop: crediting floor(elapsed / 60000) and then
    // stamping lastRestAt = now throws away up to 59s every tick, so at a
    // one-second heartbeat a Thrall recovers nothing, ever.
    const under = recoverStamina(59_000, 10, 100);
    expect(under).toEqual({ stamina: 10, consumedMs: 0 });

    const over = recoverStamina(90_000, 10, 100);
    expect(over.stamina).toBe(11);
    expect(over.consumedMs).toBe(MINUTE_MS);
  });

  it('never recovers past the pool', () => {
    const full = recoverStamina(100 * MINUTE_MS, 95, 100);
    expect(full.stamina).toBe(100);
  });

  it('resumes at a fifth of the pool, and never below one point', () => {
    expect(resumeStaminaFor({ maxStamina: 500 })).toBe(500 * RESUME_STAMINA_SHARE);
    expect(resumeStaminaFor({ maxStamina: 1 })).toBe(1);
  });
});

describe('thrall.model — magic find', () => {
  const byId = (id: string) => ({
    'mf-charm': item('mf-charm', { magicFind: 40 }),
    'loot-charm': item('loot-charm', { lootBonus: 25 }),
  } as Record<string, GameItem>)[id];

  const base: Pick<Thrall, 'rarity' | 'level' | 'equipment'> = {
    rarity: 'common', level: 1, equipment: {},
  };

  it('scales the Keeper own luck by the tier share', () => {
    expect(thrallMagicFind(base, 200, byId)).toBe(100);
    expect(thrallMagicFind({ ...base, rarity: 'legendary' }, 200, byId)).toBe(180);
  });

  it('does not tax the points the Keeper handed over', () => {
    // A charm taken off your own body and given to a Thrall has to pay its face
    // value there, or equipping one is strictly worse than not.
    const geared = { ...base, equipment: { charm: 'mf-charm' } };
    expect(thrallMagicFind(geared, 200, byId)).toBe(100 + 40);
  });

  it('counts lootBonus as magic find, the way an explorer does', () => {
    const geared = { ...base, equipment: { weapon: 'loot-charm' } };
    expect(thrallMagicFind(geared, 0, byId)).toBe(25);
  });

  it('floors at zero rather than passing a negative to the drop table', () => {
    expect(thrallMagicFind(base, -50, byId)).toBe(0);
    expect(thrallMagicFind(base, NaN, byId)).toBe(0);
  });
});

describe('thrall.model — minting', () => {
  it('starts rested, idle and level one', () => {
    const t = mintThrall('rare', () => 0.5, 42);
    expect(t.level).toBe(1);
    expect(t.status).toBe('idle');
    expect(t.stamina).toBe(t.maxStamina);
    expect(t.maxStamina).toBe(THRALL_TIERS.rare.baseStamina);
    expect(t.rollInterval).toBe(THRALL_TIERS.rare.rollInterval);
    expect(t.totalRolls).toBe(0);
    expect(t.equipment).toEqual({});
  });

  it('gives Epic and Legendary a title, and the lower tiers none', () => {
    expect(mintThrall('common', () => 0.5, 1).name).not.toContain(' ');
    expect(mintThrall('legendary', () => 0.5, 1).name).toContain(' ');
  });

  it('mints unique ids inside one millisecond', () => {
    const ids = new Set([
      mintThrall('common', seq([0.1]), 1_000).id,
      mintThrall('common', seq([0.2]), 1_000).id,
      mintThrall('common', seq([0.3]), 1_000).id,
    ]);
    expect(ids.size).toBe(3);
  });
});

/**
 * The two ceilings are written down in three files — the model, the eager
 * cloud-save registry (which cannot import a lazy chunk to read them) and the
 * `thrall-slot` level cap in `economy.model.ts`. These are the assertions those
 * copies are kept honest by.
 */
describe('thrall.model — the ceilings other files copy', () => {
  it('pins the roster and log caps the cloud-save merge mirrors', () => {
    expect(MAX_THRALLS).toBe(16);
    expect(THRALL_LOG_MAX).toBe(40);
  });

  it('pins the slot ladder the Market prices', () => {
    expect(BASE_THRALL_SLOTS).toBe(5);
    expect(MAX_THRALL_SLOTS).toBe(10);
    // `LEVEL_CAPS['thrall-slot']` in economy.model.ts is this difference. A
    // retune of either constant that forgets that file leaves a rung the
    // Market will sell and the service will never honour.
    expect(levelCap('thrall-slot')).toBe(MAX_THRALL_SLOTS - BASE_THRALL_SLOTS);
  });

  it('keeps every tier reachable from thrallTier, including nonsense', () => {
    for (const rarity of THRALL_RARITY_ORDER) {
      expect(thrallTier(rarity).id).toBe(rarity);
    }
    expect(thrallTier('nope' as never)).toBe(THRALL_TIERS.common);
  });
});
