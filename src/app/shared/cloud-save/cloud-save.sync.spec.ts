/**
 * cloud-save.sync.spec.ts — the save, end to end, across two devices.
 *
 * These tests drive the real `GameStateGateway`, the real `EconomyService` and
 * the real `XpService` against an in-memory Firestore. Everything on this side
 * of the network is shipping code; only the SDK is faked, because the real one
 * needs a Google sign-in a headless suite cannot perform.
 *
 * The property under test has not changed even though the architecture has: a
 * visitor's Gold has to be the same number on their phone and on their PC, and
 * it has to still be that number after the next thing they do. What changed is
 * where that is decided — the gateway is the record now, and localStorage is its
 * cache — so these also pin the parts of "source of truth" that are easy to
 * write and hard to notice going wrong: that a pull actually reaches the live
 * services, that a flush batches instead of writing nineteen documents, that a
 * refused write does not take the other eighteen down with it, and that being
 * offline degrades to the local-only game rather than to a broken one.
 */
import { TestBed } from '@angular/core/testing';
import { LazyFirestoreService } from '../lazy-firestore.service';
import { EasterEggService } from '../easter-eggs/easter-egg.service';
import { ECONOMY_KEY, EconomyService } from '../economy/economy.service';
import { PROGRESS_KEY } from '../gamification/progress-storage.service';
import { XpService } from '../gamification/xp.service';
import { GameStateGateway, STATE_ENTRIES } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';

const ALL_KEYS = [...STATE_ENTRIES.map(e => e.key), 'cloud-save-uid'];

/**
 * The slice of the Firestore API the gateway uses, in memory.
 *
 * Documents are deep-copied in and out so a test cannot pass because two sides
 * happen to share one object — which is precisely the illusion a sync bug hides
 * behind. Every call is counted, because several of the properties under test
 * are about *how many* round trips happen rather than about the data.
 */
class FakeFirestore {
  readonly docs = new Map<string, unknown>();
  readonly counts = { getDoc: 0, getDocs: 0, setDoc: 0, batch: 0, batchWrites: 0, deleteDoc: 0, transaction: 0 };
  /** Paths that refuse writes, standing in for a security rule. */
  readonly refuse = new Set<string>();
  /** When set, every network call rejects — the offline case. */
  down = false;

  readonly api = {
    doc: (_db: unknown, ...seg: string[]) => ({ path: seg.join('/') }),
    collection: (_db: unknown, ...seg: string[]) => ({ path: seg.join('/') }),

    getDoc: async (ref: { path: string }) => {
      this.guard();
      this.counts.getDoc++;
      const held = this.docs.get(ref.path);
      return { exists: () => held !== undefined, data: () => copy(held) };
    },

    getDocs: async (ref: { path: string }) => {
      this.guard();
      this.counts.getDocs++;
      const prefix = ref.path + '/';
      const hits = [...this.docs.entries()].filter(([p]) => p.startsWith(prefix));
      return {
        forEach: (fn: (d: { id: string; data: () => unknown }) => void) =>
          hits.forEach(([p, v]) => fn({ id: p.slice(prefix.length), data: () => copy(v) })),
      };
    },

    setDoc: async (ref: { path: string }, data: unknown) => {
      this.guard();
      this.counts.setDoc++;
      this.commit(ref.path, data);
    },

    deleteDoc: async (ref: { path: string }) => {
      this.guard();
      this.counts.deleteDoc++;
      this.docs.delete(ref.path);
    },

    writeBatch: (_db: unknown) => {
      const staged: { path: string; data: unknown }[] = [];
      return {
        set: (ref: { path: string }, data: unknown) => { staged.push({ path: ref.path, data }); },
        commit: async () => {
          this.guard();
          this.counts.batch++;
          // Atomic, like the real thing: one refusal fails the whole batch and
          // nothing is written. This is the behaviour the per-document retry
          // exists to survive.
          for (const w of staged) {
            if (this.refuse.has(w.path)) throw Object.assign(new Error('refused'), { code: 'permission-denied' });
          }
          this.counts.batchWrites += staged.length;
          for (const w of staged) this.commit(w.path, w.data);
        },
      };
    },

    runTransaction: async (_db: unknown, fn: (tx: {
      get: (ref: { path: string }) => Promise<{ exists: () => boolean; data: () => unknown }>;
      set: (ref: { path: string }, data: unknown) => void;
    }) => Promise<void>) => {
      this.guard();
      this.counts.transaction++;
      const staged = new Map<string, unknown>();
      const seen = new Map<string, unknown>();
      const tx = {
        get: async (ref: { path: string }) => {
          this.guard();
          this.counts.getDoc++;
          const held = this.docs.get(ref.path);
          seen.set(ref.path, held);
          return { exists: () => held !== undefined, data: () => copy(held) };
        },
        set: (ref: { path: string }, data: unknown) => {
          staged.set(ref.path, copy(data));
        },
      };
      await fn(tx);
      for (const [path] of seen) {
        const now = this.docs.get(path);
        if (JSON.stringify(now) !== JSON.stringify(seen.get(path))) {
          throw Object.assign(new Error('aborted'), { code: 'aborted' });
        }
      }
      for (const [path, data] of staged) this.commit(path, data);
    },
  };

  private guard(): void {
    if (this.down) throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
  }

  private commit(path: string, data: unknown): void {
    if (this.refuse.has(path)) {
      throw Object.assign(new Error('refused'), { code: 'permission-denied' });
    }
    this.docs.set(path, copy(data));
  }

  get handle(): any { return { db: {}, api: this.api }; }

  /** The gold stored in the ledger document, or null. */
  goldInCloud(uid = 'u1'): number | null {
    const d = this.docs.get(`users/${uid}/economy/state`) as { v?: { gold?: number } } | undefined;
    return d?.v?.gold ?? null;
  }

  seedGold(gold: number, uid = 'u1'): void {
    this.docs.set(`users/${uid}/economy/state`, {
      v: { version: 2, gold, totalGoldEarned: gold, lastIdleAt: Date.now() },
      updatedAt: new Date().toISOString(),
    });
  }
}

function copy<T>(v: T): T {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

/** Eggs reach for the network on trigger, which none of this needs. */
class FakeEggs {
  isFound(): boolean { return false; }
  async trigger(): Promise<void> { /* no-op */ }
  async init(): Promise<void> { /* no-op */ }
}

describe('cloud save — Firestore as the record', () => {
  let fake: FakeFirestore;

  /**
   * Stand up one device's services.
   *
   * Deliberately does *not* reset the TestBed — see {@link teardownDevice}. The
   * two steps are separate because the order between them is the difference
   * between a real test and one that quietly tests nothing.
   */
  function build() {
    TestBed.configureTestingModule({
      providers: [
        { provide: LazyFirestoreService, useValue: { get: async () => fake.handle } },
        { provide: EasterEggService, useValue: new FakeEggs() },
      ],
    });
    return {
      gateway: TestBed.inject(GameStateGateway),
      economy: TestBed.inject(EconomyService),
      xp: TestBed.inject(XpService),
      registry: TestBed.inject(LocalSaveRegistry),
    };
  }

  /**
   * Destroy the current device's services, then wipe its storage.
   *
   * The order matters and is the whole reason this is a named function.
   * `resetTestingModule()` destroys the providers, and `EconomyService`
   * implements `OnDestroy` by flushing its in-memory ledger — so wiping storage
   * first and resetting second puts the ledger straight back, and the "second
   * device" starts with the first device's Gold already on disk. The test then
   * passes without ever having proved that anything came down from the cloud.
   *
   * Two real browsers cannot do this to each other. The harness can, and did.
   */
  function teardownDevice(): void {
    TestBed.resetTestingModule();
    localStorage.clear();
  }

  function goldOnDisk(): number {
    return JSON.parse(localStorage.getItem(ECONOMY_KEY) ?? '{}').gold ?? 0;
  }

  beforeEach(() => {
    // Reset before clearing, for the reason `teardownDevice` documents: the
    // previous spec's services flush on destroy.
    TestBed.resetTestingModule();
    localStorage.clear();
    sessionStorage.clear();
    fake = new FakeFirestore();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // The property the last three releases were spent on
  // ───────────────────────────────────────────────────────────────────────────

  it('carries Gold from one device to the next', async () => {
    const a = build();
    a.economy.init();
    await a.xp.init();
    a.economy.earnGold(1000, 'test');

    await a.gateway.attach('u1', fake.handle);
    await a.gateway.flushNow();
    expect(fake.goldInCloud()).toBeGreaterThanOrEqual(1000);

    // A second device: same account, nothing on disk, its own services.
    teardownDevice();
    const b = build();
    b.economy.init();
    await b.xp.init();
    expect(localStorage.getItem(ECONOMY_KEY)).toBeNull();
    expect(b.economy.snapshot.gold).toBe(0);

    await b.gateway.attach('u1', fake.handle);

    // In the service the Flame and the Market render from — not merely on disk,
    // which is the assertion that passed against every broken version of this.
    expect(b.economy.snapshot.gold).toBeGreaterThanOrEqual(1000);
    expect(goldOnDisk()).toBeGreaterThanOrEqual(1000);
  });

  it('replays two devices spending the same pile without minting Gold', async () => {
    fake.seedGold(1000);
    const a = build();
    a.economy.init();
    await a.xp.init();
    await a.gateway.attach('u1', fake.handle);
    expect(a.economy.snapshot.gold).toBeGreaterThanOrEqual(1000);

    // Device A spends 700 of the shared 1,000.
    expect(a.economy.spendGold(700, 'test')).toBe(true);
    (a.economy as unknown as { flush(): void }).flush();
    await a.gateway.flushNow();

    teardownDevice();
    localStorage.setItem('godforge-device-id', 'device-b');
    const b = build();
    b.economy.init();
    await b.xp.init();
    // Device B still thinks the pile is 1,000 and spends 500 before it pulls.
    b.economy.earnGold(1000, 'test');
    (b.economy as unknown as { flush(): void }).flush();
    expect(b.economy.spendGold(500, 'test')).toBe(true);
    (b.economy as unknown as { flush(): void }).flush();
    await b.gateway.attach('u1', fake.handle);

    const gold = b.economy.snapshot.gold;
    // Conservation: cannot hold 700+500=1,200 of spend against a 1,000 pile.
    expect(gold).toBeLessThan(1000);
    expect(gold).toBeGreaterThanOrEqual(0);
    expect(goldOnDisk()).toBe(gold);
  });

  it('keeps the pulled Gold through the next write', async () => {
    fake.seedGold(5000);
    const { gateway, economy, xp } = build();
    economy.init();
    await xp.init();
    await gateway.attach('u1', fake.handle);

    expect(economy.snapshot.gold).toBeGreaterThanOrEqual(5000);

    economy.earnGold(1, 'test');
    (economy as unknown as { flush(): void }).flush();

    expect(goldOnDisk()).toBeGreaterThanOrEqual(5000);
    expect(economy.snapshot.gold).toBeGreaterThanOrEqual(5000);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // What "source of truth" bought
  // ───────────────────────────────────────────────────────────────────────────

  it('pulls the whole account in two round trips, not one per blob', async () => {
    fake.seedGold(10);
    const { gateway, economy, xp } = build();
    economy.init();
    await xp.init();
    await gateway.attach('u1', fake.handle);

    // One `getDocs` per subcollection. The old bind made a `getDoc` per blob,
    // which was nineteen round trips on every page load of a signed-in visitor.
    // The economy document is then re-read inside its write transaction — that
    // single getDoc is the CAS, not a return to per-blob pulls.
    expect(fake.counts.getDocs).toBe(2);
    expect(fake.counts.getDoc).toBe(fake.counts.transaction);
  });

  it('sends a burst of changes as one batch', async () => {
    const { gateway, economy, xp } = build();
    economy.init();
    await xp.init();
    await gateway.attach('u1', fake.handle);

    const batchesAfterAttach = fake.counts.batch;
    const docsAfterAttach = fake.counts.setDoc;

    // Three separate blobs move, the way a minute of play moves several.
    economy.earnGold(50, 'test');
    (economy as unknown as { flush(): void }).flush();
    xp.award('tool-use', { toolId: 'spec-tool' });
    (xp as unknown as { flushNow(): void }).flushNow();

    await gateway.flushNow();

    // One commit covering everything dirty, rather than a document write each.
    expect(fake.counts.batch).toBe(batchesAfterAttach + 1);
    expect(fake.counts.setDoc).toBe(docsAfterAttach);
    expect(fake.counts.batchWrites).toBeGreaterThanOrEqual(2);
  });

  it('writes nothing when a pull changed nothing', async () => {
    const { gateway, economy, xp } = build();
    economy.init();
    await xp.init();
    await gateway.attach('u1', fake.handle);
    await gateway.flushNow();

    const writesBefore = fake.counts.batch + fake.counts.setDoc + fake.counts.batchWrites;

    // A second attach with both sides already agreeing. Progression stamps a
    // fresh `updatedAt` on every merge, so without the volatile-field rule this
    // would report a change and cost a write on every page load, forever.
    await gateway.attach('u1', fake.handle);

    expect(fake.counts.batch + fake.counts.setDoc + fake.counts.batchWrites).toBe(writesBefore);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // The ways the cloud says no
  // ───────────────────────────────────────────────────────────────────────────

  it('lands the other blobs when one document is refused', async () => {
    const { gateway, economy, xp } = build();
    economy.init();
    await xp.init();
    await gateway.attach('u1', fake.handle);
    await gateway.flushNow();

    // Stand in for the monotonic-XP rule refusing a write. A batch is atomic, so
    // without the per-document retry this would hold the ledger hostage too.
    fake.refuse.add('users/u1/progress/state');
    economy.earnGold(777, 'test');
    (economy as unknown as { flush(): void }).flush();
    xp.award('tool-use', { toolId: 'refused-tool' });
    (xp as unknown as { flushNow(): void }).flushNow();

    await gateway.flushNow().catch(() => { /* the refusal propagates; expected */ });

    expect(fake.goldInCloud()).toBeGreaterThanOrEqual(777);
  });

  it('keeps the game playable and the queue held while offline', async () => {
    const { gateway, economy, xp } = build();
    economy.init();
    await xp.init();
    await gateway.attach('u1', fake.handle);
    await gateway.flushNow();

    fake.down = true;
    economy.earnGold(250, 'test');
    (economy as unknown as { flush(): void }).flush();
    await gateway.flushNow().catch(() => { /* offline; expected */ });

    // The visitor keeps playing and keeps their Gold; the write is still owed.
    expect(economy.snapshot.gold).toBeGreaterThanOrEqual(250);
    expect(goldOnDisk()).toBeGreaterThanOrEqual(250);
    expect(gateway.link).toBe('offline');
    expect(gateway.pending).toBeGreaterThan(0);

    // Back online, the queue drains without anything else prompting it.
    fake.down = false;
    await gateway.flushNow();
    expect(fake.goldInCloud()).toBeGreaterThanOrEqual(250);
    expect(gateway.link).toBe('synced');
    expect(gateway.pending).toBe(0);
  });

  it('reads from the cache when signed out, and queues nothing', async () => {
    const { gateway, economy, xp } = build();
    economy.init();
    await xp.init();
    economy.earnGold(400, 'test');
    (economy as unknown as { flush(): void }).flush();

    // The anonymous majority: the game works and the cloud is never touched.
    expect(gateway.attached).toBe(false);
    expect(gateway.link).toBe('local');
    expect(gateway.pending).toBe(0);
    expect(economy.snapshot.gold).toBeGreaterThanOrEqual(400);
    expect(fake.counts.getDocs + fake.counts.setDoc + fake.counts.batch).toBe(0);
  });

  it('leaves the local save alone on sign-out', async () => {
    fake.seedGold(3000);
    const { gateway, economy, xp } = build();
    economy.init();
    await xp.init();
    await gateway.attach('u1', fake.handle);
    expect(economy.snapshot.gold).toBeGreaterThanOrEqual(3000);

    await gateway.detach();

    // Signing out is not a request to forget months of progress.
    expect(gateway.attached).toBe(false);
    expect(goldOnDisk()).toBeGreaterThanOrEqual(3000);
    expect(economy.snapshot.gold).toBeGreaterThanOrEqual(3000);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Progression's own rules, which the structural ones get wrong
  // ───────────────────────────────────────────────────────────────────────────

  it('keeps the earlier createdAt and adopts the signed-in identity', async () => {
    const early = '2024-01-01T00:00:00.000Z';
    const late = '2026-01-01T00:00:00.000Z';

    localStorage.setItem(PROGRESS_KEY, JSON.stringify({
      version: 2, xp: 10, aether: 10, nox: 0, level: 1, achievements: [],
      toolsUsed: [], history: {}, streak: 1, bestStreak: 1, lastVisit: null,
      userId: 'local-uuid', createdAt: late, updatedAt: late,
    }));
    fake.docs.set('users/u1/progress/state', {
      version: 2, xp: 50, aether: 50, nox: 0, level: 1, achievements: [],
      toolsUsed: [], history: {}, streak: 1, bestStreak: 1, lastVisit: null,
      userId: 'u1', createdAt: early, updatedAt: early,
    });

    const { gateway, economy, xp } = build();
    economy.init();
    await xp.init();
    await gateway.attach('u1', fake.handle);

    const stored = JSON.parse(localStorage.getItem(PROGRESS_KEY)!);
    // The structural rule takes the greater of two strings, which is right for
    // every other date in the save and wrong for this one — it is when the
    // visitor first struck the forge, so the earlier value is the true one.
    expect(stored.createdAt).toBe(early);
    // Adopting the signed-in identity is most of what attaching means.
    expect(stored.userId).toBe('u1');
    expect(xp.snapshot.xp).toBeGreaterThanOrEqual(50);
  });
});
