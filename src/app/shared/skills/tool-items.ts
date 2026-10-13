/**
 * tool-items.ts — the sixteen tool definitions (four families, tiers I-IV).
 *
 * Generated from one small table rather than written out, because this file
 * sits in the eagerly loaded item catalogue and sixteen hand-written rows of
 * lore would cost more bytes than they are worth.
 *
 * Tools are soulbound off-hand pieces with no rolls: what a tool is worth is
 * the tier, and the tier is the item. Soulbound keeps them off the Exchange
 * and out of the Gambler's pool (both skip soulbound definitions) — a tool is
 * something you forge, not something you buy.
 *
 * Only types are imported from the item catalogue, so the catalogue can import
 * this file without a cycle.
 */
import type { ItemDefinition, ItemStyle } from '../rpg/item-definition';

export type ToolFamily = 'pickaxe' | 'axe' | 'sickle' | 'staff';
export type ToolTier = 1 | 2 | 3 | 4;

export const TOOL_FAMILIES: readonly ToolFamily[] = ['pickaxe', 'axe', 'sickle', 'staff'];
export const TOOL_TIER_LIST: readonly ToolTier[] = [1, 2, 3, 4];
export const TOOL_NUMERALS = ['', 'I', 'II', 'III', 'IV'] as const;

const FAMILY_NAME: Readonly<Record<ToolFamily, string>> = {
  pickaxe: 'Pickaxe', axe: 'Axe', sickle: 'Sickle', staff: 'Staff',
};

const FAMILY_STYLE: Readonly<Record<ToolFamily, ItemStyle>> = {
  pickaxe: 'infernal', axe: 'verdant', sickle: 'verdant', staff: 'celestial',
};

const FAMILY_LORE: Readonly<Record<ToolFamily, string>> = {
  pickaxe: 'A Keeper-forged pickaxe. Each tier bites into harder veins.',
  axe: 'A Keeper-forged axe. Each tier fells older trees.',
  sickle: 'A Keeper-forged sickle. Each tier reaches rarer growth.',
  staff: 'A Keeper-forged staff. Each tier breaks stronger seals.',
};

/** `pickaxe-2` and so on. Stable: saves hold these as definition ids. */
export function toolItemId(family: ToolFamily, tier: ToolTier): string {
  return `${family}-${tier}`;
}

export function toolName(family: ToolFamily, tier: ToolTier): string {
  return `${FAMILY_NAME[family]} ${TOOL_NUMERALS[tier]}`;
}

/**
 * The starter tools every Keeper is handed (owner rule, 2026-10-13: "everything
 * needs a meaning" — no invisible floor). Each works as tier I and swings at the
 * slowest speed, so the first forged tool is a felt upgrade. One fixed instance
 * id per family: granting again can never make a second copy.
 */
export type StarterFamily = Exclude<ToolFamily, 'staff'>;
export const STARTER_FAMILIES: readonly StarterFamily[] = ['pickaxe', 'axe', 'sickle'];
export function starterToolId(family: StarterFamily): string { return `starter-${family}`; }
export function starterInstanceId(family: StarterFamily): string { return `starter-${family}:v1`; }
const STARTER_NAME: Readonly<Record<StarterFamily, string>> = { pickaxe: 'Worn Pickaxe', axe: 'Worn Axe', sickle: 'Worn Sickle' };

/**
 * The family and tier a definition id names, or null if it is not a tool.
 * A starter tool is tier I with `starter: true`.
 */
export function parseToolId(id: string | undefined | null): { family: ToolFamily; tier: ToolTier; starter?: true } | null {
  if (!id) return null;
  const m = /^(pickaxe|axe|sickle|staff)-([1-4])$/.exec(id);
  if (m) return { family: m[1] as ToolFamily, tier: Number(m[2]) as ToolTier };
  const s = /^starter-(pickaxe|axe|sickle)$/.exec(id);
  return s ? { family: s[1] as ToolFamily, tier: 1, starter: true } : null;
}

export const TOOL_DEFINITIONS: readonly ItemDefinition[] = TOOL_FAMILIES.flatMap(family =>
  TOOL_TIER_LIST.map((tier): ItemDefinition => ({
    id: toolItemId(family, tier),
    name: toolName(family, tier),
    family: 'equipment',
    type: 'artifact',
    slot: 'off-hand',
    style: FAMILY_STYLE[family],
    rollKeys: [],
    base: {},
    temperable: false,
    maxTemper: 0,
    temperGoldBase: 0,
    lore: FAMILY_LORE[family],
    soulbound: true,
  })),
);

/** The three starter tools: tier I, soulbound, no rolls, worth nothing. */
export const STARTER_TOOL_DEFINITIONS: readonly ItemDefinition[] = STARTER_FAMILIES.map((family): ItemDefinition => ({
  id: starterToolId(family),
  name: STARTER_NAME[family],
  family: 'equipment',
  type: 'artifact',
  slot: 'off-hand',
  style: FAMILY_STYLE[family],
  rollKeys: [],
  base: {},
  temperable: false,
  maxTemper: 0,
  temperGoldBase: 0,
  lore: 'Every Keeper starts with one. It does the job, slowly. Forge a real one at the Crafting Bench to swing faster.',
  soulbound: true,
}));

