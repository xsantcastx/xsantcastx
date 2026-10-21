/**
 * td-elites.spec.ts — elite packs in the top-down world (roadmap §10 item 3): the affix roll, the stat math, the loot
 * floors, and that no pack ever spawns in a town.
 */
import type { EngineOptions, LootRow } from '../engine/engine.model';
import { MOBS, MobSystem, type MobHost } from './td-mobs';
import {
  AFFIX_DEFS, COLD_AURA_R, COLD_SLOW, CURSE_SECONDS, ELITE_AFFIXES, ELITE_CHANCE, MANA_BURN, NAME_FIRST, NAME_TITLE,
  eliteEligible, eliteStats, floorEliteRows, guaranteeMagic, hasMagicItem, lootRank, makePack, rollAffixes, rollElite,
  TD_RANK_HP,
} from './td-elites';
import { RANK_DAMAGE, seededRandom } from '../../shared/loot/champions';
import { TdWorld } from './td-world';
import { CONTINENTS } from './td-engine';
import { TILE } from './td-art';

function world(opts: { safe?: (x: number, y: number) => boolean; rollLoot?: EngineOptions['rollLoot']; keeper?: { x: number; y: number } } = {}): { sys: MobSystem; hurt: number[] } {
  const hurt: number[] = [];
  const keeper = opts.keeper ?? { x: 0, y: 0 };
  const host: MobHost = {
    options: { rollLoot: opts.rollLoot } as EngineOptions,
    walkable: () => true,
    levelId: () => 'spec',
    player: () => keeper,
    hurtPlayer: n => hurt.push(n),
    healPlayer: () => undefined,
    swung: () => undefined,
    ...(opts.safe ? { safeAt: opts.safe } : {}),
  };
  const sys = new MobSystem(host);
  sys.aura = null;
  return { sys, hurt };
}

describe('td-elites: the affix roll', () => {
  it('never rolls two element affixes on one creature, and never the same affix twice', () => {
    for (let s = 0; s < 400; s++) {
      const got = rollAffixes(seededRandom(s + 1), 3);
      expect(new Set(got).size).toBe(got.length);
      expect(got.filter(a => AFFIX_DEFS[a].group === 'element').length).toBeLessThanOrEqual(1);
      for (const a of got) expect(ELITE_AFFIXES).toContain(a);
    }
  });

  it('is deterministic per seed, and comes up about once in 16 with a quarter uniques', () => {
    expect(rollElite('w:3,4|0')).toEqual(rollElite('w:3,4|0'));
    let packs = 0, uniques = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const p = rollElite(`spawn-${i}`);
      if (!p) continue;
      packs++;
      if (p.rank === 'unique') {
        uniques++;
        expect(p.affixes.length).toBeGreaterThanOrEqual(1);
        expect(p.affixes.length).toBeLessThanOrEqual(3);
        expect(p.followers).toBeGreaterThanOrEqual(2);
        expect(p.followers).toBeLessThanOrEqual(4);
        const [first, ...rest] = p.name!.split(' ');
        expect(NAME_FIRST).toContain(first);
        expect(NAME_TITLE).toContain(rest.join(' '));
      } else {
        expect(p.affixes.length).toBe(1);
        expect(p.name).toBeNull();
        // A champion pack is 2–4 creatures: the leader and 1–3 copies.
        expect(p.followers + 1).toBeGreaterThanOrEqual(2);
        expect(p.followers + 1).toBeLessThanOrEqual(4);
      }
    }
    // About 1 per 16 (the brief: one pack per 12–20 spawns).
    expect(packs / N).toBeGreaterThan(1 / 20);
    expect(packs / N).toBeLessThan(1 / 12);
    expect(Math.abs(packs / N - ELITE_CHANCE)).toBeLessThan(.008);
    expect(uniques / packs).toBeGreaterThan(.18);
    expect(uniques / packs).toBeLessThan(.32);
  });

  it('the zone decides (never the Keeper\'s level): never a boss, an authored champion, a level-1 creature or a safe square', () => {
    expect(eliteEligible({ level: 10, safe: false })).toBeTrue();
    expect(eliteEligible({ level: 10, safe: true })).toBeFalse();
    expect(eliteEligible({ level: 10, rank: 'boss', safe: false })).toBeFalse();
    expect(eliteEligible({ level: 10, rank: 'champion', safe: false })).toBeFalse();
    expect(eliteEligible({ level: 2, safe: false })).toBeFalse();
    // A level-30 zone raises its packs for a level-5 Keeper and a level-50 one alike.
    expect(eliteEligible({ level: 30, safe: false })).toBeTrue();
  });
});

describe('td-elites: the stat math', () => {
  const base = { hp: 100, dmg: [10, 20] as [number, number], speed: 30, rate: 1.2 };

  it('a champion takes its rank and its affix', () => {
    const st = eliteStats(base, { rank: 'champion', role: 'leader', affixes: ['extra-strong'] });
    expect(st.hp).toBe(Math.round(100 * TD_RANK_HP.champion));
    expect(st.dmg).toEqual([Math.round(10 * RANK_DAMAGE.champion * 1.5), Math.round(20 * RANK_DAMAGE.champion * 1.5)]);
    expect(st.speed).toBe(30);
    expect(st.take).toBe(1);
  });

  it('a unique leader stacks its affixes; its minions keep their own numbers', () => {
    const st = eliteStats(base, { rank: 'unique', role: 'leader', affixes: ['extra-fast', 'stone-skin', 'fire-enchanted'] });
    expect(st.hp).toBe(Math.round(100 * TD_RANK_HP.unique));
    expect(st.speed).toBeCloseTo(30 * 1.6, 5);
    expect(st.rate).toBeCloseTo(1.2 / 1.3, 5);
    expect(st.take).toBeCloseTo(.6, 5);
    expect(st.hits).toBe('fire');
    expect(st.dmg[0]).toBe(Math.round(10 * RANK_DAMAGE.unique * 1.25));
    const minion = eliteStats(base, { rank: 'unique', role: 'minion', affixes: ['extra-fast'] });
    expect(minion).toEqual({ hp: 100, dmg: [10, 20], speed: 30, rate: 1.2, hits: undefined, take: 1 });
  });

  it('a spawned pack carries those numbers on each member (the bars, the Gold and the loot read them)', () => {
    const { sys } = world();
    const def = MOBS['cinder-bailiff'];
    const pack = sys.spawnPack('p', def, 100, 100, makePack('champion', ['stone-skin'], null, 2));
    expect(pack.length).toBe(3);
    for (const m of pack) {
      expect(m.def.hp).toBe(Math.round(def.hp * TD_RANK_HP.champion));
      expect(m.hp).toBe(m.def.hp);
      expect(m.def.rank).toBe('champion');
      expect(m.elite?.affixes).toEqual(['stone-skin']);
    }
    // Stone Skin turns part of a blow aside.
    const before = pack[0].hp;
    sys.petBite(pack[0], 10, 1);
    expect(before - pack[0].hp).toBe(6);
    const u = sys.spawnPack('u', def, 300, 100, makePack('unique', ['teleport'], 'Grimfang the Hollow', 3));
    expect(u.length).toBe(4);
    expect(u[0].elite?.role).toBe('leader');
    expect(u[0].elite?.name).toBe('Grimfang the Hollow');
    expect(u[0].def.rank).toBe('unique');
    for (const m of u.slice(1)) { expect(m.elite?.role).toBe('minion'); expect(m.def.rank).toBe('normal'); expect(m.def.hp).toBe(def.hp); }
    expect(lootRank(u[0].elite)).toBe('unique');
    expect(lootRank(u[1].elite)).toBe('normal');
  });

  it('Mana Burn drains, Cursed marks, Cold Aura slows the step', () => {
    const { sys } = world();
    const def = { ...MOBS['cinder-bailiff'], rate: .1 };
    const [m] = sys.spawnPack('a', def, 4, 0, makePack('unique', ['mana-burn', 'cursed', 'cold-aura'], 'Sootjaw the Unlit', 0));
    m.cd = 0;
    sys.mana = 50;
    sys.update(.02);
    expect(sys.mana).toBeLessThanOrEqual(50 - MANA_BURN + 1);
    expect(sys.curseT).toBeGreaterThan(CURSE_SECONDS - .1);
    expect(sys.chill).toBe(COLD_SLOW);
    m.x = COLD_AURA_R * 3; m.hx = m.x; m.def = { ...m.def, sight: 0 };
    sys.update(.02);
    expect(sys.chill).toBe(0);
  });
});

describe('td-elites: loot floors', () => {
  type Row = { kind: 'item'; rarity: string; unique?: boolean } | { kind: 'rune'; rarity: string };
  it('an elite never drops common gear; named uniques and runes keep their rung', () => {
    const rows: Row[] = [{ kind: 'item', rarity: 'common' }, { kind: 'item', rarity: 'common', unique: true }, { kind: 'rune', rarity: 'common' }, { kind: 'item', rarity: 'rare' }];
    expect(floorEliteRows(rows, 'champion').map(r => r.rarity)).toEqual(['uncommon', 'common', 'common', 'rare']);
    expect(floorEliteRows(rows, 'unique')[0].rarity).toBe('uncommon');
    expect(floorEliteRows(rows, 'normal')[0].rarity).toBe('common');
  });

  it('a unique leader always leaves a magic-or-better piece', () => {
    let calls = 0;
    const got = guaranteeMagic<Row>([{ kind: 'rune', rarity: 'common' }], () => (++calls < 4 ? [] : [{ kind: 'item', rarity: 'common' }]));
    expect(hasMagicItem(got)).toBeTrue();
    expect(calls).toBe(4);
    expect(guaranteeMagic<Row>([{ kind: 'item', rarity: 'rare' }], () => { throw new Error('no reroll needed'); }).length).toBe(1);
  });

  it('through the fight: a champion asks the host for its rank, a unique leader drops magic+ every time', () => {
    const asked: string[] = [];
    let n = 0;
    // A stingy table: mostly nothing, now and then a common base.
    const rollLoot = (k: { rank: string }): readonly LootRow[] => { asked.push(k.rank); return ++n % 5 === 0 ? [{ kind: 'item', definitionId: 'x', rarity: 'common', label: 'X' }] : []; };
    const { sys } = world({ rollLoot });
    for (let i = 0; i < 20; i++) {
      const [lead] = sys.spawnPack(`u${i}`, { ...MOBS['cinder-bailiff'], sight: 0 }, 400 + i * 50, 400, makePack('unique', ['extra-strong'], 'Inkfang the Ashen', 0));
      sys.drops.length = 0;
      sys.petBite(lead, 1e6, 1);
      const gear = sys.drops.filter(d => d.item);
      expect(gear.length).toBeGreaterThanOrEqual(1);
      expect(gear.every(d => d.item!.rarity !== 'common')).toBeTrue();
    }
    expect(asked).toContain('unique');
    const [champ] = sys.spawnPack('c', { ...MOBS['cinder-bailiff'], sight: 0 }, 900, 900, makePack('champion', ['extra-fast'], null, 0));
    asked.length = 0;
    sys.petBite(champ, 1e6, 1);
    expect(asked).toEqual(['champion']);
  });
});

describe('td-elites: never in town', () => {
  const ember = new TdWorld(CONTINENTS['ember-isle']);
  const spot = ember.spawn;

  it('the town and the ground round it are safe; the far wilds are not', () => {
    expect(ember.safeAt(Math.floor(spot.x / TILE), Math.floor(spot.y / TILE))).toBeTrue();
    expect(ember.safeAt(Math.floor(spot.x / TILE) + 400, Math.floor(spot.y / TILE) + 400)).toBeFalse();
  });

  it('a thousand spawns in town: not one elite; the same far out: about one in 16', () => {
    const safe = (x: number, y: number) => ember.safeAt(Math.floor(x / TILE), Math.floor(y / TILE));
    const { sys } = world({ safe });
    sys.elites = true; sys.keeperLevel = 3; sys.eliteSalt = 'spec';
    const N = 1000;
    sys.addSpawns(Array.from({ length: N }, (_, i) => ({ key: `t${i}`, type: 'cinder-bailiff', x: spot.x + (i % 9) - 4, y: spot.y })));
    expect(sys.mobs.length).toBe(N);
    expect(sys.mobs.some(m => m.elite)).toBeFalse();
    const far = world({ safe });
    far.sys.elites = true; far.sys.keeperLevel = 3; far.sys.eliteSalt = 'spec';
    far.sys.addSpawns(Array.from({ length: N }, (_, i) => ({ key: `f${i}`, type: 'cinder-bailiff', x: spot.x + 400 * TILE, y: spot.y + 400 * TILE })));
    const leaders = far.sys.mobs.filter(m => m.elite?.role === 'leader').length;
    expect(leaders).toBeGreaterThan(N / 25);
    expect(leaders).toBeLessThan(N / 10);
  });

  it('off unless the host turns it on, so a fixed spawn list stays itself', () => {
    const { sys } = world();
    sys.keeperLevel = 3;
    sys.addSpawns(Array.from({ length: 400 }, (_, i) => ({ key: `o${i}`, type: 'cinder-bailiff', x: i * 40, y: 0 })));
    expect(sys.mobs.length).toBe(400);
    expect(sys.mobs.some(m => m.elite)).toBeFalse();
  });
});
