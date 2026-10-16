/**
 * cascade.model — cluster-pays tumbling machines as data and one pure function.
 *
 * Two machines run on this engine (docs/handoff/eclipse-cascade.md):
 *
 *  - **Eclipse Cascade** (`ECLIPSE_CASCADE`, the Mirror Slate's app beside the
 *    Reels): a 10×10 grid of runes. Five or more of a kind joined edge to edge
 *    pay by the size of the cluster; the winners burst and new runes fall in
 *    from above, again and again until nothing more joins (a tumble). A cell
 *    that bursts twice becomes a **multiplier spot** (×2), doubling each time a
 *    win bursts on it again, up to ×1,024; a cluster pays its own pay × the sum
 *    of the spots under it. Spots clear on every paid spin. Three Eclipse
 *    anywhere open ten free spins where the spots stay for the whole round
 *    (sticky); four or more open the **Super Bonus**: every cell starts at ×2.
 *  - **The Orrery Tumbler** (`ORRERY_TUMBLER`, found in the Orrery Wells): a
 *    7×7 brass orrery whose down turns after every tumble (the new stars fall
 *    up, then down, then up), and a climbing **orbit ladder** instead of spots:
 *    each tumble of one spin multiplies its wins by the next rung (×1, ×2, ×3,
 *    ×5, ×8). In its round the ladder is sticky: it climbs one rung per tumble
 *    for the whole round (to ×50); the Super Bonus starts on ×5.
 *
 * The whole play (the base spin, every tumble, every free spin) is decided by
 * `playCascade(machine, rng, bet)` before anything moves; the animation only
 * walks it. The ledger stores a small `CascadeSummary` (what was paid, the final
 * window) and the seed: the full play is re-derived from the seed to animate it
 * (`replayCascade`), so a saved play is a few hundred bytes, not a film.
 *
 * Gold is counted in TENTHS of the bet, so every pay is whole Gold (bets are
 * multiples of 10, economy-curve GAMES_BET) and every machine pays the same
 * share of the bet at every stake: RTP does not depend on the bet.
 *
 * Pure and import-free apart from the shared RNG helper and the curve, so the
 * node simulator (`scripts/economy-sim.mjs --cascade`) runs the code that ships.
 */
import { pickWeighted } from '../games/seeded-rng';
import { GAMES_MAX_WIN_X } from '../economy/economy-curve';

export interface CascadeSymbolDef {
  /** One letter in the stored window ('a'…). */
  code: string;
  /** What the player sees. World names only. */
  name: string;
  /** Weight in every cell drawn (out of the machine's total). */
  weight: number;
  /** Tenths of the bet by cluster size: index 0 = the smallest paying cluster, the last = that size and up. */
  pays: readonly number[];
}

export type CascadeGravity = 'down' | 'flip';
export type CascadeBoost = 'spots' | 'ladder';

export interface CascadeMachine {
  id: string;
  rows: number;
  cols: number;
  /** The smallest cluster that pays. */
  minCluster: number;
  /** Paying symbols, low to high. */
  symbols: readonly CascadeSymbolDef[];
  /** Wild: joins any cluster, pays nothing on its own. */
  wildWeight: number;
  /** In the round wilds come thicker: the spots grow on them. */
  freeWildWeight: number;
  /** The scatter (the Eclipse / the Comet): only in the first fall of a spin, never bursts, counted on the settled window. */
  scatterWeight: number;
  /** In free spins the scatter is a little rarer (a retrigger is a treat, not a loop). */
  freeScatterWeight: number;
  gravity: CascadeGravity;
  boost: CascadeBoost;
  /** Spots: the top of a spot, and where a Super Bonus spot starts. */
  spotCap: number;
  /** A Super Bonus spot starts here. */
  superSpot: number;
  /** Ladder: the rungs of a paid spin (one per tumble, back to the first every spin). */
  ladder: readonly number[];
  /** Ladder: the round's rungs. Sticky: one rung per tumble for the whole round. */
  freeLadder: readonly number[];
  /** Ladder: the rung (index into `freeLadder`) a Super Bonus starts on. */
  superLadderStart: number;
  /** Scatters on the settled window → the round. */
  freeTrigger: number;
  superTrigger: number;
  /** Scatter pays on the settled window (count → tenths of the bet). */
  scatterPays: Readonly<Record<number, number>>;
  freeSpins: number;
  retriggerSpins: number;
  maxSpins: number;
  /** No single play pays more than this many times the bet. */
  maxWinX: number;
  /** A guard: a spin that has tumbled this many times stops (it never happens; the sim reports it). */
  maxTumbles: number;
}

/** The stored window: one letter a cell, row-major from the top-left. Wild 'W', scatter 'S'. */
export const WILD_CODE = 'W';
export const SCATTER_CODE = 'S';

/** The runes of the Eclipse Cascade, low to high (the Rune Forge's own names). */
export const ECLIPSE_CASCADE: CascadeMachine = {
  id: 'eclipse-cascade',
  rows: 10,
  cols: 10,
  minCluster: 5,
  //            size:  5   6   7   8   9  10  11  12  13  14 15+
  symbols: [
    { code: 'a', name: 'Ash', weight: 150, pays: [3, 4, 7, 9, 11, 13, 17, 22, 28, 34, 56] },
    { code: 'b', name: 'Ember', weight: 145, pays: [4, 6, 7, 9, 11, 16, 20, 25, 31, 39, 67] },
    { code: 'c', name: 'Thorn', weight: 140, pays: [6, 7, 9, 11, 13, 18, 22, 28, 36, 45, 84] },
    { code: 'd', name: 'Glint', weight: 135, pays: [7, 8, 10, 13, 17, 20, 27, 34, 45, 56, 112] },
    { code: 'e', name: 'Pulse', weight: 130, pays: [8, 9, 11, 16, 20, 25, 31, 40, 54, 67, 140] },
    { code: 'f', name: 'Sigil', weight: 125, pays: [9, 11, 13, 18, 22, 29, 38, 50, 67, 90, 168] },
    { code: 'g', name: 'Nexus', weight: 120, pays: [11, 13, 18, 22, 28, 36, 47, 62, 84, 112, 280] },
    { code: 'h', name: 'Fracture', weight: 115, pays: [17, 20, 27, 34, 45, 56, 73, 95, 123, 168, 560] },
  ],
  wildWeight: 4,
  freeWildWeight: 50,
  scatterWeight: 4,
  freeScatterWeight: 3,
  gravity: 'down',
  boost: 'spots',
  spotCap: 1024,
  superSpot: 2,
  ladder: [1],
  freeLadder: [1],
  superLadderStart: 0,
  freeTrigger: 3,
  superTrigger: 4,
  scatterPays: { 3: 20, 4: 100, 5: 300, 6: 1000 },
  freeSpins: 10,
  retriggerSpins: 5,
  maxSpins: 50,
  maxWinX: GAMES_MAX_WIN_X,
  maxTumbles: 200,
};

/** The Orrery Tumbler (the Orrery Wells): 7×7, the down turns each tumble, an orbit ladder. */
export const ORRERY_TUMBLER: CascadeMachine = {
  id: 'orrery-tumbler',
  rows: 7,
  cols: 7,
  minCluster: 5,
  //            size:  5   6   7   8   9  10  11  12  13  14 15+
  symbols: [
    { code: 'a', name: 'Brass Cog', weight: 140, pays: [2, 4, 5, 6, 7, 10, 12, 14, 18, 24, 36] },
    { code: 'b', name: 'Starsteel', weight: 135, pays: [4, 5, 6, 7, 10, 12, 14, 18, 24, 30, 48] },
    { code: 'c', name: 'Meridian Glass', weight: 130, pays: [5, 6, 7, 10, 12, 14, 18, 24, 30, 36, 60] },
    { code: 'd', name: 'Orrery Ring', weight: 125, pays: [6, 7, 10, 12, 14, 18, 24, 30, 36, 48, 90] },
    { code: 'e', name: 'Star-chain', weight: 120, pays: [7, 10, 12, 14, 18, 24, 30, 36, 48, 60, 120] },
    { code: 'f', name: 'The Ephemeris', weight: 115, pays: [12, 14, 18, 24, 30, 36, 48, 60, 72, 96, 240] },
  ],
  wildWeight: 4,
  freeWildWeight: 24,
  scatterWeight: 6,
  freeScatterWeight: 5,
  gravity: 'flip',
  boost: 'ladder',
  spotCap: 1,
  superSpot: 1,
  ladder: [1, 2, 3, 5, 8],
  freeLadder: [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50],
  superLadderStart: 4,
  freeTrigger: 3,
  superTrigger: 4,
  scatterPays: { 3: 20, 4: 100, 5: 300 },
  freeSpins: 10,
  retriggerSpins: 5,
  maxSpins: 50,
  maxWinX: GAMES_MAX_WIN_X,
  maxTumbles: 200,
};

/**
 * What Details prints, proven: `node scripts/economy-sim.mjs --cascade` runs the
 * stratified proof (`cascadeProof`: the round chances exact, the base game and
 * both rounds simulated apart) and fails when the RTP drifts more than half a
 * point from `rtp`; `--check` runs a smaller one. Karma replays whole spins.
 * The return is the same at every bet: everything is tenths of the bet, Gold only.
 */
export const CASCADE_STATS: Readonly<Record<string, { rtp: number; hitOneIn: number }>> = {
  'eclipse-cascade': { rtp: 0.942, hitOneIn: 2.4 },
  'orrery-tumbler': { rtp: 0.940, hitOneIn: 2.4 },
};

export const CASCADE_MACHINES: Readonly<Record<string, CascadeMachine>> = {
  [ECLIPSE_CASCADE.id]: ECLIPSE_CASCADE,
  [ORRERY_TUMBLER.id]: ORRERY_TUMBLER,
};

// ── Cells ───────────────────────────────────────────────────────────────────
// A cell is a number: 0..n-1 the paying symbols, n the wild, n+1 the scatter.

export function wildOf(m: CascadeMachine): number { return m.symbols.length; }
export function scatterOf(m: CascadeMachine): number { return m.symbols.length + 1; }

interface Weights { base: number[]; free: number[]; refill: number[]; refillFree: number[]; baseTotal: number; freeTotal: number; refillTotal: number; refillFreeTotal: number }
const WEIGHTS = new Map<CascadeMachine, Weights>();
function weights(m: CascadeMachine): Weights {
  let w = WEIGHTS.get(m);
  if (!w) {
    const sym = m.symbols.map(s => s.weight);
    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
    const base = [...sym, m.wildWeight, m.scatterWeight];
    const free = [...sym, m.freeWildWeight, m.freeScatterWeight];
    // Refills never bring a scatter: the Eclipses come with the first fall only, so the
    // chance of a round is exact (a binomial over the first window) and Details can print it.
    const refill = [...sym, m.wildWeight, 0];
    const refillFree = [...sym, m.freeWildWeight, 0];
    w = { base, free, refill, refillFree, baseTotal: sum(base), freeTotal: sum(free), refillTotal: sum(refill), refillFreeTotal: sum(refillFree) };
    WEIGHTS.set(m, w);
  }
  return w;
}

/** One cell's chance of each symbol (base game), for Details. */
export function cellChances(m: CascadeMachine): { code: string; chance: number }[] {
  const w = weights(m);
  const codes = [...m.symbols.map(s => s.code), WILD_CODE, SCATTER_CODE];
  return codes.map((code, i) => ({ code, chance: w.base[i] / w.baseTotal }));
}

export function codeOf(m: CascadeMachine, cell: number): string {
  if (cell === wildOf(m)) return WILD_CODE;
  if (cell === scatterOf(m)) return SCATTER_CODE;
  return m.symbols[cell]?.code ?? '?';
}

export function windowText(m: CascadeMachine, grid: readonly number[]): string {
  let s = '';
  for (const c of grid) s += codeOf(m, c);
  return s;
}

export function parseWindow(m: CascadeMachine, text: string): number[] {
  const out: number[] = [];
  for (const ch of text) {
    if (ch === WILD_CODE) out.push(wildOf(m));
    else if (ch === SCATTER_CODE) out.push(scatterOf(m));
    else out.push(Math.max(0, m.symbols.findIndex(s => s.code === ch)));
  }
  return out;
}

function draw(m: CascadeMachine, rng: () => number, free: boolean, refill = false): number {
  const w = weights(m);
  if (refill) return free ? pickWeighted(w.refillFree, w.refillFreeTotal, rng) : pickWeighted(w.refill, w.refillTotal, rng);
  return free ? pickWeighted(w.free, w.freeTotal, rng) : pickWeighted(w.base, w.baseTotal, rng);
}

/** A fresh window, row-major. */
export function fillWindow(m: CascadeMachine, rng: () => number, free: boolean): number[] {
  const out: number[] = new Array(m.rows * m.cols);
  for (let i = 0; i < out.length; i++) out[i] = draw(m, rng, free);
  return out;
}

// ── Clusters ────────────────────────────────────────────────────────────────

export interface Cluster {
  /** The paying symbol (index into `symbols`). */
  symbol: number;
  /** Cells, ascending. Wilds included. */
  cells: number[];
}

/**
 * Every paying cluster on a window: for each paying symbol, the cells of that
 * symbol joined edge to edge (up, down, left, right; never diagonally) with
 * wilds joining any of them, `minCluster` or more cells and at least one real
 * symbol. A wild can belong to clusters of two symbols at once.
 */
export function findClusters(m: CascadeMachine, grid: readonly number[]): Cluster[] {
  const { rows, cols } = m;
  const wild = wildOf(m);
  const out: Cluster[] = [];
  const seen = new Int32Array(rows * cols).fill(-1);
  const stack: number[] = [];
  for (let s = 0; s < m.symbols.length; s++) {
    for (let start = 0; start < grid.length; start++) {
      if (grid[start] !== s || seen[start] === s) continue;
      const cells: number[] = [];
      seen[start] = s;
      stack.length = 0;
      stack.push(start);
      while (stack.length) {
        const i = stack.pop()!;
        cells.push(i);
        const r = (i / cols) | 0, c = i - r * cols;
        if (r > 0) visit(i - cols);
        if (r < rows - 1) visit(i + cols);
        if (c > 0) visit(i - 1);
        if (c < cols - 1) visit(i + 1);
      }
      if (cells.length >= m.minCluster) out.push({ symbol: s, cells: cells.sort((a, b) => a - b) });
    }
    function visit(j: number): void {
      if (seen[j] === s) return;
      const v = grid[j];
      if (v !== s && v !== wild) return;
      seen[j] = s;
      stack.push(j);
    }
  }
  return out;
}

/** Tenths of the bet a cluster of `size` pays for `symbol`, before any multiplier. */
export function clusterPay(m: CascadeMachine, symbol: number, size: number): number {
  const pays = m.symbols[symbol].pays;
  if (size < m.minCluster) return 0;
  return pays[Math.min(pays.length - 1, size - m.minCluster)];
}

// ── Gravity ─────────────────────────────────────────────────────────────────

/**
 * Remove `burst` cells and let the rest fall toward `dir` (1 = down, -1 = up);
 * new symbols fill the emptied end of each column. Columns left to right; in
 * each, new cells are drawn from the far end inward (the RNG order is fixed, so
 * a seed is one exact play). Returns the new window and which cells are new.
 */
export function tumble(m: CascadeMachine, grid: readonly number[], burst: ReadonlySet<number>, dir: 1 | -1, rng: () => number, free: boolean): { grid: number[]; fresh: number[] } {
  const { rows, cols } = m;
  const next = new Array<number>(grid.length);
  const fresh: number[] = [];
  for (let c = 0; c < cols; c++) {
    const kept: number[] = [];
    // Walk the column from its landing end, keeping survivors in order.
    for (let k = 0; k < rows; k++) {
      const r = dir === 1 ? rows - 1 - k : k;
      const i = r * cols + c;
      if (!burst.has(i)) kept.push(grid[i]);
    }
    for (let k = 0; k < rows; k++) {
      const r = dir === 1 ? rows - 1 - k : k;
      const i = r * cols + c;
      if (k < kept.length) next[i] = kept[k];
    }
    // The emptied end: draw from the far edge inward.
    for (let k = rows - 1; k >= kept.length; k--) {
      const r = dir === 1 ? rows - 1 - k : k;
      const i = r * cols + c;
      next[i] = draw(m, rng, free, true);
      fresh.push(i);
    }
  }
  return { grid: next, fresh };
}

// ── Multiplier spots ────────────────────────────────────────────────────────

/**
 * One burst on a cell: an unmarked cell is marked (1), a marked cell becomes a
 * ×2 spot, a spot doubles, up to `cap`. 0 = unmarked; 1 = marked (pays ×1).
 */
export function bumpSpot(value: number, cap: number): number {
  if (value <= 0) return 1;
  if (value === 1) return Math.min(cap, 2);
  return Math.min(cap, value * 2);
}

/** What a cluster is multiplied by: the sum of the ×2+ spots under it, or 1 when there are none. */
export function spotMultiplier(spots: readonly number[], cells: readonly number[]): number {
  let sum = 0;
  for (const i of cells) if (spots[i] >= 2) sum += spots[i];
  return sum > 0 ? sum : 1;
}

// ── A spin ──────────────────────────────────────────────────────────────────

export interface ClusterWin { symbol: number; cells: number[]; tenths: number; mult: number }

export interface CascadeStep {
  /** The window this step's clusters burst on. */
  window: number[];
  wins: ClusterWin[];
  /** Spots after this step's bursts. */
  spots: number[];
  /** Which way the new cells fell after it (1 down, -1 up). */
  dir: 1 | -1;
  /** The orbit ladder's rung for this step (ladder machines; 1 for spots). */
  rung: number;
}

export interface CascadeSpin {
  start: number[];
  steps: CascadeStep[];
  /** The window when nothing more joins. */
  final: number[];
  spotsStart: number[];
  spotsEnd: number[];
  scatters: number;
  /** Cluster wins of the spin (tenths of the bet), multipliers applied. */
  tenths: number;
  /** Scatter pay on the settled window (base game only). */
  scatterTenths: number;
  /** Ladder: the round's rung index after this spin (sticky in a round). */
  rungEnd: number;
}

/**
 * One spin with its whole tumble chain. `spotsIn` is the round's spots (a new
 * array comes back in the spin); `rungIn` the round's ladder index (0 in a paid spin).
 */
export function spinCascade(m: CascadeMachine, rng: () => number, mode: 'base' | 'free' | 'super', spotsIn: readonly number[], rungIn = 0): CascadeSpin {
  const free = mode !== 'base';
  const start = fillWindow(m, rng, free);
  let grid = start;
  let spots = [...spotsIn];
  const steps: CascadeStep[] = [];
  const ladder = mode === 'base' ? m.ladder : m.freeLadder;
  const from = mode === 'base' ? 0 : rungIn;
  let dir: 1 | -1 = 1;
  let tenths = 0;
  for (let n = 0; n < m.maxTumbles; n++) {
    const clusters = findClusters(m, grid);
    if (!clusters.length) break;
    const rung = m.boost === 'ladder' ? ladder[Math.min(ladder.length - 1, from + n)] : 1;
    const wins: ClusterWin[] = clusters.map(cl => {
      const base = clusterPay(m, cl.symbol, cl.cells.length);
      const mult = m.boost === 'spots' ? spotMultiplier(spots, cl.cells) : rung;
      return { symbol: cl.symbol, cells: cl.cells, tenths: base * mult, mult };
    });
    for (const w of wins) tenths += w.tenths;
    const burst = new Set<number>();
    for (const cl of clusters) for (const i of cl.cells) burst.add(i);
    if (m.boost === 'spots') {
      spots = [...spots];
      for (const i of burst) spots[i] = bumpSpot(spots[i], m.spotCap);
    }
    steps.push({ window: grid, wins, spots, dir, rung });
    grid = tumble(m, grid, burst, dir, rng, free).grid;
    if (m.gravity === 'flip') dir = dir === 1 ? -1 : 1;
  }
  const scatter = scatterOf(m);
  let scatters = 0;
  for (const c of grid) if (c === scatter) scatters++;
  return {
    start, steps, final: grid, spotsStart: [...spotsIn], spotsEnd: spots, scatters, tenths,
    scatterTenths: mode === 'base' ? scatterPay(m, scatters) : 0,
    rungEnd: from + steps.length,
  };
}

export function scatterPay(m: CascadeMachine, scatters: number): number {
  let best = 0;
  for (const [k, v] of Object.entries(m.scatterPays)) if (scatters >= Number(k)) best = Math.max(best, v);
  return best;
}

// ── A whole play ────────────────────────────────────────────────────────────

export type CascadeBonusKind = 'free' | 'super';

export interface CascadeBonus {
  kind: CascadeBonusKind;
  spins: CascadeSpin[];
  /** Tenths of the bet the round pays. */
  tenths: number;
  retriggers: number;
  /** The largest spot (or rung) the round reached. */
  top: number;
}

export interface CascadeOutcome {
  machine: string;
  bet: number;
  base: CascadeSpin;
  /** Base clusters + scatter pay, tenths of the bet. */
  baseTenths: number;
  bonus: CascadeBonus | null;
  /** Everything, after the cap. */
  tenths: number;
  capped: boolean;
  /** Gold paid. */
  win: number;
}

/** Gold for tenths of a bet. Bets are multiples of 10, so this is exact. */
export function goldFor(tenths: number, bet: number): number {
  return Math.floor((tenths * bet) / 10);
}

export function emptySpots(m: CascadeMachine): number[] {
  return new Array<number>(m.rows * m.cols).fill(0);
}

/** The bonus round on its own: free spins until none are left. Spots stay for the whole round. */
export function cascadeRound(m: CascadeMachine, rng: () => number, kind: CascadeBonusKind): CascadeBonus {
  const mode = kind === 'super' ? 'super' : 'free';
  let spots = m.boost === 'spots' && kind === 'super' ? new Array<number>(m.rows * m.cols).fill(m.superSpot) : emptySpots(m);
  let rung = kind === 'super' ? m.superLadderStart : 0;
  const spins: CascadeSpin[] = [];
  let left = m.freeSpins;
  let total = m.freeSpins;
  let tenths = 0;
  let retriggers = 0;
  let top = 0;
  while (left > 0) {
    left--;
    const s = spinCascade(m, rng, mode, spots, rung);
    spins.push(s);
    spots = s.spotsEnd;
    rung = s.rungEnd;
    tenths += s.tenths;
    for (const st of s.steps) top = Math.max(top, st.rung);
    for (const v of spots) if (v > top) top = v;
    if (s.scatters >= m.freeTrigger && total < m.maxSpins) {
      const add = Math.min(m.retriggerSpins, m.maxSpins - total);
      left += add;
      total += add;
      retriggers++;
    }
  }
  return { kind, spins, tenths, retriggers, top };
}

/** One whole play: the base spin with its tumbles and, if it opens, the full round. */
export function playCascade(m: CascadeMachine, rng: () => number, bet: number): CascadeOutcome {
  const base = spinCascade(m, rng, 'base', emptySpots(m));
  const baseTenths = base.tenths + base.scatterTenths;
  const kind: CascadeBonusKind | null = base.scatters >= m.superTrigger ? 'super' : base.scatters >= m.freeTrigger ? 'free' : null;
  const bonus = kind ? cascadeRound(m, rng, kind) : null;
  const raw = baseTenths + (bonus?.tenths ?? 0);
  const capTenths = m.maxWinX * 10;
  const tenths = Math.min(capTenths, raw);
  return { machine: m.id, bet, base, baseTenths, bonus, tenths, capped: raw > capTenths, win: goldFor(tenths, bet) };
}

// ── What the ledger keeps ───────────────────────────────────────────────────

/** The small record a play is stored as. The full play is re-derived from the seed (`replayCascade`). */
export interface CascadeSummary {
  machine: string;
  bet: number;
  win: number;
  tenths: number;
  baseTenths: number;
  /** The base spin's settled window (one letter a cell). */
  window: string;
  tumbles: number;
  scatters: number;
  bonus: { kind: CascadeBonusKind; spins: number; retriggers: number; tenths: number; top: number } | null;
  capped: boolean;
}

export function summarize(o: CascadeOutcome, m: CascadeMachine = CASCADE_MACHINES[o.machine]): CascadeSummary {
  return {
    machine: o.machine, bet: o.bet, win: o.win, tenths: o.tenths, baseTenths: o.baseTenths,
    window: windowText(m, o.base.final),
    tumbles: o.base.steps.length,
    scatters: o.base.scatters,
    bonus: o.bonus ? { kind: o.bonus.kind, spins: o.bonus.spins.length, retriggers: o.bonus.retriggers, tenths: o.bonus.tenths, top: o.bonus.top } : null,
    capped: o.capped,
  };
}

/** The ledger's resolve: the summary only. */
export function playCascadeSummary(m: CascadeMachine, rng: () => number, bet: number): CascadeSummary {
  return summarize(playCascade(m, rng, bet), m);
}

/**
 * The full play behind a stored summary, from its seed. Null when it does not
 * match what was paid (the machine's tables changed in an update since): the
 * player then sees the settled result without the film, never a different one.
 */
export function replayCascade(m: CascadeMachine, rng: () => number, summary: CascadeSummary): CascadeOutcome | null {
  const o = playCascade(m, rng, summary.bet);
  return o.win === summary.win && windowText(m, o.base.final) === summary.window ? o : null;
}

// ── The proof ───────────────────────────────────────────────────────────────

export interface CascadeTheory {
  plays: number;
  rtp: number;
  /** Standard error of `rtp`. */
  se: number;
  hitRate: number;
  freeOneIn: number;
  superOneIn: number;
  /** Mean pay of a round (× bet), by kind. */
  freeMean: number;
  superMean: number;
  /** Share of the RTP from the base game (clusters + scatter). */
  baseShare: number;
  maxX: number;
  capped: number;
  meanTumbles: number;
  bigOneIn: number;
  megaOneIn: number;
  epicOneIn: number;
}

/** Whole plays on one stream: the RTP and the shape of the machine. Deterministic per seed. */
export function cascadeTheory(m: CascadeMachine, rng: () => number, plays: number): CascadeTheory {
  let sum = 0, sq = 0, hits = 0, free = 0, sup = 0, freeSum = 0, supSum = 0, baseSum = 0, maxX = 0, capped = 0, tumbles = 0;
  let big = 0, mega = 0, epic = 0;
  for (let i = 0; i < plays; i++) {
    const o = playCascade(m, rng, 10);
    const x = o.tenths / 10;
    sum += x; sq += x * x;
    if (x > 0) hits++;
    if (x > maxX) maxX = x;
    if (o.capped) capped++;
    if (x >= 200) epic++; else if (x >= 50) mega++; else if (x >= 10) big++;
    baseSum += Math.min(o.tenths, o.baseTenths) / 10;
    tumbles += o.base.steps.length;
    if (o.bonus?.kind === 'free') { free++; freeSum += o.bonus.tenths / 10; }
    if (o.bonus?.kind === 'super') { sup++; supSum += o.bonus.tenths / 10; }
  }
  const rtp = sum / plays;
  const sd = Math.sqrt(Math.max(0, sq / plays - rtp * rtp));
  const oneIn = (n: number) => (n ? plays / n : Infinity);
  return {
    plays, rtp, se: sd / Math.sqrt(plays), hitRate: hits / plays,
    freeOneIn: oneIn(free), superOneIn: oneIn(sup),
    freeMean: free ? freeSum / free : 0, superMean: sup ? supSum / sup : 0,
    baseShare: sum ? baseSum / sum : 0, maxX, capped, meanTumbles: tumbles / plays,
    bigOneIn: oneIn(big), megaOneIn: oneIn(mega), epicOneIn: oneIn(epic),
  };
}

// ── Exact chances (the scatter only comes with the first fall) ──────────────

/** P(exactly k scatters on a first window), k = 0..cells. */
export function scatterDistribution(m: CascadeMachine, free = false): number[] {
  const w = weights(m);
  const p = free ? m.freeScatterWeight / w.freeTotal : m.scatterWeight / w.baseTotal;
  const n = m.rows * m.cols;
  const out: number[] = [];
  let choose = 1;
  for (let k = 0; k <= n; k++) {
    out.push(choose * p ** k * (1 - p) ** (n - k));
    choose = (choose * (n - k)) / (k + 1);
  }
  return out;
}

/** Exact: the chance a paid spin opens the free spins (not the Super), the Super Bonus, and a retrigger inside a round. */
export function roundChances(m: CascadeMachine): { free: number; super: number; retrigger: number; scatterRtp: number } {
  const d = scatterDistribution(m);
  let free = 0, sup = 0, scatterRtp = 0;
  d.forEach((pk, k) => {
    if (k >= m.superTrigger) sup += pk;
    else if (k >= m.freeTrigger) free += pk;
    scatterRtp += (pk * scatterPay(m, k)) / 10;
  });
  const retrigger = scatterDistribution(m, true).reduce((s, pk, k) => (k >= m.freeTrigger ? s + pk : s), 0);
  return { free, super: sup, retrigger, scatterRtp };
}

export interface CascadeProof {
  /** Cluster pays of the base game per paid spin (simulated), × bet. */
  clusters: number;
  clustersSe: number;
  /** Scatter pays (exact). */
  scatter: number;
  chances: { free: number; super: number; retrigger: number };
  freeMean: number;
  freeSd: number;
  freeSpins: number;
  superMean: number;
  superSd: number;
  rtp: number;
  se: number;
  /** Share of paid spins that pay anything. */
  hitRate: number;
  meanTumbles: number;
  maxRoundX: number;
}

/**
 * The RTP proof, stratified: what can be exact is (the round's chance, the
 * scatter pays); the base game's clusters and the two rounds are simulated
 * apart (`base` spins, `free` and `superRounds` rounds), so the rare Super
 * Bonus is measured thousands of times instead of a handful. The cap is applied
 * per round (a base win on top of a capped round is ignored: a few in a billion).
 */
export function cascadeProof(m: CascadeMachine, rng: () => number, base: number, free: number, superRounds: number): CascadeProof {
  const ch = roundChances(m);
  let cs = 0, cq = 0, hits = 0, tumbles = 0;
  for (let i = 0; i < base; i++) {
    const s = spinCascade(m, rng, 'base', emptySpots(m));
    const x = s.tenths / 10;
    cs += x; cq += x * x;
    if (x > 0 || s.scatterTenths > 0) hits++;
    tumbles += s.steps.length;
  }
  const cap = m.maxWinX * 10;
  let maxRoundX = 0;
  const rounds = (kind: CascadeBonusKind, n: number) => {
    let s = 0, q = 0, spins = 0;
    for (let i = 0; i < n; i++) {
      const r = cascadeRound(m, rng, kind);
      const x = Math.min(cap, r.tenths) / 10;
      s += x; q += x * x; spins += r.spins.length;
      if (x > maxRoundX) maxRoundX = x;
    }
    const mean = n ? s / n : 0;
    return { mean, sd: n ? Math.sqrt(Math.max(0, q / n - mean * mean)) : 0, spins: n ? spins / n : 0 };
  };
  const F = rounds('free', free);
  const S = rounds('super', superRounds);
  const clusters = cs / base;
  const clustersSd = Math.sqrt(Math.max(0, cq / base - clusters * clusters));
  const rtp = clusters + ch.scatterRtp + ch.free * F.mean + ch.super * S.mean;
  const se = Math.sqrt((clustersSd / Math.sqrt(base)) ** 2 + (ch.free * F.sd) ** 2 / Math.max(1, free) + (ch.super * S.sd) ** 2 / Math.max(1, superRounds));
  return {
    clusters, clustersSe: clustersSd / Math.sqrt(base), scatter: ch.scatterRtp,
    chances: { free: ch.free, super: ch.super, retrigger: ch.retrigger },
    freeMean: F.mean, freeSd: F.sd, freeSpins: F.spins, superMean: S.mean, superSd: S.sd,
    rtp, se, hitRate: hits / base, meanTumbles: tumbles / base, maxRoundX,
  };
}
