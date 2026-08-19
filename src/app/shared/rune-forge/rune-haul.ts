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

/** One rung of a bulk run's tally: "7 Common", in the rung's own colour. */
export interface BatchTier {
  tier: RuneTier;
  label: string;
  color: string;
  count: number;
}

/**
 * What a bulk run turned up, by rung, rarest first.
 *
 * Rungs that came up empty are dropped rather than printed as zeroes: on a
 * run of ten the honest line is "7 Common, 2 Uncommon, 1 Rare", not a table
 * of nine rungs six of which say nothing. Rarest first because that is the
 * part the player is reading for.
 */
export function tallyTiers(finds: readonly { rune: { tier: RuneTier } }[]): BatchTier[] {
  const counts = new Map<RuneTier, number>();
  for (const find of finds) {
    counts.set(find.rune.tier, (counts.get(find.rune.tier) ?? 0) + 1);
  }
  return [...RUNE_TIER_ORDER]
    .reverse()
    .filter(tier => counts.has(tier))
    .map(tier => ({
      tier,
      label: RUNE_TIERS[tier].label,
      color: RUNE_TIERS[tier].color,
      count: counts.get(tier) ?? 0,
    }));
}

/**
 * The slice of a find a running tally reads. Structural for the same reason
 * `HaulSource` is: this file imports nothing from the service.
 */
export interface TallySource extends HaulSource {
  rune: { id: string; name: string; tier: RuneTier };
  isNew: boolean;
}

/**
 * A bulk run, folded as it goes instead of kept.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * ALL used to be clamped to a thousand strikes, and the reveal simply held on
 * to every find in an array: the chunk loop did `batch = batch.concat(finds)`,
 * the grid rendered `batch`, and `bestBatchIndex` and `batchNew` were template
 * getters that walked the whole thing on every change-detection pass.
 *
 * At a thousand that is fine. Uncapped it is not, and all three degrade at
 * once. `concat` copies the entire accumulated array once per chunk, which is
 * quadratic: a forty-thousand-strike run does on the order of a hundred
 * million element copies before it does anything else. The two getters are
 * linear scans re-run on every pass of an OnPush component that is marked
 * dirty by every chunk. And forty thousand finds are forty thousand live
 * object graphs held for the length of the run.
 *
 * Everything the reveal actually shows is reducible, so none of it needs to be
 * kept: a count, a new-count, a per-rung tally, four haul totals, the best
 * find, the last find, and — only while the run is small enough for the grid
 * to draw them — the first `cardCap` finds. This folds each find into those as
 * it arrives, in constant time and constant space.
 *
 * Pure. No browser APIs, no framework, no imports from the service.
 */
export class BatchTally<T extends TallySource> {
  private readonly _cards: T[] = [];
  private readonly _tiers = new Map<RuneTier, number>();
  private readonly _haul: BatchHaul = { items: 0, scrolls: 0, explorers: 0, essence: 0 };
  private _count = 0;
  private _new = 0;
  private _best: T | null = null;
  private _last: T | null = null;
  private _bestRank = -1;

  /**
   * `cardCap` is how many finds are worth keeping for the grid. Past it the
   * reveal prints the tally and the single best find instead of a wall of
   * thumbnails, so the rest are never drawn and never need to be held.
   */
  constructor(private readonly cardCap: number) {}

  add(find: T): void {
    this._count++;
    this._last = find;
    if (find.isNew) this._new++;
    if (this._cards.length < this.cardCap) this._cards.push(find);

    this._tiers.set(find.rune.tier, (this._tiers.get(find.rune.tier) ?? 0) + 1);

    if (find.item) this._haul.items++;
    if (find.scroll) this._haul.scrolls++;
    if (find.explorer) this._haul.explorers++;
    if (find.essence > 0) this._haul.essence += find.essence;

    // Rank compared once and remembered, rather than an indexOf per comparison
    // against the running best — this runs once per strike on every strike.
    const rank = RUNE_TIER_ORDER.indexOf(find.rune.tier);
    if (rank > this._bestRank) {
      this._bestRank = rank;
      this._best = find;
    }
  }

  get count(): number { return this._count; }
  get newCount(): number { return this._new; }
  /** The best rung in the run. Ties keep the earliest, which is the one the
   *  grid's `is-best` marker points at. */
  get best(): T | null { return this._best; }
  /** The find the run ended on — what the reveal card shows. */
  get last(): T | null { return this._last; }
  /** The finds the grid may draw. Empty past `cardCap`; see the constructor. */
  get cards(): readonly T[] { return this._cards; }

  /** Where the best find sits in `cards`, or null when it is past the cap. */
  get bestCardIndex(): number | null {
    if (!this._best) return null;
    const i = this._cards.indexOf(this._best);
    return i === -1 ? null : i;
  }

  haul(): BatchHaul { return { ...this._haul }; }

  /** The tally, rarest first, empty rungs dropped — same contract as
   *  `tallyTiers`, which this replaces for anything that accumulates. */
  tiers(): BatchTier[] {
    return [...RUNE_TIER_ORDER]
      .reverse()
      .filter(tier => this._tiers.has(tier))
      .map(tier => ({
        tier,
        label: RUNE_TIERS[tier].label,
        color: RUNE_TIERS[tier].color,
        count: this._tiers.get(tier) ?? 0,
      }));
  }
}
