/**
 * foraging.model.ts — A2 Foraging, data only.
 *
 * The second skill. This copies Mining's tier shape (activity.model.ts's
 * MiningTier / MINING_TIERS / miningTierFor / isMiningTierUnlocked) on
 * purpose rather than lifting a shared SkillTier<T> out of it: the
 * progression spec is explicit that a second skill should mirror the first
 * concretely and let the day a third skill arrives decide what, if anything,
 * the two have earned in common.
 *
 * The site itself — ROOTGLASS_CANOPY — is registered in activity.model.ts
 * beside BASALT_SEAMWORKS, because that file owns the location registry the
 * gateway consults. This file only imports from it, never the reverse, so
 * there is no runtime cycle.
 *
 * Tier gates and XP: Starlight Herb L1 2xp, Sunbloom L6 4xp, Nightbloom L14
 * 8xp, Thornroot L25 15xp. XP per action rises strictly with tier (the spec's
 * non-negotiable) and interpolates Mining's 2/5/12 at L1/8/20 onto the
 * brief's L1/6/14/25 gates. On the shared curve (mining-level.ts) that puts
 * L6 at ~72 minutes of Starlight, L14 at ~4.3h more of Sunbloom, L25 at ~7h
 * more of Nightbloom — a stair-step comparable to Mining's. Thornroot pays 15,
 * above Heartstone's 12, because it opens five levels later.
 */
import type { ActivityLocationDefinition } from './activity.model';
import { ROOTGLASS_CANOPY_ID } from './activity.model';

export { ROOTGLASS_CANOPY_ID };
export type { ActivityLocationDefinition };

export const STARLIGHT_HERB_ID = 'starlight-herb';
export const SUNBLOOM_ID = 'sunbloom';
export const NIGHTBLOOM_ID = 'nightbloom';
export const THORNROOT_ID = 'thornroot';
/** The rare find. A consumable in the art manifest, so repeat drops are sensible. */
export const RIFT_KEY_ID = 'rift-key';

/**
 * The level-1 baseline between gathers. Not what actually gates a gather —
 * see foraging-ops.ts's effectiveForagingRecoveryMs, which starts from this
 * number and shortens it with level. Same shape as MINING_RECOVERY_MS.
 */
export const FORAGING_RECOVERY_MS = 2500;
export const FORAGING_XP_PER_ACTION = 2;
/** 0.1% on any gather. */
export const RIFT_KEY_CHANCE = 0.001;
/** The 600th accepted Canopy gather guarantees the first key if none has landed. */
export const RIFT_KEY_GUARANTEE_AT = 600;
export const ROOTGLASS_CANOPY_HREF = '/world/realms/verdant/rootglass-canopy';

export interface ForagingTier {
  herbId: string;
  /** Foraging level required to select this growth. Starlight Herb is 1 — always open. */
  unlockLevel: number;
  xpPerAction: number;
}

export const FORAGING_TIERS: readonly ForagingTier[] = [
  { herbId: STARLIGHT_HERB_ID, unlockLevel: 1, xpPerAction: FORAGING_XP_PER_ACTION },
  { herbId: SUNBLOOM_ID, unlockLevel: 6, xpPerAction: 4 },
  { herbId: NIGHTBLOOM_ID, unlockLevel: 14, xpPerAction: 8 },
  { herbId: THORNROOT_ID, unlockLevel: 25, xpPerAction: 15 },
];

export function foragingTierFor(herbId: string): ForagingTier | undefined {
  return FORAGING_TIERS.find(tier => tier.herbId === herbId);
}

export function isForagingTierUnlocked(tier: ForagingTier, level: number): boolean {
  return level >= tier.unlockLevel;
}
