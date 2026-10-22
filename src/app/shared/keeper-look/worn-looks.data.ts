/**
 * worn-looks.data.ts — the hand-authored worn looks: every unique, every boss's own and every set piece, drawn to match
 * its icon (art/item-icons.ts: the same materials), its name and its lore. Keyed by item definition id.
 *
 * A NEW unique can carry its look on its own entry instead (unique-items.ts `look`, the same WornLookSpec) — that wins
 * over this table, so whoever adds a unique adds its look beside its lore and never edits this file. Colours are hexes
 * or icon ramp names ('umbral' → its shade, base and lit steps; as an accent, its lit step). The shapes, the details and
 * what each one paints: worn-look.model.ts.
 *
 * Pure data.
 */
import type { WornLookSpec } from './worn-look.model';

/** The Sexton's grave-dark wool: near black with a cold violet cast. */
const GRAVE: readonly [string, string, string] = ['#0e0a10', '#1e1820', '#342a36'];
const EMBER = '#ffb347', EMBER_HOT = '#ff7a2e', VIOLET = '#b06bff', VIOLET_PALE = '#f0e0ff', BONE = '#e8e1cf';
const MOTE_GOLD = '#fff1b0', SPORE = '#9af0d0', VOID_PINK = '#ff6dd7';

export const WORN_LOOK_TABLE: Readonly<Record<string, WornLookSpec>> = {
  // ── The bosses' own (boss-uniques.ts) ──────────────────────────────────────────────────────────────────────────
  // He lost it the night he counted forty-one: a deep grave-dark cowl, the face lost in its shadow, two red eye-pips.
  'unique-sextons-lost-cowl': { shape: 'cowl', pal: GRAVE, accent: '#ff3b30', trim: '#4a3c4c', eyes: '#ff3b30', shadow: true, seam: '#5a5048', fx: { kind: 'mist', color: '#2a2030' } },
  // It banked the heat to keep the seam shut: a basalt crown of coals, embers rising off it.
  'unique-crown-banked-coal': { shape: 'crown', pal: 'basalt', accent: EMBER_HOT, runes: EMBER, fx: { kind: 'embers', color: EMBER } },
  // Swung over the drowned for a hundred years: a brass censer on its chain, violet smoke.
  'unique-abbess-censer': { shape: 'censer', pal: 'brass', accent: VIOLET, sub: '#4a3260', fx: { kind: 'smoke', color: VIOLET } },
  // The bone thread the Seamworks stitched the seam with: dark gloves, a violet seam, bone stitches.
  'unique-seamstitch-grips': { shape: 'gloves', pal: ['#120c18', '#221830', '#3a2a4a'], accent: VIOLET, seam: VIOLET, trim: BONE, runes: VIOLET_PALE },
  // A crucible that never cools: a black pot of molten ore in the off-hand, embers off its lip.
  'unique-tyrants-crucible': { shape: 'crucible', pal: 'basalt', accent: EMBER_HOT, sub: 'iron', fx: { kind: 'embers', color: EMBER } },
  // Four smithies' one hammer: a basalt maul banded in iron, its face still glowing.
  'unique-hammer-first-watch': { shape: 'hammer', pal: 'basalt', accent: EMBER_HOT, sub: 'iron', runes: EMBER },
  // Splinters of rootglass that remember the tree: a rootwood bow with amber splinters and moss on the grip.
  'unique-splinterbow-rootcradle': { shape: 'bow', pal: 'rootwood', accent: '#f2b65e', sub: 'moss', runes: SPORE },
  // It stood so long the moss gave it a heartbeat: mossed plate, an amber heart, a moss mantle.
  'unique-mossbound-heart': { shape: 'plate', pal: 'moss', accent: '#f2b65e', mantle: '#3a5a2a', runes: '#f2b65e', fx: { kind: 'motes', color: SPORE } },
  // The mine's last light, banked: an ember pendant.
  'unique-wardens-last-ember': { shape: 'pendant', pal: 'basalt', accent: EMBER_HOT, fx: { kind: 'embers', color: EMBER } },
  // The dragon's last heat in a bone: a bone phylactery on a cord.
  'unique-ashbone-phylactery': { shape: 'pendant', pal: 'ivory', accent: EMBER_HOT },

  // ── The item sets (set-items.ts): each set one palette, its four pieces read as a kit ──────────────────────────
  // The Ossuary Watch: ash-black garrison iron, pyre embers.
  'set-ossuary-helm': { shape: 'great-helm', pal: 'ash', accent: EMBER_HOT, sub: 'iron', eyes: EMBER, horns: BONE },
  'set-ossuary-hauberk': { shape: 'scale', pal: 'ash', accent: EMBER_HOT, sub: 'iron', runes: EMBER },
  'set-ossuary-bulwark': { shape: 'shield', pal: 'ash', accent: EMBER_HOT, sub: 'iron', runes: EMBER },
  'set-ossuary-boots': { shape: 'greaves', pal: 'ash', accent: EMBER_HOT, sub: 'iron' },
  // The Drowned Abbey: umbral wool, brass, ink.
  'set-abbey-hood': { shape: 'hood', pal: 'umbral', accent: VIOLET, trim: '#b08a55', runes: '#7b4fc0' },
  'set-abbey-robe': { shape: 'robe', pal: 'umbral', accent: VIOLET, trim: '#b08a55', runes: '#7b4fc0', seam: '#140c1c' },
  'set-abbey-censer-chain': { shape: 'pendant', pal: 'brass', accent: VIOLET },
  'set-abbey-sandals': { shape: 'sandals', pal: 'umbral', accent: '#b08a55', sub: '#8a7a58' },
  // Rootcradle Vestments: moss, bark-strip, amber.
  'set-rootcradle-circlet': { shape: 'circlet', pal: 'rootwood', accent: '#f2b65e', runes: '#7fb85a', fx: { kind: 'motes', color: SPORE } },
  'set-rootcradle-wrap': { shape: 'cloak', pal: 'moss', accent: '#f2b65e', sub: 'rootwood', mantle: '#7a5a36' },
  'set-rootcradle-bracers': { shape: 'gloves', pal: 'moss', accent: '#f2b65e', sub: 'rootwood', seam: '#7a5a36' },
  'set-rootcradle-greaves': { shape: 'greaves', pal: 'moss', accent: '#f2b65e', sub: 'rootwood', runes: '#f2b65e' },
  // The Lamplighter's Things: oiled leather, brass, the lamp's gold.
  'set-lamplighter-lantern': { shape: 'lantern', pal: 'brass', accent: '#ffd27a', sub: 'iron', fx: { kind: 'motes', color: '#ffd27a' } },
  'set-lamplighter-coat': { shape: 'leather', pal: 'leather', accent: '#E8D44D', trim: '#b08a55' },
  'set-lamplighter-gloves': { shape: 'gloves', pal: 'leather', accent: '#E8D44D', trim: '#b08a55', seam: '#2a1810' },
  'set-lamplighter-signet': { shape: 'ring', pal: 'sungold', accent: '#fff1b0' },

  // ── The open uniques (unique-items.ts), by slot ──────────────────────────────────────────────────────────────────
  // Head
  'unique-lantern-oath': { shape: 'open-helm', pal: 'stone', accent: '#f2b65e', runes: '#f2b65e' },
  'unique-stillglass-cowl': { shape: 'cowl', pal: 'midnight', accent: '#e8f0f8', eyes: '#d8ecff', shadow: true, trim: '#c8d4e0' },
  'unique-crown-of-borrowed-noon': { shape: 'crown', pal: 'brass', accent: '#5fb6ff', runes: '#00d4ff', fx: { kind: 'motes', color: MOTE_GOLD } },
  'unique-nameless-crown': { shape: 'crown', pal: 'grey', accent: VOID_PINK, horns: '#5c5359', fx: { kind: 'mist', color: '#2a1a3a' } },
  'unique-spore-crown': { shape: 'crown', pal: 'moss', accent: '#7fd5a3', runes: '#c4ffe0', fx: { kind: 'motes', color: SPORE } },
  // Chest
  'unique-ashfall-wrap': { shape: 'robe', pal: 'ash', accent: EMBER_HOT, seam: '#7a2a12' },
  'unique-quiet-cuirass': { shape: 'plate', pal: 'obsidian', accent: '#b8bcd8', runes: '#8a90b0' },
  'unique-heartwood-of-the-verge': { shape: 'scale', pal: 'rootwood', accent: '#7fb85a', mantle: '#4a7a3a', fx: { kind: 'motes', color: SPORE } },
  'unique-aureths-mantle': { shape: 'cloak', pal: 'ivory', accent: '#ffe7a0', mantle: '#ffe7a0', runes: '#b8901e', fx: { kind: 'motes', color: MOTE_GOLD } },
  'unique-rootmothers-embrace': { shape: 'robe', pal: 'moss', accent: '#f2b65e', runes: '#f2b65e', mantle: '#7a5a36', fx: { kind: 'motes', color: SPORE } },
  // Hands
  'unique-tinders-due': { shape: 'gloves', pal: 'leather', accent: EMBER_HOT, seam: EMBER_HOT },
  'unique-anvil-of-small-hours': { shape: 'gauntlets', pal: 'basalt', accent: EMBER_HOT, runes: EMBER },
  'unique-first-anvil-fragment': { shape: 'gauntlets', pal: 'iron', accent: EMBER_HOT, runes: EMBER, fx: { kind: 'embers', color: EMBER } },
  'unique-ashen-covenant': { shape: 'gauntlets', pal: 'ash', accent: EMBER_HOT, runes: EMBER_HOT },
  'unique-kaels-left-hand': { shape: 'gauntlets', pal: 'iron', accent: EMBER_HOT, runes: '#ffd08a', fx: { kind: 'embers', color: EMBER } },
  // Legs
  'unique-thornroot-greaves': { shape: 'greaves', pal: 'rootwood', accent: '#7fb85a', runes: '#7fb85a' },
  // Weapons
  'unique-cinderwake': { shape: 'sword', pal: 'ember', accent: '#ffd08a', sub: 'basalt' },
  'unique-hollowmark': { shape: 'sword', pal: 'void', accent: VOID_PINK, sub: 'obsidian', runes: VOID_PINK },
  'unique-goldmouth': { shape: 'sword', pal: 'gold', accent: '#E8D44D', sub: 'leather' },
  'unique-verrins-requiem': { shape: 'greatsword', pal: 'moon', accent: '#A855F7', sub: 'umbral', runes: '#c9a0ff', fx: { kind: 'mist', color: '#3a1f63' } },
  'unique-worldsplitter': { shape: 'axe', pal: 'steel', accent: '#a855f7', sub: 'rootwood', runes: '#d9b8ff', fx: { kind: 'motes', color: '#d9b8ff' } },
  'unique-forges-memory': { shape: 'greatsword', pal: 'iron', accent: EMBER_HOT, sub: 'leather', runes: EMBER, fx: { kind: 'embers', color: EMBER } },
  // Off-hand
  'unique-mourners-ledger': { shape: 'tome', pal: 'umbral', accent: '#b8bcd8' },
  'unique-lastwarden': { shape: 'shield', pal: 'obsidian', accent: '#b8bcd8', runes: '#8a90b0' },
  'unique-mirror-of-small-mercies': { shape: 'orb', pal: 'moon', accent: '#A855F7', sub: 'umbral' },
  'unique-shadowloom': { shape: 'wand', pal: 'umbral', accent: '#A855F7', fx: { kind: 'mist', color: '#3a1f63' } },
  'unique-pyrograph-scroll-case': { shape: 'scroll', pal: 'paper', accent: EMBER_HOT, sub: 'basalt' },
  'unique-mirror-meridians': { shape: 'orb', pal: 'silver', accent: '#b08a55', sub: 'midnight' },
  'unique-archivists-codex': { shape: 'tome', pal: 'midnight', accent: '#e8c47a', runes: '#00d4ff', fx: { kind: 'motes', color: '#d8ecff' } },
  'unique-merchants-ledger': { shape: 'tome', pal: 'leather', accent: '#e8c898' },
  // Trinkets (a pendant or a ring at the throat)
  'unique-copper-witness': { shape: 'pendant', pal: 'copper', accent: '#d88a5a' },
  'unique-first-light-pendant': { shape: 'pendant', pal: 'stone', accent: '#ffe7a0' },
  'unique-cartographers-regret': { shape: 'pendant', pal: 'paper', accent: '#00d4ff' },
  'unique-the-unstruck-hour': { shape: 'pendant', pal: 'void', accent: VOID_PINK, fx: { kind: 'mist', color: '#2a1a3a' } },
  'unique-architect-compass': { shape: 'pendant', pal: 'brass', accent: '#5fb6ff' },
  'unique-heartstone-world-root': { shape: 'pendant', pal: 'amber', accent: '#7fb85a', fx: { kind: 'motes', color: SPORE } },
  'unique-eclipse-hourglass': { shape: 'pendant', pal: 'glass', accent: '#a855f7' },
  // Charms (beads at the belt)
  'unique-voids-whisper': { shape: 'charm', pal: 'void', accent: VOID_PINK },
  'unique-tally-of-hands': { shape: 'charm', pal: 'ivory', accent: '#b86a70' },
  'unique-verdant-accord': { shape: 'charm', pal: 'rootwood', accent: '#7fb85a' },
  'unique-long-account': { shape: 'charm', pal: 'paper', accent: '#e8c898' },
  'unique-keepers-second-name': { shape: 'charm', pal: 'ivory', accent: '#a855f7' },
  'unique-merchants-scale': { shape: 'charm', pal: 'gold', accent: '#E8D44D' },
  'unique-eclipse-manifest': { shape: 'charm', pal: 'obsidian', accent: '#d9b8ff' },
};
