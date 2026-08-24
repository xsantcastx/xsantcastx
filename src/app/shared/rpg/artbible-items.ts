/**
 * artbible-items.ts — the Eclipse Realms Item Art Bible, as game objects.
 *
 * Seventy-seven ordinary definitions drawn from the hundred-item Art Bible. The
 * twenty named relics in it are not here — a named object with a passive is a
 * unique, so they live in `unique-items.ts` with the rest of their kind.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE BASES ARE NOT THE ART BIBLE'S NUMBERS
 * ─────────────────────────────────────────────────────────────────────────────
 * The Art Bible was written for painters, and its stat lines describe a combat
 * game this one is not: "Base Damage +120-450", "Shadow Resistance +15-50%",
 * "Mana Regen +10-40/sec". `ItemStats` has six keys and none of them is damage.
 * Transcribing those numbers would have produced eighty-seven items carrying
 * stats nothing reads, which is worse than having no items — the tooltip would
 * promise a mechanic the game does not have.
 *
 * So each entry keeps the Art Bible's *identity* — name, lore, realm, the tier
 * it drops at — and takes its numbers from the slot it occupies, scaled by the
 * stature the Art Bible gave it. A Dawnrender is a weapon first and a Mythic
 * second, and both facts are in its base.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE RUNES ARE MATERIALS
 * ─────────────────────────────────────────────────────────────────────────────
 * The Art Bible's fifteen runes are socketing stones: every stat line on them
 * ends in "(when socketed)", and there are no sockets. They are also not the
 * Forge's runes — `rune.model.ts` already owns a closed ladder of twenty-five
 * with its own drop budget, forge costs and Runewords, and forking a second
 * rune ladder into the charm wells is the exact two-ladder problem item.model's
 * header was written to prevent.
 *
 * They are filed as materials, which is what an uncut stone waiting on a
 * mechanic actually is: they stack in the bag, they come home from the realm
 * that owns them, and the Collection Log counts them. When sockets ship, this
 * is the list they are cut from.
 *
 * Pure data. No Angular, no browser APIs, SSR-safe.
 */
import type { ItemDefinition, ItemStatKey, ItemStyle } from './item-definition';
import type { ItemStats, SlotId } from './item.model';

/**
 * The tier each Art Bible entry first drops at, for the Collection Log.
 *
 * The Art Bible publishes a *band* — "Relic / Mythic / Eternal" — because a
 * painter needed to know which treatments an item might need. An ordinary
 * definition has no authored rarity in this codebase (the box that opens it
 * decides), so the band's floor is recorded here instead: it is the answer to
 * "how rare is this discovery", which is the only question the log asks.
 */
export const ARTBIBLE_RARITY: Readonly<Record<string, string>> = {
  'dawnrender': 'epic',
  'nullthorn-staff': 'rare',
  'starfall-maul': 'legendary',
  'briarvein-kris': 'uncommon',
  'cindergnaw': 'epic',
  'meridian-longbow': 'rare',
  'hollow-fang': 'legendary',
  'rootbreaker-mace': 'uncommon',
  'pyreclast-wand': 'rare',
  'eclipse-edge': 'mythic',
  'ashveil-throwing-knives': 'uncommon',
  'radiant-halberd': 'rare',
  'spinerift-crossbow': 'rare',
  'astral-glaive': 'epic',
  'godforge-tongs': 'epic',
  'crown-of-the-first-dawn': 'legendary',
  'voidweave-cowl': 'epic',
  'starplate-cuirass': 'rare',
  'thornmantle-pauldrons': 'uncommon',
  'ember-vambraces': 'rare',
  'solstice-greaves': 'epic',
  'abyssal-aegis': 'legendary',
  'cometfall-helm': 'epic',
  'cinderhide-coat': 'rare',
  'rootwall-shield': 'uncommon',
  'duskmail-hauberk': 'epic',
  'forgeborn-warhelm': 'epic',
  'astral-striders': 'rare',
  'blazebraid-belt': 'rare',
  'luminous-aegis-mantle': 'legendary',
  'aurumleaf-pendant': 'uncommon',
  'coinspinners-ring': 'rare',
  'tithe-of-ash': 'epic',
  'dewdrop-purse': 'uncommon',
  'phantom-toll': 'legendary',
  'lens-of-the-archivist': 'rare',
  'inkwell-talisman': 'uncommon',
  'ember-primer': 'rare',
  'seedpod-of-knowing': 'uncommon',
  'gilded-quill': 'epic',
  'sunstone-dowser': 'rare',
  'starweavers-thread': 'epic',
  'thornseeker-beetle': 'rare',
  'cinder-compass': 'epic',
  'rune-of-radiance': 'uncommon',
  'rune-of-dawns-edge': 'epic',
  'rune-of-the-solstice': 'legendary',
  'rune-of-hollow': 'uncommon',
  'rune-of-erasure': 'epic',
  'rune-of-starfire': 'epic',
  'rune-of-void-navigation': 'legendary',
  'rune-of-root': 'uncommon',
  'rune-of-overgrowth': 'epic',
  'rune-of-the-world-root': 'mythic',
  'rune-of-the-forge': 'uncommon',
  'rune-of-cinder': 'epic',
  'rune-of-the-underhearth': 'legendary',
  'liquid-dawn': 'rare',
  'phial-null': 'epic',
  'starbloom-tea': 'uncommon',
  'rootsap-tincture': 'uncommon',
  'embervial': 'rare',
  'scroll-shattering-memory': 'legendary',
  'astral-ink': 'rare',
  'thornberry-elixir': 'uncommon',
  'forge-dust-sachet': 'rare',
  'eclipse-fragment-capsule': 'mythic',
  'orichalcum-ore': 'epic',
  'shadowthread-silk': 'rare',
  'celestial-quartz': 'rare',
  'world-root-bark': 'uncommon',
  'pyrite-dust': 'uncommon',
  'moonpetal-herb': 'uncommon',
  'godforge-slag': 'uncommon',
  'void-crystal': 'legendary',
  'solar-resin': 'rare',
  'emberheart-ore': 'rare',
};

// ─────────────────────────────────────────────────────────────────────────────
// Factories
// ─────────────────────────────────────────────────────────────────────────────
//
// Four, matching the four families this file authors. They mirror `eq()` in
// item-definition.ts rather than importing it — that one is not exported, and
// exporting a constructor so a second file can add to the same catalogue is how
// the balance table and the content list end up editing each other's lines.

/** A worn or held piece. `type: 'artifact'` is what the paper doll accepts. */
function eq(
  id: string, name: string, slot: SlotId, style: ItemStyle,
  rollKeys: readonly ItemStatKey[], base: Partial<ItemStats>, lore: string,
): ItemDefinition {
  return {
    id, name, family: 'equipment', type: 'artifact', slot, style, rollKeys, base,
    temperable: true, maxTemper: 10, temperGoldBase: 50_000, lore,
  };
}

/** A charm well filler. `type: 'charm'` is what the wells accept. */
function charm(
  id: string, name: string, style: ItemStyle,
  rollKeys: readonly ItemStatKey[], base: Partial<ItemStats>, lore: string,
): ItemDefinition {
  return {
    id, name, family: 'charm', type: 'charm', style, rollKeys, base,
    temperable: false, maxTemper: 0, temperGoldBase: 0, lore,
  };
}

/** Drunk, burned or read once. Rolls, because what it grants is not fixed. */
function consumable(
  id: string, name: string, style: ItemStyle,
  rollKeys: readonly ItemStatKey[], base: Partial<ItemStats>, lore: string,
): ItemDefinition {
  return {
    id, name, family: 'consumable', type: 'charm', style, rollKeys, base,
    temperable: false, maxTemper: 0, temperGoldBase: 0, lore,
  };
}

/**
 * A stack in the bag. Never rolls — see the header of item-definition.ts.
 *
 * `mintEquipment` refuses this family outright, which is why nothing here needs
 * a `rollKeys` entry and why the Exchange skips them: a material is a quantity,
 * not an instance with numbers frozen onto it.
 */
function material(id: string, name: string, style: ItemStyle, lore: string): ItemDefinition {
  return {
    id, name, family: 'material', type: 'artifact', style, rollKeys: [], base: {},
    temperable: false, maxTemper: 0, temperGoldBase: 0, lore,
  };
}

const WEAPONS: readonly ItemDefinition[] = [
  eq('dawnrender', 'Dawnrender', 'weapon', 'luminous', ['strikePower', 'goldPerSec'],
    { strikePower: 1.7, goldPerSec: 0.68 },
    'Forged at the First Dawn, when the Luminous Realm cracked open the void\'s ceiling and let light spill into Eclipse Realms for the first time.'),
  eq('nullthorn-staff', 'Nullthorn Staff', 'weapon', 'umbral', ['strikePower', 'goldPerSec'],
    { strikePower: 1.3, goldPerSec: 0.52 },
    'Verrin the Hollow grew this staff from a cutting of the World-Root\'s shadow — the inverse tree that grows downward beneath the Godforge.'),
  eq('starfall-maul', 'Starfall Maul', 'weapon', 'celestial', ['strikePower', 'goldPerSec'],
    { strikePower: 2.2, goldPerSec: 0.88 },
    'When the Celestial Realm opened a window to let The Archivist study the outer cosmos, a fragment of dead star fell through.'),
  eq('briarvein-kris', 'Briarvein Kris', 'weapon', 'verdant', ['strikePower', 'goldPerSec'],
    { strikePower: 1, goldPerSec: 0.4 },
    'The Verdant Realm grows its weapons. This kris was planted as a seed in the Grove of Edges, watered with sap from the World-Root, and harvested after three eclipses.'),
  eq('cindergnaw', 'Cindergnaw', 'weapon', 'infernal', ['strikePower', 'goldPerSec'],
    { strikePower: 1.7, goldPerSec: 0.68 },
    'Forged in the deepest furnace of the Infernal Realm, where fire is not a tool but a predator. Cindergnaw was made to fell the ironwood pillars that held up the ceiling of the Underhearth.'),
  eq('meridian-longbow', 'Meridian Longbow', 'weapon', 'celestial', ['strikePower', 'goldPerSec'],
    { strikePower: 1.3, goldPerSec: 0.52 },
    'The Archivist crafted twelve of these bows, each tuned to a different constellation in the Celestial Realm\'s sky.'),
  eq('hollow-fang', 'Hollow Fang', 'weapon', 'umbral', ['strikePower', 'goldPerSec'],
    { strikePower: 2.2, goldPerSec: 0.88 },
    'Verrin the Hollow pulled this blade from the jaw of something that lives beneath the Umbral Realm\'s floor — a creature so old that its teeth had become volcanic glass.'),
  eq('rootbreaker-mace', 'Rootbreaker Mace', 'weapon', 'verdant', ['strikePower', 'goldPerSec'],
    { strikePower: 1, goldPerSec: 0.4 },
    'When the World-Root\'s oldest branch finally fell during the Shattering, Verdant smiths carved weapons from the petrified heartwood before it could rot into nothing.'),
  eq('pyreclast-wand', 'Pyreclast Wand', 'weapon', 'infernal', ['strikePower', 'goldPerSec'],
    { strikePower: 1.3, goldPerSec: 0.52 },
    'The Infernal Realm does not produce elegant instruments.'),
  eq('eclipse-edge', 'Eclipse Edge', 'weapon', 'neutral', ['strikePower', 'goldPerSec'],
    { strikePower: 2.8, goldPerSec: 1.12 },
    'This blade existed before the realms separated. It was the tool the Nameless used to cut the original Eclipse — the event that split one world into five realms.'),
  eq('ashveil-throwing-knives', 'Ashveil Throwing Knives', 'weapon', 'infernal', ['strikePower', 'goldPerSec'],
    { strikePower: 1, goldPerSec: 0.4 },
    'These knives were the calling card of the Ashwalkers, a disbanded guild of Infernal assassins who believed that fire should be precise, not indiscriminate.'),
  eq('radiant-halberd', 'Radiant Halberd', 'weapon', 'luminous', ['strikePower', 'goldPerSec'],
    { strikePower: 1.3, goldPerSec: 0.52 },
    'The Luminous Realm\'s soldiers do not carry swords — they carry halberds, because light reaches further than shadow.'),
  eq('spinerift-crossbow', 'Spinerift Crossbow', 'weapon', 'verdant', ['strikePower', 'goldPerSec'],
    { strikePower: 1.3, goldPerSec: 0.52 },
    'The Verdant Realm does not mine metal. Its ranged weapons are grown, harvested, and assembled from forest materials.'),
  eq('astral-glaive', 'Astral Glaive', 'weapon', 'celestial', ['strikePower', 'goldPerSec'],
    { strikePower: 1.7, goldPerSec: 0.68 },
    'The Celestial Realm measures time by the motion of their glaives.'),
  eq('godforge-tongs', 'Godforge Tongs', 'weapon', 'neutral', ['strikePower', 'goldPerSec'],
    { strikePower: 1.7, goldPerSec: 0.68 },
    'Before the Godforge made items, it made itself. These tongs shaped the first anvil, which shaped the first hammer, which shaped everything else.'),
];

const ARMOR: readonly ItemDefinition[] = [
  eq('crown-of-the-first-dawn', 'Crown of the First Dawn', 'head', 'luminous', ['magicFind', 'xpBonus'],
    { magicFind: 3.3, xpBonus: 2.2 },
    'Aureth the Radiant wore the original during the Shattering, and it absorbed enough light to burn permanently.'),
  eq('voidweave-cowl', 'Voidweave Cowl', 'head', 'umbral', ['magicFind', 'xpBonus'],
    { magicFind: 2.55, xpBonus: 1.7 },
    'Woven by the Umbral Realm\'s Weavers — blind artisans who work by touch in total darkness. The fabric is not dyed black; it is woven from threads of compressed shadow, harvested from the underside of the world.'),
  eq('starplate-cuirass', 'Starplate Cuirass', 'chest', 'celestial', ['ward', 'goldPerSec'],
    { ward: 1.04, goldPerSec: 0.39 },
    'The Celestial Realm records everything — even armor is a document.'),
  eq('thornmantle-pauldrons', 'Thornmantle Pauldrons', 'chest', 'verdant', ['ward', 'goldPerSec'],
    { ward: 0.8, goldPerSec: 0.3 },
    'Verdant armor grows to fit its wearer, which means it bonds permanently.'),
  eq('ember-vambraces', 'Ember Vambraces', 'hands', 'infernal', ['strikePower', 'ward'],
    { strikePower: 1.43, ward: 0.52 },
    'Infernal smiths wear their armor while forging — it is both protection and statement.'),
  eq('solstice-greaves', 'Solstice Greaves', 'legs', 'luminous', ['magicFind', 'goldPerSec'],
    { magicFind: 2.72, goldPerSec: 0.2 },
    'On the solstice, the Luminous Realm\'s light reaches its peak — for one hour, there are no shadows anywhere.'),
  eq('abyssal-aegis', 'Abyssal Aegis', 'off-hand', 'umbral', ['ward', 'magicFind'],
    { ward: 2.42, magicFind: 2.2 },
    'The Abyssal Aegis does not block attacks — it swallows them. Arrows that strike it vanish. Blades that contact it lose inches of length.'),
  eq('cometfall-helm', 'Cometfall Helm', 'head', 'celestial', ['magicFind', 'xpBonus'],
    { magicFind: 2.55, xpBonus: 1.7 },
    'When the first comet was observed passing through the Celestial Realm\'s sky, the Realm\'s armorers captured fragments that survived atmospheric entry and embedded them in steel.'),
  eq('cinderhide-coat', 'Cinderhide Coat', 'chest', 'infernal', ['ward', 'goldPerSec'],
    { ward: 1.04, goldPerSec: 0.39 },
    'Salamander hide is the Infernal Realm\'s leather — it comes from creatures that live in lava flows and shed their skins seasonally.'),
  eq('rootwall-shield', 'Rootwall Shield', 'off-hand', 'verdant', ['ward', 'magicFind'],
    { ward: 1.1, magicFind: 1 },
    'This shield is a history book. Each growth ring represents one year of the World-Root\'s life, and Verdant scholars can read events in the variations of ring thickness.'),
  eq('duskmail-hauberk', 'Duskmail Hauberk', 'chest', 'umbral', ['ward', 'goldPerSec'],
    { ward: 1.36, goldPerSec: 0.51 },
    'Shadow-tempered iron is forged in darkness — literally. Umbral smiths work by touch alone in lightless forges, heating metal by the sound of the flame rather than its color.'),
  eq('forgeborn-warhelm', 'Forgeborn Warhelm', 'head', 'infernal', ['magicFind', 'xpBonus'],
    { magicFind: 2.55, xpBonus: 1.7 },
    'The Infernal Realm\'s soldiers do not see the battlefield through their visors — they see the heat signatures.'),
  eq('astral-striders', 'Astral Striders', 'feet', 'celestial', ['magicFind', 'xpBonus'],
    { magicFind: 1.82, xpBonus: 1.56 },
    'The Celestial Realm\'s scouts cover impossible distances because their boots understand the concept of \'shortest path\' — not the physical shortest path, but the mathematical one.'),
  eq('blazebraid-belt', 'Blazebraid Belt', 'legs', 'infernal', ['magicFind', 'goldPerSec'],
    { magicFind: 2.08, goldPerSec: 0.16 },
    'Infernal warriors do not wear belts for fashion — they wear them because the Infernal Realm\'s gravity fluctuates near the deep vents, and an unsecured armor set will drift apart at the worst possible moment.'),
  eq('luminous-aegis-mantle', 'Luminous Aegis Mantle', 'chest', 'luminous', ['ward', 'goldPerSec'],
    { ward: 1.76, goldPerSec: 0.66 },
    'The Luminous Aegis Mantle was designed not for battle but for diplomacy — it marks the wearer as a representative of the Luminous Realm, protected by the authority of Aureth the Radiant.'),
];

const CHARMS: readonly ItemDefinition[] = [
  charm('aurumleaf-pendant', 'Aurumleaf Pendant', 'luminous', ['goldPerSec', 'magicFind'],
    { goldPerSec: 1.2, magicFind: 0.8 },
    'In the Luminous Realm, gold grows on trees — not metaphorically. The Golden Oaks shed leaves of pure gold every autumn, and the realm\'s economy is built on harvest cycles.'),
  charm('coinspinners-ring', 'Coinspinner\'s Ring', 'celestial', ['goldPerSec', 'magicFind'],
    { goldPerSec: 1.56, magicFind: 1.04 },
    'The Archivist calculated that probability itself has a pattern, and that pattern can be exploited.'),
  charm('tithe-of-ash', 'Tithe of Ash', 'infernal', ['goldPerSec', 'magicFind'],
    { goldPerSec: 2.04, magicFind: 1.36 },
    'The Infernal Realm taxes its citizens in ash — the residue of burned offerings. This coffer converts that concept into reality: it tithes the ambient thermal energy of its surroundings and converts it to gold.'),
  charm('dewdrop-purse', 'Dewdrop Purse', 'verdant', ['goldPerSec', 'magicFind'],
    { goldPerSec: 1.2, magicFind: 0.8 },
    'The Verdant Realm\'s currency is not mined but grown. Dewdrop Purses produce gold through photosynthesis — a biological process that converts sunlight and soil nutrients into tiny gold coins.'),
  charm('phantom-toll', 'Phantom Toll', 'umbral', ['goldPerSec', 'magicFind'],
    { goldPerSec: 2.64, magicFind: 1.76 },
    'In the Umbral Realm, every shadow cast by a living thing pays a toll to the darkness.'),
  charm('lens-of-the-archivist', 'Lens of the Archivist', 'celestial', ['xpBonus', 'magicFind'],
    { xpBonus: 4.55, magicFind: 1.3 },
    'The Archivist made seven of these lenses, each calibrated to perceive a different layer of reality.'),
  charm('inkwell-talisman', 'Inkwell Talisman', 'umbral', ['xpBonus', 'magicFind'],
    { xpBonus: 3.5, magicFind: 1 },
    'Knowledge is written in shadow-ink in the Umbral Realm, where written words literally carry the weight of what they describe.'),
  charm('ember-primer', 'Ember Primer', 'infernal', ['xpBonus', 'magicFind'],
    { xpBonus: 4.55, magicFind: 1.3 },
    'Before the Infernal Realm had forges, it had kilns. The first knowledge was not written on paper but burned into clay, because paper could not survive the environment.'),
  charm('seedpod-of-knowing', 'Seedpod of Knowing', 'verdant', ['xpBonus', 'magicFind'],
    { xpBonus: 3.5, magicFind: 1 },
    'The Verdant Realm stores knowledge in seeds. Every tree in the realm is a library; every forest is a university.'),
  charm('gilded-quill', 'Gilded Quill', 'luminous', ['xpBonus', 'magicFind'],
    { xpBonus: 5.95, magicFind: 1.7 },
    'In the Luminous Realm, the Sunbirds fly at the edge of dawn, and their feathers fall like burning confetti.'),
  charm('sunstone-dowser', 'Sunstone Dowser', 'luminous', ['magicFind', 'lootBonus'],
    { magicFind: 4.55, lootBonus: 2.6 },
    'Dowsers in the Luminous Realm don\'t search for water — they search for significance.'),
  charm('starweavers-thread', 'Starweaver\'s Thread', 'celestial', ['magicFind', 'lootBonus'],
    { magicFind: 5.95, lootBonus: 3.4 },
    'The Celestial Realm believes that all things of value are connected by invisible threads — a web of significance that spans all five realms.'),
  charm('thornseeker-beetle', 'Thornseeker Beetle', 'verdant', ['magicFind', 'lootBonus'],
    { magicFind: 4.55, lootBonus: 2.6 },
    'Thornseekers are a species of beetle native to the Verdant Realm that can smell rarity. Their antennae detect the concentration of Godforge energy in objects — the more powerful an item, the stronger the scent.'),
  charm('cinder-compass', 'Cinder Compass', 'infernal', ['magicFind', 'lootBonus'],
    { magicFind: 5.95, lootBonus: 3.4 },
    'The Infernal Realm navigates by heat, not magnetism. This compass was built by a firewalker cartographer who mapped the Underhearth by following thermal signatures of powerful artifacts.'),
];

const CONSUMABLES: readonly ItemDefinition[] = [
  consumable('liquid-dawn', 'Flask of Liquid Dawn', 'luminous', ['xpBonus'],
    { xpBonus: 6.5 },
    'The Luminous Realm bottles its excess light during peak solstice. Liquid Dawn is distilled from the first 30 seconds of sunrise, compressed into a drinkable form.'),
  consumable('phial-null', 'Phial of Null', 'umbral', ['magicFind'],
    { magicFind: 10.2 },
    'Shadow-extract is distilled from the deepest darkness of the Umbral Realm — not merely absence of light, but active darkness, the kind that pushes back against illumination.'),
  consumable('starbloom-tea', 'Starbloom Tea', 'celestial', ['xpBonus'],
    { xpBonus: 6.5 },
    'Starbloom grows only at the highest point of the Celestial Realm, where the sky is thin enough to see through.'),
  consumable('rootsap-tincture', 'Rootsap Tincture', 'verdant', ['ward'],
    { ward: 2 },
    'Rootsap is the blood of the World-Root, tapped carefully from the deepest roots by Verdant healers who whisper apologies to the tree for each extraction.'),
  consumable('embervial', 'Embervial', 'infernal', ['strikePower'],
    { strikePower: 2.86 },
    'Embervials are not brewed; they are collected.'),
  consumable('scroll-shattering-memory', 'Scroll of Shattering Memory', 'neutral', ['xpBonus', 'magicFind'],
    { xpBonus: 15.4, magicFind: 8.8 },
    'This scroll records the Shattering from five perspectives simultaneously — one for each realm.'),
  consumable('astral-ink', 'Astral Ink', 'celestial', ['magicFind'],
    { magicFind: 6.5 },
    'The Archivist invented Astral Ink to solve a problem: how to write truth. Normal ink writes what the writer wants it to say.'),
  consumable('thornberry-elixir', 'Thornberry Elixir', 'verdant', ['ward'],
    { ward: 1.8 },
    'Thornberries grow on the razor-vine — a plant so aggressive it attacks anything that moves within its reach.'),
  consumable('forge-dust-sachet', 'Forge-Dust Sachet', 'infernal', ['strikePower'],
    { strikePower: 2.6 },
    'The floor of the Godforge is covered in dust — the accumulated debris of millennia of creation.'),
  consumable('eclipse-fragment-capsule', 'Eclipse Fragment Capsule', 'neutral', ['goldPerSec', 'xpBonus', 'magicFind'],
    { goldPerSec: 8.4, xpBonus: 22.4, magicFind: 16.8 },
    'Eclipse Fragments are pieces of the original Eclipse event, captured and preserved in crystal. They contain the moment when one world became five — the raw energy of division itself.'),
];

const MATERIALS: readonly ItemDefinition[] = [
  material('rune-of-radiance', 'Rune of Radiance', 'luminous',
    'Radiance runes are the Luminous Realm\'s most common enchantment — they literally add light to items.'),
  material('rune-of-dawns-edge', 'Rune of Dawn\'s Edge', 'luminous',
    'When Dawnrender shattered during the Shattering, Luminous artisans gathered fragments of the blade and preserved them in sacred amber.'),
  material('rune-of-the-solstice', 'Rune of the Solstice', 'luminous',
    'The Solstice Rune is calibrated to the Luminous Realm\'s calendar — each of the 12 small suns represents one turning of the light.'),
  material('rune-of-hollow', 'Rune of Hollow', 'umbral',
    'Hollow runes extract what is not there. They reach into the spaces between things and pull out shadow, amplifying the wielder\'s connection to the Umbral Realm\'s core concept: that absence has power.'),
  material('rune-of-erasure', 'Rune of Erasure', 'umbral',
    'The Erasure Rune is not a weapon enhancement — it is a concept made physical. It represents the Umbral Realm\'s power to make things not-exist, to unwrite reality.'),
  material('rune-of-starfire', 'Rune of Starfire', 'celestial',
    'Star sapphires are naturally occurring in the Celestial Realm, where stars are not distant suns but reachable objects.'),
  material('rune-of-void-navigation', 'Rune of Void Navigation', 'celestial',
    'Tektite forms when a meteorite strikes the ground with enough force to melt the earth itself.'),
  material('rune-of-root', 'Rune of the Root', 'verdant',
    'Petrified wood is the Verdant Realm\'s most sacred material: a living thing that chose to become stone rather than rot.'),
  material('rune-of-overgrowth', 'Rune of Overgrowth', 'verdant',
    'Overgrowth is the Verdant Realm\'s answer to decay — not preservation, but replacement. When something dies, nature grows over it, through it, and from it.'),
  material('rune-of-the-world-root', 'Rune of the World-Root', 'verdant',
    'This is a seed from the World-Root — the tree at the center of all five realms whose roots hold Eclipse Realms together.'),
  material('rune-of-the-forge', 'Rune of the Forge', 'infernal',
    'Every item that passes through the Godforge carries a trace of its fire.'),
  material('rune-of-cinder', 'Rune of Cinder', 'infernal',
    'Pumice is frozen foam — lava that cooled so fast it trapped gas inside. This piece cooled only on the outside.'),
  material('rune-of-the-underhearth', 'Rune of the Underhearth', 'infernal',
    'The Underhearth is the lowest level of the Infernal Realm — a place so deep that even fire is compressed into something else.'),
  material('orichalcum-ore', 'Orichalcum Ore', 'neutral',
    'Orichalcum occurs naturally only at the boundaries between realms — the seams where one world meets another.'),
  material('shadowthread-silk', 'Shadowthread Silk', 'umbral',
    'Woven by the Umbral Weavers (the same blind artisans who made the Voidweave Cowl), Shadowthread Silk is the base material for all Umbral cloth armor, accessories, and concealment devices.'),
  material('celestial-quartz', 'Celestial Quartz', 'celestial',
    'Celestial Quartz grows in the vaults beneath the Celestial Realm\'s observatories, where concentrated starlight filters through rock for centuries.'),
  material('world-root-bark', 'World-Root Bark', 'verdant',
    'The World-Root sheds bark naturally as it grows, and Verdant harvesters collect the shed pieces for crafting.'),
  material('pyrite-dust', 'Pyrite Dust', 'infernal',
    'Pyrite — iron sulfide — is the Infernal Realm\'s most abundant mineral. It forms in the realm\'s volcanic vents and is harvested by the ton.'),
  material('moonpetal-herb', 'Moonpetal Herb', 'celestial',
    'Moonpetal grows on the moonlit slopes of the Celestial Realm\'s highest mountains, blooming only when starlight is brightest.'),
  material('godforge-slag', 'Godforge Slag', 'neutral',
    'The Godforge produces slag like any forge — the waste material that rises to the top during smelting.'),
  material('void-crystal', 'Void Crystal', 'umbral',
    'Void Crystals form in the deepest parts of the Umbral Realm, where the concept of \'space\' itself has been compressed into a solid.'),
  material('solar-resin', 'Solar Resin', 'luminous',
    'Solar Resin is the sap of the Golden Oaks of the Luminous Realm, hardened over centuries. Like amber, it preserves what it captures — but instead of insects, it captures light.'),
  material('emberheart-ore', 'Emberheart Ore', 'infernal',
    'Emberheart Ore forms at the exact boundary between liquid and solid in the Infernal Realm\'s deepest magma chambers.'),
];

export const ARTBIBLE_DEFINITIONS: readonly ItemDefinition[] = [
  ...WEAPONS, ...ARMOR, ...CHARMS, ...CONSUMABLES, ...MATERIALS,
];
