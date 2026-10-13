import { mergeInventoryLedgers, stackQuantityOf } from './inventory-ops';
import {
  INSTANCE_RECORD_BUDGET,
  SATCHEL_BASE_SLOTS,
  SATCHEL_ROW_KEY,
  SUPPLY_KEYS,
  capacityOf,
  dropLegacySigils,
  isLegacySigil,
  layoutOf,
  ledgerCapacity,
  routeFor,
  settle,
  slotClassOf,
  stackCapOf,
  storageTabKey,
  vaultHolder,
  vaultTabOf,
  type Capacity,
  type VaultTabId,
} from './inventory-layout';
import type {
  InventoryLedger,
  InventoryStackOp,
  OwnedItemInstance,
  OwnedItemRecord,
  OwnedItemStack,
} from './inventory.model';
import { INVENTORY_ERA } from './inventory.model';
import { PLACEABLES } from '../../play/engine/terrain';
import { ITEM_DEFINITIONS } from './item-definition';

function instance(id: string, hlc = 1, extra: Partial<OwnedItemInstance> = {}): OwnedItemInstance {
  return {
    id, definitionId: `charm:${id}`, kind: 'instance', category: 'equipment', tags: ['charm'],
    rarity: 'common', soulbound: false, acquiredAt: '2026-08-01T00:00:00.000Z',
    revision: { hlc, deviceId: 'phone', sequence: 1 }, source: 'inventory', name: id, type: 'charm',
    stats: { goldPerSec: 1 }, rollQuality: { goldPerSec: 0.5 }, sellValue: 10, location: { kind: 'bag' },
    ...extra,
  };
}

function stackRow(key: string): OwnedItemStack {
  return {
    id: `stack:${key}`, definitionId: key, kind: 'stack', category: 'materials', tags: ['material', key],
    soulbound: false, acquiredAt: '2026-08-01T00:00:00.000Z', revision: { hlc: 1, deviceId: 'phone', sequence: 1 },
    source: 'inventory', stackKey: key, location: { kind: 'bag' },
  };
}

function grant(id: string, key: string, quantity: number, hlc = 1, deviceId = 'phone'): InventoryStackOp {
  return { id, stackKey: key, kind: 'grant', quantity, hlc, deviceId, sequence: 1 };
}

function ledger(records: OwnedItemRecord[], stackOps: InventoryStackOp[] = []): InventoryLedger {
  const hlc = Math.max(0, ...records.map(r => r.revision.hlc), ...stackOps.map(o => o.hlc));
  return { version: 2, records, tombstones: [], stackOps, goldFromSales: 0, sold: 0, hlc, legacyBackup: null, era: INVENTORY_ERA };
}

const BASE: Capacity = capacityOf(() => 0);
const all = (satchel = SATCHEL_BASE_SLOTS): Capacity =>
  ({ satchel, tabs: new Set<VaultTabId>(['general-1', 'general-2', 'materials', 'supplies', 'gear', 'overflow']) });

describe('inventory-layout: classes', () => {
  it('classifies every placeable as a supply and every catalogued material as a material', () => {
    expect([...SUPPLY_KEYS].sort()).toEqual(PLACEABLES.map(p => p.id).sort());
    for (const p of PLACEABLES) expect(slotClassOf(p.id)).toBe('supply');
    for (const def of ITEM_DEFINITIONS) {
      if (def.family !== 'material') continue;
      expect(['material', 'quest']).toContain(slotClassOf(def.id));
    }
    expect(slotClassOf('kaels-hammer')).toBe('quest');
    expect(slotClassOf(SATCHEL_ROW_KEY)).toBe('entitlement');
    expect(slotClassOf('never-heard-of-it')).toBe('material');
  });

  it('caps blocks and materials at 999 and crafted supplies at 99', () => {
    expect(stackCapOf('dirt-block')).toBe(999);
    expect(stackCapOf('torch')).toBe(99);
    expect(stackCapOf('cinder-ore')).toBe(999);
  });

  it('reads capacity from entitlements, five rows at most', () => {
    expect(BASE.satchel).toBe(40);
    expect([...BASE.tabs].sort()).toEqual(['general-1', 'overflow']);
    const cap = capacityOf(key => (key === SATCHEL_ROW_KEY ? 9 : key === storageTabKey('materials') ? 1 : 0));
    expect(cap.satchel).toBe(80);
    expect(cap.tabs.has('materials')).toBeTrue();
  });

  it('keeps the record budget inside one Firestore document', () => {
    expect(INSTANCE_RECORD_BUDGET).toBe(700);
    // A worst-case tempered, socketed rare record, measured: ~0.85 KB each.
    const fat = instance('x', 1, {
      lore: 'x'.repeat(200), sockets: ['ash', 'ember', null], upgradeLevel: 9, reforgeCount: 3,
      lastUpgradeAt: new Date().toISOString(), lastUpgradeMutationId: 'm'.repeat(40),
      lastReforgeAt: new Date().toISOString(), lastReforgeMutationId: 'm'.repeat(40),
    });
    const bytes = JSON.stringify(fat).length * INSTANCE_RECORD_BUDGET;
    expect(bytes).toBeLessThan(800 * 1024);
  });

  it('deletes plain legacy Sigil records only — never a graded, tempered or socketed one', () => {
    const plain = (id: string) => instance(id, 1, { type: 'rune', name: 'Ash Sigil', stats: {}, rollQuality: undefined });
    const l = ledger([
      plain('s1'), plain('s2'),
      instance('graded', 1, { type: 'rune', name: 'Ash Sigil', stats: {}, rollQuality: { goldPerSec: 0.9 } }),
      instance('socketed', 1, { type: 'rune', name: 'Ash Sigil', stats: {}, rollQuality: undefined, sockets: ['ash'] }),
      instance('charm'),
    ]);
    expect(isLegacySigil(plain('x'))).toBeTrue();
    const out = dropLegacySigils(l, 'tab', 5000);
    expect(out.records.map(r => r.id).sort()).toEqual(['charm', 'graded', 'socketed']);
    expect(out.tombstones.map(t => t.id).sort()).toEqual(['s1', 's2']);
    expect(dropLegacySigils(out, 'tab', 6000)).toBe(out);
    // A device that still holds one merges it away.
    expect(mergeInventoryLedgers(out, l).records.some(r => r.id === 's1')).toBeFalse();
  });

  it('deletes Sigils of retired runes too (Mote, Seam, Ledger left the rune table after minting)', () => {
    const retired = ['Mote Sigil', 'Seam Sigil', 'Ledger Sigil'].map((name, i) =>
      instance(`r${i}`, 1, { type: 'rune', name, stats: {}, rollQuality: undefined }));
    const out = dropLegacySigils(ledger([...retired, instance('charm')]), 'tab', 5000);
    expect(out.records.map(r => r.id)).toEqual(['charm']);
    expect(isLegacySigil(instance('n', 1, { type: 'rune', name: 'Sigil of Dawn', stats: {}, rollQuality: undefined }))).toBeFalse();
  });

  it('names a Vault tab by owner id, and an unknown tab reads as Overflow', () => {
    expect(vaultTabOf({ kind: 'explorer', explorerId: vaultHolder('gear') })).toBe('gear');
    expect(vaultTabOf({ kind: 'explorer', explorerId: 'vault:attic' })).toBe('overflow');
    expect(vaultTabOf({ kind: 'explorer', explorerId: 'exp-1' })).toBeNull();
    expect(vaultTabOf({ kind: 'bag' })).toBeNull();
  });
});

describe('inventory-layout: layoutOf', () => {
  it('gives worn, lent and chest kit no slot', () => {
    const l = ledger([
      instance('a'),
      instance('b', 1, { location: { kind: 'equipped', slotId: 'head' } }),
      instance('c', 1, { location: { kind: 'explorer', explorerId: 'thr-1' } }),
      instance('d', 1, { location: { kind: 'explorer', explorerId: 'delve-chest:9' } }),
      instance('e', 1, { location: { kind: 'explorer', explorerId: vaultHolder('general-1') } }),
    ]);
    const out = layoutOf(l, BASE);
    expect(out.satchel.map(c => c.key)).toEqual(['a']);
    expect(out.tabs['general-1'].map(c => c.key)).toEqual(['e']);
    expect(out.satchelUsed).toBe(1);
  });

  it('places a stack whole: satchel when it fits, else General, else Overflow', () => {
    const items = Array.from({ length: 39 }, (_, i) => instance(`i${String(i).padStart(2, '0')}`));
    const l = ledger([...items, stackRow('cinder-ore'), stackRow('torch')], [
      grant('g1', 'cinder-ore', 1500), grant('g2', 'torch', 5),
    ]);
    const out = layoutOf(l, BASE);
    // Supplies place first: the torch takes the last satchel slot, the ore needs two.
    expect(out.satchel.find(c => c.key === 'torch')?.slots).toBe(1);
    expect(out.tabs['general-1'].find(c => c.key === 'cinder-ore')?.slots).toBe(2);
    expect(out.satchelUsed).toBe(40);
  });

  it('puts a kind in its owned affinity tab, and hides entitlements and quest items from slots', () => {
    const l = ledger([stackRow('void-shard'), stackRow(SATCHEL_ROW_KEY), stackRow('rift-key')], [
      grant('g1', 'void-shard', 5000), grant('g2', SATCHEL_ROW_KEY, 1), grant('g3', 'rift-key', 1),
    ]);
    const out = layoutOf(l, all());
    expect(out.tabs.materials.map(c => [c.key, c.quantity, c.slots])).toEqual([['void-shard', 5000, 0]]);
    expect(out.quest.map(c => c.key)).toEqual(['rift-key']);
    expect(out.satchel.length).toBe(0);
  });

  it('is independent of record order', () => {
    const records = [instance('a', 3), instance('b', 2), stackRow('cinder-ore'), stackRow('torch')];
    const ops = [grant('g1', 'cinder-ore', 3), grant('g2', 'torch', 2)];
    const one = layoutOf(ledger(records, ops), BASE);
    const two = layoutOf(ledger([...records].reverse(), [...ops].reverse()), BASE);
    expect(two).toEqual(one);
  });
});

describe('inventory-layout: routeFor + settle', () => {
  it('routes to Gear, then General with room, then Overflow', () => {
    const counts = { 'general-1': 0, 'general-2': 0, 'general-3': 0, 'general-4': 0, materials: 0, supplies: 0, gear: 0, overflow: 0 };
    expect(routeFor(counts, BASE)).toBe('general-1');
    expect(routeFor(counts, all())).toBe('gear');
    expect(routeFor({ ...counts, gear: 120 }, all())).toBe('general-1');
    expect(routeFor({ ...counts, 'general-1': 60 }, BASE)).toBe('overflow');
  });

  it('moves the most recently written bag instances over the cap, writes only location, and is idempotent', () => {
    const items = Array.from({ length: 45 }, (_, i) => instance(`i${i}`, 100 + i));
    const before = ledger(items);
    const { ledger: after, moved } = settle(before, BASE, 'tab', 5000);
    expect(moved.length).toBe(5);
    expect(moved.sort()).toEqual(['i40', 'i41', 'i42', 'i43', 'i44']);
    expect(after.records.length).toBe(45);
    for (const row of after.records) {
      const was = before.records.find(r => r.id === row.id)!;
      const { location: _a, revision: _b, ...rest } = row as OwnedItemInstance;
      const { location: _c, revision: _d, ...restWas } = was as OwnedItemInstance;
      expect(rest).toEqual(restWas);
    }
    expect(layoutOf(after, BASE).bagInstances).toBe(40);
    const again = settle(after, BASE, 'tab', 6000);
    expect(again.ledger).toBe(after);
    expect(again.moved).toEqual([]);
  });

  it('spills past General I into Overflow, and never past a full tab', () => {
    const items = Array.from({ length: 140 }, (_, i) => instance(`i${i}`, 100 + i));
    const { ledger: after } = settle(ledger(items), BASE, 'tab', 5000);
    const out = layoutOf(after, BASE);
    expect(out.bagInstances).toBe(40);
    expect(out.instancesIn['general-1']).toBe(60);
    expect(out.instancesIn.overflow).toBe(40);
  });
});

describe('inventory-layout: property — merge both orders, then settle, conserves everything', () => {
  /** Small deterministic PRNG so a failure reproduces. */
  function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
  }

  function device(name: string, r: () => number, shared: OwnedItemInstance[]): InventoryLedger {
    const records: OwnedItemRecord[] = [];
    for (const row of shared) if (r() < 0.7) records.push({ ...row, revision: { ...row.revision, hlc: row.revision.hlc + Math.floor(r() * 3) } });
    const own = Math.floor(r() * 300);
    for (let i = 0; i < own; i++) records.push(instance(`${name}-${i}`, 10 + Math.floor(r() * 1000)));
    const ops: InventoryStackOp[] = [];
    for (const key of ['cinder-ore', 'void-shard', 'torch']) {
      if (r() < 0.8) records.push(stackRow(key));
      const n = Math.floor(r() * 120);
      for (let i = 0; i < n; i++) ops.push(grant(`${name}:${key}:${i}`, key, 1 + Math.floor(r() * 50), 10 + i, name));
    }
    return ledger(records, ops);
  }

  function census(l: InventoryLedger): { ids: string[]; qty: Record<string, number> } {
    return {
      ids: l.records.filter(r => r.kind === 'instance').map(r => r.id).sort(),
      qty: Object.fromEntries(['cinder-ore', 'void-shard', 'torch'].map(k => [k, stackQuantityOf(l, k)])),
    };
  }

  it('over 40 random pairs of devices', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const r = rng(seed);
      const shared = Array.from({ length: 80 }, (_, i) => instance(`s${i}`, 5));
      const a = device('a', r, shared);
      const b = device('b', r, shared);
      const ab = mergeInventoryLedgers(a, b);
      const ba = mergeInventoryLedgers(b, a);
      const want = new Set([...a.records, ...b.records].filter(x => x.kind === 'instance').map(x => x.id));
      expect(census(ab).ids).toEqual([...want].sort());
      expect(census(ab)).toEqual(census(ba));
      for (const key of ['cinder-ore', 'void-shard', 'torch']) {
        expect(stackQuantityOf(ab, key)).toBe(stackQuantityOf(a, key) + stackQuantityOf(b, key));
      }

      const cap = ledgerCapacity(ab);
      const sa = settle(ab, cap, 'a', 1e6).ledger;
      const sb = settle(ba, cap, 'a', 1e6).ledger;
      expect(census(sa)).toEqual(census(ab));
      expect(census(sb)).toEqual(census(ab));
      // Settling then merging (each device settles its own copy) still conserves.
      const merged = mergeInventoryLedgers(settle(a, cap, 'a', 1e6).ledger, settle(b, cap, 'b', 1e6).ledger);
      expect(census(merged)).toEqual(census(ab));
      expect(layoutOf(sa, cap).bagInstances).toBeLessThanOrEqual(cap.satchel);
    }
  });
});
