/**
 * stat-delta.ts — "what changes if I wear this", as pure functions.
 *
 * Three surfaces ask the same question: the equipment panel's slot picker, the
 * Seamworks satchel slip, and the stat sheet that reacts to an equip. Each used
 * to either do its own subtraction or not answer at all. Everything here is a
 * pure read over stat blocks so it can be specced without mounting anything.
 *
 * Every stat the game has is "more is better", so the sign of a delta is also
 * its direction. If a stat is ever added where less is better, this is the one
 * place that has to learn about it.
 */
import {
  ITEM_STAT_IS_PERCENT,
  ITEM_STAT_KEYS,
  ITEM_STAT_LABELS,
  type ItemStats,
} from './item.model';

export type StatKey = keyof ItemStats;
export type DeltaDirection = 'up' | 'down' | 'same';

export interface StatDeltaRow {
  key: StatKey;
  label: string;
  /** The value with what is worn now. */
  before: number;
  /** The value after the swap. */
  after: number;
  /** `after - before`, rounded to two places. */
  delta: number;
  direction: DeltaDirection;
  /** "Magic Find +4%" / "Strike −0.3" / "Ward ±0". Signed in text, not just colour. */
  text: string;
}

/**
 * Two decimal places, then trailing zeros trimmed. `0.4 - 0.1` is
 * `0.30000000000000004` in IEEE 754 and a chip reading that is worse than none.
 */
export function round2(n: number): number {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
}

/** "+4%", "−0.3", "±0" — the number with a real minus sign and the % suffix. */
export function formatSignedValue(key: StatKey, value: number): string {
  const v = round2(value);
  const pct = ITEM_STAT_IS_PERCENT[key] ? '%' : '';
  if (v === 0) return `±0${pct}`;
  return `${v > 0 ? '+' : '−'}${Math.abs(v)}${pct}`;
}

/** "Magic Find +4%" — label first, the way the panel's mod lines read. */
export function formatDeltaText(key: StatKey, delta: number): string {
  return `${ITEM_STAT_LABELS[key]} ${formatSignedValue(key, delta)}`;
}

/** "+1.3 Strike" — number first, for a floating chip that is read at a glance. */
export function formatDeltaChip(key: StatKey, delta: number): string {
  return `${formatSignedValue(key, delta)} ${ITEM_STAT_LABELS[key]}`;
}

function row(key: StatKey, before: number, after: number): StatDeltaRow {
  const delta = round2(after - before);
  return {
    key,
    label: ITEM_STAT_LABELS[key],
    before: round2(before),
    after: round2(after),
    delta,
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'same',
    text: formatDeltaText(key, delta),
  };
}

export interface CompareOptions {
  /**
   * Keep stats both items carry at the same value, as `direction: 'same'`, so
   * a compare view can show them dimmed instead of silently dropping them.
   * Stats neither item touches are never listed. Default false.
   */
  includeUnchanged?: boolean;
}

/**
 * A candidate's stat block against what is worn in the slot it would take.
 *
 * `worn` may be absent: then every stat the candidate carries is a straight
 * gain from zero. Every stat *either* block touches is considered, so a stat
 * the candidate would lose shows up as a negative rather than by omission.
 * Rows come back in `ITEM_STAT_KEYS` order.
 */
export function compareStats(
  candidate: ItemStats,
  worn: ItemStats | null | undefined,
  options: CompareOptions = {},
): StatDeltaRow[] {
  const rows: StatDeltaRow[] = [];
  for (const key of ITEM_STAT_KEYS) {
    const next = candidate[key] ?? 0;
    const now = worn?.[key] ?? 0;
    if (next === 0 && now === 0) continue;
    const r = row(key, now, next);
    if (r.direction === 'same' && !options.includeUnchanged) continue;
    rows.push(r);
  }
  return rows;
}

/**
 * What changed between two loadout totals — the rows a stat sheet flashes after
 * an equip or unequip. Only stats that moved are returned.
 */
export function totalsDelta(before: ItemStats, after: ItemStats): StatDeltaRow[] {
  const rows: StatDeltaRow[] = [];
  for (const key of ITEM_STAT_KEYS) {
    const r = row(key, before[key] ?? 0, after[key] ?? 0);
    if (r.direction !== 'same') rows.push(r);
  }
  return rows;
}

/** Sum of the signed deltas. A rough "is this an upgrade on balance". */
export function netDelta(rows: readonly StatDeltaRow[]): number {
  return round2(rows.reduce((sum, r) => sum + r.delta, 0));
}
