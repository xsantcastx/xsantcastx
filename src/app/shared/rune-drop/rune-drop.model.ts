/**
 * rune-drop.model — Rune Drop (the Croupier's pin board) as data and one pure function.
 *
 * A rune falls through `rows` rows of Godforge pins. At every pin it goes left
 * or right, one fair coin each, and it lands in one of `rows + 1` bins: the
 * number of rights. So bin k is reached with chance C(rows, k) / 2^rows — the
 * centre often, the edges rarely — and each bin pays a multiple of the bet.
 *
 * The path IS the outcome: `playRuneDrop` draws the `rows` left/right bits
 * from the play's seed and the bin is their sum. The board animates exactly
 * those bits, so the rune you watch is the result, pin by pin. Nothing nudges
 * it toward the edge bins and nothing slows near them.
 *
 * Three risks per row count (8–16 rows): Low keeps most of the bet in the
 * middle, High pays almost nothing in the middle and up to ×820 at the edges.
 * Every table returns 94.9–95.2% of what is bet (exact sums, `dropRtp`).
 *
 * Pays are TENTHS of the bet; bets are multiples of 10 (economy-curve
 * GAMES_BET), so every pay is whole Gold without rounding.
 *
 * Pure and import-free, so the node simulator runs the exact code that ships.
 */

export type DropRisk = 'low' | 'medium' | 'high';
export const DROP_RISKS: readonly DropRisk[] = ['low', 'medium', 'high'];
export const DROP_ROWS = { min: 8, max: 16, start: 12 } as const;

/**
 * Pay of each bin in tenths of the bet, edge → centre (the board is
 * symmetric; `dropPays` mirrors it). Generated against the binomial odds to sit
 * at 95%, rounded to readable numbers, then checked exactly by `dropRtp`.
 */
export const DROP_TABLES: Readonly<Record<DropRisk, Readonly<Record<number, readonly number[]>>>> = {
  low: {
    8: [72, 25, 11, 7, 7],
    9: [86, 27, 13, 9, 7],
    10: [100, 36, 17, 10, 8, 6],
    11: [120, 44, 20, 13, 8, 7],
    12: [140, 52, 24, 14, 9, 8, 7],
    13: [160, 61, 29, 17, 12, 8, 7],
    14: [180, 73, 35, 20, 12, 9, 8, 7],
    15: [210, 86, 41, 20, 14, 10, 8, 8],
    16: [240, 100, 48, 25, 17, 10, 9, 8, 8],
  },
  medium: {
    8: [130, 34, 12, 6, 4],
    9: [160, 50, 18, 8, 4],
    10: [240, 67, 24, 11, 5, 4],
    11: [320, 96, 34, 14, 7, 4],
    12: [430, 130, 46, 19, 9, 5, 4],
    13: [590, 180, 63, 25, 13, 6, 4],
    14: [790, 250, 87, 35, 15, 8, 5, 4],
    15: [1050, 340, 120, 46, 20, 11, 6, 4],
    16: [1450, 460, 170, 63, 28, 13, 7, 5, 4],
  },
  high: {
    8: [270, 50, 11, 3, 2],
    9: [410, 78, 18, 5, 2],
    10: [640, 120, 29, 8, 3, 1],
    11: [950, 200, 46, 11, 4, 2],
    12: [1500, 310, 73, 20, 6, 2, 1],
    13: [2250, 480, 110, 30, 9, 4, 1],
    14: [3500, 760, 180, 48, 14, 4, 2, 1],
    15: [5300, 1200, 280, 73, 20, 7, 3, 1],
    16: [8200, 1850, 440, 110, 32, 9, 4, 2, 1],
  },
};

/** The band every table must sit in (the owner's 94–96%). */
export const DROP_RTP_BAND = [0.94, 0.96] as const;

export interface DropOutcome {
  risk: DropRisk;
  rows: number;
  /** One bit per row: 0 = left, 1 = right. The animation walks exactly these. */
  path: (0 | 1)[];
  /** Number of rights = the bin, 0 (far left) … rows (far right). */
  bin: number;
  /** Pay in tenths of the bet. */
  tenths: number;
  bet: number;
  /** Gold paid. */
  win: number;
}

export function validRows(rows: number): boolean {
  return Number.isInteger(rows) && rows >= DROP_ROWS.min && rows <= DROP_ROWS.max;
}

/** Every bin's pay in tenths of the bet, left → right (rows + 1 bins). */
export function dropPays(risk: DropRisk, rows: number): number[] {
  const half = DROP_TABLES[risk][rows];
  if (!half) throw new Error(`no Rune Drop table for ${risk}/${rows}`);
  const out: number[] = [];
  for (let k = 0; k <= rows; k++) out.push(half[Math.min(k, rows - k)]);
  return out;
}

/** The chance of each bin: C(rows, k) / 2^rows. */
export function binChances(rows: number): number[] {
  const out: number[] = [];
  let c = 1;
  for (let k = 0; k <= rows; k++) {
    out.push(c / 2 ** rows);
    c = (c * (rows - k)) / (k + 1);
  }
  return out;
}

/** Exact return of one table: Σ chance × pay. */
export function dropRtp(risk: DropRisk, rows: number): number {
  const p = binChances(rows);
  return dropPays(risk, rows).reduce((s, t, k) => s + (p[k] * t) / 10, 0);
}

/** Highest pay on the board, × bet. */
export const DROP_MAX_X = Math.max(...DROP_RISKS.flatMap(r => Object.values(DROP_TABLES[r]).map(h => h[0] / 10)));

/** One drop. The rune's path, and so the bin, comes from `rng` alone. */
export function playRuneDrop(rng: () => number, bet: number, risk: DropRisk, rows: number): DropOutcome {
  if (!validRows(rows)) throw new Error(`rows must be ${DROP_ROWS.min}–${DROP_ROWS.max}`);
  const path: (0 | 1)[] = [];
  for (let i = 0; i < rows; i++) path.push(rng() < 0.5 ? 0 : 1);
  const bin = path.reduce<number>((s, b) => s + b, 0);
  const tenths = dropPays(risk, rows)[bin];
  return { risk, rows, path, bin, tenths, bet, win: (tenths * bet) / 10 };
}

/** Gold a drop returned (the RTP harness's `value`). */
export function dropReturn(o: DropOutcome): number {
  return o.win;
}
