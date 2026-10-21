/**
 * trade-items.ts — an item as it travels in a trade window or onto the ground (the client half of
 * functions-game/src/trade-core.ts OfferItem; trade-merge.spec pins the two to each other).
 *
 * The offer carries exactly the fields the server re-checks against the save ("unchanged, by id and roll") and
 * enough to draw the item's real card on the other Keeper's screen. Short keys: it rides the Hearth.
 */
import type { GameItem, ItemRarity, ItemType } from '../../shared/rpg/item.model';

export interface OfferItem {
  id: string; def: string; name: string; type: string; rarity: string;
  stats: Record<string, number>;
  roll?: Record<string, number>; ilvl?: number; up?: number; sockets?: (string | null)[]; reforged?: number;
}
export interface Offer { items: OfferItem[]; gold: number }
export interface Terms { a: Offer; b: Offer }

/** Items in one window, Gold in one window (the server's caps: trade-core TRADE_MAX_ITEMS / TRADE_MAX_GOLD). */
export const TRADE_MAX_ITEMS = 12;
export const TRADE_MAX_GOLD = 1_000_000_000;

/** The offer for a held item (trade-core offerOf reads the same fields off the saved record). */
export function offerItemOf(item: GameItem): OfferItem {
  const out: OfferItem = {
    id: item.id, def: item.definitionId || `${item.type}:${item.name}`, name: item.name, type: item.type, rarity: item.rarity ?? 'common',
    stats: { ...item.stats } as Record<string, number>,
  };
  if (item.rollQuality && Object.keys(item.rollQuality).length) out.roll = { ...item.rollQuality } as Record<string, number>;
  if (typeof item.itemLevel === 'number') out.ilvl = item.itemLevel;
  if ((item.upgradeLevel ?? 0) > 0) out.up = item.upgradeLevel;
  if ((item.reforgeCount ?? 0) > 0) out.reforged = item.reforgeCount;
  if (item.sockets?.length) out.sockets = item.sockets.map(s => (s ? s : null));
  return out;
}

/** An offered item as a GameItem, for the card (never added to a save: the server does that). */
export function itemFromOffer(o: OfferItem): GameItem {
  return {
    id: o.id, definitionId: o.def, name: o.name, type: o.type as ItemType, rarity: o.rarity as ItemRarity,
    stats: { ...o.stats }, ...(o.roll ? { rollQuality: { ...o.roll } } : {}), ...(o.ilvl ? { itemLevel: o.ilvl } : {}),
    ...(o.up ? { upgradeLevel: o.up } : {}), ...(o.reforged ? { reforgeCount: o.reforged } : {}), ...(o.sockets ? { sockets: [...o.sockets] } : {}),
    sellValue: 0, equipped: false, foundAt: new Date(0).toISOString(), soulbound: false,
  } as GameItem;
}

/**
 * Why this item cannot be traded or dropped (the window greys it with the reason), or null. The same rules the
 * server enforces (trade-core untradeable): loose gear in the satchel only.
 */
export function tradeBlock(item: GameItem): 'worn' | 'bound' | 'starter' | null {
  if (item.equipped || item.explorerId) return 'worn';
  if (item.soulbound) return 'bound';
  if (item.id.startsWith('starter-')) return 'starter';
  return null;
}

/** JSON with sorted keys: both windows' copies of the same terms compare equal (trade-core canonical). */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}
