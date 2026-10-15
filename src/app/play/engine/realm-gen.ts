/**
 * realm-gen.ts — the realm Delves behind the Rift Gates (shared/delve/
 * rift-gates.model.ts). Pure: no DOM, no Angular. Here: the Umbral's
 * underside, the Ink Deeps (the Verdant's and the Luminous's dispatch to
 * verdant-gen.ts and luminous-gen.ts, sharing realm-kit.ts) (lore-addendum.md, "The Rift Gates": shipped —
 * owner reviews in play).
 *
 * The same rules as the Ember Delve's wings (sector-gen.ts): integer hashing
 * and + − × ÷ only, caves from noise of the WORLD cell (no seam at a sector
 * border), veins rolled per sector and clipped, structures from their lattice
 * cell's own seed and never outside it, so any sector column is the same bytes
 * on any device, in any order. The difference: there is no shipped core to
 * copy. Lattice cell 0 (world columns 0..63, the realm spec's `cols`) is the
 * hand-laid core: the Gate Hollow where the return gate stands, and under it
 * the Gloam Warden's hall. Its cells are saved like the Ember Delve's core
 * (the Delve index, under the realm's area id); the rest in the realm's own
 * region slots.
 *
 *   rows 0–1     the realm's floor above, seen from under it (bedrock)
 *   rows 2–30    the Ink Shallows: ink-slate, winding tunnels, ink pools with
 *                seeps, drift pockets (unlit passages that move)
 *   rows 31–61   the Gloam Deep: gloam-slate, broad caverns, mirrored ceilings,
 *                shade dens with nightglass in their walls
 *   rows 62–63   bedrock
 *
 * The broken rule (the Umbral's; the engine runs it, umbral.ts): the dark is
 * unreliable. A drift pocket is generated in its A layout (the upper route
 * open); the engine moves it to B and back while nobody can see it.
 */
import { FIELD_NOTE_PREFIX, fieldNotePool } from '../../shared/delve/field-notes.model';
import { REALM_ARRIVAL } from '../../shared/delve/rift-gates.model';
import { LIQUID_INK, nodeIndex, seededRandom } from './terrain';
import {
  AIR, BEDROCK, Builder, LATTICE, latticeCache, mix32, noiseColumn, SECTOR, sectorSeed, valueNoise1,
  type LatticeCache, type SectorColumnGen, type StructureKind,
} from './gen-kit';
import type { RealmContext } from './realm-kit';
import { verdantColumn, verdantNodes, verdantPlans } from './verdant-gen';
import { luminousColumn, luminousNodes, luminousPlans } from './luminous-gen';
import { celestialColumn, celestialNodes, celestialPlans } from './celestial-gen';

export type { RealmContext } from './realm-kit';

const U = {
  slate: nodeIndex('ink-slate'), gloam: nodeIndex('gloam-slate'), inkstone: nodeIndex('inkstone-vein'), nightglass: nodeIndex('nightglass-vein'),
  seep: nodeIndex('ink-seep'), drift: nodeIndex('drift-shale'), mirror: nodeIndex('ink-mirror'), brazier: nodeIndex('gloam-brazier'),
  frame: nodeIndex('rift-frame'), gate: nodeIndex('rift-gate-umbral'),
};

/** Every node the Umbral generator lays (the meaning check reads it through SECTOR_NODES). */
export function umbralNodes(): string[] {
  return ['ink-slate', 'gloam-slate', 'inkstone-vein', 'nightglass-vein', 'ink-seep', 'drift-shale', 'ink-mirror', 'gloam-brazier', 'rift-frame', 'rift-gate-umbral'];
}
/** Every node any realm generator lays (the Umbral's, the Verdant's, the Luminous's, the Celestial's). */
export function realmNodes(): string[] {
  return [...umbralNodes(), ...verdantNodes(), ...luminousNodes(), ...celestialNodes()];
}

/** The Ink Shallows end and the Gloam Deep begins about here (the edge wanders ±3). */
export const UMBRAL_EDGE = 31;
const CEILING = 2;

// ── The core: the Gate Hollow and the Gloam Warden's hall (every seed) ──────

/** The Gate Hollow: the hall the return gate stands in. Interior rows 24..30; its floor is row 31. */
export const GATE_HOLLOW = { col: 16, row: 24, w: 32, h: 7 } as const;
/** The return gate's opening (2 × 3), on the hollow's floor. */
export const RETURN_GATE = { col: 31, row: 28, w: 2, h: 3 } as const;
/** The Gloam Warden's hall, under the hollow: a mirrored ceiling, three braziers, an unbreakable floor. */
export const WARDEN_HALL = { col: 6, row: 44, w: 52, h: 10 } as const;
export const WARDEN_BRAZIERS: readonly number[] = [12, 32, 52];
/** The inkstone outcrop in the Gate Hollow, east of the arrival: three cells, floor to head height (the first swing finds ore). */
export const INK_SEAM = { col: 39, row: 28, h: 3 } as const;
/** The drift pocket the Gate Hollow's east tunnel runs through (the first one a Keeper meets). */
const CORE_POCKET = { col: 50, row: 28, w: 8, h: 3 } as const;

// ── Structures ──────────────────────────────────────────────────────────────

export interface RealmPlan { kind: StructureKind; col: number; row: number; w: number; h: number; salt: number }

/** Interior width range and height of each kind. */
const SIZE: Readonly<Partial<Record<StructureKind, { w: readonly [number, number]; h: number }>>> = {
  'ink-pool': { w: [12, 18], h: 5 },
  'drift-pocket': { w: [8, 12], h: 3 },
  'mirror-cavern': { w: [20, 28], h: 7 },
  'shade-den': { w: [16, 22], h: 5 },
};
const SHALLOWS: readonly [number, number] = [5, 22];
const DEEP: readonly [number, number] = [35, 52];
const TABLE_SHALLOWS: readonly [StructureKind, number][] = [['ink-pool', .42], ['drift-pocket', .38]];
const TABLE_DEEP: readonly [StructureKind, number][] = [['mirror-cavern', .34], ['shade-den', .34], ['drift-pocket', .18]];
/** Cells a structure keeps from its lattice cell's sides (its shell and its entries). */
const MARGIN = 6;

/**
 * The structures of lattice cell `cell`: the core's set pieces in cell 0,
 * else one per band at most, from the cell's own seed. Pure.
 */
export function realmPlans(ctx: RealmContext, cell: number): RealmPlan[] {
  // The Verdant's and the Luminous's undersides have their own generators (verdant-gen.ts, luminous-gen.ts).
  if (ctx.spec.realm === 'verdant') return verdantPlans(ctx, cell);
  if (ctx.spec.realm === 'luminous') return luminousPlans(ctx, cell);
  if (ctx.spec.realm === 'celestial') return celestialPlans(ctx, cell);
  const span = LATTICE * SECTOR, x = cell * span;
  if (x < ctx.spec.cols && x + span > 0) {
    return [
      { kind: 'gate-hollow', ...GATE_HOLLOW, salt: 1 },
      { kind: 'warden-hall', ...WARDEN_HALL, salt: 2 },
      { kind: 'drift-pocket', ...CORE_POCKET, salt: 3 },
    ];
  }
  const out: RealmPlan[] = [];
  const salt0 = mix32((ctx.seed ^ mix32(Math.imul(cell, 0x632BE5AB)) ^ 0x5bd1e995 ^ Math.imul(ctx.gv, 0x27d4eb2f)) >>> 0);
  for (let band = 0; band < 2; band++) {
    const salt = mix32((salt0 ^ Math.imul(band + 1, 0x85EBCA77)) >>> 0);
    const r = seededRandom(salt);
    const roll = r();
    let kind: StructureKind | null = null, acc = 0;
    for (const [k, weight] of band === 0 ? TABLE_SHALLOWS : TABLE_DEEP) { acc += weight; if (roll < acc) { kind = k; break; } }
    if (!kind) continue;
    const size = SIZE[kind]!;
    const w = size.w[0] + Math.floor(r() * (size.w[1] - size.w[0] + 1));
    const [lo, hi] = band === 0 ? SHALLOWS : DEEP;
    const row = lo + Math.floor(r() * Math.max(1, hi - lo - size.h + 1));
    const col = x + MARGIN + Math.floor(r() * Math.max(1, span - 2 * MARGIN - w));
    out.push({ kind, col, row, w, h: size.h, salt: mix32(salt ^ 0x51ed270b) });
  }
  return out;
}

/**
 * A drift pocket's two states: 0, the passage is there (as generated); 1, the
 * drift-shale has filled it. The engine (umbral.ts) moves a pocket only while
 * no light reaches it and the Keeper cannot see it; a torch inside pins it.
 */
export type PocketPhase = 0 | 1;
export const POCKET_ROWS = 3;

function stamp(b: Builder, plan: RealmPlan, out: SectorColumnGen, deep: boolean): void {
  const { col: x, row: y, w, h } = plan;
  const r = seededRandom(plan.salt);
  const rock = deep ? U.gloam : U.slate;
  const note = (): string | null => {
    const pool = fieldNotePool('umbral');
    return pool.length ? FIELD_NOTE_PREFIX + pool[Math.floor(r() * pool.length)] : null;
  };
  switch (plan.kind) {
    case 'ink-pool': {
      // A basin of ink under a low roof: shores either side, seeps weeping into it, inkstone in the walls.
      b.rect(x - 1, y - 1, w + 2, 1, rock);
      b.rect(x, y, w, h, AIR);
      b.rect(x - 1, y + 2, 1, h - 1, rock); b.rect(x + w, y + 2, 1, h - 1, rock);
      b.rect(x - 1, y + h, w + 2, 1, rock);
      b.rect(x, y + h - 2, 2, 2, rock); b.rect(x + w - 2, y + h - 2, 2, 2, rock);
      b.liquid(x + 2, y + h - 2, w - 4, 2, LIQUID_INK);
      for (let c = x + 1; c < x + w - 1; c += 4 + Math.floor(r() * 3)) b.put(c, y - 1, U.seep);
      b.dress(x - 2, y + 2, U.inkstone); b.dress(x + w + 1, y + 3, U.inkstone);
      if (r() < .6) { const id = note(); if (id) b.note(x + 1, y + 1, id); }
      break;
    }
    case 'drift-pocket': {
      // A passage that is only there while nobody looks: open as generated, a shale roof and floor round it.
      b.rect(x - 2, y - 1, w + 4, 1, rock); b.rect(x - 2, y + h, w + 4, 1, rock);
      b.rect(x - 2, y, w + 4, h, AIR);
      break;
    }
    case 'mirror-cavern': {
      // A tall cavern whose roof is ink polished by the tide: your reflection walks on it.
      b.rect(x, y, w, h, AIR);
      b.rect(x, y - 1, w, 1, U.mirror);
      b.rect(x - 1, y + h, w + 2, 1, rock);
      b.rect(x - 1, y + h - 3, 1, 3, AIR); b.rect(x + w, y + h - 3, 1, 3, AIR);
      if (r() < .5) { const id = note(); if (id) b.note(x + w - 2, y + h - 2, id); }
      break;
    }
    case 'shade-den': {
      // Where the shades rest: a long low hall, nightglass in the walls (worth the dark).
      b.rect(x, y, w, h, AIR);
      b.rect(x - 1, y + h, w + 2, 1, rock);
      for (let n = 0; n < 3; n++) b.dress(x + 2 + Math.floor(r() * (w - 4)), y - 1, U.nightglass);
      b.dress(x - 1, y + 2, U.nightglass);
      out.halls.push({ creature: 'shadeling', count: 2 + (r() < .5 ? 1 : 0), col0: x, col1: x + w, floorRow: y + h });
      break;
    }
    case 'gate-hollow': {
      // The return gate's hall: the gate on a frame of rift stone, tunnels east and west, a pool of ink to learn on.
      const G = GATE_HOLLOW, R = RETURN_GATE;
      b.rect(G.col - 1, G.row - 1, G.w + 2, 1, U.slate);
      b.rect(G.col, G.row, G.w, G.h, AIR);
      b.rect(G.col - 1, G.row + G.h, G.w + 2, 1, U.slate);
      b.rect(0, R.row, G.col, 3, AIR); b.rect(G.col + G.w, R.row, 64 - G.col - G.w, 3, AIR);
      b.rect(0, R.row - 1, G.col, 1, U.slate); b.rect(0, R.row + 3, G.col, 1, U.slate);
      // The gate: a lintel of rift stone over the opening (walked through, never dug), a frame floor under it.
      for (let dc = -1; dc <= R.w; dc++) b.put(R.col + dc, R.row - 1, U.frame, true);
      for (let dr = 0; dr < R.h; dr++) for (let dc = 0; dc < R.w; dc++) b.put(R.col + dc, R.row + dr, U.gate, true);
      for (let dc = -2; dc < R.w + 2; dc++) b.put(R.col + dc, G.row + G.h, U.frame, true);
      // A basin of ink in the west floor: the first ink a Keeper meets is shallow and safe.
      b.rect(18, 31, 8, 2, AIR); b.rect(17, 31, 1, 2, U.slate); b.rect(26, 31, 1, 2, U.slate); b.rect(17, 33, 10, 1, U.slate);
      b.liquid(18, 31, 8, 2, LIQUID_INK);
      b.put(21, G.row - 1, U.seep); b.put(28, G.row - 1, U.seep);
      b.dress(G.col + G.w, G.row + 2, U.inkstone); b.dress(G.col + G.w, G.row + 3, U.inkstone);
      // The first swing finds ore: an inkstone outcrop standing in the hollow, east of the arrival.
      for (let r = INK_SEAM.row; r < INK_SEAM.row + INK_SEAM.h; r++) b.put(INK_SEAM.col, r, U.inkstone);
      b.note(41, 29, `${FIELD_NOTE_PREFIX}umbral-rooks-chalk`);
      break;
    }
    case 'warden-hall': {
      // The Gloam Warden's hall: a mirrored ceiling, three braziers, a floor of rift stone (it does not break).
      const H = WARDEN_HALL;
      b.rect(H.col, H.row, H.w, H.h, AIR);
      b.rect(H.col, H.row - 1, H.w, 1, U.mirror);
      b.rect(H.col - 1, H.row + H.h, H.w + 2, 1, U.frame);
      b.rect(H.col - 1, H.row, 1, H.h, U.gloam); b.rect(H.col + H.w, H.row, 1, H.h, U.gloam);
      for (const c of WARDEN_BRAZIERS) b.put(c, H.row + H.h - 1, U.brazier, true);
      b.note(H.col + 2, H.row + H.h - 3, `${FIELD_NOTE_PREFIX}umbral-warden-oath`);
      for (let n = 0; n < 4; n++) b.dress(H.col + 4 + n * 12, H.row - 2, U.nightglass);
      break;
    }
  }
}

// ── The column ──────────────────────────────────────────────────────────────

const scratch = Array.from({ length: 4 }, () => new Float64Array(64));
const caches: LatticeCache[] = Array.from({ length: 4 }, latticeCache);

/** Veins of the Ink Deeps: `count` blobs per sector column over the row range. */
const VEINS: readonly { node: number; from: number; to: number; count: number; size: number }[] = [
  { node: U.inkstone, from: 6, to: 40, count: 4, size: 4 },
  { node: U.seep, from: 4, to: 30, count: 3, size: 2 },
  { node: U.nightglass, from: 34, to: 60, count: 3, size: 3 },
];

/** Generate sector column `sx` of a realm Delve (all rows). Same (context, sx) → the same arrays. */
export function realmColumn(ctx: RealmContext, sx: number): SectorColumnGen {
  if (ctx.spec.realm === 'verdant') return verdantColumn(ctx, sx);
  if (ctx.spec.realm === 'luminous') return luminousColumn(ctx, sx);
  if (ctx.spec.realm === 'celestial') return celestialColumn(ctx, sx);
  const rows = ctx.rows, n = SECTOR * rows, col0 = sx * SECTOR, s = ctx.seed;
  const out: SectorColumnGen = {
    sx, gv: ctx.gv,
    kind: new Uint8Array(n), liqType: new Uint8Array(n), liqLevel: new Uint8Array(n), protect: new Uint8Array(n),
    notes: new Map(), halls: [], structures: [],
  };
  if (scratch[0].length < rows) for (let k = 0; k < scratch.length; k++) scratch[k] = new Float64Array(rows);
  const floor = rows - 2;
  for (let lc = 0; lc < SECTOR; lc++) {
    const col = col0 + lc;
    const wind = noiseColumn(s ^ 0x13579bdf, col / 10, 4.5, rows, scratch[0], caches[0]);
    const blob = noiseColumn(s ^ 0x2468ace0, col / 16, 7, rows, scratch[1], caches[1]);
    const deepA = noiseColumn(s ^ 0x0badf00d, col / 18, 6, rows, scratch[2], caches[2]);
    const deepB = noiseColumn(s ^ 0x5eedc0de, col / 7, 3, rows, scratch[3], caches[3]);
    const edge = UMBRAL_EDGE + Math.round((valueNoise1(s ^ 0x7a3c1e55, col / 9) * 2 - 1) * 3);
    for (let row = 0; row < rows; row++) {
      const i = row * SECTOR + lc;
      if (row < CEILING || row >= floor) { out.kind[i] = BEDROCK; continue; }
      let cave = false;
      if (row >= CEILING + 2 && row < floor - 1) {
        cave = row < edge
          // The shallows wind: the 0.5 contour of one field, widened where a second swells.
          ? Math.abs(wind[row] - .5) < .06 + Math.max(0, blob[row] - .62) * .5
          // The deep opens broad caverns.
          : .6 * deepA[row] + .4 * deepB[row] > .63;
      }
      out.kind[i] = cave ? AIR : row < edge ? U.slate : U.gloam;
    }
  }
  for (let sy = 0; sy * SECTOR < rows; sy++) veins(ctx, out, sx, sy, floor);
  const builder = new Builder(out, col0, rows, () => false);
  for (const plan of realmPlans(ctx, Math.floor(sx / LATTICE))) {
    if (plan.col + plan.w + MARGIN < col0 || plan.col - MARGIN >= col0 + SECTOR) continue;
    stamp(builder, plan, out, plan.row >= UMBRAL_EDGE);
    out.structures.push({ kind: plan.kind, col: plan.col, row: plan.row, w: plan.w, h: plan.h });
  }
  out.halls = out.halls.filter(hall => hall.col0 >= col0 && hall.col0 < col0 + SECTOR);
  for (let lc = 0; lc < SECTOR; lc++) for (let row = 0; row < rows; row++) {
    if (row >= CEILING && row < floor) continue;
    const i = row * SECTOR + lc;
    out.kind[i] = BEDROCK; out.liqType[i] = 0; out.liqLevel[i] = 0; out.notes.delete(i);
  }
  return out;
}

function veins(ctx: RealmContext, out: SectorColumnGen, sx: number, sy: number, floor: number): void {
  const col0 = sx * SECTOR;
  const r0 = Math.max(CEILING + 1, sy * SECTOR), r1 = Math.min(floor, (sy + 1) * SECTOR);
  if (r1 <= r0) return;
  const random = seededRandom(mix32((sectorSeed(ctx.seed, sx, sy, ctx.gv) ^ 0x3b9aca07) >>> 0));
  for (const vein of VEINS) {
    const from = Math.max(vein.from, r0), to = Math.min(vein.to, r1);
    const expected = vein.count * Math.max(0, to - from) / (vein.to - vein.from);
    const roll = random();
    const count = Math.floor(expected) + (roll < expected - Math.floor(expected) ? 1 : 0);
    if (to <= from) continue;
    for (let k = 0; k < count; k++) {
      let col = col0 + Math.floor(random() * SECTOR);
      let row = from + Math.floor(random() * (to - from));
      for (let step = 0; step < vein.size; step++) {
        if (col >= col0 && col < col0 + SECTOR && row >= from && row < to) {
          const i = row * SECTOR + (col - col0);
          if (out.kind[i] !== AIR) out.kind[i] = vein.node;
        }
        const d = Math.floor(random() * 4);
        col += d === 0 ? 1 : d === 1 ? -1 : 0;
        row += d === 2 ? 1 : d === 3 ? -1 : 0;
      }
    }
  }
}

/** Where the Keeper stands on arriving through the return gate (world px of the feet: centre x, bottom y offset from `top`). */
export function realmArrival(top: number): { x: number; feet: number } {
  return { x: (REALM_ARRIVAL.col + .5) * 32, feet: top + (REALM_ARRIVAL.row + 1) * 32 };
}

// ── The gates' side: a Rift Gate in the Ember Delve (sector-gen.ts, underhearth-gen.ts) ──

/** A gate chamber's interior (cells): wide enough to walk round the gate, tall enough to stand in it. */
export const GATE_ROOM = { w: 9, h: 5 } as const;
const SPLINTER = nodeIndex('rift-splinter');

/**
 * Stamp a Rift Gate chamber at (x, y) (its interior's top-left): a chamber in
 * `rock`, open at both sides at floor level, a floor and lintel of rift stone,
 * the gate's 2 × 3 opening on the floor in the realm's own node, rift splinters
 * in the walls and roof (a Realm Sigil's frame), and a note about the gate.
 */
export function stampGate(b: Builder, x: number, y: number, gateNode: number, rock: number, note: string | null): void {
  const { w, h } = GATE_ROOM;
  b.rect(x - 1, y - 1, w + 2, 1, rock);
  b.rect(x, y, w, h, AIR);
  b.rect(x - 1, y, 1, h, rock); b.rect(x + w, y, 1, h, rock);
  b.rect(x - 1, y + 2, 1, 3, AIR); b.rect(x + w, y + 2, 1, 3, AIR);
  for (let c = x - 1; c <= x + w; c++) b.put(c, y + h, U.frame, true);
  const gx = x + 3;
  for (let c = gx - 1; c <= gx + 2; c++) b.put(c, y + 1, U.frame, true);
  for (let r = y + 2; r < y + h; r++) for (let c = gx; c < gx + 2; c++) b.put(c, r, gateNode, true);
  for (const [c, r] of [[x + 1, y - 1], [x + 6, y - 1], [x + 7, y - 1], [x - 1, y], [x - 1, y + 1], [x + w, y + 1]] as const) b.put(c, r, SPLINTER);
  if (note) b.note(x + w - 1, y + 2, FIELD_NOTE_PREFIX + note);
}
