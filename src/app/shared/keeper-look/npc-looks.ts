/**
 * npc-looks.ts — every town figure as a pixel Keeper (one art style, 2026-10-14).
 *
 * Owner: "go pixel ... make sure to be migrating everything we had in the past
 * to pixel and make it consistent." The people of the towns are painted by the
 * same painter as the player (keeper-paint.ts): same 48×48 cell, same outline,
 * same light. What makes each one themselves is a fixed look, the gear they
 * carry (the painter's own layers: robe, coat, plate, hood, a hammer, a ledger,
 * a lantern) and their GARB — the few things only townsfolk wear: a forge apron,
 * a hat, a sack over the shoulder, a loupe, a mirror for a face.
 *
 * Each look follows the cast's sprite brief (docs/art-commissions/world-sprites/
 * 03-npcs.md) and the lore (docs/world/lore-addendum.md): Kael's cracked plate,
 * apron, grey beard, one burning eye and missing left hand; Orla Stave's clerk's
 * robe and tally ledger; Verrin's hood with a mirror where a face should be.
 * Colours come only from the realm ramps (docs/art/style-guide.md §5) and the
 * life palettes (play/world/life.ts): nothing new.
 *
 * Pure: data and a seeded pick. No DOM.
 */
import { defaultLook, HAIR_STYLES, KeeperLook, lookRng, SKIN_TONES } from './keeper-look.model';
import type { GearKind, GearSlot, GearStyle, KeeperGear } from './keeper-gear';

/** What only townsfolk wear. Every colour is a hex from the realm ramps. */
export interface KeeperGarb {
  /** Explicit cloth and skin colours (override the look's palette indices). */
  skin?: string; hair?: string; tunic?: string; trim?: string; trousers?: string;
  /** A leather work apron over the tunic or plate, bib to knee. */
  apron?: string;
  /** A sash from the back shoulder to the front hip. */
  sash?: string;
  /** A quiver of green-fletched arrows on the back, in this leather (the Thornstrider). */
  quiver?: string;
  /** A hat when no head gear is worn. */
  hat?: 'brim' | 'cap';
  hatColor?: string;
  /** Dawn-glass shards rising behind the head (Aureth; never a halo). */
  shards?: boolean;
  /** One eye burns this colour (Kael) — or both, under a hood. */
  eyeGlow?: string;
  /** A smooth obsidian mirror where the face should be (Verrin the Hollow). */
  mirrorFace?: boolean;
  /** A brass loupe over the eye (the Archivist). */
  loupe?: boolean;
  /** Old: the head sits forward, a line under the eye. */
  elder?: boolean;
  /** The back (left) hand is gone (Kael). */
  oneHand?: boolean;
  /** A sack or coil over the back shoulder. */
  sack?: string;
  /** An open book floating at the shoulder (the Archivist). */
  book?: boolean;
}

export interface NpcLook { look: KeeperLook; gear: KeeperGear; garb: KeeperGarb }

/** A stable key for a garb (the painter caches frames per look + gear + garb). */
export function garbKey(garb: KeeperGarb | null | undefined): string {
  if (!garb) return '';
  return Object.keys(garb).sort().map(k => `${k}=${String(garb[k as keyof KeeperGarb])}`).join(',');
}

function piece(slot: GearSlot, kind: GearKind, style: GearStyle, color?: string, accent?: string): KeeperGear {
  return { [slot]: { slot, kind, style, rarity: 'common', ...(color ? { color } : {}), ...(accent ? { accent } : {}) } };
}
const gear = (...parts: KeeperGear[]): KeeperGear => Object.assign({}, ...parts);
function look(over: Partial<KeeperLook>): KeeperLook {
  return { ...defaultLook(), made: true, prompted: true, ...over };
}

// Ramp hexes used below (docs/art/style-guide.md §5.1–5.2).
const LEATHER = '#5a3a24';
const BASALT = '#3a2b2c', BASALT_HI = '#5a4440', IRON = '#2a2027', EMBER = '#E8752A', EMBER_HI = '#ffd08a';
const STONE = '#8a7a58', STONE_HI = '#c9b88e', IVORY = '#efe4c8', GOLD = '#b8901e', GOLD_HI = '#E8D44D', DAWN = '#fff1b0';
const NIGHT = '#1a1220', VIOLET = '#33263a', VIOLET_HI = '#4a3260', AMETHYST = '#A855F7', MOON = '#8a90b0';
const MIDNIGHT = '#14284a', MIDNIGHT_HI = '#24406e', BRASS = '#b08a55', SILVER = '#a8b8cc', ORBIT = '#5fb6ff';
const MOSS = '#3a5a2a', MOSS_HI = '#4a7a3a', ROOTWOOD = '#3a2a1c', ROOT_HI = '#7a5a36', AMBER = '#c08a3e', SAP = '#7fb85a';

/** The named people of the towns (and Hollis Fenn on the high ground), by keeper id. */
export const NPC_LOOKS: Readonly<Record<string, NpcLook>> = {
  // ── Basalt Seamworks ──
  kael: {
    look: look({ body: 'broad', hair: 'cropped', face: 'beard', eyes: 'narrow' }),
    gear: gear(piece('chest', 'plate', 'infernal', IRON, EMBER), piece('weapon', 'hammer', 'infernal', BASALT_HI, EMBER), piece('feet', 'boots', 'infernal', IRON)),
    garb: { skin: '#c99272', hair: '#9aa0ad', tunic: IRON, trim: EMBER, trousers: BASALT, apron: LEATHER, eyeGlow: EMBER_HI, oneHand: true },
  },
  'vault-clerk': {
    look: look({ body: 'slight', hair: 'topknot', eyes: 'narrow' }),
    gear: gear(piece('chest', 'robe', 'infernal', BASALT_HI, '#8d4f58'), piece('off-hand', 'tome', 'infernal', '#8d4f58', EMBER_HI)),
    garb: { skin: '#e0b08a', hair: '#3b2619', tunic: BASALT_HI, trim: '#8d4f58', trousers: BASALT, sash: '#8d4f58' },
  },
  'buyback-clerk': {
    look: look({ body: 'broad', hair: 'shaved', face: 'beard' }),
    gear: gear(piece('chest', 'coat', 'infernal', '#4b3a36', '#b6683a'), piece('weapon', 'tongs', 'infernal', BRASS, EMBER_HI)),
    garb: { skin: '#c99272', hair: '#6b4226', tunic: '#4b3a36', trim: '#b6683a', trousers: BASALT, sack: STONE },
  },
  'bench-smith': {
    look: look({ body: 'sturdy', hair: 'braid', face: 'freckles' }),
    gear: gear(piece('weapon', 'hammer', 'infernal', '#443540', EMBER), piece('hands', 'wrap', 'infernal', LEATHER, '#6b5148')),
    garb: { skin: '#e0b08a', hair: '#8f3b1f', tunic: BASALT_HI, trim: EMBER, trousers: BASALT, apron: LEATHER },
  },
  enchanter: {
    look: look({ body: 'slight', hair: 'swept', eyes: 'bright', eyeColor: 1 }),
    gear: gear(piece('chest', 'robe', 'infernal', BASALT, EMBER), piece('weapon', 'wand', 'infernal', IRON, EMBER_HI), piece('off-hand', 'orb', 'infernal', IRON, AMETHYST)),
    garb: { skin: '#d9a07a', hair: '#1d1a1f', tunic: BASALT, trim: EMBER, trousers: IRON },
  },
  // ── Heliograph Court ──
  merchant: {
    look: look({ body: 'sturdy', hair: 'curls', eyes: 'bright', eyeColor: 3 }),
    gear: gear(piece('chest', 'coat', 'luminous', '#7a5236', '#c89868'), piece('off-hand', 'scales', 'luminous', GOLD, GOLD_HI)),
    garb: { skin: '#e8c29a', hair: '#3b2619', tunic: '#7a5236', trim: '#c89868', trousers: '#4a4030', hat: 'brim', hatColor: '#4a4030' },
  },
  aureth: {
    look: look({ body: 'slight', hair: 'long', eyes: 'bright', eyeColor: 5 }),
    gear: gear(piece('chest', 'robe', 'luminous', IVORY, GOLD_HI)),
    garb: { skin: '#f2d6b4', hair: '#e0c070', tunic: IVORY, trim: GOLD_HI, trousers: STONE_HI, shards: true },
  },
  tomas: {
    look: look({ body: 'sturdy', hair: 'cropped' }),
    gear: gear(piece('chest', 'coat', 'luminous', '#d8c49a', '#a8946c'), piece('off-hand', 'lantern', 'luminous', GOLD, DAWN)),
    garb: { skin: '#e8c29a', hair: '#6b4226', tunic: '#d8c49a', trim: '#f4ead2', trousers: STONE, hat: 'cap', hatColor: STONE },
  },
  ilyra: {
    look: look({ body: 'slight', hair: 'long', eyes: 'bright', eyeColor: 1 }),
    gear: gear(piece('chest', 'robe', 'luminous', '#c9b8e0', GOLD_HI), piece('off-hand', 'orb', 'luminous', GOLD, DAWN)),
    garb: { skin: '#f2d2b0', hair: '#1d1a1f', tunic: '#c9b8e0', trim: GOLD_HI, trousers: '#998aae' },
  },
  // ── Nocturne Archive ──
  croupier: {
    look: look({ body: 'slight', hair: 'swept', eyes: 'narrow' }),
    gear: gear(piece('head', 'hood', 'umbral', '#2a1d3a', AMETHYST), piece('off-hand', 'cards', 'umbral', VIOLET_HI, '#c9a0ff'), piece('hands', 'wrap', 'umbral', MOON, '#d8dcf0')),
    garb: { skin: '#b9b0c8', hair: NIGHT, tunic: '#2a1d3a', trim: AMETHYST, trousers: NIGHT, eyeGlow: '#c9a0ff' },
  },
  broker: {
    look: look({ body: 'sturdy', hair: 'cropped', eyes: 'narrow', eyeColor: 4 }),
    gear: gear(piece('chest', 'coat', 'umbral', '#3b3048', NIGHT), piece('off-hand', 'lantern', 'umbral', VIOLET, '#d8dcf0'), piece('trinket', 'pendant', 'umbral')),
    garb: { skin: '#8d5a3a', hair: '#1d1a1f', tunic: '#3b3048', trim: '#8e8a9e', trousers: NIGHT },
  },
  verrin: {
    look: look({ body: 'slight', hair: 'shaved' }),
    gear: gear(piece('head', 'hood', 'umbral', '#1d1428', AMETHYST), piece('chest', 'robe', 'umbral', '#1d1428', AMETHYST)),
    garb: { skin: '#2a2236', hair: NIGHT, tunic: '#1d1428', trim: AMETHYST, trousers: '#0e0912', mirrorFace: true },
  },
  rook: {
    look: look({ body: 'sturdy', hair: 'cropped', face: 'scar' }),
    gear: gear(piece('head', 'hood', 'umbral', '#2a1d3a', MOON), piece('chest', 'coat', 'umbral', VIOLET, MOON), piece('off-hand', 'scroll', 'umbral', '#d8dcf0', AMETHYST)),
    garb: { skin: '#c6bed2', hair: NIGHT, tunic: VIOLET, trim: MOON, trousers: NIGHT },
  },
  // ── Meridian Orrery ──
  archivist: {
    look: look({ body: 'slight', hair: 'long', face: 'beard' }),
    gear: gear(piece('chest', 'robe', 'celestial', '#1d3360', BRASS)),
    garb: { skin: '#c9b29a', hair: '#eae4d4', tunic: '#1d3360', trim: BRASS, trousers: MIDNIGHT, loupe: true, book: true, elder: true },
  },
  'chart-clerk': {
    look: look({ body: 'slight', hair: 'curls', eyes: 'round', eyeColor: 1 }),
    gear: gear(piece('chest', 'coat', 'celestial', '#2c3c6a', SILVER), piece('off-hand', 'scroll', 'celestial', '#d8ecff', ORBIT)),
    garb: { skin: '#e0c8aa', hair: '#9aa0ad', tunic: '#2c3c6a', trim: '#c8d2e6', trousers: MIDNIGHT },
  },
  sera: {
    look: look({ body: 'sturdy', hair: 'braid', eyes: 'bright', eyeColor: 1 }),
    gear: gear(piece('chest', 'robe', 'celestial', '#3a3a5e', ORBIT), piece('weapon', 'staff', 'celestial', BRASS, '#00d4ff'), piece('head', 'circlet', 'celestial', BRASS, ORBIT)),
    garb: { skin: '#d4b896', hair: '#1d1a1f', tunic: '#3a3a5e', trim: ORBIT, trousers: MIDNIGHT_HI },
  },
  // ── Rootglass Canopy ──
  steward: {
    look: look({ body: 'sturdy', hair: 'braid', face: 'freckles' }),
    gear: gear(piece('chest', 'coat', 'verdant', MOSS, AMBER), piece('off-hand', 'lantern', 'verdant', ROOT_HI, '#e0b060'), piece('feet', 'boots', 'verdant', ROOTWOOD)),
    garb: { skin: '#d6a982', hair: '#c4612b', tunic: MOSS, trim: AMBER, trousers: ROOTWOOD, sack: BRASS, hat: 'brim', hatColor: ROOTWOOD },
  },
  herald: {
    look: look({ body: 'slight', hair: 'curls', eyes: 'bright' }),
    gear: gear(piece('chest', 'robe', 'verdant', '#5a4630', SAP), piece('off-hand', 'scroll', 'verdant', IVORY, SAP)),
    garb: { skin: '#c99a76', hair: '#e0c070', tunic: '#5a4630', trim: SAP, trousers: ROOTWOOD, hat: 'cap', hatColor: MOSS_HI },
  },
  gatekeeper: {
    look: look({ body: 'broad', hair: 'cropped', face: 'beard' }),
    gear: gear(piece('chest', 'plate', 'verdant', ROOT_HI, SAP), piece('weapon', 'halberd', 'verdant', ROOT_HI, SAP), piece('legs', 'greaves', 'verdant', ROOTWOOD)),
    garb: { skin: '#e2b896', hair: '#9aa0ad', tunic: '#4a6a4a', trim: '#e0b060', trousers: ROOTWOOD, elder: true },
  },
  'trials-warden': {
    look: look({ body: 'sturdy', hair: 'long', eyes: 'narrow', eyeColor: 2 }),
    gear: gear(piece('head', 'hood', 'verdant', MOSS, AMBER), piece('weapon', 'staff', 'verdant', ROOT_HI, '#7fd5a3')),
    garb: { skin: '#8d5a3a', hair: '#1d1a1f', tunic: MOSS, trim: AMBER, trousers: ROOTWOOD, sash: AMBER },
  },
  'lodge-warden': {
    look: look({ body: 'broad', hair: 'mohawk', face: 'warpaint' }),
    gear: gear(piece('chest', 'coat', 'verdant', '#5a4630', SAP), piece('weapon', 'axe', 'verdant', ROOT_HI, SAP)),
    garb: { skin: '#b07a4f', hair: '#3b2619', tunic: '#5a4630', trim: SAP, trousers: ROOTWOOD, apron: LEATHER },
  },
  // ── The high ground ──
  'hollis-fenn': {
    look: look({ body: 'slight', hair: 'long', face: 'beard' }),
    gear: gear(piece('chest', 'coat', 'verdant', '#5a4228', AMBER), piece('weapon', 'staff', 'verdant', ROOT_HI, '#7fd5a3')),
    garb: { skin: '#c4926a', hair: '#eae4d4', tunic: '#5a4228', trim: '#c08a3e', trousers: '#3a2a1c', hat: 'brim', hatColor: '#3a2a1c', elder: true },
  },
};

/** The colours a townsperson wears: their realm's life palette (play/world/life.ts). */
export interface FolkColors { robe: string; shade: string; trim: string; skin: string }

/**
 * A townsperson: a seeded face and hair (so the crowd is people, not copies),
 * dressed in their realm palette in the shape life.ts gives them.
 */
export function townsfolkLook(seed: string, colors: FolkColors, shape: 'robe' | 'hood' | 'smith' | 'coat'): NpcLook {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
  const r = lookRng(hash);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(r() * list.length) % list.length];
  const base = look({
    body: pick(['slight', 'sturdy', 'broad'] as const),
    hair: pick(HAIR_STYLES.filter(h => h !== 'mohawk')),
    hairColor: Math.floor(r() * 8),
    eyes: pick(['round', 'narrow'] as const),
    face: pick(['none', 'rosy', 'freckles', 'beard'] as const),
    skin: Math.floor(r() * 8) % SKIN_TONES.length,
  });
  const garb: KeeperGarb = { tunic: colors.robe, trim: colors.trim, trousers: colors.shade };
  switch (shape) {
    case 'robe': return { look: base, gear: piece('chest', 'robe', 'neutral', colors.robe, colors.trim), garb };
    case 'hood': return { look: base, gear: gear(piece('head', 'hood', 'neutral', colors.shade, colors.trim), piece('chest', 'robe', 'neutral', colors.robe, colors.trim)), garb };
    case 'smith': return { look: base, gear: {}, garb: { ...garb, apron: LEATHER } };
    default: return { look: base, gear: piece('chest', 'coat', 'neutral', colors.robe, colors.trim), garb: { ...garb, ...(r() < .4 ? { hat: 'cap' as const, hatColor: colors.shade } : {}) } };
  }
}
