/**
 * guest-profile.spec.ts — SECURITY (owner 2026-10-26): "in a browser that was ever signed in, choosing Guest loads that
 * account's roster and saves and lets the guest play them".
 *
 * Pins character-scope.ts "Profiles": a guest page on such a browser reads and writes only its own `guest~` namespace
 * (roster, active character, every per-character blob, database names), never the account's; it never attaches to the
 * cloud; and the account's keys are untouched by anything the guest does. A browser never signed in keeps its guest's
 * saves where they always were.
 */
import { TestBed } from '@angular/core/testing';
import { GameStateGateway } from './game-state.gateway';
import {
  ACCOUNT_SEEN_KEY, ACTIVE_CHARACTER_KEY, BOUND_ACCOUNT_KEY, CHARACTER_ROSTER_KEY, GUEST_FLAG_KEY, GUEST_PREFIX,
  characterDbName, characterStorageKey, readActiveCharacter, readProfile, resetBootProfileForTest,
} from './character-scope';

const store = (o: Record<string, string>) => ({ getItem: (k: string) => (k in o ? o[k] : null) });
const ACCOUNT_KEYS = ['godforge-inventory', 'godforge-economy', CHARACTER_ROSTER_KEY, ACTIVE_CHARACTER_KEY, 'godforge-keeper-look'];

describe('guest profile (pure)', () => {
  it('is the guest\'s only on a browser an account has signed in on, with Play offline chosen and no account bound', () => {
    expect(readProfile(store({}))).toBe('account');
    // Never signed in here: the guest's saves are nobody else's and stay where they were.
    expect(readProfile(store({ [GUEST_FLAG_KEY]: '1' }))).toBe('account');
    expect(readProfile(store({ [GUEST_FLAG_KEY]: '1', [ACCOUNT_SEEN_KEY]: '1' }))).toBe('guest');
    // A browser signed in before the marker existed carries the gateway's sweep stamp.
    expect(readProfile(store({ [GUEST_FLAG_KEY]: '1', 'godforge-seed-sweep': 'u1' }))).toBe('guest');
    // Signed in now: the account plays, whatever the flag says.
    expect(readProfile(store({ [GUEST_FLAG_KEY]: '1', [ACCOUNT_SEEN_KEY]: '1', [BOUND_ACCOUNT_KEY]: 'u1' }))).toBe('account');
    expect(readProfile(null)).toBe('account');
  });

  it('maps every key, database and the active-character choice into the guest\'s own namespace', () => {
    expect(characterStorageKey('godforge-inventory', 'c1', 'guest')).toBe(GUEST_PREFIX + 'godforge-inventory');
    expect(characterStorageKey('godforge-inventory', 'k2abc', 'guest')).toBe(GUEST_PREFIX + 'godforge-inventory@k2abc');
    expect(characterDbName('eclipse-world', 'c1', 'guest')).toBe(GUEST_PREFIX + 'eclipse-world');
    expect(characterStorageKey('godforge-inventory', 'c1', 'account')).toBe('godforge-inventory');
    // The account's choice of Keeper is not the guest's.
    expect(readActiveCharacter(store({ [ACTIVE_CHARACTER_KEY]: 'k77' }), 'guest')).toBe('c1');
    expect(readActiveCharacter(store({ [GUEST_PREFIX + ACTIVE_CHARACTER_KEY]: 'k88' }), 'guest')).toBe('k88');
  });
});

describe('guest profile (gateway)', () => {
  const account = {
    'godforge-inventory': JSON.stringify({ v: { records: ['the account\'s sword'] }, updatedAt: 1 }),
    'godforge-economy': JSON.stringify({ v: { gold: 999999 }, updatedAt: 1 }),
    [CHARACTER_ROSTER_KEY]: JSON.stringify({ v: { chars: { c1: { id: 'c1', name: 'Owner' }, k2abc: { id: 'k2abc', name: 'Alt' } } }, updatedAt: 1 }),
    [ACTIVE_CHARACTER_KEY]: 'k2abc',
    'godforge-inventory@k2abc': JSON.stringify({ v: { records: ['the alt\'s bow'] }, updatedAt: 1 }),
  };
  let saved: Record<string, string | null>;

  beforeEach(() => {
    saved = {};
    for (const k of [...Object.keys(account), ACCOUNT_SEEN_KEY, GUEST_FLAG_KEY, BOUND_ACCOUNT_KEY, 'godforge-seed-sweep']) saved[k] = localStorage.getItem(k);
    for (const [k, v] of Object.entries(account)) localStorage.setItem(k, v);
    localStorage.setItem(ACCOUNT_SEEN_KEY, '1');
    localStorage.setItem(GUEST_FLAG_KEY, '1');
    localStorage.removeItem(BOUND_ACCOUNT_KEY);
    resetBootProfileForTest();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
  });
  afterEach(() => {
    for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k?.startsWith(GUEST_PREFIX)) localStorage.removeItem(k); }
    for (const [k, v] of Object.entries(saved)) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
    resetBootProfileForTest();
    TestBed.resetTestingModule();
  });

  it('a guest page never reads the account\'s roster, Keeper or bag, and its writes land only in its own keys', () => {
    const gateway = TestBed.inject(GameStateGateway);
    expect(gateway.profile).toBe('guest');
    // The account's last Keeper (k2abc) is not where the guest boots.
    expect(gateway.character).toBe('c1');
    expect(gateway.read(CHARACTER_ROSTER_KEY)).toBeNull();
    expect(gateway.read('godforge-inventory')).toBeNull();
    expect(gateway.read('godforge-economy')).toBeNull();
    expect(gateway.readFor('k2abc', 'godforge-inventory')).toBeNull();
    expect(gateway.hasLocalSave('k2abc')).toBeFalse();
    gateway.write('godforge-inventory', { records: ['the guest\'s stick'] });
    gateway.selectCharacter('k9zzz');
    expect(localStorage.getItem(GUEST_PREFIX + 'godforge-inventory')).toContain('stick');
    expect(localStorage.getItem(GUEST_PREFIX + ACTIVE_CHARACTER_KEY)).toBe('k9zzz');
    for (const [k, v] of Object.entries(account)) expect(localStorage.getItem(k)).withContext(k).toBe(v);
  });

  it('a guest page never attaches to an account (nothing of the guest is merged into it, nothing of it pulled down)', async () => {
    const gateway = TestBed.inject(GameStateGateway);
    const touched: string[] = [];
    const fs = { db: {}, api: new Proxy({}, { get: (_t, name) => () => { touched.push(String(name)); throw new Error('no cloud for a guest'); } }) };
    const out = await gateway.attach('u1', fs as never);
    expect(out).toEqual({ adopted: [], seeded: false });
    expect(gateway.attached).toBeFalse();
    expect(touched).toEqual([]);
  });

  it('a browser never signed in: the guest keeps its own unprefixed saves, as before', () => {
    localStorage.removeItem(ACCOUNT_SEEN_KEY);
    localStorage.removeItem('godforge-seed-sweep');
    resetBootProfileForTest();
    const gateway = TestBed.inject(GameStateGateway);
    expect(gateway.profile).toBe('account');
    expect(gateway.character).toBe('k2abc');
    expect(gateway.read('godforge-inventory')).toEqual(JSON.parse(account['godforge-inventory@k2abc']));
  });

  // Recovery (owner bug 2026-10-26): play that landed in the guest's saves while signed in comes back as a NEW Keeper.
  it('the account\'s page offers a guest Keeper and adopts it as a new Keeper of its own, never over one it has', () => {
    localStorage.removeItem(GUEST_FLAG_KEY);
    resetBootProfileForTest();
    localStorage.setItem(GUEST_PREFIX + 'godforge-keeper-look', JSON.stringify({ version: 1, made: true, name: 'Lost', vocation: 'ashguard' }));
    localStorage.setItem(GUEST_PREFIX + 'godforge-inventory', JSON.stringify({ v: { records: ['found while stuck'] } }));
    localStorage.setItem(GUEST_PREFIX + 'eclipse-guest-played-as', 'u1');
    const gateway = TestBed.inject(GameStateGateway);
    expect(gateway.profile).toBe('account');
    expect(gateway.guestKeepers()).toEqual([{ id: 'c1', name: 'Lost', vocation: 'ashguard', playedAs: 'u1' }]);
    expect(gateway.adoptGuestKeeper('c1', 'k7lost00')).toBeTrue();
    // A new Keeper of the account's, under its own keys; the account's own Keepers untouched; the guest copy gone.
    expect(localStorage.getItem('godforge-inventory@k7lost00')).toContain('found while stuck');
    expect(localStorage.getItem('godforge-keeper-look@k7lost00')).toContain('Lost');
    expect(localStorage.getItem('godforge-cloud-pending@k7lost00')).toBe('1');
    for (const [k, v] of Object.entries(account)) expect(localStorage.getItem(k)).withContext(k).toBe(v);
    expect(localStorage.getItem(GUEST_PREFIX + 'godforge-inventory')).toBeNull();
    expect(gateway.guestKeepers()).toEqual([]);
    // Never into a slot that already holds a save, never c1.
    expect(gateway.adoptGuestKeeper('c1', 'k7lost00')).toBeFalse();
    expect(gateway.adoptGuestKeeper('c1', 'c1')).toBeFalse();
    for (const k of ['godforge-inventory@k7lost00', 'godforge-keeper-look@k7lost00', 'godforge-cloud-pending@k7lost00']) localStorage.removeItem(k);
  });

  it('"Not mine" is never offered again; a guest page is never offered anything', () => {
    localStorage.setItem(GUEST_PREFIX + 'godforge-keeper-look', JSON.stringify({ version: 1, made: true, name: 'Stranger', vocation: 'warlock' }));
    const guestPage = TestBed.inject(GameStateGateway);
    expect(guestPage.profile).toBe('guest');
    expect(guestPage.guestKeepers()).toEqual([]);
    expect(guestPage.adoptGuestKeeper('c1', 'k9x00000')).toBeFalse();
    TestBed.resetTestingModule(); TestBed.configureTestingModule({});
    localStorage.removeItem(GUEST_FLAG_KEY);
    resetBootProfileForTest();
    const gateway = TestBed.inject(GameStateGateway);
    expect(gateway.guestKeepers().map(k => k.name)).toEqual(['Stranger']);
    expect(gateway.guestKeepers()[0].playedAs).toBeNull();
    gateway.dismissGuestKeeper('c1');
    expect(gateway.guestKeepers()).toEqual([]);
  });
});
