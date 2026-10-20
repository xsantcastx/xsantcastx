/**
 * td-deep.spec.ts — the Molten Deep's lower floors (−4…−6), the Forge of the Four (−1…−3) and Cinderport's ship
 * (docs/design/world-map.md): every way leads somewhere real, the bosses call their help once, the Forge's gate is
 * never a death trap, and the ship sails from a pier the Keeper can stand on.
 */
import type { EngineOptions } from '../engine/engine.model';
import { MOBS, MobSystem, type Mob, type MobHost } from './td-mobs';
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

describe('td: the deep creatures', () => {
  for (const id of ['slag-crawler', 'glass-sentinel', 'anvil-warden', 'cinder-sovereign']) {
    it(`${id} has a combat profile at its own level`, () => {
      const p = CREATURE_PROFILES.find(x => x.creature === id);
      expect(p).withContext(id).toBeDefined();
      expect(p!.level).toBe(MOBS[id].level);
      expect(!!p!.boss).toBe(MOBS[id].rank === 'boss');
    });
  }
  for (const [boss, help] of [['cinder-sovereign', 'lava-hound'], ['anvil-warden', 'cinder-bailiff']] as const) {
    it(`${boss} calls two ${help}s once, at half its life`, () => {
      const sys = mobs();
      sys.addSpawns([{ key: 'b', type: boss, x: 0, y: 0 }]);
      const m = sys.mobs.find(x => x.key === 'b')!;
      m.hp = m.def.hp * .5 + 1;
      hit(sys, m);
      expect(sys.mobs.filter(x => x.def.id === help).length).toBe(2);
      hit(sys, m);
      expect(sys.mobs.filter(x => x.def.id === help).length).toBe(2);
    });
  }
});

describe('td: the ways down and the ship', () => {
  it('every stair on every hand-drawn floor leads to a level that exists, in front of a station that is there', () => {
    for (const [id, def] of Object.entries(LEVELS)) {
      for (const [station, exit] of new HandLevel(def).exits) {
        if (exit.to === 'surface') continue;
        const there = LEVELS[exit.to];
        expect(there).withContext(`${id} ${station} → ${exit.to}`).toBeDefined();
        expect(new HandLevel(there).stalls.some(s => s.station.id === exit.arrive)).withContext(`${id} ${station} → ${exit.to} ${exit.arrive}`).toBeTrue();
      }
    }
  });
  it('the Molten Deep goes down six floors, the Sovereign on the last; the Forge of the Four three, the Anvil-Warden on the last', () => {
    for (const [base, floors, boss] of [['molten-deep', 6, 'cinder-sovereign'], ['forge-of-four', 3, 'anvil-warden']] as const) {
      for (let f = 1; f < floors; f++) expect([...new HandLevel(LEVELS[`${base}-${f}`]).exits.values()].some(e => e.to === `${base}-${f + 1}`)).withContext(`${base} ${f}`).toBeTrue();
      expect(new HandLevel(LEVELS[`${base}-${floors}`]).spawnsIn().some(s => s.type === boss)).toBeTrue();
    }
  });
  it('no wild pack spawns within eight tiles of the Forge of the Four\'s gate, and the gate is a way in', () => {
    const reach = new TdWorld(CONTINENTS['infernal-reach']);
    const gate = reach.def.places.find(p => p.kind === 'forge')!;
    const x = gate.c * TILE, y = gate.r * TILE;
    const near = reach.spawnsIn(x - 12 * TILE, y - 12 * TILE, x + 12 * TILE, y + 12 * TILE).filter(s => Math.hypot(s.x / TILE - gate.c, s.y / TILE - gate.r) < 8);
    expect(near).toEqual([]);
    expect(reach.ways.get('forge-of-four')?.to).toBe('forge-of-four-1');
  });
  it('Cinderport\'s ship sails to Ember Isle, into Ember Harbour, boarded from its own pier', () => {
    const reach = new TdWorld(CONTINENTS['infernal-reach']);
    const way = reach.ways.get('ship-cinderport')!;
    expect(way).toEqual({ to: 'ember-isle', arrive: 'ship-reach', ship: true });
    const isle = new TdWorld(CONTINENTS['ember-isle']);
    expect(isle.stalls.some(s => s.station.id === 'ship-reach')).toBeTrue();
    const st = reach.stalls.find(s => s.station.id === 'ship-cinderport')!;
    const spot = standNear(reach, st.x, st.y + 10);
    expect(footFree(reach, spot.x, spot.y)).toBeTrue();
    expect(reach.ground(Math.floor(spot.x / TILE), Math.floor((spot.y - 1) / TILE))).toBe('plank');
    expect(reach.placeName(st.x, st.y)).toBe('Cinderport');
  });
});
