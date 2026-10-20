import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { EasterEggService } from '../easter-eggs/easter-egg.service';
import { LazyFirestoreService } from '../lazy-firestore.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { CloudSaveService, describeSyncError } from './cloud-save.service';

describe('describeSyncError', () => {
  it('names an App Check rejection instead of the generic sync failure', () => {
    expect(describeSyncError({ code: 'failed-precondition', message: 'App Check token is invalid' }))
      .toContain('security check');
    expect(describeSyncError({ code: 'app-check/fetch-status-error', message: 'token' }))
      .toContain('security check');
    expect(describeSyncError({ code: 'permission-denied', message: 'Missing or insufficient permissions' }))
      .toContain('refused that write');
  });
});

describe('CloudSaveService.bind waits for App Check', () => {
  let awaitAppCheck: jasmine.Spy;
  let attach: jasmine.Spy;
  let firestoreGet: jasmine.Spy;

  beforeEach(() => {
    awaitAppCheck = spyOn(CloudSaveService.prototype as unknown as { awaitAppCheck: () => Promise<unknown> }, 'awaitAppCheck')
      .and.returnValue(Promise.resolve(null));
    attach = jasmine.createSpy('attach').and.resolveTo({ adopted: [], seeded: true });
    firestoreGet = jasmine.createSpy('get').and.resolveTo({ db: {}, api: {} });

    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: GameStateGateway,
          // Every method the service calls has to exist here — this is a
          // `useValue` stub, so a missing one is a runtime TypeError that tsc
          // cannot see.
          useValue: {
            attach,
            detach: async () => undefined,
            deviceSnapshot: () => null,
            restoreDeviceSnapshot: async () => true,
          },
        },
        { provide: LazyFirestoreService, useValue: { get: firestoreGet } },
        { provide: EasterEggService, useValue: { trigger: async () => undefined } },
      ],
    });
  });

  it('does not open Firestore until App Check has settled', async () => {
    let release!: (value: null) => void;
    awaitAppCheck.and.returnValue(new Promise<null>(resolve => { release = resolve; }));

    const cloud = TestBed.inject(CloudSaveService);
    const pending = (cloud as unknown as {
      bind: (user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }) => Promise<void>;
    }).bind({ uid: 'u1', email: 'a@b.c', displayName: 'A', photoURL: null });

    await Promise.resolve();
    expect(awaitAppCheck).toHaveBeenCalled();
    expect(firestoreGet).not.toHaveBeenCalled();
    expect(attach).not.toHaveBeenCalled();

    release(null);
    await pending;

    expect(firestoreGet).toHaveBeenCalled();
    expect(attach).toHaveBeenCalled();
  });
});

/**
 * Resuming on page load — the cross-save path (docs/handoff/cross-save.md).
 *
 * A signed-in device must re-attach to Firestore on every load without the
 * player touching anything: that attach is both the pull (another device's
 * progress lands here) and what arms the push (this device's play goes up).
 * When the shell stopped calling `init()` the whole feature went dark while
 * every spec here stayed green, because none of them started from a reload.
 */
describe('CloudSaveService.init resumes a signed-in device', () => {
  const BOUND = 'cloud-save-uid';
  const REDIRECT = 'cloud-save-redirect';
  const user = { uid: 'u-phone', email: 'p@x.y', displayName: 'P', photoURL: null };

  let attach: jasmine.Spy;
  let authLoads: jasmine.Spy;
  let fakeAuth: {
    getAuth: jasmine.Spy;
    getRedirectResult: jasmine.Spy;
    onAuthStateChanged: jasmine.Spy;
  };

  beforeEach(() => {
    localStorage.removeItem(BOUND);
    sessionStorage.removeItem(REDIRECT);
    spyOn(CloudSaveService.prototype as unknown as { awaitAppCheck: () => Promise<unknown> }, 'awaitAppCheck')
      .and.returnValue(Promise.resolve(null));
    // Run the idle callback straight away; the timing is not what is under test.
    spyOn(CloudSaveService.prototype as unknown as { whenIdle: (fn: () => void) => void }, 'whenIdle')
      .and.callFake((fn: () => void) => fn());

    fakeAuth = {
      getAuth: jasmine.createSpy('getAuth').and.returnValue({}),
      getRedirectResult: jasmine.createSpy('getRedirectResult').and.resolveTo(null),
      onAuthStateChanged: jasmine.createSpy('onAuthStateChanged')
        .and.callFake((_auth: unknown, next: (u: unknown) => void) => { setTimeout(() => next(user)); return () => undefined; }),
    };
    authLoads = spyOn(CloudSaveService.prototype as unknown as { auth: () => Promise<unknown> }, 'auth')
      .and.callFake(() => Promise.resolve(fakeAuth));

    attach = jasmine.createSpy('attach').and.resolveTo({ adopted: ['godforge-economy'], seeded: false });
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: GameStateGateway,
          useValue: {
            attach,
            detach: async () => undefined,
            deviceSnapshot: () => null,
            restoreDeviceSnapshot: async () => true,
          },
        },
        { provide: LazyFirestoreService, useValue: { get: async () => ({ db: {}, api: {} }) } },
        { provide: EasterEggService, useValue: { trigger: async () => undefined } },
      ],
    });
  });

  afterEach(() => {
    localStorage.removeItem(BOUND);
    sessionStorage.removeItem(REDIRECT);
  });

  async function settled(cloud: CloudSaveService): Promise<void> {
    for (let i = 0; i < 50 && cloud.status.state === 'syncing'; i++) {
      await new Promise(r => setTimeout(r, 5));
    }
  }

  it('re-attaches the bound account on load, with no click', async () => {
    localStorage.setItem(BOUND, user.uid);
    const cloud = TestBed.inject(CloudSaveService);

    cloud.init();
    expect(cloud.status.uid).toBe(user.uid);
    await settled(cloud);

    expect(attach).toHaveBeenCalledTimes(1);
    expect(attach.calls.mostRecent().args[0]).toBe(user.uid);
    expect(cloud.status.state).toBe('synced');
  });

  it('finishes a redirect sign-in that has just come back from Google', async () => {
    sessionStorage.setItem(REDIRECT, '1');
    const cloud = TestBed.inject(CloudSaveService);

    cloud.init();
    await settled(cloud);

    expect(fakeAuth.getRedirectResult).toHaveBeenCalled();
    expect(attach).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(BOUND)).toBe(user.uid);
    expect(sessionStorage.getItem(REDIRECT)).toBeNull();
  });

  it('costs a signed-out visitor nothing: no auth SDK, no Firestore, no attach', async () => {
    // A timer the previous spec left running (its fake sign-in) can land here: let it drain, then count from zero.
    await new Promise(r => setTimeout(r, 30));
    authLoads.calls.reset(); attach.calls.reset();
    const cloud = TestBed.inject(CloudSaveService);

    cloud.init();
    await new Promise(r => setTimeout(r, 20));

    expect(authLoads).not.toHaveBeenCalled();
    expect(attach).not.toHaveBeenCalled();
    expect(cloud.status.state).toBe('off');
  });

  it('drops a lapsed binding instead of syncing forever', async () => {
    localStorage.setItem(BOUND, user.uid);
    fakeAuth.onAuthStateChanged.and.callFake((_a: unknown, next: (u: unknown) => void) => {
      setTimeout(() => next(null));
      return () => undefined;
    });
    const cloud = TestBed.inject(CloudSaveService);

    cloud.init();
    await settled(cloud);

    expect(attach).not.toHaveBeenCalled();
    expect(cloud.status.state).toBe('off');
    expect(localStorage.getItem(BOUND)).toBeNull();
  });
});
