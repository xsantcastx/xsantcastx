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
 * v1 shipped Clear, Overcast, Rain, Thunderstorm and Fog; S8 adds each land's special (Ashfall on Ember Isle and the
 * Reach, Spore drift in the Wilds, Mist-rain in the Marches) and the storm's strikes (td-weather-fx). An eclipse hushes
 * the weather (Clear or Overcast only). Outdoors only.
 *
 * Wet (the shared table, skills-100 §0.4): lightning taken +25%, fire dealt −15% and fire taken −15%, a cold hit on the
 * Wet freezes. Rain makes the fish bite 25% sooner; a campfire in the rain gutters out in 60 s.
 *
 * Pure: no Angular, no DOM. The room bundles it (room-world.ts re-exports `weatherRolls`).
 */
import { hashSeed } from '../loot/champions';
import { eclipseAt, worldTime, type DayPhase } from '../world-clock/world-clock.model';

export type WeatherState = 'clear' | 'overcast' | 'rain' | 'storm' | 'fog' | 'ashfall' | 'spores' | 'mistrain';
export const WEATHER_STATES: readonly WeatherState[] = ['clear', 'overcast', 'rain', 'storm', 'fog', 'ashfall', 'spores', 'mistrain'];
/** Each land's own weather (world-acts §3.2): the sixth column of its weights. */
export type LandSpecial = 'ashfall' | 'spores' | 'mistrain';
export const LAND_SPECIAL: Readonly<Record<string, LandSpecial>> = {
  'ember-isle': 'ashfall', 'infernal-reach': 'ashfall', 'verdant-wilds': 'spores', 'umbral-marches': 'mistrain',
};

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

/** Walk the weights in order with the roll; the sixth column is the land's special (Overcast where a land has none). */
export function stateFor(roll: number, row: Row, eclipse: boolean, special: WeatherState = 'overcast'): WeatherState {
  const order: WeatherState[] = ['clear', 'overcast', 'rain', 'storm', 'fog', special];
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
  return stateFor(roll, weightsFor(land, region, part), !!eclipseAt(mid), LAND_SPECIAL[land] ?? 'overcast');
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

/** Rain, Thunderstorm and the Marches' Mist-rain wet everything outdoors. */
export function isWet(state: WeatherState): boolean { return state === 'rain' || state === 'storm' || state === 'mistrain'; }
/** Mist-rain is Rain's rules at half strength (world-acts §3.2): Wet, fire −8%, lightning +10%. */
export function wetStrength(state: WeatherState): number { return state === 'mistrain' ? .5 : isWet(state) ? 1 : 0; }
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
  // Mist-rain thickens the Marches' own fog by a tenth.
  if (state === 'mistrain') return .1;
  if (state !== 'fog') return 0;
  return ownFog > 0 ? .1 : .35;
}

/** Ashfall (Ember Isle, the Reach): fire burns a tenth hotter in the ash, cold a tenth weaker (world-acts §3.2). */
export const ASHFALL = { fire: 1.1, cold: .9 } as const;
/**
 * Spore drift (the Wilds): a fire hit on anything inside the drift bursts once — twice the drift's 4 a second, one
 * tile round (design-bible §4.7's Spore rule). Creatures only: the drift never hurts a Keeper.
 */
export const SPORE_BURST = { dmg: 8, r: 1, gap: 2 } as const;

// ── The storm's strikes (world-acts §3.2, §3.4) ──────────────────────────────

/**
 * Every 20–40 s (seeded per Keeper) a strike lands on an open tile within 12 tiles: a 1.2 s ring is the tell, then 8%
 * of max life as lightning to whatever stands within a tile. A strike never takes a Keeper below a tenth of their life;
 * creatures take it in full.
 */
export const STRIKE = { every: [20, 40], reach: 12, tell: 1.2, pct: .08, floor: .1, radius: 1.25, scorch: 20 } as const;
/** What a strike takes from a Keeper: 8% of max life, Wet ×1.25, a meal's resist off, never below the floor. */
export function strikeOnKeeper(hp: number, maxHp: number, o: { wet: number; resist: number }): number {
  const floor = Math.ceil(maxHp * STRIKE.floor);
  if (hp <= floor) return 0;
  const raw = maxHp * STRIKE.pct * (1 + (WET.lightningTaken - 1) * Math.max(0, Math.min(1, o.wet))) * (1 - Math.max(0, Math.min(.75, o.resist / 100)));
  return Math.max(0, Math.min(hp - floor, Math.round(raw)));
}
/** What a strike takes from a creature: 8% of its life, deeper on the Wet. */
export function strikeOnCreature(maxHp: number, wet: number): number {
  return Math.max(1, Math.round(maxHp * STRIKE.pct * (1 + (WET.lightningTaken - 1) * Math.max(0, Math.min(1, wet)))));
}

// ── Odette Pryor's board (world-acts §3.6; canon §9 "The smoke leans") ───────

/** The next two windows' weather for a land's default ground, from the same roll the sky uses. */
export function forecast(land: string, ms: number, rolls?: WeatherInput['rolls']): [WeatherState, WeatherState] {
  const w = weatherWindow(ms);
  return [stateAt(land, '*', w + 1, rolls ?? null), stateAt(land, '*', w + 2, rolls ?? null)];
}

/** Overcast and Fog darken the day a little; a Thunderstorm more. */
export function dayDim(state: WeatherState): number {
  switch (state) {
    case 'overcast': return .15;
    case 'fog': return .1;
    case 'rain': return .12;
    case 'storm': return .25;
    case 'ashfall': return .12;
    case 'spores': return .06;
    case 'mistrain': return .12;
    default: return 0;
  }
}

/** The player's choice (Menu → Settings → Weather): weather-show.ts. */
export { WEATHER_SHOWS, WEATHER_SHOW_KEY, type WeatherShow } from './weather-show';
