/**
 * celebration-audio.service.spec.ts — off by default, and it remembers.
 *
 * The synthesis itself is not tested: asserting that a sawtooth is a sawtooth
 * would test the Web Audio API, not this file. What is worth guarding is the
 * contract around it — that a visitor who has not asked for a thunderclap does
 * not get one, that the choice survives a reload, and that reduced motion
 * silences it the way it silences everything else on the site.
 */
import { TestBed } from '@angular/core/testing';

import { CelebrationAudioService, SOUND_PREF_KEY } from './celebration-audio.service';

describe('CelebrationAudioService', () => {
  function make(): CelebrationAudioService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(CelebrationAudioService);
  }

  beforeEach(() => localStorage.removeItem(SOUND_PREF_KEY));
  afterEach(() => localStorage.removeItem(SOUND_PREF_KEY));

  it('is off until asked for', () => {
    expect(make().enabled).toBe(false);
  });

  it('remembers being turned on', () => {
    make().setEnabled(true);
    expect(localStorage.getItem(SOUND_PREF_KEY)).toBe('1');
    // A fresh instance is what the next page load gets.
    expect(make().enabled).toBe(true);
  });

  it('remembers being turned off again', () => {
    const on = make();
    on.setEnabled(true);
    on.setEnabled(false);
    expect(localStorage.getItem(SOUND_PREF_KEY)).toBe('0');
    expect(make().enabled).toBe(false);
  });

  it('treats anything but the on value as off', () => {
    // Guards against a stray value from an older build reading as "on" and
    // handing someone a thunderclap they never asked for.
    localStorage.setItem(SOUND_PREF_KEY, 'true');
    expect(make().enabled).toBe(false);
  });

  it('publishes the state for the toggle to bind to', () => {
    const svc = make();
    const seen: boolean[] = [];
    const sub = svc.enabled$.subscribe(v => seen.push(v));
    svc.toggle();
    svc.toggle();
    sub.unsubscribe();
    expect(seen).toEqual([false, true, false]);
  });

  it('does not emit when set to the value it already has', () => {
    const svc = make();
    const seen: boolean[] = [];
    const sub = svc.enabled$.subscribe(v => seen.push(v));
    svc.setEnabled(false);
    svc.setEnabled(false);
    sub.unsubscribe();
    expect(seen).toEqual([false]);
  });

  it('builds no AudioContext while it is off', () => {
    // The whole point of defaulting to off: a visitor who never turns it on
    // never pays for an audio graph. Every profile is fired to be sure none of
    // them takes a shortcut around the check.
    const spy = spyOn(window, 'AudioContext').and.callThrough();
    const svc = make();
    for (const p of ['ping', 'chime', 'chime-bass', 'thunder-horn', 'crescendo', 'void'] as const) {
      svc.play(p);
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it('never plays the silent profile', () => {
    // Enabled through storage rather than through setEnabled(), which builds
    // the context inside the click on purpose — going through it here would
    // cache a context and make the assertion below vacuous.
    localStorage.setItem(SOUND_PREF_KEY, '1');
    const svc = make();
    const spy = spyOn(window, 'AudioContext').and.callThrough();
    svc.play('none');
    expect(spy).not.toHaveBeenCalled();
  });

  it('stays silent under reduced motion even when it is on', () => {
    localStorage.setItem(SOUND_PREF_KEY, '1');
    const svc = make();
    expect(svc.enabled).toBe(true);
    spyOn(window, 'matchMedia').and.returnValue(
      { matches: true } as unknown as MediaQueryList,
    );
    const spy = spyOn(window, 'AudioContext').and.callThrough();
    svc.play('crescendo');
    expect(spy).not.toHaveBeenCalled();
  });
});
