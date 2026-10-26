/**
 * inventory.model.ts — C3 unified inventory ledger (schema only).
 *
 * InventoryService is the writer of owned **instances and stacks**. Economy
 * remains the writer of currency and of Market artifact/cosmetic ownership
 * until a later approved migration. This file is the adapter contract, not
 * a bag UI.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * OWNERSHIP SOURCES (do not transfer authority in C3)
 * ─────────────────────────────────────────────────────────────────────────────
 * | Source                         | Key                 | C3 role              |
 * | InventoryService.items         | godforge-inventory  | migrate to records   |
 * | Economy artifacts/cosmetics    | godforge-economy    | read-only projection |
 * | Rune Forge runes/runewords     | godforge-runes      | read-only projection |
 *
 * Hydration: Economy loads first. Inventory then can project Economy (and,
 * via a pure helper, the rune ledger). A projection never writes back.
 *
 * Today's Character / explorer UI still reads Economy and Rune Forge from
 * those services. `itemsFromLedger` / the published snapshot contain only
 * `source: 'inventory'` GameItems so Market artifacts, cosmetics, and runes
 * do not appear in the existing bag. `projectEconomy` / `projectRunes` exist
 * for C4's unified bag and for tests.
 *
 * C5 slot map (authored, not applied here):
 *   head→head, chest→chest, weapon→weapon, offhand→off-hand;
 *   hands/legs/feet/trinket start empty;
 *   charm1–3 unequip to bag and stay frozen (“Requires the future charm system”).
 * C5 applies that map: offhand → off-hand, charm1–3 bag + retired tag.
 */
import type { GameItem, GraveCurse, GraveWhisper, ItemRarity, ItemStats, ItemType, SlotId } from './item.model';

export const INVENTORY_SCHEMA_VERSION = 2 as const;
/** Bump wipes bag, stacks, and worn pieces. Cloud copies without this era empty too. */
export const INVENTORY_ERA = 55 as const;
/** Same window as ledger ACK_STALE_MS: tombstones survive this long after delete. */
export const INVENTORY_TOMBSTONE_RETAIN_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * Tombstones a ledger keeps. Past it — and past {@link INVENTORY_TOMBSTONE_RETAIN_MS} — the oldest are dropped by
 * `compactInventoryLedger` and their time raises `tombFloor`, so the record they killed still cannot come back
 * (save compaction, docs/handoff/save-compaction.md). ~45 B each in the packed cloud document.
 */
export const INVENTORY_TOMBSTONE_MAX = 1024;
/**
 * Another device's stack ops are folded for it once its newest op is this old: a phone that stopped syncing would
 * otherwise keep its unfolded ops in every save forever (the owner's held 256 from August).
 */
export const INVENTORY_DORMANT_DEVICE_MS = 14 * 24 * 60 * 60 * 1000;
/**
 * The size guard: a cloud inventory document (packed, JSON characters) above this is compacted hard — every other
 * device's ops folded after a day, tombstones and fold memory halved. Firestore refuses documents over 1 MiB.
 */
export const INVENTORY_SIZE_GUARD = 400_000;
/**
 * Own stack ops one device keeps unfolded. Past it, the device folds its own
 * oldest ops into its {@link InventoryStackFold} (down to half), so a device
 * that never syncs does not grow its blob without bound.
 */
export const INVENTORY_STACK_OPS_MAX = 64;
/**
 * Folded op ids a device remembers (as hashes), so a grant replayed after its
 * op was folded is still recognised and lands once. 10 B each in the packed
 * cloud document, ~10 KB a device. 1,024 since save compaction (was 2,048, the
 * largest part of the owner's save after its records): a replay is a retry of
 * the same action, and 1,024 folded ops is days of play on one device.
 */
export const INVENTORY_FOLD_ID_MEMORY = 1024;
/**
 * The retired 250-record ceiling. Nothing on the client enforces it any more;
 * kept for the inventory spec §4.4 / slice S7 (the player market server that
 * read it was removed).
 */
export const INVENTORY_BAG_CAP = 250;

export type OwnedItemCategory =
  | 'equipment'
  | 'runes'
  | 'materials'
  | 'consumables'
  | 'quest'
  | 'artifacts';

export type InventoryRecordSource = 'inventory' | 'economy' | 'runes';

export interface InventoryRevision {
  hlc: number;
  deviceId: string;
  sequence: number;
}

export type ItemLocation =
  | { kind: 'bag' }
  | { kind: 'equipped'; slotId: SlotId }
  | { kind: 'explorer'; explorerId: string };

/**
 * Where a thing sits in its grid (docs/design/inventory-grid.md §2): the satchel (`k: 'b'`) or a Vault tab
 * (`k: <tab id>`), and the top-left cell of each pile (`c`: one for an instance; one per pile for a stack; cell =
 * row * GRID_W + column). Its own revision `r`, merged by itself (the newer `pos` wins, whatever record copy wins),
 * so a move never fights an upgrade made on another device. Absent: placed by the rule (first fit), never stored.
 */
export interface GridPos {
  k: string;
  c: number[];
  r: InventoryRevision;
}

export interface OwnedItemBase {
  id: string;
  definitionId: string;
  category: OwnedItemCategory;
  tags: string[];
  rarity?: string;
  soulbound: boolean;
  acquiredAt: string;
  revision: InventoryRevision;
  source: InventoryRecordSource;
  /** Its place in the grid; see {@link GridPos}. */
  pos?: GridPos;
}

export interface OwnedItemInstance extends OwnedItemBase {
  kind: 'instance';
  name: string;
  type: ItemType;
  lore?: string;
  stats: ItemStats;
  /** Per-stat roll grade, 0..1. Absent on records written before grading. */
  rollQuality?: Partial<Record<keyof ItemStats, number>>;
  /** Where it dropped (1..99); sets the affix ranges. Absent before affixes. */
  itemLevel?: number;
  sellValue: number;
  /**
   * Economy version `sellValue` is written in. Absent (or < 3) means v2 Gold,
   * which the parser scales by ρ exactly once and then stamps 3 — a per-record
   * marker, so a merge that picks either copy of a record stays consistent.
   */
  econ?: number;
  location: ItemLocation;
  upgradeLevel?: number;
  lastUpgradeAt?: string;
  lastUpgradeMutationId?: string;
  lastUpgradeOk?: boolean;
  /** Reforge's twins of the three above. See GameItem in item.model.ts. */
  reforgeCount?: number;
  lastReforgeAt?: string;
  lastReforgeMutationId?: string;
  lastReforgeLock?: keyof ItemStats;
  /** Runes in this instance's sockets, in well order. See `GameItem.sockets`. */
  sockets?: (string | null)[];
  /** A cursed grave-good's curse. See `GameItem.curse`. */
  curse?: GraveCurse;
  /** A whispering item's voice and progress. See `GameItem.whisper`. */
  whisper?: GraveWhisper;
  /** A Spellstone's charges left (1..100). See `GameItem.charges`. */
  charges?: number;
}

export interface OwnedItemStack extends OwnedItemBase {
  kind: 'stack';
  stackKey: string;
  location: { kind: 'bag' };
}

export type OwnedItemRecord = OwnedItemInstance | OwnedItemStack;

export interface InventoryTombstone {
  id: string;
  revision: InventoryRevision;
  deletedAt: number;
}

export type StackOpKind = 'grant' | 'consume';

export interface InventoryStackOp {
  id: string;
  stackKey: string;
  kind: StackOpKind;
  quantity: number;
  hlc: number;
  deviceId: string;
  sequence: number;
}

export interface InventoryBlobV1 {
  version: 1;
  items: GameItem[];
  goldFromSales: number;
  sold: number;
}

/**
 * One device's compacted stack history: the net of every stack op *that device
 * wrote* with `hlc <= upToHlc`, per stack key, plus the hashes of the newest
 * folded op ids.
 *
 * Per device, because only the writer of an op is sure to hold it: a device
 * folds its own ops and nobody else's, so an op another device has not seen
 * yet can never be folded away under it (the old global watermark lost those).
 * A device writes its ops in strictly increasing hlc and is the only writer of
 * its fold, so two copies of one device's fold are ordered by `upToHlc` and a
 * merge keeps the higher one whole — a state-based counter per device.
 *
 * `ids` is the replay memory: a grant retried after its op was folded must
 * still be recognised (`ledgerKnowsOp`), or it would land a second time.
 * Bounded: the newest {@link INVENTORY_FOLD_ID_MEMORY} per device. `net` may be
 * negative (a device can spend what another granted); only the total clamps.
 */
export interface InventoryStackFold {
  deviceId: string;
  upToHlc: number;
  net: Record<string, number>;
  /** `opIdHash` of folded op ids, oldest first. */
  ids: string[];
}

export interface InventoryLedger {
  version: 2;
  records: OwnedItemRecord[];
  tombstones: InventoryTombstone[];
  stackOps: InventoryStackOp[];
  /** Compacted stack history, one fold per device. Absent until a device first folds. */
  stackFolds?: InventoryStackFold[];
  goldFromSales: number;
  sold: number;
  hlc: number;
  /** Original v1 blob, kept until the first successful cloud merge. */
  legacyBackup: InventoryBlobV1 | null;
  era?: number;
  /**
   * How many times the trade server wrote this save (functions-game/src/trade-core.ts: a trade, a ground drop or pickup).
   * Merged by max; firestore.rules refuses a client write that carries a lower one than the stored document, so a
   * device that read the save just before the server wrote it re-reads and merges instead of overwriting the move.
   * Absent (0) on a save the server never touched.
   */
  serverSeq?: number;
  /**
   * The tombstone watermark (save compaction): the newest time of any tombstone this ledger has dropped. A record
   * at or below it that this ledger does not hold is one of the items those tombstones killed, so the merge refuses
   * it from the other side instead of letting a stale device resurrect it. Merged by max. Absent (0) until the first
   * tombstone is dropped. Items minted on a device that did not sync for longer than the window are the price — the
   * same stale-device window the economy ledger's checkpoint uses.
   */
  tombFloor?: number;
  /**
   * The grid version this ledger was laid out under (docs/design/inventory-grid.md §4). Absent: a list-era save, laid
   * out once on load (what does not fit goes to the Vault, once, with a note). Merged by max.
   */
  grid?: number;
}

export type EconomyProjectionInput = {
  artifacts: readonly string[];
  cosmetics: readonly string[];
};

export type RuneProjectionInput = {
  runes: Record<string, number>;
  runewords: readonly string[];
};
