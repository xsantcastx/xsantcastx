/**
 * celestial.ts — the Celestial underside's broken rule, as pure functions (the
 * engine runs them; scripts/celestial-delve.test.cjs pins them). No DOM, no Angular.
 *
 * The rule (rift-gates.model.ts): DOWN IS NEGOTIABLE. The Orrery Wells lie
 * under the Celestial realm's towns, where the Meridian Compact once measured
 * the sky from underneath and left its instruments running. Said once, plainly,
 * the first time it applies (the engine's telegraph lines):
 *
 *  1. Orrery fields. Some open air is an ORRERY FIELD (it glitters, and its
 *     chevrons point its down). A field's down is decided by its ORRERY RINGS:
 *     brass (`a`) and the field falls up — the Keeper stands on its ceiling —
 *     blue (`b`) and it falls down as anywhere. A field is one connected run of
 *     field cells (and the rings in it); E at any of its rings turns every ring
 *     of that field, so a field never argues with itself. A field with no ring
 *     rests down.
 *  2. Star-wells. A STAR-WELL always falls up. A STAR-CHAIN beside every one is
 *     the way back down (climbing ignores down, whatever it is doing).
 *  3. The Keeper's down is the field at the middle of its body. Walk out of a
 *     field and the ordinary down comes back. There is no fall damage, falls are
 *     capped at TERMINAL_FALL (terrain.ts), and every field's rings sit where a
 *     Keeper can reach them standing on its floor AND standing on its ceiling,
 *     so no field is ever a trap (the generator places them; the tests check it).
 *  4. The Fallen Ephemeris: in orbit (its hall's field up) it rides the ceiling
 *     and no blow lands; turn the hall's field down and it drops into its own
 *     well, stunned for FALLEN_TIME; then it gathers itself (a GATHER_TELL
 *     second warning: the rings flash) and turns the field back up.
 *
 * The Orrery Key (carried): E anywhere in an orrery field turns its rings from
 * where you stand; and in a star-well, holding Down sinks against its pull.
 */
import { TERRAIN_NODE_LIST, type Terrain } from './terrain';

/** A field is flood-filled at most this many cells (bounds the work; the generator's fields are far smaller). */
export const FIELD_MAX = 1400;
/** The Fallen Ephemeris: seconds stunned in its well, seconds of warning before it turns the field back, its call. */
export const FALLEN_TIME = 9;
export const GATHER_TELL = 1.5;
/** When it rises: a pulse that hurts a Keeper within PULSE_CELLS of it. */
export const PULSE_CELLS = 3;
export const PULSE_HIT = 16;
/** In orbit it drifts toward the Keeper and swipes at one standing on its ceiling within SWIPE_CELLS. */
export const ORBIT_SPEED = 70;
export const SWIPE_CELLS = 3;
export const SWIPE_HIT = 14;
/** A star-well with the Orrery Key and Down held: the Keeper sinks at this speed (px/s) instead of falling up. */
export const KEY_SINK = 160;

const id = (name: string) => TERRAIN_NODE_LIST.findIndex(node => node.id === name);
export const C = {
  field: id('orrery-field'), well: id('star-well'), ringA: id('orrery-ring-a'), ringB: id('orrery-ring-b'), chain: id('star-chain'),
};

/** Down, as a sign: 1 the ordinary down, -1 up. */
export type Down = 1 | -1;

export function isRing(kind: number): boolean { return kind === C.ringA || kind === C.ringB; }
/** A cell that belongs to an orrery field (its air, or one of its rings). */
export function inField(kind: number): boolean { return kind === C.field || isRing(kind); }
/** A ring turned the other way. */
export function turnedRing(kind: number): number { return kind === C.ringA ? C.ringB : kind === C.ringB ? C.ringA : kind; }
/** A world cell as one number (stable however the loaded window moves). */
export function cellKey(col: number, row: number): number { return (col + 0x100000) * 256 + row; }

/** One orrery field: its cells (world keys) and its rings (world cells). */
export interface Field { cells: Set<number>; rings: { col: number; row: number }[] }

/**
 * The field the cell (col, row) belongs to: a flood through field cells and
 * rings (4-neighbour), at most FIELD_MAX cells. Null when the cell is not in a
 * field. Pure.
 */
export function fieldAt(t: Terrain, col: number, row: number): Field | null {
  if (!t.inside(col, row) || !inField(t.kind[t.index(col, row)])) return null;
  const cells = new Set<number>(), rings: { col: number; row: number }[] = [];
  const stack = [col, row];
  cells.add(cellKey(col, row));
  while (stack.length && cells.size < FIELD_MAX) {
    const r = stack.pop()!, c = stack.pop()!;
    if (isRing(t.kind[t.index(c, r)])) rings.push({ col: c, row: r });
    for (const [dc, dr] of NEIGHBOURS) {
      const nc = c + dc, nr = r + dr, key = cellKey(nc, nr);
      if (cells.has(key) || !t.inside(nc, nr) || !inField(t.kind[t.index(nc, nr)])) continue;
      cells.add(key); stack.push(nc, nr);
    }
  }
  return { cells, rings };
}
const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** A field's down: its first ring's (brass: up; blue: down). No ring: it rests down. Pure. */
export function fieldDown(t: Terrain, field: Field): Down {
  const ring = field.rings[0];
  if (!ring || !t.inside(ring.col, ring.row)) return 1;
  return t.kind[t.index(ring.col, ring.row)] === C.ringA ? -1 : 1;
}

/**
 * The down at a cell: a star-well's is up; an orrery field's is its rings';
 * anywhere else, the ordinary down. `field` (optional) is a cache the caller
 * keeps: the field already known to hold this cell. Pure.
 */
export function downAt(t: Terrain, col: number, row: number, field?: Field | null): Down {
  if (!t.inside(col, row)) return 1;
  const k = t.kind[t.index(col, row)];
  if (k === C.well) return -1;
  if (!inField(k)) return 1;
  const f = field && field.cells.has(cellKey(col, row)) ? field : fieldAt(t, col, row);
  return f ? fieldDown(t, f) : 1;
}

/**
 * Turn every ring of a field (the one holding the ring at (col, row)). Returns
 * the cells it changed (the caller saves them, as a dig). Pure apart from `t`.
 */
export function turnField(t: Terrain, field: Field): { col: number; row: number; kind: number }[] {
  const out: { col: number; row: number; kind: number }[] = [];
  for (const ring of field.rings) {
    if (!t.inside(ring.col, ring.row)) continue;
    const k = t.kind[t.index(ring.col, ring.row)];
    if (!isRing(k)) continue;
    const next = turnedRing(k);
    t.set(ring.col, ring.row, next);
    out.push({ col: ring.col, row: ring.row, kind: next });
  }
  return out;
}

/**
 * The no-softlock check (the generator's promise, the tests' assertion): every
 * ring-less field rests down (so it is plain air to a Keeper); every field with
 * rings has one a Keeper can reach standing on its floor and one reachable
 * standing on its ceiling. "Reach": the ring sits in the rows the Keeper's body
 * covers, `bodyRows` tall, standing on that floor / under that ceiling. Returns the cells (world keys)
 * of the field's floor and ceiling stands that reach no ring (empty: no trap). Pure.
 */
export function unreachableStands(t: Terrain, field: Field, bodyRows: number): number[] {
  if (!field.rings.length) return [];
  const bad: number[] = [];
  for (const key of field.cells) {
    const col = Math.floor(key / 256) - 0x100000, row = key % 256;
    // A floor stand: this cell is open, the one under it solid. A ceiling stand: the one over it solid.
    const floor = t.inside(col, row + 1) && t.solid(col, row + 1);
    const ceiling = t.inside(col, row - 1) && t.solid(col, row - 1);
    if (!floor && !ceiling) continue;
    const rows = floor ? [row - bodyRows + 1, row] : [row, row + bodyRows - 1];
    const reached = field.rings.some(ring => ring.row >= rows[0] && ring.row <= rows[1]);
    // The Keeper walks the stand to any ring in the band, so the band reaching one is enough.
    if (!reached) bad.push(key);
  }
  return bad;
}
