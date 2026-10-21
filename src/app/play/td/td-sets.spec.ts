/**
 * td-sets.spec.ts — the item sets in the top-down fight (shared/rpg/set-items.ts): the tiers reach `fightStats` through
 * `wornCombat`, the signatures reach the mob system through `relicTotals`, and every source is a real creature or chest.
 */
import type { EngineOptions } from '../engine/engine.model';
import { MOBS, MobSystem, type MobHost } from './td-mobs';
import { fightStats, levelStats, wornCombat } from './td-skills';
import { ITEM_SETS, SET_PIECES, setSigIds, setSigOf } from '../../shared/rpg/set-items';
import { relicTotals } from '../../shared/rpg/boss-uniques';
import { sumStats } from '../../shared/rpg/item.model';
import { bestiaryEntries, creatureHaunts } from './td-bestiary';
import { SHADE_CHESTS } from './td-dark';

const none = { vit: 0, ene: 0, spi: 0, agi: 0 };
const worn = (setId: string, n: number): string[] => ITEM_SETS.find(s => s.id === setId)!.pieces.slice(0, n);
const gearOf = (stats: Parameters<typeof sumStats>[0], ids: readonly string[]) => wornCombat({ equippedTotals: sumStats(stats) }, ids);

function world(): MobSystem {
  const keeper = { x: 0, y: 0 };
  const host: MobHost = {
    options: {} as EngineOptions, walkable: () => true, levelId: () => 'spec', player: () => keeper,
    hurtPlayer: () => undefined, healPlayer: () => undefined, swung: () => undefined,
  };
  const sys = new MobSystem(host);
  sys.aura = null;
  return sys;
}
const wear = (sys: MobSystem, ids: readonly string[]) => sys.setRelics(relicTotals(setSigIds(ids), setSigOf));

describe('td-sets: tiers applied through wornCombat and fightStats', () => {
  it('with no set worn, wornCombat and fightStats are what they always were', () => {
    const plain = wornCombat({ equippedTotals: sumStats([{ life: 3, defense: 40 }]) });
    expect(gearOf([{ life: 3, defense: 40 }], [])).toEqual(plain);
    expect(gearOf([{ life: 3, defense: 40 }], ['unique-tinders-due', ...worn('ossuary-watch', 1)])).toEqual(plain);
    expect(fightStats(10, none, plain).defense).toBe(40);
  });

  it('Ossuary Watch: two pieces +10% Defense, the full set +10% spell damage', () => {
    const base = fightStats(10, none, gearOf([{ defense: 100 }], []));
    const two = fightStats(10, none, gearOf([{ defense: 100 }], worn('ossuary-watch', 2)));
    expect(two.defense).toBe(110);
    expect(two.power).toBeCloseTo(base.power, 6);
    const full = fightStats(10, none, gearOf([{ defense: 100 }], worn('ossuary-watch', 4)));
    expect(full.defense).toBe(110);
    expect(full.power).toBeCloseTo(base.power * 1.1, 6);
  });

  it('Rootcradle: +1.5 life a second at two, +30 life at three, +10 to every resist at the full set', () => {
    const base = fightStats(10, none, gearOf([{ life: 20 }], []));
    expect(fightStats(10, none, gearOf([{ life: 20 }], worn('rootcradle', 2))).lifeRegen).toBeCloseTo(base.lifeRegen + 1.5, 6);
    expect(fightStats(10, none, gearOf([{ life: 20 }], worn('rootcradle', 3))).maxHp).toBe(base.maxHp + 30);
    const full = fightStats(10, none, gearOf([{ life: 20 }, { fireResist: 15 }], worn('rootcradle', 4)));
    expect(full.resists.fire).toBe(25);
    expect(full.resists.cold).toBe(10);
  });

  it('Garb of the Drowned Abbey: +15% spell damage at two, +1 mana a second at three', () => {
    const base = fightStats(10, none, gearOf([{}], []));
    expect(fightStats(10, none, gearOf([{}], worn('drowned-abbey', 2))).power).toBeCloseTo(base.power * 1.15, 6);
    expect(fightStats(10, none, gearOf([{}], worn('drowned-abbey', 3))).regen).toBeCloseTo(levelStats(10, none).regen + 1, 6);
  });

  it('taking a piece off drops the tier again', () => {
    const four = fightStats(10, none, gearOf([{ defense: 100 }], worn('ossuary-watch', 4)));
    const three = fightStats(10, none, gearOf([{ defense: 100 }], worn('ossuary-watch', 3)));
    expect(four.power).toBeGreaterThan(three.power);
    expect(fightStats(10, none, gearOf([{ defense: 100 }], worn('ossuary-watch', 1))).defense).toBe(100);
  });
});

describe('td-sets: signatures in the mob system', () => {
  it('Ossuary Watch at three pieces lets one more skeleton stand', () => {
    const sys = world();
    expect(sys.relics.raisedMax).toBe(0);
    wear(sys, worn('ossuary-watch', 2));
    expect(sys.relics.raisedMax).toBe(0);
    wear(sys, worn('ossuary-watch', 3));
    expect(sys.relics.raisedMax).toBe(1);
  });

  it('Ossuary Watch full set: Skeleton Mastery holds two ranks more (once learnt)', () => {
    const sys = world();
    sys.setRanks({ 'skeleton-mastery': 2 });
    wear(sys, worn('ossuary-watch', 4));
    expect(sys.rank('skeleton-mastery')).toBe(4);
  });

  it('Garb full set: Dark Ward two ranks up, and every hit stains with ink', () => {
    const sys = world();
    sys.setRanks({ 'dark-ward': 1 });
    wear(sys, worn('drowned-abbey', 4));
    expect(sys.rank('dark-ward')).toBe(3);
    expect(sys.relics.ink).toEqual({ pct: 10, secs: 3 });
    expect(sys.relics.mf).toBe(20);
  });

  it('Rootcradle full set doubles regeneration standing still', () => {
    const sys = world();
    wear(sys, worn('rootcradle', 3));
    expect(sys.relics.stillRegen).toBe(1);
    wear(sys, worn('rootcradle', 4));
    expect(sys.relics.stillRegen).toBe(2);
  });

  it("the Lamplighter's Things: light 2 at two pieces, 4 at the full set, Magic Find 10 at three", () => {
    const sys = world();
    expect(sys.lightBonus).toBe(0);
    wear(sys, worn('lamplighters-things', 2));
    expect(sys.lightBonus).toBe(2);
    wear(sys, worn('lamplighters-things', 3));
    expect(sys.relics.mf).toBe(10);
    wear(sys, worn('lamplighters-things', 4));
    expect(sys.lightBonus).toBe(4);
  });
});

describe('td-sets: every source is real', () => {
  it('every set creature is a td-mobs creature that lives somewhere, and the Bestiary names its set', () => {
    const haunts = creatureHaunts();
    const entries = bestiaryEntries({});
    for (const s of ITEM_SETS) for (const c of s.source.creatures) {
      expect(MOBS[c]).withContext(c).toBeDefined();
      expect(MOBS[c].level).withContext(`${c} reaches the set's level`).toBeGreaterThanOrEqual(s.source.minLevel);
      expect((haunts.get(c) ?? []).length).withContext(c).toBeGreaterThan(0);
      expect(entries.find(e => e.id === c)?.set).withContext(c).toEqual({ id: s.id, level: s.source.minLevel });
    }
    for (const e of entries) if (!ITEM_SETS.some(s => s.source.creatures.includes(e.id))) expect(e.set).withContext(e.id).toBeNull();
  });

  it('every set\'s creatures live in the place the card names', () => {
    const haunts = creatureHaunts();
    const where: Record<string, RegExp> = { 'ossuary-watch': /Ashen Crypt/, 'drowned-abbey': /Drowned Crypts|Umbral/, rootcradle: /Overgrown Temple/ };
    for (const s of ITEM_SETS) if (where[s.id]) for (const c of s.source.creatures) {
      expect((haunts.get(c) ?? []).some(h => where[s.id].test(h))).withContext(`${s.id}: ${c} in ${haunts.get(c)}`).toBeTrue();
    }
  });

  it('every shade chest the Lamplighter names is a real shade chest, and the set has exactly the four pieces', () => {
    const lamp = ITEM_SETS.find(s => s.id === 'lamplighters-things')!;
    for (const chest of Object.keys(lamp.source.chests!)) expect(SHADE_CHESTS.some(c => c.id === chest)).withContext(chest).toBeTrue();
    expect(SET_PIECES.filter(p => p.set === lamp.id).length).toBe(4);
  });
});
