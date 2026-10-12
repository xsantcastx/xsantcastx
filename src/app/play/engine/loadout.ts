import type { LootRarity } from '../world/world.model';

/**
 * The Keeper's worn gear as the renderer sees it. Pure types and math; the
 * engine's `setLoadout` takes a KeeperLoadout. Visual only: combat numbers
 * come from `setStats`, never from here.
 */
export interface HeldItem {
  /** Image URL (e.g. `artFor(key).src`) or an `artFor()` key; loaded once and cached. */
  art: string;
  rarity?: LootRarity;
  /** Where the hand closes on the painting, normalised (u right, v down). */
  grip?: { u: number; v: number };
  /** Canvas angle of the item's long axis as painted, grip → tip. -PI/4 = pointing up-right. */
  tilt?: number;
  /** Drawn size in world px (the painting is drawn square). */
  size?: number;
}
export interface KeeperLoadout {
  /** Main hand: drawn in the front hand, following the swing. */
  weapon?: HeldItem | null;
  /** Off hand: drawn on the back arm, behind the body. */
  offhand?: HeldItem | null;
  /** Highest equipped rarity: a subtle aura in its colour. */
  auraRarity?: LootRarity | null;
}

/** Item paintings are icons: a weapon is usually painted diagonally, hilt bottom-left. */
export const WEAPON_DEFAULTS = { grip: { u: .24, v: .78 }, tilt: -Math.PI / 4, size: 72 } as const;
/** Off-hand items (shields, tomes, orbs) are held by their centre, upright. */
export const OFFHAND_DEFAULTS = { grip: { u: .5, v: .55 }, tilt: -Math.PI / 2, size: 52 } as const;

/** Where the Keeper's back hand is painted (mirror of KEEPER_HAND). */
export const KEEPER_BACK_HAND = { u: .335, v: .48 };

export interface HeldTransform {
  /** Translate to (x, y), rotate by `rotation`, then drawImage at (drawX, drawY, size, size). */
  x: number; y: number; rotation: number; drawX: number; drawY: number; size: number;
}
export function createHeldTransform(): HeldTransform { return { x: 0, y: 0, rotation: 0, drawX: 0, drawY: 0, size: 0 }; }

/**
 * Place an item so its grip lands on the hand (handX, handY) and its painted
 * axis points along `aim` (canvas angle; -PI/2 = straight up). Pure.
 */
export function heldTransform(
  handX: number, handY: number, aim: number, item: HeldItem,
  defaults: { grip: { u: number; v: number }; tilt: number; size: number },
  out: HeldTransform,
): void {
  const grip = item.grip ?? defaults.grip;
  const size = item.size && item.size > 0 ? item.size : defaults.size;
  out.x = handX; out.y = handY; out.size = size;
  out.rotation = aim - (item.tilt ?? defaults.tilt);
  out.drawX = -grip.u * size; out.drawY = -grip.v * size;
}
/** Where the painting's (u, v) lands under a HeldTransform. For tests and anchoring effects. */
export function heldPoint(t: HeldTransform, u: number, v: number, out: { x: number; y: number }): void {
  const lx = t.drawX + u * t.size, ly = t.drawY + v * t.size;
  const cos = Math.cos(t.rotation), sin = Math.sin(t.rotation);
  out.x = t.x + cos * lx - sin * ly;
  out.y = t.y + sin * lx + cos * ly;
}
/**
 * The legacy Basalt Edge is drawn pointing straight up after rotating by
 * `bladeRotation`; a held item's aim is the same direction.
 */
export function aimFromBladeRotation(bladeRotation: number): number { return bladeRotation - Math.PI / 2; }
