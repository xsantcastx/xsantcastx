import {
  FLAWLESS_THRESHOLD,
  PERFECT_THRESHOLD,
  QUALITY_BAND,
  bandFor,
  formatQuality,
  gradeFor,
  qualityAdjustedSellValue,
  qualityOf,
  qualityPercent,
  qualityTagOf,
  sellQualityMultiplier,
} from './item-quality';
import { itemDefinitionById, mintEquipment, rollItemStatsWithQuality, statCeiling } from './item-definition';
import { mintCharm } from './item.model';
import type { ItemRarity } from './item.model';

const LADDER: ItemRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'singular'];

describe('roll quality bands', () => {
  it('widens the gamble up to Legendary, then trades width for a high floor', () => {
    const width = (r: ItemRarity) => QUALITY_BAND[r].max - QUALITY_BAND[r].min;
    // Common → Legendary: every rung is a bigger gamble than the one below.
    expect(width('uncommon')).toBeGreaterThan(width('common'));
    expect(width('rare')).toBeGreaterThan(width('uncommon'));
    expect(width('epic')).toBeGreaterThan(width('rare'));
    expect(width('legendary')).toBeGreaterThan(width('epic'));
    // The top two buy a guarantee instead: a floor no lower tier can promise.
    expect(QUALITY_BAND.mythic.min).toBeGreaterThan(QUALITY_BAND.legendary.min);
    expect(QUALITY_BAND.singular.min).toBeGreaterThan(QUALITY_BAND.mythic.min);
    // And pay for it with a ceiling above the tier's own cap.
    expect(QUALITY_BAND.mythic.max).toBeGreaterThan(1);
    expect(QUALITY_BAND.singular.max).toBeGreaterThan(1);
  });

  it('normalises every tier so 100% means "this tier cannot do better"', () => {
    for (const rarity of LADDER) {
      const { min, max } = QUALITY_BAND[rarity];
      expect(qualityPercent(min, rarity)).toBe(0);
      expect(qualityPercent(max, rarity)).toBe(1);
      expect(qualityPercent((min + max) / 2, rarity)).toBeCloseTo(0.5, 6);
    }
  });

  it('clamps a legacy roll that sits outside the current band', () => {
    expect(qualityPercent(-2, 'rare')).toBe(0);
    expect(qualityPercent(99, 'rare')).toBe(1);
  });

  it('widens void-touched work at both ends without moving the midpoint', () => {
    const plain = bandFor('rare', false);
    const voided = bandFor('rare', true);
    expect(voided.min).toBeLessThan(plain.min);
    expect(voided.max).toBeGreaterThan(plain.max);
    expect((voided.min + voided.max) / 2).toBeCloseTo((plain.min + plain.max) / 2, 6);
  });
});

describe('grading an instance', () => {
  it('reports null for an item minted before grading existed', () => {
    expect(qualityOf({})).toBeNull();
    expect(qualityTagOf({})).toBeNull();
    // …and pays exactly sticker, rather than guessing in either direction.
    expect(sellQualityMultiplier({})).toBe(1);
    expect(qualityAdjustedSellValue(1_000, {})).toBe(1_000);
  });

  it('averages every rolled stat unweighted', () => {
    expect(qualityOf({ rollQuality: { goldPerSec: 0.8, ward: 0.4 } })).toBeCloseTo(0.6, 6);
  });

  it('tags Perfect on the average and Flawless only when every stat is maxed', () => {
    expect(qualityTagOf({ rollQuality: { goldPerSec: 0.99, ward: 0.99 } })).toBe('perfect');
    // A maxed primary cannot drag a poor secondary over the line on its own.
    expect(qualityTagOf({ rollQuality: { goldPerSec: 1, ward: 0.5 } })).toBeNull();
    expect(qualityTagOf({ rollQuality: { goldPerSec: 1, ward: 1 } })).toBe('flawless');
    // Flawless outranks Perfect; only the higher tag comes back.
    expect(PERFECT_THRESHOLD).toBeLessThan(FLAWLESS_THRESHOLD);
  });

  it('colours the four grade bands apart', () => {
    const ids = [0.2, 0.6, 0.8, 0.95].map(pct => gradeFor(pct).id);
    expect(ids).toEqual(['poor', 'fair', 'good', 'superb']);
    expect(formatQuality(0.784)).toBe('78%');
  });
});

describe('the till pays for the roll', () => {
  it('prices a dud at half sticker and a maxed roll at one and a half', () => {
    expect(qualityAdjustedSellValue(1_000, { rollQuality: { goldPerSec: 0 } })).toBe(500);
    // 1.0 on a single stat is Flawless, so read the curve just below the tag.
    expect(qualityAdjustedSellValue(1_000, { rollQuality: { goldPerSec: 0.9 } })).toBe(1_400);
  });

  it('jumps rather than continues the curve for Perfect and Flawless', () => {
    const nearMiss = qualityAdjustedSellValue(1_000, { rollQuality: { goldPerSec: 0.94 } });
    const perfect = qualityAdjustedSellValue(1_000, { rollQuality: { goldPerSec: 0.96 } });
    const flawless = qualityAdjustedSellValue(1_000, { rollQuality: { goldPerSec: 1 } });
    expect(perfect).toBe(3_000);
    expect(flawless).toBe(5_000);
    expect(perfect / nearMiss).toBeGreaterThan(2);
  });

  it('never pays for something the till would not take', () => {
    expect(qualityAdjustedSellValue(0, { rollQuality: { goldPerSec: 1 } })).toBe(0);
  });
});

describe('minting carries the grade', () => {
  it('grades every rolled key and only the rolled keys', () => {
    const def = itemDefinitionById('eclipse-longblade')!;
    const rolled = rollItemStatsWithQuality(def, 'rare', () => 0.5);
    expect(Object.keys(rolled.quality).sort()).toEqual(['goldPerSec', 'strikePower']);
    expect(rolled.quality.goldPerSec).toBeCloseTo(0.5, 6);
    expect(rolled.quality.xpBonus).toBeUndefined();
  });

  it('lands a maxed roll on the tier ceiling and a floor roll below it', () => {
    const def = itemDefinitionById('astral-helm')!;
    const ceiling = statCeiling(def, 'epic', 'xpBonus');
    const best = rollItemStatsWithQuality(def, 'epic', () => 1);
    const worst = rollItemStatsWithQuality(def, 'epic', () => 0);
    expect(best.quality.xpBonus).toBe(1);
    expect(best.stats.xpBonus!).toBeCloseTo(Math.round(ceiling * QUALITY_BAND.epic.max * 10) / 10, 6);
    expect(worst.quality.xpBonus).toBe(0);
    expect(worst.stats.xpBonus!).toBeLessThan(best.stats.xpBonus!);
  });

  it('freezes the grade onto the instance and prices it off the grade', () => {
    const dud = mintEquipment('eclipse-longblade', 'rare', () => 0, '2026-08-01T00:00:00.000Z', 'dud')!;
    const god = mintEquipment('eclipse-longblade', 'rare', () => 1, '2026-08-01T00:00:00.000Z', 'god')!;
    expect(qualityOf(dud)).toBe(0);
    expect(qualityOf(god)).toBe(1);
    expect(qualityTagOf(god)).toBe('flawless');
    expect(god.sellValue).toBeGreaterThan(dud.sellValue);
  });

  it('rolls charms against their authored value as a ceiling, never above it', () => {
    const seed = { id: 'c', name: 'C', rarity: 'legendary' as const, stats: { xpBonus: 28 }, weight: 1, lore: '' };
    const best = mintCharm(seed, '2026-08-01T00:00:00.000Z', () => 1);
    const worst = mintCharm(seed, '2026-08-01T00:00:00.000Z', () => 0);
    expect(best.stats.xpBonus).toBe(28);
    expect(best.rollQuality?.xpBonus).toBe(1);
    expect(worst.stats.xpBonus!).toBeLessThan(28);
    expect(worst.rollQuality?.xpBonus).toBe(0);
  });
});
