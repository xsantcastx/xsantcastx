/**
 * td-sky-lines.ts — what people say about the weather (S8; docs/design/world-acts.md §3.6), and Odette Pryor's forecast
 * board in the Pyre Spire study (canon §9 "The smoke leans"). Pure data: the engine speaks a line once per weather
 * window when the Keeper walks near the one who says it while their weather holds. The words are gathering.i18n.ts
 * (`weather.bark.*`, `weather.board.*`), EN + ES. Old Netter Pell's rain line plays as you cast (gathering, S4).
 */
import type { WeatherState } from '../../shared/weather/weather.model';

export interface WeatherBark { npc: string; states: readonly WeatherState[]; key: string }

/** By keeper id (the town maps' and the piers' givers), the weather they speak in, and their line's key. */
export const WEATHER_BARKS: readonly WeatherBark[] = [
  { npc: 'harbourmaster-odd-tarn', states: ['storm'], key: 'weather.bark.tarn' },
  { npc: 'charburner-kiln', states: ['rain', 'storm', 'mistrain'], key: 'weather.bark.maud' },
  { npc: 'captain-vey', states: ['storm'], key: 'weather.bark.vey' },
  { npc: 'warden-fenn', states: ['spores'], key: 'weather.bark.fenn' },
  // S10: the Antlered Storm's rumours (monsters-abilities §6.3): in a thunderstorm the Wilds talk about the Oak.
  { npc: 'warden-fenn', states: ['storm'], key: 'weather.bark.fennStorm' },
  { npc: 'teo-alder', states: ['storm'], key: 'weather.bark.alderStorm' },
  { npc: 'harbourmaster-old-corvane', states: ['fog', 'mistrain'], key: 'weather.bark.corvane' },
];
/** How near (tiles) the Keeper walks for one of them to speak. */
export const BARK_REACH = 5;

/** The line a keeper says in this weather, or null. */
export function barkFor(npc: string | undefined, state: WeatherState): string | null {
  if (!npc) return null;
  const b = WEATHER_BARKS.find(x => x.npc === npc && x.states.includes(state));
  return b ? b.key : null;
}

/**
 * Odette Pryor's board: on the wall of her Study, the Pyre Spire's second floor (maps/pyre-spire.ts 'B'). Read it (E, a
 * tap) and it says the next two windows' weather over the Reach, from the same roll the sky uses.
 */
export const ODETTE_BOARD = { id: 'odette:board', level: 'pyre-spire-2', land: 'infernal-reach' } as const;
