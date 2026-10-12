/**
 * homestead.model.ts — what each Homestead building shows and offers, derived
 * from REAL service state. Pure: no Angular, no DOM, no clock of its own.
 *
 * Two rules hold everywhere in here:
 *  1. Nothing is credited. Gold, runes and expedition loot are already banked by
 *     EconomyService / ThrallService / ExplorerService the moment they happen.
 *     The "since you were last here" tallies are a *receipt* built from those
 *     services' own after-the-fact events, and collecting one only zeroes the
 *     receipt and plays the animation.
 *  2. Nothing is priced. The one action a building offers is an existing Gold
 *     ladder rung, quoted through the economy's own `nextCost` and bought
 *     through `purchaseListing`; this file only chooses WHICH rung to offer.
 */
import type { HomesteadBuildingId } from '../world/homestead';

/** One rung of an existing ladder, as the chooser needs it. */
export interface RungDef {
  id: string;
  name: string;
  /** What one level adds, in the ladder's own unit (Gold/sec, strikes/sec, multiplier…). */
  gain: number;
}

/** A read-only window onto the economy, so the choice is testable without it. */
export interface RungQuote {
  level(id: string): number;
  cost(id: string): number;
  maxed(id: string): boolean;
}

/**
 * The rung worth buying next: the most `gain` per Gold among the rungs that can
 * still be bought. A free rung wins outright. Ties go to the cheaper rung.
 * Null when every rung is maxed (or there are none).
 */
export function bestRung(rungs: readonly RungDef[], quote: RungQuote): RungDef | null {
  let best: RungDef | null = null;
  let bestValue = -1;
  let bestCost = Infinity;
  for (const rung of rungs) {
    if (quote.maxed(rung.id)) continue;
    const cost = quote.cost(rung.id);
    const value = cost <= 0 ? Infinity : rung.gain / cost;
    if (value > bestValue || (value === bestValue && cost < bestCost)) { best = rung; bestValue = value; bestCost = cost; }
  }
  return best;
}

/** The first rung not yet held, in catalogue order (the one-shot multipliers). */
export function nextUnheld(rungs: readonly RungDef[], quote: RungQuote): RungDef | null {
  return rungs.find(rung => !quote.maxed(rung.id)) ?? null;
}

/** Levels held across a whole ladder: how big a building is drawn. */
export function ladderLevels(rungs: readonly RungDef[], quote: Pick<RungQuote, 'level'>): number {
  return rungs.reduce((sum, rung) => sum + quote.level(rung.id), 0);
}

/** The one big button on a building's panel, or why there isn't one. */
export interface BuildingAction {
  /** The ladder rung it buys. Null when the building is fully built or gated. */
  upgradeId: string | null;
  /** "Upgrade Furnace: Ember Stoker · 20,000 Gold". */
  label: string;
  cost: number;
  affordable: boolean;
  /** One plain sentence when the button cannot be pressed. Empty when it can. */
  locked: string;
}

/** Whole Gold with thousands separators, the way the button reads it. */
export function formatGoldWhole(n: number): string {
  return Math.ceil(Math.max(0, n)).toLocaleString('en-US');
}

/**
 * The building's single action for a chosen rung.
 * `verb` is "Build" for a building that has nothing yet, else the building's own verb.
 */
export function buildingAction(rung: RungDef | null, quote: RungQuote, gold: number, verb: string, gate = ''): BuildingAction {
  if (gate) return { upgradeId: null, label: verb, cost: 0, affordable: false, locked: gate };
  if (!rung) return { upgradeId: null, label: 'Fully built', cost: 0, affordable: false, locked: 'This building is as big as it gets.' };
  const cost = quote.cost(rung.id);
  const price = cost <= 0 ? 'Free' : `${formatGoldWhole(cost)} Gold`;
  const affordable = gold >= cost;
  return {
    upgradeId: rung.id,
    label: `${verb}: ${rung.name} · ${price}`,
    cost,
    affordable,
    locked: affordable ? '' : `You need ${formatGoldWhole(cost - gold)} more Gold.`,
  };
}

// ── "Since you were last here" ──────────────────────────────────────────────

/** What a building has quietly made since the Keeper last walked past it. */
export interface Pending {
  gold: number;
  runes: number;
  returns: number;
}

export type PendingLedger = Record<HomesteadBuildingId, Pending>;

export function emptyLedger(): PendingLedger {
  const zero = (): Pending => ({ gold: 0, runes: 0, returns: 0 });
  return { forge: zero(), treasury: zero(), furnace: zero(), automatons: zero(), camp: zero(), workshop: zero() };
}

export function hasPending(p: Pending): boolean {
  return p.gold >= 1 || p.runes > 0 || p.returns > 0;
}

/** "+1,240 Gold since you were last here" — the line that floats up on collect. */
export function pendingLine(p: Pending): string {
  const parts: string[] = [];
  if (p.gold >= 1) parts.push(`+${formatGoldWhole(Math.floor(p.gold))} Gold`);
  if (p.runes > 0) parts.push(`+${p.runes} ${p.runes === 1 ? 'rune' : 'runes'}`);
  if (p.returns > 0) parts.push(`${p.returns} ${p.returns === 1 ? 'explorer' : 'explorers'} home`);
  return parts.length ? `${parts.join(' · ')} since you were last here` : '';
}

/** How close (world px) the Keeper must pass for a building to hand over its receipt. */
export const COLLECT_REACH = 130;
/** A building standing next to the Keeper batches its receipt this long, so each second's tick is not a pop. */
export const COLLECT_COOLDOWN_MS = 4000;

/**
 * Which buildings the Keeper is collecting from right now. Pure: returns the ids
 * and leaves zeroing the ledger to the caller (who also plays the animation).
 */
export function collectable(
  ledger: PendingLedger,
  buildings: readonly { id: HomesteadBuildingId; x: number }[],
  playerX: number,
  now: number,
  lastCollect: Partial<Record<HomesteadBuildingId, number>>,
): HomesteadBuildingId[] {
  const out: HomesteadBuildingId[] = [];
  for (const b of buildings) {
    if (Math.abs(b.x - playerX) > COLLECT_REACH) continue;
    if (!hasPending(ledger[b.id])) continue;
    if (now - (lastCollect[b.id] ?? -Infinity) < COLLECT_COOLDOWN_MS) continue;
    out.push(b.id);
  }
  return out;
}

// ── The buildings column (Cookie-Clicker simple) ────────────────────────────

/** Which plot building a column rung raises when bought. */
export type ColumnBuilding = 'furnace' | 'automatons';

/** One Gold-per-second ladder rung, as the column lists it. */
export interface ColumnRungDef {
  id: string;
  name: string;
  /** `artFor()` key of its painting (the ladder ids have art of the same name). */
  art: string;
  baseCost: number;
  building: ColumnBuilding;
}

export interface ColumnRow {
  id: string;
  name: string;
  art: string;
  building: ColumnBuilding;
  /** Levels owned. */
  owned: number;
  /** What the next level costs right now (the economy's own quote). */
  cost: number;
  /** Gold/sec the next level adds, everything applied. */
  gain: number;
  affordable: boolean;
  /** Gold still missing; 0 when affordable or maxed. */
  shortfall: number;
  maxed: boolean;
  /** 'mystery' is the single "??? — unlocks at …" row just ahead of the player. */
  state: 'shown' | 'mystery';
  /** Lifetime Gold earned that reveals a mystery row. */
  unlockAt: number;
}

/** A rung shows once lifetime earnings reach this share of its base price (or once one is owned). */
export const REVEAL_SHARE = 0.5;

/**
 * The column's rows, cheapest first: every revealed rung, then exactly one
 * mystery row for the next rung, then nothing. The first rung is always shown,
 * so a brand-new player always has something to look at.
 *
 * `gainOf(id)` is the honest Gold/sec one more level adds (the caller measures
 * it on the real ledger), so a rebalance of rates or multipliers flows through.
 */
export function columnRows(
  defs: readonly ColumnRungDef[], quote: RungQuote, gold: number, earned: number, gainOf: (id: string) => number,
): ColumnRow[] {
  const sorted = [...defs].sort((a, b) => a.baseCost - b.baseCost);
  const rows: ColumnRow[] = [];
  let mystery = false;
  sorted.forEach((def, index) => {
    const owned = quote.level(def.id);
    const unlockAt = Math.ceil(def.baseCost * REVEAL_SHARE);
    const revealed = index === 0 || owned > 0 || earned >= unlockAt;
    if (!revealed && mystery) return;
    const maxed = quote.maxed(def.id);
    const cost = quote.cost(def.id);
    const affordable = !maxed && gold >= cost;
    rows.push({
      id: def.id, name: def.name, art: def.art, building: def.building, owned, cost,
      gain: revealed ? Math.max(0, gainOf(def.id)) : 0,
      affordable, shortfall: affordable || maxed ? 0 : Math.max(0, Math.ceil(cost - gold)), maxed,
      state: revealed ? 'shown' : 'mystery', unlockAt,
    });
    if (!revealed) mystery = true;
  });
  return rows;
}

/** Compact Gold/sec for a row: "+0.5 Gold/s", "+1.2K Gold/s". */
export function formatPerSecond(n: number): string {
  const abs = Math.abs(n);
  const body = abs >= 1e9 ? `${trim(n / 1e9)}B` : abs >= 1e6 ? `${trim(n / 1e6)}M` : abs >= 1e3 ? `${trim(n / 1e3)}K` : trim(n);
  return `+${body} Gold/s`;
}
function trim(n: number): string {
  const fixed = Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(1);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
}

/**
 * Split one idle settlement between the buildings that made it, by the real
 * breakdown's lines (furnace ladder vs automatons; anything else — flat RPG
 * Gold — lands at the Treasury). Shares of an amount already credited.
 */
export function splitIdleGain(amount: number, breakdown: { idle: number; auto: number; rpg: number }): Record<'furnace' | 'automatons' | 'treasury', number> {
  const idle = Math.max(0, breakdown.idle || 0), auto = Math.max(0, breakdown.auto || 0), rpg = Math.max(0, breakdown.rpg || 0);
  const sum = idle + auto + rpg;
  if (!(amount > 0) || !(sum > 0)) return { furnace: Math.max(0, amount || 0), automatons: 0, treasury: 0 };
  return { furnace: amount * idle / sum, automatons: amount * auto / sum, treasury: amount * rpg / sum };
}
