/**
 * Identical pieces share slots (manager decision 2026-10-13): a group of n
 * identical instances in the satchel or a slot-limited Vault tab takes
 * ceil(n / 20) slots. Each piece stays its own record; only counting changes.
 *
 * The property test reuses the 48-seed harness shape of
 * inventory-stack-folds.spec.ts: two or three devices run random grants,
 * group moves both ways and syncs (merge order random), settling as the
 * service does. After every step nothing is lost or copied, the satchel fits,
 * settle is a no-op, and the layout's slot count equals the count the UI
 * derives from its own ×N rows. After a full sync every device agrees.
 */
import {
  emptyInventoryLedger,
  itemsFromLedger,
  mergeInventoryLedgers,
  nextRevision,
  upsertRecord,
} from './inventory-ops';
import {
  VAULT_TABS,
  layoutOf,
  occupancyOf,
  routeFor,
  settle,
  stowPlan,
  takeOutPlan,
  vaultHolder,
  vaultTabOf,
  type Capacity,
  type VaultTabId,
} from './inventory-layout';
import { groupItems, slotsForGroup } from './item-groups';
import type { InventoryLedger, ItemLocation, OwnedItemInstance } from './inventory.model';
import { INVENTORY_ERA } from './inventory.model';

type Kind = 'ring' | 'ring-variant' | 'boots' | 'unique';

function piece(id: string, kind: Kind, hlc = 1, location: ItemLocation = { kind: 'bag' }): OwnedItemInstance {
  const def = kind === 'boots' ? 'eq:boots' : 'eq:ring';
  return {
    id, definitionId: def, kind: 'instance', category: 'artifacts', tags: ['artifact'],
    rarity: 'common', soulbound: false, acquiredAt: '2026-10-01T00:00:00.000Z',
    revision: { hlc, deviceId: 'phone', sequence: 1 }, source: 'inventory',
    name: kind === 'boots' ? 'Ash Boots' : 'Ember Ring', type: 'artifact',
    stats: { goldPerSec: 2 },
    // A variant: same definition, a different frozen grade — never the same group.
    rollQuality: { goldPerSec: kind === 'ring-variant' ? 0.9 : 0.4 },
    sellValue: 12, location,
    ...(kind === 'unique' ? { upgradeLevel: 1 } : {}),
  };
}

function ledgerOf(rows: OwnedItemInstance[]): InventoryLedger {
  const hlc = Math.max(0, ...rows.map(r => r.revision.hlc));
  return { version: 2, records: rows, tombstones: [], stackOps: [], goldFromSales: 0, sold: 0, hlc, legacyBackup: null, era: INVENTORY_ERA };
}

const tabs = (...owned: VaultTabId[]): ReadonlySet<VaultTabId> => new Set<VaultTabId>(['general-1', 'overflow', ...owned]);
const CAP40: Capacity = { satchel: 40, tabs: tabs() };

function many(prefix: string, n: number, kind: Kind, hlc0 = 1, location?: ItemLocation): OwnedItemInstance[] {
  return Array.from({ length: n }, (_, i) => piece(`${prefix}${String(i).padStart(3, '0')}`, kind, hlc0 + i, location));
}

const inTab = (tab: VaultTabId): ItemLocation => ({ kind: 'explorer', explorerId: vaultHolder(tab) });

describe('inventory-layout: identical pieces share slots (20 to a slot)', () => {
  it('7 identical rings take 1 slot; 20 take 1; 21 take 2; 25 take 2', () => {
    for (const [n, slots] of [[7, 1], [20, 1], [21, 2], [25, 2], [40, 2], [41, 3]] as const) {
      const out = layoutOf(ledgerOf(many('r', n, 'ring')), CAP40);
      expect(out.bagInstances).withContext(`${n}`).toBe(n);
      expect(out.bagSlots).withContext(`${n}`).toBe(slots);
      expect(out.satchelUsed).withContext(`${n}`).toBe(slots);
      expect(out.satchel.reduce((sum, cell) => sum + cell.slots, 0)).toBe(slots);
    }
  });

  it('a variant (another grade), other gear and a tempered piece each take their own slot', () => {
    const rows = [...many('r', 7, 'ring'), piece('v1', 'ring-variant'), piece('b1', 'boots'), piece('u1', 'unique'), piece('u2', 'unique')];
    const out = layoutOf(ledgerOf(rows), CAP40);
    expect(out.bagSlots).toBe(1 + 1 + 1 + 2);
  });

  it('a slot-limited Vault tab counts the same way, and stacks get the room it frees', () => {
    const out = layoutOf(ledgerOf(many('r', 25, 'ring', 1, inTab('general-1'))), CAP40);
    expect(out.instancesIn['general-1']).toBe(25);
    expect(out.instanceSlotsIn['general-1']).toBe(2);
    expect(out.tabs['general-1'].reduce((sum, cell) => sum + cell.slots, 0)).toBe(2);
  });

  it('which piece carries the slot does not depend on record order', () => {
    const rows = many('r', 33, 'ring');
    expect(layoutOf(ledgerOf([...rows].reverse()), CAP40)).toEqual(layoutOf(ledgerOf(rows), CAP40));
  });
});

describe('inventory-layout: moving groups with shared slots', () => {
  it('taking out 30 identical with one free slot takes 20, and the plan says which', () => {
    const rows = [...many('u', 39, 'unique'), ...many('r', 30, 'ring', 100, inTab('general-1'))];
    const plan = takeOutPlan(ledgerOf(rows), CAP40, rows.filter(r => r.id.startsWith('r')).map(r => r.id));
    expect(plan.length).toBe(20);
  });

  it('pieces joining a group already in the satchel need no new slot', () => {
    const rows = [...many('u', 39, 'unique'), ...many('a', 5, 'ring'), ...many('r', 30, 'ring', 100, inTab('general-1'))];
    // The 5 in the bag share one slot with room for 15 more; the satchel is otherwise full.
    const plan = takeOutPlan(ledgerOf(rows), CAP40, rows.filter(r => r.id.startsWith('r')).map(r => r.id));
    expect(plan.length).toBe(15);
  });

  it('a one-of-a-kind piece needs a free slot', () => {
    const rows = [...many('u', 40, 'unique'), piece('x', 'unique', 5, inTab('general-1'))];
    expect(takeOutPlan(ledgerOf(rows), CAP40, ['x'])).toEqual([]);
  });

  it('routing keeps a group together: an identical piece joins its group, even past an owned Gear tab', () => {
    const rows = many('g', 3, 'ring', 1, inTab('general-1'));
    const occupancy = occupancyOf(ledgerOf(rows));
    const key = [...occupancy.groups['general-1'].keys()][0];
    expect(routeFor(occupancy, { satchel: 40, tabs: tabs('gear') }, key)).toBe('general-1');
    expect(routeFor(occupancy, { satchel: 40, tabs: tabs('gear') }, null)).toBe('gear');
  });

  it('a full tab still takes an identical piece whose group has room; a new kind spills on', () => {
    const rows = [...many('u', 59, 'unique', 1, inTab('general-1')), ...many('r', 4, 'ring', 100, inTab('general-1'))];
    const ledger = ledgerOf(rows);
    expect(layoutOf(ledger, CAP40).instanceSlotsIn['general-1']).toBe(60);
    const plan = stowPlan(ledgerOf([...rows, piece('new-r', 'ring', 500), piece('new-b', 'boots', 501)]), CAP40, ['new-r', 'new-b']);
    expect(plan).toEqual([{ id: 'new-r', tab: 'general-1' }, { id: 'new-b', tab: 'overflow' }]);
  });

  it('stowPlan sends 25 identical to one tab, taking 2 slots there', () => {
    const rows = many('r', 25, 'ring');
    const plan = stowPlan(ledgerOf(rows), CAP40, rows.map(r => r.id));
    expect(new Set(plan.map(step => step.tab))).toEqual(new Set<VaultTabId>(['general-1']));
  });
});

describe('inventory-layout: settle with shared slots', () => {
  it('a 21st identical piece over a full satchel moves just that one piece', () => {
    const rows = [...many('u', 38, 'unique', 1), ...many('r', 21, 'ring', 100)];
    const ledger = ledgerOf(rows);
    expect(layoutOf(ledger, CAP40).bagSlots).toBe(40);
    const over = ledgerOf([...rows, piece('u-new', 'unique', 900)]);
    const { ledger: after, moved } = settle(over, CAP40, 'tab', 5000);
    expect(moved).toEqual(['u-new']);
    expect(layoutOf(after, CAP40).bagSlots).toBe(40);
  });

  it('frees a slot with the fewest moves when only groups are over', () => {
    const cap: Capacity = { satchel: 2, tabs: tabs() };
    const rows = [...many('a', 23, 'ring', 1), ...many('b', 5, 'boots', 100)];
    const before = ledgerOf(rows);
    expect(layoutOf(before, cap).bagSlots).toBe(3);
    const { ledger: after, moved } = settle(before, cap, 'tab', 5000);
    expect(moved.length).toBe(3);
    expect(moved.every(id => id.startsWith('a'))).toBe(true);
    const out = layoutOf(after, cap);
    expect(out.bagSlots).toBe(2);
    expect(out.instancesIn['general-1']).toBe(3);
    expect(out.instanceSlotsIn['general-1']).toBe(1);
    expect(after.records.length).toBe(before.records.length);
    const again = settle(after, cap, 'tab', 6000);
    expect(again.ledger).toBe(after);
  });
});

// ── Property: random grants, group moves and syncs across devices ───────────

interface Device { id: string; ledger: InventoryLedger; known: Set<string>; skew: number }

function rng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** How often the run hit the interesting paths, so a quiet harness fails loudly. */
const exercised = { settleMoves: 0, partialTakes: 0, splitGroups: 0 };

/** What `InventoryService` does after any write that can fill the satchel. */
function settled(dev: Device, cap: Capacity, wall: number): void {
  const result = settle(dev.ledger, cap, dev.id, wall + dev.skew);
  exercised.settleMoves += result.moved.length;
  dev.ledger = result.ledger;
}

function relocate(dev: Device, id: string, location: ItemLocation, wall: number): void {
  const row = dev.ledger.records.find(r => r.id === id) as OwnedItemInstance;
  const stepped = nextRevision(dev.ledger, dev.id, wall + dev.skew, row.revision);
  dev.ledger = { ...upsertRecord(dev.ledger, { ...row, location, revision: stepped.revision }), hlc: stepped.hlc };
}

function sync(from: Device, to: Device, flip: boolean, cap: Capacity, wall: number): void {
  to.ledger = flip ? mergeInventoryLedgers(to.ledger, from.ledger) : mergeInventoryLedgers(from.ledger, to.ledger);
  for (const id of from.known) to.known.add(id);
  settled(to, cap, wall); // rehydrate settles
}

/** The UI's own count: its ×N rows (item-groups), ceil(n / 20) each, place by place. */
function uiSlots(ledger: InventoryLedger): Record<string, number> {
  const items = itemsFromLedger(ledger);
  const out: Record<string, number> = {};
  const bag = items.filter(item => !item.equipped && !item.explorerId);
  out['bag'] = groupItems(bag).reduce((sum, g) => sum + slotsForGroup(g.ids.length), 0);
  for (const tab of VAULT_TABS) {
    const here = items.filter(item => item.explorerId === vaultHolder(tab));
    out[tab] = groupItems(here).reduce((sum, g) => sum + slotsForGroup(g.ids.length), 0);
  }
  return out;
}

function check(dev: Device, cap: Capacity, where: string, full = true): void {
  const ids = dev.ledger.records.map(r => r.id);
  expect(ids.length).withContext(`${where}: duplicated record`).toBe(new Set(ids).size);
  expect([...ids].sort()).withContext(`${where}: lost or invented a piece`).toEqual([...dev.known].sort());
  const layout = layoutOf(dev.ledger, cap);
  expect(layout.bagSlots).withContext(`${where}: satchel over`).toBeLessThanOrEqual(cap.satchel);
  const again = settle(dev.ledger, cap, dev.id, 9e12);
  expect(again.ledger).withContext(`${where}: settle not idempotent`).toBe(dev.ledger);
  if (!full) return;
  const ui = uiSlots(dev.ledger);
  expect(ui['bag']).withContext(`${where}: satchel count`).toBe(layout.satchelUsed);
  for (const tab of VAULT_TABS) {
    expect(ui[tab]).withContext(`${where}: ${tab} count`).toBe(layout.instanceSlotsIn[tab]);
  }
}

describe('inventory-layout: property — shared slots across devices', () => {
  it('48 seeds: grants, group moves both ways and syncs in either merge order never lose, copy or overfill', () => {
    const KINDS: Kind[] = ['ring', 'ring', 'ring', 'ring-variant', 'boots', 'boots', 'unique'];
    let runs = 0;
    for (let seed = 1; seed <= 48; seed++) {
      const r = rng(seed);
      const count = seed % 2 ? 2 : 3;
      // A small satchel, so settle and partial take-outs happen all the time.
      const cap: Capacity = { satchel: 2 + (seed % 4), tabs: seed % 3 ? tabs('gear') : tabs() };
      const devices: Device[] = Array.from({ length: count }, (_, i) => ({
        id: `dev-${i}`, ledger: emptyInventoryLedger(), known: new Set<string>(), skew: Math.floor(r() * 40) - 20,
      }));
      let wall = 1000;
      let next = 0;

      for (let step = 0; step < 120; step++) {
        wall += 1 + Math.floor(r() * 3);
        const dev = devices[Math.floor(r() * devices.length)];
        const roll = r();
        if (roll < 0.4) {
          // Grants arrive in bursts of identical pieces, then settle (the service's add()).
          const kind = KINDS[Math.floor(r() * KINDS.length)];
          const burst = 1 + Math.floor(r() * 8);
          for (let i = 0; i < burst; i++) {
            const id = `p${seed}:${next++}`;
            const stepped = nextRevision(dev.ledger, dev.id, wall + dev.skew);
            dev.ledger = { ...upsertRecord(dev.ledger, { ...piece(id, kind), revision: stepped.revision }), hlc: stepped.hlc };
            dev.known.add(id);
          }
          settled(dev, cap, wall);
        } else if (roll < 0.55) {
          // Send a ×N row (or part of one) to the Vault.
          const groups = groupItems(itemsFromLedger(dev.ledger).filter(i => !i.equipped && !i.explorerId));
          const group = groups[Math.floor(r() * groups.length)];
          if (group) {
            const ids = group.ids.slice(0, 1 + Math.floor(r() * group.ids.length));
            if (ids.length < group.ids.length) exercised.splitGroups++;
            for (const { id, tab } of stowPlan(dev.ledger, cap, ids)) relocate(dev, id, inTab(tab), wall);
          }
        } else if (roll < 0.75) {
          // Take a Vault ×N row out: as many as fit.
          const vaulted = itemsFromLedger(dev.ledger).filter(i => i.explorerId?.startsWith('vault:'));
          const groups = groupItems(vaulted);
          const group = groups[Math.floor(r() * groups.length)];
          if (group) {
            const plan = takeOutPlan(dev.ledger, cap, group.ids);
            if (plan.length && plan.length < group.ids.length) exercised.partialTakes++;
            for (const id of plan) relocate(dev, id, { kind: 'bag' }, wall);
          }
        } else {
          const other = devices[Math.floor(r() * devices.length)];
          if (other !== dev) sync(dev, other, r() < 0.5, cap, wall);
        }
        // The UI cross-check every third step keeps the run fast; the rest every step.
        for (const d of devices) check(d, cap, `seed ${seed} step ${step} ${d.id}`, step % 3 === 0);
      }

      // Everyone syncs with everyone, both directions, both merge orders.
      for (let round = 0; round < 3; round++) {
        wall += 5;
        for (const a of devices) for (const b of devices) if (a !== b) sync(a, b, round % 2 === 1, cap, wall);
      }
      const where = (d: Device) => Object.fromEntries(d.ledger.records
        .map(row => [row.id, row.kind === 'instance' ? (vaultTabOf(row.location) ?? row.location.kind) : 'stack']));
      for (const d of devices) {
        check(d, cap, `seed ${seed} final ${d.id}`);
        expect(where(d)).withContext(`seed ${seed}: ${d.id} disagrees with ${devices[0].id}`).toEqual(where(devices[0]));
      }
      // The merge itself is order-free.
      const ab = mergeInventoryLedgers(devices[0].ledger, devices[1].ledger);
      const ba = mergeInventoryLedgers(devices[1].ledger, devices[0].ledger);
      expect(layoutOf(ab, cap)).withContext(`seed ${seed}: merge order`).toEqual(layoutOf(ba, cap));
      runs++;
    }
    expect(runs).toBe(48);
    expect(exercised.settleMoves).toBeGreaterThan(100);
    expect(exercised.partialTakes).toBeGreaterThan(20);
    expect(exercised.splitGroups).toBeGreaterThan(20);
  });
});
