/**
 * worn-gear.ts — the player's equipped items → the painter's gear layers.
 *
 * Kept apart from keeper-gear.ts so that file stays import-free (it is pure
 * rules + math); this one reads item definitions for each piece's realm style
 * and its worn look (worn-looks.ts: the silhouette, tones and details that
 * match the item's icon and lore). Items worn by an explorer are not on the
 * Keeper and are skipped.
 */
import type { GameItem, SlotId } from '../rpg/item.model';
import { definitionFor } from '../rpg/item-definition';
import { handsOf } from '../rpg/item-hands';
import { GEAR_SLOTS, KeeperGear, gearPiece } from './keeper-gear';
import { pieceOfLook, wornLookOf } from './worn-looks';

export function wornGear(equipped: Partial<Record<SlotId, GameItem>>): KeeperGear {
  const gear: KeeperGear = {};
  for (const slot of GEAR_SLOTS) {
    const item = equipped[slot as SlotId];
    if (!item || item.explorerId) continue;
    const look = wornLookOf(item, slot);
    const def = look ? null : definitionFor(item);
    const piece = look ? pieceOfLook(look) : gearPiece(slot, `${item.name} ${item.definitionId ?? ''}`, def?.style, item.rarity);
    // The weapon's hands are the item's own (item-hands.ts), so the painter never draws a shield beside a bow.
    const hands = slot === 'weapon' ? handsOf(item) : null;
    gear[slot] = hands ? { ...piece, hands } : piece;
  }
  return gear;
}

/** A ledger row as the lobby reads it from another character's save (no service: GameStateGateway.readFor). */
interface LedgerRow { definitionId?: unknown; name?: unknown; rarity?: unknown; type?: unknown; explorerId?: unknown; location?: { kind?: unknown; slotId?: unknown } }

/**
 * The Keeper's own worn items in an inventory ledger blob (the v2 ledger InventoryService persists: one list of records,
 * where an item IS being `location: { kind: 'equipped', slotId }`). For the campfire lobby, which paints every Keeper on
 * the roster without loading their saves into the services. Anything unreadable is skipped.
 */
export function equippedInLedger(blob: unknown): Partial<Record<SlotId, GameItem>> {
  const out: Partial<Record<SlotId, GameItem>> = {};
  const records = blob && typeof blob === 'object' ? (blob as { records?: unknown }).records : null;
  if (!Array.isArray(records)) return out;
  const stones = (blob as { tombstones?: unknown }).tombstones;
  const gone = new Set<unknown>(Array.isArray(stones) ? stones.map(t => (t as { id?: unknown })?.id).filter(id => typeof id === 'string') : []);
  for (const r of records as (LedgerRow & { id?: unknown })[]) {
    if (!r || typeof r !== 'object' || r.explorerId || r.location?.kind !== 'equipped' || gone.has(r.id)) continue;
    const slot = r.location.slotId;
    if (typeof slot !== 'string' || !(GEAR_SLOTS as readonly string[]).includes(slot) || out[slot as SlotId]) continue;
    if (typeof r.definitionId !== 'string') continue;
    out[slot as SlotId] = {
      definitionId: r.definitionId, name: typeof r.name === 'string' ? r.name : '', rarity: typeof r.rarity === 'string' ? r.rarity : 'common',
      type: typeof r.type === 'string' ? r.type : 'artifact',
    } as unknown as GameItem;
  }
  return out;
}
