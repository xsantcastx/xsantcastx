/**
 * forged-today.service.spec.ts — the day key, and the two honesty properties.
 *
 * What is worth pinning here is not the Firestore call — that is the same
 * write-only `increment(1)` the visit counter has always made, against a rule
 * this collection has always had. It is the two decisions that make the number
 * believable:
 *
 *   · the day boundary is LOCAL, not UTC. A visitor in Madrid at 00:30 is on
 *     today's board, not yesterday's. Getting this wrong is invisible in a
 *     UTC+0 test suite and wrong for most of the world.
 *   · null and 0 are different states. null is "not told yet" and renders
 *     nothing; 0 is a claim this can never truthfully make, because the person
 *     reading the number has themselves just been counted.
 */
import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { ForgedTodayService, localDayKey, FORGED_REFRESH_MS } from './forged-today.service';

describe('localDayKey', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(localDayKey(new Date(2026, 7, 25, 12, 0, 0))).toBe('2026-08-25');
  });

  it('zero-pads single-digit months and days', () => {
    expect(localDayKey(new Date(2026, 0, 5, 12, 0, 0))).toBe('2026-01-05');
  });

  it('uses the local day, not the UTC one', () => {
    // Half past midnight local. `toISOString().slice(0,10)` would report the
    // previous day for any timezone east of UTC, which would put a European
    // visitor on yesterday's board for the first hours of every day.
    const justAfterMidnight = new Date(2026, 7, 25, 0, 30, 0);
    expect(localDayKey(justAfterMidnight)).toBe('2026-08-25');

    // And late evening local, which is the mirror failure west of UTC.
    const lateEvening = new Date(2026, 7, 25, 23, 30, 0);
    expect(localDayKey(lateEvening)).toBe('2026-08-25');
  });
});

describe('ForgedTodayService', () => {
  it('publishes null until it has been told a real number', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const service = TestBed.inject(ForgedTodayService);

    // Not 0. A zero would assert that nobody has been here today, in front of
    // somebody who is here today.
    expect(service.count$.value).toBeNull();
  });

  it('does nothing on the server', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });
    const service = TestBed.inject(ForgedTodayService);

    // start() must be safe to call during prerender: it touches localStorage,
    // sessionStorage and Firestore, none of which exist there.
    await expectAsync(service.start()).toBeResolved();
    expect(service.count$.value).toBeNull();
  });

  it('polls on a cadence a visitor would read as live', () => {
    // Pinned so a future "let's just make it five minutes" is a deliberate
    // decision with a failing test in front of it rather than a quiet edit.
    expect(FORGED_REFRESH_MS).toBe(60_000);
  });
});
