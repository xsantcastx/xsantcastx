/**
 * tool-level.ts — the gathering skill's share of a tool's swing and power.
 *
 * On top of the tool's tier, the skill that wields it (TOOL_SKILL) sharpens
 * it: level 1 adds nothing, level 99 swings 25% faster and hits 50% harder,
 * linearly in between. Past 99 (levels are uncapped) it keeps sharpening with
 * diminishing returns toward an asymptote it never reaches: up to 10 more
 * points of swing (35% in all) and 50 more of power (x2.0 in all), half of
 * that by level 199. The 0.25 s swing floor (tools.ts, the engine) still holds. Rewards do not grow with it — the Delve still books one
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
/** Past 99, approached and never reached: this much more swing and power on top. */
export const BEYOND_SWING_BONUS = 0.10;
export const BEYOND_POWER_BONUS = 0.5;
/** Levels past 99 at which half of the "beyond" bonus is earned (level 199). */
export const BEYOND_HALF_LEVELS = 100;
const MASTERY = 99;

/** 0 at level 1, 1 at level 99 (and 1 above it). */
function levelShare(level: number): number {
  const lvl = Number.isFinite(level) ? Math.min(MASTERY, Math.max(1, Math.floor(level))) : 1;
  return (lvl - 1) / (MASTERY - 1);
}

/** 0 up to level 99, then n / (n + 100) for n levels past it: 0.5 at 199, 0.67 at 299, -> 1. */
export function beyondShare(level: number): number {
  if (!Number.isFinite(level)) return 0;
  const n = Math.max(0, Math.floor(level) - MASTERY);
  return n / (n + BEYOND_HALF_LEVELS);
}

function swingCut(level: number): number { return LEVEL_SWING_BONUS * levelShare(level) + BEYOND_SWING_BONUS * beyondShare(level); }
function powerAdd(level: number): number { return LEVEL_POWER_BONUS * levelShare(level) + BEYOND_POWER_BONUS * beyondShare(level); }

/** The most a level can ever multiply power by (the engine clamps to it): x2.0. */
export const MAX_LEVEL_POWER = 1 + LEVEL_POWER_BONUS + BEYOND_POWER_BONUS;

/** Multiply a tier's seconds-per-swing by this: 1 at level 1, 0.75 at 99, 0.70 at 199, -> 0.65. */
export function levelSwingFactor(level: number): number { return 1 - swingCut(level); }
/** Multiply a tier's power by this: 1 at level 1, 1.5 at 99, 1.75 at 199, -> 2.0. */
export function levelPowerFactor(level: number): number { return 1 + powerAdd(level); }

/** The level's bonus in whole-ish percent, as the cards print it ("10", "21"). */
export function levelSwingPct(level: number): number { return Math.round(swingCut(level) * 100); }
export function levelPowerPct(level: number): number { return Math.round(powerAdd(level) * 100); }

/** True when this skill sharpens a tool (Mining, Woodcutting, Foraging, Enchanting). */
export function sharpensTool(skill: SkillId): boolean { return Object.values(TOOL_SKILL).includes(skill); }

/** The staff works by its blast, whose cooldown is fixed: Enchanting sharpens its power only. */
export function sharpensSwing(skill: SkillId): boolean { return sharpensTool(skill) && skill !== TOOL_SKILL.staff; }

/**
 * What a level crossing added, as percentage points of the tier's base, one
 * decimal ("0.3", "0.5"; two decimals under 0.1): the level-up banner's tool line.
 */
export function levelGain(before: number, after: number): { swing: string | null; power: string } {
  // Past ~300 a single level adds under a tenth of a point: two decimals, so the line never reads "0.0%".
  const pts = (n: number): string => n.toFixed(n > 0 && n < 0.1 ? 2 : 1);
  return { swing: pts((swingCut(after) - swingCut(before)) * 100), power: pts((powerAdd(after) - powerAdd(before)) * 100) };
}
