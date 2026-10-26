/**
 * weather.model.ts — Weather v1 (S4; canon §6.7, docs/design/world-acts.md §3).
 *
 * The sky is one for everyone. Each land rolls one number per **weather window of 6 real minutes**:
 *
 *   window = floor(ms / 360 000)
 *   roll   = hashSeed(`${land}|weather|${window}`) / 2^32       (0..1; the loot module's FNV-1a)
 *
 * and each wild section maps that one roll through its own weights for the daypart at the window's midpoint (a
 * mountain can storm while the shore only rains). The Hearth room owns the roll when a Keeper is in the room-run
 * world: it sends the window and the rolls from its own clock (scripts/social-world.mjs `world-weather`), so two
 * devices with skewed clocks still see one sky. Alone, the device's world clock gives the same numbers.
 *
 * v1 ships Clear, Overcast, Rain, Thunderstorm and Fog. The land specials (Ashfall, Spore drift, Mist-rain: S8) read as
 * Overcast until they are built. An eclipse hushes the weather (Clear or Overcast only). Outdoors only.
 *
 * Wet (the shared table, skills-100 §0.4): lightning taken +25%, fire dealt −15% and fire taken −15%, a cold hit on the
 * Wet freezes. Rain makes the fish bite 25% sooner; a campfire in the rain gutters out in 60 s.
 *
 * Pure: no Angular, no DOM. The room bundles it (room-world.ts re-exports `weatherRolls`).
 */
import { hashSeed } from '../loot/champions';
import { eclipseAt, worldTime, type DayPhase } from '../world-clock/world-clock.model';

export type WeatherState = 'clear' | 'overcast' | 'rain' | 'storm' | 'fog';
export const WEATHER_STATES: readonly WeatherState[] = ['clear', 'overcast', 'rain', 'storm', 'fog'];

/** One weather window, in real ms (6 minutes). */
export const WEATHER_WINDOW_MS = 360_000;
/** Rain eases in at a window's start and out at its end over this long, when the next window differs. */
export const WEATHER_EASE_MS = 30_000;
/** The lands that weather (their continent ids). A hand-drawn level (a cave, a house, a floor) never does. */
export const WEATHER_LANDS: readonly string[] = ['ember-isle', 'infernal-reach', 'verdant-wilds', 'umbral-marches'];

/** Clear, Overcast, Rain, Thunderstorm, Fog, the land's special — per cent, summing to 100. */
type Row = readonly [number, number, number, number, number, number];
interface Weights { day: Row; night: Row }
const W = (day: Row, night: Row): Weights => ({ day, night });

/**
 * world-acts.md §3.3, by land and region (the continent maps' region characters). `*` is the land's default (its
 * coast, meadows, sea, lakes and town). Every row sums to 100 (weather.spec pins it).
 */
export const WEATHER_WEIGHTS: Readonly<Record<string, Readonly<Record<string, Weights>>>> = {
  'ember-isle': {
    '*': W([55, 20, 15, 0, 5, 5], [45, 20, 15, 0, 15, 5]),
    f: W([45, 20, 15, 0, 10, 10], [30, 20, 15, 0, 25, 10]),
    F: W([45, 20, 15, 0, 10, 10], [30, 20, 15, 0, 25, 10]),
    // Slagstone Hills: the island's one high ground, and its only storms.
    h: W([45, 20, 15, 5, 5, 10], [35, 20, 15, 5, 15, 10]),
    m: W([45, 20, 15, 5, 5, 10], [35, 20, 15, 5, 15, 10]),
    v: W([30, 20, 10, 0, 10, 30], [25, 20, 10, 0, 15, 30]),
  },
  'infernal-reach': {
    '*': W([45, 20, 15, 5, 5, 10], [35, 20, 15, 5, 15, 10]),
    f: W([35, 25, 10, 5, 10, 15], [25, 20, 10, 5, 25, 15]),
    F: W([35, 25, 10, 5, 10, 15], [25, 20, 10, 5, 25, 15]),
    h: W([40, 20, 5, 10, 0, 25], [30, 20, 5, 15, 5, 25]),
    v: W([35, 20, 5, 10, 0, 30], [30, 20, 5, 10, 5, 30]),
    // The Pyre Peaks: the Reach's storm country.
    m: W([30, 20, 10, 20, 10, 10], [20, 20, 10, 25, 15, 10]),
  },
  'verdant-wilds': {
    '*': W([40, 20, 25, 5, 5, 5], [30, 20, 25, 5, 15, 5]),
    r: W([35, 15, 30, 5, 10, 5], [25, 15, 25, 5, 25, 5]),
    l: W([35, 15, 30, 5, 10, 5], [25, 15, 25, 5, 25, 5]),
    j: W([30, 20, 25, 10, 5, 10], [20, 20, 25, 10, 15, 10]),
    J: W([20, 25, 20, 15, 10, 10], [15, 20, 20, 15, 20, 10]),
    u: W([25, 20, 20, 15, 10, 10], [15, 20, 15, 15, 25, 10]),
  },
  'umbral-marches': {
    '*': W([15, 25, 15, 5, 30, 10], [10, 20, 10, 5, 45, 10]),
    Q: W([10, 20, 15, 10, 35, 10], [5, 15, 10, 10, 50, 10]),
    k: W([10, 25, 15, 10, 30, 10], [5, 20, 10, 10, 45, 10]),
    x: W([10, 20, 10, 15, 35, 10], [5, 15, 10, 15, 45, 10]),
  },
};

export type Daypart = 'day' | 'dusk' | 'night';
/** Dawn counts as dusk (§3.1). */
export function daypartOf(phase: DayPhase): Daypart { return phase === 'day' ? 'day' : phase === 'night' ? 'night' : 'dusk'; }

/** The window an instant falls in. */
export function weatherWindow(ms: number): number { return Math.floor(ms / WEATHER_WINDOW_MS); }

/** A land's roll for a window, 0..1. */
export function weatherRoll(land: string, window: number): number {
  return hashSeed(`${land}|weather|${window}`) / 4294967296;
}

/** Every land's roll for a window (what the room sends). */
export function weatherRolls(window: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const land of WEATHER_LANDS) out[land] = weatherRoll(land, window);
  return out;
}

/** A section's weights for a daypart (dusk: the mean of day and night, rounded, then nudged back to 100). */
export function weightsFor(land: string, region: string, part: Daypart): Row {
  const table = WEATHER_WEIGHTS[land];
  const w = table?.[region] ?? table?.['*'];
  if (!w) return [100, 0, 0, 0, 0, 0];
  if (part !== 'dusk') return w[part];
  const mean = w.day.map((d, i) => Math.round((d + w.night[i]) / 2));
  const off = 100 - mean.reduce((a, b) => a + b, 0);
  mean[0] += off;
  return mean as unknown as Row;
}

/** Walk the weights in order with the roll. The land special (S8) reads as Overcast in v1. */
export function stateFor(roll: number, row: Row, eclipse: boolean): WeatherState {
  const order: WeatherState[] = ['clear', 'overcast', 'rain', 'storm', 'fog', 'overcast'];
  const u = Math.max(0, Math.min(.999999, roll)) * 100;
  let acc = 0, pick: WeatherState = 'clear';
  for (let i = 0; i < 6; i++) { acc += row[i]; if (u < acc) { pick = order[i]; break; } }
  // An eclipse hushes the sky: Clear or Overcast only, in the section's own proportion of the two.
  if (eclipse && pick !== 'clear' && pick !== 'overcast') {
    const share = row[0] / Math.max(1, row[0] + row[1] + row[5]);
    pick = (roll * 7.31) % 1 < share ? 'clear' : 'overcast';
  }
  return pick;
}

export interface WeatherNow {
  state: WeatherState;
  /** How far in the state is, 0..1 (the 30 s ease at a window's edges when the neighbour differs). */
  level: number;
  /** The window and the next one's state (Odette Pryor's board reads it, S8). */
  window: number;
  next: WeatherState;
  /** Real ms until this window ends. */
  leftMs: number;
}

export interface WeatherInput {
  land: string;
  /** The region character under the Keeper (the continent map's), or '*' for the land's default. */
  region: string;
  ms: number;
  /** The room's rolls for `window` (it owns the sky while a Keeper is in its world); absent: rolled here. */
  rolls?: { window: number; lands: Readonly<Record<string, number>> } | null;
  /** Indoors (a cave, a floor, a house): no weather. */
  indoors?: boolean;
}

function stateAt(land: string, region: string, window: number, rolls: WeatherInput['rolls']): WeatherState {
  const mid = window * WEATHER_WINDOW_MS + WEATHER_WINDOW_MS / 2;
  const part = daypartOf(worldTime(mid).phase);
  const roll = rolls && rolls.window === window && typeof rolls.lands[land] === 'number' ? rolls.lands[land] : weatherRoll(land, window);
  return stateFor(roll, weightsFor(land, region, part), !!eclipseAt(mid));
}

/** The weather a Keeper stands in. Pure. */
export function weatherAt(i: WeatherInput): WeatherNow {
  const window = weatherWindow(i.ms);
  const leftMs = (window + 1) * WEATHER_WINDOW_MS - i.ms;
  if (i.indoors || !WEATHER_WEIGHTS[i.land]) return { state: 'clear', level: 0, window, next: 'clear', leftMs };
  const state = stateAt(i.land, i.region, window, i.rolls);
  const prev = stateAt(i.land, i.region, window - 1, i.rolls);
  const next = stateAt(i.land, i.region, window + 1, i.rolls);
  const into = i.ms - window * WEATHER_WINDOW_MS;
  let level = 1;
  if (prev !== state) level = Math.min(level, into / WEATHER_EASE_MS);
  if (next !== state) level = Math.min(level, leftMs / WEATHER_EASE_MS);
  return { state, level: Math.max(0, Math.min(1, level)), window, next, leftMs };
}

// ── What the weather does (the rules) ────────────────────────────────────────

/** Rain and Thunderstorm wet everything outdoors. */
export function isWet(state: WeatherState): boolean { return state === 'rain' || state === 'storm'; }
/** How long Wet lingers after the rain (s). */
export const WET_LINGER_SECS = 5;

/** The shared Wet table: what a hit of `type` is multiplied by on (or by) the Wet. */
export const WET = { lightningTaken: 1.25, fireDealt: .85, fireTaken: .85 } as const;

/** Fishing bites sooner in the rain (world-acts §3.7). */
export function biteWeather(state: WeatherState): number { return isWet(state) ? 1.25 : 1; }

/** A campfire's life in seconds: two minutes (canon §6.5), one in the rain. */
export const FIRE_SECS = 120;
export const FIRE_RAIN_SECS = 60;
export function fireSecs(state: WeatherState): number { return isWet(state) ? FIRE_RAIN_SECS : FIRE_SECS; }

/** Fog's added mist over a land with none of its own, and over one that has it (the Marches). */
export function fogExtra(state: WeatherState, ownFog: number): number {
  if (state !== 'fog') return 0;
  return ownFog > 0 ? .1 : .35;
}

/** Overcast and Fog darken the day a little; a Thunderstorm more. */
export function dayDim(state: WeatherState): number {
  return state === 'overcast' ? .15 : state === 'fog' ? .1 : state === 'rain' ? .12 : state === 'storm' ? .25 : 0;
}

/** The player's choice (Menu → Settings → Weather): weather-show.ts. */
export { WEATHER_SHOWS, WEATHER_SHOW_KEY, type WeatherShow } from './weather-show';
