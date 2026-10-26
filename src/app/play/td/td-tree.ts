/**
 * td-tree.ts — the rules of the Skill Book (owner 2026-10-21: "spells — we need to work on spell trees or something";
 * 2026-10-26: "skill tree rework, like the image, as a book"; docs/design/skill-book.md, skills-100.md §0.2–0.3).
 *
 * Each tree is a page of rows, one skill a row, in the book's order (the level a row opens at, then the old tier and
 * column). A rank needs the row's level, and the first rank in a row needs one rank in ANY earlier row of the same
 * page (D2's "walk down the page", without dead skills); ranks run 1–20. Each row carries six marks (td-marks): one
 * point each, A2/B2 at rank 5 and A3/B3 at rank 10, in order along their branch, one star a row. The ten old passives
 * are marks now (td-marks FOLDED): they have no row, take no points of their own, and run at their row's rank.
 *
 * Each level from the second gives a skill point (shared/keeper-look/skill-points). The starting kit holds rank 1
 * free. The stored tree is never trusted: every read is clamped to the level's points, so a merge or an edited save can
 * never fight with points nobody earned.
 */
import type { KeeperSkillTree, Vocation } from '../../shared/keeper-look/keeper-look.model';
import { skillPointsEarned } from '../../shared/keeper-look/skill-points';
import { CLASS_SKILLS, MAX_RANK, SKILLS, STARTER_RANKS, TIER_LEVELS, type SkillId, type TreeId } from './td-skills';
import { FOLDED, MARKS, MARK_BIT, MARK_PREV, MARK_RANK, MARK_SLOTS, STAR_OTHER, FULL_MASK, markCount, maskHas, type MarkSlot } from './td-marks';

/** The level a row opens at. */
export function levelFor(id: SkillId): number { return SKILLS[id].level ?? TIER_LEVELS[SKILLS[id].tier] ?? 1; }

function owns(v: Vocation, id: string): id is SkillId { return (CLASS_SKILLS[v] as readonly string[]).includes(id); }
const nodesOf = (tree: KeeperSkillTree): Readonly<Record<string, number>> => tree.nodes ?? {};

/** The marks a row holds (its 6-bit mask; 0 for none or a row this class does not own). */
export function marksOf(tree: KeeperSkillTree, v: Vocation, id: SkillId): number {
  return owns(v, id) && MARKS[id] ? (nodesOf(tree)[id] ?? 0) & FULL_MASK : 0;
}
/** Every row's mask, as the fight reads it (only rows with marks taken). */
export function effectiveMarks(tree: KeeperSkillTree, v: Vocation): Partial<Record<SkillId, number>> {
  const out: Partial<Record<SkillId, number>> = {};
  for (const id of CLASS_SKILLS[v]) { const m = marksOf(tree, v, id); if (m) out[id] = m; }
  return out;
}

/** The rank a skill holds free (the starting kit, an old save's bar). A folded passive holds none. */
export function freeRank(tree: KeeperSkillTree, v: Vocation, id: SkillId): number {
  return owns(v, id) && !FOLDED[id] && (STARTER_RANKS[v].includes(id) || tree.free.includes(id)) ? 1 : 0;
}
/**
 * A skill's rank: free + bought, at most MAX_RANK. A folded passive's is its row's rank while its mark is taken (so
 * the fight's `rank('ember-mastery')` still says how strong it runs), else 0.
 */
export function rankOf(tree: KeeperSkillTree, v: Vocation, id: SkillId): number {
  const fold = FOLDED[id];
  if (fold) return owns(v, id) && maskHas(marksOf(tree, v, fold.into), fold.slot) ? rankOf(tree, v, fold.into) : 0;
  return owns(v, id) ? Math.min(MAX_RANK, freeRank(tree, v, id) + (tree.spent[id] ?? 0)) : 0;
}
/** Every class skill's rank (what the fight reads), the folded passives' included. */
export function effectiveRanks(tree: KeeperSkillTree, v: Vocation): Record<SkillId, number> {
  return Object.fromEntries(CLASS_SKILLS[v].map(id => [id, rankOf(tree, v, id)])) as Record<SkillId, number>;
}
/**
 * The ranks each skill holds above its free one (what synergies read, design-bible §4.1): the kit's free rank 1 never
 * counts, so a fresh Warlock fights exactly as before. A folded passive has bought none (a synergy reads rows, never
 * marks). Read off the clamped tree the fight uses.
 */
export function boughtRanks(tree: KeeperSkillTree, v: Vocation): Record<SkillId, number> {
  return Object.fromEntries(CLASS_SKILLS[v].map(id => [id, FOLDED[id] ? 0 : Math.max(0, rankOf(tree, v, id) - freeRank(tree, v, id))])) as Record<SkillId, number>;
}
/** Points spent: every bought rank, and one for every mark. */
export function pointsSpent(tree: KeeperSkillTree): number {
  return Object.values(tree.spent).reduce((a, n) => a + n, 0) + Object.values(nodesOf(tree)).reduce((a, m) => a + markCount(m), 0);
}
/** Points still to spend at a level. */
export function treePointsLeft(tree: KeeperSkillTree, level: number): number {
  return Math.max(0, skillPointsEarned(level) - pointsSpent(tree));
}

/** One page's rows in the book's order: the level each opens at, then the old tier and column. Folded passives have none. */
export function bookRows(v: Vocation, tree: TreeId): SkillId[] {
  return CLASS_SKILLS[v].filter(id => SKILLS[id].tree === tree && !FOLDED[id])
    .sort((a, b) => levelFor(a) - levelFor(b) || SKILLS[a].tier - SKILLS[b].tier || SKILLS[a].col - SKILLS[b].col);
}
/** One tree's rows (the book's order). Kept under its old name for the callers that lay a page out. */
export function treeSkills(v: Vocation, tree: TreeId): SkillId[] { return bookRows(v, tree); }
/**
 * Does any row above this one on its page hold a rank (the first rank's need)? The rows that open with the page (its
 * first level, level 1 for every shipped page) need none: they are the top of the page, as they were on the board.
 */
export function earlierHeld(tree: KeeperSkillTree, v: Vocation, id: SkillId): boolean {
  const rows = bookRows(v, SKILLS[id].tree), i = rows.indexOf(id);
  if (i <= 0 || levelFor(id) <= levelFor(rows[0])) return true;
  return rows.slice(0, i).some(r => rankOf(tree, v, r) > 0);
}

/** Why a rank cannot be bought now (null: it can). `req`: no rank in an earlier row yet. `folded`: a mark, not a row. */
export type RankBlock = 'class' | 'max' | 'level' | 'req' | 'points' | 'folded';
export function rankBlock(tree: KeeperSkillTree, v: Vocation, id: SkillId, level: number): RankBlock | null {
  if (!owns(v, id)) return 'class';
  if (FOLDED[id]) return 'folded';
  if (rankOf(tree, v, id) >= MAX_RANK) return 'max';
  if (Math.floor(level) < levelFor(id)) return 'level';
  if (rankOf(tree, v, id) < 1 && !earlierHeld(tree, v, id)) return 'req';
  if (treePointsLeft(tree, level) <= 0) return 'points';
  return null;
}
/** Buy one rank: the new tree, or null when the rules refuse. */
export function buyRank(tree: KeeperSkillTree, v: Vocation, id: SkillId, level: number): KeeperSkillTree | null {
  const base = clampTree(tree, v, level);
  if (rankBlock(base, v, id, level)) return null;
  return { ...base, spent: { ...base.spent, [id]: (base.spent[id] ?? 0) + 1 } };
}
/** Give one bought rank back (the book's stepper, over pending ranks): marks that rank held go with it (clampTree). */
export function dropRank(tree: KeeperSkillTree, v: Vocation, id: SkillId, level: number): KeeperSkillTree | null {
  if (!((tree.spent[id] ?? 0) > 0)) return null;
  const spent = { ...tree.spent, [id]: (tree.spent[id] ?? 0) - 1 };
  if (spent[id] <= 0) delete spent[id];
  return clampTree({ ...tree, spent }, v, level);
}

/**
 * Why a mark cannot be taken now (null: it can). `rank`: the row's rank is under the slot's need; `prev`: the mark
 * before it on its branch is not taken; `star`: the row's other star is taken.
 */
export type MarkBlock = 'class' | 'none' | 'taken' | 'rank' | 'prev' | 'star' | 'points';
export function markBlock(tree: KeeperSkillTree, v: Vocation, id: SkillId, slot: MarkSlot, level: number): MarkBlock | null {
  if (!owns(v, id)) return 'class';
  if (!MARKS[id]) return 'none';
  const mask = marksOf(tree, v, id);
  if (maskHas(mask, slot)) return 'taken';
  if (rankOf(tree, v, id) < MARK_RANK[slot]) return 'rank';
  const prev = MARK_PREV[slot];
  if (prev && !maskHas(mask, prev)) return 'prev';
  const other = STAR_OTHER[slot];
  if (other && maskHas(mask, other)) return 'star';
  if (treePointsLeft(tree, level) <= 0) return 'points';
  return null;
}
/** Take a mark: the new tree, or null when the rules refuse. */
export function buyMark(tree: KeeperSkillTree, v: Vocation, id: SkillId, slot: MarkSlot, level: number): KeeperSkillTree | null {
  const base = clampTree(tree, v, level);
  if (markBlock(base, v, id, slot, level)) return null;
  return { ...base, nodes: { ...nodesOf(base), [id]: marksOf(base, v, id) | MARK_BIT[slot] } };
}
/** Give a mark back, and every mark after it on its branch (they need it). */
export function dropMark(tree: KeeperSkillTree, v: Vocation, id: SkillId, slot: MarkSlot): KeeperSkillTree | null {
  const mask = marksOf(tree, v, id);
  if (!maskHas(mask, slot)) return null;
  let cut = MARK_BIT[slot];
  for (const s of MARK_SLOTS) { const prev = MARK_PREV[s]; if (prev && (cut & MARK_BIT[prev])) cut |= MARK_BIT[s]; }
  const nodes = { ...nodesOf(tree), [id]: mask & ~cut };
  if (!nodes[id]) delete nodes[id];
  return { ...tree, nodes };
}
/**
 * Swap the row's star (skill-book.md §3: "Swap Cinder Ward for Twin Nova? The point moves."): the other star goes and
 * this one comes, for no new point. Null when the swap is not open (the rank, the branch, the class).
 */
export function swapStar(tree: KeeperSkillTree, v: Vocation, id: SkillId, slot: MarkSlot, level: number): KeeperSkillTree | null {
  const other = STAR_OTHER[slot];
  if (!other || !maskHas(marksOf(tree, v, id), other)) return null;
  const freed = dropMark(tree, v, id, other);
  return freed ? buyMark(freed, v, id, slot, level) : null;
}

/** The free respec: every bought point and every mark back; the free ranks stay. */
export function resetTree(tree: KeeperSkillTree): KeeperSkillTree {
  return { spent: {}, free: [...tree.free], nodes: {}, book: 2, at: tree.at };
}

/**
 * The tree the fight may use at a level: points only in this class's rows (never a folded passive's: those points were
 * refunded with the book, skill-book.md §6.2), none past a row's top rank, none in a row whose level the Keeper has not
 * reached; marks only where the row's rank reaches them, in order along their
 * branch, one star a row (B3 goes when both are set); and never more than the level has earned — the deepest row's
 * marks give theirs back first (B3, B2 … then A), then the ranks, deepest first.
 */
export function clampTree(tree: KeeperSkillTree, v: Vocation, level: number): KeeperSkillTree {
  const spent: Record<string, number> = {};
  for (const [id, n] of Object.entries(tree.spent)) {
    if (!owns(v, id) || FOLDED[id] || !(n > 0) || Math.floor(level) < levelFor(id)) continue;
    const room = MAX_RANK - freeRank(tree, v, id);
    if (room > 0) spent[id] = Math.min(room, Math.floor(n));
  }
  const nodes: Record<string, number> = {};
  for (const [id, m] of Object.entries(nodesOf(tree))) if (owns(v, id) && MARKS[id] && (m & FULL_MASK)) nodes[id] = m & FULL_MASK;
  const out: KeeperSkillTree = { spent, free: [...tree.free], nodes, book: 2, at: tree.at };
  const order = CLASS_SKILLS[v].filter(id => !FOLDED[id]).sort((a, b) => levelFor(a) - levelFor(b) || SKILLS[a].tier - SKILLS[b].tier || SKILLS[a].col - SKILLS[b].col);

  const settle = () => {
    // The "one rank above it" need is the book's buying rule (rankBlock), never a clamp: a save from the tree board
    // whose Bone Armor stood on the old free Soul Harvest keeps every rank (skill-book.md §6.2: no rank is lost).
    // Marks: the rank they need, the branch in order, one star.
    for (const id of Object.keys(nodes) as SkillId[]) {
      let m = nodes[id];
      const rank = rankOf(out, v, id);
      for (const s of MARK_SLOTS) {
        if (!(m & MARK_BIT[s])) continue;
        const prev = MARK_PREV[s];
        if (rank < MARK_RANK[s] || (prev && !(m & MARK_BIT[prev]))) m &= ~MARK_BIT[s];
      }
      if ((m & MARK_BIT.a3) && (m & MARK_BIT.b3)) m &= ~MARK_BIT.b3;
      if (m) nodes[id] = m; else delete nodes[id];
    }
  };
  settle();
  const earned = skillPointsEarned(level);
  while (pointsSpent(out) > earned) {
    // Marks first: the deepest row's, its last slot first (B3, B2, B1, A3, A2, A1).
    const deep = [...order].reverse().find(id => nodes[id]);
    if (deep) {
      const slot = [...MARK_SLOTS].reverse().find(s => nodes[deep] & MARK_BIT[s])!;
      nodes[deep] &= ~MARK_BIT[slot];
      if (!nodes[deep]) delete nodes[deep];
    } else {
      const deepest = Object.keys(spent).sort((a, b) => SKILLS[b as SkillId].tier - SKILLS[a as SkillId].tier || spent[b] - spent[a])[0];
      if (!deepest) break;
      if (--spent[deepest] <= 0) delete spent[deepest];
    }
    settle();
  }
  return out;
}
