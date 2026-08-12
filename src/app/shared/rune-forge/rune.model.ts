/**
 * rune.model.ts — the twenty-five runes and the six words they spell.
 *
 * The shape is Diablo 2's rune ladder: a long tail of things you will hold
 * hundreds of, a short head of things most players will never see, and a set of
 * recipes that only pay out if you spend the head. None of the names are
 * Diablo's. They are Eclipse Realms names, and each one is a piece of the same
 * story the codex tells — the First Sun, the Shattering, and the five realms
 * that were left standing in the pieces.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A NOTE ON THE DROP TABLE
 * ─────────────────────────────────────────────────────────────────────────────
 * `dropRate` is the chance of *that individual rune*, not of its tier. The tier
 * budgets are 60 / 25 / 10 / 3.5 / 1 / 0.3 / 0.05 percent, and each tier splits
 * its budget evenly across its members — so Void, alone in Singular, carries the
 * whole 0.0005, while each of the five Common runes carries 0.12.
 *
 * Those budgets sum to 0.9985, not 1. That is deliberate and it is why
 * `rollRune()` normalises against the measured total rather than assuming a
 * unit interval: a table that has to sum to exactly 1 is a table nobody can
 * edit without a calculator, and the 0.15% rounding error would otherwise have
 * to be swept into Common, quietly making the published "60%" false.
 *
 * `forgeCost` is what the rune is *worth*, not what a strike costs. A strike is
 * a single flat price (`STRIKE_COST`) and pays out one rune from this table —
 * you cannot buy a tier. The worth drives the collection-value stat, the XP a
 * find pays, and the line under a rune in the inventory.
 *
 * Pure data. No browser APIs — safe to import from an SSR path.
 */

export type RuneTier =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'mythic'
  | 'singular';

export interface Rune {
  id: string;
  name: string;
  tier: RuneTier;
  /** Chance of this exact rune on one strike. Void is 0.0005. */
  dropRate: number;
  /** What the rune is worth in Gold. See the note above — this is not a price. */
  forgeCost: number;
  /** One line from the codex. */
  lore: string;
  /** Rarity colour, taken from `RUNE_TIERS` so a rune cannot drift off-tier. */
  color: string;
  /** Reserved for the painted rune sheet. Text glyph until that ships. */
  icon?: string;
}

export interface RuneTierDefinition {
  id: RuneTier;
  /** Shown on the tier badge. */
  label: string;
  /** Share of one strike this whole tier is worth. */
  budget: number;
  /** Gold worth of every rune in the tier. */
  worth: number;
  color: string;
  /** Alpha'd for box-shadow use. */
  glow: string;
  /**
   * How loud the reveal gets. Each step up earns a channel the step below did
   * not have — colour, then sound, then the viewport itself.
   */
  reveal: 'plain' | 'glow' | 'burst' | 'shimmer' | 'edge' | 'flash' | 'void';
  /** Which `RarityAudioService` cue fires on the find. */
  sound: 'blip' | 'chime' | 'horn' | 'impact' | 'prism' | 'none';
  /** Semitones the anvil strike is pitched up by. Rarer rings higher. */
  semitones: number;
  /** Milliseconds the reveal holds the screen. */
  duration: number;
  /** XP a find in this tier pays. */
  xp: number;
}

/**
 * The ladder. Colours are the ones already on the wall: Eclipsed blue, Sacred
 * violet, Anomalous gold and Mythic red are lifted verbatim from
 * `rarity.model.ts` so a Rare rune and a Sacred achievement are the same purple
 * — two ladders that disagree about what purple means is two ladders nobody can
 * read at a glance. Singular is the one new value, and it is deliberately not
 * black: the Void is what the realms were carved *out of*, and a colour that
 * vanishes into the page cannot carry that.
 */
export const RUNE_TIERS: Record<RuneTier, RuneTierDefinition> = {
  common: {
    id: 'common', label: 'Common', budget: 0.60, worth: 10,
    color: '#8f98a8', glow: 'rgba(143, 152, 168, 0.45)',
    reveal: 'plain', sound: 'blip', semitones: 0, duration: 1600, xp: 2,
  },
  uncommon: {
    id: 'uncommon', label: 'Uncommon', budget: 0.25, worth: 50,
    color: '#5fb6ff', glow: 'rgba(80, 180, 255, 0.55)',
    reveal: 'glow', sound: 'blip', semitones: 2, duration: 2000, xp: 8,
  },
  rare: {
    id: 'rare', label: 'Rare', budget: 0.10, worth: 200,
    color: '#a48bff', glow: 'rgba(140, 110, 255, 0.7)',
    reveal: 'burst', sound: 'chime', semitones: 4, duration: 2600, xp: 30,
  },
  epic: {
    id: 'epic', label: 'Epic', budget: 0.035, worth: 500,
    color: '#C9A84C', glow: 'rgba(255, 190, 90, 0.75)',
    reveal: 'shimmer', sound: 'horn', semitones: 5, duration: 3200, xp: 90,
  },
  legendary: {
    id: 'legendary', label: 'Legendary', budget: 0.01, worth: 2_000,
    color: '#ff9a5a', glow: 'rgba(255, 154, 90, 0.8)',
    reveal: 'edge', sound: 'horn', semitones: 7, duration: 4200, xp: 300,
  },
  mythic: {
    id: 'mythic', label: 'Mythic', budget: 0.003, worth: 5_000,
    color: '#ff2d4d', glow: 'rgba(255, 45, 77, 0.85)',
    reveal: 'flash', sound: 'impact', semitones: 10, duration: 5600, xp: 1_200,
  },
  singular: {
    id: 'singular', label: 'Singular', budget: 0.0005, worth: 10_000,
    color: '#e6dcff', glow: 'rgba(230, 220, 255, 0.95)',
    reveal: 'void', sound: 'prism', semitones: 12, duration: 9000, xp: 5_000,
  },
};

export const RUNE_TIER_ORDER: RuneTier[] = [
  'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'singular',
];

/** What one strike costs. The Common tier's worth — the entry price of the table. */
export const STRIKE_COST = 10;

/**
 * The runes, in ladder order. `dropRate`, `forgeCost` and `color` are derived
 * from the tier below rather than written per-rune: three fields that must agree
 * with the tier table are three chances to typo a drop rate into something
 * nobody notices until a Mythic starts falling every other strike.
 */
interface RuneSeed {
  id: string;
  name: string;
  tier: RuneTier;
  lore: string;
}

const RUNE_SEEDS: RuneSeed[] = [
  // ── Common ── what the floor of the world is made of.
  { id: 'ash', name: 'Ash', tier: 'common',
    lore: 'What the First Sun left on the floor. There is more of this than of anything else.' },
  { id: 'ember', name: 'Ember', tier: 'common',
    lore: 'Still warm. It has been still warm for four thousand years.' },
  { id: 'drift', name: 'Drift', tier: 'common',
    lore: 'Picked up by someone walking and set down somewhere else. That is the whole of its history.' },
  { id: 'shade', name: 'Shade', tier: 'common',
    lore: 'The Umbral keep these the way other realms keep coins, and spend them about as carefully.' },
  { id: 'mote', name: 'Mote', tier: 'common',
    lore: 'Too small to have been broken. It simply is this size, and was, before there was anything to break.' },

  // ── Uncommon ── the realms, each leaving one mark.
  { id: 'glint', name: 'Glint', tier: 'uncommon',
    lore: 'A Luminous vault, seen for exactly as long as it takes a door to close.' },
  { id: 'veil', name: 'Veil', tier: 'uncommon',
    lore: 'The Nocturne speak through these. Nobody has established what they are saying.' },
  { id: 'pulse', name: 'Pulse', tier: 'uncommon',
    lore: 'The Verge has a heartbeat. This is one beat of it, kept.' },
  { id: 'thorn', name: 'Thorn', tier: 'uncommon',
    lore: 'From the last growing thing. It defended something, and it lost.' },
  { id: 'scorch', name: 'Scorch', tier: 'uncommon',
    lore: 'The mark fire leaves when it is in a hurry and does not intend to come back.' },
  { id: 'seam', name: 'Seam', tier: 'uncommon',
    lore: 'Where two realms were sewn back together badly. The stitch outlived the wound.' },

  // ── Rare ── things that were made on purpose.
  { id: 'nexus', name: 'Nexus', tier: 'rare',
    lore: 'Every thread ever tied passes through a knot like this one. Pull it and find out which.' },
  { id: 'sigil', name: 'Sigil', tier: 'rare',
    lore: 'A maker signed her work here. The work is gone. The signature is not.' },
  { id: 'rift', name: 'Rift', tier: 'rare',
    lore: 'A hole, held open and carried. Do not set it down on anything you intend to keep.' },
  { id: 'hollow', name: 'Hollow', tier: 'rare',
    lore: 'What is left in the shape of a thing after the thing has been taken out of it.' },
  { id: 'ledger', name: 'Ledger', tier: 'rare',
    lore: 'The Archivum wrote down what was lost. This is the page with the total on it.' },

  // ── Epic ── the Shattering itself, in three pieces.
  { id: 'fracture', name: 'Fracture', tier: 'epic',
    lore: 'The exact line the Shattering ran along. Read it and you know where you were standing.' },
  { id: 'eclipse', name: 'Eclipse', tier: 'epic',
    lore: 'The moment the light went, held at the moment it went, indefinitely.' },
  { id: 'forge', name: 'Forge', tier: 'epic',
    lore: 'The heat that made the realms, cooled to something a hand can close around.' },

  // ── Legendary ── the two energies, and the book that named them.
  { id: 'aether', name: 'Aether', tier: 'legendary',
    lore: 'Light, crystallised. It weighs nothing at all and it will not be put down.' },
  { id: 'nox', name: 'Nox', tier: 'legendary',
    lore: 'Shadow, crystallised. It weighs a great deal and it will not be picked up.' },
  { id: 'codex', name: 'Codex', tier: 'legendary',
    lore: 'One page of a book the Archivum voted to forget. The vote was not unanimous.' },

  // ── Mythic ── the two halves of the thing that broke.
  { id: 'convergence', name: 'Convergence', tier: 'mythic',
    lore: 'Both realms, fused at the seam, and still arguing about which of them is on top.' },
  { id: 'godstone', name: 'Godstone', tier: 'mythic',
    lore: 'A fragment of the First Sun. Not a memory of it, not a likeness. A piece.' },

  // ── Singular ── one rune, and it is not a piece of anything.
  { id: 'void', name: 'Void', tier: 'singular',
    lore: 'Not the absence of the realms. The thing they were carved out of.' },
];

/** How many runes each tier holds. Splits the tier budget. */
const TIER_COUNTS = RUNE_SEEDS.reduce<Record<string, number>>((acc, seed) => {
  acc[seed.tier] = (acc[seed.tier] ?? 0) + 1;
  return acc;
}, {});

export const RUNES: Rune[] = RUNE_SEEDS.map(seed => {
  const tier = RUNE_TIERS[seed.tier];
  return {
    id: seed.id,
    name: seed.name,
    tier: seed.tier,
    lore: seed.lore,
    dropRate: tier.budget / TIER_COUNTS[seed.tier],
    forgeCost: tier.worth,
    color: tier.color,
  };
});

const RUNE_BY_ID = new Map(RUNES.map(r => [r.id, r]));

export function runeById(id: string): Rune | undefined {
  return RUNE_BY_ID.get(id);
}

export function tierOf(tier: RuneTier): RuneTierDefinition {
  return RUNE_TIERS[tier] ?? RUNE_TIERS.common;
}

/**
 * The measured total of the drop table — 0.9985 with the published budgets.
 *
 * Computed rather than hardcoded so that adding a rune, retiring one, or
 * retuning a budget cannot silently skew every rate below it in the table.
 */
export const DROP_TABLE_TOTAL = RUNES.reduce((sum, r) => sum + r.dropRate, 0);

/**
 * One strike, resolved.
 *
 * `random` is injected so the table can be tested against a known sequence
 * instead of a coin-flip — a 0.05% branch is not something you can reach by
 * calling this a few thousand times in a spec and hoping.
 *
 * The walk is over `RUNES` in ladder order, which puts the four-nines-improbable
 * entries at the end where the accumulator has to survive the whole table to
 * reach them. That is the correct order for readability and it is also the
 * correct order numerically: summing the large weights first keeps the running
 * total's exponent stable, so the 0.0005 at the tail is not swallowed by
 * floating-point drift the way it would be if it were added to a near-1 total
 * from the other direction.
 */
export function rollRune(random: () => number = Math.random): Rune {
  let roll = random() * DROP_TABLE_TOTAL;
  for (const rune of RUNES) {
    roll -= rune.dropRate;
    if (roll <= 0) return rune;
  }
  // Unreachable while DROP_TABLE_TOTAL is the true sum, but a drop table that
  // returns undefined on a rounding edge is a crash in the one place the player
  // is paying attention. The floor of the ladder is the safe answer.
  return RUNES[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Runewords
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What a completed word actually pays.
 *
 * Every field is additive and every field is a *bonus*, not a multiplier: a
 * word worth "+25% Gold" contributes 0.25 here, and the wiring layer sums the
 * bonuses of every crafted word before turning the total into the ×1.25 the
 * economy multiplies by. Storing multipliers instead would mean two words worth
 * +100% each compose to ×4 rather than ×3, which is not what "+100%" means in
 * any of the copy on the page.
 */
export interface RunewordBonus {
  /** Added to the Gold rate multiplier — idle, automatons and strikes alike. */
  income?: number;
  /** Added to the multiplier on Gold paid out by quest completions. */
  questGold?: number;
  /** Added to the XP multiplier. */
  xp?: number;
  /** Earn every realm's currency at once rather than only the active realm's. */
  allRealms?: boolean;
}

export interface Runeword {
  id: string;
  name: string;
  /** Rune ids in the order they are set into the word. Order is displayed, and consumed. */
  runes: string[];
  /** One line describing what it pays, in the player's terms. */
  effect: string;
  lore: string;
  /** The rarest rune the recipe demands. Drives the panel's difficulty badge. */
  tier: RuneTier;
  bonus: RunewordBonus;
}

/**
 * The six words.
 *
 * Note that Convergence appears in two recipes and is consumed by both, so a
 * player who wants Godforge Mastery *and* Breath of the Void needs two Mythic
 * drops of the same rune at 0.15% each. That is the intended shape of the
 * endgame: the last word is not gated on skill or on time so much as on being
 * the kind of person who is still striking the anvil after the fifth thousand.
 */
export const RUNEWORDS: Runeword[] = [
  {
    id: 'first-light',
    name: 'First Light',
    runes: ['ash', 'ember', 'glint'],
    effect: '+25% to all Gold income',
    lore: 'The first thing anyone made after the Shattering was a smaller sun. It did not work. It is still burning.',
    tier: 'uncommon',
    bonus: { income: 0.25 },
  },
  {
    id: 'shadow-step',
    name: 'Shadow Step',
    runes: ['shade', 'veil', 'pulse'],
    effect: '+50% Gold from quest rewards',
    lore: 'The Nocturne do not walk between the realms. They walk where the realms are not, and arrive first.',
    tier: 'uncommon',
    bonus: { questGold: 0.5 },
  },
  {
    id: 'realm-bridge',
    name: 'Realm Bridge',
    runes: ['nexus', 'rift', 'sigil'],
    effect: 'Earn every realm’s currency at once',
    lore: 'Built by someone who refused to choose a side, and was therefore trusted by none of them and used by all.',
    tier: 'rare',
    bonus: { allRealms: true, income: 0.1 },
  },
  {
    id: 'convergents-will',
    name: 'The Convergent’s Will',
    runes: ['aether', 'nox', 'eclipse'],
    effect: '×2 XP, permanently',
    lore: 'Light in one hand and shadow in the other, and the will to keep holding both. Most Convergents drop one.',
    tier: 'legendary',
    bonus: { xp: 1 },
  },
  {
    id: 'godforge-mastery',
    name: 'Godforge Mastery',
    runes: ['godstone', 'convergence', 'forge', 'fracture'],
    effect: '+100% to Gold, quest rewards and XP',
    lore: 'The Godforge was never sealed. It was simply set down, and nobody since has been able to lift it.',
    tier: 'mythic',
    bonus: { income: 1, questGold: 1, xp: 1 },
  },
  {
    id: 'breath-of-the-void',
    name: 'Breath of the Void',
    runes: ['convergence', 'hollow', 'ash', 'ember', 'void', 'scorch'],
    effect: '×3 to all income, forever',
    lore: 'Six runes, and one of them does not exist. The Archivum lists the recipe anyway, under a heading that translates roughly as: in case.',
    tier: 'singular',
    bonus: { income: 2, questGold: 2 },
  },
];

const RUNEWORD_BY_ID = new Map(RUNEWORDS.map(w => [w.id, w]));

export function runewordById(id: string): Runeword | undefined {
  return RUNEWORD_BY_ID.get(id);
}

/** How many of each rune a word consumes, since a recipe may repeat one. */
export function runeCostOf(word: Runeword): Map<string, number> {
  const cost = new Map<string, number>();
  for (const id of word.runes) cost.set(id, (cost.get(id) ?? 0) + 1);
  return cost;
}

/**
 * Sum every crafted word into one bonus.
 *
 * Bonuses add and the sum is turned into a multiplier once, at the end: three
 * words worth +25%, +100% and +200% pay ×4.25, not ×1.25 × ×2 × ×3.
 */
export function totalBonus(craftedIds: readonly string[]): Required<RunewordBonus> {
  const total: Required<RunewordBonus> = {
    income: 0, questGold: 0, xp: 0, allRealms: false,
  };
  for (const id of craftedIds) {
    const word = RUNEWORD_BY_ID.get(id);
    if (!word) continue;
    total.income += word.bonus.income ?? 0;
    total.questGold += word.bonus.questGold ?? 0;
    total.xp += word.bonus.xp ?? 0;
    total.allRealms = total.allRealms || !!word.bonus.allRealms;
  }
  return total;
}
