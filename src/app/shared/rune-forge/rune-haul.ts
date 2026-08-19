/**
 * rune-haul.ts — everything a strike produced besides the rune, as lines.
 *
 * `RuneFind` carries the equippable minted alongside the rune, a possible Lore
 * Scroll, a possible explorer and any Eclipse Essence — the service comments
 * say the reveal should show them together, and until now it showed none of
 * them. This turns the find into a flat list the reveal can print under the
 * card, so the player is told the whole haul rather than the headline.
 *
 * Nothing here decides anything. It reads a find the service already wrote and
 * formats it; it never touches inventory, economy or the ledger. Pure data in,
 * pure data out — safe on an SSR path and in a Karma spec without a TestBed.
 */
import {
  ITEM_STAT_KEYS,
  formatItemMod,
  rarityColor,
  rarityLabel,
  type GameItem,
} from '../rpg/item.model';
import { explorerTier, type RosterExplorer } from '../rpg/explorer-roster.model';
import type { LoreScroll } from './lore-scroll.model';
import { RUNE_TIERS, RUNE_TIER_ORDER, type RuneTier } from './rune.model';

/** One printed line under the reveal card. `color` is a rarity colour off the ladder. */
export interface HaulLine {
  kind: 'item' | 'scroll' | 'explorer' | 'essence';
  name: string;
  detail: string;
  color: string;
}

/**
 * The slice of a `RuneFind` the haul reads. Declared structurally rather than
 * as `Pick<RuneFind, …>` so this file has no import from the service — the
 * component passes a real find, a spec passes a literal.
 */
export interface HaulSource {
  item: GameItem | null;
  scroll: LoreScroll | null;
  explorer: RosterExplorer | null;
  essence: number;
}

/**
 * Counts for the Auto ×10 summary line. A type alias rather than an interface
 * so it satisfies `TranslationService.translate`'s `Record<string, …>` vars
 * parameter directly — interfaces carry no implicit index signature.
 */
export type BatchHaul = {
  items: number;
  scrolls: number;
  explorers: number;
  essence: number;
};

/**
 * Epic and above earn the sub-bass voice on the reveal cue and the heavier
 * card treatments. One place for the threshold so the pull and the temper
 * agree on where "heavy" starts.
 */
export function isHeavyTier(tier: RuneTier): boolean {
  return RUNE_TIER_ORDER.indexOf(tier) >= RUNE_TIER_ORDER.indexOf('epic');
}

/**
 * The lines, in a fixed order: item, scroll, explorer, essence. Fixed so two
 * strikes with the same haul read the same way, and so the thing the player
 * can equip comes first.
 */
export function haulOf(find: HaulSource): HaulLine[] {
  const lines: HaulLine[] = [];

  if (find.item) {
    const item = find.item;
    lines.push({
      kind: 'item',
      name: item.name,
      detail: topStatOf(item) ?? rarityLabel(item.rarity),
      color: rarityColor(item.rarity),
    });
  }

  if (find.scroll) {
    const scroll = find.scroll;
    lines.push({
      kind: 'scroll',
      name: scroll.title,
      detail: scroll.subtitle || scroll.chapterName,
      color: (RUNE_TIERS[scroll.rarity] ?? RUNE_TIERS.common).color,
    });
  }

  if (find.explorer) {
    const explorer = find.explorer;
    const tier = explorerTier(explorer.rarity);
    lines.push({
      kind: 'explorer',
      name: explorer.name,
      detail: tier.label,
      color: tier.color,
    });
  }

  if (find.essence > 0) {
    lines.push({
      kind: 'essence',
      name: `+${find.essence}`,
      detail: '',
      color: RUNE_TIERS.common.color,
    });
  }

  return lines;
}

/** The first stat the item carries, in `ITEM_STAT_KEYS` order, as a mod line. */
function topStatOf(item: GameItem): string | null {
  for (const key of ITEM_STAT_KEYS) {
    const value = item.stats?.[key];
    if (value != null) return formatItemMod(key, value);
  }
  return null;
}

/** Totals across an Auto ×10 batch, for the one-line summary. */
export function batchHaul(finds: readonly HaulSource[]): BatchHaul {
  const out: BatchHaul = { items: 0, scrolls: 0, explorers: 0, essence: 0 };
  for (const find of finds) {
    if (find.item) out.items++;
    if (find.scroll) out.scrolls++;
    if (find.explorer) out.explorers++;
    out.essence += find.essence > 0 ? find.essence : 0;
  }
  return out;
}
