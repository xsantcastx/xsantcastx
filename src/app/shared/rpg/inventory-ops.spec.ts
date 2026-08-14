import type { GameItem } from './item.model';
import {
  applyStackOp,
  coerceInventoryLedger,
  compareRevision,
  dropLegacyBackup,
  itemsFromLedger,
  mergeInventoryLedgers,
  migrateV1,
  parseInventoryLedger,
  projectEconomy,
  projectRunes,
  pruneTombstones,
  stackQuantity,
  tombstoneRecord,
} from './inventory-ops';
import {
  INVENTORY_TOMBSTONE_RETAIN_MS,
  type InventoryLedger,
  type InventoryRevision,
  type OwnedItemInstance,
} from './inventory.model';

function item(id: string, extra: Partial<GameItem> = {}): GameItem {
  return {
    id,
    name: id,
    type: 'charm',
    rarity: 'common',
    stats: { goldPerSec: 1 },
    sellValue: 10,
    equipped: false,
    foundAt: '2026-08-01T00:00:00.000Z',
    soulbound: false,
    ...extra,
  };
}

function revision(hlc: number, deviceId = 'phone', sequence = 1): InventoryRevision {
  return { hlc, deviceId, sequence };
}

function instance(
  id: string,
  extra: Partial<OwnedItemInstance> = {},
): OwnedItemInstance {
  return {
    id,
    definitionId: `charm:${id}`,
    kind: 'instance',
    category: 'equipment',
    tags: ['charm'],
    rarity: 'common',
    soulbound: false,
    acquiredAt: '2026-08-01T00:00:00.000Z',
    revision: revision(1),
    source: 'inventory',
    name: id,
    type: 'charm',
    stats: {},
    sellValue: 10,
    location: { kind: 'bag' },
    ...extra,
  };
}

function ledger(partial: Partial<InventoryLedger> = {}): InventoryLedger {
  return {
    version: 2,
    records: [],
    tombstones: [],
    stackOps: [],
    goldFromSales: 0,
    sold: 0,
    hlc: 0,
    legacyBackup: null,
    ...partial,
  };
}

describe('inventory adapter (C3)', () => {
  it('migrates a v1 bag idempotently and keeps a rollback copy', () => {
    const v1 = { version: 1 as const, items: [item('sword', { type: 'artifact', name: 'Blade' })], goldFromSales: 40, sold: 2 };
    const first = migrateV1(v1);
    const again = migrateV1(v1);
    expect(first.version).toBe(2);
    expect(first.legacyBackup).toEqual(v1);
    expect(first.records[0].id).toBe('sword');
    expect(first.records[0].location).toEqual({ kind: 'bag' });
    expect(first.goldFromSales).toBe(40);
    expect(itemsFromLedger(first).map(row => row.id)).toEqual(itemsFromLedger(again).map(row => row.id));
    expect(first.records[0].revision).toEqual(again.records[0].revision);
  });

  it('restores a corrupt v2 from its legacy backup', () => {
    const v1 = { version: 1 as const, items: [item('kept')], goldFromSales: 3, sold: 1 };
    const broken = { version: 2, records: 'nope', legacyBackup: v1 };
    const restored = coerceInventoryLedger(broken);
    expect(restored?.records.map(row => row.id)).toEqual(['kept']);
    expect(restored?.legacyBackup?.items[0].id).toBe('kept');
  });

  it('returns empty on unrecoverable garbage', () => {
    const skipped = parseInventoryLedger({ version: 2, records: [{ id: 1 }] });
    expect(skipped?.records).toEqual([]);
    expect(coerceInventoryLedger('???')).toBeNull();
  });

  it('drops the backup only after a successful cloud adopt', () => {
    const migrated = migrateV1({ version: 1, items: [item('a')], goldFromSales: 0, sold: 0 });
    expect(migrated.legacyBackup).not.toBeNull();
    expect(dropLegacyBackup(migrated).legacyBackup).toBeNull();
  });

  it('merge is commutative, associative, and idempotent', () => {
    const a = ledger({ records: [instance('a', { revision: revision(5, 'phone') })], hlc: 5 });
    const b = ledger({ records: [instance('b', { revision: revision(6, 'tablet') })], hlc: 6 });
    const c = ledger({
      records: [instance('a', { revision: revision(8, 'phone', 2), location: { kind: 'equipped', slotId: 'charm1' } })],
      hlc: 8,
    });
    const ab = mergeInventoryLedgers(a, b);
    const ba = mergeInventoryLedgers(b, a);
    expect(ab.records.map(row => row.id).sort()).toEqual(ba.records.map(row => row.id).sort());
    const abc = mergeInventoryLedgers(ab, c);
    const bca = mergeInventoryLedgers(mergeInventoryLedgers(b, c), a);
    expect(abc.records.find(row => row.id === 'a')?.kind === 'instance'
      && abc.records.find(row => row.id === 'a')?.kind === 'instance'
      ? (abc.records.find(row => row.id === 'a') as OwnedItemInstance).location
      : null).toEqual({ kind: 'equipped', slotId: 'charm1' });
    expect(bca.records.map(row => row.id).sort()).toEqual(abc.records.map(row => row.id).sort());
    expect(mergeInventoryLedgers(ab, ab).records.length).toBe(ab.records.length);
  });

  it('sell versus equip: the higher revision wins the whole record', () => {
    const equipped = ledger({
      records: [instance('helm', {
        type: 'artifact',
        location: { kind: 'equipped', slotId: 'head' },
        revision: revision(10, 'phone'),
      })],
      hlc: 10,
    });
    const sold = tombstoneRecord(
      ledger({ records: [instance('helm')], hlc: 20 }),
      'helm',
      revision(20, 'tablet'),
      1_000,
    );
    const ab = mergeInventoryLedgers(equipped, sold);
    const ba = mergeInventoryLedgers(sold, equipped);
    expect(ab.records.find(row => row.id === 'helm')).toBeUndefined();
    expect(ba.records.find(row => row.id === 'helm')).toBeUndefined();
    expect(ab.tombstones.find(row => row.id === 'helm')?.revision.hlc).toBe(20);
  });

  it('an older sell cannot unequip a later revision', () => {
    const equipped = ledger({
      records: [instance('helm', {
        type: 'artifact',
        location: { kind: 'equipped', slotId: 'head' },
        revision: revision(30, 'phone'),
      })],
      hlc: 30,
    });
    const sold = tombstoneRecord(ledger({ hlc: 5 }), 'helm', revision(5, 'tablet'), 1);
    const merged = mergeInventoryLedgers(equipped, sold);
    const live = merged.records.find(row => row.id === 'helm') as OwnedItemInstance;
    expect(live.location).toEqual({ kind: 'equipped', slotId: 'head' });
  });

  it('clock skew does not beat a lower HLC', () => {
    const earlier = instance('ring', {
      revision: revision(50, 'phone'),
      location: { kind: 'equipped', slotId: 'charm1' },
      acquiredAt: '2020-01-01T00:00:00.000Z',
    });
    const skewed = instance('ring', {
      revision: revision(10, 'tablet'),
      location: { kind: 'bag' },
      acquiredAt: '2035-01-01T00:00:00.000Z',
    });
    const merged = mergeInventoryLedgers(
      ledger({ records: [earlier], hlc: 50 }),
      ledger({ records: [skewed], hlc: 10 }),
    );
    const live = merged.records[0] as OwnedItemInstance;
    expect(live.location).toEqual({ kind: 'equipped', slotId: 'charm1' });
    expect(compareRevision(skewed.revision, earlier.revision)).toBeLessThan(0);
  });

  it('a tombstone blocks a stale device from resurrecting a sold item', () => {
    const sold = tombstoneRecord(ledger({ hlc: 12 }), 'gone', revision(12, 'phone'), 2_000);
    const stale = ledger({ records: [instance('gone', { revision: revision(3, 'tablet') })], hlc: 3 });
    const ab = mergeInventoryLedgers(sold, stale);
    const ba = mergeInventoryLedgers(stale, sold);
    expect(ab.records.find(row => row.id === 'gone')).toBeUndefined();
    expect(ba.records.find(row => row.id === 'gone')).toBeUndefined();
    expect(mergeInventoryLedgers(ab, stale).records.find(row => row.id === 'gone')).toBeUndefined();
  });

  it('stack quantity is derived from idempotent grant/consume ids', () => {
    const grant = {
      id: 'grant:cinder:1', stackKey: 'cinder-ore', kind: 'grant' as const,
      quantity: 6, hlc: 1, deviceId: 'phone', sequence: 1,
    };
    const consume = {
      id: 'consume:cinder:1', stackKey: 'cinder-ore', kind: 'consume' as const,
      quantity: 6, hlc: 2, deviceId: 'phone', sequence: 2,
    };
    const once = applyStackOp(applyStackOp([], grant), grant);
    expect(once.length).toBe(1);
    expect(stackQuantity(once, 'cinder-ore')).toBe(6);
    const spent = applyStackOp(once, consume);
    expect(stackQuantity(spent, 'cinder-ore')).toBe(0);
    const merged = mergeInventoryLedgers(
      ledger({ stackOps: spent }),
      ledger({ stackOps: [grant, consume, grant] }),
    );
    expect(stackQuantity(merged.stackOps, 'cinder-ore')).toBe(0);
  });

  it('projects Economy artifacts and cosmetics without writing them as bag items', () => {
    const projected = projectEconomy({ artifacts: ['obsidian-heart'], cosmetics: ['ember-cloak'] });
    expect(projected.map(row => row.id)).toEqual([
      'econ:artifact:obsidian-heart',
      'econ:cosmetic:ember-cloak',
    ]);
    expect(projected.every(row => row.source === 'economy' && row.soulbound)).toBe(true);
    const ledgerState = ledger({ records: [instance('drop')] });
    expect(itemsFromLedger(ledgerState).map(row => row.id)).toEqual(['drop']);
  });

  it('projects the rune ledger as adapter-owned stacks and keeps the source key', () => {
    const projected = projectRunes({ runes: { ash: 3, ember: 0 }, runewords: ['cinder-bind'] });
    expect(projected.find(row => row.id === 'rune:ash')?.kind).toBe('stack');
    expect(projected.find(row => row.id === 'runeword:cinder-bind')?.source).toBe('runes');
    expect(projected.find(row => row.id === 'rune:ember')).toBeUndefined();
  });

  it('prunes tombstones after the retain window and keeps a hard cap', () => {
    const now = 10_000 + INVENTORY_TOMBSTONE_RETAIN_MS;
    const expired = pruneTombstones(
      [{ id: 'old', revision: revision(1), deletedAt: 1 }],
      now,
    );
    expect(expired.find(row => row.id === 'old')).toBeUndefined();
    const many = Array.from({ length: 300 }, (_, i) => ({
      id: `t${i}`,
      revision: revision(i),
      deletedAt: now - 1,
    }));
    expect(pruneTombstones(many, now).length).toBe(256);
  });

  it('repeated delivery of the same two ledgers does not duplicate items', () => {
    const a = ledger({ records: [instance('a')], goldFromSales: 4 });
    const b = ledger({ records: [instance('b')], goldFromSales: 9 });
    const once = mergeInventoryLedgers(a, b);
    const twice = mergeInventoryLedgers(once, mergeInventoryLedgers(b, a));
    expect(twice.records.map(row => row.id).sort()).toEqual(['a', 'b']);
    expect(twice.goldFromSales).toBe(9);
  });
});
