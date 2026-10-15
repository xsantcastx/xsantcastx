/**
 * held-tool.ts — which tool the Keeper takes in hand for an activity.
 *
 * Owner, 2026-10-15: "when fishing I still have the sword equipped; when doing
 * activities it should use the correct tool if we have it in our inventory."
 *
 * The model (docs/handoff/touch-and-tools.md): tools already WORK from the
 * satchel (tools.ts — nothing is equipped), so taking one "in hand" is purely
 * what the Keeper is seen holding. No item ever moves: the equipped weapon
 * stays in its slot (and in the save), and the engine swaps the painter's
 * weapon layer for the tool while the activity lasts, then back to the weapon
 * when a foe comes near, a blow lands on one, or the work stops.
 *
 * The rule, per activity: of the tools of that family the Keeper holds (bag or
 * worn; not one stored in a Delve chest — the host filters those), the highest
 * tier the wielding skill allows (TOOL_TIER_LEVEL: tier II from level 10…); a
 * forged tool beats the Worn starter of the same tier; when every held tool is
 * above the cap, the lowest one (it works as the capped tier). Rods follow the
 * same rule against Fishing and each rod's own level.
 *
 * Pure. No Angular, no DOM.
 */
import { RODS } from '../fishing/fishing.model';
import type { GearPiece, GearRarity, GearStyle } from '../keeper-look/keeper-gear';
import { FAMILY_STYLE, parseToolId, TOOL_MAX_TIER, type ToolFamily } from './tool-items';
import { maxTierForLevel } from './tools';

/** What an activity takes in hand. The staff works by its blast and stays a weapon-hand choice. */
export type HeldToolKind = Exclude<ToolFamily, 'staff'> | 'rod';
export const HELD_TOOL_KINDS: readonly HeldToolKind[] = ['pickaxe', 'axe', 'sickle', 'rod'];

export interface HeldToolPick {
  kind: HeldToolKind;
  /** The item it is (`pickaxe-2`, `starter-axe`, `seam-rod`). */
  definitionId: string;
  tier: number;
  starter: boolean;
}

/** A tool's look in the hand: the family's realm style, lit by its tier (the item ladder's colours). */
const TIER_RARITY: readonly GearRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const ROD_LOOK: Readonly<Record<string, readonly [GearStyle, GearRarity]>> = {
  'worn-rod': ['neutral', 'common'],
  'root-rod': ['verdant', 'uncommon'],
  'seam-rod': ['infernal', 'rare'],
  'glowline-rod': ['luminous', 'epic'],
};

/**
 * The best tool of `family` among `definitionIds` for a Keeper at `level` in
 * its wielding skill, or null when none is held.
 */
export function bestTool(family: Exclude<ToolFamily, 'staff'>, definitionIds: Iterable<string | undefined | null>, level: number): HeldToolPick | null {
  const cap = Math.min(maxTierForLevel(level), TOOL_MAX_TIER[family]);
  let best: HeldToolPick | null = null;
  let lowest: HeldToolPick | null = null;
  for (const id of definitionIds) {
    const tool = parseToolId(id);
    if (!tool || tool.family !== family) continue;
    const pick: HeldToolPick = { kind: family, definitionId: id!, tier: tool.tier, starter: !!tool.starter };
    if (!lowest || pick.tier < lowest.tier || (pick.tier === lowest.tier && lowest.starter && !pick.starter)) lowest = pick;
    if (pick.tier > cap) continue;
    if (!best || pick.tier > best.tier || (pick.tier === best.tier && best.starter && !pick.starter)) best = pick;
  }
  return best ?? lowest;
}

/** The best rod held (`has(id)`) for a Keeper at Fishing `level`, or null. */
export function bestRod(has: (rodId: string) => boolean, level: number): HeldToolPick | null {
  let best: HeldToolPick | null = null;
  let lowest: HeldToolPick | null = null;
  for (const rod of RODS) {
    if (!has(rod.id)) continue;
    const pick: HeldToolPick = { kind: 'rod', definitionId: rod.id, tier: rod.tier, starter: rod.id === 'worn-rod' };
    lowest ??= pick;
    // RODS runs weakest to strongest, so a later one that the level allows wins.
    if (rod.level <= level) best = pick;
  }
  return best ?? lowest;
}

/** The painter's weapon layer for a picked tool (its kind is the sprite: pickaxe, axe, sickle, rod). */
export function heldToolPiece(pick: HeldToolPick): GearPiece {
  if (pick.kind === 'rod') {
    const [style, rarity] = ROD_LOOK[pick.definitionId] ?? ['neutral', 'common'];
    return { slot: 'weapon', kind: 'rod', style, rarity };
  }
  return {
    slot: 'weapon', kind: pick.kind,
    style: pick.starter ? 'neutral' : FAMILY_STYLE[pick.kind] as GearStyle,
    rarity: pick.starter ? 'common' : TIER_RARITY[Math.min(TIER_RARITY.length - 1, pick.tier)],
  };
}

export interface HeldToolInput {
  /** Definition ids of everything held (bag and worn; not chest-stored). */
  definitionIds: readonly (string | undefined | null)[];
  /** Wielding-skill levels: Mining → pickaxe, Woodcutting → axe, Foraging → sickle, Fishing → rod. */
  levels: Readonly<Record<'mining' | 'woodcutting' | 'foraging' | 'fishing', number>>;
  /** Whether a rod is held (rods are stacks). */
  hasRod: (rodId: string) => boolean;
}

/** Per activity, what goes in hand (missing = the Keeper has none of that tool). */
export function heldToolPieces(input: HeldToolInput): Partial<Record<HeldToolKind, GearPiece>> {
  const out: Partial<Record<HeldToolKind, GearPiece>> = {};
  const picks: (HeldToolPick | null)[] = [
    bestTool('pickaxe', input.definitionIds, input.levels.mining),
    bestTool('axe', input.definitionIds, input.levels.woodcutting),
    bestTool('sickle', input.definitionIds, input.levels.foraging),
    bestRod(input.hasRod, input.levels.fishing),
  ];
  for (const pick of picks) if (pick) out[pick.kind] = heldToolPiece(pick);
  return out;
}

/** A stable key for a set of held-tool pieces (the host pushes them when it changes). */
export function heldToolsKey(pieces: Partial<Record<HeldToolKind, GearPiece>>): string {
  return HELD_TOOL_KINDS.map(kind => { const p = pieces[kind]; return p ? `${kind}:${p.style}:${p.rarity}` : ''; }).filter(Boolean).join('|');
}
