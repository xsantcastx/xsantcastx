/**
 * first-goals.ts: the four things a brand-new Keeper is walked through, in order:
 * buy a building, forge (and equip) a blade, defeat a creature with it, dig in
 * the Delve.
 *
 * The blade comes before the hunt on purpose (owner call, 2026-10-13): the
 * Basalt Edge needs only Cinder Ore from the seam and the Ember Residue the
 * seam guarantees by the 8th ore, so nobody has to fight bare-handed. The blade
 * goal is not done until a weapon is worn (or a creature has already fallen,
 * when arming no longer matters).
 *
 * Pure: the play view hands in what the save already says (a building owned,
 * Hunting XP, the Basalt Edge crafted and a weapon worn, a Delve cell dug) and
 * where the Keeper stands, and gets back one line to show and one place to walk
 * to. Nothing is stored for the guide itself, so it can never disagree with the
 * save: the first goal the save does not show yet is the current one, and once
 * all four are true the guide is gone for good.
 *
 * After the four, `runeForgeHint` may surface the Rune Forge once, the first
 * time a strike is affordable (the host stores only "seen").
 *
 * The copy lives in the lazy first-goals i18n table (EN + ES), never the eager one.
 */
import { HOMESTEAD_FORGE_STATION, HOMESTEAD_GATE_ID, HOMESTEAD_ID } from './homestead';

export type FirstGoalId = 'buy' | 'craft' | 'hunt' | 'delve';
export const FIRST_GOALS: readonly FirstGoalId[] = ['buy', 'craft', 'hunt', 'delve'];

/** What the save says, plus where the Keeper is. */
export interface FirstGoalFacts {
  /** At least one Homestead building owned (a Gold-per-second maker). */
  bought: boolean;
  /** Any Hunting XP: a creature has fallen to the Keeper. */
  hunted: boolean;
  /** The Basalt Edge was forged (or anything was crafted at a bench). */
  crafted: boolean;
  /** The Basalt Edge is in the satchel or worn. */
  edge: boolean;
  /** A weapon is worn in the main hand. */
  armed: boolean;
  /** Any cell dug in the Ember Delve. */
  dug: boolean;
  /** The engine's current area id: a town id, a hunt zone, the Homestead or the Delve. */
  areaId: string;
  /** Cinder Ore and Ember Residue held: which half of the blade goal is next. */
  ore: number;
  ember: number;
  /**
   * One World (docs/design/one-world.md): the town stands on the Delve, so the
   * play view hands 'infernal' on the settlement's street and 'ember-delve'
   * below it. `mawX` is where the Rivet Maws roam (the Quarry Road).
   */
  world?: { mawX: number };
}

/** Where "Show me" walks: a station (walk there and use it) or a spot on the floor. */
export type FirstGoalTarget = { station: string } | { x: number };

export interface FirstGoalView {
  /** A first goal, or 'rune': the one-time Rune Forge hint after all four. */
  id: FirstGoalId | 'rune';
  /** 1-based, for "Goal 2 of 4". 0 for the Rune Forge hint, which has no number. */
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
/** One World: where the first dig goal walks to: beside the mine head, past its bedrock ledge (col 8). */
const WORLD_DIG_X = 260;
/** What the Seamworks Forge asks for the Basalt Edge. */
const BLADE_ORE = 6;
const BLADE_EMBER = 1;

/**
 * The first goal the save does not show yet, or null when all four are done.
 * The blade goal is met once the Edge (or any craft) is made and a weapon is
 * worn; a Keeper who has already felled a creature is past needing it.
 */
export function currentFirstGoal(facts: Pick<FirstGoalFacts, 'bought' | 'hunted' | 'crafted' | 'armed' | 'dug'>): FirstGoalId | null {
  if (!facts.bought) return 'buy';
  if (!facts.hunted && !(facts.crafted && facts.armed)) return 'craft';
  if (!facts.hunted) return 'hunt';
  if (!facts.dug) return 'delve';
  return null;
}

export function firstGoal(facts: FirstGoalFacts): FirstGoalView | null {
  const id = currentFirstGoal(facts);
  if (!id) return null;
  const view = (key: string, target: FirstGoalTarget | null): FirstGoalView =>
    ({ id, n: FIRST_GOALS.indexOf(id) + 1, total: FIRST_GOALS.length, key, target });

  // One World (P2): the Homestead and the Ember Quarry are regions of the world the town stands in, so
  // there is no "head back": every goal is a walk along the same street (only the buy and the hunt are local).
  if (facts.world && facts.areaId === HOMESTEAD_ID) {
    if (id === 'buy') return view('play.goal.buy.home', { station: HOMESTEAD_FORGE_STATION });
    return firstGoal({ ...facts, areaId: HOME_TOWN });
  }
  if (facts.world && facts.areaId === QUARRY) {
    if (id === 'hunt') return view('play.goal.hunt.here', null);
    return firstGoal({ ...facts, areaId: HOME_TOWN });
  }
  // Off the beaten path: point back to the Seamworks, where every first goal is.
  if (facts.areaId === HOMESTEAD_ID) {
    return id === 'buy'
      ? view('play.goal.buy.home', { station: HOMESTEAD_FORGE_STATION })
      : view(`play.goal.${id}.back`, { station: 'passage' });
  }
  if (facts.areaId === DELVE) {
    // One World: under the town there is no exit to walk to; the way up is the way you dug (or the Travel map's recall).
    return id === 'delve' ? view('play.goal.delve.dig', null) : view(`play.goal.${id}.back`, facts.world ? null : { station: 'delve-exit' });
  }
  if (facts.areaId === QUARRY) {
    return id === 'hunt' ? view('play.goal.hunt.here', null) : view(`play.goal.${id}.back`, { station: 'passage' });
  }
  // One World: the wilds east and west are the same world as the town; the goals are a walk away, not a Waystone.
  if (facts.areaId !== HOME_TOWN && !facts.world) return view('play.goal.away', { station: 'waystone' });

  switch (id) {
    // One World: the plot is west along the street; walk to its Forge.
    case 'buy': return view('play.goal.buy.town', { station: facts.world ? HOMESTEAD_FORGE_STATION : HOMESTEAD_GATE_ID });
    case 'craft':
      // Forged but not worn: the Seamworks Forge equips it on the next use.
      if (facts.edge && !facts.armed) return view('play.goal.craft.equip', { station: 'forge' });
      return facts.ore >= BLADE_ORE && facts.ember >= BLADE_EMBER
        ? view('play.goal.craft.forge', { station: 'forge' })
        : view('play.goal.craft.mine', { station: 'ore' });
    case 'hunt': return view('play.goal.hunt.town', { x: facts.world?.mawX ?? MAW_APPROACH_X });
    // One World: the Delve is under the street; dig beside the headframe (its ledge is bedrock), where the old shaft dropped you.
    case 'delve': return facts.world ? view('play.goal.delve.world', { x: WORLD_DIG_X }) : view('play.goal.delve.town', { station: 'delve' });
  }
}

/** What the Rune Forge hint reads: the four goals, the purse, and whether it was already shown. */
export interface RuneHintFacts {
  /** All four first goals are done (firstGoal returned null). */
  goalsDone: boolean;
  gold: number;
  /** One rune strike's price (rune.model STRIKE_COST). */
  strikeCost: number;
  /** The hint was followed or dismissed, or the Rune Forge was opened: never again. */
  seen: boolean;
  areaId: string;
}

/**
 * The Rune Forge, surfaced in context. It stays out of the four goals; once
 * they are behind the Keeper and the purse first covers a strike, one "next
 * step" line points at it, on the Seamworks floor where it stands. Never twice
 * (the host stores `seen`), and never as a nag in the Delve or the Homestead.
 */
export function runeForgeHint(facts: RuneHintFacts): FirstGoalView | null {
  if (!facts.goalsDone || facts.seen || facts.areaId !== HOME_TOWN) return null;
  if (!(facts.strikeCost > 0) || facts.gold < facts.strikeCost) return null;
  return { id: 'rune', n: 0, total: FIRST_GOALS.length, key: 'play.goal.rune.town', target: { station: 'runes' } };
}
