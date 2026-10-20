/**
 * character-scope.spec.ts — one account, several characters: the gateway's per-character namespacing.
 *
 * Pins the save design of the login / character select (character-scope.ts): character #1 is the old single save
 * (same keys, same Firestore paths, so an existing save migrates by doing nothing), every other character has its
 * own `<key>@<id>` keys and `users/{uid}/characters/{id}/…` documents, a short list of keys is account-wide, and a
 * character being deleted can never be written back.
 */
import { TestBed } from '@angular/core/testing';
import { GameStateGateway, STATE_ENTRIES } from './game-state.gateway';
import {
  ACCOUNT_WIDE_KEYS, ACTIVE_CHARACTER_KEY, CHARACTER_ROSTER_KEY, PRIMARY_CHARACTER, characterDbName, characterDocPath,
  characterStorageKey, isCharacterId, isCharacterScoped, newCharacterId, readActiveCharacter,
} from './character-scope';
import { LocalSaveRegistry } from './local-save-registry.service';

const STATE_KEYS = new Set(STATE_ENTRIES.map(e => e.key));

/** A minimal in-memory Firestore: paths in, paths out (enough for attach, push and delete). */
class PathFirestore {
  readonly docs = new Map<string, unknown>();
  readonly api = {
    doc: (_db: unknown, ...seg: string[]) => ({ path: seg.join('/') }),
    collection: (_db: unknown, ...seg: string[]) => ({ path: seg.join('/') }),
    getDoc: async (ref: { path: string }) => {
      const held = this.docs.get(ref.path);
      return { exists: () => held !== undefined, data: () => clone(held) };
    },
    getDocs: async (ref: { path: string }) => {
      const prefix = ref.path + '/';
      const hits = [...this.docs.entries()].filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'));
      return { forEach: (fn: (d: { id: string; data: () => unknown }) => void) => hits.forEach(([p, v]) => fn({ id: p.slice(prefix.length), data: () => clone(v) })) };
    },
    setDoc: async (ref: { path: string }, data: unknown) => { this.docs.set(ref.path, clone(data)); },
    deleteDoc: async (ref: { path: string }) => { this.docs.delete(ref.path); },
    writeBatch: () => {
      const staged: { path: string; data: unknown }[] = [];
      return {
        set: (ref: { path: string }, data: unknown) => { staged.push({ path: ref.path, data }); },
        commit: async () => { for (const w of staged) this.docs.set(w.path, clone(w.data)); },
      };
    },
    runTransaction: async (_db: unknown, fn: (tx: { get: (r: { path: string }) => Promise<unknown>; set: (r: { path: string }, d: unknown) => void; update: (r: { path: string }, d: unknown) => void; delete: (r: { path: string }) => void }) => Promise<unknown>) => {
      const staged = new Map<string, unknown>();
      const out = await fn({
        get: async (ref) => { const held = this.docs.get(ref.path); return { exists: () => held !== undefined, data: () => clone(held) }; },
        set: (ref, d) => { staged.set(ref.path, clone(d)); },
        update: (ref, d) => { staged.set(ref.path, { ...(this.docs.get(ref.path) as object), ...(d as object) }); },
        delete: (ref) => { this.docs.delete(ref.path); },
      });
      for (const [p, d] of staged) this.docs.set(p, d);
      return out;
    },
  };
  get handle(): any { return { db: {}, api: this.api }; }
}

function clone<T>(v: T): T { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }

function gatewayFor(character: string | null): GameStateGateway {
  TestBed.resetTestingModule();
  if (character) localStorage.setItem(ACTIVE_CHARACTER_KEY, character);
  else localStorage.removeItem(ACTIVE_CHARACTER_KEY);
  TestBed.configureTestingModule({});
  return TestBed.inject(GameStateGateway);
}

describe('character scope (pure)', () => {
  it('keeps character #1 on the old keys, paths and database names', () => {
    expect(characterStorageKey('godforge-inventory', PRIMARY_CHARACTER)).toBe('godforge-inventory');
    expect(characterDocPath(PRIMARY_CHARACTER, 'progress', 'inventory')).toEqual(['progress', 'inventory']);
    expect(characterDbName('eclipse-world', PRIMARY_CHARACTER)).toBe('eclipse-world');
  });

  it('gives every other character its own keys, paths and database names', () => {
    expect(characterStorageKey('godforge-inventory', 'k2abc')).toBe('godforge-inventory@k2abc');
    expect(characterDocPath('k2abc', 'economy', 'state')).toEqual(['characters', 'k2abc', 'economy', 'state']);
    expect(characterDbName('eclipse-world', 'k2abc')).toBe('eclipse-world@k2abc');
  });

  it('scopes the save per character, except the short account-wide list and keys it does not own', () => {
    for (const key of ['godforge-keeper-look', 'godforge-keeper-level', 'godforge-inventory', 'godforge-economy', 'godforge-activity',
      'eclipse-progress', 'godforge-town-tasks', 'eclipse-quests', 'godforge-world', 'eclipse-play-world-v1']) {
      expect(isCharacterScoped(key, STATE_KEYS)).withContext(key).toBe(true);
    }
    for (const key of ACCOUNT_WIDE_KEYS) expect(isCharacterScoped(key, STATE_KEYS)).withContext(key).toBe(false);
    for (const key of ['preferred-language', 'cloud-save-uid', 'godforge-device-id', 'eclipse-onboarding', ACTIVE_CHARACTER_KEY]) {
      expect(isCharacterScoped(key, STATE_KEYS)).withContext(key).toBe(false);
    }
    // The roster is synced and account-wide; every account-wide key is one the gateway actually syncs.
    expect(STATE_KEYS.has(CHARACTER_ROSTER_KEY)).toBe(true);
    for (const key of ACCOUNT_WIDE_KEYS) expect(STATE_KEYS.has(key)).withContext(key).toBe(true);
  });

  it('only accepts short safe ids, and never mints c1 for a new character', () => {
    expect(isCharacterId('c1')).toBe(true);
    expect(isCharacterId('k8x2ab')).toBe(true);
    for (const bad of ['', 'a', 'K2', 'k2/../x', 'k2@x', 'x'.repeat(17), null, 7]) expect(isCharacterId(bad)).withContext(String(bad)).toBe(false);
    let n = 0;
    const id = newCharacterId(() => (n++ % 7) / 7, new Set(['c1']));
    expect(isCharacterId(id)).toBe(true);
    expect(id).not.toBe('c1');
  });

  it('boots into the stored character, or #1 when there is none or it is junk', () => {
    expect(readActiveCharacter({ getItem: () => null })).toBe(PRIMARY_CHARACTER);
    expect(readActiveCharacter({ getItem: () => 'k77' })).toBe('k77');
    expect(readActiveCharacter({ getItem: () => '../evil' })).toBe(PRIMARY_CHARACTER);
    expect(readActiveCharacter(null)).toBe(PRIMARY_CHARACTER);
  });
});

describe('GameStateGateway — characters', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => { TestBed.resetTestingModule(); localStorage.clear(); });

  it('migrates an existing single save into character #1 by leaving it where it is', () => {
    localStorage.setItem('godforge-inventory', JSON.stringify({ items: ['old'] }));
    const gateway = gatewayFor(null);
    expect(gateway.character).toBe(PRIMARY_CHARACTER);
    expect(gateway.read('godforge-inventory')).toEqual({ items: ['old'] });
    gateway.write('godforge-inventory', { items: ['old', 'new'] });
    expect(JSON.parse(localStorage.getItem('godforge-inventory')!)).toEqual({ items: ['old', 'new'] });
    expect(gateway.hasLocalSave(PRIMARY_CHARACTER)).toBe(true);
  });

  it('keeps a second character apart from the first, and shares only the account-wide keys', () => {
    localStorage.setItem('godforge-inventory', JSON.stringify({ items: ['first'] }));
    localStorage.setItem('eclipse-play-world-v1', JSON.stringify({ td: { continent: 'ember-isle', level: 'surface', x: 10, y: 20 } }));
    localStorage.setItem('godforge-sound', JSON.stringify({ music: 0.3 }));
    const second = gatewayFor('k2second');
    expect(second.read('godforge-inventory')).toBeNull();
    expect(second.read('eclipse-play-world-v1')).toBeNull();
    expect(second.read('godforge-sound')).toEqual({ music: 0.3 });

    second.write('godforge-inventory', { items: ['second'] });
    second.write('eclipse-play-world-v1', { td: { continent: 'ember-isle', level: 'surface', x: 99, y: 99 } });
    second.write('godforge-sound', { music: 0.8 });
    expect(JSON.parse(localStorage.getItem('godforge-inventory@k2second')!)).toEqual({ items: ['second'] });
    // The first character is untouched; the shared preference moved for both.
    expect(JSON.parse(localStorage.getItem('godforge-inventory')!)).toEqual({ items: ['first'] });
    expect(JSON.parse(localStorage.getItem('eclipse-play-world-v1')!).td.x).toBe(10);
    expect(JSON.parse(localStorage.getItem('godforge-sound')!)).toEqual({ music: 0.8 });

    // Read-only views of another character, for the list.
    expect(second.readFor(PRIMARY_CHARACTER, 'godforge-inventory')).toEqual({ items: ['first'] });
    expect(second.readFor('k2second', 'godforge-inventory')).toEqual({ items: ['second'] });
    expect(second.hasLocalSave('k3never')).toBe(false);
  });

  it('chooses the next character without moving this page off its own (the switch is a reload)', () => {
    const gateway = gatewayFor(null);
    gateway.selectCharacter('k2next');
    expect(localStorage.getItem(ACTIVE_CHARACTER_KEY)).toBe('k2next');
    gateway.write('godforge-inventory', { items: ['still #1'] });
    expect(localStorage.getItem('godforge-inventory')).toContain('still #1');
    expect(localStorage.getItem('godforge-inventory@k2next')).toBeNull();
    gateway.selectCharacter('../nope');
    expect(localStorage.getItem(ACTIVE_CHARACTER_KEY)).toBe('k2next');
  });

  it('deletes one character and keeps the others and the account-wide keys', async () => {
    localStorage.setItem('godforge-inventory', JSON.stringify({ items: ['first'] }));
    localStorage.setItem('godforge-inventory@k2gone', JSON.stringify({ items: ['gone'] }));
    localStorage.setItem('eclipse-play-world-v1@k2gone', '{}');
    localStorage.setItem('godforge-sound', '{}');
    const gateway = gatewayFor(null);
    await gateway.deleteCharacterSave('k2gone');
    expect(localStorage.getItem('godforge-inventory@k2gone')).toBeNull();
    expect(localStorage.getItem('eclipse-play-world-v1@k2gone')).toBeNull();
    expect(localStorage.getItem('godforge-inventory')).not.toBeNull();
    expect(localStorage.getItem('godforge-sound')).not.toBeNull();
  });

  it('never writes a retired character back — not even the owners\' pagehide flush', async () => {
    localStorage.setItem('godforge-inventory@k2bye', JSON.stringify({ items: ['bye'] }));
    const gateway = gatewayFor('k2bye');
    const registry = TestBed.inject(LocalSaveRegistry);
    // A live owner holding the character in memory, as every service does.
    registry.register('godforge-inventory', { flush: () => gateway.write('godforge-inventory', { items: ['stale'] }), rehydrate: () => undefined });
    gateway.retireCharacter();
    await gateway.deleteCharacterSave('k2bye');
    window.dispatchEvent(new Event('pagehide'));
    registry.flush('godforge-inventory');
    expect(localStorage.getItem('godforge-inventory@k2bye')).toBeNull();
    // Account-wide state still saves (the roster's tombstone is written after a retire).
    gateway.write(CHARACTER_ROSTER_KEY, { v: 1, chars: {} });
    expect(localStorage.getItem(CHARACTER_ROSTER_KEY)).not.toBeNull();
  });

  it('syncs a second character to its own documents and the account-wide ones to the root', async () => {
    const fake = new PathFirestore();
    fake.docs.set('users/u1/progress/inventory', { v: { items: ['first, in the cloud'] }, updatedAt: 'x' });
    fake.docs.set('users/u1/progress/sound', { v: { music: 0.5 }, updatedAt: 'x' });
    fake.docs.set('users/u1/characters/k2cloud/progress/keeper-look', { v: { name: 'Wren', made: true, updatedAt: 5 }, updatedAt: 'x' });
    localStorage.setItem('godforge-inventory@k2cloud', JSON.stringify({ items: ['second, here'] }));
    const gateway = gatewayFor('k2cloud');
    await gateway.attach('u1', fake.handle);

    // Pulled: its own look and the shared sound; never character #1's bag.
    expect((gateway.read('godforge-keeper-look') as { name: string }).name).toBe('Wren');
    expect(gateway.read('godforge-sound')).not.toBeNull();
    expect(localStorage.getItem('godforge-sound')).not.toBeNull();
    expect(localStorage.getItem('godforge-inventory')).toBeNull();
    // Pushed: its bag under characters/k2cloud, character #1's document untouched.
    expect((fake.docs.get('users/u1/characters/k2cloud/progress/inventory') as { v: unknown }).v).toEqual({ items: ['second, here'] });
    expect((fake.docs.get('users/u1/progress/inventory') as { v: unknown }).v).toEqual({ items: ['first, in the cloud'] });

    gateway.write('godforge-sound', { version: 1, ambience: 0.9, effects: 0.5, muted: false, updatedAt: 9 });
    await gateway.flushNow();
    expect((fake.docs.get('users/u1/progress/sound') as { v: { ambience: number } }).v.ambience).toBe(0.9);
    expect(fake.docs.has('users/u1/characters/k2cloud/progress/sound')).toBe(false);

    // Deleting the character reaches its cloud documents too.
    await gateway.deleteCharacterSave('k2cloud');
    expect([...fake.docs.keys()].some(p => p.startsWith('users/u1/characters/k2cloud/'))).toBe(false);
    expect(fake.docs.has('users/u1/progress/inventory')).toBe(true);
    await gateway.detach();
  });

  it('keeps character #1 on the root documents when signed in', async () => {
    const fake = new PathFirestore();
    localStorage.setItem('godforge-inventory', JSON.stringify({ items: ['first'] }));
    const gateway = gatewayFor(null);
    await gateway.attach('u1', fake.handle);
    expect((fake.docs.get('users/u1/progress/inventory') as { v: unknown }).v).toEqual({ items: ['first'] });
    expect([...fake.docs.keys()].some(p => p.includes('/characters/'))).toBe(false);
    await gateway.detach();
  });
});
