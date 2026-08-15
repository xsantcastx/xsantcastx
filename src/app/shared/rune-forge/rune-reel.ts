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

export const AUTO_ROLLS = 10;
export const PICK_COUNT = 10;
const PICK_MARKS = ['◈', '◇', '☽', 'ϟ', '✦', '✶', '⬡', '⟡', '☼', '☖'] as const;

export interface PickSlot {
  index: number;
  mark: string;
}

/** Ten backs. The ledger already wrote the winner; the pick is theatrical. */
export function buildPickHand(count = PICK_COUNT): PickSlot[] {
  const n = Math.max(2, Math.floor(count));
  return Array.from({ length: n }, (_, index) => ({
    index,
    mark: PICK_MARKS[index % PICK_MARKS.length],
  }));
}
