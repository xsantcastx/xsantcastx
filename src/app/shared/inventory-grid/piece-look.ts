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
import { runeOfStack } from '../rune-forge/rune-stack';
import { runeIcon } from '../art/item-icons';
import { matchSocketWord } from '../enchanting/socket-words';
import { isSocketedNormal } from '../enchanting/socket.model';
import type { GameItem } from '../rpg/item.model';

/**
 * An item's display name and colour, D2's way: a runeword shows the word's name in gold, a socketed normal base
 * reads grey, everything else its rarity (docs/design/runewords.md §2).
 */
export function itemNameTone(item: GameItem): { name: string; tone: string; word: boolean } {
  const word = matchSocketWord(item);
  const up = (item.upgradeLevel ?? 0) > 0 ? ` +${item.upgradeLevel}` : '';
  if (word) return { name: `${word.name}${up}`, tone: 'var(--cozy-loot-runeword)', word: true };
  if (isSocketedNormal(item)) return { name: `${item.name}${up}`, tone: 'var(--cozy-loot-socketed)', word: false };
  return { name: `${item.name}${up}`, tone: `var(--cozy-loot-${item.rarity}, var(--cozy-loot-common))`, word: false };
}

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
    const rune = runeOfStack(p.stackKey);
    if (rune) {
      const name = `${rune.name} Rune`;
      return { name, art: runeIcon(rune.id)?.src ?? '', mark: rune.name.slice(0, 2).toUpperCase(), tone: 'var(--cozy-loot-rune)' };
    }
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
  const shown = itemNameTone(item);
  return { name: shown.name, art: itemArt(item)?.src ?? '', mark: monogram(item.name), tone: shown.tone, item };
}
