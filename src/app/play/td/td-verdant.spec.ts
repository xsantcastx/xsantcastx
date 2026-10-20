/**
 * td-verdant.spec.ts — the Verdant Wilds' deeper places (docs/design/world-map.md): the Overgrown Temple's Drowned
 * Vault and Rootcradle (−4, −5), the Root Hollows (−1…−3), the two village houses, and Mossharbor's ship to Ember Isle.
 * Every way leads somewhere real, nothing waits within eight tiles of a stair or a door, the Elder Rootwyrm winds up
 * before it breathes and calls its acolytes once, and the ketch sails both ways from a plank the Keeper can stand on.
 */
import type { EngineOptions } from '../engine/engine.model';
import { CALL_TELL, MOBS, MobSystem, windsUp, type Mob, type MobHost } from './td-mobs';
import { CREATURE_PROFILES } from '../../shared/loot/creature-families';
import { CONTINENTS, LEVELS } from './td-engine';
import { HandLevel, footFree, standNear } from './td-level';
import { TdWorld } from './td-world';
import { TILE } from './td-art';

function mobs(): MobSystem {
  const host: MobHost = {
    options: {} as EngineOptions, walkable: () => true, levelId: () => 'spec', player: () => ({ x: 0, y: 2000 }),
    hurtPlayer: () => undefined, healPlayer: () => undefined, swung: () => undefined,
  };
  const sys = new MobSystem(host);
  sys.aura = null;
  return sys;
}
const hit = (sys: MobSystem, m: Mob) => (sys as unknown as { hitFoe(m: Mob, n: number, c: string): void }).hitFoe(m, 1, '#fff');

const NEW_LEVELS = ['overgrown-temple-4', 'overgrown-temple-5', 'root-hollows-1', 'root-hollows-2', 'root-hollows-3',
  'netloft-1', 'netloft-2', 'herbal-cottage-1', 'herbal-cottage-0'];

describe('td: the Verdant Wilds, deeper', () => {
  for (const id of ['rootgnaw', 'sporecap', 'drowned-acolyte', 'elder-rootwyrm']) {
    it(`${id} has lore and a combat profile at its own level`, () => {
      const p = CREATURE_PROFILES.find(x => x.creature === id);
      expect(p).withContext(id).toBeDefined();
      expect(p!.level).toBe(MOBS[id].level);
      expect(!!p!.boss).toBe(MOBS[id].rank === 'boss');
      expect(MOBS[id].lore?.length ?? 0).toBeGreaterThan(40);
    });
  }
  it('the Elder Rootwyrm is level 40, winds up before it breathes, and calls two Drowned Acolytes once at half its life', () => {
    const def = MOBS['elder-rootwyrm'];
    expect(def.level).toBe(40);
    expect(windsUp(def)).toBeTrue();
    const sys = mobs();
    sys.addSpawns([{ key: 'w', type: 'elder-rootwyrm', x: 0, y: 0 }]);
    const m = sys.mobs.find(x => x.key === 'w')!;
    m.hp = def.hp * .5 + 1;
    hit(sys, m);
    expect(sys.calls.length).toBe(2);
    for (let t = 0; t < CALL_TELL + .05; t += .02) sys.update(.02);
    expect(sys.mobs.filter(x => x.def.id === 'drowned-acolyte').length).toBe(2);
    hit(sys, m);
    for (let t = 0; t < CALL_TELL + .05; t += .02) sys.update(.02);
    expect(sys.mobs.filter(x => x.def.id === 'drowned-acolyte').length).toBe(2);
  });
  it('the temple goes down five floors, the Rootwyrm on the last; the Root Hollows three, and out by the root-hole', () => {
    for (const [base, floors] of [['overgrown-temple', 5], ['root-hollows', 3]] as const) {
      for (let f = 1; f < floors; f++) expect([...new HandLevel(LEVELS[`${base}-${f}`]).exits.values()].some(e => e.to === `${base}-${f + 1}`)).withContext(`${base} ${f}`).toBeTrue();
    }
    expect(new HandLevel(LEVELS['overgrown-temple-5']).spawnsIn().some(s => s.type === 'elder-rootwyrm')).toBeTrue();
    expect([...new HandLevel(LEVELS['root-hollows-1']).exits.values()]).toContain({ to: 'surface', arrive: 'root-hollows' });
    for (const type of ['rootgnaw', 'sporecap']) expect([1, 2, 3].some(f => new HandLevel(LEVELS[`root-hollows-${f}`]).spawnsIn().some(s => s.type === type))).withContext(type).toBeTrue();
  });
  for (const id of NEW_LEVELS) {
    it(`${id}: no creature within eight tiles of a stair or a door`, () => {
      const level = new HandLevel(LEVELS[id]);
      for (const s of level.spawnsIn()) for (const st of level.stalls) {
        expect(Math.hypot(s.x - st.x, s.y - (st.y - 6)) / TILE).withContext(`${id} ${s.type} by ${st.station.id}`).toBeGreaterThanOrEqual(8);
      }
    });
  }
  it('the Root Hollows open off the Deep Wilds, with no wild pack within eight tiles of the root-hole', () => {
    const wilds = new TdWorld(CONTINENTS['verdant-wilds']);
    expect(wilds.ways.get('root-hollows')).toEqual({ to: 'root-hollows-1', arrive: 'hollows-out', ship: false });
    const hole = wilds.def.places.find(p => p.kind === 'cave')!;
    const x = hole.c * TILE, y = hole.r * TILE;
    const near = wilds.spawnsIn(x - 12 * TILE, y - 12 * TILE, x + 12 * TILE, y + 12 * TILE).filter(s => Math.hypot(s.x / TILE - hole.c, s.y / TILE - hole.r) < 8);
    expect(near).toEqual([]);
    const st = wilds.stalls.find(s => s.station.id === 'root-hollows')!;
    const spot = standNear(wilds, st.x, st.y + 10);
    expect(footFree(wilds, spot.x, spot.y)).toBeTrue();
  });
  it('Mossharbor\'s ketch sails to Ember Harbour from its west finger, and Ember Harbour\'s second ship sails back', () => {
    const wilds = new TdWorld(CONTINENTS['verdant-wilds']), isle = new TdWorld(CONTINENTS['ember-isle']);
    expect(wilds.ways.get('ship-mossharbor-isle')).toEqual({ to: 'ember-isle', arrive: 'ship-isle-verdant', ship: true });
    expect(isle.ways.get('ship-isle-verdant')).toEqual({ to: 'verdant-wilds', arrive: 'ship-mossharbor-isle', ship: true });
    for (const [world, id, place] of [[wilds, 'ship-mossharbor-isle', 'Mossharbor'], [isle, 'ship-isle-verdant', null]] as const) {
      const st = world.stalls.find(s => s.station.id === id)!;
      const spot = standNear(world, st.x, st.y + 10);
      expect(footFree(world, spot.x, spot.y)).withContext(id).toBeTrue();
      expect(world.ground(Math.floor(spot.x / TILE), Math.floor((spot.y - 1) / TILE))).withContext(id).toBe('plank');
      if (place) expect(world.placeName(st.x, st.y)).toBe(place);
    }
    // The two ships at each harbour are boarded from different planks.
    const a = wilds.stalls.find(s => s.station.id === 'ship-mossharbor')!, b = wilds.stalls.find(s => s.station.id === 'ship-mossharbor-isle')!;
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(3 * TILE);
    const c = isle.stalls.find(s => s.station.id === 'ship-reach')!, d = isle.stalls.find(s => s.station.id === 'ship-isle-verdant')!;
    expect(Math.hypot(c.x - d.x, c.y - d.y)).toBeGreaterThan(2 * TILE);
  });
});
