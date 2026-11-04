/**
 * night-events.model.ts — the night events, batch 1 (S8; docs/design/world-acts.md §5, canon §9).
 *
 * The dark is where the world remembers. Every event here comes only at night (one weather-gated one only in its
 * weather too); it never hurts, takes or chases; it is seen from a distance before it is near; walking away ends it;
 * following it pays. Each is **seeded per land and night** — `hashSeed(land|event|night)` and the world clock (the
 * room's clock while a Keeper is in its world) — so a party sees the same event at the same moment without a word on
 * the wire, and each runs at most **once per in-game night per land** (a world day is 24 real minutes, the night 9).
 *
 *   The Late Shift          Ember Isle, the Ember Mine head      night, 1 night in 3   six lamp-lights walk up out of
 *                           the shaft and go out one by one; where the last goes out, a lunch tin (a Cold Miner's
 *                           Pasty) and a scrap. A planted clue for campaign #1 (The Beacon Goes Down).
 *   The Count Goes On       Ember Isle, the Hushed Barrow's gate  night and fog         the barrow's bell counts one to
 *                           forty and starts again; stand at the lych-gate through a whole count for Wren's thanks.
 *   The Relief Column       the Reach, the Bastion Road           night                 a grey column marches to the
 *                           Ashen Bastion's gate and answers "Present." twenty times; walk at its side to the gate for
 *                           the chalked name and a Margin Note scrap (canon §9, Doors in the dark).
 *   The Kiln That Lights    the Reach, the Deep Charwood          night and Ashfall     the cold kiln glows for two
 *   Itself                  minutes; light it (a tinderbox) before it fades for the burners' cache.
 *   The Walking Tree        the Wilds, the Greenwood's glade      night, or fog         (S11) one of a pair of copied
 *                           trees is somewhere else each time the Keeper looks away; after three moves Glim dims beside
 *                           it, and one blow makes it a plain tree, leaving a copy-seed (a clue for campaign #7).
 *   The Bell Under the Water the Marches, the Black Meres         an eclipse            (S11 part 2) a minute or two
 *                           into the eclipse the fifth bell rings once under the water and every Lampfish in the Meres
 *                           goes dark; a Keeper by the Belfry's roof who stands still through its ringing sees the
 *                           fifth bell's keyhole glow, and takes a wax rubbing of it (a clue for campaign #12).
 *
 * Pure: no Angular, no DOM. The engine (play/td/td-night-events.ts) draws and walks them; the host pays.
 */
import { hashSeed } from '../loot/champions';
import { huntGold } from '../economy/economy-curve';
import { DAWN_START, NIGHT_START, eclipseAt, msAt, worldTime } from '../world-clock/world-clock.model';
import { WEATHER_WINDOW_MS, weatherAt, weatherWindow, type WeatherInput, type WeatherState } from '../weather/weather.model';

export type NightEventId = 'late-shift' | 'count-goes-on' | 'relief-column' | 'self-lit-kiln' | 'walking-tree' | 'bell-under-water';
export const NIGHT_EVENT_IDS: readonly NightEventId[] = ['late-shift', 'count-goes-on', 'relief-column', 'self-lit-kiln', 'walking-tree', 'bell-under-water'];

export interface NightEventDef {
  id: NightEventId;
  /** The land it is seeded on (its weather's land), and the area (a continent or an act's section) it happens in. */
  land: string;
  area: string;
  /** The region character its weather is read through (the section's own weights). */
  region: string;
  /** The weather it needs as well as the night, if any. */
  needs?: WeatherState;
  /** Nights in how many it comes (the Late Shift: 1 in 3); unset: every night its weather allows. */
  every?: number;
  /** How long it runs once it begins (s). The Count runs while its fog holds, in counts of forty. */
  secs: number;
  /** It comes under an eclipse, not at night (the Bell Under the Water): one an eclipse, the eclipse's day its "night". */
  eclipse?: boolean;
}

export const NIGHT_EVENTS: readonly NightEventDef[] = [
  { id: 'late-shift', land: 'ember-isle', area: 'ember-isle', region: '*', every: 3, secs: 120 },
  { id: 'count-goes-on', land: 'ember-isle', area: 'ember-isle', region: 'F', needs: 'fog', secs: 0 },
  { id: 'relief-column', land: 'infernal-reach', area: 'infernal-reach-pyre-peaks', region: 'h', secs: 120 },
  { id: 'self-lit-kiln', land: 'infernal-reach', area: 'infernal-reach-deep-charwood', region: 'F', needs: 'ashfall', secs: 120 },
  // The Walking Tree (S11): all night, and by day while the Greenwood's fog holds; it waits for the Keeper to look away.
  { id: 'walking-tree', land: 'verdant-wilds', area: 'verdant-wilds-greenwood', region: 'j', secs: 0 },
  // The Bell Under the Water (S11 part 2): once an eclipse, over the Sunken Belfry's roof on the Black Meres.
  { id: 'bell-under-water', land: 'umbral-marches', area: 'umbral-marches-meres', region: 'k', secs: 0, eclipse: true },
];
const BY_ID = new Map(NIGHT_EVENTS.map(e => [e.id, e]));
export function nightEventDef(id: string): NightEventDef | undefined { return BY_ID.get(id as NightEventId); }

// ── The night ────────────────────────────────────────────────────────────────

/** The night an instant belongs to (night n runs from day n's 20:00 to day n+1's 05:00), or null by day. */
export function nightOf(ms: number): number | null {
  const t = worldTime(ms);
  if (t.minute >= NIGHT_START) return t.day;
  if (t.minute < DAWN_START) return t.day - 1;
  return null;
}
/** Night n's first and last real ms. */
export function nightSpan(n: number): { start: number; end: number } {
  return { start: msAt(n, NIGHT_START), end: msAt(n + 1, DAWN_START) };
}

/** An event's seed for a night: the same number on every device of the land. */
export function nightSeed(land: string, id: NightEventId, night: number): number { return hashSeed(`${land}|${id}|${night}`); }

/** An event happening now: which night, when it began (real ms), how far in it is (s). */
export interface NightEventNow { id: NightEventId; night: number; startMs: number; t: number; secs: number }

/** The real-ms instant an event begins on a night, or null when it does not come that night. */
export function nightEventStart(def: NightEventDef, night: number, rolls?: WeatherInput['rolls']): number | null {
  const seed = nightSeed(def.land, def.id, night);
  if (def.every && seed % def.every !== 0) return null;
  const { start, end } = nightSpan(night);
  if (!def.needs) {
    // Somewhere in the night, never in its first or last minute.
    const room = Math.max(1, end - start - def.secs * 1000 - 120_000);
    return start + 60_000 + (Math.floor(seed / 7) % room);
  }
  // The first stretch of the night its weather holds (window by window), then a seeded breath into it.
  for (let w = weatherWindow(start); w * WEATHER_WINDOW_MS < end; w++) {
    const a = Math.max(start, w * WEATHER_WINDOW_MS), b = Math.min(end, (w + 1) * WEATHER_WINDOW_MS);
    const st = weatherAt({ land: def.land, region: def.region, ms: a + 1, rolls: rolls ?? null }).state;
    if (st !== def.needs) continue;
    const at = a + (Math.floor(seed / 11) % 60_000);
    if (at < b - 30_000) return at;
  }
  return null;
}

/**
 * The events happening in an area now. The Count runs whenever its night and fog hold (its counts keep to the world
 * clock, so a party hears the same bell); the rest run once, from their start, for their `secs`.
 */
export function nightEventsAt(area: string, ms: number, rolls?: WeatherInput['rolls']): NightEventNow[] {
  const night = nightOf(ms);
  const out: NightEventNow[] = [];
  // The Walking Tree also walks in a day's fog: that day's fog and the night after it are one night's event (one seed).
  for (const def of NIGHT_EVENTS) {
    if (def.area !== area || def.id !== 'walking-tree') continue;
    const fog = weatherAt({ land: def.land, region: def.region, ms, rolls: rolls ?? null }).state === 'fog';
    if (night === null && !fog) continue;
    const n = night ?? worldTime(ms).day, startMs = night !== null ? nightSpan(night).start : weatherWindow(ms) * WEATHER_WINDOW_MS;
    out.push({ id: def.id, night: n, startMs, t: (ms - startMs) / 1000, secs: 0 });
  }
  // The Bell Under the Water keeps an eclipse, not the night: it runs from the eclipse's first minute to its last.
  const ecl = eclipseAt(ms);
  for (const def of NIGHT_EVENTS) {
    if (def.area !== area || !def.eclipse || !ecl) continue;
    out.push({ id: def.id, night: ecl.id, startMs: ecl.startMs, t: (ms - ecl.startMs) / 1000, secs: (ecl.endMs - ecl.startMs) / 1000 });
  }
  if (night === null) return out;
  for (const def of NIGHT_EVENTS) {
    if (def.area !== area || def.id === 'walking-tree' || def.eclipse) continue;
    if (def.id === 'count-goes-on') {
      if (weatherAt({ land: def.land, region: def.region, ms, rolls: rolls ?? null }).state !== 'fog') continue;
      const startMs = Math.floor(ms / COUNT_CYCLE_MS) * COUNT_CYCLE_MS;
      out.push({ id: def.id, night, startMs, t: (ms - startMs) / 1000, secs: COUNT_CYCLE_MS / 1000 });
      continue;
    }
    const startMs = nightEventStart(def, night, rolls);
    if (startMs === null || ms < startMs || ms >= startMs + def.secs * 1000) continue;
    out.push({ id: def.id, night, startMs, t: (ms - startMs) / 1000, secs: def.secs });
  }
  return out;
}

// ── Each event's own clockwork ───────────────────────────────────────────────

/** The Count: a bell every 1.5 s, one to forty, then a beat of silence (the forty-first), and again. */
export const COUNT = { step: 1.5, bells: 40 } as const;
export const COUNT_CYCLE_MS = (COUNT.bells + 1) * COUNT.step * 1000;
/** The bell a count has reached (1–40), or 41: the silence before it starts again. */
export function countBell(t: number): number { return Math.min(COUNT.bells + 1, Math.floor(t / COUNT.step) + 1); }
/** How near the lych-gate a Keeper must stand through the count (tiles). */
export const COUNT_GATE = 3;

/** The Late Shift: six lamps a few seconds apart, at a slow walk; each goes out where the walk ends. */
export const SHIFT = { lamps: 6, gap: 2.5, speed: 1, out: 1.4 } as const;

/** The Relief Column: soldiers in file, at a march; then the roll-call, "Present." twenty times. */
export const COLUMN = { soldiers: 10, gap: 1.2, speed: 1.6, calls: 20, callEvery: 2, side: 5, share: .6 } as const;

/** The Kiln: it glows the event's two minutes; lit before it fades, it pays once. */
export const KILN = { glow: 120 } as const;

/**
 * The Walking Tree: it moves only while unseen, never to within `keep` tiles of the Keeper; after `moves` moves Glim dims
 * beside it, and a blow within `reach` tiles makes it a plain tree. It is "seen" once it has stood in view `look` s.
 */
export const WALKER = { moves: 3, keep: 6, reach: 2.5, look: .6 } as const;

/**
 * The Bell Under the Water: the fifth bell rings once, `ring` s into the eclipse plus a seeded minute (a forced test
 * event: `forced` s); every Lampfish in the Meres goes dark for `dark` s. A Keeper within `near` tiles of the Belfry's
 * roof at the note who stays within `drift` tiles of where they stood for `still` s sees the keyhole glow (paid once).
 */
export const UNDERBELL = { ring: 60, spread: 60, forced: 3, dark: 60, still: 12, near: 10, drift: .6, heard: 40 } as const;
/** The seconds into an eclipse the fifth bell rings (the same for every Keeper of the land). */
export function underbellRing(eclipseDay: number): number {
  return eclipseDay < 0 ? UNDERBELL.forced : UNDERBELL.ring + (nightSeed('umbral-marches', 'bell-under-water', eclipseDay) % UNDERBELL.spread);
}

// ── What following pays (once per night, per Keeper; the host books it) ────

export interface NightReward { stacks: readonly { id: string; qty: number }[]; gold: number }
export const NIGHT_REWARDS: Readonly<Record<NightEventId, NightReward>> = {
  'late-shift': { stacks: [{ id: 'cold-miners-pasty', qty: 1 }], gold: 0 },
  // The Sexton's thanks, from the Count's own purse (sexton-count's reward pool: priced as three minutes of a level-6 hunt).
  'count-goes-on': { stacks: [], gold: Math.floor(huntGold(6, 3 * 60)) },
  'relief-column': { stacks: [{ id: 'margin-note-scrap', qty: 1 }], gold: 0 },
  'self-lit-kiln': { stacks: [{ id: 'charcoal', qty: 10 }, { id: 'basalt-blank', qty: 1 }], gold: 0 },
  'walking-tree': { stacks: [{ id: 'copy-seed', qty: 1 }], gold: 0 },
  'bell-under-water': { stacks: [{ id: 'keyhole-rubbing', qty: 1 }], gold: 0 },
};
/** The one key a night's reward is booked under (a drop id: a second claim the same night is the same write). */
export function nightRewardKey(id: NightEventId, night: number, part = ''): string { return `night:${id}:${night}${part ? `:${part}` : ''}`; }
