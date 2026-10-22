/**
 * unique-items.ts — the fifty-two named things, and what makes each one named.
 *
 * A normal definition is a *kind* of object: there are many Astral Helms and the
 * only thing separating yours from anyone else's is the roll. A unique is a
 * specific object with a history, and finding one is meant to be an event rather
 * than an inventory line.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT MAKES A UNIQUE UNIQUE — AND WHAT DOES NOT
 * ─────────────────────────────────────────────────────────────────────────────
 * Uniques still roll. That is the point of putting them in this system at all:
 * "Void's Whisper" is guaranteed to carry Magic Find, and how *much* Magic Find
 * is the same gamble as everything else. A unique with fixed numbers would be a
 * thing you find once and never look at again, which is exactly the failure the
 * roll system was built to fix.
 *
 * What a unique adds on top is a **passive** — one line of rules text no rolled
 * item can produce, and it is real: `sig` is what the top-down fight applies
 * while the piece is worn (the same RelicSig the boss uniques and the set tiers
 * carry, summed by boss-uniques.ts `relicTotals` and read by play/td/td-mobs.ts:
 * Magic Find, Hunting XP, the Gold pile, thorns, an echoing hit, a reprieve, mana
 * per kill, a pull toward named things, life a second). `passive.text` says
 * exactly that, and play/td/td-truth-passives.spec.ts measures every one of them
 * in a real fight: a unique with no `sig`, or a `sig` field with no probe, fails.
 * `passive.effect` names the family (which kind of passive it is).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THEY ARE A SEPARATE FILE AND NOT `ITEM_DEFINITIONS` ENTRIES
 * ─────────────────────────────────────────────────────────────────────────────
 * They *become* `ItemDefinition`s — `UNIQUE_DEFINITIONS` below is spread into
 * the catalogue, so every existing consumer (mint, reforge, temper, the paper
 * doll, the Collection Log) handles them with no special case at all. The file
 * boundary is editorial, not technical: the Keeper kit in item-definition.ts is
 * a balance table that gets retuned, and this is a list of named objects with
 * lore that gets *added to*. Mixing them means every new unique is a diff on the
 * same file as the balance numbers.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RARITY IS AUTHORED, NOT ROLLED
 * ─────────────────────────────────────────────────────────────────────────────
 * Each unique names the rarity it drops at. A "Legendary" charm that could turn
 * up Common would be a different object with the same name, and the whole point
 * of a named item is that there is one of it. The Gambler honours this: a box
 * only offers a unique whose authored rarity is inside the box's own range.
 *
 * Pure data. No Angular, no browser APIs, SSR-safe.
 */
import type { ItemDefinition, ItemStatKey, ItemStyle } from './item-definition';
import type { ItemRarity, ItemStats, SlotId } from './item.model';
import type { AuraId } from '../loot/auras';
import { BOSS_UNIQUES, type RelicSig } from './boss-uniques';
import type { WornLookSpec } from '../keeper-look/worn-look.model';
import { SET_PIECES, setSigOf } from './set-items';

/**
 * The family a passive belongs to (what kind of thing it does: see `sig` for the
 * numbers the fight applies). Consumers switch on `sig`, never on the name.
 *
 *   guaranteed-mf, loot-bias → `mf`   xp-echo → `xp`   gold-surge → `gold`
 *   ward-mirror → `thorns`   strike-double → `echo`   temper-mercy → `mercy`
 *   reforge-memory → `manaKill`   rarity-pull → `named`   idle-drift → `regen`
 */
export type UniqueEffect =
  | 'guaranteed-mf'
  | 'gold-surge'
  | 'xp-echo'
  | 'ward-mirror'
  | 'strike-double'
  | 'loot-bias'
  | 'temper-mercy'
  | 'reforge-memory'
  | 'rarity-pull'
  | 'idle-drift'
  /** A boss unique's signature (boss-uniques.ts): the top-down fight reads it through `relicTotals`. */
  | 'relic';

export interface UniquePassive {
  effect: UniqueEffect;
  /** The rules line the player reads. Written as a fact, never as a stat. */
  text: string;
}

export interface UniqueItem {
  id: string;
  name: string;
  /** The one rarity this object exists at. See the header. */
  rarity: ItemRarity;
  slot?: SlotId;
  style: ItemStyle;
  rollKeys: readonly ItemStatKey[];
  base: Partial<ItemStats>;
  passive: UniquePassive;
  /** What the passive does in the top-down fight while worn (boss-uniques.ts RelicSig; relicTotals sums it). */
  sig?: RelicSig;
  lore: string;
  /** Charms sit in the charm wells; everything else is worn or held. */
  charm?: boolean;
  /** Named and unsellable. Reserved for the two the Archivum would not price. */
  soulbound?: boolean;
  /**
   * A D2-style aura the object carries while worn (loot/auras.ts), at a level
   * from its rarity (loot/aura-sources.ts). Rules text, not a stat: it shows on
   * the item card and the Keeper walks with its ring.
   */
  aura?: AuraId;
  /**
   * The boss it drops from, and from nothing else (boss-uniques.ts). Set only on
   * the eight boss uniques; the Gambler and every creature's ordinary unique
   * roll leave these out.
   */
  boss?: string;
  /**
   * The item set it belongs to (set-items.ts). Set only on the sixteen set pieces: like a boss unique, a piece reaches
   * the player by its own path (a creature of its place, a shade chest), never the Gambler or an open unique roll.
   */
  set?: string;
  /**
   * How it looks WORN on the Keeper (keeper-look/worn-look.model.ts): its silhouette, tones and details — glowing eyes,
   * runes, horns, embers… A new unique writes its look here, beside its lore; the uniques that shipped before this field
   * have theirs in keeper-look/worn-looks.data.ts. Without one, the look is derived from the icon and the base type.
   */
  look?: WornLookSpec;
}

/**
 * Fifty-two named objects across the ladder (the last eight are the bosses' own).
 *
 * Weighted toward the middle rungs on purpose: a unique the player can actually
 * reach is what teaches them uniques exist, and a table that is all Mythic is a
 * table most players never learn about. The Singulars are the only entries
 * that are also soulbound — an object with one copy in the world should not have
 * a sale price, because naming a price is the game admitting there could be two.
 */
export const UNIQUE_ITEMS: readonly UniqueItem[] = [
  // ── Uncommon: the ones you meet first ────────────────────────────────────
  {
    id: 'unique-tinders-due', name: "Tinder's Due", rarity: 'uncommon', slot: 'hands', style: 'infernal',
    rollKeys: ['strikePower', 'goldFind'], base: { strikePower: 1.4, goldFind: 0.2 },
    passive: { effect: 'strike-double', text: 'Every second hit you land strikes 10% harder.' },
    sig: { echo: { every: 2, pct: 10 } },
    lore: 'A smith left these on the anvil for a apprentice who never came back for them. They were still warm a year later.',
  },
  {
    id: 'unique-lantern-oath', name: 'Lantern Oath', rarity: 'uncommon', slot: 'head', style: 'luminous',
    rollKeys: ['magicFind', 'xpBonus'], base: { magicFind: 1.8, xpBonus: 1.2 },
    passive: { effect: 'guaranteed-mf', text: '+5% Magic Find on every kill\'s loot roll.' },
    sig: { mf: 5 },
    lore: 'Worn by the watch who agreed to keep one light burning between them, and then argued for six years about whose turn it was.',
  },
  {
    id: 'unique-ashfall-wrap', name: 'Ashfall Wrap', rarity: 'uncommon', slot: 'chest', style: 'infernal',
    rollKeys: ['ward', 'goldFind'], base: { ward: 0.9, goldFind: 0.3 },
    passive: { effect: 'ward-mirror', text: 'A creature that strikes you in melee takes 10% of its blow back.' },
    sig: { thorns: 10 },
    lore: 'Sewn from the drop-cloth of a forge that burned down twice and was rebuilt in the same place both times.',
  },
  {
    id: 'unique-copper-witness', name: 'The Copper Witness', rarity: 'uncommon', slot: 'trinket', style: 'neutral',
    rollKeys: ['xpBonus', 'magicFind'], base: { xpBonus: 1.6, magicFind: 1.2 },
    passive: { effect: 'xp-echo', text: 'Every kill gives 5% more Hunting XP.' },
    sig: { xp: 5 },
    lore: 'A cheap coin punched through and hung on a cord, carried by a clerk who outlived every record she kept.',
  },

  // ── Rare: the first ones worth building around ───────────────────────────
  {
    id: 'unique-voids-whisper', name: "Void's Whisper", rarity: 'rare', style: 'void-touched', charm: true,
    rollKeys: ['magicFind'], base: { magicFind: 9 },
    passive: { effect: 'guaranteed-mf', text: '+8% Magic Find on every kill\'s loot roll.' },
    sig: { mf: 8 },
    lore: 'It is not saying anything. It is the shape a sentence leaves when the sentence is removed, and it fits in a pocket.',
  },
  {
    id: 'unique-cinderwake', name: 'Cinderwake', rarity: 'rare', slot: 'weapon', style: 'infernal',
    rollKeys: ['goldFind', 'strikePower'], base: { goldFind: 0.7, strikePower: 1.3 },
    passive: { effect: 'gold-surge', text: 'Every kill\'s Gold pile is 10% bigger.' },
    sig: { gold: 10 },
    lore: 'The edge cooled crooked and nobody straightened it, because crooked is how it caught the seam in the first place.',
    aura: 'holy-fire',
  },
  {
    id: 'unique-stillglass-cowl', name: 'Stillglass Cowl', rarity: 'rare', slot: 'head', style: 'celestial',
    rollKeys: ['xpBonus', 'magicFind'], base: { xpBonus: 3.2, magicFind: 1.6 },
    passive: { effect: 'xp-echo', text: 'Every kill gives 8% more Hunting XP.' },
    sig: { xp: 8 },
    lore: 'Ground from a pane that survived the Shattering by being, at the moment it happened, entirely uninteresting.',
  },
  {
    id: 'unique-thornroot-greaves', name: 'Thornroot Greaves', rarity: 'rare', slot: 'legs', style: 'verdant',
    rollKeys: ['ward', 'magicFind'], base: { ward: 1.1, magicFind: 1.8 },
    passive: { effect: 'loot-bias', text: '+6% Magic Find on every kill\'s loot roll.' },
    sig: { mf: 6 },
    lore: 'They grow a little every season and have to be cut back, which their owners describe as a relationship rather than maintenance.',
  },
  {
    id: 'unique-tally-of-hands', name: 'The Tally of Hands', rarity: 'rare', style: 'neutral', charm: true,
    rollKeys: ['goldFind'], base: { goldFind: 2.4 },
    passive: { effect: 'idle-drift', text: '+1 life a second, always.' },
    sig: { regen: 1 },
    lore: 'Every Keeper who held it added one mark. There are four hundred and eleven marks and eleven known Keepers.',
  },

  // ── Epic: the mid-game chase ─────────────────────────────────────────────
  {
    id: 'unique-mourners-ledger', name: "Mourner's Ledger", rarity: 'epic', slot: 'off-hand', style: 'umbral',
    rollKeys: ['ward', 'magicFind'], base: { ward: 2.2, magicFind: 3 },
    passive: { effect: 'reforge-memory', text: 'Every kill gives back 4 mana.' },
    sig: { manaKill: 4 },
    lore: 'A book of everything the Archivum decided not to keep, kept by the person who was told to burn it.',
  },
  {
    id: 'unique-first-light-pendant', name: 'Pendant of First Light', rarity: 'epic', slot: 'trinket', style: 'luminous',
    rollKeys: ['magicFind', 'xpBonus'], base: { magicFind: 4.5, xpBonus: 3 },
    passive: { effect: 'rarity-pull', text: 'Named uniques are 25% likelier on every kill\'s loot roll.' },
    sig: { named: 25 },
    lore: 'Not a fragment of the First Sun. A very good forgery, made by someone who had seen the real one and was honest about the rest.',
  },
  {
    id: 'unique-anvil-of-small-hours', name: 'Anvil of Small Hours', rarity: 'epic', slot: 'hands', style: 'infernal',
    rollKeys: ['strikePower', 'goldFind'], base: { strikePower: 2.8, goldFind: 0.5 },
    passive: { effect: 'strike-double', text: 'Every third hit you land strikes 50% harder.' },
    sig: { echo: { every: 3, pct: 50 } },
    lore: 'Portable, barely. Its owner carried it up the Verge stair one step at a time over three days and never explained why.',
  },
  {
    id: 'unique-quiet-cuirass', name: 'The Quiet Cuirass', rarity: 'epic', slot: 'chest', style: 'umbral',
    rollKeys: ['ward', 'goldFind'], base: { ward: 2.6, goldFind: 0.6 },
    passive: { effect: 'ward-mirror', text: 'A creature that strikes you in melee takes 20% of its blow back.' },
    sig: { thorns: 20 },
    lore: 'Obsidian scale over mirror-backing. The mirror is not decorative; it is so the wearer has to see what they are absorbing.',
  },
  {
    id: 'unique-hollowmark', name: 'Hollowmark', rarity: 'epic', slot: 'weapon', style: 'void', charm: false,
    rollKeys: ['goldFind', 'xpBonus'], base: { goldFind: 1.6, xpBonus: 3.4 },
    passive: { effect: 'rarity-pull', text: 'Named uniques are 25% likelier on every kill\'s loot roll.' },
    sig: { named: 25 },
    lore: 'The blade is fine. It is the absence running down the centre of it that people ask about, and it has no answer.',
  },
  {
    id: 'unique-verdant-accord', name: 'The Verdant Accord', rarity: 'epic', style: 'verdant', charm: true,
    rollKeys: ['xpBonus', 'goldFind'], base: { xpBonus: 7, goldFind: 1.2 },
    passive: { effect: 'idle-drift', text: '+1.5 life a second, always.' },
    sig: { regen: 1.5 },
    lore: 'Two realms signed it. Neither has enforced a clause in two hundred years and both consider it their finest work.',
  },

  // ── Legendary: the ones players name their builds after ──────────────────
  {
    id: 'unique-crown-of-borrowed-noon', name: 'Crown of Borrowed Noon', rarity: 'legendary', slot: 'head', style: 'celestial',
    rollKeys: ['xpBonus', 'magicFind'], base: { xpBonus: 9, magicFind: 5 },
    passive: { effect: 'xp-echo', text: 'Every kill gives 15% more Hunting XP.' },
    sig: { xp: 15 },
    lore: 'Worn once, at the coronation of a Solarii who abdicated the same afternoon and was never recorded as having reigned.',
  },
  {
    id: 'unique-lastwarden', name: 'Lastwarden', rarity: 'legendary', slot: 'off-hand', style: 'umbral',
    rollKeys: ['ward', 'magicFind'], base: { ward: 5.5, magicFind: 6 },
    passive: { effect: 'temper-mercy', text: 'Once every 90 seconds, a blow that would fell you leaves you standing on one point of life.' },
    sig: { mercy: 90 },
    lore: 'The shield of the guard who stayed at the Verge gate after the order to hold it had been formally withdrawn.',
    aura: 'redemption',
  },
  {
    id: 'unique-goldmouth', name: 'Goldmouth', rarity: 'legendary', slot: 'weapon', style: 'infernal',
    rollKeys: ['goldFind', 'strikePower'], base: { goldFind: 4.2, strikePower: 3 },
    passive: { effect: 'gold-surge', text: 'Every kill\'s Gold pile is 20% bigger.' },
    sig: { gold: 20 },
    lore: 'A blade that pays. The Archivum has four separate rulings on whether that sentence is metaphor and they disagree.',
  },
  {
    id: 'unique-cartographers-regret', name: "Cartographer's Regret", rarity: 'legendary', slot: 'trinket', style: 'celestial',
    rollKeys: ['magicFind'], base: { magicFind: 15 },
    passive: { effect: 'loot-bias', text: '+12% Magic Find on every kill\'s loot roll.' },
    sig: { mf: 12 },
    lore: 'The map it was made to complete was finished by someone else, correctly, from worse instruments, in half the time.',
  },
  {
    id: 'unique-long-account', name: 'The Long Account', rarity: 'legendary', style: 'neutral', charm: true,
    rollKeys: ['xpBonus', 'goldFind', 'magicFind'], base: { xpBonus: 14, goldFind: 2.5, magicFind: 5 },
    passive: { effect: 'reforge-memory', text: 'Every kill gives back 6 mana.' },
    sig: { manaKill: 6 },
    lore: 'Not the whole account. The long one, which is a different document, and the only one anybody finished.',
  },

  // ── Mythic: two, and they are meant to be talked about ───────────────────
  {
    id: 'unique-heartwood-of-the-verge', name: 'Heartwood of the Verge', rarity: 'mythic', slot: 'chest', style: 'verdant',
    rollKeys: ['ward', 'goldFind', 'xpBonus'], base: { ward: 9, goldFind: 5, xpBonus: 10 },
    passive: { effect: 'idle-drift', text: '+3 life a second, always.' },
    sig: { regen: 3 },
    lore: 'Cut from the one tree that was standing on both sides of the Shattering and did not appear to notice.',
    aura: 'prayer',
  },
  {
    id: 'unique-mirror-of-small-mercies', name: 'Mirror of Small Mercies', rarity: 'mythic', slot: 'off-hand', style: 'umbral',
    rollKeys: ['ward', 'magicFind'], base: { ward: 8, magicFind: 19 },
    passive: { effect: 'temper-mercy', text: 'Once every 60 seconds, a blow that would fell you leaves you standing on one point of life.' },
    sig: { mercy: 60 },
    lore: 'It shows you the version of the attempt that went slightly better. This is either kindness or the cruellest thing in the realms.',
  },

  // ── Singular: one each, unsellable. See the header. ──────────────────────
  {
    id: 'unique-the-unstruck-hour', name: 'The Unstruck Hour', rarity: 'singular', slot: 'trinket', style: 'void',
    rollKeys: ['goldFind', 'xpBonus', 'magicFind'], base: { goldFind: 9, xpBonus: 18, magicFind: 12 },
    passive: { effect: 'rarity-pull', text: 'Named uniques are 60% likelier on every kill\'s loot roll.' },
    sig: { named: 60 },
    lore: 'Every bell in the five realms rang at the Shattering except one, and nobody has ever agreed on which.',
    soulbound: true,
  },
  {
    id: 'unique-keepers-second-name', name: "The Keeper's Second Name", rarity: 'singular', style: 'neutral', charm: true,
    rollKeys: ['xpBonus', 'magicFind', 'goldFind'], base: { xpBonus: 24, magicFind: 14, goldFind: 7 },
    passive: { effect: 'guaranteed-mf', text: '+20% Magic Find on every kill\'s loot roll.' },
    sig: { mf: 20 },
    lore: 'A Keeper is issued one name. This is the other one, and reading it aloud is how the Archivum defines a bad afternoon.',
    soulbound: true,
  },

  // ── The Art Bible's twenty named relics ──────────────────────────────────
  //
  // Items 061-070 and 091-100 of the Eclipse Realms Item Art Bible. The Bible
  // files the first ten as "Artifacts" and the last ten as "Singular", but both
  // groups are the same kind of thing by this file's definition: one specific
  // object, with a history, that carries a line of rules text no roll can
  // produce. So they are uniques, not `family: 'artifact'` — that family means
  // "the five things the Market sells", and none of these is for sale.
  //
  // The Singular ten are soulbound for the reason the header gives: naming a
  // price on a one-of-a-kind object is the game admitting there could be two.
  {
    id: 'unique-architect-compass', name: 'The Architect\'s Compass', rarity: 'mythic', slot: 'trinket', style: 'celestial',
    rollKeys: ['magicFind', 'xpBonus'], base: { magicFind: 21.12, xpBonus: 9.9 },
    passive: { effect: 'loot-bias', text: '+15% Magic Find on every kill\'s loot roll.' },
    sig: { mf: 15 },
    lore: 'The Archivist designed this tool to measure the distance between ideas — literally.',
  },
  {
    id: 'unique-heartstone-world-root', name: 'Heartstone of the World-Root', rarity: 'singular', slot: 'trinket', style: 'verdant',
    rollKeys: ['magicFind', 'xpBonus'], base: { magicFind: 26.88, xpBonus: 12.6 },
    passive: { effect: 'idle-drift', text: '+4 life a second, always.' },
    sig: { regen: 4 },
    lore: 'The World-Root\'s heart is a stone. This is that stone — or the closest thing to it that exists outside the Root itself.',
    soulbound: true,
  },
  {
    id: 'unique-first-anvil-fragment', name: 'The First Anvil (Fragment)', rarity: 'mythic', slot: 'hands', style: 'neutral',
    rollKeys: ['strikePower', 'ward', 'magicFind'], base: { strikePower: 7.26, ward: 2.64, magicFind: 7.92 },
    passive: { effect: 'strike-double', text: 'Every third hit you land strikes 75% harder.' },
    sig: { echo: { every: 3, pct: 75 } },
    lore: 'The Godforge had a first anvil, before there were five realms, before there were realms at all.',
  },
  {
    id: 'unique-shadowloom', name: 'Shadowloom', rarity: 'legendary', slot: 'off-hand', style: 'umbral',
    rollKeys: ['ward', 'magicFind'], base: { ward: 5.72, magicFind: 5.2 },
    passive: { effect: 'loot-bias', text: '+12% Magic Find on every kill\'s loot roll.' },
    sig: { mf: 12 },
    lore: 'The Umbral Weavers use full-sized looms to weave shadow into cloth, armor, and concealment.',
  },
  {
    id: 'unique-merchants-scale', name: 'The Merchant\'s Scale', rarity: 'epic', charm: true, style: 'neutral',
    rollKeys: ['magicFind', 'xpBonus', 'goldFind'], base: { magicFind: 14, xpBonus: 12, goldFind: 4 },
    passive: { effect: 'gold-surge', text: 'Every kill\'s Gold pile is 15% bigger.' },
    sig: { gold: 15 },
    lore: 'The Merchant does not haggle. They weigh. This scale measures not mass but value — a concept that incorporates rarity, craftsmanship, desire, and destiny.',
  },
  {
    id: 'unique-pyrograph-scroll-case', name: 'Pyrograph Scroll Case', rarity: 'legendary', slot: 'off-hand', style: 'infernal',
    rollKeys: ['ward', 'magicFind'], base: { ward: 5.72, magicFind: 5.2 },
    passive: { effect: 'xp-echo', text: 'Every kill gives 12% more Hunting XP.' },
    sig: { xp: 12 },
    lore: 'Before the Infernal Realm had a written language, it had this scroll. The Pyrograph writes down everything that happens near the bearer, recording events as they occur in a script of fire.',
  },
  {
    id: 'unique-mirror-meridians', name: 'The Mirror of Meridians', rarity: 'mythic', slot: 'off-hand', style: 'celestial',
    rollKeys: ['ward', 'magicFind'], base: { ward: 7.26, magicFind: 14.52 },
    passive: { effect: 'ward-mirror', text: 'A creature that strikes you in melee takes 30% of its blow back.' },
    sig: { thorns: 30 },
    lore: 'The Archivist made this mirror to solve a problem: they wanted to see what they could not see by looking.',
  },
  {
    id: 'unique-spore-crown', name: 'Spore Crown', rarity: 'legendary', slot: 'head', style: 'verdant',
    rollKeys: ['magicFind', 'xpBonus'], base: { magicFind: 7.8, xpBonus: 5.2 },
    passive: { effect: 'idle-drift', text: '+2 life a second, always.' },
    sig: { regen: 2 },
    lore: 'Fungi are the Verdant Realm\'s communication network. The mycelial web beneath the World-Root carries messages between every living thing in the realm, and this crown connects the wearer to that network.',
  },
  {
    id: 'unique-eclipse-hourglass', name: 'Eclipse Hourglass', rarity: 'singular', slot: 'trinket', style: 'neutral',
    rollKeys: ['magicFind', 'xpBonus'], base: { magicFind: 26.88, xpBonus: 12.6 },
    passive: { effect: 'rarity-pull', text: 'Named uniques are 60% likelier on every kill\'s loot roll.' },
    sig: { named: 60 },
    lore: 'Time in Eclipse Realms is not linear — it spirals, and the spiral has a period. This hourglass measures that period: the interval between Eclipses.',
    soulbound: true,
  },
  {
    id: 'unique-ashen-covenant', name: 'Ashen Covenant', rarity: 'legendary', slot: 'hands', style: 'infernal',
    rollKeys: ['strikePower', 'ward'], base: { strikePower: 5.72, ward: 2.08 },
    passive: { effect: 'temper-mercy', text: 'Once every 90 seconds, a blow that would fell you leaves you standing on one point of life.' },
    sig: { mercy: 90 },
    lore: 'A covenant in the Infernal Realm is sealed not with signatures but with a handshake in fire. This gauntlet allows such handshakes to occur without consuming the flesh.',
  },
  {
    id: 'unique-aureths-mantle', name: 'Aureth\'s Mantle', rarity: 'singular', slot: 'chest', style: 'luminous',
    rollKeys: ['ward', 'goldFind', 'magicFind'], base: { ward: 6.72, goldFind: 2.52, magicFind: 10.08 },
    passive: { effect: 'gold-surge', text: 'Every kill\'s Gold pile is 30% bigger.' },
    sig: { gold: 30 },
    lore: 'Aureth the Radiant wore this mantle during every significant event in the Luminous Realm\'s history: the First Dawn, the Shattering, the Reconstruction, and the Forging of the Treaties.',
    soulbound: true,
  },
  {
    id: 'unique-verrins-requiem', name: 'Verrin\'s Requiem', rarity: 'singular', slot: 'weapon', style: 'umbral',
    rollKeys: ['strikePower', 'goldFind', 'magicFind'], base: { strikePower: 8.4, goldFind: 3.36, magicFind: 10.08 },
    passive: { effect: 'strike-double', text: 'Every fourth hit you land strikes 150% harder.' },
    sig: { echo: { every: 4, pct: 150 } },
    lore: 'Verrin the Hollow forged this blade to answer a question: \'What happens when you cut something with nothing?',
    soulbound: true,
  },
  {
    id: 'unique-archivists-codex', name: 'The Archivist\'s Codex', rarity: 'singular', slot: 'off-hand', style: 'celestial',
    rollKeys: ['ward', 'magicFind'], base: { ward: 9.24, magicFind: 18.48 },
    passive: { effect: 'xp-echo', text: 'Every kill gives 25% more Hunting XP.' },
    sig: { xp: 25 },
    lore: 'The Archivist\'s Codex is not a book — it is a database in book form. It contains the index to every piece of knowledge in the Celestial Realm, cross-referenced, annotated, and updated in real time.',
    soulbound: true,
  },
  {
    id: 'unique-kaels-left-hand', name: 'Kael\'s Left Hand', rarity: 'singular', slot: 'hands', style: 'infernal',
    rollKeys: ['strikePower', 'ward', 'magicFind'], base: { strikePower: 9.24, ward: 3.36, magicFind: 10.08 },
    passive: { effect: 'strike-double', text: 'Every third hit you land strikes 100% harder.' },
    sig: { echo: { every: 3, pct: 100 } },
    lore: 'This is Kael the Broken Flame\'s actual left hand — the original was consumed when he shook hands with the Godforge to seal a covenant.',
    soulbound: true,
  },
  {
    id: 'unique-nameless-crown', name: 'The Nameless Crown', rarity: 'singular', slot: 'head', style: 'neutral',
    rollKeys: ['magicFind', 'xpBonus'], base: { magicFind: 22.68, xpBonus: 8.4 },
    passive: { effect: 'rarity-pull', text: 'Named uniques are 50% likelier on every kill\'s loot roll.' },
    sig: { named: 50 },
    lore: 'The Nameless is the figure who exists in all five realms simultaneously — the founder, the builder, the one who split the world and has spent eternity trying to decide if that was the right choice.',
    soulbound: true,
  },
  {
    id: 'unique-worldsplitter', name: 'Worldsplitter', rarity: 'singular', slot: 'weapon', style: 'neutral',
    rollKeys: ['strikePower', 'goldFind', 'magicFind'], base: { strikePower: 8.4, goldFind: 3.36, magicFind: 10.08 },
    passive: { effect: 'strike-double', text: 'Every second hit you land strikes 60% harder.' },
    sig: { echo: { every: 2, pct: 60 } },
    lore: 'The Nameless used Worldsplitter to perform the Eclipse — the act that divided one world into five realms.',
    aura: 'might',
    soulbound: true,
  },
  {
    id: 'unique-merchants-ledger', name: 'The Merchant\'s Ledger', rarity: 'singular', slot: 'off-hand', style: 'neutral',
    rollKeys: ['ward', 'magicFind'], base: { ward: 9.24, magicFind: 18.48 },
    passive: { effect: 'gold-surge', text: 'Every kill\'s Gold pile is 35% bigger.' },
    sig: { gold: 35 },
    lore: 'The Merchant trades in all five realms and records every transaction in this ledger — not because they must, but because they believe that fair trade is the only true magic.',
    soulbound: true,
  },
  {
    id: 'unique-rootmothers-embrace', name: 'Rootmother\'s Embrace', rarity: 'singular', slot: 'chest', style: 'verdant',
    rollKeys: ['ward', 'goldFind', 'magicFind'], base: { ward: 6.72, goldFind: 2.52, magicFind: 10.08 },
    passive: { effect: 'ward-mirror', text: 'A creature that strikes you in melee takes 40% of its blow back.' },
    sig: { thorns: 40 },
    lore: 'The Rootmother is the oldest consciousness in the Verdant Realm — not a person but the collective awareness of the World-Root\'s primary root system.',
    soulbound: true,
  },
  {
    id: 'unique-forges-memory', name: 'The Forge\'s Memory', rarity: 'singular', slot: 'weapon', style: 'neutral',
    rollKeys: ['strikePower', 'goldFind', 'magicFind'], base: { strikePower: 8.4, goldFind: 3.36, magicFind: 10.08 },
    passive: { effect: 'reforge-memory', text: 'Every kill gives back 10 mana.' },
    sig: { manaKill: 10 },
    lore: 'This is the hammer that was shaped on the First Anvil using the Godforge Tongs — the third tool in the Trinity of Creation.',
    soulbound: true,
  },
  {
    id: 'unique-eclipse-manifest', name: 'Eclipse', rarity: 'singular', charm: true, style: 'neutral',
    rollKeys: ['magicFind', 'xpBonus', 'goldFind'], base: { magicFind: 29.4, xpBonus: 25.2, goldFind: 8.4 },
    passive: { effect: 'guaranteed-mf', text: '+25% Magic Find on every kill\'s loot roll.' },
    sig: { mf: 25 },
    lore: 'The Eclipse was the event that created the five realms — the moment of division, the original wound in reality.',
    soulbound: true,
  },
  // ── The bosses' own (boss-uniques.ts): each drops from its boss alone ──
  ...BOSS_UNIQUES,
  // ── The item sets' pieces (set-items.ts): mythic, each from its own place ──
  ...SET_PIECES,
];

/**
 * First temper price by rarity. Steeper than the Keeper kit's flat 6,000.
 * Economy v3: the v2 bases × 0.12, the same factor the kit's base moved by.
 */
export const UNIQUE_TEMPER_BASE: Readonly<Record<ItemRarity, number>> = {
  common: 4_800,
  uncommon: 7_200,
  rare: 10_800,
  epic: 16_800,
  legendary: 26_400,
  mythic: 48_000,
  singular: 90_000,
};

/**
 * The uniques as ordinary `ItemDefinition`s.
 *
 * Once this is spread into `ITEM_DEFINITIONS`, nothing downstream needs to know
 * a unique is special: mint, reforge, temper and the paper doll all treat it as
 * an equipment or charm definition like any other. `uniqueById` is how the
 * surfaces that *do* care — the discovery animation, the Bestiary entry — get
 * back to the passive and the lore.
 */
export const UNIQUE_DEFINITIONS: readonly ItemDefinition[] = UNIQUE_ITEMS.map(u => ({
  id: u.id,
  name: u.name,
  family: u.charm ? 'charm' : 'equipment',
  // Charms have to be `type: 'charm'` for the charm wells to accept them, and
  // everything worn is `type: 'artifact'` for the same reason the Keeper kit is.
  type: u.charm ? 'charm' : 'artifact',
  slot: u.slot,
  style: u.style,
  rollKeys: u.rollKeys,
  base: u.base,
  temperable: !u.charm,
  maxTemper: u.charm ? 0 : 10,
  // Priced off the rarity so a unique is never a cheaper temper than the
  // ordinary piece it is competing with for the same slot.
  temperGoldBase: UNIQUE_TEMPER_BASE[u.rarity],
  lore: u.lore,
  soulbound: u.soulbound,
}));

const UNIQUE_BY_ID = new Map(UNIQUE_ITEMS.map(u => [u.id, u]));

export function uniqueById(id: string | undefined): UniqueItem | undefined {
  return id ? UNIQUE_BY_ID.get(id) : undefined;
}

/**
 * The signature behind a worn id the fight reads (relicTotals' `extra`): a unique's passive (an ordinary unique's or
 * a boss's), or an item-set tier's (`set:<set>:<at>`, set-items.ts setSigOf).
 */
export function relicSigOf(id: string): RelicSig | undefined {
  return UNIQUE_BY_ID.get(id)?.sig ?? setSigOf(id);
}
/** The worn definition ids whose passive the fight applies (every unique carrying a signature). */
export function sigIds(worn: readonly string[]): string[] {
  return worn.filter(id => !!UNIQUE_BY_ID.get(id)?.sig);
}

/** True when this instance is one of the named objects. */
export function isUnique(item: { definitionId?: string }): boolean {
  return !!item.definitionId && UNIQUE_BY_ID.has(item.definitionId);
}

/**
 * Every unique that drops at exactly this rarity from the open pools (the
 * Gambler, any creature's unique roll). A boss's own unique is never here: it
 * drops from its boss alone (boss-uniques.ts rollBossUnique).
 */
export function uniquesAtRarity(rarity: ItemRarity): UniqueItem[] {
  return UNIQUE_ITEMS.filter(u => u.rarity === rarity && !u.boss && !u.set);
}
