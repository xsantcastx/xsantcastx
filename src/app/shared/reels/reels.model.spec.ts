import { simulateRtp } from '../games/rtp-sim';
import { seededRng } from '../games/seeded-rng';
import {
  CELL_WEIGHT_TOTAL,
  FREE_SPINS,
  MAX_WIN_X,
  PAYLINES,
  REELS_STATS,
  REEL_SYMBOLS,
  SCATTER_PAY,
  bonusChance,
  goldFor,
  lineWins,
  playReels,
  prizeRtp,
  reelsReturn,
  reelsTheory,
  scatterTenths,
  type ReelSymbol,
} from './reels.model';

/** An rng that replays cell picks: each value lands in the middle of that symbol's weight band. */
function cellsRng(cells: ReelSymbol[], then: () => number = () => 0.99): () => number {
  const mid = (id: ReelSymbol): number => {
    let acc = 0;
    for (const s of REEL_SYMBOLS) {
      if (s.id === id) return (acc + s.weight / 2) / CELL_WEIGHT_TOTAL;
      acc += s.weight;
    }
    return 0;
  };
  const queue = cells.map(mid);
  return () => (queue.length ? queue.shift()! : then());
}

describe('Reels model', () => {
  it('has the pay table Details prints', () => {
    expect(REEL_SYMBOLS.map(s => [s.id, s.weight, s.pay])).toEqual([
      ['cinder', 29, 10], ['ash', 24, 20], ['ember', 18, 50], ['maw', 14, 100], ['heart', 10, 300], ['eclipse', 5, 0],
    ]);
    expect(CELL_WEIGHT_TOTAL).toBe(100);
    expect(SCATTER_PAY).toEqual({ 3: 20, 4: 100, 5: 500 });
    expect(PAYLINES.length).toBe(5);
    expect(scatterTenths(2)).toBe(0);
    expect(scatterTenths(7)).toBe(500);
  });

  it('pays three on a line, on rows and diagonals, and nothing else', () => {
    const middle: ReelSymbol[] = ['cinder', 'ash', 'maw', 'heart', 'heart', 'heart', 'ember', 'cinder', 'ash'];
    expect(lineWins(middle)).toEqual([{ line: 0, symbol: 'heart', tenths: 300 }]);
    const diag: ReelSymbol[] = ['maw', 'ash', 'ember', 'cinder', 'maw', 'ash', 'ember', 'cinder', 'maw'];
    expect(lineWins(diag)).toEqual([{ line: 3, symbol: 'maw', tenths: 100 }]);
    const eclipses: ReelSymbol[] = ['eclipse', 'eclipse', 'eclipse', 'ash', 'cinder', 'ember', 'maw', 'heart', 'ash'];
    expect(lineWins(eclipses)).toEqual([]); // the scatter never pays as a line
  });

  it('turns tenths into whole Gold at every bet', () => {
    expect(goldFor(300, 10)).toBe(300);
    expect(goldFor(10, 10)).toBe(10);
    expect(goldFor(20, 50)).toBe(100);
  });

  it('pays a scripted line win', () => {
    const o = playReels(cellsRng(['cinder', 'ash', 'maw', 'heart', 'heart', 'heart', 'ember', 'cinder', 'ash']), 100);
    expect(o.bonus).toBeNull();
    expect(o.win).toBe(3_000);
  });

  it('opens the Eclipse Round on three Eclipses and pays lines × the orb sum once, at the end', () => {
    const o = playReels(cellsRng(['eclipse', 'eclipse', 'eclipse', 'ash', 'cinder', 'ember', 'maw', 'heart', 'ash'], seededRng('round')), 10);
    expect(o.bonus).not.toBeNull();
    const b = o.bonus!;
    expect(b.spins.length).toBeGreaterThanOrEqual(FREE_SPINS);
    expect(b.orbSum).toBe(b.spins.flatMap(s => s.orbs).reduce((s, x) => s + x.value, 0));
    expect(b.tenths).toBe(b.lineTenths * Math.max(1, b.orbSum));
    expect(o.tenths).toBe(Math.min(MAX_WIN_X * 10, o.baseTenths + b.tenths));
    expect(o.baseTenths).toBe(20);
  });

  it('is a pure function of the seed (a reload re-derives the same play)', () => {
    expect(playReels(seededRng('k:3'), 50)).toEqual(playReels(seededRng('k:3'), 50));
  });

  it('opens the round about 1 in 120 plays (exact)', () => {
    expect(1 / bonusChance()).toBeCloseTo(119.6, 0);
  });

  it('prizes add the same small share at small stakes and fade at large ones', () => {
    const th = { trigger: bonusChance(), roundSpins: 10.44 };
    expect(prizeRtp(10, th)).toBeCloseTo(prizeRtp(100, th), 4);
    expect(prizeRtp(10, th)).toBeLessThan(0.01);
    expect(prizeRtp(1e9, th)).toBeLessThan(0.0001);
  });

  it('the stated Gold RTP holds (exact lines + 200k simulated rounds)', () => {
    const th = reelsTheory(seededRng('karma:theory'), 200_000);
    expect(Math.abs(th.goldRtp - REELS_STATS.goldRtp)).toBeLessThan(0.006);
    expect(th.goldRtp + prizeRtp(10, th)).toBeGreaterThanOrEqual(0.92);
    expect(th.goldRtp + prizeRtp(10, th)).toBeLessThanOrEqual(0.94);
  });

  it('returns the stated RTP within ±1 point over 1e6 whole plays', () => {
    const rep = simulateRtp({ play: playReels, value: reelsReturn }, 1_000_000, 100, 'karma:reels');
    expect(Math.abs(rep.rtp - REELS_STATS.rtp)).toBeLessThanOrEqual(0.01);
    expect(1 / rep.hitRate).toBeCloseTo(REELS_STATS.hitOneIn, 0);
    expect(rep.maxX).toBeLessThanOrEqual(MAX_WIN_X);
  });
});
