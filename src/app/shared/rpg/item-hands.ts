/**
 * item-hands.ts — how many hands a weapon takes (players, relayed by the owner 2026-10-21: "Ranger, no shield. or make
 * 1H and 2H weapons, bows should be 2h, crossbows could be 1 handed and have consistency overall").
 *
 * ONE table, keyed on the item's base (item-base.ts: the same base the icon painter and the requirements read), so the
 * card, every equip path, the paper doll, the Keeper's painter and the fight all agree:
 *
 *   two hands  bow, staff, greatsword, hammer (mauls and war-hammers), spear (polearms: halberds, glaives)
 *   one hand   crossbow, sword, axe, mace, wand, dagger (and the held tools: pickaxe, sickle)
 *
 * The rules (docs/design/loot-and-combat.md §3.5):
 *  - wearing a two-handed weapon leaves no hand for the off-hand: putting one on sends the off-hand to the satchel
 *    (refused with a reason when the satchel is full), and putting an off-hand on while one is worn sends the weapon
 *    to the satchel the same way (InventoryService.equip, which every equip path goes through);
 *  - the off-hand well shows as blocked while a two-handed weapon is worn;
 *  - a two-handed weapon lands the basic attack TWO_HAND_MULT harder (td-melee weaponSwing: the Watch Blade's swing,
 *    the Thorn Shot, the Ember Bolt, the Kindle) — the price of the empty off-hand;
 *  - an old save wearing both is mended on load (the off-hand to the satchel, else the Vault).
 *
 * Pure: no Angular, no DOM.
 */
import type { GearBase } from '../art/gear-icons';
import { itemBase, itemDefinitionOf } from './item-base';
import type { GameItem } from './item.model';
import type { InventoryLedger, OwnedItemInstance } from './inventory.model';
import { nextRevision, recordToItem, upsertRecord } from './inventory-ops';

export { TWO_HAND_MULT, handsMult } from './hands-rules';
import type { Hands } from './hands-rules';
export type { Hands } from './hands-rules';

/** Every weapon base and the hands it takes. A base not listed is not a weapon (null). */
export const BASE_HANDS: Readonly<Partial<Record<GearBase, Hands>>> = {
  bow: 2, staff: 2, greatsword: 2, hammer: 2, spear: 2,
  crossbow: 1, sword: 1, axe: 1, mace: 1, wand: 1, dagger: 1, pickaxe: 1, sickle: 1,
};

type HandItem = Partial<Pick<GameItem, 'id' | 'name' | 'type' | 'definitionId' | 'rarity' | 'slot'>>;

/** The hands a weapon takes, or null when the item is not a weapon (armour, an off-hand, a charm). */
export function handsOf(item: HandItem | null | undefined): Hands | null {
  if (!item) return null;
  // Only what goes in the weapon slot: an off-hand drawn as a shuttle or a wand is still an off-hand.
  const def = itemDefinitionOf(item);
  if (def && def.slot !== 'weapon') return null;
  const base = itemBase(item);
  if (base && BASE_HANDS[base]) return BASE_HANDS[base]!;
  // A weapon whose kind has no painter of its own (the Godforge Tongs) is held in one hand.
  return def?.slot === 'weapon' ? 1 : null;
}

/** A two-handed weapon? */
export function isTwoHanded(item: HandItem | null | undefined): boolean { return handsOf(item) === 2; }


/**
 * What wearing `item` in `slot` displaces because of hands: the worn off-hand when a two-handed weapon goes on, the
 * worn two-handed weapon when an off-hand goes on. Empty when nothing has to move. `worn` is what is worn now.
 */
export function handsDisplaced<T extends HandItem & { id?: string }>(
  item: HandItem, slot: string, worn: Partial<Record<string, T | undefined>>,
): T[] {
  if (slot === 'weapon' && isTwoHanded(item)) {
    const off = worn['off-hand'];
    return off && off.id !== item.id ? [off] : [];
  }
  if (slot === 'off-hand') {
    const w = worn['weapon'];
    return w && w.id !== item.id && isTwoHanded(w) ? [w] : [];
  }
  return [];
}

/**
 * An old save wearing a two-handed weapon AND an off-hand (worn before hands existed): the off-hand goes back to the
 * satchel. The caller settles the ledger after (inventory-layout settle), so a full satchel sends it on to the Vault —
 * moved, never deleted. Returns the same ledger when nothing had to move.
 */
export function mendHands(ledger: InventoryLedger, deviceId: string, now: number): InventoryLedger {
  const worn = (slot: string) => ledger.records.find((row): row is OwnedItemInstance =>
    row.kind === 'instance' && row.source === 'inventory' && row.location.kind === 'equipped' && row.location.slotId === slot);
  const weapon = worn('weapon'), off = worn('off-hand');
  if (!weapon || !off || !isTwoHanded(recordToItem(weapon))) return ledger;
  const stepped = nextRevision(ledger, deviceId, now, off.revision);
  return { ...upsertRecord(ledger, { ...off, location: { kind: 'bag' }, revision: stepped.revision }), hlc: stepped.hlc };
}
