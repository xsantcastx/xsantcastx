/**
 * celestial-gen.ts — the Celestial's underside, the Orrery Wells, behind the
 * Celestial Rift Gate in the Magma Halls (shared/delve/rift-gates.model.ts;
 * the rule is celestial.ts; lore-addendum.md "The Orrery Wells": shipped —
 * owner reviews in play). Pure: no DOM, no Angular. Shared rules and the
 * core's layout: realm-kit.ts.
 *
 *   rows 2–~30   the Brass Galleries: astral stone, winding tunnels, orrery
 *                vaults (a chamber whose down its rings decide, starsteel in
 *                the roof) and star-wells (a shaft that falls up to a pocket,
 *                a star-chain beside it the way back down)
 *   rows ~31–61  the Nadir Deep: nadir stone, broad caverns, warden galleries
 *                where Anchor Wardens walk their last orbit, meridian glass
 *
 * Core (cols 0–63): the Gate Hollow (return gate, a starsteel outcrop), the
 * Turning Room in the east tunnel (an orrery field over a pit: walk in and you
 * fall into it; turn the pit's ring and you fall up and walk the ceiling
 * across), a star-chain down a shaft from the west tunnel to the Fallen
 * Ephemeris's hall (the Orrery Well itself: a field whose rings start brass,
 * so the hall's ceiling is its floor until someone turns them).
 *
 * The no-softlock promise (celestial.ts): every field's rings sit in the rows
 * a Keeper covers standing on its floor and standing on its ceiling; every
 * star-well has a star-chain the length of it. scripts/celestial-delve.test.cjs checks both.
 */
import { FIELD_NOTE_PREFIX, fieldNotePool } from '../../shared/delve/field-notes.model';
import { nodeIndex, seededRandom } from './terrain';
import { AIR, Builder, type SectorColumnGen } from './gen-kit';
import {
  bandedColumn, CORE_HALL, CORE_HOLLOW, CORE_SHAFT, isRealmCore, rollPlans, stampCoreHall, stampCoreHollow,
  type PlanTable, type RealmContext, type RealmDef, type RealmPlan,
} from './realm-kit';

const S = {
  stone: nodeIndex('astral-stone'), nadir: nodeIndex('nadir-stone'), starsteel: nodeIndex('starsteel-vein'), glass: nodeIndex('meridian-glass-vein'),
  scrap: nodeIndex('orrery-scrap'), field: nodeIndex('orrery-field'), well: nodeIndex('star-well'), ringA: nodeIndex('orrery-ring-a'),
  ringB: nodeIndex('orrery-ring-b'), chain: nodeIndex('star-chain'), frame: nodeIndex('rift-frame'), gate: nodeIndex('rift-gate-celestial'),
};

/** Every node the Celestial generator lays (the meaning check reads it through SECTOR_NODES). */
export function celestialNodes(): string[] {
  return ['astral-stone', 'nadir-stone', 'starsteel-vein', 'meridian-glass-vein', 'orrery-scrap', 'orrery-field', 'star-well',
    'orrery-ring-a', 'orrery-ring-b', 'star-chain', 'rift-frame', 'rift-gate-celestial'];
}

/** The Brass Galleries end and the Nadir Deep begins about here. */
export const CELESTIAL_EDGE = 31;
/**
 * The Turning Room (the east tunnel): an orrery field over the tunnel (rows
 * 28–30) and a three-row pit under it. Its rings start blue: walk in and you
 * drop into the pit; the pit's ring (reachable from its floor) turns the field,
 * and you fall up to the tunnel's ceiling and walk it east. The tunnel ring
 * (reachable from the tunnel's floor and its ceiling) turns it back.
 */
export const TURNING_ROOM = {
  field: { col: 50, row: 28, w: 8, h: 3 }, pit: { col: 51, row: 31, w: 6, h: 3 },
  ring: { col: 50, row: 29 }, pitRing: { col: 56, row: 32 }, ore: { col: 53, row: 34 },
} as const;
/** The Fallen Ephemeris's hall: the hall's rings, one near the ceiling and one near the floor at each station. */
export const HALL_RINGS: readonly { col: number; row: number }[] = [12, 28, 42, 55].flatMap(col => [{ col, row: CORE_HALL.row + 1 }, { col, row: CORE_HALL.row + CORE_HALL.h - 2 }]);

const TABLE: PlanTable = {
  salt: 0xce_1e57,
  bands: [
    { rows: [4, 28], table: [['orrery-vault', .36], ['star-well', .3]] },
    { rows: [34, 59], table: [['warden-gallery', .32], ['orrery-vault', .24], ['star-well', .18]] },
  ],
  sizes: { 'orrery-vault': { w: [12, 16], h: 6 }, 'star-well': { w: [6, 6], h: 17 }, 'warden-gallery': { w: [16, 22], h: 5 } },
};

export function celestialPlans(ctx: RealmContext, cell: number): RealmPlan[] {
  if (isRealmCore(ctx, cell)) {
    return [
      { kind: 'gate-hollow', ...CORE_HOLLOW, salt: 1 },
      { kind: 'orrery-hall', ...CORE_HALL, salt: 2 },
      { kind: 'turning-room', ...TURNING_ROOM.field, h: 7, salt: 3 },
    ];
  }
  return rollPlans(ctx, cell, TABLE);
}

function stamp(b: Builder, plan: RealmPlan, out: SectorColumnGen, deep: boolean): void {
  const { col: x, row: y, w, h } = plan;
  const r = seededRandom(plan.salt);
  const rock = deep ? S.nadir : S.stone;
  const ore = deep ? S.glass : S.starsteel;
  const note = (): string | null => {
    const pool = fieldNotePool('celestial');
    return pool.length ? FIELD_NOTE_PREFIX + pool[Math.floor(r() * pool.length)] : null;
  };
  switch (plan.kind) {
    case 'orrery-vault': {
      // A tall chamber, all field; a ring by the ceiling at one end and by the floor at the other (one field, one
      // state). The roof holds the ore a Keeper on the floor cannot reach: turn the field and walk the ceiling to it.
      b.rect(x - 1, y - 1, w + 2, 1, rock);
      b.rect(x - 1, y, 1, h, rock); b.rect(x + w, y, 1, h, rock);
      b.rect(x - 1, y + h, w + 2, 1, rock);
      b.rect(x, y, w, h, S.field);
      // Doors at floor level each side (plain air: step out and the ordinary down comes back).
      b.rect(x - 1, y + h - 3, 1, 3, AIR); b.rect(x + w, y + h - 3, 1, 3, AIR);
      const ring = r() < .5 ? S.ringA : S.ringB;
      b.put(x, y + 1, ring, true);
      b.put(x + w - 1, y + h - 2, ring, true);
      for (let n = 0; n < 2 + (r() < .5 ? 1 : 0); n++) b.put(x + 3 + Math.floor(r() * (w - 6)), y - 1, ore);
      b.dress(x + Math.floor(w / 2), y + h, S.scrap);
      if (r() < .6) { const id = note(); if (id) b.note(x - 2, y + h - 2, id); }
      break;
    }
    case 'star-well': {
      // A pocket up top (rows y..y+2), the shaft (y+3..y+11), a chamber at the foot (y+12..y+15), its floor y+16.
      // The well is the column at x; the chain beside it at x+1 reaches from the pocket to the chamber's floor.
      const wx = x + 2, top = y + 3, foot = y + 12;
      b.rect(x - 1, y - 1, w + 2, 1, rock);
      b.rect(x, y, w, 3, AIR);
      b.rect(x - 1, y, 1, 3, rock); b.rect(x + w, y, 1, 3, rock);
      b.rect(x - 1, top, w + 2, foot - top, rock);
      b.rect(x, foot, w, 4, AIR);
      b.rect(x - 1, foot + 4, w + 2, 1, rock);
      b.rect(x - 1, foot + 1, 1, 3, AIR); b.rect(x + w, foot + 1, 1, 3, AIR);
      for (let row = y; row < foot + 4; row++) b.put(wx, row, S.well, true);
      for (let row = y + 2; row < foot + 4; row++) b.put(wx + 1, row, S.chain, true);
      b.put(x - 1, y + 1, ore); b.put(x + w, y + 1, ore);
      if (r() < .5) b.put(x + w - 1, y - 1, deep ? S.glass : S.scrap);
      if (r() < .5) { const id = note(); if (id) b.note(x, foot + 2, id); }
      break;
    }
    case 'warden-gallery': {
      // Where the Anchor Wardens walk their last orbit: a long low hall, brass scrap and meridian glass in the roof.
      b.rect(x, y, w, h, AIR);
      b.rect(x - 1, y + h, w + 2, 1, rock);
      for (let n = 0; n < 3; n++) b.dress(x + 2 + Math.floor(r() * (w - 4)), y - 1, n ? S.scrap : S.glass);
      b.dress(x - 1, y + 2, S.starsteel);
      out.halls.push({ creature: 'anchor-warden', count: 2 + (r() < .5 ? 1 : 0), col0: x, col1: x + w, floorRow: y + h });
      break;
    }
    case 'gate-hollow': {
      stampCoreHollow(b, S.stone, S.gate, S.frame, S.starsteel);
      // The west tunnel's shaft: a star-chain down to the Orrery Well.
      for (let row = CORE_SHAFT.row; row < CORE_SHAFT.row + CORE_SHAFT.h; row++) b.put(CORE_SHAFT.col, row, S.chain, true);
      b.dress(CORE_HOLLOW.col + CORE_HOLLOW.w, CORE_HOLLOW.row + 2, S.starsteel);
      b.dress(20, CORE_HOLLOW.row - 1, S.scrap);
      b.note(41, 29, `${FIELD_NOTE_PREFIX}celestial-sera-survey`);
      b.note(46, 29, `${FIELD_NOTE_PREFIX}celestial-turn-the-ring`);
      break;
    }
    case 'turning-room': {
      const F = TURNING_ROOM.field, P = TURNING_ROOM.pit;
      b.rect(F.col, F.row, F.w, F.h, S.field);
      b.rect(P.col - 1, P.row, 1, P.h + 1, rock); b.rect(P.col + P.w, P.row, 1, P.h + 1, rock);
      b.rect(P.col, P.row, P.w, P.h, S.field);
      b.rect(P.col - 1, P.row + P.h, P.w + 2, 1, rock);
      b.put(TURNING_ROOM.ring.col, TURNING_ROOM.ring.row, S.ringB, true);
      b.put(TURNING_ROOM.pitRing.col, TURNING_ROOM.pitRing.row, S.ringB, true);
      b.put(TURNING_ROOM.ore.col, TURNING_ROOM.ore.row, S.starsteel);
      break;
    }
    case 'orrery-hall': {
      // The Fallen Ephemeris's hall: nadir walls, a rift-stone floor, all of it one field; its rings start brass.
      stampCoreHall(b, S.nadir, S.frame);
      const H = CORE_HALL;
      b.rect(H.col, H.row, H.w, H.h, S.field);
      // The shaft's chain comes down through the hall's roof.
      b.put(CORE_SHAFT.col, H.row - 1, S.chain, true);
      for (const ring of HALL_RINGS) b.put(ring.col, ring.row, S.ringA, true);
      for (let n = 0; n < 4; n++) b.dress(H.col + 8 + n * 13, H.row - 2, n % 2 ? S.glass : S.starsteel);
      b.note(H.col - 1, H.row + 3, `${FIELD_NOTE_PREFIX}celestial-ephemeris`);
      break;
    }
  }
}

const DEF: RealmDef = {
  salt: 0x0e_b17a, shallow: S.stone, deep: S.nadir, edge: CELESTIAL_EDGE, tunnel: .064, cavern: .62,
  veins: [
    { node: S.starsteel, from: 6, to: 44, count: 4, size: 4 },
    { node: S.glass, from: 34, to: 60, count: 3, size: 3 },
    { node: S.scrap, from: 4, to: 60, count: 2, size: 2 },
  ],
  plans: celestialPlans,
  stamp,
};

/** Generate sector column `sx` of the Orrery Wells (all rows). Same (context, sx) → the same arrays. */
export function celestialColumn(ctx: RealmContext, sx: number): SectorColumnGen {
  return bandedColumn(ctx, sx, DEF);
}
