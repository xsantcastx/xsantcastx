import { MASTERY_LEVEL, MASTERY_STEP, formatXp, levelProgressPct, miningLevelView, xpForLevel } from './mining-level';

const MAX_SKILL_LEVEL = MASTERY_LEVEL;

describe('skill XP curve', () => {
  it('starts at level 1 with nothing earned', () => {
    const v = miningLevelView(0);
    expect(v.level).toBe(1);
    expect(v.into).toBe(0);
    expect(v.next).toBe(xpForLevel(2));
  });

  it('is strictly increasing so a level is never skipped or shared', () => {
    for (let l = 2; l <= MAX_SKILL_LEVEL; l++) {
      expect(xpForLevel(l)).toBeGreaterThan(xpForLevel(l - 1));
    }
  });

  it('lands the player on the level their XP has paid for', () => {
    for (let l = 2; l < MAX_SKILL_LEVEL; l++) {
      const at = xpForLevel(l);
      expect(miningLevelView(at).level).toBe(l);
      expect(miningLevelView(at - 1).level).toBe(l - 1);
    }
  });

  /*
   * The old table put the first level-up 1,500 actions away — 62 minutes of
   * unbroken clicking at the 2.5s cooldown — and the cap two levels later.
   * The curve is front-loaded so the loop teaches itself.
   */
  it('front-loads the first hour', () => {
    const actionsFor = (level: number) => xpForLevel(level) / 2;
    expect(actionsFor(2)).toBeLessThan(60);            // ~2 min
    expect(actionsFor(5)).toBeLessThan(1_200);         // under an hour
    expect(actionsFor(10)).toBeGreaterThan(3_000);     // a real climb
  });

  it('reports progress inside the level, not against the total', () => {
    const floorXp = xpForLevel(4);
    const span = xpForLevel(5) - floorXp;
    const v = miningLevelView(floorXp + Math.floor(span / 2));
    expect(v.level).toBe(4);
    expect(v.into).toBe(Math.floor(span / 2));
    expect(v.span).toBe(span);
    expect(levelProgressPct(v)).toBeCloseTo(50, 0);
  });

  it('does not cap at 99: a next level is always there, and the bar fills inside it', () => {
    const v = miningLevelView(xpForLevel(MAX_SKILL_LEVEL) + 10_000);
    expect(v.level).toBe(MAX_SKILL_LEVEL);
    expect(v.next).toBe(xpForLevel(100));
    expect(v.span).toBe(xpForLevel(100) - xpForLevel(99));
    expect(levelProgressPct(v)).toBe(Math.round(10_000 / v.span * 100));
  });

  it('treats junk input as zero rather than throwing', () => {
    for (const bad of [NaN, -50, Infinity]) {
      expect(miningLevelView(bad as number).level).toBe(1);
    }
  });

  /* Levels are derived and XP is what is stored, so a curve change re-levels
     saves without losing progress — and this curve is gentler early, so an
     existing player only ever gains. */
  it('never lowers the level of a save that had reached the old thresholds', () => {
    expect(miningLevelView(3_000).level).toBeGreaterThanOrEqual(2);
    expect(miningLevelView(9_000).level).toBeGreaterThanOrEqual(3);
  });

  describe('the 1-99 extension is migration-safe', () => {
    // Pinned literals from the 50-cap curve. If any of these move, a stored XP
    // total would read as a different level than it did yesterday.
    const PINNED: ReadonlyArray<[number, number]> = [[2, 100], [10, 12_569], [20, 65_051], [50, 522_915]];

    it('keeps every pre-99 threshold to the XP', () => {
      for (const [level, xp] of PINNED) expect(xpForLevel(level)).toBe(xp);
    });

    it('reads the same level as before for any total under the old cap', () => {
      for (const [level, xp] of PINNED) {
        expect(miningLevelView(xp).level).toBe(level);
        expect(miningLevelView(xp - 1).level).toBe(level - 1);
      }
    });

    it('keeps 99 where it was (mastery), and goes on past it', () => {
      expect(MAX_SKILL_LEVEL).toBe(99);
      expect(xpForLevel(99)).toBe(Math.floor(100 * Math.pow(98, 2.2)));
      expect(miningLevelView(xpForLevel(99)).level).toBe(99);
      expect(miningLevelView(xpForLevel(99)).next).toBe(xpForLevel(100));
    });
  });

  describe('uncapped, Tibia-style past 99', () => {
    const step = (l: number) => xpForLevel(l) - xpForLevel(l - 1);

    it('is continuous at 99 -> 100 and steepens with the square of the level', () => {
      expect(step(99)).toBe(MASTERY_STEP);
      expect(step(100)).toBeGreaterThan(step(99));
      expect(step(100) / step(99)).toBeLessThan(1.03);
      expect(step(198) / step(99)).toBeCloseTo(4, 0);
    });

    it('is monotonic, exact and overflow-free up to level 1000', () => {
      for (let l = 100; l <= 1000; l++) {
        expect(Number.isSafeInteger(xpForLevel(l))).toBeTrue();
        expect(step(l)).toBeGreaterThanOrEqual(step(l - 1));
        expect(miningLevelView(xpForLevel(l)).level).toBe(l);
        expect(miningLevelView(xpForLevel(l) - 1).level).toBe(l - 1);
      }
    });

    it('formats big totals for a phone (K/M/B)', () => {
      expect(formatXp(53_607)).toBe('53,607');
      expect(formatXp(xpForLevel(99))).toBe('2.4M');
      expect(formatXp(xpForLevel(300))).toBe('50.1M');
      expect(formatXp(xpForLevel(1000))).toBe('1.83B');
    });
  });
});
