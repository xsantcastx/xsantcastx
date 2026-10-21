/**
 * td-seek.spec.ts — Lumvesh, the Seek, and Light (design-bible §4.6, §5.5): the direction in eight points, the
 * distance bands, the floors, where every boss and level lies, and the two spells going off in the fight.
 */
import type { EngineOptions } from '../engine/engine.model';
import { MobSystem, MOBS, type MobHost } from './td-mobs';
import { CLASS_SKILLS, COMMON_TREE, SKILLS, STARTER_RANKS, skillVars } from './td-skills';
import { levelFor, rankBlock, treeSkills } from './td-tree';
import { CONTINENTS, LEVELS } from './td-engine';

const DOORS_SPEC = { 'lodge-door': { to: 'woodward-lodge-1' } };
import { TILE } from './td-art';
import { bandOf, compass, floorWord, levelLinks, levelSpawns, seekCost, seekReading, townEntries, wayEntries, type SeekPlace } from './td-seek';
import { relicTotals } from '../../shared/rpg/boss-uniques';

const at = (x: number, y: number, extra: Partial<SeekPlace> = {}): SeekPlace => ({ continent: 'isle', level: null, x, y, floor: 0, ax: x, ay: y, ...extra });

describe('td-seek: direction, distance, floor', () => {
  it('eight points, north up the map (y grows south)', () => {
    expect(compass(0, -1)).toBe('n');
    expect(compass(1, -1)).toBe('ne');
    expect(compass(1, 0)).toBe('e');
    expect(compass(1, 1)).toBe('se');
    expect(compass(0, 1)).toBe('s');
    expect(compass(-1, 1)).toBe('sw');
    expect(compass(-1, 0)).toBe('w');
    expect(compass(-1, -1)).toBe('nw');
    expect(compass(0, 0)).toBeNull();
    // Each point holds the 45° round it: 21.8° is still east, 26.6° is north-east.
    expect(compass(10, -4)).toBe('e');
    expect(compass(10, -5)).toBe('ne');
    expect(compass(-3, -100)).toBe('n');
    expect(compass(100, 3)).toBe('e');
  });

  it('the bands: beside (< 5 tiles), near (< 30), far (< 120), very far', () => {
    expect(bandOf(0)).toBe('beside');
    expect(bandOf(4.99)).toBe('beside');
    expect(bandOf(5)).toBe('near');
    expect(bandOf(29.9)).toBe('near');
    expect(bandOf(30)).toBe('far');
    expect(bandOf(119.9)).toBe('far');
    expect(bandOf(120)).toBe('veryFar');
    expect(bandOf(-3)).toBe('beside');
  });

  it('floors: here, below (deeper), above', () => {
    expect(floorWord(0, 0)).toBe('here');
    expect(floorWord(0, -3)).toBe('below');
    expect(floorWord(-3, -1)).toBe('above');
    expect(floorWord(-1, 2)).toBe('above');
  });

  it('a reading on the surface: "far to the north-east"', () => {
    const r = seekReading(at(0, 0), at(40 * TILE, -40 * TILE));
    expect(r).toEqual({ dir: 'ne', band: 'far', floor: 'here', tiles: Math.hypot(40, 40), sea: false });
    expect(seekReading(at(0, 0), at(3 * TILE, 0))).toEqual({ dir: null, band: 'beside', floor: 'here', tiles: 3, sea: false });
    expect(seekReading(at(0, 0), at(-200 * TILE, 0)).band).toBe('veryFar');
  });

  it('into a dungeon: the way in is the point, and the floor says below', () => {
    const boss = at(999, 999, { level: 'mine-3', floor: -3, ax: 0, ay: 10 * TILE });
    expect(seekReading(at(0, 0), boss)).toEqual({ dir: 's', band: 'near', floor: 'below', tiles: 10, sea: false });
    // Two floors of one dungeon compare their own halls.
    const me = at(0, 0, { level: 'mine-1', floor: -1, ax: 0, ay: 10 * TILE });
    const r = seekReading(me, at(-50 * TILE, 0, { level: 'mine-3', floor: -3, ax: 0, ay: 10 * TILE }));
    expect(r.dir).toBe('w'); expect(r.band).toBe('far'); expect(r.floor).toBe('below');
    // From a dungeon to the surface: from its way in.
    expect(seekReading(me, at(0, 40 * TILE)).dir).toBe('s');
    expect(seekReading(me, at(0, 40 * TILE)).floor).toBe('above');
  });

  it('another continent is across the sea, and the last choice', () => {
    const r = seekReading(at(0, 0), at(0, 0, { continent: 'reach' }));
    expect(r.sea).toBeTrue();
    expect(seekCost(r)).toBeGreaterThan(seekCost(seekReading(at(0, 0), at(5000 * TILE, 0))));
    // A floor away costs a little more than the same distance here.
    expect(seekCost(seekReading(at(0, 0), at(10 * TILE, 0, { floor: -1 })))).toBeGreaterThan(seekCost(seekReading(at(0, 0), at(10 * TILE, 0))));
  });
});

describe('td-seek: the world it reads', () => {
  const links = levelLinks([...wayEntries(CONTINENTS, LEVELS), ...townEntries(CONTINENTS, LEVELS, DOORS_SPEC)], LEVELS);

  it('every boss stands in a hall reachable from its continent, on the floor its stairs say', () => {
    const bosses = levelSpawns(LEVELS, id => MOBS[id]?.rank === 'boss');
    const ids = bosses.map(b => b.mob).sort();
    expect(ids).toEqual(['anvil-warden', 'bone-dragon', 'cinder-sovereign', 'elder-rootwyrm', 'ember-warden', 'ink-abbess', 'magma-tyrant', 'mossbound-colossus', 'the-uncounted']);
    for (const b of bosses) {
      const l = links.get(b.level);
      expect(l).withContext(b.level).toBeDefined();
      expect(l!.floor).withContext(b.level).toBeLessThan(0);
    }
    expect(links.get('ember-mine-1')).toEqual(jasmine.objectContaining({ continent: 'ember-isle', floor: -1 }));
    expect(links.get('ember-mine-3')?.floor).toBe(-3);
    expect(links.get('molten-deep-6')?.floor).toBe(-6);
    expect(links.get('molten-deep-6')?.continent).toBe('infernal-reach');
    // Every floor of one dungeon shares its way in.
    expect(links.get('molten-deep-6')?.ax).toBe(links.get('molten-deep-1')?.ax);
    // The Hushed Barrow's vault: under the plot's door, one floor down, on Ember Isle.
    expect(links.get('hushed-barrow-1')).toEqual(jasmine.objectContaining({ continent: 'ember-isle', floor: -1 }));
  });

  it('a tower climbs: through its door at the ground floor, up its stairs above it', () => {
    const tower = levelLinks([{ level: 'lantern-tower-0', continent: 'umbral-marches', x: 0, y: 0 }], LEVELS);
    expect(tower.get('lantern-tower-0')?.floor).toBe(0);
    expect(tower.get('lantern-tower-1')?.floor).toBe(1);
    expect(tower.get('lantern-tower-2')?.floor).toBe(2);
  });

  it('from Ember Isle\'s square the Ember Warden reads below, and the Ink Abbess across the sea', () => {
    const square = at(CONTINENTS['ember-isle'].town().spawn.x, CONTINENTS['ember-isle'].town().spawn.y, { continent: 'ember-isle' });
    const w = levelSpawns(LEVELS, id => id === 'ember-warden')[0], wl = links.get(w.level)!;
    const r = seekReading(square, { continent: wl.continent, level: w.level, x: w.x, y: w.y, floor: wl.floor, ax: wl.ax, ay: wl.ay });
    expect(r.sea).toBeFalse();
    expect(r.floor).toBe('below');
    expect(r.dir).not.toBeNull();
    const a = levelSpawns(LEVELS, id => id === 'ink-abbess')[0], al = links.get(a.level)!;
    expect(seekReading(square, { continent: al.continent, level: a.level, x: a.x, y: a.y, floor: al.floor, ax: al.ax, ay: al.ay }).sea).toBeTrue();
  });
});

describe('td-seek: Light and the Seek as spells', () => {
  function world(seek?: (secs: number) => boolean): { sys: MobSystem; asked: number[] } {
    const asked: number[] = [];
    const host: MobHost = {
      options: {} as EngineOptions, walkable: () => true, levelId: () => 'spec', player: () => ({ x: 0, y: 0 }),
      hurtPlayer: () => undefined, healPlayer: () => undefined, swung: () => undefined,
      ...(seek ? { seek: (secs: number) => { asked.push(secs); return seek(secs); } } : {}),
    };
    const sys = new MobSystem(host);
    sys.aura = null;
    sys.mana = sys.maxMana = 100;
    return { sys, asked };
  }

  it('they sit on the common page with their words; Light is free from the start, the Seek opens at level 8', () => {
    // The Waygate (td-waygate.ts) shares the page: a town portal, early.
    expect(treeSkills('warlock', COMMON_TREE)).toEqual(['light', 'waygate', 'seek']);
    expect(CLASS_SKILLS.warlock).toContain('light');
    expect(CLASS_SKILLS.warlock).toContain('seek');
    expect(SKILLS.light.words).toBe('lum');
    expect(SKILLS.seek.words).toBe('lum vesh');
    expect(STARTER_RANKS.warlock).toContain('light');
    expect(levelFor('light')).toBe(1);
    expect(levelFor('seek')).toBe(8);
    const tree = { spent: {}, free: [], at: 0 };
    expect(rankBlock(tree, 'warlock', 'seek', 7)).toBe('level');
    expect(rankBlock(tree, 'warlock', 'seek', 8)).toBeNull();
    // Ranks grow them: a wider, longer Light; a Seek arrow that holds longer.
    expect(skillVars('light', 10)['radius']).toBeGreaterThan(skillVars('light', 1)['radius']);
    expect(skillVars('light', 10)['secs']).toBeGreaterThan(skillVars('light', 1)['secs']);
    expect(skillVars('seek', 10)['secs']).toBeGreaterThan(skillVars('seek', 1)['secs']);
  });

  it('Light: +3 tiles for 5 minutes, then gone; spoken again it starts over; the Warden\'s Ember stacks on it', () => {
    const { sys } = world();
    sys.setRanks({ light: 1 });
    expect(sys.lightBonus).toBe(0);
    expect(sys.useAbility('light')).toBeNull();
    expect(sys.lightBonus).toBe(3);
    expect(sys.lightT).toBe(300);
    expect(sys.mana).toBe(100 - SKILLS.light.mana);
    sys.setRelics(relicTotals(['unique-wardens-last-ember']));
    expect(sys.lightBonus).toBe(5);
    for (let t = 0; t < 200; t += .5) sys.update(.5);
    expect(sys.lightT).toBeCloseTo(100, 3);
    sys.cooldowns.light = 0;
    sys.useAbility('light');
    expect(sys.lightT).toBe(300);
    for (let t = 0; t < 301; t += .5) sys.update(.5);
    expect(sys.lightT).toBe(0);
    expect(sys.lightBonus).toBe(2);
  });

  it('the Seek asks the host for its arrow seconds; nothing to seek spends nothing', () => {
    const none = world(() => false);
    none.sys.setRanks({ seek: 1 });
    expect(none.sys.useAbility('seek')).toBe('noseek');
    expect(none.sys.mana).toBe(100);
    expect(none.sys.cooldowns.seek ?? 0).toBe(0);
    expect(none.asked).toEqual([SKILLS.seek.vars['secs']]);
    const found = world(() => true);
    found.sys.setRanks({ seek: 5 });
    expect(found.sys.useAbility('seek')).toBeNull();
    expect(found.asked).toEqual([skillVars('seek', 5)['secs']]);
    expect(found.sys.mana).toBe(100 - SKILLS.seek.mana);
    expect(found.sys.useAbility('seek')).toBe('cooldown');
    // No host to ask, or not learnt: it does not go off.
    expect(world().sys.useAbility('seek')).toBe('noseek');
    const locked = world(() => true);
    locked.sys.setRanks({ seek: 0 });
    expect(locked.sys.useAbility('seek')).toBe('locked');
  });
});
