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
  retireCharms,
  projectRunes,
  pruneTombstones,
  stackQuantity,
  tombstoneRecord,
} from './inventory-ops';
import {
  INVENTORY_BAG_CAP,
  INVENTORY_STACK_OPS_MAX,
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
      records: [instance('a', { revision: revision(8, 'phone', 2), location: { kind: 'equipped', slotId: 'head' } })],
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
      : null).toEqual({ kind: 'equipped', slotId: 'head' });
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
      location: { kind: 'equipped', slotId: 'head' },
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
    expect(live.location).toEqual({ kind: 'equipped', slotId: 'head' });
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

  it('does not evict worn, explorer, soulbound, zero-value, or stack records', () => {
    const worn = instance('worn', { location: { kind: 'equipped', slotId: 'head' }, sellValue: 1 });
    const carried = instance('carried', { location: { kind: 'explorer', explorerId: 'e1' }, sellValue: 1 });
    const bound = instance('bound', { soulbound: true, sellValue: 99 });
    const worthless = instance('worthless', { sellValue: 0 });
    const filler = Array.from({ length: INVENTORY_BAG_CAP }, (_, i) =>
      instance(`f${i}`, { sellValue: 50 + i, acquiredAt: `2026-01-01T00:00:00.00${String(i).padStart(1, '0')}Z` }));
    const merged = mergeInventoryLedgers(
      ledger({ records: [worn, carried, bound, worthless] }),
      ledger({ records: filler }),
    );
    const ids = new Set(merged.records.map(row => row.id));
    expect(ids.has('worn')).toBe(true);
    expect(ids.has('carried')).toBe(true);
    expect(ids.has('bound')).toBe(true);
    expect(ids.has('worthless')).toBe(true);
    expect(merged.records.length).toBeGreaterThanOrEqual(INVENTORY_BAG_CAP);
  });

  it('eviction tombstones block a stale pre-eviction copy', () => {
    const cheap = Array.from({ length: 180 }, (_, i) =>
      instance(`c${i}`, { sellValue: 1, acquiredAt: '2026-01-01T00:00:00.000Z', revision: revision(1, 'phone') }));
    const pricey = Array.from({ length: 180 }, (_, i) =>
      instance(`p${i}`, { sellValue: 80, acquiredAt: '2026-02-01T00:00:00.000Z', revision: revision(1, 'tablet') }));
    const merged = mergeInventoryLedgers(
      ledger({ records: cheap }),
      ledger({ records: pricey }),
    );
    expect(merged.records.length).toBe(INVENTORY_BAG_CAP);
    const evicted = cheap.find(row => !merged.records.some(kept => kept.id === row.id));
    expect(evicted).toBeTruthy();
    const stale = ledger({ records: [evicted!], hlc: 1 });
    const again = mergeInventoryLedgers(merged, stale);
    expect(again.records.find(row => row.id === evicted!.id)).toBeUndefined();
    expect(again.tombstones.find(row => row.id === evicted!.id)).toBeTruthy();
  });

  it('same-slot merge keeps the higher revision and is commutative', () => {
    const sword = instance('sword', {
      type: 'artifact',
      location: { kind: 'equipped', slotId: 'weapon' },
      revision: revision(4, 'phone'),
    });
    const hammer = instance('hammer', {
      type: 'artifact',
      location: { kind: 'equipped', slotId: 'weapon' },
      revision: revision(9, 'tablet'),
    });
    const ab = mergeInventoryLedgers(ledger({ records: [sword] }), ledger({ records: [hammer] }));
    const ba = mergeInventoryLedgers(ledger({ records: [hammer] }), ledger({ records: [sword] }));
    const loc = (id: string, blob: InventoryLedger) =>
      (blob.records.find(row => row.id === id) as OwnedItemInstance | undefined)?.location;
    expect(loc('hammer', ab)).toEqual({ kind: 'equipped', slotId: 'weapon' });
    expect(loc('sword', ab)).toEqual({ kind: 'bag' });
    expect(loc('hammer', ba)).toEqual(loc('hammer', ab));
    expect(loc('sword', ba)).toEqual(loc('sword', ab));
  });

  it('sell on A and equip on B merge both ways by revision', () => {
    const base = instance('helm', { type: 'artifact', revision: revision(1, 'seed') });
    const sold = tombstoneRecord(
      ledger({ records: [base], hlc: 8 }),
      'helm',
      revision(8, 'phone'),
      Date.now(),
    );
    const worn = ledger({
      records: [instance('helm', {
        type: 'artifact',
        location: { kind: 'equipped', slotId: 'head' },
        revision: revision(3, 'tablet'),
      })],
      hlc: 3,
    });
    const ab = mergeInventoryLedgers(sold, worn);
    const ba = mergeInventoryLedgers(worn, sold);
    expect(ab.records.find(row => row.id === 'helm')).toBeUndefined();
    expect(ba.records.find(row => row.id === 'helm')).toBeUndefined();
    expect(ab.tombstones.find(row => row.id === 'helm')?.revision.hlc).toBe(8);
    expect(ba.tombstones.find(row => row.id === 'helm')?.revision.hlc).toBe(8);
  });

  it('HLC order ignores acquiredAt and a future wall clock is still deterministic', () => {
    expect(compareRevision(revision(2, 'phone'), revision(9, 'tablet'))).toBeLessThan(0);
    const past = instance('ring', {
      revision: revision(80, 'phone'),
      acquiredAt: '2010-01-01T00:00:00.000Z',
      location: { kind: 'bag' },
    });
    const future = instance('ring', {
      revision: revision(20, 'tablet'),
      acquiredAt: '2040-01-01T00:00:00.000Z',
      location: { kind: 'equipped', slotId: 'head' },
    });
    const ab = mergeInventoryLedgers(ledger({ records: [past] }), ledger({ records: [future] }));
    const ba = mergeInventoryLedgers(ledger({ records: [future] }), ledger({ records: [past] }));
    expect((ab.records[0] as OwnedItemInstance).location).toEqual({ kind: 'bag' });
    expect((ba.records[0] as OwnedItemInstance).location).toEqual({ kind: 'bag' });
  });

  it('caps stack ops so the blob cannot grow without bound', () => {
    const ops = Array.from({ length: INVENTORY_STACK_OPS_MAX + 40 }, (_, i) => ({
      id: `grant:${i}`,
      stackKey: 'cinder-ore',
      kind: 'grant' as const,
      quantity: 1,
      hlc: i + 1,
      deviceId: 'phone',
      sequence: i + 1,
    }));
    const merged = mergeInventoryLedgers(ledger({ stackOps: ops.slice(0, 200) }), ledger({ stackOps: ops.slice(100) }));
    expect(merged.stackOps.length).toBe(INVENTORY_STACK_OPS_MAX);
    expect(merged.stackOps[0].id).toBe(`grant:${ops.length - INVENTORY_STACK_OPS_MAX}`);
  });

  it('repeated delivery of the same two ledgers does not duplicate items', () => {
    const a = ledger({ records: [instance('a')], goldFromSales: 4 });
    const b = ledger({ records: [instance('b')], goldFromSales: 9 });
    const once = mergeInventoryLedgers(a, b);
    const twice = mergeInventoryLedgers(once, mergeInventoryLedgers(b, a));
    expect(twice.records.map(row => row.id).sort()).toEqual(['a', 'b']);
    expect(twice.goldFromSales).toBe(9);
  });

  it('maps offhand to off-hand and bags retired charms', () => {
    const raw = {
      version: 2,
      records: [
        instance('blade', { type: 'artifact', location: { kind: 'equipped', slotId: 'offhand' as 'head' } }),
        instance('charm', { type: 'charm', location: { kind: 'equipped', slotId: 'charm1' as 'head' } }),
      ],
      tombstones: [], stackOps: [], goldFromSales: 0, sold: 0, hlc: 1, legacyBackup: null,
    };
    const parsed = coerceInventoryLedger(raw)!;
    const blade = parsed.records.find(row => row.id === 'blade') as OwnedItemInstance;
    const charm = parsed.records.find(row => row.id === 'charm') as OwnedItemInstance;
    expect(blade.location).toEqual({ kind: 'equipped', slotId: 'off-hand' });
    expect(charm.location).toEqual({ kind: 'bag' });
    const retired = retireCharms(parsed, 'phone', 1_000);
    expect(retired.retiredIds).toContain('charm');
    expect((retired.ledger.records.find(row => row.id === 'charm') as OwnedItemInstance).tags)
      .toContain('retired-charm');
    expect(retireCharms(retired.ledger, 'phone', 2_000).retiredIds).toEqual([]);
  });

  it('two devices retiring the same charm merge to one bagged tagged record', () => {
    const worn = instance('charm', {
      type: 'charm',
      location: { kind: 'equipped', slotId: 'charm1' as 'head' },
      revision: revision(1, 'seed'),
    });
    const raw = {
      version: 2,
      records: [worn],
      tombstones: [], stackOps: [], goldFromSales: 0, sold: 0, hlc: 1, legacyBackup: null,
    };
    const parsed = coerceInventoryLedger(raw)!;
    const phone = retireCharms(parsed, 'phone', 1_000);
    const tablet = retireCharms(parsed, 'tablet', 1_000);
    const ab = mergeInventoryLedgers(phone.ledger, tablet.ledger);
    const ba = mergeInventoryLedgers(tablet.ledger, phone.ledger);
    const loc = (blob: InventoryLedger) =>
      (blob.records.find(row => row.id === 'charm') as OwnedItemInstance).location;
    expect(loc(ab)).toEqual({ kind: 'bag' });
    expect(loc(ba)).toEqual({ kind: 'bag' });
    expect((ab.records[0] as OwnedItemInstance).tags).toContain('retired-charm');
    expect((ba.records[0] as OwnedItemInstance).tags).toContain('retired-charm');
    expect(ab.records.map(row => row.id)).toEqual(ba.records.map(row => row.id));
  });

  it('C4 offhand and C5 off-hand merge to the canonical slot both ways', () => {
    const c4 = {
      version: 2,
      records: [instance('blade', {
        type: 'artifact',
        location: { kind: 'equipped', slotId: 'offhand' as 'head' },
        revision: revision(2, 'phone'),
      })],
      tombstones: [], stackOps: [], goldFromSales: 0, sold: 0, hlc: 2, legacyBackup: null,
    };
    const c5 = {
      version: 2,
      records: [instance('blade', {
        type: 'artifact',
        location: { kind: 'equipped', slotId: 'off-hand' },
        revision: revision(3, 'tablet'),
      })],
      tombstones: [], stackOps: [], goldFromSales: 0, sold: 0, hlc: 3, legacyBackup: null,
    };
    const ab = mergeInventoryLedgers(c4, c5);
    const ba = mergeInventoryLedgers(c5, c4);
    const loc = (blob: InventoryLedger) =>
      (blob.records.find(row => row.id === 'blade') as OwnedItemInstance).location;
    expect(loc(ab)).toEqual({ kind: 'equipped', slotId: 'off-hand' });
    expect(loc(ba)).toEqual({ kind: 'equipped', slotId: 'off-hand' });
  });
});
