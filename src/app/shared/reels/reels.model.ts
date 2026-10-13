/**
 * reels.model — the Croupier's Reels as data and one pure function.
 *
 * A 3×3 window, five paylines, six symbols from the world. Every cell is drawn
 * independently with the weights below (the odds Details prints are these
 * numbers, nothing hidden). Three of a kind on a line pays; three or more
 * Eclipse anywhere pays and opens the Eclipse Round:
 *
 *   TEN FREE SPINS. Every Ash or Ember rune that lands in the round may carry
 *   a multiplier orb (×2…×50). Orbs are sticky: they add up for the whole
 *   round, and the round's line wins are paid once at the end, times the sum.
 *   Three or more Eclipse inside the round adds five spins (up to 50).
 *
 * The whole outcome (base spin, every free spin, every orb, every prize) is
 * decided by `playReels(rng, bet)` before a single reel moves. The animation
 * only walks toward it, the same for a win and a loss.
 *
 * Gold is counted in TENTHS of the bet so every pay is exact: bets are
 * multiples of 10 (economy-curve GAMES_BET), so `tenths × bet / 10` is whole.
 *
 * Prizes: a winning line of Cinder Ore, Infernal Heartstone, Ash or Ember may
 * also hand over one of that thing (material → the satchel / Vault routing,
 * rune → the Rune Forge ledger). The chance scales with the bet against the
 * thing's worth, so prizes add the same small share of the bet at any stake
 * and can never be farmed cheaper at the minimum bet.
 *
 * Pure and import-free apart from the shared RNG helper, so the node
 * simulator (`scripts/economy-sim.mjs --reels`) runs the exact code that ships.
 */
import { pickWeighted } from '../games/seeded-rng';

export type ReelSymbol = 'cinder' | 'ash' | 'ember' | 'maw' | 'heart' | 'eclipse';

export interface ReelSymbolDef {
  id: ReelSymbol;
  /** What the player sees. World names only. */
  name: string;
  /** Weight of this symbol in each of the nine cells (out of `CELL_WEIGHT_TOTAL`). */
  weight: number;
  /** Three on a line pays this many tenths of the bet. 0 = scatter only. */
  pay: number;
  /** One of this thing may come with a winning line. */
  prize?: ReelPrizeDef;
}

export interface ReelPrizeDef {
  kind: 'material' | 'rune';
  /** Material stack key or rune id. */
  id: string;
  /** Gold worth on the ρ-scaled ladder (exchange base × 0.06; rune tier worth). */
  worth: number;
}

/** Low to high. Eclipse is the scatter and the top symbol. */
export const REEL_SYMBOLS: readonly ReelSymbolDef[] = [
  { id: 'cinder', name: 'Cinder Ore', weight: 29, pay: 10, prize: { kind: 'material', id: 'cinder-ore', worth: 25 } },
  { id: 'ash', name: 'Ash rune', weight: 24, pay: 20, prize: { kind: 'rune', id: 'ash', worth: 600 } },
  { id: 'ember', name: 'Ember rune', weight: 18, pay: 50, prize: { kind: 'rune', id: 'ember', worth: 600 } },
  { id: 'maw', name: 'Rivet Maw', weight: 14, pay: 100 },
  { id: 'heart', name: 'Infernal Heartstone', weight: 10, pay: 300, prize: { kind: 'material', id: 'infernal-heartstone', worth: 5_700 } },
  { id: 'eclipse', name: 'Eclipse', weight: 5, pay: 0 },
];

export const CELL_WEIGHT_TOTAL = REEL_SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
const WEIGHTS = REEL_SYMBOLS.map(s => s.weight);
const SYMBOL_BY_ID = new Map(REEL_SYMBOLS.map(s => [s.id, s]));
export function reelSymbol(id: ReelSymbol): ReelSymbolDef {
  return SYMBOL_BY_ID.get(id)!;
}

/** Cells are row-major: index = row * 3 + reel. */
export const PAYLINES: readonly (readonly [number, number, number])[] = [
  [3, 4, 5], // middle row
  [0, 1, 2], // top row
  [6, 7, 8], // bottom row
  [0, 4, 8], // diagonal down
  [6, 4, 2], // diagonal up
];

/** Eclipse anywhere: count → tenths of the bet. 3+ also opens the round. */
export const SCATTER_PAY: Readonly<Record<number, number>> = { 3: 20, 4: 100, 5: 500 };
export const SCATTER_TRIGGER = 3;
export const FREE_SPINS = 10;
export const RETRIGGER_SPINS = 5;
export const MAX_FREE_SPINS = 50;

/** In the round: the chance an Ash or Ember cell carries an orb, and the orb values. */
export const ORB_CHANCE = 0.0215;
export const ORB_VALUES: readonly { value: number; weight: number }[] = [
  { value: 2, weight: 520 },
  { value: 3, weight: 290 },
  { value: 5, weight: 130 },
  { value: 10, weight: 46 },
  { value: 25, weight: 11 },
  { value: 50, weight: 3 },
];
const ORB_WEIGHTS = ORB_VALUES.map(o => o.weight);
const ORB_TOTAL = ORB_WEIGHTS.reduce((a, b) => a + b, 0);

/** No single play pays more than this many times the bet. */
export const MAX_WIN_X = 5_000;

/** A prize's chance on a winning line = min(1, bet × this / worth). */
export const PRIZE_SHARE = 0.03;

export interface LineWin { line: number; symbol: ReelSymbol; tenths: number }
export interface ReelOrb { cell: number; value: number }

export interface ReelSpin {
  cells: ReelSymbol[];
  lines: LineWin[];
  eclipses: number;
  /** Free spins only: orbs that landed this spin. */
  orbs: ReelOrb[];
}

export interface ReelPrize { kind: 'material' | 'rune'; id: string; name: string; worth: number }

export interface ReelsBonus {
  spins: ReelSpin[];
  /** Line wins of every free spin, before the multiplier. */
  lineTenths: number;
  /** Sum of every orb (0 when none landed; the round then pays ×1). */
  orbSum: number;
  /** Tenths of the bet the round pays (lines × max(1, orbSum)). */
  tenths: number;
  retriggers: number;
}

export interface ReelsOutcome {
  bet: number;
  base: ReelSpin;
  /** Base lines + the Eclipse scatter pay, tenths of the bet. */
  baseTenths: number;
  bonus: ReelsBonus | null;
  /** Everything, after the cap. */
  tenths: number;
  /** Gold paid. */
  win: number;
  prizes: ReelPrize[];
}

function drawCells(rng: () => number): ReelSymbol[] {
  const cells: ReelSymbol[] = [];
  for (let i = 0; i < 9; i++) cells.push(REEL_SYMBOLS[pickWeighted(WEIGHTS, CELL_WEIGHT_TOTAL, rng)].id);
  return cells;
}

/** Line wins on a window. */
export function lineWins(cells: readonly ReelSymbol[]): LineWin[] {
  const out: LineWin[] = [];
  PAYLINES.forEach(([a, b, c], line) => {
    const s = cells[a];
    if (s === cells[b] && s === cells[c]) {
      const pay = reelSymbol(s).pay;
      if (pay > 0) out.push({ line, symbol: s, tenths: pay });
    }
  });
  return out;
}

export function countEclipses(cells: readonly ReelSymbol[]): number {
  let n = 0;
  for (const c of cells) if (c === 'eclipse') n++;
  return n;
}

export function scatterTenths(eclipses: number): number {
  if (eclipses < SCATTER_TRIGGER) return 0;
  return SCATTER_PAY[Math.min(5, eclipses)] ?? 0;
}

function spin(rng: () => number, free: boolean): ReelSpin {
  const cells = drawCells(rng);
  const orbs: ReelOrb[] = [];
  if (free) {
    cells.forEach((s, cell) => {
      if ((s === 'ash' || s === 'ember') && rng() < ORB_CHANCE) {
        orbs.push({ cell, value: ORB_VALUES[pickWeighted(ORB_WEIGHTS, ORB_TOTAL, rng)].value });
      }
    });
  }
  return { cells, lines: lineWins(cells), eclipses: countEclipses(cells), orbs };
}

function rollPrizes(lines: readonly LineWin[], bet: number, rng: () => number, out: ReelPrize[]): void {
  for (const l of lines) {
    const def = reelSymbol(l.symbol);
    const p = def.prize;
    if (!p) continue;
    if (rng() < Math.min(1, (bet * PRIZE_SHARE) / p.worth)) out.push({ ...p, name: def.name });
  }
}

/** Gold for tenths of a bet. Bets are multiples of 10, so this is exact. */
export function goldFor(tenths: number, bet: number): number {
  return Math.floor((tenths * bet) / 10);
}

/** The Eclipse Round on its own: free spins until none are left. */
export function eclipseRound(rng: () => number, bet: number, prizes: ReelPrize[] = []): ReelsBonus {
  const spins: ReelSpin[] = [];
  let left = FREE_SPINS;
  let total = FREE_SPINS;
  let lineTenths = 0;
  let orbSum = 0;
  let retriggers = 0;
  while (left > 0) {
    left--;
    const s = spin(rng, true);
    spins.push(s);
    lineTenths += s.lines.reduce((sum, l) => sum + l.tenths, 0);
    for (const o of s.orbs) orbSum += o.value;
    rollPrizes(s.lines, bet, rng, prizes);
    if (s.eclipses >= SCATTER_TRIGGER && total < MAX_FREE_SPINS) {
      const add = Math.min(RETRIGGER_SPINS, MAX_FREE_SPINS - total);
      left += add;
      total += add;
      retriggers++;
    }
  }
  return { spins, lineTenths, orbSum, tenths: lineTenths * Math.max(1, orbSum), retriggers };
}

/** One whole play: the base spin and, if it opens, the full Eclipse Round. */
export function playReels(rng: () => number, bet: number): ReelsOutcome {
  const prizes: ReelPrize[] = [];
  const base = spin(rng, false);
  const baseTenths = base.lines.reduce((s, l) => s + l.tenths, 0) + scatterTenths(base.eclipses);
  rollPrizes(base.lines, bet, rng, prizes);
  const bonus = base.eclipses >= SCATTER_TRIGGER ? eclipseRound(rng, bet, prizes) : null;
  const tenths = Math.min(MAX_WIN_X * 10, baseTenths + (bonus?.tenths ?? 0));
  return { bet, base, baseTenths, bonus, tenths, win: goldFor(tenths, bet), prizes };
}

export interface ReelsTheory {
  /** Base-game line pays per play, × bet (exact). */
  baseLines: number;
  /** Eclipse scatter pays per play, × bet (exact). */
  scatter: number;
  /** Chance a play opens the round (exact). */
  trigger: number;
  /** Simulated rounds: mean and standard deviation of the round's pay, × bet. */
  roundMean: number;
  roundSd: number;
  /** Mean free spins per round (retriggers included). */
  roundSpins: number;
  /** Gold returned per Gold bet. */
  goldRtp: number;
  /** Standard error of `goldRtp` from the simulated rounds. */
  goldRtpSe: number;
  /** One standard deviation of a 1e6-play RTP measurement. */
  sdOf1e6: number;
}

/**
 * The RTP proof: everything that can be computed exactly is (lines, scatter,
 * trigger), and only the Eclipse Round is simulated, `rounds` times. Prizes
 * are priced by `prizeRtp(bet, theory)`.
 */
export function reelsTheory(rng: () => number, rounds: number): ReelsTheory {
  let baseLines = 0;
  for (const s of REEL_SYMBOLS) baseLines += PAYLINES.length * cellChance(s.id) ** 3 * (s.pay / 10);
  const p = cellChance('eclipse');
  let scatter = 0;
  let choose = 1;
  for (let k = 0; k <= 9; k++) {
    scatter += choose * p ** k * (1 - p) ** (9 - k) * (scatterTenths(k) / 10);
    choose = (choose * (9 - k)) / (k + 1);
  }
  const trigger = bonusChance();
  let sum = 0, sq = 0, spins = 0;
  for (let i = 0; i < rounds; i++) {
    const r = eclipseRound(rng, 10);
    const v = Math.min(MAX_WIN_X * 10, r.tenths) / 10;
    sum += v; sq += v * v; spins += r.spins.length;
  }
  const roundMean = sum / rounds;
  const roundSd = Math.sqrt(Math.max(0, sq / rounds - roundMean * roundMean));
  return {
    baseLines, scatter, trigger, roundMean, roundSd,
    roundSpins: spins / rounds,
    goldRtp: baseLines + scatter + trigger * roundMean,
    goldRtpSe: (trigger * roundSd) / Math.sqrt(rounds),
    sdOf1e6: Math.sqrt(trigger * (roundSd * roundSd + roundMean * roundMean)) / 1000,
  };
}

/** Prize worth returned per Gold bet at this stake, given the round's mean length. */
export function prizeRtp(bet: number, theory: Pick<ReelsTheory, 'trigger' | 'roundSpins'>): number {
  const spinsPerPlay = 1 + theory.trigger * theory.roundSpins;
  let perSpin = 0;
  for (const s of REEL_SYMBOLS) {
    if (!s.prize) continue;
    const chance = Math.min(1, (bet * PRIZE_SHARE) / s.prize.worth);
    perSpin += PAYLINES.length * cellChance(s.id) ** 3 * chance * s.prize.worth;
  }
  return (perSpin * spinsPerPlay) / bet;
}

/** Gold worth of everything a play returns (paid Gold + prize worth). For the RTP. */
export function reelsReturn(o: ReelsOutcome): number {
  return o.win + o.prizes.reduce((s, p) => s + p.worth, 0);
}

/** Exact chance a play opens the Eclipse Round (3+ of 9 independent cells). */
export function bonusChance(): number {
  const p = cellChance('eclipse');
  let below = 0;
  let choose = 1;
  for (let k = 0; k < SCATTER_TRIGGER; k++) {
    below += choose * p ** k * (1 - p) ** (9 - k);
    choose = (choose * (9 - k)) / (k + 1);
  }
  return 1 - below;
}

/**
 * What Details prints. Proven, not hoped: `node scripts/economy-sim.mjs
 * --reels` computes `goldRtp` as base lines + scatter (exact) + the Eclipse
 * Round (2e6 simulated rounds, standard error ~0.03 points) and fails when it
 * drifts more than half a point from this; the Karma spec plays 1e6 whole
 * spins and fails beyond one point. Prizes add ~0.7 points at small bets and
 * fall toward 0 at large ones (their chance is capped at 1), so `rtp` is the
 * small-bet total and `goldRtp` the floor.
 */
export const REELS_STATS = { rtp: 0.928, goldRtp: 0.921, hitOneIn: 4.5 } as const;

/** The chance one cell shows this symbol, for Details. */
export function cellChance(id: ReelSymbol): number {
  return reelSymbol(id).weight / CELL_WEIGHT_TOTAL;
}
