import { miningLevelView } from './mining-level';

describe('miningLevelView', () => {
  it('uses the authored compact thresholds', () => {
    expect(miningLevelView(0)).toEqual({ level: 1, xp: 0, into: 0, next: 3_000 });
    expect(miningLevelView(14)).toEqual({ level: 1, xp: 14, into: 14, next: 3_000 });
    expect(miningLevelView(3_000)).toEqual({ level: 2, xp: 3_000, into: 3_000, next: 9_000 });
    expect(miningLevelView(9_000)).toEqual({ level: 3, xp: 9_000, into: 9_000, next: null });
  });
});
