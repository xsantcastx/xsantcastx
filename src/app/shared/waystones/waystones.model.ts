/**
 * waystones.model.ts — what the Waystones remember, and their rules
 * (One World §3, docs/design/one-world.md). Pure; no Angular, no imports from
 * the engine: cloud-save.model.ts is eager and imports `mergeWaystones`.
 *
 * Saved through the gateway as `godforge-waystones` (synced: progress/waystones),
 * written only while the One World preview is on:
 *
 *   lit    stone ids lit by hand (the receipt, written before the XP is granted)
 *   seen   stone ids discovered (they show grey on the map)
 *   marks  Meridian Survey marks reached (§3.4)
 *
 * All three only grow: two devices merge by union (the cabinets pattern).
 *
 * Every Waystone is a Meridian transit aperture of Sera Quill's Compact. The
 * five town stones are her trunk line, always lit (owner decision, 2026-10-15);
 * every other stone is found and lit by hand. A lit stone agrees with every
 * other lit stone, the way a Rift Anchor's two ends agree.
 */
export const WAYSTONES_KEY = 'godforge-waystones';

export interface WaystonesState {
  version: 1;
  lit: string[];
  seen: string[];
  marks: string[];
}

/** `<world>:<name>` or `<world>:ws:<sector column>` (a wild stone). */
const STONE_ID = /^(ember|ink|root|prism|orrery):(ws:-?\d{1,6}|[a-z][a-z-]{1,30})$/;
const MARK_ID = /^[a-z][a-z-]{1,30}$/;
/** Wild stones are endless; a save keeps at most this many of each list. */
const MAX_IDS = 512;

export function emptyWaystones(): WaystonesState { return { version: 1, lit: [], seen: [], marks: [] }; }

/** Anything → a valid state; junk ids are dropped, lists sorted (stable merges). */
export function coerceWaystones(raw: unknown): WaystonesState {
  const o = raw && typeof raw === 'object' ? raw as Partial<Record<keyof WaystonesState, unknown>> : {};
  const ids = (v: unknown, re: RegExp) => Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === 'string' && re.test(s)))].sort().slice(0, MAX_IDS) : [];
  return { version: 1, lit: ids(o.lit, STONE_ID), seen: ids(o.seen, STONE_ID), marks: ids(o.marks, MARK_ID) };
}

/** Union of both sides; commutative and idempotent. */
export function mergeWaystones(remote: unknown, local: unknown): WaystonesState {
  if (remote == null) return coerceWaystones(local);
  if (local == null) return coerceWaystones(remote);
  const r = coerceWaystones(remote), l = coerceWaystones(local);
  return coerceWaystones({ lit: [...l.lit, ...r.lit], seen: [...l.seen, ...r.seen], marks: [...l.marks, ...r.marks] });
}

/** A stone as the rules need it. */
export interface StoneRef { id: string; trunk?: boolean }

/** Lit: a trunk-line stone always; any other once lit by hand. */
export function isLit(state: Pick<WaystonesState, 'lit'>, stone: StoneRef): boolean {
  return !!stone.trunk || state.lit.includes(stone.id);
}

/**
 * The Meridian Survey (§3.4): the fifteen authored stones, five per kind.
 * Working names (docs/world/lore-addendum.md, "owner reviews in play").
 */
export const TOWN_STONES = ['ember:town', 'ink:town', 'root:town', 'prism:town', 'orrery:town'] as const;
export const REGION_STONES = ['ember:quarry-head', 'ink:corridor-head', 'root:thicket-head', 'prism:channel-head', 'orrery:ring-head'] as const;
export const DEEP_STONES = ['ember:landing', 'ink:gate-hollow', 'root:gate-hollow', 'prism:gate-hollow', 'orrery:gate-hollow'] as const;
export const MERIDIAN_SURVEY: readonly string[] = [...TOWN_STONES, ...REGION_STONES, ...DEEP_STONES];

/** Survey marks by stones lit. Marks past the second wait on P2/P3's stones (none can be reached in P1). */
export const SURVEY_MARKS: readonly { at: number; id: string }[] = [
  // Lighting a stone clears ±3 sectors of fog (not ±2).
  { at: 4, id: 'sera-chart' },
  // The travel channel drops to 0.8 s.
  { at: 8, id: 'quick-hands' },
  // A region's High Roads finds show on its map (P2).
  { at: 12, id: 'couriers-memory' },
  // The title Meridian Surveyor (P3, with its income: economy-sim --waystones).
  { at: 15, id: 'surveyor' },
];

/** The survey stones lit: the trunk line (always) and the authored ones lit by hand. */
export function surveyCount(state: Pick<WaystonesState, 'lit'>): number {
  return MERIDIAN_SURVEY.filter(id => (TOWN_STONES as readonly string[]).includes(id) || state.lit.includes(id)).length;
}
/** The marks reached with `count` survey stones lit. Pure. */
export function surveyMarks(count: number): string[] { return SURVEY_MARKS.filter(m => count >= m.at).map(m => m.id); }

/** Seconds a stone-to-stone travel channels before the fade (Quick Hands: 0.8). */
export function channelSeconds(marks: readonly string[]): number { return marks.includes('quick-hands') ? .8 : 1.5; }
/** Seconds a recall channels ("Return to <town>": free, from anywhere). */
export const RECALL_SECONDS = 3;
/** Seconds E is held to light a stone. */
export const LIGHT_HOLD = 1.2;
/** Delving XP for lighting a stone, once (the rift shrine's rate), keyed `waystone:<id>`. */
export const LIGHT_XP = 15;
/** Sector columns of fog a lit stone clears either side (Sera's Chart: 3). Sky band and ground only. */
export function revealSectors(marks: readonly string[]): number { return marks.includes('sera-chart') ? 3 : 2; }

/** Why travel is refused right now (the Slate's busy rule), or null. */
export interface TravelFacts { defeated: boolean; fighting: boolean; fishing: boolean; story: boolean; paused?: boolean }
export function travelRefusal(f: TravelFacts): 'defeated' | 'fight' | 'line' | 'story' | null {
  if (f.defeated) return 'defeated';
  if (f.story) return 'story';
  if (f.fishing) return 'line';
  if (f.fighting) return 'fight';
  return null;
}
