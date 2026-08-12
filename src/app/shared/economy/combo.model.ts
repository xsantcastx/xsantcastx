/**
 * combo.model.ts — the escalation ladder behind the Forge Flame.
 *
 * A combo is consecutive *paid* strikes. `EconomyService.strike()` enforces a
 * 500ms cooldown and returns null inside it, so the ceiling is two strikes a
 * second no matter how fast anybody clicks — which is what makes the numbers at
 * the top of this table mean something. Reaching 9,999 is 4,999 seconds of
 * unbroken rhythm, a little under 83 minutes, and one gap longer than
 * `COMBO_RESET_MS` puts you back at zero.
 *
 * Everything here is pure data and pure functions — no browser APIs — so the
 * flame's server render can read the table and the whole ladder is testable
 * without an AudioContext or a DOM.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ON THE EFFECTS AT THE TOP OF THE LADDER
 * ─────────────────────────────────────────────────────────────────────────────
 * The last four tiers reach past the flame and touch the whole viewport. Two
 * constraints shape how, and both are load-bearing rather than fussiness:
 *
 *  1. Every one of them is skipped outright under `prefers-reduced-motion`. The
 *     combo still counts, still pays, still drops its achievements — what goes
 *     is the motion, not the reward. That is the house rule and this is exactly
 *     the feature it was written for.
 *
 *  2. Nothing here flashes repeatedly. Each tier fires once per run, on the
 *     strike that crosses it, so the brightest moments are single events
 *     hundreds of strikes apart rather than anything that could approach the
 *     three-per-second threshold that matters for photosensitive epilepsy.
 */

/** Consecutive paid strikes stop counting here. The display caps with it. */
export const MAX_COMBO = 9_999;

/**
 * Silence longer than this drops the combo to zero.
 *
 * Two seconds against a 500ms cooldown leaves 1.5s of slack per strike — enough
 * that a missed click or a moment's hesitation is survivable, tight enough that
 * the rhythm has to be deliberate. It is the whole difficulty curve.
 */
export const COMBO_RESET_MS = 2_000;

/** Which palette a tier shouts in. The three the forge already speaks in. */
export type ComboTone = 'purple' | 'gold' | 'crimson';

/**
 * What a tier does beyond the flame itself. Ordered by reach: `pop` never
 * leaves the ember, `shatter` takes the screen.
 */
export type ComboEffect =
  /** Text and a brighter ember. Nothing outside the corner. */
  | 'pop'
  /** The ember grows and beats faster, and holds it while the combo lives. */
  | 'surge'
  /** A purple wash along the edges of the viewport, held while the combo lives. */
  | 'edge'
  /** A hard shake of the flame and the effect layer, plus a wide spark burst. */
  | 'shake'
  /** The flame doubles for a moment. */
  | 'swell'
  /** A full vignette that pulses once and then sits under the combo. */
  | 'vignette'
  /** One bright frame across the viewport, with a bass impact under it. */
  | 'flash'
  /** White for 200ms, then purple energy floods back in. */
  | 'whiteout'
  /** Everything at once, and the confetti the forge keeps for endings. */
  | 'shatter';

export interface ComboTier {
  /** The combo count that crosses into this tier. */
  at: number;
  /** Shouted over the flame. */
  label: string;
  tone: ComboTone;
  effect: ComboEffect;
  /**
   * Semitones above the base strike. The click itself pitches up as the ladder
   * climbs, which is the part people feel before they read anything.
   */
  semitones: number;
  /** Egg id banked on first arrival, or undefined for a tier that pays nothing. */
  egg?: string;
}

/**
 * The ladder. Ten steps, and the gaps widen the way the XP ranks do — x10 is an
 * accident, x9,999 is a decision somebody made 83 minutes ago and stuck to.
 *
 * x25 and x250 carry no achievement on purpose. They exist to keep the middle of
 * the climb from going quiet, and a wall covered in participation trophies makes
 * the ones that took something worth less.
 */
export const COMBO_TIERS: ComboTier[] = [
  { at: 10,    label: 'COMBO x10!',              tone: 'purple', effect: 'pop',      semitones: 1,  egg: 'combo-rapid-strike' },
  { at: 25,    label: 'FORGING!',                tone: 'purple', effect: 'surge',    semitones: 2 },
  { at: 50,    label: 'ON FIRE!',                tone: 'gold',   effect: 'edge',     semitones: 3,  egg: 'combo-forge-frenzy' },
  { at: 100,   label: 'CENTURY FORGE!',          tone: 'gold',   effect: 'shake',    semitones: 5,  egg: 'combo-century-forge' },
  { at: 250,   label: 'UNSTOPPABLE!',            tone: 'gold',   effect: 'swell',    semitones: 6 },
  { at: 500,   label: 'GODFORGE AWAKENS!',       tone: 'purple', effect: 'vignette', semitones: 7,  egg: 'combo-relentless' },
  { at: 1_000, label: 'MILLENNIUM STRIKE!',      tone: 'gold',   effect: 'flash',    semitones: 8,  egg: 'combo-millennium-strike' },
  { at: 5_000, label: 'ECLIPSE BREAKER!',        tone: 'purple', effect: 'whiteout', semitones: 10, egg: 'combo-eclipse-breaker' },
  { at: MAX_COMBO, label: 'THE FIRST SUN SHATTERS!', tone: 'gold', effect: 'shatter', semitones: 12, egg: 'combo-first-sun' },
];

// ─────────────────────────────────────────────────────────────────────────────
// The Nameless
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The one count that is not a tier.
 *
 * It sits between 500 and 1,000 and is passed *through* rather than climbed to,
 * so it is deliberately kept out of `COMBO_TIERS`: the sustained colour of the
 * counter should keep climbing the ladder rather than dropping to crimson for
 * one strike and then back. It fires once, ever — the achievement is the gate,
 * so the second time somebody counts past 666 the realm stays quiet.
 */
export const NAMELESS_AT = 666;
export const NAMELESS_EGG = 'combo-forbidden-count';
export const NAMELESS_LABEL = 'THE NAMELESS STIRS...';

// ─────────────────────────────────────────────────────────────────────────────
// Lookups
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The tier a combo of `count` is standing in, or null below the first rung.
 *
 * This is the *sustained* answer — what colour the counter is and which held
 * effects are running — as distinct from `tierCrossedAt`, which fires once.
 */
export function tierFor(count: number): ComboTier | null {
  let held: ComboTier | null = null;
  for (const tier of COMBO_TIERS) {
    if (count >= tier.at) held = tier;
    else break;
  }
  return held;
}

/** The tier whose threshold is exactly `count`, or null. Fires the shout. */
export function tierCrossedAt(count: number): ComboTier | null {
  return COMBO_TIERS.find(t => t.at === count) ?? null;
}

/** The next rung, or null once the ladder has been topped out. */
export function nextTier(count: number): ComboTier | null {
  return COMBO_TIERS.find(t => t.at > count) ?? null;
}

/**
 * Semitones to pitch this strike up by, from the tier being held.
 *
 * Below the first tier the strike is unchanged, which matters: the ordinary
 * click has to stay ordinary or there is nothing for the ladder to climb away
 * from.
 */
export function pitchFor(count: number): number {
  return tierFor(count)?.semitones ?? 0;
}

/** Every achievement on the ladder, including the one that is not a tier. */
export function comboEggIds(): string[] {
  return [...COMBO_TIERS.map(t => t.egg).filter((id): id is string => !!id), NAMELESS_EGG];
}

/**
 * How long an unbroken run to `count` takes at the cooldown-limited ceiling.
 * Used by the codex copy so the claim about 83 minutes stays true if the
 * cooldown is ever retuned.
 */
export function minutesToReach(count: number, cooldownMs: number): number {
  return (count * cooldownMs) / 60_000;
}
