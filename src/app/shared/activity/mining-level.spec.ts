import { MAX_SKILL_LEVEL, levelProgressPct, miningLevelView, xpForLevel } from './mining-level';

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

  it('caps without a next level and reads as full', () => {
    const v = miningLevelView(xpForLevel(MAX_SKILL_LEVEL) + 10_000);
    expect(v.level).toBe(MAX_SKILL_LEVEL);
    expect(v.next).toBeNull();
    expect(v.span).toBe(0);
    expect(levelProgressPct(v)).toBe(100);
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

    it('runs to 99 and caps there', () => {
      expect(MAX_SKILL_LEVEL).toBe(99);
      expect(miningLevelView(xpForLevel(99)).level).toBe(99);
      expect(miningLevelView(xpForLevel(99)).next).toBeNull();
      expect(xpForLevel(99)).toBeGreaterThan(xpForLevel(98));
    });
  });
});
