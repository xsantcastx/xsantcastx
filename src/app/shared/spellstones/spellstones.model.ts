/**
 * spellstones.model.ts — Spellstones and Soul (docs/design/design-bible.md §5.1, roadmap §10 item 10): Tibia's runes,
 * named so they never clash with the Forge's 22 runes. Pure: no Angular, no DOM; imports only the import-free
 * economy curve.
 *
 *   Soul         a small per-character counter, earned one a kill of a creature no more than 10 levels below the
 *                Keeper (Soul Harvest adds one more per 5 ranks), capped at 100 (+1 per 20 levels, to 200). Shown by
 *                the mana bar as a pale-flame pip.
 *   Basalt Blank a stone cut to take the cant. Creatures drop them now and then; Edrin Kade's counter sells them,
 *                priced on the hunt (economy-curve huntGold).
 *   Inscribing   in the Spellbook, on any active spell the Keeper holds a rank in: 1 Blank + its Soul → a Spellstone
 *                with charges. The stone keeps the rank it was inscribed at.
 *   Using        the Spellstone slot on the belt (F, or the button): the spell goes off at the stone's rank, with no
 *                mana and no cooldown of its own; one stone a second. Any vocation can use any Spellstone.
 *
 * Stones are satchel items (skill-book.md §4, the grid release): a 1×1 instance `spellstone:<skill>@<rank>#<marks>`
 * carrying its charges, piled only with stones of the identical recipe, tradeable, droppable and storable. The old
 * hidden pouch (save v1) migrates into the satchel once (spellstone.service.ts). Blanks are satchel stacks
 * (`basalt-blank`).
 *
 * Lore: "The Seamworks scribes cut the cant into basalt because basalt remembers being fire."
 */
import { huntGold } from '../economy/economy-curve';

/** The satchel stack a Spellstone is cut from. */
export const BLANK_ID = 'basalt-blank';
export const BLANK_NAME = 'Basalt Blank';

/** The Soul a Keeper of `level` can hold: 100, +1 per 20 levels, never more than 200. */
export const SOUL_BASE = 100;
export const SOUL_MAX = 200;
export function soulCap(level: number): number {
  return Math.min(SOUL_MAX, SOUL_BASE + Math.floor(Math.max(1, Math.floor(level || 1)) / 20));
}
/** A kill of a creature more than this many levels below the Keeper gives no Soul (Tibia's rule). */
export const SOUL_LEVEL_GAP = 10;
/** Soul Harvest: one more Soul a kill for every this many ranks. */
export const SOUL_HARVEST_STEP = 5;
/** The Soul one kill gives: 1 (+1 per 5 Soul Harvest ranks), or 0 for a creature far below the Keeper. */
export function soulForKill(keeperLevel: number, creatureLevel: number, harvestRank = 0): number {
  if (!(creatureLevel >= Math.max(1, Math.floor(keeperLevel || 1)) - SOUL_LEVEL_GAP)) return 0;
  return 1 + Math.floor(Math.max(0, harvestRank) / SOUL_HARVEST_STEP);
}

/** The spell families (the Spellbook's pages): each has its own stone icon. */
export type StoneFamily = 'ember' | 'bone' | 'shadow' | 'common';
export const STONE_FAMILIES: readonly StoneFamily[] = ['ember', 'bone', 'shadow', 'common'];
/** The pixel icon id of a family's stone (art/pixel-icons via spellstone-icons.ts). */
export function stoneIcon(family: StoneFamily | string): string {
  return `spellstone-${(STONE_FAMILIES as readonly string[]).includes(family) ? family : 'common'}`;
}

/** What inscribing a spell costs and gives. `mana`: the spell's mana per cast (td-skills SKILLS). */
export interface StoneRecipe { blanks: 1; soul: number; charges: number }
/**
 * The recipe for a spell: a dearer spell costs more Soul and gives fewer charges.
 *   soul    = clamp(ceil(mana / 5), 1, 12)   (Hellfire Nova 25 → 5, Dark Ward 20 → 4, Light 10 → 2, Meteor 35 → 7)
 *   charges = clamp(round(100 / mana), 2, 10) (Nova 4, Dark Ward 5, Drain Life 8, Light 10, Meteor 3)
 * A spell with no mana cost (Life Tap) is inscribed for 2 Soul and 4 charges.
 */
export function stoneRecipe(mana: number): StoneRecipe {
  const m = Number.isFinite(mana) && mana > 0 ? mana : 0;
  if (!m) return { blanks: 1, soul: 2, charges: 4 };
  return { blanks: 1, soul: Math.max(1, Math.min(12, Math.ceil(m / 5))), charges: Math.max(2, Math.min(10, Math.round(100 / m))) };
}

/** The highest rank a stone can carry (td-skills MAX_RANK). */
export const STONE_MAX_RANK = 20;
/** A stone in the pouch is keyed by its spell and its rank: `hellfire-nova@3`. */
export function stoneKey(skill: string, rank: number): string {
  return `${skill}@${Math.max(1, Math.min(STONE_MAX_RANK, Math.floor(rank) || 1))}`;
}
export function parseStoneKey(key: string): { skill: string; rank: number } | null {
  const m = /^([a-z][a-z-]{0,40})@(\d{1,2})$/.exec(key);
  if (!m) return null;
  const rank = Number(m[2]);
  return rank >= 1 && rank <= STONE_MAX_RANK ? { skill: m[1], rank } : null;
}
/** Charges one stone holds at most (skill-book.md §4.1). */
export const STONE_MAX_CHARGES = 100;
/** The marks (modifier nodes) a stone recorded: the row's 6-bit mask when it was cut (A1 A2 A3 B1 B2 B3). */
export const STONE_MARKS_MASK = 63;
/** A stone's recipe: `hellfire-nova@7#5` (spell, rank, marks). Stones pile only with an identical recipe. */
export function recipeKey(skill: string, rank: number, marks = 0): string {
  return `${stoneKey(skill, rank)}#${Math.max(0, Math.min(STONE_MARKS_MASK, Math.floor(marks) || 0))}`;
}
export function parseRecipeKey(key: string): { skill: string; rank: number; marks: number } | null {
  const m = /^([a-z][a-z-]{0,40}@\d{1,2})(?:#(\d{1,2}))?$/.exec(key);
  if (!m) return null;
  const base = parseStoneKey(m[1]);
  const marks = m[2] === undefined ? 0 : Number(m[2]);
  return base && marks <= STONE_MARKS_MASK ? { ...base, marks } : null;
}
/** The satchel item's definition id for a recipe. */
export const STONE_DEF_PREFIX = 'spellstone:';
export function stoneDefId(recipe: string): string { return `${STONE_DEF_PREFIX}${recipe}`; }
export function recipeOfDef(definitionId: string | undefined): string | null {
  if (!definitionId?.startsWith(STONE_DEF_PREFIX)) return null;
  const r = definitionId.slice(STONE_DEF_PREFIX.length);
  return parseRecipeKey(r) ? r : null;
}
/** Level to use a stone: the lowest level anyone could hold that rank (skill-book.md §4.1). */
export function stoneLevel(unlockLevel: number, rank: number): number {
  return Math.max(unlockLevel, unlockLevel + Math.max(1, rank) - 1);
}
/** Gold a charge sells for: half the cheapest blank's (cutting stones is never a Gold machine). */
export const STONE_CHARGE_GOLD = Math.max(1, Math.floor(5 / 2));

/** Seconds between two stones (Tibia's exhaust), whatever the spell. */
export const STONE_COOLDOWN = 1;

// ── Blanks: drops and the counter ───────────────────────────────────────────

/** Chance a kill leaves a Basalt Blank, by the creature's rank; a boss leaves two. */
export const BLANK_DROP_CHANCE: Readonly<Record<'normal' | 'champion' | 'unique' | 'boss', number>> = {
  normal: 0.05, champion: 0.15, unique: 0.25, boss: 0.5,
};
/** Blanks a kill leaves (0 most of the time). `rand` returns [0, 1). */
export function rollBlankDrop(rank: 'normal' | 'champion' | 'unique' | 'boss', rand: () => number): number {
  return rand() < (BLANK_DROP_CHANCE[rank] ?? 0) ? (rank === 'boss' ? 2 : 1) : 0;
}
/** Edrin Kade's price for one blank: twenty seconds of a steady hunt at the Keeper's level, never under 5 Gold. */
export const BLANK_SECONDS = 20;
export const BLANK_MIN_PRICE = 5;
export function blankPrice(level: number): number {
  return Math.max(BLANK_MIN_PRICE, huntGold(Math.max(1, Math.floor(level || 1)), BLANK_SECONDS));
}

// ── The save (`godforge-spellstones`, per character) ─────────────────────────

export const SPELLSTONES_KEY = 'godforge-spellstones';

export interface SpellstoneSave {
  /** 1: the hidden pouch era. 2: stones live in the satchel; `pouch` is empty (kept for the migration's reading). */
  version: 1 | 2;
  /** Soul held now. */
  soul: number;
  /** v1 only: the stone pouch, `skill@rank` → charges left. Empty from v2 on (its stones are satchel items). */
  pouch: Record<string, number>;
  /** The belt's Spellstone slot: a recipe (`skill@rank#marks`) the satchel's stones are drawn from, or null. */
  slot: string | null;
  /** Stones inscribed, ever (only grows). */
  inscribed: number;
  /** ms of the last change: the later device wins the whole blob on a merge. */
  at: number;
}

export function emptySpellstones(): SpellstoneSave {
  return { version: 2, soul: 0, pouch: {}, slot: null, inscribed: 0, at: 0 };
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const whole = (v: unknown, max = Number.MAX_SAFE_INTEGER): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(max, Math.floor(v)) : 0);
const MAX_POUCH = 64;
const MAX_CHARGES = 999;

export function coerceSpellstones(raw: unknown): SpellstoneSave {
  if (!isRecord(raw)) return emptySpellstones();
  const pouch: Record<string, number> = {};
  if (isRecord(raw['pouch'])) {
    for (const [k, v] of Object.entries(raw['pouch']).slice(0, MAX_POUCH)) {
      const n = whole(v, MAX_CHARGES);
      if (n > 0 && parseStoneKey(k)) pouch[k] = n;
    }
  }
  // A v1 slot names a pouch key (`skill@rank`): the recipe with no marks.
  const slotRaw = typeof raw['slot'] === 'string' ? raw['slot'] : '';
  const slotParsed = parseRecipeKey(slotRaw);
  const slot = slotParsed ? recipeKey(slotParsed.skill, slotParsed.rank, slotParsed.marks) : null;
  const version = raw['version'] === 2 ? 2 : 1;
  return { version, soul: whole(raw['soul'], SOUL_MAX), pouch: version === 2 ? {} : pouch, slot, inscribed: whole(raw['inscribed']), at: whole(raw['at']) };
}

/** Two devices into one: the later change wins the whole blob (a cast on one and an inscription on the other cannot be split). */
export function mergeSpellstones(remote: unknown, local: unknown): unknown {
  if (remote == null) return local;
  if (local == null) return remote;
  const r = coerceSpellstones(remote), l = coerceSpellstones(local);
  const win = r.at > l.at || (r.at === l.at && r.inscribed > l.inscribed) ? r : l;
  return { ...win, inscribed: Math.max(r.inscribed, l.inscribed) } satisfies SpellstoneSave;
}

/** Add Soul from a kill, never past the cap. */
export function gainSoul(s: SpellstoneSave, n: number, cap: number): SpellstoneSave {
  const soul = Math.min(Math.max(0, cap), s.soul + Math.max(0, Math.floor(n)));
  return soul === s.soul ? s : { ...s, soul };
}

/**
 * Inscribe: spend the recipe's Soul, add its charges to the stone at (skill, rank). Null when the Soul is short or the
 * rank is 0 (a spell the Keeper does not hold). The blank is the satchel's to take (the service does, first).
 */
export function inscribe(s: SpellstoneSave, skill: string, rank: number, recipe: StoneRecipe): SpellstoneSave | null {
  if (!(rank >= 1) || s.soul < recipe.soul) return null;
  const key = stoneKey(skill, rank);
  return {
    ...s, soul: s.soul - recipe.soul, inscribed: s.inscribed + 1,
    pouch: { ...s.pouch, [key]: Math.min(MAX_CHARGES, (s.pouch[key] ?? 0) + recipe.charges) },
    // The first stone made goes on the belt by itself.
    slot: s.slot && (s.pouch[s.slot] ?? 0) > 0 ? s.slot : key,
  };
}

/** One charge of the stone at `key` spent. Null when there is none. An emptied stone leaves the pouch (and the slot). */
export function spendCharge(s: SpellstoneSave, key: string): SpellstoneSave | null {
  const left = s.pouch[key] ?? 0;
  if (left <= 0) return null;
  const pouch = { ...s.pouch };
  if (left > 1) pouch[key] = left - 1; else delete pouch[key];
  return { ...s, pouch, slot: s.slot === key && left <= 1 ? null : s.slot };
}

/** What check-meaning reads: the blank's and the stones' source, use and lore. */
export const SPELLSTONE_MEANING = {
  blank: {
    sources: ['creature drops (any creature, 1 in 20; bosses two)', 'Edrin Kade sells it (Material Vendor, priced on the hunt)'],
    uses: ['inscribed with a ranked spell and Soul in the Spellbook: a Spellstone'],
    lore: 'The Seamworks scribes cut the cant into basalt because basalt remembers being fire.',
  },
  stone: {
    sources: ['cut in the Skill Book from a Basalt Blank and Soul (a spell the Keeper has ranked)', 'traded', 'dropped by Keepers in Tibia-scope falls'],
    uses: ['the belt\'s Spellstone slot (F): the spell at the stone\'s rank with its marks, no mana; any vocation can use it'],
    lore: 'A spell held in stone keeps the hand that cut it. Lend it to a friend and it still speaks in your voice.',
  },
  soul: {
    sources: ['kills of creatures no more than 10 levels below the Keeper (Soul Harvest adds more)'],
    uses: ['inscribing Spellstones'],
    lore: 'The dead pay their toll in a little light. The Seamworks keeps it in basalt.',
  },
} as const;
