/**
 * inventory-grid-1x1.spec.ts — the hotfix grid (owner 2026-10-26): every piece 1×1; the v1 → v2 migration keeps every
 * piece where it was drawn; a drop, a move or a pickup never moves anything else; Sort runs only when asked.
 */
import { emptyInventoryLedger } from './inventory-ops';
import { GRID_VERSION, GRID_W, SATCHEL_BASE_H, gridLayout, landingFor, migrateGrid, pinLoose, sortContainer } from './inventory-grid';
import { FOOTPRINTS, footprintOf, legacyFootprintOf } from './item-footprint';
import { ledgerCapacity } from './inventory-layout';
import type { InventoryLedger, OwnedItemInstance } from './inventory.model';

const T0 = 1_790_000_000_000;
function inst(id: string, definitionId: string, over: Partial<OwnedItemInstance> = {}): OwnedItemInstance {
  return {
    id, definitionId, kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: 'rare', soulbound: false,
    acquiredAt: new Date(T0).toISOString(), revision: { hlc: T0, deviceId: 'dev-a', sequence: 1 }, source: 'inventory',
    name: `${definitionId} ${id}`, type: 'artifact', stats: { defense: id.length + id.charCodeAt(id.length - 1) }, sellValue: 10, econ: 3,
    location: { kind: 'bag' }, ...over,
  };
}
const ledgerOf = (records: OwnedItemInstance[], grid?: number): InventoryLedger => ({ ...emptyInventoryLedger(), records, hlc: T0, era: 55, ...(grid ? { grid } : {}) });
const cells = (l: InventoryLedger) => Object.fromEntries(gridLayout(l).bag.pieces.flatMap(p => p.ids.map(id => [id, p.cell])));
const without = (l: InventoryLedger, id: string): InventoryLedger => ({ ...l, records: l.records.filter(r => r.id !== id) });

describe('the 1×1 satchel', () => {
  it('every piece covers one cell (a ring and a greatsword alike); the v1 table is kept for the migration only', () => {
    expect(footprintOf({ name: 'Keeper Staff', type: 'artifact', definitionId: 'keeper-staff', rarity: 'rare' })).toEqual({ w: 1, h: 1 });
    expect(footprintOf({ name: 'x', type: 'artifact', definitionId: 'infernal-cuirass', rarity: 'rare' })).toEqual({ w: 1, h: 1 });
    expect(legacyFootprintOf({ name: 'Keeper Staff', type: 'artifact', definitionId: 'keeper-staff', rarity: 'rare' })).toEqual(FOOTPRINTS.staff);
    expect(GRID_W * SATCHEL_BASE_H).toBe(60);
  });

  it('v1 → v2: each piece keeps the top-left cell v1 drew it at; nothing goes to the Vault; two devices agree; once', () => {
    const v1 = ledgerOf(['keeper-staff', 'infernal-cuirass', 'anchor-ring', 'astral-helm', 'meridian-longbow', 'keepers-cowl']
      .map((d, i) => inst(`i${i}`, d)), 1);
    const before = Object.fromEntries(gridLayout(v1, undefined, legacyFootprintOf).bag.pieces.flatMap(p => p.ids.map(id => [id, p.cell])));
    const a = migrateGrid(v1, ledgerCapacity(v1), 'dev-a', T0 + 10);
    const b = migrateGrid(v1, ledgerCapacity(v1), 'dev-b', T0 + 20);
    expect(a.ledger.grid).toBe(GRID_VERSION);
    expect(a.movedItems).toEqual([]);
    expect(cells(a.ledger)).toEqual(before);
    expect(cells(b.ledger)).toEqual(before);
    for (const r of a.ledger.records) expect((r as OwnedItemInstance).location.kind).toBe('bag');
    expect(migrateGrid(a.ledger, ledgerCapacity(a.ledger), 'dev-a', T0 + 30).ledger).toBe(a.ledger);
  });

  it('dropping one piece moves nothing else (every piece is pinned where it is drawn)', () => {
    const l = pinLoose(ledgerOf(Array.from({ length: 12 }, (_, i) => inst(`p${String(i).padStart(2, '0')}`, i % 2 ? 'anchor-ring' : 'astral-helm'))), 'dev-a', T0 + 5);
    const at = cells(l);
    for (const gone of ['p00', 'p05', 'p11']) {
      const after = cells(without(l, gone));
      const rest = { ...at }; delete rest[gone];
      expect(after).withContext(gone).toEqual(rest);
    }
  });

  it('a move writes one place and nothing else shifts; a pickup lands in the first free cell', () => {
    let l = pinLoose(ledgerOf([inst('a', 'astral-helm'), inst('b', 'anchor-ring'), inst('c', 'keeper-staff')]), 'dev-a', T0 + 5);
    const at = cells(l);
    l = { ...l, records: l.records.map(r => (r.id === 'b' ? { ...r, pos: { k: 'b' as const, c: [37], r: { hlc: T0 + 9, deviceId: 'dev-a', sequence: 9 } } } : r)) };
    const moved = cells(l);
    expect(moved['b']).toBe(37);
    expect(moved['a']).toBe(at['a']);
    expect(moved['c']).toBe(at['c']);
    // The freed cell is the first free one: a pickup lands there, and the others stay.
    const land = landingFor(gridLayout(l).bag, { w: 1, h: 1 }, null)!;
    expect([at['a'], at['b'], at['c']]).toEqual([0, 10, 20]);   // laid column by column, D2's way
    expect(land.cell).toBe(at['b']);
    const withNew = pinLoose({ ...l, records: [...l.records, inst('z', 'anchor-ring')] }, 'dev-a', T0 + 12);
    const after = cells(withNew);
    expect(after['a']).toBe(at['a']); expect(after['b']).toBe(37); expect(after['c']).toBe(at['c']);
    expect(after['z']).toBe(land.cell);
  });

  it('pinLoose is a no-op on a pinned save (the same object), so a save never churns', () => {
    const l = pinLoose(ledgerOf([inst('a', 'astral-helm'), inst('b', 'anchor-ring')]), 'dev-a', T0 + 5);
    expect(pinLoose(l, 'dev-a', T0 + 6)).toBe(l);
  });

  it('Sort orders by kind, then rarity (best first), then name, and only when called', () => {
    const l = pinLoose(ledgerOf([
      inst('r1', 'anchor-ring', { name: 'Zed Ring', rarity: 'common' }),
      inst('r2', 'anchor-ring', { name: 'Able Ring', rarity: 'common' }),
      inst('r3', 'anchor-ring', { name: 'Mid Ring', rarity: 'legendary' }),
    ]), 'dev-a', T0 + 5);
    const sorted = sortContainer(l, 'b', 'dev-a', T0 + 50);
    const at = cells(sorted);
    expect([at['r3'], at['r2'], at['r1']]).toEqual([0, 1, 2]);
    expect(sortContainer(sorted, 'b', 'dev-a', T0 + 60)).toBe(sorted);
  });

  it('a full satchel has no landing (the pickup is refused and the thing stays on the ground)', () => {
    const l = ledgerOf(Array.from({ length: 60 }, (_, i) => inst(`f${String(i).padStart(2, '0')}`, 'anchor-ring', { stats: { defense: i + 1 } })));
    expect(landingFor(gridLayout(l).bag, footprintOf(), null)).toBeNull();
  });
});
