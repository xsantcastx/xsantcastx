/**
 * socket-words.ts — the secret combinations, and what finding one pays.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THESE ARE NOT THE RUNEWORDS THAT ALREADY EXIST
 * ─────────────────────────────────────────────────────────────────────────────
 * `rune-forge/rune.model.ts` already has a `Runeword`, and it is a different
 * object doing a different job: a recipe that *consumes* runes at the Forge and
 * mints a permanent account-wide bonus, listed openly on the Forge page. These
 * are Socket Words — a sequence of runes set into one item's wells, which pays
 * only while that item is worn, is undone by pulling a rune, and is not listed
 * anywhere until a player stumbles into it.
 *
 * They are deliberately a separate type with a separate name rather than a
 * second flavour of the first. The two share nothing but the word "rune": one
 * is spent and permanent, the other is held and conditional. Merging them would
 * mean every consumer of `Runeword` has to ask which kind it is holding.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY MATCHING IS EXACT AND ORDERED
 * ─────────────────────────────────────────────────────────────────────────────
 * A word matches when the item's wells, read left to right, are exactly the
 * word's sequence — same runes, same order, no empty wells, and the item's
 * socket count equal to the sequence length. That last clause is what stops a
 * three-socket sword from silently satisfying every two-rune word by leaving
 * one well empty, and it is what makes the socket count on an item meaningful:
 * a Legendary weapon is not merely a Rare weapon with a spare hole, it is a
 * weapon that can hold a different class of word.
 *
 * Order matters because it is free discovery surface. Two runes in two orders
 * are two things to find rather than one, and a player who has Ash and Ember
 * and has tried them one way has a reason to try them the other.
 *
 * Pure data and pure functions — no browser APIs, safe on an SSR path.
 */
import { ITEM_STAT_KEYS, type GameItem, type ItemStats } from '../rpg/item.model';
import { runeById, type RuneTier } from '../rune-forge/rune.model';
import {
  socketCountFor,
  socketFrameOf,
  socketStats,
  socketsOf,
  type SocketFrame,
} from './socket.model';

/** Which frames a word will seat in. `any` seats in both. */
export type WordFrame = SocketFrame | 'any';

export interface SocketWord {
  id: string;
  name: string;
  /** Rune ids, in the order they must sit in the wells. */
  runes: readonly string[];
  /** Which frame the sequence has to be set into. */
  frame: WordFrame;
  /** Flat stats added on top of the item's own and its runes'. */
  stats?: ItemStats;
  /**
   * Scales the whole item — base roll, socket runes and the word's own flat
   * stats — once. 1.5 is the "+50% to everything" a word can promise; absent
   * means the word pays only what `stats` says.
   */
  multiplier?: number;
  /** One line in the player's terms. What the Codex prints when it is found. */
  effect: string;
  lore: string;
  /**
   * A line shown *before* discovery, in place of the recipe.
   *
   * A word nobody can find is not a secret, it is a dead end. Every word names
   * its frame and gestures at its runes without spelling the sequence out, the
   * same contract the Codex's Secrets wall already keeps.
   */
  clue: string;
}

/**
 * The rarest rune a word demands. Drives the difficulty badge and the sort.
 *
 * Derived rather than authored for the reason `RUNES` derives its drop rates
 * from the tier table: a hand-written tier that disagrees with the recipe is a
 * badge that lies, and nobody notices until someone asks why the Godforge Seal
 * is filed under Common.
 */
const TIER_RANK: Record<RuneTier, number> = {
  common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, singular: 6,
};

export function wordTier(word: SocketWord): RuneTier {
  let best: RuneTier = 'common';
  for (const id of word.runes) {
    const rune = runeById(id);
    if (rune && TIER_RANK[rune.tier] > TIER_RANK[best]) best = rune.tier;
  }
  return best;
}

/**
 * Fifteen words, in ascending order of what they cost to assemble.
 *
 * Four of them are one rune long, which is on purpose: a one-socket word is the
 * only kind a player holding nothing but Commons can find, and a discovery
 * system whose first hit is gated behind a Rare weapon is a discovery system
 * nobody discovers. The three-rune weapon words need a Legendary weapon to hold
 * them, and that is the top of the ladder rather than the entry to it.
 */
export const SOCKET_WORDS: readonly SocketWord[] = [
  // ── One well ──────────────────────────────────────────────────────────────
  {
    id: 'cinderling',
    name: 'Cinderling',
    runes: ['ash'],
    frame: 'weapon',
    stats: { goldPerSec: 4, strikePower: 1 },
    effect: '+4 Gold/sec and +1 Strike',
    lore: 'The smallest word there is. Somebody put ash in a sword and the sword got warmer, and that was the whole of the discovery.',
    clue: 'The floor of the world, set into an edge.',
  },
  {
    id: 'dustmark',
    name: 'Dustmark',
    runes: ['drift'],
    frame: 'armor',
    stats: { magicFind: 3 },
    effect: '+3% Magic Find',
    lore: 'Worn by people who are going somewhere and have not decided where. They find things on the way.',
    clue: 'Something picked up walking, worn rather than swung.',
  },
  {
    id: 'mothlight',
    name: 'Mothlight',
    runes: ['mote'],
    frame: 'armor',
    stats: { xpBonus: 4 },
    effect: '+4% XP',
    lore: 'Too small to have been broken, and therefore too small to break you. The Archivum recommends it to apprentices.',
    clue: 'The one rune that was never part of anything larger.',
  },
  {
    id: 'voidmark',
    name: 'Voidmark',
    runes: ['void'],
    frame: 'any',
    multiplier: 2.5,
    effect: '×2.5 to every stat on the item',
    lore: 'One rune, one well, and the thing the realms were carved out of sitting in it. Nobody has written down what it feels like to wear.',
    clue: 'A single well, and the rune that does not exist in it.',
  },

  // ── Two wells ─────────────────────────────────────────────────────────────
  {
    id: 'ashwake',
    name: 'Ashwake',
    runes: ['ash', 'ember'],
    frame: 'weapon',
    stats: { goldPerSec: 12, strikePower: 2 },
    effect: '+12 Gold/sec and +2 Strike',
    lore: 'What the First Sun left, and what is still warm in it, in that order. Reverse them and nothing happens, which is the first lesson.',
    clue: 'The two commonest things in the Infernal, edge-set, cold before warm.',
  },
  {
    id: 'driftveil',
    name: 'Driftveil',
    runes: ['drift', 'veil'],
    frame: 'armor',
    stats: { magicFind: 6, ward: 2 },
    effect: '+6% Magic Find and +2 Ward',
    lore: 'The Nocturne wear this to be somewhere else. It works often enough that they keep doing it.',
    clue: 'A traveller\'s rune behind a Nocturne one.',
  },
  {
    id: 'nightglass',
    name: 'Nightglass',
    runes: ['shade', 'glint'],
    frame: 'armor',
    stats: { magicFind: 9, ward: 3 },
    effect: '+9% Magic Find and +3 Ward',
    lore: 'A vault door, seen for as long as it takes to close, remembered by someone standing in the dark.',
    clue: 'Shadow first, then the light it was hiding from.',
  },
  {
    id: 'emberseam',
    name: 'Emberseam',
    runes: ['ember', 'scorch'],
    frame: 'weapon',
    stats: { strikePower: 4 },
    multiplier: 1.15,
    effect: '+4 Strike, and +15% to everything else on the item',
    lore: 'Fire that stayed, and fire that did not. Held together they burn steadily, which is not what either does alone.',
    clue: 'Two kinds of burning, in an edge, patient one first.',
  },
  {
    id: 'wayfarer',
    name: 'Wayfarer',
    runes: ['pulse', 'seam'],
    frame: 'weapon',
    stats: { goldPerSec: 45, lootBonus: 6 },
    effect: '+45 Gold/sec and +6% loot quality',
    lore: 'One beat of the Verge, and the stitch where two realms were sewn back badly. Carried by everyone who crosses on purpose.',
    clue: 'A heartbeat, then the bad stitch it beats across.',
  },
  {
    id: 'archivists-ledger',
    name: 'The Archivist’s Ledger',
    runes: ['ledger', 'sigil'],
    frame: 'armor',
    stats: { xpBonus: 12, lootBonus: 8 },
    effect: '+12% XP and +8% loot quality',
    lore: 'The page with the total on it, countersigned. The Archivum keeps two copies and disagrees with itself about which is the original.',
    clue: 'The total, and the signature under it. Worn, not swung.',
  },
  {
    id: 'daybreak',
    name: 'Daybreak',
    runes: ['aether', 'glint'],
    frame: 'armor',
    stats: { xpBonus: 22, goldPerSec: 140 },
    effect: '+22% XP and +140 Gold/sec',
    lore: 'Light crystallised, with one ordinary glint set behind it so the wearer remembers what light used to be for.',
    clue: 'Crystallised light, backed by the cheap kind.',
  },
  {
    id: 'codex-of-the-unmade',
    name: 'Codex of the Unmade',
    runes: ['codex', 'ledger'],
    frame: 'armor',
    stats: { xpBonus: 28, lootBonus: 20 },
    multiplier: 1.25,
    effect: '+28% XP, +20% loot quality, and +25% to everything else on the item',
    lore: 'The page they voted to forget, filed against the page listing what was lost. The vote was not unanimous and the filing is why.',
    clue: 'The forgotten page, and the record of what it cost.',
  },

  // ── Three wells ───────────────────────────────────────────────────────────
  {
    id: 'riftwalk',
    name: 'Riftwalk',
    runes: ['rift', 'nexus', 'hollow'],
    frame: 'weapon',
    stats: { magicFind: 14, goldPerSec: 110 },
    multiplier: 1.2,
    effect: '+14% Magic Find, +110 Gold/sec, and +20% to everything else',
    lore: 'A hole, a knot, and the shape left behind. Set in that order they make a door; set in any other they make a mess.',
    clue: 'A carried hole, a knot of every thread, and what remains after. Three wells.',
  },
  {
    id: 'eclipse-blade',
    name: 'Eclipse Blade',
    runes: ['eclipse', 'nox', 'fracture'],
    frame: 'weapon',
    multiplier: 1.5,
    effect: '+50% to every stat on the item',
    lore: 'The moment the light went, the shadow that replaced it, and the line the whole thing broke along. Three wells and no flat bonus at all — the blade does not add to what you have, it multiplies it.',
    clue: 'The moment the light went, what came after, and the line it all broke along.',
  },
  {
    id: 'godforge-seal',
    name: 'Godforge Seal',
    runes: ['godstone', 'convergence', 'forge'],
    frame: 'weapon',
    stats: { strikePower: 12, goldPerSec: 700 },
    multiplier: 2,
    effect: '+12 Strike, +700 Gold/sec, and ×2 to everything else',
    lore: 'A piece of the First Sun, both realms fused at the seam, and the heat that made them, in a weapon that can hold all three. The Godforge was never sealed. This is what sealing it would have looked like.',
    clue: 'A piece of the Sun, the seam of both realms, and the heat that made them. Three wells, and nothing cheap in any of them.',
  },
];

const WORD_BY_ID = new Map(SOCKET_WORDS.map(w => [w.id, w]));

export function socketWordById(id: string): SocketWord | undefined {
  return WORD_BY_ID.get(id);
}

/** True when this word will seat in that frame. */
export function wordFitsFrame(word: SocketWord, frame: SocketFrame): boolean {
  if (frame === 'none') return false;
  return word.frame === 'any' || word.frame === frame;
}

/**
 * The word seated in this item right now, or null.
 *
 * Exactly one word can match, because the match is on the full ordered contents
 * of every well — two words with the same sequence and the same frame would be
 * the same word, and `socket-words.spec.ts` pins that no such pair exists.
 */
export function matchSocketWord(item: GameItem): SocketWord | null {
  const frame = socketFrameOf(item);
  if (frame === 'none') return null;
  const wells = socketsOf(item);
  if (!wells.length || wells.some(id => id === null)) return null;
  const count = socketCountFor(item);

  for (const word of SOCKET_WORDS) {
    if (word.runes.length !== count) continue;
    if (!wordFitsFrame(word, frame)) continue;
    if (word.runes.every((id, i) => wells[i] === id)) return word;
  }
  return null;
}

/**
 * The item's stats with its runes and its word applied.
 *
 * The order is load-bearing and it is the order the panel prints:
 *   base roll  →  + socket runes  →  + the word's flat stats  →  × the word's
 *   multiplier
 *
 * The multiplier lands last and on the sum, which is what "+50% to every stat
 * on the item" says on the card. Applying it to the base roll alone would make
 * Eclipse Blade worth less on a heavily socketed sword than on a bare one,
 * which is the opposite of what a three-rune word should mean.
 */
export function effectiveStats(item: GameItem, socketed: ItemStats): ItemStats {
  const word = matchSocketWord(item);
  const scale = word?.multiplier ?? 1;
  const out: ItemStats = {};

  for (const key of ITEM_STAT_KEYS) {
    const base = item.stats[key] ?? 0;
    const fromRunes = socketed[key] ?? 0;
    const fromWord = word?.stats?.[key] ?? 0;
    const total = (base + fromRunes + fromWord) * scale;
    if (total === 0) continue;
    // One decimal, always. Item rolls carry one, the multipliers are authored to
    // one, and a Magic Find of 14.399999999999999 on a tooltip is a bug report.
    out[key] = Math.round(total * 10) / 10;
  }
  return out;
}

/**
 * Everything one item is worth right now — roll, runes and word together.
 *
 * The single entry point for every consumer that used to read `item.stats`
 * directly. Keeping the composition in one function is what stops the bag, the
 * loadout panel, the worn totals and the explorer roster from each growing
 * their own idea of what a socketed item pays.
 */
export function wornStats(item: GameItem): ItemStats {
  const socketed = socketStats(item);
  return effectiveStats(item, socketed);
}
