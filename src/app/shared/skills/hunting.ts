/**
 * hunting.ts — what a kill is worth to the Hunting skill.
 *
 * Hunting XP scales with the creature's full HP, so a sturdier creature is
 * worth more and nothing needs a hand-set table: a Rootglass Stag (50 HP)
 * pays 10, a Rivet Maw (60) 12, a Magma Maw (110) 22, the Rune-Warden (260)
 * 52. On the shared curve that is ~9 Maws for Hunting 2.
 *
 * Pure. No Angular — the engine harness loads it under node.
 */

/** HP per point of Hunting XP. */
export const HUNTING_HP_PER_XP = 5;
/** The gateway's ceiling on one world action (WORLD_ACTION_MAX_XP). */
const MAX_XP = 500;

/** Whole-number Hunting XP for felling a creature of `hp` full HP. At least 1. */
export function huntingXpFor(hp: number): number {
  if (!Number.isFinite(hp) || hp <= 0) return 1;
  return Math.max(1, Math.min(MAX_XP, Math.round(hp / HUNTING_HP_PER_XP)));
}
