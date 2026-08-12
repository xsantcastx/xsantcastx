/**
 * economy-achievements.ts — the eight the forge hands out.
 *
 * These are registered in `EASTER_EGGS` like everything else on the Codex wall,
 * rather than in a private list of their own. That is not a shortcut — it is
 * the only way they behave like achievements: the egg registry is what drives
 * the rarity drop, the XP payout, the discovery date, the Codex card and the
 * hint on the locked version of that card. A parallel registry would have to
 * reimplement all five, and would be the second place a "did you unlock this"
 * question could be answered differently.
 *
 * Their tiers live in `EGG_TIERS`, their hints in `codex-hints.ts`, and their
 * predicates here — one file per concern, matching how the rest of the wall is
 * assembled.
 */
import { EconomyService } from './economy.service';
import { ARTIFACTS } from './economy.model';

/** Strikes inside sixty seconds that count as a frenzy. */
export const FRENZY_CLICKS = 100;

export interface EconomyAchievement {
  /** Egg id, registered in EASTER_EGGS. */
  id: string;
  /** True once the visitor has earned it. Pure, and cheap — it runs per snapshot. */
  met(economy: EconomyService): boolean;
}

export const ECONOMY_ACHIEVEMENTS: EconomyAchievement[] = [
  {
    id: 'forge-first-purchase',
    met: e => e.hasBoughtAnything,
  },
  {
    id: 'forge-investor',
    met: e => e.upgradeLevels >= 5,
  },
  {
    id: 'forge-market-mogul',
    met: e => e.upgradeLevels >= 15,
  },
  {
    id: 'forge-artifact-collector',
    met: e => e.artifactsOwned >= 3,
  },
  {
    // Guarded on the catalog length rather than a literal 5, so adding a sixth
    // artifact does not silently leave this claimable at five.
    id: 'forge-complete-collection',
    met: e => e.artifactsOwned >= ARTIFACTS.length,
  },
  {
    id: 'forge-click-frenzy',
    met: e => e.clicksLastMinute >= FRENZY_CLICKS,
  },
  // No strike-count predicate here. The Ambient Forge already registered
  // 'idle-forge-striker' (1,000) and 'idle-obsidian-hammer' (10,000), and the
  // Forge Flame drives IdleService's counter on every strike, so both still
  // fire. Adding a second pair keyed on the same act would put two cards on the
  // Codex wall for one thing.
];
