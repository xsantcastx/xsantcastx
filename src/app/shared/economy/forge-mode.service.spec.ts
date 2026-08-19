import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import {
  DEFAULT_FORGE_MODE,
  FORGE_MODE_KEY,
  ForgeMode,
  ForgeModeService,
} from './forge-mode.service';

/**
 * The switch, on both platforms.
 *
 * The mode is a display preference and lives in localStorage directly rather
 * than in the save gateway — see the note at the top of the service — so these
 * tests drive real storage and clean up after themselves.
 */
describe('ForgeModeService', () => {
  function make(platform: 'browser' | 'server'): ForgeModeService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: platform }],
    });
    return TestBed.inject(ForgeModeService);
  }

  afterEach(() => {
    try { localStorage.removeItem(FORGE_MODE_KEY); } catch { /* private mode */ }
  });

  it('starts on Gold with nothing stored', () => {
    localStorage.removeItem(FORGE_MODE_KEY);
    const svc = make('browser');
    svc.init();
    expect(svc.mode).toBe(DEFAULT_FORGE_MODE);
    expect(svc.mode).toBe('gold');
    expect(svc.isAnvil).toBeFalse();
  });

  it('reads a stored mode on init and writes one on set', () => {
    localStorage.setItem(FORGE_MODE_KEY, 'anvil');
    const svc = make('browser');
    svc.init();
    expect(svc.mode).toBe('anvil');
    expect(svc.isAnvil).toBeTrue();

    svc.set('gold');
    expect(localStorage.getItem(FORGE_MODE_KEY)).toBe('gold');
  });

  it('toggles between the two faces and returns the one it landed on', () => {
    localStorage.removeItem(FORGE_MODE_KEY);
    const svc = make('browser');
    svc.init();
    expect(svc.toggle()).toBe('anvil');
    expect(localStorage.getItem(FORGE_MODE_KEY)).toBe('anvil');
    expect(svc.toggle()).toBe('gold');
    expect(localStorage.getItem(FORGE_MODE_KEY)).toBe('gold');
  });

  it('replays the mode to late subscribers and emits once per change', () => {
    localStorage.removeItem(FORGE_MODE_KEY);
    const svc = make('browser');
    svc.init();
    const seen: ForgeMode[] = [];
    const sub = svc.mode$.subscribe(m => seen.push(m));
    svc.toggle();
    // Setting the mode it is already on must not emit — the flame re-renders
    // on every emission and the switch is bound to a pointer.
    svc.set('anvil');
    sub.unsubscribe();
    expect(seen).toEqual(['gold', 'anvil']);
  });

  it('ignores a stored value that is not a mode', () => {
    localStorage.setItem(FORGE_MODE_KEY, 'ANVIL!!');
    const svc = make('browser');
    svc.init();
    expect(svc.mode).toBe('gold');
  });

  it('is inert on the server: the default mode, and no write', () => {
    localStorage.setItem(FORGE_MODE_KEY, 'anvil');
    const svc = make('server');
    svc.init();
    // The prerendered page shows the face every visitor starts on, whatever
    // this particular machine's browser had stored.
    expect(svc.mode).toBe('gold');

    localStorage.removeItem(FORGE_MODE_KEY);
    svc.set('anvil');
    // The in-memory value moves so an SSR render stays coherent; nothing is
    // written, because on the server there is no storage to write to.
    expect(svc.mode).toBe('anvil');
    expect(localStorage.getItem(FORGE_MODE_KEY)).toBeNull();
  });

  it('survives storage being unavailable', () => {
    const svc = make('browser');
    const getItem = spyOn(Storage.prototype, 'getItem').and.throwError('denied');
    const setItem = spyOn(Storage.prototype, 'setItem').and.throwError('denied');

    expect(() => svc.init()).not.toThrow();
    expect(svc.mode).toBe('gold');
    expect(() => svc.set('anvil')).not.toThrow();
    // The flip still took, in memory. Only the persistence was lost.
    expect(svc.mode).toBe('anvil');

    getItem.and.callThrough();
    setItem.and.callThrough();
  });
});
