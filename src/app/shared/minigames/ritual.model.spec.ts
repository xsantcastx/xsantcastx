/**
 * ritual.model.spec.ts — a hit is generous, a miss is free, quality stays 0..1.
 */
import {
  PULSE_FROM,
  PULSE_TO,
  RITUAL_MIN_HIT_QUALITY,
  gradePulse,
  pulseAt,
  pulseWindow,
} from './ritual.model';
import { craftSkillXp } from '../skills/skill-actions.service';

describe('rune ritual pulse', () => {
  it('shrinks from the rim to the centre and loops', () => {
    expect(pulseAt(0, 1000)).toBeCloseTo(PULSE_FROM, 9);
    expect(pulseAt(999.999, 1000)).toBeCloseTo(PULSE_TO, 3);
    expect(pulseAt(1000, 1000)).toBeCloseTo(PULSE_FROM, 9);
  });

  it('crosses the socket ring (scale 1) once per sweep', () => {
    let crossings = 0;
    let prev = pulseAt(0, 1000);
    for (let t = 1; t < 1000; t++) {
      const s = pulseAt(t, 1000);
      if (prev > 1 && s <= 1) crossings++;
      prev = s;
    }
    expect(crossings).toBe(1);
  });

  it('scores a dead-centre hit 1 and the window edge the floor', () => {
    const exact = gradePulse(1);
    expect(exact.hit).toBeTrue();
    if (exact.hit) expect(exact.quality).toBeCloseTo(1, 9);
    const edge = gradePulse(1 + pulseWindow(0) - 1e-9);
    expect(edge.hit).toBeTrue();
    if (edge.hit) expect(edge.quality).toBeCloseTo(RITUAL_MIN_HIT_QUALITY, 6);
    expect(gradePulse(1.5).hit).toBeFalse();
    expect(gradePulse(NaN).hit).toBeFalse();
  });

  it('widens the window after each miss, up to a cap', () => {
    expect(pulseWindow(1)).toBeGreaterThan(pulseWindow(0));
    expect(pulseWindow(50)).toBeLessThanOrEqual(0.3);
    expect(gradePulse(1.2, 0).hit).toBeFalse();
    expect(gradePulse(1.2, 2).hit).toBeTrue();
  });

  it('keeps every quality inside the XP hook\'s 8..40 range', () => {
    for (let m = 0; m < 6; m++) {
      for (let s = 0.5; s < 1.6; s += 0.01) {
        const r = gradePulse(s, m);
        if (!r.hit) continue;
        expect(r.quality).toBeGreaterThanOrEqual(RITUAL_MIN_HIT_QUALITY);
        expect(r.quality).toBeLessThanOrEqual(1);
        const xp = craftSkillXp(r.quality);
        expect(xp).toBeGreaterThanOrEqual(8);
        expect(xp).toBeLessThanOrEqual(40);
      }
    }
  });
});
