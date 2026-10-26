/**
 * piece-look.ts — how a grid piece looks (name, art, monogram, rarity colour), for every grid: the satchel, the Vault,
 * the "no room" strip. One function so a thing reads the same wherever it sits.
 */
import { artFor } from '../art/art';
import type { InventorySnapshot } from '../rpg/inventory.service';
import type { Piece } from '../rpg/inventory-grid';
import { itemArt, materialDisplay } from '../rpg/material-catalog';
import { parseRecipeKey, recipeOfDef, stoneIcon } from '../spellstones/spellstones.model';
import type { PieceLook } from './item-grid.component';

const monogram = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '·';
const tone = (rarity: string) => `var(--cozy-loot-${rarity}, var(--cozy-loot-common))`;

/**
 * The look of a piece. `stoneFamily` names a spell's tree (the play view knows the skills; shared code does not), and
 * `stoneName` a spell's display name.
 */
export function pieceLookOf(
  snap: InventorySnapshot,
  p: Piece,
  stoneFamily: (skill: string) => string = () => 'common',
  stoneName: (skill: string) => string = skill => skill,
): PieceLook {
  if (p.kind === 'stack') {
    const d = materialDisplay(p.stackKey ?? '');
    const name = d?.name ?? p.stackKey ?? '';
    return { name, art: d?.art ?? artFor(p.stackKey)?.src ?? '', mark: monogram(name), tone: 'var(--cozy-loot-material)' };
  }
  const item = snap.items.find(i => i.id === p.ids[0]);
  if (!item) return { name: '', art: '', mark: '·', tone: null };
  const recipe = recipeOfDef(item.definitionId);
  if (recipe) {
    const r = parseRecipeKey(recipe)!;
    const charges = p.ids.reduce((n, id) => n + (snap.items.find(i => i.id === id)?.charges ?? 0), 0);
    const name = `${stoneName(r.skill)} · ${charges}`;
    return { name, art: artFor(stoneIcon(stoneFamily(r.skill)))?.src ?? '', mark: monogram(name), tone: tone('rare'), item };
  }
  const name = (item.upgradeLevel ?? 0) > 0 ? `${item.name} +${item.upgradeLevel}` : item.name;
  return { name, art: itemArt(item)?.src ?? '', mark: monogram(item.name), tone: tone(item.rarity), item };
}
