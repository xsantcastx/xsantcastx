/**
 * td-drop-art.ts — what a thing on the ground looks like (owner, 2026-10-26: "ground items look like what they are").
 * Pure helpers: which pixel icon a drop takes (the same art as the satchel) and how much it glows by rarity. The
 * engine paints the icon lying on the ground inside the rung's stepped light column (td-fx lootBeam).
 */
import { artIcon, runeIcon } from '../../shared/art/item-icons';
import { pixelIcon } from '../../shared/art/pixel-icons';
import type { LootRung } from './td-fx';

/** The bits of a Drop that decide its picture. */
export interface DropLike { rune?: string; item?: { definitionId: string }; material?: string }

/** Which icon a drop takes: a rune its tablet, gear its icon, a material its own; null = nothing to show (a sack). */
export function dropIconKey(g: DropLike): { kind: 'rune' | 'item' | 'material'; id: string } | null {
  if (g.rune) return { kind: 'rune', id: g.rune };
  if (g.item?.definitionId) return { kind: 'item', id: g.item.definitionId };
  if (g.material) return { kind: 'material', id: g.material };
  return null;
}

/** The icon's data-URI source for a drop, or null when no pixel icon exists (the engine then keeps its tile / sack). */
export function dropIconSrc(g: DropLike): string | null {
  const k = dropIconKey(g);
  if (!k) return null;
  const e = k.kind === 'rune' ? runeIcon(k.id) : (artIcon(k.id) ?? pixelIcon(k.id));
  return e ? e.src : null;
}

/**
 * How a rung glows on top of its light column: `beam` scales the column's alpha (faint → full), `halo` is the number of
 * stepped rings of light round the piece (0–2), `motes` the least motes climbing the column (0 = whatever lootBeam gives).
 */
export interface DropGlow { readonly beam: number; readonly halo: 0 | 1 | 2; readonly motes: number }
const GLOW: Readonly<Record<LootRung, DropGlow>> = {
  common: { beam: 0, halo: 0, motes: 0 },
  uncommon: { beam: .5, halo: 0, motes: 0 },
  rare: { beam: .9, halo: 0, motes: 0 },
  epic: { beam: 1, halo: 1, motes: 2 },
  legendary: { beam: 1, halo: 2, motes: 3 },
  mythic: { beam: 1, halo: 2, motes: 4 },
  singular: { beam: 1, halo: 2, motes: 5 },
};
export function dropGlow(rung: LootRung): DropGlow { return GLOW[rung] ?? GLOW.common; }
