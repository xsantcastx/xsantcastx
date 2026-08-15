import { miningLevelView } from './mining-level';

describe('miningLevelView', () => {
  it('uses the authored compact thresholds', () => {
    expect(miningLevelView(0)).toEqual({ level: 1, xp: 0, into: 0, next: 30 });
    expect(miningLevelView(14)).toEqual({ level: 1, xp: 14, into: 14, next: 30 });
    expect(miningLevelView(30)).toEqual({ level: 2, xp: 30, into: 30, next: 90 });
    expect(miningLevelView(90)).toEqual({ level: 3, xp: 90, into: 90, next: null });
  });
});
