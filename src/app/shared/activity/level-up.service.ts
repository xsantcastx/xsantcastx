/**
 * level-up.service.ts — the event a skill level crossing fires.
 *
 * Mining's XP curve now lands five level-ups in the first hour and the skill
 * bar just... refills. That is the gap the vision doc calls out: MapleStory
 * and Diablo 2 both treat a level-up as a moment the player looks up from the
 * numbers, and right now there is no moment at all — just a percentage
 * changing colour under a bar nobody was staring at.
 *
 * Per-skill entry points rather than a generic "skill" abstraction. The
 * progression spec is explicit that a second skill should copy the first's
 * shape rather than force an abstraction neither has earned yet. A2 Foraging
 * did exactly that: `checkForaging` sits beside `checkMining`, both hand the
 * same before/after pair to one private `announce`, and the day a third skill
 * arrives decides whether that private helper deserves to become public.
 *
 * B1 Prospecting is that third skill, and the answer is yes: `check` is now
 * public and reads the label key and the mark from SKILL_BANNER, the same
 * per-discipline table the Current Work tile and the skill panel read. The two
 * named methods stay as thin wrappers — every existing call site keeps working
 * and reads better at the page than `check('mining', …)` would.
 */
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { miningLevelView } from './mining-level';
import { artFor, type ArtEntry } from '../art/art';
import type { DisciplineId } from './activity.model';

/**
 * What a level-up banner shows for each live discipline: the i18n key for the
 * skill's name, and the manifest id of the thing the skill produces every
 * action — Mining wears its ore, Foraging its herb, Prospecting its alloy.
 */
const SKILL_BANNER: Partial<Record<DisciplineId, { labelKey: string; artId: string }>> = {
  mining: { labelKey: 'work.discipline.mining', artId: 'cinder-ore' },
  foraging: { labelKey: 'work.discipline.foraging', artId: 'starlight-herb' },
  prospecting: { labelKey: 'work.discipline.prospecting', artId: 'celestial-alloy' },
};

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
    this.check('mining', beforeXp, afterXp);
  }

  /**
   * A2 Foraging's twin. Same contract: the foraging XP total immediately
   * before and after one resolved gather (`RootglassCanopyComponent.gather()`),
   * never a save's history. Wears the herb every gather produces.
   */
  checkForaging(beforeXp: number, afterXp: number): void {
    this.check('foraging', beforeXp, afterXp);
  }

  /**
   * B1 Prospecting's. Same contract again — the prospecting XP total from
   * immediately before and after one resolved survey
   * (`MeridianOrreryComponent.prospect()`).
   */
  checkProspecting(beforeXp: number, afterXp: number): void {
    this.check('prospecting', beforeXp, afterXp);
  }

  /**
   * The generic entry point the file's own header deferred to the third skill.
   * A discipline with no banner row (exploration, forge, hunting — not live)
   * is silently ignored rather than announcing a nameless level.
   */
  check(discipline: DisciplineId, beforeXp: number, afterXp: number): void {
    const row = SKILL_BANNER[discipline];
    if (!row) return;
    this.announce(row.labelKey, row.artId, beforeXp, afterXp);
  }

  private announce(skillLabelKey: string, artId: string, beforeXp: number, afterXp: number): void {
    if (!(afterXp > beforeXp)) return;
    const before = miningLevelView(beforeXp).level;
    const after = miningLevelView(afterXp).level;
    if (after <= before) return;

    // A single action grants single-digit XP against curve deltas in the
    // hundreds or thousands (see mining-level.ts), so crossing more than one
    // level in one action cannot happen today. If a future bulk-grant path
    // ever changes that, this still announces the level actually reached
    // rather than queuing one banner per level skipped.
    this.events$$.next({
      skillLabelKey,
      level: after,
      milestone: after % 10 === 0,
      art: artFor(artId),
    });
  }
}
