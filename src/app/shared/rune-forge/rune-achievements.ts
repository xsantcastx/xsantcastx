/**
 * rune-achievements.ts — the eight the anvil hands out.
 *
 * Same arrangement as `economy-achievements.ts`, and for the same reason: the
 * eight are registered in `EASTER_EGGS` like everything else on the Codex wall,
 * so they inherit the rarity drop, the XP payout, the discovery date, the card
 * and the locked-card hint. Only the predicates live here.
 *
 * Unlike the economy's, these are not polled off a snapshot. Every one of them
 * can only become true on a strike or a craft, both of which are single points
 * in `RuneForgeService`, so they are checked there — a subscriber that re-ran
 * eight predicates on every economy tick would be doing it about once a second
 * for a page the visitor is not looking at.
 */
import { RUNES } from './rune.model';
import type { RuneForgeService } from './rune-forge.service';

export interface RuneAchievement {
  /** Egg id, registered in EASTER_EGGS. */
  id: string;
  /** True once earned. Pure and cheap — runs on every strike. */
  met(forge: RuneForgeService): boolean;
}

export const RUNE_ACHIEVEMENTS: RuneAchievement[] = [
  {
    id: 'rune-first',
    met: f => f.uniqueFound >= 1,
  },
  {
    id: 'rune-collector',
    met: f => f.uniqueFound >= 10,
  },
  {
    id: 'rune-master',
    met: f => f.uniqueFound >= 20,
  },
  {
    // Guarded on the registry length rather than a literal 25, so adding a
    // twenty-sixth rune does not silently leave this claimable at twenty-five.
    id: 'rune-complete-set',
    met: f => f.uniqueFound >= RUNES.length,
  },
  {
    id: 'rune-first-word',
    met: f => f.craftedCount >= 1,
  },
  {
    id: 'rune-word-scholar',
    met: f => f.craftedCount >= 3,
  },
  {
    // `hasEverFound`, not a live count: the Void is consumed by Breath of the
    // Void, and an achievement that un-earned itself the moment you spent the
    // thing it was for would be the cruellest card on the wall.
    id: 'rune-void-voice',
    met: f => f.hasEverFound('void'),
  },
  {
    id: 'rune-breath-of-void',
    met: f => f.hasCrafted('breath-of-the-void'),
  },
];
