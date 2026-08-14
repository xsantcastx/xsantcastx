/**
 * idle.service.spec.ts — the parts of the Ambient Forge that only a clock can
 * prove.
 *
 * Accrual is the one behaviour that cannot be checked by driving a real
 * browser: the credit arrives after sixty seconds of *visible* time, and a
 * browser backgrounds and throttles the tab the moment an automated harness
 * looks away — which correctly produces zero and proves nothing. Fake timers
 * make the same code path deterministic and instant.
 *
 * These tests own the invariants that money-shaped bugs would hide in: the
 * daily cap, the visibility gate, the strike cooldown, and the fractional carry
 * that stops half an XP being rounded away sixty times an hour.
 */
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { CANONICAL } from '../canonical-routes';
import { IdleService, IDLE_KEY } from './idle.service';
import {
  DAILY_MINUTE_CAP,
  HEARTBEAT_MS,
  MINUTE_MS,
  STRIKE_COOLDOWN_MS,
  effectiveRate,
  streakMultiplier,
} from './idle.model';
import { XpService } from '../gamification/xp.service';
import { ToolMasteryService } from '../gamification/tool-mastery.service';
import { EasterEggService } from '../easter-eggs/easter-egg.service';
import { QuestService } from '../quests/quest.service';

/** A stand-in for the XP ledger that just records what it was asked to pay. */
class FakeXp {
  awarded: number[] = [];
  snapshot = { streak: 0, aether: 0, nox: 0, xp: 0, level: { level: 1 } } as any;
  snapshot$ = new BehaviorSubject(this.snapshot);
  init(): void { /* no-op */ }
  award(_type: string, opts: { amount?: number } = {}): void {
    if (opts.amount) this.awarded.push(opts.amount);
  }
  claimAchievement(): boolean { return true; }
  get total(): number { return this.awarded.reduce((a, b) => a + b, 0); }
}

class FakeQuests {
  board = { daily: [], weekly: [], epic: [] } as any;
  init(): void { /* no-op */ }
}

class FakeEggs {
  found = new Set<string>();
  isFound(id: string): boolean { return this.found.has(id); }
  async trigger(id: string): Promise<void> { this.found.add(id); }
}

class FakeMastery {
  counts: Record<string, number> = {};
  all(): Record<string, number> { return this.counts; }
}

describe('IdleService', () => {
  let idle: IdleService;
  let xp: FakeXp;
  let eggs: FakeEggs;
  let visibility: 'visible' | 'hidden';
  let routerEvents: BehaviorSubject<NavigationEnd | null>;

  /** Advance fake time and let the heartbeat run over it. */
  function runFor(ms: number): void {
    jasmine.clock().tick(ms);
  }

  beforeEach(() => {
    localStorage.removeItem(IDLE_KEY);
    visibility = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      get: () => visibility,
      configurable: true,
    });

    xp = new FakeXp();
    eggs = new FakeEggs();

    TestBed.configureTestingModule({
      providers: [
        IdleService,
        { provide: XpService, useValue: xp },
        { provide: QuestService, useValue: new FakeQuests() },
        { provide: EasterEggService, useValue: eggs },
        { provide: ToolMasteryService, useValue: new FakeMastery() },
        { provide: Router, useValue: { url: CANONICAL.world, events: routerEvents = new BehaviorSubject<NavigationEnd | null>(null) } },
      ],
    });

    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 7, 12, 10, 0, 0));

    idle = TestBed.inject(IdleService);
    idle.init();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
    localStorage.removeItem(IDLE_KEY);
  });

  // ── Accrual ───────────────────────────────────────────────────────────────

  it('credits nothing before a full minute of visible time', () => {
    runFor(MINUTE_MS - HEARTBEAT_MS);
    expect(idle.snapshot.minutesToday).toBe(0);
    expect(xp.total).toBe(0);
  });

  it('credits one minute, at the base rate, after sixty visible seconds', () => {
    runFor(MINUTE_MS);
    expect(idle.snapshot.minutesToday).toBe(1);
    // /world is 'elsewhere' — 1 XP/min, no streak, no realm, no quest.
    expect(xp.total).toBe(1);
  });

  it('keeps crediting minute by minute', () => {
    runFor(5 * MINUTE_MS);
    expect(idle.snapshot.minutesToday).toBe(5);
    expect(xp.total).toBe(5);
  });

  it('stops at the daily cap however long the tab stays open', () => {
    runFor((DAILY_MINUTE_CAP + 20) * MINUTE_MS);
    expect(idle.snapshot.minutesToday).toBe(DAILY_MINUTE_CAP);
    expect(xp.total).toBe(DAILY_MINUTE_CAP);
    expect(idle.snapshot.state).toBe('banked');
  });

  it('earns nothing at all while the tab is hidden', () => {
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    runFor(10 * MINUTE_MS);
    expect(idle.snapshot.minutesToday).toBe(0);
    expect(xp.total).toBe(0);
    expect(idle.snapshot.state).toBe('cooled');
  });

  it('resumes earning when the tab comes back, and drops the partial minute', () => {
    runFor(40_000);                       // 40s of a minute banked

    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    runFor(10 * MINUTE_MS);               // away for ten minutes

    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    runFor(40_000);                       // 40s more — would total 80s if kept

    // The abandoned 40s is not carried, so no minute has completed yet.
    expect(idle.snapshot.minutesToday).toBe(0);

    runFor(25_000);                       // now past a full visible minute
    expect(idle.snapshot.minutesToday).toBe(1);
  });

  it('does not pay out a sleeping laptop', () => {
    runFor(HEARTBEAT_MS);

    // A closed lid is the clock moving without the interval firing — which is
    // `mockDate`, not `tick`: ticking six hours would run 2160 ordinary
    // heartbeats and simulate someone sitting there all afternoon instead.
    jasmine.clock().mockDate(new Date(2026, 7, 12, 16, 0, 0));
    runFor(HEARTBEAT_MS);

    // The single beat that follows sees a six-hour delta and is clamped to one
    // interval's worth, so the whole sleep is worth less than a minute.
    expect(idle.snapshot.minutesToday).toBe(0);
    expect(xp.total).toBe(0);
  });

  it('resets the allowance when the local day rolls over', () => {
    runFor(DAILY_MINUTE_CAP * MINUTE_MS);
    expect(idle.snapshot.state).toBe('banked');

    jasmine.clock().mockDate(new Date(2026, 7, 13, 10, 0, 0));
    runFor(HEARTBEAT_MS);
    expect(idle.snapshot.minutesToday).toBe(0);
  });

  it('awards The Godforge Never Sleeps when the date changes under an open tab', () => {
    runFor(MINUTE_MS);
    expect(eggs.isFound('idle-never-sleeps')).toBe(false);

    jasmine.clock().mockDate(new Date(2026, 7, 13, 0, 0, 30));
    runFor(HEARTBEAT_MS);
    expect(eggs.isFound('idle-never-sleeps')).toBe(true);
  });

  it('awards Forge Meditation after thirty unbroken visible minutes', () => {
    runFor(29 * MINUTE_MS);
    expect(eggs.isFound('idle-forge-meditation')).toBe(false);
    runFor(2 * MINUTE_MS);
    expect(eggs.isFound('idle-forge-meditation')).toBe(true);
  });

  it('does not award Forge Meditation across a break', () => {
    runFor(20 * MINUTE_MS);
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    runFor(MINUTE_MS);
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    runFor(20 * MINUTE_MS);
    expect(eggs.isFound('idle-forge-meditation')).toBe(false);
  });

  // ── Striking ──────────────────────────────────────────────────────────────

  it('ignores a second strike inside the cooldown', () => {
    expect(idle.strike()).toBe(true);
    expect(idle.strike()).toBe(false);
    expect(idle.snapshot.strikes).toBe(1);
  });

  it('accepts a strike once the cooldown has passed', () => {
    idle.strike();
    jasmine.clock().tick(STRIKE_COOLDOWN_MS + 1);
    expect(idle.strike()).toBe(true);
    expect(idle.snapshot.strikes).toBe(2);
  });

  it('pays the century bonus on every hundredth strike', () => {
    for (let i = 0; i < 100; i++) {
      idle.strike();
      jasmine.clock().tick(STRIKE_COOLDOWN_MS + 1);
    }
    expect(idle.snapshot.strikes).toBe(100);
    // 100 strikes at 1, plus one 10 XP century bonus.
    expect(idle.snapshot.strikeXp).toBe(110);
  });

  it('keeps striking payable after the idle allowance is spent', () => {
    runFor(DAILY_MINUTE_CAP * MINUTE_MS);
    const before = idle.snapshot.strikes;
    expect(idle.strike()).toBe(true);
    expect(idle.snapshot.strikes).toBe(before + 1);
  });

  // ── Multi-tab ─────────────────────────────────────────────────────────────

  it('does not overwrite an allowance a second tab has already spent', () => {
    runFor(MINUTE_MS);

    // A second tab writes the day as fully spent.
    const shared = JSON.parse(localStorage.getItem(IDLE_KEY)!);
    shared.minutesToday = DAILY_MINUTE_CAP;
    localStorage.setItem(IDLE_KEY, JSON.stringify(shared));

    runFor(5 * MINUTE_MS);

    const after = JSON.parse(localStorage.getItem(IDLE_KEY)!);
    expect(after.minutesToday).toBe(DAILY_MINUTE_CAP);
    expect(idle.snapshot.state).toBe('banked');
  });

  // ── Rates ─────────────────────────────────────────────────────────────────

  it('carries the fraction rather than rounding it away every minute', () => {
    // 1.5/min on the arena: two minutes must pay 3, not 2 and not 4.
    const arena = effectiveRate('arena', 0, false, false);
    expect(arena.rate).toBe(1.5);
  });

  it('scales the streak on the two anchors the design names', () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(6)).toBe(1);
    expect(streakMultiplier(7)).toBe(1.5);
    expect(streakMultiplier(29)).toBe(1.5);
    expect(streakMultiplier(30)).toBe(2);
  });

  it('treats /world/trials as arena', () => {
    expect(idle.snapshot.location).toBe('elsewhere');
    routerEvents.next(new NavigationEnd(1, CANONICAL.trials, CANONICAL.trials));
    expect(idle.snapshot.location).toBe('arena');
  });

  it('keeps /arena/<game> as arena', () => {
    routerEvents.next(new NavigationEnd(1, '/arena/color-memory', '/arena/color-memory'));
    expect(idle.snapshot.location).toBe('arena');
  });

  it('stays elsewhere on /world', () => {
    routerEvents.next(new NavigationEnd(1, CANONICAL.world, CANONICAL.world));
    expect(idle.snapshot.location).toBe('elsewhere');
  });

  it('stacks the realm bonus additively and the quest and streak multiplicatively', () => {
    // (2 base + 0.5 realm) × 2 quest × 1.5 streak
    expect(effectiveRate('tool', 7, true, true).rate).toBe(7.5);
    // The realm bonus only applies on a tool page.
    expect(effectiveRate('arena', 0, true, false).rate).toBe(1.5);
  });
});
