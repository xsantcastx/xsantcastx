import {
  AFFIX_DEFS,
  RESIST_CAP,
  AFFIX_KEYS,
  AFFIX_RARITY_MULT,
  IMPLICIT_BY_SLOT,
  AFFIX_FAMILIES,
  FAMILY_RULES,
  affixFamilyOf,
  familyRolls,
  affixCountFor,
  affixPoolFor,
  affixRange,
  rollAffixes,
  type AffixFamily,
  type AffixSlot,
} from './item-affixes';
import { RARITY_MULT, mintEquipment, rollsAffixes, itemDefinitionById } from './item-definition';
import { qualityTagOf } from './item-quality';
import type { ItemRarity } from './item.model';

const RARITIES: ItemRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'singular'];
const SLOTS: AffixSlot[] = ['weapon', 'head', 'chest', 'hands', 'legs', 'feet', 'off-hand', 'trinket'];

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

describe('item-affixes (every item is a roll)', () => {
  it('counts affixes by rarity: 0 / 1 / 2 / 3 / 4 / 5 / 5', () => {
    expect(RARITIES.map(affixCountFor)).toEqual([0, 1, 2, 3, 4, 5, 5]);
  });

  it('keeps its rarity multipliers equal to RARITY_MULT ceilings', () => {
    for (const r of RARITIES) expect(AFFIX_RARITY_MULT[r]).withContext(r).toBe(RARITY_MULT[r][1]);
  });

  it('rolls the implicit plus min(count, pool) affixes, never repeating, all from the slot pool', () => {
    for (const slot of SLOTS) {
      const pool = affixPoolFor(slot);
      for (const rarity of RARITIES) {
        for (let seed = 1; seed <= 40; seed++) {
          const roll = rollAffixes({ slot }, rarity, 20, seeded(seed));
          // The flat pair is one affix: its high end rides with its low end.
          const keys = Object.keys(roll.stats).filter(k => k !== 'maxDamage');
          expect(roll.implicit).toBe(IMPLICIT_BY_SLOT[slot]);
          expect(keys).toContain(IMPLICIT_BY_SLOT[slot]);
          expect(new Set(keys).size).toBe(keys.length);
          expect(keys.length).withContext(`${slot} ${rarity}`).toBe(1 + Math.min(affixCountFor(rarity), pool.length - 1));
          for (const k of keys) expect(pool).withContext(`${slot} rolled ${k}`).toContain(k as never);
        }
      }
    }
  });

  it('rolls Movement Speed on feet only', () => {
    expect(FAMILY_RULES.armour.only?.moveSpeed).toEqual(['feet']);
    for (const slot of SLOTS.filter(s => s !== 'feet')) {
      expect(affixPoolFor(slot)).not.toContain('moveSpeed');
      expect(affixRange('moveSpeed', slot, 30, 'mythic')).toEqual([0, 0]);
      for (let seed = 1; seed <= 30; seed++) {
        expect(rollAffixes({ slot }, 'mythic', 30, seeded(seed)).stats.moveSpeed).toBeUndefined();
      }
    }
    // The feet pool shares its draws with the resists (§6), so look across seeds rather than at one.
    const rolled = Array.from({ length: 30 }, (_, i) => rollAffixes({ slot: 'feet' }, 'legendary', 10, seeded(i + 1)).stats.moveSpeed ?? 0);
    expect(rolled.filter(v => v > 0).length).toBeGreaterThan(5);
  });

  it('grows ranges with item level and with rarity', () => {
    for (const key of AFFIX_KEYS) {
      const family = AFFIX_FAMILIES.find(f => familyRolls(f, key))!;
      const slot = { family, slot: FAMILY_RULES[family].only?.[key]?.[0] ?? null };
      if (key === 'skillRanks') continue; // whole ranks: a range of 1–2 does not grow by a rank every few levels
      const low = affixRange(key, slot, 1, 'rare');
      const high = affixRange(key, slot, 60, 'rare');
      expect(high[0]).withContext(key).toBeGreaterThan(low[0]);
      expect(high[1]).withContext(key).toBeGreaterThan(low[1]);
      let prev = affixRange(key, slot, 40, 'common');
      for (const rarity of RARITIES.slice(1)) {
        const next = affixRange(key, slot, 40, rarity);
        expect(next[1]).withContext(`${key} ${rarity}`).toBeGreaterThan(prev[1]);
        prev = next;
      }
    }
    // The table at item level 1, common: Life 4–8, Defense 2–5.
    expect(affixRange('life', 'chest', 1, 'common')).toEqual([4, 8]);
    expect(affixRange('defense', 'chest', 1, 'common')).toEqual([2, 5]);
    // Growth: Defense +0.8 a level, ×1.35 at rare → item level 11 rare = [13.5, 17.55] → [14, 18].
    expect(affixRange('defense', 'head', 11, 'rare')).toEqual([14, 18]);
  });

  it('grades each roll as its position in the range, and keeps the value inside it', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const roll = rollAffixes({ slot: 'trinket' }, 'epic', 25, seeded(seed));
      for (const [key, value] of Object.entries(roll.stats)) {
        const k = key as (typeof AFFIX_KEYS)[number];
        const [lo, hi] = affixRange(k, 'trinket', 25, 'epic');
        const grade = roll.quality[k]!;
        expect(grade).toBeGreaterThanOrEqual(0);
        expect(grade).toBeLessThanOrEqual(1);
        expect(value).toBeGreaterThanOrEqual(lo);
        expect(value).toBeLessThanOrEqual(hi);
        // Position: the rounded value sits near lo + grade × (hi − lo).
        const tolerance = 10 ** -AFFIX_DEFS[k].decimals;
        expect(Math.abs(value - (lo + grade * (hi - lo)))).withContext(k).toBeLessThanOrEqual(tolerance + 1e-9);
      }
    }
    // An rng that always says 1 gives a top roll on every line, graded 1.
    const top = rollAffixes({ slot: 'weapon' }, 'rare', 10, () => 0.999999999);
    for (const g of Object.values(top.quality)) expect(g!).toBeGreaterThan(0.999);
    const bottom = rollAffixes({ slot: 'weapon' }, 'rare', 10, () => 0);
    for (const g of Object.values(bottom.quality)) expect(g).toBe(0);
  });

  it('is deterministic with a seeded rng', () => {
    const a = rollAffixes({ slot: 'head' }, 'legendary', 33, seeded(1234));
    const b = rollAffixes({ slot: 'head' }, 'legendary', 33, seeded(1234));
    expect(a).toEqual(b);
    const c = rollAffixes({ slot: 'head' }, 'legendary', 33, seeded(4321));
    expect(c).not.toEqual(a);
  });

  it('returns nothing for a definition with no gear slot', () => {
    expect(rollAffixes({}, 'epic', 10, seeded(1))).toEqual({ stats: {}, quality: {}, implicit: null, family: null });
    expect(rollAffixes({ slot: 'charm1' }, 'epic', 10, seeded(1)).implicit).toBeNull();
  });

  describe('mintEquipment', () => {
    it('mints gear with an item level, an implicit and affixes, and no Gold/sec, Strike or Ward', () => {
      const item = mintEquipment('keepers-mantle', 'epic', seeded(9), '2026-10-20T00:00:00Z', 'x', 17)!;
      expect(item.itemLevel).toBe(17);
      expect(item.stats.defense).toBeGreaterThan(0);
      expect(item.stats.goldPerSec).toBeUndefined();
      expect(item.stats.ward).toBeUndefined();
      expect(item.stats.strikePower).toBeUndefined();
      for (const key of Object.keys(item.stats)) expect(item.rollQuality![key as 'defense']).toBeDefined();
    });

    it('rolls Magic Find and XP only as affixes, never off the definition\'s old list', () => {
      const item = mintEquipment('keepers-cowl', 'rare', seeded(3))!;
      expect(item.itemLevel).toBe(10);
      expect(item.stats.defense).toBeGreaterThan(0);
      // implicit + 2 affixes for a rare, nothing else
      expect(Object.keys(item.stats).length).toBe(3);
    });

    it('gives every family (in every slot it fills) a pool deep enough for a mythic\'s five affixes', () => {
      for (const family of AFFIX_FAMILIES) for (const slot of SLOTS) {
        const pool = affixPoolFor({ family, slot });
        expect(pool.filter(k => k !== FAMILY_RULES[family].implicit).length).withContext(`${family} ${slot}`).toBeGreaterThanOrEqual(5);
      }
    });

    it('leaves the Forge edge and tools on their own rolls', () => {
      expect(rollsAffixes(itemDefinitionById('basalt-edge')!)).toBeFalse();
      const edge = mintEquipment('basalt-edge', 'uncommon', seeded(2))!;
      expect(edge.stats.strikePower).toBeGreaterThan(0);
      expect(edge.itemLevel).toBeUndefined();
      const tool = mintEquipment('starter-pickaxe', 'common', seeded(2))!;
      expect(tool.stats).toEqual({});
    });

    it('clamps the item level to 1..99', () => {
      expect(mintEquipment('astral-helm', 'common', seeded(1), undefined, undefined, 500)!.itemLevel).toBe(99);
      expect(mintEquipment('astral-helm', 'common', seeded(1), undefined, undefined, -3)!.itemLevel).toBe(1);
    });

    it('names a top roll Flawless', () => {
      const item = mintEquipment('anchor-ring', 'rare', () => 0.9999999, undefined, undefined, 5)!;
      expect(qualityTagOf(item)).toBe('flawless');
    });
  });

  describe('resist affixes (§6)', () => {
    const ELEMENT_KEYS = ['fireResist', 'coldResist', 'lightningResist', 'arcaneResist'] as const;
    const WARDED: AffixSlot[] = ['head', 'chest', 'hands', 'legs', 'feet', 'off-hand', 'trinket'];

    it('rolls each element on armour, shields, quivers and rings, never on a weapon or a focus; All Resist on rings only', () => {
      for (const key of ELEMENT_KEYS) {
        for (const slot of WARDED) expect(affixPoolFor(slot)).withContext(`${key} ${slot}`).toContain(key);
        for (const f of ['caster', 'martial', 'bow', 'focus'] as AffixFamily[]) expect(familyRolls(f, key)).withContext(`${key} ${f}`).toBeFalse();
        expect(affixPoolFor('weapon')).not.toContain(key);
        expect(affixRange(key, 'weapon', 40, 'mythic')).toEqual([0, 0]);
      }
      expect(AFFIX_FAMILIES.filter(f => familyRolls(f, 'allResist'))).toEqual(['jewel']);
      for (const slot of SLOTS.filter(s => s !== 'trinket')) expect(affixPoolFor(slot)).withContext(slot).not.toContain('allResist');
      for (let seed = 1; seed <= 60; seed++) {
        const weapon = rollAffixes({ slot: 'weapon' }, 'singular', 60, seeded(seed)).stats;
        for (const key of [...ELEMENT_KEYS, 'allResist'] as const) expect(weapon[key]).toBeUndefined();
      }
    });

    it('ranges 3–6% at item level 1 (All Resist 2–4%), growing 0.15 a level (0.08), times the rarity', () => {
      for (const key of ELEMENT_KEYS) {
        expect(affixRange(key, 'chest', 1, 'common')).withContext(key).toEqual([3, 6]);
        // Item level 21 legendary: (3 + 3) × 1.8 = 10.8 → 11, (6 + 3) × 1.8 = 16.2 → 16.
        expect(affixRange(key, 'feet', 21, 'legendary')).withContext(key).toEqual([11, 16]);
      }
      expect(affixRange('allResist', 'trinket', 1, 'common')).toEqual([2, 4]);
      // Smaller than any one element's range at the same level and rarity.
      expect(affixRange('allResist', 'trinket', 50, 'mythic')[1]).toBeLessThan(affixRange('fireResist', 'trinket', 50, 'mythic')[1]);
    });

    it('caps every resist\'s worn total at 75 (the Keeper\'s ceiling), and rolls whole percents inside the range', () => {
      expect(RESIST_CAP).toBe(75);
      for (const key of [...ELEMENT_KEYS, 'allResist'] as const) {
        expect(AFFIX_DEFS[key].cap).withContext(key).toBe(75);
        expect(AFFIX_DEFS[key].decimals).toBe(0);
      }
      let seen = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const roll = rollAffixes({ slot: 'trinket' }, 'mythic', 45, seeded(seed));
        for (const key of [...ELEMENT_KEYS, 'allResist'] as const) {
          const v = roll.stats[key];
          if (v === undefined) continue;
          seen++;
          const [lo, hi] = affixRange(key, 'trinket', 45, 'mythic');
          expect(Number.isInteger(v)).toBeTrue();
          expect(v).toBeGreaterThanOrEqual(lo);
          expect(v).toBeLessThanOrEqual(hi);
        }
      }
      expect(seen).toBeGreaterThan(50);
    });
  });
});
