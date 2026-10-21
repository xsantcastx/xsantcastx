/**
 * td-zones.spec.ts — D2's fixed zone levels (owner 2026-10-21: "each zone should not scale with the player, each zone
 * should have a level of difficulty") and the level gap ("If I'm level 20 vs a 40 I should get one-shot").
 */
import type { EngineOptions } from '../engine/engine.model';
import { MOBS, MobSystem, type MobHost } from './td-mobs';
import { CONTINENTS, LEVELS } from './td-engine';
import { HandLevel } from './td-level';
import { TdWorld } from './td-world';
import { TILE } from './td-art';
import { bestiaryEntries } from './td-bestiary';
import { SEAM_BAND, seamEaterAt, SEAM_ID } from './td-seam';
import {
  CONTINENT_BANDS, DANGER_GAP, LEVEL_GAP, SEAM_LEVELS, XP_FALLOFF, ZONES, atZoneLevel, callLevel, gapDealt, gapHurt, gapMiss, gapPace,
  gapTone, graveyardZone, levelGap, regionZone, seamLevelFor, zoneDanger, zoneLevel, zoneOf, zoneXp,
} from './td-zones';

function system(keeperLevel: number): MobSystem {
  const host: MobHost = {
    options: {} as EngineOptions, walkable: () => true, levelId: () => 'spec', player: () => ({ x: 0, y: 0 }),
    hurtPlayer: () => undefined, healPlayer: () => undefined, swung: () => undefined,
  };
  const sys = new MobSystem(host);
  sys.aura = null;
  sys.keeperLevel = keeperLevel;
  return sys;
}

describe('td-zones: every area has a fixed band', () => {
  it('every region of every continent, every graveyard and every hand-drawn level', () => {
    for (const c of Object.values(CONTINENTS)) {
      const regions = new Set([...Object.keys(c.names), ...Object.keys(c.mobs)]);
      for (const r of regions) expect(zoneOf(regionZone(c.id, r))).withContext(`${c.id}:${r}`).not.toBeNull();
      if (c.places.some(p => p.kind === 'graveyard')) expect(zoneOf(graveyardZone(c.id))).withContext(`${c.id} graveyard`).not.toBeNull();
      expect(CONTINENT_BANDS[c.id]).withContext(`${c.id} continent band`).toBeDefined();
      expect(SEAM_LEVELS[c.id]).withContext(`${c.id} Seam Eater`).toBeDefined();
    }
    for (const id of Object.keys(LEVELS)) expect(zoneOf(id)).withContext(id).not.toBeNull();
    for (const [id, z] of Object.entries(ZONES)) {
      expect(z.band[0]).withContext(id).toBeGreaterThanOrEqual(1);
      expect(z.band[1]).withContext(id).toBeGreaterThanOrEqual(z.band[0]);
    }
  });

  it('each continent\'s zones lie inside its band, and the continents climb in order (D2\'s acts)', () => {
    for (const [id, z] of Object.entries(ZONES)) {
      const c = Object.keys(CONTINENT_BANDS).find(k => id.startsWith(`${k}:`));
      if (!c) continue;
      expect(z.band[0]).withContext(id).toBeGreaterThanOrEqual(CONTINENT_BANDS[c][0]);
      expect(z.band[1]).withContext(id).toBeLessThanOrEqual(CONTINENT_BANDS[c][1]);
    }
    const order = ['ember-isle', 'infernal-reach', 'verdant-wilds', 'umbral-marches'];
    for (let i = 1; i < order.length; i++) {
      expect(CONTINENT_BANDS[order[i]][0]).toBeGreaterThan(CONTINENT_BANDS[order[i - 1]][0]);
      expect(CONTINENT_BANDS[order[i]][1]).toBeGreaterThan(CONTINENT_BANDS[order[i - 1]][1]);
    }
    expect(CONTINENT_BANDS['ember-isle']).toEqual([1, 10]);
    expect(CONTINENT_BANDS['umbral-marches'][1]).toBe(50);
  });

  it('a dungeon goes deeper = harder, and each boss stands inside its floor\'s band', () => {
    const groups = new Map<string, { n: number; band: readonly [number, number] }[]>();
    for (const id of Object.keys(LEVELS)) {
      const m = /^(.*)-(\d+)$/.exec(id), z = zoneOf(id)!;
      if (!m || z.safe) continue;
      groups.set(m[1], [...(groups.get(m[1]) ?? []), { n: Number(m[2]), band: z.band }]);
    }
    for (const [dungeon, floors] of groups) {
      floors.sort((a, b) => a.n - b.n);
      for (let i = 1; i < floors.length; i++) expect(floors[i].band[0]).withContext(`${dungeon} −${floors[i].n}`).toBeGreaterThan(floors[i - 1].band[0]);
    }
    for (const lv of Object.values(LEVELS)) for (const e of Object.values(lv.legend)) {
      if (!e.mob || MOBS[e.mob]?.rank !== 'boss') continue;
      const band = zoneOf(lv.id)!.band;
      expect(MOBS[e.mob].level).withContext(`${e.mob} on ${lv.id}`).toBeGreaterThanOrEqual(band[0]);
      expect(MOBS[e.mob].level).withContext(`${e.mob} on ${lv.id}`).toBeLessThanOrEqual(band[1]);
    }
  });
});

describe('td-zones: creatures spawn at the zone\'s level, never the Keeper\'s', () => {
  it('a floor\'s spawns carry levels inside its band, the same every time (a co-op host and its party agree)', () => {
    for (const def of Object.values(LEVELS)) {
      const z = zoneOf(def.id)!, a = new HandLevel(def).spawnsIn(), b = new HandLevel(def).spawnsIn();
      a.forEach((s, i) => {
        expect(s.level).withContext(s.key).toBeGreaterThanOrEqual(z.band[0]);
        expect(s.level).withContext(s.key).toBeLessThanOrEqual(z.band[1]);
        expect(b[i].level).withContext(s.key).toBe(s.level);
      });
    }
  });

  it('a level-1 and a level-50 Keeper see the same creature levels in the same zone', () => {
    for (const c of Object.values(CONTINENTS)) {
      const world = new TdWorld(c), span = 220 * TILE;
      const spawns = world.spawnsIn(-span, -span, span, span).filter(s => s.level !== undefined);
      expect(spawns.length).withContext(c.id).toBeGreaterThan(5);
      const low = system(1), high = system(50);
      low.addSpawns(spawns); high.addSpawns(spawns);
      const lv = (sys: MobSystem) => sys.mobs.map(m => `${m.key}:${m.def.id}:${m.def.level}:${m.def.hp}`).sort();
      expect(lv(low)).withContext(c.id).toEqual(lv(high));
      // …and every one inside its zone's band.
      for (const m of low.mobs) {
        const s = spawns.find(x => x.key === m.key)!;
        const r = world.regionAt(Math.floor(s.x / TILE), Math.floor((s.y - 1) / TILE));
        const band = (s.key.startsWith('g:') ? zoneOf(graveyardZone(c.id)) : zoneOf(regionZone(c.id, r)))?.band;
        if (!band || m.def.rank === 'boss') continue;
        expect(m.def.level).withContext(`${c.id} ${m.key}`).toBe(s.level!);
      }
    }
  });

  it('a creature re-made at a level grows with it; the same level, a boss or the Seam Eater are themselves', () => {
    const wolf = MOBS['ash-wolf'], at11 = atZoneLevel(wolf, 11);
    expect(at11.level).toBe(11);
    expect(at11.hp).toBeGreaterThan(wolf.hp * 3);
    expect(at11.dmg[1]).toBeGreaterThan(wolf.dmg[1]);
    expect(atZoneLevel(wolf, wolf.level)).toBe(wolf);
    expect(atZoneLevel(MOBS['magma-tyrant'], 5)).toBe(MOBS['magma-tyrant']);
    expect(atZoneLevel(MOBS[SEAM_ID], 5)).toBe(MOBS[SEAM_ID]);
    // A night swap keeps the spawn's level: a Bone Walker (its own level 6) rising in the Charwood comes at the zone's.
    expect(atZoneLevel(MOBS['bone-walker'], 12).level).toBe(12);
  });

  it('zoneLevel is the key\'s alone and stays inside the band', () => {
    for (let i = 0; i < 200; i++) {
      const L = zoneLevel([13, 16], `k${i}`);
      expect(L).toBeGreaterThanOrEqual(13);
      expect(L).toBeLessThanOrEqual(16);
      expect(zoneLevel([13, 16], `k${i}`)).toBe(L);
    }
    expect(zoneLevel([7, 7], 'x')).toBe(7);
  });

  it('the Seam Eater is fixed per continent, inside its curve, whatever the Keeper', () => {
    expect(seamLevelFor('ember-isle')).toBe(20);
    expect(seamLevelFor('infernal-reach')).toBe(30);
    expect(seamLevelFor('verdant-wilds')).toBe(40);
    expect(seamLevelFor('umbral-marches')).toBe(55);
    for (const L of Object.values(SEAM_LEVELS)) {
      expect(L).toBeGreaterThanOrEqual(SEAM_BAND.min);
      expect(L).toBeLessThanOrEqual(SEAM_BAND.max);
      expect(seamEaterAt(MOBS[SEAM_ID], L).level).toBe(L);
    }
  });

  it('a boss calls its help at its floor\'s level; the world boss calls its own kind', () => {
    expect(callLevel(MOBS['cinder-sovereign'], MOBS['lava-hound'])).toBe(28);
    expect(callLevel(MOBS['the-uncounted'], MOBS['bone-walker'])).toBe(6);
    expect(callLevel(seamEaterAt(MOBS[SEAM_ID], 55), MOBS['drowned-knight'])).toBe(MOBS['drowned-knight'].level);
  });
});

describe('td-zones: XP rewards hunting at your level (D2)', () => {
  it('full to five below, then 5% less a level, floored; a little more above', () => {
    expect(zoneXp(20, 20)).toBe(1);
    expect(zoneXp(20, 15)).toBe(1);
    expect(zoneXp(20, 14)).toBeCloseTo(.95, 6);
    expect(zoneXp(20, 10)).toBeCloseTo(.75, 6);
    expect(zoneXp(30, 10)).toBeCloseTo(.25, 6);
    expect(zoneXp(50, 1)).toBe(XP_FALLOFF.floor);
    expect(zoneXp(20, 21)).toBeCloseTo(1.02, 6);
    expect(zoneXp(20, 25)).toBeCloseTo(1.1, 6);
    expect(zoneXp(20, 40)).toBeCloseTo(1 + XP_FALLOFF.bonusCap, 6);
  });

  it('a kill reports the falloff to the host', () => {
    const kills: { xp?: number }[] = [];
    const host: MobHost = {
      options: { onKill: (e: { xp?: number }) => kills.push(e) } as unknown as EngineOptions, walkable: () => true,
      levelId: () => 'spec', player: () => ({ x: 0, y: 0 }), hurtPlayer: () => undefined, healPlayer: () => undefined, swung: () => undefined,
    };
    const sys = new MobSystem(host);
    sys.aura = null; sys.keeperLevel = 30; sys.levelGap = true;
    const m = sys.place('far-below', atZoneLevel(MOBS['ash-wolf'], 10), 400, 0);
    (sys as unknown as { kill(m: unknown): void }).kill(m);
    expect(kills[0].xp).toBeCloseTo(.25, 6);
  });
});

describe('td-zones: the level gap (owner: "If I\'m level 20 vs a 40 I should get one-shot")', () => {
  it('a creature above the Keeper strikes harder, steepening past ten levels; below him it is never softer', () => {
    expect(levelGap(20, 15)).toBe(0);
    expect(gapHurt(0)).toBe(1);
    expect(gapHurt(levelGap(20, 25))).toBeCloseTo(2.5, 6);
    expect(gapHurt(10)).toBeCloseTo(4, 6);
    expect(gapHurt(20)).toBeCloseTo(4 * Math.pow(LEVEL_GAP.steepRate, 10), 6);
    expect(gapHurt(20)).toBeGreaterThan(20);
    expect(gapPace(20)).toBeCloseTo(1.6, 6);
  });

  it('the Keeper misses more and hurts less against a creature above him (≤ 20% at +20)', () => {
    expect(gapMiss(0)).toBe(0);
    expect(gapDealt(0)).toBe(1);
    expect(gapMiss(5)).toBeCloseTo(.375, 6);
    expect((1 - gapMiss(20)) * gapDealt(20)).toBeLessThanOrEqual(.2);
    expect(gapDealt(100)).toBe(LEVEL_GAP.dealtFloor);
    expect(gapMiss(100)).toBe(LEVEL_GAP.missCap);
  });

  it('a level-40 creature\'s blow lands ten-fold on a level-20 Keeper, and evenly on a level-40 one', () => {
    const blow = (keeper: number) => {
      const hurt: number[] = [];
      const host: MobHost = { options: {} as EngineOptions, walkable: () => true, levelId: () => 'spec', player: () => ({ x: 0, y: 0 }), hurtPlayer: n => hurt.push(n), healPlayer: () => undefined, swung: () => undefined };
      const sys = new MobSystem(host);
      sys.aura = null; sys.keeperLevel = keeper; sys.levelGap = true;
      const m = sys.place('k', atZoneLevel(MOBS['drowned-knight'], 40), 10, 0);
      (sys as unknown as { biteKeeper(n: number, t: string, from: unknown): void }).biteKeeper(40, 'physical', m);
      return hurt[0];
    };
    expect(blow(20)).toBeGreaterThan(blow(40) * 10);
  });

  it('name plates by the gap (Tibia): grey, cream, yellow, orange, red', () => {
    expect(gapTone(20, 10)).toBe('trivial');
    expect(gapTone(20, 21)).toBe('even');
    expect(gapTone(20, 23)).toBe('tough');
    expect(gapTone(20, 26)).toBe('hard');
    expect(gapTone(20, 30)).toBe('deadly');
  });

  it('a zone well above the Keeper is dangerous for him; at his level it is not', () => {
    expect(zoneDanger([13, 16], 8)).toBeTrue();
    expect(zoneDanger([13, 16], 13 - DANGER_GAP + 1)).toBeFalse();
    expect(zoneDanger(null, 1)).toBeFalse();
  });
});

describe('td-zones: the Bestiary lists each creature\'s level where it is found', () => {
  it('a wild kind at each zone\'s band, a boss at its own, the Seam Eater at each rift\'s', () => {
    const all = bestiaryEntries({}), of = (id: string) => all.find(e => e.id === id)!;
    const wolf = of('ash-wolf'), at = (e: ReturnType<typeof of>, where: string) => e.hauntBands[e.haunts.indexOf(where)];
    expect(at(wolf, 'The Emberwood, Ember Isle')).toEqual([2, 4]);
    expect(at(wolf, 'The Charwood, Infernal Reach')).toEqual([10, 13]);
    expect(wolf.levels).toEqual([2, 16]);
    expect(of('magma-tyrant').levels).toEqual([20, 20]);
    expect(of(SEAM_ID).hauntBands.map(b => b?.[0])).toEqual([20, 30, 40, 55]);
    for (const e of all) expect(e.hauntBands.length).withContext(e.id).toBe(e.haunts.length);
  });
});

