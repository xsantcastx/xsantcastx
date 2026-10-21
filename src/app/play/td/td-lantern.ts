/**
 * td-lantern.ts — the Lanternwright's arithmetic (design-bible §4.3, §4.7), pure so the specs can hold it still.
 *
 * The light finds what hides from it: the dead and the dark-born (the bone and shade families of creature-families.ts,
 * and the night's wraiths, ghouls, wisps and drowned) take LIGHT_BANE times a light blow. Healing comes in ticks over a
 * few seconds (a whole number each tick, the remainder carried, so a heal of 30 over 3 s gives exactly 30). The
 * lantern is a light the Keeper carries: its tiles add to his light radius unless the shutters are closed — then only
 * what a worn unique lends is left, so a shy chest (td-dark shadeChestShown) dares to show.
 */
import { creatureProfile } from '../../shared/loot/creature-families';
import type { Vocation } from '../../shared/keeper-look/keeper-look.model';

/** A light blow on the dead or the dark-born lands this many times as hard. */
export const LIGHT_BANE = 1.5;
/** Creature ids of the dark-born outside the bone and shade families (the night tables' wraiths, ghouls, wisps …). */
const DARK_BORN = /wraith|ghoul|ghost|wisp|lich|revenant|drowned|spectre|specter|shade|skeleton|bone/;

/** Is this creature one of the dead or the dark-born (what light burns)? */
export function shadowBorn(creature: string): boolean {
  const f = creatureProfile(creature).family;
  return f === 'bone' || f === 'shade' || DARK_BORN.test(creature);
}
/** A light blow on a creature: LIGHT_BANE on the dead and the dark-born, as written on anything else. */
export function lightBlow(raw: number, creature: string): number { return shadowBorn(creature) ? raw * LIGHT_BANE : raw; }

/**
 * Tiles each class's own light reaches past the bare glow every Keeper carries: the Lanternwright's lantern on its pole.
 * (design-bible §4.3: "your light is a place".)
 */
export const VOCATION_LIGHT: Readonly<Record<Vocation, number>> = { warlock: 0, ashguard: 0, lanternwright: 2 };

/**
 * The tiles of light the Keeper carries past the bare glow: the class's lantern and the Lantern Aura while they are
 * open, the Light spell while it burns, and the worn uniques' (these last shine through any shutter).
 */
export function carriedLight(o: { vocation: Vocation; shuttered: boolean; aura: number; spell: number; relics: number }): number {
  const lamp = o.shuttered ? 0 : (VOCATION_LIGHT[o.vocation] ?? 0) + Math.max(0, o.aura);
  return lamp + Math.max(0, o.spell) + Math.max(0, o.relics);
}

/** A heal over time: what each whole tick pays, the fraction carried to the next (so the sum is exactly the heal). */
export interface HealOverTime { left: number; per: number; owed: number; t: number }
/** Start a heal of `total` paid once a second over `secs` (at least one tick). */
export function healOverTime(total: number, secs: number): HealOverTime {
  const ticks = Math.max(1, Math.round(secs));
  return { left: ticks, per: Math.max(0, total) / ticks, owed: 0, t: 1 };
}
/** Step a heal over time by `dt`: the whole life it pays now (0 between ticks). Mutates `h`. */
export function stepHeal(h: HealOverTime, dt: number): number {
  if (h.left <= 0) return 0;
  h.t -= dt;
  let paid = 0;
  while (h.t <= 0 && h.left > 0) {
    h.t += 1; h.left--;
    h.owed += h.per;
    // The last tick pays everything still owed, so nothing is lost to rounding.
    const whole = h.left === 0 ? Math.round(h.owed) : Math.floor(h.owed + 1e-9);
    h.owed -= whole; paid += whole;
  }
  return paid;
}

/** Banish: is this foe unmade outright (one of the dead or the dark-born, not a boss, at or under `below`% life)? */
export function unmakes(creature: string, rank: string | undefined, hp: number, maxHp: number, below: number): boolean {
  return rank !== 'boss' && shadowBorn(creature) && maxHp > 0 && hp > 0 && hp / maxHp * 100 <= below;
}
/** Banish on a boss of the dead: its blow lands this many times as hard instead of unmaking it. */
export const BANISH_BOSS = 1.5;

/** Last Light: of a blow `n` on a Keeper with `hp`, what lands — the fatal one is held to his last point of life. */
export function lastLightClamp(n: number, hp: number): { n: number; caught: boolean } {
  if (n < Math.floor(hp)) return { n, caught: false };
  return { n: Math.max(0, Math.floor(hp) - 1), caught: true };
}

/** Is a point inside a disc (Dawn at Noon, the Hearth Circle)? */
export function inDisc(x: number, y: number, cx: number, cy: number, r: number): boolean { return Math.hypot(x - cx, y - cy) <= r; }
