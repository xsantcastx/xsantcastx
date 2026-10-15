/**
 * verdant-gen.ts — the Verdant's underside, the Root Deeps, behind the Verdant
 * Rift Gate in the Root Hollows (shared/delve/rift-gates.model.ts; the rule is
 * verdant.ts; lore-addendum.md "The Root Deeps": shipped — owner reviews in
 * play). Pure: no DOM, no Angular. Shared rules and the core's layout:
 * realm-kit.ts.
 *
 *   rows 2–~30   the Root Tangle: rootwood (the World-Root's living wood),
 *                winding tunnels, spore hollows, vine shafts, rootglass
 *   rows ~31–61  the Heartwood Deep: heartwood, broad caverns, graftling
 *                warrens with heart-amber in their roofs
 *
 * Core (cols 0–63): the Gate Hollow (return gate, a rootglass outcrop, a root
 * choke across the east tunnel to learn the rule on, spore pods in the west
 * tunnel), a vine shaft from the west tunnel down to the Graftmother's hall,
 * and the hall itself (three heart-root pillars hold her).
 */
import { FIELD_NOTE_PREFIX, fieldNotePool } from '../../shared/delve/field-notes.model';
import { nodeIndex, seededRandom } from './terrain';
import { AIR, Builder, type SectorColumnGen } from './gen-kit';
import {
  bandedColumn, cellRoll, CORE_HALL, CORE_HOLLOW, CORE_SHAFT, isRealmCore, rollPlans, stampCoreHall, stampCoreHollow,
  type PlanTable, type RealmContext, type RealmDef, type RealmPlan,
} from './realm-kit';

const V = {
  root: nodeIndex('rootwood'), heart: nodeIndex('heartwood'), glass: nodeIndex('rootglass-vein'), amber: nodeIndex('heart-amber-vein'),
  vine: nodeIndex('living-vine'), pod: nodeIndex('spore-pod'), heartRoot: nodeIndex('heart-root'),
  frame: nodeIndex('rift-frame'), gate: nodeIndex('rift-gate-verdant'),
};

/** Every node the Verdant generator lays (the meaning check reads it through SECTOR_NODES). */
export function verdantNodes(): string[] {
  return ['rootwood', 'heartwood', 'rootglass-vein', 'heart-amber-vein', 'living-vine', 'spore-pod', 'heart-root', 'rift-frame', 'rift-gate-verdant'];
}

/** The Root Tangle ends and the Heartwood Deep begins about here. */
export const VERDANT_EDGE = 31;
/** The heart-root pillars in the Graftmother's hall (two cells each, on its floor). */
export const HEART_ROOTS: readonly number[] = [14, 32, 50];
/** The root choke across the Gate Hollow's east tunnel (it grows back: the first lesson). */
export const ROOT_CHOKE = { col: 52, row: 28, w: 3, h: 3 } as const;

const TABLE: PlanTable = {
  salt: 0x5d1e_9e11,
  bands: [
    { rows: [5, 22], table: [['spore-hollow', .4], ['vine-shaft', .3]] },
    { rows: [35, 52], table: [['graft-warren', .38], ['vine-shaft', .2]] },
  ],
  sizes: { 'spore-hollow': { w: [12, 18], h: 5 }, 'vine-shaft': { w: [3, 3], h: 14 }, 'graft-warren': { w: [16, 22], h: 5 } },
};

export function verdantPlans(ctx: RealmContext, cell: number): RealmPlan[] {
  if (isRealmCore(ctx, cell)) {
    return [
      { kind: 'gate-hollow', ...CORE_HOLLOW, salt: 1 },
      { kind: 'graft-hall', ...CORE_HALL, salt: 2 },
      { kind: 'vine-shaft', col: CORE_SHAFT.col, row: CORE_SHAFT.row, w: 1, h: CORE_SHAFT.h, salt: 3 },
    ];
  }
  return rollPlans(ctx, cell, TABLE);
}

function stamp(b: Builder, plan: RealmPlan, out: SectorColumnGen, deep: boolean): void {
  const { col: x, row: y, w, h } = plan;
  const r = seededRandom(plan.salt);
  const rock = deep ? V.heart : V.root;
  const note = (): string | null => {
    const pool = fieldNotePool('verdant');
    return pool.length ? FIELD_NOTE_PREFIX + pool[Math.floor(r() * pool.length)] : null;
  };
  switch (plan.kind) {
    case 'spore-hollow': {
      // A low hollow furred with spore pods, roof and floor; rootglass where the sap set.
      b.rect(x - 1, y - 1, w + 2, 1, rock);
      b.rect(x, y, w, h, AIR);
      b.rect(x - 1, y + h, w + 2, 1, rock);
      for (let c = x + 1; c < x + w - 1; c += 2 + Math.floor(r() * 3)) b.put(c, y - 1, V.pod);
      for (let n = 0; n < 2 + Math.floor(r() * 2); n++) b.put(x + 2 + Math.floor(r() * (w - 4)), y + h - 1, V.pod);
      b.dress(x - 1, y + 2, V.glass); b.dress(x + w, y + 1, V.glass);
      if (r() < .6) { const id = note(); if (id) b.note(x + 1, y + h - 2, id); }
      break;
    }
    case 'vine-shaft': {
      // A shaft the roots left open, a living vine down its middle (climb it).
      const mid = w === 1 ? x : x + 1;
      b.rect(x, y, w, h, AIR);
      for (let row = y; row < y + h; row++) b.put(mid, row, V.vine);
      if (w > 1) { b.dress(x - 1, y + Math.floor(h / 2), V.glass); b.dress(x + w, y + 3, V.glass); }
      break;
    }
    case 'graft-warren': {
      // Where the graftlings grow: a long low hall, heart-amber in the roof (worth the company).
      b.rect(x, y, w, h, AIR);
      b.rect(x - 1, y + h, w + 2, 1, rock);
      for (let n = 0; n < 3; n++) b.dress(x + 2 + Math.floor(r() * (w - 4)), y - 1, V.amber);
      b.dress(x - 1, y + 2, V.glass);
      out.halls.push({ creature: 'graftling', count: 2 + (r() < .5 ? 1 : 0), col0: x, col1: x + w, floorRow: y + h });
      break;
    }
    case 'gate-hollow': {
      stampCoreHollow(b, V.root, V.gate, V.frame, V.glass);
      // The roots took the east tunnel back: dig through and watch it close behind you.
      b.rect(ROOT_CHOKE.col, ROOT_CHOKE.row, ROOT_CHOKE.w, ROOT_CHOKE.h, V.root);
      // Spore pods in the west tunnel's floor, past the vine shaft (touch one and it bursts).
      b.put(4, 30, V.pod); b.put(6, 30, V.pod);
      b.put(20, CORE_HOLLOW.row - 1, V.pod); b.put(24, CORE_HOLLOW.row - 1, V.pod);
      b.dress(CORE_HOLLOW.col + CORE_HOLLOW.w, CORE_HOLLOW.row + 2, V.glass);
      b.note(41, 29, `${FIELD_NOTE_PREFIX}verdant-kesh-graft`);
      b.note(50, 29, `${FIELD_NOTE_PREFIX}verdant-siv-warning`);
      break;
    }
    case 'graft-hall': {
      // The Graftmother's hall: heartwood walls, a rift-stone floor, three heart-root pillars that hold her.
      stampCoreHall(b, V.heart, V.frame);
      for (const c of HEART_ROOTS) { b.put(c, CORE_HALL.row + CORE_HALL.h - 1, V.heartRoot); b.put(c, CORE_HALL.row + CORE_HALL.h - 2, V.heartRoot); }
      for (let n = 0; n < 4; n++) b.dress(CORE_HALL.col + 4 + n * 12, CORE_HALL.row - 2, V.amber);
      b.note(CORE_HALL.col + 2, CORE_HALL.row + CORE_HALL.h - 3, `${FIELD_NOTE_PREFIX}verdant-graft-oath`);
      break;
    }
  }
}

/** Vines hang from the tangle's roofs (outside the core): a cell under rock may grow one, 3–7 cells long. */
function dress(ctx: RealmContext, out: SectorColumnGen, col0: number, floor: number): void {
  for (let lc = 0; lc < 32; lc++) {
    const col = col0 + lc;
    if (col >= 0 && col < ctx.spec.cols) continue;
    for (let row = 4; row < floor - 2; row++) {
      const i = row * 32 + lc, above = (row - 1) * 32 + lc;
      if (out.kind[i] !== AIR || (out.kind[above] !== V.root && out.kind[above] !== V.heart)) continue;
      if (cellRoll(ctx.seed, col, row, 0x7e1e5) >= .08) continue;
      const length = 3 + Math.floor(cellRoll(ctx.seed, col, row, 0x1e9) * 5);
      for (let k = 0; k < length && row + k < floor - 1; k++) {
        const j = (row + k) * 32 + lc;
        if (out.kind[j] !== AIR || out.liqLevel[j]) break;
        out.kind[j] = V.vine;
      }
    }
  }
}

const DEF: RealmDef = {
  salt: 0x0a7e_5eed, shallow: V.root, deep: V.heart, edge: VERDANT_EDGE, tunnel: .07, cavern: .62,
  veins: [
    { node: V.glass, from: 6, to: 44, count: 4, size: 4 },
    { node: V.amber, from: 34, to: 60, count: 3, size: 3 },
    { node: V.pod, from: 4, to: 30, count: 2, size: 2 },
  ],
  plans: verdantPlans,
  stamp,
  dress,
};

/** Generate sector column `sx` of the Root Deeps (all rows). Same (context, sx) → the same arrays. */
export function verdantColumn(ctx: RealmContext, sx: number): SectorColumnGen {
  return bandedColumn(ctx, sx, DEF);
}
