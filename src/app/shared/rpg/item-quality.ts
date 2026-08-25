/**
 * item-quality.ts — how good a roll was, as a number the player can read.
 *
 * The item system already rolled: `rollItemStats` sampled uniformly inside a
 * per-rarity band and froze the result. What it never did was tell the player
 * *where in that band* they landed. Two Mythic Cuirasses sat side by side in the
 * bag showing `Gold/sec +8.1` and `Gold/sec +11.9` and nothing on either card
 * explained that the second one was near the ceiling and the first was near the
 * floor. The numbers were already unique; they were just illegible.
 *
 * This file is the legibility layer, and it is the MapleStory reading of the
 * mechanic: every stat carries a percentage of the best that stat could have
 * been at that rarity, and the item carries the average of those percentages as
 * its overall grade.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TWO NUMBERS, AND WHY THEY ARE NOT THE SAME NUMBER
 * ─────────────────────────────────────────────────────────────────────────────
 * A roll produces two things and conflating them produces a UI nobody can read:
 *
 *   · `q`   — the *multiplier fraction*. What the stat is actually worth, as a
 *             share of the rarity's ceiling. Sampled inside `QUALITY_BAND`.
 *             A Singular can exceed 1: that is the tier breaking its own cap,
 *             which is the whole reason to want one.
 *   · `pct` — the *displayed grade*. Where `q` landed inside its own band,
 *             normalised so that 0 is the worst roll the tier can produce and 1
 *             is the best. This is what goes on the tooltip.
 *
 * Displaying `q` would mean a perfect Common shows 70% and a perfect Singular
 * shows 120%, so "I rolled a good one" would have a different threshold on
 * every rung of the ladder and "100%" would be unreachable for six of the seven
 * tiers. Normalising fixes the vocabulary: **100% always means "this tier
 * cannot do better"**, whichever tier you are holding. The power difference
 * between tiers is still real — it lives in the ceiling, not in the grade.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE BAND WIDENS AND THEN NARROWS AGAIN
 * ─────────────────────────────────────────────────────────────────────────────
 * Common through Legendary widen: each rung up is a bigger gamble than the one
 * below, so a Legendary find is a moment of suspense rather than a foregone
 * conclusion. Mythic and Singular then narrow with a *high floor* — by the time
 * a player is seeing one-in-a-million drops, handing them a dud is not tension,
 * it is an insult. So the top two tiers trade variance for a guarantee, and buy
 * their excitement from a ceiling above 1.0 instead.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE GRADE IS STORED AND NOT RECOMPUTED
 * ─────────────────────────────────────────────────────────────────────────────
 * Same reason `stats` is stored (see item.model.ts), plus one more that is
 * specific to this file: **temper**. A tempered item's `stats` already include
 * every temper bonus it has won, so deriving the grade from `stats` at read time
 * would report a +7 Legendary as a 140% roll. The grade describes the *base
 * roll*, it is written once at mint, and temper never touches it. Reforge does —
 * a reroll is a new base roll, so it writes a new grade.
 *
 * Items minted before this file existed carry no grade at all. They are not
 * back-filled and must not be: there is no way to separate their base roll from
 * their temper bonuses after the fact, and inventing a number would put a
 * fabricated "92%" on an item the player can compare against a real one.
 * `qualityOf` returns null for them and every surface treats null as "ungraded".
 *
 * Pure data and pure functions — no Angular, no browser APIs, SSR-safe.
 */
// Type-only, and it has to stay that way: item.model imports this file back
// (mintCharm rolls its grades here), so a value import would close an ES module
// cycle and leave whichever side evaluated first holding an undefined binding.
// Types are erased, so this edge does not exist at runtime.
import type { ItemRarity, ItemStats } from './item.model';

export type ItemStatKey = keyof ItemStats;

/** The per-key grades frozen onto an instance. Absent keys were never rolled. */
export type RollQuality = Partial<Record<ItemStatKey, number>>;

/**
 * How wide a rarity gambles, as a fraction of that rarity's own ceiling.
 *
 * Read a row as "this tier rolls between `min` and `max` of the best it could
 * do". The width of the row is the gamble; the position of the row is the
 * guarantee. `max` above 1 means the tier can exceed the ceiling the power
 * ladder authored for it — deliberately, and only for the top two.
 */
export const QUALITY_BAND: Readonly<Record<ItemRarity, { readonly min: number; readonly max: number }>> = {
  /** Tight and mediocre. A Common is a Common; there is nothing to chase here. */
  common: { min: 0.50, max: 0.70 },
  /** Wider. Some are worth keeping. */
  uncommon: { min: 0.40, max: 0.80 },
  /** Can be bad or genuinely good. The first tier where the roll is the story. */
  rare: { min: 0.30, max: 0.90 },
  /** Huge variance. A bad Epic is a reforge target, not a keeper. */
  epic: { min: 0.20, max: 0.95 },
  /** Trash or perfect. The widest band in the game, on purpose. */
  legendary: { min: 0.10, max: 1.00 },
  /** Always decent, and can break the ceiling. High floor, see the header. */
  mythic: { min: 0.50, max: 1.10 },
  /** Guaranteed strong, absurd ceiling. One of a kind should feel like it. */
  singular: { min: 0.80, max: 1.20 },
};

/**
 * Void-touched work widens the band at both ends.
 *
 * The roll/temper spec's §6 gives `void-touched` "higher variance" as its style
 * bias, where every other style gets a small directional nudge to one stat. A
 * nudge cannot express "unbound possibility", so void spends its bias on the
 * band instead: same midpoint, more room on either side of it.
 */
export const VOID_VARIANCE = 0.10;

/** The band a roll actually samples, after the style widening. */
export function bandFor(rarity: ItemRarity, voidTouched = false): { min: number; max: number } {
  const band = QUALITY_BAND[rarity] ?? QUALITY_BAND.common;
  if (!voidTouched) return { min: band.min, max: band.max };
  return {
    min: Math.max(0, band.min - VOID_VARIANCE),
    max: band.max + VOID_VARIANCE,
  };
}

/**
 * Multiplier fraction → displayed grade, 0..1.
 *
 * Clamped, because a legacy item whose stats were rolled under the old bands can
 * sit outside the current one and a `-0.3` on a tooltip helps nobody.
 */
export function qualityPercent(q: number, rarity: ItemRarity, voidTouched = false): number {
  const { min, max } = bandFor(rarity, voidTouched);
  const span = max - min;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (q - min) / span));
}

// ─────────────────────────────────────────────────────────────────────────────
// Grading an instance
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Average grade across every rolled stat, or null when the item has none.
 *
 * Unweighted: a two-key item's primary and secondary count the same. Weighting
 * the primary would mean the number on the card and the number the player can
 * reconstruct from the stat lines disagree, and a grade you cannot check by hand
 * is a grade you stop trusting.
 */
export function qualityOf(item: { rollQuality?: RollQuality }): number | null {
  const rolls = item.rollQuality;
  if (!rolls) return null;
  let sum = 0;
  let count = 0;
  for (const value of Object.values(rolls)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    sum += value;
    count++;
  }
  return count ? sum / count : null;
}

/**
 * Average grade across all stats, at or above which an item is **Perfect**.
 *
 * 0.95 is roughly a 1-in-20 roll per stat, so a 1-in-400 two-key item. Rare
 * enough that the prismatic border means something, common enough that a player
 * who grinds will eventually own one and know what they are chasing.
 */
export const PERFECT_THRESHOLD = 0.95;

/**
 * Per-stat grade at or above which every stat counts as maxed, for **Flawless**.
 *
 * Not 1.0. The roll is a continuous uniform, so landing on exactly 1.0 has
 * probability zero and a tag nothing can earn is a tag that does not exist.
 * 0.999 is a genuine 1-in-1000 per stat — 1-in-a-million on a two-key item,
 * which is the right order of magnitude for the rarest cosmetic in the game.
 */
export const FLAWLESS_THRESHOLD = 0.999;

export type QualityTag = 'flawless' | 'perfect' | null;

/**
 * Flawless beats Perfect; every Flawless item is also Perfect, and only the
 * higher tag is returned so no surface has to decide which of two badges wins.
 */
export function qualityTagOf(item: { rollQuality?: RollQuality }): QualityTag {
  const rolls = item.rollQuality;
  if (!rolls) return null;
  const values: number[] = [];
  for (const value of Object.values(rolls)) {
    if (typeof value === 'number' && Number.isFinite(value)) values.push(value);
  }
  if (!values.length) return null;
  if (values.every(v => v >= FLAWLESS_THRESHOLD)) return 'flawless';
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  return avg >= PERFECT_THRESHOLD ? 'perfect' : null;
}

export const QUALITY_TAG_LABELS: Readonly<Record<'flawless' | 'perfect', string>> = {
  flawless: 'Flawless',
  perfect: 'Perfect',
};

// ─────────────────────────────────────────────────────────────────────────────
// Colour
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Grade bands, in the site's own palette.
 *
 * Deliberately *not* the rarity colours: a card already carries its rarity
 * colour on the border, and painting the grade in the same five hues would make
 * "purple" mean two unrelated things on one card. These are the traffic-light
 * reading — bad, middling, good, exceptional — and gold is reserved for the top
 * band so it reads as the same event as a Perfect badge.
 */
export type QualityGrade = 'poor' | 'fair' | 'good' | 'superb';

export interface QualityGradeDefinition {
  id: QualityGrade;
  label: string;
  /** Inclusive lower bound on the displayed percentage. */
  from: number;
  color: string;
  glow: string;
}

export const QUALITY_GRADES: readonly QualityGradeDefinition[] = [
  { id: 'superb', label: 'Superb', from: 0.90, color: '#e8c898', glow: 'rgba(232, 200, 152, 0.55)' },
  { id: 'good', label: 'Good', from: 0.75, color: '#7fd5a3', glow: 'rgba(127, 213, 163, 0.5)' },
  { id: 'fair', label: 'Fair', from: 0.50, color: '#ffd76a', glow: 'rgba(255, 215, 106, 0.45)' },
  { id: 'poor', label: 'Poor', from: 0, color: '#ff6d6d', glow: 'rgba(255, 109, 109, 0.45)' },
];

export function gradeFor(pct: number): QualityGradeDefinition {
  for (const grade of QUALITY_GRADES) {
    if (pct >= grade.from) return grade;
  }
  return QUALITY_GRADES[QUALITY_GRADES.length - 1];
}

export function qualityColor(pct: number): string {
  return gradeFor(pct).color;
}

/** `78%`. One place, so the bag, the tooltip and the Gambler never disagree. */
export function formatQuality(pct: number): string {
  return `${Math.round(pct * 100)}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Price
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What a grade does to the till price.
 *
 * The floor is half sticker and the ceiling is one and a half, so a maxed roll
 * is worth three times a dud of the same name and rarity — enough that reading
 * the grade before selling is worth the player's time, not so much that the bag
 * becomes a lottery ticket they are afraid to cash.
 *
 * Perfect and Flawless then jump the curve rather than continuing it. That
 * discontinuity is intentional: the tags are the jackpot, and a jackpot that
 * pays 4% more than a near-miss is not a jackpot. A player who sells a Perfect
 * without noticing the badge is a player the UI failed, so every sell surface
 * shows the tag and the multiplier together.
 */
export const SELL_QUALITY_FLOOR = 0.5;
export const SELL_QUALITY_SPAN = 1.0;
export const SELL_PERFECT_MULTIPLIER = 3;
export const SELL_FLAWLESS_MULTIPLIER = 5;

export function sellQualityMultiplier(item: { rollQuality?: RollQuality }): number {
  const tag = qualityTagOf(item);
  if (tag === 'flawless') return SELL_FLAWLESS_MULTIPLIER;
  if (tag === 'perfect') return SELL_PERFECT_MULTIPLIER;
  const pct = qualityOf(item);
  // Ungraded legacy items pay exactly sticker. Guessing either way would move
  // money the player never agreed to gamble.
  if (pct == null) return 1;
  return SELL_QUALITY_FLOOR + pct * SELL_QUALITY_SPAN;
}

/** Sticker price × grade, rounded to whole Gold. Never negative. */
export function qualityAdjustedSellValue(base: number, item: { rollQuality?: RollQuality }): number {
  if (!(base > 0)) return 0;
  return Math.max(0, Math.round(base * sellQualityMultiplier(item)));
}
