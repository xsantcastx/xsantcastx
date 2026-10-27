/**
 * trade-items.ts — an item as it travels in a trade window or onto the ground (the client half of
 * functions-game/src/trade-core.ts OfferItem; trade-merge.spec pins the two to each other).
 *
 * The offer carries exactly the fields the server re-checks against the save ("unchanged, by id and roll") and
 * enough to draw the item's real card on the other Keeper's screen. Short keys: it rides the Hearth.
 */
import type { GameItem, ItemRarity, ItemType } from '../../shared/rpg/item.model';
import type { GridView, Piece } from '../../shared/rpg/inventory-grid';

export interface OfferItem {
  id: string; def: string; name: string; type: string; rarity: string;
  stats: Record<string, number>;
  roll?: Record<string, number>; ilvl?: number; up?: number; sockets?: (string | null)[]; reforged?: number;
  /** A Spellstone's charges (trade-core OfferItem.ch). */
  ch?: number;
  /** A satchel stack (trade-core OfferItem.sk / qty): its plain key and how many; its id is `stack:<sk>`. */
  sk?: string; qty?: number;
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
  if ((item.charges ?? 0) > 0) out.ch = item.charges;
  return out;
}

/** The offer for `qty` of a satchel stack (potions, fish, meals, logs, runes, materials). */
export function stackOfferOf(stackKey: string, name: string, qty: number): OfferItem {
  return { id: `stack:${stackKey}`, def: stackKey, name: name.slice(0, 80) || stackKey, type: 'material', rarity: 'common', stats: {}, sk: stackKey, qty: Math.max(1, Math.floor(qty)) };
}

/**
 * The entries a window shows for a list of offers: a stack is one entry (its qty), and identical instances (the same
 * thing in every field but the id, as the satchel piles them) one entry with every id. Order of first appearance.
 */
export function groupOffers(items: readonly OfferItem[]): { key: string; first: OfferItem; ids: string[]; qty: number }[] {
  const out = new Map<string, { key: string; first: OfferItem; ids: string[]; qty: number }>();
  for (const o of items) {
    const key = o.sk ? o.id : canonical({ ...o, id: undefined });
    const g = out.get(key);
    if (g) { g.ids.push(o.id); g.qty += o.qty ?? 1; } else out.set(key, { key, first: o, ids: [o.id], qty: o.qty ?? 1 });
  }
  return [...out.values()];
}

/** One satchel entry for the trade window: a stack (`sk`) or a pile of instances (`ids`), and how many are left to offer. */
export interface SatchelGroup { sk?: string; ids: string[]; qty: number; quest?: boolean }
/**
 * The trade window's satchel (owner 2026-10-27: "not showing my inventory complete", "all items are unstacked"): every
 * piece of the satchel GRID, in grid order, then the no-room strip — one entry per stack key with its total, one per
 * pile of identical instances with every id — less what is offered and what is on its way to the ground; then the
 * quest finds (no cell; listed so the window hides nothing, never offered).
 */
export function satchelGroups(
  grid: Pick<GridView, 'pieces' | 'held'>, questStacks: readonly { stackKey: string; quantity: number }[],
  mine: readonly OfferItem[], pending: (id: string) => boolean = () => false,
): SatchelGroup[] {
  const offeredIds = new Set(mine.filter(o => !o.sk).map(o => o.id));
  const offeredQty = new Map(mine.filter(o => o.sk).map(o => [o.sk as string, o.qty ?? 0]));
  const groups = new Map<string, SatchelGroup>();
  const pieces: Piece[] = [...grid.pieces].sort((a, b) => a.cell - b.cell).concat(grid.held);
  for (const p of pieces) {
    if (p.kind === 'stack') {
      const sk = p.stackKey ?? '', key = `s:${sk}`, g = groups.get(key);
      if (g) g.qty += p.qty; else groups.set(key, { sk, ids: [], qty: p.qty });
      continue;
    }
    const ids = p.ids.filter(id => !offeredIds.has(id) && !pending(id));
    if (!ids.length) continue;
    const key = `i:${p.pileKey ?? p.ids[0]}`, g = groups.get(key);
    if (g) { g.ids.push(...ids); g.qty += ids.length; } else groups.set(key, { ids, qty: ids.length });
  }
  const out: SatchelGroup[] = [];
  for (const g of groups.values()) {
    const qty = g.sk ? g.qty - (offeredQty.get(g.sk) ?? 0) : g.qty;
    if (qty > 0) out.push({ ...g, qty });
  }
  for (const q of questStacks) if (q.quantity > 0) out.push({ sk: q.stackKey, ids: [], qty: q.quantity, quest: true });
  return out;
}

/** An offered item as a GameItem, for the card (never added to a save: the server does that). */
export function itemFromOffer(o: OfferItem): GameItem {
  return {
    id: o.id, definitionId: o.def, name: o.name, type: o.type as ItemType, rarity: o.rarity as ItemRarity,
    stats: { ...o.stats }, ...(o.roll ? { rollQuality: { ...o.roll } } : {}), ...(o.ilvl ? { itemLevel: o.ilvl } : {}),
    ...(o.up ? { upgradeLevel: o.up } : {}), ...(o.reforged ? { reforgeCount: o.reforged } : {}), ...(o.sockets ? { sockets: [...o.sockets] } : {}),
    ...(o.ch ? { charges: o.ch } : {}),
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
