/**
 * offline.model.ts — what accumulated while nobody was looking, as pure data.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS NOT
 * ─────────────────────────────────────────────────────────────────────────────
 * It is not a second economy. Every number the summary screen shows was already
 * banked by the system that owns it — the ledger settled the Gold from its own
 * `lastIdleAt`, the shift settled the Thrall pulls from their own roll clocks,
 * the expedition board settled its landings from their own deadlines. This
 * layer measures the absence, asks each of those systems to settle it, and
 * *reports* what they did.
 *
 * That direction matters and is the whole design. A summary screen that
 * computed its own payout would be a second answer to "how much Gold did I
 * make", and the visitor would believe whichever was larger. It would also
 * double-pay the moment somebody reloaded before dismissing it.
 *
 * The one reward this layer actually mints is offline XP, because there was no
 * offline XP before it — see AWAY_XP_PER_MINUTE.
 *
 * Pure data and pure functions, no browser APIs, so this is safe to import from
 * a server-rendered path.
 */

/**
 * Where the last-seen stamp lives.
 *
 * Deliberately outside `GameStateGateway`, and for the same reason the
 * onboarding record is: this is a property of a *browser*, not of a player.
 * Syncing it would mean a phone left open all afternoon told a laptop opened
 * the next morning that it had only been away five minutes — the account's most
 * recent device would silently erase everybody else's absence.
 *
 * The cost of keeping it local is the honest one: a player who switches devices
 * is credited an absence per device. That is the truth from where each browser
 * is standing, and every reward behind it is already capped by the system that
 * pays it.
 */
export const AWAY_KEY = 'godforge-away';

/**
 * The shortest absence worth a summary screen, in seconds.
 *
 * Five minutes. Below it the catch-up still happens — it always happens, it is
 * the same settlement the tab does every second — it just happens silently. A
 * curtain over the page for ninety seconds of Gold is an interruption, not a
 * reward.
 */
export const AWAY_MIN_SECONDS = 5 * 60;

/**
 * The most absence one return will be paid for, in seconds.
 *
 * Eight hours, which is deliberately the same ceiling `MAX_OFFLINE_SECONDS` in
 * the ledger already uses. Two numbers here would mean the screen reported a
 * span the Gold was not actually paid for.
 */
export const AWAY_MAX_SECONDS = 8 * 60 * 60;

/**
 * The most pulls one return will settle across the whole shift.
 *
 * A hundred. Ten Legendary Thralls pulling every five seconds would otherwise
 * produce fifty-seven thousand pulls for a night away — each one a Gold spend,
 * a rune grant, a possible mint and a possible Lore Scroll — on the first frame
 * of a page load. The cap is a frame-budget guard first and a balance decision
 * second; a hundred grants is already ~100ms of synchronous work.
 *
 * What the cap costs the player is nothing they were promised: the shift has
 * always paused with the tab, and this is the first build in which it pays for
 * an absence at all.
 */
export const AWAY_MAX_THRALL_ROLLS = 100;

/**
 * XP minted per minute of absence.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY 0.25 AND NOT A SHARE OF THE VISIBLE RATE
 * ─────────────────────────────────────────────────────────────────────────────
 * The Ambient Forge pays 1–2 XP per *visible* minute and stops at
 * `DAILY_MINUTE_CAP` — thirty minutes a day, so a fully-idled day is worth
 * 30–120 XP depending on the streak. Offline time has to sit under that
 * ceiling, or the best way to earn idle XP becomes closing the tab.
 *
 * A quarter of an XP a minute, capped at eight hours, tops out at 120 XP: the
 * same as a perfect day of *being here* on a thirty-day streak, and a quarter
 * of what the same eight hours would have paid with the tab open and visible.
 * The streak multiplier is deliberately not applied on top — it is a reward for
 * turning up, and the absence is the opposite of turning up.
 */
export const AWAY_XP_PER_MINUTE = 0.25;

/**
 * How often the stamp is refreshed while the tab is open.
 *
 * Thirty seconds. `pagehide` is the write that matters and it fires on every
 * real close, but it is not guaranteed — a killed tab, a crashed renderer, a
 * phone that swaps the process out — and every one of those would otherwise
 * leave a stamp from the start of the session and report a whole afternoon of
 * *presence* as absence. Thirty seconds bounds that error to thirty seconds.
 */
export const AWAY_HEARTBEAT_MS = 30_000;

/** One rune a Thrall turned up while the tab was shut. */
export interface AwayFind {
  /** The rune's own name, as the log line already spells it. */
  name: string;
  /** Rune tier id — `common` … `singular`. Drives the frame, never the meaning. */
  rarity: string;
  /** The rune tier's display label, so the row never speaks in ids. */
  rarityLabel: string;
  /** How many of this exact rune came home. Rows are collapsed by name. */
  count: number;
}

/**
 * One find before the rows are collapsed.
 *
 * The shift reports in these — one per pull, in the order they happened — and
 * {@link collapseFinds} turns a night of them into the list the screen shows.
 */
export type AwayFindRow = Omit<AwayFind, 'count'>;

/** One expedition that landed during the absence. */
export interface AwayExpedition {
  /** Mission label — "Deep Dive". */
  mission: string;
  /** Realm label — "Umbral". */
  realm: string;
  gold: number;
  /** Every distinct thing carried home, already spelled for a list row. */
  spoils: string[];
}

/** Everything one return is owed, and what was done about it. */
export interface OfflineReport {
  /** Real seconds away, already clamped to {@link AWAY_MAX_SECONDS}. */
  awaySeconds: number;
  /** True when the absence was longer than the ceiling paid for it. */
  clamped: boolean;
  /** Gold the ledger settled for the absence. Already banked. */
  goldEarned: number;
  /** XP minted for the absence by this layer. Already banked. */
  xpEarned: number;
  /** What the shift turned up, collapsed by rune. */
  thrallFinds: AwayFind[];
  /** Pulls actually settled, which is what `thrallFinds` was rolled from. */
  thrallRolls: number;
  /** True when the shift stopped at {@link AWAY_MAX_THRALL_ROLLS}. */
  thrallCapped: boolean;
  /** Expeditions that came home while the tab was shut. */
  expeditions: AwayExpedition[];
  /** The daily quest board rolled over during the absence. */
  dailyQuestAvailable: boolean;
  /** The Contract Board rolled over during the absence. */
  challengesReset: boolean;
}

/** An empty report, so callers never have to build one field by field. */
export function emptyReport(awaySeconds = 0): OfflineReport {
  return {
    awaySeconds,
    clamped: false,
    goldEarned: 0,
    xpEarned: 0,
    thrallFinds: [],
    thrallRolls: 0,
    thrallCapped: false,
    expeditions: [],
    dailyQuestAvailable: false,
    challengesReset: false,
  };
}

/**
 * Whole seconds between the last stamp and now, clamped both ways.
 *
 * A negative span is a clock that moved backwards — an NTP correction, a
 * manual change, a machine restored from a snapshot — and is worth zero rather
 * than a negative payout or an absolute value that would pay for time travel.
 */
export function awaySecondsBetween(lastActiveAt: number, now: number): number {
  if (!Number.isFinite(lastActiveAt) || !Number.isFinite(now)) return 0;
  const elapsed = Math.floor((now - lastActiveAt) / 1000);
  if (elapsed <= 0) return 0;
  return Math.min(elapsed, AWAY_MAX_SECONDS);
}

/** XP owed for an absence. Floored — a fraction of an XP is not a reward. */
export function offlineXpFor(awaySeconds: number): number {
  if (!Number.isFinite(awaySeconds) || awaySeconds <= 0) return 0;
  const seconds = Math.min(awaySeconds, AWAY_MAX_SECONDS);
  return Math.floor((seconds / 60) * AWAY_XP_PER_MINUTE);
}

/**
 * True when a report has something a visitor would be glad to be stopped for.
 *
 * A long absence with a brand-new save earns nothing at all — no upgrades, no
 * Thralls, no expeditions — and raising a curtain to announce zero of
 * everything is the worst version of this feature. The board rollovers count on
 * their own, because "your daily quests are back" is a reason to look.
 */
export function isReportWorthShowing(report: OfflineReport): boolean {
  return report.goldEarned > 0
    || report.xpEarned > 0
    || report.thrallFinds.length > 0
    || report.expeditions.length > 0
    || report.dailyQuestAvailable
    || report.challengesReset;
}

/**
 * "8h 23m" — the absence, as the header spells it.
 *
 * Seconds are shown only under a minute, because "5m 04s" invites the reader to
 * check the arithmetic on a number that was rounded twice before it got here.
 */
export function formatAway(awaySeconds: number): string {
  const total = Math.max(0, Math.floor(awaySeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${total}s`;
}

/**
 * Collapse a run of finds into one row per rune.
 *
 * Twelve Cinder Ore is one line that says twelve, not twelve lines. The order
 * of first appearance is kept rather than sorted by rarity: the list reads as a
 * night's work, and re-sorting it would put the best find at the top of a list
 * the visitor is about to be told is chronological.
 */
export function collapseFinds(finds: ReadonlyArray<AwayFindRow>): AwayFind[] {
  const rows: AwayFind[] = [];
  const byName = new Map<string, AwayFind>();
  for (const find of finds) {
    const seen = byName.get(find.name);
    if (seen) { seen.count++; continue; }
    const row: AwayFind = { ...find, count: 1 };
    byName.set(find.name, row);
    rows.push(row);
  }
  return rows;
}
