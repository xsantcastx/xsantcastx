/**
 * level-up.service.ts — the event a skill level crossing fires.
 *
 * Mining's XP curve now lands five level-ups in the first hour and the skill
 * bar just... refills. That is the gap the vision doc calls out: MapleStory
 * and Diablo 2 both treat a level-up as a moment the player looks up from the
 * numbers, and right now there is no moment at all — just a percentage
 * changing colour under a bar nobody was staring at.
 *
 * Mining-specific rather than a generic "skill" abstraction. Only one skill
 * exists; the progression spec is explicit that a second skill should copy
 * this shape rather than force an abstraction neither skill has earned yet.
 * When Foraging (or anything else) ships, add `checkForaging` beside
 * `checkMining` and let the day a third skill arrives decide what, if
 * anything, the two have enough in common to share.
 */
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { miningLevelView } from './mining-level';
import { artFor, type ArtEntry } from '../art/art';

export interface LevelUpEvent {
  /** i18n key for the skill's display name, e.g. 'work.discipline.mining'. */
  skillLabelKey: string;
  level: number;
  /** Every tenth level gets the bigger treatment — see level-up-banner. */
  milestone: boolean;
  art: ArtEntry | null;
}

@Injectable({ providedIn: 'root' })
export class LevelUpService {
  private readonly events$$ = new Subject<LevelUpEvent>();
  readonly events$ = this.events$$.asObservable();

  /**
   * Call with the mining XP total from immediately before and immediately
   * after a single mine resolves. Deliberately *not* wired to `snapshot$`:
   * that observable's first emission on a page load is the loaded save, and a
   * returning level-30 Keeper opening the site is not a 29-level-up moment.
   * Hanging this off the one call site that actually grants mining XP
   * (`BasaltSeamworksComponent.mine()`) means it can only ever fire for XP
   * earned in the session that is looking at it.
   */
  checkMining(beforeXp: number, afterXp: number): void {
    if (!(afterXp > beforeXp)) return;
    const before = miningLevelView(beforeXp).level;
    const after = miningLevelView(afterXp).level;
    if (after <= before) return;

    // A single mine action grants single-digit XP against curve deltas in the
    // hundreds or thousands (see mining-level.ts), so crossing more than one
    // level in one action cannot happen today. If a future bulk-grant path
    // ever changes that, this still announces the level actually reached
    // rather than queuing one banner per level skipped.
    this.events$$.next({
      skillLabelKey: 'work.discipline.mining',
      level: after,
      milestone: after % 10 === 0,
      art: artFor('cinder-ore'),
    });
  }
}
