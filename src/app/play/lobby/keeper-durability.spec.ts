/**
 * keeper-durability.spec.ts — a Keeper made at the Glass is that Keeper on every device, after any sign-out.
 *
 * Owner, 2026-10-21: "I created a ranger, logged me out and when logging back in, the character looked like a warlock".
 * The cloud held the new Keeper's roster row (saying "warlock") and fifteen of its documents, but no `keeper-look`:
 * the class and the face existed only on the device that made them, and two things finished the job —
 *   - the lobby's summary took the row's class from whatever look the device held, so a device (or page) without the
 *     look stamped the default Warlock over the row the Glass wrote, newer, and it won everywhere;
 *   - a character's documents went up only from a page playing that character while signed in, so a look written
 *     signed out, behind the lease, or by a page that went away before its flush never reached the cloud from any
 *     other page (the Ashguard `kzxyxtrw` had a row and no documents at all).
 *
 * These drive the real gateway, roster, look service, the Glass (KeeperMakerComponent) and the lobby
 * (PlayShellComponent's own functions) against an in-memory Firestore, for a later character and for character #1.
 */
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { LazyFirestoreService } from '../../shared/lazy-firestore.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { CloudSaveService } from '../../shared/cloud-save/cloud-save.service';
import { EconomyService } from '../../shared/economy/economy.service';
import { InventoryService } from '../../shared/rpg/inventory.service';
import { GameStateGateway, SEED_SWEEP_KEY } from '../../shared/save/game-state.gateway';
import { ACTIVE_CHARACTER_KEY, CLOUD_PENDING_KEY, PRIMARY_CHARACTER, characterStorageKey } from '../../shared/save/character-scope';
import { CharacterRosterService } from '../../shared/characters/character-roster.service';
import { CharacterRow, coerceRoster } from '../../shared/characters/character-roster.model';
import { KeeperLookService } from '../../shared/keeper-look/keeper-look.service';
import { KEEPER_LOOK_KEY, type KeeperLook, type Vocation, coerceLook } from '../../shared/keeper-look/keeper-look.model';
import { KeeperMakerComponent } from '../../shared/keeper-look/keeper-maker.component';
import { PlayShellComponent } from './play-shell.component';
import { summarise } from './character-summary';

const UID = 'u1';
const BOUND_UID_KEY = 'cloud-save-uid';
const LILITH = 'kzyn7zit';

/** Firestore, in memory: paths in, paths out, deep copies both ways (enough for attach, push, the lease). */
class FakeFirestore {
  readonly docs = new Map<string, unknown>();
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
    setDoc: async (ref: { path: string }, data: unknown) => { this.docs.set(ref.path, copy(data)); },
    deleteDoc: async (ref: { path: string }) => { this.docs.delete(ref.path); },
    writeBatch: () => {
      const staged: { path: string; data: unknown }[] = [];
      return {
        set: (ref: { path: string }, data: unknown) => { staged.push({ path: ref.path, data }); },
        commit: async () => { for (const w of staged) this.docs.set(w.path, copy(w.data)); },
      };
    },
    runTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) => {
      const staged = new Map<string, unknown>();
      const out = await fn({
        get: async (ref: { path: string }) => {
          const held = this.docs.get(ref.path);
          return { exists: () => held !== undefined, data: () => copy(held) };
        },
        set: (ref: { path: string }, data: unknown) => { staged.set(ref.path, copy(data)); },
        update: (ref: { path: string }, data: unknown) => { staged.set(ref.path, { ...(this.docs.get(ref.path) as object), ...(data as object) }); },
        delete: (ref: { path: string }) => { this.docs.delete(ref.path); },
      });
      for (const [path, data] of staged) this.docs.set(path, data);
      return out;
    },
  };
  get handle(): any { return { db: {}, api: this.api }; }

  look(character: string): KeeperLook | null {
    const path = character === PRIMARY_CHARACTER ? `users/${UID}/progress/keeper-look` : `users/${UID}/characters/${character}/progress/keeper-look`;
    const doc = this.docs.get(path) as { v?: unknown } | undefined;
    return doc ? coerceLook(doc.v) : null;
  }
  row(id: string): CharacterRow | undefined {
    const doc = this.docs.get(`users/${UID}/progress/characters`) as { v?: unknown } | undefined;
    return doc ? coerceRoster(doc.v).chars[id] : undefined;
  }
  docsOf(character: string): string[] {
    const prefix = `users/${UID}/characters/${character}/`;
    return [...this.docs.keys()].filter(p => p.startsWith(prefix));
  }
}

function copy<T>(v: T): T { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }

/** CloudSaveService as the lobby sees it: signed in (the pull landed) or not. */
class FakeCloud {
  signedIn = false;
  status = { state: 'signed-out', uid: null as string | null, email: null, displayName: null, photoURL: null, lastSyncedAt: null as number | null, error: null };
  readonly status$ = new BehaviorSubject(this.status);
  init(): void { /* the test attaches the gateway itself */ }
  settle(signedIn: boolean): void {
    this.signedIn = signedIn;
    this.status = { ...this.status, state: signedIn ? 'synced' : 'signed-out', uid: signedIn ? UID : null, lastSyncedAt: signedIn ? 1 : null };
    this.status$.next(this.status);
  }
}

interface Page {
  gateway: GameStateGateway;
  roster: CharacterRosterService;
  looks: KeeperLookService;
  cloud: FakeCloud;
  shell: PlayShellComponent;
}

describe('a Keeper made at the Glass survives sign-out, other devices and other pages', () => {
  let fake: FakeFirestore;

  /** A page load of /play on this device, playing `character`. */
  function page(character: string = PRIMARY_CHARACTER): Page {
    TestBed.resetTestingModule();
    localStorage.setItem(ACTIVE_CHARACTER_KEY, character);
    const cloud = new FakeCloud();
    TestBed.configureTestingModule({
      providers: [
        { provide: LazyFirestoreService, useValue: { get: async () => fake.handle } },
        { provide: EasterEggService, useValue: { isFound: () => false, trigger: async () => undefined, init: async () => undefined } },
        { provide: CloudSaveService, useValue: cloud },
        { provide: EconomyService, useValue: { grantCosmetic: () => undefined, init: () => undefined } },
        { provide: InventoryService, useValue: { grantStack: () => undefined, init: () => undefined, snapshot$: of({ equipped: {} }), snapshot: { equipped: {} } } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
      ],
    });
    const shell = TestBed.runInInjectionContext(() => new PlayShellComponent());
    return { gateway: TestBed.inject(GameStateGateway), roster: TestBed.inject(CharacterRosterService), looks: TestBed.inject(KeeperLookService), cloud, shell };
  }

  async function signIn(p: Page): Promise<void> {
    localStorage.setItem(BOUND_UID_KEY, UID);
    await p.gateway.attach(UID, fake.handle);
    p.cloud.settle(true);
  }

  /** What CloudSaveService.signOut does to this device: detach (one last push) and forget the binding. Nothing else. */
  async function signOut(p: Page): Promise<void> {
    await p.gateway.detach();
    localStorage.removeItem(BOUND_UID_KEY);
    p.cloud.settle(false);
  }

  /** The Glass: choose a class and a name, press Become (the maker saves; the shell writes the row). */
  function become(p: Page, vocation: Vocation, name: string): KeeperLook {
    const maker = TestBed.runInInjectionContext(() => new KeeperMakerComponent());
    let made: KeeperLook | null = null;
    maker.done.subscribe(look => { made = look; p.shell.made(look); });
    maker.setVocation(vocation);
    maker.setName(name);
    maker.keep();
    return made!;
  }

  /** New Keeper on this page: the id the lobby hands out, then the reload into it (sessionStorage carries nothing here). */
  function newKeeperId(p: Page, id: string): string {
    p.gateway.selectCharacter(id);
    return id;
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
    sessionStorage.clear();
  });

  /** Character #1, an existing Warlock, played and synced on this device. */
  async function existingWarlock(): Promise<void> {
    const c1 = page(PRIMARY_CHARACTER);
    await signIn(c1);
    become(c1, 'warlock', 'Morrow');
    await c1.gateway.flushNow();
    await c1.gateway.detach();
  }

  it('Become on a later character puts its look (Thornstrider) and a Thornstrider row in the cloud, and leaves #1 alone', async () => {
    await existingWarlock();
    const id = newKeeperId(page(PRIMARY_CHARACTER), LILITH);
    const glass = page(id);
    await signIn(glass);
    become(glass, 'thornstrider', 'Lilith');
    // pushNow is fire-and-forget in made(); give it the turn it needs.
    await glass.gateway.flushNow();

    expect(fake.look(LILITH)?.vocation).toBe('thornstrider');
    expect(fake.look(LILITH)?.made).toBeTrue();
    expect(fake.look(LILITH)?.name).toBe('Lilith');
    expect(fake.row(LILITH)?.vocation).toBe('thornstrider');
    expect(fake.row(LILITH)?.name).toBe('Lilith');
    expect(fake.row(LILITH)?.look?.vocation).toBe('thornstrider');
    // Character #1 kept its own Keeper.
    expect(fake.look(PRIMARY_CHARACTER)?.vocation).toBe('warlock');
    expect(fake.look(PRIMARY_CHARACTER)?.name).toBe('Morrow');
    await glass.gateway.detach();
  });

  it('a look made before the page attached still goes up on the attach', async () => {
    const glass = page(LILITH);
    become(glass, 'thornstrider', 'Lilith'); // the sign-in had not resumed yet
    await signIn(glass);
    await glass.gateway.flushNow();
    expect(fake.look(LILITH)?.vocation).toBe('thornstrider');
    await glass.gateway.detach();
  });

  it('a look whose page went away before its flush is pushed by the next signed-in page, whichever Keeper it plays', async () => {
    await existingWarlock();
    // Lilith made on a page that never attached (signed out, or the tab closed inside the debounce).
    const glass = page(LILITH);
    become(glass, 'thornstrider', 'Lilith');
    expect(localStorage.getItem(characterStorageKey(CLOUD_PENDING_KEY, LILITH))).toBe('1');

    // Next load is character #1, signed in: Lilith's documents go up from here.
    const c1 = page(PRIMARY_CHARACTER);
    await signIn(c1);
    await c1.gateway.flushNow();
    expect(fake.look(LILITH)?.vocation).toBe('thornstrider');
    expect(fake.row(LILITH)?.vocation).toBe('thornstrider');
    expect(localStorage.getItem(characterStorageKey(CLOUD_PENDING_KEY, LILITH))).toBeNull();
    expect(fake.look(PRIMARY_CHARACTER)?.name).toBe('Morrow');
    await c1.gateway.detach();
  });

  it('an older character this device holds with no documents (the Ashguard) is pushed once on sign-in', async () => {
    // Written by an older build: local blobs, a row, no pending mark, no documents.
    localStorage.setItem(characterStorageKey(KEEPER_LOOK_KEY, 'kzxyxtrw'), JSON.stringify({ ...coerceLook({}), made: true, name: 'Ash', vocation: 'ashguard', updatedAt: 5 }));
    localStorage.setItem(characterStorageKey('godforge-inventory', 'kzxyxtrw'), JSON.stringify({ version: 1, items: [] }));
    localStorage.setItem('eclipse-characters', JSON.stringify({ v: 1, chars: { kzxyxtrw: { id: 'kzxyxtrw', name: 'Ash', vocation: 'ashguard', level: 1, area: '', look: null, createdAt: 2, updatedAt: 2 } } }));
    const c1 = page(PRIMARY_CHARACTER);
    await signIn(c1);
    expect(fake.look('kzxyxtrw')?.vocation).toBe('ashguard');
    expect(fake.docsOf('kzxyxtrw').length).toBeGreaterThanOrEqual(2);
    expect(localStorage.getItem(SEED_SWEEP_KEY)).toBe(UID);
    await c1.gateway.detach();
  });

  it('sign out keeps every local save; a fresh device signing in plays the Thornstrider with her look', async () => {
    await existingWarlock();
    const glass = page(newKeeperId(page(PRIMARY_CHARACTER), LILITH));
    await signIn(glass);
    const made = become(glass, 'thornstrider', 'Lilith');
    await glass.gateway.flushNow();

    await signOut(glass);
    // Signing out clears nothing on this device.
    expect(coerceLook(JSON.parse(localStorage.getItem(characterStorageKey(KEEPER_LOOK_KEY, LILITH))!)).vocation).toBe('thornstrider');
    expect(localStorage.getItem(KEEPER_LOOK_KEY)).not.toBeNull();

    // A fresh device: nothing local at all. It boots #1 and signs in; the list summarises what it holds.
    localStorage.clear();
    const list = page(PRIMARY_CHARACTER);
    await signIn(list);
    for (const row of list.roster.characters) {
      const next = summarise(list.gateway, row);
      if (next !== row) list.roster.put(next);
    }
    expect(list.roster.row(LILITH)?.vocation).toBe('thornstrider');
    expect(list.looks.look.name).toBe('Morrow');
    await list.gateway.detach();

    // Entering Lilith: the page boots her and writes a few first-visit ledgers before the pull lands (the
    // summary taken then must not turn her into a Warlock), then the pull brings her look down.
    const her = page(LILITH);
    her.gateway.write('godforge-inventory', { version: 1, items: [] });
    const early = summarise(her.gateway, her.roster.row(LILITH)!);
    expect(early.vocation).toBe('thornstrider');
    await signIn(her);
    expect(her.looks.look.vocation).toBe('thornstrider');
    expect(her.looks.look.made).toBeTrue();
    expect(her.looks.look.name).toBe('Lilith');
    expect(her.looks.look.hair).toBe(made.hair);
    // The lobby enters her world, not the Glass.
    await her.shell.enter(LILITH);
    expect(her.shell.mode).toBe('game');
    expect(fake.row(LILITH)?.vocation).toBe('thornstrider');
    await her.gateway.detach();
  });

  it('character #1 made as a Thornstrider on a device never signed in comes back a Thornstrider on a fresh device', async () => {
    const first = page(PRIMARY_CHARACTER);
    become(first, 'thornstrider', 'Rue');
    await signIn(first);
    await first.gateway.flushNow();
    expect(fake.look(PRIMARY_CHARACTER)?.vocation).toBe('thornstrider');
    expect(fake.row(PRIMARY_CHARACTER)?.vocation).toBe('thornstrider');
    await signOut(first);

    localStorage.clear();
    const fresh = page(PRIMARY_CHARACTER);
    fresh.gateway.write('godforge-inventory', { version: 1, items: [] });
    expect(summarise(fresh.gateway, coerceRoster({ v: 1, chars: { c1: fake.row(PRIMARY_CHARACTER) } }).chars['c1']).vocation).toBe('thornstrider');
    await signIn(fresh);
    expect(fresh.looks.look.vocation).toBe('thornstrider');
    expect(fresh.looks.look.name).toBe('Rue');
    await fresh.shell.enter(PRIMARY_CHARACTER);
    expect(fresh.shell.mode).toBe('game');
    await fresh.gateway.detach();
  });

  it('a made Keeper booted with no row on this device (a stale roster) gets its row back, never a wipe', async () => {
    localStorage.setItem(characterStorageKey(KEEPER_LOOK_KEY, LILITH), JSON.stringify({ ...coerceLook({}), made: true, name: 'Lilith', vocation: 'thornstrider', updatedAt: 5 }));
    localStorage.setItem(characterStorageKey('godforge-inventory', LILITH), JSON.stringify({ version: 1, items: [] }));
    localStorage.setItem('eclipse-lobby-guest', '1');
    const her = page(LILITH);
    await (her.shell as unknown as { decide(): Promise<void> }).decide();
    expect(her.roster.row(LILITH)?.vocation).toBe('thornstrider');
    expect(her.roster.row(LILITH)?.name).toBe('Lilith');
    expect(localStorage.getItem(characterStorageKey(KEEPER_LOOK_KEY, LILITH))).not.toBeNull();
    expect(localStorage.getItem(ACTIVE_CHARACTER_KEY)).toBe(LILITH);
  });

  describe('the recovery Glass (a Keeper on the list whose look was never made anywhere)', () => {
    function lostRow(vocation = 'warlock'): void {
      // The cloud as the owner's account holds it: the row (a later summary turned it Warlock), documents, no look.
      fake.docs.set(`users/${UID}/progress/characters`, { v: { v: 1, chars: { [LILITH]: { id: LILITH, name: 'Lilith', vocation, level: 1, area: '', look: null, createdAt: 1792582655717, updatedAt: 1792582700000 } } }, updatedAt: 'x' });
      fake.docs.set(`users/${UID}/characters/${LILITH}/progress/inventory`, { v: { version: 1, items: [] }, updatedAt: 'x' });
    }

    it('opens the Glass on the row (name and class prefilled, class still choosable) instead of a default Warlock', async () => {
      lostRow('warlock');
      const her = page(LILITH);
      await signIn(her);
      await her.shell.enter(LILITH);
      expect(her.shell.mode).toBe('create');

      const maker = TestBed.runInInjectionContext(() => new KeeperMakerComponent());
      expect(maker.draft.name).toBe('Lilith');
      expect(maker.draft.vocation).toBe('warlock'); // what the row says: never converted behind the player's back
      expect(maker.locked).toBeFalse();
      maker.done.subscribe(look => her.shell.made(look));
      maker.setVocation('thornstrider');
      maker.keep();
      await her.gateway.flushNow();

      expect(her.shell.mode).toBe('game');
      expect(fake.look(LILITH)?.vocation).toBe('thornstrider');
      expect(fake.row(LILITH)?.vocation).toBe('thornstrider');
      expect(fake.row(LILITH)?.createdAt).toBe(1792582655717);
      await her.gateway.detach();
    });

    it('leaving that Glass goes back to the list and deletes nothing', async () => {
      lostRow();
      const her = page(LILITH);
      await signIn(her);
      await her.shell.enter(LILITH);
      expect(her.shell.mode).toBe('create');
      await her.shell.backFromCreate();
      expect(her.shell.mode).toBe('select');
      expect(her.roster.row(LILITH)).toBeDefined();
      expect(fake.docs.has(`users/${UID}/characters/${LILITH}/progress/inventory`)).toBeTrue();
      await her.gateway.detach();
    });

    it('is not shown while the pull has not landed, nor for a made Keeper, nor for a nameless pre-Glass #1', async () => {
      lostRow();
      const her = page(LILITH);
      localStorage.setItem(BOUND_UID_KEY, UID);
      her.roster.put({ id: LILITH, name: 'Lilith', vocation: 'warlock', level: 1, area: '', look: null, createdAt: 1, updatedAt: 1 });
      await her.shell.enter(LILITH); // bound, the session not back yet: the cloud may still hold her look
      expect(her.shell.mode).toBe('game');

      const old = page(PRIMARY_CHARACTER);
      localStorage.removeItem(BOUND_UID_KEY);
      old.roster.put({ id: PRIMARY_CHARACTER, name: '', vocation: 'warlock', level: 3, area: '', look: null, createdAt: 0, updatedAt: 1 });
      await old.shell.enter(PRIMARY_CHARACTER);
      expect(old.shell.mode).toBe('game');
    });
  });
});
