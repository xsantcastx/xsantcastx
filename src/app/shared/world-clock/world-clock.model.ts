/**
 * world-clock.model.ts — the one in-game clock of Eclipse Realms
 * (docs/handoff/world-clock.md). Pure: no Angular, no imports, so the engine,
 * the node harness, the economy sim and the meaning check all load it as is.
 *
 * ONE IN-GAME DAY = 24 REAL MINUTES (one real second is one in-game minute;
 * one real minute is one in-game hour). Why 24:
 *  - a play session (20–40 min) sees a whole day and a whole night, so day and
 *    night are something you live through, not a setting you read about;
 *  - the night (20:00–05:00) is nine real minutes: long enough to walk to a
 *    hunting ground and cut a Moonwake Bloom, short enough that nobody waits
 *    for it (Terraria's day is the same 24 minutes, the owner's reference);
 *  - the arithmetic is the kind a player can do in their head ("a minute is an
 *    hour").
 *
 * DETERMINISTIC FROM REAL TIME. Everything here is a function of one number,
 * epoch milliseconds (Date.now()). No local time, no time zone, no DST: two
 * devices on opposite sides of the world, one of them mid-DST-change, read the
 * same hour, the same day and the same eclipse. Nothing is saved; nothing
 * drifts.
 *
 * Real-world resets are NOT this clock: Pim's bounties, the quest board, the
 * Banked Furnace once-a-day and every other daily turn over at the player's
 * local midnight, as they always have. This clock is the world's sky.
 *
 * The calendar: a week of seven named days, five months of fourteen days, one
 * per realm, so a year is seventy in-game days (28 real hours). The year count
 * starts at Year 1 on 2026-01-01 00:00 UTC.
 *
 * Eclipses: every fifth in-game day (two real hours apart), 10:00–18:00 (eight
 * real minutes), the moon mirror crosses the sun. The schedule is fixed, so the
 * Slate can count down to the next one from anywhere.
 */

/** The clock's zero: Year 1, the first of Emberwane, a Forgeday, midnight. */
export const CLOCK_EPOCH_MS = Date.UTC(2026, 0, 1);
/** Real milliseconds per in-game minute (one in-game day = 24 real minutes). */
export const REAL_MS_PER_WORLD_MINUTE = 1000;
export const WORLD_MINUTES_PER_DAY = 1440;
/** Real milliseconds in one in-game day. */
export const WORLD_DAY_MS = WORLD_MINUTES_PER_DAY * REAL_MS_PER_WORLD_MINUTE;

/** The seven days of the week (i18n `clock.day.<id>`), each named for what keeps it. */
export const WEEK_DAYS = ['forge', 'light', 'ink', 'star', 'root', 'hearth', 'moon'] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

export type ClockRealm = 'infernal' | 'luminous' | 'umbral' | 'celestial' | 'verdant';
export const CLOCK_REALMS: readonly ClockRealm[] = ['infernal', 'luminous', 'umbral', 'celestial', 'verdant'];

/** The five months, one per realm (i18n `clock.month.<id>`). */
export const MONTHS: readonly { id: string; realm: ClockRealm }[] = [
  { id: 'emberwane', realm: 'infernal' },
  { id: 'brightmere', realm: 'luminous' },
  { id: 'inkfall', realm: 'umbral' },
  { id: 'starturn', realm: 'celestial' },
  { id: 'rootwake', realm: 'verdant' },
];
export const MONTH_DAYS = 14;
export const YEAR_DAYS = MONTH_DAYS * MONTHS.length;

/** The parts of the day. An eclipse is its own sky (it only ever falls in the day). */
export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';
export type SkyPhase = DayPhase | 'eclipse';

/** Phase boundaries, in in-game minutes from midnight. */
export const DAWN_START = 5 * 60;
export const DAY_START = 7 * 60;
export const DUSK_START = 18 * 60;
export const NIGHT_START = 20 * 60;

/** Eclipses: every `every` days from day `offset`, `start`–`end` (in-game minutes), the dark ramping over `ramp`. */
export const ECLIPSE = { every: 5, offset: 2, start: 10 * 60, end: 18 * 60, ramp: 45 } as const;

export interface WorldTime {
  /** The real instant this was read at (epoch ms). */
  ms: number;
  /** In-game days since the epoch (0 = the first day; negative before it). */
  day: number;
  /** Minute of the in-game day, 0..1439. */
  minute: number;
  hour: number;
  /** Minute of the hour, 0..59. */
  min: number;
  /** 0..6 into WEEK_DAYS. */
  weekday: number;
  /** 0..4 into MONTHS. */
  month: number;
  /** 1..14. */
  dayOfMonth: number;
  /** 1.. */
  year: number;
  phase: DayPhase;
}

/** Floor modulo (always 0..m-1, also for negatives). */
function mod(n: number, m: number): number { return ((n % m) + m) % m; }

/** The in-game time at a real instant. Pure; time-zone and DST proof (epoch ms only). */
export function worldTime(ms: number): WorldTime {
  const total = Math.floor((ms - CLOCK_EPOCH_MS) / REAL_MS_PER_WORLD_MINUTE);
  const day = Math.floor(total / WORLD_MINUTES_PER_DAY);
  const minute = mod(total, WORLD_MINUTES_PER_DAY);
  const ofYear = mod(day, YEAR_DAYS);
  return {
    ms, day, minute,
    hour: Math.floor(minute / 60),
    min: minute % 60,
    weekday: mod(day, WEEK_DAYS.length),
    month: Math.floor(ofYear / MONTH_DAYS),
    dayOfMonth: (ofYear % MONTH_DAYS) + 1,
    year: Math.floor(day / YEAR_DAYS) + 1,
    phase: phaseAt(minute),
  };
}

/** The part of the day at a minute of it. */
export function phaseAt(minute: number): DayPhase {
  const m = mod(minute, WORLD_MINUTES_PER_DAY);
  if (m >= NIGHT_START || m < DAWN_START) return 'night';
  if (m < DAY_START) return 'dawn';
  if (m < DUSK_START) return 'day';
  return 'dusk';
}

/** Night proper (20:00–04:59): the moon is up, the Moonwake opens, the crickets sing. */
export function isNightMinute(minute: number): boolean { return phaseAt(minute) === 'night'; }

/** 0..1, eased. */
function smooth(t: number): number { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); }

/**
 * Daylight, 0 (deep night) .. 1 (full day): it climbs through the dawn, holds
 * all day and falls through the dusk. Pure; the engine maps it to a tint.
 */
export function daylight(minute: number): number {
  const m = mod(minute, WORLD_MINUTES_PER_DAY);
  if (m >= DAWN_START && m < DAY_START) return smooth((m - DAWN_START) / (DAY_START - DAWN_START));
  if (m >= DAY_START && m < DUSK_START) return 1;
  if (m >= DUSK_START && m < NIGHT_START) return 1 - smooth((m - DUSK_START) / (NIGHT_START - DUSK_START));
  return 0;
}

/** How warm (golden) the low sun makes the sky: peaks mid-dawn and mid-dusk, 0 otherwise. */
export function sunGlow(minute: number): number {
  const m = mod(minute, WORLD_MINUTES_PER_DAY);
  const bump = (from: number, to: number) => Math.sin(Math.PI * (m - from) / (to - from));
  if (m >= DAWN_START && m < DAY_START) return bump(DAWN_START, DAY_START);
  if (m >= DUSK_START && m < NIGHT_START) return bump(DUSK_START, NIGHT_START);
  return 0;
}

// ── Eclipses ──────────────────────────────────────────────────────────────

/** Whether an eclipse falls on an in-game day. */
export function isEclipseDay(day: number): boolean { return mod(day - ECLIPSE.offset, ECLIPSE.every) === 0; }

/** The realm the eclipse on `day` is aligned with: it turns through the five in order. */
export function eclipseRealm(day: number): ClockRealm {
  return CLOCK_REALMS[mod(Math.floor((day - ECLIPSE.offset) / ECLIPSE.every), CLOCK_REALMS.length)];
}

export interface EclipseWindow {
  /** The eclipse's id: the in-game day it falls on (the receipt the ledger keeps). */
  id: number;
  startMs: number;
  endMs: number;
  realm: ClockRealm;
}

/** The eclipse on `day` (whether or not that day has one: callers check isEclipseDay). */
function windowOf(day: number): EclipseWindow {
  const dayMs = CLOCK_EPOCH_MS + day * WORLD_DAY_MS;
  return {
    id: day,
    startMs: dayMs + ECLIPSE.start * REAL_MS_PER_WORLD_MINUTE,
    endMs: dayMs + ECLIPSE.end * REAL_MS_PER_WORLD_MINUTE,
    realm: eclipseRealm(day),
  };
}

/** The eclipse on now, or null. */
export function eclipseAt(ms: number): EclipseWindow | null {
  const { day } = worldTime(ms);
  if (!isEclipseDay(day)) return null;
  const w = windowOf(day);
  return ms >= w.startMs && ms < w.endMs ? w : null;
}

/** The eclipse on now, else the next one to begin. */
export function nextEclipse(ms: number): EclipseWindow {
  const now = eclipseAt(ms);
  if (now) return now;
  const { day } = worldTime(ms);
  let d = day + mod(ECLIPSE.offset - day, ECLIPSE.every);
  if (windowOf(d).startMs <= ms) d += ECLIPSE.every;
  return windowOf(d);
}

/** How dark the eclipse makes the sky now, 0..1 (ramping in and out over ECLIPSE.ramp in-game minutes). */
export function eclipseDepth(ms: number): number {
  const w = eclipseAt(ms);
  if (!w) return 0;
  const rampMs = ECLIPSE.ramp * REAL_MS_PER_WORLD_MINUTE;
  return smooth(Math.min(ms - w.startMs, w.endMs - ms) / rampMs);
}

// ── The sky the world draws ───────────────────────────────────────────────

export interface Sky {
  phase: SkyPhase;
  /** 0 (dark) .. 1 (full day), the eclipse included. */
  light: number;
  /** Dawn or dusk gold, 0..1. */
  glow: number;
  /** The eclipse's depth, 0..1. */
  eclipse: number;
  /** Night proper: night-only things are out. */
  night: boolean;
  /** An eclipse is on (from its first minute to its last). */
  eclipseOn: boolean;
  /** "Night-like": night, or the night at noon an eclipse makes. The Moonwake, the Mirrorfin and the Ink Lanterns keep this hour. */
  dark: boolean;
}

/** What the sky is doing at a real instant. Pure. */
export function skyAt(ms: number): Sky {
  const t = worldTime(ms);
  const eclipseOn = !!eclipseAt(ms);
  const depth = eclipseOn ? eclipseDepth(ms) : 0;
  const night = t.phase === 'night';
  return {
    phase: eclipseOn ? 'eclipse' : t.phase,
    light: daylight(t.minute) * (1 - .85 * depth),
    glow: sunGlow(t.minute) * (1 - depth),
    eclipse: depth,
    night,
    eclipseOn,
    dark: night || eclipseOn,
  };
}

/** "07:05". */
export function clockText(minute: number): string {
  const m = mod(Math.floor(minute), WORLD_MINUTES_PER_DAY);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** The real ms until `targetMs`, as in-game hours and minutes: { h, m } (both ≥ 0). */
export function worldSpan(fromMs: number, targetMs: number): { h: number; m: number } {
  const minutes = Math.max(0, Math.ceil((targetMs - fromMs) / REAL_MS_PER_WORLD_MINUTE));
  return { h: Math.floor(minutes / 60), m: minutes % 60 };
}

/** The real instant a given in-game minute of `day` begins (the test hook and the specs use it). */
export function msAt(day: number, minute: number): number {
  return CLOCK_EPOCH_MS + day * WORLD_DAY_MS + minute * REAL_MS_PER_WORLD_MINUTE;
}
