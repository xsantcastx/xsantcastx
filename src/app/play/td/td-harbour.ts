/**
 * td-harbour.ts — the Harbourmasters and the Sailing Board (docs/design/realms-endgame.md §1), pure data and logic.
 *
 * A ship is still a ContinentWay / VillageWay with `ship: true` (continent.ts): the engine keeps it as a berth to arrive
 * in front of. What the player meets is the Harbourmaster who stands at the head of each pier and, on talking to them,
 * the Sailing Board: every ship of that pier, composed from the same ways (no second copy of the routes), with a fare
 * priced in the hunt (huntGold), a level band, and a state. Nothing here touches the DOM or the engine.
 */
import type { ContinentDef } from './continent';
import { CONTINENT_BANDS } from './td-zones';
import { huntGold } from '../../shared/economy/economy-curve';

/** A pier with a Harbourmaster on it. */
export interface Pier {
  id: string;
  /** The pier's name in English (the text in i18n is keyed by id). */
  name: string;
  continent: string;
  /** The village the pier belongs to (its ways), or null: the continent's own harbour place (Ember Harbour, Pyrehold). */
  village: string | null;
  /** Every ship station moored here. */
  stations: readonly string[];
  master: { id: string; name: string };
  /** Where the Harbourmaster stands: tiles of the village, or offset from the harbour place (the pier's landward end). */
  at: { c: number; r: number };
}

export const PIERS: readonly Pier[] = [
  { id: 'ember-harbour', name: 'Ember Harbour', continent: 'ember-isle', village: null, stations: ['ship-reach', 'ship-isle-verdant'], master: { id: 'harbourmaster-odd-tarn', name: 'Odd Tarn' }, at: { c: 1, r: 2 } },
  { id: 'pyrehold', name: 'Pyrehold', continent: 'infernal-reach', village: null, stations: ['ship-isle', 'ship-verdant', 'ship-umbral'], master: { id: 'harbourmaster-hale-dross', name: 'Hale Dross' }, at: { c: 1, r: 2 } },
  { id: 'cinderport', name: 'Cinderport', continent: 'infernal-reach', village: 'Cinderport', stations: ['ship-cinderport'], master: { id: 'harbourmaster-marit-salt', name: 'Marit Salt' }, at: { c: 16, r: 12 } },
  { id: 'mossharbor', name: 'Mossharbor', continent: 'verdant-wilds', village: 'Mossharbor', stations: ['ship-mossharbor', 'ship-mossharbor-isle'], master: { id: 'harbourmaster-sunny-pell', name: 'Sunny Pell' }, at: { c: 12, r: 12 } },
  { id: 'mirewatch', name: 'Mirewatch', continent: 'umbral-marches', village: 'Mirewatch', stations: ['ship-mirewatch'], master: { id: 'harbourmaster-old-corvane', name: 'Old Corvane' }, at: { c: 17, r: 12 } },
];

export const pierById = (id: string): Pier | undefined => PIERS.find(p => p.id === id);
/** The pier a Harbourmaster stands on (by their keeper id), or undefined (any other keeper). */
export const pierOfMaster = (keeperId: string): Pier | undefined => PIERS.find(p => p.master.id === keeperId);
/** The pier a ship station is moored at. */
export const pierOfStation = (stationId: string): Pier | undefined => PIERS.find(p => p.stations.includes(stationId));
/** Whether a station is a ship's berth (the engine arrives in front of it, but it is never a place of its own). */
export const isBerth = (stationId: string): boolean => PIERS.some(p => p.stations.includes(stationId));

/** What a continent is, to a sailor: its level band (docs/design/world-map.md) and the act that closes the way in. */
export interface LandFacts { band: readonly [number, number]; entry: number; gate: string | null }
const GATES: Readonly<Record<string, string | null>> = { 'ember-isle': null, 'infernal-reach': 'ember-warden', 'verdant-wilds': 'cinder-sovereign', 'umbral-marches': 'elder-rootwyrm' };
/** The bands are td-zones' own (CONTINENT_BANDS), so a ship's board and the Map's titles never disagree; the entry is the band's floor. */
export const LANDS: Readonly<Record<string, LandFacts>> = Object.fromEntries(Object.entries(CONTINENT_BANDS).map(([id, band]) => [id, { band, entry: band[0], gate: GATES[id] ?? null }]));
/**
 * The story gates are a data hook, not a wall: until the acts that set them are tracked, every route that is reachable
 * today stays reachable. Flip this on (and pass `cleared`) when the story spine lands.
 */
export const STORY_LOCKS_ENFORCED = false;

/** The long way round (two minutes by sea in the doc): a boat that skips a whole continent. */
const LONG_WAY: ReadonlySet<string> = new Set(['ship-isle-verdant', 'ship-mossharbor-isle']);

/** A fare is about ten steady kills at the destination's entry level, rounded to ten (economy-curve). */
export const FARE_SECONDS = 150;
export function fareFor(entryLevel: number): number {
  return Math.max(10, Math.round(huntGold(Math.max(1, entryLevel), FARE_SECONDS) / 10) * 10);
}

/** One ship out of a pier, read from the continents' own ways. */
export interface Route { from: string; to: string; arrive: string; destPier: string; long: boolean }

/** Every ship way of a continent (its places' and its villages'), with the village it leaves from (null: the harbour place). */
function shipWays(def: ContinentDef): { village: string | null; station: string; to: string; arrive: string }[] {
  const out: { village: string | null; station: string; to: string; arrive: string }[] = [];
  for (const w of def.ways) if (w.ship) out.push({ village: null, station: w.station.id, to: w.to, arrive: w.arrive });
  for (const v of def.villages ?? []) for (const w of v.ways ?? []) if (w.ship) out.push({ village: v.name, station: w.station.id, to: w.to, arrive: w.arrive });
  return out;
}

/** The ships that leave a pier. */
export function routesFrom(pierId: string, continents: Readonly<Record<string, ContinentDef>>): Route[] {
  const pier = pierById(pierId), def = pier && continents[pier.continent];
  if (!pier || !def) return [];
  const out: Route[] = [];
  for (const w of shipWays(def)) {
    if (!pier.stations.includes(w.station)) continue;
    const dest = pierOfStation(w.arrive);
    if (dest) out.push({ from: w.station, to: w.to, arrive: w.arrive, destPier: dest.id, long: LONG_WAY.has(w.station) });
  }
  return out;
}

export type BoardState = 'ok' | 'broke' | 'locked';
export interface BoardRow {
  /** The ship's station id: unique on a board. */
  id: string;
  destPier: string;
  continent: string;
  band: readonly [number, number];
  entry: number;
  fare: number;
  long: boolean;
  to: string;
  arrive: string;
  /** The act whose boss closes the way (data; only a lock when STORY_LOCKS_ENFORCED). */
  gate: string | null;
  state: BoardState;
  /** The Keeper is below the destination's entry level: a soft warning, never a block. */
  warn: boolean;
}

export interface BoardOpts {
  continents: Readonly<Record<string, ContinentDef>>;
  /** The Keeper's level and purse. */
  level: number;
  gold: number;
  /** Bosses felled (ids as LANDS.gate), for when the story locks are enforced. */
  cleared?: ReadonlySet<string>;
  enforceStory?: boolean;
}

/** The Sailing Board of a pier: affordable and open first (the cheaper the nearer), then the locked. */
export function buildBoard(pierId: string, o: BoardOpts): BoardRow[] {
  const enforce = o.enforceStory ?? STORY_LOCKS_ENFORCED;
  const rows = routesFrom(pierId, o.continents).map((r): BoardRow => {
    const dest = pierById(r.destPier)!, land = LANDS[dest.continent] ?? { band: [1, 1], entry: 1, gate: null };
    const fare = fareFor(land.entry);
    const locked = enforce && !!land.gate && !(o.cleared?.has(land.gate));
    return {
      id: r.from, destPier: r.destPier, continent: dest.continent, band: land.band, entry: land.entry, fare, long: r.long, to: r.to, arrive: r.arrive,
      gate: land.gate, state: locked ? 'locked' : o.gold >= fare ? 'ok' : 'broke', warn: o.level < land.entry,
    };
  });
  return rows.sort((a, b) => (a.state === 'locked' ? 1 : 0) - (b.state === 'locked' ? 1 : 0) || a.fare - b.fare || a.destPier.localeCompare(b.destPier));
}

/** The cheapest fare out of a pier (the hover card on its map pin). */
export function cheapestFare(pierId: string, continents: Readonly<Record<string, ContinentDef>>): number {
  return Math.min(...routesFrom(pierId, continents).map(r => fareFor(LANDS[pierById(r.destPier)!.continent]?.entry ?? 1)));
}
