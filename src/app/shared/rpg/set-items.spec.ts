/**
 * set-items.spec.ts — the four item sets (design-bible §7.4): the pieces, the drop gate, the tiers counting what is worn,
 * and the old items that must load exactly as before.
 */
import {
  ITEM_SETS, SET_CHANCE, SET_PIECES, activeBonuses, addSetBonuses, chestSetPiece, chestsHolding, isSetPiece, rollSetPiece,
  setCounts, setForKill, setOfPiece, setSigIds, setSigOf,
} from './set-items';
import { UNIQUE_ITEMS, uniqueById, uniquesAtRarity } from './unique-items';
import { ITEM_DEFINITIONS, mintEquipment } from './item-definition';
import { DROP_POOL, rollCreatureLoot, uniquesAt } from '../loot/drop-tables';
import { MYSTERY_BOXES, boxPool, rollBox } from '../gambler/mystery-box';
import { itemIcon } from '../art/item-icons';
import { LOOT_TIER_ORDER } from '../loot/loot-tiers';
import { relicTotals } from './boss-uniques';
import type { ItemStats } from './item.model';

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const ids = (setId: string, n: number): string[] => ITEM_SETS.find(s => s.id === setId)!.pieces.slice(0, n);

describe('item sets: the four', () => {
  it('four sets of 3-5 pieces, each in different slots, mythic, with lore, a tier at 2, 3 and the full count', () => {
    expect(ITEM_SETS.length).toBe(4);
    for (const s of ITEM_SETS) {
      expect(s.pieces.length).withContext(s.id).toBeGreaterThanOrEqual(3);
      expect(s.pieces.length).withContext(s.id).toBeLessThanOrEqual(5);
      const pieces = s.pieces.map(id => SET_PIECES.find(p => p.id === id)!);
      expect(pieces.every(p => !!p && p.set === s.id)).withContext(s.id).toBeTrue();
      expect(new Set(pieces.map(p => p.slot)).size).withContext(`${s.id} slots`).toBe(pieces.length);
      for (const p of pieces) {
        expect(p.rarity).withContext(p.id).toBe('mythic');
        expect(p.lore.length).withContext(p.id).toBeGreaterThan(30);
      }
      expect(s.bonuses.map(b => b.at)).withContext(s.id).toEqual([2, 3, s.pieces.length]);
      for (const b of s.bonuses) expect(!!(b.stats || b.defensePct || b.sig)).withContext(`${s.id} ${b.at}`).toBeTrue();
    }
    expect(SET_PIECES.length).toBe(16);
  });

  it('the pieces are named objects like every unique: UNIQUE_ITEMS, ITEM_DEFINITIONS, mintable at mythic, with an icon', () => {
    for (const p of SET_PIECES) {
      expect(uniqueById(p.id)).withContext(p.id).toBe(p);
      expect(isSetPiece(p.id)).toBeTrue();
      expect(setOfPiece(p.id)?.id).toBe(p.set);
      expect(ITEM_DEFINITIONS.find(d => d.id === p.id)?.family).withContext(p.id).toBe('equipment');
      const item = mintEquipment(p.id, 'mythic', seeded(1), undefined, undefined, 30);
      expect(item?.definitionId).withContext(p.id).toBe(p.id);
      expect(item?.rarity).toBe('mythic');
      expect(Object.keys(item?.stats ?? {}).length).withContext(p.id).toBeGreaterThan(1);
      expect(itemIcon(p.id)?.src).withContext(p.id).toContain('data:image/svg+xml');
    }
  });
});

describe('item sets: the drop gate', () => {
  it('never in an open pool: no rung of the unique roll, the Gambler or the ordinary drop pool', () => {
    const set = new Set(SET_PIECES.map(p => p.id));
    for (const tier of LOOT_TIER_ORDER) {
      expect(uniquesAtRarity(tier).some(u => set.has(u.id))).withContext(tier).toBeFalse();
      expect(uniquesAt(tier).some(u => set.has(u.id))).withContext(tier).toBeFalse();
      expect(boxPool(tier).some(d => set.has(d.id))).withContext(tier).toBeFalse();
    }
    expect(DROP_POOL.some(d => set.has(d.id))).toBeFalse();
    const rng = seeded(9);
    for (const box of MYSTERY_BOXES) for (let i = 0; i < 400; i++) {
      const r = rollBox(box, {}, rng);
      if (r) expect(set.has(r.definitionId)).withContext(box.id).toBeFalse();
    }
  });

  it('only a set\'s own creatures drop it, and only from the set\'s level', () => {
    const rng = seeded(3);
    for (let i = 0; i < 1500; i++) {
      for (const creature of ['lava-hound', 'bone-walker', 'obsidian-golem', 'ink-abbess-x']) {
        for (const rank of ['normal', 'champion', 'unique', 'boss'] as const) {
          const drops = rollCreatureLoot({ creature, level: 60, tier: 'normal', magicFind: 300, rank }, rng);
          expect(drops.some(d => d.kind === 'item' && isSetPiece(d.definitionId))).withContext(`${creature} ${rank}`).toBeFalse();
        }
      }
      // A set creature below the set's level (an ash-ghoul at level 3): never.
      const low = rollCreatureLoot({ creature: 'ash-ghoul', level: 3, tier: 'normal', magicFind: 300, rank: 'boss' }, rng);
      expect(low.some(d => d.kind === 'item' && isSetPiece(d.definitionId))).toBeFalse();
    }
    expect(setForKill('ash-ghoul', 3)).toBeUndefined();
    expect(setForKill('ash-ghoul', 9)?.id).toBe('ossuary-watch');
    expect(rollSetPiece({ creature: 'lava-hound', level: 40, rank: 'boss', magicFind: 0 }, () => 0)).toBeNull();
  });

  it('a set creature drops a piece of its own set only, at about its rank\'s chance, unique and mythic', () => {
    for (const set of ITEM_SETS) for (const creature of set.source.creatures) for (const rank of ['normal', 'boss'] as const) {
      const rng = seeded(21), n = 8000;
      let got = 0;
      for (let i = 0; i < n; i++) {
        for (const d of rollCreatureLoot({ creature, level: 60, tier: 'normal', magicFind: 0, rank }, rng)) {
          if (d.kind !== 'item' || !isSetPiece(d.definitionId)) continue;
          expect(set.pieces).withContext(creature).toContain(d.definitionId);
          expect(d.unique).toBeTrue();
          expect(d.rarity).toBe('mythic');
          got++;
        }
      }
      expect(Math.abs(got / n - SET_CHANCE[rank])).withContext(`${creature} ${rank}`).toBeLessThan(.02);
    }
  });

  it('the roll is its chance exactly, and Magic Find leans it', () => {
    const ctx = { creature: 'ash-ghoul', level: 20, rank: 'normal' as const, magicFind: 0 };
    expect(rollSetPiece(ctx, () => SET_CHANCE.normal - 1e-9)).not.toBeNull();
    expect(rollSetPiece(ctx, () => SET_CHANCE.normal)).toBeNull();
    expect(rollSetPiece({ ...ctx, magicFind: 100 }, () => SET_CHANCE.normal * 1.4)).not.toBeNull();
  });

  it('the Lamplighter lies in the shade chests: one piece to a chest, and the last chest holds any', () => {
    expect(chestSetPiece('galleries', () => 0)?.id).toBe('set-lamplighter-lantern');
    expect(chestSetPiece('bone-hall', () => 0)?.id).toBe('set-lamplighter-coat');
    expect(chestSetPiece('smithies', () => 0)?.id).toBe('set-lamplighter-gloves');
    expect(chestSetPiece('sporewell', () => 0)?.id).toBe('set-lamplighter-signet');
    const any = new Set<string>();
    for (let i = 0; i < 40; i++) any.add(chestSetPiece('cloister', seeded(i))!.id);
    expect(any.size).toBeGreaterThan(1);
    expect(chestSetPiece('nowhere', () => 0)).toBeNull();
    for (const p of SET_PIECES.filter(x => x.set === 'lamplighters-things')) expect(chestsHolding(p).length).withContext(p.id).toBeGreaterThan(0);
  });
});

describe('item sets: tiers count the pieces worn', () => {
  it('2 / 3 / full light in turn, cumulatively, and one piece lights nothing', () => {
    for (const s of ITEM_SETS) {
      expect(activeBonuses(ids(s.id, 1)).length).withContext(s.id).toBe(0);
      expect(activeBonuses(ids(s.id, 2)).map(a => a.bonus.at)).toEqual([2]);
      expect(activeBonuses(ids(s.id, 3)).map(a => a.bonus.at)).toEqual([2, 3]);
      expect(activeBonuses(ids(s.id, s.pieces.length)).map(a => a.bonus.at)).toEqual([2, 3, s.pieces.length]);
    }
  });

  it('a double of one piece counts once; other gear and unknown ids count for nothing; sets do not mix', () => {
    const w = ids('ossuary-watch', 1);
    expect(setCounts([...w, ...w, 'unique-tinders-due', 'nonsense']).get('ossuary-watch')).toBe(1);
    const mixed = [...ids('ossuary-watch', 1), ...ids('rootcradle', 1)];
    expect(activeBonuses(mixed).length).toBe(0);
    const both = [...ids('ossuary-watch', 2), ...ids('rootcradle', 2)];
    expect(activeBonuses(both).map(a => a.set.id)).toEqual(['ossuary-watch', 'rootcradle']);
  });

  it('flat stats and a share of Defense are added to the worn totals; no set worn returns them untouched', () => {
    const gear: Partial<ItemStats> = { defense: 100, life: 10 };
    expect(addSetBonuses(gear, [])).toBe(gear);
    expect(addSetBonuses(gear, ['unique-tinders-due'])).toBe(gear);
    expect(addSetBonuses(gear, ids('ossuary-watch', 2)).defense).toBe(110);
    const full = addSetBonuses(gear, ids('ossuary-watch', 4));
    expect(full.defense).toBe(110);
    expect(full.spellDamage).toBe(10);
    const roots = addSetBonuses(gear, ids('rootcradle', 4));
    expect(roots.lifeRegen).toBe(1.5);
    expect(roots.life).toBe(40);
    expect(roots.allResist).toBe(10);
  });

  it('signature tiers are named ids the fight resolves through relicTotals', () => {
    expect(setSigIds(ids('lamplighters-things', 1))).toEqual([]);
    expect(setSigIds(ids('lamplighters-things', 2))).toEqual(['set:lamplighters-things:2']);
    const all = setSigIds(ids('lamplighters-things', 4));
    expect(relicTotals(all, setSigOf).light).toBe(4);
    expect(relicTotals(all, setSigOf).mf).toBe(10);
    expect(relicTotals(all).light).withContext('without the resolver they are unknown ids').toBe(0);
    expect(setSigOf('set:nonsense:2')).toBeUndefined();
    expect(setSigOf('unique-tinders-due')).toBeUndefined();
  });
});

describe('item sets: old items still load', () => {
  it('the fifty-two uniques before the sets are all still there with no set tag, and no set piece appears in a legacy id list', () => {
    const before = UNIQUE_ITEMS.filter(u => !u.set);
    expect(before.length).toBe(52);
    expect(before.every(u => !u.set)).toBeTrue();
    expect(UNIQUE_ITEMS.length).toBe(52 + SET_PIECES.length);
    expect(isSetPiece('unique-tinders-due')).toBeFalse();
    expect(isSetPiece(undefined)).toBeFalse();
    expect(setOfPiece('ember-helm')).toBeUndefined();
  });

  it('an item saved with no definition id, or one the sets never heard of, counts for nothing and breaks nothing', () => {
    expect(setCounts([]).size).toBe(0);
    expect(activeBonuses(['', 'astral-helm', 'removed-in-2025']).length).toBe(0);
    expect(addSetBonuses({ life: 5 }, ['astral-helm'])).toEqual({ life: 5 });
  });
});
