/**
 * tools.ts — what the Keeper can dig, chop, cut and break right now.
 *
 * `toolTiers` is the one read the world engine needs: the host calls
 * `engine.setTools(toolTiers(inventory.snapshot, activity.snapshot.progress))`
 * whenever either snapshot moves. Tiers are plain numbers, 0 = none.
 *
 * Two gates, both visible to the player:
 *   - owning the tool (forged at the crafting bench, gated by Smithing), and
 *   - being skilled enough to wield it (Mining for a pickaxe, Woodcutting for
 *     an axe, Foraging for a sickle, Enchanting for a staff).
 * A Pickaxe III in the bag of a Mining-12 Keeper digs like a Pickaxe II. The
 * bag still counts — tools work from the bag; nothing has to be equipped.
 *
 * Pure. No Angular.
 */
import type { DisciplineProgress } from '../activity/activity.model';
import type { ItemRarity } from '../rpg/item.model';
import { skillLevel, type SkillId } from './skill.model';
import { parseToolId, TOOL_FAMILIES, TOOL_MAX_TIER, type ToolFamily, type ToolTier } from './tool-items';
import { levelPowerFactor, levelPowerPct, levelSwingFactor, levelSwingPct, sharpensSwing, TOOL_SKILL } from './tool-level';

export { TOOL_SKILL } from './tool-level';

export interface ToolTiers {
  pickaxe: number;
  axe: number;
  sickle: number;
  staff: number;
  /** Any equipped weapon, by its rarity. Cuts vines and brambles. */
  blade: number;
  /** World tiles the Delve lantern lights. Grows with Delving. */
  lanternRadius: number;
  /**
   * Seconds between digging/gathering swings, per family (Terraria's "use
   * time"). A starter tool swings at STARTER_SWING_SECONDS; a forged one at its
   * effective tier's TOOL_SWING_SECONDS; then the wielding skill's level takes
   * up to 25% off (tool-level.ts), floored at SWING_FLOOR_SECONDS. No tool: the
   * starter pace.
   */
  swing: Record<ToolFamily, number>;
  /** Per family, the tier's own pace before the level (what the cards call "tool"). */
  toolSwing: Record<ToolFamily, number>;
  /** Per family, the wielding skill's power multiplier (1 at level 1, 1.5 at 99). The engine multiplies the tier's damage by it. */
  power: Record<ToolFamily, number>;
}

/** The starter tools' pace — and every swing that is not digging or gathering (combat stays here). */
export const STARTER_SWING_SECONDS = 0.52;
/** A forged tool's pace by effective tier. Faster per tier; rewards stay capped by the seam's breath and node regrowth. */
export const TOOL_SWING_SECONDS: Readonly<Record<ToolTier, number>> = { 1: 0.46, 2: 0.40, 3: 0.35, 4: 0.31, 5: 0.28 };
/** No swing beats this, whatever the tier and level (the engine clamps to the same floor). */
export const SWING_FLOOR_SECONDS = 0.25;

/**
 * A tier's pace sharpened by the wielding skill's level, floored. `skill`
 * Enchanting leaves it as is: the staff works by its blast, whose cooldown is fixed.
 */
export function levelSwing(tierSwing: number, level: number, skill?: SkillId): number {
  if (skill && !sharpensSwing(skill)) return tierSwing;
  return Math.max(SWING_FLOOR_SECONDS, tierSwing * levelSwingFactor(level));
}

/**
 * One tool's power against a node of tier `min`: the engine's rule
 * (1 + (tier − min) / 2 per swing).
 */
export function toolPower(tier: number, min = 1): number { return 1 + Math.max(0, tier - min) / 2; }

/** What one family is doing for the Keeper right now, for the stats sheet and the item card. */
export interface ToolFamilyStatus {
  family: ToolFamily;
  skill: SkillId;
  /** The best tool held (0 = none). */
  owned: number;
  /** The tier it works as after the skill cap (0 = none). */
  tier: number;
  /** The best tool held is the starter (slowest pace). */
  starter: boolean;
  /** Seconds per swing: the tier's pace sharpened by the skill level. */
  swing: number;
  /** Power against a tier-I node: the tier's power sharpened by the skill level. */
  power: number;
  /** The tier's own pace and power, before the level. */
  toolSwing: number;
  toolPower: number;
  /** The wielding skill's level (1 without progress). */
  level: number;
  /** The skill level that lifts the cap, when the cap bites (owned > tier). */
  capUntil: number | null;
}

/**
 * The level a tier needs — both to forge it (Smithing) and to wield it (the
 * family's gathering skill). One table so the player learns one rule:
 * "tier II needs level 10".
 */
export const TOOL_TIER_LEVEL: Readonly<Record<ToolTier, number>> = { 1: 1, 2: 10, 3: 25, 4: 45, 5: 60 };

/**
 * What each tier opens in the world. `materialId` is what the node drops (an
 * existing material, so the bag, the bench and the Exchange already know it);
 * `label` is the one plain sentence the recipe card and the unlock table show.
 * The engine places the nodes; this table is what it keys them by.
 */
export interface ToolOpens { materialId: string | null; label: string }

export const TOOL_OPENS: Readonly<Record<ToolFamily, Readonly<Record<1 | 2 | 3 | 4, ToolOpens> & Partial<Record<5, ToolOpens>>>>> = {
  pickaxe: {
    1: { materialId: 'cinder-ore', label: 'Digs Cinder veins' },
    2: { materialId: 'slag-fragment', label: 'Digs Slag veins' },
    3: { materialId: 'infernal-heartstone', label: 'Digs Heartstone veins' },
    4: { materialId: 'emberheart-ore', label: 'Digs Emberheart veins' },
    5: { materialId: 'godforge-slag', label: 'Digs Banked Furnace slag' },
  },
  axe: {
    1: { materialId: 'world-root-bark', label: 'Fells World-Root saplings' },
    2: { materialId: 'verdant-sap', label: 'Taps sap trees' },
    3: { materialId: 'solar-resin', label: 'Fells Golden Oaks' },
    4: { materialId: 'shadowthread-silk', label: 'Fells Shadowbark trees' },
    5: { materialId: 'ironwood', label: 'Fells ironwood heartposts' },
  },
  sickle: {
    1: { materialId: 'starlight-herb', label: 'Cuts Starlight Herb' },
    2: { materialId: 'sunbloom', label: 'Cuts Sunbloom' },
    3: { materialId: 'nightbloom', label: 'Cuts Nightbloom' },
    4: { materialId: 'thornroot', label: 'Cuts Thornroot' },
  },
  staff: {
    1: { materialId: null, label: 'Breaks ember wards' },
    2: { materialId: 'luminous-prism', label: 'Shatters prism clusters' },
    3: { materialId: 'celestial-quartz', label: 'Shatters quartz geodes' },
    4: { materialId: 'void-crystal', label: 'Shatters void geodes' },
  },
};

/** The highest tier a skill level may wield. Level 1 always wields tier I. */
export function maxTierForLevel(level: number): ToolTier {
  if (level >= TOOL_TIER_LEVEL[5]) return 5;
  if (level >= TOOL_TIER_LEVEL[4]) return 4;
  if (level >= TOOL_TIER_LEVEL[3]) return 3;
  if (level >= TOOL_TIER_LEVEL[2]) return 2;
  return 1;
}

/**
 * Lantern reach in Delve tiles (one tile = one 32 px cell; the engine takes it
 * as `setTools({ lanternTiles })`): 7 at Delving 1 — the reach the Delve was
 * tuned with — then +1 every 10 levels, 16 at 99.
 */
export const LANTERN_BASE_TILES = 7;
export function lanternRadiusFor(delvingLevel: number): number {
  const lvl = Number.isFinite(delvingLevel) ? Math.max(1, Math.floor(delvingLevel)) : 1;
  return LANTERN_BASE_TILES + Math.floor(Math.min(lvl, 99) / 10);
}

const BLADE_TIER: Readonly<Record<ItemRarity, number>> = {
  common: 1, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 4, singular: 4,
};

/** The structural slice of an inventory snapshot this reads. */
export interface ToolInventoryView {
  items: ReadonlyArray<{ definitionId?: string }>;
  equipped: Partial<Record<string, { rarity?: ItemRarity } | undefined>>;
}

/**
 * Best tier per family across everything held (bag and worn), capped by the
 * wielding skill when `progress` is given. Without `progress` it answers
 * "what do I own" — useful for the recipe card, wrong for the engine.
 */
export function toolTiers(inventory: ToolInventoryView | null | undefined, progress?: DisciplineProgress | null): ToolTiers {
  const owned: Record<ToolFamily, number> = { pickaxe: 0, axe: 0, sickle: 0, staff: 0 };
  // Best forged (non-starter) tier per family: that is what sets the pace.
  const forged: Record<ToolFamily, number> = { pickaxe: 0, axe: 0, sickle: 0, staff: 0 };
  for (const item of inventory?.items ?? []) {
    const tool = parseToolId(item?.definitionId);
    if (!tool) continue;
    if (tool.tier > owned[tool.family]) owned[tool.family] = tool.tier;
    if (!tool.starter && tool.tier > forged[tool.family]) forged[tool.family] = tool.tier;
  }

  const capOf = (family: ToolFamily, tier: number): number => {
    if (!progress) return tier;
    return Math.min(tier, maxTierForLevel(skillLevel(progress, TOOL_SKILL[family])));
  };
  const cap = (family: ToolFamily): number => capOf(family, owned[family]);
  const levelOf = (family: ToolFamily): number => progress ? skillLevel(progress, TOOL_SKILL[family]) : 1;
  const tierPace = (family: ToolFamily): number => {
    const tier = capOf(family, forged[family]);
    return tier > 0 ? TOOL_SWING_SECONDS[tier as ToolTier] : STARTER_SWING_SECONDS;
  };
  const pace = (family: ToolFamily): number => levelSwing(tierPace(family), levelOf(family), TOOL_SKILL[family]);
  const power = (family: ToolFamily): number => levelPowerFactor(levelOf(family));

  const weapon = inventory?.equipped?.['weapon'];
  const blade = weapon ? (BLADE_TIER[weapon.rarity as ItemRarity] ?? 1) : 0;

  return {
    pickaxe: cap('pickaxe'),
    axe: cap('axe'),
    sickle: cap('sickle'),
    staff: cap('staff'),
    blade,
    lanternRadius: lanternRadiusFor(progress ? skillLevel(progress, 'delving') : 1),
    swing: { pickaxe: pace('pickaxe'), axe: pace('axe'), sickle: pace('sickle'), staff: pace('staff') },
    toolSwing: { pickaxe: tierPace('pickaxe'), axe: tierPace('axe'), sickle: tierPace('sickle'), staff: tierPace('staff') },
    power: { pickaxe: power('pickaxe'), axe: power('axe'), sickle: power('sickle'), staff: power('staff') },
  };
}

/**
 * Per family: the best tool held, what it works as, its pace and power, and
 * the level that lifts a skill cap. Pure; what the Keeper Stats "Tools" block
 * shows.
 */
export function toolStatus(inventory: ToolInventoryView | null | undefined, progress?: DisciplineProgress | null): ToolFamilyStatus[] {
  const owned = toolTiers(inventory);
  const working = toolTiers(inventory, progress);
  const starterOnly = (family: ToolFamily): boolean => {
    let forged = false, starter = false;
    for (const item of inventory?.items ?? []) {
      const tool = parseToolId(item?.definitionId);
      if (tool?.family !== family) continue;
      if (tool.starter) starter = true; else forged = true;
    }
    return starter && !forged;
  };
  return TOOL_FAMILIES.map(family => {
    const tier = working[family];
    const have = owned[family];
    const level = progress ? skillLevel(progress, TOOL_SKILL[family]) : 1;
    const base = tier > 0 ? toolPower(tier) : 0;
    return {
      family,
      skill: TOOL_SKILL[family],
      owned: have,
      tier,
      starter: starterOnly(family),
      swing: working.swing[family],
      power: base * working.power[family],
      toolSwing: working.toolSwing[family],
      toolPower: base,
      level,
      capUntil: have > tier && tier > 0 ? TOOL_TIER_LEVEL[(tier + 1) as ToolTier] : null,
    };
  });
}

/** The card facts for one tool item: power, pace, what it opens, and the cap line. */
export interface ToolCard {
  family: ToolFamily;
  tier: ToolTier;
  starter: boolean;
  skill: SkillId;
  /** Power against a tier-I node when wielded at full tier, sharpened by the skill level. */
  power: number;
  /** Seconds per swing at full tier, sharpened by the skill level. */
  swing: number;
  /** The tier's own power and pace, before the level. */
  toolPower: number;
  toolSwing: number;
  /** The wielding skill's level (1 without progress). */
  level: number;
  opens: string;
  /** Works as this tier until `capUntil` (the skill level) — null when no cap. */
  worksAs: number | null;
  capUntil: number | null;
}

type Translate = (key: string, vars?: Record<string, string | number>) => string;
const NUMERAL = ['', 'I', 'II', 'III', 'IV', 'V'];

/** "0.46" — a pace as the cards print it. */
export function formatSwing(seconds: number): string { return seconds.toFixed(2); }
/** "1.5", "1.81" — a power as the cards print it. */
export function formatPower(power: number): string { return String(Math.round(power * 100) / 100); }

/** The facts both the card and the stats block print. */
type ToolFacts = Pick<ToolCard, 'skill' | 'starter' | 'power' | 'swing' | 'toolPower' | 'toolSwing' | 'level'>;

/**
 * Power and pace lines. At level 1 the plain ones ("Mining power 1.5",
 * "0.46 s per swing"); above it the split, so the player sees what the tool
 * gives and what the level adds: "Swing 0.41 s (tool 0.46 · Mining 42 −10%)".
 */
export function toolPaceLines(f: ToolFacts, t: Translate): string[] {
  const skill = t(`toolStat.skill.${f.skill}`);
  if (f.level <= 1) {
    return [
      t('toolStat.power', { skill, n: formatPower(f.power) }),
      t(f.starter ? 'toolStat.swingStarter' : 'toolStat.swing', { s: formatSwing(f.swing) }),
    ];
  }
  return [
    t('toolStat.powerSplit', { n: formatPower(f.power), tool: formatPower(f.toolPower), skill, level: f.level, pct: levelPowerPct(f.level) }),
    sharpensSwing(f.skill)
      ? t('toolStat.swingSplit', { s: formatSwing(f.swing), tool: formatSwing(f.toolSwing), skill, level: f.level, pct: levelSwingPct(f.level) })
      : t(f.starter ? 'toolStat.swingStarter' : 'toolStat.swing', { s: formatSwing(f.swing) }),
  ];
}

/**
 * The item card lines for one tool (keys in tools.i18n.ts): power, pace, what
 * it opens, and "works as tier N until <Skill> L" when the skill cap bites.
 */
export function toolCardLines(card: ToolCard, t: Translate): string[] {
  const skill = t(`toolStat.skill.${card.skill}`);
  const lines = [...toolPaceLines(card, t), t(`toolStat.opens.${card.family}.${card.tier}`)];
  if (card.worksAs && card.capUntil) lines.push(t('toolStat.worksAs', { tier: NUMERAL[card.worksAs], skill, level: card.capUntil }));
  return lines;
}

export function toolCard(definitionId: string | undefined | null, progress?: DisciplineProgress | null): ToolCard | null {
  const tool = parseToolId(definitionId);
  if (!tool) return null;
  const skill = TOOL_SKILL[tool.family];
  const level = progress ? skillLevel(progress, skill) : 1;
  const max = progress ? Math.min(maxTierForLevel(level), TOOL_MAX_TIER[tool.family]) : TOOL_MAX_TIER[tool.family];
  const capped = tool.tier > max;
  const tier = capped ? max : tool.tier;
  const toolPowerAt = toolPower(tool.tier);
  const toolSwing = tool.starter ? STARTER_SWING_SECONDS : TOOL_SWING_SECONDS[tool.tier];
  return {
    family: tool.family,
    tier: tool.tier,
    starter: !!tool.starter,
    skill,
    power: toolPowerAt * levelPowerFactor(level),
    swing: levelSwing(toolSwing, level, skill),
    toolPower: toolPowerAt,
    toolSwing,
    level,
    opens: TOOL_OPENS[tool.family][tool.tier]?.label ?? '',
    worksAs: capped ? tier : null,
    capUntil: capped ? TOOL_TIER_LEVEL[(tier + 1) as ToolTier] : null,
  };
}
