/**
 * luminous-gen.ts — the Luminous's underside, the Prism Mines, behind the
 * Luminous Rift Gate in the Glowcap Grotto (shared/delve/rift-gates.model.ts;
 * the rule is luminous.ts; lore-addendum.md "The Prism Mines": shipped — owner
 * reviews in play). Pure: no DOM, no Angular. Shared rules and the core's
 * layout: realm-kit.ts.
 *
 *   rows 2–~30   the Prism Galleries: prism-stone, winding tunnels, sunwells
 *                (a chasm, a sun-prism over it, a mirror on its lip), prism
 *                blooms and prismite
 *   rows ~31–61  the Dawnglass Deep: dawnstone, broad caverns, shadow halls
 *                (a floor of shadow glass over a pit), prism galleries where
 *                prismlings gather, dawnglass in their roofs
 *
 * Core (cols 0–63): the Gate Hollow (return gate, a prismite outcrop), the
 * Sunwell Crossing in the east tunnel (turn the mirror and the beam lays a
 * bridge over the pit), a sun-prism over the west tunnel whose beam is a
 * ladder of light down a shaft to the Hollow Sun's hall, and the hall itself
 * (the beam ends on a mirror there: turn it to catch the Hollow Sun).
 */
import { FIELD_NOTE_PREFIX, fieldNotePool } from '../../shared/delve/field-notes.model';
import { nodeIndex, seededRandom } from './terrain';
import { AIR, Builder, type SectorColumnGen } from './gen-kit';
import {
  bandedColumn, CORE_HALL, CORE_HOLLOW, CORE_SHAFT, isRealmCore, rollPlans, stampCoreHall, stampCoreHollow,
  type PlanTable, type RealmContext, type RealmDef, type RealmPlan,
} from './realm-kit';

const L = {
  stone: nodeIndex('prism-stone'), dawn: nodeIndex('dawnstone'), prismite: nodeIndex('prismite-vein'), dawnglass: nodeIndex('dawnglass-vein'),
  bloom: nodeIndex('prism-bloom'), sun: nodeIndex('sun-prism'), mirrorA: nodeIndex('prism-mirror-a'), mirrorB: nodeIndex('prism-mirror-b'),
  pane: nodeIndex('umbra-pane'), frame: nodeIndex('rift-frame'), gate: nodeIndex('rift-gate-luminous'),
};

/** Every node the Luminous generator lays (the meaning check reads it through SECTOR_NODES). */
export function luminousNodes(): string[] {
  return ['prism-stone', 'dawnstone', 'prismite-vein', 'dawnglass-vein', 'prism-bloom', 'sun-prism', 'prism-mirror-a', 'prism-mirror-b', 'umbra-pane', 'rift-frame', 'rift-gate-luminous'];
}

/** The Prism Galleries end and the Dawnglass Deep begins about here. */
export const LUMINOUS_EDGE = 31;
/**
 * The Sunwell Crossing (the east tunnel): a sun-prism in the roof over the pit's
 * west lip, a mirror on the lip ('/' as generated: the beam goes into the rock),
 * the pit two rows deep. Turned to '\', the beam lays a bridge across the pit.
 */
export const CROSSING = { sun: { col: 49, row: 27 }, mirror: { col: 49, row: 31 }, pit: { col: 50, row: 31, w: 8, h: 2 } } as const;
/** The sun over the west tunnel: its beam is a ladder of light down the core shaft into the hall, onto the hall's mirror. */
export const HALL_SUN = { col: CORE_SHAFT.col, row: 27 } as const;
export const HALL_MIRROR = { col: CORE_SHAFT.col, row: 51 } as const;

const TABLE: PlanTable = {
  salt: 0x1e_5c0de,
  bands: [
    { rows: [5, 22], table: [['sunwell', .45], ['shadow-hall', .2]] },
    { rows: [35, 50], table: [['prism-gallery', .36], ['shadow-hall', .3]] },
  ],
  sizes: { 'sunwell': { w: [10, 14], h: 4 }, 'shadow-hall': { w: [14, 20], h: 5 }, 'prism-gallery': { w: [16, 22], h: 5 } },
};

export function luminousPlans(ctx: RealmContext, cell: number): RealmPlan[] {
  if (isRealmCore(ctx, cell)) {
    return [
      { kind: 'gate-hollow', ...CORE_HOLLOW, salt: 1 },
      { kind: 'prism-hall', ...CORE_HALL, salt: 2 },
      { kind: 'sunwell', col: CROSSING.pit.col - 2, row: 28, w: CROSSING.pit.w + 4, h: 3, salt: 3 },
    ];
  }
  return rollPlans(ctx, cell, TABLE);
}

function stamp(b: Builder, plan: RealmPlan, out: SectorColumnGen, deep: boolean): void {
  const { col: x, row: y, w, h } = plan;
  const r = seededRandom(plan.salt);
  const rock = deep ? L.dawn : L.stone;
  const note = (): string | null => {
    const pool = fieldNotePool('luminous');
    return pool.length ? FIELD_NOTE_PREFIX + pool[Math.floor(r() * pool.length)] : null;
  };
  switch (plan.kind) {
    case 'sunwell': {
      // A chamber with a pit across its floor, a sun-prism in the roof over the west lip and a mirror on the lip.
      const core = plan.salt === 3;
      if (!core) {
        b.rect(x - 1, y - 1, w + 2, 1, rock);
        b.rect(x, y, w, h, AIR);
        b.rect(x - 1, y + h, w + 2, 1, rock);
        b.rect(x - 1, y + h - 3, 1, 3, AIR); b.rect(x + w, y + h - 3, 1, 3, AIR);
        for (let c = x + 4; c < x + w - 1; c += 3 + Math.floor(r() * 3)) b.put(c, y - 1, L.bloom);
        b.dress(x + w + 1, y + 1, L.prismite);
        if (r() < .5) { const id = note(); if (id) b.note(x, y + h - 2, id); }
      }
      const lip = x + 1;
      b.rect(lip + 1, y + h, w - 4, 2, AIR);
      b.rect(lip + 1, y + h + 2, w - 4, 1, rock);
      b.put(lip, y - 1, L.sun, true);
      b.put(lip, y + h, core || r() < .7 ? L.mirrorA : L.mirrorB, true);
      break;
    }
    case 'shadow-hall': {
      // A hall whose middle floor is shadow glass over a pit: a floor only while light is on it. Stairs out of the pit.
      b.rect(x - 1, y - 1, w + 2, 1, rock);
      b.rect(x, y, w, h, AIR);
      b.rect(x - 1, y + h, w + 2, 1, rock);
      b.rect(x - 1, y + h - 3, 1, 3, AIR); b.rect(x + w, y + h - 3, 1, 3, AIR);
      b.rect(x + 3, y + h, w - 6, 1, L.pane);
      b.rect(x + 3, y + h + 1, w - 6, 4, AIR);
      b.rect(x + 2, y + h + 5, w - 4, 1, rock);
      b.rect(x + w - 5, y + h + 3, 1, 2, rock);
      b.rect(x + w - 4, y + h + 1, 1, 4, rock);
      b.dress(x - 1, y + 1, L.prismite); b.dress(x + w, y + 2, L.prismite);
      if (deep) b.dress(x + Math.floor(w / 2), y - 2, L.dawnglass);
      if (r() < .6) { const id = note(); if (id) b.note(x + 1, y + h - 2, id); }
      break;
    }
    case 'prism-gallery': {
      // Where the prismlings gather: a long low hall, dawnglass in the roof.
      b.rect(x, y, w, h, AIR);
      b.rect(x - 1, y + h, w + 2, 1, rock);
      for (let n = 0; n < 3; n++) b.dress(x + 2 + Math.floor(r() * (w - 4)), y - 1, L.dawnglass);
      b.dress(x - 1, y + 2, L.prismite);
      out.halls.push({ creature: 'prismling', count: 2 + (r() < .5 ? 1 : 0), col0: x, col1: x + w, floorRow: y + h });
      break;
    }
    case 'gate-hollow': {
      stampCoreHollow(b, L.stone, L.gate, L.frame, L.prismite);
      // The west tunnel's sun: its beam goes down the core shaft into the Hollow Sun's hall.
      b.put(HALL_SUN.col, HALL_SUN.row, L.sun, true);
      b.rect(CORE_SHAFT.col, CORE_SHAFT.row, 1, CORE_SHAFT.h, AIR);
      for (const c of [20, 26, 44]) b.put(c, CORE_HOLLOW.row - 1, L.bloom);
      b.dress(CORE_HOLLOW.col + CORE_HOLLOW.w, CORE_HOLLOW.row + 2, L.prismite);
      b.note(41, 29, `${FIELD_NOTE_PREFIX}luminous-aureth-chalk`);
      b.note(46, 29, `${FIELD_NOTE_PREFIX}luminous-turn-the-glass`);
      break;
    }
    case 'prism-hall': {
      // The Hollow Sun's hall: dawnstone walls, a rift-stone floor, the shaft's beam ending on a mirror.
      stampCoreHall(b, L.dawn, L.frame);
      b.rect(CORE_SHAFT.col, CORE_HALL.row - 1, 1, 1, AIR);
      b.put(HALL_MIRROR.col, HALL_MIRROR.row, L.mirrorA, true);
      for (let n = 0; n < 4; n++) b.dress(CORE_HALL.col + 4 + n * 12, CORE_HALL.row - 2, L.dawnglass);
      b.note(CORE_HALL.col + 2, CORE_HALL.row + CORE_HALL.h - 3, `${FIELD_NOTE_PREFIX}luminous-hollow-sun`);
      break;
    }
  }
}

const DEF: RealmDef = {
  salt: 0x7a11_b0a7, shallow: L.stone, deep: L.dawn, edge: LUMINOUS_EDGE, tunnel: .065, cavern: .63,
  veins: [
    { node: L.prismite, from: 6, to: 44, count: 4, size: 4 },
    { node: L.dawnglass, from: 34, to: 60, count: 3, size: 3 },
    { node: L.bloom, from: 4, to: 30, count: 2, size: 2 },
  ],
  plans: luminousPlans,
  stamp,
};

/** Generate sector column `sx` of the Prism Mines (all rows). Same (context, sx) → the same arrays. */
export function luminousColumn(ctx: RealmContext, sx: number): SectorColumnGen {
  return bandedColumn(ctx, sx, DEF);
}
