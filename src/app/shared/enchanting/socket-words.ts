/**
 * socket-words.ts — the runewords (docs/design/runewords.md; canon §6.2), and what one pays.
 *
 * A runeword is the right runes, in the right order, in the right base: a NORMAL (white, no-affix) item of one of the
 * word's base types, with exactly as many wells as the word has runes, every well filled in order. It is made at the
 * Enchanting Table (Idris Calder), where runes are set; the name then shows gold and the item gains the word's fixed
 * stats on top of its base and its runes (and the word's aura, if it has one). Runes never come out, so a word is
 * for good.
 *
 * (The file keeps its old name: the shipped "Socket Words" are these runewords, re-cut to canon. The Forge's
 * consumed "Runewords" in rune.model.ts were retired with the Rune Forge; their bonuses still pay.)
 *
 * Pure data and pure functions — no browser APIs, safe on an SSR path.
 */
import { ITEM_STAT_KEYS, type GameItem, type ItemStats } from '../rpg/item.model';
import { runeById, type RuneTier } from '../rune-forge/rune.model';
import { graveStats } from '../grave-goods/grave-goods.model';
import { itemBase } from '../rpg/item-base';
import type { GearBase } from '../art/gear-icons';
import type { AuraId } from '../loot/auras';
import { socketCountFor, socketStats, socketsOf } from './socket.model';

export interface SocketWord {
  id: string;
  name: string;
  /** Rune ids, in the order they must sit in the wells. */
  runes: readonly string[];
  /** The base types it can be made in. */
  bases: readonly GearBase[];
  /** Fixed stats, added on top of the base's own and its runes'. */
  stats: ItemStats;
  /** One line in the player's terms. */
  effect: string;
  lore: string;
  /** Shown before discovery, in place of the recipe. */
  clue: string;
  /** A D2-style aura while worn (loot/auras.ts), at a level from the word's rarest rune. */
  aura?: AuraId;
}

const TIER_RANK: Record<RuneTier, number> = {
  common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, singular: 6,
};

/** The rarest rune a word demands (derived, so a badge cannot lie). */
export function wordTier(word: SocketWord): RuneTier {
  let best: RuneTier = 'common';
  for (const id of word.runes) {
    const rune = runeById(id);
    if (rune && TIER_RANK[rune.tier] > TIER_RANK[best]) best = rune.tier;
  }
  return best;
}

const BLADES: readonly GearBase[] = ['sword', 'dagger', 'greatsword'];
const HAFTS: readonly GearBase[] = ['mace', 'hammer', 'axe', 'spear'];
const BOWS: readonly GearBase[] = ['bow', 'crossbow'];
const CASTERS: readonly GearBase[] = ['staff', 'wand'];
const HELMS: readonly GearBase[] = ['helm', 'hood', 'crown', 'circlet'];
const BODY: readonly GearBase[] = ['plate', 'robe', 'coat'];
const SHIELD: readonly GearBase[] = ['shield'];

/**
 * Eighteen starter words (the DM's list, 2026-10-26), cheapest first. Two wells hold at any item level; three need
 * item level 15 (a shield or staff anywhere); four need 30; five only a staff at 30+.
 */
export const SOCKET_WORDS: readonly SocketWord[] = [
  // ── Two wells: Ember Isle's commons ───────────────────────────────────────
  {
    id: 'cinderling', name: 'Cinderling', runes: ['ember', 'ash'], bases: BLADES,
    stats: { attackDamage: 18, minDamage: 2, maxDamage: 5, lifeLeech: 2 },
    effect: '+18% attack damage, +2-5 damage, 2% life steal',
    lore: 'Light it, then let it settle. The first word every Seamworks apprentice sets into an edge.',
    clue: 'What is still warm, then what it leaves. In a blade.',
  },
  {
    id: 'hearthguard', name: 'Hearthguard', runes: ['shade', 'ember'], bases: SHIELD,
    stats: { defense: 20, life: 15, coldResist: 15, blockChance: 5 },
    effect: '+20 defence, +15 life, +15% cold resist, +5% block',
    lore: 'A shadow and a warmth, carried before you like a hearth on the arm.',
    clue: 'The dark first, then a coal. On a shield.',
  },
  {
    id: 'wayfarer', name: 'Wayfarer', runes: ['drift', 'shade'], bases: BODY,
    stats: { life: 20, defense: 15, magicFind: 8, goldFind: 6 },
    effect: '+20 life, +15 defence, +8% Magic Find, +6% Gold Find',
    lore: 'Worn by people who are going somewhere and have not decided where. They find things on the way.',
    clue: 'Something picked up walking, then the shadow it walked in. Worn on the body.',
  },
  {
    id: 'mothlight', name: 'Mothlight', runes: ['ash', 'drift'], bases: HELMS,
    stats: { life: 10, mana: 12, xpBonus: 6 },
    effect: '+10 life, +12 mana, +6% XP',
    lore: 'A small warmth worn close: a beginning that has not yet decided what it will light. The Archive gives it to apprentices.',
    clue: 'The floor of the world, then a traveller. On the head.',
  },
  {
    id: 'ashwake', name: 'Ashwake', runes: ['ember', 'drift'], bases: CASTERS,
    stats: { spellDamage: 20, castSpeed: 8, mana: 15 },
    effect: '+20% spell damage, +8% cast speed, +15 mana',
    lore: 'What the First Sun left, carried somewhere it can burn again. The scribes cut it into their first staves.',
    clue: 'A coal, then a wanderer. In a staff or a wand.',
  },
  // ── Three wells: the Reach's uncommons ────────────────────────────────────
  {
    id: 'brandoath', name: 'Brandoath', runes: ['thorn', 'scorch', 'ember'], bases: [...BLADES, ...HAFTS],
    stats: { attackDamage: 35, attackSpeed: 10, critChance: 4 },
    effect: '+35% attack damage, +10% attack speed, +4% crit, and the Might aura',
    lore: 'The oath the Seamworks smiths swear on a fresh edge: that it will bite before it bends. The aura is the oath kept.',
    clue: 'A barb, a short fire, a long one. In a blade or a haft.',
    aura: 'might',
  },
  {
    id: 'stormglass', name: 'Stormglass', runes: ['glint', 'pulse', 'drift'], bases: BOWS,
    stats: { attackDamage: 30, pierceChance: 10, lightningResist: 15 },
    effect: '+30% attack damage, +10% pierce, +15% lightning resist, and the Holy Shock aura',
    lore: 'A flash, a heartbeat and the wind that carries both. The Heliograph Court calls it a lightning rod that answers back.',
    clue: 'A gleam, a heartbeat, and the wind that carries both. On a bow.',
    aura: 'holy-shock',
  },
  {
    id: 'rimeveil', name: 'Rimeveil', runes: ['veil', 'shade', 'veil'], bases: BODY,
    stats: { defense: 40, life: 30, coldResist: 30 },
    effect: '+40 defence, +30 life, +30% cold resist, and the Holy Freeze aura',
    lore: 'Winter, worn. What comes close to the wearer moves as if through the Archive at night.',
    clue: 'A curtain, a shadow, a curtain. Worn on the body.',
    aura: 'holy-freeze',
  },
  {
    id: 'mercyroot', name: 'Mercyroot', runes: ['thorn', 'veil', 'ash'], bases: SHIELD,
    stats: { blockChance: 12, defense: 35, life: 25 },
    effect: '+12% block, +35 defence, +25 life, and the Redemption aura',
    lore: 'The Root Deeps waste nothing. A creature that falls by the bearer feeds them, as a fallen tree feeds the canopy.',
    clue: 'A barb behind a curtain, and the floor of the world it grows from. On a shield.',
    aura: 'redemption',
  },
  {
    id: 'vigil', name: 'Vigil', runes: ['shade', 'ash', 'glint'], bases: HELMS,
    stats: { life: 25, lifeRegen: 2, allResist: 8 },
    effect: '+25 life, +2 life regen, +8% all resists, and the Prayer aura',
    lore: 'Kept by the Seamworks night watch: a shadow, what the First Sun left, and the gleam that means morning. The watch has never lost a Keeper to the cold.',
    clue: 'The dark, the floor of the world, a gleam. On the head.',
    aura: 'prayer',
  },
  // ── Four wells (three on a helm): the Wilds', the Marches' and the Peaks' runes ──
  {
    id: 'verdict', name: 'Verdict', runes: ['hollow', 'sigil', 'nexus', 'rift'], bases: HAFTS,
    stats: { attackDamage: 80, critChance: 8, lifeLeech: 5, maxDamage: 12 },
    effect: '+80% attack damage, +12 max damage, +8% crit, 5% life steal, and the Conviction aura',
    lore: 'The Archive\'s ruling, written into a haft: what stands before it is found wanting, whatever it was made to withstand.',
    clue: 'An emptiness, a mark of record, a knot, a hole. In a haft.',
    aura: 'conviction',
  },
  {
    id: 'riftwalk', name: 'Riftwalk', runes: ['rift', 'nexus', 'hollow', 'pulse'], bases: BODY,
    stats: { life: 60, defense: 60, allResist: 15, lifeRegen: 4 },
    effect: '+60 life, +60 defence, +15% all resists, +4 life regen, and the Vigor aura',
    lore: 'A hole, a knot, the shape left behind and the beat that carries you through. Set in that order they make a door.',
    clue: 'A carried hole, a knot, what remains, a heartbeat. Worn on the body.',
    aura: 'vigor',
  },
  {
    id: 'emberseam', name: 'Emberseam', runes: ['ember', 'scorch', 'forge', 'ash'], bases: ['staff'],
    stats: { spellDamage: 60, castSpeed: 15, skillRanks: 1, fireResist: 20 },
    effect: '+60% spell damage, +15% cast speed, +1 to skills, +20% fire resist, and the Holy Fire aura',
    lore: 'Fire that stayed, fire that did not, the heat that made the realms, and the ash after. A staff that remembers the forge.',
    clue: 'Two kinds of burning, the great heat, and what it leaves. In a staff.',
    aura: 'holy-fire',
  },
  {
    id: 'archivists-ledger', name: 'The Archivist\u2019s Ledger', runes: ['sigil', 'codex', 'ash'], bases: HELMS,
    stats: { xpBonus: 25, magicFind: 30, mana: 40, skillRanks: 1 },
    effect: '+25% XP, +30% Magic Find, +40 mana, +1 to skills',
    lore: 'The record of what was spent, countersigned. The Archive keeps two copies and disagrees with itself about which is the original.',
    clue: 'A signature, the forgotten page, and what was lost. Three wells, on the head.',
  },
  {
    id: 'daybreak', name: 'Daybreak', runes: ['aether', 'glint', 'ash', 'sigil'], bases: SHIELD,
    stats: { blockChance: 20, defense: 120, allResist: 30, life: 60 },
    effect: '+20% block, +120 defence, +30% all resists, +60 life, and the Prayer aura',
    lore: 'Light crystallised, with an ordinary glint set behind it so the bearer remembers what light used to be for.',
    clue: 'Crystallised light, the cheap kind, the floor of the world, a signature. On a shield.',
    aura: 'prayer',
  },
  {
    id: 'eclipse-blade', name: 'Eclipse Blade', runes: ['eclipse', 'nox', 'fracture', 'aether'], bases: BLADES,
    stats: { attackDamage: 120, attackSpeed: 20, critChance: 12, lifeLeech: 8, allResist: 20 },
    effect: '+120% attack damage, +20% attack speed, +12% crit, 8% life steal, +20% all resists, and the Conviction aura',
    lore: 'The moment the light went, the shadow that replaced it, the line it broke along, and the light again. Four wells, and the blade forgets which side it was on.',
    clue: 'The moment the light went, what came after, the line it broke along, and light. In a blade.',
    aura: 'conviction',
  },
  // ── Five wells: a staff at item level 30+, the Expanse's mythics ──────────
  {
    id: 'godforge-weld', name: 'Godforge Weld', runes: ['godstone', 'convergence', 'forge', 'fracture', 'ember'], bases: ['staff'],
    stats: { spellDamage: 150, castSpeed: 30, skillRanks: 3, allResist: 40, life: 100 },
    effect: '+150% spell damage, +30% cast speed, +3 to skills, +40% all resists, +100 life, and the Fanaticism aura',
    lore: 'A piece of the First Sun, both halves fused at the seam, the heat that made them, the line they broke along, and a coal to keep it warm. The seam, welded.',
    clue: 'A piece of the Sun, the seam of both halves, the great heat, the break, and a coal. Five wells in a staff.',
    aura: 'fanaticism',
  },
  // ── Hell only: the Void ────────────────────────────────────────────────────
  {
    id: 'voidmark', name: 'Voidmark', runes: ['void', 'eclipse', 'nox', 'hollow'], bases: BLADES,
    stats: { attackDamage: 150, attackSpeed: 30, critChance: 20, lifeLeech: 12, allResist: 40, skillRanks: 2 },
    effect: '+150% attack damage, +30% attack speed, +20% crit, 12% life steal, +40% all resists, +2 to skills, and the Conviction aura',
    lore: 'The thing the realms were carved out of, set first, and the dark of three other wells after it. Nobody has written down what it feels like to wear.',
    clue: 'The rune that does not exist, then the moment the light went, a heavy dark, and what is left of a thing. In a blade.',
    aura: 'conviction',
  },
];

const WORD_BY_ID = new Map(SOCKET_WORDS.map(w => [w.id, w]));
export function socketWordById(id: string): SocketWord | undefined { return WORD_BY_ID.get(id); }

/** The wells a word needs. */
export function wordWells(word: SocketWord): number { return word.runes.length; }

/**
 * The runeword this item spells right now, or null: a normal base of one of the word's types, with exactly the
 * word's number of wells, all filled in the word's order. Exactly one can match (the spec pins no two words share
 * runes and a base).
 */
export function matchSocketWord(item: Pick<GameItem, 'type' | 'slot' | 'definitionId' | 'sockets' | 'rarity' | 'name' | 'id'>): SocketWord | null {
  if (item.rarity !== 'common') return null;
  const count = socketCountFor(item);
  if (count < 1) return null;
  const wells = socketsOf(item);
  if (wells.some(id => id === null)) return null;
  const base = itemBase(item);
  if (!base) return null;
  for (const word of SOCKET_WORDS) {
    if (word.runes.length !== count || !word.bases.includes(base)) continue;
    if (word.runes.every((id, i) => wells[i] === id)) return word;
  }
  return null;
}

/** The words this base could ever hold (for the table's list and the item card's hint). */
export function wordsForBase(base: GearBase | null, wells?: number): SocketWord[] {
  if (!base) return [];
  return SOCKET_WORDS.filter(w => w.bases.includes(base) && (wells === undefined || w.runes.length === wells));
}

/**
 * The item's stats with its runes and its word applied.
 *
 * base roll + socket runes + the word's fixed stats, to one decimal.
 */
export function effectiveStats(item: GameItem, socketed: ItemStats): ItemStats {
  const word = matchSocketWord(item);
  const out: ItemStats = {};

  for (const key of ITEM_STAT_KEYS) {
    const base = item.stats[key] ?? 0;
    const fromRunes = socketed[key] ?? 0;
    const fromWord = word?.stats?.[key] ?? 0;
    const total = base + fromRunes + fromWord;
    if (total === 0) continue;
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
  const out = effectiveStats(item, socketed);
  // A grave-good's curse or whisper (shared/grave-goods): its bonus and its cost ride on top of the roll.
  if (!item.curse && !item.whisper) return out;
  for (const [key, n] of Object.entries(graveStats(item)) as [keyof ItemStats, number][]) {
    const total = Math.round(((out[key] ?? 0) + n) * 10) / 10;
    if (total === 0) delete out[key]; else out[key] = total;
  }
  return out;
}
