/**
 * world-hour.ts — the in-game hour One World's settlements keep (routines,
 * lit windows, the night's dark). A small adapter the world clock replaces.
 *
 * The day/night clock is in flight on its own branch (`world-clock`: a Sky
 * state, a Slate phone with a Map app). Until it lands on main, this is the
 * one place that says what hour it is: a day of DAY_MINUTES real minutes, the
 * same for every player at the same moment (the epoch, not the session), so
 * two Keepers in one settlement see the keepers in the same place. When the
 * clock lands, `worldHourSource` points at it and nothing else changes: every
 * caller asks `worldHour(now)`.
 *
 * Tests and the e2e pin the hour with `?hour=<0-24>` (read once per page).
 */
/** Real minutes in one in-game day. */
export const DAY_MINUTES = 48;

export interface WorldHourSource { hour(now: number): number }

/** The default: the epoch's clock, a day every DAY_MINUTES. */
export const EPOCH_HOURS: WorldHourSource = {
  hour: now => ((now / (DAY_MINUTES * 60_000)) % 1) * 24,
};

let source: WorldHourSource = EPOCH_HOURS;
let pinned: number | null | undefined;

/** Point the hour at another clock (the world-clock service, when it lands). */
export function setWorldHourSource(next: WorldHourSource): void { source = next; }

/** The in-game hour, 0 ≤ h < 24. */
export function worldHour(now: number = Date.now()): number {
  if (pinned === undefined) {
    pinned = null;
    try {
      const raw = typeof window !== 'undefined' ? new URLSearchParams(window.location?.search ?? '').get('hour') : null;
      const h = raw === null ? NaN : Number(raw);
      if (Number.isFinite(h) && h >= 0 && h < 24) pinned = h;
    } catch { /* the clock's own hour */ }
  }
  if (pinned !== null) return pinned;
  const h = source.hour(now);
  return ((h % 24) + 24) % 24;
}
