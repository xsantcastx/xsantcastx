/**
 * fresh-device-progress.spec.ts — a Keeper's level survives being opened on a second device.
 *
 * Owner, 2026-10-21: "connected my account to another device and in the character screen it said i was level 1? Is
 * progression saving correctly?" It was not: the cloud's activity ledger (every point of Hunting XP, which IS the
 * Keeper's level) had been deleted by the new device. A browser that has never stamped the realm era runs the era-55
 * wipe on boot (realm-era.ts), and that wipe went through `GameStateGateway.remove`, which queues a *cloud* delete for
 * the next attach. The first sign-in then drained the queue and deleted the account's real ledger before merging,
 * and the lobby summarised what was left: level 1, stamped newer than the true row, synced to every device.
 *
 * These drive the real gateway, the real era wipe and the real lobby summary against an in-memory Firestore (the
 * same shape as cloud-save.sync.spec.ts's fake, cut down to what attach uses), for character #1 (root paths) and a
 * later character (`characters/{id}/...`).
 */
import { TestBed } from '@angular/core/testing';
import { LazyFirestoreService } from '../lazy-firestore.service';
import { EasterEggService } from '../easter-eggs/easter-egg.service';
import { GameStateGateway } from './game-state.gateway';
import { applyRealmEra, REALM_ERA, REALM_ERA_KEY } from './realm-era';
import { ACTIVE_CHARACTER_KEY, PRIMARY_CHARACTER, characterStorageKey } from './character-scope';
import { ACTIVITY_KEY } from '../activity/activity.model';
import { CharacterRosterService } from '../characters/character-roster.service';
import { CharacterRow, coerceRoster, mergeCharacterRoster } from '../characters/character-roster.model';
import { huntingLevelOf, summarise } from '../../play/lobby/character-summary';
import { keeperLevelForXp } from '../skills/keeper-level';

const HUNTING_XP = 5_000;
const TRUE_LEVEL = keeperLevelForXp(HUNTING_XP);

/** The slice of Firestore that attach, push and delete use, in memory. Documents are deep-copied both ways. */
class FakeFirestore {
  readonly docs = new Map<string, unknown>();
  deletes: string[] = [];
  readonly api = {
    doc: (_db: unknown, ...seg: string[]) => ({ path: seg.join('/') }),
    collection: (_db: unknown, ...seg: string[]) => ({ path: seg.join('/') }),
    getDoc: async (ref: { path: string }) => {
      const held = this.docs.get(ref.path);
      return { exists: () => held !== undefined, data: () => copy(held) };
    },
    getDocs: async (ref: { path: string }) => {
      const prefix = ref.path + '/';
      const hits = [...this.docs.entries()].filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'));
      return { forEach: (fn: (d: { id: string; data: () => unknown }) => void) => hits.forEach(([p, v]) => fn({ id: p.slice(prefix.length), data: () => copy(v) })) };
    },
    setDoc: async (ref: { path: string }, data: unknown) => { this.commit(ref.path, data); },
    deleteDoc: async (ref: { path: string }) => { this.deletes.push(ref.path); this.docs.delete(ref.path); },
    writeBatch: () => {
      const staged: { path: string; data: unknown }[] = [];
      return {
        set: (ref: { path: string }, data: unknown) => { staged.push({ path: ref.path, data }); },
        commit: async () => { for (const w of staged) this.commit(w.path, w.data); },
      };
    },
    runTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<void>) => {
      const staged = new Map<string, unknown>();
      await fn({
        get: async (ref: { path: string }) => {
          const held = this.docs.get(ref.path);
          return { exists: () => held !== undefined, data: () => copy(held) };
        },
        set: (ref: { path: string }, data: unknown) => { staged.set(ref.path, data); },
      });
      for (const [path, data] of staged) this.commit(path, data);
    },
  };

  get handle(): any { return { db: {}, api: this.api }; }

  private commit(path: string, data: unknown): void {
    // Mirror firestore.rules: progress/state XP may never go down.
    if (path.endsWith('/progress/state')) {
      const prev = this.docs.get(path) as { xp?: number } | undefined;
      const next = data as { xp?: number } | null;
      if (typeof prev?.xp === 'number' && typeof next?.xp === 'number' && next.xp < prev.xp) {
        throw Object.assign(new Error('refused'), { code: 'permission-denied' });
      }
    }
    this.docs.set(path, copy(data));
  }

  /** Hunting XP in the cloud's activity ledger for `prefix` (`progress` or `characters/{id}/progress`), or null. */
  huntingXp(prefix: string): number | null {
    const doc = this.docs.get(`users/u1/${prefix}/activity`) as { v?: { progress?: { xpByDiscipline?: { hunting?: number } } } } | undefined;
    if (!doc) return null;
    return doc.v?.progress?.xpByDiscipline?.hunting ?? 0;
  }

  rosterRow(id: string): CharacterRow | undefined {
    const doc = this.docs.get('users/u1/progress/characters') as { v?: unknown } | undefined;
    return doc ? coerceRoster(doc.v).chars[id] : undefined;
  }
}

function copy<T>(v: T): T {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

class FakeEggs {
  isFound(): boolean { return false; }
  async trigger(): Promise<void> { /* no-op */ }
  async init(): Promise<void> { /* no-op */ }
}

function ledger(hunting: number): unknown {
  return { version: 1, era: REALM_ERA, currentWork: null, progress: { version: 1, xpByDiscipline: { hunting } }, operations: [] };
}

function row(id: string, level: number, updatedAt: number): CharacterRow {
  return { id, name: 'Ash', vocation: 'warlock', level, area: 'Ember Isle', look: null, createdAt: 1, updatedAt };
}

describe('a Keeper opened on a second device', () => {
  let fake: FakeFirestore;

  function device(character = PRIMARY_CHARACTER) {
    if (character !== PRIMARY_CHARACTER) localStorage.setItem(ACTIVE_CHARACTER_KEY, character);
    TestBed.configureTestingModule({
      providers: [
        { provide: LazyFirestoreService, useValue: { get: async () => fake.handle } },
        { provide: EasterEggService, useValue: new FakeEggs() },
      ],
    });
    return { gateway: TestBed.inject(GameStateGateway), roster: TestBed.inject(CharacterRosterService) };
  }

  /** What app.component does on every boot, before any sign-in. */
  function boot(gateway: GameStateGateway): void {
    applyRealmEra(gateway);
  }

  function newDevice(): void {
    TestBed.resetTestingModule();
    localStorage.clear();
  }

  /** Device A: has played the Keeper to TRUE_LEVEL and pushed it, roster row included. */
  async function firstDevice(character: string): Promise<void> {
    const a = device(character);
    boot(a.gateway);
    a.gateway.write(ACTIVITY_KEY, ledger(HUNTING_XP));
    a.roster.put(row(character, TRUE_LEVEL, 1_000));
    await a.gateway.attach('u1', fake.handle);
    await a.gateway.flushNow();
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    sessionStorage.clear();
    fake = new FakeFirestore();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  for (const [label, character, prefix] of [
    ['character #1 (root paths)', PRIMARY_CHARACTER, 'progress'],
    ['a later character (characters/{id}/...)', 'k2second', 'characters/k2second/progress'],
  ] as const) {
    describe(label, () => {
      it('the first device really did push its Hunting XP', async () => {
        await firstDevice(character);
        expect(fake.huntingXp(prefix)).toBe(HUNTING_XP);
        expect(fake.rosterRow(character)?.level).toBe(TRUE_LEVEL);
      });

      it('a fresh device keeps the cloud ledger and shows the true level after signing in', async () => {
        await firstDevice(character);
        newDevice();

        const b = device(character);
        boot(b.gateway); // a browser with no era stamp: the era wipe runs here
        await b.gateway.attach('u1', fake.handle);
        await b.gateway.flushNow();

        expect(fake.deletes.filter(p => p.endsWith('/activity'))).toEqual([]);
        expect(fake.huntingXp(prefix)).toBe(HUNTING_XP);
        expect(huntingLevelOf(b.gateway.readFor(character, ACTIVITY_KEY))).toBe(TRUE_LEVEL);

        // The lobby renders now: the row it shows and the row it syncs.
        const shown = summarise(b.gateway, b.roster.row(character)!, 5_000);
        expect(shown.level).toBe(TRUE_LEVEL);
        if (shown !== b.roster.row(character)) b.roster.put(shown);
        await b.gateway.flushNow();
        expect(fake.rosterRow(character)?.level).toBe(TRUE_LEVEL);
      });

      it('a lobby that summarises before the pull lands cannot lower the synced level', async () => {
        await firstDevice(character);
        newDevice();

        const b = device(character);
        boot(b.gateway);
        // A first visit writes empty ledgers before anyone plays (hasLocalSave is true from here on).
        b.gateway.write(ACTIVITY_KEY, ledger(0));
        expect(b.gateway.hasLocalSave(character)).toBe(true);
        // The lobby rendered before the activity ledger landed, holding the true row (pulled earlier, or written by
        // this device before). The summary it computes from the empty ledger must not become a newer, lower row.
        const early = summarise(b.gateway, row(character, TRUE_LEVEL, 1_000), 9_000);
        expect(early.level).toBe(TRUE_LEVEL);
        b.roster.put(early);

        await b.gateway.attach('u1', fake.handle);
        await b.gateway.flushNow();
        expect(fake.rosterRow(character)?.level).toBe(TRUE_LEVEL);
        expect(b.roster.row(character)?.level).toBe(TRUE_LEVEL);
        expect(fake.huntingXp(prefix)).toBe(HUNTING_XP);

        // And once the ledger is here the summary is the true one.
        const after = summarise(b.gateway, b.roster.row(character)!, 10_000);
        expect(after.level).toBe(TRUE_LEVEL);
      });

      it('the first device still holds and re-shows its level after the second device signed in', async () => {
        await firstDevice(character);
        newDevice();
        const b = device(character);
        boot(b.gateway);
        b.roster.put({ ...row(character, 1, 9_000) });
        await b.gateway.attach('u1', fake.handle);
        await b.gateway.flushNow();

        // Back on device A (its own storage again).
        newDevice();
        const a = device(character);
        localStorage.setItem(characterStorageKey(REALM_ERA_KEY, character), String(REALM_ERA));
        a.gateway.write(ACTIVITY_KEY, ledger(HUNTING_XP));
        boot(a.gateway);
        await a.gateway.attach('u1', fake.handle);
        expect(a.roster.row(character)?.level).toBe(TRUE_LEVEL);
        expect(fake.huntingXp(prefix)).toBe(HUNTING_XP);
      });
    });
  }

  it('a stale era-wipe delete queued by an older build is not executed against the cloud', async () => {
    await firstDevice(PRIMARY_CHARACTER);
    newDevice();
    // An older build ran the wipe on this browser and left the cloud delete queued; the era is already stamped.
    localStorage.setItem(REALM_ERA_KEY, String(REALM_ERA));
    localStorage.setItem('godforge-pending-deletes', JSON.stringify([ACTIVITY_KEY]));
    const b = device();
    boot(b.gateway);
    await b.gateway.attach('u1', fake.handle);
    expect(fake.huntingXp('progress')).toBe(HUNTING_XP);
  });
});

describe('the roster merge', () => {
  it('never lowers a living row’s level, whichever row is newer', () => {
    const high = row('c1', 40, 100);
    const low = row('c1', 1, 200);
    for (const [r, l] of [[high, low], [low, high]]) {
      const merged = coerceRoster(mergeCharacterRoster({ v: 1, chars: { c1: r } }, { v: 1, chars: { c1: l } }));
      expect(merged.chars['c1'].level).toBe(40);
      // The newer row still wins its other fields (a rename, a new place).
      expect(merged.chars['c1'].updatedAt).toBe(200);
    }
  });

  it('keeps a tombstone deleted', () => {
    const live = row('k2second', 40, 100);
    const dead = { ...row('k2second', 1, 300), deletedAt: 300 };
    const merged = coerceRoster(mergeCharacterRoster({ v: 1, chars: { k2second: live } }, { v: 1, chars: { k2second: dead } }));
    expect(merged.chars['k2second'].deletedAt).toBe(300);
  });

  it('the summary of an empty or unsynced local copy never lowers a row', () => {
    const store = {
      readFor: (_c: string, key: string) => (key === ACTIVITY_KEY ? ledger(0) : null),
      hasLocalSave: () => true,
    };
    const shown = summarise(store, row('c1', 40, 100), 500);
    expect(shown.level).toBe(40);
  });

  it('a wipe taken on this device after the row was written may lower it, and that lower row wins the merge', () => {
    const store = {
      readFor: (_c: string, key: string) => (key === ACTIVITY_KEY ? ledger(0) : key === 'godforge-reset-at' ? 400 : null),
      hasLocalSave: () => true,
    };
    const before = row('c1', 40, 100);
    const shown = summarise(store, before, 500);
    expect(shown.level).toBe(1);
    expect(shown.levelResetAt).toBe(400);
    const merged = coerceRoster(mergeCharacterRoster({ v: 1, chars: { c1: before } }, { v: 1, chars: { c1: shown } }));
    expect(merged.chars['c1'].level).toBe(1);
  });
});
