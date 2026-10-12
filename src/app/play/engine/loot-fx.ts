import type { LootRarity } from '../world/world.model';

/**
 * Loot readability, pure math only: rarity beam colours, the satchel target
 * point and the pickup flight curve. The engine draws with these; the node
 * tests check them without a canvas. Visual only: nothing here grants loot.
 */

/** The tier ladder's colours (mirrors RUNE_TIERS in shared/rune-forge/rune.model.ts). */
export const RARITY_COLORS: Readonly<Record<LootRarity, string>> = {
  common: '#8f8aa1',
  uncommon: '#9db8a8',
  rare: '#00d4ff',
  epic: '#a855f7',
  legendary: '#e8c898',
  mythic: '#f8e8c8',
  singular: '#ff6dd7',
};
/** Coins burn gold unless their entry names a rarity. */
export const COIN_BEAM_COLOR = '#ffd36d';
const RARITY_ORDER: readonly LootRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'singular'];

export function rarityRank(rarity: LootRarity | null | undefined): number {
  return rarity ? RARITY_ORDER.indexOf(rarity) : -1;
}
/** Beam colour for a drop: its rarity, else gold for coins and 'common' for materials. */
export function beamColor(rarity: LootRarity | undefined, coins: boolean): string {
  if (rarity && RARITY_COLORS[rarity]) return RARITY_COLORS[rarity];
  return coins ? COIN_BEAM_COLOR : RARITY_COLORS.common;
}
/** Rarer drops throw taller beams, so a legendary reads across the screen. World px. */
export function beamHeight(rarity: LootRarity | undefined, coins: boolean): number {
  return 70 + Math.max(0, rarityRank(rarity)) * 26 + (coins && !rarity ? -10 : 0);
}

/** Margin of the default satchel target from the canvas's top-right corner, CSS px. */
export const SATCHEL_DEFAULT_INSET = 56;

/**
 * Where a pickup flies to, in canvas CSS px (0,0 = the canvas's top-left).
 * `target` is in CLIENT (viewport) px — e.g. the centre of the satchel button's
 * getBoundingClientRect(). Omitted → the canvas's top-right corner. A target
 * outside the canvas is clamped to its edge, so the item visibly leaves toward it.
 */
export function satchelPoint(
  target: { x: number; y: number } | null | undefined,
  rect: { left: number; top: number; width: number; height: number },
  cssWidth: number, cssHeight: number,
  out: { x: number; y: number },
): void {
  if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) {
    out.x = cssWidth - SATCHEL_DEFAULT_INSET; out.y = SATCHEL_DEFAULT_INSET;
    return;
  }
  const kx = rect.width ? cssWidth / rect.width : 1, ky = rect.height ? cssHeight / rect.height : 1;
  out.x = Math.max(0, Math.min(cssWidth, (target.x - rect.left) * kx));
  out.y = Math.max(0, Math.min(cssHeight, (target.y - rect.top) * ky));
}

/** Seconds a picked-up item takes to reach the satchel. */
export const FLIGHT_TIME = .6;

/**
 * A point on the pickup flight at progress t (0..1): a quadratic arc that lifts
 * off the ground first and accelerates into the satchel, shrinking as it goes.
 * t = 0 is exactly the start, t = 1 exactly the end.
 */
export function flightPoint(
  sx: number, sy: number, ex: number, ey: number, t: number,
  out: { x: number; y: number; scale: number },
): void {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  const u = k * k * (1.6 - .6 * k); // ease in, still reaching 1 at k = 1
  const cx = sx + (ex - sx) * .15, cy = Math.min(sy, ey) - 90;
  const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
  out.x = a * sx + b * cx + c * ex;
  out.y = a * sy + b * cy + c * ey;
  out.scale = 1 - .55 * u;
}
