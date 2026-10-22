/**
 * boss-uniques.ts — one named thing per boss (docs/design/design-bible.md §7.2, roadmap §10 item 9: "every boss has a
 * reason to farm it").
 *
 * Each of the ten top-down bosses (`rank: 'boss'` in play/td/td-mobs.ts) carries one unique that drops from it and
 * from nothing else: never the Gambler, never another creature's unique roll (unique-items.ts `uniquesAtRarity` and
 * drop-tables.ts leave them out), only `rollBossUnique` on that boss's kill. Each has a **signature** the fight really
 * applies (play/td/td-mobs.ts reads `relicTotals` of what is worn); the card shows it with where it is found.
 *
 * Pure data and pure functions; skill ids are plain strings so this leaf never imports the play chunk.
 */
import type { UniqueItem } from './unique-items';

/** What a worn boss unique does in the top-down fight. Every field is summed over what is worn (relicTotals). */
export interface RelicSig {
  /** Tiles added to the Keeper's own light. */
  light?: number;
  /** Ranks added to a skill the Keeper has learnt (td-skills ids). */
  ranks?: Readonly<Record<string, number>>;
  /** Seconds off a spell's cooldown. */
  cdCut?: Readonly<Record<string, number>>;
  /** % more damage on constructs (the riveted and the glass: creature family maw / prism, the golems). */
  construct?: number;
  /** More raised skeletons may stand at once. */
  raisedMax?: number;
  /** A raised skeleton's first blow is a breath of fire: this many times its blow. */
  breath?: number;
  /** % more fire damage (multiplies Ember Mastery's). */
  fire?: number;
  /** The staff's bolt sets its foe smouldering: fire damage a second, for so many seconds. */
  singe?: { dps: number; secs: number };
  /** Life back a second, always; and the whole regeneration × this while standing still. */
  regen?: number;
  stillRegen?: number;
  /** More missiles: spears in a Bone Storm, arrows in a Volley (td-skills castVars); and tiles added to a Bone Spear's flight. */
  spears?: number;
  spearRange?: number;
  /** Every spell hit stains its foe with ink: it takes `pct`% more from every hit for `secs` seconds. */
  ink?: { pct: number; secs: number };
  /** Percentage points of Magic Find on every kill's loot roll (the item sets' tiers, set-items.ts). */
  mf?: number;
  /** % harder every hit the Keeper lands while the sky is dark (night, or an eclipse) — the Seam Eater's. */
  umbra?: number;
  // ── The ordinary uniques' passives (unique-items.ts `sig`) ──
  /** % more Hunting XP from every kill. */
  xp?: number;
  /** % more Gold in every kill's pile (before Gold Find, which lifts it at pickup). */
  gold?: number;
  /** % of every creature's melee blow (as it swings, before the Keeper's guards) turned back on it. */
  thorns?: number;
  /** Every `every`-th hit the Keeper lands (spells, bolts, swings, their burns) lands `pct`% harder. */
  echo?: { every: number; pct: number };
  /** Once every `mercy` seconds, a blow that would fell the Keeper leaves him at 1 life. */
  mercy?: number;
  /** Mana back on every kill. */
  manaKill?: number;
  /** % likelier that a loot roll landing on a rung with named uniques is one of them (drop-tables UNIQUE_SHARE). */
  named?: number;
}

/** A boss unique: a UniqueItem with the boss it drops from, its chance (1 in `oneIn`), where it is and its signature. */
export interface BossUnique extends UniqueItem {
  boss: string;
  oneIn: number;
  /** The boss's lair, as the card's "Found in" line names it. */
  lair: string;
  sig: RelicSig;
}

/**
 * The nine. Gold (legendary) like every boss's best; the stats roll as any gear of the slot at the boss's level
 * (item-affixes.ts), the signature is the named part. Chances: the starter boss 1 in 6 (the bible's normal), the
 * deeper ones rarer, the act bosses 1 in 10.
 */
export const BOSS_UNIQUES: readonly BossUnique[] = [
  {
    id: 'unique-wardens-last-ember', name: "Warden's Last Ember", rarity: 'legendary', slot: 'trinket', style: 'infernal',
    rollKeys: ['life', 'fireResist'], base: { life: 8, fireResist: 6 },
    passive: { effect: 'relic', text: 'Your own light reaches 2 tiles further, and your Ember Bolt holds 1 rank more.' },
    lore: 'It kept the mine lit after the miners left. Whatever it was banking, it is still banking it.',
    boss: 'ember-warden', oneIn: 6, lair: 'Ember Mine · Floor 3', sig: { light: 2, ranks: { 'ember-bolt': 1 } },
  },
  {
    // The Hushed Barrow's own (shared/sexton, the Sexton's Count): it lies on the forty-first grave, and the chain hands
    // the first one over cursed (a Hollow Ward, frozen at the find). Afterwards the Uncounted keeps rising, and keeps it.
    id: 'unique-sextons-lost-cowl', name: "Sexton's Lost Cowl", rarity: 'legendary', slot: 'head', style: 'neutral',
    rollKeys: ['life', 'lifeRegen'], base: { life: 8, lifeRegen: 0.4 },
    passive: { effect: 'relic', text: 'Your own light reaches 2 tiles further.' },
    lore: 'He lost it the night he counted forty-one. The Sexton counted it twice.',
    boss: 'the-uncounted', oneIn: 6, lair: 'The Hushed Barrow · The Vault', sig: { light: 2 },
  },
  {
    id: 'unique-tyrants-crucible', name: "Tyrant's Crucible", rarity: 'legendary', slot: 'off-hand', style: 'infernal',
    rollKeys: ['spellDamage', 'mana'], base: { spellDamage: 6, mana: 6 },
    passive: { effect: 'relic', text: 'Meteor cools 2 seconds sooner.' },
    lore: 'A crucible that never cools. The caldera poured its crown in this, and the crown poured badly.',
    boss: 'magma-tyrant', oneIn: 7, lair: 'The Molten Deep · Floor 3', sig: { cdCut: { meteor: 2 } },
  },
  {
    id: 'unique-hammer-first-watch', name: 'Hammer of the First Watch', rarity: 'legendary', slot: 'weapon', style: 'infernal',
    rollKeys: ['attackDamage', 'critChance'], base: { attackDamage: 6, critChance: 2 },
    passive: { effect: 'relic', text: 'Cinder Cleave holds 2 ranks more, and every hit lands 20% harder on constructs.' },
    lore: 'Four smithies. One hammer they all agreed on. The anvil kept it when the smiths stopped coming down.',
    boss: 'anvil-warden', oneIn: 7, lair: 'The Forge of the Four · Floor 3', sig: { ranks: { 'cinder-cleave': 2 }, construct: 20 },
  },
  {
    id: 'unique-ashbone-phylactery', name: 'Ashbone Phylactery', rarity: 'legendary', slot: 'trinket', style: 'infernal',
    rollKeys: ['life', 'allResist'], base: { life: 8, allResist: 3 },
    passive: { effect: 'relic', text: 'One more skeleton may stand at once, each one\'s first blow is a breath of fire (3× its blow), and Bone Spear flies 3 tiles further.' },
    lore: 'The dragon kept its last heat in a bone. Hold it to your ear and the Bastion is still burning.',
    boss: 'bone-dragon', oneIn: 8, lair: 'The Ashen Crypt · Floor 2', sig: { raisedMax: 1, breath: 3, spearRange: 3 },
  },
  {
    id: 'unique-crown-banked-coal', name: 'Crown of the Banked Coal', rarity: 'legendary', slot: 'head', style: 'infernal',
    rollKeys: ['defense', 'fireResist'], base: { defense: 5, fireResist: 5 },
    passive: { effect: 'relic', text: '+15% fire damage, and your staff\'s bolts leave their foe smouldering (5 fire a second for 3 seconds).' },
    lore: 'It banked the heat to keep the seam shut. Wear it and you can feel the seam leaning on the other side.',
    boss: 'cinder-sovereign', oneIn: 10, lair: 'The Molten Deep · Floor 6', sig: { fire: 15, singe: { dps: 5, secs: 3 } },
  },
  {
    id: 'unique-mossbound-heart', name: 'Mossbound Heart', rarity: 'legendary', slot: 'chest', style: 'verdant',
    rollKeys: ['life', 'lifeRegen'], base: { life: 10, lifeRegen: 0.6 },
    passive: { effect: 'relic', text: '+2 life a second, and your life comes back twice as fast while you stand still.' },
    lore: 'It stood so long the moss gave it a heartbeat. It is slow, and it does not stop.',
    boss: 'mossbound-colossus', oneIn: 8, lair: 'The Overgrown Temple · Floor 3', sig: { regen: 2, stillRegen: 2 },
  },
  {
    id: 'unique-splinterbow-rootcradle', name: 'Splinterbow of the Rootcradle', rarity: 'legendary', slot: 'weapon', style: 'verdant',
    rollKeys: ['attackDamage', 'pierceChance'], base: { attackDamage: 6, pierceChance: 4 },
    passive: { effect: 'relic', text: 'Volley holds 2 ranks more, and looses 2 more arrows.' },
    lore: 'Splinters of rootglass that remember the tree. Draw it and the Cradle\'s coils creak somewhere under you.',
    boss: 'elder-rootwyrm', oneIn: 9, lair: 'The Overgrown Temple · Floor 5', sig: { ranks: { volley: 2 }, spears: 2 },
  },
  {
    id: 'unique-abbess-censer', name: "The Abbess's Censer", rarity: 'legendary', slot: 'off-hand', style: 'umbral',
    rollKeys: ['spellDamage', 'manaRegen'], base: { spellDamage: 6, manaRegen: 0.6 },
    passive: { effect: 'relic', text: 'Every spell that hits stains its foe with ink: for 3 seconds it takes 10% more from every hit.' },
    lore: 'She swung it over the drowned for a hundred years. The ink in it is everything the abbey ever wrote down.',
    boss: 'ink-abbess', oneIn: 10, lair: 'The Drowned Crypts · Floor 3', sig: { ink: { pct: 10, secs: 3 } },
  },
  {
    // The eclipse's world boss (play/td/td-seam.ts): it rises at the rifts under an eclipse and its fall opens the tiers.
    id: 'unique-seamstitch-grips', name: 'Seamstitch Grips', rarity: 'legendary', slot: 'hands', style: 'umbral',
    rollKeys: ['defense', 'life'], base: { defense: 6, life: 8 },
    passive: { effect: 'relic', text: 'While the sky is dark (night or an eclipse), every hit you land is 20% harder.' },
    lore: 'The bone thread the Seamworks stitched it shut with. It held for a while. It still remembers which side it was on.',
    boss: 'seam-eater-risen', oneIn: 8, lair: 'The Ninefold Stones, Ember Isle', sig: { umbra: 20 },
  },
];

const BY_ID = new Map(BOSS_UNIQUES.map(u => [u.id, u]));
const BY_BOSS = new Map(BOSS_UNIQUES.map(u => [u.boss, u]));

export function bossUniqueById(id: string | undefined): BossUnique | undefined { return id ? BY_ID.get(id) : undefined; }
/** The unique a boss keeps (undefined for anything that is not one of the nine). */
export function bossUniqueFor(creature: string): BossUnique | undefined { return BY_BOSS.get(creature); }
export function isBossUnique(id: string | undefined): boolean { return !!id && BY_ID.has(id); }

/** One kill of `creature`: its unique, at its chance, or null (any other creature: always null, and no roll is spent). */
export function rollBossUnique(creature: string, rng: () => number): BossUnique | null {
  const u = BY_BOSS.get(creature);
  if (!u) return null;
  return rng() < 1 / u.oneIn ? u : null;
}

/** Everything the worn boss uniques add, summed (unknown ids and doubles of one id count once). */
export interface RelicTotals {
  light: number; ranks: Record<string, number>; cdCut: Record<string, number>; construct: number; raisedMax: number;
  breath: number; fire: number; singe: { dps: number; secs: number } | null; regen: number; stillRegen: number;
  spears: number; spearRange: number; ink: { pct: number; secs: number } | null; mf: number; umbra: number;
  xp: number; gold: number; thorns: number; echo: readonly { every: number; pct: number }[]; mercy: number; manaKill: number; named: number;
}
export const NO_RELICS: RelicTotals = Object.freeze({
  light: 0, ranks: {}, cdCut: {}, construct: 0, raisedMax: 0, breath: 0, fire: 0, singe: null, regen: 0, stillRegen: 1,
  spears: 0, spearRange: 0, ink: null, mf: 0, umbra: 0, xp: 0, gold: 0, thorns: 0, echo: [], mercy: 0, manaKill: 0, named: 0,
}) as RelicTotals;

export function relicTotals(ids: readonly string[], extra?: (id: string) => RelicSig | undefined): RelicTotals {
  const out: RelicTotals = { ...NO_RELICS, ranks: {}, cdCut: {}, echo: [] };
  for (const id of new Set(ids)) {
    // `extra` names signatures that are not a boss unique's (the item sets' tiers, set-items.ts setSigOf).
    const s = BY_ID.get(id)?.sig ?? extra?.(id);
    if (!s) continue;
    out.light += s.light ?? 0;
    for (const [k, n] of Object.entries(s.ranks ?? {})) out.ranks[k] = (out.ranks[k] ?? 0) + n;
    for (const [k, n] of Object.entries(s.cdCut ?? {})) out.cdCut[k] = (out.cdCut[k] ?? 0) + n;
    out.construct += s.construct ?? 0;
    out.raisedMax += s.raisedMax ?? 0;
    out.breath = Math.max(out.breath, s.breath ?? 0);
    out.fire += s.fire ?? 0;
    if (s.singe) out.singe = { dps: (out.singe?.dps ?? 0) + s.singe.dps, secs: Math.max(out.singe?.secs ?? 0, s.singe.secs) };
    out.regen += s.regen ?? 0;
    out.stillRegen = Math.max(out.stillRegen, s.stillRegen ?? 1);
    out.spears += s.spears ?? 0;
    out.spearRange += s.spearRange ?? 0;
    out.mf += s.mf ?? 0;
    out.umbra += s.umbra ?? 0;
    if (s.ink) out.ink = { pct: (out.ink?.pct ?? 0) + s.ink.pct, secs: Math.max(out.ink?.secs ?? 0, s.ink.secs) };
    out.xp += s.xp ?? 0;
    out.gold += s.gold ?? 0;
    out.thorns += s.thorns ?? 0;
    // Each worn echo keeps its own beat (two pieces: both, on their own counts).
    if (s.echo) out.echo = [...out.echo, s.echo];
    // The quickest mercy wins (it is one reprieve, not two).
    if (s.mercy) out.mercy = out.mercy > 0 ? Math.min(out.mercy, s.mercy) : s.mercy;
    out.manaKill += s.manaKill ?? 0;
    out.named += s.named ?? 0;
  }
  return out;
}

/** Life back a second: the worn regeneration plus the relics', × the Mossbound Heart's while the Keeper stands still. */
export function relicRegen(base: number, r: RelicTotals, still: boolean): number {
  // A curse's drain (a negative base, shared/grave-goods) is not doubled by standing still; regeneration is.
  const n = base + r.regen;
  return still && n > 0 ? n * r.stillRegen : n;
}
