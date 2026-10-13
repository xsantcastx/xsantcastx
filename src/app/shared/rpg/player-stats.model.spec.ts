/**
 * player-stats.model.spec.ts — a stat's words must say what its number does.
 */
import { STAT_BY_ID, emptyStats, enduranceMultiplier } from './player-stats.model';

describe('Endurance (meaning audit #4)', () => {
  it('multiplies the expedition haul and says so', () => {
    const endurance = STAT_BY_ID.get('endurance')!;
    expect(endurance.unit).toBe('expedition haul');
    expect(endurance.format(2)).toBe('+20% expedition haul');
    expect(enduranceMultiplier({ ...emptyStats(), endurance: 2 })).toBeCloseTo(1.2);
  });
});
