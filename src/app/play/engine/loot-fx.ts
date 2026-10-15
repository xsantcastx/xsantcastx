import type { LootRarity } from '../world/world.model';
import { LOOT_TIER_FX } from '../../shared/loot/loot-tiers';

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
/** The base column a Rare throws (LOOT_TIER_FX scales it per rung). World px. */
export const BEAM_BASE = 150;
/** A common material keeps a low glint; plain coins a short gold one. */
export const GLINT_BEAM = 24;
export const COIN_BEAM = 46;
/**
 * Rarer drops throw taller beams, so a legendary reads across the screen
 * (shared/loot/loot-tiers.ts LOOT_TIER_FX: common a glint, singular 2.6x a Rare). World px.
 */
export function beamHeight(rarity: LootRarity | undefined, coins: boolean): number {
  if (!rarity) return coins ? COIN_BEAM : GLINT_BEAM;
  return Math.max(GLINT_BEAM, Math.round(BEAM_BASE * LOOT_TIER_FX[rarity].beam));
}

/**
 * Sparkle `i` of `n` around a drop at time `t` (seconds): a slow orbit with a
 * rise-and-fall, offsets in world px from the drop's foot, plus a 0..1 twinkle.
 * Pure, so the node tests can pin it; reduced motion passes t = 0 (a still ring).
 */
export function sparkleAt(i: number, n: number, t: number, height: number, out: { x: number; y: number; a: number }): void {
  const phase = (i / Math.max(1, n)) * Math.PI * 2;
  const turn = phase + t * 1.3;
  const rise = ((t * .35 + i / Math.max(1, n)) % 1);
  out.x = Math.round(Math.cos(turn) * 22);
  out.y = -Math.round(10 + rise * height * .7);
  out.a = Math.max(0, Math.sin(rise * Math.PI)) * (.6 + .4 * Math.abs(Math.sin(t * 6 + i)));
}

/**
 * Where an off-screen drop's edge pip sits, in screen px: the screen point
 * pulled onto the frame `inset` px inside the edge, along the line from the
 * centre. `visible` is false when the drop is on screen (no pip).
 */
export function edgePip(sx: number, sy: number, w: number, h: number, inset: number, out: { x: number; y: number; visible: boolean }): void {
  out.visible = sx < 0 || sx > w || sy < 0 || sy > h;
  const cx = w / 2, cy = h / 2, dx = sx - cx, dy = sy - cy;
  const kx = dx ? (cx - inset) / Math.abs(dx) : Infinity, ky = dy ? (cy - inset) / Math.abs(dy) : Infinity;
  const k = Math.min(1, kx, ky);
  out.x = cx + dx * k; out.y = cy + dy * k;
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
