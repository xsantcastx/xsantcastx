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
import { skillDef, skillForDiscipline, type SkillId } from '../skills/skill.model';
import { describeUnlock, unlocksBetween, type UnlockWords } from '../skills/skill-unlocks';
import { titlesBetween } from '../skills/skill-titles';
import { levelGain, sharpensSwing, sharpensTool } from '../skills/tool-level';

export interface LevelUpEvent {
  /** i18n key for the skill's display name, e.g. 'work.discipline.mining'. */
  skillLabelKey: string;
  level: number;
  /** Every tenth level, and every title past 99, gets the bigger treatment — see level-up-banner. */
  milestone: boolean;
  art: ArtEntry | null;
  /**
   * What the crossing opened (skill-unlocks), as i18n key + vars for the
   * banner to translate. Empty for a level that opened nothing new.
   */
  unlocks: ReadonlyArray<UnlockWords>;
  /**
   * Past 99: the title this crossing earned (skill-titles.ts) — its i18n key
   * and stars, for the banner's "Title earned" line. Null otherwise.
   */
  title: { key: string; stars: number } | null;
  /**
   * For a skill that sharpens a tool (tool-level.ts): how much faster and
   * harder it now swings, in percentage points ("0.3", "0.5"); `swing` null
   * for Enchanting (the staff's blast keeps its cooldown). Null otherwise.
   */
  tool: { swing: string | null; power: string } | null;
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

  /** A2 Foraging's twin. Same contract: one resolved gather's before/after. */
  checkForaging(beforeXp: number, afterXp: number): void {
    this.check('foraging', beforeXp, afterXp);
  }

  /** B1 Prospecting's. Same contract again — one resolved survey. */
  checkProspecting(beforeXp: number, afterXp: number): void {
    this.check('prospecting', beforeXp, afterXp);
  }

  /**
   * By ledger discipline. Every discipline now maps to a player-facing skill
   * (forge → Smithing, exploration → Delving), so all eight announce.
   */
  check(discipline: DisciplineId, beforeXp: number, afterXp: number): void {
    const skill = skillForDiscipline(discipline);
    if (skill) this.checkSkill(skill.id, beforeXp, afterXp);
  }

  /**
   * By skill. The totals must be the *skill's* totals — for Smithing that
   * includes the bench's XP (see the skills module's skillXp), which is why
   * SkillActionService, not the raw gateway result, is the usual caller.
   */
  checkSkill(skill: SkillId, beforeXp: number, afterXp: number): void {
    if (!(afterXp > beforeXp)) return;
    const before = miningLevelView(beforeXp).level;
    const after = miningLevelView(afterXp).level;
    if (after <= before) return;

    // A multi-level jump announces once, at the level actually reached, but
    // still names everything every skipped level opened.
    const def = skillDef(skill);
    const earned = titlesBetween(skill, before, after).at(-1) ?? null;
    const tool = sharpensTool(skill) ? { ...levelGain(before, after), ...(sharpensSwing(skill) ? {} : { swing: null }) } : null;
    this.events$$.next({
      skillLabelKey: def.labelKey,
      level: after,
      milestone: after % 10 === 0 || !!earned,
      art: artFor(def.artId),
      unlocks: unlocksBetween(skill, before, after).map(describeUnlock),
      // Far past 99 a single level's sharpening rounds to nothing: no line rather than "0.00%".
      tool: tool && Number(tool.power) > 0 ? tool : null,
      title: earned ? { key: earned.key, stars: earned.stars } : null,
    });
  }
}
