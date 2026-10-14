/**
 * skill-unlocks.ts — what every skill level is *for*.
 *
 * A level that opens nothing is a number going up. Every skill gets something
 * concrete roughly every ten levels: a tool tier it may wield, a new node to
 * gather, a perk the world reads (`skillPerks`), a tier of tools Smithing may
 * forge, a wider Delve lantern. The skills panel shows the next row as one
 * plain line ("Next: Wield Pickaxe II at level 10") and the whole table behind
 * Details; the level-up banner names what the new level opened.
 *
 * Gathering nodes reuse the gathering sites' existing tier levels (Slag at
 * Mining 8, Sunbloom at Foraging 6, ...) so a row here never contradicts what
 * the Seamworks, the Canopy or the Orrery already enforce. Tool rows use the
 * one tier table in the tools module, so "tier II needs level 10" holds for
 * forging and wielding alike.
 *
 * Perks are data. `skillPerks` is the read the world engine and the future
 * anvil/ritual call; nothing here applies them by itself.
 *
 * Pure. No Angular.
 */
import { MASTERY_LEVEL, miningLevelView, xpForLevel } from '../activity/mining-level';
import { TITLE_RANKS, titleAt, titleRank } from './skill-titles';
import { materialDisplay } from '../rpg/material-catalog';
import type { SkillId } from './skill.model';
import { TOOL_NUMERALS, toolName, type ToolFamily, type ToolTier } from './tool-items';
import { TOOL_OPENS, TOOL_TIER_LEVEL, lanternRadiusFor } from './tools';
import { fishingPerks, RODS } from '../fishing/fishing.model';

export type PerkKind = 'yield' | 'speed' | 'quality' | 'loot';

export type SkillUnlock =
  | { level: number; kind: 'tool'; family: ToolFamily; tier: ToolTier }
  | { level: number; kind: 'forge'; tier: ToolTier }
  | { level: number; kind: 'node'; materialId: string }
  | { level: number; kind: 'perk'; perk: PerkKind; pct: number }
  | { level: number; kind: 'lantern'; radius: number }
  | { level: number; kind: 'depth'; depth: number }
  | { level: number; kind: 'mastery' }
  /** Fishing: a rod works at its own tier from here (fishing.model.ts RODS). */
  | { level: number; kind: 'rod'; rodId: string; name: string }
  /** Fishing: a line of the angler's perks (fishingPerks): bite speed, crate chance, double catch, the reel window, lava. */
  | { level: number; kind: 'fishperk'; perk: 'bite' | 'crate' | 'double' | 'window' | 'lava'; n: number }
  /** Past 99: a title every 25 levels (skill-titles.ts), cosmetic — nothing is gated on it. */
  | { level: number; kind: 'title'; skill: SkillId; rank: number };

const tool = (family: ToolFamily, tier: ToolTier): SkillUnlock =>
  ({ level: TOOL_TIER_LEVEL[tier], kind: 'tool', family, tier });
const node = (level: number, materialId: string): SkillUnlock => ({ level, kind: 'node', materialId });
const perk = (level: number, kind: PerkKind, pct: number): SkillUnlock => ({ level, kind: 'perk', perk: kind, pct });
const mastery: SkillUnlock = { level: MASTERY_LEVEL, kind: 'mastery' };

/** Gathering skills share a perk rhythm: speed and double-haul alternate. */
function gatherPerks(levels: readonly number[]): SkillUnlock[] {
  return levels.map((level, i) => perk(level, i % 2 === 0 ? 'speed' : 'yield', 5 * (Math.floor(i / 2) + 1)));
}

function wields(family: ToolFamily): SkillUnlock[] {
  return ([1, 2, 3, 4] as const).map(tier => tool(family, tier));
}

function sorted(rows: SkillUnlock[]): readonly SkillUnlock[] {
  return [...rows].sort((a, b) => a.level - b.level);
}

const BASE_UNLOCKS: Readonly<Record<SkillId, readonly SkillUnlock[]>> = {
  mining: sorted([
    ...wields('pickaxe'),
    node(1, 'cinder-ore'), node(8, 'slag-fragment'), node(20, 'infernal-heartstone'),
    node(45, 'emberheart-ore'), node(70, 'orichalcum-ore'),
    ...gatherPerks([15, 30, 40, 50, 60, 80, 90]),
    mastery,
  ]),
  foraging: sorted([
    ...wields('sickle'),
    node(1, 'starlight-herb'), node(6, 'sunbloom'), node(14, 'nightbloom'), node(25, 'thornroot'),
    node(40, 'moonpetal-herb'),
    ...gatherPerks([20, 30, 50, 60, 70, 80, 90]),
    mastery,
  ]),
  woodcutting: sorted([
    ...wields('axe'),
    ...([1, 2, 3, 4] as const).map(tier => node(TOOL_TIER_LEVEL[tier], TOOL_OPENS.axe[tier].materialId!)),
    ...gatherPerks([20, 30, 40, 50, 60, 70, 80, 90]),
    mastery,
  ]),
  smithing: sorted([
    ...([1, 2, 3, 4] as const).map((tier): SkillUnlock => ({ level: TOOL_TIER_LEVEL[tier], kind: 'forge', tier })),
    perk(15, 'quality', 5), perk(30, 'quality', 10), perk(55, 'quality', 15),
    perk(70, 'quality', 20), perk(85, 'quality', 25),
    mastery,
  ]),
  delving: sorted([
    ...[1, 10, 20, 30, 40, 50, 60, 70, 80, 90].map((level): SkillUnlock =>
      ({ level, kind: 'lantern', radius: lanternRadiusFor(level) })),
    ...[[1, 1], [15, 2], [35, 3], [55, 4], [75, 5]].map(([level, depth]): SkillUnlock =>
      ({ level, kind: 'depth', depth })),
    mastery,
  ]),
  enchanting: sorted([
    ...wields('staff'),
    perk(20, 'quality', 5), perk(35, 'quality', 10), perk(55, 'quality', 15),
    perk(70, 'quality', 20), perk(85, 'quality', 25),
    mastery,
  ]),
  hunting: sorted([
    ...[10, 20, 30, 40, 50, 60, 70, 80, 90].map((level, i) =>
      perk(level, i % 2 === 0 ? 'loot' : 'yield', 5 * (Math.floor(i / 2) + 1))),
    mastery,
  ]),
  fishing: sorted([
    ...RODS.filter(rod => rod.id !== 'worn-rod').map((rod): SkillUnlock => ({ level: rod.level, kind: 'rod', rodId: rod.id, name: rod.name })),
    { level: 10, kind: 'fishperk', perk: 'lava', n: 0 },
    ...[10, 20, 30, 40, 50, 60, 70, 80, 90].map((level): SkillUnlock => ({ level, kind: 'fishperk', perk: 'bite', n: Math.round((fishingPerks(level).bite - 1) * 100) })),
    ...[20, 40, 60, 80].map((level): SkillUnlock => ({ level, kind: 'fishperk', perk: 'crate', n: Math.round(fishingPerks(level).crate * 1000) / 10 })),
    ...[25, 50, 75].map((level): SkillUnlock => ({ level, kind: 'fishperk', perk: 'double', n: Math.round(fishingPerks(level).double * 100) })),
    ...[30, 60, 90].map((level): SkillUnlock => ({ level, kind: 'fishperk', perk: 'window', n: Math.round(fishingPerks(level).window * 100) })),
    mastery,
  ]),
  prospecting: sorted([
    node(1, 'celestial-alloy'), node(7, 'luminous-prism'), node(15, 'verdant-sap'),
    node(24, 'umbral-ink'), node(34, 'void-shard'),
    ...gatherPerks([40, 50, 60, 70, 80, 90]),
    mastery,
  ]),
};

function titleRow(skill: SkillId, rank: number): SkillUnlock {
  const t = titleAt(skill, rank);
  return { level: t.level, kind: 'title', skill, rank };
}

/**
 * Every skill's table: the 1-99 rows above, then the eight authored titles
 * past mastery (100 ... 275). The starred ranks from 300 are endless, so they
 * are not listed — `nextUnlock` names the next one.
 */
export const SKILL_UNLOCKS: Readonly<Record<SkillId, readonly SkillUnlock[]>> = Object.fromEntries(
  (Object.keys(BASE_UNLOCKS) as SkillId[]).map(skill => [skill, [
    ...BASE_UNLOCKS[skill],
    ...Array.from({ length: TITLE_RANKS }, (_, i) => titleRow(skill, i + 1)),
  ]]),
) as unknown as Record<SkillId, readonly SkillUnlock[]>;

/** Everything a skill has opened by `level`, in level order. */
export function unlocksFor(skill: SkillId, level: number): SkillUnlock[] {
  return (SKILL_UNLOCKS[skill] ?? []).filter(u => u.level <= level);
}

/** What crossing from `fromLevel` to `toLevel` opened (exclusive, inclusive). */
export function unlocksBetween(skill: SkillId, fromLevel: number, toLevel: number): SkillUnlock[] {
  return (SKILL_UNLOCKS[skill] ?? []).filter(u => u.level > fromLevel && u.level <= toLevel);
}

export interface NextUnlock {
  level: number;
  /** Every row that lands at that level; the first is the headline. */
  unlocks: SkillUnlock[];
  /** XP still to earn. Always > 0. */
  xpNeeded: number;
}

/** The next level that opens something, from an XP total. Null when none is left. */
export function nextUnlock(skill: SkillId, xp: number): NextUnlock | null {
  const level = miningLevelView(xp).level;
  const listed = (SKILL_UNLOCKS[skill] ?? []).filter(u => u.level > level);
  // Past the last authored title the next star is always ahead: the table never runs out.
  const ahead = listed.length || !SKILL_UNLOCKS[skill] ? listed : [titleRow(skill, titleRank(level) + 1)];
  if (!ahead.length) return null;
  const at = ahead[0].level;
  const total = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
  return {
    level: at,
    unlocks: ahead.filter(u => u.level === at),
    xpNeeded: Math.max(1, xpForLevel(at) - total),
  };
}

export interface SkillPerks { yieldPct: number; speedPct: number; qualityPct: number; lootPct: number }

/** The perks a level has earned. Each row is the new total, not an increment. */
export function skillPerks(skill: SkillId, level: number): SkillPerks {
  const out: SkillPerks = { yieldPct: 0, speedPct: 0, qualityPct: 0, lootPct: 0 };
  for (const u of unlocksFor(skill, level)) {
    if (u.kind !== 'perk') continue;
    const key = `${u.perk}Pct` as keyof SkillPerks;
    out[key] = Math.max(out[key], u.pct);
  }
  return out;
}

/**
 * The i18n key and variables for one row. The caller translates. A title row
 * also carries `nameKey` (the title's own words, plus `stars`): translate it
 * into `vars.name` first — `unlockText` does both.
 */
export interface UnlockWords { key: string; vars: Record<string, string | number>; nameKey?: string; stars?: number }

export function describeUnlock(u: SkillUnlock): UnlockWords {
  switch (u.kind) {
    case 'tool':
      return { key: 'skills.unlock.tool', vars: { name: toolName(u.family, u.tier), opens: TOOL_OPENS[u.family][u.tier].label } };
    case 'forge':
      return { key: 'skills.unlock.forge', vars: { tier: TOOL_NUMERALS[u.tier] } };
    case 'node':
      return { key: 'skills.unlock.node', vars: { name: materialDisplay(u.materialId)?.name ?? u.materialId } };
    case 'perk':
      return { key: `skills.unlock.${u.perk}`, vars: { n: u.pct } };
    case 'lantern':
      return { key: 'skills.unlock.lantern', vars: { n: u.radius } };
    case 'depth':
      return { key: 'skills.unlock.depth', vars: { n: u.depth } };
    case 'mastery':
      return { key: 'skills.unlock.mastery', vars: {} };
    case 'rod':
      return { key: 'skills.unlock.rod', vars: { name: u.name } };
    case 'fishperk':
      return { key: `skills.unlock.fish.${u.perk}`, vars: { n: u.n } };
    case 'title': {
      const t = titleAt(u.skill, u.rank);
      return { key: 'skills.unlock.title', vars: {}, nameKey: t.key, stars: t.stars };
    }
  }
}

type Translate = (key: string, vars?: Record<string, string | number>) => string;

/** One described row, translated (a title row's name resolved, with its stars). */
export function wordsText(w: UnlockWords, t: Translate): string {
  if (!w.nameKey) return t(w.key, w.vars);
  const name = t(w.nameKey);
  const shown = w.stars ? t('skills.title.starred', { title: name, n: w.stars }) : name;
  return t(w.key, { ...w.vars, name: shown });
}

/** One row, translated. */
export function unlockText(u: SkillUnlock, t: Translate): string {
  return wordsText(describeUnlock(u), t);
}
