/**
 * td-pets.spec.ts — the companions in the top-down world: the pet's leash and follow spot, what it fetches (and what
 * it leaves: the filter, coins the Keeper already pulls, a drop he stands on), whom it nips (never a tell), the mend's
 * size, the idle poses; Glim's pointer; the sprites; and that a fetched drop set at the Keeper's feet goes through his
 * own pick-up (EngineOptions.onLoot), exactly as if he had walked over it.
 */
import type { EngineOptions } from '../engine/engine.model';
import { MOBS, MobSystem, type Drop, type Mob, type MobHost } from './td-mobs';
import { TILE } from './td-art';
import {
  GLIM_TD, TD_PET, TD_PET_JOB, bossTelling, fetchable, followSpot, glimIdle, glimPointer, idlePose, mendPulse, pastLeash, petBlow, pickFetchTarget, pickNipTarget, tdPetJob,
  type GlimSpot,
} from './td-pets';
import { PET_ACT } from '../../shared/pets/pet-roles';
import { PETS } from '../../shared/pets/pets.model';
import { PET_H, PET_W, TD_PET_ART_IDS, TD_PET_FRAMES, glimFrame, petFace, petSheet } from './td-pet-art';

const drop = (id: string, x: number, y: number, extra: Partial<Drop> = {}): Drop => ({ id, x, y, coins: 0, material: 'ember-residue', qty: 1, label: id, color: '#fff', age: 2, ...extra });
const K = { x: 0, y: 0, face: 1 as const };

function mobs(keeper = { x: 0, y: 0 }, onLoot?: EngineOptions['onLoot']): MobSystem {
  const host: MobHost = {
    options: { onLoot } as EngineOptions, walkable: () => true, levelId: () => 'spec', player: () => keeper,
    hurtPlayer: () => undefined, healPlayer: () => undefined, swung: () => undefined,
  };
  const sys = new MobSystem(host);
  sys.aura = null;
  return sys;
}
const mobAt = (sys: MobSystem, type: string, x: number, y: number): Mob => {
  sys.addSpawns([{ key: `${type}@${x},${y}`, type, x, y }]);
  return sys.mobs.find(m => m.key === `${type}@${x},${y}`)!;
};

describe('td-pets: jobs and commands', () => {
  it('gives every pet one clear job, and the card\'s command still rules', () => {
    for (const def of PETS) expect(TD_PET_JOB[def.id]).withContext(def.id).toBeDefined();
    expect(TD_PET_JOB['rivet-hatchling']).toBe('fetch');
    expect(tdPetJob('ink-pup', 'follow')).toBe('fight');
    expect(tdPetJob('ink-pup', 'gather')).toBe('fetch');
    expect(tdPetJob('moss-hedgehog', 'fight')).toBe('fight');
    expect(tdPetJob('sunling', 'stay')).toBe('stay');
    expect(tdPetJob('sunling', 'play')).toBe('play');
    expect(tdPetJob('sunling', 'follow')).toBe('mend');
  });
});

describe('td-pets: follow and leash', () => {
  it('stands a step behind the Keeper, on the side he walks away from', () => {
    expect(followSpot({ x: 100, y: 50, face: 1 }).x).toBeLessThan(100);
    expect(followSpot({ x: 100, y: 50, face: -1 }).x).toBeGreaterThan(100);
    expect(Math.hypot(followSpot(K).x, followSpot(K).y)).toBeLessThan(2 * TILE);
  });
  it('steps out at his side once past the leash (or never placed)', () => {
    expect(pastLeash({ x: 30, y: 0 }, K)).toBeFalse();
    expect(pastLeash({ x: TD_PET.leash + 1, y: 0 }, K)).toBeTrue();
    expect(pastLeash({ x: NaN, y: 0 }, K)).toBeTrue();
  });
  it('sits a moment after he stops, naps after a long while', () => {
    expect(idlePose(0)).toBe('follow');
    expect(idlePose(TD_PET.sitAfter + .1)).toBe('sit');
    expect(idlePose(TD_PET.sleepAfter + 1)).toBe('sleep');
  });
});

describe('td-pets: what a pet fetches', () => {
  it('goes for the nearest landed drop near the Keeper, not one he stands on, not one past its reach', () => {
    const near = drop('near', 40, 0), far = drop('far', 90, 0), under = drop('under', 10, 0), out = drop('out', TD_PET.fetchReach + 10, 0);
    expect(pickFetchTarget(K, [far, near, under, out], TD_PET.fetchReach, 'all')?.id).toBe('near');
    expect(pickFetchTarget(K, [drop('fresh', 40, 0, { age: .1 })], TD_PET.fetchReach, 'all')).toBeNull();
    expect(pickFetchTarget(K, [out], TD_PET.fetchReach, 'all')).toBeNull();
  });
  it('skips what it gave up on, and coins the Keeper already pulls in', () => {
    expect(pickFetchTarget(K, [drop('a', 40, 0)], TD_PET.fetchReach, 'all', new Set(['a']))).toBeNull();
    const coins = drop('c', 60, 0, { coins: 12, material: undefined });
    expect(pickFetchTarget(K, [coins], TD_PET.fetchReach, 'all')).toBeNull();
  });
  it('respects the loot filter for gear; potions and materials always', () => {
    const common = drop('g', 40, 0, { material: undefined, item: { definitionId: 'x', rarity: 'common', unique: false }, rarity: 'common' });
    const rare = drop('r', 50, 0, { material: undefined, item: { definitionId: 'y', rarity: 'rare', unique: false }, rarity: 'rare' });
    expect(fetchable(common, 'all')).toBeTrue();
    expect(fetchable(common, 'hide-common')).toBeFalse();
    expect(fetchable(rare, 'rare-plus')).toBeTrue();
    expect(pickFetchTarget(K, [common, rare], TD_PET.fetchReach, 'hide-common')?.id).toBe('r');
    expect(fetchable(drop('p', 0, 0, { material: 'health-potion-minor' }), 'rare-plus')).toBeTrue();
  });
  it('a drop set at the Keeper\'s feet waits for his hand (only Gold is walked up); the pet\'s delivery takes it through onLoot', () => {
    const got: string[] = [];
    const sys = mobs({ x: 0, y: 0 }, loot => { got.push(loot.material ?? ''); return true; });
    sys.layDrop('fetched', 0, 0, 'ember-residue', 1, 'ember residue');
    sys.update(.05);
    expect(got).toEqual([]);
    expect(sys.drops.length).toBe(1);
    expect(sys.takeDrop('fetched')).toBeTrue();
    expect(got).toEqual(['ember-residue']);
    expect(sys.drops.length).toBe(0);
  });
  it('a full satchel leaves it lying (the pet lets it be)', () => {
    const sys = mobs({ x: 0, y: 0 }, () => false);
    sys.layDrop('fetched', 0, 0, 'ember-residue', 1, 'ember residue');
    expect(sys.takeDrop('fetched')).toBeFalse();
    expect(sys.drops.length).toBe(1);
  });
});

describe('td-pets: whom a pet nips', () => {
  it('the Keeper\'s target near him; else the nearest foe at his side; never one past the engage range', () => {
    const sys = mobs();
    const a = mobAt(sys, 'ash-wolf', 30, 0), b = mobAt(sys, 'ash-wolf', 20, 0), far = mobAt(sys, 'ash-wolf', TD_PET.engage + 40, 0);
    expect(pickNipTarget(K, a, sys.mobs)).toBe(a);
    expect(pickNipTarget(K, null, sys.mobs)).toBe(b);
    expect(pickNipTarget(K, far, [far])).toBeNull();
  });
  it('never a creature winding up its tell; a boss\'s tell sends every pet behind the Keeper', () => {
    const sys = mobs();
    const boss = mobAt(sys, 'bone-dragon', 60, 0);
    boss.tell = .4;
    expect(pickNipTarget(K, boss, sys.mobs)).toBeNull();
    expect(bossTelling(K, sys.mobs)).toBe(boss);
    boss.tell = 0;
    expect(bossTelling(K, sys.mobs)).toBeNull();
  });
  it('bites small next to the Keeper (a few a second against his ~38), and the bite never touches him', () => {
    const blow = petBlow('bite', true, 1);
    expect(blow.dmg / blow.rest).toBeLessThan(6);
    expect(petBlow('forage', false, 1).dmg).toBeLessThan(blow.dmg + 1);
    const sys = mobs();
    const wolf = mobAt(sys, 'ash-wolf', 10, 0);
    const before = wolf.hp;
    expect(sys.petBite(wolf, blow.dmg, 1).landed).toBeTrue();
    expect(wolf.hp).toBe(before - blow.dmg);
    expect(MOBS['ash-wolf'].hp).toBeGreaterThan(blow.dmg * 3);
  });
  it('mends only in a fight and under the line, a small share', () => {
    expect(mendPulse(100, 100, true)).toBe(0);
    expect(mendPulse(50, 100, false)).toBe(0);
    expect(mendPulse(50, 100, true)).toBe(Math.round(100 * PET_ACT.pulseShare));
    expect(mendPulse(0, 100, true)).toBe(0);
  });
});

describe('td-pets: Glim\'s pointer', () => {
  const spots: GlimSpot[] = [
    { id: 'ore:a', kind: 'ore', x: 80, y: 0 },
    { id: 'drop:b', kind: 'drop', x: 110, y: 0 },
    { id: 'way:c', kind: 'way', x: 60, y: 0 },
    { id: 'drop:under', kind: 'drop', x: 10, y: 0 },
    { id: 'ore:far', kind: 'ore', x: GLIM_TD.pointReach + 20, y: 0 },
  ];
  it('points at a drop left lying first (weighted), never at his feet or out of reach', () => {
    expect(glimPointer(K, spots, new Set())?.id).toBe('way:c');
    expect(glimPointer(K, spots, new Set(['way:c']))?.id).toBe('drop:b');
    expect(glimPointer(K, spots, new Set(['way:c', 'drop:b']))?.id).toBe('ore:a');
    expect(glimPointer(K, spots, new Set(['way:c', 'drop:b', 'ore:a']))).toBeNull();
  });
  it('orbits when he rests, dozes after a long while', () => {
    expect(glimIdle(0)).toBe('shoulder');
    expect(glimIdle(GLIM_TD.orbitAfter + .1)).toBe('orbit');
    expect(glimIdle(GLIM_TD.dozeAfter + 1)).toBe('doze');
  });
  it('lights the dark wider than the Keeper\'s own light (70)', () => {
    expect(GLIM_TD.light).toBeGreaterThan(70);
    expect(GLIM_TD.lampLight).toBeGreaterThan(GLIM_TD.light);
    expect(TD_PET.light).toBeLessThan(GLIM_TD.light);
  });
});

describe('td-pet-art', () => {
  it('paints every pet: eight cells, opaque pixels in each, a face for the chip', () => {
    for (const def of PETS) expect(TD_PET_ART_IDS).withContext(def.id).toContain(def.id);
    for (const id of TD_PET_ART_IDS) {
      const sheet = petSheet(id)!;
      expect(sheet.width).toBe(PET_W * TD_PET_FRAMES.length);
      expect(sheet.height).toBe(PET_H);
      const c = sheet.getContext('2d')!;
      for (let f = 0; f < TD_PET_FRAMES.length; f++) {
        const d = c.getImageData(f * PET_W, 0, PET_W, PET_H).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 200) n++;
        expect(n).withContext(`${id} ${TD_PET_FRAMES[f]}`).toBeGreaterThan(40);
      }
      expect(petFace(id)).toMatch(/^data:image\/png/);
    }
  });
  it('draws Glim\'s moth with a face per mood', () => {
    const a = glimFrame('mid', 'calm')!, b = glimFrame('mid', 'happy')!;
    expect(a.width).toBeGreaterThan(10);
    expect(a.toDataURL()).not.toBe(b.toDataURL());
  });
});
