/**
 * td-hearth.spec.ts — where the Cold Hearth's fires stand: one in every capital and village of every continent, each on
 * open ground with room to stand in front, never on a stall or a prop; a Hearth Shrine beside each capital's.
 */
import { CONTINENTS } from './td-engine';
import { TdWorld } from './td-world';
import { TILE } from './td-art';
import { hearthContinent, hearthsOf } from './td-hearth';
import { isHearthId } from '../../shared/hearth/hearth-save.model';

describe('td-hearth (the hearths of the top-down world)', () => {
  it('places a hearth in every settlement and a shrine by every capital, with stable, valid ids', () => {
    const all: string[] = [];
    for (const [id, def] of Object.entries(CONTINENTS)) {
      const world = new TdWorld(def);
      const hs = hearthsOf(world);
      expect(hs.length).withContext(id).toBe(world.settlements.length);
      expect(hs.filter(h => h.capital).length).withContext(id).toBe(1);
      for (const h of hs) {
        expect(isHearthId(h.id)).withContext(h.id).toBeTrue();
        expect(hearthContinent(h.id)).toBe(id);
        expect(!!h.shrine).withContext(h.id).toBe(h.capital);
        // The fire blocks its own tile; the tile in front is open to stand on.
        const c = Math.floor(h.x / TILE), r = Math.floor((h.y - 1) / TILE);
        expect(world.walkable(c, r)).withContext(h.id).toBeFalse();
        expect(world.walkable(c, r + 1)).withContext(h.id).toBeTrue();
        // Never on or beside water or lava.
        for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) expect(['water', 'blackwater', 'ember']).withContext(`${h.id} ${dc},${dr}`).not.toContain(world.ground(c + dc, r + dr));
        // Its stall is the continent's, so E and a tap reach it.
        expect(world.stalls.some(s => s.station.id === h.id)).withContext(h.id).toBeTrue();
        if (h.shrine) expect(world.stalls.some(s => s.station.id === h.shrine!.id)).toBeTrue();
        all.push(h.id);
      }
      // Placed once: a second call returns the same list and adds no stalls.
      const stalls = world.stalls.length;
      expect(hearthsOf(world)).toBe(hs);
      expect(world.stalls.length).toBe(stalls);
      // Derived the same way on a fresh continent (the save keeps the ids).
      expect(hearthsOf(new TdWorld(def)).map(h => `${h.id}@${h.x},${h.y}`)).toEqual(hs.map(h => `${h.id}@${h.x},${h.y}`));
    }
    expect(new Set(all).size).toBe(all.length);
    expect(all).toContain('hearth:infernal-reach:pyrehold');
    expect(all).toContain('hearth:ember-isle:basalt-seamworks');
  });
});
