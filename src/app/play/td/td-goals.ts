/**
 * td-goals.ts — the first goals of the top-down game (docs/design/vision.md; owner 2026-10-20: drop the Homestead and
 * gold-per-second for now, "focus on the game play"). Three things a new Warlock does, read from the save like the old
 * goals (never stored), so they move on the moment each is done, wherever it was done:
 *   1. go down the mine shaft and defeat a Rivet Maw (any Hunting XP),
 *   2. mine Cinder Ore (any accepted mining action),
 *   3. cut a tree in the wilds (any Woodcutting XP).
 * Pure. The view shape is first-goals.ts FirstGoalView, so the HUD's scroll shows it unchanged.
 */
import type { FirstGoalView } from '../world/first-goals';

export interface TdGoalFacts { hunted: boolean; mined: boolean; chopped: boolean }
export const TD_GOALS = ['hunt', 'mine', 'chop'] as const;

export function tdFirstGoal(f: TdGoalFacts): FirstGoalView | null {
  const order: [typeof TD_GOALS[number], boolean][] = [['hunt', f.hunted], ['mine', f.mined], ['chop', f.chopped]];
  const i = order.findIndex(([, done]) => !done);
  if (i < 0) return null;
  const id = order[i][0];
  const target = id === 'chop' ? null : { station: id === 'hunt' ? 'delve' : 'ore' };
  return { id, n: i + 1, total: order.length, key: `play.td.goal.${id}`, target };
}
