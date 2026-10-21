/**
 * ranger-items.ts — the one-handed ranged family and the quiver (owner 2026-10-21, relaying the players: "bows should
 * be 2h, crossbows could be 1 handed"). A Thornstrider's hunting bow takes both hands; one who wants an off-hand picks
 * up a crossbow instead and wears a quiver (or a charm-like off-hand) beside it (shared/rpg/item-hands.ts).
 *
 * Bases, not uniques: they drop from every hunt like the rest of the pool (loot/drop-tables DROP_POOL), at the level
 * of the creature that fell — so the requirement curve (item-requirements.ts: Agility for a crossbow) puts each one in
 * its band — the Gambler stocks them and the Exchange lists them. Their icons are item-icons.ts entries (the 32-px
 * crossbow painter; the quiver keeps its 16-px tube). Canon ties: the Canopy Wardens (design-bible §4.5) and the Pyre
 * Watch (§4.4).
 *
 * The family, with the Art Bible's Spinerift Crossbow (artbible-items.ts):
 *   Canopy Warden's Crossbow   verdant    the light one      (Strike 1.1)
 *   Spinerift Crossbow          verdant    the grown one      (Strike 1.3)
 *   Cinderlatch Crossbow        infernal   the heavy one      (Strike 1.6)
 *   Canopy Warden's Quiver      off-hand   Defense and Magic Find, worn on the back
 *
 * Pure data. No Angular, no browser APIs, SSR-safe.
 */
import type { ItemDefinition, ItemStatKey, ItemStyle } from './item-definition';
import type { ItemStats, SlotId } from './item.model';

function eq(
  id: string, name: string, slot: SlotId, style: ItemStyle,
  rollKeys: readonly ItemStatKey[], base: Partial<ItemStats>, lore: string,
): ItemDefinition {
  return {
    id, name, family: 'equipment', type: 'artifact', slot, style, rollKeys, base,
    temperable: true, maxTemper: 10, temperGoldBase: 50_000, lore,
  };
}

export const RANGER_DEFINITIONS: readonly ItemDefinition[] = [
  eq('warden-crossbow', 'Canopy Warden\'s Crossbow', 'weapon', 'verdant', ['strikePower', 'goldFind'],
    { strikePower: 1.1, goldFind: 1.3 },
    'The Canopy Wardens string these for the branches, where a bow is too long to draw: one hand on the stock, the other on the bough.'),
  eq('cinderlatch-crossbow', 'Cinderlatch Crossbow', 'weapon', 'infernal', ['strikePower', 'goldFind'],
    { strikePower: 1.6, goldFind: 1.9 },
    'The Pyre Watch kept one on every wall: a latch you could spring with one hand while the other held the torch to the beacon.'),
  eq('warden-quiver', 'Canopy Warden\'s Quiver', 'off-hand', 'verdant', ['ward', 'magicFind'],
    { ward: 0.9, magicFind: 1.2 },
    'Green-fletched, as the Wardens fletch them. Worn on the back, it leaves the off-hand free to draw — and to notice what is worth taking home.'),
];

/** The collection log's tier for each (the Keeper kit's hand grade, collection.model). */
export const RANGER_RARITY: Readonly<Record<string, 'uncommon' | 'rare'>> = {
  'warden-crossbow': 'uncommon', 'cinderlatch-crossbow': 'rare', 'warden-quiver': 'uncommon',
};
