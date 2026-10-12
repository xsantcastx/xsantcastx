/**
 * works-map.model.ts — the geometry behind the Sanctum's Works map.
 *
 * Pure functions of a progress fraction or a timestamp, and nothing else. The
 * map never *advances* anything: every position it draws is recomputed from the
 * expedition's own `startedAt` + `duration`, or a Thrall's `lastRollAt` +
 * `rollInterval`, at the moment it is drawn. That is what keeps it right after
 * a reload, a sleeping laptop or a background tab whose animation frames the
 * browser stopped delivering — there is no accumulated state to fall behind.
 *
 * Coordinates are in map units on a 1000 × 420 board. The template maps one
 * unit to 0.1cqw of the stage, so the same numbers place SVG paths and HTML
 * tokens without measuring anything.
 *
 * No browser APIs — safe on the SSR path.
 */

export interface MapPoint {
  x: number;
  y: number;
}

/** Board size, in map units. The stage keeps this aspect ratio. */
export const MAP_W = 1000;
export const MAP_H = 420;

/** The Treasury — where every journey starts and every haul lands. */
export const HUB: MapPoint = { x: 120, y: 210 };
/** The Thrall anvil. */
export const ANVIL: MapPoint = { x: 300, y: 82 };
/** The Forge automatons — the idle Gold rate. */
export const FORGE: MapPoint = { x: 300, y: 338 };
/** The Keeper's own Current Work site. */
export const WORKSITE: MapPoint = { x: 500, y: 372 };

/** Where realm `index` of `count` sits on the right-hand arc. */
export function realmAnchor(index: number, count: number): MapPoint {
  const n = Math.max(1, count);
  const top = 52;
  const bottom = MAP_H - 52;
  const y = n === 1 ? MAP_H / 2 : top + (index * (bottom - top)) / (n - 1);
  const mid = (n - 1) / 2;
  const x = 885 - Math.abs(index - mid) * 46;
  return { x, y };
}

/**
 * The control point of the route from the Treasury to `to`.
 *
 * `lane` fans out several explorers bound for the same realm, so two tokens on
 * one road do not sit exactly on top of each other.
 */
export function routeControl(to: MapPoint, lane = 0): MapPoint {
  return {
    x: 520,
    y: (HUB.y + to.y) / 2 + (to.y - HUB.y) * 0.32 + lane * 30,
  };
}

/** Quadratic Bézier point at `t`. */
export function bezierAt(p0: MapPoint, c: MapPoint, p2: MapPoint, t: number): MapPoint {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * c.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * c.y + t * t * p2.y,
  };
}

/** SVG path data for a route. */
export function routePath(to: MapPoint, lane = 0): string {
  const c = routeControl(to, lane);
  return `M ${HUB.x} ${HUB.y} Q ${c.x} ${c.y} ${to.x} ${to.y}`;
}

/**
 * How a mission's wall-clock is split into a journey.
 *
 * The mission itself is one span with one deadline; the map just tells it as
 * a trip out, a stay at the site, and a walk home. The shares are display only
 * — they never touch when the expedition actually lands.
 */
export const OUTBOUND_SHARE = 0.42;
export const ON_SITE_SHARE = 0.16;

export type JourneyPhase = 'out' | 'site' | 'back' | 'home';

export interface JourneyPosition {
  phase: JourneyPhase;
  /** 0 at the Treasury, 1 at the site. */
  along: number;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Where along the road a mission at `progress` (0–1) is. */
export function journeyAt(progress: number): JourneyPosition {
  const p = clamp01(Number.isFinite(progress) ? progress : 0);
  if (p >= 1) return { phase: 'home', along: 0 };
  if (p < OUTBOUND_SHARE) return { phase: 'out', along: smooth(p / OUTBOUND_SHARE) };
  const back = OUTBOUND_SHARE + ON_SITE_SHARE;
  if (p < back) return { phase: 'site', along: 1 };
  return { phase: 'back', along: 1 - smooth((p - back) / (1 - back)) };
}

/** Mission progress at `now`, from its own frozen start and duration. */
export function progressAt(startedAt: number, duration: number, now: number): number {
  if (!(duration > 0)) return 1;
  return clamp01((now - startedAt) / duration);
}

/**
 * Fraction (0–1) of the way to a worker's next beat.
 *
 * Used for a Thrall's next pull and for the Current Work recovery: both are a
 * "last happened at" stamp plus an interval. A worker that has never beaten yet
 * (`last` of 0) reads as just started.
 */
export function cycleAt(last: number, interval: number, now: number): number {
  if (!(interval > 0) || !(last > 0)) return 0;
  return clamp01((now - last) / interval);
}

/** A slot on the ring of Thralls around the anvil. */
export function anvilSlot(index: number, count: number): MapPoint {
  const n = Math.max(1, count);
  // A half-ring opening towards the Treasury, so the flows leave cleanly.
  const start = -Math.PI * 0.15;
  const end = Math.PI * 1.15;
  const a = n === 1 ? Math.PI / 2 : start + (index * (end - start)) / (n - 1);
  return { x: ANVIL.x + Math.cos(a) * 70, y: ANVIL.y - Math.sin(a) * 46 + 14 };
}

/** One or two letters for an orb with no painting. */
export function monogram(name: string | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(w => /^[A-Za-z]/.test(w));
  if (!words.length) return '?';
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}
