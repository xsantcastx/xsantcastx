/**
 * damage.model.ts — damage types and resistances (docs/design/loot-and-combat.md §6).
 *
 * Five types. Physical is the swing; the four elements are what a creature, a
 * champion's enchantment or an aura pulse can carry. Arcane is the staff's
 * "lance of light" (the blast), so a creature that shrugs off steel can still
 * be burned with light.
 *
 * Resistances are percentages, D2-shaped:
 *  - a creature's resist is clamped to [-100, 100] when it takes a hit; 100 or
 *    more is IMMUNE (no damage at all);
 *  - Conviction lowers a creature's resist; against an immunity it only works
 *    at a fifth of its strength (so an immunity breaks only when Conviction is
 *    strong enough to take it under 100: Hell needs a big aura);
 *  - the Keeper's resists start at 0, take the difficulty penalty (Nightmare
 *    -40, Hell -100) and are capped at 75 (MAX_KEEPER_RESIST): gear, runes and
 *    auras are how a Keeper climbs back.
 *
 * Pure: no imports, no browser APIs. The engine, the sims and the specs share it.
 */
export type DamageType = 'physical' | 'fire' | 'cold' | 'lightning' | 'arcane';
export const DAMAGE_TYPES: readonly DamageType[] = ['physical', 'fire', 'cold', 'lightning', 'arcane'];
/** The four the Keeper resists (physical is Ward's job: more health). */
export type Element = Exclude<DamageType, 'physical'>;
export const ELEMENTS: readonly Element[] = ['fire', 'cold', 'lightning', 'arcane'];

export type Resists = Partial<Record<DamageType, number>>;

/** A creature at or above this resist takes nothing of that type. */
export const IMMUNE_AT = 100;
/** The Keeper's resist ceiling (D2's 75). */
export const MAX_KEEPER_RESIST = 75;
/** Nothing is ever less resistant than this: -100 is double damage. */
export const MIN_RESIST = -100;
/** Conviction against an immunity works at this share (D2: a fifth). */
export const IMMUNE_CONVICTION_SHARE = 0.2;

/** The pixel colour of each type: hit numbers, the debuff tint, the codex row. */
export const DAMAGE_COLORS: Readonly<Record<DamageType, string>> = {
  physical: '#f2e6d0',
  fire: '#ff8a3d',
  cold: '#8fd8ff',
  lightning: '#ffe36d',
  arcane: '#d9c2ff',
};

/**
 * A creature's resist to `type` after Conviction (`lower`, a positive number of
 * points). Immunities only take a fifth of it; nothing goes below MIN_RESIST.
 */
export function effectiveResist(resist: number | undefined, lower = 0): number {
  const r = Number.isFinite(resist) ? Number(resist) : 0;
  const cut = Math.max(0, lower);
  const out = r >= IMMUNE_AT ? r - cut * IMMUNE_CONVICTION_SHARE : r - cut;
  return Math.max(MIN_RESIST, out);
}

/** True when that resist (after Conviction) still makes the creature immune. */
export function isImmune(resist: number | undefined, lower = 0): boolean {
  return effectiveResist(resist, lower) >= IMMUNE_AT;
}

/**
 * Damage after a resist: `damage × (1 - resist/100)`, clamped, rounded, never
 * below 1 unless immune (an immune creature takes 0). `lower` is Conviction.
 */
export function mitigate(damage: number, resist: number | undefined, lower = 0): number {
  if (!(damage > 0)) return 0;
  const r = effectiveResist(resist, lower);
  if (r >= IMMUNE_AT) return 0;
  return Math.max(1, Math.round(damage * (1 - r / 100)));
}

/**
 * The Keeper's resist to an element: what gear gives, minus the difficulty
 * penalty, minus a curse, capped at MAX_KEEPER_RESIST and floored at MIN_RESIST.
 */
export function keeperResist(fromGear: number | undefined, penalty: number, curse = 0): number {
  const raw = (Number.isFinite(fromGear) ? Number(fromGear) : 0) - Math.max(0, penalty) - Math.max(0, curse);
  return Math.max(MIN_RESIST, Math.min(MAX_KEEPER_RESIST, raw));
}

/** A hit on the Keeper of `type`: physical is never resisted here (Ward is health). */
export function hitOnKeeper(damage: number, type: DamageType, resist: number): number {
  if (!(damage > 0)) return 0;
  if (type === 'physical') return Math.max(1, Math.round(damage));
  return Math.max(1, Math.round(damage * (1 - Math.max(MIN_RESIST, Math.min(MAX_KEEPER_RESIST, resist)) / 100)));
}

/** Sum resist blocks (gear pieces, runes, words). */
export function sumResists(blocks: readonly Resists[]): Resists {
  const out: Resists = {};
  for (const b of blocks) for (const t of DAMAGE_TYPES) {
    const v = b[t];
    if (typeof v === 'number' && Number.isFinite(v) && v !== 0) out[t] = (out[t] ?? 0) + v;
  }
  return out;
}
