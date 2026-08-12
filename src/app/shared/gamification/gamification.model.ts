/**
 * gamification.model.ts — Eclipse Realms progression types.
 *
 * The site is a universe; this is the part of it that remembers you. XP is
 * earned by using tools, and the level titles are lifted from the Eclipse
 * Realms lore codex: a visitor starts as a Wanderer with no allegiance and
 * ends as an Eclipse Lord who has walked both realms.
 *
 * Everything here is pure data — no browser APIs — so it is safe to import
 * from a server-rendered module.
 */

/** The two energies of the lore. Aether is light/creation, Nox is shadow/decay. */
export type EnergyType = 'aether' | 'nox';

/** Every way a visitor can earn XP. */
export type XpEventType =
  | 'tool-use'
  | 'page-visit'
  | 'copy'
  | 'easter-egg'
  | 'share'
  | 'streak'
  | 'quest'
  | 'game-win'
  | 'idle';

/** Canonical XP award per event. Kept in one place so the economy is auditable. */
export const XP_VALUES: Record<XpEventType, number> = {
  'tool-use': 15,
  'page-visit': 5,
  'copy': 5,
  'easter-egg': 200,
  'share': 25,
  // Streak is computed, not fixed — this is the per-day step (see STREAK_STEP).
  'streak': 0,
  // Quest payouts are authored per quest in quest.model.ts, so there is no
  // table value here either — the claim always passes an explicit amount.
  'quest': 0,
  // Base for clearing an Arena gate. The gate itself passes an `amount` scaled
  // by how well it was cleared, so this is the floor, not the usual payout.
  'game-win': 40,
  // Ambient forge energy. Always passed an explicit amount — the rate depends
  // on where the visitor is standing, their streak and what quest is live, so
  // there is no single table value to state here.
  'idle': 0,
};

/** Each consecutive day adds this much to the daily bonus… */
export const STREAK_STEP = 50;
/** …until it caps here. Twelve days of return visits reaches the ceiling. */
export const STREAK_MAX = 600;

/**
 * Daily streak bonus for a given streak length (1-indexed: first day = 1).
 * Compounds linearly and then plateaus, so the reward for coming back is real
 * but a long absence costs at most twelve days of rebuilding.
 */
export function streakBonus(streakDays: number): number {
  if (streakDays < 1) return 0;
  return Math.min(streakDays * STREAK_STEP, STREAK_MAX);
}

/**
 * Which energy a tool category feeds. Design and authoring work is Aether
 * (light, creation); security and code work is Nox (shadow, transformation).
 * The realm layer maps realms onto the same split, so a tool's realm and its
 * energy never disagree.
 */
const NOX_CATEGORIES = new Set([
  'Security Tools',
  'Code Converters',
  'DevOps',
  'Reference',
]);

export function energyForCategory(category: string | undefined): EnergyType {
  return category && NOX_CATEGORIES.has(category) ? 'nox' : 'aether';
}

export interface LevelDefinition {
  /** 1-indexed rank. */
  level: number;
  /** Lore title shown in the XP bar. */
  title: string;
  /** Total lifetime XP required to hold this title. */
  minXp: number;
}

/**
 * The ten ranks. Thresholds widen as you climb — Wanderer to Seeker is a single
 * afternoon, Eclipse Sage to Eclipse Lord is a habit.
 */
export const LEVELS: LevelDefinition[] = [
  { level: 1,  title: 'Wanderer',        minXp: 0 },
  { level: 2,  title: 'Seeker',          minXp: 100 },
  { level: 3,  title: 'Forgehand',       minXp: 300 },
  { level: 4,  title: 'Realm Walker',    minXp: 600 },
  { level: 5,  title: 'Convergent',      minXp: 1000 },
  { level: 6,  title: 'Shadow Weaver',   minXp: 1500 },
  { level: 7,  title: 'Neon Architect',  minXp: 2500 },
  { level: 8,  title: 'Godforge Keeper', minXp: 4000 },
  { level: 9,  title: 'Eclipse Sage',    minXp: 6000 },
  { level: 10, title: 'Eclipse Lord',    minXp: 10000 },
];

/** The rank held at a given lifetime XP total. */
export function levelForXp(xp: number): LevelDefinition {
  let held = LEVELS[0];
  for (const def of LEVELS) {
    if (xp >= def.minXp) held = def;
    else break;
  }
  return held;
}

/** The next rank up, or null when already an Eclipse Lord. */
export function nextLevelForXp(xp: number): LevelDefinition | null {
  return LEVELS.find(def => def.minXp > xp) ?? null;
}

/** 0-1 progress through the current rank. Returns 1 at max rank. */
export function levelProgress(xp: number): number {
  const current = levelForXp(xp);
  const next = nextLevelForXp(xp);
  if (!next) return 1;
  const span = next.minXp - current.minXp;
  return span > 0 ? Math.min(1, Math.max(0, (xp - current.minXp) / span)) : 0;
}

/** The persisted shape. Versioned so a future migration can detect old blobs. */
export interface ProgressState {
  version: 1;
  xp: number;
  /** Lifetime XP routed to each energy. The two always sum to `xp`. */
  aether: number;
  nox: number;
  /** Consecutive days with at least one visit. */
  streak: number;
  /** ISO date (YYYY-MM-DD) of the most recent counted visit. */
  lastVisit: string | null;
  /** Longest streak ever reached — survives a reset so the loss is visible. */
  bestStreak: number;
  /** Tool slugs the visitor has used at least once. */
  toolsUsed: string[];
  /** Achievement ids already awarded, so a tier never drops twice. */
  achievements: string[];
  /**
   * XP earned per local day, keyed YYYY-MM-DD. Feeds the Codex streak calendar.
   *
   * Trimmed to `HISTORY_DAYS` on every write so the blob cannot grow without
   * bound in a browser that keeps localStorage for years — the heatmap only ever
   * renders the last month, and nothing else reads further back.
   */
  history: Record<string, number>;
}

/** How many days of daily-XP history are kept. The calendar renders 30. */
export const HISTORY_DAYS = 60;

export function emptyProgress(): ProgressState {
  return {
    version: 1,
    xp: 0,
    aether: 0,
    nox: 0,
    streak: 0,
    lastVisit: null,
    bestStreak: 0,
    toolsUsed: [],
    achievements: [],
    history: {},
  };
}
