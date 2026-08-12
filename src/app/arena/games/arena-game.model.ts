/**
 * arena-game.model.ts — the registry of gates that are actually playable.
 *
 * The Arena has always listed gates; most of them were flavour text. This file
 * is the subset that leads somewhere: each entry carries the route the card
 * links to, the egg that unchains it, and what a win is worth.
 *
 * Pure data, no browser APIs, so `ArenaComponent` can import it and still
 * prerender.
 */

export type ScoreKind =
  /** Raw points. Rendered as-is. */
  | 'points'
  /** Pages of the Codex restored, out of ten. */
  | 'levels';

export interface ArenaPlayableGame {
  /** Matches the seed id in `ArenaComponent`, so the card can find its game. */
  id: string;
  /** Absolute route, as used by `routerLink`. */
  route: string;
  title: string;
  /** One line of lore, shown under the title on the game page. */
  lore: string;
  description: string;
  icon: string;
  /** The egg that breaks this gate's chain. */
  unlockEggId: string;
  unlockHint: string;
  /** XP paid out the first time the game is beaten. */
  xpReward: number;
  /** Which energy the reward feeds. */
  energy: 'aether' | 'nox';
  scoreKind: ScoreKind;
}

/**
 * A repeat win still pays, but only a fraction — the full reward is a
 * first-clear prize, not an income stream. Beating your own best is the only
 * way to trigger it, so the price of each repeat award is a harder run.
 */
export const REPEAT_WIN_XP = 10;

export const ARENA_PLAYABLE: ArenaPlayableGame[] = [
  {
    id: 'color-memory',
    route: '/arena/color-memory',
    title: 'Eclipse Fragments',
    lore: 'Match the Eclipse Fragments before the realms collapse.',
    description:
      'The Shattering scattered the fragments in pairs. Turn them face up two at a time and put the realm back together — fewer moves, less time, more Aether.',
    icon: '🌗',
    unlockEggId: 'color-void',
    unlockHint: 'Convert pure black #000000 in the Color Converter',
    xpReward: 50,
    energy: 'aether',
    scoreKind: 'points',
  },
  {
    id: 'realm-rush',
    route: '/arena/realm-rush',
    title: 'Realm Rush',
    lore: 'The Verge is closing — type the incantations before reality fractures.',
    description:
      'Incantations fall out of the rift: CSS properties, JS keywords, regex fragments, HTML tags. Type each one before it hits the floor. Three misses and the Verge takes you.',
    icon: '🌠',
    unlockEggId: 'speed-demon',
    unlockHint: 'Visit 5 different tools in under 60 seconds',
    xpReward: 30,
    energy: 'aether',
    scoreKind: 'points',
  },
  {
    id: 'shadow-cipher',
    route: '/arena/shadow-cipher',
    title: 'Shadow Cipher',
    lore: 'The Nocturne encrypted the Codex — restore the sacred code.',
    description:
      'Ten pages of the Codex, every line shuffled out of order. Put them back the way they were written. Hints are available, and the Nocturne charges for them.',
    icon: '🗝️',
    unlockEggId: 'b64-mirror',
    unlockHint: 'Encode "xsantcastx" in Base64 in the Base64 Encoder',
    xpReward: 100,
    energy: 'nox',
    scoreKind: 'levels',
  },
  {
    id: 'forge-strike',
    route: '/arena/forge-strike',
    title: 'Forge Strike',
    lore: 'The Godforge heats — strike true, Forgehand.',
    description:
      'Sixty seconds at the anvil. Squash every bug, ship every feature, and never touch a live error — the chain multiplier is worth more than any single strike.',
    icon: '🔨',
    unlockEggId: 'sql-drop',
    unlockHint: 'Format SQL containing DROP TABLE in the SQL Formatter',
    xpReward: 40,
    energy: 'nox',
    scoreKind: 'points',
  },
  {
    id: 'convergents-path',
    route: '/arena/convergents-path',
    title: "The Convergent's Path",
    lore: 'Walk between Light and Shadow — lose your balance, lose yourself.',
    description:
      'A maze that is never the same twice, seeded with Aether and Nox. Take both in equal measure. Lean too far either way and the realm closes over you.',
    icon: '🧭',
    unlockEggId: 'grid-matrix',
    unlockHint: 'Create a 12x12 CSS Grid in the Grid Generator',
    xpReward: 75,
    energy: 'aether',
    scoreKind: 'points',
  },
];

export function playableById(id: string): ArenaPlayableGame | undefined {
  return ARENA_PLAYABLE.find(g => g.id === id);
}

/** Score formatted for a card or a header chip. */
export function formatScore(kind: ScoreKind, score: number): string {
  switch (kind) {
    case 'levels': return `${score}/10 pages`;
    default: return `${score.toLocaleString()} pts`;
  }
}
