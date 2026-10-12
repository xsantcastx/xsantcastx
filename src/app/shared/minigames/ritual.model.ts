/**
 * ritual.model.ts — the Enchanting ritual's pulse check, as pure functions.
 *
 * After the rune is placed on the circle, a ring of light shrinks from the
 * rim toward the centre, over and over. The player taps when it lies on the
 * socket ring (scale 1). A hit seats the rune; a miss just runs the pulse
 * again with a slightly wider window. Nothing is ever spent on a miss — the
 * gateway is only called after a hit.
 *
 * Quality only scales Enchanting XP (`craftSkillXp`, 8..40). It never touches
 * the socket, the rune or the item.
 */

/** The pulse ring's scale at the start and end of one sweep. The socket ring is 1. */
export const PULSE_FROM = 1.7;
export const PULSE_TO = 0.45;
/** One sweep, rim to centre. */
export const PULSE_PERIOD_MS = 1700;

/** Hit window (|scale - 1|) on the first try, how much each miss widens it, and the cap. */
export const PULSE_WINDOW = 0.14;
export const PULSE_WINDOW_STEP = 0.05;
export const PULSE_WINDOW_MAX = 0.3;

/** Quality given when reduced motion swaps the pulse for a plain confirm. */
export const RITUAL_CONFIRM_QUALITY = 0.5;

/** The lowest quality a hit can score — a hit at the very edge of the window. */
export const RITUAL_MIN_HIT_QUALITY = 0.4;

/** The pulse ring's scale `elapsedMs` into the ritual. */
export function pulseAt(elapsedMs: number, periodMs = PULSE_PERIOD_MS): number {
  if (!(periodMs > 0) || !Number.isFinite(elapsedMs)) return PULSE_FROM;
  const t = (((elapsedMs / periodMs) % 1) + 1) % 1;
  return PULSE_FROM + (PULSE_TO - PULSE_FROM) * t;
}

/**
 * The hit window after `misses` misses. `base` is the first-try window: today's
 * PULSE_WINDOW everywhere except an upgraded Enchanting Circle at home
 * (home-forge.model), which starts wider. Never past PULSE_WINDOW_MAX.
 */
export function pulseWindow(misses: number, base = PULSE_WINDOW): number {
  const m = Number.isFinite(misses) ? Math.max(0, Math.floor(misses)) : 0;
  const start = Number.isFinite(base) ? Math.min(PULSE_WINDOW_MAX, Math.max(PULSE_WINDOW, base)) : PULSE_WINDOW;
  return Math.min(PULSE_WINDOW_MAX, start + m * PULSE_WINDOW_STEP);
}

export type PulseResult = { hit: true; quality: number } | { hit: false };

/**
 * Grade a tap at pulse `scale`. A dead-centre hit is quality 1; the window's
 * edge is RITUAL_MIN_HIT_QUALITY. Each miss before the hit costs a little
 * quality (never below the floor), so trying again is always worth it.
 * `firstWindow` is today's PULSE_WINDOW unless an upgraded home circle passes a wider one.
 */
export function gradePulse(scale: number, misses = 0, firstWindow = PULSE_WINDOW): PulseResult {
  if (!Number.isFinite(scale)) return { hit: false };
  const err = Math.abs(scale - 1);
  const win = pulseWindow(misses, firstWindow);
  if (err > win) return { hit: false };
  const closeness = 1 - err / win;
  const base = RITUAL_MIN_HIT_QUALITY + (1 - RITUAL_MIN_HIT_QUALITY) * closeness;
  const m = Number.isFinite(misses) ? Math.max(0, Math.floor(misses)) : 0;
  const quality = Math.max(RITUAL_MIN_HIT_QUALITY, base - m * 0.1);
  return { hit: true, quality: Math.min(1, quality) };
}
