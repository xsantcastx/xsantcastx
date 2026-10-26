/**
 * inventory-sockets.spec.ts — sockets are merge-safe (docs/design/runewords.md §4): a well set on either device
 * stays set whichever copy of the record wins, and a rune two devices set into the same well offline is refunded,
 * once, so nothing is lost. The packed v3 format carries the wells (`so`), empty ones included.
 */
import type { GameItem } from './item.model';
import type { InventoryLedger, OwnedItemInstance } from './inventory.model';
import { applyStackOp, emptyInventoryLedger, itemToRecord, mergeInventoryLedgers, socketOpId, socketRefunds, stackQuantityOf } from './inventory-ops';
import { runeStackKey } from '../rune-forge/rune-stack';

const base: GameItem = {
  id: 'staff-1', name: 'Keeper Staff', type: 'artifact', rarity: 'common', stats: {}, sellValue: 5, equipped: false,
  foundAt: '2026-10-26T00:00:00.000Z', soulbound: false, definitionId: 'keeper-staff', sockets: [null, null],
};

function rec(sockets: (string | null)[], hlc: number, deviceId: string): OwnedItemInstance {
  return { ...itemToRecord({ ...base, sockets }), revision: { hlc, deviceId, sequence: 1 } };
}

function ledger(records: OwnedItemInstance[], ops: { id: string; kind: 'grant' | 'consume'; qty: number; key: string; hlc: number }[] = []): InventoryLedger {
  let stackOps = emptyInventoryLedger().stackOps;
  for (const o of ops) stackOps = applyStackOp(stackOps, { id: o.id, stackKey: o.key, kind: o.kind, quantity: o.qty, hlc: o.hlc, deviceId: 'd', sequence: 1 });
  return { ...emptyInventoryLedger(), records, stackOps, hlc: 100 };
}

describe('sockets merge-safe', () => {
  const ash = runeStackKey('ash'), ember = runeStackKey('ember');

  it('keeps a well set on the older copy when the newer copy won (a temper elsewhere)', () => {
    const a = ledger([rec(['ember', null], 10, 'a')]);
    const b = ledger([rec([null, null], 20, 'b')]);
    for (const merged of [mergeInventoryLedgers(a, b), mergeInventoryLedgers(b, a)]) {
      const r = merged.records.find(x => x.id === 'staff-1') as OwnedItemInstance;
      expect(r.sockets).toEqual(['ember', null]);
    }
  });

  it('unions two devices that filled different wells', () => {
    const a = ledger([rec(['ember', null], 10, 'a')]);
    const b = ledger([rec([null, 'drift'], 20, 'b')]);
    const r = mergeInventoryLedgers(a, b).records.find(x => x.id === 'staff-1') as OwnedItemInstance;
    expect(r.sockets).toEqual(['ember', 'drift']);
  });

  it('refunds the losing rune of two set into one well, once', () => {
    const a = ledger([rec(['ash', null], 10, 'a')], [
      { id: 'g-ash', kind: 'grant', qty: 1, key: ash, hlc: 1 },
      { id: socketOpId('staff-1', 0, 'ash'), kind: 'consume', qty: 1, key: ash, hlc: 10 },
    ]);
    const b = ledger([rec(['ember', null], 20, 'b')], [
      { id: 'g-ember', kind: 'grant', qty: 1, key: ember, hlc: 1 },
      { id: socketOpId('staff-1', 0, 'ember'), kind: 'consume', qty: 1, key: ember, hlc: 20 },
    ]);
    const merged = mergeInventoryLedgers(a, b);
    const r = merged.records.find(x => x.id === 'staff-1') as OwnedItemInstance;
    expect(r.sockets).toEqual(['ember', null]);
    const refunds = socketRefunds(merged);
    expect(refunds).toEqual([{ id: `sockback:${socketOpId('staff-1', 0, 'ash')}`, stackKey: ash }]);
    // Applied, the Ash comes back, and asking again refunds nothing more.
    let ops = merged.stackOps;
    for (const f of refunds) ops = applyStackOp(ops, { id: f.id, stackKey: f.stackKey, kind: 'grant', quantity: 1, hlc: 30, deviceId: 'c', sequence: 1 });
    const healed = { ...merged, stackOps: ops };
    expect(stackQuantityOf(healed, ash)).toBe(1);
    expect(stackQuantityOf(healed, ember)).toBe(0);
    expect(socketRefunds(healed)).toEqual([]);
  });

  it('refunds nothing when the rune sits where its op says', () => {
    const l = ledger([rec(['ash', null], 10, 'a')], [
      { id: 'g', kind: 'grant', qty: 1, key: ash, hlc: 1 },
      { id: socketOpId('staff-1', 0, 'ash'), kind: 'consume', qty: 1, key: ash, hlc: 10 },
    ]);
    expect(socketRefunds(l)).toEqual([]);
  });
});
