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

/** Bump when the persisted shape changes; add a step to `migrateProgress`. */
export const PROGRESS_VERSION = 2;

/**
 * A banked achievement.
 *
 * v1 stored bare id strings. They are objects now so a profile can be rendered
 * from the blob alone — no second lookup against a client-side registry, and an
 * achievement that is later renamed or retired still shows correctly on the wall
 * of someone who earned it. That also matters for Phase 2: a Firestore document
 * that needs the app's registry to be legible is not much of a document.
 */
export interface AchievementRecord {
  id: string;
  /** ISO timestamp. */
  unlockedAt: string;
}

/**
 * The persisted shape.
 *
 * Three fields exist for Phase 2 (progression that follows a signed-in visitor)
 * rather than for anything shipping today:
 *
 *  - `userId` — a locally minted UUID now, the Firebase Auth UID later. Having
 *    it from day one means the blob is already keyed the way Firestore wants,
 *    so signing in swaps an id rather than inventing an identity model.
 *  - `level` / `levelTitle` — denormalised from `xp`. Derived-on-read is right
 *    for a local object and wrong for a database: a leaderboard cannot
 *    `orderBy` a value that only exists after running a function over every
 *    document. `XpService` keeps them in step on every award.
 *  - `createdAt` / `updatedAt` — the timestamps any synced record needs, and
 *    what `mergeProgress` uses to decide which of two devices is authoritative.
 */
export interface ProgressState {
  version: number;
  /** Phase 1: a locally generated UUID. Phase 2: the Firebase Auth UID. */
  userId: string;
  xp: number;
  /** Denormalised from `xp` — see the note above. */
  level: number;
  levelTitle: string;
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
  /** Achievements already awarded, so a tier never drops twice. */
  achievements: AchievementRecord[];
  /**
   * XP earned per local day, keyed YYYY-MM-DD. Feeds the Codex streak calendar.
   *
   * Trimmed to `HISTORY_DAYS` on every write so the blob cannot grow without
   * bound in a browser that keeps localStorage for years — the heatmap only ever
   * renders the last month, and nothing else reads further back.
   */
  history: Record<string, number>;
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
}

/** How many days of daily-XP history are kept. The calendar renders 30. */
export const HISTORY_DAYS = 60;

export function emptyProgress(): ProgressState {
  const now = new Date().toISOString();
  const first = LEVELS[0];
  return {
    version: PROGRESS_VERSION,
    userId: newUserId(),
    xp: 0,
    level: first.level,
    levelTitle: first.title,
    aether: 0,
    nox: 0,
    streak: 0,
    lastVisit: null,
    bestStreak: 0,
    toolsUsed: [],
    achievements: [],
    history: {},
    createdAt: now,
    updatedAt: now,
  };
}

/** RFC4122 v4 where available, with a fallback for locked-down browsers. */
export function newUserId(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) {
    const bytes = c.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  // Last resort. Not cryptographically random, but this id only has to be
  // unique within one browser until Firebase Auth takes over.
  return `local-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

/** Keep the denormalised rank in step with lifetime XP. */
export function withLevel(state: ProgressState): ProgressState {
  const def = levelForXp(state.xp);
  return state.level === def.level && state.levelTitle === def.title
    ? state
    : { ...state, level: def.level, levelTitle: def.title };
}

/**
 * Bring any older persisted blob up to `PROGRESS_VERSION`.
 *
 * Every branch is additive and lossless. A migration that silently drops a
 * visitor's streak is worse than no migration at all — they would just see the
 * number they had been protecting reset to one with no explanation. Unknown or
 * newer versions pass through untouched rather than being mangled downwards.
 */
export function migrateProgress(raw: unknown): ProgressState {
  const base = emptyProgress();
  if (!raw || typeof raw !== 'object') return base;

  const input = raw as Record<string, unknown>;
  const version = typeof input['version'] === 'number' ? (input['version'] as number) : 1;

  // ── v1 → v2 ──────────────────────────────────────────────────────────────
  // v1 had no identity, no denormalised rank, no timestamps, and stored
  // achievements as bare id strings.
  if (version < 2) {
    const ids = Array.isArray(input['achievements']) ? (input['achievements'] as unknown[]) : [];
    // v1 recorded no unlock time. `createdAt` is the earliest moment we can
    // honestly claim, and it keeps the wall in a sane chronological order
    // rather than stamping every legacy trophy with "just now".
    const stamped = base.createdAt;

    return withLevel({
      ...base,
      xp: num(input['xp']),
      aether: num(input['aether']),
      nox: num(input['nox']),
      streak: num(input['streak']),
      lastVisit: typeof input['lastVisit'] === 'string' ? (input['lastVisit'] as string) : null,
      bestStreak: num(input['bestStreak']),
      toolsUsed: strArray(input['toolsUsed']),
      achievements: ids
        .filter((id): id is string => typeof id === 'string')
        .map(id => ({ id, unlockedAt: stamped })),
      history: numRecord(input['history']),
    });
  }

  // ── Current version ──────────────────────────────────────────────────────
  // Merge onto a fresh blob so a state written by a build that predates a newly
  // added field still hydrates instead of throwing on the first read.
  return withLevel({
    ...base,
    ...(input as Partial<ProgressState>),
    userId: typeof input['userId'] === 'string' && input['userId'] ? (input['userId'] as string) : base.userId,
    xp: num(input['xp']),
    toolsUsed: strArray(input['toolsUsed']),
    achievements: Array.isArray(input['achievements'])
      ? (input['achievements'] as AchievementRecord[]).filter(a => a && typeof a.id === 'string')
      : [],
    history: numRecord(input['history']),
    version: PROGRESS_VERSION,
  });
}

/**
 * Reconcile two blobs for the same visitor — the Phase 2 case where someone has
 * been earning XP anonymously on a laptop and then signs in on a phone that
 * already has its own progress.
 *
 * Counters take the max rather than the sum: a device that fell behind should
 * catch up, not double the total. Id sets union. The merge is commutative, so
 * there is no wrong device to sign in from.
 */
export function mergeProgress(a: ProgressState, b: ProgressState): ProgressState {
  const ahead = a.xp >= b.xp ? a : b;
  const behind = ahead === a ? b : a;

  const achievements = [...ahead.achievements];
  const seen = new Set(achievements.map(x => x.id));
  for (const rec of behind.achievements) {
    if (!seen.has(rec.id)) { achievements.push(rec); seen.add(rec.id); }
  }

  const history: Record<string, number> = { ...behind.history };
  for (const [day, xp] of Object.entries(ahead.history)) {
    history[day] = Math.max(xp, history[day] ?? 0);
  }

  return withLevel({
    ...ahead,
    achievements,
    history,
    xp: Math.max(a.xp, b.xp),
    aether: Math.max(a.aether, b.aether),
    nox: Math.max(a.nox, b.nox),
    streak: Math.max(a.streak, b.streak),
    bestStreak: Math.max(a.bestStreak, b.bestStreak),
    lastVisit: [a.lastVisit, b.lastVisit].filter(Boolean).sort().pop() ?? null,
    toolsUsed: [...new Set([...a.toolsUsed, ...b.toolsUsed])],
    createdAt: a.createdAt < b.createdAt ? a.createdAt : b.createdAt,
    updatedAt: new Date().toISOString(),
    version: PROGRESS_VERSION,
  });
}

// ── Coercion helpers ────────────────────────────────────────────────────────
// Persisted data is untrusted input: it may have been written by an older
// build, hand-edited in devtools, or truncated by a full disk.

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function numRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
}
