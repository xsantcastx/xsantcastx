/**
 * td-mobs.spec.ts — the Warlock's raised skeletons (Raise Skeleton), the Bone Spear, and the creatures' shots
 * (owner 2026-10-20: "more spells for the warlock like raise undead skeletons to fight for him").
 */
import type { EngineOptions } from '../engine/engine.model';
import { MOBS, MobSystem, aimShot, capMinions, pickMinionTarget, raisedStats, shotHits, stepShot, type Minion, type Mob, type MobHost } from './td-mobs';
import { CLASS_SKILLS, SKILLS, defaultBar } from './td-skills';
import { CREATURE_PROFILES } from '../../shared/loot/creature-families';
import { TdWorld } from './td-world';
import { CONTINENTS } from './td-engine';
import { TILE } from './td-art';

function world(keeper = { x: 0, y: 0 }): { sys: MobSystem; hurt: number[]; keeper: { x: number; y: number } } {
  const hurt: number[] = [];
  const host: MobHost = {
    options: {} as EngineOptions,
    walkable: () => true,
    levelId: () => 'spec',
    player: () => keeper,
    hurtPlayer: n => hurt.push(n),
    healPlayer: () => undefined,
    swung: () => undefined,
  };
  const sys = new MobSystem(host);
  sys.aura = null;
  return { sys, hurt, keeper };
}
const run = (sys: MobSystem, secs: number, dt = .02) => { for (let t = 0; t < secs; t += dt) sys.update(dt); };
const minion = (id: number): Minion => ({ id, x: 0, y: 0, hp: 10, maxHp: 10, dmg: [1, 1], cd: 0, t: 0, face: 1, life: 10, hit: 0, target: null });
const mobAt = (sys: MobSystem, type: string, x: number, y: number, key = `${type}@${x},${y}`): Mob => {
  sys.addSpawns([{ key, type, x, y }]);
  return sys.mobs.find(m => m.key === key)!;
};

describe('td-mobs: Raise Skeleton', () => {
  const v = SKILLS['raise-skeleton'].vars;

  it('raises its count, and never keeps more than the cap (the oldest crumble first)', () => {
    const { sys } = world();
    expect(sys.useAbility('raise-skeleton')).toBeNull();
    expect(sys.minions.length).toBe(v['count']);
    const first = sys.minions.map(k => k.id);
    sys.cooldowns['raise-skeleton'] = 0; sys.mana = sys.maxMana;
    expect(sys.useAbility('raise-skeleton')).toBeNull();
    expect(sys.minions.length).toBe(v['max']);
    expect(sys.minions.some(k => first.includes(k.id))).toBeFalse();
  });

  it('capMinions lets go of the oldest', () => {
    const list = [minion(1), minion(2), minion(3)];
    const gone = capMinions(list, 2);
    expect(gone.map(k => k.id)).toEqual([1]);
    expect(list.map(k => k.id)).toEqual([2, 3]);
    expect(capMinions(list, 2)).toEqual([]);
  });

  it('rises from a fresh corpse in reach, else from the ground at the Keeper\'s side', () => {
    const { sys } = world();
    sys.corpses.push({ x: 40, y: 5, at: 0 });
    sys.useAbility('raise-skeleton');
    expect(sys.minions.some(k => k.x === 40 && k.y === 5)).toBeTrue();
    expect(sys.minions.some(k => Math.abs(k.x) === 16)).toBeTrue();
    expect(sys.corpses.length).toBe(0);
  });

  it('grows with the Keeper\'s level and spell power', () => {
    const low = raisedStats(1, 1, v), high = raisedStats(20, 2, v);
    expect(low.hp).toBe(v['hp']);
    expect(high.hp).toBeGreaterThan(low.hp * 3);
    expect(high.dmg[0]).toBeGreaterThan(low.dmg[1]);
  });

  it('crumbles when its time is up', () => {
    const { sys } = world();
    sys.useAbility('raise-skeleton');
    run(sys, v['secs'] - 1, .1);
    expect(sys.minions.length).toBe(2);
    run(sys, 2, .1);
    expect(sys.minions.length).toBe(0);
  });

  it('goes for the nearest foe in its sight, within the Keeper\'s leash', () => {
    const { sys } = world();
    const near = mobAt(sys, 'bone-walker', 40, 0), far = mobAt(sys, 'bone-walker', 70, 0), loose = mobAt(sys, 'bone-walker', 400, 0);
    expect(pickMinionTarget({ x: 30, y: 0 }, sys.mobs, { x: 0, y: 0 }, 96, 144)).toBe(near);
    expect(pickMinionTarget({ x: 80, y: 0 }, sys.mobs, { x: 0, y: 0 }, 96, 144)).toBe(far);
    expect(pickMinionTarget({ x: 390, y: 0 }, sys.mobs, { x: 0, y: 0 }, 96, 144)).withContext('past the leash').toBeNull();
    expect(loose).toBeDefined();
  });

  it('kills a creature for the Keeper and never hurts him; the creature turns on the skeletons', () => {
    const { sys, hurt } = world();
    sys.useAbility('raise-skeleton');
    const foe = mobAt(sys, 'bone-walker', 44, 0);
    let bitten = false;
    for (let t = 0; t < 20 && sys.mobs.includes(foe); t += .02) {
      sys.update(.02);
      if (sys.minions.some(k => k.hp < k.maxHp)) bitten = true;
    }
    expect(sys.mobs.includes(foe)).withContext('the skeletons felled it').toBeFalse();
    expect(bitten).withContext('it fought back at the skeletons').toBeTrue();
    expect(hurt).toEqual([]);
  });
});

describe('td-mobs: Bone Spear', () => {
  it('pierces every creature in its line, and only those', () => {
    const { sys } = world();
    const line = [mobAt(sys, 'bone-walker', 30, 0), mobAt(sys, 'bone-walker', 55, 0), mobAt(sys, 'bone-walker', 80, 0)];
    const aside = mobAt(sys, 'bone-walker', 70, 70);
    sys.target = line[0];
    expect(sys.useAbility('bone-spear')).toBeNull();
    run(sys, .45);
    for (const m of line) expect(m.hp).withContext(m.key).toBeLessThanOrEqual(m.def.hp - SKILLS['bone-spear'].vars['min']);
    expect(aside.hp).toBe(aside.def.hp);
  });

  it('needs a foe in range', () => {
    const { sys } = world();
    expect(sys.useAbility('bone-spear')).toBe('nofoe');
  });
});

describe('td-mobs: creatures that shoot', () => {
  it('a shot flies straight at where it was aimed, and hits only what stands on its line', () => {
    const s = aimShot(0, 0, 100, 0, 100, 80, 7, 'arrow');
    expect(s.life).toBeCloseTo(1.12, 2);
    stepShot(s, .5);
    expect(s.x).toBeCloseTo(50, 5);
    expect(s.y).toBeCloseTo(0, 5);
    expect(shotHits(s, 52, 3)).toBeTrue();
    expect(shotHits(s, 52, 30)).toBeFalse();
  });

  it('a Bone Archer\'s arrow lands on a Keeper who stands still, and misses one who steps aside', () => {
    const still = world();
    mobAt(still.sys, 'bone-archer', 84, 0);
    run(still.sys, 4);
    expect(still.hurt.length).toBeGreaterThan(0);

    const dodge = world();
    mobAt(dodge.sys, 'bone-archer', 84, 0);
    for (let t = 0; t < 4 && !dodge.sys.shots.length; t += .02) dodge.sys.update(.02);
    expect(dodge.sys.shots.length).toBe(1);
    dodge.keeper.y = 60;
    run(dodge.sys, 1);
    expect(dodge.hurt).toEqual([]);
  });

  it('a ranged creature keeps its distance', () => {
    const { sys } = world();
    const archer = mobAt(sys, 'bone-archer', 30, 0);
    run(sys, 2);
    expect(Math.hypot(archer.x, archer.y)).toBeGreaterThan(50);
  });

  it('the Ashbone Dragon calls two Bone Walkers once, at half its life', () => {
    const { sys } = world({ x: 0, y: 2000 });
    const dragon = mobAt(sys, 'bone-dragon', 0, 0);
    sys.power = 100;
    sys.target = dragon;
    sys.keeperLevel = 1;
    dragon.hp = dragon.def.hp * .5 + 1;
    (sys as unknown as { hitFoe(m: Mob, n: number, c: string): void }).hitFoe(dragon, 1, '#fff');
    expect(sys.mobs.filter(m => m.def.id === 'bone-walker').length).toBe(2);
    (sys as unknown as { hitFoe(m: Mob, n: number, c: string): void }).hitFoe(dragon, 1, '#fff');
    expect(sys.mobs.filter(m => m.def.id === 'bone-walker').length).toBe(2);
  });
});

describe('td-mobs: the new creatures and spells are whole', () => {
  const NEW = ['bone-walker', 'bone-archer', 'ash-ghoul', 'cinder-wraith', 'cinder-orc', 'orc-firecaller', 'orc-warlord', 'ember-drake', 'bone-dragon'];
  it('each has a combat profile at its own level', () => {
    for (const id of NEW) {
      const p = CREATURE_PROFILES.find(x => x.creature === id);
      expect(p).withContext(id).toBeDefined();
      expect(p!.level).withContext(id).toBe(MOBS[id].level);
    }
  });
  it('the default bar stays the first four spells; the new ones wait in the Spellbook', () => {
    expect(defaultBar('warlock')).toEqual(['drain-life', 'ember-curse', 'hellfire-nova', 'dark-ward']);
    expect(CLASS_SKILLS.warlock).toContain('bone-spear');
    expect(CLASS_SKILLS.warlock).toContain('raise-skeleton');
  });
});

describe('td-mobs: where the new creatures live', () => {
  it('the Hushed Barrow on Ember Isle holds a few Bone Walkers, each on open ground', () => {
    const isle = new TdWorld(CONTINENTS['ember-isle']);
    const barrow = isle.def.places.find(p => p.kind === 'graveyard')!;
    const x = barrow.c * TILE, y = barrow.r * TILE;
    const dead = isle.spawnsIn(x - 8 * TILE, y - 8 * TILE, x + 8 * TILE, y + 8 * TILE).filter(s => s.type === 'bone-walker');
    expect(dead.length).toBeGreaterThanOrEqual(3);
    expect(dead.length).toBeLessThanOrEqual(4);
    for (const s of dead) expect(isle.walkable(Math.floor(s.x / TILE), Math.floor((s.y - 1) / TILE))).withContext(s.key).toBeTrue();
  });
  it('no wild pack spawns within eight tiles of the Ashen Crypt\'s door', () => {
    const reach = new TdWorld(CONTINENTS['infernal-reach']);
    const door = reach.def.places.find(p => p.kind === 'crypt')!;
    const x = door.c * TILE, y = door.r * TILE;
    const near = reach.spawnsIn(x - 12 * TILE, y - 12 * TILE, x + 12 * TILE, y + 12 * TILE)
      .filter(s => Math.hypot(s.x / TILE - door.c, s.y / TILE - door.r) < 8);
    expect(near).toEqual([]);
  });
});
