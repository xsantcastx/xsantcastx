/**
 * worn-look.model.ts — what a worn item LOOKS like on the Keeper: its silhouette, its colours and its small details.
 *
 * Owner, 2026-10-22: "items when equipped should feel nice, for example I got some crazy looking item from that boss, a
 * unique helm, and I put it on my head, and nope — I was expecting like a hooded dark with red eyes". A worn piece used
 * to draw as its slot's generic layer in its realm's two colours; now every item resolves to a WornLook (worn-looks.ts):
 * a shape per slot (a cowl is not a hood is not a horned helm), three tones and an accent taken from the item's own icon
 * materials, and optional details — glowing eyes in a shadowed face, runes, a trim, horns, a mantle, a stitched seam, and
 * a few live pixels (embers rising, a dark mist wisp, motes, censer smoke). Both painters read it: the side view
 * (keeper-paint.ts) and the front/back views (keeper-front.ts); the live pixels are worn-fx.ts.
 *
 * Pure types and two tiny helpers: no imports but types, so the painters and the rpg data can both depend on it.
 */
import type { GearRarity, GearSlot, GearStyle } from './keeper-gear';

/** Head: soft hood, a deep cowl (the face in shadow), a horned helm, a crown, a circlet, a face mask, an open helm, a closed great helm. */
export type HeadShape = 'hood' | 'cowl' | 'horned' | 'crown' | 'circlet' | 'mask' | 'open-helm' | 'great-helm';
/** Chest: a robe to the ankles, a cloak, plate, a leather coat, scale (mail). */
export type ChestShape = 'robe' | 'cloak' | 'plate' | 'leather' | 'scale';
export type HandsShape = 'gloves' | 'gauntlets';
export type LegsShape = 'greaves' | 'belt';
/** Feet: boots, tall armoured greaves (sabatons), reed sandals. */
export type FeetShape = 'boots' | 'greaves' | 'sandals';
/** In hand: the icon families (keeper-gear WeaponKind) plus the off-hand things. */
export type HeldShape =
  | 'sword' | 'greatsword' | 'dagger' | 'axe' | 'hammer' | 'mace' | 'staff' | 'wand' | 'bow' | 'crossbow' | 'spear' | 'halberd'
  | 'shield' | 'quiver' | 'lantern' | 'orb' | 'censer' | 'crucible' | 'tome' | 'scroll';
export type TrinketShape = 'pendant' | 'ring' | 'charm';
export type WornShape = HeadShape | ChestShape | HandsShape | LegsShape | FeetShape | HeldShape | TrinketShape;

export const HEAD_SHAPES: readonly HeadShape[] = ['hood', 'cowl', 'horned', 'crown', 'circlet', 'mask', 'open-helm', 'great-helm'];
export const CHEST_SHAPES: readonly ChestShape[] = ['robe', 'cloak', 'plate', 'leather', 'scale'];
export const HELD_SHAPES: readonly HeldShape[] = [
  'sword', 'greatsword', 'dagger', 'axe', 'hammer', 'mace', 'staff', 'wand', 'bow', 'crossbow', 'spear', 'halberd',
  'shield', 'quiver', 'lantern', 'orb', 'censer', 'crucible', 'tome', 'scroll',
];

/**
 * The live pixels a piece carries (effects-spec rule 4: a handful, never hiding a fight): embers rising off it, a dark
 * mist wisp, slow motes, censer smoke. Each is at most six pixels alive; still under reduced motion.
 */
export type WornFxKind = 'embers' | 'mist' | 'motes' | 'smoke';

/** A colour: a hex, or a ramp name from the item icons (art/item-icons.ts RAMPS: 'umbral', 'ember', 'moss'…). */
export type Tone = string;

/**
 * How an item looks worn, as authored: on a unique's own entry (`look`), or in the table (worn-looks.data.ts). Every
 * field but `shape` is optional: the palette falls back to the item's icon materials, then to its realm's colours.
 */
export interface WornLookSpec {
  shape: WornShape;
  /** The body tones, deep → lit: three hexes, or one ramp name (its shade, base and lit steps). */
  pal?: Tone | readonly [string, string, string];
  /** The one bright colour: gems, a blade's edge, the orb, the coals. */
  accent?: Tone;
  /** A second material: a haft, a grip, a lining, a strap. */
  sub?: Tone;
  /** A trim line (else the rarity's tone from rare up). */
  trim?: Tone;
  /** Glowing eyes in the face (a hood, a cowl, a mask, a great helm's slit): two pips and a flickering 1-px glow. */
  eyes?: Tone;
  /** The face in shadow under the brim (the cowl's depth). */
  shadow?: boolean;
  /** Runes cut in the piece, lit in this colour. */
  runes?: Tone;
  /** Horns (on a helm, a hood, a crown). */
  horns?: Tone;
  /** A short mantle over the shoulders. */
  mantle?: Tone;
  /** A stitched seam (a glove's, a robe's). */
  seam?: Tone;
  /** A few live pixels. */
  fx?: { kind: WornFxKind; color: Tone };
}

/** A look resolved to colours, ready to paint. `id` is what travels to other players (peer-look). */
export interface WornLook {
  id: string;
  slot: GearSlot;
  shape: WornShape;
  style: GearStyle;
  rarity: GearRarity;
  deep: string; base: string; lit: string;
  accent: string;
  sub: string;
  /** The trim line, or null (common and uncommon pieces carry none of their own). */
  trim: string | null;
  /** A faint glow along the top edge (legendary and up), or null. */
  glow: string | null;
  eyes?: string;
  shadow?: boolean;
  runes?: string;
  horns?: string;
  mantle?: string;
  seam?: string;
  fx?: { kind: WornFxKind; color: string };
  /** Hands a held weapon takes (unset: the kind's own). */
  hands?: 1 | 2;
}

const RANK: Readonly<Record<GearRarity, number>> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, singular: 6 };
/** Rare and up carry a trim in the rarity's tone. */
export const trimmed = (r: GearRarity): boolean => RANK[r] >= 2;
/** Legendary and up carry a faint glow edge. */
export const glowing = (r: GearRarity): boolean => RANK[r] >= 4;
