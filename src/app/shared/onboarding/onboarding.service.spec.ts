/**
 * onboarding.service.spec.ts — who gets the tutorial, and who never sees it again.
 *
 * The two regressions these tests own are both failures of *timing* rather than
 * of logic, and both would ship green without them:
 *
 *   1. The freshness check is read once, at construction. If it were re-derived
 *      on demand, the tutorial's own second screen — which strikes the real
 *      forge and therefore writes the wallet — would make the service report
 *      "returning visitor" halfway through its own run and tear the overlay
 *      down mid-step. The test for this drives the storage change *after*
 *      construction and asserts the answer does not move.
 *
 *   2. `active` must be false at construction on every platform. A signal that
 *      read storage eagerly would be true during the server render too, where
 *      storage is unreadable and the answer is always "new visitor" — baking
 *      the overlay into the prerendered HTML of /world, serving it to Google
 *      and to every returning visitor, and then tearing it down on hydration.
 */
import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { OnboardingService, ONBOARDING_KEY, ONBOARDING_STEPS } from './onboarding.service';
import { PROGRESS_KEY } from '../gamification/gamification.model';
import { ECONOMY_KEY } from '../economy/economy.service';

/** A save blob's shape does not matter here — only that the key is present. */
const ANY_SAVE = JSON.stringify({ xp: 1 });

function makeService(): OnboardingService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({});
  return TestBed.inject(OnboardingService);
}

describe('OnboardingService', () => {
  beforeEach(() => {
    localStorage.removeItem(ONBOARDING_KEY);
    localStorage.removeItem(PROGRESS_KEY);
    localStorage.removeItem(ECONOMY_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(ONBOARDING_KEY);
    localStorage.removeItem(PROGRESS_KEY);
    localStorage.removeItem(ECONOMY_KEY);
  });

  it('onboards a browser with no save and no record', () => {
    expect(makeService().shouldOnboard()).toBe(true);
  });

  it('does not onboard a browser that already has progression', () => {
    localStorage.setItem(PROGRESS_KEY, ANY_SAVE);
    expect(makeService().shouldOnboard()).toBe(false);
  });

  it('does not onboard a browser that already has a wallet', () => {
    // The wallet alone is enough. A visitor who only ever struck the flame has
    // no progression blob, and treating them as new would replay the tutorial
    // over a forge they have already been using.
    localStorage.setItem(ECONOMY_KEY, ANY_SAVE);
    expect(makeService().shouldOnboard()).toBe(false);
  });

  it('does not onboard a browser that has already been shown it', () => {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ done: true, lastStep: 2, at: '' }));
    expect(makeService().shouldOnboard()).toBe(false);
  });

  it('renders nothing until start() is called', () => {
    // The prerender contract: constructing the service must never raise the
    // overlay, however new the browser looks.
    expect(makeService().active()).toBe(false);
  });

  it('holds its freshness answer once the run has begun', () => {
    const service = makeService();
    service.start();
    expect(service.active()).toBe(true);

    // Screen two strikes the real forge, which writes the wallet. This is that
    // write. The verdict must not move underneath the running tutorial.
    localStorage.setItem(ECONOMY_KEY, ANY_SAVE);

    expect(service.shouldOnboard()).toBe(true);
    expect(service.active()).toBe(true);
  });

  it('walks the steps and finishes on the last one', () => {
    const service = makeService();
    service.start();
    expect(service.step()).toBe(1);

    for (let i = 1; i < ONBOARDING_STEPS; i++) service.next();
    expect(service.step()).toBe(ONBOARDING_STEPS);
    expect(service.active()).toBe(true);

    // One more `next()` on the last screen ends the run rather than walking off
    // the end of the board.
    service.next();
    expect(service.active()).toBe(false);
    expect(service.hasRecord()).toBe(true);
  });

  it('never returns after a skip', () => {
    const service = makeService();
    service.start();
    service.next();
    service.finish(service.step());

    expect(service.active()).toBe(false);
    // A fresh service on the same storage — this is the next page load.
    expect(makeService().shouldOnboard()).toBe(false);
  });

  it('records which step the run ended on', () => {
    const service = makeService();
    service.start();
    service.next();
    service.next();
    service.finish(service.step());

    const record = JSON.parse(localStorage.getItem(ONBOARDING_KEY)!);
    expect(record.done).toBe(true);
    expect(record.lastStep).toBe(3);
  });

  describe('on the server', () => {
    it('never onboards and never touches storage', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
      });
      const service = TestBed.inject(OnboardingService);

      expect(service.shouldOnboard()).toBe(false);
      expect(service.active()).toBe(false);

      // finish() is reachable on the server through a shared code path; it must
      // lower the flag without writing a record that the client would then read
      // as "already seen".
      service.finish(ONBOARDING_STEPS);
      expect(localStorage.getItem(ONBOARDING_KEY)).toBeNull();
    });
  });
});
