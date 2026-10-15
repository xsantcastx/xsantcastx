/**
 * routines.ts — where a settlement's keepers are, by the hour (One World §2.5).
 * Pure: no DOM, no Angular; the node harness (scripts/one-world.test.cjs) pins it.
 *
 * A keeper's day is a pure function of the world clock's in-game hour, so
 * nothing is simulated off screen and nothing is saved:
 *
 *   06–19  at the counter                      prompt: as always
 *   19–20  walking to the Hearth fire          prompt: "Kael is at the fire"
 *   20–23  at the Hearth (the canon "evening at the fire" lines)
 *   23–06  upstairs, the window lit, then dark prompt: "Ring the bell"
 *
 * A station is NEVER closed by time (owner rule: stations are dummy-simple):
 * at night E rings the bell and the panel opens as usual, with a sleepy line.
 *
 * Head marks, MapleStory's: `!` over a keeper with something to offer, `?`
 * over one with something to hand in (the hand-in wins), read from the same
 * chain and mission states the Quest Board shows (npc-quest.service.ts).
 */

export type KeeperSpotId = 'counter' | 'walk' | 'hearth' | 'upstairs';
/** Hours (0–24): the day's turns. */
export const DAY_START = 6, WALK_START = 19, HEARTH_START = 20, NIGHT_START = 23;

/** Where a keeper is at `hour`, and (walking) how far along the walk, 0..1. Pure. */
export function keeperSpot(hour: number): { spot: KeeperSpotId; t: number } {
  const h = ((hour % 24) + 24) % 24;
  if (h >= DAY_START && h < WALK_START) return { spot: 'counter', t: 0 };
  if (h >= WALK_START && h < HEARTH_START) return { spot: 'walk', t: h - WALK_START };
  if (h >= HEARTH_START && h < NIGHT_START) return { spot: 'hearth', t: 0 };
  return { spot: 'upstairs', t: 0 };
}

/** A keeper's x at `hour`: the counter, the walk to the fire (eased), the fire, or the counter's column upstairs. Pure. */
export function keeperX(hour: number, counterX: number, hearthX: number): number {
  const { spot, t } = keeperSpot(hour);
  if (spot === 'hearth') return hearthX;
  if (spot !== 'walk') return counterX;
  const s = t * t * (3 - 2 * t);
  return counterX + (hearthX - counterX) * s;
}

/** Stations are never closed by time. (A pure statement, pinned by the node test.) */
export function stationOpen(_hour: number): true { return true; }

/** What a station's prompt says about its keeper: as always, "at the fire", or "ring the bell". Pure. */
export function stationPrompt(hour: number): 'counter' | 'hearth' | 'bell' {
  const { spot } = keeperSpot(hour);
  return spot === 'upstairs' ? 'bell' : spot === 'counter' ? 'counter' : 'hearth';
}

/** True when windows are lit: from dusk until the keepers sleep, and the hour after they go up. */
export function windowsLit(hour: number): boolean {
  const h = ((hour % 24) + 24) % 24;
  return h >= WALK_START || h < 0.5;
}

/** A keeper's chain standing (the Quest Board's `!` and `?`). */
export interface ChainMark { offerReady: boolean; turnInReady: boolean }
/** A mission the keeper offers (unlocked, not yet claimed). */
export interface MissionMark { turnInReady: boolean }

/** `?` when anything can be handed in, `!` when anything is on offer, else null. Pure. */
export function headMark(chain: ChainMark | null | undefined, missions: readonly MissionMark[]): '!' | '?' | null {
  if (chain?.turnInReady || missions.some(m => m.turnInReady)) return '?';
  if (chain?.offerReady || missions.length) return '!';
  return null;
}
