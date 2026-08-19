/**
 * game-state.reset.spec.ts — a wipe has to stay wiped.
 *
 * These drive the real `GameStateGateway` and the real `DeviceLeaseService`
 * against an in-memory Firestore. The shape under test is the one that shipped
 * broken: the local half of a reset succeeds, the cloud half silently does not,
 * and the next pull reads the survivor as state to adopt.
 *
 * The two ways the cloud half fails are both represented, because they are the
 * two that actually happen and neither of them throws anything a user could
 * see:
 *
 *   - the gateway is not attached yet. The Firestore SDK is lazy, so on a cold
 *     mobile load there is a window of seconds where `fs` is null. This is the
 *     mobile bug in the report.
 *   - the device is offline. The delete rejects and the document lives on.
 */
import { TestBed } from '@angular/core/testing';
import { GameStateGateway, STATE_ENTRIES } from './game-state.gateway';
import { DeviceLeaseService } from './device-lease.service';
import { LEASE_TTL_MS } from './device-lease';
import { RESET_STAMP_KEY } from './save-reset';
import { PROGRESS_KEY } from '../gamification/gamification.model';

/** The slice of the SDK these tests touch, in memory. */
class FakeFirestore {
  readonly docs = new Map<string, unknown>();
  readonly counts = { deleteDoc: 0, setDoc: 0, transaction: 0 };
  down = false;

  readonly api = {
    doc: (_db: unknown, ...seg: string[]) => ({ path: seg.join('/') }),
    collection: (_db: unknown, ...seg: string[]) => ({ path: seg.join('/') }),

    getDoc: async (ref: { path: string }) => {
      this.guard();
      const held = this.docs.get(ref.path);
      return { exists: () => held !== undefined, data: () => copy(held) };
    },

    getDocs: async (ref: { path: string }) => {
      this.guard();
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
      this.docs.set(ref.path, copy(data));
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
          for (const w of staged) this.docs.set(w.path, copy(w.data));
        },
      };
    },

    runTransaction: async (_db: unknown, fn: (tx: {
      get: (ref: { path: string }) => Promise<{ exists: () => boolean; data: () => unknown }>;
      set: (ref: { path: string }, data: unknown) => void;
      delete: (ref: { path: string }) => void;
    }) => Promise<unknown>) => {
      this.guard();
      this.counts.transaction++;
      const staged = new Map<string, unknown | undefined>();
      const tx = {
        get: async (ref: { path: string }) => {
          const held = this.docs.get(ref.path);
          return { exists: () => held !== undefined, data: () => copy(held) };
        },
        set: (ref: { path: string }, data: unknown) => { staged.set(ref.path, copy(data)); },
        delete: (ref: { path: string }) => { staged.set(ref.path, undefined); },
      };
      const out = await fn(tx);
      for (const [path, data] of staged) {
        if (data === undefined) this.docs.delete(path);
        else this.docs.set(path, data);
      }
      return out;
    },
  };

  private guard(): void {
    if (this.down) throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
  }

  get handle(): any { return { db: {}, api: this.api }; }

  seedSave(uid = 'u1'): void {
    this.docs.set(`users/${uid}/economy/state`, {
      v: { version: 2, gold: 5_000, totalGoldEarned: 5_000, lastIdleAt: 1 },
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    this.docs.set(`users/${uid}/progress/state`, {
      version: 2, xp: 4_200, level: 7, achievements: [], createdAt: '2026-01-01T00:00:00.000Z',
    });
  }

  /** Saved-state documents only: excludes the lease and the reset tombstone. */
  stateDocs(uid = 'u1'): string[] {
    return [...this.docs.keys()]
      .filter(p => p.startsWith(`users/${uid}/`))
      .filter(p => !p.includes('/meta/') && !p.endsWith('/progress/reset'))
      .sort();
  }
}

function copy<T>(v: T): T {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

describe('reset survives its own sync', () => {
  let fake: FakeFirestore;
  let gateway: GameStateGateway;
  let leases: DeviceLeaseService;

  beforeEach(() => {
    localStorage.clear();
    fake = new FakeFirestore();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    gateway = TestBed.inject(GameStateGateway);
    leases = TestBed.inject(DeviceLeaseService);
  });

  afterEach(async () => {
    await gateway.detach();
    localStorage.clear();
  });

  /** Local state standing in for a played save. */
  function seedLocal(): void {
    localStorage.setItem('godforge-economy', JSON.stringify({ version: 2, gold: 5_000 }));
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ version: 2, xp: 4_200, level: 7 }));
  }

  function localSurvivors(): string[] {
    return STATE_ENTRIES
      .map(e => e.key)
      .filter(k => localStorage.getItem(k) !== null)
      .sort();
  }

  it('clears both halves when the network is there', async () => {
    fake.seedSave();
    seedLocal();
    await gateway.attach('u1', fake.handle);

    await gateway.resetAll();

    expect(localSurvivors()).toEqual([]);
    // The state documents are gone; the tombstone is what is left behind.
    expect(fake.stateDocs()).toEqual([]);
    expect(fake.docs.has('users/u1/progress/reset')).toBe(true);
    expect(Number(localStorage.getItem(RESET_STAMP_KEY))).toBeGreaterThan(0);
  });

  it('does not resurrect a save whose cloud delete never landed', async () => {
    // The reported bug, exactly: reset while offline, then come back.
    fake.seedSave();
    seedLocal();
    await gateway.attach('u1', fake.handle);

    fake.down = true;
    await gateway.resetAll();
    fake.down = false;

    // The wipe is local-only at this point and the cloud still holds the save —
    // which is precisely the state the old code adopted straight back.
    expect(localSurvivors()).toEqual([]);
    expect(fake.stateDocs().some(p => p.endsWith('/economy/state'))).toBe(true);

    await gateway.detach();
    await gateway.attach('u1', fake.handle);

    expect(localSurvivors()).toEqual([]);
    expect(fake.stateDocs()).toEqual([]);
  });

  it('finishes a wipe taken before the lazy SDK had attached', async () => {
    // The mobile case: `resetAll` runs with no Firestore handle at all, because
    // the ~450 kB SDK chunk is still in flight. Nothing can be deleted yet.
    fake.seedSave();
    seedLocal();
    expect(gateway.attached).toBe(false);

    await gateway.resetAll();
    expect(localSurvivors()).toEqual([]);

    // Signing in a moment later, with the same cloud save still up there.
    await gateway.attach('u1', fake.handle);

    expect(localSurvivors()).toEqual([]);
    expect(fake.stateDocs()).toEqual([]);
  });

  it('adopts a wipe taken later on another device', async () => {
    // This device never reset. The account did, elsewhere, after this device
    // last played — so its survivors are the save that was deleted, not state
    // the cloud is missing.
    seedLocal();
    fake.docs.set('users/u1/progress/reset', { at: Date.now() + 1_000, deviceId: 'other' });

    await gateway.attach('u1', fake.handle);

    expect(localSurvivors()).toEqual([]);
    expect(fake.stateDocs()).toEqual([]);
  });

  it('leaves an ordinary sign-in alone', async () => {
    // The regression guard: with no wipe on either side, the cloud save is
    // adopted exactly as it always was.
    fake.seedSave();
    await gateway.attach('u1', fake.handle);

    expect(localStorage.getItem('godforge-economy')).not.toBeNull();
    expect(localStorage.getItem(PROGRESS_KEY)).not.toBeNull();
  });

  it('re-issues a single-key delete that never reached the cloud', async () => {
    fake.seedSave();
    seedLocal();

    // Not attached: `remove` can clear the local copy and nothing else.
    gateway.remove('godforge-economy');
    expect(localStorage.getItem('godforge-economy')).toBeNull();
    expect(fake.docs.has('users/u1/economy/state')).toBe(true);

    await gateway.attach('u1', fake.handle);

    expect(localStorage.getItem('godforge-economy')).toBeNull();
    expect(fake.docs.has('users/u1/economy/state')).toBe(false);
    // Progression was never deleted and must be untouched by any of this.
    expect(localStorage.getItem(PROGRESS_KEY)).not.toBeNull();
  });

  it('cancels a queued delete when the key is written again', async () => {
    fake.seedSave();
    seedLocal();
    gateway.remove('godforge-economy');
    // The visitor starts playing again before the next sign-in.
    gateway.write('godforge-economy', { version: 2, gold: 12 });

    await gateway.attach('u1', fake.handle);

    expect(localStorage.getItem('godforge-economy')).not.toBeNull();
    expect(fake.docs.has('users/u1/economy/state')).toBe(true);
  });
});

describe('device lease', () => {
  let fake: FakeFirestore;
  let gateway: GameStateGateway;
  let leases: DeviceLeaseService;

  beforeEach(() => {
    localStorage.clear();
    fake = new FakeFirestore();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    gateway = TestBed.inject(GameStateGateway);
    leases = TestBed.inject(DeviceLeaseService);
  });

  afterEach(async () => {
    await gateway.detach();
    localStorage.clear();
  });

  it('takes the lease on attach when nobody holds it', async () => {
    await gateway.attach('u1', fake.handle);
    expect(leases.state.role).toBe('active');
    expect(leases.mayWrite).toBe(true);
    expect(fake.docs.has('users/u1/meta/device-lease')).toBe(true);
  });

  it('goes passive behind a device that is still beating', async () => {
    fake.docs.set('users/u1/meta/device-lease', {
      deviceId: 'other-device',
      acquiredAt: Date.now(),
      heartbeatAt: Date.now(),
      deviceName: 'Safari on iPhone',
    });

    await gateway.attach('u1', fake.handle);

    expect(leases.state.role).toBe('passive');
    expect(leases.mayWrite).toBe(false);
    expect(leases.state.holder?.deviceName).toBe('Safari on iPhone');
  });

  it('takes over from a device that has stopped beating', async () => {
    fake.docs.set('users/u1/meta/device-lease', {
      deviceId: 'other-device',
      acquiredAt: 0,
      heartbeatAt: Date.now() - LEASE_TTL_MS - 1_000,
    });

    await gateway.attach('u1', fake.handle);

    expect(leases.state.role).toBe('active');
  });

  it('holds a passive device queue instead of dropping it', async () => {
    fake.docs.set('users/u1/meta/device-lease', {
      deviceId: 'other-device',
      acquiredAt: Date.now(),
      heartbeatAt: Date.now(),
    });
    await gateway.attach('u1', fake.handle);
    expect(leases.state.role).toBe('passive');

    gateway.write('godforge-economy', { version: 2, gold: 777 });
    await gateway.flushNow();

    // Local play is recorded and nothing is lost; only the upload waits.
    expect(localStorage.getItem('godforge-economy')).not.toBeNull();
    expect(gateway.pending).toBeGreaterThan(0);
    expect(gateway.link).toBe('waiting');
  });

  it('sends what passive play queued once the lease is claimed', async () => {
    fake.docs.set('users/u1/meta/device-lease', {
      deviceId: 'other-device',
      acquiredAt: Date.now(),
      heartbeatAt: Date.now(),
    });
    await gateway.attach('u1', fake.handle);
    gateway.write('godforge-economy', { version: 2, gold: 777 });
    await gateway.flushNow();
    expect(gateway.pending).toBeGreaterThan(0);

    await gateway.claimLease();

    expect(leases.state.role).toBe('active');
    expect(gateway.pending).toBe(0);
    expect(fake.docs.has('users/u1/economy/state')).toBe(true);
  });

  it('keeps writing when the lease cannot be read at all', async () => {
    // A network failure on the lease must not lock a device out of its own
    // save. 'unknown' is writable on purpose; the merge rules are still there.
    await gateway.attach('u1', fake.handle);
    fake.down = true;
    await leases.refresh();

    expect(leases.state.role).toBe('unknown');
    expect(leases.mayWrite).toBe(true);
  });

  it('releases only its own lease', async () => {
    await gateway.attach('u1', fake.handle);
    // Another device took over while this one was hidden.
    fake.docs.set('users/u1/meta/device-lease', {
      deviceId: 'someone-else',
      acquiredAt: Date.now(),
      heartbeatAt: Date.now(),
    });

    leases.release();
    await new Promise(r => setTimeout(r, 0));

    expect(fake.docs.has('users/u1/meta/device-lease')).toBe(true);
  });

  it('shares one browser id across tabs', () => {
    const first = leases.deviceId();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const second = TestBed.inject(DeviceLeaseService).deviceId();
    expect(second).toBe(first);
  });
});
