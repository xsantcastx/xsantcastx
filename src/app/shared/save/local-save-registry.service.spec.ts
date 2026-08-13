/**
 * local-save-registry.service.spec.ts — the seam, and the bug it exists for.
 *
 * The regression these tests own is the one that survived two attempted fixes,
 * because both of them fixed the merge and neither fixed the adoption:
 *
 *   Sign in on a second device. Cloud save reads both saves, merges them
 *   correctly, writes the merged blob to localStorage — and then the service that
 *   owns that blob writes its own pre-merge copy straight back over it, because
 *   nothing had told it the disk had moved. Both devices report "Synced". The
 *   Gold never crosses.
 *
 * The first two tests are the registry's own contract. The rest drive the real
 * `EconomyService` against a real localStorage and assert the property that
 * actually matters: after a rehydrate, every subsequent write must carry the
 * merged Gold. Testing "rehydrate re-reads" alone would pass against the broken
 * build too — the pre-merge value was always still in memory, waiting for the
 * next flush.
 */
import { TestBed } from '@angular/core/testing';
import { LocalSaveRegistry, SaveOwner } from './local-save-registry.service';
import { ECONOMY_KEY, EconomyService } from '../economy/economy.service';
import { emptyEconomy } from '../economy/economy.model';

describe('LocalSaveRegistry', () => {
  let registry: LocalSaveRegistry;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    registry = TestBed.inject(LocalSaveRegistry);
  });

  it('reports nothing to do for a key nobody owns', () => {
    expect(registry.hasOwner('nobody-owns-this')).toBe(false);
    // False is not a failure here — it is "no live service is holding a stale
    // copy", which is why cloud save no longer needs a reload as a fallback.
    expect(registry.rehydrate('nobody-owns-this')).toBe(false);
    // And flushing one is a no-op rather than a throw.
    expect(() => registry.flush('nobody-owns-this')).not.toThrow();
  });

  it('unregisters by identity, so a replaced owner cannot unclaim the live one', () => {
    const outgoing: SaveOwner = { rehydrate: () => { /* stale */ } };
    const incoming: SaveOwner = { rehydrate: () => { /* live */ } };

    registry.register('k', outgoing);
    registry.register('k', incoming);
    // The route's next component registered before the old one tore down. The
    // teardown must not take the live owner with it.
    registry.unregister('k', outgoing);

    expect(registry.hasOwner('k')).toBe(true);
  });

  it('survives an owner that throws, and reports the failure', () => {
    registry.register('k', {
      flush: () => { throw new Error('cannot write'); },
      rehydrate: () => { throw new Error('cannot read'); },
    });

    // One service failing must not abandon the sync for the other seventeen.
    expect(() => registry.flush('k')).not.toThrow();
    expect(registry.rehydrate('k')).toBe(false);
  });
});

describe('EconomyService cloud-save adoption', () => {
  let economy: EconomyService;
  let registry: LocalSaveRegistry;

  /** Write a ledger straight to disk, the way a second device would have left it. */
  function seedLedger(gold: number): void {
    localStorage.setItem(ECONOMY_KEY, JSON.stringify({
      ...emptyEconomy(),
      version: 2,
      gold,
      totalGoldEarned: gold,
      // Anchored to now, so hydration does not settle an offline span and pay
      // out idle Gold on top of the figure under test.
      lastIdleAt: Date.now(),
    }));
  }

  function goldOnDisk(): number {
    return JSON.parse(localStorage.getItem(ECONOMY_KEY) ?? '{}').gold;
  }

  beforeEach(() => {
    localStorage.removeItem(ECONOMY_KEY);
    TestBed.configureTestingModule({});
    registry = TestBed.inject(LocalSaveRegistry);
    economy = TestBed.inject(EconomyService);
  });

  afterEach(() => {
    localStorage.removeItem(ECONOMY_KEY);
  });

  it('claims its blob once hydrated, so cloud save knows it is holding one', () => {
    expect(registry.hasOwner(ECONOMY_KEY)).toBe(false);
    economy.init();
    expect(registry.hasOwner(ECONOMY_KEY)).toBe(true);
  });

  it('flushes the in-memory ledger, so a merge reads the current Gold', () => {
    seedLedger(100);
    economy.init();
    // Minted through the throttle rather than an immediate write: `earnGold`
    // calls `persistSoon`, so without a flush hook the disk lags memory by up to
    // five seconds and the merge would price the visitor's Gold from the past.
    economy.earnGold(50, 'test');

    registry.flush(ECONOMY_KEY);

    expect(goldOnDisk()).toBe(economy.snapshot.gold);
    expect(economy.snapshot.gold).toBeGreaterThanOrEqual(150);
  });

  it('adopts a merged ledger written underneath it', () => {
    seedLedger(0);
    economy.init();
    expect(economy.snapshot.gold).toBe(0);

    // What cloud save does: merge, write, rehydrate.
    seedLedger(1000);
    registry.rehydrate(ECONOMY_KEY);

    expect(economy.snapshot.gold).toBe(1000);
  });

  it('does not write the pre-merge Gold back on the next save — the actual bug', () => {
    seedLedger(0);
    economy.init();
    // Put a write in flight, which is the state the tab is really in: the idle
    // tick calls `persistSoon` once a second.
    economy.earnGold(5, 'test');

    seedLedger(1000);
    registry.rehydrate(ECONOMY_KEY);

    // The write that used to lose the merge. Under the old build this was
    // `pagehide` firing during `location.reload()`, and it wrote 5.
    economy.earnGold(1, 'test');
    (economy as unknown as { flush(): void }).flush();

    expect(goldOnDisk()).toBeGreaterThanOrEqual(1000);
    expect(economy.snapshot.gold).toBeGreaterThanOrEqual(1000);
  });

  it('leaves the ledger alone when the blob on disk is unreadable', () => {
    seedLedger(750);
    economy.init();

    localStorage.setItem(ECONOMY_KEY, '{ not json');
    registry.rehydrate(ECONOMY_KEY);

    // `load()` falls back to an empty ledger on a parse failure, so this asserts
    // the honest outcome rather than a pretended one: the Gold is not silently
    // kept, it is reset — and the *cloud* copy is still correct, which is what
    // the next reconciliation restores from. What must not happen is a throw
    // escaping into the sign-in path.
    expect(economy.snapshot.gold).toBe(0);
  });
});
