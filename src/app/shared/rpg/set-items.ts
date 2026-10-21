/**
 * set-items.ts — the four item sets (docs/design/design-bible.md §7.4, roadmap §10 item 12: "a mythic chase with goals").
 *
 * A set is four named pieces in four different slots, each tied to one place and one people. Wearing some of them
 * wakes the set (D2's rule): **two** pieces, **three** pieces, the **full** set, each tier on top of the one below.
 * The pieces are mythic (the ladder's "Set / ancient" rung, `--cozy-loot-mythic`) and, like the bosses' uniques, are
 * spread into `UNIQUE_ITEMS` with a `set` tag: they roll as any gear of their slot at the level they dropped at, they
 * never come out of the Gambler or an open unique roll, and each reaches the player by exactly one path (below).
 *
 *   sources  The Ossuary Watch, the Garb of the Drowned Abbey and the Rootcradle Vestments drop from the creatures of
 *            their place at a small chance (`rollSetPiece`, rolled last in `rollCreatureLoot`, from a minimum level);
 *            the Lamplighter's Things lie in the shade chests (td-dark.ts), one piece to a chest.
 *   effect   A tier is stats (summed into the worn combat totals: `addSetBonuses`, read by td-skills `wornCombat`, so
 *            `fightStats` applies them), a share of Defense (`defensePct`), or a signature of the kind the bosses'
 *            uniques carry (`sig`, applied by the fight through `relicTotals`: skill ranks, light, regeneration, ink,
 *            more skeletons, Magic Find). Nothing here is text without a number behind it.
 *
 * Pure data and pure functions; skill ids are plain strings so this leaf never imports the play chunk.
 */
import type { UniqueItem } from './unique-items';
import type { RelicSig } from './boss-uniques';
import type { ItemStats } from './item.model';
import type { MonsterRank } from '../loot/champions';

/** One tier of a set: it is on while `at` or more of the set's pieces are worn. */
export interface SetBonus {
  /** Pieces worn that wake it (2, 3, then the full set's count). */
  at: number;
  /** Flat worn stats, added to the combat totals. */
  stats?: Partial<ItemStats>;
  /** Percent more Defense (on the whole worn total, after the flat stats). */
  defensePct?: number;
  /** What the fight applies on top (boss-uniques.ts RelicSig). */
  sig?: RelicSig;
}

/** A set piece: a mythic UniqueItem tied to its set. */
export interface SetPiece extends UniqueItem {
  set: string;
}

/** Where a set's pieces come from. */
export interface SetSource {
  /** Creatures whose kills may drop a piece (never the Gambler, never an open roll). */
  creatures: readonly string[];
  /** The lowest level a kill is worth a piece at (monsterLevel(), difficulty included). */
  minLevel: number;
  /** Shade chests (td-dark.ts SHADE_CHESTS ids) and the piece each one holds; null: a random piece of the set. */
  chests?: Readonly<Record<string, string | null>>;
}

export interface ItemSet {
  id: string;
  name: string;
  /** Whose kit it was (the card and the Bestiary say it). */
  lore: string;
  /** Where it is found, as the "Found in" line names it. */
  where: string;
  /** Piece ids, in the order the card lists them. */
  pieces: readonly string[];
  /** The tiers, lowest first; the last is the full set. */
  bonuses: readonly SetBonus[];
  source: SetSource;
}

const P = (p: SetPiece): SetPiece => p;

/** The sixteen pieces, four to a set. All mythic; stats roll as any gear of the slot (item-affixes.ts). */
export const SET_PIECES: readonly SetPiece[] = [
  // ── The Ossuary Watch: the Ashen Bastion's garrison kit ──
  P({
    id: 'set-ossuary-helm', set: 'ossuary-watch', name: 'Ossuary Helm', rarity: 'mythic', slot: 'head', style: 'infernal',
    rollKeys: ['defense', 'life'], base: { defense: 7, life: 8 },
    passive: { effect: 'relic', text: 'A piece of the Ossuary Watch.' },
    lore: 'The garrison wore them down into the crypt and never took them off. The dents are the roll of the watch.',
  }),
  P({
    id: 'set-ossuary-hauberk', set: 'ossuary-watch', name: 'Ossuary Hauberk', rarity: 'mythic', slot: 'chest', style: 'infernal',
    rollKeys: ['defense', 'life'], base: { defense: 9, life: 12 },
    passive: { effect: 'relic', text: 'A piece of the Ossuary Watch.' },
    lore: 'Ash-black mail, one ring for every night the Bastion held. It is heavier than it should be, and warmer.',
  }),
  P({
    id: 'set-ossuary-bulwark', set: 'ossuary-watch', name: 'Ossuary Bulwark', rarity: 'mythic', slot: 'off-hand', style: 'infernal',
    rollKeys: ['defense', 'fireResist'], base: { defense: 8, fireResist: 6 },
    passive: { effect: 'relic', text: 'A piece of the Ossuary Watch.' },
    lore: 'A tower shield with a pyre cut into its face. Whoever stood behind it was told to stand there until relieved.',
  }),
  P({
    id: 'set-ossuary-boots', set: 'ossuary-watch', name: 'Ossuary Boots', rarity: 'mythic', slot: 'feet', style: 'infernal',
    rollKeys: ['defense', 'moveSpeed'], base: { defense: 6, moveSpeed: 3 },
    passive: { effect: 'relic', text: 'A piece of the Ossuary Watch.' },
    lore: 'Made for the long walk down the Bone Hall and, it turned out, not for the walk back.',
  }),
  // ── Garb of the Drowned Abbey: what the sisters wore under the water ──
  P({
    id: 'set-abbey-hood', set: 'drowned-abbey', name: 'Abbey Hood', rarity: 'mythic', slot: 'head', style: 'umbral',
    rollKeys: ['spellDamage', 'mana'], base: { spellDamage: 7, mana: 8 },
    passive: { effect: 'relic', text: 'A piece of the Garb of the Drowned Abbey.' },
    lore: 'Wool that has been under the water so long it has forgotten it is wet. It remembers the hymns instead.',
  }),
  P({
    id: 'set-abbey-robe', set: 'drowned-abbey', name: 'Drowned Robe', rarity: 'mythic', slot: 'chest', style: 'umbral',
    rollKeys: ['spellDamage', 'manaRegen'], base: { spellDamage: 8, manaRegen: 0.6 },
    passive: { effect: 'relic', text: 'A piece of the Garb of the Drowned Abbey.' },
    lore: 'Ink-stained to the knee: the sisters copied by lamplight, standing in the nave as it filled.',
  }),
  P({
    id: 'set-abbey-censer-chain', set: 'drowned-abbey', name: 'Censer-Chain', rarity: 'mythic', slot: 'trinket', style: 'umbral',
    rollKeys: ['mana', 'allResist'], base: { mana: 10, allResist: 3 },
    passive: { effect: 'relic', text: 'A piece of the Garb of the Drowned Abbey.' },
    lore: 'The chain the Abbess swung her censer from. The censer is elsewhere; the chain kept the habit of the swing.',
  }),
  P({
    id: 'set-abbey-sandals', set: 'drowned-abbey', name: 'Abbey Sandals', rarity: 'mythic', slot: 'feet', style: 'umbral',
    rollKeys: ['moveSpeed', 'mana'], base: { moveSpeed: 3, mana: 6 },
    passive: { effect: 'relic', text: 'A piece of the Garb of the Drowned Abbey.' },
    lore: 'Reed soles, made for stone that is always an inch under water. They make no sound on it.',
  }),
  // ── Rootcradle Vestments: the moss-priests' ──
  P({
    id: 'set-rootcradle-circlet', set: 'rootcradle', name: 'Rootcradle Circlet', rarity: 'mythic', slot: 'head', style: 'verdant',
    rollKeys: ['life', 'lifeRegen'], base: { life: 9, lifeRegen: 0.5 },
    passive: { effect: 'relic', text: 'A piece of the Rootcradle Vestments.' },
    lore: 'Rootglass woven round a single living twig. The twig has been green for longer than the temple has been drowned.',
  }),
  P({
    id: 'set-rootcradle-wrap', set: 'rootcradle', name: 'Rootcradle Wrap', rarity: 'mythic', slot: 'chest', style: 'verdant',
    rollKeys: ['life', 'defense'], base: { life: 12, defense: 6 },
    passive: { effect: 'relic', text: 'A piece of the Rootcradle Vestments.' },
    lore: 'Moss on a linen of bark-strip. The priests slept in it so the Cradle would know their breathing.',
  }),
  P({
    id: 'set-rootcradle-bracers', set: 'rootcradle', name: 'Rootcradle Bracers', rarity: 'mythic', slot: 'hands', style: 'verdant',
    rollKeys: ['castSpeed', 'lifeRegen'], base: { castSpeed: 4, lifeRegen: 0.5 },
    passive: { effect: 'relic', text: 'A piece of the Rootcradle Vestments.' },
    lore: 'Worn to tend the roots by hand. The grooves in them are the shapes of roots.',
  }),
  P({
    id: 'set-rootcradle-greaves', set: 'rootcradle', name: 'Rootcradle Greaves', rarity: 'mythic', slot: 'legs', style: 'verdant',
    rollKeys: ['life', 'defense'], base: { life: 9, defense: 6 },
    passive: { effect: 'relic', text: 'A piece of the Rootcradle Vestments.' },
    lore: 'Bound with living bast. Stand still in them and you start to feel the floor give a little, like soil.',
  }),
  // ── The Lamplighter's Things: someone keeps leaving them for you ──
  P({
    id: 'set-lamplighter-lantern', set: 'lamplighters-things', name: "Lamplighter's Lantern", rarity: 'mythic', slot: 'off-hand', style: 'luminous',
    rollKeys: ['mana', 'manaRegen'], base: { mana: 10, manaRegen: 0.6 },
    passive: { effect: 'relic', text: 'A piece of the Lamplighter\'s Things.' },
    lore: 'Lit when you find it, though no one has been near. The wick never shortens.',
  }),
  P({
    id: 'set-lamplighter-coat', set: 'lamplighters-things', name: "Lamplighter's Coat", rarity: 'mythic', slot: 'chest', style: 'luminous',
    rollKeys: ['defense', 'life'], base: { defense: 7, life: 10 },
    passive: { effect: 'relic', text: 'A piece of the Lamplighter\'s Things.' },
    lore: 'Smells of lamp oil and rain. Folded, with a note in the pocket that only says: you left this.',
  }),
  P({
    id: 'set-lamplighter-gloves', set: 'lamplighters-things', name: "Lamplighter's Gloves", rarity: 'mythic', slot: 'hands', style: 'luminous',
    rollKeys: ['castSpeed', 'critChance'], base: { castSpeed: 4, critChance: 2 },
    passive: { effect: 'relic', text: 'A piece of the Lamplighter\'s Things.' },
    lore: 'Scorched at the fingertips from a hundred wicks trimmed in a hurry.',
  }),
  P({
    id: 'set-lamplighter-signet', set: 'lamplighters-things', name: "Lamplighter's Ring", rarity: 'mythic', slot: 'trinket', style: 'luminous',
    rollKeys: ['allResist', 'life'], base: { allResist: 3, life: 8 },
    passive: { effect: 'relic', text: 'A piece of the Lamplighter\'s Things.' },
    lore: 'A plain band with a flame stamped inside it, where only the wearer would see.',
  }),
];

/** The four sets. Bonus tiers are cumulative: the full set also holds the 2- and 3-piece tiers. */
export const ITEM_SETS: readonly ItemSet[] = [
  {
    id: 'ossuary-watch', name: 'The Ossuary Watch',
    lore: 'The Ashen Bastion\'s garrison kit, left on the dead where they fell.',
    where: 'The Ashen Crypt · Floors 1–2',
    pieces: ['set-ossuary-helm', 'set-ossuary-hauberk', 'set-ossuary-bulwark', 'set-ossuary-boots'],
    bonuses: [
      { at: 2, defensePct: 10 },
      { at: 3, sig: { raisedMax: 1 } },
      { at: 4, sig: { ranks: { 'skeleton-mastery': 2 } }, stats: { spellDamage: 10 } },
    ],
    source: { creatures: ['bone-archer', 'ash-ghoul', 'bone-dragon'], minLevel: 8 },
  },
  {
    id: 'drowned-abbey', name: 'Garb of the Drowned Abbey',
    lore: 'What the abbey\'s sisters wore under the water.',
    where: 'The Drowned Crypts and the dead of the Umbral Marches',
    pieces: ['set-abbey-hood', 'set-abbey-robe', 'set-abbey-censer-chain', 'set-abbey-sandals'],
    bonuses: [
      { at: 2, stats: { spellDamage: 15 } },
      { at: 3, stats: { manaRegen: 1 }, sig: { mf: 20 } },
      { at: 4, sig: { ranks: { 'dark-ward': 2 }, ink: { pct: 10, secs: 3 } } },
    ],
    source: { creatures: ['drowned-knight', 'gloam-witch', 'ink-hound', 'ink-abbess'], minLevel: 32 },
  },
  {
    id: 'rootcradle', name: 'Rootcradle Vestments',
    lore: 'The moss-priests kept them; the temple kept the priests.',
    where: 'The Overgrown Temple · Floors 4–5',
    pieces: ['set-rootcradle-circlet', 'set-rootcradle-wrap', 'set-rootcradle-bracers', 'set-rootcradle-greaves'],
    bonuses: [
      { at: 2, stats: { lifeRegen: 1.5 } },
      { at: 3, stats: { life: 30 } },
      { at: 4, stats: { allResist: 10 }, sig: { stillRegen: 2 } },
    ],
    source: { creatures: ['thorn-weaver', 'drowned-acolyte', 'elder-rootwyrm'], minLevel: 28 },
  },
  {
    id: 'lamplighters-things', name: "The Lamplighter's Things",
    lore: 'Someone keeps leaving them for you.',
    where: 'The shade chests of the five crypts and mines',
    pieces: ['set-lamplighter-lantern', 'set-lamplighter-coat', 'set-lamplighter-gloves', 'set-lamplighter-signet'],
    bonuses: [
      { at: 2, sig: { light: 2 } },
      { at: 3, sig: { mf: 10 } },
      { at: 4, sig: { light: 2 } },
    ],
    source: {
      creatures: [], minLevel: 1,
      chests: {
        galleries: 'set-lamplighter-lantern', 'bone-hall': 'set-lamplighter-coat', smithies: 'set-lamplighter-gloves',
        sporewell: 'set-lamplighter-signet', cloister: null,
      },
    },
  },
];

const SET_BY_ID = new Map(ITEM_SETS.map(s => [s.id, s]));
const PIECE_BY_ID = new Map(SET_PIECES.map(p => [p.id, p]));

export function setById(id: string | undefined): ItemSet | undefined { return id ? SET_BY_ID.get(id) : undefined; }
export function setPieceById(id: string | undefined): SetPiece | undefined { return id ? PIECE_BY_ID.get(id) : undefined; }
export function isSetPiece(id: string | undefined): boolean { return !!id && PIECE_BY_ID.has(id); }
/** The set a piece belongs to. */
export function setOfPiece(id: string | undefined): ItemSet | undefined { return setById(setPieceById(id)?.set); }

/** The tier names on the card: "2 pieces", "3 pieces", "Full set". */
export function tierWord(set: ItemSet, b: SetBonus): '2' | '3' | 'full' {
  return b.at >= set.pieces.length ? 'full' : b.at >= 3 ? '3' : '2';
}

/** Distinct pieces of each set among the worn definition ids (a double of one piece, or an unknown id, counts once / not at all). */
export function setCounts(worn: readonly string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const id of new Set(worn)) {
    const p = PIECE_BY_ID.get(id);
    if (p) out.set(p.set, (out.get(p.set) ?? 0) + 1);
  }
  return out;
}

/** Every tier that is on for these worn ids, set by set, lowest first. */
export function activeBonuses(worn: readonly string[]): { set: ItemSet; bonus: SetBonus }[] {
  const counts = setCounts(worn), out: { set: ItemSet; bonus: SetBonus }[] = [];
  for (const [id, n] of counts) {
    const set = SET_BY_ID.get(id)!;
    for (const bonus of set.bonuses) if (n >= bonus.at) out.push({ set, bonus });
  }
  return out;
}

/** The worn combat totals with every active set tier on top (td-skills wornCombat → fightStats). Unchanged when no set is worn. */
export function addSetBonuses(gear: Partial<ItemStats>, worn: readonly string[]): Partial<ItemStats> {
  const on = activeBonuses(worn);
  if (!on.length) return gear;
  const out: Partial<ItemStats> = { ...gear };
  let pct = 0;
  for (const { bonus } of on) {
    for (const [k, n] of Object.entries(bonus.stats ?? {}) as [keyof ItemStats, number][]) out[k] = ((out[k] as number | undefined) ?? 0) + n;
    pct += bonus.defensePct ?? 0;
  }
  if (pct) out.defense = Math.round(((out.defense as number | undefined) ?? 0) * (1 + pct / 100));
  return out;
}

/** The ids the fight reads for the set tiers that carry a signature: `set:<set>:<at>` (see `setSigOf`). */
export function setSigIds(worn: readonly string[]): string[] {
  return activeBonuses(worn).filter(a => a.bonus.sig).map(a => `set:${a.set.id}:${a.bonus.at}`);
}
/** The signature behind a `setSigIds` id (anything else: undefined). */
export function setSigOf(id: string): RelicSig | undefined {
  const m = /^set:([a-z-]+):(\d+)$/.exec(id);
  return m ? SET_BY_ID.get(m[1])?.bonuses.find(b => b.at === +m[2])?.sig : undefined;
}

/** A piece's chance per kill, by rank, before Magic Find. */
export const SET_CHANCE: Readonly<Record<MonsterRank, number>> = { normal: .02, champion: .06, unique: .1, boss: .2 };

/** The set a creature's kills may drop a piece of, at this level (undefined: none). */
export function setForKill(creature: string, level: number): ItemSet | undefined {
  return ITEM_SETS.find(s => s.source.creatures.includes(creature) && level >= s.source.minLevel);
}

/** One kill: a piece of its place's set at its chance, or null (any other creature: null, and no roll is spent). */
export function rollSetPiece(ctx: { creature: string; level: number; rank: MonsterRank; magicFind: number }, rng: () => number): SetPiece | null {
  const set = setForKill(ctx.creature, ctx.level);
  if (!set) return null;
  const chance = SET_CHANCE[ctx.rank] * (1 + Math.max(0, Math.min(300, ctx.magicFind)) / 200);
  if (!(rng() < chance)) return null;
  return PIECE_BY_ID.get(set.pieces[Math.min(set.pieces.length - 1, Math.floor(rng() * set.pieces.length))]) ?? null;
}

/** The piece a shade chest holds (a fixed one, or a random piece of its set); null for a chest that holds none. */
export function chestSetPiece(chestId: string, rng: () => number): SetPiece | null {
  for (const s of ITEM_SETS) {
    const held = s.source.chests;
    if (!held || !(chestId in held)) continue;
    const id = held[chestId] ?? s.pieces[Math.min(s.pieces.length - 1, Math.floor(rng() * s.pieces.length))];
    return PIECE_BY_ID.get(id) ?? null;
  }
  return null;
}

/** The shade chests that can hold this piece (its own, and any chest that holds a random piece of its set). */
export function chestsHolding(p: SetPiece): string[] {
  const held = SET_BY_ID.get(p.set)?.source.chests ?? {};
  return Object.entries(held).filter(([, v]) => v === p.id || v === null).map(([k]) => k);
}
