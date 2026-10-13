/**
 * inventory-layout.ts — where things show: the satchel, the Vault, Overflow.
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
 *   · Instances outrank stacks for space. A stack that no longer fits in the
 *     satchel shows in a Vault tab or Overflow; benches read the total anyway.
 *   · Nothing here deletes. `settle` only ever rewrites `location`.
 */
import { compareRevision, nextRevision, stackQuantityOf, tombstoneRecord } from './inventory-ops';
import type { InventoryLedger, ItemLocation, OwnedItemInstance } from './inventory.model';
import { RUNES } from '../rune-forge/rune.model';

/** Names the rule set. Placement is recomputed, so bumping it converts nothing on disk. */
export const INVENTORY_LAYOUT = 1;

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
]);

/**
 * `terrain.ts PLACEABLES` ids. Copied rather than imported so the bag does not
 * pull the Delve engine into the initial bundle; inventory-layout.spec.ts pins
 * the two lists together.
 */
export const SUPPLY_KEYS: ReadonlySet<string> = new Set([
  'dirt-block', 'basalt-block', 'torch', 'ladder', 'platform', 'chest', 'camp',
  'timber-support', 'basalt-support', 'blast-charge',
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

export interface Cell {
  /** Instance id, or stack key. */
  key: string;
  kind: 'instance' | 'stack';
  quantity: number;
  /** Slots it takes where it sits: 1 for an instance, ceil(qty / cap) for a stack, 0 in a no-cap tab. */
  slots: number;
}

export interface Layout {
  satchel: Cell[];
  tabs: Record<VaultTabId, Cell[]>;
  quest: Cell[];
  /** Slots used in the satchel, instances and stacks together. */
  satchelUsed: number;
  /** Instance cells per tab (stacks are derived and yield to instances). */
  instancesIn: Record<VaultTabId, number>;
  /** Bag instances: the number `settle` holds to `capacity.satchel`. */
  bagInstances: number;
}

function liveInstances(ledger: InventoryLedger): OwnedItemInstance[] {
  return ledger.records.filter((row): row is OwnedItemInstance =>
    row.kind === 'instance' && row.source === 'inventory');
}

/** Instance records counted against {@link INSTANCE_RECORD_BUDGET}. */
export function instanceRecordCount(ledger: InventoryLedger): number {
  return liveInstances(ledger).length;
}

const CLASS_ORDER: Readonly<Record<SlotClass, number>> = {
  supply: 0, material: 1, quest: 2, entitlement: 3,
};
const AFFINITY: Partial<Record<SlotClass, VaultTabId>> = {
  material: 'materials', supply: 'supplies',
};

function emptyTabs<T>(make: () => T): Record<VaultTabId, T> {
  return Object.fromEntries(VAULT_TABS.map(tab => [tab, make()])) as Record<VaultTabId, T>;
}

/** Where everything shows. Deterministic and independent of record order. */
export function layoutOf(ledger: InventoryLedger, capacity: Capacity): Layout {
  const tabs = emptyTabs<Cell[]>(() => []);
  const instancesIn = emptyTabs(() => 0);
  const satchel: Cell[] = [];
  const quest: Cell[] = [];

  const instances = liveInstances(ledger).sort((a, b) => a.id.localeCompare(b.id));
  for (const row of instances) {
    const cell: Cell = { key: row.id, kind: 'instance', quantity: 1, slots: 1 };
    if (row.location.kind === 'bag') { satchel.push(cell); continue; }
    const tab = vaultTabOf(row.location);
    if (!tab) continue; // worn, lent, in a chest: no slot
    tabs[tab].push(cell);
    instancesIn[tab] += 1;
  }
  const bagInstances = satchel.length;

  let satchelFree = capacity.satchel - bagInstances;
  const tabFree = emptyTabs(() => 0);
  for (const tab of VAULT_TABS) tabFree[tab] = TAB_SLOTS[tab] - instancesIn[tab];

  const keys = [...new Set(ledger.records
    .filter(row => row.kind === 'stack' && row.source === 'inventory')
    .map(row => row.kind === 'stack' ? row.stackKey : ''))]
    .sort((a, b) => CLASS_ORDER[slotClassOf(a)] - CLASS_ORDER[slotClassOf(b)] || a.localeCompare(b));

  for (const key of keys) {
    const quantity = stackQuantityOf(ledger, key);
    if (quantity <= 0) continue;
    const cls = slotClassOf(key);
    if (cls === 'entitlement') continue;
    const need = Math.ceil(quantity / stackCapOf(key));
    if (cls === 'quest') { quest.push({ key, kind: 'stack', quantity, slots: 0 }); continue; }

    const affinity = AFFINITY[cls];
    if (affinity && capacity.tabs.has(affinity)) {
      const uncapped = TAB_SLOTS[affinity] === Infinity;
      if (uncapped || need <= tabFree[affinity]) {
        tabs[affinity].push({ key, kind: 'stack', quantity, slots: uncapped ? 0 : need });
        if (!uncapped) tabFree[affinity] -= need;
        continue;
      }
    }
    if (need <= satchelFree) {
      satchel.push({ key, kind: 'stack', quantity, slots: need });
      satchelFree -= need;
      continue;
    }
    const general = GENERAL_TABS.find(tab => capacity.tabs.has(tab) && need <= tabFree[tab]);
    if (general) {
      tabs[general].push({ key, kind: 'stack', quantity, slots: need });
      tabFree[general] -= need;
      continue;
    }
    tabs.overflow.push({ key, kind: 'stack', quantity, slots: need });
  }

  const satchelUsed = satchel.reduce((sum, cell) => sum + cell.slots, 0);
  return { satchel, tabs, quest, satchelUsed, instancesIn, bagInstances };
}

/**
 * Where an instance goes when it is sent to the Vault (or arrives to a full
 * satchel): the Gear tab if owned with room, else the first General tab with
 * room, else Overflow. Room counts instances only — stacks yield.
 */
export function routeFor(instancesIn: Readonly<Record<VaultTabId, number>>, capacity: Capacity): VaultTabId {
  const room = (tab: VaultTabId) => capacity.tabs.has(tab) && instancesIn[tab] < TAB_SLOTS[tab];
  if (room('gear')) return 'gear';
  return GENERAL_TABS.find(room) ?? 'overflow';
}

/**
 * Hold the satchel to its capacity: move the bag instances over it — the most
 * recently written first — to the Vault route. The only automatic write in the
 * design, and it is the same single-field location write an equip makes, so a
 * merge of two devices that settled different sets loses and copies nothing.
 * Idempotent: a settled ledger comes back unchanged (the same object).
 */
export function settle(
  ledger: InventoryLedger,
  capacity: Capacity,
  deviceId: string,
  now: number,
): { ledger: InventoryLedger; moved: string[] } {
  const bag = liveInstances(ledger).filter(row => row.location.kind === 'bag');
  const over = bag.length - capacity.satchel;
  if (over <= 0) return { ledger, moved: [] };

  const instancesIn = { ...layoutOf(ledger, capacity).instancesIn };
  const doomed = [...bag]
    .sort((a, b) => compareRevision(b.revision, a.revision) || a.id.localeCompare(b.id))
    .slice(0, over);
  let next = ledger;
  const moved: string[] = [];
  for (const row of doomed) {
    const tab = routeFor(instancesIn, capacity);
    instancesIn[tab] += 1;
    const stepped = nextRevision(next, deviceId, now, row.revision);
    const updated: OwnedItemInstance = {
      ...row,
      location: { kind: 'explorer', explorerId: vaultHolder(tab) },
      revision: stepped.revision,
    };
    next = {
      ...next,
      hlc: stepped.hlc,
      records: next.records.map(entry => entry.id === row.id ? updated : entry),
    };
    moved.push(row.id);
  }
  return { ledger: next, moved };
}

const SIGIL_NAMES = new Set(RUNES.map(rune => `${rune.name} Sigil`));

/**
 * A pre-removal "<Rune> Sigil" record: every rune find used to mint one, with
 * nothing of its own — no stats, no roll grade, no temper, reforge or socket.
 * Anything carrying any of those is not one, so a frozen grade is never lost.
 */
export function isLegacySigil(row: OwnedItemInstance): boolean {
  if (row.type !== 'rune' || !SIGIL_NAMES.has(row.name)) return false;
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
