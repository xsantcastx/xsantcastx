import { revealTiming, revealTotalMs } from './reveal-timing';
import { RARITY_LADDER } from './mystery-box';

describe('revealTiming', () => {
  it('charges longer for a rarer outcome at normal speed', () => {
    const totals = RARITY_LADDER.map(r => revealTotalMs(revealTiming(r, 'normal')));
    for (let i = 1; i < totals.length; i++) {
      expect(totals[i]).toBeGreaterThan(totals[i - 1]);
    }
  });

  it('is deterministic for a given rarity — no random near-miss teasing', () => {
    for (const r of RARITY_LADDER) {
      expect(revealTiming(r, 'normal')).toEqual(revealTiming(r, 'normal'));
    }
  });

  it('fast mode gives every rarity the same length', () => {
    const totals = new Set(RARITY_LADDER.map(r => revealTotalMs(revealTiming(r, 'fast'))));
    expect(totals.size).toBe(1);
    expect([...totals][0]).toBeLessThan(revealTotalMs(revealTiming('common', 'normal')));
  });

  it('instant reveals take no time', () => {
    for (const r of RARITY_LADDER) {
      expect(revealTotalMs(revealTiming(r, 'instant'))).toBe(0);
    }
  });

  it('scales intensity from 0 at the bottom of the ladder to 1 at the top', () => {
    expect(revealTiming('common', 'normal').intensity).toBe(0);
    expect(revealTiming('singular', 'normal').intensity).toBe(1);
  });
});
