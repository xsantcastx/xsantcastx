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
 *   · Identical instances share slots (item-groups.ts, manager decision
 *     2026-10-13): a group of n identical pieces in one place takes
 *     ceil(n / 20) slots. Each piece is still its own record; only counting
 *     changes, and every surface reads the count from here.
 *   · Instances outrank stacks for space. A stack that no longer fits in the
 *     satchel shows in a Vault tab or Overflow; benches read the total anyway.
 *   · Nothing here deletes. `settle` only ever rewrites `location`.
 */
import { compareRevision, nextRevision, recordToItem, stackQuantityOf, tombstoneRecord } from './inventory-ops';
import { IDENTICAL_PER_SLOT, identityKeyOf } from './item-groups';
import type { InventoryLedger, ItemLocation, OwnedItemInstance } from './inventory.model';

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
  // The Worn Rod: handed to every Keeper, soulbound, like the quest finds it takes no slot.
  'worn-rod',
  // The Underhearth (Phase 8): the Four Hammer-Marks, kept after the first fight (they wake the furnace).
  'four-hammer-marks',
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
  /**
   * Slots it takes where it sits: ceil(qty / cap) for a stack (0 in a no-cap
   * tab); 1 for a one-of-a-kind instance. Identical instances share: the 1st,
   * 21st, 41st… piece of a group (by id) carries the slot, the rest carry 0,
   * so a group of n sums to ceil(n / 20).
   */
  slots: number;
}

export interface Layout {
  satchel: Cell[];
  tabs: Record<VaultTabId, Cell[]>;
  quest: Cell[];
  /** Slots used in the satchel, instances and stacks together. */
  satchelUsed: number;
  /** Instance pieces per tab ("N more in your Vault" counts these). */
  instancesIn: Record<VaultTabId, number>;
  /** Slots instances take per tab, identical groups sharing (stacks yield to these). */
  instanceSlotsIn: Record<VaultTabId, number>;
  /** Instance pieces loose in the satchel. */
  bagInstances: number;
  /** Slots those pieces take: the number `settle` holds to `capacity.satchel`. */
  bagSlots: number;
}

/** Where an instance takes slots: the satchel, or a Vault tab. */
export type SlotPlace = 'bag' | VaultTabId;

/**
 * Instance slots in use, place by place, with each place's identical groups
 * (identity key → pieces). The one model every slot check reads, so the
 * counters, the routing and settle cannot disagree.
 */
export interface Occupancy {
  slots: Record<SlotPlace, number>;
  groups: Record<SlotPlace, Map<string, number>>;
}

// Records are replaced, never edited in place, so a key cached per record
// object stays right; the layout is recomputed on every publish.
const IDENTITY = new WeakMap<OwnedItemInstance, string | null>();

/** A record's identity key (item-groups), or null when it is one of a kind. */
export function identityOfRecord(row: OwnedItemInstance): string | null {
  const cached = IDENTITY.get(row);
  if (cached !== undefined) return cached;
  const key = identityKeyOf(recordToItem(row));
  IDENTITY.set(row, key);
  return key;
}

/** The place an instance takes slots in, or null (worn, lent, in a chest). */
export function slotPlaceOf(location: ItemLocation): SlotPlace | null {
  return location.kind === 'bag' ? 'bag' : vaultTabOf(location);
}

/** Slots one more piece with this identity key adds in `place`: 1, or 0 when it joins a group with room. */
export function slotCostOf(occupancy: Occupancy, place: SlotPlace, key: string | null): number {
  if (key === null) return 1;
  return (occupancy.groups[place].get(key) ?? 0) % IDENTICAL_PER_SLOT === 0 ? 1 : 0;
}

/** Add one piece to `place`. Mutates. */
export function occupy(occupancy: Occupancy, place: SlotPlace, key: string | null): void {
  occupancy.slots[place] += slotCostOf(occupancy, place, key);
  if (key !== null) occupancy.groups[place].set(key, (occupancy.groups[place].get(key) ?? 0) + 1);
}

/** Take one piece out of `place`. Mutates. */
export function vacate(occupancy: Occupancy, place: SlotPlace, key: string | null): void {
  if (key === null) { occupancy.slots[place] -= 1; return; }
  const n = occupancy.groups[place].get(key) ?? 0;
  if (n <= 0) return;
  if (n === 1) occupancy.groups[place].delete(key);
  else occupancy.groups[place].set(key, n - 1);
  if (n % IDENTICAL_PER_SLOT === 1) occupancy.slots[place] -= 1;
}

const SLOT_PLACES: readonly SlotPlace[] = ['bag', ...VAULT_TABS];

function emptyOccupancy(): Occupancy {
  return {
    slots: Object.fromEntries(SLOT_PLACES.map(place => [place, 0])) as Record<SlotPlace, number>,
    groups: Object.fromEntries(SLOT_PLACES.map(place => [place, new Map<string, number>()])) as Record<SlotPlace, Map<string, number>>,
  };
}

/** The instance slots a ledger uses, place by place. */
export function occupancyOf(ledger: InventoryLedger): Occupancy {
  const occupancy = emptyOccupancy();
  for (const row of liveInstances(ledger)) {
    const place = slotPlaceOf(row.location);
    if (place) occupy(occupancy, place, identityOfRecord(row));
  }
  return occupancy;
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

  const instanceSlotsIn = emptyTabs(() => 0);
  let bagSlots = 0;

  // Sorted by id, so which piece of a group carries its slot is stable.
  const instances = liveInstances(ledger).sort((a, b) => a.id.localeCompare(b.id));
  const occupancy = emptyOccupancy();
  for (const row of instances) {
    const place = slotPlaceOf(row.location);
    if (!place) continue; // worn, lent, in a chest: no slot
    const key = identityOfRecord(row);
    const slots = slotCostOf(occupancy, place, key);
    occupy(occupancy, place, key);
    const cell: Cell = { key: row.id, kind: 'instance', quantity: 1, slots };
    if (place === 'bag') { satchel.push(cell); bagSlots += slots; continue; }
    tabs[place].push(cell);
    instancesIn[place] += 1;
    instanceSlotsIn[place] += slots;
  }
  const bagInstances = satchel.length;

  let satchelFree = capacity.satchel - bagSlots;
  const tabFree = emptyTabs(() => 0);
  for (const tab of VAULT_TABS) tabFree[tab] = TAB_SLOTS[tab] - instanceSlotsIn[tab];

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
  return { satchel, tabs, quest, satchelUsed, instancesIn, instanceSlotsIn, bagInstances, bagSlots };
}

/**
 * Where an instance goes when it is sent to the Vault (or arrives to a full
 * satchel). First, an owned tab where an identical group has room for one
 * more (it costs no slot, and the group stays together); else the Gear tab if
 * owned with room; else the first General tab with room; else Overflow. Room
 * counts instance slots only — stacks yield.
 */
export function routeFor(occupancy: Occupancy, capacity: Capacity, key: string | null = null): VaultTabId {
  const owned = (tab: VaultTabId) => capacity.tabs.has(tab) && tab !== 'overflow';
  const room = (tab: VaultTabId) =>
    owned(tab) && occupancy.slots[tab] + slotCostOf(occupancy, tab, key) <= TAB_SLOTS[tab];
  const order: VaultTabId[] = ['gear', ...GENERAL_TABS];
  if (key !== null) {
    const joins = order.find(tab => owned(tab) && slotCostOf(occupancy, tab, key) === 0);
    if (joins) return joins;
  }
  return order.find(room) ?? 'overflow';
}

/**
 * Plan sending satchel pieces to the Vault: each routed in turn, as single
 * sends would be, so identical pieces land together. Ids not loose in the
 * satchel are skipped. Pure.
 */
export function stowPlan(
  ledger: InventoryLedger,
  capacity: Capacity,
  ids: readonly string[],
): { id: string; tab: VaultTabId }[] {
  const occupancy = occupancyOf(ledger);
  const plan: { id: string; tab: VaultTabId }[] = [];
  for (const row of rowsFor(ledger, ids)) {
    if (row.location.kind !== 'bag') continue;
    const key = identityOfRecord(row);
    const tab = routeFor(occupancy, capacity, key);
    vacate(occupancy, 'bag', key);
    occupy(occupancy, tab, key);
    plan.push({ id: row.id, tab });
  }
  return plan;
}

/**
 * Plan taking Vault pieces into the satchel: as many as fit, counting shared
 * slots — 30 identical pieces into a satchel with one free slot take 20.
 * Ids not in the Vault are skipped. Pure.
 */
export function takeOutPlan(ledger: InventoryLedger, capacity: Capacity, ids: readonly string[]): string[] {
  const occupancy = occupancyOf(ledger);
  const plan: string[] = [];
  for (const row of rowsFor(ledger, ids)) {
    const tab = vaultTabOf(row.location);
    if (!tab) continue;
    const key = identityOfRecord(row);
    if (occupancy.slots.bag + slotCostOf(occupancy, 'bag', key) > capacity.satchel) continue;
    vacate(occupancy, tab, key);
    occupy(occupancy, 'bag', key);
    plan.push(row.id);
  }
  return plan;
}

/** Whether a Vault tab has room for one more of this piece (shared slots counted). */
export function tabHasRoomFor(ledger: InventoryLedger, capacity: Capacity, tab: VaultTabId, row: OwnedItemInstance): boolean {
  if (!capacity.tabs.has(tab)) return false;
  const occupancy = occupancyOf(ledger);
  return occupancy.slots[tab] + slotCostOf(occupancy, tab, identityOfRecord(row)) <= TAB_SLOTS[tab];
}

function rowsFor(ledger: InventoryLedger, ids: readonly string[]): OwnedItemInstance[] {
  const byId = new Map(liveInstances(ledger).map(row => [row.id, row]));
  return [...new Set(ids)].map(id => byId.get(id)).filter((row): row is OwnedItemInstance => !!row);
}

/**
 * Hold the satchel to its capacity: move bag instances to the Vault route
 * until their slots fit. The only automatic write in the design, and it is
 * the same single-field location write an equip makes, so a merge of two
 * devices that settled different sets loses and copies nothing.
 *
 * Which pieces: the most recently written piece whose move frees a slot (a
 * one-of-a-kind piece, or the odd piece of a group past a multiple of 20).
 * When none would, the group closest to freeing one gives up its newest piece.
 * Deterministic for a given ledger, so two devices settling the same merged
 * ledger make the same moves. Idempotent: a settled ledger comes back
 * unchanged (the same object).
 */
export function settle(
  ledger: InventoryLedger,
  capacity: Capacity,
  deviceId: string,
  now: number,
): { ledger: InventoryLedger; moved: string[] } {
  const occupancy = occupancyOf(ledger);
  if (occupancy.slots.bag <= capacity.satchel) return { ledger, moved: [] };

  const candidates = liveInstances(ledger)
    .filter(row => row.location.kind === 'bag')
    .map(row => ({ row, key: identityOfRecord(row) }))
    .sort((a, b) => compareRevision(b.row.revision, a.row.revision) || a.row.id.localeCompare(b.row.id));
  // Pieces a group is past its last full slot; 1 means moving this one frees a slot.
  const remainder = (key: string | null) =>
    key === null ? 1 : (((occupancy.groups.bag.get(key) ?? 1) - 1) % IDENTICAL_PER_SLOT) + 1;

  let next = ledger;
  const moved: string[] = [];
  while (occupancy.slots.bag > capacity.satchel && candidates.length) {
    let at = candidates.findIndex(c => remainder(c.key) === 1);
    if (at < 0) {
      at = 0;
      for (let i = 1; i < candidates.length; i++) {
        if (remainder(candidates[i].key) < remainder(candidates[at].key)) at = i;
      }
    }
    const [{ row, key }] = candidates.splice(at, 1);
    const tab = routeFor(occupancy, capacity, key);
    vacate(occupancy, 'bag', key);
    occupy(occupancy, tab, key);
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
