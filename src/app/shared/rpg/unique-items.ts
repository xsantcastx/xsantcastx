/**
 * unique-items.ts — the forty-four named things, and what makes each one named.
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
 * What a unique adds on top is a **passive** — one authored sentence of rules
 * text that no rolled item can produce. The passive is flavour and future
 * mechanics, deliberately in that order: `passive.effect` is a machine-readable
 * tag that nothing reads yet, and `passive.text` is what the player sees today.
 * Shipping the tag now means the day a consumer appears it does not need a save
 * migration to find out which items were supposed to have the effect.
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

/**
 * The machine-readable half of a passive.
 *
 * Nothing consumes these yet and that is on purpose — see the header. When a
 * consumer arrives it switches on this tag, not on the item's name, so renaming
 * "Void's Whisper" for lore reasons cannot silently delete its behaviour.
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
  | 'idle-drift';

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
  lore: string;
  /** Charms sit in the charm wells; everything else is worn or held. */
  charm?: boolean;
  /** Named and unsellable. Reserved for the two the Archivum would not price. */
  soulbound?: boolean;
}

/**
 * Forty-four named objects across the ladder.
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
    rollKeys: ['strikePower', 'goldPerSec'], base: { strikePower: 1.4, goldPerSec: 0.2 },
    passive: { effect: 'strike-double', text: 'The second strike of any pair lands warmer than the first.' },
    lore: 'A smith left these on the anvil for a apprentice who never came back for them. They were still warm a year later.',
  },
  {
    id: 'unique-lantern-oath', name: 'Lantern Oath', rarity: 'uncommon', slot: 'head', style: 'luminous',
    rollKeys: ['magicFind', 'xpBonus'], base: { magicFind: 1.8, xpBonus: 1.2 },
    passive: { effect: 'guaranteed-mf', text: 'Always carries Magic Find, however poorly it rolls.' },
    lore: 'Worn by the watch who agreed to keep one light burning between them, and then argued for six years about whose turn it was.',
  },
  {
    id: 'unique-ashfall-wrap', name: 'Ashfall Wrap', rarity: 'uncommon', slot: 'chest', style: 'infernal',
    rollKeys: ['ward', 'goldPerSec'], base: { ward: 0.9, goldPerSec: 0.3 },
    passive: { effect: 'ward-mirror', text: 'Heat turned aside by this cloth is heat someone else does not have to carry.' },
    lore: 'Sewn from the drop-cloth of a forge that burned down twice and was rebuilt in the same place both times.',
  },
  {
    id: 'unique-copper-witness', name: 'The Copper Witness', rarity: 'uncommon', slot: 'trinket', style: 'neutral',
    rollKeys: ['xpBonus', 'magicFind'], base: { xpBonus: 1.6, magicFind: 1.2 },
    passive: { effect: 'xp-echo', text: 'What it sees, it remembers twice.' },
    lore: 'A cheap coin punched through and hung on a cord, carried by a clerk who outlived every record she kept.',
  },

  // ── Rare: the first ones worth building around ───────────────────────────
  {
    id: 'unique-voids-whisper', name: "Void's Whisper", rarity: 'rare', style: 'void-touched', charm: true,
    rollKeys: ['magicFind'], base: { magicFind: 9 },
    passive: { effect: 'guaranteed-mf', text: 'Always carries Magic Find. How much is the question it will not answer.' },
    lore: 'It is not saying anything. It is the shape a sentence leaves when the sentence is removed, and it fits in a pocket.',
  },
  {
    id: 'unique-cinderwake', name: 'Cinderwake', rarity: 'rare', slot: 'weapon', style: 'infernal',
    rollKeys: ['goldPerSec', 'strikePower'], base: { goldPerSec: 0.7, strikePower: 1.3 },
    passive: { effect: 'gold-surge', text: 'The furnace runs hotter for a moment after every find.' },
    lore: 'The edge cooled crooked and nobody straightened it, because crooked is how it caught the seam in the first place.',
  },
  {
    id: 'unique-stillglass-cowl', name: 'Stillglass Cowl', rarity: 'rare', slot: 'head', style: 'celestial',
    rollKeys: ['xpBonus', 'magicFind'], base: { xpBonus: 3.2, magicFind: 1.6 },
    passive: { effect: 'xp-echo', text: 'Lessons learned under it are harder to unlearn.' },
    lore: 'Ground from a pane that survived the Shattering by being, at the moment it happened, entirely uninteresting.',
  },
  {
    id: 'unique-thornroot-greaves', name: 'Thornroot Greaves', rarity: 'rare', slot: 'legs', style: 'verdant',
    rollKeys: ['ward', 'magicFind'], base: { ward: 1.1, magicFind: 1.8 },
    passive: { effect: 'loot-bias', text: 'Ground walked slowly gives up more than ground walked fast.' },
    lore: 'They grow a little every season and have to be cut back, which their owners describe as a relationship rather than maintenance.',
  },
  {
    id: 'unique-tally-of-hands', name: 'The Tally of Hands', rarity: 'rare', style: 'neutral', charm: true,
    rollKeys: ['goldPerSec'], base: { goldPerSec: 2.4 },
    passive: { effect: 'idle-drift', text: 'It keeps counting while you are not looking.' },
    lore: 'Every Keeper who held it added one mark. There are four hundred and eleven marks and eleven known Keepers.',
  },

  // ── Epic: the mid-game chase ─────────────────────────────────────────────
  {
    id: 'unique-mourners-ledger', name: "Mourner's Ledger", rarity: 'epic', slot: 'off-hand', style: 'umbral',
    rollKeys: ['ward', 'lootBonus'], base: { ward: 2.2, lootBonus: 3 },
    passive: { effect: 'reforge-memory', text: 'It remembers the roll you gave up on.' },
    lore: 'A book of everything the Archivum decided not to keep, kept by the person who was told to burn it.',
  },
  {
    id: 'unique-first-light-pendant', name: 'Pendant of First Light', rarity: 'epic', slot: 'trinket', style: 'luminous',
    rollKeys: ['magicFind', 'xpBonus'], base: { magicFind: 4.5, xpBonus: 3 },
    passive: { effect: 'rarity-pull', text: 'What it finds tends to be worth the finding.' },
    lore: 'Not a fragment of the First Sun. A very good forgery, made by someone who had seen the real one and was honest about the rest.',
  },
  {
    id: 'unique-anvil-of-small-hours', name: 'Anvil of Small Hours', rarity: 'epic', slot: 'hands', style: 'infernal',
    rollKeys: ['strikePower', 'goldPerSec'], base: { strikePower: 2.8, goldPerSec: 0.5 },
    passive: { effect: 'strike-double', text: 'Work done when nobody is watching counts twice.' },
    lore: 'Portable, barely. Its owner carried it up the Verge stair one step at a time over three days and never explained why.',
  },
  {
    id: 'unique-quiet-cuirass', name: 'The Quiet Cuirass', rarity: 'epic', slot: 'chest', style: 'umbral',
    rollKeys: ['ward', 'goldPerSec'], base: { ward: 2.6, goldPerSec: 0.6 },
    passive: { effect: 'ward-mirror', text: 'It turns a blow aside rather than pretending the blow did not land.' },
    lore: 'Obsidian scale over mirror-backing. The mirror is not decorative; it is so the wearer has to see what they are absorbing.',
  },
  {
    id: 'unique-hollowmark', name: 'Hollowmark', rarity: 'epic', slot: 'weapon', style: 'void', charm: false,
    rollKeys: ['goldPerSec', 'xpBonus'], base: { goldPerSec: 1.6, xpBonus: 3.4 },
    passive: { effect: 'rarity-pull', text: 'It cuts toward what is rare, which is not always what is useful.' },
    lore: 'The blade is fine. It is the absence running down the centre of it that people ask about, and it has no answer.',
  },
  {
    id: 'unique-verdant-accord', name: 'The Verdant Accord', rarity: 'epic', style: 'verdant', charm: true,
    rollKeys: ['xpBonus', 'goldPerSec'], base: { xpBonus: 7, goldPerSec: 1.2 },
    passive: { effect: 'idle-drift', text: 'Growth continues in your absence, which is the only kind that lasts.' },
    lore: 'Two realms signed it. Neither has enforced a clause in two hundred years and both consider it their finest work.',
  },

  // ── Legendary: the ones players name their builds after ──────────────────
  {
    id: 'unique-crown-of-borrowed-noon', name: 'Crown of Borrowed Noon', rarity: 'legendary', slot: 'head', style: 'celestial',
    rollKeys: ['xpBonus', 'magicFind'], base: { xpBonus: 9, magicFind: 5 },
    passive: { effect: 'xp-echo', text: 'The hour it lends you has to be given back eventually.' },
    lore: 'Worn once, at the coronation of a Solarii who abdicated the same afternoon and was never recorded as having reigned.',
  },
  {
    id: 'unique-lastwarden', name: 'Lastwarden', rarity: 'legendary', slot: 'off-hand', style: 'umbral',
    rollKeys: ['ward', 'lootBonus'], base: { ward: 5.5, lootBonus: 6 },
    passive: { effect: 'temper-mercy', text: 'A failed temper costs it less than it costs anything else.' },
    lore: 'The shield of the guard who stayed at the Verge gate after the order to hold it had been formally withdrawn.',
  },
  {
    id: 'unique-goldmouth', name: 'Goldmouth', rarity: 'legendary', slot: 'weapon', style: 'infernal',
    rollKeys: ['goldPerSec', 'strikePower'], base: { goldPerSec: 4.2, strikePower: 3 },
    passive: { effect: 'gold-surge', text: 'It has never once been described as subtle.' },
    lore: 'A blade that pays. The Archivum has four separate rulings on whether that sentence is metaphor and they disagree.',
  },
  {
    id: 'unique-cartographers-regret', name: "Cartographer's Regret", rarity: 'legendary', slot: 'trinket', style: 'celestial',
    rollKeys: ['magicFind', 'lootBonus'], base: { magicFind: 8, lootBonus: 7 },
    passive: { effect: 'loot-bias', text: 'It points at the thing you did not come for.' },
    lore: 'The map it was made to complete was finished by someone else, correctly, from worse instruments, in half the time.',
  },
  {
    id: 'unique-long-account', name: 'The Long Account', rarity: 'legendary', style: 'neutral', charm: true,
    rollKeys: ['xpBonus', 'goldPerSec', 'magicFind'], base: { xpBonus: 14, goldPerSec: 2.5, magicFind: 5 },
    passive: { effect: 'reforge-memory', text: 'Everything you have rerolled away is written down in here somewhere.' },
    lore: 'Not the whole account. The long one, which is a different document, and the only one anybody finished.',
  },

  // ── Mythic: two, and they are meant to be talked about ───────────────────
  {
    id: 'unique-heartwood-of-the-verge', name: 'Heartwood of the Verge', rarity: 'mythic', slot: 'chest', style: 'verdant',
    rollKeys: ['ward', 'goldPerSec', 'xpBonus'], base: { ward: 9, goldPerSec: 5, xpBonus: 10 },
    passive: { effect: 'idle-drift', text: 'It grows toward whichever realm you have neglected longest.' },
    lore: 'Cut from the one tree that was standing on both sides of the Shattering and did not appear to notice.',
  },
  {
    id: 'unique-mirror-of-small-mercies', name: 'Mirror of Small Mercies', rarity: 'mythic', slot: 'off-hand', style: 'umbral',
    rollKeys: ['ward', 'magicFind', 'lootBonus'], base: { ward: 8, magicFind: 9, lootBonus: 10 },
    passive: { effect: 'temper-mercy', text: 'It will not let a failure be the last thing that happened.' },
    lore: 'It shows you the version of the attempt that went slightly better. This is either kindness or the cruellest thing in the realms.',
  },

  // ── Singular: one each, unsellable. See the header. ──────────────────────
  {
    id: 'unique-the-unstruck-hour', name: 'The Unstruck Hour', rarity: 'singular', slot: 'trinket', style: 'void',
    rollKeys: ['goldPerSec', 'xpBonus', 'magicFind'], base: { goldPerSec: 9, xpBonus: 18, magicFind: 12 },
    passive: { effect: 'rarity-pull', text: 'The hour that was never struck is still, technically, available.' },
    lore: 'Every bell in the five realms rang at the Shattering except one, and nobody has ever agreed on which.',
    soulbound: true,
  },
  {
    id: 'unique-keepers-second-name', name: "The Keeper's Second Name", rarity: 'singular', style: 'neutral', charm: true,
    rollKeys: ['xpBonus', 'magicFind', 'goldPerSec'], base: { xpBonus: 24, magicFind: 14, goldPerSec: 7 },
    passive: { effect: 'guaranteed-mf', text: 'It answers to you, which is not the same as belonging to you.' },
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
    rollKeys: ['magicFind', 'xpBonus', 'lootBonus'], base: { magicFind: 13.2, xpBonus: 9.9, lootBonus: 7.92 },
    passive: { effect: 'loot-bias', text: 'It points at the plan rather than the prize, and is usually right about which you needed.' },
    lore: 'The Archivist designed this tool to measure the distance between ideas — literally.',
  },
  {
    id: 'unique-heartstone-world-root', name: 'Heartstone of the World-Root', rarity: 'singular', slot: 'trinket', style: 'verdant',
    rollKeys: ['magicFind', 'xpBonus', 'lootBonus'], base: { magicFind: 16.8, xpBonus: 12.6, lootBonus: 10.08 },
    passive: { effect: 'idle-drift', text: 'It keeps growing while you are not looking, which is most of the time.' },
    lore: 'The World-Root\'s heart is a stone. This is that stone — or the closest thing to it that exists outside the Root itself.',
    soulbound: true,
  },
  {
    id: 'unique-first-anvil-fragment', name: 'The First Anvil (Fragment)', rarity: 'mythic', slot: 'hands', style: 'neutral',
    rollKeys: ['strikePower', 'ward', 'lootBonus'], base: { strikePower: 7.26, ward: 2.64, lootBonus: 7.92 },
    passive: { effect: 'strike-double', text: 'Everything struck on it comes out one grade better than the hand deserved.' },
    lore: 'The Godforge had a first anvil, before there were five realms, before there were realms at all.',
  },
  {
    id: 'unique-shadowloom', name: 'Shadowloom', rarity: 'legendary', slot: 'off-hand', style: 'umbral',
    rollKeys: ['ward', 'magicFind'], base: { ward: 5.72, magicFind: 5.2 },
    passive: { effect: 'loot-bias', text: 'It weaves a concealment you did not ask for and cannot decline.' },
    lore: 'The Umbral Weavers use full-sized looms to weave shadow into cloth, armor, and concealment.',
  },
  {
    id: 'unique-merchants-scale', name: 'The Merchant\'s Scale', rarity: 'epic', charm: true, style: 'neutral',
    rollKeys: ['magicFind', 'xpBonus', 'goldPerSec'], base: { magicFind: 14, xpBonus: 12, goldPerSec: 4 },
    passive: { effect: 'gold-surge', text: 'It weighs the offer and the offerer, and only reports one of the two.' },
    lore: 'The Merchant does not haggle. They weigh. This scale measures not mass but value — a concept that incorporates rarity, craftsmanship, desire, and destiny.',
  },
  {
    id: 'unique-pyrograph-scroll-case', name: 'Pyrograph Scroll Case', rarity: 'legendary', slot: 'off-hand', style: 'infernal',
    rollKeys: ['ward', 'magicFind'], base: { ward: 5.72, magicFind: 5.2 },
    passive: { effect: 'xp-echo', text: 'It records what happened near it whether or not anyone wanted a record.' },
    lore: 'Before the Infernal Realm had a written language, it had this scroll. The Pyrograph writes down everything that happens near the bearer, recording events as they occur in a script of fire.',
  },
  {
    id: 'unique-mirror-meridians', name: 'The Mirror of Meridians', rarity: 'mythic', slot: 'off-hand', style: 'celestial',
    rollKeys: ['ward', 'magicFind', 'lootBonus'], base: { ward: 7.26, magicFind: 6.6, lootBonus: 7.92 },
    passive: { effect: 'ward-mirror', text: 'It shows the room you are not in, which is the one the trap is in.' },
    lore: 'The Archivist made this mirror to solve a problem: they wanted to see what they could not see by looking.',
  },
  {
    id: 'unique-spore-crown', name: 'Spore Crown', rarity: 'legendary', slot: 'head', style: 'verdant',
    rollKeys: ['magicFind', 'xpBonus'], base: { magicFind: 7.8, xpBonus: 5.2 },
    passive: { effect: 'idle-drift', text: 'What grows on it answers questions, though rarely the asked one.' },
    lore: 'Fungi are the Verdant Realm\'s communication network. The mycelial web beneath the World-Root carries messages between every living thing in the realm, and this crown connects the wearer to that network.',
  },
  {
    id: 'unique-eclipse-hourglass', name: 'Eclipse Hourglass', rarity: 'singular', slot: 'trinket', style: 'neutral',
    rollKeys: ['magicFind', 'xpBonus', 'lootBonus'], base: { magicFind: 16.8, xpBonus: 12.6, lootBonus: 10.08 },
    passive: { effect: 'rarity-pull', text: 'The sand runs toward whichever realm is closest to alignment.' },
    lore: 'Time in Eclipse Realms is not linear — it spirals, and the spiral has a period. This hourglass measures that period: the interval between Eclipses.',
    soulbound: true,
  },
  {
    id: 'unique-ashen-covenant', name: 'Ashen Covenant', rarity: 'legendary', slot: 'hands', style: 'infernal',
    rollKeys: ['strikePower', 'ward'], base: { strikePower: 5.72, ward: 2.08 },
    passive: { effect: 'temper-mercy', text: 'An agreement sealed on this cannot be broken, only outlived.' },
    lore: 'A covenant in the Infernal Realm is sealed not with signatures but with a handshake in fire. This gauntlet allows such handshakes to occur without consuming the flesh.',
  },
  {
    id: 'unique-aureths-mantle', name: 'Aureth\'s Mantle', rarity: 'singular', slot: 'chest', style: 'luminous',
    rollKeys: ['ward', 'goldPerSec', 'lootBonus'], base: { ward: 6.72, goldPerSec: 2.52, lootBonus: 10.08 },
    passive: { effect: 'gold-surge', text: 'It carries a sunrise that has not been overhead for four thousand years.' },
    lore: 'Aureth the Radiant wore this mantle during every significant event in the Luminous Realm\'s history: the First Dawn, the Shattering, the Reconstruction, and the Forging of the Treaties.',
    soulbound: true,
  },
  {
    id: 'unique-verrins-requiem', name: 'Verrin\'s Requiem', rarity: 'singular', slot: 'weapon', style: 'umbral',
    rollKeys: ['strikePower', 'goldPerSec', 'lootBonus'], base: { strikePower: 8.4, goldPerSec: 3.36, lootBonus: 10.08 },
    passive: { effect: 'strike-double', text: 'What it cuts is not wounded. It is asked whether it was ever there.' },
    lore: 'Verrin the Hollow forged this blade to answer a question: \'What happens when you cut something with nothing?',
    soulbound: true,
  },
  {
    id: 'unique-archivists-codex', name: 'The Archivist\'s Codex', rarity: 'singular', slot: 'off-hand', style: 'celestial',
    rollKeys: ['ward', 'magicFind', 'lootBonus'], base: { ward: 9.24, magicFind: 8.4, lootBonus: 10.08 },
    passive: { effect: 'xp-echo', text: 'Every page is the page you needed, which is why nobody finishes reading it.' },
    lore: 'The Archivist\'s Codex is not a book — it is a database in book form. It contains the index to every piece of knowledge in the Celestial Realm, cross-referenced, annotated, and updated in real time.',
    soulbound: true,
  },
  {
    id: 'unique-kaels-left-hand', name: 'Kael\'s Left Hand', rarity: 'singular', slot: 'hands', style: 'infernal',
    rollKeys: ['strikePower', 'ward', 'lootBonus'], base: { strikePower: 9.24, ward: 3.36, lootBonus: 10.08 },
    passive: { effect: 'strike-double', text: 'The hand Kael lost, still working, still stamping runes it was not given.' },
    lore: 'This is Kael the Broken Flame\'s actual left hand — the original was consumed when he shook hands with the Godforge to seal a covenant.',
    soulbound: true,
  },
  {
    id: 'unique-nameless-crown', name: 'The Nameless Crown', rarity: 'singular', slot: 'head', style: 'neutral',
    rollKeys: ['magicFind', 'xpBonus', 'lootBonus'], base: { magicFind: 12.6, xpBonus: 8.4, lootBonus: 10.08 },
    passive: { effect: 'rarity-pull', text: 'It fits whoever wears it, and afterwards they are difficult to describe.' },
    lore: 'The Nameless is the figure who exists in all five realms simultaneously — the founder, the builder, the one who split the world and has spent eternity trying to decide if that was the right choice.',
    soulbound: true,
  },
  {
    id: 'unique-worldsplitter', name: 'Worldsplitter', rarity: 'singular', slot: 'weapon', style: 'neutral',
    rollKeys: ['strikePower', 'goldPerSec', 'lootBonus'], base: { strikePower: 8.4, goldPerSec: 3.36, lootBonus: 10.08 },
    passive: { effect: 'strike-double', text: 'The axe that made five realms out of one, and has not been put down since.' },
    lore: 'The Nameless used Worldsplitter to perform the Eclipse — the act that divided one world into five realms.',
    soulbound: true,
  },
  {
    id: 'unique-merchants-ledger', name: 'The Merchant\'s Ledger', rarity: 'singular', slot: 'off-hand', style: 'neutral',
    rollKeys: ['ward', 'magicFind', 'lootBonus'], base: { ward: 9.24, magicFind: 8.4, lootBonus: 10.08 },
    passive: { effect: 'gold-surge', text: 'Every transaction in the five realms is in here, including the ones not yet made.' },
    lore: 'The Merchant trades in all five realms and records every transaction in this ledger — not because they must, but because they believe that fair trade is the only true magic.',
    soulbound: true,
  },
  {
    id: 'unique-rootmothers-embrace', name: 'Rootmother\'s Embrace', rarity: 'singular', slot: 'chest', style: 'verdant',
    rollKeys: ['ward', 'goldPerSec', 'lootBonus'], base: { ward: 6.72, goldPerSec: 2.52, lootBonus: 10.08 },
    passive: { effect: 'ward-mirror', text: 'It is alive, it is armour, and it has opinions about which of those comes first.' },
    lore: 'The Rootmother is the oldest consciousness in the Verdant Realm — not a person but the collective awareness of the World-Root\'s primary root system.',
    soulbound: true,
  },
  {
    id: 'unique-forges-memory', name: 'The Forge\'s Memory', rarity: 'singular', slot: 'weapon', style: 'neutral',
    rollKeys: ['strikePower', 'goldPerSec', 'lootBonus'], base: { strikePower: 8.4, goldPerSec: 3.36, lootBonus: 10.08 },
    passive: { effect: 'reforge-memory', text: 'It remembers every strike ever made with it, and repeats the good ones.' },
    lore: 'This is the hammer that was shaped on the First Anvil using the Godforge Tongs — the third tool in the Trinity of Creation.',
    soulbound: true,
  },
  {
    id: 'unique-eclipse-manifest', name: 'Eclipse', rarity: 'singular', charm: true, style: 'neutral',
    rollKeys: ['magicFind', 'xpBonus', 'goldPerSec'], base: { magicFind: 29.4, xpBonus: 25.2, goldPerSec: 8.4 },
    passive: { effect: 'guaranteed-mf', text: 'Not an object. The Eclipse itself, folded small enough to carry.' },
    lore: 'The Eclipse was the event that created the five realms — the moment of division, the original wound in reality.',
    soulbound: true,
  },
];

/** First temper price by rarity. Steeper than the Keeper kit's flat 50k. */
export const UNIQUE_TEMPER_BASE: Readonly<Record<ItemRarity, number>> = {
  common: 40_000,
  uncommon: 60_000,
  rare: 90_000,
  epic: 140_000,
  legendary: 220_000,
  mythic: 400_000,
  singular: 750_000,
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

/** True when this instance is one of the named objects. */
export function isUnique(item: { definitionId?: string }): boolean {
  return !!item.definitionId && UNIQUE_BY_ID.has(item.definitionId);
}

/** Every unique that drops at exactly this rarity. */
export function uniquesAtRarity(rarity: ItemRarity): UniqueItem[] {
  return UNIQUE_ITEMS.filter(u => u.rarity === rarity);
}
