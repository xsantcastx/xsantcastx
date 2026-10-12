/**
 * anvil.model.spec.ts — the anvil may move a roll up its band, never past it.
 */
import {
  ANVIL_STRIKES,
  anvilBiasRoll,
  anvilExponent,
  anvilPeriod,
  anvilQuality,
  anvilRng,
  anvilVerdict,
  expectedAnvilRoll,
  gradeStrike,
  markerAt,
} from './anvil.model';
import { masteryRng, MASTERY_BONUS, CRAFTING_RECIPES } from '../crafting/crafting.model';
import { itemDefinitionById, mintEquipment, statCeiling } from '../rpg/item-definition';
import { bandFor } from '../rpg/item-quality';

/** A deterministic U[0,1) stream (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('anvil strikes', () => {
  it('grades the centre Perfect, the shoulders Good and the ends Off', () => {
    expect(gradeStrike(0.5)).toBe('perfect');
    expect(gradeStrike(0.55)).toBe('perfect');
    expect(gradeStrike(0.65)).toBe('good');
    expect(gradeStrike(0.35)).toBe('good');
    expect(gradeStrike(0.3)).toBe('off');
    expect(gradeStrike(0.05)).toBe('off');
    expect(gradeStrike(1)).toBe('off');
    expect(gradeStrike(NaN)).toBe('off');
  });

  it('sweeps the marker 0 → 1 → 0 once per period', () => {
    expect(markerAt(0, 1000)).toBe(0);
    expect(markerAt(250, 1000)).toBeCloseTo(0.5, 9);
    expect(markerAt(500, 1000)).toBeCloseTo(1, 9);
    expect(markerAt(1000, 1000)).toBeCloseTo(0, 9);
    for (let t = 0; t < 3000; t += 37) {
      const p = markerAt(t, 1200, 0.3);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it('speeds up per strike but never below the floor', () => {
    expect(anvilPeriod(1)).toBeLessThan(anvilPeriod(0));
    expect(anvilPeriod(99)).toBeGreaterThanOrEqual(900);
  });

  it('scores quality as the mean strike score', () => {
    expect(anvilQuality([])).toBe(0);
    expect(anvilQuality(Array(ANVIL_STRIKES).fill('perfect'))).toBe(1);
    expect(anvilQuality(['perfect', 'off'])).toBeCloseTo(0.575, 9);
    expect(anvilVerdict(1)).toBe('masterful');
    expect(anvilVerdict(0.6)).toBe('fine');
    expect(anvilVerdict(0.2)).toBe('rough');
  });
});

describe('anvil roll bias', () => {
  it('is the identity for a skipped game (quality 0 / null)', () => {
    const base = () => 0.42;
    expect(anvilRng(base, null)).toBe(base);
    expect(anvilRng(base, 0)).toBe(base);
    expect(anvilBiasRoll(0.42, 0)).toBe(0.42);
  });

  it('only ever moves a roll up, and never to 1', () => {
    for (const q of [0.1, 0.5, 1]) {
      for (const r of [0, 0.01, 0.25, 0.5, 0.75, 0.99, 1 - Number.EPSILON, 1, 1.5]) {
        const biased = anvilBiasRoll(r, q);
        expect(biased).toBeGreaterThanOrEqual(Math.min(r, 1 - Number.EPSILON) - 1e-12);
        expect(biased).toBeLessThan(1);
        expect(biased).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('keeps the exponent in [0.8, 1], so a perfect game moves the mean by ≤ 5.6 points', () => {
    expect(anvilExponent(0)).toBe(1);
    expect(anvilExponent(1)).toBeCloseTo(0.8, 12);
    expect(anvilExponent(7)).toBeCloseTo(0.8, 12);
    expect(expectedAnvilRoll(0)).toBeCloseTo(0.5, 12);
    expect(expectedAnvilRoll(1)).toBeCloseTo(1 / 1.8, 12);
    // Empirically, on a seeded stream.
    const rng = anvilRng(seeded(7), 1);
    let sum = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) sum += rng();
    expect(sum / n).toBeCloseTo(1 / 1.8, 2);
  });

  it('composes with mastery and never exceeds the band ceiling', () => {
    const { min, max } = bandFor('legendary');
    const rng = masteryRng(anvilRng(() => 1, 1), MASTERY_BONUS, 'legendary');
    const q = min + rng() * (max - min);
    expect(q).toBeLessThanOrEqual(max + 1e-12);
  });

  it('mints no stat above today\'s ceiling for any rolled recipe, even with a perfect game', () => {
    const rolled = CRAFTING_RECIPES
      .map(r => ({ r, def: itemDefinitionById(r.output.itemId) }))
      .filter(x => x.def && x.def.rollKeys.length > 0);
    expect(rolled.length).toBeGreaterThan(0);
    for (const { r, def } of rolled) {
      const voidTouched = def!.style === 'void' || def!.style === 'void-touched';
      const { max } = bandFor(r.rarity, voidTouched);
      // The best RNG today can return is just under 1.
      const item = mintEquipment(def!.id, r.rarity, anvilRng(() => 1 - Number.EPSILON, 1));
      if (!item) continue;
      for (const key of def!.rollKeys) {
        const ceiling = statCeiling(def!, r.rarity, key);
        if (!ceiling) continue;
        const value = item.stats[key] ?? 0;
        // roundStat may round to a display step; allow one step of slack.
        expect(value).toBeLessThanOrEqual(ceiling * max + 1);
        const grade = item.rollQuality?.[key];
        if (grade != null) expect(grade).toBeLessThanOrEqual(1);
      }
    }
  });
});
