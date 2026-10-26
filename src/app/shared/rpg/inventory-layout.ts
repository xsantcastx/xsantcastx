/**
 * inventory-layout.ts — the satchel's and the Vault's vocabulary: stack classes and caps, the storage entitlements,
 * Vault tab ids. Where things SIT is the grid's (inventory-grid.ts, docs/design/inventory-grid.md); the list-era
 * layout, routing and `settle` (which moved things to the Vault by themselves) are gone with it.
 *
 * The list-era rules, kept for the record:
 *
 * Pure. Ledger in, layout (or ledger) out. See docs/inventory/inventory-spec.md
 * §2. The rules in one paragraph:
 *
 *   · Instances (gear, charms, runeword items) sit where their `location` says.
 *     A Vault tab is the opaque owner id `vault:<tabId>` on an `explorer`
 *     location — the same mechanism as Thralls and Delve chests, so there is
 *     no schema change. Worn and lent-out kit takes no slot.
 *   · Stackables (materials, supplies) have one account-wide quantity
 *     from the stack ops. Where they *show* is computed here, never stored, so
 *     two devices cannot disagree about it and a merge has nothing to move.
 *   · Identical instances share slots (item-groups.ts, manager decision
 *     2026-10-13): a group of n identical pieces in one place takes
 *     ceil(n / 20) slots. Each piece is still its own record; only counting
 *     changes, and every surface reads the count from here.
 *   · Instances outrank stacks for space. A stack that no longer fits in the
 *     satchel shows in a Vault tab or Overflow; benches read the total anyway.
 *   · Nothing here deletes. `settle` only ever rewrites `location`.
 */
import { nextRevision, stackQuantityOf, tombstoneRecord } from './inventory-ops';
import type { InventoryLedger, ItemLocation, OwnedItemInstance } from './inventory.model';
import { GATHER_PILE_CAP, GATHER_PILE_KEYS } from '../gathering/gather-keys';

/**
 * Instance records one save may hold, every location counted (spec §2.8):
 * ~580 KB of a 1 MiB Firestore document. Gold purchases that mint an instance
 * are refused before the spend at this line; other arrivals still land.
 */
export const INSTANCE_RECORD_BUDGET = 700;

/**
 * The 40-slot satchel and the Vault are live. Off, the satchel has no ceiling,
 * nothing is routed and settle never moves anything — the pre-Vault behaviour
 * minus the eviction. On since slice S5: the Vault station in the Basalt
 * Seamworks is where things are taken back out.
 */
export const VAULT_LIVE = true;

export const SATCHEL_BASE_SLOTS = 40;
export const SATCHEL_ROW_SLOTS = 8;
export const SATCHEL_MAX_ROWS = 5;
export const STACK_CAP = 999;
export const SUPPLY_CAP = 99;

export type SlotClass = 'material' | 'supply' | 'quest' | 'entitlement';

/**
 * The spec's Runes tab is gone with the Sigil items it existed to hold: runes
 * live in the Rune Forge ledger, which no satchel slot ever counted.
 */
export type VaultTabId =
  | 'general-1' | 'materials' | 'supplies' | 'gear'
  | 'general-2' | 'general-3' | 'general-4' | 'overflow';

/** Display and routing order. General I and Overflow are always owned. */
export const VAULT_TABS: readonly VaultTabId[] = [
  'general-1', 'materials', 'supplies', 'gear', 'general-2', 'general-3', 'general-4', 'overflow',
];
const GENERAL_TABS: readonly VaultTabId[] = ['general-1', 'general-2', 'general-3', 'general-4'];

/** Slots per tab. Materials holds one cell per kind with no cap; Overflow is unlimited. */
export const TAB_SLOTS: Readonly<Record<VaultTabId, number>> = {
  'general-1': 60, 'general-2': 60, 'general-3': 60, 'general-4': 60,
  supplies: 60, gear: 120, materials: Infinity, overflow: Infinity,
};

export const SATCHEL_ROW_KEY = 'storage:satchel-row';
export function storageTabKey(tab: VaultTabId): string { return `storage:tab:${tab}`; }

const VAULT_PREFIX = 'vault:';
export function vaultHolder(tab: VaultTabId): string { return `${VAULT_PREFIX}${tab}`; }

/** The Vault tab an item location names, or null when it is not in the Vault. */
export function vaultTabOf(location: ItemLocation): VaultTabId | null {
  if (location.kind !== 'explorer' || !location.explorerId.startsWith(VAULT_PREFIX)) return null;
  const tab = location.explorerId.slice(VAULT_PREFIX.length) as VaultTabId;
  // An unknown tab id (a newer client's tab) still holds the item: it shows in Overflow.
  return VAULT_TABS.includes(tab) ? tab : 'overflow';
}

/** POE2's quest items take no slot either. */
export const QUEST_STACKS: ReadonlySet<string> = new Set([
  'kaels-hammer', 'godforge-fragment', 'shadow-root-cutting', 'rift-key',
  // The Worn Rod: handed to every Keeper, soulbound, like the quest finds it takes no slot.
  'worn-rod',
  // The Mirror Slate (shared/slate): a carried key item, never a slot.
  'mirror-slate', 'mirror-slate-ii',
  // The Underhearth (Phase 8): the Four Hammer-Marks, kept after the first fight (they wake the furnace).
  'four-hammer-marks',
  // The Lost Cabinets (shared/cabinets): the sixteen curios, the hatbox and the loupe are kept, never a slot.
  'curio-unstruck-bell', 'curio-jar-of-noon', 'curio-blank-page', 'curio-lost-moon', 'curio-stubborn-seed', 'curio-tally-stick',
  'curio-blinking-mirror', 'curio-unsigned-letter', 'curio-pressed-rose', 'curio-moss-locket', 'curio-lamp-wick', 'curio-kept-coal',
  'curio-clean-ink', 'curio-backward-rings', 'curio-folded-shadow', 'curio-last-chart', 'hatbox-of-small-crowns', 'curators-loupe',
]);

/**
 * `terrain.ts PLACEABLES` ids. Copied rather than imported so the bag does not
 * pull the Delve engine into the initial bundle; inventory-layout.spec.ts pins
 * the two lists together.
 */
export const SUPPLY_KEYS: ReadonlySet<string> = new Set([
  'dirt-block', 'basalt-block', 'torch', 'ladder', 'platform', 'chest', 'camp',
  'timber-support', 'basalt-support', 'blast-charge', 'obsidian-block',
  // The Underhearth (Phase 8).
  'seam-rail', 'bark-rope', 'rift-anchor',
]);
const BLOCK_KEYS: ReadonlySet<string> = new Set(['dirt-block', 'basalt-block']);

/** A stack key's class. Anything uncatalogued is a Material, never lost and never hidden. */
export function slotClassOf(stackKey: string): SlotClass {
  if (stackKey.startsWith('storage:')) return 'entitlement';
  if (QUEST_STACKS.has(stackKey)) return 'quest';
  if (SUPPLY_KEYS.has(stackKey)) return 'supply';
  return 'material';
}

export function stackCapOf(stackKey: string): number {
  // What the gathering loops land (fish, logs, meals) piles 20 to a cell, in the satchel and in a Vault tab alike.
  if (GATHER_PILE_KEYS.has(stackKey.replace(/^v:[^:]+:/, ''))) return GATHER_PILE_CAP;
  return slotClassOf(stackKey) === 'supply' && !BLOCK_KEYS.has(stackKey) ? SUPPLY_CAP : STACK_CAP;
}

export interface Capacity {
  satchel: number;
  tabs: ReadonlySet<VaultTabId>;
}

/** Capacity from the `storage:*` entitlements. `qty` reads a stack total. */
export function capacityOf(qty: (stackKey: string) => number): Capacity {
  const rows = Math.min(SATCHEL_MAX_ROWS, Math.max(0, Math.floor(qty(SATCHEL_ROW_KEY))));
  const tabs = new Set<VaultTabId>(['general-1', 'overflow']);
  for (const tab of VAULT_TABS) if (qty(storageTabKey(tab)) >= 1) tabs.add(tab);
  return { satchel: SATCHEL_BASE_SLOTS + SATCHEL_ROW_SLOTS * rows, tabs };
}

export function ledgerCapacity(ledger: InventoryLedger): Capacity {
  return capacityOf(key => stackQuantityOf(ledger, key));
}

/** Instance records counted against {@link INSTANCE_RECORD_BUDGET}. */
export function instanceRecordCount(ledger: InventoryLedger): number {
  return ledger.records.filter(row => row.kind === 'instance' && row.source === 'inventory').length;
}

// Any "<Name> Sigil", not only today's runes: Mote, Seam and Ledger were
// retired after their Sigils were minted, and those must go too.
const SIGIL_NAME = /^[A-Z][A-Za-z' -]* Sigil$/;

/**
 * A pre-removal "<Rune> Sigil" record: every rune find used to mint one, with
 * nothing of its own — no stats, no roll grade, no temper, reforge or socket.
 * Anything carrying any of those is not one, so a frozen grade is never lost.
 */
export function isLegacySigil(row: OwnedItemInstance): boolean {
  if (row.type !== 'rune' || !SIGIL_NAME.test(row.name)) return false;
  if (Object.keys(row.stats).length || row.rollQuality) return false;
  if ((row.upgradeLevel ?? 0) > 0 || (row.reforgeCount ?? 0) > 0) return false;
  return !row.sockets?.some(Boolean);
}

/**
 * Delete every legacy Sigil record (manager decision 2026-10-13: they meant
 * nothing — the rune they were named after is in the Rune Forge ledger, which
 * is what sockets, Runewords and the library read). A tombstone, so a device
 * that still holds one merges it away too. Idempotent; returns the same object
 * when there is nothing to do.
 */
export function dropLegacySigils(ledger: InventoryLedger, deviceId: string, now: number): InventoryLedger {
  let next = ledger;
  for (const row of ledger.records) {
    if (row.kind !== 'instance' || row.source !== 'inventory' || !isLegacySigil(row)) continue;
    const stepped = nextRevision(next, deviceId, now, row.revision);
    next = { ...tombstoneRecord(next, row.id, stepped.revision, now), hlc: stepped.hlc };
  }
  return next;
}
