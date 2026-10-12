/**
 * home-forge.model.ts: the Homestead's own Anvil and Enchanting Circle, as
 * pure data and pure functions. No Angular, no storage.
 *
 * Two stations on the plot open the same Crafting Bench and Enchanting Table
 * (and so the same mini-games) as town. Each has four tiers, I to IV, bought
 * with Gold. A tier changes ONLY how forgiving the mini-game is, and ONLY at
 * home: the panel host passes the tier in through HOME_FORGE (see
 * shared/in-world-panel); town benches, the Delve camp and the routed pages
 * never see it and play exactly as before.
 *
 * THE RETUNING KNOB is `HOME_FORGE_CONFIG` below: prices and effects in one
 * object. The prices are written against the economy rebalance's curve
 * (docs/economy/rebalance-spec.md, rule S: "about five minutes of income at
 * the stage where the player meets it"), so retune them here if that curve
 * moves.
 *
 * THE CEILING STILL HOLDS. The anvil's roll bias reads one number, quality q,
 * and the proof in the anvil model needs q in [0, 1]. Every anvil tier keeps
 * that: a strike scores 0.15, 0.6 or 1, and quality is the mean of the best
 * `counted` scores, so it is a mean of numbers in [0, 1]. `homeAnvilQuality`
 * clamps anyway. A wider Perfect zone or a spare strike only makes a high q
 * easier to reach; it never makes a q above 1 possible, so no stat can pass
 * today's ceiling (pinned in the anvil spec and the node test).
 *
 * "A RARER RUNE" is a convenience. The enchanting rules let any held rune be
 * socketed into any well; nothing gates a rune by its tier. Gating rare runes
 * behind a home upgrade would take something away from town, so tier III+
 * only puts your rarest rune first in the picker and pre-selects it.
 */

import { ANVIL_STRIKES, ANVIL_ZONES, STRIKE_SCORE, anvilQuality, type StrikeGrade } from './anvil.model';
import { PULSE_WINDOW, PULSE_WINDOW_MAX } from './ritual.model';

/** Saved through the game-state gateway; synced as progress/home-forge. */
export const HOME_FORGE_KEY = 'godforge-home-forge';

export type HomeStationId = 'anvil' | 'circle';
export const HOME_STATION_IDS: readonly HomeStationId[] = ['anvil', 'circle'];

/** Tier I is what stands on the plot from the start. */
export const HOME_TIER_MIN = 1;
export const HOME_TIER_MAX = 4;

export interface AnvilTierRules {
  /** Half-widths of the target zones, as in ANVIL_ZONES. */
  zones: { perfect: number; good: number };
  /** Strikes in one game. */
  strikes: number;
  /** How many of the best strikes count toward quality. Equal to `strikes` = all of them. */
  counted: number;
}

export interface CircleTierRules {
  /** The ritual's first-try hit window, as PULSE_WINDOW. */
  window: number;
  /** Rarest held rune listed first and pre-selected (a convenience; see the header). */
  rarestFirst: boolean;
}

/**
 * Every price and every effect, in one place. Index 0 is tier I.
 * `price[i]` is the Gold to go FROM tier i+1 TO tier i+2 (so `price[0]` buys II).
 */
export const HOME_FORGE_CONFIG = {
  anvil: {
    price: [750_000, 6_000_000, 250_000_000] as readonly number[],
    tiers: [
      { zones: { perfect: ANVIL_ZONES.perfect, good: ANVIL_ZONES.good }, strikes: ANVIL_STRIKES, counted: ANVIL_STRIKES },
      { zones: { perfect: 0.16, good: ANVIL_ZONES.good }, strikes: ANVIL_STRIKES, counted: ANVIL_STRIKES },
      { zones: { perfect: 0.16, good: ANVIL_ZONES.good }, strikes: ANVIL_STRIKES + 1, counted: ANVIL_STRIKES },
      { zones: { perfect: 0.2, good: 0.4 }, strikes: ANVIL_STRIKES + 1, counted: ANVIL_STRIKES },
    ] as readonly AnvilTierRules[],
  },
  circle: {
    price: [750_000, 6_000_000, 250_000_000] as readonly number[],
    tiers: [
      { window: PULSE_WINDOW, rarestFirst: false },
      { window: 0.18, rarestFirst: false },
      { window: 0.22, rarestFirst: true },
      { window: 0.26, rarestFirst: true },
    ] as readonly CircleTierRules[],
  },
} as const;

/** A whole tier in [MIN, MAX]. Anything unreadable is tier I. */
export function clampTier(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : HOME_TIER_MIN;
  return Math.min(HOME_TIER_MAX, Math.max(HOME_TIER_MIN, n));
}

/** Roman numeral for a tier: I, II, III, IV. */
export function tierNumeral(tier: number): string {
  return ['I', 'II', 'III', 'IV'][clampTier(tier) - 1];
}

/**
 * The anvil's rules at `tier`, held to what the bias proof needs:
 * 0 < perfect <= good <= 1 and 1 <= counted <= strikes.
 */
export function anvilTierRules(tier: number): AnvilTierRules {
  const raw = HOME_FORGE_CONFIG.anvil.tiers[clampTier(tier) - 1];
  const good = Math.min(1, Math.max(0, raw.zones.good));
  const perfect = Math.min(good, Math.max(0, raw.zones.perfect));
  const strikes = Math.max(1, Math.floor(raw.strikes));
  const counted = Math.min(strikes, Math.max(1, Math.floor(raw.counted)));
  return { zones: { perfect, good }, strikes, counted };
}

/** The circle's rules at `tier`. The window never passes the ritual's own cap. */
export function circleTierRules(tier: number): CircleTierRules {
  const raw = HOME_FORGE_CONFIG.circle.tiers[clampTier(tier) - 1];
  return { window: Math.min(PULSE_WINDOW_MAX, Math.max(PULSE_WINDOW, raw.window)), rarestFirst: raw.rarestFirst };
}

/**
 * Quality of a home anvil game: the mean of the best `counted` strike scores.
 * With counted = strikes it is exactly `anvilQuality`. Always in [0, 1].
 */
export function homeAnvilQuality(grades: readonly StrikeGrade[], counted: number): number {
  if (!grades.length) return 0;
  const n = Math.max(1, Math.min(grades.length, Math.floor(counted) || grades.length));
  // Everything counts: today's function itself, so the base game is bit-identical.
  if (n >= grades.length) return anvilQuality(grades);
  const best = grades.map(g => STRIKE_SCORE[g] ?? 0).sort((a, b) => b - a).slice(0, n);
  const q = best.reduce((sum, s) => sum + s, 0) / n;
  return Number.isFinite(q) ? Math.min(1, Math.max(0, q)) : 0;
}

// ── The save ─────────────────────────────────────────────────────────────────

/**
 * `{ version: 1, anvil: 1..4, circle: 1..4 }`. Tiers only ever go up, so the
 * cloud's structural "higher wins" merge is exactly right and no hand-written
 * merge is needed (which also keeps this file out of the eager bundle).
 */
export interface HomeForgeState {
  version: 1;
  anvil: number;
  circle: number;
}

export function emptyHomeForge(): HomeForgeState {
  return { version: 1, anvil: HOME_TIER_MIN, circle: HOME_TIER_MIN };
}

export function coerceHomeForge(value: unknown): HomeForgeState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyHomeForge();
  const v = value as Record<string, unknown>;
  return { version: 1, anvil: clampTier(v['anvil']), circle: clampTier(v['circle']) };
}

/** What the next upgrade of `station` would be. `tier` null when it is fully upgraded. */
export interface HomeUpgradeQuote {
  station: HomeStationId;
  /** The tier it would become, or null at IV. */
  tier: number | null;
  cost: number;
  affordable: boolean;
  shortfall: number;
  /** The idempotent action id for this exact step: `home-forge:<station>:<tier>`. */
  actionId: string | null;
}

export function homeUpgradeActionId(station: HomeStationId, tier: number): string {
  return `home-forge:${station}:${clampTier(tier)}`;
}

/** The price to reach `tier` (II..IV). 0 for tier I or below. */
export function homeUpgradeCost(station: HomeStationId, tier: number): number {
  const t = clampTier(tier);
  if (t <= HOME_TIER_MIN) return 0;
  const price = HOME_FORGE_CONFIG[station].price[t - 2];
  return Number.isFinite(price) && price > 0 ? Math.ceil(price) : 0;
}

export function quoteHomeUpgrade(state: HomeForgeState, station: HomeStationId, gold: number): HomeUpgradeQuote {
  const current = clampTier(state[station]);
  if (current >= HOME_TIER_MAX) return { station, tier: null, cost: 0, affordable: false, shortfall: 0, actionId: null };
  const tier = current + 1;
  const cost = homeUpgradeCost(station, tier);
  const have = Number.isFinite(gold) ? Math.max(0, gold) : 0;
  return { station, tier, cost, affordable: have >= cost, shortfall: Math.max(0, cost - have), actionId: homeUpgradeActionId(station, tier) };
}

/**
 * Raise `station` to `tier`. Null when that is not the next step: already
 * there or past it (a replay of the same action id, which must not charge
 * again), or a skip of more than one tier.
 */
export function applyHomeUpgrade(state: HomeForgeState, station: HomeStationId, tier: number): HomeForgeState | null {
  const current = clampTier(state[station]);
  if (!Number.isFinite(tier) || Math.floor(tier) !== current + 1 || tier > HOME_TIER_MAX) return null;
  return { ...state, version: 1, [station]: current + 1 };
}
