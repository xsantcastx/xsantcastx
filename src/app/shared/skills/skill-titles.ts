/**
 * skill-titles.ts — what a level past 99 is *for*.
 *
 * Levels are uncapped (Tibia-style, mining-level.ts). Nothing in the game
 * needs a level above 99 to work, so the climb past mastery pays in standing:
 * the first level past mastery and every 25 after it earn a title (100, 125,
 * ... 275 — eight per skill, in the realm's own words), and every 25 from 300
 * adds +1 to the last one ("Eclipse Hewer +2" at 325), forever. The skills panel shows a skill's title
 * under its name, Character → Stats lists them all, and the Keeper may wear
 * one beside their rank (the name-tag flourish, a device preference). Each
 * one lands with the level-up banner's milestone treatment.
 *
 * Pure data, no Angular. The words are in skill-titles.i18n.ts (lazy).
 */
import { MASTERY_LEVEL } from '../activity/mining-level';
import type { SkillId } from './skill.model';

/** A title every this many levels past mastery. */
export const TITLE_STEP = 25;
/** Authored titles per skill (100 ... 275). Past the last, stars. */
export const TITLE_RANKS = 8;
/** The level of the first title: the first level past mastery (100). */
export const FIRST_TITLE_LEVEL = MASTERY_LEVEL + 1;

export interface SkillTitle {
  skill: SkillId;
  /** 1 at 100 ... 8 at 275, 9+ past it (the stars). */
  rank: number;
  /** i18n key of the title's words (the last authored one for a starred rank). */
  key: string;
  /** Stars on the last title: 0 up to 299, 1 at 300, 2 at 325, ... */
  stars: number;
  /** The level it is earned at. */
  level: number;
}

/** The rank a level has earned: 0 below 100, 1 at 100, 2 at 125, 8 at 275, 9 at 300. */
export function titleRank(level: number): number {
  if (!Number.isFinite(level) || level < FIRST_TITLE_LEVEL) return 0;
  return Math.floor((Math.floor(level) - FIRST_TITLE_LEVEL) / TITLE_STEP) + 1;
}

/** The level a rank is earned at (rank >= 1). */
export function titleLevel(rank: number): number {
  return FIRST_TITLE_LEVEL + (Math.max(1, Math.floor(rank)) - 1) * TITLE_STEP;
}

/** A skill's title at a given rank (rank >= 1). */
export function titleAt(skill: SkillId, rank: number): SkillTitle {
  const r = Math.max(1, Math.floor(rank));
  return {
    skill,
    rank: r,
    key: `skills.title.${skill}.${Math.min(TITLE_RANKS, r)}`,
    stars: Math.max(0, r - TITLE_RANKS),
    level: titleLevel(r),
  };
}

/** The title a skill level has earned, or null below 100. */
export function titleFor(skill: SkillId, level: number): SkillTitle | null {
  const rank = titleRank(level);
  return rank > 0 ? titleAt(skill, rank) : null;
}

/** The title-bearing levels crossed going from `before` to `after` (exclusive, inclusive). */
export function titlesBetween(skill: SkillId, before: number, after: number): SkillTitle[] {
  const out: SkillTitle[] = [];
  for (let r = titleRank(before) + 1; r <= titleRank(after); r++) out.push(titleAt(skill, r));
  return out;
}

/** The title's words, translated: "Seam-Sage", or "Eclipse Hewer +2" from 300. */
export function titleText(title: SkillTitle, t: (key: string, vars?: Record<string, string | number>) => string): string {
  const name = t(title.key);
  return title.stars ? t('skills.title.starred', { title: name, n: title.stars }) : name;
}
