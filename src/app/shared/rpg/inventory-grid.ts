/**
 * inventory-grid.ts — the satchel and the Vault as D2 / PoE2 grids (docs/design/inventory-grid.md).
 *
 * Pure. Ledger in, grids out. The rules in one paragraph:
 *
 *   · Every container is a grid GRID_W cells wide: the satchel (`b`, SATCHEL_BASE_H rows plus one per bought row)
 *     and each Vault tab (VAULT_TAB_H rows). Overflow is not a grid: it is the list of what has no cell.
 *   · A thing covers its footprint (item-footprint.ts). Identical instances (item-groups) and identical Spellstones
 *     share a cell as one pile, up to IDENTICAL_PER_SLOT. A stack covers one 1×1 cell per pile of up to its cap.
 *   · Where a thing sits is its `pos` (inventory.model GridPos), written only when a player moves it or it arrives.
 *     Stored places are honoured newest first; a clash (two devices filled one cell) and everything never placed is
 *     laid by the rule: biggest first, then by id, into the first free spot, column by column (Diablo II's pickup).
 *     So two devices draw the same grid from the same ledger, and a merge has nothing to move.
 *   · Stacks in the Vault are their own stack keys (`v:<tab>:<key>`): moving 30 ore in is one consume and one grant,
 *     both ordinary stack ops, so a merge can never make or lose ore. A bench reads the satchel's key only.
 *   · Nothing here writes, except {@link migrateGrid}: once per save, what does not fit the new satchel goes to the
 *     Vault (the only automatic Vault move left; docs/design/inventory-grid.md §4).
 */
import { compareRevision, nextRevision, recordToItem, stackQuantityOf, applyStackOp } from './inventory-ops';
import { IDENTICAL_PER_SLOT, identityKeyOf } from './item-groups';
import { footprintOf, isSpellstoneDef, legacyFootprintOf, type Footprint } from './item-footprint';
import { RUNE_TIER_ORDER } from '../rune-forge/rune.model';
import {
  SATCHEL_MAX_ROWS, SATCHEL_ROW_KEY, VAULT_TABS, slotClassOf, stackCapOf, vaultHolder, vaultTabOf, type Capacity, type VaultTabId,
} from './inventory-layout';
import type { GridPos, InventoryLedger, InventoryRevision, OwnedItemInstance, OwnedItemStack } from './inventory.model';

export const GRID_W = 10;
export const SATCHEL_BASE_H = 6;
export const VAULT_TAB_H = 12;
/** The grid format a save is laid out under (InventoryLedger.grid). */
export const GRID_VERSION = 2;
/** How many cells a record covers (1×1 since grid v2; the v1 table only for the migration). */
export type FootprintFn = (item: ReturnType<typeof recordToItem>) => Footprint;
/** A Spellstone pile's charge cap is its pieces' (≤100 each); piles hold this many stones. */
export const PILE_MAX = IDENTICAL_PER_SLOT;

/** A grid: the satchel, or a Vault tab. */
export type ContainerId = 'b' | VaultTabId;
export const GRID_TABS: readonly VaultTabId[] = VAULT_TABS.filter(t => t !== 'overflow');

// ── Vault stack keys ────────────────────────────────────────────────────────

const VAULT_STACK = /^v:([a-z0-9-]{1,24}):(.+)$/;
export function vaultStackKey(tab: VaultTabId, stackKey: string): string { return `v:${tab}:${stackKey}`; }
/** The tab and the plain key of a Vault stack key; null for a satchel key. */
export function parseVaultStackKey(storeKey: string): { tab: VaultTabId; key: string } | null {
  const m = VAULT_STACK.exec(storeKey);
  if (!m) return null;
  const tab = (VAULT_TABS as readonly string[]).includes(m[1]) ? m[1] as VaultTabId : 'overflow';
  return { tab, key: m[2] };
}
export function isVaultStackKey(storeKey: string): boolean { return VAULT_STACK.test(storeKey); }
/** Stack keys that take a cell: everything but quest finds and entitlements. */
export function stackTakesCell(stackKey: string): boolean {
  const cls = slotClassOf(stackKey);
  return cls === 'material' || cls === 'supply';
}

// ── Pieces and views ────────────────────────────────────────────────────────

export interface Piece {
  /** Stable within one layout: `i:<first id>` or `s:<store key>#<pile>`. */
  key: string;
  kind: 'instance' | 'stack';
  /** Instance ids in the pile, sorted. Empty for a stack. */
  ids: string[];
  /** Stack: the ledger key it is counted under (a Vault key in the Vault) and the plain item key. */
  storeKey?: string;
  stackKey?: string;
  pile?: number;
  /** Pieces in the pile, or the stack pile's quantity. */
  qty: number;
  w: number;
  h: number;
  /** Top-left cell (row * GRID_W + col), or -1 when it has none. */
  cell: number;
  /** What another piece must share to join this pile; null: never joins. */
  pileKey: string | null;
  /** The newest write behind it (stored places are honoured newest first). */
  rev: InventoryRevision | null;
}

export interface GridView {
  id: ContainerId;
  w: number;
  h: number;
  pieces: Piece[];
  /** Things here with no room (shown on the "no room" strip, or in Overflow for a Vault tab). */
  held: Piece[];
  /** Cells covered. */
  used: number;
}

export interface GridLayout {
  bag: GridView;
  tabs: Record<VaultTabId, GridView>;
  /** Overflow (not a grid): what sits in `vault:overflow`, plus any Vault tab's held pieces. */
  overflow: Piece[];
}

/** Rows the satchel has. */
export function satchelRows(qty: (stackKey: string) => number): number {
  return SATCHEL_BASE_H + Math.min(SATCHEL_MAX_ROWS, Math.max(0, Math.floor(qty(SATCHEL_ROW_KEY))));
}

const NO_REV: InventoryRevision = { hlc: -1, deviceId: '', sequence: 0 };
const rows = (cells: number) => Math.floor(cells / GRID_W);

/** The pile key of an instance record: identical pieces, or the same Spellstone recipe. */
export function pileKeyOfRecord(row: OwnedItemInstance): string | null {
  if (isSpellstoneDef(row.definitionId)) return `stone|${row.definitionId}|${row.soulbound ? 1 : 0}`;
  const item = recordToItem(row);
  return identityKeyOf({ ...item, equipped: false });
}

/** The container an instance record sits in (null: worn, lent, in a chest, or in Overflow). */
export function containerOfLocation(location: OwnedItemInstance['location']): ContainerId | 'overflow' | null {
  if (location.kind === 'bag') return 'b';
  const tab = vaultTabOf(location);
  return tab ?? null;
}

// ── A working grid ──────────────────────────────────────────────────────────

/** An occupancy map for placing: which piece covers each cell. Mutable; build one per decision. */
export class Board {
  readonly cells: Int32Array;
  readonly pieces: Piece[] = [];
  constructor(readonly w: number, readonly h: number) { this.cells = new Int32Array(w * h).fill(-1); }

  static of(view: Pick<GridView, 'w' | 'h' | 'pieces'>, without?: ReadonlySet<string>): Board {
    const b = new Board(view.w, view.h);
    for (const p of view.pieces) if (!without?.has(p.key)) b.put(p, p.cell);
    return b;
  }

  /** True when a w×h footprint fits with its top-left at `cell` (in bounds, nothing under it). */
  free(cell: number, w: number, h: number): boolean {
    if (cell < 0) return false;
    const x = cell % this.w, y = rows(cell);
    if (x + w > this.w || y + h > this.h) return false;
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (this.cells[(y + dy) * this.w + x + dx] !== -1) return false;
    return true;
  }

  /** The piece covering a cell, or null. */
  at(cell: number): Piece | null {
    const i = cell >= 0 && cell < this.cells.length ? this.cells[cell] : -1;
    return i >= 0 ? this.pieces[i] : null;
  }

  /** A pile this piece may join (same pile key, room, the same footprint): its key, or null. */
  joinable(pileKey: string | null, add: number, cell?: number): Piece | null {
    if (pileKey === null) return null;
    for (const p of this.pieces) {
      if (p.pileKey !== pileKey || p.qty + add > PILE_MAX) continue;
      if (cell === undefined || p.cell === cell) return p;
    }
    return null;
  }

  put(p: Piece, cell: number): void {
    const x = cell % this.w, y = rows(cell), i = this.pieces.length;
    p.cell = cell;
    this.pieces.push(p);
    for (let dy = 0; dy < p.h; dy++) for (let dx = 0; dx < p.w; dx++) this.cells[(y + dy) * this.w + x + dx] = i;
  }

  /** The first spot a w×h footprint fits, column by column from the top left (Diablo II), or -1. */
  spot(w: number, h: number): number {
    for (let x = 0; x + w <= this.w; x++) for (let y = 0; y + h <= this.h; y++) {
      const cell = y * this.w + x;
      if (this.free(cell, w, h)) return cell;
    }
    return -1;
  }

  used(): number { let n = 0; for (const c of this.cells) if (c !== -1) n++; return n; }
}

// ── The layout ──────────────────────────────────────────────────────────────

interface Bucket { instances: OwnedItemInstance[]; stacks: { row: OwnedItemStack; qty: number }[] }

function liveInstances(ledger: InventoryLedger): OwnedItemInstance[] {
  return ledger.records.filter((row): row is OwnedItemInstance => row.kind === 'instance' && row.source === 'inventory');
}

const PILE_KEYS = new WeakMap<OwnedItemInstance, string | null>();
function pileKey(row: OwnedItemInstance): string | null {
  const hit = PILE_KEYS.get(row);
  if (hit !== undefined) return hit;
  const k = pileKeyOfRecord(row);
  PILE_KEYS.set(row, k);
  return k;
}

function newer(a: InventoryRevision | null, b: InventoryRevision | null): InventoryRevision | null {
  if (!a) return b;
  if (!b) return a;
  return compareRevision(a, b) >= 0 ? a : b;
}

/** Lay one container out. Deterministic and independent of record order. */
function layContainer(id: ContainerId, w: number, h: number, bucket: Bucket, fpOf: FootprintFn = footprintOf): GridView {
  const board = new Board(w, h);
  const held: Piece[] = [];
  const stored: Piece[] = [];
  const loose: Piece[] = [];
  const looseIds: OwnedItemInstance[] = [];

  // Instances with a stored place here, grouped into piles by (pile key, cell).
  const piles = new Map<string, OwnedItemInstance[]>();
  for (const row of [...bucket.instances].sort((a, b) => a.id.localeCompare(b.id))) {
    const pos = row.pos;
    if (pos && pos.k === id && pos.c.length === 1) {
      const pk = pileKey(row);
      const groupKey = pk === null ? `one:${row.id}` : `${pk}@${pos.c[0]}`;
      const list = piles.get(groupKey) ?? [];
      list.push(row);
      piles.set(groupKey, list);
    } else looseIds.push(row);
  }
  for (const rowsOfPile of piles.values()) {
    const first = rowsOfPile[0];
    const fp = fpOf(recordToItem(first));
    const keep = rowsOfPile.slice(0, PILE_MAX);
    looseIds.push(...rowsOfPile.slice(PILE_MAX));
    stored.push({
      key: `i:${first.id}`, kind: 'instance', ids: keep.map(r => r.id), qty: keep.length, w: fp.w, h: fp.h,
      cell: first.pos!.c[0], pileKey: pileKey(first), rev: keep.reduce<InventoryRevision | null>((m, r) => newer(m, r.pos!.r), null),
    });
  }
  // Stack piles: full piles first; a stored cell per pile when its place names this container.
  for (const { row, qty } of [...bucket.stacks].sort((a, b) => a.row.stackKey.localeCompare(b.row.stackKey))) {
    const plain = parseVaultStackKey(row.stackKey)?.key ?? row.stackKey;
    const cap = stackCapOf(plain);
    const n = Math.ceil(qty / cap);
    for (let i = 0; i < n; i++) {
      const piece: Piece = {
        key: `s:${row.stackKey}#${i}`, kind: 'stack', ids: [], storeKey: row.stackKey, stackKey: plain, pile: i,
        qty: Math.min(cap, qty - i * cap), w: 1, h: 1, cell: -1, pileKey: null, rev: row.pos?.r ?? null,
      };
      const cell = row.pos && row.pos.k === id ? row.pos.c[i] : undefined;
      if (cell !== undefined) { piece.cell = cell; stored.push(piece); } else loose.push(piece);
    }
  }

  // Stored places, newest first: a clash goes to the loose pile.
  stored.sort((a, b) => compareRevision(b.rev ?? NO_REV, a.rev ?? NO_REV) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  for (const p of stored) {
    if (board.free(p.cell, p.w, p.h)) { board.put(p, p.cell); continue; }
    if (p.kind === 'instance') looseIds.push(...bucketRows(bucket, p.ids));
    else { p.cell = -1; loose.push(p); }
  }

  // The rest by the rule: instances join a pile with room, else biggest first into the first free spot.
  const fresh: Piece[] = [];
  for (const row of looseIds.sort((a, b) => a.id.localeCompare(b.id))) {
    const pk = pileKey(row);
    const pile = board.joinable(pk, 1) ?? fresh.find(p => p.pileKey !== null && p.pileKey === pk && p.qty < PILE_MAX);
    if (pile) { pile.ids.push(row.id); pile.ids.sort(); pile.qty += 1; continue; }
    const fp = fpOf(recordToItem(row));
    fresh.push({ key: `i:${row.id}`, kind: 'instance', ids: [row.id], qty: 1, w: fp.w, h: fp.h, cell: -1, pileKey: pk, rev: null });
  }
  fresh.push(...loose);
  fresh.sort((a, b) => b.w * b.h - a.w * a.h || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  for (const p of fresh) {
    const cell = board.spot(p.w, p.h);
    if (cell >= 0) board.put(p, cell);
    else held.push(p);
  }
  return { id, w, h, pieces: board.pieces, held, used: board.used() };
}

function bucketRows(bucket: Bucket, ids: readonly string[]): OwnedItemInstance[] {
  const set = new Set(ids);
  return bucket.instances.filter(r => set.has(r.id));
}

/** Every grid of a save. `capacity` gives the satchel's rows (via the row entitlement) and the owned tabs. */
export function gridLayout(ledger: InventoryLedger, _capacity?: Capacity, fpOf: FootprintFn = footprintOf): GridLayout {
  const buckets = new Map<ContainerId | 'overflow', Bucket>();
  const bucket = (id: ContainerId | 'overflow') => {
    let b = buckets.get(id);
    if (!b) { b = { instances: [], stacks: [] }; buckets.set(id, b); }
    return b;
  };
  for (const row of liveInstances(ledger)) {
    const where = containerOfLocation(row.location);
    if (where) bucket(where).instances.push(row);
  }
  const seen = new Set<string>();
  for (const row of ledger.records) {
    if (row.kind !== 'stack' || row.source !== 'inventory' || seen.has(row.stackKey)) continue;
    seen.add(row.stackKey);
    const v = parseVaultStackKey(row.stackKey);
    const plain = v?.key ?? row.stackKey;
    if (!stackTakesCell(plain)) continue;
    const qty = stackQuantityOf(ledger, row.stackKey);
    if (qty <= 0) continue;
    bucket(v ? v.tab : 'b').stacks.push({ row, qty });
  }
  const empty: Bucket = { instances: [], stacks: [] };
  const h = satchelRows(key => stackQuantityOf(ledger, key));
  const bag = layContainer('b', GRID_W, h, buckets.get('b') ?? empty, fpOf);
  const tabs = {} as Record<VaultTabId, GridView>;
  const overflow: Piece[] = [];
  for (const tab of GRID_TABS) {
    tabs[tab] = layContainer(tab, GRID_W, VAULT_TAB_H, buckets.get(tab) ?? empty, fpOf);
    overflow.push(...tabs[tab].held);
  }
  // Overflow: no grid, one entry per pile, in a stable order.
  const over = layContainer('overflow', GRID_W, 0, buckets.get('overflow') ?? empty, fpOf);
  tabs.overflow = { ...over, pieces: [] };
  overflow.push(...over.held);
  return { bag, tabs, overflow };
}

// ── Questions the service asks ─────────────────────────────────────────────

/** Where an arriving instance would land in a view: a pile to join, or a free top-left cell; null when full. */
export function landingFor(view: GridView, fp: Footprint, pk: string | null): { cell: number; joins: Piece | null } | null {
  const board = Board.of(view);
  const pile = board.joinable(pk, 1);
  if (pile) return { cell: pile.cell, joins: pile };
  const cell = board.spot(fp.w, fp.h);
  return cell >= 0 ? { cell, joins: null } : null;
}

/** Where `qty` of a stack would land in a view (topping up its last pile first), or null when it does not fit. */
export function stackLanding(view: GridView, stackKey: string, qty: number): { cells: number[] } | null {
  const cap = stackCapOf(stackKey);
  const mine = view.pieces.filter(p => p.kind === 'stack' && p.stackKey === stackKey);
  const room = mine.reduce((sum, p) => sum + (cap - p.qty), 0);
  const need = Math.max(0, Math.ceil((qty - room) / cap));
  if (need === 0) return { cells: [] };
  const board = Board.of(view);
  const cells: number[] = [];
  for (let i = 0; i < need; i++) {
    const cell = board.spot(1, 1);
    if (cell < 0) return null;
    board.put({ key: `new${i}`, kind: 'stack', ids: [], qty: 0, w: 1, h: 1, cell, pileKey: null, rev: null }, cell);
    cells.push(cell);
  }
  return { cells };
}

/**
 * May `piece` sit with its top-left at `cell` in `view`? The piece's own cells (it may already be here) are free to
 * reuse; a pile of the same kind exactly there with room is a join. Returns 'place', 'join', or null.
 */
export function dropFits(view: GridView, piece: Pick<Piece, 'key' | 'w' | 'h' | 'pileKey' | 'qty' | 'kind' | 'stackKey'>, cell: number): 'place' | 'join' | null {
  const board = Board.of(view, new Set([piece.key]));
  const under = board.at(cell);
  if (under && under.cell === cell) {
    if (piece.kind === 'instance' && under.pileKey !== null && under.pileKey === piece.pileKey && under.qty + piece.qty <= PILE_MAX) return 'join';
    if (piece.kind === 'stack' && under.kind === 'stack' && under.stackKey === piece.stackKey) return 'join';
  }
  return board.free(cell, piece.w, piece.h) ? 'place' : null;
}

/** The top-left cell a drop names: the cell under the pointer, less where the piece was held, kept in the grid. */
export function dropCell(view: Pick<GridView, 'w' | 'h'>, pointerCell: number, w: number, h: number, grabDx = 0, grabDy = 0): number {
  const x = Math.max(0, Math.min(view.w - w, (pointerCell % view.w) - grabDx));
  const y = Math.max(0, Math.min(view.h - h, rows(pointerCell) - grabDy));
  return y * view.w + x;
}

// ── The one-time migration (list era → grid) ───────────────────────────────

export interface GridMigration { ledger: InventoryLedger; movedItems: string[]; movedStacks: { stackKey: string; qty: number; tab: VaultTabId }[] }

/**
 * Lay a list-era save into the grid, once (docs/design/inventory-grid.md §4). Nothing is written for what fits: its
 * place is the rule's, which every device computes alike. What does not fit the satchel goes to the Vault: an item to
 * the first owned tab with room (Overflow last), a stack pile as a consume and a grant whose op ids name the key and
 * the amount, so two devices migrating the same save write the same ops and the merge keeps one pair. Vault tabs that
 * overflow their new grid move to Overflow. Stamps `grid`. An empty save is left alone (it may yet merge with a full
 * cloud copy, which must migrate then). Idempotent: a stamped ledger comes back as the same object.
 */
export function migrateGrid(ledger: InventoryLedger, capacity: Capacity, deviceId: string, now: number): GridMigration {
  if ((ledger.grid ?? 0) >= GRID_VERSION) return { ledger, movedItems: [], movedStacks: [] };
  if (!ledger.records.some(r => r.source === 'inventory')) return { ledger, movedItems: [], movedStacks: [] };
  // v1 → v2 (every piece 1×1, owner 2026-10-26): pin each piece at the top-left cell v1 drew it at (a pinned v1 piece
  // keeps its cell; one the rule laid gets that cell written), then pin what v1 had no room for into the first free
  // cells. Nothing goes to the Vault and nothing that fitted moves. Deterministic, so two devices write the same cells.
  if ((ledger.grid ?? 0) >= 1) {
    const pinned = pinLoose(pinLoose(ledger, deviceId, now, legacyFootprintOf), deviceId, now);
    return { ledger: { ...pinned, grid: GRID_VERSION }, movedItems: [], movedStacks: [] };
  }
  const v1 = migrateGridV1(ledger, capacity, deviceId, now);
  return { ...v1, ledger: { ...pinLoose(v1.ledger, deviceId, now), grid: GRID_VERSION } };
}

/** The list era → grid layout (1×1), what did not fit the satchel to the Vault: the original one-time move. */
function migrateGridV1(ledger: InventoryLedger, capacity: Capacity, deviceId: string, now: number): GridMigration {
  let next = ledger;
  const layout = gridLayout(ledger, capacity);
  const movedItems: string[] = [];
  const movedStacks: GridMigration['movedStacks'] = [];
  const owned = GRID_TABS.filter(t => capacity.tabs.has(t));
  const boards = new Map<VaultTabId, Board>(owned.map(t => [t, Board.of(layout.tabs[t])]));
  const byId = new Map(liveInstances(ledger).map(r => [r.id, r]));

  const relocate = (id: string, tab: VaultTabId, cell: number | null) => {
    const row = byId.get(id);
    if (!row) return;
    const stepped = nextRevision(next, deviceId, now, row.revision);
    const pos: GridPos | undefined = cell === null ? undefined : { k: tab, c: [cell], r: stepped.revision };
    const { pos: _old, ...rest } = row;
    void _old;
    const updated: OwnedItemInstance = { ...rest, location: { kind: 'explorer', explorerId: vaultHolder(tab) }, revision: stepped.revision, ...(pos ? { pos } : {}) };
    next = { ...next, hlc: stepped.hlc, records: next.records.map(r => (r.id === id ? updated : r)) };
    movedItems.push(id);
  };

  // Satchel pieces with no room: instances to a Vault tab, stack piles to Vault stack keys.
  for (const p of layout.bag.held) {
    let placed: { tab: VaultTabId; cell: number } | null = null;
    for (const tab of owned) {
      const board = boards.get(tab)!;
      const cell = board.spot(p.w, p.h);
      if (cell >= 0) { board.put({ ...p, key: `m:${p.key}` }, cell); placed = { tab, cell }; break; }
    }
    if (p.kind === 'instance') {
      for (const id of p.ids) relocate(id, placed?.tab ?? 'overflow', placed?.cell ?? null);
      continue;
    }
    const tab = placed?.tab ?? 'overflow';
    const into = vaultStackKey(tab, p.stackKey!);
    const opBase = `gridmig:${p.stackKey}:${p.pile}:${p.qty}`;
    for (const [kind, key, suffix] of [['consume', p.storeKey!, 'out'], ['grant', into, 'in']] as const) {
      const stepped = nextRevision(next, deviceId, now);
      next = {
        ...next, hlc: stepped.hlc,
        stackOps: applyStackOp(next.stackOps, {
          id: `${opBase}:${suffix}`, stackKey: key, kind, quantity: p.qty,
          hlc: stepped.revision.hlc, deviceId: stepped.revision.deviceId, sequence: stepped.revision.sequence,
        }),
      };
    }
    next = ensureStackRecord(next, into, deviceId, now, placed ? placed.cell : null, tab);
    movedStacks.push({ stackKey: p.stackKey!, qty: p.qty, tab });
  }
  // Vault tabs whose old slots outgrew the new grid: to Overflow.
  for (const tab of GRID_TABS) for (const p of layout.tabs[tab].held) {
    if (p.kind === 'instance') for (const id of p.ids) relocate(id, 'overflow', null);
  }
  return { ledger: next, movedItems, movedStacks };
}

/** The stack's record (created when missing), with `cell` appended to its place in `tab` when given. */
export function ensureStackRecord(ledger: InventoryLedger, storeKey: string, deviceId: string, now: number, cell: number | null, container: ContainerId | 'overflow'): InventoryLedger {
  const held = ledger.records.find((r): r is OwnedItemStack => r.kind === 'stack' && r.stackKey === storeKey && r.source === 'inventory');
  const stepped = nextRevision(ledger, deviceId, now, held?.revision);
  const k = container;
  const prior = held?.pos && held.pos.k === k ? held.pos.c : [];
  const pos: GridPos | undefined = cell === null ? held?.pos : { k, c: [...prior.filter(c => c !== cell), cell], r: stepped.revision };
  if (held) {
    if (pos === held.pos) return ledger;
    const updated: OwnedItemStack = { ...held, ...(pos ? { pos } : {}) };
    return { ...ledger, hlc: stepped.hlc, records: ledger.records.map(r => (r === held ? updated : r)) };
  }
  const row: OwnedItemStack = {
    id: `stack:${storeKey}`, definitionId: storeKey, kind: 'stack', category: 'materials', tags: ['material', storeKey],
    soulbound: false, acquiredAt: new Date(now).toISOString(), revision: stepped.revision, source: 'inventory',
    stackKey: storeKey, location: { kind: 'bag' }, ...(pos ? { pos } : {}),
  };
  return { ...ledger, hlc: stepped.hlc, records: [...ledger.records, row] };
}

// ── Pinning: every piece keeps the cell it is drawn in ─────────────────────

/**
 * Write the drawn cell of every piece that has none (or a stale one) as its stored place, in every grid. After this, the
 * layout is a pure read of stored places: dropping, moving or taking one piece can never move another (owner
 * 2026-10-26: "drop one thing and nothing else moves"). A piece the rule would lay (a fresh arrival, a pile split by a
 * merge) is pinned where it is first drawn. Pieces with no room stay unpinned. Returns the same object when nothing
 * changes. Writes only places, each its own register (merge-safe: the newer place wins).
 */
export function pinLoose(ledger: InventoryLedger, deviceId: string, now: number, fpOf: FootprintFn = footprintOf): InventoryLedger {
  const layout = gridLayout(ledger, undefined, fpOf);
  const views: GridView[] = [layout.bag, ...GRID_TABS.map(t => layout.tabs[t])];
  const instPos = new Map<string, { k: ContainerId; cell: number }>();
  const stackCells = new Map<string, { k: ContainerId; cells: number[] }>();
  for (const v of views) for (const p of v.pieces) {
    if (p.kind === 'instance') for (const id of p.ids) instPos.set(id, { k: v.id, cell: p.cell });
    else if (p.storeKey) {
      const e = stackCells.get(p.storeKey) ?? { k: v.id, cells: [] };
      e.cells[p.pile ?? 0] = p.cell;
      stackCells.set(p.storeKey, e);
    }
  }
  let rev: InventoryRevision | null = null;
  let hlc = ledger.hlc;
  const stamp = (): InventoryRevision => {
    if (!rev) { const stepped = nextRevision(ledger, deviceId, now); rev = stepped.revision; hlc = stepped.hlc; }
    return rev;
  };
  let changed = false;
  const records = ledger.records.map(r => {
    if (r.source !== 'inventory') return r;
    if (r.kind === 'instance') {
      const want = instPos.get(r.id);
      if (!want || (r.pos && r.pos.k === want.k && r.pos.c.length === 1 && r.pos.c[0] === want.cell)) return r;
      changed = true;
      return { ...r, pos: { k: want.k, c: [want.cell], r: stamp() } };
    }
    if (r.kind === 'stack') {
      const want = stackCells.get(r.stackKey);
      if (!want || want.cells.some(c => c === undefined)) return r;
      const cur = r.pos;
      if (cur && cur.k === want.k && want.cells.every((c, i) => cur.c[i] === c)) return r;
      changed = true;
      // Keep any cells past the drawn piles (a pile that will come back keeps its place).
      const tail = cur && cur.k === want.k ? cur.c.slice(want.cells.length).filter(c => !want.cells.includes(c)) : [];
      return { ...r, pos: { k: want.k, c: [...want.cells, ...tail], r: stamp() } };
    }
    return r;
  });
  return changed ? { ...ledger, hlc, records } : ledger;
}

// ── The manual Sort (owner 2026-10-26: only when pressed; nothing ever sorts by itself) ──

const KIND_ORDER = ['weapon', 'armor', 'artifact', 'rune', 'spellstone', 'supply', 'material'];

/** A piece's sort key: by type, then rarity (best first), then name. */
function sortKeyOf(ledger: InventoryLedger, p: Piece): [number, number, string] {
  if (p.kind === 'stack') {
    const cls = slotClassOf(p.stackKey ?? '');
    return [KIND_ORDER.indexOf(cls === 'supply' ? 'supply' : 'material'), 0, p.stackKey ?? ''];
  }
  const row = ledger.records.find((r): r is OwnedItemInstance => r.kind === 'instance' && r.id === p.ids[0]);
  if (!row) return [99, 0, p.key];
  const item = recordToItem(row);
  const kind = isSpellstoneDef(row.definitionId) ? 'spellstone' : item.type === 'rune' ? 'rune' : item.slot === 'weapon' || item.slot === 'off-hand' ? 'weapon' : item.slot ? 'armor' : 'artifact';
  const tier = RUNE_TIER_ORDER.indexOf(item.rarity as (typeof RUNE_TIER_ORDER)[number]);
  return [KIND_ORDER.indexOf(kind), -tier, item.name ?? ''];
}

/**
 * Lay one grid out in order (type, rarity, name), from the top-left, row by row. Writes only places. Pieces with no
 * room (the satchel's "no room" strip) stay where they are. Same object back when already in order.
 */
export function sortContainer(ledger: InventoryLedger, container: ContainerId, deviceId: string, now: number): InventoryLedger {
  const layout = gridLayout(ledger);
  const view = container === 'b' ? layout.bag : layout.tabs[container];
  if (!view) return ledger;
  const order = [...view.pieces].sort((a, b) => {
    const ka = sortKeyOf(ledger, a), kb = sortKeyOf(ledger, b);
    return ka[0] - kb[0] || ka[1] - kb[1] || ka[2].localeCompare(kb[2]) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  });
  const target = new Map<string, number>();
  order.forEach((p, i) => target.set(p.key, i));
  if (order.every(p => p.cell === target.get(p.key))) return ledger;
  const stepped = nextRevision(ledger, deviceId, now);
  const r = stepped.revision;
  const instCell = new Map<string, number>();
  const stackCellsOf = new Map<string, number[]>();
  for (const p of order) {
    const cell = target.get(p.key)!;
    if (p.kind === 'instance') for (const id of p.ids) instCell.set(id, cell);
    else if (p.storeKey) { const list = stackCellsOf.get(p.storeKey) ?? []; list[p.pile ?? 0] = cell; stackCellsOf.set(p.storeKey, list); }
  }
  const records = ledger.records.map(row => {
    if (row.source !== 'inventory') return row;
    if (row.kind === 'instance' && instCell.has(row.id)) return { ...row, pos: { k: container, c: [instCell.get(row.id)!], r } };
    if (row.kind === 'stack' && stackCellsOf.has(row.stackKey)) return { ...row, pos: { k: container, c: stackCellsOf.get(row.stackKey)!, r } };
    return row;
  });
  return { ...ledger, hlc: stepped.hlc, records };
}
