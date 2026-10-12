/**
 * station-ui.model.ts — the pure arithmetic behind every station's big button.
 *
 * A station (the Enchanting Table, the Crafting Bench, the Rune Forge, and next
 * the Market, Gambler, Exchange …) has ONE primary action with a price. This
 * file answers the three questions that button asks, without Angular, so the
 * answers can be tested under plain node (scripts/station-ui.test.cjs):
 *
 *   · can I afford it?            → `isAffordable(costs)`
 *   · if not, why, in plain words → `shortfall(costs)` (the first thing short)
 *   · how close am I?             → `affordProgress(costs)` (0..1, the weakest line)
 *
 * It knows nothing about game rules. A station builds `StationCost` rows from
 * the numbers its own service already uses — the gateway still decides whether
 * the action is allowed. This only decides what the button *says*.
 *
 * No imports, on purpose: the node test transpiles this one file in isolation.
 */

/** What a cost is paid in. Drives the chip's art and colour. */
export type StationCostKind = 'gold' | 'essence' | 'material' | 'rune' | 'item';

/** Anything with a picture: an `ArtEntry` from `artFor()` or a rune `CardArt`. */
export interface StationArt {
  src: string;
  srcset?: string;
  width?: number;
  height?: number;
}

/** One line of a price: "12,000 Gold", "6 Thornroot", "1 Ember rune". */
export interface StationCost {
  kind: StationCostKind;
  /** Catalogue id (material id, rune id). Gold/Essence may omit it. */
  id?: string;
  /** Display name, already translated: "Gold", "Thornroot". */
  label: string;
  /** How many the action spends. */
  need: number;
  /** How many the player holds right now. */
  have: number;
  /** Painted art, resolved by the caller via `artFor()` / `runeCard()`. Never a hand-written path. */
  art?: StationArt | null;
}

/** How many more of one cost the player needs. Never negative. */
export function costShort(cost: StationCost): number {
  return Math.max(0, Math.ceil(cost.need - cost.have));
}

/** True when every line of the price is covered. An empty price is free. */
export function isAffordable(costs: readonly StationCost[]): boolean {
  return costs.every(cost => costShort(cost) === 0);
}

/**
 * 0..1 — how close the player is to affording the whole price.
 *
 * The WEAKEST line, not the average: owning 6/6 Thornroot and 0/12,000 Gold is
 * not "half way" to a craft, it is nowhere, and a bar that said 50% would lie.
 * A line with `need <= 0` counts as complete.
 */
export function affordProgress(costs: readonly StationCost[]): number {
  if (!costs.length) return 1;
  let weakest = 1;
  for (const cost of costs) {
    const ratio = cost.need <= 0 ? 1 : Math.max(0, Math.min(1, cost.have / cost.need));
    if (ratio < weakest) weakest = ratio;
  }
  return weakest;
}

/** The first line the player is short of, and by how much — or null when affordable. */
export interface Shortfall {
  cost: StationCost;
  short: number;
}

/**
 * The line to name in "Need 200 more Gold".
 *
 * Order is the caller's order, so a station lists the thing players most often
 * lack first (usually Gold). Only one line is named: a button that lists four
 * shortages is the wall of text this kit exists to remove — the chips already
 * flash every short line red.
 */
export function shortfall(costs: readonly StationCost[]): Shortfall | null {
  for (const cost of costs) {
    const short = costShort(cost);
    if (short > 0) return { cost, short };
  }
  return null;
}

/**
 * 12,000 → "12,000"; 1,250,000 → "1.25M". Exact while a player can still read
 * it at a glance, compact once the digits stop meaning anything.
 */
export function formatAmount(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const v = Math.floor(n);
  const abs = Math.abs(v);
  if (abs < 100_000) return v.toLocaleString('en-US');
  const units: [number, string][] = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  for (const [size, suffix] of units) {
    if (abs >= size) {
      const scaled = v / size;
      const text = scaled >= 100 ? Math.floor(scaled).toString() : (Math.floor(scaled * 100) / 100).toString();
      return text + suffix;
    }
  }
  return String(v);
}

/**
 * How many times the player can pay this price right now — the "Craft all"
 * count. The tightest line wins; lines with `need <= 0` don't limit. Capped
 * so a deep purse can't ask a station to loop forever. An empty price → cap.
 */
export function maxAffordable(costs: readonly StationCost[], cap = 99): number {
  let n = cap;
  for (const cost of costs) {
    if (cost.need <= 0) continue;
    n = Math.min(n, Math.floor(Math.max(0, cost.have) / cost.need));
  }
  return Math.max(0, n);
}

/** "12,000 Gold + 6 Thornroot" — the price as one line, for aria-labels and summaries. */
export function priceLine(costs: readonly StationCost[]): string {
  return costs.map(cost => `${formatAmount(cost.need)} ${cost.label}`).join(' + ');
}
