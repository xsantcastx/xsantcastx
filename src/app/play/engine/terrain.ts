/**
 * terrain.ts — diggable tile terrain for delve areas. Pure: no DOM, no Angular.
 *
 * An area that declares `terrain` (a TerrainSpec) gets a grid of CELL-px cells
 * hanging below its surface (row 0's top edge sits at `spec.top`, the floor
 * line). Every cell is one node type from TERRAIN_NODES: what it looks like,
 * how many hits it takes, which tool (and tier) can work it, and what breaking
 * it pays out. Generation is deterministic from the spec's seed, so the same
 * area always opens with the same rock.
 *
 * Node data format (the Skills and Homestead agents read this):
 *
 *   {
 *     id: 'cinder-vein', label: 'Cinder Ore vein', solid: true,
 *     hp: 3,                      // hits at the minimum tier
 *     tools: { pickaxe: 1 },      // tool → minimum tier. {} = unbreakable
 *     discipline: 'mining', xp: 2,
 *     yield: { materialId: 'cinder-ore', qty: 1, chance?: 1 },
 *     minLevel: 1,                // skill level for `discipline`, checked when the host says it
 *     glow: { color, radius },    // light source when exposed; glint through rock
 *   }
 *
 * A hit with tool tier T on a node whose minimum is M deals 1 + (T - M) / 2.
 * Breaking a node that pays xp or a yield asks the host first (the engine's
 * `onWorldAction`); a refusal leaves the cell standing.
 */
import type { DisciplineId } from '../../shared/activity/activity.model';

/** Cell edge in world px. The Keeper is drawn at half size in delves: three cells tall. */
export const CELL = 32;
/** Chunk edge in cells, the unit of render caching. */
export const CHUNK = 8;

export type ToolKind = 'pickaxe' | 'axe' | 'sickle' | 'blade' | 'staff';
export const TOOL_KINDS: readonly ToolKind[] = ['pickaxe', 'axe', 'sickle', 'blade', 'staff'];
export type WorldActionKind = 'mine' | 'chop' | 'forage' | 'cut' | 'blast';
/** What working a node with each tool is called. */
export const TOOL_ACTION: Readonly<Record<ToolKind, WorldActionKind>> = {
  pickaxe: 'mine', axe: 'chop', sickle: 'forage', blade: 'cut', staff: 'blast',
};
export const TOOL_LABEL: Readonly<Record<ToolKind, string>> = {
  pickaxe: 'Pickaxe', axe: 'Axe', sickle: 'Sickle', blade: 'Blade', staff: 'Staff',
};
/** Tier per tool; 0 or absent = the Keeper has none. */
export type ToolTiers = Partial<Record<ToolKind, number>>;
/** Tools a swing (attack) can use. The staff only works through its blast. */
export const SWING_TOOLS: readonly ToolKind[] = ['pickaxe', 'axe', 'sickle', 'blade'];
export const BLAST_TOOLS: readonly ToolKind[] = ['staff'];

export interface NodeYield { materialId: string; qty: number; chance?: number }
export interface TerrainNodeDef {
  id: string;
  label: string;
  solid: boolean;
  /** Hits to break at the minimum tier. Infinity = never. */
  hp: number;
  tools: ToolTiers;
  discipline: DisciplineId;
  xp: number;
  yield?: NodeYield;
  /** Skill level (in `discipline`) needed; mirrors MINING_TIERS for ore. */
  minLevel?: number;
  /** Palette: body, shadow edge, lit edge, fleck/nugget. */
  base: string; dark: string; light: string; fleck: string;
  glow?: { color: string; radius: number };
  /**
   * Sealed until a once-per-player flag is set (a guardian's `once`): any hit
   * clangs with `refusal` until then. The engine checks the flag, not the host.
   */
  guard?: { flag: string; refusal: string };
  /** The placeable stack breaking it drops into the satchel ('dirt-block'), paid by the host. */
  block?: PlaceableId;
  /** A placed thing that is not dug but taken back whole (torch, ladder, chest): its stack id. */
  placeable?: PlaceableId;
  /** Not solid, but a floor from above: land on it, drop through holding Down (platforms, ladder tops). */
  oneWay?: true;
  /** Climbable: Up/Down move the Keeper along it, and it holds them still (ladders). */
  climb?: true;
  /**
   * Used with E or a tap, like a station: the host opens it (a chest's
   * contents, a camp's crafting). A rift shrine is the engine's own: it shows
   * the tunnels round it on the map, and the host pays its first touch.
   */
  use?: 'chest' | 'camp' | 'shrine' | 'anchor' | 'mark' | 'furnace' | 'gate' | 'brazier' | 'mirror';
  /**
   * A rail the Seam Cart rides (Phase 8, traversal.ts): Kael's old lines
   * (generated) and the Keeper's own (placed). Consecutive rail cells join
   * left and right, level or one row up or down.
   */
  rail?: true;
  /**
   * Dark until struck (cold coal): its glow shows only once a swing has
   * cracked it ("cold to the touch. Strike it and it remembers").
   */
  struckGlow?: true;
  /**
   * A procedural find (the endless Delve's structures): once dug, its empty
   * cell is the receipt, kept by the save. Regrowth (a far tunnel healing,
   * sector-world.ts) never brings it back, so it pays once per player.
   */
  receipt?: true;
  /** A placed support: loose rock within this many cells (Chebyshev) holds when dug. */
  support?: number;
  /** A placed blasting charge: its fuse is lit when placed (engine `fuses`). */
  charge?: true;
}

/** The flag the Seam Eater sets when it falls (delve save `claimed`). */
export const WARDEN_FLAG = 'warden-defeated';

const ROCK = { base: '#5c5359', dark: '#3a3339', light: '#877c84', fleck: '#a0949b' };

/**
 * Every node type. Index in this list is the byte stored per cell, so append
 * only — index 0 is open air.
 */
export const TERRAIN_NODE_LIST: readonly TerrainNodeDef[] = [
  { id: 'air', label: 'Open air', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0, base: '#120c10', dark: '#0b0709', light: '#1d1418', fleck: '#000' },
  // Dirt and loam: an Ember Grub (fishing bait) one dig in twenty (delve-and-beyond.md §5.2).
  { id: 'dirt', label: 'Loose dirt', solid: true, hp: 1, tools: { pickaxe: 1, axe: 1, staff: 1 }, discipline: 'mining', xp: 0, block: 'dirt-block', yield: { materialId: 'ember-grub', qty: 1, chance: .05 }, base: '#8c5a37', dark: '#5c3a22', light: '#b47a4c', fleck: '#cf9c68' },
  { id: 'rock', label: 'Basalt', solid: true, hp: 2, tools: { pickaxe: 1 }, discipline: 'mining', xp: 1, block: 'basalt-block', ...ROCK },
  { id: 'hard-rock', label: 'Hard basalt', solid: true, hp: 4, tools: { pickaxe: 1 }, discipline: 'mining', xp: 2, block: 'basalt-block', base: '#423b48', dark: '#2a2530', light: '#655c6e', fleck: '#7d7486' },
  { id: 'cinder-vein', label: 'Cinder Ore vein', solid: true, hp: 3, tools: { pickaxe: 1 }, discipline: 'mining', xp: 2, minLevel: 1,
    yield: { materialId: 'cinder-ore', qty: 1 }, ...ROCK, fleck: '#ffa040', glow: { color: '#ff9b4f', radius: 46 } },
  { id: 'slag-vein', label: 'Slag vein', solid: true, hp: 4, tools: { pickaxe: 2 }, discipline: 'mining', xp: 5, minLevel: 8,
    yield: { materialId: 'slag-fragment', qty: 1 }, base: '#4a454e', dark: '#2e2a32', light: '#6e6874', fleck: '#5ff0d8', glow: { color: '#8fd6cf', radius: 42 } },
  { id: 'heartstone-vein', label: 'Heartstone vein', solid: true, hp: 6, tools: { pickaxe: 3 }, discipline: 'mining', xp: 12, minLevel: 20,
    yield: { materialId: 'infernal-heartstone', qty: 1 }, base: '#5c2438', dark: '#3a1424', light: '#8a3c56', fleck: '#ff5a8a', glow: { color: '#ff4f7a', radius: 70 } },
  { id: 'cracked-wall', label: 'Cracked wall', solid: true, hp: 2, tools: { staff: 1 }, discipline: 'exploration', xp: 3,
    base: '#4c3a62', dark: '#2e2242', light: '#715a8c', fleck: '#d8b4ff', glow: { color: '#b88cff', radius: 34 } },
  { id: 'roots', label: 'Tangled roots', solid: true, hp: 1, tools: { sickle: 1, blade: 1 }, discipline: 'foraging', xp: 1,
    yield: { materialId: 'thornroot', qty: 1, chance: .5 }, base: '#5a3c22', dark: '#3a2614', light: '#a8854c', fleck: '#d8b66c' },
  // A trunk the World-Root sank into the basalt: the axe's work, so the Delve
  // trains Woodcutting by what you find, not only Mining.
  { id: 'petrified-trunk', label: 'Petrified trunk', solid: true, hp: 3, tools: { axe: 1 }, discipline: 'woodcutting', xp: 4,
    yield: { materialId: 'world-root-bark', qty: 1, chance: .6 }, base: '#70492a', dark: '#4a2f18', light: '#a6784a', fleck: '#d4a86c' },
  { id: 'bedrock', label: 'Bedrock', solid: true, hp: Infinity, tools: {}, discipline: 'mining', xp: 0, base: '#28222e', dark: '#16121a', light: '#3c3446', fleck: '#4c4258' },
  // The most common vein: a quarter of strikes leave Ember Residue (audit #1).
  { id: 'ember-rock', label: 'Ember-veined basalt', solid: true, hp: 2, tools: { pickaxe: 1 }, discipline: 'mining', xp: 1,
    yield: { materialId: 'ember-residue', qty: 1, chance: .25 }, ...ROCK, fleck: '#ffc25c', glow: { color: '#ff8a3d', radius: 64 } },
  { id: 'cache', label: 'Keeper\'s cache', solid: true, hp: 1, tools: { pickaxe: 1, axe: 1, sickle: 1, blade: 1 }, discipline: 'exploration', xp: 8,
    yield: { materialId: 'ember-residue', qty: 1 }, base: '#6b4a2c', dark: '#3a2617', light: '#c9a06a', fleck: '#ffd36d', glow: { color: '#ffd36d', radius: 52 } },
  // ── Biomes (Phase 2.6). Appended: the index is the saved byte. ──
  // Root Hollows: soil the World-Root's shadow grew through.
  { id: 'root-loam', label: 'Root-bound loam', solid: true, hp: 1, tools: { pickaxe: 1, axe: 1, staff: 1 }, discipline: 'mining', xp: 0, block: 'dirt-block', yield: { materialId: 'ember-grub', qty: 1, chance: .05 },
    base: '#6e4a2e', dark: '#48301e', light: '#946642', fleck: '#7fb04a' },
  // The inverse tree that grows downward: the cutting Verrin asks for.
  { id: 'shadow-root', label: 'Shadow-root', solid: true, hp: 2, tools: { sickle: 1, blade: 1 }, discipline: 'foraging', xp: 3,
    yield: { materialId: 'shadow-root-cutting', qty: 1, chance: .75 }, base: '#3e2858', dark: '#281838', light: '#7c54aa', fleck: '#c4a0ff', glow: { color: '#9b7ad6', radius: 30 } },
  // Glowcap Grotto: stone wet with the light seeping through the fracture.
  { id: 'grotto-stone', label: 'Grotto stone', solid: true, hp: 3, tools: { pickaxe: 1 }, discipline: 'mining', xp: 1, block: 'basalt-block',
    base: '#2c5668', dark: '#1c3846', light: '#4a8296', fleck: '#86d2e6' },
  { id: 'glowcap', label: 'Glowcap cluster', solid: true, hp: 1, tools: { sickle: 1, blade: 1 }, discipline: 'foraging', xp: 2,
    yield: { materialId: 'glowcap', qty: 1 }, base: '#244a5c', dark: '#163242', light: '#6fdcff', fleck: '#d0f6ff', glow: { color: '#7fc8ff', radius: 58 } },
  // Magma Halls: the fracture itself.
  { id: 'scorched-basalt', label: 'Scorched basalt', solid: true, hp: 4, tools: { pickaxe: 1 }, discipline: 'mining', xp: 2, block: 'basalt-block',
    base: '#6e2a1e', dark: '#481812', light: '#9c4630', fleck: '#ff8040' },
  // A carved wall: a backdrop the Keeper stands in front of and reads (E).
  { id: 'inscription', label: 'Carved inscription', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0,
    base: '#2a2024', dark: '#171114', light: '#5a4636', fleck: '#e8c47a', glow: { color: '#e8c47a', radius: 40 } },
  // One per player: the diff keeps it dug, the host keeps it paid once.
  { id: 'godforge-fragment', label: 'Godforge fragment', solid: true, hp: 8, tools: { pickaxe: 1, staff: 1 }, discipline: 'exploration', xp: 40,
    yield: { materialId: 'godforge-fragment', qty: 1 }, base: '#4a3a24', dark: '#2a1f12', light: '#ffe9a8', fleck: '#fff4d0', glow: { color: '#ffe9a8', radius: 96 },
    guard: { flag: WARDEN_FLAG, refusal: 'The Seam Eater still stands. Defeat it to free the fragment' } },
  // Kael's old cache in the Maws' cavern: his lost hammer, once per player (the host's `claimed`).
  { id: 'kaels-cache', label: 'Kael\'s old cache', solid: true, hp: 2, tools: { pickaxe: 1, axe: 1, sickle: 1, blade: 1 }, discipline: 'exploration', xp: 10,
    yield: { materialId: 'kaels-hammer', qty: 1 }, base: '#5a3f2a', dark: '#2e1f14', light: '#d8b07a', fleck: '#ffd9a0', glow: { color: '#ffc97a', radius: 56 } },
  // ── Building (Phase 2.6). What the Keeper places. Never generated, only placed. ──
  // Blocks: no XP (placing and re-digging must not farm Mining), the block back on a break.
  { id: 'packed-dirt', label: 'Packed dirt', solid: true, hp: 1, tools: { pickaxe: 1, axe: 1, staff: 1 }, discipline: 'mining', xp: 0, block: 'dirt-block',
    base: '#96643f', dark: '#684429', light: '#bc8b5e', fleck: '#d2a678' },
  { id: 'basalt-block', label: 'Basalt block', solid: true, hp: 2, tools: { pickaxe: 1 }, discipline: 'mining', xp: 0, block: 'basalt-block',
    base: '#645b6a', dark: '#403a46', light: '#8c8494', fleck: '#a49cac' },
  // Placed things that are taken back whole (X, or a long-press), never dug.
  { id: 'torch', label: 'Torch', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0, placeable: 'torch',
    base: '#5a3a22', dark: '#2e1d10', light: '#ffd08a', fleck: '#ff9b4f', glow: { color: '#ffb066', radius: 150 } },
  { id: 'ladder', label: 'Ladder', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0, placeable: 'ladder', oneWay: true, climb: true,
    base: '#7a5a36', dark: '#3a2a18', light: '#b08a55', fleck: '#5a4026' },
  { id: 'platform', label: 'Platform', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0, placeable: 'platform', oneWay: true,
    base: '#8a6a40', dark: '#3a2a18', light: '#c9a06a', fleck: '#5a4026' },
  { id: 'chest', label: 'Chest', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0, placeable: 'chest', use: 'chest',
    base: '#6b4a2c', dark: '#3a2617', light: '#c9a06a', fleck: '#e8c47a' },
  // A portable workbench and its fire: crafting in the Delve, and a way back down from town.
  { id: 'camp', label: 'Camp', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0, placeable: 'camp', use: 'camp',
    base: '#5a3f2a', dark: '#2e1f14', light: '#b08a55', fleck: '#ff9b4f', glow: { color: '#ff9b4f', radius: 140 } },
  // Supports: a post and a cap beam. Walked through, taken back whole; loose
  // rock within `support` cells holds when it is dug (see isLoose / supportNear).
  { id: 'timber-support', label: 'Timber support', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0, placeable: 'timber-support', support: 3,
    base: '#7a5a36', dark: '#3a2a18', light: '#b08a55', fleck: '#5a4026' },
  { id: 'basalt-support', label: 'Basalt support', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0, placeable: 'basalt-support', support: 5,
    base: '#4a3a40', dark: '#241a1e', light: '#7a656e', fleck: '#ff9b4f' },
  // A blasting charge: lit when placed, it clears a small round of rock (engine `detonate`).
  { id: 'blast-charge', label: 'Blasting charge', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0, placeable: 'blast-charge', charge: true,
    base: '#6a2a22', dark: '#2e110e', light: '#d8b07a', fleck: '#ffd36d', glow: { color: '#ff6a3a', radius: 44 } },
  // ── Liquids (Phase 6). Where water meets lava, the smaller volume sets into
  // obsidian (liquids.ts). Never generated in the core: a made cell pays its
  // block only (`generated` in the engine), so an obsidian generator builds
  // walls, it does not mint XP. Phase 8's Underhearth generates it, and there
  // it pays its Mining XP like any rock.
  { id: 'obsidian', label: 'Obsidian', solid: true, hp: 5, tools: { pickaxe: 1 }, discipline: 'mining', xp: 3, block: 'obsidian-block',
    base: '#2a1f3a', dark: '#140e20', light: '#5a4a7a', fleck: '#a48bff' },
  // A placed obsidian block: built with, dug back as a block, no XP.
  { id: 'obsidian-block', label: 'Obsidian block', solid: true, hp: 5, tools: { pickaxe: 1 }, discipline: 'mining', xp: 0, block: 'obsidian-block',
    base: '#30243f', dark: '#181024', light: '#62527f', fleck: '#b49cff' },
  // ── The endless Delve (Phase 7). Laid by sector-gen.ts east and west of the core. ──
  // Kael's waycache: "For whoever comes next. Light it before you need it." A bundle of
  // torches he left in the Basalt Caverns; the dug cell is the receipt (it never regrows).
  { id: 'waycache', label: 'Kael\'s waycache', solid: true, hp: 2, tools: { pickaxe: 1, axe: 1, sickle: 1, blade: 1 }, discipline: 'exploration', xp: 6,
    yield: { materialId: 'torch', qty: 3 }, receipt: true, base: '#5e4630', dark: '#30221a', light: '#d3a873', fleck: '#ffcf8a', glow: { color: '#ffb066', radius: 48 } },
  // A rift the fracture scattered ("a passage created by difference"): touched, it shows the
  // tunnels round it on the map. Walked through, never dug; its light is violet.
  { id: 'rift-shrine', label: 'Rift shrine', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0, use: 'shrine',
    base: '#2e2242', dark: '#140a1f', light: '#b88cff', fleck: '#e8d8ff', glow: { color: '#b88cff', radius: 110 } },
  // ── The Underhearth (Phase 8, delve-and-beyond.md §2.2): rows 56-117 under the Magma Halls. ──
  // "Where fire is compressed into something else." Palette: iron black and obsidian, ember seams,
  // white-hot at the hottest (style guide §5.3, the Underhearth ramps).
  { id: 'iron-basalt', label: 'Iron-black basalt', solid: true, hp: 5, tools: { pickaxe: 3 }, discipline: 'mining', xp: 3, block: 'basalt-block',
    base: '#2a2027', dark: '#171116', light: '#443540', fleck: '#c4501e' },
  { id: 'banked-obsidian', label: 'Banked obsidian', solid: true, hp: 6, tools: { pickaxe: 4 }, discipline: 'mining', xp: 4, block: 'obsidian-block',
    base: '#2e2238', dark: '#1e1428', light: '#463650', fleck: '#6a5878' },
  // One of the sixteen pillars that held the Underhearth's ceiling (twelve were felled).
  { id: 'ironwood-pillar', label: 'Ironwood pillar', solid: true, hp: 5, tools: { axe: 4 }, discipline: 'woodcutting', xp: 14, minLevel: 45,
    yield: { materialId: 'ironwood', qty: 1 }, base: '#4a3a30', dark: '#2a2027', light: '#6e5a48', fleck: '#c4501e' },
  { id: 'emberheart-vein', label: 'Emberheart vein', solid: true, hp: 7, tools: { pickaxe: 4 }, discipline: 'mining', xp: 22, minLevel: 45,
    yield: { materialId: 'emberheart-ore', qty: 1 }, base: '#3a2430', dark: '#1e1428', light: '#6a3a3a', fleck: '#ffd08a', glow: { color: '#E8752A', radius: 64 } },
  { id: 'pyrite-seam', label: 'Pyrite seam', solid: true, hp: 5, tools: { pickaxe: 3 }, discipline: 'mining', xp: 10, minLevel: 25,
    yield: { materialId: 'pyrite-dust', qty: 1 }, base: '#443540', dark: '#2a2027', light: '#6a5878', fleck: '#e8c47a', glow: { color: '#e8c47a', radius: 30 } },
  // "The coal down here is cold to the touch. Strike it and it remembers."
  { id: 'cold-coal', label: 'Cold coal', solid: true, hp: 4, tools: { pickaxe: 4 }, discipline: 'mining', xp: 8, minLevel: 45, struckGlow: true,
    yield: { materialId: 'ember-residue', qty: 2 }, base: '#1c1420', dark: '#0e0a12', light: '#2e2238', fleck: '#57474f', glow: { color: '#ff9b4f', radius: 56 } },
  // The Banked Furnace's own slag, pressed so long it is half stone: Pickaxe V.
  { id: 'furnace-slag', label: 'Furnace slag', solid: true, hp: 8, tools: { pickaxe: 5 }, discipline: 'mining', xp: 30, minLevel: 60,
    yield: { materialId: 'godforge-slag', qty: 1 }, base: '#3a2a22', dark: '#1c1420', light: '#6a4a3a', fleck: '#ffd08a', glow: { color: '#c4501e', radius: 40 } },
  // One of the four pillars left standing, its heartwood: Axe V.
  { id: 'ironwood-heart', label: 'Ironwood heartpost', solid: true, hp: 8, tools: { axe: 5 }, discipline: 'woodcutting', xp: 26, minLevel: 60,
    yield: { materialId: 'ironwood', qty: 3 }, base: '#5a4434', dark: '#2a2027', light: '#8a6a50', fleck: '#ffd08a', glow: { color: '#c4501e', radius: 36 } },
  // The fracture's own line through the rock: never breaks, always lit. Lore, not loot.
  { id: 'fracture-seam', label: 'Fracture seam', solid: true, hp: Infinity, tools: {}, discipline: 'exploration', xp: 0,
    base: '#2a1440', dark: '#140a1f', light: '#7b3fc4', fleck: '#b88cff', glow: { color: '#7b3fc4', radius: 60 } },
  // The Breach seal under the fragment chamber: Pickaxe IV, Delving 15, and Kael's word (The Fracture claimed).
  { id: 'hearth-seal', label: 'Banked seal', solid: true, hp: 2, tools: { pickaxe: 4 }, discipline: 'exploration', xp: 0, minLevel: 15,
    base: '#443540', dark: '#1e1428', light: '#c4501e', fleck: '#ffd08a', glow: { color: '#c4501e', radius: 44 },
    guard: { flag: 'underhearth-unsealed', refusal: 'The seal holds. Bring Kael the Godforge Fragment first: he knows what it holds back' } },
  // The Four's forge masonry: the furnace hall's floor and the furnace's own body. Never breaks.
  { id: 'hearth-brick', label: 'Hearth brick', solid: true, hp: Infinity, tools: {}, discipline: 'mining', xp: 0,
    base: '#4a2a28', dark: '#2a1418', light: '#7a3a2a', fleck: '#c4501e' },
  // The Banked Furnace's four vents (douse them with water) and its hearth stone (summon it there).
  { id: 'furnace-vent', label: 'Furnace vent', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0,
    base: '#2a2027', dark: '#140a1f', light: '#ffd08a', fleck: '#E8752A', glow: { color: '#ff9b4f', radius: 70 } },
  { id: 'furnace-hearth', label: 'The Banked Furnace', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0, use: 'furnace',
    base: '#2a2027', dark: '#140a1f', light: '#ffd08a', fleck: '#E8752A', glow: { color: '#E8752A', radius: 90 } },
  // A hammer-mark cut where one of the Four stood (four in every Delve). E takes a rubbing.
  { id: 'hammer-mark', label: 'Hammer-mark', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0, use: 'mark',
    base: '#2a2027', dark: '#140a1f', light: '#7a656e', fleck: '#ffd08a', glow: { color: '#ffd08a', radius: 36 } },
  // Kael's old rail (generated, ridden, never taken) and the Keeper's own Seam Rail (placed).
  { id: 'old-rail', label: 'Kael\'s old rail', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0, rail: true,
    base: '#4a3a30', dark: '#2a2027', light: '#8a7a6a', fleck: '#57474f' },
  { id: 'seam-rail', label: 'Seam Rail', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0, placeable: 'seam-rail', rail: true,
    base: '#6a5040', dark: '#3a2a18', light: '#a49cac', fleck: '#5a4026' },
  // Bark Rope: spooled down from a ledge to the floor; climbed like a ladder.
  { id: 'rope', label: 'Bark Rope', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0, placeable: 'bark-rope', climb: true,
    base: '#8a6a40', dark: '#4a3018', light: '#c9a06a', fleck: '#6a4a2c' },
  // A Rift Anchor: "a passage that holds only because both ends agree to." Up to eight; E travels.
  { id: 'rift-anchor', label: 'Rift Anchor', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0, placeable: 'rift-anchor', use: 'anchor',
    base: '#3a2a4a', dark: '#140a1f', light: '#b88cff', fleck: '#e8d8ff', glow: { color: '#b88cff', radius: 96 } },
  // The Four's outpost cache: what they left at the forge corner (the dug cell is the receipt).
  { id: 'hearth-cache', label: 'The Four\'s cache', solid: true, hp: 2, tools: { pickaxe: 1, axe: 1, sickle: 1, blade: 1 }, discipline: 'exploration', xp: 12,
    yield: { materialId: 'ironwood', qty: 2 }, receipt: true, base: '#4a3a30', dark: '#2a2027', light: '#c9a06a', fleck: '#ffd08a', glow: { color: '#ffb066', radius: 48 } },
  // ── The Rift Gates (shared/delve/rift-gates.model.ts; lore-addendum.md "The Rift Gates"). ──
  // A gate's opening, one node per realm (its light is the realm's colour): walked through, never dug.
  // E: attune it with the realm's sigil, step through, or (on the realm side) step back out.
  { id: 'rift-gate-umbral', label: 'Umbral rift gate', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0, use: 'gate',
    base: '#1a1028', dark: '#0a0612', light: '#a48bff', fleck: '#e8d8ff', glow: { color: '#a48bff', radius: 120 } },
  { id: 'rift-gate-luminous', label: 'Luminous rift gate', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0, use: 'gate',
    base: '#2a2414', dark: '#140f06', light: '#ffe9a8', fleck: '#fff6d8', glow: { color: '#ffe9a8', radius: 120 } },
  { id: 'rift-gate-celestial', label: 'Celestial rift gate', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0, use: 'gate',
    base: '#10202e', dark: '#060e16', light: '#5fb6ff', fleck: '#d8ecff', glow: { color: '#5fb6ff', radius: 120 } },
  { id: 'rift-gate-verdant', label: 'Verdant rift gate', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0, use: 'gate',
    base: '#10241a', dark: '#06120c', light: '#7fd5a3', fleck: '#d8ffe8', glow: { color: '#7fd5a3', radius: 120 } },
  // The gate's frame: older than the Delve, and it does not break.
  { id: 'rift-frame', label: 'Rift frame', solid: true, hp: Infinity, tools: {}, discipline: 'exploration', xp: 0,
    base: '#3a3046', dark: '#1a1424', light: '#7a6a90', fleck: '#d8c0ff' },
  // Rift splinters: the gate's frame shed them as the rift settled. Pickaxe IV; a Realm Sigil's frame.
  { id: 'rift-splinter', label: 'Rift splinter', solid: true, hp: 5, tools: { pickaxe: 4 }, discipline: 'mining', xp: 14, minLevel: 40,
    yield: { materialId: 'rift-splinter', qty: 1 }, base: '#33284a', dark: '#1a1428', light: '#9a84c4', fleck: '#e8d8ff', glow: { color: '#b88cff', radius: 40 } },
  // ── The Umbral Delve, the Ink Deeps (play/engine/realm-gen.ts; the Umbral's underside). ──
  // Ink-slate: the Ink Shallows' rock, black-violet and damp. Pickaxe III.
  { id: 'ink-slate', label: 'Ink-slate', solid: true, hp: 5, tools: { pickaxe: 3 }, discipline: 'mining', xp: 3, block: 'basalt-block',
    base: '#1e1828', dark: '#0e0a16', light: '#3a2e4c', fleck: '#6a5a86' },
  // Gloam-slate: the Gloam Deep's rock, pressed under the shallows. Pickaxe IV.
  { id: 'gloam-slate', label: 'Gloam-slate', solid: true, hp: 6, tools: { pickaxe: 4 }, discipline: 'mining', xp: 4, block: 'obsidian-block',
    base: '#16121e', dark: '#08060e', light: '#2e2640', fleck: '#4a3e66' },
  // Inkstone: the "ink ore": stone that has drunk so much ink it writes. Pickaxe IV, Mining 48.
  { id: 'inkstone-vein', label: 'Inkstone vein', solid: true, hp: 7, tools: { pickaxe: 4 }, discipline: 'mining', xp: 20, minLevel: 48,
    yield: { materialId: 'inkstone', qty: 1 }, base: '#1c1626', dark: '#0a0812', light: '#2e2440', fleck: '#8a6cff', glow: { color: '#6a4adf', radius: 38 } },
  // Nightglass: glass the dark made where no light ever fell. Pickaxe IV, Mining 55.
  { id: 'nightglass-vein', label: 'Nightglass vein', solid: true, hp: 8, tools: { pickaxe: 4 }, discipline: 'mining', xp: 28, minLevel: 55,
    yield: { materialId: 'nightglass', qty: 1 }, base: '#141020', dark: '#06040c', light: '#3a3060', fleck: '#c8b8ff', glow: { color: '#c8b8ff', radius: 52 } },
  // An ink seep: where the realm's ink wells out of the rock. Sickle III: Umbral Ink, now and then.
  { id: 'ink-seep', label: 'Ink seep', solid: true, hp: 3, tools: { sickle: 3 }, discipline: 'foraging', xp: 12, minLevel: 35,
    yield: { materialId: 'umbral-ink', qty: 1, chance: .35 }, base: '#120c1c', dark: '#06040a', light: '#2a1e3c', fleck: '#a48bff' },
  // Drift-shale: rock that is only where it is while nobody is looking. No pick holds it; light pins it.
  { id: 'drift-shale', label: 'Drift-shale', solid: true, hp: Infinity, tools: {}, discipline: 'exploration', xp: 0,
    base: '#221a30', dark: '#0e0a16', light: '#4a3c66', fleck: '#8a7ab0' },
  // An ink mirror: a cavern's ceiling polished by the tide. It shows you walking above yourself.
  { id: 'ink-mirror', label: 'Ink mirror', solid: true, hp: Infinity, tools: {}, discipline: 'exploration', xp: 0,
    base: '#0c0814', dark: '#040208', light: '#6a5a96', fleck: '#e8d8ff' },
  // A gloam brazier (the Gloam Warden's hall): E lights it with a torch; it gutters out, and the tide puts it out.
  { id: 'gloam-brazier', label: 'Gloam brazier', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0, use: 'brazier',
    base: '#2a2030', dark: '#120c18', light: '#6a5a7a', fleck: '#8a7a9a' },
  { id: 'gloam-brazier-lit', label: 'Lit gloam brazier', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0,
    base: '#2a2030', dark: '#120c18', light: '#ffd08a', fleck: '#fff4dc', glow: { color: '#ffd8a0', radius: 170 } },
  // ── The Verdant Delve, the Root Deeps (play/engine/verdant-gen.ts; the Verdant's underside; verdant.ts). ──
  // Rootwood: the Root Tangle's rock is the World-Root's own living wood. Pickaxe III. Dug, it grows back.
  { id: 'rootwood', label: 'Rootwood', solid: true, hp: 5, tools: { pickaxe: 3 }, discipline: 'mining', xp: 3, block: 'dirt-block',
    base: '#3a2a1c', dark: '#24190f', light: '#7a5a36', fleck: '#7fb85a' },
  // Heartwood: older, pressed wood under the tangle. Pickaxe IV. It grows back too, slower to look at, as fast.
  { id: 'heartwood', label: 'Heartwood', solid: true, hp: 6, tools: { pickaxe: 4 }, discipline: 'mining', xp: 4, block: 'dirt-block',
    base: '#4a2e1c', dark: '#2a180e', light: '#8a5a32', fleck: '#c08a3e' },
  // Rootglass: sap that set into glass along the root's veins. Pickaxe IV, Mining 50.
  { id: 'rootglass-vein', label: 'Rootglass vein', solid: true, hp: 7, tools: { pickaxe: 4 }, discipline: 'mining', xp: 22, minLevel: 50,
    yield: { materialId: 'rootglass', qty: 1 }, base: '#2a2a1a', dark: '#14160c', light: '#4a7a3a', fleck: '#c4ffe0', glow: { color: '#7fd5a3', radius: 44 } },
  // Heart-amber: what the root bleeds where it was cut long ago. Pickaxe IV, Mining 58.
  { id: 'heart-amber-vein', label: 'Heart-amber vein', solid: true, hp: 8, tools: { pickaxe: 4 }, discipline: 'mining', xp: 30, minLevel: 58,
    yield: { materialId: 'heart-amber', qty: 1 }, base: '#3a2414', dark: '#1e1208', light: '#6a4010', fleck: '#ffc669', glow: { color: '#e0b060', radius: 54 } },
  // A living vine: hangs from the tangle's roofs; climb it (Up/Down), stand on its top.
  { id: 'living-vine', label: 'Living vine', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0, oneWay: true, climb: true,
    base: '#3a5a2a', dark: '#1e2a14', light: '#7fb85a', fleck: '#c4ffe0' },
  // A spore pod: touch one and it bursts (it stings). Struck with a sickle, it gives its sap. It grows back.
  { id: 'spore-pod', label: 'Spore pod', solid: true, hp: 2, tools: { sickle: 3, blade: 3 }, discipline: 'foraging', xp: 10, minLevel: 30,
    yield: { materialId: 'verdant-sap', qty: 1, chance: .45 }, base: '#4a5a1e', dark: '#24300e', light: '#a6c84a', fleck: '#f0ff9a', glow: { color: '#c8e86a', radius: 34 } },
  // A heart-root: the Graftmother's anchor in her hall's roof. Cut it (axe or pick); it grows back unless burnt or cut clean.
  { id: 'heart-root', label: 'Heart-root', solid: true, hp: 8, tools: { axe: 3, pickaxe: 4 }, discipline: 'woodcutting', xp: 20,
    base: '#5a2418', dark: '#30120a', light: '#9a4a2a', fleck: '#ff9a7a', glow: { color: '#ff6a4a', radius: 50 } },
  // ── The Luminous Delve, the Prism Mines (play/engine/luminous-gen.ts; the Luminous's underside; luminous.ts). ──
  // Prism-stone: the Galleries' pale rock, faceted. Pickaxe III.
  { id: 'prism-stone', label: 'Prism-stone', solid: true, hp: 5, tools: { pickaxe: 3 }, discipline: 'mining', xp: 3, block: 'basalt-block',
    base: '#5a5040', dark: '#3a3226', light: '#8a7a58', fleck: '#ffe7a0' },
  // Dawnstone: the deep's rock, where the light pressed longest. Pickaxe IV.
  { id: 'dawnstone', label: 'Dawnstone', solid: true, hp: 6, tools: { pickaxe: 4 }, discipline: 'mining', xp: 4, block: 'basalt-block',
    base: '#4a4232', dark: '#2a241a', light: '#7a6a48', fleck: '#fff1b0' },
  // Prismite: the crystal ore; light goes in one colour and comes out arguing. Pickaxe IV, Mining 50.
  { id: 'prismite-vein', label: 'Prismite vein', solid: true, hp: 7, tools: { pickaxe: 4 }, discipline: 'mining', xp: 22, minLevel: 50,
    yield: { materialId: 'prismite', qty: 1 }, base: '#4a4232', dark: '#2a241a', light: '#c9b88e', fleck: '#ffe9a8', glow: { color: '#ffe9a8', radius: 46 } },
  // Dawnglass: light that stood still so long it set. Pickaxe IV, Mining 58.
  { id: 'dawnglass-vein', label: 'Dawnglass vein', solid: true, hp: 8, tools: { pickaxe: 4 }, discipline: 'mining', xp: 30, minLevel: 58,
    yield: { materialId: 'dawnglass', qty: 1 }, base: '#3a3426', dark: '#1e1a12', light: '#e8d8a0', fleck: '#fffaf0', glow: { color: '#fff1b0', radius: 58 } },
  // A prism bloom: a crystal flower. Sickle III: a Luminous Prism, now and then.
  { id: 'prism-bloom', label: 'Prism bloom', solid: true, hp: 2, tools: { sickle: 3 }, discipline: 'foraging', xp: 10, minLevel: 30,
    yield: { materialId: 'luminous-prism', qty: 1, chance: .4 }, base: '#5a5040', dark: '#3a3226', light: '#fff1b0', fleck: '#a8e8ff', glow: { color: '#ffe7a0', radius: 36 } },
  // A sun-prism: the realm's sun, seen from underneath, caught in a crystal. It shines straight down, always.
  { id: 'sun-prism', label: 'Sun-prism', solid: true, hp: Infinity, tools: {}, discipline: 'exploration', xp: 0,
    base: '#8a7a58', dark: '#4a4030', light: '#fffaf0', fleck: '#fff1b0', glow: { color: '#fff1b0', radius: 110 } },
  // A prism mirror, two ways ('/' and '\'): E turns it. Stand on it. A beam that meets it turns a corner.
  { id: 'prism-mirror-a', label: 'Prism mirror', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0, oneWay: true, use: 'mirror',
    base: '#8a7a58', dark: '#4a4030', light: '#efe4c8', fleck: '#ffe9a8', glow: { color: '#ffe9a8', radius: 40 } },
  { id: 'prism-mirror-b', label: 'Prism mirror', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0, oneWay: true, use: 'mirror',
    base: '#8a7a58', dark: '#4a4030', light: '#efe4c8', fleck: '#ffe9a8', glow: { color: '#ffe9a8', radius: 40 } },
  // Solid light: where a beam crosses open air it is a floor (across) or a ladder (down). It goes when the beam does.
  { id: 'light-bridge', label: 'Light bridge', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0, oneWay: true,
    base: '#c9b88e', dark: '#8a7a58', light: '#fffaf0', fleck: '#fff1b0', glow: { color: '#fff1b0', radius: 40 } },
  { id: 'light-shaft', label: 'Light shaft', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0, oneWay: true, climb: true,
    base: '#c9b88e', dark: '#8a7a58', light: '#fffaf0', fleck: '#fff1b0', glow: { color: '#fff1b0', radius: 40 } },
  // Shadow glass: a floor only while light is on it. Unlit, it is a hole that looks like a floor.
  { id: 'umbra-pane', label: 'Shadow glass', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0,
    base: '#1a1610', dark: '#0e0c08', light: '#3a3426', fleck: '#5a5040' },
  { id: 'lit-pane', label: 'Lit glass', solid: false, hp: 0, tools: {}, discipline: 'exploration', xp: 0, oneWay: true,
    base: '#8a7a58', dark: '#5a5040', light: '#fff1b0', fleck: '#fffaf0' },
];
/** 1 where the node at that index is solid. Read per collision test, so a lookup, not a property walk. */
const SOLID_KIND = Uint8Array.from(TERRAIN_NODE_LIST, node => node.solid ? 1 : 0);
/** 1 where the node is a placed thing taken back whole (torch, ladder, chest…). */
const TAKEABLE_KIND = Uint8Array.from(TERRAIN_NODE_LIST, node => node.placeable && !node.solid ? 1 : 0);
/** 1 where the node is a one-way floor (platforms, ladders). */
const ONEWAY_KIND = Uint8Array.from(TERRAIN_NODE_LIST, node => node.oneWay ? 1 : 0);
/** 1 where the node is climbable (ladders). */
const CLIMB_KIND = Uint8Array.from(TERRAIN_NODE_LIST, node => node.climb ? 1 : 0);
/** 1 where the node is a rail (old or placed). */
const RAIL_KIND = Uint8Array.from(TERRAIN_NODE_LIST, node => node.rail ? 1 : 0);
export const TERRAIN_NODES: Readonly<Record<string, TerrainNodeDef>> = Object.fromEntries(TERRAIN_NODE_LIST.map(node => [node.id, node]));
const NODE_INDEX = new Map(TERRAIN_NODE_LIST.map((node, index) => [node.id, index]));
export function nodeIndex(id: string): number {
  const index = NODE_INDEX.get(id);
  if (index === undefined) throw new Error(`Unknown terrain node ${id}`);
  return index;
}
const AIR = 0;
const BEDROCK = nodeIndex('bedrock');

// ── Tools ──────────────────────────────────────────────────────────────────

export type ToolCheck =
  | { ok: true; tool: ToolKind; tier: number; damage: number }
  /** `need` null = nothing can break it (bedrock). */
  | { ok: false; need: { tool: ToolKind; tier: number } | null };

/**
 * The best of `allowed` tools the Keeper holds that can work `node`, and its
 * damage per hit (1 + (tier - min) / 2, times the wielding skill's `power`
 * multiplier when given — fractional, so a cell's HP may go fractional too);
 * or the requirement to show when none can. Pure.
 */
export function toolFor(node: Pick<TerrainNodeDef, 'tools'>, tiers: ToolTiers, allowed: readonly ToolKind[] = TOOL_KINDS, power?: Partial<Record<ToolKind, number>>): ToolCheck {
  let best: { tool: ToolKind; tier: number; damage: number } | null = null;
  let need: { tool: ToolKind; tier: number } | null = null;
  for (const tool of TOOL_KINDS) {
    const min = node.tools[tool];
    if (!min) continue;
    const have = tiers[tool] ?? 0;
    if (allowed.includes(tool) && have >= min) {
      const damage = (1 + (have - min) / 2) * (power?.[tool] ?? 1);
      if (!best || damage > best.damage) best = { tool, tier: have, damage };
    } else if (!need || (allowed.includes(tool) && !allowed.includes(need.tool))) {
      // Prefer naming a tool this action could use (a swing names the pickaxe, not the staff).
      need = { tool, tier: min };
    }
  }
  return best ? { ok: true, ...best } : { ok: false, need };
}

const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI'];
/** "Pickaxe II". */
export function toolName(tool: ToolKind, tier: number): string {
  return `${TOOL_LABEL[tool]} ${ROMAN[tier] ?? tier}`;
}

// ── Generation ─────────────────────────────────────────────────────────────

/** Ambient particles a biome breathes: spores drift, embers rise, motes wander, ash falls. */
export type BiomeParticle = 'spore' | 'ember' | 'mote' | 'ash';

/**
 * A depth band of a delve with its own look and node mix. Pure data; the
 * renderer and lighting read it, generation stamps its veins.
 */
export interface BiomeDef {
  id: string;
  name: string;
  /** Rows above `to` belong to this biome (the last biome runs to the bottom). */
  to: number;
  /** Tunnel back wall: two tones (hash-picked) and the shadow under rock. */
  wall: readonly [string, string, string];
  /** Darkness colour as `r,g,b`: the dark is never pure black, it is this biome's dark. */
  dark: string;
  /** A soft wash over the lit world (overlay), and its strength 0..1. */
  wash: { color: string; alpha: number };
  /** Ambient particles: kind, colour, how many at once (the pool caps the total). */
  particles: { kind: BiomeParticle; color: string; count: number };
  /** Heat shimmer over the view (Magma Halls). Reduced motion keeps it still. */
  shimmer?: boolean;
  /** This biome's node mix: vein blobs stamped after the shared ones. */
  veins: readonly VeinSpec[];
  /**
   * Loose ceiling: this share (0..1) of the biome's own band rock (`node`) is
   * loose, picked by a fixed hash of the cell. Digging a loose cell with no
   * support near drops rubble. Derived, never generated: adding or retuning it
   * changes no cell, so it needs no `version` bump.
   */
  loose?: { node: string; chance: number };
  /**
   * Ink-blind (the Umbral Delve): the lantern reaches only this share of its
   * radius here, and the unlit dark is deeper (ambient floor 0.92, not 0.8).
   * Torches and glowing veins are untouched: placed light is how you push back.
   */
  gloom?: number;
}

/** Liquid types, as stored per cell (`Terrain.liqType`). 0 is none. Append only. */
export const LIQUID_NONE = 0, LIQUID_WATER = 1, LIQUID_LAVA = 2;
/**
 * Ink (the Umbral Delve's liquid; realm-gen.ts): heavier than water (it sinks
 * under it, and water rests on it), slow (half water's pace), and it drinks
 * light: a Keeper whose head is under it carries almost none.
 */
export const LIQUID_INK = 3;
export type LiquidKind = 'water' | 'lava' | 'ink';
export const LIQUID_IDS: readonly (LiquidKind | null)[] = [null, 'water', 'lava', 'ink'];
/** A full cell of liquid. Each level is 2 art px (4 world px) of the 16 art px cell. */
export const LIQUID_FULL = 8;
/** Generated liquid: fills the open cells of a rectangle at `level` (default full). Solid cells are skipped. */
export interface LiquidStamp { col: number; row: number; w?: number; h?: number; liquid: LiquidKind; level?: number }

export interface VeinSpec { node: string; from: number; to: number; count: number; size: number; cols?: readonly [number, number] }

/** A hand-placed carved wall: interacting reports its id. Fixed for every player. */
export interface InscriptionSpec { id: string; col: number; row: number }

export interface TerrainSpec {
  seed: number;
  /**
   * Bump when the generator's output for a seed changes (rows, bands, veins,
   * stamps). Saved dig diffs are keyed by it, so an old diff is dropped rather
   * than applied to cells that now mean something else.
   */
  version?: number;
  cols: number;
  rows: number;
  /** World y of row 0's top edge (the surface the Keeper walks in on). */
  top: number;
  /** Depth bands: rows above `to` use `node`. The last band runs to the bottom. */
  bands: readonly { to: number; node: string }[];
  /** Band edges wander ± this many rows per column. */
  jitter?: number;
  /** `count` blobs of `node`, about `size` cells each, in rows [from, to) and optional cols [lo, hi). */
  veins: readonly VeinSpec[];
  /**
   * Hand-placed rectangles, stamped last and in order. `node: 'air'` carves.
   * `protect`: a blasting charge never clears these cells (caches, sealed
   * walls); tools still work them. Marking a stamp changes no cell.
   */
  stamps: readonly { col: number; row: number; w?: number; h?: number; node: string; protect?: true }[];
  /**
   * Rectangles a blasting charge leaves alone until a once-per-player flag is
   * set (the fragment chamber, until its warden falls). Tools are unaffected.
   */
  sealed?: readonly { col: number; row: number; w: number; h: number; flag: string }[];
  /** Bedrock rows at the bottom. */
  bedrock: number;
  /** Depth biomes, top to bottom. Absent: one unnamed biome with the default look. */
  biomes?: readonly BiomeDef[];
  /** Carved walls, stamped after everything else (they never move). */
  inscriptions?: readonly InscriptionSpec[];
  /**
   * Lakes and pools, laid last, into open cells only (never into rock, so they
   * change no cell and need no `version` bump). They start settled (asleep).
   */
  liquids?: readonly LiquidStamp[];
  /**
   * Bump when the generated liquids change. A saved liquid diff is filed under
   * it (with the terrain layout) and dropped on a mismatch: the cells stay.
   */
  /**
   * A realm Delve behind a Rift Gate (rift-gates.model.ts): its wings come from
   * that realm's own generator (realm-gen.ts), not the Infernal strata's.
   */
  realm?: 'umbral' | 'verdant' | 'luminous';
  liquidVersion?: number;
  /**
   * The core of an endless Delve (Phase 7): sector-world.ts generates sectors
   * east and west of this grid, forever, when the host's save can hold them
   * (`DelvePersistence.sectors`). The grid itself is unchanged.
   */
  endless?: true;
  /**
   * The deep strata under the core (Phase 8, the Underhearth): the endless
   * world's rows run on past `rows` down to `depth.rows`, every column
   * (sector-gen.ts → underhearth-gen.ts), each deep band with its own biome
   * (appended after `biomes`). The core's own `rows` and grid never change.
   */
  depth?: { rows: number; biomes: readonly BiomeDef[] };
}

/** The look a terrain without biomes gets: today's basalt dark. */
export const DEFAULT_BIOME: BiomeDef = {
  id: 'delve', name: '', to: Infinity, wall: ['#1a1115', '#160e12', '#0a0608'], dark: '5,3,9',
  wash: { color: '#000000', alpha: 0 }, particles: { kind: 'ash', color: '#8a7468', count: 0 }, veins: [],
};

/** Index of the biome holding `row` (rows above 0 count as the first). Pure. */
export function biomeIndexAt(biomes: readonly BiomeDef[] | undefined, row: number): number {
  if (!biomes?.length) return -1;
  for (let i = 0; i < biomes.length - 1; i++) if (row < biomes[i].to) return i;
  return biomes.length - 1;
}
/** The biome holding `row`, or DEFAULT_BIOME. Pure. */
export function biomeAt(spec: Pick<TerrainSpec, 'biomes'>, row: number): BiomeDef {
  const i = biomeIndexAt(spec.biomes, row);
  return i < 0 ? DEFAULT_BIOME : spec.biomes![i];
}

/**
 * The key a saved dig diff is filed under: the grid's shape, the generator
 * version and the seed. Any of them changing means the diff's cell indices no
 * longer name the same rock, so the diff is dropped (see delve-save.model).
 */
export function terrainLayout(spec: Pick<TerrainSpec, 'cols' | 'rows' | 'version'>, seed: number): string {
  return `${spec.cols}x${spec.rows}:v${spec.version ?? 1}:${seed >>> 0}`;
}

/** mulberry32: small, fast, deterministic. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A grid of cells. Kinds and HP are typed arrays; nothing allocates per frame. */
export class Terrain {
  readonly kind: Uint8Array;
  readonly hp: Float32Array;
  readonly chunkCols: number;
  readonly chunkRows: number;
  /** Bumped whenever something a chunk draws changes. Renderers compare against what they drew. */
  readonly chunkRev: Uint32Array;
  readonly bottom: number;
  readonly width: number;
  /** The kinds as generated, before any dig or placement: what a diff is measured against. */
  base: Uint8Array;
  /** Biomes top to bottom, and the biome index of each row (0 when there are none). */
  biomes: readonly BiomeDef[] = [DEFAULT_BIOME];
  readonly biomeOfRow: Uint8Array;
  /** Inscription id per cell index, for the carved walls. */
  readonly inscriptions = new Map<number, string>();
  /** 1 where a hand stamp is marked `protect`: a blast never clears it. */
  readonly protect: Uint8Array;
  /** Sealed rectangles (spec `sealed`): a blast leaves them until their flag is set. */
  sealed: readonly { col: number; row: number; w: number; h: number; flag: string }[] = [];
  /** Liquid per cell: type (LIQUID_*) and level 0..LIQUID_FULL. Only open (non-solid) cells hold any. */
  readonly liqType: Uint8Array;
  readonly liqLevel: Uint8Array;
  /** The liquids as generated: what a saved liquid diff is measured against. */
  baseLiqType: Uint8Array;
  baseLiqLevel: Uint8Array;
  /** Bumped whenever any liquid cell changes (map thumbnails, tests). */
  liquidRev = 0;
  /**
   * Endless Delve (sector-world.ts): the arrays hold a RING of `cols` world
   * columns (a power of two), the loaded span [colLo, colHi). A world column
   * lives in slot `col & (cols - 1)`, so a cell's index is stable while it is
   * loaded and nothing else moves when the span does: the column that leaves
   * and the one that arrives share a slot. Off: the plain grid, cols 0..cols-1.
   */
  readonly ring: boolean;
  private readonly mask: number;
  /** World columns loaded: [colLo, colHi). The plain grid is [0, cols). */
  colLo = 0;
  colHi: number;
  constructor(readonly cols: number, readonly rows: number, readonly top: number, ring = false) {
    if (ring && (cols < CHUNK || (cols & (cols - 1)))) throw new Error('A ring terrain needs a power-of-two width');
    this.ring = ring;
    this.mask = cols - 1;
    this.colHi = cols;
    this.kind = new Uint8Array(cols * rows);
    this.liqType = new Uint8Array(cols * rows);
    this.liqLevel = new Uint8Array(cols * rows);
    this.baseLiqType = this.liqType;
    this.baseLiqLevel = this.liqLevel;
    this.protect = new Uint8Array(cols * rows);
    this.base = this.kind;
    this.biomeOfRow = new Uint8Array(rows);
    this.hp = new Float32Array(cols * rows);
    this.chunkCols = Math.ceil(cols / CHUNK);
    this.chunkRows = Math.ceil(rows / CHUNK);
    this.chunkRev = new Uint32Array(this.chunkCols * this.chunkRows);
    this.bottom = top + rows * CELL;
    this.width = cols * CELL;
  }
  index(col: number, row: number): number { return row * this.cols + (this.ring ? col & this.mask : col); }
  inside(col: number, row: number): boolean { return col >= this.colLo && row >= 0 && col < this.colHi && row < this.rows; }
  /** The world column of a cell index (the ring maps its slot back into the loaded span). */
  colOf(index: number): number {
    const slot = index % this.cols;
    return this.ring ? this.colLo + ((slot - this.colLo) & this.mask) : slot;
  }
  rowOf(index: number): number { return (index / this.cols) | 0; }
  /** World x of the loaded span's edges. */
  get left(): number { return this.colLo * CELL; }
  get right(): number { return this.colHi * CELL; }
  /** A body's x kept inside the loaded span (the plain grid: inside `width`, as the area declares). */
  clampX(x: number, width: number): number {
    return this.ring ? Math.max(this.left + 30, Math.min(this.right - 30, x)) : Math.max(30, Math.min(width - 30, x));
  }
  /** The chunkRev slot of a chunk (world chunk column `cc`, row `cr`), or -1 outside the loaded span. */
  chunkKey(cc: number, cr: number): number {
    if (cr < 0 || cr >= this.chunkRows) return -1;
    if (this.ring) {
      if (cc * CHUNK < this.colLo || cc * CHUNK >= this.colHi) return -1;
      return cr * this.chunkCols + (cc & (this.chunkCols - 1));
    }
    return cc < 0 || cc >= this.chunkCols ? -1 : cr * this.chunkCols + cc;
  }
  colAt(x: number): number { return Math.floor(x / CELL); }
  rowAt(y: number): number { return Math.floor((y - this.top) / CELL); }
  /** The biome a row lies in (rows above the grid read as the first). */
  biomeAt(row: number): BiomeDef {
    return this.biomes[this.biomeOfRow[Math.max(0, Math.min(this.rows - 1, row))]] ?? DEFAULT_BIOME;
  }
  /** Node at a cell. Above the surface is air; the sides and below the grid are bedrock. */
  nodeAt(col: number, row: number): TerrainNodeDef {
    if (row < 0) return TERRAIN_NODE_LIST[AIR];
    if (!this.inside(col, row)) return TERRAIN_NODE_LIST[BEDROCK];
    return TERRAIN_NODE_LIST[this.kind[this.index(col, row)]];
  }
  solid(col: number, row: number): boolean {
    if (row < 0) return false;
    if (!this.inside(col, row)) return true;
    return SOLID_KIND[this.kind[this.index(col, row)]] === 1;
  }
  solidAt(x: number, y: number): boolean { return this.solid(this.colAt(x), this.rowAt(y)); }
  /** Any open neighbour (4-way): the cell is exposed to the tunnels. */
  exposed(col: number, row: number): boolean {
    return !this.solid(col - 1, row) || !this.solid(col + 1, row) || !this.solid(col, row - 1) || !this.solid(col, row + 1);
  }
  /** Remaining HP as a fraction of full, 0..1. */
  health(col: number, row: number): number {
    if (!this.inside(col, row)) return 1;
    const i = this.index(col, row);
    const full = TERRAIN_NODE_LIST[this.kind[i]].hp;
    return Number.isFinite(full) && full > 0 ? this.hp[i] / full : 1;
  }
  /** Crack stage 0..3 drawn on the cell. */
  stage(col: number, row: number): number { return crackStage(this.health(col, row)); }
  set(col: number, row: number, node: number): void {
    if (!this.inside(col, row)) return;
    const i = this.index(col, row);
    this.kind[i] = node;
    this.hp[i] = TERRAIN_NODE_LIST[node].hp;
    // Rock holds no liquid: a block set into a pool displaces that cell's share (as in Terraria).
    if (SOLID_KIND[node] && this.liqLevel[i]) { this.liqType[i] = 0; this.liqLevel[i] = 0; this.liquidRev++; }
    this.touch(col, row);
  }
  /** Liquid type at a cell (LIQUID_*), 0 outside the grid. */
  liquidAt(col: number, row: number): number {
    if (row < 0 || !this.inside(col, row)) return 0;
    const i = this.index(col, row);
    return this.liqLevel[i] ? this.liqType[i] : 0;
  }
  /** Liquid level at a cell, 0..LIQUID_FULL. */
  levelAt(col: number, row: number): number {
    return row < 0 || !this.inside(col, row) ? 0 : this.liqLevel[this.index(col, row)];
  }
  /** Set remaining HP; marks the chunk only when the visible crack stage changes. */
  setHp(col: number, row: number, hp: number): void {
    if (!this.inside(col, row)) return;
    const before = this.stage(col, row);
    this.hp[this.index(col, row)] = hp;
    if (this.stage(col, row) !== before) this.touch(col, row);
  }
  /** Mark the chunk holding a cell (and any neighbour chunk whose edge shading reads it) for redraw. */
  touch(col: number, row: number): void {
    const cc = Math.floor(col / CHUNK), cr = Math.floor(row / CHUNK);
    this.bump(cc, cr);
    const lc = col - cc * CHUNK, lr = row - cr * CHUNK;
    if (lc === 0) this.bump(cc - 1, cr);
    if (lc === CHUNK - 1) this.bump(cc + 1, cr);
    if (lr === 0) this.bump(cc, cr - 1);
    if (lr === CHUNK - 1) this.bump(cc, cr + 1);
    // A corner cell is also a diagonal neighbour's corner notch (auto-tiling reads 8 neighbours).
    const dc = lc === 0 ? -1 : lc === CHUNK - 1 ? 1 : 0, dr = lr === 0 ? -1 : lr === CHUNK - 1 ? 1 : 0;
    if (dc && dr) this.bump(cc + dc, cr + dr);
  }
  private bump(cc: number, cr: number): void {
    const key = this.chunkKey(cc, cr);
    if (key >= 0) this.chunkRev[key]++;
  }
  /** Every chunk of world columns [col0, col1) is drawn afresh (a column arrived in its ring slots). */
  touchColumns(col0: number, col1: number): void {
    for (let cc = Math.floor(col0 / CHUNK); cc * CHUNK < col1; cc++) for (let cr = 0; cr < this.chunkRows; cr++) this.bump(cc, cr);
  }
}

export function crackStage(health: number): number {
  if (health >= .999) return 0;
  return health > .66 ? 1 : health > .33 ? 2 : 3;
}

/** Stable key of a cell, as reported in world actions. */
export function cellKey(col: number, row: number): string { return `${col},${row}`; }

// ── Building ───────────────────────────────────────────────────────────────

/** Satchel stack ids of the things a Keeper can place in a delve. */
export type PlaceableId = 'dirt-block' | 'basalt-block' | 'torch' | 'ladder' | 'platform' | 'chest' | 'camp'
  | 'timber-support' | 'basalt-support' | 'blast-charge' | 'obsidian-block'
  | 'seam-rail' | 'bark-rope' | 'rift-anchor';

export interface PlaceableDef {
  /** The satchel stack it is placed from and taken back to. */
  id: PlaceableId;
  /** "Dirt block", for the hotbar and the plain feedback. */
  label: string;
  /** Terrain node it becomes. */
  node: string;
  /**
   * Where B puts it: 'block' fills the hole ahead first (blocks, platforms:
   * walk-and-place bridges); 'beside' goes beside the body (torches); 'here'
   * goes where the Keeper stands first (ladders: place, climb, place again).
   */
  aim: PlaceAim;
  /** Needs solid ground (or a platform) under its cell. */
  grounded?: true;
  /** One per delve: a second is refused until the first is taken back. */
  single?: true;
  /** At most this many in the Delve at once (Rift Anchors: 8). */
  max?: number;
  /** Spools down from the cell to the floor below, one stack item per cell (Bark Rope, up to SPOOL_MAX). */
  spool?: true;
}
/** The longest strand a Bark Rope spools down, in cells. */
export const SPOOL_MAX = 24;
export type PlaceAim = 'block' | 'beside' | 'here';

/** Every placeable, in hotbar order (keys 1, 2, …). */
export const PLACEABLES: readonly PlaceableDef[] = [
  { id: 'dirt-block', label: 'Dirt block', node: 'packed-dirt', aim: 'block' },
  { id: 'basalt-block', label: 'Basalt block', node: 'basalt-block', aim: 'block' },
  { id: 'torch', label: 'Torch', node: 'torch', aim: 'beside' },
  { id: 'ladder', label: 'Ladder', node: 'ladder', aim: 'here' },
  { id: 'platform', label: 'Platform', node: 'platform', aim: 'block' },
  { id: 'chest', label: 'Chest', node: 'chest', aim: 'beside', grounded: true },
  { id: 'camp', label: 'Camp', node: 'camp', aim: 'beside', grounded: true, single: true },
  { id: 'timber-support', label: 'Timber support', node: 'timber-support', aim: 'beside', grounded: true },
  { id: 'basalt-support', label: 'Basalt support', node: 'basalt-support', aim: 'beside', grounded: true },
  { id: 'blast-charge', label: 'Blasting charge', node: 'blast-charge', aim: 'beside' },
  // Past key 0: shown in the hotbar only while the satchel holds some.
  { id: 'obsidian-block', label: 'Obsidian block', node: 'obsidian-block', aim: 'block' },
  // The Underhearth (Phase 8): Kael's rails, Bark Rope, Rift Anchors.
  { id: 'seam-rail', label: 'Seam Rail', node: 'seam-rail', aim: 'block', grounded: true },
  { id: 'bark-rope', label: 'Bark Rope', node: 'rope', aim: 'block', spool: true },
  { id: 'rift-anchor', label: 'Rift Anchor', node: 'rift-anchor', aim: 'beside', grounded: true, max: 8 },
];
/** The first ten placeables always show in the hotbar (keys 1-0); the rest only while held. */
export const HOTBAR_FIXED = 10;
const PLACEABLE_BY_ID = new Map(PLACEABLES.map(def => [def.id, def]));
export function placeableById(id: string | null | undefined): PlaceableDef | undefined {
  return id ? PLACEABLE_BY_ID.get(id as PlaceableId) : undefined;
}

/** Open air: the only cell anything is placed into. */
export function isAir(t: Terrain, col: number, row: number): boolean {
  return row >= 0 && t.inside(col, row) && t.kind[t.index(col, row)] === AIR && !t.inscriptions.has(t.index(col, row));
}

/**
 * Where a place action without a pointer puts a thing, as a cell index, or -1.
 *
 *   below  (holding Down): the cell under the Keeper's feet, if it is open.
 *   front: the column just past the body in the facing direction. Its floor
 *          cell first (fills the hole ahead: walk-and-place bridges a gap),
 *          then the lowest open cell beside the body (walls and stairs).
 *
 * Pure.
 */
export function placeTarget(t: Terrain, x: number, feetY: number, facing: number, below: boolean, box: BodyBox, aim: PlaceAim = 'block'): number {
  const feetRow = t.rowAt(feetY - EPS), floorRow = feetRow + 1, headRow = t.rowAt(feetY - box.height);
  const own = t.colAt(x);
  if (below) return isAir(t, own, floorRow) ? t.index(own, floorRow) : -1;
  const lowest = (col: number) => { for (let row = feetRow; row >= headRow; row--) if (isAir(t, col, row)) return t.index(col, row); return -1; };
  // A ladder goes where you stand, so you can climb it at once.
  if (aim === 'here') { const here = lowest(own); if (here >= 0) return here; }
  const col = frontCol(t, x, facing, box);
  // A block fills the hole ahead first; a thing you walk through (a torch) never goes in a floor.
  if (aim === 'block' && isAir(t, col, floorRow)) return t.index(col, floorRow);
  const ahead = lowest(col);
  if (ahead >= 0) return ahead;
  // Walled in: a torch can go where you stand.
  return aim === 'beside' ? lowest(own) : -1;
}

/** The first cell holding node `id`, as an index, or -1. A scan: call on placement or travel, never per frame. */
export function findNode(t: Terrain, id: string): number {
  const kind = nodeIndex(id);
  return t.kind.indexOf(kind);
}

/** True when the cell is a one-way floor (a platform or a ladder). */
export function isOneWay(t: Terrain, col: number, row: number): boolean {
  return row >= 0 && t.inside(col, row) && ONEWAY_KIND[t.kind[t.index(col, row)]] === 1;
}
/** True when the cell is a rail (Kael's old line or a placed Seam Rail). */
export function isRail(t: Terrain, col: number, row: number): boolean {
  return row >= 0 && t.inside(col, row) && RAIL_KIND[t.kind[t.index(col, row)]] === 1;
}
/** True when the cell is climbable. */
export function isClimbable(t: Terrain, col: number, row: number): boolean {
  return row >= 0 && t.inside(col, row) && CLIMB_KIND[t.kind[t.index(col, row)]] === 1;
}
/** On a ladder: the cell at the feet or mid-body (centre column) is climbable. Standing on a ladder's top is not. Pure. */
export function onLadder(t: Terrain, x: number, feetY: number, box: BodyBox): boolean {
  const col = t.colAt(x);
  return isClimbable(t, col, t.rowAt(feetY - EPS)) || isClimbable(t, col, t.rowAt(feetY - box.height * .5));
}

/** The column just past the body in the facing direction. */
function frontCol(t: Terrain, x: number, facing: number, box: BodyBox): number {
  return facing < 0 ? t.colAt(x - box.halfWidth) - 1 : t.colAt(x + box.halfWidth - EPS) + 1;
}

/** True when the cell holds a placed thing that is taken back whole. */
export function isTakeable(t: Terrain, col: number, row: number): boolean {
  return row >= 0 && t.inside(col, row) && TAKEABLE_KIND[t.kind[t.index(col, row)]] === 1;
}

/** How far E (and X) reach past either side of the Keeper's body, in px: half a cell. */
export const INTERACT_REACH = CELL * .5;

/**
 * The placed thing X takes back, as a cell index, or -1. X reaches exactly as
 * far as E: `prefer` (the cell the prompt names, when it is takeable) first,
 * then the nearest beside the body in the facing direction, then the Keeper's
 * own column (feet up), then anything else in E's reach (half a cell past
 * either side of the body), else just under the feet. Pure, no allocation.
 */
export function takeTarget(t: Terrain, x: number, feetY: number, facing: number, box: BodyBox, prefer = -1): number {
  if (prefer >= 0 && prefer < t.kind.length) {
    if (isTakeable(t, t.colOf(prefer), t.rowOf(prefer))) return prefer;
  }
  const feetRow = t.rowAt(feetY - EPS), headRow = t.rowAt(feetY - box.height);
  const front = frontCol(t, x, facing, box), own = t.colAt(x);
  for (let row = feetRow; row >= headRow; row--) if (isTakeable(t, front, row)) return t.index(front, row);
  for (let row = feetRow; row >= headRow; row--) if (isTakeable(t, own, row)) return t.index(own, row);
  // The rest of E's reach: the same window findInteractive scans.
  const c0 = t.colAt(x - box.halfWidth - INTERACT_REACH), c1 = t.colAt(x + box.halfWidth + INTERACT_REACH);
  for (let row = feetRow; row >= headRow; row--) {
    for (let col = c0; col <= c1; col++) if (isTakeable(t, col, row)) return t.index(col, row);
  }
  return isTakeable(t, own, feetRow + 1) ? t.index(own, feetRow + 1) : -1;
}

// ── Loose rock and supports ────────────────────────────────────────────────

/** A fixed 0..1 hash of a cell: the same for every player and seed. */
export function looseHash(col: number, row: number): number {
  let h = (col * 2654435761 + row * 2246822519 + 0x5eed) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * True when a cell is loose rock: its biome declares `loose`, the cell still
 * holds that biome's band rock exactly as generated, and its fixed hash falls
 * under the biome's share. Pure.
 */
export function isLoose(t: Terrain, col: number, row: number): boolean {
  if (row < 0 || !t.inside(col, row)) return false;
  const loose = t.biomeAt(row).loose;
  if (!loose) return false;
  const kind = NODE_INDEX.get(loose.node);
  const i = t.index(col, row);
  if (kind === undefined || t.base[i] !== kind || t.kind[i] !== kind) return false;
  return looseHash(col, row) < loose.chance;
}

/** The longest reach any support has, in cells (the scan window). */
const SUPPORT_REACH = Math.max(0, ...TERRAIN_NODE_LIST.map(node => node.support ?? 0));
const SUPPORT_RANGE = Uint8Array.from(TERRAIN_NODE_LIST, node => node.support ?? 0);

/** True when a placed support holds the cell: within its reach in both directions (Chebyshev). Pure. */
export function supportNear(t: Terrain, col: number, row: number): boolean {
  for (let r = Math.max(0, row - SUPPORT_REACH); r <= Math.min(t.rows - 1, row + SUPPORT_REACH); r++) {
    for (let c = Math.max(t.colLo, col - SUPPORT_REACH); c <= Math.min(t.colHi - 1, col + SUPPORT_REACH); c++) {
      const reach = SUPPORT_RANGE[t.kind[t.index(c, r)]];
      if (reach && Math.max(Math.abs(c - col), Math.abs(r - row)) <= reach) return true;
    }
  }
  return false;
}

// ── Blasting charges ───────────────────────────────────────────────────────

/** Radius of a charge's blast, in cells (from the charge's centre to a cell's centre). */
export const CHARGE_RADIUS = 2.3;
/** Seconds between placing a charge and the blast. */
export const CHARGE_FUSE = 1.6;

/**
 * Whether a charge of `power` (the highest tool tier it stands in for) clears
 * this cell: solid rock some tool could break at or under that tier, never
 * bedrock, never a protected stamp, never a guarded node or a sealed
 * rectangle whose flag (`open`) is not set yet. Placed things that are not
 * solid (torches, chests…) are never touched. Pure.
 */
export function blastable(t: Terrain, col: number, row: number, power: number, open: (flag: string) => boolean): boolean {
  if (row < 0 || !t.inside(col, row)) return false;
  const i = t.index(col, row);
  const node = TERRAIN_NODE_LIST[t.kind[i]];
  if (!node.solid || !Number.isFinite(node.hp) || t.protect[i]) return false;
  let min = Infinity;
  for (const tool of TOOL_KINDS) { const tier = node.tools[tool]; if (tier && tier < min) min = tier; }
  if (min > power) return false;
  if (node.guard && !open(node.guard.flag)) return false;
  for (const seal of t.sealed) {
    if (col >= seal.col && col < seal.col + seal.w && row >= seal.row && row < seal.row + seal.h && !open(seal.flag)) return false;
  }
  return true;
}

/** The cells a charge at (col, row) clears, as indices into `out`, nearest first; returns how many. Pure. */
export function blastCells(t: Terrain, col: number, row: number, power: number, open: (flag: string) => boolean, out: Int32Array, radius = CHARGE_RADIUS): number {
  const span = Math.ceil(radius);
  let n = 0;
  for (let ring = 0; ring <= span; ring++) {
    for (let r = row - ring; r <= row + ring; r++) {
      for (let c = col - ring; c <= col + ring; c++) {
        if (Math.max(Math.abs(c - col), Math.abs(r - row)) !== ring) continue;
        if (Math.hypot(c - col, r - row) > radius) continue;
        if (n < out.length && blastable(t, c, r, power, open)) out[n++] = t.index(c, r);
      }
    }
  }
  return n;
}

/**
 * How much darkness a glowing cell lifts at its centre, 0 for none. Placed
 * lights (non-solid: torches) always burn; a glowing vein only once a tunnel
 * exposes it. Pure.
 */
export function glowIntensity(node: TerrainNodeDef, exposed: boolean): number {
  if (!node.glow) return 0;
  if (!node.solid) return .9;
  return exposed ? .55 : 0;
}

/** Build an area's terrain from its spec. Same spec → same grid, cell for cell. */
export function generateTerrain(spec: TerrainSpec, seed = spec.seed): Terrain {
  const t = new Terrain(spec.cols, spec.rows, spec.top);
  const random = seededRandom(seed);
  if (spec.biomes?.length) {
    t.biomes = spec.biomes;
    for (let row = 0; row < spec.rows; row++) t.biomeOfRow[row] = biomeIndexAt(spec.biomes, row);
  }
  const jitter = spec.jitter ?? 0;
  // One smooth wander per band edge: a value every 6 columns, eased between.
  const edges = spec.bands.map(() => {
    const knots = Array.from({ length: Math.ceil(spec.cols / 6) + 2 }, () => (random() * 2 - 1) * jitter);
    return (col: number) => {
      const k = col / 6, i = Math.floor(k), f = k - i, s = f * f * (3 - 2 * f);
      return knots[i] * (1 - s) + knots[i + 1] * s;
    };
  });
  const bandNodes = spec.bands.map(band => nodeIndex(band.node));
  for (let col = 0; col < spec.cols; col++) {
    for (let row = 0; row < spec.rows; row++) {
      let node = bandNodes[bandNodes.length - 1];
      for (let b = 0; b < spec.bands.length - 1; b++) {
        if (row < spec.bands[b].to + Math.round(edges[b](col))) { node = bandNodes[b]; break; }
      }
      t.kind[t.index(col, row)] = node;
    }
  }
  const veins = spec.biomes?.length ? [...spec.veins, ...spec.biomes.flatMap(biome => biome.veins)] : spec.veins;
  for (const vein of veins) {
    const node = nodeIndex(vein.node);
    const [lo, hi] = vein.cols ?? [0, spec.cols];
    for (let n = 0; n < vein.count; n++) {
      let col = lo + Math.floor(random() * (hi - lo));
      let row = vein.from + Math.floor(random() * Math.max(1, vein.to - vein.from));
      for (let s = 0; s < vein.size; s++) {
        if (t.inside(col, row) && row >= vein.from && row < vein.to) t.kind[t.index(col, row)] = node;
        const step = Math.floor(random() * 4);
        col += step === 0 ? 1 : step === 1 ? -1 : 0;
        row += step === 2 ? 1 : step === 3 ? -1 : 0;
      }
    }
  }
  for (const stamp of spec.stamps) {
    const node = nodeIndex(stamp.node);
    for (let r = stamp.row; r < stamp.row + (stamp.h ?? 1); r++) {
      for (let c = stamp.col; c < stamp.col + (stamp.w ?? 1); c++) {
        if (!t.inside(c, r)) continue;
        t.kind[t.index(c, r)] = node;
        if (stamp.protect) t.protect[t.index(c, r)] = 1;
      }
    }
  }
  if (spec.sealed) t.sealed = spec.sealed;
  for (let row = Math.max(0, spec.rows - spec.bedrock); row < spec.rows; row++) {
    for (let col = 0; col < spec.cols; col++) t.kind[t.index(col, row)] = BEDROCK;
  }
  const carved = nodeIndex('inscription');
  for (const inscription of spec.inscriptions ?? []) {
    if (!t.inside(inscription.col, inscription.row)) continue;
    const index = t.index(inscription.col, inscription.row);
    t.kind[index] = carved;
    t.inscriptions.set(index, inscription.id);
  }
  for (let i = 0; i < t.kind.length; i++) t.hp[i] = TERRAIN_NODE_LIST[t.kind[i]].hp;
  for (const pool of spec.liquids ?? []) {
    const type = pool.liquid === 'lava' ? LIQUID_LAVA : LIQUID_WATER;
    const level = Math.max(1, Math.min(LIQUID_FULL, Math.round(pool.level ?? LIQUID_FULL)));
    for (let r = pool.row; r < pool.row + (pool.h ?? 1); r++) {
      for (let c = pool.col; c < pool.col + (pool.w ?? 1); c++) {
        if (!t.inside(c, r) || SOLID_KIND[t.kind[t.index(c, r)]]) continue;
        t.liqType[t.index(c, r)] = type; t.liqLevel[t.index(c, r)] = level;
      }
    }
  }
  t.base = t.kind.slice();
  t.baseLiqType = t.liqType.slice();
  t.baseLiqLevel = t.liqLevel.slice();
  return t;
}

/** The key a saved liquid diff is filed under: the terrain's layout and the spec's liquid version. */
export function liquidLayout(spec: Pick<TerrainSpec, 'cols' | 'rows' | 'version' | 'liquidVersion'>, seed: number): string {
  return `${terrainLayout(spec, seed)}:l${spec.liquidVersion ?? 1}`;
}

/** One cell's liquid packed in a byte: type × 16 + level. */
export function packLiquid(type: number, level: number): number { return level ? type * 16 + level : 0; }

/** The settled liquid that differs from what was generated, as index → packed (type × 16 + level). Pure. */
export function liquidDiff(t: Terrain): Map<number, number> {
  const out = new Map<number, number>();
  for (let i = 0; i < t.kind.length; i++) {
    const now = packLiquid(t.liqType[i], t.liqLevel[i]), was = packLiquid(t.baseLiqType[i], t.baseLiqLevel[i]);
    if (now !== was) out.set(i, now);
  }
  return out;
}

/**
 * Lay a saved liquid diff over a generated grid. Cells that are solid now
 * (dug diff applied first), out of range or malformed are skipped. Pure apart from `t`.
 */
export function applyLiquidDiff(t: Terrain, cells: ReadonlyMap<number, number>): number {
  let applied = 0;
  for (const [index, packed] of cells) {
    if (!Number.isInteger(index) || index < 0 || index >= t.kind.length || !Number.isInteger(packed) || packed < 0) continue;
    const type = packed >> 4, level = packed & 15;
    if (level > LIQUID_FULL || (level && (type < 1 || type >= LIQUID_IDS.length)) || SOLID_KIND[t.kind[index]]) continue;
    t.liqType[index] = level ? type : 0; t.liqLevel[index] = level;
    applied++;
  }
  if (applied) t.liquidRev++;
  return applied;
}

/**
 * Lay a saved diff (cell index → node index) over a freshly generated grid.
 * Out-of-range cells, unknown kinds and the carved walls (fixed for everyone)
 * are skipped. Returns how many cells changed. Pure apart from `t`.
 */
export function applyTerrainDiff(t: Terrain, cells: ReadonlyMap<number, number>): number {
  let applied = 0;
  for (const [index, kind] of cells) {
    if (!Number.isInteger(index) || index < 0 || index >= t.kind.length) continue;
    if (!Number.isInteger(kind) || kind < 0 || kind >= TERRAIN_NODE_LIST.length) continue;
    if (t.inscriptions.has(index) || TERRAIN_NODE_LIST[kind].id === 'inscription') continue;
    if (t.kind[index] === kind) continue;
    const col = index % t.cols, row = (index - col) / t.cols;
    t.set(col, row, kind);
    applied++;
  }
  return applied;
}

/** The cells that differ from the generated grid, as index → kind. Pure. */
export function terrainDiff(t: Terrain): Map<number, number> {
  const out = new Map<number, number>();
  for (let i = 0; i < t.kind.length; i++) if (t.kind[i] !== t.base[i]) out.set(i, t.kind[i]);
  return out;
}

// ── Bodies ─────────────────────────────────────────────────────────────────

export interface TerrainBody { x: number; y: number; vy: number; grounded: boolean }
export interface BodyBox { halfWidth: number; height: number }
/** Fastest fall in px/s: under one cell per fixed step, so a body never tunnels through a row. */
export const TERMINAL_FALL = 1500;
const GRAVITY = 1650;
/** How hard a liquid brakes a body falling faster than its sink speed, px/s². */
const LIQUID_DRAG = 2600;
const EPS = .01;

/** True when the box with feet at (x, y) overlaps a solid cell. */
export function boxHits(t: Terrain, x: number, y: number, box: BodyBox): boolean {
  const c0 = t.colAt(x - box.halfWidth), c1 = t.colAt(x + box.halfWidth - EPS);
  const r0 = t.rowAt(y - box.height), r1 = t.rowAt(y - EPS);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (t.solid(c, r)) return true;
  return false;
}
function rowBlocked(t: Terrain, row: number, x: number, box: BodyBox): boolean {
  const c0 = t.colAt(x - box.halfWidth), c1 = t.colAt(x + box.halfWidth - EPS);
  for (let c = c0; c <= c1; c++) if (t.solid(c, row)) return true;
  return false;
}
/** A one-way floor under the body's centre column in `row` (the feet must be wholly over it to land). */
function rowOneWay(t: Terrain, row: number, x: number): boolean {
  return isOneWay(t, t.colAt(x), row);
}

/** Ladder speed, px/s: brisk, a little faster than walking in a delve (Terraria-style climbing). */
export const CLIMB_SPEED = 220;

/**
 * One fixed step on a ladder: no gravity, Up/Down (`climb` -1/1, 0 holds)
 * move along it, walls still stop it, and a floor reached climbing down is
 * stood on. Walking off the ladder's column hands the body back to
 * stepTerrainBody. Pure apart from `body`.
 */
export function climbTerrainBody(body: TerrainBody, velocityX: number, climb: number, dt: number, t: Terrain, box: BodyBox, width: number): void {
  if (velocityX) {
    const nx = t.clampX(body.x + velocityX * dt, width);
    if (!boxHits(t, nx, body.y, box)) body.x = nx;
  }
  body.vy = 0; body.grounded = true;
  if (!climb) return;
  const ny = body.y + climb * CLIMB_SPEED * dt;
  if (!boxHits(t, body.x, ny, box)) { body.y = ny; return; }
  if (climb > 0) {
    // Down onto a floor: stand on its top edge.
    const edge = t.top + t.rowAt(ny - EPS) * CELL;
    if (edge > body.y && !boxHits(t, body.x, edge, box)) body.y = edge;
  }
}

/**
 * One fixed step of a body moving through terrain: walls stop it, a single
 * cell ledge is stepped up while grounded, floors catch it, ceilings bump it.
 * One-way platforms (the area's safety floor) still apply. Mirrors advanceBody.
 */
/**
 * A liquid the body is in: gravity and the fastest fall are scaled down (the
 * Keeper sinks slowly and can swim up; liquids.ts `SWIM`). Absent: open air.
 */
export interface BodyMedium { gravity: number; terminal: number }
export function stepTerrainBody(body: TerrainBody, velocityX: number, dt: number, t: Terrain, box: BodyBox,
  platforms: readonly { x: number; y: number; width: number }[], width: number, drop = false, medium?: BodyMedium | null): void {
  // Horizontal, then vertical, so a wall never eats a landing.
  if (velocityX) {
    const nx = t.clampX(body.x + velocityX * dt, width);
    if (!boxHits(t, nx, body.y, box)) body.x = nx;
    else if (body.grounded && !boxHits(t, nx, body.y - CELL, box) && !boxHits(t, body.x, body.y - CELL, box)) {
      body.x = nx; body.y -= CELL;
    }
  }
  const previousY = body.y;
  if (medium) {
    // Liquid: light gravity, and drag brakes a fast entry down to the slow sink.
    body.vy += GRAVITY * medium.gravity * dt;
    if (body.vy > medium.terminal) body.vy = Math.max(medium.terminal, body.vy - LIQUID_DRAG * dt);
  } else body.vy = Math.min(TERMINAL_FALL, body.vy + GRAVITY * dt);
  let ny = body.y + body.vy * dt;
  body.grounded = false;
  if (body.vy >= 0) {
    // The first row boundary the feet cross with a solid cell under them.
    const from = t.rowAt(previousY - EPS) + 1, to = t.rowAt(ny);
    for (let row = from; row <= to; row++) {
      const edge = t.top + row * CELL;
      // Solid rock always catches; a platform or ladder top only when not dropping through (Down).
      if (edge >= previousY - EPS && edge <= ny && (rowBlocked(t, row, body.x, box) || (!drop && rowOneWay(t, row, body.x)))) {
        ny = edge; body.vy = 0; body.grounded = true; break;
      }
    }
    for (const platform of platforms) {
      if (previousY <= platform.y && ny >= platform.y && body.x + 16 > platform.x && body.x - 16 < platform.x + platform.width) {
        ny = platform.y; body.vy = 0; body.grounded = true;
      }
    }
  } else {
    const head = ny - box.height;
    const row = t.rowAt(head);
    if (rowBlocked(t, row, body.x, box) && t.rowAt(previousY - box.height) !== row) {
      ny = t.top + (row + 1) * CELL + box.height; body.vy = 0;
    }
  }
  body.y = ny;
}

// ── Aiming ─────────────────────────────────────────────────────────────────

/**
 * Cells whose centres fall inside a cone from (ox, oy) along unit (dx, dy),
 * out to `range` px, `halfAngle` radians each side. Writes cell indices into
 * `out` (reused, never grown past its length) and returns how many. Pure.
 */
export function coneCells(t: Terrain, ox: number, oy: number, dx: number, dy: number, range: number, halfAngle: number, out: Int32Array): number {
  const cos = Math.cos(halfAngle);
  const c0 = Math.max(t.colLo, t.colAt(ox - range)), c1 = Math.min(t.colHi - 1, t.colAt(ox + range));
  const r0 = Math.max(0, t.rowAt(oy - range)), r1 = Math.min(t.rows - 1, t.rowAt(oy + range));
  let n = 0;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const vx = (c + .5) * CELL - ox, vy = t.top + (r + .5) * CELL - oy;
      const d = Math.hypot(vx, vy);
      if (d > range || d < 1e-6) continue;
      if ((vx * dx + vy * dy) / d < cos) continue;
      if (n < out.length) out[n++] = t.index(c, r);
    }
  }
  return n;
}
