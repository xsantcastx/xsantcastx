/**
 * codex.model.ts — how the Codex slices the world.
 *
 * The Achievement Wall groups by *codex category*, which is the five realms plus
 * two cross-cuts: the Arena (eggs that unlock a gate) and Global (eggs with no
 * tool behind them). Those two take precedence over the realm an egg would
 * otherwise land in, because "this one opens a gate" is the more interesting
 * fact about an egg than "this one lives in Luminous" — and because a category
 * list that overlaps is a filter that lies about its counts.
 *
 * Pure data and pure functions. No browser APIs: the wall is server-rendered in
 * its fully-locked state and hydration only flips what has actually been found.
 */
import { EasterEgg, PUBLIC_CODEX_EGGS, isPublicCodexEgg } from '../shared/easter-eggs/easter-egg.service';
import { EclipseRarity, RarityDefinition, rarityOf, tierForEgg } from '../shared/rarity/rarity.model';
import { RealmId } from '../shared/realms/realm.model';
import { hintFor } from './codex-hints';

export type CodexCategoryId = RealmId | 'arena' | 'global';

export interface CodexCategory {
  id: CodexCategoryId;
  /** Name as it appears on a filter chip and a section header. */
  label: string;
  /**
   * Path to the category's mark. The five realms carry their painted sigil;
   * Arena and Global have no art on the sheet and keep their glyph, so this is
   * read as an image path only when `art` is true.
   */
  icon: string;
  /** True when `icon` is an image path rather than a glyph. */
  art?: boolean;
  color: string;
  glow: string;
  /** One line under the section header. */
  blurb: string;
}

export const CODEX_CATEGORIES: CodexCategory[] = [
  {
    id: 'luminous',
    label: 'Luminous Realm',
    icon: 'assets/icons/realms/luminous.webp',
    art: true,
    color: '#E8D44D',
    glow: 'rgba(232, 212, 77, 0.6)',
    blurb: 'Secrets buried in light — colour, type, shadow and the making of surfaces.',
  },
  {
    id: 'umbral',
    label: 'Umbral Realm',
    icon: 'assets/icons/realms/umbral.webp',
    art: true,
    color: '#8B2252',
    glow: 'rgba(139, 34, 82, 0.7)',
    blurb: 'What the Nocturne left in the keys, the hashes and the certificates.',
  },
  {
    id: 'verge',
    label: 'The Verge',
    icon: 'assets/icons/realms/celestial.webp',
    art: true,
    color: '#00d4ff',
    glow: 'rgba(0, 212, 255, 0.6)',
    blurb: 'The unstable border, where one form is translated into another.',
  },
  {
    id: 'archivum',
    label: 'The Archivum',
    icon: 'assets/icons/realms/verdant.webp',
    art: true,
    color: '#c89868',
    glow: 'rgba(200, 152, 104, 0.6)',
    blurb: 'Everything the archive counted, timed, listed or filed away.',
  },
  {
    id: 'nexus',
    label: 'The Nexus',
    icon: 'assets/icons/realms/infernal.webp',
    art: true,
    color: '#10B981',
    glow: 'rgba(16, 185, 129, 0.6)',
    blurb: 'Threads between worlds. Every message, and whether it arrived.',
  },
  {
    id: 'arena',
    label: 'Arena',
    icon: '🏟️',
    color: '#ff6dd7',
    glow: 'rgba(255, 109, 215, 0.6)',
    blurb: 'Eight secrets that are also keys. Each one unchains a gate in the Arena.',
  },
  {
    id: 'global',
    label: 'Global',
    icon: '🌐',
    color: '#A78BFA',
    glow: 'rgba(139, 92, 246, 0.6)',
    blurb: 'Site-wide: streaks, exploration, and the things you did to the realm itself.',
  },
];

export const CODEX_CATEGORY_ORDER: CodexCategoryId[] = CODEX_CATEGORIES.map(c => c.id);

/**
 * Eggs that chain an Arena gate, keyed egg id → gate name. Empty since the
 * seven tool-era "flavour gates" (Shadow Puzzle, Regex Race, …) went with the
 * tool eggs that opened them; the five playable gates unlock from
 * `ARENA_PLAYABLE` and are not Codex achievements.
 */
export const ARENA_GATE_EGGS: Record<string, string> = {};

export function categoryForEgg(egg: EasterEgg): CodexCategoryId {
  return ARENA_GATE_EGGS[egg.id] ? 'arena' : 'global';
}

export function categoryById(id: CodexCategoryId): CodexCategory {
  return CODEX_CATEGORIES.find(c => c.id === id) ?? CODEX_CATEGORIES[CODEX_CATEGORIES.length - 1];
}

/** One card on the Achievement Wall. Locked state is filled in at runtime. */
export interface CodexAchievement {
  id: string;
  name: string;
  description: string;
  hint: string;
  icon: string;
  tier: EclipseRarity;
  rarity: RarityDefinition;
  category: CodexCategory;
  /** Registry title of the tool this lives in, or null for global eggs. */
  toolTitle: string | null;
  /** Route to that tool, so an unlocked card can link back to where it happened. */
  toolRoute: string | null;
  /** Arena gate this egg unchains, when it is one of the eight. */
  gate: string | null;
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
      category: categoryById(categoryForEgg(egg)),
      toolTitle: null,
      toolRoute: null,
      gate: ARENA_GATE_EGGS[egg.id] ?? null,
      xp: egg.xp ?? EGG_XP,
      unlocked: false,
      unlockedAt: null,
    };
  });
}

export { isPublicCodexEgg };

/** Sort modes for the wall. */
export type CodexSort = 'rarity' | 'recent' | 'alpha' | 'category';
export type CodexStatus = 'all' | 'locked' | 'unlocked';

export const SORT_LABELS: Record<CodexSort, string> = {
  rarity: 'Rarity',
  recent: 'Recently found',
  alpha: 'Alphabetical',
  category: 'Category',
};

/**
 * Arena gate ids present here but absent from the Arena's own seed list, or vice
 * versa. Unused by the app — the unit test reads it so a renamed gate egg fails
 * the build instead of silently splitting the Arena category in two.
 */
export function arenaGateDrift(arenaEggIds: readonly string[]): { missing: string[]; extra: string[] } {
  const mine = new Set(Object.keys(ARENA_GATE_EGGS));
  const theirs = new Set(arenaEggIds);
  return {
    missing: [...theirs].filter(id => !mine.has(id)),
    extra: [...mine].filter(id => !theirs.has(id)),
  };
}
