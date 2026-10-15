/**
 * blueprints.ts — One World's buildings as cells (docs/design/one-world.md §2.3).
 * Pure: no DOM, no Angular; the node harness (scripts/one-world.test.cjs) loads it.
 *
 * A building is a tiny ASCII grid, top row first, its last row standing on the
 * ground line (the row just above `ground`). surface-gen.ts stamps it into the
 * sky band; the engine dresses it (sign, awning, window display, smoke) from
 * the marks a blueprint leaves (`BlueprintMarks`), never from cells it guesses.
 *
 *   #  wall block (the realm's masonry)        =  roof (slate shingles)
 *   T  timber beam                            -  floorboards (one-way: stood on, dropped through)
 *   H  fixed ladder (climbed; one-way on top)  .  back wall only (open: walked through)
 *   w  window in the back wall (lit at night)  D  doorway (open; a door frame in the back wall)
 *   C  counter: the station's anchor (open)    S  the hanging sign (open; dressing)
 *   c  chimney (masonry; smoke rises from its top)
 *   l  a leg or post in the back wall (timber; walked past)
 *   p  a stone post in the back wall (an arch's; walked past)
 *   (space) sky: nothing at all
 *
 * Side walls stand above the doorways only, so the street runs through every
 * building at Keeper height: the Keeper walks in one door, past the counter,
 * and out of the other (MapleStory's open fronts, Terraria's cut-away walls).
 */

/** What a blueprint cell becomes: a terrain node id (or null: open air) and its back wall. */
export interface BlueprintCell { node: string | null; back: number }

/** Back-wall ids per cell (Terrain.back). 0 = none: the sky shows through. */
export const BACK_NONE = 0, BACK_BRICK = 1, BACK_TIMBER = 2, BACK_WINDOW = 3, BACK_DOOR = 4, BACK_STONE = 5;
/** How many back-wall kinds there are (the renderer's palette table is this long). */
export const BACK_KINDS = 6;

/** A realm's materials: which nodes its walls, roofs and beams are, and its back-wall look. */
export interface RealmPalette {
  wall: string;
  roof: string;
  beam: string;
  plank: string;
  ladder: string;
  /** Back-wall colours per BACK_* id: [body, light, shadow]. */
  backs: readonly (readonly [string, string, string])[];
  /** The awning's two stripes and the trim under it (art bible ramps). */
  awning: readonly [string, string, string];
}

/** The Infernal palette: basalt masonry, slate roofs, ember-seam trim, warm timber (style guide §5.1). */
export const INFERNAL_PALETTE: RealmPalette = {
  wall: 'seam-brick', roof: 'town-roof', beam: 'town-beam', plank: 'town-plank', ladder: 'town-ladder',
  backs: [
    ['#000000', '#000000', '#000000'],
    ['#2e2228', '#3e2e36', '#1a1218'],
    ['#4a3220', '#5e4028', '#2a1c12'],
    ['#2e2228', '#3e2e36', '#1a1218'],
    ['#3a2a20', '#5a4030', '#1a1210'],
    ['#2a2228', '#3a3036', '#16121a'],
  ],
  awning: ['#8d3f36', '#c2a26a', '#e1c29a'],
};

/** Every building kind the settlements are made of. */
export type BlueprintKind = 'shop' | 'shop-wide' | 'forge' | 'mine-head' | 'beacon-tower' | 'arch' | 'basin';

/**
 * The grids. Rows run top to bottom; every row of one blueprint is as wide as
 * the first. Two floors for every shop (the shop below, the keeper's room
 * above, a ladder between): a keeper sleeps upstairs at night (routines.ts).
 */
export const BLUEPRINTS: Readonly<Record<BlueprintKind, readonly string[]>> = {
  // 10 wide: the Vault, the Material Vendor. Three rows a floor: a Keeper (90 px) fits either.
  shop: [
    '  ======  ',
    ' ======== ',
    '==========',
    '#.w...w.H#',
    '#.......H#',
    '#.......H#',
    'T-------HT',
    'D...C...HD',
    'D.......HD',
    'D.......HD',
  ],
  // 12 wide: the Crafting Bench, the Rune Forge, the Enchanting Table.
  'shop-wide': [
    '   ======   ',
    ' ========== ',
    '============',
    '#..w..w..wH#',
    '#.........H#',
    '#.........H#',
    'T---------HT',
    'D....C....HD',
    'D.........HD',
    'D.........HD',
  ],
  // 14 wide, with a chimney over the hearth: the Seamworks Forge (Kael's first quest).
  forge: [
    '  cc          ',
    '  cc======    ',
    ' =cc========= ',
    '==============',
    '#...w...w...H#',
    '#...........H#',
    '#...........H#',
    'T-----------HT',
    'D.....C.....HD',
    'D...........HD',
    'D...........HD',
  ],
  // The mine head over the core's entry ledge: a timber headframe on legs you walk between,
  // its ladder down onto the ledge (col 3, the old shaft's place).
  'mine-head': [
    'TTTTT',
    'T   T',
    'T H T',
    'l H l',
    'l H l',
    'l H l',
    'l H l',
  ],
  // The Eclipse Beacon's tower: a stone shaft, the lamp sits on its top.
  'beacon-tower': [
    ' ### ',
    '#...#',
    '#.w.#',
    '#...#',
    'D...D',
    'D...D',
    'D...D',
  ],
  // A temporary arch (P1): stone posts and a lintel, open under it.
  arch: [
    '#####',
    'p   p',
    'p   p',
    'p   p',
  ],
  // The square's raised basin (the settlement's pond): a stone rim, water laid between.
  basin: [
    '#    #',
  ],
};

/** Where the dressing goes, in blueprint-local cells (x from the left, y from the top). */
export interface BlueprintMarks {
  width: number;
  height: number;
  counter: { x: number; y: number } | null;
  sign: { x: number; y: number } | null;
  chimney: { x: number; y: number } | null;
  windows: readonly { x: number; y: number }[];
  /** The upstairs room's floor row (local y of the planks), or null for one floor. */
  upstairs: number | null;
}

const MARK_CACHE = new Map<BlueprintKind, BlueprintMarks>();

/** The marks of a blueprint (memoised). Pure. */
export function blueprintMarks(kind: BlueprintKind): BlueprintMarks {
  let marks = MARK_CACHE.get(kind);
  if (marks) return marks;
  const rows = BLUEPRINTS[kind];
  let counter: BlueprintMarks['counter'] = null, sign: BlueprintMarks['sign'] = null, chimney: BlueprintMarks['chimney'] = null, upstairs: number | null = null;
  const windows: { x: number; y: number }[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const g = row[x];
      if (g === 'C') counter = { x, y };
      else if (g === 'S') sign = { x, y };
      else if (g === 'c' && !chimney) chimney = { x, y };
      else if (g === 'w') windows.push({ x, y });
      else if (g === '-' && upstairs === null) upstairs = y;
    }
  });
  // No `S`: a shop's sign hangs off its east beam, over the street (the upstairs floor's row).
  if (!sign && counter && upstairs !== null) sign = { x: rows[0].length - 1, y: upstairs };
  marks = { width: rows[0].length, height: rows.length, counter, sign, chimney, windows, upstairs };
  MARK_CACHE.set(kind, marks);
  return marks;
}

/** One blueprint glyph as a cell, in a realm's palette. Pure. */
export function blueprintCell(glyph: string, palette: RealmPalette): BlueprintCell | null {
  switch (glyph) {
    case '#': return { node: palette.wall, back: BACK_BRICK };
    case 'c': return { node: palette.wall, back: BACK_NONE };
    case '=': return { node: palette.roof, back: BACK_NONE };
    case 'T': return { node: palette.beam, back: BACK_TIMBER };
    case '-': return { node: palette.plank, back: BACK_TIMBER };
    case 'H': return { node: palette.ladder, back: BACK_BRICK };
    case '.': case 'C': case 'S': return { node: null, back: BACK_BRICK };
    case 'w': return { node: null, back: BACK_WINDOW };
    case 'D': return { node: null, back: BACK_DOOR };
    // A leg or post seen behind the street: timber in the back wall, walked past.
    case 'l': return { node: null, back: BACK_TIMBER };
    // A stone post seen behind the street (an arch's): walked past.
    case 'p': return { node: null, back: BACK_STONE };
    case ' ': return null;
  }
  throw new Error(`Unknown blueprint glyph '${glyph}'`);
}

/** Check every blueprint is rectangular and uses only known glyphs (the node test calls it). */
export function validateBlueprints(): string[] {
  const problems: string[] = [];
  for (const [kind, rows] of Object.entries(BLUEPRINTS)) {
    const w = rows[0]?.length ?? 0;
    rows.forEach((row, y) => {
      if (row.length !== w) problems.push(`${kind} row ${y} is ${row.length} wide, not ${w}`);
      for (const g of row) { try { blueprintCell(g, INFERNAL_PALETTE); } catch { problems.push(`${kind} row ${y}: glyph '${g}'`); } }
    });
  }
  return problems;
}
