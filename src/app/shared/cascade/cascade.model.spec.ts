import { seededRng } from '../games/seeded-rng';
import { GAMES_MAX_WIN_X } from '../economy/economy-curve';
import { CASCADE_SPRITE, spriteCodes, spriteGrid, spriteLayers } from './cascade-sprites';
import {
  CASCADE_STATS, ECLIPSE_CASCADE, ORRERY_TUMBLER, bumpSpot, cascadeProof, cascadeRound, clusterPay, emptySpots,
  findClusters, parseWindow, playCascade, playCascadeSummary, replayCascade, roundChances, scatterDistribution,
  scatterOf, spinCascade, spotMultiplier, summarize, tumble, wildOf, windowText, type CascadeMachine,
} from './cascade.model';
import { BUILT_REALM_MACHINES, REALM_MACHINES, machinePoint } from './realm-machines.model';
import { MACHINE_H, MACHINE_W, machinePixel } from '../../play/engine/machine-art';

/** A tiny 4×4 test machine: two kinds, min cluster 3, so windows can be written by hand. */
const TINY: CascadeMachine = {
  ...ECLIPSE_CASCADE,
  id: 'tiny', rows: 4, cols: 4, minCluster: 3,
  symbols: [
    { code: 'a', name: 'A', weight: 1, pays: [10, 20, 30] },
    { code: 'b', name: 'B', weight: 1, pays: [5, 10, 15] },
  ],
  wildWeight: 0, freeWildWeight: 0, scatterWeight: 0, freeScatterWeight: 0,
};
const W = (rows: string[]) => parseWindow(TINY, rows.join(''));
/** An RNG that always lands on the first weight (symbol 'a'). */
const firstOnly = () => 0;

describe('cascade.model', () => {
  describe('clusters', () => {
    it('joins up, down, left and right, never corner to corner', () => {
      const grid = W(['aab.', 'b.ab', 'baab', 'bbbb'].map(r => r.replace(/\./g, 'b')));
      // a: (0,0),(0,1) | (1,2) (2,1),(2,2) → the right group is 3 (1,2)-(2,2)-(2,1); the left pair is 2 (no pay).
      const clusters = findClusters(TINY, grid);
      const aClusters = clusters.filter(c => c.symbol === 0);
      expect(aClusters.length).toBe(1);
      expect(aClusters[0].cells).toEqual([6, 9, 10]);
      // A diagonal touch does not join: (0,1) and (1,2) are corner to corner.
      expect(aClusters[0].cells).not.toContain(1);
    });

    it('needs the minimum size and at least one real symbol; a wild joins two kinds at once', () => {
      const m: CascadeMachine = { ...TINY };
      const grid = parseWindow(m, ['aaWb', 'bbbb', 'abab', 'baba'].join(''));
      const clusters = findClusters(m, grid);
      const a = clusters.find(c => c.symbol === 0)!;
      const b = clusters.find(c => c.symbol === 1)!;
      expect(a.cells).toEqual([0, 1, 2]);
      expect(b.cells).toContain(2);
      expect(b.cells).toContain(3);
      // A window of only wilds pays nothing.
      expect(findClusters(m, parseWindow(m, 'W'.repeat(16)))).toEqual([]);
    });

    it('pays by size, the last pay for that size and up', () => {
      expect(clusterPay(TINY, 0, 2)).toBe(0);
      expect(clusterPay(TINY, 0, 3)).toBe(10);
      expect(clusterPay(TINY, 0, 5)).toBe(30);
      expect(clusterPay(TINY, 0, 16)).toBe(30);
      expect(clusterPay(ECLIPSE_CASCADE, 7, 15)).toBe(ECLIPSE_CASCADE.symbols[7].pays[10]);
    });
  });

  describe('tumble', () => {
    it('lets the rest fall down and fills the top', () => {
      const grid = W(['abab', 'baba', 'abab', 'bbbb']);
      const burst = new Set([12, 13]); // two cells of the bottom row
      const { grid: next, fresh } = tumble(TINY, grid, burst, 1, firstOnly, false);
      // Column 0: a,b,a,(b burst) → falls to [new, a, b, a].
      expect([next[0], next[4], next[8], next[12]]).toEqual([0, 0, 1, 0]);
      expect(fresh.sort((x, y) => x - y)).toEqual([0, 1]);
      // Column 2 is untouched.
      expect([next[2], next[6], next[10], next[14]]).toEqual([grid[2], grid[6], grid[10], grid[14]]);
    });

    it('falls up when the down turns (the Tumbler): the rest rise, the bottom fills', () => {
      const grid = W(['bbbb', 'abab', 'baba', 'abab']);
      const { grid: next, fresh } = tumble(TINY, grid, new Set([0]), -1, firstOnly, false);
      expect([next[0], next[4], next[8], next[12]]).toEqual([0, 1, 0, 0]);
      expect(fresh).toEqual([12]);
    });

    it('never drops a scatter in a refill (they come with the first fall only)', () => {
      const m: CascadeMachine = { ...TINY, id: 'tiny-s', scatterWeight: 1000, freeScatterWeight: 1000 };
      const grid = parseWindow(m, 'a'.repeat(16));
      const rng = seededRng('refill');
      for (let i = 0; i < 50; i++) {
        const { grid: next } = tumble(m, grid, new Set([0, 1, 2, 3, 4, 5]), 1, rng, i % 2 === 0);
        expect(next).not.toContain(scatterOf(m));
      }
    });
  });

  describe('multiplier spots', () => {
    it('mark, then ×2, then double each burst, up to the cap', () => {
      let v = 0;
      const seen: number[] = [];
      for (let i = 0; i < 13; i++) { v = bumpSpot(v, 1024); seen.push(v); }
      expect(seen.slice(0, 5)).toEqual([1, 2, 4, 8, 16]);
      expect(seen[seen.length - 1]).toBe(1024);
      expect(bumpSpot(1024, 1024)).toBe(1024);
    });

    it('a cluster pays × the sum of the ×2+ spots under it, ×1 with none (a mark alone pays ×1)', () => {
      const spots = new Array(16).fill(0);
      expect(spotMultiplier(spots, [0, 1, 2])).toBe(1);
      spots[0] = 1;
      expect(spotMultiplier(spots, [0, 1, 2])).toBe(1);
      spots[1] = 2; spots[2] = 8;
      expect(spotMultiplier(spots, [0, 1, 2])).toBe(10);
    });

    it('grow inside one spin and clear for the next paid spin; stay for a whole round', () => {
      const o = playCascade(ECLIPSE_CASCADE, seededRng('e2e-cascade-241:0'), 10);
      expect(o.bonus).toBeNull();
      expect(o.base.steps.some(s => s.wins.some(w => w.mult >= 2))).toBeTrue();
      expect(o.base.spotsStart.every(v => v === 0)).toBeTrue();
      // Each step's pay is its base pay × the spots it stood on before they grew.
      let spots = o.base.spotsStart;
      for (const step of o.base.steps) {
        for (const w of step.wins) {
          expect(w.mult).toBe(spotMultiplier(spots, w.cells));
          expect(w.tenths).toBe(clusterPay(ECLIPSE_CASCADE, w.symbol, w.cells.length) * w.mult);
        }
        spots = step.spots;
      }
      const round = cascadeRound(ECLIPSE_CASCADE, seededRng('round'), 'free');
      for (let i = 1; i < round.spins.length; i++) expect(round.spins[i].spotsStart).toEqual(round.spins[i - 1].spotsEnd);
    });

    it('a Super Bonus starts every spot at ×2', () => {
      const round = cascadeRound(ECLIPSE_CASCADE, seededRng('super'), 'super');
      expect(round.spins[0].spotsStart.every(v => v === 2)).toBeTrue();
    });
  });

  describe('the orbit ladder (the Tumbler)', () => {
    it('climbs one rung a tumble in a paid spin, back to ×1 the next spin', () => {
      const o = playCascade(ORRERY_TUMBLER, seededRng('e2e-tumbler-10:0'), 10);
      expect(o.base.steps.length).toBeGreaterThanOrEqual(2);
      o.base.steps.forEach((s, n) => expect(s.rung).toBe(ORRERY_TUMBLER.ladder[Math.min(ORRERY_TUMBLER.ladder.length - 1, n)]));
      // The down turns after every tumble.
      o.base.steps.forEach((s, n) => expect(s.dir).toBe(n % 2 === 0 ? 1 : -1));
    });

    it('is sticky in a round, and the Super starts it at ×5', () => {
      const round = cascadeRound(ORRERY_TUMBLER, seededRng('ladder'), 'free');
      let rung = 0;
      for (const s of round.spins) {
        s.steps.forEach((st, n) => expect(st.rung).toBe(ORRERY_TUMBLER.freeLadder[Math.min(ORRERY_TUMBLER.freeLadder.length - 1, rung + n)]));
        rung = s.rungEnd;
      }
      const sup = cascadeRound(ORRERY_TUMBLER, seededRng('ladder-super'), 'super');
      const first = sup.spins.find(s => s.steps.length)!;
      expect(first.steps[0].rung).toBeGreaterThanOrEqual(5);
    });
  });

  describe('bonus triggers', () => {
    it('the scatter count is a binomial over the first window; the chances are exact', () => {
      for (const m of [ECLIPSE_CASCADE, ORRERY_TUMBLER]) {
        const d = scatterDistribution(m);
        expect(d.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
        const ch = roundChances(m);
        const oneIn = 1 / (ch.free + ch.super);
        expect(oneIn).toBeGreaterThan(80);
        expect(oneIn).toBeLessThan(400);
        expect(ch.super).toBeLessThan(ch.free);
      }
    });

    it('3 scatters open free spins, 4+ the Super Bonus (pinned seeds)', () => {
      const free = playCascade(ECLIPSE_CASCADE, seededRng('e2e-cascade-402:0'), 10);
      expect(free.base.scatters).toBe(3);
      expect(free.bonus?.kind).toBe('free');
      expect(free.bonus!.spins.length).toBe(10);
      const sup = playCascade(ECLIPSE_CASCADE, seededRng('e2e-cascade-4526:0'), 10);
      expect(sup.base.scatters).toBeGreaterThanOrEqual(4);
      expect(sup.bonus?.kind).toBe('super');
    });

    it('a retrigger adds spins and never passes the most', () => {
      const m: CascadeMachine = { ...ECLIPSE_CASCADE, id: 'retrigger', freeScatterWeight: 400 };
      const round = cascadeRound(m, seededRng('many'), 'free');
      expect(round.retriggers).toBeGreaterThan(0);
      expect(round.spins.length).toBeLessThanOrEqual(m.maxSpins);
      expect(round.spins.length).toBe(Math.min(m.maxSpins, m.freeSpins + round.retriggers * m.retriggerSpins));
    });
  });

  describe('payout', () => {
    it('is decided by the seed alone: the same seed, the same play, every time', () => {
      for (const seed of ['a:0', 'b:7', 'e2e-cascade-402:0']) {
        const one = playCascadeSummary(ECLIPSE_CASCADE, seededRng(seed), 100);
        const two = playCascadeSummary(ECLIPSE_CASCADE, seededRng(seed), 100);
        expect(two).toEqual(one);
        expect(replayCascade(ECLIPSE_CASCADE, seededRng(seed), one)?.win).toBe(one.win);
      }
    });

    it('pays whole Gold, the same share of the bet at every stake', () => {
      const ten = playCascade(ECLIPSE_CASCADE, seededRng('e2e-cascade-241:0'), 10);
      const big = playCascade(ECLIPSE_CASCADE, seededRng('e2e-cascade-241:0'), 1_000_000);
      expect(ten.win).toBe(74);
      expect(big.win).toBe(ten.win * 100_000);
      expect(Number.isInteger(big.win)).toBeTrue();
    });

    it('stores a small summary (the window, not the film) and refuses a replay that does not match', () => {
      const o = playCascade(ECLIPSE_CASCADE, seededRng('e2e-cascade-402:0'), 10);
      const s = summarize(o);
      expect(JSON.stringify(s).length).toBeLessThan(400);
      expect(s.window.length).toBe(100);
      expect(s.window).toBe(windowText(ECLIPSE_CASCADE, o.base.final));
      expect(replayCascade(ECLIPSE_CASCADE, seededRng('e2e-cascade-402:0'), { ...s, win: s.win + 1 })).toBeNull();
    });

    it('caps a play at the curve\'s max win', () => {
      expect(ECLIPSE_CASCADE.maxWinX).toBe(GAMES_MAX_WIN_X);
      expect(ORRERY_TUMBLER.maxWinX).toBe(GAMES_MAX_WIN_X);
      const tiny: CascadeMachine = { ...ECLIPSE_CASCADE, id: 'capped', maxWinX: 1 };
      for (let i = 0; i < 200; i++) {
        const o = playCascade(tiny, seededRng(`cap:${i}`), 10);
        expect(o.win).toBeLessThanOrEqual(10);
        if (o.capped) { expect(o.win).toBe(10); return; }
      }
      fail('no play reached the tiny cap');
    });

    it('returns about its stated RTP (stratified proof, small: economy-sim --cascade runs the full one)', () => {
      for (const m of [ECLIPSE_CASCADE, ORRERY_TUMBLER]) {
        const p = cascadeProof(m, seededRng(`karma:${m.id}`), 30_000, 3_000, 800);
        expect(Math.abs(p.rtp - CASCADE_STATS[m.id].rtp)).toBeLessThan(Math.max(0.02, 4 * p.se));
        expect(p.rtp).toBeLessThan(1);
      }
    });
  });

  describe('the board and the machines', () => {
    it('every symbol is pixel art inside its 14×14 box, with SVG layers', () => {
      for (const id of [ECLIPSE_CASCADE.id, ORRERY_TUMBLER.id]) {
        const codes = spriteCodes(id);
        expect(codes).toContain('W');
        expect(codes).toContain('S');
        for (const code of codes) {
          const g = spriteGrid(id, code);
          expect(g.length).toBe(CASCADE_SPRITE);
          expect(g.every(r => r.length === CASCADE_SPRITE)).toBeTrue();
          expect(g.flat().filter(Boolean).length).withContext(`${id} ${code}`).toBeGreaterThan(30);
          expect(spriteLayers(id, code).length).toBeGreaterThan(1);
        }
      }
      expect(wildOf(ECLIPSE_CASCADE)).toBe(8);
      expect(emptySpots(ECLIPSE_CASCADE).length).toBe(100);
    });

    it('the Orrery Tumbler stands in the Orrery Wells\' Gate Hollow; three more are spec\'d', () => {
      expect(REALM_MACHINES.length).toBe(4);
      expect(new Set(REALM_MACHINES.map(m => m.realm)).size).toBe(4);
      expect(BUILT_REALM_MACHINES.map(m => m.id)).toEqual(['orrery-tumbler']);
      const t = BUILT_REALM_MACHINES[0];
      expect(t.area).toBe('celestial-delve');
      // The Gate Hollow: interior cols 16..47, its floor is row 31 (realm-kit CORE_HOLLOW).
      expect(t.col).toBeGreaterThanOrEqual(16);
      expect(t.col).toBeLessThanOrEqual(47);
      expect(t.floorRow).toBe(31);
      expect(machinePoint(t, 0)).toEqual({ x: t.col * 32 + 16, y: 31 * 32 });
    });

    it('the machine\'s pixel art stays inside its box and twinkles', () => {
      let diff = 0;
      for (let y = 0; y < MACHINE_H; y++) for (let x = 0; x < MACHINE_W; x++) if (machinePixel(x, y, 0) !== machinePixel(x, y, 1)) diff++;
      expect(diff).toBeGreaterThan(0);
      expect(machinePixel(-1, 0, 0)).toBe('');
      expect(machinePixel(MACHINE_W, 0, 0)).toBe('');
      expect(machinePixel(0, 8, 0)).not.toBe('');
    });

    it('a spin is a pure function of its RNG and spots', () => {
      const a = spinCascade(ECLIPSE_CASCADE, seededRng('spin'), 'base', emptySpots(ECLIPSE_CASCADE));
      const b = spinCascade(ECLIPSE_CASCADE, seededRng('spin'), 'base', emptySpots(ECLIPSE_CASCADE));
      expect(b).toEqual(a);
    });
  });
});
