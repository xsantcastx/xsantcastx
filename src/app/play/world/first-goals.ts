/**
 * first-goals.ts: the four things a brand-new Keeper is walked through, in order:
 * buy a building, defeat a creature, forge a blade, dig in the Delve.
 *
 * Pure: the play view hands in what the save already says (a building owned,
 * Hunting XP, the Basalt Edge crafted, a Delve cell dug) and where the Keeper
 * stands, and gets back one line to show and one place to walk to. Nothing is
 * stored for the guide itself, so it can never disagree with the save: the
 * first goal the save does not show yet is the current one, and once all four
 * are true the guide is gone for good.
 *
 * The copy lives in the lazy first-goals i18n table (EN + ES), never the eager one.
 */
import { HOMESTEAD_FORGE_STATION, HOMESTEAD_GATE_ID, HOMESTEAD_ID } from './homestead';

export type FirstGoalId = 'buy' | 'hunt' | 'craft' | 'delve';
export const FIRST_GOALS: readonly FirstGoalId[] = ['buy', 'hunt', 'craft', 'delve'];

/** What the save says, plus where the Keeper is. */
export interface FirstGoalFacts {
  /** At least one Homestead building owned (a Gold-per-second maker). */
  bought: boolean;
  /** Any Hunting XP: a creature has fallen to the Keeper. */
  hunted: boolean;
  /** The Basalt Edge was forged (or anything was crafted at a bench). */
  crafted: boolean;
  /** Any cell dug in the Ember Delve. */
  dug: boolean;
  /** The engine's current area id: a town id, a hunt zone, the Homestead or the Delve. */
  areaId: string;
  /** Cinder Ore and Ember Residue held: which half of the blade goal is next. */
  ore: number;
  ember: number;
}

/** Where "Show me" walks: a station (walk there and use it) or a spot on the floor. */
export type FirstGoalTarget = { station: string } | { x: number };

export interface FirstGoalView {
  id: FirstGoalId;
  /** 1-based, for "Goal 2 of 4". */
  n: number;
  total: number;
  /** The line to show (first-goals i18n key). */
  key: string;
  target: FirstGoalTarget | null;
}

/** The infernal town holds every first goal; the Delve and the quarry hang off it. */
const HOME_TOWN = 'infernal';
const DELVE = 'ember-delve';
const QUARRY = 'ember-quarry';
/** Just east of the Waystone, short of the first Rivet Maw (they guard from x 2250). */
const MAW_APPROACH_X = 2120;
/** What the Seamworks Forge asks for the Basalt Edge. */
const BLADE_ORE = 6;
const BLADE_EMBER = 1;

/** The first goal the save does not show yet, or null when all four are done. */
export function currentFirstGoal(facts: Pick<FirstGoalFacts, 'bought' | 'hunted' | 'crafted' | 'dug'>): FirstGoalId | null {
  if (!facts.bought) return 'buy';
  if (!facts.hunted) return 'hunt';
  if (!facts.crafted) return 'craft';
  if (!facts.dug) return 'delve';
  return null;
}

export function firstGoal(facts: FirstGoalFacts): FirstGoalView | null {
  const id = currentFirstGoal(facts);
  if (!id) return null;
  const view = (key: string, target: FirstGoalTarget | null): FirstGoalView =>
    ({ id, n: FIRST_GOALS.indexOf(id) + 1, total: FIRST_GOALS.length, key, target });

  // Off the beaten path: point back to the Seamworks, where every first goal is.
  if (facts.areaId === HOMESTEAD_ID) {
    return id === 'buy'
      ? view('play.goal.buy.home', { station: HOMESTEAD_FORGE_STATION })
      : view(`play.goal.${id}.back`, { station: 'passage' });
  }
  if (facts.areaId === DELVE) {
    return id === 'delve' ? view('play.goal.delve.dig', null) : view(`play.goal.${id}.back`, { station: 'delve-exit' });
  }
  if (facts.areaId === QUARRY) {
    return id === 'hunt' ? view('play.goal.hunt.here', null) : view(`play.goal.${id}.back`, { station: 'passage' });
  }
  if (facts.areaId !== HOME_TOWN) return view('play.goal.away', { station: 'waystone' });

  switch (id) {
    case 'buy': return view('play.goal.buy.town', { station: HOMESTEAD_GATE_ID });
    case 'hunt': return view('play.goal.hunt.town', { x: MAW_APPROACH_X });
    case 'craft':
      return facts.ore >= BLADE_ORE && facts.ember >= BLADE_EMBER
        ? view('play.goal.craft.forge', { station: 'forge' })
        : view('play.goal.craft.mine', { station: 'ore' });
    case 'delve': return view('play.goal.delve.town', { station: 'delve' });
  }
}
