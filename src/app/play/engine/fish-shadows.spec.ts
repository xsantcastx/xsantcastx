import { CELL, LIQUID_FULL, LIQUID_LAVA, LIQUID_WATER, Terrain } from './terrain';
import { placeFish, type FishShadow } from './fish-shadows';

/** A lake: cols 2..37, rows 10..12 full of `liquid` (row 10 is the surface row). */
function lake(liquid = LIQUID_WATER): Terrain {
  const t = new Terrain(40, 20, 0);
  for (let row = 10; row <= 12; row++) for (let col = 2; col <= 37; col++) {
    const i = t.index(col, row);
    t.liqType[i] = liquid; t.liqLevel[i] = LIQUID_FULL;
  }
  return t;
}

describe('fish shadows (where are the fish?)', () => {
  it('a lake holds fish, under its surface row, inside the water', () => {
    const t = lake(), out: FishShadow[] = [];
    const n = placeFish(t, 0, 39, 0, 19, 0, null, out, 24);
    expect(n).toBeGreaterThan(0);
    for (const f of out.slice(0, n)) {
      const row = Math.floor(f.y / CELL);
      expect(row).toBeGreaterThanOrEqual(11);
      expect(row).toBeLessThanOrEqual(12);
      const col = Math.floor(f.x / CELL);
      expect(col).toBeGreaterThanOrEqual(2); expect(col).toBeLessThanOrEqual(37);
    }
  });

  it('is the same lake every time (deterministic homes)', () => {
    const a: FishShadow[] = [], b: FishShadow[] = [];
    const na = placeFish(lake(), 0, 39, 0, 19, 3.5, null, a, 24), nb = placeFish(lake(), 0, 39, 0, 19, 3.5, null, b, 24);
    expect(na).toBe(nb);
    expect(a.slice(0, na)).toEqual(b.slice(0, nb));
  });

  it('more gather near a cast line, and draw toward the bob', () => {
    const t = lake(), far: FishShadow[] = [], near: FishShadow[] = [];
    const nFar = placeFish(t, 14, 26, 0, 19, 0, null, far, 99);
    const line = { col: 20, row: 10, phase: 'wait' as const, bobX: 20.5 * CELL };
    const nNear = placeFish(t, 14, 26, 0, 19, 2, line, near, 99);
    expect(nNear).toBeGreaterThan(nFar);
  });

  it('none in lava, a puddle or past the cap', () => {
    expect(placeFish(lake(LIQUID_LAVA), 0, 39, 0, 19, 0, null, [], 24)).toBe(0);
    const puddle = new Terrain(40, 20, 0);
    for (let col = 2; col <= 37; col++) { const i = puddle.index(col, 10); puddle.liqType[i] = LIQUID_WATER; puddle.liqLevel[i] = LIQUID_FULL; }
    expect(placeFish(puddle, 0, 39, 0, 19, 0, null, [], 24)).toBe(0);
    expect(placeFish(lake(), 0, 39, 0, 19, 0, null, [], 1)).toBeLessThanOrEqual(1);
  });
});
