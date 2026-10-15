/**
 * underhearth.model.ts — the Underhearth's shared facts (Phase 8,
 * docs/world/delve-and-beyond.md §2.2, §6.2–6.3, §7; lore: lore-addendum.md,
 * "The Four Who Went Down", shipped — owner reviews in play).
 *
 * The engine (play/engine), the play view, the missions and the save all
 * read these, so they live here with no imports: flags are strings in the
 * Delve save's `claimed` set, ids are satchel stack keys. Never rename one;
 * they are in players' saves.
 */

/** The Delve's world rows with the Underhearth: the Magma Halls end at 55, the Underhearth runs 56..117, bedrock 118..119. */
export const UNDERHEARTH_TOP = 56;
export const DEEP_ROWS = 120;

/**
 * Once-per-player flags (the Delve save's `claimed`):
 *  - UNSEALED: Kael has been brought the Godforge Fragment (The Fracture claimed),
 *    so the Banked seal answers to a pick. Set by the play view.
 *  - REACHED: the Keeper has stood in the Underhearth. Set by the engine.
 *  - FURNACE: the Banked Furnace's first defeat (MonsterDef.once).
 *  - hammer marks: `hammer-mark-1`..`-4`, one per outpost, set when its rubbing is taken.
 */
export const UNSEALED_FLAG = 'underhearth-unsealed';
export const UNDERHEARTH_REACHED_FLAG = 'underhearth-reached';
export const FURNACE_FLAG = 'banked-furnace-defeated';
export const HAMMER_MARK_FLAGS: readonly string[] = ['hammer-mark-1', 'hammer-mark-2', 'hammer-mark-3', 'hammer-mark-4'];
/** The once-a-day rekindling: a repeat fight sets `banked-furnace-day:<YYYY-MM-DD>` (no reward farming). */
export const FURNACE_DAY_PREFIX = 'banked-furnace-day:';
export function furnaceDayFlag(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${FURNACE_DAY_PREFIX}${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export const WAYSTONE_SHARD = 'waystone-shard';
/** The summon: rubbings of the four marks, kept after the first fight. */
export const FOUR_HAMMER_MARKS = 'four-hammer-marks';
export const SEAM_CART = 'seam-cart';
export const THORNROOT_GRAPPLE = 'thornroot-grapple';

/** Rift Anchors a Delve holds at once. */
export const ANCHOR_MAX = 8;
/** The grapple's reach, in cells (phones: tap a cell within it). */
export const GRAPPLE_CELLS = 10;

/** Delving XP for a hammer-mark's rubbing (once per mark) and for first reaching the Underhearth. */
export const HAMMER_MARK_XP = 40;
