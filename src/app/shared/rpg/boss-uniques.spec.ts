/**
 * boss-uniques.spec.ts — one named thing per boss, dropping from that boss alone (design-bible §7.2): the drop gate,
 * the four catalogues it fans out to (memory: "one definition fans out to four catalogues"), and the signature sums.
 */
import { BOSS_UNIQUES, NO_RELICS, bossUniqueFor, isBossUnique, relicRegen, relicTotals, rollBossUnique } from './boss-uniques';
import { UNIQUE_ITEMS, uniqueById, uniquesAtRarity } from './unique-items';
import { ITEM_DEFINITIONS, mintEquipment } from './item-definition';
import { DROP_POOL, rollCreatureLoot, uniquesAt } from '../loot/drop-tables';
import { MYSTERY_BOXES, boxPool, rollBox } from '../gambler/mystery-box';
import { itemIcon } from '../art/item-icons';
import { LOOT_TIER_ORDER } from '../loot/loot-tiers';

/** A deterministic stream (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const BOSSES = ['ember-warden', 'the-uncounted', 'magma-tyrant', 'anvil-warden', 'bone-dragon', 'cinder-sovereign', 'mossbound-colossus', 'elder-rootwyrm', 'ink-abbess', 'seam-eater-risen'];

describe('boss uniques: one per boss', () => {
  it('one per boss, every boss has one, gold, with a slot, lore, a signature and odds of 1 in 6 to 1 in 10', () => {
    expect(BOSS_UNIQUES.length).toBe(10);
    expect(new Set(BOSS_UNIQUES.map(u => u.boss))).toEqual(new Set(BOSSES));
    for (const u of BOSS_UNIQUES) {
      expect(bossUniqueFor(u.boss)).withContext(u.boss).toBe(u);
      expect(u.rarity).withContext(u.id).toBe('legendary');
      expect(u.slot).withContext(u.id).toBeTruthy();
      expect(u.lore.length).withContext(u.id).toBeGreaterThan(20);
      expect(Object.keys(u.sig).length).withContext(u.id).toBeGreaterThan(0);
      expect(u.oneIn).withContext(u.id).toBeGreaterThanOrEqual(6);
      expect(u.oneIn).withContext(u.id).toBeLessThanOrEqual(10);
      expect(u.passive.effect).toBe('relic');
    }
  });

  it('they are named objects like every unique: in UNIQUE_ITEMS, ITEM_DEFINITIONS, mintable at their rarity, with an icon', () => {
    for (const u of BOSS_UNIQUES) {
      expect(uniqueById(u.id)).withContext(u.id).toBe(u);
      expect(isBossUnique(u.id)).toBeTrue();
      const def = ITEM_DEFINITIONS.find(d => d.id === u.id);
      expect(def?.family).withContext(u.id).toBe('equipment');
      const item = mintEquipment(u.id, u.rarity, seeded(1), undefined, undefined, 20);
      expect(item?.definitionId).withContext(u.id).toBe(u.id);
      expect(item?.itemLevel).withContext(u.id).toBe(20);
      expect(Object.keys(item?.stats ?? {}).length).withContext(u.id).toBeGreaterThan(1);
      expect(itemIcon(u.id)?.src).withContext(u.id).toContain('data:image/svg+xml');
    }
    expect(isBossUnique('unique-tinders-due')).toBeFalse();
  });
});

describe('boss uniques: the drop gate', () => {
  it('never in an open pool: not at any rung of the creature unique roll, the Gambler or the ordinary drop pool', () => {
    const ids = new Set(BOSS_UNIQUES.map(u => u.id));
    for (const tier of LOOT_TIER_ORDER) {
      expect(uniquesAtRarity(tier).some(u => ids.has(u.id))).withContext(tier).toBeFalse();
      expect(uniquesAt(tier).some(u => ids.has(u.id))).withContext(tier).toBeFalse();
      expect(boxPool(tier).some(d => ids.has(d.id))).withContext(tier).toBeFalse();
    }
    expect(DROP_POOL.some(d => ids.has(d.id))).toBeFalse();
    // The ordinary uniques still are where they were.
    expect(uniquesAtRarity('uncommon').length).toBe(UNIQUE_ITEMS.filter(u => u.rarity === 'uncommon').length);
  });

  it('a Gambler box never pays one, however many are opened', () => {
    const ids = new Set(BOSS_UNIQUES.map(u => u.id)), rng = seeded(7);
    for (const box of MYSTERY_BOXES) for (let i = 0; i < 400; i++) {
      const r = rollBox(box, {}, rng);
      if (r) expect(ids.has(r.definitionId)).withContext(box.id).toBeFalse();
    }
  });

  it('only its own boss drops it, and only as a boss', () => {
    const rng = seeded(3);
    for (let i = 0; i < 2000; i++) {
      for (const creature of ['lava-hound', 'bone-walker', 'obsidian-golem']) {
        for (const rank of ['normal', 'champion', 'unique', 'boss'] as const) {
          const drops = rollCreatureLoot({ creature, level: 30, tier: 'normal', magicFind: 300, rank }, rng);
          expect(drops.some(d => d.kind === 'item' && isBossUnique(d.definitionId))).withContext(`${creature} ${rank}`).toBeFalse();
        }
      }
      // Its boss's name on a non-boss rank (an elite copy, a side-view creature): never.
      const champ = rollCreatureLoot({ creature: 'ink-abbess', level: 50, tier: 'normal', magicFind: 0, rank: 'champion' }, rng);
      expect(champ.some(d => d.kind === 'item' && isBossUnique(d.definitionId))).toBeFalse();
    }
    expect(rollBossUnique('lava-hound', () => 0)).toBeNull();
  });

  it('a boss drops its own (never another\'s) at about its chance, unique and at its rarity', () => {
    for (const u of BOSS_UNIQUES) {
      const rng = seeded(11), n = 6000;
      let got = 0;
      for (let i = 0; i < n; i++) {
        const drops = rollCreatureLoot({ creature: u.boss, level: 30, tier: 'normal', magicFind: 0, rank: 'boss' }, rng);
        for (const d of drops) {
          if (d.kind !== 'item' || !isBossUnique(d.definitionId)) continue;
          expect(d.definitionId).withContext(u.boss).toBe(u.id);
          expect(d.unique).toBeTrue();
          expect(d.rarity).toBe(u.rarity);
          got++;
        }
      }
      expect(got / n).withContext(u.id).toBeCloseTo(1 / u.oneIn, 1);
      expect(Math.abs(got / n - 1 / u.oneIn)).withContext(u.id).toBeLessThan(.02);
    }
  });

  it('the roll is its chance exactly: under 1/N drops it, at or over does not', () => {
    const u = bossUniqueFor('ember-warden')!;
    expect(rollBossUnique('ember-warden', () => 1 / u.oneIn - 1e-9)).toBe(u);
    expect(rollBossUnique('ember-warden', () => 1 / u.oneIn)).toBeNull();
  });
});

describe('boss uniques: the signatures summed', () => {
  it('nothing worn is nothing', () => {
    expect(relicTotals([])).toEqual({ ...NO_RELICS, ranks: {}, cdCut: {} });
    expect(relicTotals(['unique-tinders-due', 'nonsense'])).toEqual({ ...NO_RELICS, ranks: {}, cdCut: {} });
  });

  it('each piece adds its own; two of one count once', () => {
    const all = relicTotals(BOSS_UNIQUES.map(u => u.id));
    // The Warden's ember and the Sexton's cowl each reach 2 tiles further.
    expect(all.light).toBe(4);
    // §3.6: the Hammer (a maul) is the Ashguard's, the Splinterbow the Thornstrider's.
    expect(all.ranks).toEqual({ 'ember-bolt': 1, 'cinder-cleave': 2, volley: 2 });
    expect(all.cdCut).toEqual({ meteor: 2 });
    expect(all.construct).toBe(20);
    expect(all.raisedMax).toBe(1);
    expect(all.breath).toBe(3);
    expect(all.fire).toBe(15);
    expect(all.singe).toEqual({ dps: 5, secs: 3 });
    expect(all.regen).toBe(2);
    expect(all.stillRegen).toBe(2);
    expect(all.spears).toBe(2);
    expect(all.spearRange).toBe(3);
    expect(all.ink).toEqual({ pct: 10, secs: 3 });
    expect(relicTotals(['unique-tyrants-crucible', 'unique-tyrants-crucible']).cdCut).toEqual({ meteor: 2 });
  });

  it('the Mossbound Heart: +2 life a second, and twice the whole regeneration standing still', () => {
    const heart = relicTotals(['unique-mossbound-heart']);
    expect(relicRegen(1, NO_RELICS, true)).toBe(1);
    expect(relicRegen(1, heart, false)).toBe(3);
    expect(relicRegen(1, heart, true)).toBe(6);
    // A negative base is a cursed grave-good's drain (shared/grave-goods): the Heart's +2 offsets it, standing still never doubles it.
    expect(relicRegen(-4, heart, false)).toBe(-2);
    expect(relicRegen(-4, heart, true)).toBe(-2);
    expect(relicRegen(-1, heart, true)).toBe(2);
  });
});
