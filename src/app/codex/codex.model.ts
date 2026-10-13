/**
 * codex.model.ts — the Achievement Wall's data.
 *
 * The wall used to group by *codex category* — the five realms plus Arena and
 * Global — but the realm categories only ever held tool eggs and the Arena one
 * only the tool-era gate eggs, so every public egg is now simply on the wall,
 * filtered by rarity and status rather than by a place it no longer has.
 *
 * Pure data and pure functions. No browser APIs: the wall is server-rendered in
 * its fully-locked state and hydration only flips what has actually been found.
 */
import { PUBLIC_CODEX_EGGS, isPublicCodexEgg } from '../shared/easter-eggs/easter-egg.service';
import { EclipseRarity, RarityDefinition, rarityOf, tierForEgg } from '../shared/rarity/rarity.model';
import { hintFor } from './codex-hints';

/** One card on the Achievement Wall. Locked state is filled in at runtime. */
export interface CodexAchievement {
  id: string;
  name: string;
  description: string;
  hint: string;
  icon: string;
  tier: EclipseRarity;
  rarity: RarityDefinition;
  /** XP this pays on discovery. */
  xp: number;
  unlocked: boolean;
  /** ISO timestamp, or null when unlocked before dates were recorded. */
  unlockedAt: string | null;
}

/** The standard easter-egg award. Mirrors XP_VALUES['easter-egg']. */
const EGG_XP = 200;

/**
 * Every achievement, fully described but universally locked.
 *
 * Built once at module scope so the server renders a complete, correct wall
 * during prerender. Only game-relevant eggs are listed: tool-specific legacy
 * records stay in the save registry but do not appear here, even if found.
 */
export function buildAchievements(): CodexAchievement[] {
  return PUBLIC_CODEX_EGGS.map(egg => {
    const tier = tierForEgg(egg.id, egg.rarity);
    return {
      id: egg.id,
      name: egg.name,
      description: egg.description,
      hint: hintFor(egg.id),
      icon: egg.icon,
      tier,
      rarity: rarityOf(tier),
      xp: egg.xp ?? EGG_XP,
      unlocked: false,
      unlockedAt: null,
    };
  });
}

export { isPublicCodexEgg };

/** Sort modes for the wall. */
export type CodexSort = 'rarity' | 'recent' | 'alpha';
export type CodexStatus = 'all' | 'locked' | 'unlocked';

export const SORT_LABELS: Record<CodexSort, string> = {
  rarity: 'Rarity',
  recent: 'Recently found',
  alpha: 'Alphabetical',
};
