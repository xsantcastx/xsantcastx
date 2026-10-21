/**
 * grave-goods.model.ts — cursed grave-goods and whispering items (docs/design/design-bible.md §6.2, §7.7; roadmap §10
 * item 11 and the queued Whispering items). Pure: no Angular, no DOM; imports only the import-free economy curve.
 *
 * CURSED GRAVE-GOODS. 1 in 12 rare-or-better drops in the crypts (the Ashen Crypt, the Drowned Crypts) comes up
 * Cursed: it keeps every rolled stat and carries one strong bonus and one cost, both frozen at the drop (the
 * frozen-grade rule: nothing here is ever recomputed from the item's level later). A cursed piece can be worn, taken
 * off and sold freely (cozy: no trapped slot). Sexton Aldous Wren cleanses one for Gold: the cost goes, the bonus
 * halves, and the card says "Laid to rest." — a choice, not a fix.
 *
 * WHISPERING ITEMS. 1 in 40 rare-or-better drops anywhere is Whispering: a sentence in an erased witness's voice,
 * revealed a piece at a time as the Keeper fights with it worn. Each piece it wakes adds a little of its stat (three
 * pieces past the first, then it is fully awake). While it whispers the dead lean in to listen: −5 to all resists.
 * The Archivist will silence it for Gold: it keeps the words and the stat it has woken, stops growing, and the cost goes.
 *
 * Both are optional fields on GameItem (`curse`, `whisper`); an item without them loads exactly as before.
 */
import { huntGold } from '../economy/economy-curve';
import type { GameItem, ItemRarity, ItemStats } from '../rpg/item.model';

// ── Cursed grave-goods ──────────────────────────────────────────────────────

export type CurseId = 'grave-cold' | 'hollow-ward' | 'leaden-step';

export interface CurseDef {
  id: CurseId;
  /** The stat the bonus lifts, and what it is at item level L (frozen at the drop). */
  bonus: keyof ItemStats;
  bonusAt: (level: number) => number;
  /** The stat the curse takes (a negative number on the worn total), and how much at item level L. */
  cost: keyof ItemStats;
  costAt: (level: number) => number;
}

const tenth = (n: number): number => Math.round(n * 10) / 10;

/**
 * Three curses, each a strong bonus against a real cost the fight reads:
 *  - Grave-cold: more spell damage; it drains life slowly (a negative life regeneration, never below 1 life).
 *  - Hollow Ward: more life; all four resists fall.
 *  - Leaden Step: more crits; the feet go slow.
 */
export const CURSES: Readonly<Record<CurseId, CurseDef>> = {
  'grave-cold': { id: 'grave-cold', bonus: 'spellDamage', bonusAt: L => Math.round(8 + L * 0.3), cost: 'lifeRegen', costAt: L => tenth(1 + L / 25) },
  'hollow-ward': { id: 'hollow-ward', bonus: 'life', bonusAt: L => Math.round(15 + L * 2), cost: 'allResist', costAt: () => 15 },
  'leaden-step': { id: 'leaden-step', bonus: 'critChance', bonusAt: L => tenth(4 + L * 0.1), cost: 'moveSpeed', costAt: () => 12 },
};
export const CURSE_IDS = Object.keys(CURSES) as CurseId[];
export function isCurseId(v: unknown): v is CurseId { return typeof v === 'string' && v in CURSES; }

/** One rare+ drop in this many in a crypt is a cursed grave-good. */
export const CURSE_ONE_IN = 12;
/** One rare+ drop in this many, anywhere, whispers. */
export const WHISPER_ONE_IN = 40;

/** The top-down levels that count as graves (td level ids): every floor of the two crypts. */
export const GRAVE_LEVELS: readonly string[] = ['ashen-crypt', 'drowned-crypts'];
export function isGraveLevel(levelId: string | null | undefined): boolean {
  return !!levelId && GRAVE_LEVELS.some(p => levelId === p || levelId.startsWith(`${p}-`));
}
/** The level a top-down drop fell in, read off its id (`td:<level>:<creature>:…`, td-mobs kill). */
export function dropLevel(dropId: string): string | null {
  return /^td:([a-z0-9-]+):/.exec(dropId)?.[1] ?? null;
}

const RARITY_RANK: Readonly<Record<string, number>> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, singular: 6 };
export function rareOrBetter(r: ItemRarity | string): boolean { return (RARITY_RANK[r] ?? 0) >= 2; }

/** A curse as frozen on an item: which one, the bonus and the cost it rolled, and whether the Sexton laid it to rest. */
export interface ItemCurse { id: CurseId; bonus: number; cost: number; cleansed?: boolean }

export function curseFor(id: CurseId, itemLevel: number): ItemCurse {
  const L = Math.max(1, Math.floor(itemLevel || 1)), def = CURSES[id];
  return { id, bonus: def.bonusAt(L), cost: def.costAt(L) };
}

// ── Whispering items ─────────────────────────────────────────────────────────

export type WhisperId = 'ash-garrison' | 'drowned-sister' | 'first-tally' | 'margin-hand';

export interface WhisperDef {
  id: WhisperId;
  /** The stat each woken piece adds, and how much per piece. */
  stat: keyof ItemStats;
  per: number;
}

/** Four voices, each an erased witness (design-bible §3.1, the dark remembers what light was told to forget). */
export const WHISPERS: Readonly<Record<WhisperId, WhisperDef>> = {
  'ash-garrison': { id: 'ash-garrison', stat: 'defense', per: 4 },
  'drowned-sister': { id: 'drowned-sister', stat: 'manaRegen', per: 0.5 },
  'first-tally': { id: 'first-tally', stat: 'spellDamage', per: 2 },
  'margin-hand': { id: 'margin-hand', stat: 'critChance', per: 1 },
};
export const WHISPER_IDS = Object.keys(WHISPERS) as WhisperId[];
export function isWhisperId(v: unknown): v is WhisperId { return typeof v === 'string' && v in WHISPERS; }

/** Kills made with it worn at which the 2nd, 3rd and 4th pieces of the sentence wake. */
export const WHISPER_STAGES: readonly number[] = [25, 75, 150];
/** Pieces of each sentence (the first shows from the drop). */
export const WHISPER_PIECES = WHISPER_STAGES.length + 1;
/** While a whispering item is worn and not silenced: this off all four resists (the dead lean in to listen). */
export const WHISPER_COST = 5;
/** Kills are counted to this and no further. */
export const WHISPER_KILL_CAP = WHISPER_STAGES[WHISPER_STAGES.length - 1];

export interface ItemWhisper { id: WhisperId; kills: number; silenced?: boolean }

/** How awake it is: 0 (one piece showing) … 3 (the whole sentence). */
export function whisperStage(w: Pick<ItemWhisper, 'kills'>): number {
  return WHISPER_STAGES.filter(n => w.kills >= n).length;
}
/** The kills the next piece wakes at, or null when it is fully awake (or silenced). */
export function nextWhisperAt(w: ItemWhisper): number | null {
  if (w.silenced) return null;
  return WHISPER_STAGES.find(n => w.kills < n) ?? null;
}
/** One more kill with it worn. A silenced item does not listen; past the last piece the count stops. */
export function whisperKill(w: ItemWhisper): ItemWhisper {
  if (w.silenced || w.kills >= WHISPER_KILL_CAP) return w;
  return { ...w, kills: w.kills + 1 };
}

// ── What a grave-good pays on the worn total ────────────────────────────────

/**
 * The stats a curse and a whisper add to the item's worn total (socket-words wornStats adds this to the roll):
 *  - a curse: its bonus (halved once cleansed) and, until cleansed, its cost as a negative stat;
 *  - a whisper: its stat × the pieces woken, and −WHISPER_COST all resist while it still whispers.
 */
export function graveStats(item: Pick<GameItem, 'curse' | 'whisper'>): ItemStats {
  const out: ItemStats = {};
  const add = (k: keyof ItemStats, n: number) => { if (n) out[k] = tenth((out[k] ?? 0) + n); };
  const c = item.curse;
  if (c && isCurseId(c.id)) {
    const def = CURSES[c.id];
    add(def.bonus, c.cleansed ? tenth(c.bonus / 2) : c.bonus);
    if (!c.cleansed) add(def.cost, -c.cost);
  }
  const w = item.whisper;
  if (w && isWhisperId(w.id)) {
    const def = WHISPERS[w.id];
    add(def.stat, def.per * whisperStage(w));
    if (!w.silenced) add('allResist', -WHISPER_COST);
  }
  return out;
}

// ── Rolling one at the drop ─────────────────────────────────────────────────

/**
 * What a fresh drop becomes, if anything. `rand` returns [0, 1) (the mint's seeded stream in play). Uniques keep their
 * authored self. In a crypt a rare+ piece may be cursed; anywhere a rare+ piece may whisper (a curse wins the roll).
 */
export function rollGrave(drop: { rarity: ItemRarity | string; unique?: boolean; itemLevel?: number; levelId?: string | null }, rand: () => number): { curse?: ItemCurse; whisper?: ItemWhisper } {
  if (drop.unique || !rareOrBetter(drop.rarity)) return {};
  if (isGraveLevel(drop.levelId) && rand() < 1 / CURSE_ONE_IN) {
    return { curse: curseFor(CURSE_IDS[Math.floor(rand() * CURSE_IDS.length) % CURSE_IDS.length], drop.itemLevel ?? 1) };
  }
  if (rand() < 1 / WHISPER_ONE_IN) return { whisper: { id: WHISPER_IDS[Math.floor(rand() * WHISPER_IDS.length) % WHISPER_IDS.length], kills: 0 } };
  return {};
}

// ── Prices (Gold only; a Gold sink, priced on the hunt) ─────────────────────

/** Sexton Wren's cleansing: three minutes of a steady hunt at the Keeper's level. */
export const CLEANSE_SECONDS = 180;
export const CLEANSE_MIN = 60;
export function cleansePrice(level: number): number { return Math.max(CLEANSE_MIN, huntGold(Math.max(1, Math.floor(level || 1)), CLEANSE_SECONDS)); }
/** The Archivist's silence: two minutes of a steady hunt at the Keeper's level. */
export const SILENCE_SECONDS = 120;
export const SILENCE_MIN = 40;
export function silencePrice(level: number): number { return Math.max(SILENCE_MIN, huntGold(Math.max(1, Math.floor(level || 1)), SILENCE_SECONDS)); }

// ── Reading a saved one ──────────────────────────────────────────────────────

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, max: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0);

/** A saved curse, or undefined for anything that is not one (a junk field never breaks the item). */
export function parseCurse(raw: unknown): ItemCurse | undefined {
  if (!isRecord(raw) || !isCurseId(raw['id'])) return undefined;
  const out: ItemCurse = { id: raw['id'], bonus: tenth(num(raw['bonus'], 10_000)), cost: tenth(num(raw['cost'], 10_000)) };
  if (raw['cleansed'] === true) out.cleansed = true;
  return out;
}
/** A saved whisper, or undefined. */
export function parseWhisper(raw: unknown): ItemWhisper | undefined {
  if (!isRecord(raw) || !isWhisperId(raw['id'])) return undefined;
  const out: ItemWhisper = { id: raw['id'], kills: Math.floor(num(raw['kills'], WHISPER_KILL_CAP)) };
  if (raw['silenced'] === true) out.silenced = true;
  return out;
}

/**
 * What check-meaning reads: each curse and whisper's source, use and lore (the words live in grave-goods.i18n.ts).
 */
export const GRAVE_MEANING = {
  cursed: {
    sources: ['rare-or-better drops in the Ashen Crypt and the Drowned Crypts (1 in 12)'],
    uses: ['worn: a strong bonus with a cost the fight reads (curse); Sexton Aldous Wren cleanses it for Gold'],
    lore: 'Grave-goods: what was buried with the erased. The crypts do not stay closed, and neither do they.',
  },
  whispering: {
    sources: ['rare-or-better drops anywhere (1 in 40)'],
    uses: ['worn: wakes a piece of its sentence and a little of its stat as the Keeper fights; the Archivist silences it for Gold'],
    lore: 'The erased witnesses speak through what they touched. Wear it long enough and it finishes the sentence.',
  },
} as const;
