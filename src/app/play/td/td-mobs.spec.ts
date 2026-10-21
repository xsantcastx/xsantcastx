/**
 * td-mobs.spec.ts — the Warlock's raised skeletons (Raise Skeleton), the Bone Spear, and the creatures' shots
 * (owner 2026-10-20: "more spells for the warlock like raise undead skeletons to fight for him").
 */
import type { EngineOptions } from '../engine/engine.model';
import { BOSS_TELL, CALL_TELL, MOBS, MobSystem, goldDropFor, aimShot, mobHits, capMinions, pickMinionTarget, raisedStats, shotHits, stepShot, type Minion, type Mob, type MobHost } from './td-mobs';
import { CLASS_SKILLS, SKILLS, defaultBar } from './td-skills';
import { CREATURE_PROFILES } from '../../shared/loot/creature-families';
import { DAMAGE_COLORS, DAMAGE_TYPES } from '../../shared/loot/damage.model';
import { TdWorld } from './td-world';
import { CONTINENTS } from './td-engine';
import { TILE } from './td-art';
import { HUNT_GOLD, huntGoldMean, huntGoldRange, rollHuntGold } from '../../shared/economy/economy-curve';

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
    expect(sys.minions.length).toBe(v['cap']);
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

  it('lasts until it falls or is released — no timer, and travel never ends it (owner 2026-10-20)', () => {
    const { sys } = world();
    sys.useAbility('raise-skeleton');
    run(sys, 300, .5);
    expect(sys.minions.length).withContext('five minutes on').toBe(2);
    sys.enterLevel([]);
    run(sys, 1, .1);
    expect(sys.minions.length).withContext('after a change of level').toBe(2);
    expect(sys.minions.every(k => Math.abs(k.x) < 100 && Math.abs(k.y) < 100)).withContext('set down at the Keeper\'s side').toBeTrue();
    expect(sys.releaseMinions()).toBe(2);
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
    // A sigil first where each will stand (the tell), then they climb out.
    expect(sys.calls.length).toBe(2);
    expect(sys.mobs.filter(m => m.def.id === 'bone-walker').length).toBe(0);
    run(sys, CALL_TELL + .05);
    expect(sys.calls.length).toBe(0);
    expect(sys.mobs.filter(m => m.def.id === 'bone-walker').length).toBe(2);
    (sys as unknown as { hitFoe(m: Mob, n: number, c: string): void }).hitFoe(dragon, 1, '#fff');
    run(sys, CALL_TELL + .05);
    expect(sys.mobs.filter(m => m.def.id === 'bone-walker').length).toBe(2);
  });
});

describe('td-mobs: a boss\'s tell before its breath', () => {
  it('the Ashbone Dragon winds up for BOSS_TELL seconds before its breath leaves, standing its ground', () => {
    const { sys, hurt } = world({ x: 0, y: 120 });
    const dragon = mobAt(sys, 'bone-dragon', 0, 0);
    dragon.rcd = 0;
    sys.update(.02);
    expect(dragon.tell).toBeCloseTo(BOSS_TELL, 5);
    expect(dragon.aim).toEqual({ x: 0, y: 108 });
    expect(sys.shots.length).toBe(0);
    const at = { x: dragon.x, y: dragon.y };
    run(sys, BOSS_TELL - .1);
    expect(sys.shots.length).toBe(0);
    expect({ x: dragon.x, y: dragon.y }).toEqual(at);
    run(sys, .14);
    expect(sys.shots.length).toBe(3);
    expect(dragon.tell).toBe(0);
    run(sys, 1.6);
    expect(hurt.length).toBeGreaterThan(0);
  });

  it('a Keeper who steps aside during the tell is missed: the breath goes where the warning showed', () => {
    const { sys, hurt, keeper } = world({ x: 0, y: 120 });
    const dragon = mobAt(sys, 'bone-dragon', 0, 0);
    dragon.rcd = 0;
    sys.update(.02);
    keeper.x = 70;
    run(sys, BOSS_TELL + .02);
    expect(sys.shots.length).toBe(3);
    // Hold him there (out of its bite) while the breath flies by.
    for (let t = 0; t < 1.4; t += .02) { dragon.x = 0; dragon.y = 0; sys.update(.02); }
    expect(hurt).toEqual([]);
  });

  it('a creature that is not a boss shoots at once, with no tell (the Bone Archer)', () => {
    const { sys } = world({ x: 0, y: 0 });
    const archer = mobAt(sys, 'bone-archer', 84, 0);
    archer.rcd = 0;
    sys.update(.02);
    expect(archer.tell).toBe(0);
    expect(sys.shots.length).toBe(1);
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

describe('td-mobs: damage types (§6)', () => {
  it('each creature hits with its family\'s type unless it says otherwise', () => {
    for (const def of Object.values(MOBS)) expect(DAMAGE_TYPES).withContext(def.id).toContain(mobHits(def));
    for (const id of ['ember-drake', 'orc-firecaller', 'cinder-sovereign', 'bone-dragon', 'glass-sentinel', 'lava-hound', 'magma-tyrant', 'cinder-imp']) {
      expect(mobHits(MOBS[id])).withContext(id).toBe('fire');
    }
    expect(mobHits(MOBS['cinder-wraith'])).toBe('cold');
    for (const id of ['bone-walker', 'bone-archer', 'cinder-orc', 'orc-warlord', 'ash-wolf', 'rivet-maw']) expect(mobHits(MOBS[id])).withContext(id).toBe('physical');
    expect(mobHits({ id: 'no-such-creature' })).toBe('physical');
  });

  it('a fire bite is cut by fire resist, not Defense; a physical bite by Defense, not resists', () => {
    spyOn(Math, 'random').and.returnValue(.5);
    const bite = (type: string, setup: (sys: MobSystem) => void): { hurt: number[]; colors: string[] } => {
      const w = world();
      setup(w.sys);
      mobAt(w.sys, type, 10, 0);
      run(w.sys, 1.2);
      return { hurt: w.hurt, colors: w.sys.floaters.map(f => f.color) };
    };
    // Lava Hound [7, 12] → 10 at random .5; Ash Wolf [3, 7] → 5.
    expect(bite('lava-hound', () => undefined).hurt[0]).toBe(10);
    expect(bite('lava-hound', sys => { sys.defense = 1000; sys.keeperLevel = 1; }).hurt[0]).toBe(10);
    const warded = bite('lava-hound', sys => { sys.resists = { fire: 75, cold: 0 }; });
    expect(warded.hurt[0]).toBe(3);
    expect(warded.colors).toContain(DAMAGE_COLORS.fire);
    expect(bite('lava-hound', sys => { sys.resists = { cold: 75, lightning: 75, arcane: 75 }; }).hurt[0]).toBe(10);
    expect(bite('ash-wolf', sys => { sys.resists = { fire: 75, cold: 75, lightning: 75, arcane: 75 }; }).hurt[0]).toBe(5);
    expect(bite('ash-wolf', sys => { sys.defense = 100; sys.keeperLevel = 1; }).hurt[0]).toBeLessThan(5);
  });
});

describe('td-mobs Gold piles (D2: the pile follows the level and the rank)', () => {
  it('scales with the creature level, inside ± the spread, never below 1', () => {
    expect(huntGoldRange(1)).toEqual([4, 9]);
    expect(huntGoldRange(10)).toEqual([19, 44]);
    expect(huntGoldRange(40)).toEqual([86, 202]);
    for (const L of [1, 7, 25, 100, 1000, 10000]) {
      const [lo, hi] = huntGoldRange(L);
      expect(rollHuntGold(L, 'normal', () => 0)).toBe(lo);
      expect(rollHuntGold(L, 'normal', () => 1)).toBe(hi);
      expect(lo).toBeGreaterThanOrEqual(1);
      expect(huntGoldMean(L + 1)).toBeGreaterThan(huntGoldMean(L));
    }
  });

  it('a boss pays far more than its kin, a champion in between', () => {
    expect(huntGoldMean(20, 'boss')).toBe(huntGoldMean(20) * HUNT_GOLD.rank.boss);
    expect(huntGoldMean(20, 'champion')).toBeGreaterThan(huntGoldMean(20));
    expect(huntGoldMean(20, 'champion')).toBeLessThan(huntGoldMean(20, 'boss'));
    const tyrant = MOBS['magma-tyrant'], hound = MOBS['lava-hound'];
    expect(goldDropFor(tyrant, () => .5)).toBeGreaterThan(10 * goldDropFor(hound, () => .5));
  });

  it('a kill leaves a Gold pile on the ground; walking over it pays the purse and floats +N Gold', () => {
    const looted: { coins: number }[] = [];
    const host: MobHost = {
      options: { onLoot: (l: { coins: number }) => { looted.push(l); return true; } } as unknown as EngineOptions,
      walkable: () => true, levelId: () => 'surface', player: () => ({ x: 0, y: 0 }), hurtPlayer: () => {}, healPlayer: () => {}, swung: () => {},
    };
    const sys = new MobSystem(host);
    const def = MOBS['cinder-orc'];
    const mob = { def, key: 'k', x: 400, y: 400, hp: 1 } as unknown as Mob;
    (sys as unknown as { mobs: Mob[] }).mobs.push(mob);
    (sys as unknown as { kill(m: Mob): void }).kill(mob);
    const pile = sys.drops.find(d => d.coins > 0)!;
    const [lo, hi] = huntGoldRange(def.level);
    expect(pile.coins).toBeGreaterThanOrEqual(lo);
    expect(pile.coins).toBeLessThanOrEqual(hi);
    expect(pile.label).toBe(`${pile.coins} Gold`);
    pile.x = 0; pile.y = 0; pile.age = 1;
    sys.update(.016);
    expect(looted.map(l => l.coins)).toContain(pile.coins);
    expect(sys.floaters.some(f => f.text === `+${pile.coins} Gold`)).toBeTrue();
  });
});
