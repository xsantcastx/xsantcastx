import { simulateRtp } from '../games/rtp-sim';
import { seededRng } from '../games/seeded-rng';
import {
  DROP_MAX_X,
  DROP_RISKS,
  DROP_ROWS,
  DROP_RTP_BAND,
  binChances,
  dropPays,
  dropReturn,
  dropRtp,
  playRuneDrop,
} from './rune-drop.model';

/** An rng that replays left/right bits (0 → left, 1 → right). */
function bitsRng(bits: (0 | 1)[]): () => number {
  const q = [...bits];
  return () => ((q.shift() ?? 0) ? 0.75 : 0.25);
}

describe('Rune Drop model', () => {
  it('every board sits in the 94–96% band, exactly', () => {
    for (const risk of DROP_RISKS) for (let n = DROP_ROWS.min; n <= DROP_ROWS.max; n++) {
      const rtp = dropRtp(risk, n);
      expect(rtp).toBeGreaterThanOrEqual(DROP_RTP_BAND[0]);
      expect(rtp).toBeLessThanOrEqual(DROP_RTP_BAND[1]);
    }
  });

  it('boards are symmetric, whole tenths, and the bins add to certainty', () => {
    for (const risk of DROP_RISKS) for (let n = DROP_ROWS.min; n <= DROP_ROWS.max; n++) {
      const pays = dropPays(risk, n);
      expect(pays.length).toBe(n + 1);
      expect(pays).toEqual([...pays].reverse());
      expect(pays.every(t => Number.isInteger(t) && t >= 1)).toBeTrue();
      expect(binChances(n).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    }
    expect(DROP_MAX_X).toBe(820);
  });

  it('the bin is the number of rights, and the path is the stored bits', () => {
    const bits: (0 | 1)[] = [1, 0, 1, 1, 0, 0, 1, 1];
    const o = playRuneDrop(bitsRng(bits), 20, 'high', 8);
    expect(o.path).toEqual(bits);
    expect(o.bin).toBe(5);
    expect(o.tenths).toBe(dropPays('high', 8)[5]);
    expect(o.win).toBe(o.tenths * 2);
    const edge = playRuneDrop(bitsRng([0, 0, 0, 0, 0, 0, 0, 0]), 10, 'high', 8);
    expect(edge.bin).toBe(0);
    expect(edge.win).toBe(270);
  });

  it('is deterministic for a seed', () => {
    expect(playRuneDrop(seededRng('rd:1'), 50, 'medium', 12)).toEqual(playRuneDrop(seededRng('rd:1'), 50, 'medium', 12));
  });

  it('rejects a row count off the board', () => {
    expect(() => playRuneDrop(seededRng('x'), 10, 'low', 7)).toThrow();
    expect(() => playRuneDrop(seededRng('x'), 10, 'low', 17)).toThrow();
  });

  // 400k drops on the medium-12 board. Its per-drop sd is ~1.55× bet, so one
  // run's RTP has sd ~0.25 points; ±1 point is 4 sd. Fixed seed: deterministic.
  it('400k simulated drops land within 1 point of the exact RTP (seed karma:rune-drop)', () => {
    const rep = simulateRtp({ play: (rng, bet) => playRuneDrop(rng, bet, 'medium', 12), value: dropReturn }, 400_000, 10, 'karma:rune-drop');
    expect(Math.abs(rep.rtp - dropRtp('medium', 12))).toBeLessThan(0.01);
  });
});
