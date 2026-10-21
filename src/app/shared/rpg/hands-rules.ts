/**
 * hands-rules.ts — the numbers of hands, import-free so the fight (td-melee) and the sims can read them without the
 * item tables. The table of which weapon takes how many hands is item-hands.ts.
 */
export type Hands = 1 | 2;

/** How much harder a two-handed weapon lands the basic attack (×). One-handed: ×1. */
export const TWO_HAND_MULT = 1.2;

/** The basic attack's multiplier for the weapon in hand (none, one hand: 1). */
export function handsMult(hands: number | null | undefined): number { return hands === 2 ? TWO_HAND_MULT : 1; }
