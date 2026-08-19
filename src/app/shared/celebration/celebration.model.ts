/**
 * celebration.model.ts — how loud each rung of the ladder gets.
 *
 * Santiago's note was that a Rare turns up and nothing happens: the card flips,
 * the rune is banked, and the only thing that separates it from the Ash you
 * hold four hundred of is a border colour. The screen-level flare that already
 * exists starts at Legendary, which is roughly one strike in a hundred thousand
 * — so for almost every player, almost always, the answer to "did I get
 * something good" is a colour they have to remember the meaning of.
 *
 * This table moves the first real reaction down to Rare and then earns each rung
 * above it a channel the rung below did not have. The shape is deliberate and
 * it is the same shape the tier table already uses for `reveal` and `sound`:
 *
 *   Common      nothing. A Common should feel like nothing; that is what makes
 *               the rest work. Adding a fanfare here would cost the fanfare.
 *   Uncommon    a breath of colour. No sound, no shake, no cleanup cost.
 *   Rare        the first hit — a ring off the card, the edges catch light,
 *               particles, a chime, the name typed rather than printed.
 *   Epic        the viewport moves. Shake, an energy wave, the WebGL field
 *               shoves outward, a bass note under the chime.
 *   Legendary   dark, then gold. Lightning, a shower from the top of the
 *               screen, thunder and a horn, and the card slams down.
 *   Mythic      prismatic. Beams, more bolts, the field whites out, the card
 *               reveal itself drops to half speed so the moment has weight.
 *   Singular    an event. Black and silent for half a second, then the screen
 *               cracks and the rune is inside the crack.
 *
 * Every field is nullable and every null is "this rung does not get that
 * channel". The service reads the table and does exactly what is in it, so the
 * whole of the tuning lives here and none of it lives in the DOM code.
 *
 * Pure data and pure functions. No browser APIs — safe to import from SSR.
 */

import { RUNE_TIER_ORDER, type RuneTier } from '../rune-forge/rune.model';

/** Which layered audio cue the celebration fires. */
export type SoundProfile =
  | 'none'
  | 'ping'
  | 'chime'
  | 'chime-bass'
  | 'thunder-horn'
  | 'crescendo'
  | 'void';

/** How the WebGL particle field reacts, if it is running at all. */
export type SceneReaction =
  | 'none'
  /** Shove outward from the card. */
  | 'burst'
  /** Shove outward, then rush back in. */
  | 'burst-return'
  /** Burst plus a colour flash across the whole field. */
  | 'burst-flash'
  /** The field goes white and settles back. */
  | 'whiteout'
  /** Spiral inward to the card, then explode outward. */
  | 'spiral';

export interface ShakeFx { amplitude: number; duration: number }
export interface FlashFx { duration: number; opacity: number }
export interface WaveFx { rings: number; duration: number }
export interface ParticleFx { count: number; spread: number; duration: number }
export interface ShowerFx { count: number; duration: number }
export interface BoltFx { bolts: number; duration: number }
export interface BeamFx { count: number; duration: number; prismatic: boolean }
export interface BlackoutFx { fade: number; hold: number }

export interface TierFx {
  tier: RuneTier;
  /**
   * How long the whole celebration owns the screen, in milliseconds. The
   * service tears every layer down at this mark whatever else is still running,
   * so a bug in one effect cannot leave a fixed overlay on the page forever.
   */
  duration: number;
  /** Viewport shake. Amplitude in CSS pixels. */
  shake: ShakeFx | null;
  /** Vignette wash in the tier colour, from the screen edges inward. */
  flash: FlashFx | null;
  /** Expanding rings off the centre of the card. */
  wave: WaveFx | null;
  /** Radial burst of specks in the tier colour. */
  particles: ParticleFx | null;
  /** Fall from the top of the viewport. Legendary and up. */
  shower: ShowerFx | null;
  /** SVG bolts cracking in from the edges. */
  lightning: BoltFx | null;
  /** Light beams out of the card. `prismatic` cycles hue instead of holding one. */
  beams: BeamFx | null;
  /** The screen goes dark before the payoff lands. */
  blackout: BlackoutFx | null;
  /** Breaking-glass crack that the card materialises inside. */
  crack: boolean;
  /** A slow hue-rotate over the whole page. Reads as reality bending. */
  distort: boolean;
  /**
   * Multiplier on the card reveal's own animations. 2 is half speed.
   *
   * Applied by writing `data-gf-slowmo` on <html>, which the Rune Forge's own
   * stylesheet keys the longer durations off — the celebration does not reach
   * into the component, it raises a flag the component's CSS already reads.
   */
  timeScale: number;
  sound: SoundProfile;
  scene: SceneReaction;
  /** Reveal the rune's name one letter at a time rather than all at once. */
  letters: boolean;
}

/**
 * The ladder.
 *
 * Durations are held under the tier table's own `duration` (1600 / 2000 / 2600 /
 * 3200 / 4200 / 5600 / 9000) so the celebration always finishes inside the
 * window the reveal is on screen for. A celebration that outlives its card is a
 * celebration playing over an empty page.
 */
export const TIER_FX: Record<RuneTier, TierFx> = {
  /* Common — nothing. This is not an oversight; see the header. */
  common: {
    tier: 'common', duration: 0,
    shake: null, flash: null, wave: null, particles: null, shower: null,
    lightning: null, beams: null, blackout: null,
    crack: false, distort: false, timeScale: 1,
    sound: 'none', scene: 'none', letters: false,
  },

  /* Uncommon — one ring and a breath of colour at the edges. No sound. */
  uncommon: {
    tier: 'uncommon', duration: 900,
    shake: null,
    flash: { duration: 700, opacity: 0.16 },
    wave: { rings: 1, duration: 800 },
    particles: null, shower: null, lightning: null, beams: null, blackout: null,
    crack: false, distort: false, timeScale: 1,
    sound: 'ping', scene: 'none', letters: false,
  },

  /* Rare — the first hit of dopamine. Ring, edge flash, particles, a chime,
     and the name typed out rather than printed. */
  rare: {
    tier: 'rare', duration: 1600,
    shake: null,
    flash: { duration: 900, opacity: 0.32 },
    wave: { rings: 2, duration: 1100 },
    particles: { count: 26, spread: 260, duration: 1200 },
    shower: null, lightning: null, beams: null, blackout: null,
    crack: false, distort: false, timeScale: 1,
    sound: 'chime', scene: 'burst', letters: true,
  },

  /* Epic — the viewport moves for the first time. */
  epic: {
    tier: 'epic', duration: 2200,
    shake: { amplitude: 3, duration: 240 },
    flash: { duration: 1100, opacity: 0.4 },
    wave: { rings: 3, duration: 1500 },
    particles: { count: 40, spread: 340, duration: 1600 },
    shower: null, lightning: null,
    beams: { count: 6, duration: 1400, prismatic: false },
    blackout: null,
    crack: false, distort: false, timeScale: 1,
    sound: 'chime-bass', scene: 'burst-return', letters: true,
  },

  /* Legendary — dark, then gold. The first rung that takes the screen away
     before it gives anything back. */
  legendary: {
    tier: 'legendary', duration: 3000,
    shake: { amplitude: 6, duration: 420 },
    flash: { duration: 1600, opacity: 0.5 },
    wave: { rings: 3, duration: 1800 },
    particles: { count: 60, spread: 420, duration: 1900 },
    shower: { count: 40, duration: 2600 },
    lightning: { bolts: 3, duration: 900 },
    beams: { count: 8, duration: 2000, prismatic: false },
    blackout: { fade: 90, hold: 110 },
    crack: false, distort: false, timeScale: 1,
    sound: 'thunder-horn', scene: 'burst-flash', letters: true,
  },

  /* Mythic — prismatic, and the card reveal itself slows to half speed. */
  mythic: {
    tier: 'mythic', duration: 4000,
    shake: { amplitude: 8, duration: 560 },
    flash: { duration: 2000, opacity: 0.55 },
    wave: { rings: 4, duration: 2400 },
    particles: { count: 80, spread: 520, duration: 2400 },
    shower: { count: 56, duration: 3200 },
    lightning: { bolts: 5, duration: 1200 },
    beams: { count: 9, duration: 2800, prismatic: true },
    blackout: { fade: 110, hold: 140 },
    crack: false, distort: true, timeScale: 2,
    sound: 'crescendo', scene: 'whiteout', letters: true,
  },

  /* Singular — the Void. Black and silent, then the screen breaks.
     Roughly one strike in two million. It should not resemble anything else. */
  singular: {
    tier: 'singular', duration: 5600,
    shake: { amplitude: 10, duration: 700 },
    flash: { duration: 2600, opacity: 0.5 },
    wave: { rings: 5, duration: 3000 },
    particles: { count: 96, spread: 620, duration: 3000 },
    shower: { count: 64, duration: 4000 },
    lightning: { bolts: 6, duration: 1600 },
    beams: { count: 10, duration: 3400, prismatic: true },
    /* The long silence. Half a second of black with no sound under it is the
       whole trick: every other rung gives you something immediately. */
    blackout: { fade: 160, hold: 500 },
    crack: true, distort: true, timeScale: 2,
    sound: 'void', scene: 'spiral', letters: true,
  },
};

/** Below this rung the celebration is a no-op. Kept as a named constant so the
 *  "where does it start" question has one answer and not seven. */
export const CELEBRATION_FLOOR: RuneTier = 'uncommon';

export function fxFor(tier: RuneTier): TierFx {
  return TIER_FX[tier] ?? TIER_FX.common;
}

/** True when this tier earns anything at all. */
export function celebrates(tier: RuneTier): boolean {
  return RUNE_TIER_ORDER.indexOf(tier) >= RUNE_TIER_ORDER.indexOf(CELEBRATION_FLOOR)
    && fxFor(tier).duration > 0;
}

/** What the environment can afford. Passed in rather than read, so the scaling
 *  below is a pure function and can be tested without a browser. */
export interface FxBudget {
  /** `prefers-reduced-motion: reduce`. */
  reduced: boolean;
  /** Viewport narrower than 768px — a phone, by the site's own breakpoint. */
  narrow: boolean;
  /** Coarse pointer, i.e. touch. Correlates with a weaker GPU. */
  coarse: boolean;
}

/**
 * Cut the effect down to what the device and the visitor's preferences allow.
 *
 * Reduced motion keeps the *colour* and drops everything that moves: a visitor
 * who has asked for less motion still gets to know a Singular landed, they just
 * do not get the screen shaken at them. That is the site's standing rule — a
 * static end state, not an absent one.
 *
 * Narrow viewports drop lightning entirely (long SVG stroke animations over a
 * full-screen filter are the single most expensive thing here) and halve the
 * particle counts. The rest stays: a phone should still feel the Singular.
 */
export function scaleFx(fx: TierFx, budget: FxBudget): TierFx {
  if (budget.reduced) {
    return {
      ...fx,
      shake: null, wave: null, particles: null, shower: null,
      lightning: null, beams: null, blackout: null,
      crack: false, distort: false, timeScale: 1,
      scene: 'none',
      letters: false,
      // The wash stays, held rather than pulsed, and short.
      flash: fx.flash ? { duration: Math.min(fx.flash.duration, 700), opacity: fx.flash.opacity * 0.6 } : null,
      duration: fx.duration > 0 ? Math.min(fx.duration, 900) : 0,
    };
  }

  if (!budget.narrow && !budget.coarse) return fx;

  const half = (n: number) => Math.max(1, Math.round(n * 0.5));
  return {
    ...fx,
    // Lightning is the one effect a phone does not get. Six animated SVG paths
    // under a blur filter across the full viewport is a compositor stall on
    // exactly the hardware least able to absorb one.
    lightning: budget.narrow ? null : fx.lightning,
    particles: fx.particles ? { ...fx.particles, count: half(fx.particles.count) } : null,
    shower: fx.shower ? { ...fx.shower, count: half(fx.shower.count) } : null,
    beams: fx.beams ? { ...fx.beams, count: half(fx.beams.count) } : null,
    // A phone's shake is the phone in your hand, so it needs less of it.
    shake: fx.shake ? { ...fx.shake, amplitude: Math.max(2, Math.round(fx.shake.amplitude * 0.6)) } : null,
  };
}
