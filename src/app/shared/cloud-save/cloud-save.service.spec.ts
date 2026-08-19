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
