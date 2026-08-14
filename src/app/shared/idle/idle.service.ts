/**
 * idle.service.ts — the Ambient Forge.
 *
 * Earns XP for time spent with the site open and visible, and for striking the
 * flame by hand. Two rules shape the whole thing:
 *
 *   **Hidden means nothing.** The Page Visibility API gates every credit. A tab
 *   in the background earns zero, so this rewards having the site open in front
 *   of you rather than having it open at all.
 *
 *   **Time is measured, not counted.** Credits come from accumulated visible
 *   milliseconds, not from counting timer fires. A throttled background tab, a
 *   sleeping laptop and a browser that coalesces timers all produce the wrong
 *   number if you count fires; measuring and clamping the delta produces the
 *   right one.
 *
 * SSR: `init()` returns early on the server and every mutation is behind
 * `isBrowser`, so the prerender renders a cold flame and touches no storage.
 */
import { Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { XpService } from '../gamification/xp.service';
import { ToolMasteryService } from '../gamification/tool-mastery.service';
import { EasterEggService } from '../easter-eggs/easter-egg.service';
import { QuestService } from '../quests/quest.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { TOOLS_REGISTRY, ToolDefinition } from '../../tools/tools-registry';
import { CANONICAL, canonicalizePlayerPath } from '../canonical-routes';
import { RealmId, realmForCategory } from '../realms/realm.model';
import { dayKey } from '../quests/quest.model';
import {
  CENTURY_EVERY,
  CENTURY_STRIKE_XP,
  DAILY_MINUTE_CAP,
  DOMINANT_REALM_BONUS,
  ForgeLocation,
  ForgeState,
  HEARTBEAT_CLAMP_MS,
  HEARTBEAT_MS,
  IDLE_MILESTONES,
  IDLE_XP_MILESTONES,
  MEDITATION_MS,
  MINUTE_MS,
  RateBreakdown,
  SPARK_EVERY,
  STRIKE_COOLDOWN_MS,
  STRIKE_MILESTONES,
  STRIKE_XP,
  effectiveRate,
  energyForRealm,
} from './idle.model';

export const IDLE_KEY = 'eclipse-idle';

interface IdleState {
  version: 1;
  /** Lifetime XP earned by idling. Strikes are counted separately. */
  idleXp: number;
  /** Lifetime forge strikes. */
  strikes: number;
  /** Lifetime XP earned by striking. */
  strikeXp: number;
  /** The local day `minutesToday` belongs to. */
  dayKey: string;
  /** Minutes credited today, capped at DAILY_MINUTE_CAP. */
  minutesToday: number;
  /** Longest unbroken visible run ever, in ms. Feeds Forge Meditation. */
  bestVigilMs: number;
  /**
   * Lifetime visible time in the Forge, in ms.
   *
   * Deliberately uncapped, unlike `minutesToday`. That number is an *allowance*
   * — how much of today the forge is still willing to pay for — and reading it
   * as time spent would tell someone who has been here nine hours that they
   * have been here thirty minutes. This one is a record, not a payout, so it
   * keeps counting long after the day's XP has run out.
   */
  lifetimeMs: number;
}

function emptyState(): IdleState {
  return {
    version: 1,
    idleXp: 0,
    strikes: 0,
    strikeXp: 0,
    dayKey: '',
    minutesToday: 0,
    bestVigilMs: 0,
    lifetimeMs: 0,
  };
}

/** Everything the flame renders. */
export interface IdleSnapshot {
  state: ForgeState;
  location: ForgeLocation;
  /** Effective XP per minute right now. 0 when cooled or banked. */
  rate: number;
  breakdown: RateBreakdown;
  /** 0–1 toward the next minute credit. Drives the flame's fill. */
  toward: number;
  idleXp: number;
  strikes: number;
  strikeXp: number;
  minutesToday: number;
  minutesCap: number;
  /** Lifetime visible time in the Forge, in ms. Uncapped — see `IdleState`. */
  lifetimeMs: number;
  /** The tooltip's first line. */
  label: string;
  /** The tooltip's second line — why the rate is what it is. */
  note: string;
}

/** Emitted per strike so the UI can spark without owning the counter. */
export interface StrikeEvent {
  strikes: number;
  xp: number;
  spark: boolean;
  century: boolean;
}

@Injectable({ providedIn: 'root' })
export class IdleService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly zone = inject(NgZone);
  private readonly router = inject(Router);
  private readonly xp = inject(XpService);
  private readonly mastery = inject(ToolMasteryService);
  private readonly eggs = inject(EasterEggService);
  private readonly quests = inject(QuestService);
  private readonly saves = inject(LocalSaveRegistry);
  private readonly store = inject(GameStateGateway);

  private state: IdleState = emptyState();
  private started = false;

  /** The tool page currently open, or null everywhere else. */
  private currentTool: ToolDefinition | null = null;
  private onArena = false;

  /** Visible milliseconds banked toward the next whole minute. */
  private accumMs = 0;
  /** Wall clock at the previous heartbeat. */
  private lastBeatAt = 0;
  /** When the current unbroken visible run began, or null while hidden. */
  private visibleSince: number | null = null;
  /** Fractional XP carried between credits. In memory — losing <1 XP is fine. */
  private carry = 0;
  /** Visible ms observed but not yet written to `lifetimeMs`. See `creditLifetime`. */
  private lifetimeCarryMs = 0;
  private lastStrikeAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  private readonly snapshot$$ = new BehaviorSubject<IdleSnapshot>(this.snapshotOf());
  private readonly strike$$ = new Subject<StrikeEvent>();

  readonly snapshot$: Observable<IdleSnapshot> = this.snapshot$$.asObservable();
  readonly strike$: Observable<StrikeEvent> = this.strike$$.asObservable();

  get snapshot(): IdleSnapshot { return this.snapshot$$.value; }

  init(): void {
    if (!this.isBrowser || this.started) return;
    this.started = true;

    this.state = this.load();
    this.xp.init();
    this.quests.init();
    this.rollDay();

    this.resolveRoute(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        this.resolveRoute(e.urlAfterRedirects);
        this.publish();
      });

    // The heartbeat and the visibility listener never touch template state
    // directly — they publish through a BehaviorSubject whose subscribers
    // re-enter the zone — so keep them off the change-detection path.
    this.zone.runOutsideAngular(() => {
      this.lastBeatAt = Date.now();
      if (document.visibilityState === 'visible') this.visibleSince = this.lastBeatAt;

      document.addEventListener('visibilitychange', () => this.onVisibilityChange(), { passive: true });
      // Closing a window does not always produce a visibilitychange, and the
      // lifetime counter buffers up to a minute in memory. `pagehide` is the
      // one event that fires on every teardown path, and the flush behind it
      // is a synchronous localStorage write.
      window.addEventListener('pagehide', () => {
        if (this.visibleSince !== null) {
          this.creditLifetime(Math.min(Date.now() - this.lastBeatAt, HEARTBEAT_CLAMP_MS));
        }
        this.flushLifetime();
      });
      this.timer = setInterval(() => this.beat(), HEARTBEAT_MS);
    });

    // This one blob never clobbered a merge — `mutate()` re-reads storage before
    // every write, because the idle feature is the one part of the progression
    // layer that genuinely expects two tabs. It still registers, for two reasons:
    // `flush` settles the lifetime counter, which buffers up to a minute in
    // memory and would otherwise be uploaded a minute behind itself; and
    // `rehydrate` republishes, so the /forge-keeper readouts show the merged
    // numbers instead of waiting for the next heartbeat to notice.
    this.saves.register(IDLE_KEY, {
      flush: () => this.flushLifetime(),
      rehydrate: () => {
        this.state = this.load();
        this.publish();
      },
    });

    this.publish();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // The heartbeat
  // ───────────────────────────────────────────────────────────────────────────

  private onVisibilityChange(): void {
    const now = Date.now();
    if (document.visibilityState === 'visible') {
      // Rekindle. The run starts now — time spent hidden is not part of it.
      this.visibleSince = now;
      this.lastBeatAt = now;
    } else {
      // Cool. Bank the run's length before forgetting where it started, and
      // drop the partial minute: a minute half-earned and then abandoned is not
      // a minute the visitor was here for.
      this.creditVigil(now);
      // The lifetime counter *does* keep the tail. Up to one heartbeat of
      // visible time has elapsed since the last beat, and time spent is time
      // spent whether or not it completed a payable minute.
      this.creditLifetime(Math.min(now - this.lastBeatAt, HEARTBEAT_CLAMP_MS));
      this.flushLifetime();
      this.lastBeatAt = now;
      this.visibleSince = null;
      this.accumMs = 0;
    }
    this.zone.run(() => this.publish());
  }

  /**
   * One accounting step. Credits whole minutes of accumulated visible time and
   * pays for them.
   */
  private beat(): void {
    const now = Date.now();
    const delta = Math.min(now - this.lastBeatAt, HEARTBEAT_CLAMP_MS);
    this.lastBeatAt = now;

    if (document.visibilityState !== 'visible' || this.visibleSince === null) return;

    // Before the cap check below, which returns early: time in the Forge is a
    // record of attendance, and attendance does not stop when the day's XP
    // allowance runs out.
    this.creditLifetime(delta);

    // Order matters: the crossing is detected by the day *changing*, so it has
    // to be read from rollDay's return value rather than by comparing the
    // stored key afterwards — by then it is already today.
    const crossedMidnight = this.rollDay();
    this.creditVigil(now);
    if (crossedMidnight) this.onMidnightCrossing();

    if (this.state.minutesToday >= DAILY_MINUTE_CAP) {
      // Allowance spent. Keep publishing so the flame can say so, but stop
      // accumulating — a partial minute banked now would be paid at tomorrow's
      // first beat for time spent today.
      this.accumMs = 0;
      this.zone.run(() => this.publish());
      return;
    }

    this.accumMs += delta;

    let credited = 0;
    while (this.accumMs >= MINUTE_MS && this.state.minutesToday + credited < DAILY_MINUTE_CAP) {
      this.accumMs -= MINUTE_MS;
      credited++;
    }

    if (credited > 0) this.creditMinutes(credited);

    this.zone.run(() => this.publish());
  }

  /** Pay for `minutes` of visible time at the current rate. */
  private creditMinutes(minutes: number): void {
    const { rate } = this.rateNow();

    // Rates are fractional (1.5/min on the arena, ×1.5 streaks). Carry the
    // remainder so a half-XP is never silently rounded away every minute.
    this.carry += rate * minutes;
    const whole = Math.floor(this.carry);
    this.carry -= whole;

    this.mutate(s => {
      // Clamp against the *shared* total, which another tab may have moved.
      s.minutesToday = Math.min(DAILY_MINUTE_CAP, s.minutesToday + minutes);
      s.idleXp += whole;
    });

    if (whole > 0) {
      this.xp.award('idle', {
        amount: whole,
        energy: energyForRealm(this.currentRealm()),
      });
    }

    this.checkIdleMilestones();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Striking
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Hit the flame. Returns false when the strike landed inside the cooldown,
   * which is what stops a held-down mouse or a macro from being an XP faucet.
   */
  strike(): boolean {
    if (!this.isBrowser) return false;

    const now = Date.now();
    if (now - this.lastStrikeAt < STRIKE_COOLDOWN_MS) return false;
    this.lastStrikeAt = now;

    let century = false;
    let gain = STRIKE_XP;
    this.mutate(s => {
      s.strikes += 1;
      century = s.strikes % CENTURY_EVERY === 0;
      gain = STRIKE_XP + (century ? CENTURY_STRIKE_XP : 0);
      s.strikeXp += gain;
    });

    this.xp.award('idle', { amount: gain, energy: energyForRealm(this.currentRealm()) });

    this.strike$$.next({
      strikes: this.state.strikes,
      xp: gain,
      spark: this.state.strikes % SPARK_EVERY === 0,
      century,
    });

    this.checkStrikeMilestones();
    this.publish();
    return true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Milestones
  // ───────────────────────────────────────────────────────────────────────────

  private checkIdleMilestones(): void {
    for (const m of IDLE_XP_MILESTONES) {
      if (this.state.idleXp >= m.at && !this.eggs.isFound(m.egg)) void this.eggs.trigger(m.egg);
    }
    if (this.state.bestVigilMs >= MEDITATION_MS && !this.eggs.isFound(IDLE_MILESTONES.forgeMeditation)) {
      void this.eggs.trigger(IDLE_MILESTONES.forgeMeditation);
    }
  }

  private checkStrikeMilestones(): void {
    for (const m of STRIKE_MILESTONES) {
      if (this.state.strikes >= m.at && !this.eggs.isFound(m.egg)) void this.eggs.trigger(m.egg);
    }
  }

  /** Bank the length of the current unbroken visible run. */
  /**
   * Add visible time to the lifetime counter, buffered in memory.
   *
   * Flushed a minute at a time rather than written on every heartbeat: the
   * counter is rendered to the minute, so six writes a minute would buy nothing
   * but six times the localStorage traffic. `snapshotOf` adds the unflushed
   * remainder back, so the number on screen is never behind what it should be —
   * only the number on disk is, and by less than a minute.
   */
  private creditLifetime(deltaMs: number): void {
    if (deltaMs <= 0) return;
    this.lifetimeCarryMs += deltaMs;
    if (this.lifetimeCarryMs >= MINUTE_MS) this.flushLifetime();
  }

  /** Write the buffered visible time through. Called on the minute and on hide. */
  private flushLifetime(): void {
    if (this.lifetimeCarryMs <= 0) return;
    const pending = this.lifetimeCarryMs;
    this.lifetimeCarryMs = 0;
    this.mutate(s => { s.lifetimeMs += pending; });
  }

  private creditVigil(now: number): void {
    if (this.visibleSince === null) return;
    const run = now - this.visibleSince;
    if (run > this.state.bestVigilMs) {
      this.mutate(s => { s.bestVigilMs = Math.max(s.bestVigilMs, run); });
      this.checkIdleMilestones();
    }
  }

  /**
   * The Godforge Never Sleeps: the local date changed while the tab was open
   * and visible.
   *
   * Deliberately the rollover rather than "it is currently after midnight" —
   * the egg registry already has Night Owl for being here between 2am and 5am,
   * and two achievements for the same act is one of them lying about being an
   * achievement.
   */
  private onMidnightCrossing(): void {
    if (this.visibleSince === null) return;
    if (this.eggs.isFound(IDLE_MILESTONES.neverSleeps)) return;
    void this.eggs.trigger(IDLE_MILESTONES.neverSleeps);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Rates
  // ───────────────────────────────────────────────────────────────────────────

  private location(): ForgeLocation {
    if (this.currentTool) return 'tool';
    if (this.onArena) return 'arena';
    return 'elsewhere';
  }

  private currentRealm(): RealmId | null {
    return this.currentTool ? realmForCategory(this.currentTool.category).id : null;
  }

  /**
   * The realm this visitor has worked most, by total tool opens.
   *
   * Read from ToolMasteryService rather than the XP ledger: XP records *whether*
   * a tool was used, so every tool would weigh the same and "dominant" would
   * mean "the realm with the most distinct tools", which is Archivum for
   * everybody and therefore not about the visitor at all.
   */
  private dominantRealm(): RealmId | null {
    const counts = this.mastery.all();
    const byRealm = new Map<RealmId, number>();

    for (const [slug, uses] of Object.entries(counts)) {
      const tool = TOOLS_REGISTRY.find(t => t.id === slug);
      if (!tool) continue;
      const realm = realmForCategory(tool.category).id;
      byRealm.set(realm, (byRealm.get(realm) ?? 0) + uses);
    }

    let best: RealmId | null = null;
    let bestCount = 0;
    for (const [realm, count] of byRealm) {
      if (count > bestCount) { best = realm; bestCount = count; }
    }
    // With nothing recorded there is no dominant realm, and claiming one would
    // hand a first-time visitor a loyalty bonus.
    return bestCount > 0 ? best : null;
  }

  /** True when a live quest on the board is asking for the tool underfoot. */
  private hasActiveQuestForTool(): boolean {
    const tool = this.currentTool;
    if (!tool) return false;

    const realm = realmForCategory(tool.category).id;
    const board = this.quests.board;

    return [...board.daily, ...board.weekly].some(q => {
      if (q.status === 'completed') return false;
      const c = q.condition;
      if (c.toolSlug) return c.toolSlug === tool.id;
      if (c.category) return c.category === tool.category;
      if (c.realm) return c.realm === realm;
      return false;
    });
  }

  private rateNow(): RateBreakdown {
    const location = this.location();
    const dominant = location === 'tool' && this.dominantRealm() === this.currentRealm();
    return effectiveRate(
      location,
      this.xp.snapshot.streak,
      dominant,
      this.hasActiveQuestForTool(),
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Plumbing
  // ───────────────────────────────────────────────────────────────────────────

  private resolveRoute(url: string): void {
    const path = url.split('?')[0].split('#')[0];
    this.currentTool = TOOLS_REGISTRY.find(t => t.route === path) ?? null;
    const canonical = canonicalizePlayerPath(path);
    this.onArena = canonical === CANONICAL.trials || path.startsWith('/arena/');
  }

  /**
   * Re-sync from the shared pool, resetting the day's allowance if the local
   * date has changed. Returns true when a day actually rolled over *and* there
   * was a previous day to roll from — a first-ever visit is not a midnight
   * crossing.
   *
   * This is also the read half of the multi-tab story, and it has to be: the
   * heartbeat gates accrual on `minutesToday`, so a tab holding a stale copy
   * would either keep earning after a second tab spent the allowance, or sit
   * refusing to earn after midnight because it still remembers yesterday as
   * full. Called at the top of every beat for exactly that reason.
   */
  private rollDay(): boolean {
    const today = dayKey();
    const fresh = this.load();
    const rolledFrom = fresh.dayKey;

    if (rolledFrom === today) {
      this.state = fresh;
      return false;
    }

    fresh.dayKey = today;
    fresh.minutesToday = 0;
    this.state = fresh;
    this.persist();
    return rolledFrom !== '';
  }

  private snapshotOf(): IdleSnapshot {
    const hidden = this.isBrowser && typeof document !== 'undefined'
      ? document.visibilityState !== 'visible'
      : true;
    const banked = this.state.minutesToday >= DAILY_MINUTE_CAP;
    const location = this.started ? this.location() : 'elsewhere';
    const breakdown = this.started
      ? this.rateNow()
      : { rate: 0, base: 0, streak: 1, dominantRealm: false, activeQuest: false };

    const state: ForgeState = !this.started || hidden
      ? 'cooled'
      : banked ? 'banked'
      : location === 'tool' ? 'burning'
      : 'warming';

    return {
      state,
      location,
      rate: state === 'cooled' || state === 'banked' ? 0 : breakdown.rate,
      breakdown,
      toward: Math.min(1, this.accumMs / MINUTE_MS),
      idleXp: this.state.idleXp,
      strikes: this.state.strikes,
      strikeXp: this.state.strikeXp,
      minutesToday: this.state.minutesToday,
      minutesCap: DAILY_MINUTE_CAP,
      // Plus whatever has not been flushed yet, so the readout on /forge-keeper
      // advances with the session rather than jumping a minute at a time.
      lifetimeMs: this.state.lifetimeMs + this.lifetimeCarryMs,
      label: labelFor(state, breakdown.rate),
      note: noteFor(state, breakdown, this.state.minutesToday),
    };
  }

  private publish(): void {
    this.snapshot$$.next(this.snapshotOf());
  }

  /**
   * Read-modify-write against storage, rather than writing this tab's copy of
   * the state over whatever is there.
   *
   * The idle feature is the one part of the progression layer that genuinely
   * expects two tabs — its whole premise is "leave it open" — and the
   * write-the-whole-blob pattern the other ledgers use breaks badly here. Two
   * tabs each holding an in-memory total means the second one to credit a
   * minute erases the first one's, and, worse, each tab would earn its own
   * separate thirty-minute allowance, which is precisely the farming the cap
   * exists to stop.
   *
   * Re-reading first makes the day's allowance one shared pool no matter how
   * many tabs are watching it.
   */
  private mutate(fn: (state: IdleState) => void): void {
    const fresh = this.load();
    // Another tab may have been the one to roll the day over.
    const today = dayKey();
    if (fresh.dayKey !== today) {
      fresh.dayKey = today;
      fresh.minutesToday = 0;
    }
    fn(fresh);
    this.state = fresh;
    this.persist();
  }

  private load(): IdleState {
    try {
      const raw = this.store.readRaw(IDLE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw) as Partial<IdleState>;
      return { ...emptyState(), ...parsed, version: 1 };
    } catch {
      return emptyState();
    }
  }

  private persist(): void {
      this.store.write(IDLE_KEY, this.state);
  }

  /** Wipe the forge. Exposed alongside the other resets. */
  reset(): void {
    if (!this.isBrowser) return;
    this.state = emptyState();
    this.accumMs = 0;
    this.carry = 0;
    this.store.remove(IDLE_KEY);
    this.rollDay();
    this.publish();
  }
}

/** The tooltip's headline. */
function labelFor(state: ForgeState, rate: number): string {
  switch (state) {
    case 'cooled':  return 'The forge cools...';
    case 'banked':  return 'The forge rests.';
    case 'burning': return `The forge hums... +${trim(rate)} XP/min`;
    default:        return `Ambient forge energy... +${trim(rate)} XP/min`;
  }
}

/** The tooltip's second line: why this rate, or why none. */
function noteFor(state: ForgeState, b: RateBreakdown, minutesToday: number): string {
  if (state === 'cooled') return 'Nothing accrues while the tab is hidden.';
  if (state === 'banked') return `Today's ${DAILY_MINUTE_CAP} minutes are spent. It rekindles at midnight.`;

  const parts: string[] = [];
  if (b.activeQuest) parts.push('quest ×2');
  if (b.dominantRealm) parts.push(`your realm +${DOMINANT_REALM_BONUS}`);
  if (b.streak > 1) parts.push(`streak ×${trim(b.streak)}`);

  const left = DAILY_MINUTE_CAP - minutesToday;
  const remaining = `${left} min left today`;
  return parts.length ? `${parts.join(' · ')} — ${remaining}` : remaining;
}


/** 1.5 → "1.5", 2.0 → "2". Tooltips should not read "+2.0 XP/min". */
function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
