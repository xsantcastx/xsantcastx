/**
 * keeper-milestones.ts — what the big levels give (docs/design/leveling.md §3).
 *
 * Every milestone hands over something real, and every reward has a use the player can see:
 *   title        a name worn under the Keeper's on the portrait, picked in the character sheet (C)
 *   skillPoints  bonus Spellbook points (skill-points.ts MILESTONE_SKILL_POINTS; spent in the Warlock skill tree)
 *   points       a batch of attribute points for the sheet
 *   passive      a small lasting edge (+1% spell damage, speed, crits, cast speed; All Resist) — the sheet's totals
 *   frame        the portrait's frame metal (copper → bronze → silver → gold → eclipse → starlit)
 *   gold         a fixed sum, paid once (receipt first: keeper-level.service): worth N minutes of a hunt at that level
 *                (economy-curve huntGold), since the forge no longer pays by the second (IDLE_INCOME off)
 *   gear         a piece minted once under a fixed id (the town tasks' path)
 *
 * Everything but Gold and gear is DERIVED from the level, so it can never be granted twice; Gold and gear are the
 * only one-time grants and go through the receipt (keeper-milestones-save.model.ts).
 *
 * Pure. Type-only import of the item stats.
 */
import type { ItemStats } from '../rpg/item.model';
import { MILESTONE_SKILL_POINTS } from '../keeper-look/skill-points';
import { LEVEL_GROWTH, levelAttributePoints, levelSteps } from './keeper-level';
import { huntGold } from '../economy/economy-curve';

/** A milestone's Gold: `minutes` of a steady hunt of creatures at its own level, as a fixed sum. */
const hunt = (level: number, minutes: number): number => huntGold(level, minutes * 60);

export type PassiveStat = Extract<keyof ItemStats, 'spellDamage' | 'moveSpeed' | 'critChance' | 'castSpeed' | 'allResist'>;
export type FrameId = 'copper' | 'bronze' | 'silver' | 'gold' | 'eclipse' | 'starlit';

export interface MilestoneRewards {
  /** i18n `play.lvl.title.<id>`. */
  title?: string;
  skillPoints?: number;
  points?: number;
  passive?: { stat: PassiveStat; n: number };
  frame?: FrameId;
  /** Fixed Gold, paid once. */
  gold?: number;
  gear?: { defId: string; rarity: 'uncommon' | 'rare' | 'epic'; level: number };
}

export interface Milestone {
  level: number;
  /** 50, 100, 1,000, 5,000 and 10,000: the banner's bigger treatment. */
  big?: true;
  rewards: MilestoneRewards;
}

const m = (level: number, rewards: MilestoneRewards, big?: true): Milestone => {
  const sp = MILESTONE_SKILL_POINTS[level];
  return { level, ...(big ? { big } : {}), rewards: sp ? { ...rewards, skillPoints: sp } : rewards };
};

export const MILESTONES: readonly Milestone[] = [
  m(5, { title: 'kindled', gold: hunt(5, 3) }),
  m(10, { frame: 'copper', gear: { defId: 'keepers-cowl', rarity: 'uncommon', level: 10 } }),
  m(15, { title: 'ashwalker', passive: { stat: 'spellDamage', n: 1 } }),
  m(20, { points: 5, gold: hunt(20, 10) }),
  m(25, { title: 'reachwarden', passive: { stat: 'moveSpeed', n: 1 } }),
  m(30, { frame: 'bronze', gear: { defId: 'keeper-staff', rarity: 'rare', level: 30 } }),
  m(40, { title: 'wildstrider', passive: { stat: 'critChance', n: 1 }, gold: hunt(40, 15) }),
  m(50, { title: 'eclipsekeeper', frame: 'silver', points: 10, gold: hunt(50, 30), gear: { defId: 'infernal-cuirass', rarity: 'epic', level: 50 } }, true),
  m(75, { title: 'marchlord', points: 5, passive: { stat: 'castSpeed', n: 1 } }),
  m(100, { title: 'hundredfold', frame: 'gold', points: 10, passive: { stat: 'allResist', n: 2 }, gold: hunt(100, 60) }, true),
  m(200, { passive: { stat: 'spellDamage', n: 1 } }),
  m(300, { title: 'emberbound', points: 5 }),
  m(400, { passive: { stat: 'moveSpeed', n: 1 } }),
  m(500, { title: 'lanternbearer', points: 5, gold: hunt(500, 90) }),
  m(600, { passive: { stat: 'spellDamage', n: 1 } }),
  m(700, { points: 5 }),
  m(800, { passive: { stat: 'critChance', n: 1 } }),
  m(900, { points: 5 }),
  m(1000, { title: 'thousandfold', frame: 'eclipse', points: 20, passive: { stat: 'allResist', n: 3 }, gold: hunt(1000, 120) }, true),
  m(1500, { passive: { stat: 'spellDamage', n: 1 } }),
  m(2000, { title: 'starwright', points: 10 }),
  m(2500, { passive: { stat: 'castSpeed', n: 1 } }),
  m(3000, { points: 10 }),
  m(3500, { passive: { stat: 'spellDamage', n: 1 } }),
  m(4000, { points: 10 }),
  m(4500, { passive: { stat: 'critChance', n: 1 } }),
  m(5000, { title: 'eclipsewalker', points: 20, gold: hunt(5000, 240) }, true),
  m(10000, { title: 'longnight', frame: 'starlit', points: 50, passive: { stat: 'spellDamage', n: 5 }, gold: hunt(10000, 480) }, true),
];

const BY_LEVEL = new Map(MILESTONES.map(x => [x.level, x]));
const lv = (level: number) => (Number.isFinite(level) ? Math.floor(level) : 1);

export function milestoneAt(level: number): Milestone | undefined { return BY_LEVEL.get(level); }
/** The first milestone above `level`, or null past the last. */
export function nextMilestone(level: number): Milestone | null { return MILESTONES.find(x => x.level > lv(level)) ?? null; }
/** Milestones crossed going from `before` to `after` (before < level ≤ after). */
export function milestonesBetween(before: number, after: number): Milestone[] {
  return MILESTONES.filter(x => x.level > lv(before) && x.level <= lv(after));
}
/** Every milestone reached at `level`. */
export function milestonesReached(level: number): Milestone[] { return MILESTONES.filter(x => x.level <= lv(level)); }

/** Attribute points the milestones have added by `level`. */
export function milestoneAttributePoints(level: number): number {
  return milestonesReached(level).reduce((n, x) => n + (x.rewards.points ?? 0), 0);
}
/** Every attribute point a Keeper of `level` has to spend: the level's own plus the milestones' batches. */
export function keeperAttributePoints(level: number): number { return levelAttributePoints(level) + milestoneAttributePoints(level); }

/** The milestones' passives at `level`, as worn-stat bonuses (the fight adds them to the gear's totals). */
export function passiveBonus(level: number): Partial<Record<PassiveStat, number>> {
  const out: Partial<Record<PassiveStat, number>> = {};
  for (const x of milestonesReached(level)) { const p = x.rewards.passive; if (p) out[p.stat] = (out[p.stat] ?? 0) + p.n; }
  return out;
}
/** Titles earned by `level`, earliest first. */
export function titlesEarned(level: number): string[] {
  return milestonesReached(level).flatMap(x => (x.rewards.title ? [x.rewards.title] : []));
}
/** The portrait's frame at `level` (the latest earned), or null before 10. */
export function frameFor(level: number): FrameId | null {
  return milestonesReached(level).reduce<FrameId | null>((f, x) => x.rewards.frame ?? f, null);
}

/** What a level-up gave: the banner's lines. */
export interface LevelUpSummary {
  from: number;
  level: number;
  life: number;
  mana: number;
  /** Spell power gained, in whole percent (rounded; at least shown as 0). */
  power: number;
  points: number;
  skillPoints: number;
  milestones: Milestone[];
}

/** Everything going from level `from` to `to` gave (a multi-level jump sums every level and milestone crossed). */
export function levelUpSummary(from: number, to: number): LevelUpSummary {
  const a = Math.max(1, lv(from)), b = Math.max(a, lv(to));
  const steps = levelSteps(b) - levelSteps(a);
  const crossed = milestonesBetween(a, b);
  const sp = crossed.reduce((n, x) => n + (x.rewards.skillPoints ?? 0), 0);
  return {
    from: a,
    level: b,
    life: Math.round(steps * LEVEL_GROWTH.life),
    mana: Math.round(steps * LEVEL_GROWTH.mana),
    power: Math.round(steps * LEVEL_GROWTH.power * 100),
    points: keeperAttributePoints(b) - keeperAttributePoints(a),
    skillPoints: (b - a) + sp,
    milestones: crossed,
  };
}
