/**
 * offline.service.ts — measures the absence, asks every system to settle it,
 * and hands the result to a summary screen.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS SERVICE OWNS NO REWARDS
 * ─────────────────────────────────────────────────────────────────────────────
 * Four systems already know how to price time: the ledger settles Gold from its
 * own `lastIdleAt`, the shift settles Thrall pulls from their own roll clocks,
 * the expedition board settles landings from their own deadlines, and the two
 * boards roll over on their own day keys. A fifth system computing any of those
 * again would be a second answer to a question the visitor can already check
 * against their balance.
 *
 * So this is a *reporter*. It captures the window, triggers the settlements
 * that were not going to happen on this route, collects what they did, and
 * shows it. The one thing it mints is offline XP, because there was no offline
 * XP before it — the Ambient Forge pays for visible minutes only, by design.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE STAMP IS READ AT CONSTRUCTION
 * ─────────────────────────────────────────────────────────────────────────────
 * The same reason OnboardingService reads its two keys there. `AppComponent`
 * field-injects this service, so construction runs before `ngOnInit` — and
 * therefore before `economyWiring.init()` settles the idle Gold, before
 * `questWiring.init()` rolls the daily board over, and before
 * `challengeWiring.init()` redraws the Contract Board. Every one of those
 * *erases the evidence* this service exists to read. A `lastActiveAt` read any
 * later would be fine; the two board day keys would not be.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE LAZY SETTLEMENTS ARE DYNAMIC IMPORTS
 * ─────────────────────────────────────────────────────────────────────────────
 * The shift and the expedition board are lazy: `ThrallService.init()` is called
 * by the Market and the Thrall panel, `ExplorerService.init()` by the Forge
 * View. A visitor who comes back to /home after a night away therefore settles
 * neither — the Gold is there, the runes and the haul are not, and the summary
 * screen would be a lie by omission.
 *
 * Injecting them here would drag both chunks, and everything they pull with
 * them, into the initial bundle for every visitor on every route. So they are
 * reached through `import()`, and only after a raw read of their own blobs says
 * there is something to settle: a save with no working Thrall and no expedition
 * out never fetches either chunk.
 */
import {
  Injectable,
  Injector,
  NgZone,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { EconomyService } from '../economy/economy.service';
import { XpService } from '../gamification/xp.service';
import { dayKey } from '../quests/quest.model';
import {
  AWAY_HEARTBEAT_MS,
  AWAY_KEY,
  AWAY_MAX_SECONDS,
  AWAY_MAX_THRALL_ROLLS,
  AWAY_MIN_SECONDS,
  AwayExpedition,
  AwayFindRow,
  OfflineReport,
  awaySecondsBetween,
  collapseFinds,
  emptyReport,
  isReportWorthShowing,
  offlineXpFor,
} from './offline.model';

/**
 * The two lazy blobs, spelled here rather than imported.
 *
 * `THRALL_KEY` lives in the Thrall model and `EXPLORER_KEY` in the explorer
 * model, and a module is the chunking unit: importing either constant would
 * pull its whole model — six hundred lines of pure data apiece — into the
 * initial bundle, which is the exact cost the dynamic imports below exist to
 * avoid. They are pinned against their real definitions in the spec, so a
 * rename cannot drift them silently.
 */
export const THRALL_BLOB_KEY = 'godforge-thralls';
export const EXPLORER_BLOB_KEY = 'godforge-explorers';
/** The two boards, read for their day keys before anything rolls them over. */
export const QUEST_BLOB_KEY = 'eclipse-quests';
export const CHALLENGE_BLOB_KEY = 'godforge-challenges';

/** The window one return is settling. Null whenever no settlement is running. */
export interface AwayWindow {
  /** Epoch ms the absence is priced from — already clamped to the ceiling. */
  from: number;
  /** Epoch ms the absence ended, which is when this page load started. */
  to: number;
}

function readBlob(key: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    // Unparseable, or Safari private mode. Either way there is nothing to
    // settle and nothing to report, which is the same answer as "no save".
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class OfflineService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly zone = inject(NgZone);
  private readonly injector = inject(Injector);
  private readonly economy = inject(EconomyService);
  private readonly xp = inject(XpService);

  /**
   * Whether the summary is on screen.
   *
   * False on every platform including the browser until {@link settle} raises
   * it, for the reason OnboardingService gives: a signal that read storage at
   * construction would be true during the server render too, where storage is
   * unreadable, and Angular would report the hydration mismatch.
   */
  readonly active = signal(false);

  /** What the absence was worth. Null until a settlement has produced one. */
  readonly report = signal<OfflineReport | null>(null);

  /** Frozen at construction. See the header note on why this cannot wait. */
  private readonly lastActiveAt = this.readStamp();
  private readonly questDayAtLoad = this.readDayKey(QUEST_BLOB_KEY);
  private readonly challengeDayAtLoad = this.readDayKey(CHALLENGE_BLOB_KEY);

  private window: AwayWindow | null = null;
  private finds: AwayFindRow[] = [];
  private expeditions: AwayExpedition[] = [];

  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private settled = false;

  // ───────────────────────────────────────────────────────────────────────────
  // The window, for the systems that settle into it
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * The absence currently being settled, or null.
   *
   * Non-null only for the duration of {@link settle}. A lazy service asks for
   * it inside its own `init()` and settles the span if it gets one — which is
   * how a Thrall shift that the Market would have started ten minutes into the
   * session knows not to replay a window that has already been reported.
   */
  awayWindow(): AwayWindow | null {
    return this.window;
  }

  /** Called by the shift with what a replayed absence turned up. */
  reportThrallFinds(finds: ReadonlyArray<AwayFindRow>): void {
    if (!this.window || !finds.length) return;
    this.finds.push(...finds);
  }

  /**
   * Called by the expedition board for every landing it settles.
   *
   * Filtered here rather than there: the board settles everything that is due,
   * and only this service knows which of those were due *before* the visitor
   * came back. A mission that landed four seconds ago is not news from a night
   * away, it is the page catching up.
   */
  reportExpedition(landing: AwayExpedition & { returnedAt: number }): void {
    const window = this.window;
    if (!window) return;
    if (landing.returnedAt > window.to) return;
    const { returnedAt: _ignored, ...row } = landing;
    this.expeditions.push(row);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // The settlement
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Price the absence, settle what is owed, and raise the summary.
   *
   * Called once, from the end of `AppComponent.ngOnInit`, after every eager
   * `init()` above it. That placement is what lets the Gold line be a receipt
   * rather than a guess: the ledger has already settled by the time this runs.
   *
   * Awaits two dynamic imports in the worst case, so the curtain arrives a beat
   * after the page rather than with it. That is the right order — a visitor
   * should see their forge before they see a screen about it.
   */
  async settle(): Promise<void> {
    if (!this.isBrowser || this.settled) return;
    this.settled = true;

    // Always, and before anything below can return early: a tab that is open is
    // a tab whose stamp has to keep moving, whatever the absence turned out to
    // be worth.
    this.startHeartbeat();

    const last = this.lastActiveAt;
    const now = Date.now();

    // Stamped up front rather than at the end. Every reward below is either
    // already banked by the system that owns it or minted once, here — so the
    // failure this guards is a visitor who reloads mid-settlement and is paid
    // the offline XP twice.
    this.stamp(now);

    // No stamp at all is a browser that has never been here. The tutorial is
    // what that visitor gets, and two full-viewport curtains at once is neither.
    if (last === null) return;

    const awaySeconds = awaySecondsBetween(last, now);
    if (awaySeconds < AWAY_MIN_SECONDS) return;

    const report = emptyReport(awaySeconds);
    report.clamped = (now - last) / 1000 > AWAY_MAX_SECONDS;

    // The window is the *clamped* span, not the real one: a machine asleep for
    // a week must not replay a week of Thrall pulls to find that only eight
    // hours of them were payable.
    this.window = { from: now - awaySeconds * 1000, to: now };

    // ── Gold: the receipt the ledger left on its way past ────────────────
    const settlement = this.economy.takeOfflineSettlement();
    report.goldEarned = Math.floor(Math.max(0, settlement?.gold ?? 0));

    // ── XP: the one thing this layer actually mints ──────────────────────
    const xp = offlineXpFor(awaySeconds);
    if (xp > 0) {
      this.xp.award('idle', { amount: xp });
      report.xpEarned = xp;
    }

    // ── The two boards ───────────────────────────────────────────────────
    const today = dayKey(new Date(now));
    report.dailyQuestAvailable = this.questDayAtLoad !== null && this.questDayAtLoad !== today;
    report.challengesReset = this.challengeDayAtLoad !== null && this.challengeDayAtLoad !== today;

    // ── The two lazy systems ─────────────────────────────────────────────
    await this.settleShift();
    await this.settleExpeditions();

    report.thrallRolls = this.finds.length;
    report.thrallCapped = this.finds.length >= AWAY_MAX_THRALL_ROLLS;
    report.thrallFinds = collapseFinds(this.finds);
    report.expeditions = this.expeditions;

    // Closed before the screen goes up. Anything that settles after this point
    // is the live game, not the absence, and must not land in a report the
    // visitor is already reading.
    this.window = null;

    if (!isReportWorthShowing(report)) return;

    this.report.set(report);
    this.active.set(true);
  }

  /** Dismiss the summary. The rewards were banked during the settlement. */
  dismiss(): void {
    this.active.set(false);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // The two lazy settlements
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Start the shift, if there is a shift to start.
   *
   * `ThrallService.init()` settles the open window itself — see `settleAway`
   * there — so all this has to do is decide whether the chunk is worth
   * fetching. The raw read is the gate: a save with no working Thrall in it
   * pays nothing for a feature it does not use.
   */
  private async settleShift(): Promise<void> {
    const blob = readBlob(THRALL_BLOB_KEY);
    const roster = Array.isArray(blob?.['thralls']) ? blob['thralls'] as unknown[] : [];
    const working = roster.some(t =>
      !!t && typeof t === 'object' && (t as Record<string, unknown>)['status'] === 'working');
    if (!working) return;

    try {
      const { ThrallService } = await import('../thralls/thrall.service');
      this.injector.get(ThrallService).init();
    } catch {
      // A chunk that will not load costs the summary one section. It must not
      // cost the visitor the rest of the screen, or the page behind it.
    }
  }

  /**
   * Settle any expedition that came home while the tab was shut.
   *
   * `ExplorerService.init()` settles on load — that behaviour predates this
   * service and is not changed here. What is new is that it now happens on
   * *every* route rather than only on the Forge View, so an overnight Deep Dive
   * pays out when the visitor comes back to the home page instead of the next
   * time they happen to open the expedition board.
   */
  private async settleExpeditions(): Promise<void> {
    const blob = readBlob(EXPLORER_BLOB_KEY);
    const active = Array.isArray(blob?.['active']) ? blob['active'] as unknown[] : [];
    const now = Date.now();
    const landed = active.some(e => {
      if (!e || typeof e !== 'object') return false;
      const run = e as Record<string, unknown>;
      const startedAt = typeof run['startedAt'] === 'number' ? run['startedAt'] : NaN;
      const duration = typeof run['duration'] === 'number' ? run['duration'] : NaN;
      return Number.isFinite(startedAt) && Number.isFinite(duration) && startedAt + duration <= now;
    });
    if (!landed) return;

    try {
      const { ExplorerService } = await import('../explorer/explorer.service');
      this.injector.get(ExplorerService).init();
    } catch {
      // As above: one missing section, not a broken return.
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // The stamp
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Keep the stamp fresh for as long as the tab is alive.
   *
   * Three writers, and all three are needed. `pagehide` is the one that fires on
   * a real close and is the only one that fires on iOS. `visibilitychange` to
   * hidden covers the tab that is backgrounded and then killed by the OS without
   * ever firing `pagehide`. The interval covers everything else — a crashed
   * renderer, a force-quit, a laptop lid — and bounds the error to one beat.
   *
   * Outside the Angular zone: a `setInterval` inside it is a full change
   * detection pass every thirty seconds, for the life of the tab, to write one
   * number nothing is bound to.
   */
  private startHeartbeat(): void {
    if (this.heartbeat !== null) return;
    this.zone.runOutsideAngular(() => {
      this.heartbeat = setInterval(() => this.stamp(Date.now()), AWAY_HEARTBEAT_MS);
      addEventListener('pagehide', () => this.stamp(Date.now()));
      addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.stamp(Date.now());
      }, { passive: true });
    });
  }

  /**
   * Write the stamp, never backwards.
   *
   * Two tabs open on the same forge both write here, and the newer answer is
   * the true one: the visitor was present as recently as the most recent tab
   * says. Taking the max means closing an old background tab cannot rewind the
   * stamp and manufacture an absence out of a session the player never left.
   */
  private stamp(at: number): void {
    if (!this.isBrowser) return;
    try {
      const previous = this.readStamp();
      if (previous !== null && previous > at) return;
      localStorage.setItem(AWAY_KEY, String(at));
    } catch {
      // Quota, or private mode. A stamp that cannot be written means the next
      // return reports no absence, which is the safe direction to fail in.
    }
  }

  private readStamp(): number | null {
    if (!this.isBrowser) return null;
    try {
      const raw = localStorage.getItem(AWAY_KEY);
      if (raw === null) return null;
      const at = Number(raw);
      return Number.isFinite(at) && at > 0 ? at : null;
    } catch {
      return null;
    }
  }

  /**
   * The local day a board blob was last rolled over on.
   *
   * Null for a board that has never been written, which is not the same as a
   * board that rolled over: a visitor with no quest history has no daily quests
   * waiting for them, and announcing a reset that did not happen is worse than
   * announcing nothing.
   */
  private readDayKey(key: string): string | null {
    const blob = readBlob(key);
    const day = blob?.['dayKey'];
    return typeof day === 'string' && day.length > 0 ? day : null;
  }
}
