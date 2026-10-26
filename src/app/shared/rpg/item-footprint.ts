/**
 * item-footprint.ts — how many satchel cells a thing covers (the D2 / PoE2 grid; docs/design/inventory-grid.md §1).
 *
 * Pure. The base type comes from item-base.ts (the same lookup the gear painter and the requirements read), so a new
 * piece of gear gets the right footprint the day it gets the right icon. Anything with no base — a stack, a rune, a
 * Spellstone, a potion, a quest find, an unknown kind — is 1×1: nothing is ever too big to carry.
 */
import type { GearBase } from '../art/gear-icons';
import { itemBase } from './item-base';
import type { GameItem } from './item.model';

export interface Footprint { w: number; h: number }

/** The table (width × height, in cells). The design doc carries the same table; inventory-grid.spec pins the two. */
export const FOOTPRINTS: Readonly<Record<GearBase, Footprint>> = {
  // One-handers: a hand's width, as long as the blade.
  dagger: { w: 1, h: 2 }, wand: { w: 1, h: 2 }, sickle: { w: 1, h: 2 },
  sword: { w: 1, h: 3 }, mace: { w: 1, h: 3 },
  axe: { w: 1, h: 3 }, pickaxe: { w: 1, h: 3 }, hammer: { w: 2, h: 3 },
  // Long things: a staff stands four cells tall; a two-handed blade too.
  staff: { w: 1, h: 4 }, greatsword: { w: 1, h: 4 }, spear: { w: 2, h: 4 },
  bow: { w: 2, h: 3 }, crossbow: { w: 2, h: 3 },
  // Off-hands and heads: a square.
  shield: { w: 2, h: 2 }, tome: { w: 2, h: 2 },
  helm: { w: 2, h: 2 }, hood: { w: 2, h: 2 }, crown: { w: 2, h: 2 }, circlet: { w: 2, h: 2 },
  // Body armour: the big one.
  plate: { w: 2, h: 3 }, robe: { w: 2, h: 3 }, coat: { w: 2, h: 3 },
  gloves: { w: 2, h: 2 }, boots: { w: 2, h: 2 }, legs: { w: 2, h: 2 }, belt: { w: 2, h: 1 },
  // Small things: one cell.
  ring: { w: 1, h: 1 }, amulet: { w: 1, h: 1 }, trinket: { w: 1, h: 1 }, charm: { w: 1, h: 1 },
  rune: { w: 1, h: 1 }, potion: { w: 1, h: 1 }, material: { w: 1, h: 1 },
};

export const ONE_BY_ONE: Footprint = { w: 1, h: 1 };

/** A Spellstone (shared/spellstones): its definition id is `spellstone:<skill>@<rank>#<marks>`. */
export function isSpellstoneDef(definitionId: string | undefined): boolean {
  return typeof definitionId === 'string' && definitionId.startsWith('spellstone:');
}

/** The cells an item covers. */
export function footprintOf(item: Pick<GameItem, 'name' | 'type' | 'definitionId' | 'rarity'> & { id?: string }): Footprint {
  if (item.type === 'rune' || isSpellstoneDef(item.definitionId)) return ONE_BY_ONE;
  let base: GearBase | null = null;
  try { base = itemBase(item); } catch { base = null; }
  return (base && FOOTPRINTS[base]) || ONE_BY_ONE;
}
