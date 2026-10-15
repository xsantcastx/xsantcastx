/**
 * one-world-flag.ts — the One World preview gate (docs/design/one-world.md §5).
 *
 * A per-device preview, set three ways: Menu → "One World (preview)", the
 * query `?oneworld=1` / `?oneworld=0`, or this flag directly. It defaults OFF
 * until the flip at the end of P3, and is deleted in P4. With the gate off,
 * nothing in v3 runs and no v3 key is written: the old game, intact.
 *
 * Tiny and eager on purpose: no imports. It is a device preference (like the
 * minimap's fold), not game state, so it lives in its own localStorage key and
 * never rides the cloud save.
 */
export const ONE_WORLD_KEY = 'eclipse-oneworld';

/** Read once per page (a flip reloads): a query parameter wins, and is remembered. */
let cached: boolean | null = null;

export const OneWorldFlag = {
  /** True when this device previews One World. False on the server. */
  get on(): boolean {
    if (cached !== null) return cached;
    if (typeof window === 'undefined') return false;
    let on = false;
    try {
      const query = new URLSearchParams(window.location?.search ?? '').get('oneworld');
      if (query === '1' || query === '0') {
        on = query === '1';
        window.localStorage?.setItem(ONE_WORLD_KEY, on ? '1' : '0');
      } else on = window.localStorage?.getItem(ONE_WORLD_KEY) === '1';
    } catch { on = false; }
    cached = on;
    return on;
  },
  /** Turn the preview on or off for this device. The caller reloads: the world is built once per page. */
  set(on: boolean): void {
    cached = on;
    try { window.localStorage?.setItem(ONE_WORLD_KEY, on ? '1' : '0'); } catch { /* this page only */ }
  },
  /** Tests: forget the cached reading. */
  reset(): void { cached = null; },
};
