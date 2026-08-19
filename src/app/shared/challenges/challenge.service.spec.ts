/**
 * challenge.service.spec.ts — the Contract Board's state machine.
 *
 * Every dependency is a stub, so what is under test is only the board's own
 * arithmetic: the draw, the counters, the receipt, the sweep, the streak, and
 * the two ways a double payout could otherwise happen.
 *
 * The date is *not* stubbed. `dayKey()` reads the real clock, and the specs are
 * written to be true on any day rather than pinned to one — a suite that only
 * passes in the first half of August is a suite that will fail in CI at
 * midnight and be blamed on the wrong change.
 */
import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { ChallengeService } from './challenge.service';
import {
  CHALLENGE_KEY,
  DAILY_CHALLENGES,
  DAILY_CHALLENGE_SLOTS,
  STREAK_BOOST_MULTIPLIER,
} from './challenge.model';
import { EconomyService } from '../economy/economy.service';
import { XpService } from '../gamification/xp.service';
import { RuneForgeService } from '../rune-forge/rune-forge.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';

describe('ChallengeService', () => {
  let store: Map<string, string>;
  let challenges: ChallengeService;
  let minted: { amount: number; source: string }[];
  let boosts: { multiplier: number; until: number }[];
  let granted: unknown[];

  beforeEach(() => {
    store = new Map();
    minted = [];
    boosts = [];
    granted = [];

    TestBed.configureTestingModule({
      providers: [
        ChallengeService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: EconomyService,
          useValue: {
            earnGold: (amount: number, source: string) => {
              minted.push({ amount, source });
              return amount;
            },
            setEventBoost: (multiplier: number, until: number) => {
              boosts.push({ multiplier, until });
            },
          },
        },
        {
          provide: XpService,
          useValue: {
            snapshot: { level: { level: 1 } },
            snapshot$: new BehaviorSubject({ level: { level: 1 } }),
            init: () => undefined,
          },
        },
        { provide: RuneForgeService, useValue: { grant: (r: unknown) => { granted.push(r); return null; } } },
        {
          provide: GameStateGateway,
          useValue: {
            readRaw: (key: string) => store.get(key) ?? null,
            write: (key: string, value: unknown) => store.set(key, JSON.stringify(value)),
            remove: (key: string) => store.delete(key),
          },
        },
        { provide: LocalSaveRegistry, useValue: { register: () => undefined } },
      ],
    });
    challenges = TestBed.inject(ChallengeService);
    challenges.init();
  });

  /** Drive a challenge to its target, whatever family its metric is in. */
  function complete(id: string): void {
    const def = DAILY_CHALLENGES.find(c => c.id === id)!;
    if (def.metric === 'combo-peak' || def.metric === 'rune-tier') {
      challenges.recordPeak(def.metric, def.target);
    } else if (def.metric === 'hall-variety') {
      for (let i = 0; i < def.target; i++) challenges.recordMember(def.metric, `/world/h${i}`);
    } else {
      challenges.record(def.metric, def.target);
    }
  }

  it('draws a full daily and weekly board', () => {
    expect(challenges.board.daily.length).toBe(DAILY_CHALLENGE_SLOTS);
    expect(challenges.board.weekly.length).toBeGreaterThan(0);
  });

  it('starts every card at zero and none complete', () => {
    for (const c of challenges.board.daily) {
      expect(c.observed).toBe(0);
      expect(c.progress).toBe(0);
      expect(c.status).toBe('active');
    }
    expect(challenges.board.unclaimed).toBe(0);
  });

  it('moves a counted card and caps its progress at the target', () => {
    // Explicitly a *counted* card: today's board is a deterministic draw, so
    // `daily[0]` is whichever metric the date hashed to and could be a peak or
    // a set — which `record()` correctly refuses.
    const target = challenges.board.daily.find(
      c => !['combo-peak', 'rune-tier', 'hall-variety', 'level'].includes(c.metric),
    );
    if (!target) return;
    challenges.record(target.metric, target.target * 3);
    const after = challenges.board.daily.find(c => c.id === target.id)!;
    expect(after.progress).toBe(100);
    expect(after.observed).toBe(target.target);
  });

  it('keeps a high water mark rather than a tally for a peak metric', () => {
    challenges.recordPeak('combo-peak', 60);
    challenges.recordPeak('combo-peak', 60);
    // Two sixties is not a hundred and twenty. This is the exact bug the
    // separate write path exists to prevent.
    expect(readCounters().day['combo-peak']).toBe(60);
    challenges.recordPeak('combo-peak', 140);
    expect(readCounters().day['combo-peak']).toBe(140);
    challenges.recordPeak('combo-peak', 20);
    expect(readCounters().day['combo-peak']).toBe(140);
  });

  it('refuses a peak write through the counted door and vice versa', () => {
    challenges.record('combo-peak', 500);
    expect(readCounters().day['combo-peak']).toBeUndefined();
    challenges.recordPeak('rune-forged', 500);
    expect(readCounters().day['rune-forged']).toBeUndefined();
  });

  it('counts a set member once however many times it arrives', () => {
    challenges.recordMember('hall-variety', '/codex');
    challenges.recordMember('hall-variety', '/codex');
    challenges.recordMember('hall-variety', '/market');
    expect(readState().daySets['hall-variety'].length).toBe(2);
  });

  it('pays Gold on a claim and marks the card collected', () => {
    const first = challenges.board.daily[0];
    complete(first.id);
    expect(challenges.claim(first.id)).toBe(true);
    expect(minted).toEqual([{ amount: first.gold, source: 'challenge' }]);
    expect(challenges.board.daily.find(c => c.id === first.id)!.status).toBe('claimed');
  });

  it('refuses a second claim on the same card', () => {
    const first = challenges.board.daily[0];
    complete(first.id);
    expect(challenges.claim(first.id)).toBe(true);
    expect(challenges.claim(first.id)).toBe(false);
    expect(minted.length).toBe(1);
  });

  it('refuses a claim on a card that is not finished', () => {
    const first = challenges.board.daily[0];
    expect(challenges.claim(first.id)).toBe(false);
    expect(minted.length).toBe(0);
  });

  it('refuses a claim on a card that is not on the board', () => {
    const offBoard = DAILY_CHALLENGES.find(
      c => !challenges.board.daily.some(d => d.id === c.id),
    )!;
    challenges.record(offBoard.metric, offBoard.target);
    expect(challenges.claim(offBoard.id)).toBe(false);
  });

  it('lights the boost and the streak once every daily is collected', () => {
    for (const c of challenges.board.daily) {
      complete(c.id);
      challenges.claim(c.id);
    }
    expect(challenges.board.dailySwept).toBe(true);
    expect(challenges.board.streak).toBe(1);
    expect(challenges.boostActive).toBe(true);
    expect(boosts.at(-1)!.multiplier).toBe(STREAK_BOOST_MULTIPLIER);
  });

  it('does not light the boost while a daily is still open', () => {
    const [first] = challenges.board.daily;
    complete(first.id);
    challenges.claim(first.id);
    expect(challenges.board.dailySwept).toBe(false);
    expect(challenges.boostActive).toBe(false);
  });

  it('does not advance the streak twice on the same day', () => {
    for (const c of challenges.board.daily) {
      complete(c.id);
      challenges.claim(c.id);
    }
    expect(challenges.board.streak).toBe(1);

    // Re-hydrating and re-sweeping is the reload path a player would use to
    // farm the boost. The streak day is what closes it.
    const before = challenges.board.streak;
    (challenges as unknown as { settleSweep(): unknown }).settleSweep();
    expect(challenges.board.streak).toBe(before);
  });

  it('carries the board across a reload', () => {
    const first = challenges.board.daily[0];
    complete(first.id);
    challenges.claim(first.id);

    const reloaded = freshService();
    expect(reloaded.board.daily.find(c => c.id === first.id)!.status).toBe('claimed');
  });

  it('ignores a hand-edited boost that runs past its own length', () => {
    const state = readState();
    state.boostUntil = Date.now() + 400 * 24 * 3600_000;
    store.set(CHALLENGE_KEY, JSON.stringify(state));

    const reloaded = freshService();
    // Still boosted — the deadline was clamped, not dropped, because a player
    // whose clock is merely fast has not done anything wrong.
    expect(reloaded.board.boostUntil).toBeLessThanOrEqual(Date.now() + 3600_000 + 5_000);
  });

  it('drops a receipt for a challenge that has left the pool', () => {
    const state = readState();
    state.claimed.push(`retired-challenge@${state.dayKey}`);
    store.set(CHALLENGE_KEY, JSON.stringify(state));

    const reloaded = freshService();
    // `load()` sanitises into memory; the next write is what flushes the clean
    // blob back. Asserting after a write is the honest test — it is the
    // invariant that actually matters, which is that the bad row never survives
    // to be read a second time.
    reloaded.record('rune-forged', 1);
    expect(readState().claimed).not.toContain(`retired-challenge@${state.dayKey}`);
  });

  it('survives a corrupt blob rather than throwing on load', () => {
    store.set(CHALLENGE_KEY, '{ not json');
    const reloaded = freshService();
    expect(reloaded.board.daily.length).toBe(DAILY_CHALLENGE_SLOTS);
    expect(reloaded.board.streak).toBe(0);
  });

  it('drops a counter holding something that is not a number', () => {
    const live = readState();
    store.set(CHALLENGE_KEY, JSON.stringify({
      version: 1,
      // Today's own keys, so `rollPeriods` does not wipe the counters before
      // the assertion can read them — which is exactly what it should do to a
      // blob from a period that has ended.
      dayKey: live.dayKey, weekKey: live.weekKey,
      day: { 'rune-forged': 'lots', 'material-mined': 4 },
      week: {}, daySets: {}, weekSets: {},
      claimed: [], streak: 0, streakDay: '', boostUntil: 0,
      chests: 0, goldPaid: 0, log: [],
    }));
    const reloaded = freshService();
    reloaded.record('expedition-done', 1);
    const counters = readCounters();
    expect(counters.day['rune-forged']).toBeUndefined();
    expect(counters.day['material-mined']).toBe(4);
  });

  it('clears the boost and everything else on reset', () => {
    for (const c of challenges.board.daily) {
      complete(c.id);
      challenges.claim(c.id);
    }
    challenges.reset();
    expect(challenges.board.streak).toBe(0);
    expect(challenges.board.goldPaid).toBe(0);
    expect(challenges.boostActive).toBe(false);
    expect(boosts.at(-1)).toEqual({ multiplier: 1, until: 0 });
  });

  // ── helpers ────────────────────────────────────────────────────────────────

  function readState() {
    return JSON.parse(store.get(CHALLENGE_KEY) ?? '{}');
  }

  function readCounters() {
    const state = readState();
    return { day: state.day ?? {}, week: state.week ?? {} };
  }

  /** A second service over the same store — the reload path. */
  function freshService(): ChallengeService {
    const next = TestBed.inject(ChallengeService);
    // `providedIn: 'root'` hands back the same instance, so the reload is
    // driven through the private hydrate rather than through a new object.
    (next as unknown as { initialised: boolean }).initialised = false;
    next.init();
    return next;
  }
});
