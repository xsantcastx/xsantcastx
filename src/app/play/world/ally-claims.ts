/**
 * ally-claims.ts — heals, wards and the tank's guards that land on ANOTHER Keeper (S5; skills-100.md §3 "Ally
 * targeting", §2 Banner/Intercept/Hold the Gate; docs/design/online.md §4d).
 *
 * Since M4 a Keeper's life is the room's (keeper-life.ts). A Lanternwright's heal on a party mate, a ward round them, a
 * cleanse, a Rekindle, the Ashguard's Banner, his Intercept bond and his Gate are therefore claims the room weighs —
 * never a number one screen writes into another's life. Each claim names its skill, and the room checks it:
 *
 *  - **legal**: the skill can do this kind of thing to an ally (ALLY_SKILLS, from the game's own rows), and the healer
 *    has reached the row's level;
 *  - **in reach**: the healer stands within the skill's reach of the one it names, by the room's own record (marks may
 *    lengthen it: the table holds the longest the book allows, +ALLY_SLACK tiles for a step between presences);
 *  - **budgeted**: heals within the healer's level budget over ALLY_WINDOW_MS (allyHealBudget), a ward within its row's
 *    most, a bond's share and a banner's cut within their rows' tops; at most ALLY_PER_SEC claims a second;
 *  - **Rekindle**: only a Keeper the room saw fall within REKINDLE_MAX_MS, the healer within REKINDLE_REACH tiles of
 *    where it fell, once per REKINDLE_MIN_CD_MS.
 *
 * Pure: no Angular, no DOM. The Hearth bundles it (scripts/world-sim-build.mjs); room-world.ts applies what passes.
 */
import { MARK_SLOTS, type MarkSlot } from '../td/td-marks';
import { SKILLS, TIER_LEVELS, type SkillId } from '../td/td-skills';

/** What one ally claim does. */
export type AllyKind = 'heal' | 'ward' | 'cleanse' | 'rekindle' | 'bond' | 'aura';
export const ALLY_KINDS: readonly AllyKind[] = ['heal', 'ward', 'cleanse', 'rekindle', 'bond', 'aura'];

/**
 * One claim on the wire (the `/world/life` body's `a`):
 *  - `k` the kind, `s` the skill (and `m` a mark it leans on), `to` the Keeper it lands on (none for an aura);
 *  - `n`: a heal's life, a ward's absorb, a Rekindle's life %, a bond's share %, an aura's damage cut %;
 *  - `t`: seconds, in tenths (a ward's, a bond's, an aura's);
 *  - `r`: an aura's reach in tenths of a tile;
 *  - `f`: flags (a cleanse's Dry Cloak = 1; an aura's: 1 steady, 2 resolve, 4 the Watchfire at half, 8 regen).
 */
export interface AllyClaim { k: AllyKind; s: string; to?: string; n: number; t?: number; r?: number; m?: MarkSlot; f?: number }

/** What the room knows of each Keeper it weighs: where, its level, and whether it is down (and when and where it fell). */
export interface AllyKeeper { id: string; x: number; y: number; level: number; party?: string | null }

/** Per skill: the kinds it may claim on an ally, its longest reach (tiles, the marks' at most), its tops. */
export interface AllySkill { kinds: readonly AllyKind[]; reach: number; maxN?: number; maxT?: number; maxR?: number }
export const ALLY_SKILLS: Readonly<Partial<Record<SkillId, AllySkill>>> = {
  // ── The Lanternwright: heals, wards, cleanse, Rekindle ──
  'hearthlight': { kinds: ['heal'], reach: 12 },
  'hearth-circle': { kinds: ['heal', 'cleanse', 'aura'], reach: 5, maxN: 15, maxT: 3, maxR: 5 },
  'lantern-ward': { kinds: ['ward'], reach: 12, maxT: 23 },
  'cleanse': { kinds: ['cleanse', 'heal'], reach: 12 },
  'rekindle': { kinds: ['rekindle'], reach: 3, maxN: 70 },
  'hearthsong': { kinds: ['heal', 'cleanse'], reach: 8 },
  // The stand-ins S5 swaps in (skill-book-stand-ins.md): the marks that now reach allies.
  'kindle': { kinds: ['heal'], reach: 6 },
  'blinding-flash': { kinds: ['heal'], reach: 6 },
  'lamp-wisp': { kinds: ['heal'], reach: 8 },
  'beacon': { kinds: ['aura', 'heal'], reach: 12, maxN: 0, maxT: 3, maxR: 4 },
  'lantern-aura': { kinds: ['aura'], reach: 0, maxN: 15, maxT: 3, maxR: 6 },
  'dawn-at-noon': { kinds: ['aura', 'heal'], reach: 8, maxN: 0, maxT: 3, maxR: 6 },
  // ── The Warlock's kin-marks that share with allies ──
  'drain-life': { kinds: ['heal'], reach: 6 },
  'aura-siphon': { kinds: ['heal'], reach: 6 },
  'bone-armor': { kinds: ['ward'], reach: 6, maxT: 40 },
  'dark-ward': { kinds: ['ward'], reach: 6, maxT: 40 },
  'aura-embers': { kinds: ['aura'], reach: 0, maxN: 0, maxT: 3, maxR: 9 },
  // ── The Ashguard: the Banner, Intercept, the Gate, and the marks that reach allies ──
  'banner-of-the-watch': { kinds: ['aura'], reach: 0, maxN: 25, maxT: 3, maxR: 9 },
  'hold-the-gate': { kinds: ['aura'], reach: 0, maxN: 25, maxT: 3, maxR: 5 },
  'intercept': { kinds: ['bond'], reach: 12, maxN: 70, maxT: 11 },
  'watch-cry': { kinds: ['aura'], reach: 0, maxN: 15, maxT: 70, maxR: 7 },
  'aura-watchfire': { kinds: ['aura', 'heal'], reach: 5, maxN: 0, maxT: 3, maxR: 5 },
  'last-watch': { kinds: ['ward'], reach: 7, maxN: 0, maxT: 5 },
  'cinder-skin': { kinds: ['aura'], reach: 0, maxN: 40, maxT: 160, maxR: 4 },
  // ── The Thornstrider ──
  'rootwalk': { kinds: ['aura'], reach: 0, maxN: 20, maxT: 120, maxR: 5 },
};

/** A step between two presences: the room's record of where each stands lags the screens a little. */
export const ALLY_SLACK = 2;
/** The window the heal budget is measured over (ms), and its most claims a second. */
export const ALLY_WINDOW_MS = 3000;
export const ALLY_PER_SEC = 24;
/** Rekindle: a fall the room saw at most this long ago (Long Memory's 90 s, and the step to the fallen). */
export const REKINDLE_MAX_MS = 95_000;
/** Rekindle: the healer kneels within this many tiles of where the fallen one fell. */
export const REKINDLE_REACH = 4;
/** Rekindle: one a healer this often at most (its 120 s, less Short Wait's 40, less cast speed). */
export const REKINDLE_MIN_CD_MS = 50_000;
/** A ward lands at most this much (a level's most absorb, every mark and synergy in: Lantern Ward's rank 20 × 3). */
export function allyWardMax(level: number): number { return 200 + 25 * Math.max(1, level); }
/**
 * The heal a Keeper may give others a second (its level's budget): far above the strongest honest healer — Hearthsong
 * pulsing on a party of five with every mark — and far below a forged "heal 99999".
 */
export function allyHealBudget(level: number): number { const L = Math.max(1, Math.min(999, level)); return 80 + 40 * L; }

/** The level a row opens at (td-tree levelFor; kept here so the room needs no tree). */
function rowLevel(id: SkillId): number { return SKILLS[id].level ?? TIER_LEVELS[SKILLS[id].tier] ?? 1; }

export type AllyRefusal = 'illegal' | 'level' | 'far' | 'budget' | 'self' | 'nobody' | 'down' | 'alive' | 'late' | 'cooldown' | 'rate';

/**
 * Is this claim one the skill can make, from this healer, on this target? (The budget and Rekindle's clock are the
 * room's state: room-world `allies` checks them after this.)
 */
export function allyLegal(c: AllyClaim, from: AllyKeeper, to: AllyKeeper | null): AllyRefusal | null {
  const sk = ALLY_SKILLS[c.s as SkillId];
  if (!sk || !(c.s in SKILLS) || !sk.kinds.includes(c.k)) return 'illegal';
  if (from.level < rowLevel(c.s as SkillId)) return 'level';
  if (sk.maxN !== undefined && c.n > sk.maxN && c.k !== 'heal') return 'illegal';
  if (sk.maxT !== undefined && (c.t ?? 0) > sk.maxT * 10) return 'illegal';
  if (sk.maxR !== undefined && (c.r ?? 0) > (sk.maxR + ALLY_SLACK) * 10) return 'illegal';
  if (c.k === 'ward' && c.n > allyWardMax(from.level)) return 'budget';
  if (c.k === 'aura') return null;
  if (!to) return 'nobody';
  if (to.id === from.id) return 'self';
  if (c.k !== 'rekindle' && Math.hypot(to.x - from.x, to.y - from.y) > (sk.reach + ALLY_SLACK) * 16) return 'far';
  return null;
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;
/** An ally claim checked field by field (null: refused as malformed). Unknown keys refused. */
export function parseAllyClaim(raw: unknown): AllyClaim | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!['k', 's', 'to', 'n', 't', 'r', 'm', 'f'].includes(k)) return null;
  if (!ALLY_KINDS.includes(o['k'] as AllyKind)) return null;
  if (typeof o['s'] !== 'string' || !/^[a-z0-9-]{1,32}$/.test(o['s'])) return null;
  if (o['to'] !== undefined && (typeof o['to'] !== 'string' || !ID.test(o['to']))) return null;
  const int = (v: unknown, lo: number, hi: number) => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
  if (!int(o['n'], 0, 1e6)) return null;
  for (const k of ['t', 'r', 'f']) if (o[k] !== undefined && !int(o[k], 0, 10000)) return null;
  if (o['m'] !== undefined && (typeof o['m'] !== 'string' || !MARK_SLOTS.includes(o['m'] as MarkSlot))) return null;
  if (o['k'] !== 'aura' && o['to'] === undefined) return null;
  return {
    k: o['k'] as AllyKind, s: o['s'], n: o['n'] as number,
    ...(o['to'] !== undefined ? { to: o['to'] as string } : {}),
    ...(o['t'] !== undefined ? { t: o['t'] as number } : {}), ...(o['r'] !== undefined ? { r: o['r'] as number } : {}),
    ...(o['m'] !== undefined ? { m: o['m'] as MarkSlot } : {}), ...(o['f'] !== undefined ? { f: o['f'] as number } : {}),
  };
}

/** Aura flags (`f`): what the ally's screen mirrors besides the damage cut. */
export const AURA_F = Object.freeze({ steady: 1, resolve: 2, watchfire: 4, regen: 8, speed: 16, fireUp: 32, light: 64 });
/** The auras whose `n` is a damage cut the room lays on the bites of those in reach (the rest lend other things). */
export const CUT_AURAS: ReadonlySet<string> = new Set(['banner-of-the-watch', 'hold-the-gate', 'watch-cry', 'hearth-circle', 'rootwalk']);

/**
 * An effect the room laid on a Keeper from another (the snapshot event `ally` tells its screen; each screen mirrors it):
 * what kind, from whom, which skill, how much, how long.
 */
export interface AllyEffect { k: AllyKind; by: string; s: string; n: number; t?: number; f?: number; x?: number; y?: number }
