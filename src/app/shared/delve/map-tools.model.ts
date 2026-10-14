/**
 * map-tools.model.ts — the two canon map tools of map v2
 * (docs/world/delve-and-beyond.md §6.1; docs/handoff/bounties-map-v2.md).
 *
 * Both are canon objects that had painted art and codex lore but no place in
 * the game (meaning audit, "Canon items with no game presence"). Each now has a
 * source, a use, its lore (collection.model SEED_LORE) and a Found in line:
 *
 *   Broken Astral Compass  canon: "points toward the nearest fact omitted by
 *       the active model". HELD in the satchel, the Delve map draws a short
 *       violet ray from the Keeper toward the nearest structure no lantern has
 *       touched, or carving in the core not yet copied. Pim Larkin hands it over
 *       with the first bounty ever claimed: the last Herald left it on the board.
 *   Rift Map Fragment  canon: "a partial route that is legible only beside
 *       another keeper's incompatible observation". READ from the full map, it
 *       spends one and draws the nearest unvisited structure (room and
 *       surroundings) into your own explored map: legible beside your own
 *       observation. From a rift shrine's first touch, and from the Herald on
 *       every seventh day a bounty is claimed.
 *
 * Read by found-in.data.ts (the Found in lines) and scripts/check-meaning.js
 * (sources and uses). No imports.
 */
export interface MapTool {
  id: string;
  /** Found in… lines (found-in.data.ts). */
  foundIn: readonly string[];
  /** Where the game grants it (check-meaning sources). */
  sources: readonly string[];
  /** What it does (check-meaning uses). */
  uses: readonly string[];
}

export const MAP_TOOLS: readonly MapTool[] = [
  {
    id: 'broken-astral-compass',
    foundIn: ['Rootglass Canopy: the Board Herald\'s first bounty'],
    sources: ['the Board Herald\'s first bounty claimed (BountyService.claim)'],
    uses: ['held: the Delve map points toward the nearest unvisited structure or uncopied carving'],
  },
  {
    id: 'rift-map-fragment',
    foundIn: ['Ember Delve: a rift shrine, the first time you touch it', 'Rootglass Canopy: the Board Herald, every seventh bounty day'],
    sources: ['a rift shrine\'s first touch (play view discover)', 'the Board Herald, every seventh claim day (BountyService.claim)'],
    uses: ['read on the Delve map: reveals the nearest unvisited structure'],
  },
];
