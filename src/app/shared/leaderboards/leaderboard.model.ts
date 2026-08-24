/**
 * leaderboard.model.ts — seven boards, one name pool, no server.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THESE BOARDS ARE, SAID PLAINLY
 * ─────────────────────────────────────────────────────────────────────────────
 * The other ninety-six names on every board are generated, not collected. There
 * is no cross-player table behind this: the game's save is per-account and the
 * only cross-account surface the world has is cloud save, which is a private
 * document per uid. Publishing a real board would mean a new public collection
 * with every signed-in player's XP and Gold in it, which is a privacy decision
 * and a Firestore bill, not a UI feature.
 *
 * So the boards are a *ladder*, and the page says so in as many words. Their
 * job is to put a number next to the grind — "you are 41st, the next name is
 * 12,000 XP away" — which is the thing a solo idle game cannot otherwise give
 * you. Pretending otherwise would be the dishonest version, and it is not what
 * is rendered.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE LADDER IS ABSOLUTE AND NOT ANCHORED TO THE PLAYER
 * ─────────────────────────────────────────────────────────────────────────────
 * The obvious build scales every rival off the player's own number, so a fresh
 * account lands mid-table and feels seen. It also means the summit moves every
 * time the player earns anything, the top name is permanently ahead, and #1 is
 * unreachable by construction — which is exactly the failure the brief names
 * when it asks that the player be able to reach #1 with grinding.
 *
 * So each board is pinned to an authored `summit` — a real number a real save
 * can reach — and every rival is `summit × weight^curve`. The curve is steep,
 * which is what makes the low ranks bunch up near the bottom: a first-session
 * player at 400 XP is not 97th of 97, they are somewhere in the low eighties
 * and pass four names in an evening. That is the "scales around the player"
 * feeling, produced by the shape of the ladder rather than by moving it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY EVERYTHING HERE IS DETERMINISTIC
 * ─────────────────────────────────────────────────────────────────────────────
 * No `Math.random`, no `Date.now`, no daily drift. Two reasons, and the second
 * is the load-bearing one:
 *
 *   · A rival who was 12th yesterday and 40th today, having done nothing, makes
 *     the board obviously fake in the first five seconds.
 *   · The page prerenders, and the prerendered HTML is what a crawler indexes
 *     and what a visitor on a slow connection reads first. A board built from a
 *     clock bakes one field into the build and paints a different one when the
 *     bundle boots — the whole ladder visibly reshuffles under the reader, and
 *     the indexed copy is wrong from the day it ships. Pinned weights mean the
 *     prerendered page and the booted page name the same eighty rivals in the
 *     same order, and the only row that moves is the player's own.
 *
 * Pure data and pure functions. No Angular, no browser APIs.
 */

export type LeaderboardId =
  | 'xp'
  | 'gold'
  | 'collection'
  | 'arena'
  | 'quality'
  | 'expeditions'
  | 'crafting';

export type LeaderboardFormat = 'integer' | 'percent' | 'compact';

export interface LeaderboardCategory {
  id: LeaderboardId;
  name: string;
  /** One line under the tab, explaining what is being measured. */
  blurb: string;
  /** What a score is called in the column head. */
  unit: string;
  format: LeaderboardFormat;
  /** The top rival's score. A number a real save can pass. */
  summit: number;
  /**
   * Steepness. Higher bunches the field toward the bottom, which is where a new
   * player stands — see the note above on why that is the point.
   */
  curve: number;
  /**
   * Where the *worst* rival stands. Defaults to 0.
   *
   * The steep curve is right for a board measured in XP or Gold, where the
   * bottom of the field genuinely is a rounding error next to the top. It is
   * wrong for a board measured as a percentage: `summit × weight^curve` puts
   * the eightieth name on the Archivum at 0.02% complete, which rounds to
   * "0.0%" and renders a rival who has apparently never opened the game. A
   * floor lifts the tail without touching the summit, so #1 stays exactly as
   * reachable as it was.
   */
  floor?: number;
  /** Palette colour, from the cosmic table in CLAUDE.md §2. */
  color: string;
  glow: string;
}

export const LEADERBOARD_CATEGORIES: readonly LeaderboardCategory[] = [
  {
    id: 'xp',
    name: 'Ascent',
    blurb: 'Lifetime XP across every rank. The one board nothing but time moves.',
    unit: 'XP',
    format: 'compact',
    summit: 480_000,
    curve: 2.9,
    color: '#4dffe0',
    glow: 'rgba(0, 255, 204, 0.6)',
  },
  {
    id: 'gold',
    name: 'Hoard',
    blurb: 'Gold earned since the world began, not Gold currently held.',
    unit: 'Gold',
    format: 'compact',
    summit: 42_000_000,
    curve: 3.4,
    color: '#ffc669',
    glow: 'rgba(255, 180, 80, 0.6)',
  },
  {
    id: 'collection',
    name: 'Archivum',
    blurb: 'Share of the Collection Log filled in. The slowest board to move and the hardest to fake.',
    unit: 'Complete',
    format: 'percent',
    summit: 99,
    curve: 1.9,
    floor: 3,
    color: '#c48bff',
    glow: 'rgba(180, 120, 255, 0.6)',
  },
  {
    id: 'arena',
    name: 'Coliseum',
    blurb: 'Bouts won in the Ring. Losses are not counted against you here.',
    unit: 'Wins',
    format: 'integer',
    summit: 240,
    curve: 2.6,
    color: '#ff6dd7',
    glow: 'rgba(255, 90, 210, 0.6)',
  },
  {
    id: 'quality',
    name: 'Craftsmanship',
    blurb: 'The best roll grade in your bag. One perfect piece is worth a thousand ordinary ones.',
    unit: 'Best roll',
    format: 'percent',
    summit: 99,
    curve: 1.5,
    floor: 11,
    color: '#a48bff',
    glow: 'rgba(140, 110, 255, 0.6)',
  },
  {
    id: 'expeditions',
    name: 'Wayfaring',
    blurb: 'Expeditions returned from the five realms. Sent is not the same as returned.',
    unit: 'Returned',
    format: 'integer',
    summit: 1_150,
    curve: 2.7,
    color: '#7fd5a3',
    glow: 'rgba(100, 220, 150, 0.6)',
  },
  {
    id: 'crafting',
    name: 'The Bench',
    blurb: 'Crafting XP earned at the anvil. Every strike counts, mastered or not.',
    unit: 'Craft XP',
    format: 'compact',
    summit: 96_000,
    curve: 3.0,
    color: '#6affe0',
    glow: 'rgba(0, 220, 220, 0.6)',
  },
];

const CATEGORY_BY_ID = new Map(LEADERBOARD_CATEGORIES.map(c => [c.id, c]));

export function leaderboardCategory(id: LeaderboardId): LeaderboardCategory | undefined {
  return CATEGORY_BY_ID.get(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// The name pool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ninety-six names, authored in the world's voice.
 *
 * Authored rather than assembled from a first-name × epithet grid: a generated
 * pool produces "Vale Ironsong" and "Ironsong Vale" three rows apart and the
 * seam is visible immediately. Every board draws from this same pool, and the
 * per-board seed decides which sixteen sit out and where the rest land — so a
 * name near the top of the Hoard is somewhere else entirely on the Ascent,
 * which is how real ladders read.
 */
export const RIVAL_NAMES: readonly string[] = [
  'Aurel Vane', 'Bastion Krey', 'Cinderhold', 'Delve Ashwright', 'Ember Solveig',
  'Fenn of the Rootglass', 'Grail Ossivand', 'Hollow Tamsin', 'Ironwake', 'Jessamy Cold',
  'Kell Ninefold', 'Lantern Aro', 'Mourn Halvard', 'Nix Ravensbane', 'Orrin Slate',
  'Pale Corvid', 'Quill Ashgrave', 'Rook Ellander', 'Sable Winterbourne', 'Thane Ilvric',
  'Umbra Solenne', 'Vesper Aldwin', 'Wrenn Marrowsong', 'Xander Corvain', 'Yarrow Ost',
  'Zephyr Malkin', 'Ashen Idris', 'Brann Duskwalker', 'Cael Sunderlight', 'Doryn Vast',
  'Elowen Threnody', 'Faro Blackglass', 'Gethin Ward', 'Hesper Lune', 'Isolde Fenmark',
  'Jorvik Ashen', 'Kaspar Illume', 'Lorne Veyra', 'Maud Ironsong', 'Nessa Halloway',
  'Oriel Duskbane', 'Perrin Cask', 'Quarrel Vane', 'Ravel Ostmark', 'Sorrel Ashken',
  'Tamsin Gravewright', 'Ulric Fell', 'Vann Sorrowmere', 'Wex Harrowgate', 'Ysolde Kir',
  'Zorran Ilk', 'Adair Nocturne', 'Belisande', 'Corvus Ninefinger', 'Drusilla Ash',
  'Eamon Riftward', 'Fable Stormcaught', 'Gwenna Ilm', 'Harrow of the Seam', 'Ines Cadwell',
  'Jute Ashfall', 'Kestrel Vaine', 'Lark Underhollow', 'Merrow Sindt', 'Nocturne Ilvane',
  'Ossian Grey', 'Pellam Rook', 'Quinn Solvane', 'Rue Marchand', 'Silas Emberwright',
  'Torvald Ash', 'Ulla Nightgale', 'Vidar Kellsworth', 'Wynn Solaire', 'Xiu Halberd',
  'Yorick Vale', 'Zinnia Ravel', 'Alder Mournwood', 'Bel Ostrava', 'Caius Ashvold',
  'Deryn Wick', 'Esme Farrowgate', 'Fitch Alloway', 'Gilda Rune', 'Hark Sevenholm',
  'Ilsa Vantage', 'Jory Blackfen', 'Kade Illarion', 'Lysandra Vosk', 'Morrow Ilbane',
  'Nell Ashquiet', 'Oberon Skye', 'Pryce Tallowmoor', 'Rhoda Sundermark', 'Sable Ilkwright',
  'Tobin Nightreach',
];

// ─────────────────────────────────────────────────────────────────────────────
// The deterministic generator
// ─────────────────────────────────────────────────────────────────────────────

/** FNV-1a. Cheap, stable across engines, and good enough to seed with. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32. Deterministic, seeded, and short enough to read. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** How many rivals stand on each board. */
export const RIVAL_COUNT = 80;

export interface LeaderboardRow {
  rank: number;
  name: string;
  score: number;
  /** True for the one row that is the visitor. */
  isPlayer: boolean;
  /** The rival's title, or the player's arena rank. Blank when there is none. */
  title: string;
}

const RIVAL_TITLES: readonly string[] = [
  '', '', '', '', 'Sandfoot', 'Ropebreaker', 'Named Challenger', 'Seam-Walker',
  'Ring Sovereign', 'Keeper', 'Archivist', 'Wayfarer',
];

/**
 * The eighty rivals on one board, sorted best first.
 *
 * Weights come off a seeded stream keyed on the category id, so the same board
 * is the same board on every device, in every tab, on the server and in the
 * browser. Scores are `summit × weight^curve`, floored at 1 for the integer
 * boards so nothing renders a rival with a score of zero.
 */
export function rivalsFor(category: LeaderboardCategory): LeaderboardRow[] {
  const rng = seeded(hash(`rivals:${category.id}`));
  const pool = [...RIVAL_NAMES];

  // Fisher-Yates off the same stream: which names appear, and in what order,
  // is decided before any score is drawn so a name's rank is not a function of
  // its position in the source list.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const rows = pool.slice(0, RIVAL_COUNT).map((name, index) => {
    // A weight per rival, jittered so the ladder is not a smooth curve. The
    // jitter is bounded so the ordering stays close to the index — a board
    // whose 3rd row outscores its 1st would just be a shuffled list.
    const base = 1 - index / RIVAL_COUNT;
    const jitter = (rng() - 0.5) * (0.9 / RIVAL_COUNT);
    const weight = Math.min(1, Math.max(0.004, base + jitter));
    const floor = category.floor ?? 0;
    const raw = floor + (category.summit - floor) * Math.pow(weight, category.curve);
    const score = category.format === 'percent'
      ? Math.min(category.summit, Math.round(raw * 10) / 10)
      : Math.max(1, Math.round(raw));
    return {
      rank: 0,
      name,
      score,
      isPlayer: false,
      title: RIVAL_TITLES[Math.floor(rng() * RIVAL_TITLES.length)] ?? '',
    };
  });

  rows.sort((a, b) => b.score - a.score);
  return rows;
}

export interface BoardView {
  category: LeaderboardCategory;
  rows: LeaderboardRow[];
  /** The player's row, always present. Same object as the one in `rows`. */
  player: LeaderboardRow;
  /** How far ahead the next name up is, or null at #1. */
  toNext: number | null;
  /** The name directly above, or null at #1. */
  nextName: string | null;
}

/**
 * One board with the player slotted into it.
 *
 * The row count is always `RIVAL_COUNT + 1` whatever the player's score is:
 * the server renders eighty-one rows with the player last on a zero score, and
 * the browser renders eighty-one rows with the player wherever they actually
 * stand. Same shape, so the table does not resize under the reader when the
 * real numbers land — only the gold row moves.
 *
 * Ties go to the player. Passing someone should happen the moment you match
 * them, not one point later, and there is no second player whose feelings the
 * tie-break could hurt.
 */
export function buildBoard(
  category: LeaderboardCategory,
  playerScore: number,
  playerName: string,
  playerTitle: string,
): BoardView {
  const score = Number.isFinite(playerScore) && playerScore > 0
    ? (category.format === 'percent' ? Math.round(playerScore * 10) / 10 : Math.round(playerScore))
    : 0;

  const player: LeaderboardRow = {
    rank: 0,
    name: playerName,
    score,
    isPlayer: true,
    title: playerTitle,
  };

  const rows = [...rivalsFor(category), player];
  rows.sort((a, b) => (b.score - a.score) || (a.isPlayer ? -1 : b.isPlayer ? 1 : 0));
  rows.forEach((row, index) => { row.rank = index + 1; });

  const index = rows.indexOf(player);
  const above = index > 0 ? rows[index - 1] : null;

  return {
    category,
    rows,
    player,
    toNext: above ? Math.max(0, above.score - player.score) : null,
    nextName: above ? above.name : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────

/** 1_240_000 → "1.24M". Matches how the currency rail already writes Gold. */
export function compact(value: number): string {
  const n = Math.max(0, value);
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString('en-US');
}

export function formatScore(category: LeaderboardCategory, value: number): string {
  switch (category.format) {
    case 'percent': return `${(Math.round(value * 10) / 10).toFixed(1)}%`;
    case 'compact': return compact(value);
    default: return Math.round(value).toLocaleString('en-US');
  }
}

/** "#1" through "#81", with the top three called out. */
export function rankLabel(rank: number): string {
  return `#${rank}`;
}
