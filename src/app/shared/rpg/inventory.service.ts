/**
 * inventory.service.ts — the bag, the seven slots, and the till.
 *
 * Owns every `GameItem` the visitor holds, whether it is in the bag, worn in one
 * of the player's seven slots, or worn by an explorer. One list, one key, one
 * writer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY ONE LIST AND NOT THREE
 * ─────────────────────────────────────────────────────────────────────────────
 * The tempting shape is `bag`, `equipped` and `onExplorers` as separate
 * collections, which makes each read trivial and every *move* a two-sided
 * transaction that can half-fail. An item that is removed from the bag and not
 * added to the slot is gone; one added to the slot and not removed from the bag
 * exists twice, and selling the copy in the bag leaves a phantom paying stats
 * from a slot forever.
 *
 * So there is one list, and where an item *is* is a property of the item:
 * `equipped` plus `slot` for the player, `explorerId` for an explorer, neither
 * for the bag. A move is a single field write on a single record and cannot be
 * torn. The three views the UI wants are filters, computed on publish.
 *
 * C3 persists a v2 ledger (records, revisions, tombstones, stack ops) and
 * still publishes the same GameItem snapshot so Character UI is unchanged.
 * Economy artifacts/cosmetics are projected read-only and never written back.
 *
 * SSR: `init()` returns immediately on the server and the snapshot stays empty,
 * so the character sheet prerenders seven empty slots and an empty bag.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

import { DEVICE_ID_KEY } from '../economy/economy-ops';
import { EconomyService } from '../economy/economy.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import {
  GameItem,
  ItemRarity,
  ItemStats,
  SlotId,
  SLOT_IDS,
  slotAccepts,
  sumStats,
  wornGoldFind,
} from './item.model';
import { wornStats } from '../enchanting/socket-words';
import { socketsOf } from '../enchanting/socket.model';
import { oldRollTwins } from './item-calling';
import { itemAffixFamily } from './item-base';
import {
  INVENTORY_BAG_CAP,
  type InventoryLedger,
  type OwnedItemInstance,
  type OwnedItemStack,
} from './inventory.model';
import {
  applyStackOp,
  coerceInventoryLedger,
  compactInventoryLedger,
  dropLegacyBackup,
  emptyInventoryLedger,
  itemToRecord,
  itemsFromLedger,
  nextRevision,
  restoreCharms,
  socketOpId,
  socketRefunds,
  stackQuantityOf,
  ledgerKnowsOp,
  tombstoneRecord,
  upsertRecord,
} from './inventory-ops';
import { CINDER_ORE_ID, EMBER_RESIDUE_ID } from '../activity/activity.model';
import {
  BASALT_EDGE_RECIPE_ID,
  basaltEdgeItemId,
  forgeRecipeById,
  mintBasaltEdge,
} from './forge-recipes';
import { isBasaltEdge } from './material-catalog';
import { handsDisplaced, isTwoHanded, mendHands } from './item-hands';
import { refineOpIds, refinePreview, refineRecipeFor } from './refine-ops';
import { INVENTORY_ERA } from './inventory.model';
import { eraIsCurrent, ledgerFromPriorEra } from '../save/realm-era';
import { definitionFor, itemFitsSlot } from './item-definition';
import {
  applyTemperBonus,
  isTemperableKind,
  previewUpgrade,
  rollUpgradeSuccess,
  upgradeLevelOf,
  type UpgradePreview,
} from './item-upgrade';
import {
  canReforgeItem,
  previewReforge,
  reforgeGoldCost,
  rollReforgeDetailed,
  type ReforgePreview,
} from './item-reforge';
import type { ItemStatKey } from './item-definition';
import {
  INSTANCE_RECORD_BUDGET,
  VAULT_LIVE,
  dropLegacySigils,
  instanceRecordCount,
  ledgerCapacity,
  slotClassOf,
  stackCapOf,
  vaultHolder,
  vaultTabOf,
  type Capacity,
  type VaultTabId,
} from './inventory-layout';

import {
  Board, GRID_TABS, dropFits, ensureStackRecord, gridLayout, pinLoose, sortContainer, isVaultStackKey, landingFor, migrateGrid, parseVaultStackKey,
  PILE_MAX as IDENTICAL_PER_SLOT, pileKeyOfRecord, stackLanding, vaultStackKey, containerOfLocation,
  type ContainerId, type GridLayout, type GridView, type Piece,
} from './inventory-grid';
import { footprintOf } from './item-footprint';
import { recordToItem } from './inventory-ops';
import type { GridPos } from './inventory.model';

export const INVENTORY_KEY = 'godforge-inventory';

/** What a grid move names: a pile of instances, or a pile of a stack (its ledger key and how many). */
export type GridRef =
  | { kind: 'instance'; ids: readonly string[] }
  | { kind: 'stack'; storeKey: string; qty: number; pile?: number };
/** Where it goes: a grid and the top-left cell. */
export interface GridTarget { container: ContainerId; cell: number }
export type GridMoveResult = 'ok' | 'blocked' | 'vault-closed' | 'gone' | 'worn' | 'persist';
/** The one-time list → grid layout, when it moved anything to the Vault (the note the satchel shows once). */
export interface GridMigrationNote { items: number; stacks: number }

/**
 * The retired 250-row ceiling, still read by a few displays (`used / cap`).
 * Nothing is refused or evicted at it any more: the satchel's real limit is
 * `snapshot.satchelCap` (inventory-layout.ts), and overflow moves to the Vault
 * — it is never destroyed.
 */
export const MAX_INVENTORY = INVENTORY_BAG_CAP;

export interface InventoryStackView {
  id: string;
  stackKey: string;
  quantity: number;
}

export interface InventorySnapshot {
  /** Everything held, newest first. */
  items: GameItem[];
  /** Unequipped, newest first — what the bag grid renders. */
  bag: GameItem[];
  /** Material stacks (ore, residue). Each occupies one bag row. */
  stacks: InventoryStackView[];
  /** slot id → the item in it, for the seven player slots. */
  equipped: Partial<Record<SlotId, GameItem>>;
  /** Summed stats of everything the *player* wears. Explorer kit is not counted. */
  totals: Required<ItemStats>;
  goldFromSales: number;
  sold: number;
  /** Satchel slots in use: bag instances plus the stack slots shown there. */
  usedRows: number;
  /** Satchel slots owned (40 + 8 per bought row); Infinity until the Vault is live. */
  satchelCap: number;
  /** Things waiting in Overflow (instances and stack kinds). */
  overflow: number;
  /** Where each stack kind shows: the satchel, the quest strip, or a Vault tab. */
  stackPlace: Readonly<Record<string, StackPlace>>;
  /** Instances (gear, charms) resting in the Vault, Overflow included. */
  inVault: number;
  /** True at the record budget: Gold purchases that mint an item are refused. */
  full: boolean;
  /** The grids (docs/design/inventory-grid.md): the satchel, each Vault tab, Overflow. */
  grid: GridLayout;
  /** Satchel things with no room (the "no room" strip): never moved anywhere by themselves. */
  held: number;
  /** Stacks resting in the Vault, by their plain key (benches never read these). */
  vaultStacks: InventoryStackView[];
}

export type StackPlace = 'satchel' | 'quest' | VaultTabId;

/**
 * Something that arrived to a full satchel and went to the Vault instead
 * (inventory spec §5.3). Not for things that live in their own tab anyway (ore
 * in an owned Materials tab): only the ones the full satchel turned away.
 */
export type VaultRouted =
  | { kind: 'item'; id: string; name: string; tab: VaultTabId }
  | { kind: 'stack'; stackKey: string; tab: VaultTabId };

/** `inventoryCensus()` — see {@link InventoryService.census}. */
export interface InventoryCensus {
  instances: number;
  /** Instances by place: bag, equipped, exp, thr, delve, vault:<tab>. */
  where: Record<string, number>;
  stacks: Record<string, number>;
  tombstones: number;
  stackOps: number;
  checkpoints: number;
  /** Serialised ledger size; the Firestore document limit is 1 MiB. */
  bytes: number;
  budgetLeft: number;
  satchel: { used: number; cap: number };
  overflow: number;
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly economy = inject(EconomyService);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly store = inject(GameStateGateway);

  private ledger: InventoryLedger = emptyInventoryLedger();
  private deviceId = 'unknown';
  private initialised = false;

  private readonly snapshot$$ = new BehaviorSubject<InventorySnapshot>(this.snapshotOf(emptyInventoryLedger()));
  private readonly acquired$$ = new Subject<GameItem>();
  private readonly stackGranted$$ = new Subject<{ stackKey: string; quantity: number }>();
  private readonly sold$$ = new Subject<{ item: GameItem; gold: number }>();
  private readonly equipped$$ = new Subject<GameItem>();
  private readonly improved$$ = new Subject<GameItem>();
  private readonly routed$$ = new Subject<VaultRouted>();
  private readonly gridMigrated$$ = new BehaviorSubject<GridMigrationNote | null>(null);
  /** The one-time list → grid layout's note (null when it moved nothing). Replayed: the satchel shows it once. */
  readonly gridMigrated$: Observable<GridMigrationNote | null> = this.gridMigrated$$.asObservable();
  /** Standing at a Vault: only then do things move between the satchel and the stash (the Vault station sets it). */
  private atVault = false;
  setAtVault(open: boolean): void { this.atVault = open; }
  get vaultOpen(): boolean { return this.atVault; }
  /** Why the last pickup was turned away: the satchel had no room. Read by the HUD for its line. */
  lastRefusal: 'full' | null = null;

  readonly snapshot$: Observable<InventorySnapshot> = this.snapshot$$.asObservable();
  /** One per item that lands. Drives the drop toast. */
  readonly acquired$: Observable<GameItem> = this.acquired$$.asObservable();
  /**
   * One per material stack that lands, with the amount that landed.
   *
   * `acquired$` cannot carry these: a stack is not a `GameItem` — it has no
   * rarity, no roll and no instance — and the row it lives in is created once
   * and then never again, so a snapshot diff cannot tell the tenth Cinder Ore
   * from a page reload. Announced from the one place a grant is committed, and
   * only after the write has been accepted, so a refused grant is silent.
   */
  readonly stackGranted$: Observable<{ stackKey: string; quantity: number }> =
    this.stackGranted$$.asObservable();
  readonly sold$: Observable<{ item: GameItem; gold: number }> = this.sold$$.asObservable();
  /**
   * One per item that moved into a slot — the Keeper's or an explorer's.
   *
   * Published rather than derived from `snapshot$`, because a diff of the
   * snapshot cannot tell an equip apart from a hydrate: the ledger arriving
   * from storage with six things worn looks identical to six equips, and the
   * Contract Board would pay for a page load. Not replayed — an equip is a
   * moment, and a late subscriber missed it.
   */
  readonly equipped$: Observable<GameItem> = this.equipped$$.asObservable();
  /** One per successful upgrade or temper, for the same reason. */
  readonly improved$: Observable<GameItem> = this.improved$$.asObservable();
  /** Retired with the grid: nothing goes to the Vault by itself any more. Kept (silent) for old subscribers. */
  readonly routed$: Observable<VaultRouted> = this.routed$$.asObservable();

  get snapshot(): InventorySnapshot { return this.snapshot$$.value; }

  private get items(): GameItem[] {
    return itemsFromLedger(this.ledger);
  }

  init(): void {
    if (!this.isBrowser || this.initialised) return;
    this.initialised = true;
    // Economy is the currency/ownership writer. Load it first, then project.
    this.economy.init();
    this.deviceId = this.readDeviceId();
    this.ledger = this.load();
    const restored = restoreCharms(this.ledger, this.deviceId, Date.now());
    const settledLedger = this.normalised(restored.ledger);
    this.ledger = settledLedger;
    if (this.ledger.legacyBackup || restored.restoredIds.length || settledLedger !== restored.ledger) this.save();
    this.publish();
    // Opt-in console probe: `inventoryCensus()` reads this save (inventory spec §1.3).
    (globalThis as { inventoryCensus?: () => InventoryCensus }).inventoryCensus = () => this.census();

    // `save()` writes this whole bag from memory, so items merged in from another
    // device would be gone at the next equip. Rehydrate re-parses the merged
    // v2 ledger and drops the v1 backup once the cloud copy has been adopted.
    this.saves.register(INVENTORY_KEY, {
      rehydrate: () => {
        this.ledger = this.load();
        const restored = restoreCharms(this.ledger, this.deviceId, Date.now());
        // Settle the merged ledger in the same tick as the read (spec §4.2).
        this.ledger = this.normalised(restored.ledger);
        let dirty = restored.restoredIds.length > 0 || this.ledger !== restored.ledger;
        if (this.store.attached && this.ledger.legacyBackup) {
          this.ledger = dropLegacyBackup(this.ledger);
          dirty = true;
        }
        if (dirty) this.save();
        this.publish();
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Reads
  // ───────────────────────────────────────────────────────────────────────────

  itemById(id: string): GameItem | undefined {
    return this.items.find(i => i.id === id);
  }

  /** Everything a given explorer is wearing. */
  itemsOnExplorer(explorerId: string): GameItem[] {
    return this.items.filter(i => i.explorerId === explorerId);
  }

  /** Summed stats of what the player wears. Excludes anything on an explorer. */
  get equippedTotals(): Required<ItemStats> {
    return this.snapshot.totals;
  }

  /**
   * Gold Find from the player's own equipped items, each read as its card shows it (item.model wornGoldFind: an old
   * piece's retired Gold/sec converted piece by piece, its runes and Socket Word in).
   */
  get equippedGoldFind(): number {
    return wornGoldFind(this.snapshot.items.filter(i => i.equipped && !i.explorerId).map(wornStats));
  }

  /**
   * The old rolls the player wears, as the fighters' twins (item-calling.ts oldRollTwins): Spell Damage and Cast Speed
   * on pieces whose family no longer rolls them (an old sword's implicit), which a fighter reads as Martial Damage and
   * Attack Speed. Never rewritten on the item — read here, at wear time (the frozen-grade rule).
   */
  get equippedOldRolls(): { attackDamage: number; attackSpeed: number } {
    return oldRollTwins(this.snapshot.items.filter(i => i.equipped && !i.explorerId)
      .map(i => ({ family: itemAffixFamily(i), stats: wornStats(i) })));
  }

  /** Magic Find from the player's own equipped items. */
  get equippedMagicFind(): number {
    return this.snapshot.totals.magicFind;
  }

  get count(): number { return this.items.length; }

  /** Distinct rarities held, for the achievement predicates. */
  hasRarity(rarity: ItemRarity): boolean {
    return this.items.some(i => i.rarity === rarity);
  }

  /** What this save holds, by place and kind, and how close it is to its budgets. Read-only. */
  census(): InventoryCensus {
    const ledger = this.ledger;
    const where: Record<string, number> = {};
    let instances = 0;
    for (const row of ledger.records) {
      if (row.kind !== 'instance' || row.source !== 'inventory') continue;
      instances += 1;
      const loc = row.location;
      const place = loc.kind !== 'explorer' ? loc.kind
        : vaultTabOf(loc) ? `vault:${vaultTabOf(loc)}` : loc.explorerId.split(/[-:]/)[0];
      where[place] = (where[place] ?? 0) + 1;
    }
    const stacks: Record<string, number> = {};
    for (const row of ledger.records) {
      if (row.kind === 'stack' && row.source === 'inventory') stacks[row.stackKey] = this.stackOf(row.stackKey);
    }
    const grid = gridLayout(ledger);
    return {
      instances,
      where,
      stacks,
      tombstones: ledger.tombstones.length,
      stackOps: ledger.stackOps.length,
      checkpoints: (ledger.stackFolds ?? []).length,
      bytes: JSON.stringify(ledger).length,
      budgetLeft: this.instanceRoom(),
      satchel: { used: grid.bag.used, cap: grid.bag.w * grid.bag.h },
      overflow: grid.overflow.length,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Acquiring
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Put a freshly minted item in the satchel — or, when the satchel is full, in
   * the Vault (then Overflow). Never refuses for space and never evicts
   * anything: a Gold purchase checks `canAcceptInstance()` (the record budget)
   * *before* it spends, and every other arrival lands. Null only on the server.
   */
  add(item: GameItem): GameItem | null {
    if (!this.isBrowser) return null;

    const incoming = this.placedArrival(this.withRevision(itemToRecord(item)));
    this.ledger = upsertRecord(this.ledger, incoming);
    this.save();
    this.publish();
    this.acquired$$.next(item);
    return item;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // The grid (docs/design/inventory-grid.md)
  // ───────────────────────────────────────────────────────────────────────────

  /** A satchel arrival with its landing cell written (a pile to join, else the first free spot); none when full. */
  private placedArrival(row: OwnedItemInstance): OwnedItemInstance {
    if (row.location.kind !== 'bag' || row.pos) return row;
    const land = landingFor(gridLayout(this.ledger).bag, footprintOf(recordToItem(row)), pileKeyOfRecord(row));
    if (!land) return row;
    return { ...row, pos: { k: 'b', c: [land.cell], r: this.advanceRevision().revision } };
  }

  /** Would this item fit the satchel right now (a free spot, or a pile with room)? A pickup asks first. */
  canPickUp(item: GameItem): boolean {
    const row = itemToRecord({ ...item, equipped: false, explorerId: undefined });
    return !!landingFor(this.snapshot.grid.bag, footprintOf(item), pileKeyOfRecord(row));
  }

  /** Would `qty` of a stack fit the satchel (topping up its piles, then free cells)? */
  canTakeStack(stackKey: string, qty: number): boolean {
    if (!stackTakesCellKey(stackKey)) return true;
    return !!stackLanding(this.snapshot.grid.bag, stackKey, qty);
  }

  /** Note a refused pickup (the HUD says "Your satchel is full"). */
  refusePickup(): false { this.lastRefusal = 'full'; return false; }

  /**
   * Move a pile in the grids: within the satchel or a tab, satchel ↔ Vault (only while standing at one), worn → a
   * satchel cell. Optimistic and local: one ledger write, no round trip. A move between places is a location write
   * (instances) or a consume and a grant (stacks); a move inside one place writes only the place.
   */
  moveTo(ref: GridRef, to: GridTarget): GridMoveResult {
    if (!this.isBrowser) return 'gone';
    const previous = this.ledger;
    const out = this.moveCore(ref, to, this.snapshot.grid);
    if (out !== 'ok') { this.ledger = previous; return out; }
    if (this.ledger === previous) return 'ok';
    if (!this.save()) { this.ledger = previous; return 'persist'; }
    this.publish();
    return 'ok';
  }

  /** One grid move on `this.ledger`, unsaved (moveTo saves; the Vault's Deposit all / Take all batch many in one write). */
  private moveCore(ref: GridRef, to: GridTarget, grid: GridLayout): GridMoveResult {
    const view = to.container === 'b' ? grid.bag : grid.tabs[to.container];
    if (!view || to.container === 'overflow') return 'blocked';
    const previous = this.ledger;
    if (ref.kind === 'instance') {
      const rows = ref.ids.map(id => this.instanceRow(id)).filter((r): r is OwnedItemInstance => !!r);
      if (!rows.length) return 'gone';
      const first = rows[0];
      if (first.location.kind === 'explorer' && !containerOfLocation(first.location)) return 'worn';
      const from = first.location.kind === 'equipped' ? 'b' : containerOfLocation(first.location);
      if ((from !== 'b' || to.container !== 'b') && from !== to.container && !this.atVault) return 'vault-closed';
      const fp = footprintOf(recordToItem(first));
      const own = [...view.pieces, ...view.held].find(p => p.kind === 'instance' && p.ids.includes(first.id));
      const fit = dropFits(view, { key: own?.key ?? 'drag', kind: 'instance', w: fp.w, h: fp.h, pileKey: pileKeyOfRecord(first), qty: rows.length }, to.cell);
      if (!fit) return 'blocked';
      const location: OwnedItemInstance['location'] = to.container === 'b' ? { kind: 'bag' } : { kind: 'explorer', explorerId: vaultHolder(to.container) };
      for (const row of rows) {
        const moved = row.location.kind !== location.kind || (row.location.kind === 'explorer' && location.kind === 'explorer' && row.location.explorerId !== location.explorerId);
        const base = moved ? this.withRevision({ ...row, location }) : row;
        this.ledger = upsertRecord(this.ledger, { ...base, pos: { k: to.container, c: [to.cell], r: this.advanceRevision().revision } });
      }
      return 'ok';
    }
    const fromTab = parseVaultStackKey(ref.storeKey)?.tab ?? null;
    const from: ContainerId | 'overflow' = fromTab ?? 'b';
    const plain = parseVaultStackKey(ref.storeKey)?.key ?? ref.storeKey;
    if (from !== to.container && !this.atVault) return 'vault-closed';
    const qty = Math.min(Math.floor(ref.qty), this.stackOf(ref.storeKey));
    if (!(qty > 0)) return 'gone';
    const key = `s:${ref.storeKey}#${ref.pile ?? 0}`;
    const fit = dropFits(view, { key, kind: 'stack', w: 1, h: 1, pileKey: null, qty, stackKey: plain }, to.cell);
    if (!fit) return 'blocked';
    const into = to.container === 'b' ? plain : vaultStackKey(to.container, plain);
    if (into === ref.storeKey) {
      if (fit === 'join') return 'ok';
      const piles = view.pieces.filter(p => p.kind === 'stack' && p.storeKey === ref.storeKey).sort((a, b) => (a.pile ?? 0) - (b.pile ?? 0));
      const cells = piles.map(p => (p.pile === (ref.pile ?? 0) ? to.cell : p.cell));
      this.setStackPos(ref.storeKey, to.container, cells);
    } else {
      // The pile that leaves takes its cell with it: the piles left behind keep theirs (nothing else moves).
      const fromView = from === 'b' ? grid.bag : from === 'overflow' ? null : grid.tabs[from];
      const srcPiles = (fromView?.pieces ?? []).filter(p => p.kind === 'stack' && p.storeKey === ref.storeKey).sort((a, b) => (a.pile ?? 0) - (b.pile ?? 0));
      const leaving = srcPiles.find(p => (p.pile ?? 0) === (ref.pile ?? 0));
      if (fromView && from !== 'overflow' && leaving && qty >= leaving.qty && srcPiles.length > 1) {
        // The last pile is the partial one: what stays is the other piles' cells, the partial one landing in the
        // leaving pile's place only when the leaving pile was the partial one itself.
        this.setStackPos(ref.storeKey, from, srcPiles.filter(p => p !== leaving).map(p => p.cell));
      }
      for (const [kind, k] of [['consume', ref.storeKey], ['grant', into]] as const) {
        const stepped = this.advanceRevision();
        this.ledger = { ...this.ledger, stackOps: applyStackOp(this.ledger.stackOps, {
          id: `move:${ref.storeKey}>${into}:${stepped.revision.hlc.toString(36)}.${stepped.revision.sequence}`, stackKey: k, kind, quantity: qty,
          hlc: stepped.revision.hlc, deviceId: stepped.revision.deviceId, sequence: stepped.revision.sequence,
        }) };
      }
      this.ledger = ensureStackRecord(this.ledger, into, this.deviceId, Date.now(), fit === 'join' ? null : to.cell, to.container);
      if (this.stackOf(ref.storeKey) < 0) { this.ledger = previous; return 'gone'; }
    }
    return 'ok';
  }

  /**
   * The Vault's "Deposit all" (owner 2026-10-26): every satchel piece goes into the stash, each into the first owned
   * tab with room (a pile of its kind first). Worn things are not in the satchel; `keep` names what stays (what the
   * belt draws from). Quest finds have no cell and never move. Only at a Vault. One write.
   */
  depositAll(keep: { stackKeys?: ReadonlySet<string>; itemIds?: ReadonlySet<string> } = {}): { moved: number; left: number; code: GridMoveResult } {
    if (!this.isBrowser) return { moved: 0, left: 0, code: 'gone' };
    if (!this.atVault) return { moved: 0, left: 0, code: 'vault-closed' };
    const previous = this.ledger;
    const tabs = GRID_TABS.filter(t => this.capacity().tabs.has(t));
    let moved = 0, left = 0;
    for (const p of [...this.snapshot.grid.bag.pieces].sort((a, b) => a.cell - b.cell)) {
      if (p.kind === 'stack' ? keep.stackKeys?.has(p.stackKey ?? '') : p.ids.some(id => keep.itemIds?.has(id))) continue;
      if (p.kind === 'instance' && p.ids.some(id => this.instanceRow(id)?.tags?.includes('quest'))) continue;
      if (this.moveIntoTabs(p, tabs)) moved++; else left++;
    }
    if (!moved) return { moved, left, code: left ? 'blocked' : 'ok' };
    if (!this.save()) { this.ledger = previous; return { moved: 0, left, code: 'persist' }; }
    this.publish();
    return { moved, left, code: 'ok' };
  }

  /** The Vault's "Take all" for one tab: its pieces into the satchel's first free cells, as many as fit. One write. */
  takeAllFrom(tab: VaultTabId): { moved: number; left: number; code: GridMoveResult } {
    if (!this.isBrowser) return { moved: 0, left: 0, code: 'gone' };
    if (!this.atVault) return { moved: 0, left: 0, code: 'vault-closed' };
    const view = this.snapshot.grid.tabs[tab];
    if (!view || tab === 'overflow') return { moved: 0, left: 0, code: 'blocked' };
    const previous = this.ledger;
    let moved = 0, left = 0;
    for (const p of [...view.pieces].sort((a, b) => a.cell - b.cell)) {
      if (this.moveIntoTabs(p, ['b'])) moved++; else left++;
    }
    if (!moved) return { moved, left, code: left ? 'blocked' : 'ok' };
    if (!this.save()) { this.ledger = previous; return { moved: 0, left, code: 'persist' }; }
    this.publish();
    return { moved, left, code: 'ok' };
  }

  /** Move one piece into the first of `into` with room (a pile of its kind, else the first free cell). */
  private moveIntoTabs(p: Piece, into: readonly ContainerId[]): boolean {
    const ref: GridRef = p.kind === 'instance' ? { kind: 'instance', ids: p.ids } : { kind: 'stack', storeKey: p.storeKey ?? '', pile: p.pile ?? 0, qty: p.qty };
    for (const c of into) {
      const grid = gridLayout(this.ledger, this.capacity());
      const view = c === 'b' ? grid.bag : grid.tabs[c];
      if (!view) continue;
      const join = view.pieces.find(x => p.kind === 'instance'
        ? x.kind === 'instance' && x.pileKey !== null && x.pileKey === p.pileKey && x.qty + p.qty <= IDENTICAL_PER_SLOT
        : x.kind === 'stack' && x.stackKey === p.stackKey && x.qty + p.qty <= stackCapOf(p.stackKey ?? ''));
      const cell = join ? join.cell : Board.of(view).spot(1, 1);
      if (cell < 0) continue;
      const before = this.ledger;
      if (this.moveCore(ref, { container: c, cell }, grid) === 'ok') return true;
      this.ledger = before;
    }
    return false;
  }

  /** The manual Sort (type, rarity, name) of one grid; a Vault tab only at a Vault. Nothing sorts by itself. */
  sortGrid(container: ContainerId): GridMoveResult {
    if (!this.isBrowser) return 'gone';
    if (container !== 'b' && !this.atVault) return 'vault-closed';
    const previous = this.ledger;
    this.ledger = sortContainer(this.ledger, container, this.deviceId, Date.now());
    if (this.ledger === previous) return 'ok';
    if (!this.save()) { this.ledger = previous; return 'persist'; }
    this.publish();
    return 'ok';
  }

  private setStackPos(storeKey: string, container: ContainerId, cells: number[]): void {
    const row = this.ledger.records.find((r): r is OwnedItemStack => r.kind === 'stack' && r.stackKey === storeKey && r.source === 'inventory');
    if (!row) return;
    const pos: GridPos = { k: container, c: cells, r: this.advanceRevision().revision };
    this.ledger = { ...this.ledger, records: this.ledger.records.map(r => (r === row ? { ...row, pos } : r)) };
  }

  /** Spend one charge of a Spellstone (shared/spellstones); the stone is gone at 0. */
  spendCharge(itemId: string): boolean {
    if (!this.isBrowser) return false;
    const row = this.instanceRow(itemId);
    if (!row || !((row.charges ?? 0) > 0)) return false;
    const previous = this.ledger;
    const left = (row.charges ?? 1) - 1;
    if (left <= 0) {
      const gone = this.advanceRevision(row.revision);
      this.ledger = tombstoneRecord(this.ledger, itemId, gone.revision, Date.now());
    } else {
      const per = row.charges ? row.sellValue / row.charges : 0;
      this.ledger = upsertRecord(this.ledger, this.withRevision({ ...row, charges: left, sellValue: Math.floor(per * left) }));
    }
    if (!this.save()) { this.ledger = previous; return false; }
    this.publish();
    return true;
  }

  /**
   * Land items a migration mints (the Spellstone pouch → satchel, skill-book.md §6.3), in ONE write. Each keeps the id
   * the migration derived; one already here, or already gone (tombstoned), is skipped, so a second device running the
   * same migration adds nothing. Revisions sit at the old save's time (never above a later edit). Placed in the
   * satchel; what does not fit goes to the Vault (the migration rule, once), Overflow last. False on a failed save.
   */
  addMigrated(items: readonly GameItem[], at: number): boolean {
    if (!this.isBrowser) return false;
    const previous = this.ledger;
    const hlc = Math.max(1, Math.floor(at) || 0, (this.ledger.tombFloor ?? 0) + 1);
    let grid = gridLayout(this.ledger);
    let added = 0;
    for (const item of items) {
      if (this.ledger.records.some(r => r.id === item.id) || this.ledger.tombstones.some(t => t.id === item.id)) continue;
      const revision = { hlc, deviceId: 'migrate', sequence: 1 };
      let row: OwnedItemInstance = { ...itemToRecord({ ...item, equipped: false, explorerId: undefined }), revision };
      const fp = footprintOf(item), pk = pileKeyOfRecord(row);
      const bagLand = landingFor(grid.bag, fp, pk);
      if (bagLand) row = { ...row, pos: { k: 'b', c: [bagLand.cell], r: revision } };
      else {
        const tab = GRID_TABS.find(t => this.capacity().tabs.has(t) && landingFor(grid.tabs[t], fp, pk));
        const land = tab ? landingFor(grid.tabs[tab], fp, pk) : null;
        row = { ...row, location: { kind: 'explorer', explorerId: vaultHolder(tab ?? 'overflow') }, ...(tab && land ? { pos: { k: tab, c: [land.cell], r: revision } } : {}) };
      }
      this.ledger = upsertRecord(this.ledger, row);
      grid = gridLayout(this.ledger);
      added++;
    }
    if (!added) return true;
    if (!this.save()) { this.ledger = previous; return false; }
    this.publish();
    return true;
  }

  /** The grid a container shows (the satchel, or a Vault tab). */
  gridOf(container: ContainerId): GridView { return container === 'b' ? this.snapshot.grid.bag : this.snapshot.grid.tabs[container]; }

  /** Take a worn piece off into a chosen satchel cell (a drag from the doll). */
  unequipTo(itemId: string, cell: number): GridMoveResult {
    const item = this.itemById(itemId);
    if (!item?.equipped) return 'gone';
    const fp = footprintOf(item);
    const row = this.instanceRow(itemId);
    if (!row || !dropFits(this.snapshot.grid.bag, { key: 'drag', kind: 'instance', w: fp.w, h: fp.h, pileKey: null, qty: 1 }, cell)) return 'blocked';
    return this.unequip(itemId, cell) ? 'ok' : 'blocked';
  }

  /** Count of a material stack derived from grant/consume ops. */
  stackOf(stackKey: string): number {
    return stackQuantityOf(this.ledger, stackKey);
  }

  /**
   * Always true: a stack grant never refuses for space (inventory spec §2.6).
   * Where the stack *shows* is the grid's (inventory-grid.ts); benches read the satchel's key.
   * Kept as a method so the callers' "save failed vs full" branches still read.
   */
  canAcceptStackGrant(_stackKey: string): boolean {
    return true;
  }

  /** C7 grant adapter. Same grant id is a no-op. Refuses only on a failed save. */
  grantStack(grantId: string, stackKey: string, quantity: number): boolean {
    if (!this.isBrowser || !grantId || !stackKey || quantity <= 0) return false;
    if (ledgerKnowsOp(this.ledger, grantId)) return true;

    const stepped = this.advanceRevision();
    const previous = this.ledger;
    let records = this.ledger.records;
    if (!records.some(row => row.kind === 'stack' && row.stackKey === stackKey && row.source === 'inventory')) {
      const row: OwnedItemStack = {
        id: `stack:${stackKey}`,
        definitionId: stackKey,
        kind: 'stack',
        category: 'materials',
        tags: ['material', stackKey],
        soulbound: false,
        acquiredAt: new Date().toISOString(),
        revision: stepped.revision,
        source: 'inventory',
        stackKey,
        location: { kind: 'bag' },
      };
      records = [...records, row];
    }
    this.ledger = {
      ...this.ledger,
      records,
      stackOps: applyStackOp(this.ledger.stackOps, {
        id: grantId,
        stackKey,
        kind: 'grant',
        quantity,
        hlc: stepped.revision.hlc,
        deviceId: stepped.revision.deviceId,
        sequence: stepped.revision.sequence,
      }),
    };
    if (!this.save()) {
      this.ledger = previous;
      return false;
    }
    this.publish();
    this.stackGranted$$.next({ stackKey, quantity });
    return true;
  }

  missingCraftInputs(recipeId = BASALT_EDGE_RECIPE_ID): { id: string; need: number; have: number }[] {
    const recipe = forgeRecipeById(recipeId);
    if (!recipe) return [{ id: recipeId, need: 1, have: 0 }];
    return recipe.inputs
      .map(input => ({
        id: input.id,
        need: input.quantity,
        have: this.stackOf(input.id),
      }))
      .filter(row => row.have < row.need);
  }

  /** Instance records the save can still take before the record budget (spec §2.8). */
  instanceRoom(): number {
    return Math.max(0, INSTANCE_RECORD_BUDGET - instanceRecordCount(this.ledger));
  }

  /**
   * False only at the record budget. Gold purchases ask this *before* the
   * spend; it is not a satchel check — a full satchel routes to the Vault.
   */
  canAcceptInstance(): boolean {
    return this.instanceRoom() > 0;
  }

  hasBasaltEdge(): boolean {
    return this.items.some(item => isBasaltEdge(item));
  }

  /**
   * C9 first craft. Same mutation id returns the stored weapon.
   * Consume + mint are one ledger write. A failed persist rolls back both.
   */
  craftBasaltEdge(mutationId: string, now = Date.now()):
    | { ok: true; item: GameItem; replayed: boolean }
    | { ok: false; code: 'ssr' | 'clock' | 'missing' | 'capacity' | 'persist' } {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };
    if (!mutationId || !Number.isFinite(now)) return { ok: false, code: 'clock' };

    const itemId = basaltEdgeItemId(mutationId);
    const existing = this.itemById(itemId);
    if (existing) return { ok: true, item: existing, replayed: true };

    if (this.missingCraftInputs().length) return { ok: false, code: 'missing' };
    if (!this.canAcceptInstance()) return { ok: false, code: 'capacity' };

    const previous = this.ledger;
    const foundAt = new Date(now).toISOString();
    const item = mintBasaltEdge(itemId, foundAt);
    const consumes: Array<{ id: string; stackKey: string; quantity: number }> = [
      { id: `${mutationId}:cinder`, stackKey: CINDER_ORE_ID, quantity: 6 },
      { id: `${mutationId}:ember`, stackKey: EMBER_RESIDUE_ID, quantity: 1 },
    ];

    let stackOps = this.ledger.stackOps;
    for (const consume of consumes) {
      const stepped = this.advanceRevision();
      stackOps = applyStackOp(stackOps, {
        id: consume.id,
        stackKey: consume.stackKey,
        kind: 'consume',
        quantity: consume.quantity,
        hlc: stepped.revision.hlc,
        deviceId: stepped.revision.deviceId,
        sequence: stepped.revision.sequence,
      });
    }
    this.ledger = { ...this.ledger, stackOps };
    this.ledger = upsertRecord(this.ledger, this.placedArrival(this.withRevision(itemToRecord(item))));
    if (this.stackOf(CINDER_ORE_ID) < 0 || this.stackOf(EMBER_RESIDUE_ID) < 0) {
      this.ledger = previous;
      return { ok: false, code: 'missing' };
    }
    if (!this.save()) {
      this.ledger = previous;
      return { ok: false, code: 'persist' };
    }
    this.publish();
    this.acquired$$.next(item);
    return { ok: true, item, replayed: false };
  }

  /**
   * The general craft: consume several material stacks, mint several items.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * WHY THIS IS NOT `craftBasaltEdge` GENERALISED IN PLACE
   * ───────────────────────────────────────────────────────────────────────────
   * The first craft above is a progression beat: one fixed recipe, one fixed
   * mint, and a caller that also has to flip an activity flag. This is a bench
   * that has to run fifty of them, and the two differ in exactly the places
   * that matter — an arbitrary number of inputs, an arbitrary number of
   * outputs, and a mint the caller supplies because only the caller knows the
   * roll grade a mastered recipe is owed. Rewriting the tutorial to be a
   * special case of the bench would have put the C9 spec's guarantees behind a
   * generic path on the day the bench shipped.
   *
   * What the two DO share is the invariant, and it is the one worth stating:
   * **consume and mint are one ledger write.** Every stack op and every minted
   * record is staged in memory, the stack totals are re-read to prove nothing
   * went negative, and only then is `save()` called. A failed persist restores
   * the previous ledger wholesale, so there is no state where the materials are
   * gone and the item never arrived.
   *
   * Idempotent on `mutationId`: every op id and every minted item id is derived
   * from it, so a retry after a persist failure — or a double-click that beat
   * change detection — returns the stored items rather than crafting twice.
   *
   * Gold is NOT touched here. The bag does not own the till; see
   * `CraftingGateway`, which is the only caller and settles both.
   */
  craftRecipe(
    mutationId: string,
    inputs: readonly { id: string; count: number }[],
    mint: (itemId: string, index: number, foundAt: string) => GameItem | null,
    outputCount = 1,
    now = Date.now(),
  ):
    | { ok: true; items: GameItem[]; replayed: boolean }
    | { ok: false; code: 'ssr' | 'clock' | 'missing' | 'capacity' | 'persist' | 'mint' } {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };
    if (!mutationId || !Number.isFinite(now)) return { ok: false, code: 'clock' };
    if (!inputs.length || outputCount < 1) return { ok: false, code: 'clock' };

    const itemIds = Array.from({ length: outputCount }, (_, i) => craftedItemId(mutationId, i));
    const stored = itemIds.map(id => this.itemById(id)).filter((row): row is GameItem => !!row);
    if (stored.length === outputCount) return { ok: true, items: stored, replayed: true };
    // A partial replay is not a state this can produce — the mint is one write —
    // so it is a corrupt or hand-edited ledger. Refusing is the honest answer;
    // crafting the remainder would consume a second set of materials for it.
    if (stored.length) return { ok: false, code: 'persist' };

    for (const input of inputs) {
      if (this.stackOf(input.id) < input.count) return { ok: false, code: 'missing' };
    }
    if (this.instanceRoom() < outputCount) return { ok: false, code: 'capacity' };

    const previous = this.ledger;
    const foundAt = new Date(now).toISOString();
    const minted: GameItem[] = [];
    for (let i = 0; i < outputCount; i++) {
      const item = mint(itemIds[i], i, foundAt);
      if (!item) return { ok: false, code: 'mint' };
      minted.push(item);
    }

    let stackOps = this.ledger.stackOps;
    for (const input of inputs) {
      const stepped = this.advanceRevision();
      stackOps = applyStackOp(stackOps, {
        id: `${mutationId}:in:${input.id}`,
        stackKey: input.id,
        kind: 'consume',
        quantity: input.count,
        hlc: stepped.revision.hlc,
        deviceId: stepped.revision.deviceId,
        sequence: stepped.revision.sequence,
      });
    }
    this.ledger = { ...this.ledger, stackOps };
    for (const item of minted) {
      this.ledger = upsertRecord(this.ledger, this.placedArrival(this.withRevision(itemToRecord(item))));
    }
    // Re-read rather than trust the pre-flight: two ingredients that resolve to
    // the same stack key, or an op the ledger already carried, would both pass
    // the loop above and still overdraw.
    for (const input of inputs) {
      if (this.stackOf(input.id) < 0) {
        this.ledger = previous;
        return { ok: false, code: 'missing' };
      }
    }
    if (!this.save()) {
      this.ledger = previous;
      return { ok: false, code: 'persist' };
    }
    this.publish();
    for (const item of minted) this.acquired$$.next(item);
    return { ok: true, items: minted, replayed: false };
  }

  /**
   * The items a settled craft minted, or null if this mutation never landed.
   *
   * Exists so a caller can answer "has this already happened?" *before* it runs
   * its own pre-flight. Without it the replay path is unreachable: the second
   * call sees the materials the first call consumed, decides the bag is short,
   * and refuses the craft it is holding in its hand.
   *
   * Null on a partial — a craft mints all its outputs in one write, so half of
   * them is a corrupt ledger and not a replay. `craftRecipe` refuses that case
   * outright rather than topping it up.
   */
  craftedFor(mutationId: string, outputCount = 1): GameItem[] | null {
    if (!mutationId || outputCount < 1) return null;
    const items: GameItem[] = [];
    for (let i = 0; i < outputCount; i++) {
      const item = this.itemById(craftedItemId(mutationId, i));
      if (!item) return null;
      items.push(item);
    }
    return items;
  }

  /**
   * A craft whose output is a stack (a Delve torch, a ladder): consume the
   * inputs and grant `quantity` of `stackKey` in ONE ledger write, the same
   * invariant as `craftRecipe`. Idempotent on `mutationId` (every op id is
   * derived from it); `stackCraftedFor` answers "already settled?" before a
   * caller's own pre-flight, for the same reason `craftedFor` exists.
   */
  craftStack(
    mutationId: string,
    inputs: readonly { id: string; count: number }[],
    stackKey: string,
    quantity: number,
  ):
    | { ok: true; replayed: boolean }
    | { ok: false; code: 'ssr' | 'clock' | 'missing' | 'capacity' | 'persist' } {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };
    if (!mutationId || !inputs.length || !stackKey || quantity < 1) return { ok: false, code: 'clock' };
    if (this.stackCraftedFor(mutationId)) return { ok: true, replayed: true };
    for (const input of inputs) {
      if (input.count <= 0) return { ok: false, code: 'clock' };
      if (this.stackOf(input.id) < input.count) return { ok: false, code: 'missing' };
    }
    if (!this.canAcceptStackGrant(stackKey)) return { ok: false, code: 'capacity' };

    const previous = this.ledger;
    let stackOps = this.ledger.stackOps;
    for (const input of inputs) {
      const stepped = this.advanceRevision();
      stackOps = applyStackOp(stackOps, {
        id: `${mutationId}:in:${input.id}`, stackKey: input.id, kind: 'consume', quantity: input.count,
        hlc: stepped.revision.hlc, deviceId: stepped.revision.deviceId, sequence: stepped.revision.sequence,
      });
    }
    const stepped = this.advanceRevision();
    stackOps = applyStackOp(stackOps, {
      id: `${mutationId}:out`, stackKey, kind: 'grant', quantity,
      hlc: stepped.revision.hlc, deviceId: stepped.revision.deviceId, sequence: stepped.revision.sequence,
    });
    let records = this.ledger.records;
    if (!records.some(row => row.kind === 'stack' && row.stackKey === stackKey && row.source === 'inventory')) {
      const row: OwnedItemStack = {
        id: `stack:${stackKey}`, definitionId: stackKey, kind: 'stack', category: 'materials', tags: ['material', stackKey],
        soulbound: false, acquiredAt: new Date().toISOString(), revision: stepped.revision, source: 'inventory', stackKey,
        location: { kind: 'bag' },
      };
      records = [...records, row];
    }
    this.ledger = { ...this.ledger, records, stackOps };
    for (const input of inputs) {
      if (this.stackOf(input.id) < 0) {
        this.ledger = previous;
        return { ok: false, code: 'missing' };
      }
    }
    if (!this.save()) {
      this.ledger = previous;
      return { ok: false, code: 'persist' };
    }
    this.publish();
    this.stackGranted$$.next({ stackKey, quantity });
    return { ok: true, replayed: false };
  }

  /** True when a stack op with this id is in the (uncompacted) log. */
  hasStackOp(opId: string): boolean {
    return ledgerKnowsOp(this.ledger, opId);
  }

  /** True when a `craftStack` under this mutation id has already landed. */
  stackCraftedFor(mutationId: string): boolean {
    const id = `${mutationId}:out`;
    return !!mutationId && ledgerKnowsOp(this.ledger, id);
  }

  /** What a recipe is still short of, for the bench's ingredient slots. */
  missingInputs(
    inputs: readonly { id: string; count: number }[],
  ): { id: string; need: number; have: number }[] {
    return inputs
      .map(input => ({ id: input.id, need: input.count, have: this.stackOf(input.id) }))
      .filter(row => row.have < row.need);
  }

  /**
   * Consume materials and mint nothing.
   *
   * `craftRecipe` is the same write with an item on the end of it, and it
   * refuses a zero-output call for good reason — a craft that produces nothing
   * is a bug in a recipe. An infusion genuinely produces nothing an inventory
   * can hold: what it produces is a timer, and the timer lives in a different
   * ledger. So it gets its own writer rather than a `mint` callback that
   * returns null.
   *
   * Replay-safe on `mutationId`: the ops are keyed by it and `applyStackOp`
   * drops a duplicate id, so a double-click or a retried call after a dropped
   * response consumes exactly one set. `replayed` tells the caller which
   * happened so it does not start a second timer.
   */
  consumeStacks(
    mutationId: string,
    inputs: readonly { id: string; count: number }[],
  ):
    | { ok: true; replayed: boolean }
    | { ok: false; code: 'ssr' | 'clock' | 'missing' | 'persist' } {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };
    if (!mutationId || !inputs.length) return { ok: false, code: 'clock' };

    const opIds = inputs.map(input => `${mutationId}:in:${input.id}`);
    if (opIds.every(id => ledgerKnowsOp(this.ledger, id))) {
      return { ok: true, replayed: true };
    }
    for (const input of inputs) {
      if (input.count <= 0) return { ok: false, code: 'clock' };
      if (this.stackOf(input.id) < input.count) return { ok: false, code: 'missing' };
    }

    const previous = this.ledger;
    let stackOps = this.ledger.stackOps;
    inputs.forEach((input, i) => {
      const stepped = this.advanceRevision();
      stackOps = applyStackOp(stackOps, {
        id: opIds[i],
        stackKey: input.id,
        kind: 'consume',
        quantity: input.count,
        hlc: stepped.revision.hlc,
        deviceId: stepped.revision.deviceId,
        sequence: stepped.revision.sequence,
      });
    });
    this.ledger = { ...this.ledger, stackOps };

    // Re-read rather than trust the pre-flight — two inputs resolving to the
    // same stack key would both have passed the loop above and still overdraw.
    for (const input of inputs) {
      if (this.stackOf(input.id) < 0) {
        this.ledger = previous;
        return { ok: false, code: 'missing' };
      }
    }
    if (!this.save()) {
      this.ledger = previous;
      return { ok: false, code: 'persist' };
    }
    this.publish();
    return { ok: true, replayed: false };
  }

  /**
   * Rewrite one instance's socket contents.
   *
   * The sole writer of `GameItem.sockets`. It takes the whole array rather than
   * a (well, rune) pair because socketing and unsocketing are the same write
   * from the ledger's side, and because a partial write is the one thing a
   * Socket Word cannot survive: the word is matched on the ordered contents of
   * every well, so two writes that each land half of a change would seat a word
   * nobody assembled.
   *
   * It does not touch the rune ledger or the Gold — `EnchantingGateway` owns
   * that ordering, the same way `CraftingGateway` owns the bench's.
   */
  setSockets(itemId: string, sockets: readonly (string | null)[]):
    | { ok: true; item: GameItem }
    | { ok: false; code: 'ssr' | 'missing' | 'persist' } {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };
    const item = this.itemById(itemId);
    if (!item) return { ok: false, code: 'missing' };

    const previous = this.ledger;
    const next: GameItem = { ...item, sockets: [...sockets] };
    this.ledger = upsertRecord(this.ledger, this.withRevision(itemToRecord(next)));
    if (!this.save()) {
      this.ledger = previous;
      return { ok: false, code: 'persist' };
    }
    this.publish();
    const stored = this.itemById(itemId) ?? next;
    // Same channel a temper reports on: the loadout panel and the achievement
    // watchers both listen for "this item changed" and neither cares how.
    this.improved$$.next(stored);
    return { ok: true, item: stored };
  }

  /**
   * Set one rune from the satchel into the item's next empty well (D2: left to right; runes never come out). ONE
   * ledger write: the rune's consume op (`sock:<item>:<well>:<rune>`, idempotent) and the record's new wells, so a
   * failed save leaves both untouched and a replay is a no-op. Only a satchel item (not worn, not in the Vault) takes
   * a rune; where it may happen (an Enchanting Table) is the caller's (socketing.ts).
   */
  socketRune(itemId: string, runeStack: string, runeId: string):
    | { ok: true; item: GameItem; well: number; replayed: boolean }
    | { ok: false; code: 'ssr' | 'missing' | 'no-sockets' | 'full' | 'worn' | 'no-rune' | 'persist' } {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };
    const item = this.itemById(itemId);
    if (!item) return { ok: false, code: 'missing' };
    if (item.equipped || item.explorerId) return { ok: false, code: 'worn' };
    const wells = socketsOf(item);
    if (!wells.length) return { ok: false, code: 'no-sockets' };
    const well = wells.indexOf(null);
    if (well < 0) return { ok: false, code: 'full' };
    const opId = socketOpId(itemId, well, runeId);
    if (ledgerKnowsOp(this.ledger, opId)) return { ok: true, item, well, replayed: true };
    if (this.stackOf(runeStack) < 1) return { ok: false, code: 'no-rune' };
    const previous = this.ledger;
    const stepped = this.advanceRevision();
    wells[well] = runeId;
    const next: GameItem = { ...item, sockets: wells };
    this.ledger = {
      ...upsertRecord(this.ledger, this.withRevision(itemToRecord(next))),
    };
    this.ledger = {
      ...this.ledger,
      stackOps: applyStackOp(this.ledger.stackOps, {
        id: opId, stackKey: runeStack, kind: 'consume', quantity: 1,
        hlc: stepped.revision.hlc, deviceId: stepped.revision.deviceId, sequence: stepped.revision.sequence,
      }),
    };
    if (this.stackOf(runeStack) < 0 || !this.save()) {
      this.ledger = previous;
      return { ok: false, code: this.stackOf(runeStack) < 0 ? 'no-rune' : 'persist' };
    }
    this.publish();
    const stored = this.itemById(itemId) ?? next;
    this.improved$$.next(stored);
    return { ok: true, item: stored, well, replayed: false };
  }

  /**
   * Rewrite one instance's grave-good marks (shared/grave-goods): a curse laid to rest, a whisper's kills, a whisper
   * silenced. The sole writer of `GameItem.curse` / `GameItem.whisper` after the mint. `null` removes the field.
   * Gold is the caller's (GraveGoodsService spends it first, in the same tick).
   */
  setGrave(itemId: string, patch: { curse?: GameItem['curse'] | null; whisper?: GameItem['whisper'] | null }):
    | { ok: true; item: GameItem }
    | { ok: false; code: 'ssr' | 'missing' | 'persist' } {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };
    const item = this.itemById(itemId);
    if (!item) return { ok: false, code: 'missing' };
    const next: GameItem = { ...item };
    if (patch.curse !== undefined) { if (patch.curse) next.curse = { ...patch.curse }; else delete next.curse; }
    if (patch.whisper !== undefined) { if (patch.whisper) next.whisper = { ...patch.whisper }; else delete next.whisper; }
    const previous = this.ledger;
    this.ledger = upsertRecord(this.ledger, this.withRevision(itemToRecord(next)));
    if (!this.save()) {
      this.ledger = previous;
      return { ok: false, code: 'persist' };
    }
    this.publish();
    return { ok: true, item: this.itemById(itemId) ?? next };
  }

  /**
   * C1 Refining: three of one ore tier become one of the next (see
   * refine-ops.ts for the ladder). Same mutation id returns the stored result
   * without applying twice. Consume + grant are ONE ledger write; a failed
   * persist rolls back both, and the target row is never created without the
   * source being consumed in the same save.
   *
   * A pure inventory transform: no XP, no activity-ledger op, no discovery,
   * no level gate. This is the sole writer path for it — nothing else appends
   * refine ops.
   */
  refineStack(mutationId: string, fromOreId: string, batches = 1):
    | { ok: true; from: string; to: string; consumed: number; produced: number; replayed: boolean }
    | { ok: false; code: 'ssr' | 'no-recipe' | 'insufficient' | 'capacity' | 'persist' | 'bad-batches' } {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };
    // An empty mutation id would make every refine share the same op ids and
    // dedupe into one; refuse it as a malformed request rather than apply it.
    if (!mutationId) return { ok: false, code: 'bad-batches' };

    const recipe = refineRecipeFor(fromOreId);
    if (!recipe) return { ok: false, code: 'no-recipe' };

    const ids = refineOpIds(mutationId);
    const stored = this.ledger.stackOps.find(op => op.id === ids.grant);
    if (stored || ledgerKnowsOp(this.ledger, ids.grant)) {
      // Folded ops keep only their id: a replay of one reports the request's own size.
      const produced = stored?.quantity ?? Math.max(0, Math.floor(batches));
      const consumedOp = this.ledger.stackOps.find(op => op.id === ids.consume);
      return {
        ok: true,
        from: recipe.from,
        to: recipe.to,
        consumed: consumedOp?.quantity ?? produced * recipe.ratio,
        produced,
        replayed: true,
      };
    }

    // Every check runs before the ledger is touched.
    const preview = refinePreview({ fromOreId, have: this.stackOf(fromOreId), batches });
    if (!preview.ok) {
      return { ok: false, code: preview.reason ?? 'bad-batches' };
    }
    if (!this.canAcceptStackGrant(recipe.to)) return { ok: false, code: 'capacity' };

    const previous = this.ledger;
    let stackOps = this.ledger.stackOps;
    let records = this.ledger.records;

    const consumed = this.advanceRevision();
    stackOps = applyStackOp(stackOps, {
      id: ids.consume,
      stackKey: recipe.from,
      kind: 'consume',
      quantity: preview.consume,
      hlc: consumed.revision.hlc,
      deviceId: consumed.revision.deviceId,
      sequence: consumed.revision.sequence,
    });

    const granted = this.advanceRevision();
    if (!records.some(row => row.kind === 'stack' && row.stackKey === recipe.to && row.source === 'inventory')) {
      const row: OwnedItemStack = {
        id: `stack:${recipe.to}`,
        definitionId: recipe.to,
        kind: 'stack',
        category: 'materials',
        tags: ['material', recipe.to],
        soulbound: false,
        acquiredAt: new Date().toISOString(),
        revision: granted.revision,
        source: 'inventory',
        stackKey: recipe.to,
        location: { kind: 'bag' },
      };
      records = [...records, row];
    }
    stackOps = applyStackOp(stackOps, {
      id: ids.grant,
      stackKey: recipe.to,
      kind: 'grant',
      quantity: preview.produce,
      hlc: granted.revision.hlc,
      deviceId: granted.revision.deviceId,
      sequence: granted.revision.sequence,
    });

    this.ledger = { ...this.ledger, records, stackOps };
    if (!this.save()) {
      this.ledger = previous;
      return { ok: false, code: 'persist' };
    }
    this.publish();
    return {
      ok: true,
      from: recipe.from,
      to: recipe.to,
      consumed: preview.consume,
      produced: preview.produce,
      replayed: false,
    };
  }

  /** Cost and chance of the next temper, with the wearer's worn ward applied. */
  previewUpgrade(item: GameItem): UpgradePreview | null {
    return previewUpgrade(item, this.equippedTotals.ward);
  }

  canUpgrade(item: GameItem): boolean {
    const preview = previewUpgrade(item);
    if (!preview) return false;
    if (this.economy.snapshot.gold < preview.gold) return false;
    return preview.materials.every(mat => this.stackOf(mat.id) >= mat.quantity);
  }

  /**
   * Temper one instance. Same mutation id replays the stored result.
   * Gold and materials are spent even on a fail. Inventory writes first;
   * a missed Gold debit rolls the ledger back.
   */
  upgrade(
    itemId: string,
    mutationId: string,
    now = Date.now(),
    rng: () => number = Math.random,
  ):
    | { ok: true; item: GameItem; replayed: boolean; leveled: boolean }
    | { ok: false; code: 'ssr' | 'clock' | 'missing' | 'max' | 'kind' | 'funds' | 'mats' | 'persist' } {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };
    if (!itemId || !mutationId || !Number.isFinite(now)) return { ok: false, code: 'clock' };

    const item = this.itemById(itemId);
    if (!item) return { ok: false, code: 'missing' };
    if (item.lastUpgradeMutationId === mutationId) {
      return { ok: true, item, replayed: true, leveled: item.lastUpgradeOk === true };
    }
    if (!isTemperableKind(item)) return { ok: false, code: 'kind' };

    const level = upgradeLevelOf(item);
    const preview = previewUpgrade(item, this.equippedTotals.ward);
    if (!preview || level >= preview.maxLevel) return { ok: false, code: 'max' };
    if (this.economy.snapshot.gold < preview.gold) return { ok: false, code: 'funds' };
    if (preview.materials.some(mat => this.stackOf(mat.id) < mat.quantity)) {
      return { ok: false, code: 'mats' };
    }

    const previous = this.ledger;
    const foundAt = new Date(now).toISOString();
    let stackOps = this.ledger.stackOps;
    for (const mat of preview.materials) {
      const stepped = this.advanceRevision();
      stackOps = applyStackOp(stackOps, {
        id: `${mutationId}:${mat.id}`,
        stackKey: mat.id,
        kind: 'consume',
        quantity: mat.quantity,
        hlc: stepped.revision.hlc,
        deviceId: stepped.revision.deviceId,
        sequence: stepped.revision.sequence,
      });
    }

    const def = definitionFor(item);
    // Worn ward turns part of the fail chance aside — see item-upgrade.ts.
    // Read live, same as the preview above, so what the panel printed is what
    // the roll uses.
    const success = rollUpgradeSuccess(level, rng, def, this.equippedTotals.ward);
    let nextItem: GameItem = {
      ...item,
      lastUpgradeAt: foundAt,
      lastUpgradeMutationId: mutationId,
      lastUpgradeOk: success,
    };
    if (success) {
      nextItem = {
        ...nextItem,
        upgradeLevel: level + 1,
        stats: applyTemperBonus(item, rng),
      };
    } else if (preview.policy.downgradeOnFail && level > 0) {
      nextItem = {
        ...nextItem,
        upgradeLevel: level - 1,
      };
    }

    this.ledger = { ...this.ledger, stackOps };
    if (preview.materials.some(mat => this.stackOf(mat.id) < 0)) {
      this.ledger = previous;
      return { ok: false, code: 'mats' };
    }

    if (!success && preview.policy.shatterOnFail) {
      const row = this.ledger.records.find(entry => entry.id === itemId);
      const gone = this.advanceRevision(row?.revision);
      this.ledger = tombstoneRecord(this.ledger, itemId, gone.revision, now);
    } else {
      this.ledger = upsertRecord(this.ledger, this.withRevision(itemToRecord(nextItem)));
    }

    if (!this.save()) {
      this.ledger = previous;
      return { ok: false, code: 'persist' };
    }
    if (!this.economy.spendGold(preview.gold, 'temper')) {
      this.ledger = previous;
      this.save();
      this.publish();
      return { ok: false, code: 'funds' };
    }
    this.publish();
    const stored = this.itemById(itemId);
    if (!success && preview.policy.shatterOnFail) {
      return { ok: true, item: nextItem, replayed: false, leveled: false };
    }
    const settled = stored ?? nextItem;
    // Every completed temper, win or lose: the Gold and the materials were
    // spent either way, and a challenge that only counted the successes would
    // stall on a run of bad rolls the player had no control over.
    this.improved$$.next(settled);
    return { ok: true, item: settled, replayed: false, leveled: success };
  }

  /** Spec name. Same writer as `upgrade`. */
  temper(
    itemId: string,
    mutationId: string,
    now = Date.now(),
    rng: () => number = Math.random,
  ): ReturnType<InventoryService['upgrade']> {
    return this.upgrade(itemId, mutationId, now, rng);
  }

  // ── Reforge: the stat reroll (item-reforge.ts) ─────────────────────────────

  /** What a reroll of this instance would cost, and which stats it would move. */
  previewReforge(item: GameItem): ReforgePreview | null {
    return previewReforge(item);
  }

  /** Can this item be rerolled, and can the Keeper afford it right now? */
  canReforge(item: GameItem, lockedKey: ItemStatKey | null = null): boolean {
    if (!canReforgeItem(item)) return false;
    return this.economy.snapshot.gold >= reforgeGoldCost(item.rarity, !!lockedKey);
  }

  /**
   * Reroll every stat on one instance. Same mutation id replays the stored
   * result — the Inspect panel keeps its id across a persist retry so a failed
   * save cannot be turned into a second free roll.
   *
   * Gold only: unlike temper, no materials are consumed, so there is no stack
   * ledger to unwind. Inventory writes first and a missed Gold debit rolls the
   * whole record back, exactly as `upgrade` does — a reroll that the player was
   * not charged for must not be allowed to stand, or the sink leaks.
   *
   * There is no fail roll. A reforge always resolves; the risk is the roll
   * itself, not a chance of nothing happening.
   */
  reforge(
    itemId: string,
    mutationId: string,
    lockedKey: ItemStatKey | null = null,
    now = Date.now(),
    rng: () => number = Math.random,
  ):
    | { ok: true; item: GameItem; replayed: boolean; lockedKey: ItemStatKey | null }
    | { ok: false; code: 'ssr' | 'clock' | 'missing' | 'kind' | 'funds' | 'persist' } {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };
    if (!itemId || !mutationId || !Number.isFinite(now)) return { ok: false, code: 'clock' };

    const item = this.itemById(itemId);
    if (!item) return { ok: false, code: 'missing' };
    if (item.lastReforgeMutationId === mutationId) {
      return { ok: true, item, replayed: true, lockedKey: item.lastReforgeLock ?? null };
    }
    if (!canReforgeItem(item)) return { ok: false, code: 'kind' };

    // A lock the item does not actually roll is treated as no lock rather than
    // as an error: the caller still pays the plain price, never the doubled one.
    const keys = previewReforge(item)?.keys ?? [];
    const lock = lockedKey && keys.includes(lockedKey) ? lockedKey : null;
    const cost = reforgeGoldCost(item.rarity, !!lock);
    if (this.economy.snapshot.gold < cost) return { ok: false, code: 'funds' };

    const previous = this.ledger;
    // A reroll replaces the base roll, so the grade and the till price both
    // move with it — see `rollReforgeDetailed`.
    const rerolled = rollReforgeDetailed(item, lock, rng);
    const nextItem: GameItem = {
      ...item,
      stats: rerolled.stats,
      rollQuality: rerolled.quality,
      sellValue: rerolled.sellValue,
      lastReforgeAt: new Date(now).toISOString(),
      lastReforgeMutationId: mutationId,
      lastReforgeLock: lock ?? undefined,
      reforgeCount: (item.reforgeCount ?? 0) + 1,
    };

    this.ledger = upsertRecord(this.ledger, this.withRevision(itemToRecord(nextItem)));
    if (!this.save()) {
      this.ledger = previous;
      return { ok: false, code: 'persist' };
    }
    if (!this.economy.spendGold(cost, 'reforge')) {
      this.ledger = previous;
      this.save();
      this.publish();
      return { ok: false, code: 'funds' };
    }
    this.publish();
    const stored = this.itemById(itemId);
    return { ok: true, item: stored ?? nextItem, replayed: false, lockedKey: lock };
  }

  canDrop(item: GameItem): boolean {
    return !item.equipped && !item.explorerId;
  }

  /**
   * Destroy one unequipped instance. No Gold. Frees a bag row so Mine can
   * take a new stack. Worn and explorer-held items stay put.
   */
  drop(itemId: string): boolean {
    if (!this.isBrowser) return false;
    const item = this.itemById(itemId);
    if (!item || !this.canDrop(item)) return false;

    const row = this.ledger.records.find(entry => entry.id === itemId);
    if (!row || row.kind !== 'instance') return false;
    const gone = this.advanceRevision(row.revision);
    const previous = this.ledger;
    this.ledger = tombstoneRecord(this.ledger, itemId, gone.revision, Date.now());
    if (!this.save()) {
      this.ledger = previous;
      return false;
    }
    this.publish();
    return true;
  }

  /**
   * Destroy a material stack (all of it). The empty stack row is tombstoned
   * so it stops occupying the 250-row cap.
   */
  /**
   * Destroy part or all of a material stack.
   *
   * `quantity` omitted means the whole stack. It used to be the *only*
   * behaviour — there was no quantity parameter at all, so every "Drop" on a
   * stack emptied it, and the confirm copy said "Drop all N" because that was
   * the literal truth. Dropping one ore now drops one ore.
   *
   * The stack's record is tombstoned only when the last unit goes; a partial
   * drop leaves the row in place so the count keeps rendering.
   */
  dropStack(stackKey: string, quantity?: number): boolean {
    if (!this.isBrowser || !stackKey || slotClassOf(stackKey) === 'entitlement') return false;
    const have = this.stackOf(stackKey);
    if (have <= 0) return false;

    const asked = quantity === undefined ? have : Math.floor(quantity);
    if (!Number.isFinite(asked) || asked <= 0) return false;
    const take = Math.min(have, asked);
    const emptiesStack = take >= have;

    const row = this.ledger.records.find(
      entry => entry.kind === 'stack' && entry.stackKey === stackKey && entry.source === 'inventory',
    );
    if (!row) return false;

    const stepped = this.advanceRevision(row.revision);
    const previous = this.ledger;
    const consumed = applyStackOp(this.ledger.stackOps, {
      id: `drop:${stackKey}:${stepped.revision.hlc}:${stepped.revision.sequence}`,
      stackKey,
      kind: 'consume',
      quantity: take,
      hlc: stepped.revision.hlc,
      deviceId: stepped.revision.deviceId,
      sequence: stepped.revision.sequence,
    });
    this.ledger = emptiesStack
      ? { ...tombstoneRecord(this.ledger, row.id, stepped.revision, Date.now()), stackOps: consumed }
      : { ...this.ledger, stackOps: consumed, hlc: Math.max(this.ledger.hlc, stepped.revision.hlc) };

    if (!this.save()) {
      this.ledger = previous;
      return false;
    }
    this.publish();
    return true;
  }

  /**
   * Destroy many unequipped instances and/or stacks in one write.
   * Used by Bank manage so dropping a full bag is not N localStorage hits.
   */
  dropMany(itemIds: readonly string[], stackKeys: readonly string[] = []): number {
    if (!this.isBrowser) return 0;
    const previous = this.ledger;
    let next = this.ledger;
    let count = 0;

    for (const itemId of itemIds) {
      const item = this.itemById(itemId);
      if (!item || !this.canDrop(item)) continue;
      const row = next.records.find(entry => entry.id === itemId);
      if (!row || row.kind !== 'instance') continue;
      const gone = this.advanceRevision(row.revision);
      next = tombstoneRecord(next, itemId, gone.revision, Date.now());
      count += 1;
    }

    for (const stackKey of stackKeys) {
      if (!stackKey || slotClassOf(stackKey) === 'entitlement') continue;
      const have = stackQuantityOf(next, stackKey);
      if (have <= 0) continue;
      const row = next.records.find(
        entry => entry.kind === 'stack' && entry.stackKey === stackKey && entry.source === 'inventory',
      );
      if (!row) continue;
      const stepped = this.advanceRevision(row.revision);
      next = {
        ...tombstoneRecord(next, row.id, stepped.revision, Date.now()),
        stackOps: applyStackOp(next.stackOps, {
          id: `drop:${stackKey}:${stepped.revision.hlc}:${stepped.revision.sequence}`,
          stackKey,
          kind: 'consume',
          quantity: have,
          hlc: stepped.revision.hlc,
          deviceId: stepped.revision.deviceId,
          sequence: stepped.revision.sequence,
        }),
      };
      count += 1;
    }

    if (!count) return 0;
    this.ledger = next;
    if (!this.save()) {
      this.ledger = previous;
      return 0;
    }
    this.publish();
    return count;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Equipping — the player
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Wear an item, optionally in a named slot.
   *
   * With no slot the first empty compatible one is used; with every compatible
   * slot full, the *first* compatible slot is swapped. That is deliberate:
   * click-to-equip with three full charm slots should do something, and doing
   * nothing reads as a broken button.
   *
   * An item worn by an explorer is taken off them first, so there is never a
   * moment where it is counted on both.
   */
  /**
   * The host's requirement check (item-requirements.ts): the play screen knows the Keeper's level and attributes,
   * this service does not. Set, it refuses to put on a piece the Keeper cannot wear yet; what is already worn stays.
   */
  private wearCheck: ((item: GameItem) => boolean) | null = null;
  setWearCheck(check: ((item: GameItem) => boolean) | null): void { this.wearCheck = check; }

  /**
   * Why the last `equip` was refused, when hands were the reason (item-hands.ts): `hands-full` — a two-handed weapon
   * (or an off-hand beside one) would have sent the other piece to a satchel with no room for it. Null otherwise.
   */
  equipRefusal: 'hands-full' | 'kit-hands' | null = null;

  /**
   * The hands the Keeper's class kit weapon takes while the weapon slot is empty (keeper-look vocation-look KIT_HANDS:
   * the Thornstrider's hunting bow and the Lanternwright's lamp-staff take both). The play screen hands it in, as it
   * does the requirement check. Two: the off-hand stays empty until a one-handed weapon is worn; a save wearing an
   * off-hand with an empty weapon slot is mended the moment it is set (the off-hand to the satchel, else the Vault).
   */
  private kitHands: 1 | 2 = 1;
  setKitHands(hands: 1 | 2): void {
    this.kitHands = hands === 2 ? 2 : 1;
    if (!this.isBrowser || this.kitHands !== 2) return;
    const worn = this.items.filter(i => i.equipped && !i.explorerId);
    const off = worn.find(i => i.slot === 'off-hand');
    if (!off || worn.some(i => i.slot === 'weapon')) return;
    const previous = this.ledger;
    this.ledger = this.settled(this.mapInstances(row => row.id === off.id ? this.withRevision({ ...row, location: { kind: 'bag' } }) : row));
    if (!this.save()) { this.ledger = previous; return; }
    this.publish();
  }
  /** Is the off-hand shut: a two-handed weapon worn, or nothing worn and the kit's weapon takes both hands? */
  get offHandBlocked(): boolean {
    const weapon = this.snapshot.equipped['weapon'];
    const held = weapon && !weapon.explorerId ? weapon : undefined;
    return held ? isTwoHanded(held) : this.kitHands === 2;
  }

  equip(itemId: string, slot?: SlotId): boolean {
    this.equipRefusal = null;
    if (!this.isBrowser) return false;
    const item = this.itemById(itemId);
    if (!item) return false;
    if (item.explorerId) return false;
    if (!item.equipped && this.wearCheck && !this.wearCheck(item)) return false;

    const occupied = new Set<SlotId>(
      this.items
        .filter(i => i.equipped && i.slot && i.id !== itemId)
        .map(i => i.slot!),
    );

    // Pick by `itemFitsSlot`, not the item type alone: every authored piece is
    // `type: 'artifact'`, which head accepts, so a type-only pick sent an
    // unaimed weapon to head and the definition check then refused it.
    const target = slot
      ?? SLOT_IDS.find(s => !occupied.has(s) && itemFitsSlot(s, item))
      ?? SLOT_IDS.find(s => itemFitsSlot(s, item))
      ?? null;
    if (!target || !itemFitsSlot(target, item)) return false;

    const occupant = this.items.find(row =>
      row.equipped && row.slot === target && row.id !== itemId,
    );
    // Hands (item-hands.ts): a two-handed weapon empties the off-hand; an off-hand put on beside one sends the weapon
    // back. Whatever moves goes to the satchel — never the Vault — so a full satchel refuses the swap with a reason.
    const worn: Partial<Record<string, GameItem>> = {};
    for (const row of this.items) if (row.equipped && row.slot && !row.explorerId && row.id !== itemId) worn[row.slot] = row;
    const handsOut = new Set(handsDisplaced(item, target, worn).map(row => row.id));
    // The kit's two-handed weapon (the hunting bow, the lamp-staff) holds both hands until a weapon is worn.
    if (target === 'off-hand' && !worn['weapon'] && this.kitHands === 2) {
      this.equipRefusal = 'kit-hands';
      return false;
    }
    const previous = this.ledger;
    this.ledger = this.mapInstances(row => {
      if (row.id === itemId) {
        return this.withRevision({
          ...row,
          location: { kind: 'equipped', slotId: target! },
        });
      }
      if (row.location.kind === 'equipped' && (row.location.slotId === target || handsOut.has(row.id))) {
        return this.withRevision({ ...row, location: { kind: 'bag' } });
      }
      return row;
    });
    if (occupant) {
      const kept = this.ledger.records.find(row => row.id === occupant.id);
      if (!kept || kept.kind !== 'instance' || kept.location.kind !== 'bag') {
        this.ledger = previous;
        return false;
      }
    }
    if (handsOut.size && gridLayout(this.ledger).bag.held.length > gridLayout(previous).bag.held.length) {
      this.ledger = previous;
      this.equipRefusal = 'hands-full';
      return false;
    }
    // Whatever came off lands in the satchel, where it was if it has a place, else the first free spot.
    if (!this.save()) {
      this.ledger = previous;
      return false;
    }
    this.publish();
    // After the write and the publish, so a subscriber that reads the snapshot
    // in response sees the item already worn.
    this.equipped$$.next({ ...item, equipped: true, slot: target });
    return true;
  }

  unequip(itemId: string, cell?: number): boolean {
    if (!this.isBrowser) return false;
    const item = this.itemById(itemId);
    if (!item || (!item.equipped && !item.explorerId)) return false;
    if (item.explorerId && vaultTabOf({ kind: 'explorer', explorerId: item.explorerId })) return false;

    // Taking the weapon off puts the kit's back in hand: a two-handed kit (the hunting bow) takes the off-hand too.
    const off = item.equipped && item.slot === 'weapon' && this.kitHands === 2
      ? this.items.find(i => i.equipped && i.slot === 'off-hand' && !i.explorerId) : undefined;
    const previous = this.ledger;
    this.ledger = this.mapInstances(row =>
      row.id === itemId || row.id === off?.id ? this.withRevision({ ...row, location: { kind: 'bag' } }) : row,
    );
    if (cell !== undefined) {
      const row = this.instanceRow(itemId);
      if (row) this.ledger = upsertRecord(this.ledger, { ...row, pos: { k: 'b', c: [cell], r: this.advanceRevision().revision } });
    }
    if (!this.save()) {
      this.ledger = previous;
      return false;
    }
    this.publish();
    return true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Equipping — explorers
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Give an item to an explorer.
   *
   * `capacity` is passed in rather than read, because the roster owns how many
   * slots a rarity grants and this service must not import it — the roster
   * already depends on the inventory to resolve item ids, and a dependency back
   * the other way would close the cycle.
   */
  equipOnExplorer(itemId: string, explorerId: string, capacity: number): boolean {
    if (!this.isBrowser) return false;
    const item = this.itemById(itemId);
    if (!item) return false;
    if (capacity <= 0) return false;

    const worn = this.itemsOnExplorer(explorerId).filter(i => i.id !== itemId);
    if (worn.length >= capacity) return false;

    const previous = this.ledger;
    this.ledger = this.mapInstances(row =>
      row.id === itemId
        ? this.withRevision({ ...row, location: { kind: 'explorer', explorerId } })
        : row,
    );
    if (!this.save()) {
      this.ledger = previous;
      return false;
    }
    this.publish();
    this.equipped$$.next({ ...item, explorerId });
    return true;
  }

  /** Strip an explorer's kit back into the bag. Called when one is dismissed. */
  clearExplorer(explorerId: string): void {
    if (!this.isBrowser) return;
    if (!this.items.some(i => i.explorerId === explorerId)) return;

    const previous = this.ledger;
    this.ledger = this.settled(this.mapInstances(row =>
      row.location.kind === 'explorer' && row.location.explorerId === explorerId
        ? this.withRevision({ ...row, location: { kind: 'bag' } })
        : row,
    ));
    if (!this.save()) {
      this.ledger = previous;
      return;
    }
    this.publish();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // The Vault
  // ───────────────────────────────────────────────────────────────────────────

  /** Items in the Vault, by tab. */
  vaultItems(tab: VaultTabId): GameItem[] {
    return this.items.filter(item => item.explorerId && item.explorerId === vaultHolder(tab));
  }

  private instanceRow(itemId: string): OwnedItemInstance | undefined {
    const row = this.ledger.records.find(entry => entry.id === itemId);
    return row && row.kind === 'instance' && row.source === 'inventory' ? row : undefined;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Selling
  // ───────────────────────────────────────────────────────────────────────────

  /** Rarities the UI must confirm before selling. Rare and better. */
  private static readonly CONFIRM_RARITIES = new Set<ItemRarity>([
    'rare', 'epic', 'legendary', 'mythic', 'singular',
  ]);

  /** True when this item is valuable enough to warrant an "are you sure". */
  needsConfirm(item: GameItem): boolean {
    return InventoryService.CONFIRM_RARITIES.has(item.rarity);
  }

  canSell(item: GameItem): boolean {
    return !item.soulbound && item.sellValue > 0;
  }

  /**
   * Sell one item. Returns the Gold paid, or 0 if it was refused.
   *
   * An equipped item is *not* sellable — it has to be taken off first. That is a
   * deliberate friction: the sell button sits on a grid of small cards, and
   * "sold the Legendary I was wearing" is the mis-click this prevents.
   *
   * NO PLAYER-FACING SURFACE CALLS THIS. The Sell button lived in
   * equipment-panel's bag column, which only rendered for `variant` 'full' or
   * 'bank' — and the only mount site in the app passes 'select'. So it had been
   * unreachable for as long as that was true, and the dead column has now been
   * deleted. Brief D3 asks to surface it or delete it; this is the record of the
   * third answer, which is that neither is a cleanup task's call to make:
   *
   *   · Deleting it would throw away tested economy logic — the gold ledger
   *     write, the soulbound and equipped guards, the sale-revert path — that
   *     21 assertions in inventory.service.spec.ts still cover, and that
   *     `canSell` and `sellValue` are still read by live code.
   *   · Surfacing it is a product decision about where a player sells: the
   *     Market's `sellers` are NPC vendors, not a player-sell flow, and the
   *     entity/market spec does not define one yet.
   *
   * Leave it here, tested and unwired, until the market spec says where selling
   * happens. Do not add a Sell button back without that.
   */
  sell(itemId: string): number {
    if (!this.isBrowser) return 0;
    const item = this.itemById(itemId);
    if (!item) return 0;
    if (item.equipped || item.explorerId) return 0;
    if (!this.canSell(item)) return 0;

    const gold = item.sellValue;
    const row = this.ledger.records.find(entry => entry.id === itemId);
    const gone = this.advanceRevision(row?.revision);
    const previous = this.ledger;
    this.ledger = {
      ...tombstoneRecord(this.ledger, itemId, gone.revision, Date.now()),
      goldFromSales: this.ledger.goldFromSales + gold,
      sold: this.ledger.sold + 1,
    };
    // Tombstone is on disk before Gold mints. If the cache write missed, revert
    // so a reload cannot pair minted Gold with a still-sellable item.
    if (!this.save()) {
      this.ledger = previous;
      return 0;
    }

    // The item is removed and flushed before the Gold is minted. If `earnGold`
    // threw, the alternative order would leave a sold item still in the bag,
    // sellable again — paying twice for one object.
    this.economy.earnGold(gold, 'sale');
    this.publish();
    this.sold$$.next({ item, gold });
    return gold;
  }

  /**
   * Sell a chosen set of items in one write. Returns the Gold taken.
   *
   * The bulk-sell selection the Gambler's till offers, and the reason it is not
   * a loop over `sell()`: each call flushes the ledger and mints Gold
   * separately, so a forty-item selection would be forty localStorage writes,
   * forty economy publishes and forty change-detection passes — long enough to
   * look like the tab has hung. One tombstone pass, one save, one credit.
   *
   * Anything in the list that is equipped, soulbound, worn by an explorer or
   * simply not there is skipped rather than failing the batch: the selection
   * comes from a grid the player may have been clicking while an expedition
   * settled, and losing the whole sale to one stale row is the wrong trade.
   */
  sellMany(itemIds: readonly string[]): number {
    if (!this.isBrowser || !itemIds.length) return 0;

    const wanted = new Set(itemIds);
    const doomed = this.items.filter(i =>
      wanted.has(i.id) && !i.equipped && !i.explorerId && this.canSell(i),
    );
    if (!doomed.length) return 0;

    const gold = doomed.reduce((sum, i) => sum + i.sellValue, 0);
    let next = this.ledger;
    for (const item of doomed) {
      const row = next.records.find(entry => entry.id === item.id);
      const gone = this.advanceRevision(row?.revision);
      next = tombstoneRecord(next, item.id, gone.revision, Date.now());
    }
    const previous = this.ledger;
    this.ledger = {
      ...next,
      goldFromSales: this.ledger.goldFromSales + gold,
      sold: this.ledger.sold + doomed.length,
    };
    // Same ordering as `sell()`: the tombstones are on disk before the Gold is
    // minted, so a failed write cannot pair paid Gold with a still-sellable bag.
    if (!this.save()) {
      this.ledger = previous;
      return 0;
    }
    this.economy.earnGold(gold, 'sale');
    this.publish();
    for (const item of doomed) this.sold$$.next({ item, gold: item.sellValue });
    return gold;
  }

  /**
   * Sell every unequipped item at or below a rarity. Returns the Gold taken.
   *
   * One economy call and one write rather than N of each — a bag of 200 commons
   * sold one at a time is 200 localStorage writes and 200 change-detection
   * passes, which locks the tab for long enough to look like a crash.
   */
  sellAllOfRarity(rarities: ReadonlySet<ItemRarity>): number {
    if (!this.isBrowser) return 0;

    const doomed = this.items.filter(i =>
      !i.equipped && !i.explorerId && this.canSell(i) && rarities.has(i.rarity),
    );
    if (!doomed.length) return 0;

    const gold = doomed.reduce((sum, i) => sum + i.sellValue, 0);
    let next = this.ledger;
    for (const item of doomed) {
      const row = next.records.find(entry => entry.id === item.id);
      const gone = this.advanceRevision(row?.revision);
      next = tombstoneRecord(next, item.id, gone.revision, Date.now());
    }
    const previous = this.ledger;
    this.ledger = {
      ...next,
      goldFromSales: this.ledger.goldFromSales + gold,
      sold: this.ledger.sold + doomed.length,
    };
    if (!this.save()) {
      this.ledger = previous;
      return 0;
    }
    this.economy.earnGold(gold, 'sale');
    this.publish();
    return gold;
  }

  reset(): void {
    if (!this.isBrowser) return;
    this.ledger = emptyInventoryLedger();
    this.store.remove(INVENTORY_KEY);
    this.publish();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Storage
  // ───────────────────────────────────────────────────────────────────────────

  private load(): InventoryLedger {
    try {
      const raw = this.store.readRaw(INVENTORY_KEY);
      if (!raw) return emptyInventoryLedger();
      const loaded = coerceInventoryLedger(JSON.parse(raw)) ?? emptyInventoryLedger();
      if (eraIsCurrent(this.store) && ledgerFromPriorEra(loaded.era)) {
        return emptyInventoryLedger();
      }
      return loaded.era === INVENTORY_ERA ? loaded : { ...loaded, era: INVENTORY_ERA };
    } catch {
      return emptyInventoryLedger();
    }
  }

  private save(): boolean {
    if (!this.isBrowser) return false;
    // Every piece keeps the cell it is drawn in (inventory-grid pinLoose): a drop, a move or a pickup moves nothing else.
    this.ledger = pinLoose(this.ledger, this.deviceId, Date.now());
    this.ledger = compactInventoryLedger(this.ledger, this.deviceId, Date.now());
    const raw = JSON.stringify(this.ledger);
    this.store.write(INVENTORY_KEY, this.ledger);
    return this.store.readRaw(INVENTORY_KEY) === raw;
  }

  private publish(): void {
    this.snapshot$$.next(this.snapshotOf(this.ledger));
  }

  private snapshotOf(ledger: InventoryLedger): InventorySnapshot {
    // Newest first: a drop that just landed should be the first thing in the
    // grid, not buried under three months of commons.
    const items = itemsFromLedger(ledger).sort((a, b) => b.foundAt.localeCompare(a.foundAt));

    const equipped: Partial<Record<SlotId, GameItem>> = {};
    const wornBlocks: ItemStats[] = [];
    for (const item of items) {
      if (item.equipped && item.slot) {
        equipped[item.slot] = item;
        // The worn total is what the item *pays*, not what it rolled: socketed
        // runes and a seated Socket Word are as real as the base roll and every
        // consumer downstream (the Gold rate, Magic Find, the XP multiplier)
        // reads this one number. Summing `item.stats` here would mean sockets
        // showed on the tooltip and paid nothing.
        wornBlocks.push(wornStats(item));
      }
    }

    const stacks: InventoryStackView[] = [];
    for (const row of ledger.records) {
      if (row.kind !== 'stack' || row.source !== 'inventory') continue;
      if (slotClassOf(row.stackKey) === 'entitlement') continue;
      const quantity = stackQuantityOf(ledger, row.stackKey);
      if (quantity <= 0) continue;
      stacks.push({ id: row.id, stackKey: row.stackKey, quantity });
    }
    stacks.sort((a, b) => a.stackKey.localeCompare(b.stackKey));

    const capacity = this.capacityFor(ledger);
    const grid = gridLayout(ledger, capacity);
    const vaultStacks: InventoryStackView[] = [];
    const bagStacks = stacks.filter(row => {
      const v = parseVaultStackKey(row.stackKey);
      if (v) vaultStacks.push({ ...row, stackKey: v.key });
      return !v;
    });
    const stackPlace: Record<string, StackPlace> = {};
    for (const row of bagStacks) stackPlace[row.stackKey] = slotClassOf(row.stackKey) === 'quest' ? 'quest' : 'satchel';
    for (const row of stacks) { const v = parseVaultStackKey(row.stackKey); if (v && !(v.key in stackPlace)) stackPlace[v.key] = v.tab; }
    const inVault = items.filter(i => i.explorerId && vaultTabOf({ kind: 'explorer', explorerId: i.explorerId })).length;

    return {
      items,
      bag: items.filter(i => !i.equipped && !i.explorerId),
      stacks: bagStacks,
      vaultStacks,
      equipped,
      totals: sumStats(wornBlocks),
      goldFromSales: ledger.goldFromSales,
      sold: ledger.sold,
      usedRows: grid.bag.used,
      satchelCap: grid.bag.w * grid.bag.h,
      overflow: grid.overflow.length,
      stackPlace,
      inVault: inVault + vaultStacks.length,
      full: instanceRecordCount(ledger) >= INSTANCE_RECORD_BUDGET,
      grid,
      held: grid.bag.held.length,
    };
  }

  /** Capacity from the entitlements; an unbounded satchel until the Vault is live. */
  private capacityFor(ledger: InventoryLedger): Capacity {
    const owned = ledgerCapacity(ledger);
    return VAULT_LIVE ? owned : { ...owned, satchel: Infinity };
  }

  private capacity(): Capacity {
    return this.capacityFor(this.ledger);
  }

  /** Load-time pass: delete legacy Sigil records, mend hands, then settle. Quiet: nothing just arrived. */
  private normalised(ledger: InventoryLedger): InventoryLedger {
    // A two-handed weapon worn beside an off-hand (a save from before hands, item-hands.ts): the off-hand comes off.
    const now = Date.now();
    const mended = mendHands(dropLegacySigils(ledger, this.deviceId, now), this.deviceId, now);
    // The one-time list → grid layout (inventory-grid.ts migrateGrid): what does not fit goes to the Vault, once.
    const migrated = migrateGrid(mended, this.capacityFor(mended), this.deviceId, now);
    if (migrated.movedItems.length || migrated.movedStacks.length) {
      this.gridMigrated$$.next({ items: migrated.movedItems.length, stacks: migrated.movedStacks.length });
    }
    return this.withSocketRefunds(migrated.ledger, now);
  }

  /** A merge that left a socketed rune without its well refunds it, once (inventory-ops `socketRefunds`). */
  private withSocketRefunds(ledger: InventoryLedger, now: number): InventoryLedger {
    const refunds = socketRefunds(ledger);
    if (!refunds.length) return ledger;
    let stackOps = ledger.stackOps;
    let seq = 0;
    for (const r of refunds) {
      stackOps = applyStackOp(stackOps, { id: r.id, stackKey: r.stackKey, kind: 'grant', quantity: 1, hlc: Math.max(now, ledger.hlc + 1), deviceId: this.deviceId, sequence: ++seq });
    }
    return { ...ledger, stackOps };
  }

  /**
   * `settle` against the current capacity: holds the satchel to its limit by
   * moving, never deleting. What it moved is announced on `routed$` by the
   * next `publish()` (a write that fails never publishes).
   */
  private settled(ledger: InventoryLedger): InventoryLedger {
    // The grid (docs/design/inventory-grid.md): nothing is moved to the Vault by itself any more. A satchel with no
    // room keeps the newcomer on its "no room" strip until the player makes room.
    return ledger;
  }

  private mapInstances(
    fn: (row: OwnedItemInstance) => OwnedItemInstance,
  ): InventoryLedger {
    let next = this.ledger;
    for (const row of this.ledger.records) {
      if (row.kind !== 'instance' || row.source !== 'inventory') continue;
      next = upsertRecord(next, fn(row));
    }
    return next;
  }

  private withRevision(row: OwnedItemInstance): OwnedItemInstance {
    const stepped = this.advanceRevision(row.revision);
    return { ...row, revision: stepped.revision };
  }

  private advanceRevision(previous?: OwnedItemInstance['revision']) {
    const stepped = nextRevision(this.ledger, this.deviceId, Date.now(), previous);
    this.ledger = { ...this.ledger, hlc: stepped.hlc };
    return stepped;
  }

  private readDeviceId(): string {
    try {
      return localStorage.getItem(DEVICE_ID_KEY) || 'unknown';
    } catch {
      return 'unknown';
    }
  }
}

function stackTakesCellKey(stackKey: string): boolean {
  const cls = slotClassOf(stackKey);
  return cls === 'material' || cls === 'supply';
}

/**
 * The instance id one craft mints under.
 *
 * Derived from the mutation id rather than random, because that is what makes
 * `craftRecipe` idempotent: a retry recomputes the same ids, finds them in the
 * ledger and returns them instead of consuming a second set of materials.
 */
export function craftedItemId(mutationId: string, index: number): string {
  return `${mutationId}:craft:${index}`;
}
