/**
 * td-harbour.spec.ts — the Harbourmasters and the Sailing Board (docs/design/realms-endgame.md §1): every pier has a
 * keeper who can be stood in front of, the board is composed from the continents' own ship ways (no second copy), fares
 * follow the hunt (economy-curve huntGold), and the states and warnings are what the doc says.
 */
import { CONTINENTS } from './td-engine';
import { TdWorld } from './td-world';
import { footFree, standNear } from './td-level';
import { NPC_LOOKS } from '../../shared/keeper-look/npc-looks';
import { huntGold } from '../../shared/economy/economy-curve';
import { HARBOUR_I18N } from '../harbour/harbour.i18n';
import { LANDS, PIERS, STORY_LOCKS_ENFORCED, buildBoard, cheapestFare, fareFor, isBerth, pierById, pierOfMaster, pierOfStation, routesFrom } from './td-harbour';

describe('td: harbour fares', () => {
  it('a fare is about ten steady kills at the destination\'s entry level, to the nearest ten', () => {
    for (const lv of [1, 8, 15, 25, 35, 45]) {
      const raw = huntGold(lv, 150);
      expect(fareFor(lv)).withContext(`L${lv}`).toBe(Math.round(raw / 10) * 10);
      expect(Math.abs(fareFor(lv) - raw)).toBeLessThanOrEqual(5);
    }
  });
  it('the doc\'s table, as the formula gives it (the doc\'s 20 for Ember Isle is the one it rounds past)', () => {
    expect(fareFor(8)).toBe(260);
    expect(fareFor(15)).toBe(470);
    expect(fareFor(25)).toBe(820);
  });
  it('fares only rise with the destination\'s level, and never fall to nothing', () => {
    let last = 0;
    for (const lv of [1, 8, 15, 25, 35, 45, 70]) { expect(fareFor(lv)).toBeGreaterThan(last); last = fareFor(lv); }
    expect(fareFor(0)).toBeGreaterThanOrEqual(10);
    expect(fareFor(NaN)).toBeGreaterThanOrEqual(10);
  });
});

describe('td: the piers and their Harbourmasters', () => {
  it('every ship way of every continent is moored at exactly one pier', () => {
    for (const def of Object.values(CONTINENTS)) {
      const ways = [...def.ways.filter(w => w.ship).map(w => w.station.id), ...(def.villages ?? []).flatMap(v => (v.ways ?? []).filter(w => w.ship).map(w => w.station.id))];
      for (const id of ways) expect(PIERS.filter(p => p.stations.includes(id)).length).withContext(id).toBe(1);
    }
  });
  it('every station a pier names is a real ship way on its continent, and every route lands at a pier', () => {
    for (const pier of PIERS) {
      const def = CONTINENTS[pier.continent];
      const ways = [...def.ways, ...(def.villages ?? []).flatMap(v => v.ways ?? [])];
      for (const st of pier.stations) expect(ways.some(w => w.station.id === st && w.ship)).withContext(`${pier.id}: ${st}`).toBeTrue();
      const routes = routesFrom(pier.id, CONTINENTS);
      expect(routes.length).withContext(pier.id).toBe(pier.stations.length);
      for (const r of routes) {
        expect(pierById(r.destPier)).withContext(`${pier.id} -> ${r.arrive}`).toBeDefined();
        expect(pierOfStation(r.arrive)?.continent).toBe(r.to);
      }
    }
  });
  it('nothing reachable by ship today is lost: the old ship ways are exactly the board\'s routes', () => {
    const edges = PIERS.flatMap(p => routesFrom(p.id, CONTINENTS).map(r => `${p.id}>${r.destPier}`)).sort();
    expect(edges).toEqual([
      'cinderport>ember-harbour', 'ember-harbour>mossharbor', 'ember-harbour>pyrehold', 'mirewatch>pyrehold',
      'mossharbor>ember-harbour', 'mossharbor>pyrehold', 'pyrehold>ember-harbour', 'pyrehold>mirewatch', 'pyrehold>mossharbor',
    ]);
  });
  it('each Harbourmaster stands on their pier as a keeper the Keeper can stand in front of, with a look and a line', () => {
    for (const pier of PIERS) {
      const world = new TdWorld(CONTINENTS[pier.continent]);
      const st = world.stalls.find(s => s.station.id === `giver-${pier.master.id}`);
      expect(st).withContext(pier.id).toBeDefined();
      expect(st!.keeper?.id).toBe(pier.master.id);
      const spot = standNear(world, st!.x, st!.y + 10);
      expect(footFree(world, spot.x, spot.y)).withContext(pier.id).toBeTrue();
      expect(['plank', 'boardwalk', 'sand', 'cobble', 'dirt']).withContext(`${pier.id} stands on ${world.ground(Math.floor(spot.x / 16), Math.floor((spot.y - 1) / 16))}`)
        .toContain(world.ground(Math.floor(spot.x / 16), Math.floor((spot.y - 1) / 16)));
      expect(NPC_LOOKS[pier.master.id]).withContext(pier.master.id).toBeDefined();
      expect(pierOfMaster(pier.master.id)).toBe(pier);
      for (const k of [`harbour.master.${pier.id}.role`, `harbour.master.${pier.id}.line`, `harbour.pier.${pier.id}`]) expect(HARBOUR_I18N[k]).withContext(k).toBeDefined();
    }
  });
  it('a berth is no longer a place: the ship stalls stay as arrival spots, never as things to use', () => {
    for (const pier of PIERS) for (const st of pier.stations) expect(isBerth(st)).toBeTrue();
    expect(isBerth('giver-harbourmaster-odd-tarn')).toBeFalse();
    for (const r of PIERS.flatMap(p => routesFrom(p.id, CONTINENTS))) expect(new TdWorld(CONTINENTS[r.to]).stalls.some(s => s.station.id === r.arrive)).withContext(r.arrive).toBeTrue();
  });
  it('every land has its text and a band', () => {
    for (const id of Object.keys(CONTINENTS)) { expect(LANDS[id]).withContext(id).toBeDefined(); expect(HARBOUR_I18N[`harbour.land.${id}`]).withContext(id).toBeDefined(); }
  });
});

describe('td: the Sailing Board', () => {
  const base = { continents: CONTINENTS, level: 30, gold: 100_000 };
  it('Pyrehold lists three ships, the cheapest (home) first', () => {
    const rows = buildBoard('pyrehold', base);
    expect(rows.map(r => r.destPier)).toEqual(['ember-harbour', 'mossharbor', 'mirewatch']);
    expect(rows.map(r => r.fare)).toEqual([fareFor(1), fareFor(15), fareFor(25)]);
    expect(rows.every(r => r.state === 'ok' && !r.warn)).toBeTrue();
  });
  it('each row carries its destination, its continent, its band and the way the engine sails it', () => {
    const rows = buildBoard('ember-harbour', base);
    const reach = rows.find(r => r.destPier === 'pyrehold')!;
    expect(reach).toEqual(jasmine.objectContaining({ continent: 'infernal-reach', band: [8, 30], entry: 8, to: 'infernal-reach', arrive: 'ship-isle', id: 'ship-reach' }));
    const wilds = rows.find(r => r.destPier === 'mossharbor')!;
    expect(wilds.long).toBeTrue();
    expect(wilds.arrive).toBe('ship-mossharbor-isle');
  });
  it('short of gold is a state with its fare, never a hidden row', () => {
    const rows = buildBoard('mossharbor', { ...base, gold: 100 });
    expect(rows.length).toBe(2);
    expect(rows.find(r => r.destPier === 'pyrehold')!.state).toBe('broke');
    expect(rows.find(r => r.destPier === 'ember-harbour')!.state).toBe('ok');
    expect(buildBoard('mossharbor', { ...base, gold: fareFor(8) }).find(r => r.destPier === 'pyrehold')!.state).toBe('ok');
    expect(buildBoard('mossharbor', { ...base, gold: fareFor(8) - 1 }).find(r => r.destPier === 'pyrehold')!.state).toBe('broke');
  });
  it('a level below the destination is a soft warning: the row stays sailable', () => {
    const rows = buildBoard('pyrehold', { ...base, level: 5 });
    expect(rows.find(r => r.destPier === 'mirewatch')).toEqual(jasmine.objectContaining({ warn: true, state: 'ok' }));
    expect(rows.find(r => r.destPier === 'ember-harbour')!.warn).toBeFalse();
  });
  it('the story locks are a data hook: nothing is locked today, and they bite only when enforced', () => {
    expect(STORY_LOCKS_ENFORCED).toBeFalse();
    expect(buildBoard('pyrehold', base).some(r => r.state === 'locked')).toBeFalse();
    const locked = buildBoard('pyrehold', { ...base, enforceStory: true, cleared: new Set<string>() });
    expect(locked.find(r => r.destPier === 'mirewatch')).toEqual(jasmine.objectContaining({ state: 'locked', gate: 'elder-rootwyrm' }));
    expect(locked.find(r => r.destPier === 'ember-harbour')!.state).toBe('ok');   // sailing home is never gated
    expect(locked.map(r => r.state).lastIndexOf('ok')).toBeLessThan(locked.map(r => r.state).indexOf('locked'));
    const open = buildBoard('pyrehold', { ...base, enforceStory: true, cleared: new Set(['cinder-sovereign', 'elder-rootwyrm']) });
    expect(open.some(r => r.state === 'locked')).toBeFalse();
  });
  it('an unknown pier has no board, and a pier\'s cheapest fare is its home run', () => {
    expect(buildBoard('nowhere', base)).toEqual([]);
    expect(cheapestFare('pyrehold', CONTINENTS)).toBe(fareFor(1));
    expect(cheapestFare('cinderport', CONTINENTS)).toBe(fareFor(1));
  });
  it('every lock reason has its text', () => {
    for (const land of Object.values(LANDS)) if (land.gate) expect(HARBOUR_I18N[`harbour.lock.${land.gate}`]).withContext(land.gate).toBeDefined();
  });
});
