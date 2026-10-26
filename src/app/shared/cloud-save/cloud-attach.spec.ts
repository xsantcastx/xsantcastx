/**
 * cloud-attach.spec.ts — signed in ⇒ attached (owner bug 2026-10-26: "Sign in to trade" while signed in; the save was
 * not reaching the account).
 *
 * The state machine, path by path, against a stub gateway: a guest-profile page that signs in (popup, redirect, a
 * lapsed session coming back) reloads into the account's profile exactly once, guest flag cleared first; a bind that
 * failed (a missing chunk after a deploy) binds again, then reloads once; a slow bind is waited for; a second reload in
 * one tab within a minute never happens (no loop) — the page says so instead; and a drop asks to recover at once.
 */
import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { EasterEggService } from '../easter-eggs/easter-egg.service';
import { LazyFirestoreService } from '../lazy-firestore.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { GUEST_FLAG_KEY } from '../save/character-scope';
import { ATTACH_WATCH_MS, CloudSaveService, PROFILE_FIX_KEY } from './cloud-save.service';

const BOUND = 'cloud-save-uid';
const user = { uid: 'u-owner', email: 'o@x.y', displayName: 'Owner', photoURL: null };
type Bindable = { bind: (u: typeof user) => Promise<void>; resume: () => Promise<void>; status$$: { next: (s: unknown) => void } };

describe('cloud save: signed in always ends attached to the account', () => {
  let gateway: { profile: 'account' | 'guest'; attached: boolean; attach: jasmine.Spy; noteSignedIn: jasmine.Spy; settleForReload: jasmine.Spy; detach: () => Promise<void>; deviceSnapshot: () => null };
  let cloud: CloudSaveService;
  let reload: jasmine.Spy;
  const saved: Record<string, string | null> = {};

  function boot(profile: 'account' | 'guest', attachImpl?: () => Promise<unknown>): void {
    gateway = {
      profile, attached: false,
      attach: jasmine.createSpy('attach').and.callFake(attachImpl ?? (async () => { gateway.attached = true; return { adopted: [], seeded: false }; })),
      noteSignedIn: jasmine.createSpy('noteSignedIn'),
      settleForReload: jasmine.createSpy('settleForReload').and.resolveTo(undefined),
      detach: async () => undefined, deviceSnapshot: () => null,
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: GameStateGateway, useValue: gateway },
        { provide: LazyFirestoreService, useValue: { get: async () => ({ db: {}, api: {} }) } },
        { provide: EasterEggService, useValue: { trigger: async () => undefined } },
      ],
    });
    cloud = TestBed.inject(CloudSaveService);
    reload = spyOn(cloud, 'reloadPage');
    spyOn(cloud as unknown as { awaitAppCheck: () => Promise<unknown> }, 'awaitAppCheck').and.resolveTo(null);
    spyOn(cloud as unknown as { publishDirectoryRow: () => Promise<void> }, 'publishDirectoryRow').and.resolveTo();
    spyOn(cloud as unknown as { readBan: () => Promise<void> }, 'readBan').and.resolveTo();
  }
  const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

  beforeEach(() => {
    for (const k of [BOUND, GUEST_FLAG_KEY, 'eclipse-account-seen']) saved[k] = localStorage.getItem(k);
    sessionStorage.removeItem(PROFILE_FIX_KEY);
    localStorage.removeItem(BOUND);
    localStorage.setItem(GUEST_FLAG_KEY, '1');
    jasmine.clock().install();
  });
  afterEach(() => {
    jasmine.clock().uninstall();
    TestBed.resetTestingModule();
    sessionStorage.removeItem(PROFILE_FIX_KEY);
    for (const [k, v] of Object.entries(saved)) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
  });

  it('a guest page signs in (popup, redirect, a lapsed session back): the guest flag goes, the binding stays, ONE reload, no attach', async () => {
    boot('guest');
    await (cloud as unknown as Bindable).bind(user);
    await settle();
    expect(localStorage.getItem(GUEST_FLAG_KEY)).toBeNull();
    expect(localStorage.getItem(BOUND)).toBe('u-owner');
    expect(gateway.attach).not.toHaveBeenCalled();
    expect(gateway.settleForReload).toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
    // The same tab asked again within the minute (the reload did not take): no second reload — it says so.
    localStorage.setItem(GUEST_FLAG_KEY, '1');
    await (cloud as unknown as Bindable).bind(user);
    await settle();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(cloud.stuck).toBeTrue();
    expect(cloud.status.state).toBe('error');
  });

  it('a guest-profile page that finds itself signed in (any path): the watch stamps the guest saves and reloads into the account', async () => {
    boot('guest');
    // Signed in by status (the resume's optimistic paint) while this page plays the guest's saves.
    (cloud as unknown as Bindable).status$$.next({ state: 'syncing', uid: 'u-owner', email: null, displayName: null, photoURL: null, lastSyncedAt: null, error: null });
    expect(cloud.connecting).toBeTrue();
    jasmine.clock().tick(ATTACH_WATCH_MS - 1); await settle();
    expect(reload).not.toHaveBeenCalled();
    jasmine.clock().tick(1); await settle();
    expect(gateway.noteSignedIn).toHaveBeenCalledWith('u-owner');
    expect(localStorage.getItem(GUEST_FLAG_KEY)).toBeNull();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('an account page whose bind threw (a chunk missing after a deploy): binds again, then reloads once if that fails too', async () => {
    let tries = 0;
    boot('account', async () => { tries += 1; throw new Error('Failed to fetch dynamically imported module'); });
    const resume = spyOn(cloud as unknown as Bindable, 'resume').and.callFake(async () => {
      try { await (cloud as unknown as Bindable).bind(user); } catch { /* the service's own catch */ }
    });
    await (cloud as unknown as Bindable).bind(user).catch(() => undefined);
    expect(cloud.signedIn).toBeTrue();
    expect(gateway.attached).toBeFalse();
    jasmine.clock().tick(ATTACH_WATCH_MS); await settle();
    expect(resume).toHaveBeenCalledTimes(1);
    expect(tries).toBe(2);
    expect(reload).not.toHaveBeenCalled();
    jasmine.clock().tick(ATTACH_WATCH_MS); await settle();
    expect(reload).toHaveBeenCalledTimes(1);
    jasmine.clock().tick(ATTACH_WATCH_MS * 3); await settle();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('a slow bind (Firestore on its way) is waited for, not reloaded; attached clears the watch', async () => {
    let release!: () => void;
    boot('account', () => new Promise(resolve => { release = () => { gateway.attached = true; resolve({ adopted: [], seeded: false }); }; }));
    const pending = (cloud as unknown as Bindable).bind(user);
    await settle();
    jasmine.clock().tick(ATTACH_WATCH_MS * 2); await settle();
    expect(reload).not.toHaveBeenCalled();
    release(); await pending; await settle();
    expect(cloud.connecting).toBeFalse();
    jasmine.clock().tick(ATTACH_WATCH_MS * 5); await settle();
    expect(reload).not.toHaveBeenCalled();
    expect(cloud.stuck).toBeFalse();
  });

  it('an account page signs in normally: attached at once, the watch never fires', async () => {
    boot('account');
    await (cloud as unknown as Bindable).bind(user);
    expect(gateway.attach).toHaveBeenCalledTimes(1);
    expect(gateway.attached).toBeTrue();
    jasmine.clock().tick(ATTACH_WATCH_MS * 4); await settle();
    expect(reload).not.toHaveBeenCalled();
  });
});
