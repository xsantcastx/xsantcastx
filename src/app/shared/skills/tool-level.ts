/**
 * tool-level.ts — the gathering skill's share of a tool's swing and power.
 *
 * On top of the tool's tier, the skill that wields it (TOOL_SKILL) sharpens
 * it: level 1 adds nothing, level 99 swings 25% faster and hits 50% harder,
 * linearly in between. Rewards do not grow with it — the Delve still books one
 * paid op per seam breath and a node still pays once per regrowth — so a
 * higher level opens rock in fewer swings, not more XP per minute.
 *
 * Tiny and pure on purpose: the app-shell level-up banner reads it.
 */
import type { SkillId } from './skill.model';
import type { ToolFamily } from './tool-items';

/** Which skill wields (and sharpens) which family. */
export const TOOL_SKILL: Readonly<Record<ToolFamily, SkillId>> = {
  pickaxe: 'mining',
  axe: 'woodcutting',
  sickle: 'foraging',
  staff: 'enchanting',
};

/** At level 99: this much less time per swing, this much more power per hit. */
export const LEVEL_SWING_BONUS = 0.25;
export const LEVEL_POWER_BONUS = 0.5;
const MAX_LEVEL = 99;

/** 0 at level 1, 1 at level 99. */
function levelShare(level: number): number {
  const lvl = Number.isFinite(level) ? Math.min(MAX_LEVEL, Math.max(1, Math.floor(level))) : 1;
  return (lvl - 1) / (MAX_LEVEL - 1);
}

/** Multiply a tier's seconds-per-swing by this: 1 at level 1, 0.75 at 99. */
export function levelSwingFactor(level: number): number { return 1 - LEVEL_SWING_BONUS * levelShare(level); }
/** Multiply a tier's power by this: 1 at level 1, 1.5 at 99. */
export function levelPowerFactor(level: number): number { return 1 + LEVEL_POWER_BONUS * levelShare(level); }

/** The level's bonus in whole-ish percent, as the cards print it ("10", "21"). */
export function levelSwingPct(level: number): number { return Math.round(LEVEL_SWING_BONUS * levelShare(level) * 100); }
export function levelPowerPct(level: number): number { return Math.round(LEVEL_POWER_BONUS * levelShare(level) * 100); }

/** True when this skill sharpens a tool (Mining, Woodcutting, Foraging, Enchanting). */
export function sharpensTool(skill: SkillId): boolean { return Object.values(TOOL_SKILL).includes(skill); }

/** The staff works by its blast, whose cooldown is fixed: Enchanting sharpens its power only. */
export function sharpensSwing(skill: SkillId): boolean { return sharpensTool(skill) && skill !== TOOL_SKILL.staff; }

/**
 * What a level crossing added, as percentage points of the tier's base, one
 * decimal ("0.3", "0.5"): the level-up banner's tool line.
 */
export function levelGain(before: number, after: number): { swing: string | null; power: string } {
  const share = levelShare(after) - levelShare(before);
  return { swing: (LEVEL_SWING_BONUS * share * 100).toFixed(1), power: (LEVEL_POWER_BONUS * share * 100).toFixed(1) };
}
