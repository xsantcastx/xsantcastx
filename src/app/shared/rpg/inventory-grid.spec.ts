/**
 * inventory-grid.spec.ts — the D2 / PoE2 grid (docs/design/inventory-grid.md): footprints, placement, collision,
 * stacking, the one-time migration (property tests on random saves), and merge-safety across two devices.
 */
import { applyStackOp, emptyInventoryLedger, mergeInventoryLedgers, stackQuantityOf } from './inventory-ops';
import {
  Board, GRID_TABS, GRID_W, SATCHEL_BASE_H, VAULT_TAB_H, dropCell, dropFits, gridLayout, landingFor, migrateGrid,
  parseVaultStackKey, stackLanding, vaultStackKey, type GridView,
} from './inventory-grid';
import { FOOTPRINTS, footprintOf } from './item-footprint';
import { ledgerCapacity, stackCapOf } from './inventory-layout';
import type { InventoryLedger, OwnedItemInstance, OwnedItemStack } from './inventory.model';

const T0 = 1_790_000_000_000;

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEFS = ['keeper-staff', 'infernal-cuirass', 'anchor-ring', 'astral-helm', 'meridian-longbow', 'keepers-cowl'];
function inst(id: string, definitionId: string, over: Partial<OwnedItemInstance> = {}): OwnedItemInstance {
  return {
    id, definitionId, kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: 'rare', soulbound: false,
    acquiredAt: new Date(T0).toISOString(), revision: { hlc: T0, deviceId: 'dev-a', sequence: 1 }, source: 'inventory',
    name: `${definitionId} ${id}`, type: 'artifact', stats: { defense: id.length + id.charCodeAt(id.length - 1) }, sellValue: 10, econ: 3,
    location: { kind: 'bag' }, ...over,
  };
}
function stackRow(key: string): OwnedItemStack {
  return {
    id: `stack:${key}`, definitionId: key, kind: 'stack', category: 'materials', tags: ['material', key], soulbound: false,
    acquiredAt: new Date(T0).toISOString(), revision: { hlc: T0, deviceId: 'dev-a', sequence: 1 }, source: 'inventory', stackKey: key, location: { kind: 'bag' },
  };
}
function withStack(l: InventoryLedger, key: string, qty: number, n = 1): InventoryLedger {
  return {
    ...l,
    records: l.records.some(r => r.id === `stack:${key}`) ? l.records : [...l.records, stackRow(key)],
    stackOps: applyStackOp(l.stackOps, { id: `g:${key}:${n}`, stackKey: key, kind: 'grant', quantity: qty, hlc: T0 + n, deviceId: 'dev-a', sequence: n }),
  };
}
const ledgerOf = (records: OwnedItemInstance[]): InventoryLedger => ({ ...emptyInventoryLedger(), records, hlc: T0, era: 55 });

/** No two pieces cover one cell, and every piece is inside its grid. */
function sound(view: GridView): boolean {
  const b = new Board(view.w, view.h);
  for (const p of view.pieces) {
    if (!b.free(p.cell, p.w, p.h)) return false;
    b.put({ ...p }, p.cell);
  }
  return true;
}

describe('item footprints (D2 table)', () => {
  it('long things are tall, armour is 2×3, rings and runes one cell', () => {
    expect(FOOTPRINTS.staff).toEqual({ w: 1, h: 4 });
    expect(FOOTPRINTS.sword).toEqual({ w: 1, h: 3 });
    expect(FOOTPRINTS.plate).toEqual({ w: 2, h: 3 });
    expect(FOOTPRINTS.shield).toEqual({ w: 2, h: 2 });
    expect(FOOTPRINTS.helm).toEqual({ w: 2, h: 2 });
    expect(FOOTPRINTS.ring).toEqual({ w: 1, h: 1 });
    expect(FOOTPRINTS.amulet).toEqual({ w: 1, h: 1 });
    expect(footprintOf({ name: 'Keeper Staff', type: 'artifact', definitionId: 'keeper-staff', rarity: 'rare' })).toEqual({ w: 1, h: 4 });
    expect(footprintOf({ name: 'x', type: 'artifact', definitionId: 'infernal-cuirass', rarity: 'rare' })).toEqual({ w: 2, h: 3 });
    expect(footprintOf({ name: 'Ash', type: 'rune', definitionId: 'rune:ash', rarity: 'common' })).toEqual({ w: 1, h: 1 });
    expect(footprintOf({ name: 'S', type: 'artifact', definitionId: 'spellstone:hellfire-nova@7#5', rarity: 'common' })).toEqual({ w: 1, h: 1 });
    expect(footprintOf({ name: 'Mystery', type: 'artifact', definitionId: 'nobody-knows', rarity: 'rare' })).toEqual({ w: 1, h: 1 });
  });
  it('every footprint fits a 10-wide, 6-deep satchel', () => {
    for (const fp of Object.values(FOOTPRINTS)) { expect(fp.w).toBeLessThanOrEqual(GRID_W); expect(fp.h).toBeLessThanOrEqual(SATCHEL_BASE_H); }
  });
});

describe('placement and collision', () => {
  it('lays never-placed things biggest first, column by column, with no overlap, whatever the record order', () => {
    const rows = DEFS.map((d, i) => inst(`i${i}`, d));
    const a = gridLayout(ledgerOf(rows)), b = gridLayout(ledgerOf([...rows].reverse()));
    expect(sound(a.bag)).toBeTrue();
    expect(a.bag.pieces.map(p => [p.key, p.cell])).toEqual(b.bag.pieces.map(p => [p.key, p.cell]));
    expect(a.bag.held.length).toBe(0);
    expect(a.bag.w).toBe(GRID_W);
    expect(a.bag.h).toBe(SATCHEL_BASE_H);
  });
  it('honours stored places, and two items claiming one cell: the newer place wins, the other is laid by the rule', () => {
    const at = (hlc: number) => ({ hlc, deviceId: 'dev-a', sequence: 1 });
    const older = inst('old', 'astral-helm', { pos: { k: 'b', c: [22], r: at(T0 + 1) } });
    const newer = inst('new', 'keepers-cowl', { pos: { k: 'b', c: [22], r: at(T0 + 2) } });
    const view = gridLayout(ledgerOf([older, newer])).bag;
    expect(view.pieces.find(p => p.ids.includes('new'))!.cell).toBe(22);
    expect(view.pieces.find(p => p.ids.includes('old'))!.cell).not.toBe(22);
    expect(sound(view)).toBeTrue();
  });
  it('a place out of bounds or for another container is ignored', () => {
    const r = { hlc: T0, deviceId: 'dev-a', sequence: 1 };
    const view = gridLayout(ledgerOf([inst('a', 'keeper-staff', { pos: { k: 'b', c: [55], r } }), inst('b', 'anchor-ring', { pos: { k: 'general-1', c: [0], r } })])).bag;
    expect(sound(view)).toBeTrue();
    expect(view.pieces.length).toBe(2);
  });
  it('dropFits: free cells place, a covered cell refuses, the same pile joins, the piece may reuse its own cells', () => {
    const view = gridLayout(ledgerOf([inst('a', 'infernal-cuirass'), inst('b', 'anchor-ring')])).bag;
    const plate = view.pieces.find(p => p.ids.includes('a'))!;
    expect(dropFits(view, { key: 'drag', kind: 'instance', w: 1, h: 1, pileKey: null, qty: 1 }, plate.cell)).toBeNull();
    expect(dropFits(view, { key: plate.key, kind: 'instance', w: 2, h: 3, pileKey: null, qty: 1 }, plate.cell + 1)).not.toBeNull();
    expect(dropFits(view, { key: 'drag', kind: 'instance', w: 2, h: 3, pileKey: null, qty: 1 }, 9)).toBeNull(); // off the right edge
    expect(dropCell(view, 59, 2, 3)).toBe((SATCHEL_BASE_H - 3) * GRID_W + GRID_W - 2);
  });
  it('a full grid has no landing; the pickup is refused', () => {
    const rings = Array.from({ length: GRID_W * SATCHEL_BASE_H }, (_, i) => inst(`r${String(i).padStart(2, '0')}`, 'anchor-ring'));
    const view = gridLayout(ledgerOf(rings)).bag;
    expect(view.held.length).toBe(0);
    expect(landingFor(view, { w: 1, h: 1 }, null)).toBeNull();
    expect(stackLanding(view, 'cinder-ore', 1)).toBeNull();
  });
});

describe('stacking rules', () => {
  it('identical pieces pile in one cell (up to 20); different rolls do not', () => {
    const same = Array.from({ length: 23 }, (_, i) => inst(`s${String(i).padStart(2, '0')}`, 'anchor-ring', { name: 'Ring', stats: { defense: 3 } }));
    const view = gridLayout(ledgerOf([...same, inst('odd', 'anchor-ring', { name: 'Ring', stats: { defense: 9 } })])).bag;
    const piles = view.pieces.filter(p => p.kind === 'instance').map(p => p.qty).sort((a, b) => b - a);
    expect(piles).toEqual([20, 3, 1]);
  });
  it('a stack takes one cell per pile of its cap, and tops up its last pile first', () => {
    let l = withStack(ledgerOf([]), 'cinder-ore', stackCapOf('cinder-ore') * 2 + 5);
    const view = gridLayout(l).bag;
    expect(view.pieces.filter(p => p.stackKey === 'cinder-ore').map(p => p.qty)).toEqual([stackCapOf('cinder-ore'), stackCapOf('cinder-ore'), 5]);
    expect(stackLanding(view, 'cinder-ore', 10)!.cells.length).toBe(0);
    l = withStack(l, 'torch', 1, 2);
    expect(gridLayout(l).bag.pieces.filter(p => p.stackKey === 'torch').length).toBe(1);
  });
  it('Spellstones pile only with the identical recipe', () => {
    const stone = (id: string, recipe: string, charges: number) => inst(id, `spellstone:${recipe}`, { name: 'Spellstone', stats: {}, charges });
    const view = gridLayout(ledgerOf([
      stone('a', 'hellfire-nova@7#5', 4), stone('b', 'hellfire-nova@7#5', 2), stone('c', 'hellfire-nova@7#0', 4), stone('d', 'hellfire-nova@8#5', 4),
    ])).bag;
    const piles = view.pieces.map(p => p.ids.join(',')).sort();
    expect(piles).toEqual(['a,b', 'c', 'd']);
  });
  it('Vault stacks are their own keys', () => {
    expect(vaultStackKey('general-1', 'cinder-ore')).toBe('v:general-1:cinder-ore');
    expect(parseVaultStackKey('v:general-1:cinder-ore')).toEqual({ tab: 'general-1', key: 'cinder-ore' });
    expect(parseVaultStackKey('cinder-ore')).toBeNull();
    const l = withStack(ledgerOf([]), vaultStackKey('general-1', 'cinder-ore'), 40);
    const grid = gridLayout(l);
    expect(grid.bag.pieces.length).toBe(0);
    expect(grid.tabs['general-1'].pieces[0].qty).toBe(40);
    expect(grid.tabs['general-1'].h).toBe(VAULT_TAB_H);
  });
});

/** A random list-era save: gear in the bag and the Vault, worn pieces, stacks. */
function randomSave(r: () => number): InventoryLedger {
  const records: OwnedItemInstance[] = [];
  const n = Math.floor(r() * 60);
  for (let i = 0; i < n; i++) {
    const def = DEFS[Math.floor(r() * DEFS.length)];
    const where = r();
    const location = where < 0.7 ? { kind: 'bag' as const } : where < 0.9 ? { kind: 'explorer' as const, explorerId: 'vault:general-1' } : { kind: 'equipped' as const, slotId: 'head' as const };
    records.push(inst(`x${i}`, def, { location, stats: r() < 0.4 ? { defense: 1 } : { defense: i + 2 } }));
  }
  let l = ledgerOf(records);
  const keys = ['cinder-ore', 'ember-residue', 'torch', 'basalt-blank', 'minor-health-potion'];
  keys.forEach((k, i) => { if (r() < 0.7) l = withStack(l, k, 1 + Math.floor(r() * 3000), i + 1); });
  return l;
}
/** What the player owns: every live id, and each stack's total wherever it rests. */
function owned(l: InventoryLedger): string {
  const totals: Record<string, number> = {};
  for (const row of l.records) {
    if (row.kind !== 'stack') continue;
    const plain = parseVaultStackKey(row.stackKey)?.key ?? row.stackKey;
    totals[plain] = (totals[plain] ?? 0) + stackQuantityOf(l, row.stackKey);
  }
  return JSON.stringify({ ids: l.records.filter(r => r.kind === 'instance').map(r => r.id).sort(), totals: Object.entries(totals).sort() });
}

describe('the one-time list → grid migration (property tests)', () => {
  it('on 300 random saves: nothing lost, the satchel fits, Vault tabs fit, deterministic, idempotent', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const before = randomSave(rng(seed));
      const cap = ledgerCapacity(before);
      const a = migrateGrid(before, cap, 'dev-a', T0 + 1000);
      const b = migrateGrid(before, cap, 'dev-b', T0 + 2000);
      expect(owned(a.ledger)).withContext(`seed ${seed}`).toBe(owned(before));
      const grid = gridLayout(a.ledger);
      expect(grid.bag.held.length).withContext(`seed ${seed} satchel held`).toBe(0);
      expect(sound(grid.bag)).toBeTrue();
      for (const t of GRID_TABS) expect(grid.tabs[t].held.length).withContext(`seed ${seed} ${t}`).toBe(0);
      // Two devices make the same moves (only their revisions differ).
      expect(a.movedItems).toEqual(b.movedItems);
      expect(a.movedStacks).toEqual(b.movedStacks);
      // Once: a stamped save comes back as the same object.
      expect(migrateGrid(a.ledger, cap, 'dev-a', T0 + 3000).ledger).toBe(a.ledger);
      // Both devices' migrations merged (either order) still own exactly the same things.
      const ab = mergeInventoryLedgers(a.ledger, b.ledger), ba = mergeInventoryLedgers(b.ledger, a.ledger);
      expect(owned(ab)).withContext(`seed ${seed} merged`).toBe(owned(before));
      expect(owned(ba)).toBe(owned(ab));
    }
  });
  it('an empty save is not stamped (it may yet merge with a full cloud copy)', () => {
    const l = emptyInventoryLedger();
    expect(migrateGrid(l, ledgerCapacity(l), 'dev-a', T0).ledger).toBe(l);
  });
});

describe('merge-safety across two devices', () => {
  it('a move on one device and an upgrade on the other both survive the merge, in either order', () => {
    const base = ledgerOf([inst('blade', 'keeper-staff')]);
    const row = base.records[0] as OwnedItemInstance;
    // Device A moves it (only its place, under its own revision).
    const moved = { ...base, records: [{ ...row, pos: { k: 'b', c: [7], r: { hlc: T0 + 50, deviceId: 'dev-a', sequence: 2 } } }] };
    // Device B tempers it (the record's revision), unaware of the move.
    const upgraded = { ...base, records: [{ ...row, upgradeLevel: 3, revision: { hlc: T0 + 60, deviceId: 'dev-b', sequence: 2 } }] };
    for (const merged of [mergeInventoryLedgers(moved, upgraded), mergeInventoryLedgers(upgraded, moved)]) {
      const out = merged.records[0] as OwnedItemInstance;
      expect(out.upgradeLevel).toBe(3);
      expect(out.pos?.c).toEqual([7]);
    }
  });
  it('two devices filling one cell: the merged grid is sound and loses nothing', () => {
    const base = withStack(ledgerOf([]), 'cinder-ore', 5);
    const a = { ...base, records: [...base.records, inst('fromA', 'anchor-ring', { pos: { k: 'b', c: [0], r: { hlc: T0 + 5, deviceId: 'dev-a', sequence: 1 } } })] };
    const b = { ...base, records: [...base.records, inst('fromB', 'astral-helm', { pos: { k: 'b', c: [0], r: { hlc: T0 + 6, deviceId: 'dev-b', sequence: 1 } } })] };
    const merged = mergeInventoryLedgers(a, b);
    const view = gridLayout(merged).bag;
    expect(sound(view)).toBeTrue();
    expect(view.pieces.find(p => p.ids.includes('fromB'))!.cell).toBe(0);
    expect(view.pieces.some(p => p.ids.includes('fromA'))).toBeTrue();
    expect(JSON.stringify(gridLayout(mergeInventoryLedgers(b, a)).bag.pieces.map(p => [p.key, p.cell])))
      .toBe(JSON.stringify(view.pieces.map(p => [p.key, p.cell])));
  });
});
