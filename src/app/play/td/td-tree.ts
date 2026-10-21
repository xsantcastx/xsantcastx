/**
 * td-tree.ts — the rules of the Warlock's skill trees (owner 2026-10-21: "spells — we need to work on spell trees or
 * something"; docs/design/skill-trees.md).
 *
 * D2's rules: a skill needs its tier's level and one rank in the skill above it; ranks run 1–20; each level from the
 * second gives a skill point (shared/keeper-look/skill-points). The starting kit holds rank 1 free, and a save from
 * before the trees holds rank 1 free in whatever sat on its bar (keeper-look.model coerceTree). The stored tree is
 * never trusted: every read is clamped to the level's points, so a merge or an edited save can never fight with
 * points nobody earned.
 */
import type { KeeperSkillTree, Vocation } from '../../shared/keeper-look/keeper-look.model';
import { skillPointsEarned } from '../../shared/keeper-look/skill-points';
import { CLASS_SKILLS, MAX_RANK, SKILLS, STARTER_RANKS, TIER_LEVELS, type SkillId, type TreeId } from './td-skills';

/** The level a skill's tier opens at. */
export function levelFor(id: SkillId): number { return SKILLS[id].level ?? TIER_LEVELS[SKILLS[id].tier] ?? 1; }

function owns(v: Vocation, id: string): id is SkillId { return (CLASS_SKILLS[v] as readonly string[]).includes(id); }

/** The rank a skill holds free (the starting kit, an old save's bar). */
export function freeRank(tree: KeeperSkillTree, v: Vocation, id: SkillId): number {
  return owns(v, id) && (STARTER_RANKS[v].includes(id) || tree.free.includes(id)) ? 1 : 0;
}
/** A skill's rank: free + bought, at most MAX_RANK. */
export function rankOf(tree: KeeperSkillTree, v: Vocation, id: SkillId): number {
  return owns(v, id) ? Math.min(MAX_RANK, freeRank(tree, v, id) + (tree.spent[id] ?? 0)) : 0;
}
/** Every class skill's rank (what the fight reads). */
export function effectiveRanks(tree: KeeperSkillTree, v: Vocation): Record<SkillId, number> {
  return Object.fromEntries(CLASS_SKILLS[v].map(id => [id, rankOf(tree, v, id)])) as Record<SkillId, number>;
}
/**
 * The ranks each skill holds above its free one (what synergies read, design-bible §4.1): the kit's free rank 1 never
 * counts, so a fresh Warlock fights exactly as before. Read off the clamped tree the fight uses.
 */
export function boughtRanks(tree: KeeperSkillTree, v: Vocation): Record<SkillId, number> {
  return Object.fromEntries(CLASS_SKILLS[v].map(id => [id, Math.max(0, rankOf(tree, v, id) - freeRank(tree, v, id))])) as Record<SkillId, number>;
}
export function pointsSpent(tree: KeeperSkillTree): number {
  return Object.values(tree.spent).reduce((a, n) => a + n, 0);
}
/** Points still to spend at a level. */
export function treePointsLeft(tree: KeeperSkillTree, level: number): number {
  return Math.max(0, skillPointsEarned(level) - pointsSpent(tree));
}

/** Why a rank cannot be bought now (null: it can). */
export type RankBlock = 'class' | 'max' | 'level' | 'req' | 'points';
export function rankBlock(tree: KeeperSkillTree, v: Vocation, id: SkillId, level: number): RankBlock | null {
  if (!owns(v, id)) return 'class';
  if (rankOf(tree, v, id) >= MAX_RANK) return 'max';
  if (Math.floor(level) < levelFor(id)) return 'level';
  const req = SKILLS[id].req;
  if (req && rankOf(tree, v, req) < 1) return 'req';
  if (treePointsLeft(tree, level) <= 0) return 'points';
  return null;
}
/** Buy one rank: the new tree, or null when the rules refuse. */
export function buyRank(tree: KeeperSkillTree, v: Vocation, id: SkillId, level: number): KeeperSkillTree | null {
  const base = clampTree(tree, v, level);
  if (rankBlock(base, v, id, level)) return null;
  return { ...base, spent: { ...base.spent, [id]: (base.spent[id] ?? 0) + 1 } };
}
/** The free respec: every bought point back; the free ranks stay. */
export function resetTree(tree: KeeperSkillTree): KeeperSkillTree {
  return { spent: {}, free: [...tree.free], at: tree.at };
}

/**
 * The tree the fight may use at a level: points only in this class's skills, none past a skill's top rank, none in a
 * skill whose tier the level has not reached or whose prerequisite holds no rank, and never more than the level has
 * earned (the deepest tiers give theirs back first).
 */
export function clampTree(tree: KeeperSkillTree, v: Vocation, level: number): KeeperSkillTree {
  const spent: Record<string, number> = {};
  for (const [id, n] of Object.entries(tree.spent)) {
    if (!owns(v, id) || !(n > 0) || Math.floor(level) < levelFor(id)) continue;
    const room = MAX_RANK - freeRank(tree, v, id);
    if (room > 0) spent[id] = Math.min(room, Math.floor(n));
  }
  const out: KeeperSkillTree = { spent, free: [...tree.free], at: tree.at };
  const dropOrphans = () => {
    // Prerequisites always sit in a shallower tier, so one pass from the top settles it.
    for (const id of [...CLASS_SKILLS[v]].sort((a, b) => SKILLS[a].tier - SKILLS[b].tier)) {
      const req = SKILLS[id].req;
      if (spent[id] && req && rankOf(out, v, req) < 1) delete spent[id];
    }
  };
  dropOrphans();
  const earned = skillPointsEarned(level);
  while (pointsSpent(out) > earned) {
    const deepest = Object.keys(spent).sort((a, b) => SKILLS[b as SkillId].tier - SKILLS[a as SkillId].tier || spent[b] - spent[a])[0];
    if (!deepest) break;
    if (--spent[deepest] <= 0) delete spent[deepest];
    dropOrphans();
  }
  return out;
}

/** One tree's skills, as the page lays them out (tier by tier, column by column). */
export function treeSkills(v: Vocation, tree: TreeId): SkillId[] {
  return CLASS_SKILLS[v].filter(id => SKILLS[id].tree === tree).sort((a, b) => SKILLS[a].tier - SKILLS[b].tier || SKILLS[a].col - SKILLS[b].col);
}
