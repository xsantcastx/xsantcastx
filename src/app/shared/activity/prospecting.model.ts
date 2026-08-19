/**
 * prospecting.model.ts — B1 Prospecting, data only.
 *
 * The third skill. Layout copies foraging.model.ts (the skill authoring spec
 * §2.1 names Foraging's two-file split as the one skill N follows): material
 * ids, the rare find, the recovery baseline, the rate/guarantee pair, the site
 * href and the tier table live here; the roll, the operation builder, the
 * location check and the recovery curve live in prospecting-ops.ts.
 *
 * The site — MERIDIAN_ORRERY — is registered in activity.model.ts beside
 * BASALT_SEAMWORKS and ROOTGLASS_CANOPY, because that file owns the registry
 * the gateway consults. This file only imports from it, never the reverse, so
 * there is no runtime cycle (spec §2.2).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY CELESTIAL, AND WHY FIVE MATERIALS FROM FIVE REALMS
 * ─────────────────────────────────────────────────────────────────────────────
 * The five painted-but-unused materials are celestial-alloy, luminous-prism,
 * verdant-sap, umbral-ink and void-shard — one per realm plus the void. A site
 * that yields all five has to be a place where realm boundaries are physically
 * present, and canon already has exactly one: the Meridian Orrery, "a
 * brass-and-glass orbital chamber built around a suspended four-point anchor
 * whose rings trace realm boundaries in star silver"
 * (five-realms.narrative.ts). Celestial's authored resource is Astral metal,
 * "a responsive alloy that holds an orbit only while its rule remains
 * coherent" — that is celestial-alloy, the always-open tier 1. Prospecting the
 * Orrery means working the rings themselves: the deeper you cut, the further
 * from Celestial the matter you pull out is, which is the tier ladder's story
 * and its ordering (own realm → Luminous → Verdant → Umbral → the Void).
 *
 * Celestial has no chapter component, so the site is the realm's canon
 * landmark and no name is coined (spec §7.1).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TIER GATES AND XP — THE PACING ARITHMETIC (spec §4.2 requires this here)
 * ─────────────────────────────────────────────────────────────────────────────
 * Gates 1 / 7 / 15 / 24 / 34, paying 2 / 5 / 9 / 14 / 19. Both strictly rise;
 * tier 1 pays PROSPECTING_XP_PER_ACTION (2) as every skill's tier 1 must. The
 * values track the spec's rule of thumb `xpPerAction ≈ 2 + unlockLevel / 2`.
 *
 * Against the shared curve (mining-level.ts, xpForLevel(n) = 100·(n−1)^2.2) at
 * the flat 2,500 ms baseline, grinding each tier to reach the next costs:
 *
 *   L7  ·  5,151 XP       ÷ 2  = 2,576 actions ≈ 1.8 h  (first step, spec wants < ~2.5 h)
 *   L15 ·  +28,075 XP     ÷ 5  = 5,615 actions ≈ 3.9 h
 *   L24 ·  +65,811 XP     ÷ 9  = 7,313 actions ≈ 5.1 h
 *   L34 ·  +120,107 XP    ÷ 14 = 8,580 actions ≈ 6.0 h
 *
 * Every step lands in the spec's 1–8 h stair-step band, and the real numbers
 * are shorter because recovery shortens 1 %/level. Void Shard pays 19 — more
 * than Thornroot's 15 at L25 and Heartstone's 12 at L20 — because it opens
 * nine and fourteen levels later respectively; the spec's rule is that a tier
 * opening later must pay more, or the level gate punishes the climb. It stays
 * under the rejected "20+ at L25" ceiling: 19 XP for a gate nine levels above
 * Thornroot's is a 27 % raise for a 36 % longer climb.
 */
import type { ActivityLocationDefinition } from './activity.model';
import { MERIDIAN_ORRERY_ID } from './activity.model';

export { MERIDIAN_ORRERY_ID };
export type { ActivityLocationDefinition };

export const CELESTIAL_ALLOY_ID = 'celestial-alloy';
export const LUMINOUS_PRISM_ID = 'luminous-prism';
export const VERDANT_SAP_ID = 'verdant-sap';
export const UMBRAL_INK_ID = 'umbral-ink';
export const VOID_SHARD_ID = 'void-shard';

/**
 * The rare find. A consumable in the art manifest, exactly like Foraging's
 * Rift Key and for the same reason: repeat drops of a consumable are sensible,
 * so the roll needs no Mining-style latch (see prospecting-ops.ts). Clarity
 * Elixir is Celestial's own object — the realm's function is "prevent
 * preventable catastrophe by making Eclipse behavior legible" — and it is the
 * only unused consumable in the library. `broken-astral-compass` is the
 * thematically closer name but is already spoken for as the locked Exploration
 * tile's mark in hub-skills.component.ts.
 */
export const CLARITY_ELIXIR_ID = 'clarity-elixir';

/**
 * The level-1 baseline between surveys. Not what actually gates a survey —
 * see prospecting-ops.ts's effectiveProspectingRecoveryMs. 2,500 ms is the
 * shared baseline for every gathering skill (spec §6); the tier table is the
 * pacing lever, not the cooldown.
 */
export const PROSPECTING_RECOVERY_MS = 2500;
export const PROSPECTING_XP_PER_ACTION = 2;
/** 0.07% on any survey. */
export const CLARITY_ELIXIR_CHANCE = 0.0007;
/**
 * The 750th accepted Orrery survey guarantees the first elixir if none has
 * landed. Between Mining's 800 and Foraging's 600: Prospecting's ladder is the
 * longest of the three (L34 top gate against L25 and L20), so its pity timer
 * sits nearer the patient end.
 */
export const CLARITY_ELIXIR_GUARANTEE_AT = 750;
export const MERIDIAN_ORRERY_HREF = '/world/realms/celestial/meridian-orrery';

export interface ProspectingTier {
  mineralId: string;
  /** Prospecting level required to select this cut. Celestial Alloy is 1 — always open. */
  unlockLevel: number;
  xpPerAction: number;
}

export const PROSPECTING_TIERS: readonly ProspectingTier[] = [
  { mineralId: CELESTIAL_ALLOY_ID, unlockLevel: 1, xpPerAction: PROSPECTING_XP_PER_ACTION },
  { mineralId: LUMINOUS_PRISM_ID, unlockLevel: 7, xpPerAction: 5 },
  { mineralId: VERDANT_SAP_ID, unlockLevel: 15, xpPerAction: 9 },
  { mineralId: UMBRAL_INK_ID, unlockLevel: 24, xpPerAction: 14 },
  { mineralId: VOID_SHARD_ID, unlockLevel: 34, xpPerAction: 19 },
];

export function prospectingTierFor(mineralId: string): ProspectingTier | undefined {
  return PROSPECTING_TIERS.find(tier => tier.mineralId === mineralId);
}

export function isProspectingTierUnlocked(tier: ProspectingTier, level: number): boolean {
  return level >= tier.unlockLevel;
}
