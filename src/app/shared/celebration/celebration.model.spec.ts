/**
 * celebration.model.spec.ts — the tuning table, and the rules it must obey.
 *
 * Pure data and two pure functions, so none of this needs TestBed, a browser,
 * or a DOM. The tests that matter are the invariants: that the ladder is
 * monotonic, that nothing outlives its reveal, and that reduced motion is
 * genuinely quiet rather than merely quieter.
 */
import { RUNE_TIERS, RUNE_TIER_ORDER, type RuneTier } from '../rune-forge/rune.model';
import {
  CELEBRATION_FLOOR,
  TIER_FX,
  celebrates,
  fxFor,
  scaleFx,
  type FxBudget,
} from './celebration.model';

const LOUD: FxBudget = { reduced: false, narrow: false, coarse: false };
const PHONE: FxBudget = { reduced: false, narrow: true, coarse: true };
const QUIET: FxBudget = { reduced: true, narrow: false, coarse: false };

/** How many channels a tier has switched on. The ladder's actual shape. */
function channels(tier: RuneTier): number {
  const fx = TIER_FX[tier];
  return [
    fx.shake, fx.flash, fx.wave, fx.particles, fx.shower,
    fx.lightning, fx.beams, fx.blackout,
  ].filter(Boolean).length
    + (fx.crack ? 1 : 0)
    + (fx.distort ? 1 : 0)
    + (fx.scene !== 'none' ? 1 : 0)
    + (fx.sound !== 'none' ? 1 : 0);
}

describe('celebration model', () => {
  it('covers every rune tier', () => {
    for (const tier of RUNE_TIER_ORDER) {
      expect(TIER_FX[tier]).withContext(tier).toBeDefined();
      expect(TIER_FX[tier].tier).toBe(tier);
    }
  });

  it('gives Common nothing at all', () => {
    expect(TIER_FX.common.duration).toBe(0);
    expect(celebrates('common')).toBe(false);
    expect(channels('common')).toBe(0);
  });

  it('starts celebrating at the floor and never below it', () => {
    const floor = RUNE_TIER_ORDER.indexOf(CELEBRATION_FLOOR);
    for (const tier of RUNE_TIER_ORDER) {
      expect(celebrates(tier))
        .withContext(tier)
        .toBe(RUNE_TIER_ORDER.indexOf(tier) >= floor);
    }
  });

  it('never takes a channel away as the ladder climbs', () => {
    // The whole design claim: each rung earns something the rung below did not
    // have. A tier that quietly lost an effect would be a regression nobody
    // would notice from a screenshot.
    for (let i = 1; i < RUNE_TIER_ORDER.length; i++) {
      const below = RUNE_TIER_ORDER[i - 1];
      const above = RUNE_TIER_ORDER[i];
      expect(channels(above))
        .withContext(`${above} vs ${below}`)
        .toBeGreaterThanOrEqual(channels(below));
    }
  });

  it('gets louder, never quieter, as the ladder climbs', () => {
    for (let i = 1; i < RUNE_TIER_ORDER.length; i++) {
      const below = TIER_FX[RUNE_TIER_ORDER[i - 1]];
      const above = TIER_FX[RUNE_TIER_ORDER[i]];
      expect(above.duration).toBeGreaterThanOrEqual(below.duration);
    }
  });

  it('always finishes inside the window its card is on screen for', () => {
    // A celebration that outlives its reveal is a celebration playing over an
    // empty page. The tier table's own `duration` is that window.
    for (const tier of RUNE_TIER_ORDER) {
      expect(TIER_FX[tier].duration)
        .withContext(tier)
        .toBeLessThanOrEqual(RUNE_TIERS[tier].duration);
    }
  });

  it('falls back to Common for an unknown tier', () => {
    expect(fxFor('nonsense' as RuneTier)).toBe(TIER_FX.common);
  });

  describe('scaleFx', () => {
    it('leaves a capable desktop alone', () => {
      for (const tier of RUNE_TIER_ORDER) {
        expect(scaleFx(TIER_FX[tier], LOUD)).toBe(TIER_FX[tier]);
      }
    });

    it('strips every moving part under reduced motion', () => {
      for (const tier of RUNE_TIER_ORDER) {
        const fx = scaleFx(TIER_FX[tier], QUIET);
        expect(fx.shake).withContext(tier).toBeNull();
        expect(fx.particles).withContext(tier).toBeNull();
        expect(fx.shower).withContext(tier).toBeNull();
        expect(fx.lightning).withContext(tier).toBeNull();
        expect(fx.beams).withContext(tier).toBeNull();
        expect(fx.blackout).withContext(tier).toBeNull();
        expect(fx.wave).withContext(tier).toBeNull();
        expect(fx.crack).withContext(tier).toBe(false);
        expect(fx.distort).withContext(tier).toBe(false);
        expect(fx.timeScale).withContext(tier).toBe(1);
        expect(fx.scene).withContext(tier).toBe('none');
        expect(fx.letters).withContext(tier).toBe(false);
      }
    });

    it('keeps the colour under reduced motion, so the tier is still legible', () => {
      // The house rule is a static end state, not an absent one: a visitor who
      // asked for less motion should still be told a Singular landed.
      const fx = scaleFx(TIER_FX.singular, QUIET);
      expect(fx.flash).not.toBeNull();
      expect(fx.duration).toBeGreaterThan(0);
      expect(fx.duration).toBeLessThanOrEqual(900);
    });

    it('leaves Common at zero even under reduced motion', () => {
      expect(scaleFx(TIER_FX.common, QUIET).duration).toBe(0);
    });

    it('drops lightning on a narrow viewport and halves the counts', () => {
      const full = TIER_FX.singular;
      const small = scaleFx(full, PHONE);
      expect(small.lightning).toBeNull();
      expect(small.particles!.count).toBeLessThan(full.particles!.count);
      expect(small.shower!.count).toBeLessThan(full.shower!.count);
      expect(small.beams!.count).toBeLessThan(full.beams!.count);
      expect(small.shake!.amplitude).toBeLessThan(full.shake!.amplitude);
    });

    it('keeps the event itself on a phone', () => {
      // A phone gets less of it, never none of it — the Singular is the one
      // drop a player may only ever see on the device in their hand.
      const small = scaleFx(TIER_FX.singular, PHONE);
      expect(small.crack).toBe(true);
      expect(small.scene).toBe('spiral');
      expect(small.sound).toBe('void');
      expect(small.duration).toBe(TIER_FX.singular.duration);
    });

    it('keeps lightning on a wide touchscreen', () => {
      // The cut is keyed on viewport width, not on the pointer: a tablet in
      // landscape has the screen and the GPU for it.
      const tablet = scaleFx(TIER_FX.mythic, { reduced: false, narrow: false, coarse: true });
      expect(tablet.lightning).not.toBeNull();
      expect(tablet.particles!.count).toBeLessThan(TIER_FX.mythic.particles!.count);
    });

    it('never scales a count below one', () => {
      const tiny = scaleFx(
        { ...TIER_FX.rare, particles: { count: 1, spread: 10, duration: 100 } },
        PHONE,
      );
      expect(tiny.particles!.count).toBe(1);
    });
  });
});
