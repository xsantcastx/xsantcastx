/**
 * td-arrival.spec.ts — arriving never sets the Keeper inside a wall (owner 2026-10-20: "I get stuck frequently inside
 * caves or buildings"). For every door, stair, ladder and cave mouth on every hand-drawn level and every continent,
 * the spot the engine puts the Keeper on is free, close to the way in, and has room to walk away from.
 */
import { CONTINENTS, LEVELS } from './td-engine';
import { HandLevel, footFree, standNear } from './td-level';
import { TdWorld } from './td-world';
import { TILE } from './td-art';

type Walkable = { walkable(c: number, r: number): boolean };

function canStepAway(level: Walkable, x: number, y: number): boolean {
  return [[6, 0], [-6, 0], [0, 6], [0, -6]].some(([dx, dy]) => footFree(level, x + dx, y + dy));
}

describe('td arrival (never inside a wall)', () => {
  for (const [id, def] of Object.entries(LEVELS)) {
    it(`${id}: every way in sets the Keeper down free, near it, with room to move`, () => {
      const level = new HandLevel(def);
      expect(level.stalls.length).toBeGreaterThan(0);
      for (const s of level.stalls) {
        const spot = standNear(level, s.x, s.y + 10);
        expect(footFree(level, spot.x, spot.y)).withContext(`${id} ${s.station.id}`).toBeTrue();
        expect(Math.hypot(spot.x - s.x, spot.y - s.y)).withContext(`${id} ${s.station.id} distance`).toBeLessThan(TILE * 3);
        expect(canStepAway(level, spot.x, spot.y)).withContext(`${id} ${s.station.id} boxed in`).toBeTrue();
      }
    });
  }
  for (const [id, def] of Object.entries(CONTINENTS)) {
    it(`${id}: every door, cave mouth and pier sets the Keeper down free`, () => {
      const world = new TdWorld(def);
      for (const s of world.stalls) {
        const spot = standNear(world, s.x, s.y + 10);
        expect(footFree(world, spot.x, spot.y)).withContext(`${id} ${s.station.id}`).toBeTrue();
        expect(canStepAway(world, spot.x, spot.y)).withContext(`${id} ${s.station.id} boxed in`).toBeTrue();
      }
    });
  }
  it('the old spot (two rows under a door on a bottom row) was inside the wall', () => {
    const level = new HandLevel(LEVELS['ember-inn-1']);
    const door = level.stalls.find(s => s.station.id === 'inn-out')!;
    expect(footFree(level, door.x, door.y + 14)).toBeFalse();
  });
});
