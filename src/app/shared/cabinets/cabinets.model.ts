/**
 * cabinets.model.ts — the Lost Cabinets: where the Archivist's sixteen curio
 * cabinets stand, what each holds, how the Mirror Slate's Scan face reads them,
 * and the Cabinet of Curios set (docs/handoff/lost-cabinets.md; lore:
 * docs/world/lore-addendum.md, "The Lost Cabinets").
 *
 * Lore in one breath: before the Waystones the Archivist kept a Cabinet of
 * Curios — sixteen small true things the Archive could not file. When the
 * Archive was "put down", she sent each one home with a Ridge Courier, to be
 * kept where it was true, in a little cabinet latched with a sliver of the
 * Archive's moon mirror so that only the Archive's own glass could find it
 * again. Then the Waystones came, the Couriers stopped walking, and nobody
 * wrote down where. The Mirror Slate is a palm of that same mirror: held up,
 * it warms near its own latches. That is why the Scan is the glass's FIRST
 * face (tier I): it is Lune's glass that knows the latches, not Kael's brass.
 *
 * Every cabinet:
 *   - stands in a real place (a town street, a hunting ground, a High Road
 *     ledge, the Delve's rock, the Underhearth, a realm Delve), at a fixed
 *     world point (feet y), the same for every player;
 *   - is hidden until the Scan is held near it (no map marker, ever);
 *   - opens once per save and holds one curio (a real stack with a lore line),
 *     a little Gold on the curve (rule I), and sometimes a pet treat, the
 *     hatbox, or a clue that tunes the glass to a harder cabinet.
 * The five deep cabinets (the Underhearth and the four realm Delves) stay
 * silent to the glass until their clue's cabinet is open.
 *
 * Pure: no Angular, no DOM. Read by the play view, the Slate, the Codex,
 * scripts/check-meaning.js, scripts/economy-sim.mjs --cabinets and
 * scripts/lost-cabinets.test.cjs. Karma: cabinets.spec.ts.
 */
import { FLOOR } from '../../play/engine/engine.model';

export type CabinetRealm = 'infernal' | 'luminous' | 'umbral' | 'celestial' | 'verdant';
/** Where it stands, for the Codex and the economy bands: the deep ones need a clue and pay more. */
export type CabinetPlace = 'town' | 'hunt' | 'heights' | 'delve' | 'underhearth' | 'rift';

export interface CabinetDef {
  /** Unique: `cab-<place>` (the receipt and every grant are keyed by it). */
  id: string;
  /** The engine area it stands in. */
  area: string;
  realm: CabinetRealm;
  place: CabinetPlace;
  /** World x and the feet y of what it stands on (or the cell it is set into). */
  x: number;
  y: number;
  /** In a diggable Delve (the reach and the scan range are measured in cells there). */
  delve: boolean;
  /** The curio it holds (a stack id in CURIOS). */
  curio: string;
  /** Anything else inside: pet treats, the hatbox. */
  extras: readonly { id: string; qty: number }[];
  /** Gold as max(gold, goldSeconds of income) (rule I; economy-sim --cabinets). */
  gold: number;
  goldSeconds: number;
  /** The harder cabinet its clue tunes the glass to. */
  clueFor?: string;
  /** The cabinet whose clue must be open before the glass hears this one. */
  needs?: string;
}

/** Delve geometry (towns/infernal.ts, towns/*-delve.ts): row 0 starts at the world floor, 32 px cells. */
const CELL = 32;
/** A cabinet set into a Delve cell: centred in it, its feet on the cell's floor. */
const cell = (col: number, row: number) => ({ x: col * CELL + CELL / 2, y: FLOOR + (row + 1) * CELL, delve: true as const });
const ground = (x: number, y = FLOOR) => ({ x, y, delve: false as const });

/** Surface cabinets pay 3 min of income, the deep ones 8 (rule I quest band, 2-10 min). */
const SURFACE = { gold: 60, goldSeconds: 180 };
const DEEP = { gold: 240, goldSeconds: 480 };

export const PET_TREAT_ID = 'courier-honeycomb';
export const PET_HATBOX_ID = 'hatbox-of-small-crowns';
export const CURATOR_LOUPE_ID = 'curators-loupe';

/**
 * The sixteen cabinets, in the Archivist's catalogue order (the Codex lists
 * them so). The High Roads ones stand on the route of heights.ts: the Prism
 * slab (x0 + 1690 + 95, y -270) and the Orrery tree's canopy (x0 + 380, y
 * FLOOR - 320); a spec pins them to the route.
 */
export const CABINETS: readonly CabinetDef[] = [
  // ── The five towns (the Seamworks' up on the camp's high ledge, over the Vendor and the Forge) ──
  // One World (P2): the Seamworks' up in the Material Vendor's loft (col 23, its upstairs floor 4 rows over the street).
  { id: 'cab-seamworks', area: 'ember-delve', realm: 'infernal', place: 'town', ...ground(23 * CELL + CELL / 2, FLOOR - 4 * CELL), curio: 'curio-unstruck-bell', extras: [], ...SURFACE },
  { id: 'cab-court', area: 'luminous', realm: 'luminous', place: 'town', ...ground(1250), curio: 'curio-jar-of-noon', extras: [], ...SURFACE },
  { id: 'cab-archive', area: 'umbral', realm: 'umbral', place: 'town', ...ground(2100), curio: 'curio-blank-page', extras: [], ...SURFACE, clueFor: 'cab-ink-deeps' },
  { id: 'cab-orrery', area: 'celestial', realm: 'celestial', place: 'town', ...ground(1550), curio: 'curio-lost-moon', extras: [], ...SURFACE },
  { id: 'cab-canopy', area: 'verdant', realm: 'verdant', place: 'town', ...ground(1495), curio: 'curio-stubborn-seed', extras: [], ...SURFACE },
  // ── The hunting grounds (two of them up on the High Roads) ──
  // One World (P2): the Ember Quarry is a region of the Ember world; the cabinet stands under the Couriers' rope bridge (col 192).
  { id: 'cab-quarry', area: 'ember-delve', realm: 'infernal', place: 'hunt', ...ground(192 * CELL + CELL / 2), curio: 'curio-tally-stick', extras: [{ id: PET_TREAT_ID, qty: 3 }], ...SURFACE },
  { id: 'cab-prism-road', area: 'reflection-channels', realm: 'luminous', place: 'heights', ...ground(2345, -270), curio: 'curio-blinking-mirror', extras: [], ...SURFACE, clueFor: 'cab-prism-mines' },
  { id: 'cab-corridors', area: 'unrecorded-corridors', realm: 'umbral', place: 'hunt', ...ground(2650), curio: 'curio-unsigned-letter', extras: [{ id: PET_HATBOX_ID, qty: 1 }], ...SURFACE },
  { id: 'cab-orrery-road', area: 'orrery-rings', realm: 'celestial', place: 'heights', ...ground(940, FLOOR - 320), curio: 'curio-pressed-rose', extras: [], ...SURFACE, clueFor: 'cab-orrery-wells' },
  { id: 'cab-thicket', area: 'rootglass-thicket', realm: 'verdant', place: 'hunt', ...ground(2450), curio: 'curio-moss-locket', extras: [{ id: PET_TREAT_ID, qty: 3 }], ...SURFACE, clueFor: 'cab-root-deeps' },
  // ── The Ember Delve (Basalt Caverns: Kael's old forge-mines) and the Underhearth ──
  { id: 'cab-forge-mines', area: 'ember-delve', realm: 'infernal', place: 'delve', ...cell(30, 21), curio: 'curio-lamp-wick', extras: [{ id: PET_TREAT_ID, qty: 3 }], ...SURFACE, clueFor: 'cab-underhearth' },
  { id: 'cab-underhearth', area: 'ember-delve', realm: 'infernal', place: 'underhearth', ...cell(40, 74), curio: 'curio-kept-coal', extras: [], ...DEEP, needs: 'cab-forge-mines' },
  // ── The four realm Delves behind the Rift Gates ──
  { id: 'cab-ink-deeps', area: 'umbral-delve', realm: 'umbral', place: 'rift', ...cell(12, 40), curio: 'curio-clean-ink', extras: [], ...DEEP, needs: 'cab-archive' },
  { id: 'cab-root-deeps', area: 'verdant-delve', realm: 'verdant', place: 'rift', ...cell(50, 26), curio: 'curio-backward-rings', extras: [], ...DEEP, needs: 'cab-thicket' },
  { id: 'cab-prism-mines', area: 'luminous-delve', realm: 'luminous', place: 'rift', ...cell(14, 22), curio: 'curio-folded-shadow', extras: [], ...DEEP, needs: 'cab-prism-road' },
  { id: 'cab-orrery-wells', area: 'celestial-delve', realm: 'celestial', place: 'rift', ...cell(52, 44), curio: 'curio-last-chart', extras: [], ...DEEP, needs: 'cab-orrery-road' },
];

export const CABINET_IDS: readonly string[] = CABINETS.map(c => c.id);
export const cabinetDef = (id: string): CabinetDef | undefined => CABINETS.find(c => c.id === id);
export const cabinetsIn = (area: string): CabinetDef[] => CABINETS.filter(c => c.area === area);

/** The full set's reward, paid once when the sixteenth cabinet opens (rule I daily band, 20 min). */
export const FINAL_REWARD = { id: 'cabinets:final', gold: 900, goldSeconds: 1200, item: CURATOR_LOUPE_ID } as const;

// ── The things inside (check-meaning, found-in, the satchel and the Codex read these) ──

export interface CurioItem {
  id: string;
  /** English name (MATERIAL_NAMES carries the same; the Codex reads the i18n table). */
  name: string;
  /** The cabinet it is found in (null: the set's reward, or an extra found in several). */
  cabinet: string | null;
  /** Found in… lines. */
  foundIn: readonly string[];
  /** Where the game grants it (check-meaning sources). */
  sources: readonly string[];
  /** What it does (check-meaning uses). */
  uses: readonly string[];
  /** The lore line (English; ES lives in cabinets.i18n.ts). */
  lore: string;
}

const SET_USE = 'kept in the Cabinet of Curios set (Codex): opened cabinets count toward the set bonuses';
const curio = (id: string, name: string, cab: string, where: string, lore: string): CurioItem => ({
  id, name, cabinet: cab, foundIn: [`${where}: a Lost Cabinet, found with the Mirror Slate's Scan`],
  sources: [`the Lost Cabinet ${cab} (CabinetsService.open)`], uses: [SET_USE], lore,
});

export const CURIOS: readonly CurioItem[] = [
  curio('curio-unstruck-bell', 'The Unstruck Bell', 'cab-seamworks', 'Basalt Seamworks',
    'Cast without a clapper the year the forges went quiet. Nobody has rung it, so it still holds the note it was poured with.'),
  curio('curio-jar-of-noon', 'A Jar of Noon', 'cab-court', 'The Luminous Court',
    'Someone stoppered a jar at exactly midday and it kept the hour. Open it in the dark and your shadow points straight down.'),
  curio('curio-blank-page', 'A Page Left Blank on Purpose', 'cab-archive', 'The Nocturne Archive',
    'Filed, dated, signed, and empty. The Archivist\'s note in the margin: "Not lost. Waiting." A second line points under the Umbral gate.'),
  curio('curio-lost-moon', 'The Orrery\'s Lost Moon', 'cab-orrery', 'The Celestial Orrery',
    'A thumb-sized brass moon off the great orrery. The orrery has run a little wrong without it ever since, and nobody minded.'),
  curio('curio-stubborn-seed', 'A Seed That Would Not', 'cab-canopy', 'The Rootglass Canopy',
    'Planted forty times in forty soils. It refused every one, politely. The Archivist kept it as proof that no is also an answer.'),
  curio('curio-tally-stick', 'A Courier\'s Tally Stick', 'cab-quarry', 'Ember Quarry',
    'Notched once for every parcel carried over the Quarry. The last notch is only half cut: the Waystones opened that morning.'),
  curio('curio-blinking-mirror', 'A Mirror That Blinked', 'cab-prism-road', 'Reflection Channels, on the High Road',
    'For one instant a day your reflection closes its eyes. Its frame is scratched with a beam\'s path into the Prism Mines.'),
  curio('curio-unsigned-letter', 'The Unsigned Letter', 'cab-corridors', 'Unrecorded Corridors',
    'A whole letter of thanks with no name at either end. The Corridors could not copy it: there was nobody to substitute.'),
  curio('curio-pressed-rose', 'A Compass Rose Pressed Flat', 'cab-orrery-road', 'Orrery Rings, up the tree',
    'A compass rose dried between two charts like a flower. Its north still twitches toward the wells under the Orrery.'),
  curio('curio-moss-locket', 'Moss in a Locket', 'cab-thicket', 'Rootglass Thicket',
    'A locket that holds a pinch of moss instead of a portrait. It grows, very slowly, toward the roots below the Verdant gate.'),
  curio('curio-lamp-wick', 'The Forge-Mine Lamp Wick', 'cab-forge-mines', 'Ember Delve, set into the Basalt Caverns',
    'The last wick from Kael\'s old forge-mines, never lit. Wrapped round it, a courier\'s note: "Deeper. The warm one waits under the halls."'),
  curio('curio-kept-coal', 'A Coal That Kept Its Word', 'cab-underhearth', 'The Underhearth, set into the iron rock',
    'Banked a lifetime ago with a promise to stay warm. It has. Hold it and your hands remember a hearth you never sat at.'),
  curio('curio-clean-ink', 'A Bottle of Clean Ink', 'cab-ink-deeps', 'The Ink Deeps, set into the slate',
    'Ink that has never written anything. In the Deeps, where the ink remembers everything, it is the rarest thing there is.'),
  curio('curio-backward-rings', 'The Ring Count', 'cab-root-deeps', 'The Root Deeps, set into the heartwood',
    'A slice of World-Root whose rings count backwards. The Archivist dated it "tomorrow" and filed it under patience.'),
  curio('curio-folded-shadow', 'A Shadow, Folded', 'cab-prism-mines', 'The Prism Mines, set into the shadow glass',
    'A square of shadow folded like a letter. It weighs nothing, and the Mines\' light will not go near it.'),
  curio('curio-last-chart', 'The Last Star Chart', 'cab-orrery-wells', 'The Orrery Wells, set into the brass rock',
    'The chart the Meridians drew the night before the Waystones. Every star is where it was. The last line is in the Archivist\'s hand.'),
];

/** The extras and the set's reward: real stacks with their own uses. */
export const CABINET_EXTRAS: readonly CurioItem[] = [
  {
    id: PET_TREAT_ID, name: 'Courier\'s Honeycomb', cabinet: null,
    foundIn: ['Ember Quarry, Rootglass Thicket and the Ember Delve: three Lost Cabinets keep a little honeycomb'],
    sources: ['three Lost Cabinets (CabinetsService.open)'],
    uses: ['pet food: every pet eats it like its favourite (+2 affection)'],
    lore: 'Couriers carried honeycomb on the high roads: it never spoils, and every animal on the way would forgive you for anything.',
  },
  {
    id: PET_HATBOX_ID, name: 'Hatbox of Small Crowns', cabinet: 'cab-corridors',
    foundIn: ['Unrecorded Corridors: a Lost Cabinet, found with the Mirror Slate\'s Scan'],
    sources: ['the Lost Cabinet cab-corridors (CabinetsService.open)'],
    uses: ['carried: every pet may wear its hat now, without waiting for its affection'],
    lore: 'A round box of tiny hats, one for every kind of small creature the Archive ever met. They all fit. Nobody knows how.',
  },
  {
    id: CURATOR_LOUPE_ID, name: 'Curator\'s Loupe', cabinet: null,
    foundIn: ['The Cabinet of Curios: the Archivist\'s thanks, once all sixteen Lost Cabinets are open'],
    sources: ['the Cabinet of Curios set, all sixteen open (CabinetsService.open)'],
    uses: ['carried: the Scan also warms to rift shrines no lantern has touched, in the Delve'],
    lore: 'The Archivist\'s own loupe, sent after the last curio came home. "You found what I put down. Keep looking; it suits you."',
  },
];

export const CABINET_ITEMS: readonly CurioItem[] = [...CURIOS, ...CABINET_EXTRAS];

// ── The Cabinet of Curios set ──────────────────────────────────────────────

/**
 * Small and meaningful, each one about the hunt itself:
 *   4  Warm Glass          the Scan reads half again as far
 *   8  Pocketful of Crumbs every pet takes one more meal a day
 *   12 The Curator's Eye   starting a Scan, Glim says which way the nearest silent cabinet here lies
 *   16 The Last Page       the Archivist's reward: Gold, and the Curator's Loupe (the Scan finds rift shrines too)
 */
export type SetBonusId = 'warm-glass' | 'crumbs' | 'curators-eye' | 'last-page';
export const SET_BONUSES: readonly { id: SetBonusId; at: number }[] = [
  { id: 'warm-glass', at: 4 }, { id: 'crumbs', at: 8 }, { id: 'curators-eye', at: 12 }, { id: 'last-page', at: 16 },
];
export const hasBonus = (opened: number, id: SetBonusId): boolean => opened >= (SET_BONUSES.find(b => b.id === id)?.at ?? Infinity);
/** Warm Glass: how much further the Scan reads. */
export const WARM_GLASS = 1.5;
/** Pocketful of Crumbs: one more meal a day for every pet. */
export const CRUMBS_MEALS = 1;

/** The short story arc: one chapter per bonus (the Codex shows the ones reached). */
export const ARC_CHAPTERS: readonly number[] = [4, 8, 12, 16];
export function arcReached(opened: number): number { return ARC_CHAPTERS.filter(n => opened >= n).length; }

// ── The Scan ────────────────────────────────────────────────────────────────

/**
 * How warm the glass reads. 'none': nothing in this place can be heard (all
 * open, or none here, or every one still waits on its clue); 'cold': something
 * here, out of range; then cool → warm → hot → burning (close enough to see).
 */
export type Warmth = 'none' | 'cold' | 'cool' | 'warm' | 'hot' | 'burning';
export const WARMTHS: readonly Warmth[] = ['none', 'cold', 'cool', 'warm', 'hot', 'burning'];

export const SCAN = {
  /** How far the glass reads, world px (a town is ~2-3.6k wide; a Delve core 64-120 cells). */
  surfaceRange: 1600, delveRange: 1280,
  /** Within this the cabinet shows itself (it stays shown for the session). */
  surfaceReveal: 150, delveReveal: 110,
  /** Bands, as a share of the range. */
  cool: 1, warm: .6, hot: .3,
} as const;

/** The pulse: seconds between two pings, and the ping's pitch in semitones. */
export const PULSE: Readonly<Record<Warmth, { period: number; pitch: number }>> = {
  none: { period: 0, pitch: 0 }, cold: { period: 2.6, pitch: 0 }, cool: { period: 1.8, pitch: 2 },
  warm: { period: 1.1, pitch: 5 }, hot: { period: .65, pitch: 9 }, burning: { period: .4, pitch: 12 },
};

/** Reach round a shown cabinet, world px, Keeper's feet to its feet (the Delve's figures are half size). */
export const CABINET_REACH = { surface: { x: 72, y: 80 }, delve: { x: 56, y: 64 } } as const;

/** Whether the glass can hear this cabinet: not open, and its clue (if it needs one) is open. */
export function tuned(def: CabinetDef, opened: ReadonlySet<string>): boolean {
  return !opened.has(def.id) && (!def.needs || opened.has(def.needs));
}

export interface ScanReading {
  warmth: Warmth;
  /** The nearest tuned cabinet here, and how far (world px). */
  id: string | null;
  distance: number;
}

/** The warmth of a distance, against a range and a reveal radius. Pure. */
export function warmthAt(distance: number, range: number, reveal: number): Exclude<Warmth, 'none'> {
  if (distance <= reveal) return 'burning';
  const f = distance / Math.max(1, range);
  if (f > SCAN.cool) return 'cold';
  if (f > SCAN.warm) return 'cool';
  if (f > SCAN.hot) return 'warm';
  return 'hot';
}

/**
 * Read the glass: the nearest cabinet the glass can hear in this area, and how
 * warm it reads at the Keeper's feet. `opened` is the save's set; `warmGlass`
 * the 4-curio bonus.
 */
export function scanReading(area: string, at: { x: number; y: number }, opened: ReadonlySet<string>, warmGlass = false): ScanReading {
  let best: CabinetDef | null = null, bestD = Infinity;
  for (const def of CABINETS) {
    if (def.area !== area || !tuned(def, opened)) continue;
    const d = Math.hypot(def.x - at.x, def.y - at.y);
    if (d < bestD) { bestD = d; best = def; }
  }
  if (!best) return { warmth: 'none', id: null, distance: Infinity };
  const range = (best.delve ? SCAN.delveRange : SCAN.surfaceRange) * (warmGlass ? WARM_GLASS : 1);
  return { warmth: warmthAt(bestD, range, best.delve ? SCAN.delveReveal : SCAN.surfaceReveal), id: best.id, distance: bestD };
}

/** The Curator's Eye: which way the nearest tuned cabinet here lies, or null. */
export function eyeDirection(area: string, at: { x: number; y: number }, opened: ReadonlySet<string>): 'east' | 'west' | 'up' | 'down' | null {
  const r = scanReading(area, at, opened);
  const def = r.id ? cabinetDef(r.id) : undefined;
  if (!def) return null;
  const dx = def.x - at.x, dy = def.y - at.y;
  if (Math.abs(dy) > Math.abs(dx)) return dy < 0 ? 'up' : 'down';
  return dx >= 0 ? 'east' : 'west';
}

/** Whether the Keeper's feet are within reach of a cabinet. */
export function inReach(def: CabinetDef, at: { x: number; y: number }): boolean {
  const r = def.delve ? CABINET_REACH.delve : CABINET_REACH.surface;
  return Math.abs(def.x - at.x) <= r.x && Math.abs(def.y - at.y) <= r.y;
}

/** The clues the Keeper holds whose cabinet is still shut: what the Slate's Scan face lists. */
export function openClues(opened: ReadonlySet<string>): CabinetDef[] {
  return CABINETS.filter(c => c.clueFor && opened.has(c.id) && !opened.has(c.clueFor)).map(c => cabinetDef(c.clueFor!)!).filter(Boolean);
}
