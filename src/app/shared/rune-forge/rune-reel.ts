/**
 * rune-reel.ts — faces for the anvil slot.
 *
 * The strike resolves first. This only builds the strip the window scrolls
 * through, so the land is always the rune the ledger already wrote.
 */
import { RUNES, type Rune, type RuneTier } from './rune.model';
import { runeCard, type CardArt } from './rune-cards';

export const SLOT_FACE_PX = 216;

export interface ReelFace {
  id: string;
  name: string;
  card: CardArt | null;
}

export function reelLength(tier: RuneTier): number {
  if (tier === 'singular') return 28;
  if (tier === 'mythic') return 24;
  if (tier === 'legendary') return 22;
  if (tier === 'epic') return 20;
  return 16;
}

export function spinMs(tier: RuneTier): number {
  if (tier === 'singular') return 2400;
  if (tier === 'mythic') return 2000;
  if (tier === 'legendary') return 1800;
  if (tier === 'epic') return 1600;
  return 1300;
}

export function faceOf(rune: Rune): ReelFace {
  return { id: rune.id, name: rune.name, card: runeCard(rune.id) };
}

export function buildReel(
  winner: Rune,
  length: number,
  rng: () => number = Math.random,
): ReelFace[] {
  const n = Math.max(2, Math.floor(length));
  const pool = RUNES.filter(row => row.id !== winner.id);
  const faces: ReelFace[] = [];
  for (let i = 0; i < n - 1; i++) {
    const pick = pool[Math.floor(rng() * pool.length)] ?? winner;
    faces.push(faceOf(pick));
  }
  faces.push(faceOf(winner));
  return faces;
}

export function reelOffset(length: number): number {
  return -Math.max(0, length - 1) * SLOT_FACE_PX;
}

/**
 * How many strikes Auto x10 buys, and the divisor for its price.
 *
 * There used to be a ten-card hand built here for a single strike to pick
 * from. The ledger wrote the rune before the cards were dealt, so the choice
 * was theatre; it was removed and the reveal now lands the moment the strike
 * resolves.
 */
export const AUTO_ROLLS = 10;

/** The bulk buttons on the reveal, in the order they are drawn. */
export const BULK_ROLLS = [10, 100, 1000] as const;

/*
 * `BULK_CAP` used to live here, at a thousand strikes, as the ceiling on one
 * bulk run. It is gone: it made the ALL button a lie on any deep purse, which
 * offered "spend what you can afford" and then spent a fraction of it. ALL is
 * now exactly `floor(gold / STRIKE_COST)`. What the cap was really protecting
 * — the reveal holding on to every find of the run — is handled by folding the
 * run into a `BatchTally` instead of keeping it.
 */

/**
 * How long one chunk of a bulk run may hold the frame.
 *
 * Measured in the built app: a strike costs ~0.27ms on an empty bag and
 * ~1.18ms once the 250-row inventory cap starts evicting on every mint. Eight
 * milliseconds is a handful of strikes at the slow end, which keeps the
 * progress line moving and the Stop button clickable on a phone.
 */
export const BULK_FRAME_MS = 8;

/** Delay between auto-roll pulls — a lever's rhythm, not a loop's. */
export const AUTO_STEP_MS = 260;

/**
 * The rung auto-roll stops on, and every rung above it.
 *
 * Rare is the first find a player would be annoyed to have rolled straight
 * past. An auto-roll that walked through the thing it was looking for would
 * be a way to miss it rather than a way to reach it.
 */
export const AUTO_STOP_TIER: RuneTier = 'rare';
