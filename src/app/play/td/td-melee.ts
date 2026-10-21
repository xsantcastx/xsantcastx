/**
 * td-melee.ts — the Ashguard's arithmetic (design-bible §4.4, §4.7), pure so the specs can hold it still.
 *
 * The Warlock's staff throws a bolt from afar; the Ashguard swings a blade in an arc in front of him. A swing strikes
 * every creature inside the arc — within the reach (plus a little of a big creature's body) and within half the arc's
 * angle either side of where he aims. A blow is the Watch Blade's roll, lifted or cut by a share (Cinder Cleave's
 * 120%, the Whirl's 60% a turn) and by the Ember Brand while it burns. Crowd control on a boss lasts a fifth as long.
 */

/** Bosses take this share of a stun or a taunt (design-bible §4.7: "bosses take 20% of root/slow/blind duration"). */
export const BOSS_CC = .2;
/** How much of a creature's half-width the reach forgives (a broad body is reached at its flank, not its middle). */
export const BODY_GRACE = .5;

/** The angle between two headings, folded into 0..π. */
export function angleGap(a: number, b: number): number {
  const d = Math.abs(((a - b) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
  return d;
}

/**
 * Is a creature at (mx, my) inside a swing from (ox, oy) aimed at `aim` (radians) with this reach (art px) and arc
 * (degrees)? `halfBody` is half the creature's width: the reach is forgiven BODY_GRACE of it. A creature standing on
 * the Keeper's own square is always inside (nothing can hide under the blade). An arc of 360 is a full turn.
 */
export function inArc(ox: number, oy: number, aim: number, reach: number, arcDeg: number, mx: number, my: number, halfBody = 0): boolean {
  const d = Math.hypot(mx - ox, my - oy);
  if (d > reach + Math.max(0, halfBody) * BODY_GRACE) return false;
  if (d < 4 || arcDeg >= 360) return true;
  return angleGap(Math.atan2(my - oy, mx - ox), aim) <= (arcDeg / 2) * Math.PI / 180;
}

/** A blow: a roll between the blade's min and max (both whole), times `pct` % of it. Never below 1. */
export function meleeBlow(min: number, max: number, pct = 100, roll: () => number = Math.random): number {
  const lo = Math.min(min, max), hi = Math.max(min, max);
  const base = lo + Math.floor(roll() * (hi - lo + 1));
  return Math.max(1, Math.round(base * pct / 100));
}

/** The Ember Brand on a blow: the blow grows by its %, and the brand's burn rides on top (whole numbers). */
export function brandedBlow(blow: number, brandPct: number): number {
  return Math.max(1, Math.round(blow * (100 + Math.max(0, brandPct)) / 100));
}

/** Crowd control's seconds on a creature of a rank: a boss takes BOSS_CC of it. */
export function ccSecs(secs: number, rank: string | undefined): number {
  return rank === 'boss' ? Math.round(secs * BOSS_CC * 100) / 100 : secs;
}

/**
 * The Defense a blow meets: the Keeper's own, plus the Watchfire's while it runs, lifted by Hold the Line's % when his
 * life is under its threshold (`below`, a % of the most life).
 */
export function guardedDefense(defense: number, aura: number, hp: number, maxHp: number, hold: { below: number; pct: number } | null): number {
  const d = Math.max(0, defense) + Math.max(0, aura);
  if (!hold || !(maxHp > 0) || hp / maxHp * 100 >= hold.below) return d;
  return d * (1 + hold.pct / 100);
}

/** The Vow of the Last Watch: of a blow `n`, what may land on a Keeper with `hp` life — never his last point. */
export function vowClamp(n: number, hp: number): number {
  return Math.max(0, Math.min(n, Math.floor(hp) - 1));
}

/** Where a charge stops: `stop` px short of the foe on the line from the Keeper, never past where he started. */
export function strideEnd(ox: number, oy: number, fx: number, fy: number, stop: number): { x: number; y: number } {
  const d = Math.hypot(fx - ox, fy - oy);
  if (d <= stop) return { x: ox, y: oy };
  const k = (d - stop) / d;
  return { x: ox + (fx - ox) * k, y: oy + (fy - oy) * k };
}
