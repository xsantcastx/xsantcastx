import { CELL, nodeIndex, stepTerrainBodyUp, TERMINAL_FALL, Terrain, TERRAIN_NODE_LIST } from './terrain';
import { C, downAt, fieldAt, fieldDown, turnField, turnedRing, unreachableStands } from './celestial';
import { celestialColumn, CELESTIAL_EDGE, TURNING_ROOM } from './celestial-gen';
import { CELESTIAL_DELVE } from '../world/towns/celestial-delve';
import { realmSeed } from '../../shared/delve/rift-gates.model';
import { SECTOR } from './gen-kit';

/** A room: rock shell, cols 1..12 × rows 1..4 open; a field over cols 3..8 with rings at (3,2) and (8,3). */
function room(ring = C.ringB): Terrain {
  const t = new Terrain(14, 6, 0);
  const rock = nodeIndex('astral-stone');
  for (let c = 0; c < 14; c++) { t.kind[t.index(c, 0)] = rock; t.kind[t.index(c, 5)] = rock; }
  for (let r = 0; r < 6; r++) { t.kind[t.index(0, r)] = rock; t.kind[t.index(13, r)] = rock; }
  for (let c = 3; c <= 8; c++) for (let r = 1; r <= 4; r++) t.kind[t.index(c, r)] = C.field;
  t.kind[t.index(3, 2)] = ring; t.kind[t.index(8, 3)] = ring;
  return t;
}

describe('the Orrery Wells: down is negotiable (celestial.ts)', () => {
  it('a field falls the way its rings say; E turns every ring of it at once', () => {
    const t = room();
    expect(downAt(t, 5, 2)).toBe(1);
    const field = fieldAt(t, 5, 2)!;
    expect(field.rings.length).toBe(2);
    expect(turnField(t, field).length).toBe(2);
    expect(downAt(t, 5, 2)).toBe(-1);
    expect(fieldDown(t, field)).toBe(-1);
    expect(downAt(t, 10, 2)).withContext('plain air beside it').toBe(1);
    expect(turnedRing(turnedRing(C.ringA))).toBe(C.ringA);
  });

  it('every field cell is in reach of a ring standing on its floor and on its ceiling (no softlock)', () => {
    const t = room();
    expect(unreachableStands(t, fieldAt(t, 5, 2)!, 3).length).toBe(0);
    // Move the rings out of the ceiling's reach: the check names the ceiling stands.
    t.kind[t.index(3, 2)] = C.field; t.kind[t.index(3, 4)] = C.ringB;
    t.kind[t.index(8, 3)] = C.field; t.kind[t.index(8, 4)] = C.ringB;
    expect(unreachableStands(t, fieldAt(t, 5, 2)!, 2).length).toBeGreaterThan(0);
  });

  it('a star-well falls up, a star-chain is climbed, none of them is solid', () => {
    const t = room();
    t.kind[t.index(10, 2)] = C.well;
    expect(downAt(t, 10, 2)).toBe(-1);
    expect(TERRAIN_NODE_LIST[C.chain].climb).toBeTrue();
    for (const k of [C.field, C.well, C.ringA, C.ringB, C.chain]) expect(TERRAIN_NODE_LIST[k].solid).toBeFalse();
  });

  it('falling up lands the head on the ceiling, never faster than any fall', () => {
    const t = room();
    const body = { x: 5.5 * CELL, y: 5 * CELL, vy: 0, grounded: true };
    let fastest = 0;
    for (let n = 0; n < 90; n++) { stepTerrainBodyUp(body, 0, 1 / 60, t, { halfWidth: 13, height: 90 }, 14 * CELL); fastest = Math.max(fastest, -body.vy); }
    expect(body.grounded).toBeTrue();
    expect(body.y - 90).toBe(CELL);
    expect(fastest).toBeLessThanOrEqual(TERMINAL_FALL);
  });

  it('the generator lays the Turning Room in the core for any seed, deterministically', () => {
    const ctx = { spec: CELESTIAL_DELVE.terrain!, seed: realmSeed(424242, 'celestial'), gv: 1, rows: 64 };
    const a = celestialColumn(ctx, 1), b = celestialColumn(ctx, 1);
    expect(Array.from(a.kind)).toEqual(Array.from(b.kind));
    const at = (col: number, row: number) => a.kind[row * SECTOR + (col & 31)];
    expect(at(TURNING_ROOM.ring.col, TURNING_ROOM.ring.row)).toBe(C.ringB);
    expect(at(TURNING_ROOM.pitRing.col, TURNING_ROOM.pitRing.row)).toBe(C.ringB);
    expect(CELESTIAL_EDGE).toBe(31);
  });
});
