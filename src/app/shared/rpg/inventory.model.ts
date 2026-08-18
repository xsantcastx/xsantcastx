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
import type { GameItem, ItemRarity, ItemStats, ItemType, SlotId } from './item.model';

export const INVENTORY_SCHEMA_VERSION = 2 as const;
/** Bump wipes bag, stacks, and worn pieces. Cloud copies without this era empty too. */
export const INVENTORY_ERA = 55 as const;
export const INVENTORY_LEGACY_VERSION = 1 as const;
/** Same window as ledger ACK_STALE_MS: tombstones survive this long after delete. */
export const INVENTORY_TOMBSTONE_RETAIN_MS = 30 * 24 * 60 * 60 * 1000;
export const INVENTORY_TOMBSTONE_MAX = 256;
/** Hard cap on stack grant/consume ops. Oldest-by-hlc evict after this. */
export const INVENTORY_STACK_OPS_MAX = 256;
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
}

export interface OwnedItemInstance extends OwnedItemBase {
  kind: 'instance';
  name: string;
  type: ItemType;
  lore?: string;
  stats: ItemStats;
  sellValue: number;
  location: ItemLocation;
  upgradeLevel?: number;
  lastUpgradeAt?: string;
  lastUpgradeMutationId?: string;
  lastUpgradeOk?: boolean;
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
 * A compacted summary of every stack op at or below `upToHlc` for one stack.
 *
 * Stack quantities are *derived* by summing the op log, and the log is capped
 * at {@link INVENTORY_STACK_OPS_MAX}. Truncating it therefore used to subtract
 * the oldest grants from the player's total — mined ore silently vanished once
 * a save crossed the cap. A checkpoint is the retain window this file's header
 * always called for: the overflow is folded into `quantity` instead of dropped.
 *
 * Merge keeps the checkpoint with the highest `upToHlc` per stack and discards
 * ops already covered by it, which makes the fold idempotent. The known limit
 * is inherent to log compaction: an op that no device saw before compaction
 * raised the watermark past it cannot be recovered. That is strictly better
 * than the previous behaviour, which dropped ops unconditionally.
 */
export interface InventoryStackCheckpoint {
  stackKey: string;
  /** Net of every grant minus consume at or below `upToHlc`. Never negative. */
  quantity: number;
  upToHlc: number;
}

export interface InventoryLedger {
  version: 2;
  records: OwnedItemRecord[];
  tombstones: InventoryTombstone[];
  stackOps: InventoryStackOp[];
  /** Compacted stack history. Absent on saves written before this existed. */
  stackCheckpoints?: InventoryStackCheckpoint[];
  goldFromSales: number;
  sold: number;
  hlc: number;
  /** Original v1 blob, kept until the first successful cloud merge. */
  legacyBackup: InventoryBlobV1 | null;
  era?: number;
}

export type EconomyProjectionInput = {
  artifacts: readonly string[];
  cosmetics: readonly string[];
};

export type RuneProjectionInput = {
  runes: Record<string, number>;
  runewords: readonly string[];
};
