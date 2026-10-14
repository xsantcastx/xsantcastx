/**
 * item-icons.ts — every item as a pixel icon (one art style, pass 2).
 *
 * Owner, 2026-10-14: "go pixel ... make sure to be migrating everything we had
 * in the past to pixel and make it consistent." The ~270 painted collectibles
 * (1254 px renders downscaled into a 40 px slot) sat beside the pixel Keeper,
 * the pixel creatures and the 44 procedural Fishing icons. This replaces them
 * with one procedural set on one grid:
 *
 *   - a SHAPE per kind of thing (item-icon-shapes.ts: a sword, a helm, an ore,
 *     a potion, a rune tablet…), 16 × 16 art px, the size the Fishing icons
 *     already use, so a satchel of mixed finds reads as one set;
 *   - a MATERIAL per item from the art bible ramps (docs/art/style-guide.md §5):
 *     the realm's metal, cloth, stone, glass or wood, plus a second material
 *     (hafts, cords, corks) and an accent (gems, trims, liquids, veins);
 *   - one outline (the art bible floor #140a1f) added by the renderer round
 *     the silhouette, a step lighter on the lit top-left edge (sel-out, §4);
 *   - light from the upper left, baked into the shapes.
 *
 * Rarity is never baked into the icon (art bible §5.4): the slot carries it.
 *
 * Every entry is the item's own: the forged tools are pickaxes, axes, sickles
 * and staves at last (they wore hammer and mace paintings as stand-ins), each
 * rune has its own carved glyph, and the uniques that were waiting for a
 * painting (ART_PENDING) get a real icon from their slot and realm.
 *
 * Each icon is an SVG of crisp rects in a data URI (CSP img-src allows data:),
 * built on first ask and cached: no files, no DOM, identical under SSR, and the
 * engine draws the same URL on its canvas (drops, node pins, stall plaques).
 * `artFor()` asks here first, so every surface that shows an item shows this.
 */
import type { ArtEntry } from './art-manifest.generated';
import { IconKind, IconShape, RUNE_GLYPH_AT, RUNE_TABLET, SHAPES } from './item-icon-shapes';

/** Ramps, dark → light: [deep, shade, base, lit, highlight]. Hexes from the art bible §5. */
const RAMPS = {
  iron: ['#171116', '#2a2027', '#443540', '#57474f', '#8c8494'],
  steel: ['#3a3339', '#5c5359', '#877c84', '#c0c4cc', '#eef2f6'],
  basalt: ['#241a1c', '#3a2b2c', '#5a4440', '#6b5148', '#8a7468'],
  ember: ['#3a1410', '#7a2a12', '#c4501e', '#E8752A', '#ffd08a'],
  gold: ['#3a2610', '#5a3c1a', '#a5793a', '#e8c898', '#f8e8c8'],
  sungold: ['#4a3410', '#7a5a14', '#b8901e', '#E8D44D', '#fff1b0'],
  brass: ['#3a2a14', '#5a4020', '#8a6a3a', '#b08a55', '#e8c47a'],
  copper: ['#3a1a10', '#6a3420', '#a8603a', '#d88a5a', '#f4c8a0'],
  stone: ['#2e2820', '#4a4030', '#8a7a58', '#c9b88e', '#efe4c8'],
  dawn: ['#7a5a14', '#b8901e', '#ffe7a0', '#fff1b0', '#fffaf0'],
  obsidian: ['#140a1f', '#1e1428', '#2e2238', '#463650', '#6a5878'],
  umbral: ['#0e0912', '#1a1220', '#33263a', '#4a3260', '#7b4fc0'],
  amethyst: ['#3a1f63', '#5a2f8a', '#7b4fc0', '#A855F7', '#c9a0ff'],
  eclipse: ['#1e0f38', '#3a1f63', '#7b3fc4', '#a855f7', '#d9b8ff'],
  moon: ['#3a3e58', '#5a6080', '#8a90b0', '#b8bcd8', '#d8dcf0'],
  midnight: ['#050a18', '#0a1428', '#14284a', '#24406e', '#3a5a8a'],
  silver: ['#3a4458', '#6a7890', '#a8b8cc', '#d8ecff', '#ffffff'],
  orbit: ['#0e2a50', '#1e5a9a', '#5fb6ff', '#00d4ff', '#d8ecff'],
  moss: ['#1e2a14', '#3a5a2a', '#4a7a3a', '#7fb85a', '#d8f2a0'],
  rootwood: ['#24190f', '#3a2a1c', '#7a5a36', '#b08a55', '#d8b66c'],
  // Verdant amber; the lit step is a shade off the site's retired amber gold (check-ds-adherence).
  amber: ['#3a2408', '#6a4010', '#c08a3e', '#f2b65e', '#fff0c0'],
  bio: ['#0a1a14', '#14302a', '#2a8a6a', '#7fd5a3', '#c4ffe0'],
  leather: ['#2a1810', '#3a2618', '#5a3a24', '#8a5a3a', '#b08060'],
  wood: ['#2a1a0c', '#3a2614', '#6a4a2c', '#a6845a', '#d8b66c'],
  crimson: ['#2a0e14', '#4a1418', '#8d4f58', '#b86a70', '#e0a0a0'],
  ivory: ['#5a4a30', '#8c7a58', '#c9b98f', '#efe4c4', '#fffaf0'],
  paper: ['#5a4a30', '#8a7a58', '#c8b890', '#e8dcc0', '#fff8e8'],
  void: ['#050308', '#160f22', '#2a1a3a', '#4a2a5a', '#ff6dd7'],
  slag: ['#1e1c22', '#2e2a32', '#4a454e', '#5ff0d8', '#d0fff6'],
  rose: ['#2a0e1a', '#3a1424', '#5c2438', '#8a3c56', '#ff5a8a'],
  glow: ['#0e2a3a', '#244a5c', '#2e8ab0', '#6fdcff', '#d0f6ff'],
  glass: ['#4a5868', '#8a98a8', '#c8d4e0', '#e8f0f8', '#ffffff'],
  ash: ['#3a3236', '#5a5054', '#8a7468', '#b8aca4', '#d4c8bc'],
  grey: ['#3a3339', '#5c5359', '#877c84', '#a0949b', '#c8c0c6'],
} as const;
export type Material = keyof typeof RAMPS;

/** How an item is drawn: its kind, its material, and (optionally) a second material and an accent. */
export interface IconSpec { kind: IconKind | 'rune'; mat: Material; sub?: Material; acc?: Material }

const OUTLINE = '#140a1f';
/** The outline on a lit top-left edge: one step lighter (sel-out), never on the shadow side. */
const OUTLINE_LIT = '#2e2040';
const SHINE = '#fffaf0';

/** Sensible second materials per kind when an entry names none. */
const SUB: Partial<Record<IconKind | 'rune', Material>> = {
  sword: 'leather', dagger: 'leather', knives: 'leather', staff: 'wood', wand: 'wood', polearm: 'wood', axe: 'wood',
  pickaxe: 'wood', sickle: 'wood', hammer: 'wood', maul: 'wood', mace: 'wood', bow: 'wood', crossbow: 'wood', tongs: 'iron',
  potion: 'wood', vial: 'wood', flask: 'wood', scroll: 'wood', book: 'paper', compass: 'paper', hourglass: 'wood',
  lens: 'wood', mirror: 'wood', shuttle: 'wood', herb: 'moss', flower: 'moss', spool: 'wood', pendant: 'gold', scale: 'brass',
  torch: 'wood', ladder: 'wood', plank: 'wood', support: 'wood', seedpod: 'rootwood', banner: 'wood', bellows: 'wood',
};

// e: a — readable shorthand for the table below.
const I = (kind: IconSpec['kind'], mat: Material, acc?: Material, sub?: Material): IconSpec =>
  ({ kind, mat, ...(acc ? { acc } : {}), ...(sub ? { sub } : {}) });

/**
 * Every item id (and the model ids that used to borrow a painting through
 * ART_ALIAS) → its icon. Realm reads from the material: Infernal basalt, iron
 * and ember; Luminous stone, gold and dawn glass; Umbral black-violet and
 * amethyst; Celestial midnight, brass and star silver; Verdant moss, rootwood
 * and amber; the shared Godforge violet for eclipse things.
 */
const ITEM_ICONS_BY_ID: Readonly<Record<string, IconSpec>> = {
  // ── Weapons (Art Bible + equipment) ──
  'eclipse-longblade': I('sword', 'steel', 'eclipse', 'leather'),
  'eclipse-edge': I('sword', 'obsidian', 'eclipse'),
  'basalt-edge': I('sword', 'basalt', 'ember', 'leather'),
  'dawnrender': I('sword', 'dawn', 'sungold', 'stone'),
  'mirrorblade-kael': I('sword', 'silver', 'amethyst', 'iron'),
  'unique-forges-memory': I('sword', 'iron', 'ember', 'leather'),
  'unique-cinderwake': I('sword', 'ember', 'basalt', 'iron'),
  'unique-goldmouth': I('sword', 'gold', 'sungold', 'leather'),
  'unique-hollowmark': I('sword', 'void', 'void', 'obsidian'),
  'unique-verrins-requiem': I('sword', 'moon', 'amethyst', 'umbral'),
  'unique-worldsplitter': I('axe', 'steel', 'eclipse', 'rootwood'),
  'briarvein-kris': I('dagger', 'steel', 'moss', 'rootwood'),
  'hollow-fang': I('dagger', 'ivory', 'amethyst', 'umbral'),
  'cindergnaw': I('dagger', 'basalt', 'ember', 'leather'),
  'ashveil-throwing-knives': I('knives', 'ash', 'ember', 'leather'),
  'keeper-staff': I('staff', 'wood', 'eclipse'),
  'nullthorn-staff': I('staff', 'umbral', 'amethyst', 'umbral'),
  'pyreclast-wand': I('wand', 'ember', 'ember', 'basalt'),
  'astral-glaive': I('polearm', 'silver', 'orbit', 'midnight'),
  'radiant-halberd': I('polearm', 'dawn', 'sungold', 'gold'),
  'starfall-maul': I('maul', 'midnight', 'orbit', 'brass'),
  'rootbreaker-mace': I('mace', 'rootwood', 'amber', 'wood'),
  'meridian-longbow': I('bow', 'brass', 'orbit', 'midnight'),
  'spinerift-crossbow': I('crossbow', 'rootwood', 'moss'),
  'godforge-tongs': I('tongs', 'iron', 'eclipse'),
  'kaels-hammer': I('hammer', 'iron', 'ember'),

  // ── Forged tools (skills/tool-items): tier material climbs iron → ember → umbral → celestial → eclipse ──
  'starter-pickaxe': I('pickaxe', 'grey', 'stone'), 'pickaxe-1': I('pickaxe', 'iron', 'stone'), 'pickaxe-2': I('pickaxe', 'basalt', 'ember'),
  'pickaxe-3': I('pickaxe', 'umbral', 'amethyst'), 'pickaxe-4': I('pickaxe', 'midnight', 'orbit', 'brass'), 'pickaxe-5': I('pickaxe', 'eclipse', 'dawn', 'obsidian'),
  'starter-axe': I('axe', 'grey', 'stone'), 'axe-1': I('axe', 'iron', 'stone'), 'axe-2': I('axe', 'dawn', 'sungold'),
  'axe-3': I('axe', 'silver', 'orbit', 'midnight'), 'axe-4': I('axe', 'midnight', 'orbit', 'brass'), 'axe-5': I('axe', 'eclipse', 'dawn', 'obsidian'),
  'starter-sickle': I('sickle', 'grey', 'stone'), 'sickle-1': I('sickle', 'steel', 'moss'), 'sickle-2': I('sickle', 'ash', 'ember'),
  'sickle-3': I('sickle', 'ivory', 'amethyst', 'umbral'), 'sickle-4': I('sickle', 'basalt', 'ember', 'iron'),
  'staff-1': I('staff', 'wood', 'glow'), 'staff-2': I('staff', 'rootwood', 'bio'), 'staff-3': I('staff', 'obsidian', 'moon', 'umbral'), 'staff-4': I('staff', 'basalt', 'ember', 'basalt'),

  // ── Worn: head ──
  'astral-helm': I('helm', 'midnight', 'brass'),
  'cometfall-helm': I('helm', 'silver', 'orbit'),
  'forgeborn-warhelm': I('helm', 'iron', 'ember'),
  'keepers-cowl': I('hood', 'obsidian', 'eclipse'),
  'voidweave-cowl': I('hood', 'umbral', 'amethyst'),
  'unique-stillglass-cowl': I('hood', 'midnight', 'glass'),
  'unique-lantern-oath': I('helm', 'stone', 'amber'),
  'crown-of-the-first-dawn': I('crown', 'sungold', 'dawn'),
  'unique-crown-of-borrowed-noon': I('crown', 'brass', 'orbit'),
  'unique-nameless-crown': I('crown', 'grey', 'void'),
  'unique-spore-crown': I('crown', 'moss', 'bio'),
  // ── chest ──
  'infernal-cuirass': I('cuirass', 'iron', 'ember'),
  'starplate-cuirass': I('cuirass', 'midnight', 'orbit'),
  'duskmail-hauberk': I('cuirass', 'umbral', 'amethyst'),
  'unique-quiet-cuirass': I('cuirass', 'obsidian', 'moon'),
  'cinderhide-coat': I('robe', 'leather', 'ember'),
  'unique-ashfall-wrap': I('robe', 'ash', 'ember'),
  'keepers-mantle': I('mantle', 'obsidian', 'gold'),
  'luminous-aegis-mantle': I('mantle', 'stone', 'sungold'),
  'unique-aureths-mantle': I('mantle', 'ivory', 'dawn'),
  'thornmantle-pauldrons': I('mantle', 'moss', 'amber'),
  'unique-heartwood-of-the-verge': I('cuirass', 'rootwood', 'moss'),
  'unique-rootmothers-embrace': I('robe', 'moss', 'amber'),
  // ── legs, feet, hands ──
  'luminous-greaves': I('greaves', 'stone', 'sungold'),
  'solstice-greaves': I('greaves', 'gold', 'dawn'),
  'unique-thornroot-greaves': I('greaves', 'rootwood', 'moss'),
  'blazebraid-belt': I('belt', 'leather', 'ember'),
  'astral-striders': I('boots', 'midnight', 'brass'),
  'godforge-gauntlets': I('gauntlet', 'iron', 'eclipse'),
  'unique-kaels-left-hand': I('gauntlet', 'iron', 'ember'),
  'unique-ashen-covenant': I('gauntlet', 'ash', 'ember'),
  'unique-tinders-due': I('gauntlet', 'leather', 'ember'),
  'unique-first-anvil-fragment': I('anvil', 'iron', 'ember'),
  'unique-anvil-of-small-hours': I('anvil', 'basalt', 'ember'),
  'ember-vambraces': I('bracer', 'basalt', 'ember'),
  'verdant-bracers': I('bracer', 'rootwood', 'moss'),
  // ── off-hand ──
  'rootwall-shield': I('shield', 'rootwood', 'moss'),
  'abyssal-aegis': I('shield', 'umbral', 'amethyst'),
  'void-buckler': I('buckler', 'void', 'void'),
  'unique-lastwarden': I('shield', 'obsidian', 'moon'),
  'unique-mirror-of-small-mercies': I('mirror', 'moon', 'amethyst', 'umbral'),
  'unique-mirror-meridians': I('mirror', 'silver', 'brass', 'midnight'),
  'unique-archivists-codex': I('book', 'midnight', 'brass'),
  'unique-merchants-ledger': I('book', 'leather', 'gold'),
  'unique-mourners-ledger': I('book', 'umbral', 'moon'),
  'unique-pyrograph-scroll-case': I('scroll', 'paper', 'ember', 'basalt'),
  'unique-shadowloom': I('shuttle', 'umbral', 'amethyst'),
  // ── trinkets and charms ──
  'anchor-ring': I('ring', 'brass', 'orbit'),
  'keeper-signet': I('ring', 'gold', 'eclipse'),
  'coinspinners-ring': I('ring', 'gold', 'sungold'),
  'astral-pendant': I('pendant', 'midnight', 'orbit', 'brass'),
  'aurumleaf-pendant': I('pendant', 'gold', 'sungold', 'gold'),
  'unique-first-light-pendant': I('pendant', 'stone', 'dawn', 'gold'),
  'unique-copper-witness': I('coin', 'copper', 'copper'),
  'unique-cartographers-regret': I('map', 'paper', 'orbit'),
  'unique-the-unstruck-hour': I('hourglass', 'void', 'void', 'obsidian'),
  'unique-eclipse-hourglass': I('hourglass', 'glass', 'eclipse', 'obsidian'),
  'unique-architect-compass': I('compass', 'brass', 'orbit'),
  'unique-heartstone-world-root': I('heart', 'amber', 'moss'),
  'phantom-toll': I('coin', 'moon', 'amethyst'),
  'tithe-of-ash': I('coin', 'ash', 'ember'),
  'dewdrop-purse': I('purse', 'leather', 'bio'),
  'cinder-compass': I('compass', 'basalt', 'ember', 'paper'),
  'ember-primer': I('book', 'basalt', 'ember'),
  'gilded-quill': I('quill', 'ivory', 'gold'),
  'inkwell-talisman': I('inkwell', 'umbral', 'amethyst'),
  'lens-of-the-archivist': I('lens', 'brass', 'glass'),
  'seedpod-of-knowing': I('seedpod', 'moss', 'amber'),
  'starweavers-thread': I('spool', 'silver', 'orbit'),
  'sunstone-dowser': I('pendant', 'stone', 'amber', 'brass'),
  'thornseeker-beetle': I('beetle', 'moss', 'amber'),
  'unique-voids-whisper': I('orb', 'void', 'void'),
  'unique-tally-of-hands': I('page', 'ivory', 'crimson'),
  'unique-long-account': I('scroll', 'paper', 'gold'),
  'unique-keepers-second-name': I('page', 'ivory', 'eclipse'),
  'unique-verdant-accord': I('seedpod', 'rootwood', 'moss'),
  'unique-merchants-scale': I('scale', 'gold', 'sungold'),
  'unique-eclipse-manifest': I('sun', 'obsidian', 'eclipse'),

  // ── Consumables ──
  'clarity-elixir': I('potion', 'glass', 'orbit'),
  'ember-elixir': I('potion', 'glass', 'ember'),
  'thornberry-elixir': I('potion', 'glass', 'crimson'),
  'liquid-dawn': I('flask', 'glass', 'dawn'),
  'embervial': I('vial', 'glass', 'ember'),
  'phial-null': I('vial', 'glass', 'umbral'),
  'rootsap-tincture': I('vial', 'glass', 'amber'),
  'veil-draught': I('potion', 'glass', 'amethyst'),
  'astral-ink': I('inkwell', 'midnight', 'orbit'),
  'starbloom-tea': I('cup', 'ivory', 'amber'),
  'forge-dust-sachet': I('purse', 'leather', 'ember'),
  'eclipse-fragment-capsule': I('capsule', 'obsidian', 'eclipse'),
  'scroll-shattering-memory': I('scroll', 'paper', 'amethyst'),
  'rift-key': I('key', 'eclipse'),

  // ── Materials ──
  'cinder-ore': I('ore', 'basalt', 'ember'),
  'emberheart-ore': I('ore', 'obsidian', 'dawn'),
  'orichalcum-ore': I('ore', 'stone', 'copper'),
  'pyrite-dust': I('dust', 'iron', 'brass'),
  'celestial-alloy': I('bars', 'silver', 'orbit'),
  'celestial-quartz': I('crystal', 'glass', 'orbit'),
  'luminous-prism': I('gem', 'dawn', 'sungold'),
  'void-crystal': I('crystal', 'eclipse', 'void'),
  'void-shard': I('shard', 'void'),
  'umbral-ink': I('drop', 'umbral', 'amethyst'),
  'verdant-sap': I('drop', 'moss'),
  'solar-resin': I('drop', 'amber'),
  'starlight-herb': I('herb', 'silver', 'orbit', 'midnight'),
  'moonpetal-herb': I('flower', 'moon', 'silver'),
  'sunbloom': I('flower', 'sungold', 'ember'),
  'nightbloom': I('flower', 'amethyst', 'dawn', 'umbral'),
  'glowcap': I('flower', 'glow', 'bio'),
  'thornroot': I('herb', 'rootwood', 'moss', 'rootwood'),
  'shadow-root-cutting': I('herb', 'umbral', 'amethyst', 'umbral'),
  'shadowthread-silk': I('spool', 'umbral', 'amethyst'),
  'world-root-bark': I('log', 'rootwood', 'amber'),
  'slag-fragment': I('lump', 'slag', 'slag'),
  'godforge-slag': I('lump', 'obsidian', 'eclipse'),
  'godforge-fragment': I('shard', 'dawn', 'dawn'),
  'godstone': I('gem', 'gold', 'dawn'),
  'ember-residue': I('dust', 'basalt', 'ember'),
  'infernal-heartstone': I('heart', 'rose', 'ember'),
  'obsidian-heart': I('heart', 'obsidian', 'eclipse'),
  'fragment-first-sun': I('sun', 'dawn', 'sungold'),
  'relic-third-dawn': I('crystal', 'dawn', 'sungold'),
  'relic-dust': I('dust', 'ivory', 'dawn'),

  // ── Quest objects ──
  'broken-astral-compass': I('compass', 'midnight', 'orbit', 'paper'),
  'rift-map-fragment': I('map', 'paper', 'eclipse'),
  'sealed-codex-page': I('page', 'paper', 'crimson'),

  // ── Currencies ──
  'gold': I('coins', 'gold', 'sungold'),
  'essence': I('drop', 'eclipse'),
  'aether': I('star', 'silver', 'orbit'),
  'infernal-token': I('coin', 'basalt', 'ember'), 'luminous-token': I('coin', 'gold', 'dawn'), 'umbral-token': I('coin', 'umbral', 'amethyst'),
  'celestial-token': I('coin', 'midnight', 'orbit'), 'verdant-token': I('coin', 'rootwood', 'moss'),

  // ── The Market's forge, hammers, mastery and enchantments (items you own and see working on the Homestead) ──
  'forge-bellows': I('bellows', 'leather', 'brass'),
  'ember-stoker': I('wand', 'iron', 'ember', 'iron'),
  'nether-furnace': I('furnace', 'basalt', 'ember'),
  'aether-siphon': I('flask', 'glass', 'orbit'),
  'nox-harvester': I('sickle', 'umbral', 'amethyst', 'umbral'),
  'realm-conduit': I('crystal', 'moon', 'orbit'),
  'eclipse-core': I('core', 'obsidian', 'eclipse'),
  'eclipse-reactor': I('core', 'iron', 'eclipse'),
  'godforge-heart': I('heart', 'eclipse', 'dawn'),
  'the-first-sun': I('sun', 'dawn', 'ember'),
  'iron-hammer': I('hammer', 'iron', 'stone'),
  'obsidian-mallet': I('hammer', 'obsidian', 'eclipse'),
  'nox-crusher': I('maul', 'umbral', 'amethyst'),
  'eclipse-hammer': I('maul', 'eclipse', 'dawn', 'obsidian'),
  'aether-striker': I('hammer', 'silver', 'orbit', 'midnight'),
  'forge-efficiency-i': I('gear', 'iron', 'ember'), 'forge-efficiency-ii': I('gear', 'brass', 'ember'),
  'forge-efficiency-iii': I('gear', 'gold', 'ember'), 'forge-mastery': I('gear', 'eclipse', 'dawn'),
  'convergents-blessing': I('orb', 'dawn', 'eclipse'),
  'eclipse-aura': I('flame', 'eclipse', 'amethyst'),
  'scholars-mark': I('book', 'midnight', 'gold'),
  'seekers-lens': I('lens', 'gold', 'glass'),

  // ── The Delve's placeables (shared/delve) ──
  'dirt-block': I('block', 'wood', 'rootwood'),
  'basalt-block': I('block', 'basalt', 'ash'),
  'torch': I('torch', 'wood', 'ember'),
  'ladder': I('ladder', 'wood'),
  'platform': I('plank', 'wood'),
  'timber-support': I('support', 'wood'),
  'basalt-support': I('support', 'basalt', undefined, 'basalt'),
  'blast-charge': I('charge', 'crimson', 'brass'),
  'chest': I('chest', 'wood', 'brass'),
  'camp': I('tent', 'leather', 'ember'),

};

/**
 * Stall plaques and waystone crowns: what a station sells or does, as a thing.
 * Kept apart from ITEM_ICONS because these keys are also UI art elsewhere (the
 * realm crests, the Gambler's portal layers, the Market's category tiles), and
 * only the plaque in the world means "this stall".
 */
const PLAQUE_ICONS: Readonly<Record<string, IconSpec>> = {
  'rift-portal-core': I('portal', 'obsidian', 'eclipse'),
  'eclipse-summoning-sigil': I('core', 'obsidian', 'eclipse'),
  'enchantment-active': I('flame', 'eclipse', 'amethyst'),
  'trade-complete': I('scale', 'gold', 'sungold'),
  'celestial-crest': I('crest', 'midnight', 'orbit'),
  'eclipse-banner': I('banner', 'obsidian', 'eclipse'),
  'artifacts': I('chest', 'obsidian', 'gold'),
};

/** The library's file stems for the same things (ART_ALIAS's targets), so a caller asking by file name sees the icon too. */
export const FILE_STEMS: Readonly<Record<string, string>> = {
  'fragment-of-the-first-sun': 'fragment-first-sun', 'mirrorblade-of-kael': 'mirrorblade-kael', 'relic-of-the-third-dawn': 'relic-third-dawn',
  'basalt-edge-portrait': 'basalt-edge', 'eclipse-longblade-portrait': 'eclipse-longblade', 'keeper-staff-portrait': 'keeper-staff',
  'obsidian-heart-portrait': 'obsidian-heart',
};
export const ITEM_ICONS: Readonly<Record<string, IconSpec>> = {
  ...ITEM_ICONS_BY_ID,
  ...Object.fromEntries(Object.entries(FILE_STEMS).map(([stem, id]) => [stem, ITEM_ICONS_BY_ID[id]])),
};

// ── Runes: one tablet, one carved glyph each ─────────────────────────────────

/** Each rune's [tablet, glyph] materials; the tablet darkens and enriches up the tiers. */
export const RUNE_ICONS: Readonly<Record<string, readonly [Material, Material]>> = {
  ash: ['grey', 'ash'], ember: ['basalt', 'ember'], drift: ['grey', 'moon'], shade: ['grey', 'umbral'],
  glint: ['stone', 'sungold'], veil: ['stone', 'moon'], pulse: ['stone', 'rose'], thorn: ['stone', 'moss'], scorch: ['basalt', 'ember'],
  nexus: ['obsidian', 'orbit'], sigil: ['obsidian', 'amethyst'], rift: ['obsidian', 'eclipse'], hollow: ['obsidian', 'moon'],
  fracture: ['umbral', 'eclipse'], eclipse: ['umbral', 'dawn'], forge: ['iron', 'ember'],
  aether: ['midnight', 'silver'], nox: ['umbral', 'amethyst'], codex: ['midnight', 'gold'],
  convergence: ['ivory', 'eclipse'], godstone: ['gold', 'dawn'], void: ['void', 'void'],
  // The Art Bible's named runes (rune-of-*): realm stones.
  'rune-of-cinder': ['basalt', 'ember'], 'rune-of-dawns-edge': ['stone', 'dawn'], 'rune-of-erasure': ['umbral', 'moon'],
  'rune-of-hollow': ['obsidian', 'moon'], 'rune-of-overgrowth': ['rootwood', 'moss'], 'rune-of-radiance': ['stone', 'sungold'],
  'rune-of-root': ['rootwood', 'amber'], 'rune-of-starfire': ['midnight', 'orbit'], 'rune-of-the-forge': ['iron', 'ember'],
  'rune-of-the-solstice': ['gold', 'dawn'], 'rune-of-the-underhearth': ['iron', 'ember'], 'rune-of-the-world-root': ['rootwood', 'bio'],
  'rune-of-void-navigation': ['void', 'orbit'],
  // Runewords: gold-set tablets.
  'first-light': ['gold', 'dawn'], 'shadow-step': ['gold', 'umbral'], 'realm-bridge': ['gold', 'orbit'],
  'convergents-will': ['gold', 'eclipse'], 'godforge-mastery': ['gold', 'ember'], 'breath-of-the-void': ['gold', 'void'],
};

/** The rune-word ids (item-word cards), so a caller can tell a word from a rune. */
const RUNEWORDS = new Set(['first-light', 'shadow-step', 'realm-bridge', 'convergents-will', 'godforge-mastery', 'breath-of-the-void']);

/** The strokes a glyph is built from, on a 5 × 7 grid; the stem (x 2) is always cut. */
const STROKES: readonly (readonly (readonly [number, number])[])[] = [
  [[0, 0], [1, 0], [3, 0], [4, 0]],            // top bar
  [[0, 6], [1, 6], [3, 6], [4, 6]],            // foot bar
  [[0, 2], [1, 1]],                            // left arm up
  [[4, 2], [3, 1]],                            // right arm up
  [[0, 4], [1, 3], [3, 3], [4, 4]],            // chevron
  [[1, 5], [0, 6], [3, 5], [4, 6]],            // forked root
  [[0, 3], [4, 3]],                            // two notches
  [[1, 3], [3, 3]],                            // crossbar
  [[3, 1], [4, 0]],                            // right hook
  [[0, 5], [1, 4]],                            // left spur
];

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** Bits → stroke set, at least three strokes; the result is unique among the runes (assigned in table order). */
const GLYPHS: ReadonlyMap<string, number> = (() => {
  const used = new Set<number>();
  const out = new Map<string, number>();
  for (const id of Object.keys(RUNE_ICONS)) {
    let h = hash(id);
    for (let tries = 0; tries < 64; tries++) {
      const bits = h & 0x3ff;
      const count = bits.toString(2).split('1').length - 1;
      if (count >= 3 && count <= 5 && !used.has(bits)) { used.add(bits); out.set(id, bits); break; }
      h = hash(`${h}:${id}`);
    }
  }
  return out;
})();

/** The 5 × 7 glyph cells for a rune (pure; the spec checks every rune's differs). */
export function runeGlyph(id: string): ReadonlySet<string> {
  const bits = GLYPHS.get(id) ?? 0b111;
  const cells = new Set<string>();
  for (let y = 0; y < 7; y++) cells.add(`2,${y}`);
  STROKES.forEach((stroke, i) => { if (bits & (1 << i)) for (const [x, y] of stroke) cells.add(`${x},${y}`); });
  return cells;
}

// ── Render ───────────────────────────────────────────────────────────────────

type Grid = string[][];

function gridOf(shape: IconShape): Grid {
  return Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => shape[y]?.[x] ?? '.'));
}

/** Move the filled box to the centre of the 16 × 16 cell, leaving room for the outline. */
function centred(g: Grid): Grid {
  let x0 = 16, y0 = 16, x1 = -1, y1 = -1;
  g.forEach((row, y) => row.forEach((c, x) => {
    if (c === '.') return;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }));
  if (x1 < 0) return g;
  const dx = Math.floor((16 - (x1 - x0 + 1)) / 2) - x0;
  const dy = Math.floor((16 - (y1 - y0 + 1)) / 2) - y0;
  const out: Grid = Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => '.'));
  g.forEach((row, y) => row.forEach((c, x) => {
    const nx = x + dx, ny = y + dy;
    if (c !== '.' && nx >= 0 && nx < 16 && ny >= 0 && ny < 16) out[ny][nx] = c;
  }));
  return out;
}

function paletteOf(spec: IconSpec): Readonly<Record<string, string>> {
  const [D, d, b, l, h] = RAMPS[spec.mat];
  const sub = RAMPS[spec.sub ?? SUB[spec.kind] ?? 'wood'];
  const acc = RAMPS[spec.acc ?? 'gold'];
  return { D, d, b, l, h, w: sub[1], v: sub[2], u: sub[3], e: acc[1], a: acc[2], A: acc[3], G: acc[4], s: SHINE };
}

function svgOf(g: Grid, pal: Readonly<Record<string, string>>): string {
  // The outline: every clear cell touching the body. Lit (top/left of the body) cells take the lighter step.
  const filled = (x: number, y: number) => x >= 0 && x < 16 && y >= 0 && y < 16 && g[y][x] !== '.' && g[y][x] !== 'o' && g[y][x] !== 'O';
  const out = g.map(row => [...row]);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (g[y][x] !== '.') continue;
    const below = filled(x, y + 1), right = filled(x + 1, y), above = filled(x, y - 1), left = filled(x - 1, y);
    if (!(below || right || above || left)) continue;
    out[y][x] = (below || right) && !above && !left ? 'O' : 'o';
  }
  const fill = (c: string) => c === 'o' ? OUTLINE : c === 'O' ? OUTLINE_LIT : pal[c] ?? pal['b'];
  const rects: string[] = [];
  for (let y = 0; y < 16; y++) {
    let x = 0;
    while (x < 16) {
      const c = out[y][x];
      if (c === '.') { x++; continue; }
      let run = 1;
      while (x + run < 16 && out[y][x + run] === c) run++;
      rects.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${fill(c)}"/>`);
      x += run;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="64" height="64" shape-rendering="crispEdges">${rects.join('')}</svg>`;
}

function runeGrid(id: string): Grid {
  const g = gridOf(RUNE_TABLET);
  // Runewords get a gold rim cut into the tablet face.
  if (RUNEWORDS.has(id)) for (let y = 2; y <= 11; y++) { g[y][3] = 'e'; g[y][11] = 'e'; }
  for (const cell of runeGlyph(id)) {
    const [x, y] = cell.split(',').map(Number);
    g[RUNE_GLYPH_AT.y + y][RUNE_GLYPH_AT.x + x] = y === 0 || x === 2 && y < 2 ? 'G' : 'A';
  }
  return g;
}

const cache = new Map<string, ArtEntry | null>();

function entry(svg: string): ArtEntry {
  return { src: `data:image/svg+xml,${encodeURIComponent(svg)}`, srcset: '', width: 64, height: 64 };
}

/** The pixel icon for an item id, or null when it has none. Cached. */
export function itemIcon(id: string | null | undefined): ArtEntry | null {
  if (!id) return null;
  const hit = cache.get(id);
  if (hit !== undefined) return hit;
  const spec = Object.prototype.hasOwnProperty.call(ITEM_ICONS, id) ? ITEM_ICONS[id] : null;
  const made = spec ? entry(svgOf(centred(gridOf(SHAPES[spec.kind as IconKind])), paletteOf(spec))) : null;
  cache.set(id, made);
  return made;
}

/** A pixel icon for a spec that is not an item (the Gambler's coin, flames, the box on its shelf). Cached. */
export function iconOf(kind: IconKind, mat: Material, acc?: Material, sub?: Material): ArtEntry {
  const key = `spec:${kind}:${mat}:${acc ?? ''}:${sub ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const made = entry(svgOf(centred(gridOf(SHAPES[kind])), paletteOf(I(kind, mat, acc, sub))));
  cache.set(key, made);
  return made;
}

/** The icon on a stall plaque or waystone: its own plaque icon, else the item's. Cached. */
export function plaqueIcon(key: string | null | undefined): ArtEntry | null {
  if (!key) return null;
  if (!Object.prototype.hasOwnProperty.call(PLAQUE_ICONS, key)) return itemIcon(key);
  const cacheKey = `plaque:${key}`;
  const hit = cache.get(cacheKey);
  if (hit !== undefined) return hit;
  const spec = PLAQUE_ICONS[key];
  const made = entry(svgOf(centred(gridOf(SHAPES[spec.kind as IconKind])), paletteOf(spec)));
  cache.set(cacheKey, made);
  return made;
}

/**
 * The pixel rune tablet for a rune or rune-word id, or null. Separate from
 * `itemIcon` because two rune ids are also other things (`aether` the currency,
 * `forge` the station), and only the Rune Forge's cards mean the rune.
 */
export function runeIcon(id: string | null | undefined): ArtEntry | null {
  if (!id || !Object.prototype.hasOwnProperty.call(RUNE_ICONS, id)) return null;
  const key = `rune:${id}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const [tablet, glyph] = RUNE_ICONS[id];
  const made = entry(svgOf(centred(runeGrid(id)), paletteOf({ kind: 'rune', mat: tablet, acc: glyph })));
  cache.set(key, made);
  return made;
}

/** Every id with an item icon (tests and the art audit read it). */
export const ITEM_ICON_IDS: readonly string[] = Object.keys(ITEM_ICONS);
/** Every stall-plaque key with its own icon. */
export const PLAQUE_ICON_IDS: readonly string[] = Object.keys(PLAQUE_ICONS);
