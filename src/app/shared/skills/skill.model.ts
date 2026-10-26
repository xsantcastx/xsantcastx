/**
 * skill.model.ts — the eight skills a player sees, and how each maps onto the
 * activity ledger's discipline ids.
 *
 * The ledger already stores XP per `DisciplineId`, and two of those ids
 * predate their player-facing names: Smithing is stored as `forge` and Delving
 * as `exploration`. Renaming the stored ids would orphan every save's XP, so
 * the rename happens here, at the display edge, and nowhere else.
 *
 * One curve for all eight (the shared skill curve, 1-99). Pure data, no
 * Angular — the engine harness and the specs both load it under node.
 */
import type { DisciplineId, DisciplineProgress } from '../activity/activity.model';
import { miningLevelView, type MiningLevelView } from '../activity/mining-level';

export type SkillId =
  | 'mining'
  | 'foraging'
  | 'woodcutting'
  | 'smithing'
  | 'delving'
  | 'enchanting'
  | 'hunting'
  | 'prospecting'
  | 'fishing'
  | 'firemaking'
  | 'cooking';

export interface SkillDef {
  id: SkillId;
  /** Where the XP is stored. Never changes for a shipped skill. */
  discipline: DisciplineId;
  /** i18n key for the skill's name. */
  labelKey: string;
  /** i18n key for the one-line "how to train" hint. */
  hintKey: string;
  /** Manifest id for the card's mark. */
  artId: string;
}

export const SKILLS: readonly SkillDef[] = [
  { id: 'mining', discipline: 'mining', labelKey: 'work.discipline.mining', hintKey: 'skills.hint.mining', artId: 'cinder-ore' },
  { id: 'foraging', discipline: 'foraging', labelKey: 'work.discipline.foraging', hintKey: 'skills.hint.foraging', artId: 'starlight-herb' },
  { id: 'woodcutting', discipline: 'woodcutting', labelKey: 'skills.name.woodcutting', hintKey: 'skills.hint.woodcutting', artId: 'world-root-bark' },
  { id: 'smithing', discipline: 'forge', labelKey: 'skills.name.smithing', hintKey: 'skills.hint.smithing', artId: 'iron-hammer' },
  { id: 'delving', discipline: 'exploration', labelKey: 'skills.name.delving', hintKey: 'skills.hint.delving', artId: 'broken-astral-compass' },
  { id: 'enchanting', discipline: 'enchanting', labelKey: 'skills.name.enchanting', hintKey: 'skills.hint.enchanting', artId: 'rune-of-radiance' },
  { id: 'hunting', discipline: 'hunting', labelKey: 'skills.name.hunting', hintKey: 'skills.hint.hunting', artId: 'shadowthread-silk' },
  { id: 'prospecting', discipline: 'prospecting', labelKey: 'work.discipline.prospecting', hintKey: 'skills.hint.prospecting', artId: 'celestial-alloy' },
  // Fishing (Phase 6): its words live in the lazy fishing table (shared/fishing/fishing.i18n.ts).
  { id: 'fishing', discipline: 'fishing', labelKey: 'skills.name.fishing', hintKey: 'skills.hint.fishing', artId: 'glowcap-minnow' },
  // Firemaking and Cooking (shared/gathering, canon §6.5): their words live in the lazy fishing table too.
  { id: 'firemaking', discipline: 'firemaking', labelKey: 'skills.name.firemaking', hintKey: 'skills.hint.firemaking', artId: 'ashwood-log' },
  { id: 'cooking', discipline: 'cooking', labelKey: 'skills.name.cooking', hintKey: 'skills.hint.cooking', artId: 'baked-ash-perch' },
];

const BY_ID = new Map(SKILLS.map(s => [s.id, s]));
const BY_DISCIPLINE = new Map(SKILLS.map(s => [s.discipline, s]));

export function skillDef(id: SkillId): SkillDef {
  return BY_ID.get(id) ?? SKILLS[0];
}

export function skillForDiscipline(discipline: DisciplineId): SkillDef | undefined {
  return BY_DISCIPLINE.get(discipline);
}

/**
 * A skill's XP total.
 *
 * Smithing also counts the crafting bench's own ladder XP (`benchXp`). The
 * bench has kept that total in its own blob since before Smithing existed and
 * never writes the `forge` discipline, so the two are disjoint and adding them
 * cannot double-count — and every craft a Keeper has ever made counts toward
 * Smithing from day one. Pass 0 (the default) where the bench is not loaded.
 */
export function skillXp(progress: DisciplineProgress | null | undefined, id: SkillId, benchXp = 0): number {
  const raw = progress?.xpByDiscipline[skillDef(id).discipline] ?? 0;
  const base = Number.isFinite(raw) ? Math.max(0, raw) : 0;
  if (id !== 'smithing') return base;
  return base + (Number.isFinite(benchXp) ? Math.max(0, benchXp) : 0);
}

export function skillView(progress: DisciplineProgress | null | undefined, id: SkillId, benchXp = 0): MiningLevelView {
  return miningLevelView(skillXp(progress, id, benchXp));
}

export function skillLevel(progress: DisciplineProgress | null | undefined, id: SkillId, benchXp = 0): number {
  return skillView(progress, id, benchXp).level;
}
