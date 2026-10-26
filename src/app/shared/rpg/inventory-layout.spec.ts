import { mergeInventoryLedgers, stackQuantityOf } from './inventory-ops';
import {
  INSTANCE_RECORD_BUDGET,
  SATCHEL_BASE_SLOTS,
  SATCHEL_ROW_KEY,
  SUPPLY_KEYS,
  capacityOf,
  dropLegacySigils,
  isLegacySigil,
  ledgerCapacity,
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

