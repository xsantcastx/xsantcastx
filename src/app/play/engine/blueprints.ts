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
 *   p  a stone post in the back wall (walked past)
 *   (space) sky: nothing at all
 *
 * One World P2 (the High Roads and the Quarry Gate, §2.4 and §2.6):
 *
 *   R  ridge rock (the Couriers' shelves and mesas)   U  courier ruin (dressed stone, floating)
 *   |  a ridge tree's trunk (climbed; a kick-off)       ^  its canopy (one-way)
 *   ~  the Couriers' rope bridge (one-way)              B  the Quarry Gate's bars (lifted by the beacon)
 *
 * Side walls stand above the doorways only, so the street runs through every
 * building at Keeper height: the Keeper walks in one door, past the counter,
 * and out of the other (MapleStory's open fronts, Terraria's cut-away walls).
 */

/** What a blueprint cell becomes: a terrain node id (or null: open air) and its back wall. */
export interface BlueprintCell { node: string | null; back: number }

/** Back-wall ids per cell (Terrain.back). 0 = none: the sky shows through. */
export const BACK_NONE = 0, BACK_BRICK = 1, BACK_TIMBER = 2, BACK_WINDOW = 3, BACK_DOOR = 4, BACK_STONE = 5;

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
export type BlueprintKind = 'shop' | 'shop-wide' | 'forge' | 'mine-head' | 'beacon-tower' | 'basin' | 'quarry-gate' | 'high-roads';

/**
 * The High Roads (§2.6), in cells over a hunting region, west → east, all from
 * the ground line (rows are counted UP from it: `top` 5 is the cell row five
 * above the street). The Keeper jumps about 2.5 cells; a lip up to ~3.5 cells
 * over the feet is caught by the hands and mantled (terrain-moves.ts):
 *
 *   1. shelf   a floating ledge of ridge rock: jump at its side, catch the lip, mantle.   → cache
 *   2. tree    climb the trunk (Up), stand in its canopy.
 *   3. ruin    a floating ruin slab from the canopy, then the rope bridge east.            → carving
 *   4. mesa    a floating rock table; a creature is perched on it (and, one day in five, Hollis Fenn). → cache
 *   5. snag    a dead trunk, no canopy: climb to its top.
 *   6. block   a floating ruin block: from the snag, a direction + Jump kicks off, the hands catch it. → look-out
 *   7. slab    a ruin slab one step up, caught and mantled.
 *   8. spire   the spire's lip, caught and mantled: the summit, 23 rows over the street.  → summit cairn
 *
 * Every piece floats or is a trunk, so the street under it runs clear (a Keeper
 * walking to the far stone never has to climb). `dx` and `w` are columns from
 * the route's west end; `top` and `h` are rows up from the ground.
 */
export const HIGH_ROADS = {
  shelf: { dx: 0, w: 5, top: 5, h: 2 },
  tree: { dx: 9, top: 11, canopy: 5 },
  ruin: { dx: 12, w: 5, top: 11, h: 1 },
  bridge: { dx: 17, w: 8, top: 11 },
  mesa: { dx: 25, w: 9, top: 11, h: 3 },
  snag: { dx: 37, top: 14 },
  block: { dx: 41, w: 4, top: 17, h: 2 },
  slab: { dx: 46, w: 6, top: 20, h: 1 },
  spire: { dx: 53, w: 4, top: 23, h: 3 },
} as const;
/** The route's width in columns and height in rows. */
export const HIGH_ROADS_SIZE = { w: 57, h: 23 } as const;

/** The High Roads as a blueprint grid (top row first; its last row stands on the ground). Pure. */
export function highRoadsGrid(): string[] {
  const R = HIGH_ROADS, { w, h } = HIGH_ROADS_SIZE;
  const grid = Array.from({ length: h }, () => Array.from({ length: w }, () => ' '));
  // Rows up from the ground → grid y (the last grid row is one row up).
  const put = (dx: number, up: number, g: string) => { grid[h - up][dx] = g; };
  const block = (dx: number, width: number, top: number, rows: number, g: string) => {
    for (let x = dx; x < dx + width; x++) for (let up = top; up > top - rows; up--) put(x, up, g);
  };
  block(R.shelf.dx, R.shelf.w, R.shelf.top, R.shelf.h, 'R');
  for (let x = R.tree.dx - 2; x <= R.tree.dx + 2; x++) put(x, R.tree.top, '^');
  for (let up = 1; up <= R.tree.top; up++) put(R.tree.dx, up, '|');
  block(R.ruin.dx, R.ruin.w, R.ruin.top, R.ruin.h, 'U');
  for (let x = R.bridge.dx; x < R.bridge.dx + R.bridge.w; x++) put(x, R.bridge.top, '~');
  block(R.mesa.dx, R.mesa.w, R.mesa.top, R.mesa.h, 'R');
  for (let up = 1; up <= R.snag.top; up++) put(R.snag.dx, up, '|');
  block(R.block.dx, R.block.w, R.block.top, R.block.h, 'U');
  block(R.slab.dx, R.slab.w, R.slab.top, R.slab.h, 'U');
  block(R.spire.dx, R.spire.w, R.spire.top, R.spire.h, 'U');
  return grid.map(row => row.join(''));
}

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
  // The Quarry Gate (P2, §2.4): a gatehouse wall too tall to climb, its portcullis across the street.
  // The beacon lifts the bars (the engine turns them to air); the stone back wall stays: a gate passage.
  'quarry-gate': [
    '# # #',
    '#####',
    '#####',
    '#####',
    'BBBBB',
    'BBBBB',
    'BBBBB',
  ],
  // The High Roads over the Ember Quarry (P2, §2.6): built from HIGH_ROADS below.
  'high-roads': highRoadsGrid(),
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
    // A stone post seen behind the street: walked past.
    case 'p': return { node: null, back: BACK_STONE };
    // One World P2: the High Roads (open sky behind them) and the Quarry Gate's bars (a stone passage behind).
    case 'R': return { node: 'ridge-rock', back: BACK_NONE };
    case 'U': return { node: 'courier-ruin', back: BACK_NONE };
    case '|': return { node: 'ridge-trunk', back: BACK_NONE };
    case '^': return { node: 'ridge-canopy', back: BACK_NONE };
    case '~': return { node: 'rope-bridge', back: BACK_NONE };
    case 'B': return { node: 'gate-bar', back: BACK_STONE };
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
