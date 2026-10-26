/**
 * td-detail.ts — Environment detail (Menu → Settings; owner 2026-10-26: "the environment looks too much … better how it
 * was before, or maybe a little less"; docs/handoff/calm.md).
 *
 *   normal  the calm world: the rich ground with fewer flowers and stones, a quieter grass, simpler road edges, the
 *           round crowns in fewer, bigger, softer clusters. The default.
 *   low     the cheapest: the old flat ground painters, the old clean trees with a soft shadow, no aura motes; the
 *           canvas at no more than 1.5 device pixels per CSS pixel. A weak phone starts here by itself.
 *
 * The characters, creatures and pets keep their new look on both. A device's own choice, not the Keeper's: it lives in
 * plain localStorage behind try/catch (the HUD layout's rule), never the save gateway, so a phone on Low never turns a
 * desktop's world flat. No choice stored: Low on a low-end device (deviceMemory ≤ 4, hardwareConcurrency ≤ 4), or once
 * the engine measures slow frames (engine `watchFrames`), else Normal.
 */
export type EnvDetail = 'normal' | 'low';
export const ENV_DETAILS: readonly EnvDetail[] = ['normal', 'low'];
export const DETAIL_KEY = 'eclipse-td-detail';

type Nav = { deviceMemory?: number; hardwareConcurrency?: number; webdriver?: boolean };

/** The device looks weak (an automated browser never does, so the specs see one world). */
export function lowEndDevice(nav: Nav | undefined = typeof navigator === 'undefined' ? undefined : navigator as Nav): boolean {
  if (!nav || nav.webdriver) return false;
  return (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4) || (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4);
}

function stored(): EnvDetail | null {
  try {
    const v = typeof localStorage === 'undefined' ? null : localStorage.getItem(DETAIL_KEY);
    return ENV_DETAILS.includes(v as EnvDetail) ? v as EnvDetail : null;
  } catch { return null; }
}

let current: EnvDetail | null = null;
let auto = false;
const listeners = new Set<(d: EnvDetail) => void>();

/** The detail the world is drawn at now. */
export function envDetail(): EnvDetail {
  if (current) return current;
  const s = stored();
  auto = !s;
  current = s ?? (lowEndDevice() ? 'low' : 'normal');
  return current;
}
/** True when nobody chose (the device's guess is in use, so measured slow frames may still lower it). */
export function detailIsAuto(): boolean { envDetail(); return auto; }

/** The player's choice (Menu → Settings): saved on this device, applied at once. */
export function setEnvDetail(d: EnvDetail, persist = true): void {
  if (!ENV_DETAILS.includes(d)) return;
  if (persist) { auto = false; try { localStorage.setItem(DETAIL_KEY, d); } catch { /* private mode: this session only */ } }
  if (envDetail() === d) return;
  current = d;
  for (const f of listeners) f(d);
}
/** Measured slow frames with no choice made: Low for this session (the player can still pick Normal). */
export function autoLowerDetail(): boolean {
  if (!detailIsAuto() || envDetail() === 'low') return false;
  setEnvDetail('low', false);
  return true;
}
export function onEnvDetail(f: (d: EnvDetail) => void): () => void { listeners.add(f); return () => listeners.delete(f); }
