/**
 * one-world-flag.ts — the One World gate (docs/design/one-world.md §5).
 *
 * FLIPPED (P2, 2026-10-15): One World is the game for everyone, new saves and
 * old. The only way back to the legacy town scenes is a developer's escape
 * hatch, `?oneworld=0`, which holds for that browser tab only (sessionStorage:
 * reloads keep it, a new tab does not); `?oneworld=1` clears it. It is not in
 * the menu. The old per-device preview key (`eclipse-oneworld` in
 * localStorage) is ignored and removed, so a device that once turned the
 * preview off is not stranded in the old game. P4 deletes the gate.
 *
 * Tiny and eager on purpose: no imports. A device/tab preference, never game
 * state: it never rides the cloud save.
 */
/** The retired per-device preview key (P1). Read only to remove it. */
export const ONE_WORLD_KEY = 'eclipse-oneworld';
/** The tab's escape hatch (`?oneworld=0`): '0' while this tab plays the legacy scenes. */
export const ONE_WORLD_ESCAPE_KEY = 'eclipse-oneworld-off';

/** Read once per page (a change reloads). */
let cached: boolean | null = null;

export const OneWorldFlag = {
  /** True unless this tab took the escape hatch. False on the server (the engine never runs there). */
  get on(): boolean {
    if (cached !== null) return cached;
    if (typeof window === 'undefined') return false;
    let on = true;
    try {
      window.localStorage?.removeItem(ONE_WORLD_KEY);
      const query = new URLSearchParams(window.location?.search ?? '').get('oneworld');
      if (query === '0') window.sessionStorage?.setItem(ONE_WORLD_ESCAPE_KEY, '0');
      else if (query === '1') window.sessionStorage?.removeItem(ONE_WORLD_ESCAPE_KEY);
      on = window.sessionStorage?.getItem(ONE_WORLD_ESCAPE_KEY) !== '0';
    } catch { on = true; }
    cached = on;
    return on;
  },
  /** Tests and the dev hatch: set this tab's gate. The caller reloads: the world is built once per page. */
  set(on: boolean): void {
    cached = on;
    try {
      if (on) window.sessionStorage?.removeItem(ONE_WORLD_ESCAPE_KEY);
      else window.sessionStorage?.setItem(ONE_WORLD_ESCAPE_KEY, '0');
    } catch { /* this page only */ }
  },
  /** Tests: forget the cached reading. */
  reset(): void { cached = null; },
};
