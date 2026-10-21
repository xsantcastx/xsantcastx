/**
 * audio-visibility.ts — every AudioContext on the page goes quiet when the page does.
 *
 * The world's score (SoundService) already suspends on a hidden tab, but the forge, level-up, celebration and
 * rarity cues each build their own context and kept playing when a phone switched to another app (owner,
 * 2026-10-21). Each of those contexts is handed to `guardAudioContext` as it is born: a hidden page (another
 * app, a locked screen, a background tab) suspends it, and a visible one wakes it. `audioHidden()` lets a cue
 * refuse to start at all while the page is away, so a timer that fires in the background cannot resume a
 * context behind the guard's back.
 *
 * Pure DOM, import-free, SSR-safe: off the browser every function is a no-op.
 */

const guarded = new Set<AudioContext>();
let bound = false;

function hidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

function apply(away: boolean): void {
  for (const ctx of guarded) {
    if (ctx.state === 'closed') { guarded.delete(ctx); continue; }
    if (away && ctx.state === 'running') void ctx.suspend().catch(() => undefined);
    else if (!away && ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  }
}

function bind(): void {
  if (bound || typeof document === 'undefined' || typeof window === 'undefined') return;
  bound = true;
  document.addEventListener('visibilitychange', () => apply(hidden()));
  // pagehide covers the cases visibilitychange misses on some mobile browsers (bfcache, app switch on iOS).
  window.addEventListener('pagehide', () => apply(true));
  window.addEventListener('pageshow', () => apply(hidden()));
}

/** Register a context: it suspends whenever the page is hidden and wakes when it is shown again. */
export function guardAudioContext<T extends AudioContext>(ctx: T): T {
  guarded.add(ctx);
  bind();
  if (hidden() && ctx.state === 'running') void ctx.suspend().catch(() => undefined);
  return ctx;
}

/** True while the page is hidden: a cue should not start (nor resume its context) then. */
export function audioHidden(): boolean {
  return hidden();
}
