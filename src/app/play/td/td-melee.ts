/**
 * td-melee.ts — the Ashguard's arithmetic (design-bible §4.4, §4.7), pure so the specs can hold it still.
 *
 * The Warlock's staff throws a bolt from afar; the Ashguard swings a blade in an arc in front of him. A swing strikes
 * every creature inside the arc — within the reach (plus a little of a big creature's body) and within half the arc's
 * angle either side of where he aims. A blow is the Watch Blade's roll, lifted or cut by a share (Cinder Cleave's
 * 100%, the Whirl's 60% a turn) and by the Ember Brand while it burns. Crowd control on a boss lasts a fifth as long.
 */

import { handsMult } from '../../shared/rpg/hands-rules';

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

/**
 * The weapon in hand as the swing sees it: `flat` is added to the Watch Blade's roll (before any %), `mult` scales the
 * whole roll. D2-style: the kit blade is the base, the weapon's own damage rides on it. `blade` is a melee weapon's own
 * +min–max Damage (the Ashguard's swing and blade skills add it), `arrow` a bow's or crossbow's (the Thornstrider's
 * shots add it) — docs/design/loot-and-combat.md §3.6.
 */
export interface WeaponSwing { flat: number; mult: number; blade?: readonly [number, number]; arrow?: readonly [number, number] }
/** Bare hands: the blade still swings, a fifth less hard (the kit sword with nothing to hold). */
export const FISTS: WeaponSwing = { flat: 0, mult: .85 };
/** A weapon with no extra damage over the starter edge swings exactly as the kit blade does. */
export const NO_WEAPON_BONUS: WeaponSwing = { flat: 0, mult: 1 };
/** Weapon power of the starter Basalt Edge (strikePower 1): the point past which a weapon adds damage. */
export const STARTER_WEAPON_POWER = 1;
/** Flat swing damage per point of weapon power above the starter's. */
export const WEAPON_FLAT_PER_POINT = 3;
/** An OLD roll's Spell Damage % on a melee weapon counts as this share of a point of weapon power per % (§3.6 old rolls). */
export const WEAPON_SD_PER_POINT = .25;

/** What the swing reads off the held weapon. `kind`: 'melee' (a sword, an axe…), 'bow' (bows, crossbows) or 'caster'. */
export interface HeldWeapon {
  strikePower?: number; spellDamage?: number; minDamage?: number; maxDamage?: number; hands?: number;
  kind?: 'melee' | 'bow' | 'caster';
}

/**
 * A held weapon's swing. Weapon power = its Strike (the legacy head stat) + a quarter of an OLD melee weapon's Spell
 * Damage % (§3.6: an old sword swings exactly as before); the flat is WEAPON_FLAT_PER_POINT × what that has over the
 * starter edge's 1. A melee weapon's +min–max Damage is the blade's, a bow's is the arrow's; a caster's weapon adds
 * neither (its Spell Damage lifts the spells). `hands: 2` (a bow, a staff, a greatsword, a maul, a polearm) multiplies
 * the blow by TWO_HAND_MULT. `null` is no weapon.
 */
export function weaponSwing(w: HeldWeapon | null): WeaponSwing {
  if (!w) return FISTS;
  const n = (x: number | undefined) => (Number.isFinite(x) ? Math.max(0, x as number) : 0);
  const kind = w.kind ?? 'melee';
  const power = n(w.strikePower) + (kind === 'melee' ? n(w.spellDamage) * WEAPON_SD_PER_POINT : 0);
  const lo = Math.round(n(w.minDamage)), hi = Math.max(lo, Math.round(n(w.maxDamage)));
  const own: readonly [number, number] | undefined = hi > 0 ? [lo, hi] : undefined;
  // Two hands (shared/rpg/item-hands.ts): the whole blow lands TWO_HAND_MULT harder — the price is the empty off-hand.
  return {
    flat: Math.round(Math.max(0, power - STARTER_WEAPON_POWER) * WEAPON_FLAT_PER_POINT), mult: handsMult(w.hands),
    ...(own && kind === 'melee' ? { blade: own } : {}),
    ...(own && kind === 'bow' ? { arrow: own } : {}),
  };
}

/** One roll inside [lo, hi] (whole numbers) on the sample `u` in [0, 1). */
function within(lo: number, hi: number, u: number): number {
  return lo + Math.floor(u * (hi - lo + 1));
}

/**
 * A blow: a roll between the blade's min and max (both whole), plus the weapon's flat and its own +min–max (the same
 * roll, so a top blade roll is a top weapon roll), times `pct` % of it. Never below 1.
 */
export function meleeBlow(min: number, max: number, pct = 100, roll: () => number = Math.random, weapon: WeaponSwing = NO_WEAPON_BONUS): number {
  const lo = Math.min(min, max), hi = Math.max(min, max);
  const u = roll();
  const own = weapon.blade ? within(weapon.blade[0], weapon.blade[1], u) : 0;
  const base = (within(lo, hi, u) + weapon.flat + own) * weapon.mult;
  return Math.max(1, Math.round(base * pct / 100));
}

/** An arrow: the shot's roll plus a bow's own +min–max (the same sample), times its hands. Never below 1. */
export function arrowBlow(min: number, max: number, roll: () => number = Math.random, weapon: WeaponSwing = NO_WEAPON_BONUS, mult = 1): number {
  const lo = Math.min(min, max), hi = Math.max(min, max);
  const u = roll();
  const own = weapon.arrow ? within(weapon.arrow[0], weapon.arrow[1], u) : 0;
  return Math.max(1, Math.round((within(lo, hi, u) + own) * mult));
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
