/**
 * cloud-save.sync.spec.ts — the reported bug, end to end.
 *
 * The complaint this exists for, in the words it was reported in: "Gold and other
 * data is STILL different between mobile and PC after signing into the same
 * account." It had survived two fixes, because both of them fixed the *merge* and
 * the merge was never the broken part. The reconciliation was correct, the cloud
 * document was correct, and the blob written to localStorage was correct — and
 * then the service that owned that blob wrote its own pre-merge copy back over
 * it, because nothing had told it the disk had moved.
 *
 * So this drives the real `CloudSaveService` and the real `EconomyService` through
 * the whole shape of the report:
 *
 *   1. earn Gold on device A, and let it push
 *   2. clear localStorage — a second device, same account
 *   3. bind again, which is what signing in does
 *   4. assert the Gold is *in the service*, not merely on disk
 *
 * Step 4 is the one that matters and the one that was missing. Asserting on
 * localStorage alone passes against the broken build: the merged blob really was
 * written there, and was then overwritten a second later by a ledger nobody had
 * refreshed.
 *
 * Firestore is faked because the real thing needs a Google sign-in this suite
 * cannot perform. Everything on this side of the network — the merge rules, the
 * adopt path, the registry, the ledger — is the shipping code.
 */
import { TestBed } from '@angular/core/testing';
import { LazyFirestoreService } from '../lazy-firestore.service';
import { EasterEggService } from '../easter-eggs/easter-egg.service';
import { ECONOMY_KEY, EconomyService } from '../economy/economy.service';
import { PROGRESS_KEY } from '../gamification/progress-storage.service';
import { XpService } from '../gamification/xp.service';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { CloudSaveService } from './cloud-save.service';
import { SYNCED_BLOBS } from './cloud-save.model';

/** Every key this suite touches, so one test cannot leak into the next. */
const ALL_KEYS = [PROGRESS_KEY, 'cloud-save-uid', ...SYNCED_BLOBS.map(b => b.key)];

/**
 * An in-memory stand-in for the slice of the Firestore API cloud save uses.
 *
 * Documents are keyed by path and deep-copied on the way in and out, so a test
 * cannot accidentally pass because two sides are sharing one object — which is
 * exactly the illusion a sync bug hides behind.
 */
class FakeFirestore {
  readonly docs = new Map<string, unknown>();
  /** Every path read, so a test can assert the read-skip did or did not fire. */
  readonly reads: string[] = [];

  readonly api = {
    doc: (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }),
    getDoc: async (ref: { path: string }) => {
      this.reads.push(ref.path);
      const held = this.docs.get(ref.path);
      return {
        exists: () => held !== undefined,
        data: () => copy(held),
      };
    },
    setDoc: async (ref: { path: string }, data: unknown) => {
      this.docs.set(ref.path, copy(data));
    },
    deleteDoc: async (ref: { path: string }) => {
      this.docs.delete(ref.path);
    },
  };

  get handle(): any {
    return { db: {}, api: this.api };
  }
}

function copy<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

/** Eggs reach for the network on `trigger`, which this suite has no use for. */
class FakeEggs {
  isFound(): boolean { return false; }
  async trigger(): Promise<void> { /* no-op */ }
  async init(): Promise<void> { /* no-op */ }
}

describe('cloud save — Gold across two devices', () => {
  let cloud: CloudSaveService;
  let economy: EconomyService;
  let xp: XpService;
  let registry: LocalSaveRegistry;
  let fake: FakeFirestore;

  /** What signing in does, minus the Google round trip `bind` never sees. */
  function bind(uid = 'test-uid'): Promise<void> {
    return (cloud as unknown as {
      bind(u: { uid: string; email: null; displayName: null; photoURL: null }): Promise<void>;
    }).bind({ uid, email: null, displayName: null, photoURL: null });
  }

  function pushAll(): Promise<void> {
    return (cloud as unknown as { pushAll(): Promise<void> }).pushAll();
  }

  function goldOnDisk(): number {
    return JSON.parse(localStorage.getItem(ECONOMY_KEY) ?? '{}').gold ?? 0;
  }

  beforeEach(() => {
    ALL_KEYS.forEach(k => localStorage.removeItem(k));
    sessionStorage.clear();
    fake = new FakeFirestore();

    TestBed.configureTestingModule({
      providers: [
        { provide: LazyFirestoreService, useValue: { get: async () => fake.handle } },
        { provide: EasterEggService, useValue: new FakeEggs() },
      ],
    });

    cloud = TestBed.inject(CloudSaveService);
    economy = TestBed.inject(EconomyService);
    xp = TestBed.inject(XpService);
    registry = TestBed.inject(LocalSaveRegistry);
  });

  afterEach(() => {
    // `bind` starts a ten-second push loop and window listeners.
    (cloud as unknown as { stopPushing(): void }).stopPushing();
    ALL_KEYS.forEach(k => localStorage.removeItem(k));
    sessionStorage.clear();
  });

  it('carries Gold from one device to the next', async () => {
    // ── Device A ───────────────────────────────────────────────────────────────
    economy.init();
    await xp.init();
    economy.earnGold(1000, 'test');
    expect(economy.snapshot.gold).toBeGreaterThanOrEqual(1000);

    await bind();
    await pushAll();

    // The ledger reached the cloud.
    const remote = fake.docs.get('users/test-uid/economy/state') as { v: { gold: number } };
    expect(remote.v.gold).toBeGreaterThanOrEqual(1000);

    // ── Device B: same account, nothing on disk ────────────────────────────────
    // A fresh TestBed rather than reusing the one above, because the second
    // device is a second set of services — reusing them would leave the ledger
    // already holding 1000 and the test would prove nothing.
    TestBed.resetTestingModule();
    ALL_KEYS.forEach(k => localStorage.removeItem(k));
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: LazyFirestoreService, useValue: { get: async () => fake.handle } },
        { provide: EasterEggService, useValue: new FakeEggs() },
      ],
    });
    const cloudB = TestBed.inject(CloudSaveService);
    const economyB = TestBed.inject(EconomyService);
    const xpB = TestBed.inject(XpService);

    economyB.init();
    await xpB.init();
    expect(economyB.snapshot.gold).toBe(0);

    await (cloudB as unknown as {
      bind(u: { uid: string; email: null; displayName: null; photoURL: null }): Promise<void>;
    }).bind({ uid: 'test-uid', email: null, displayName: null, photoURL: null });

    // The assertion the old build failed. Not "is it on disk" — is it in the
    // service the Flame, the Market and the currency rail all render from.
    expect(economyB.snapshot.gold).toBeGreaterThanOrEqual(1000);
    expect(goldOnDisk()).toBeGreaterThanOrEqual(1000);

    (cloudB as unknown as { stopPushing(): void }).stopPushing();
  });

  it('keeps the adopted Gold through the next write, which is where it used to go', async () => {
    fake.docs.set('users/test-uid/economy/state', {
      v: { version: 2, gold: 5000, totalGoldEarned: 5000, lastIdleAt: Date.now() },
      updatedAt: new Date().toISOString(),
    });

    economy.init();
    await xp.init();
    await bind();

    expect(economy.snapshot.gold).toBeGreaterThanOrEqual(5000);

    // The write that used to lose it. On the old build this was `pagehide` firing
    // inside `location.reload()`, flushing a ledger that still held 0.
    economy.earnGold(1, 'test');
    (economy as unknown as { flush(): void }).flush();

    expect(goldOnDisk()).toBeGreaterThanOrEqual(5000);
    expect(economy.snapshot.gold).toBeGreaterThanOrEqual(5000);
  });

  it('adopts Gold that lands in the cloud mid-session, on the push loop', async () => {
    economy.init();
    await xp.init();
    await bind();
    await pushAll();

    // A phone banks 900 Gold while this tab sits open. Nothing here has reloaded.
    fake.docs.set('users/test-uid/economy/state', {
      v: { version: 2, gold: 900, totalGoldEarned: 900, lastIdleAt: Date.now() },
      updatedAt: new Date().toISOString(),
    });

    // Something moves on this device, so the loop has a reason to look at the blob.
    economy.earnGold(10, 'test');
    await pushAll();

    // Before this change `pushAll` deliberately left the merged result in the
    // cloud — correct for a build whose services could not be refreshed, and the
    // reason a desktop tab left open all day never saw the phone's evening.
    expect(economy.snapshot.gold).toBeGreaterThanOrEqual(900);
  });

  it('does not reload the tab to adopt', async () => {
    fake.docs.set('users/test-uid/economy/state', {
      v: { version: 2, gold: 2500, totalGoldEarned: 2500, lastIdleAt: Date.now() },
      updatedAt: new Date().toISOString(),
    });

    economy.init();
    await xp.init();
    await bind();

    // The old adopt path set this flag immediately before calling
    // `location.reload()`. Nothing writes it any more, and its absence is the
    // cheapest available proof that adoption happened in place.
    expect(sessionStorage.getItem('cloud-save-adopted')).toBeNull();
    expect(economy.snapshot.gold).toBeGreaterThanOrEqual(2500);
  });

  it('leaves every owner registered holding what is on disk after a bind', async () => {
    economy.init();
    await xp.init();
    await bind();

    // The contract the registry exists to keep. Both blobs that clobbered the
    // merge on the old build are claimed by the time a bind completes.
    expect(registry.hasOwner(ECONOMY_KEY)).toBe(true);
    expect(registry.hasOwner(PROGRESS_KEY)).toBe(true);
  });
});
