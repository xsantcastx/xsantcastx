import { followShift } from './td-zoom';

describe('td-zoom followShift (the camera clears the phone rails; Director, dirfix)', () => {
  it('stands the Keeper in the middle of the world the rails leave', () => {
    expect(followShift(240, 0, 0, null)).toBe(0);
    expect(followShift(240, 36, 0, null)).toBe(18);
    expect(followShift(240, 0, 30, null)).toBe(-15);
    expect(followShift(240, 36, 36, null)).toBe(0);
  });

  it('brings a target out from under a rail, never past a fifth of the view', () => {
    // A hound 70 px left of the Keeper, 20 px half wide, a 36 px rail on the left of a 240 px view:
    // base 18 puts its left edge at 18 - 70 - 20 = -72, the rail ends at -120 + 36 + 4 = -80: already clear.
    expect(followShift(240, 36, 0, { d: -70, hw: 20 })).toBe(18);
    // 90 px left: its edge at -92, 12 px under the rail — the view moves 12 more.
    expect(followShift(240, 36, 0, { d: -90, hw: 20 })).toBe(30);
    // Far off to the left: capped at a fifth of the view (48) on top of the rails' own shift.
    expect(followShift(240, 36, 0, { d: -400, hw: 20 })).toBe(18 + 48);
    // Off the right edge: the view moves the other way (the target is not hidden by the rail but by the edge).
    expect(followShift(240, 36, 0, { d: 110, hw: 20 })).toBe(18 + (116 - 148));
  });

  it('no rails: the camera never chases the target', () => {
    expect(followShift(240, 0, 0, { d: -400, hw: 20 })).toBe(0);
  });
});
