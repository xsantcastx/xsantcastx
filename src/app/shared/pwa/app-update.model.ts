/**
 * app-update.model.ts — the pure rules behind "a new version is ready".
 *
 * No window, no navigator, no Angular: AppUpdateService gathers the facts and
 * these decide. Kept apart so the decisions are testable without a fake
 * service worker.
 *
 * The facts:
 *   - the build this document booted (`<meta name="gf-build">`, stamped by
 *     scripts/stamp-build-id.js; absent under `ng serve`, which turns the whole
 *     feature off);
 *   - the build the server is on now (/version.json, same script);
 *   - whether a newer service worker is installed and waiting.
 */

/** How often a visible page asks the server what it is on. */
export const UPDATE_POLL_MS = 30 * 60 * 1000;
/**
 * A page coming back into view asks again, but not more often than this —
 * a phone flipped between apps all afternoon should not fetch on every flip.
 */
export const UPDATE_REFOCUS_GAP_MS = 2 * 60 * 1000;
/** After Reload: how long to wait for the new worker to take control. */
export const CONTROLLER_WAIT_MS = 4_000;
/** After Reload: how long a still-installing worker is given to finish. */
export const INSTALL_WAIT_MS = 6_000;
/** While an update is ready but the player is busy, how often to look again. */
export const BUSY_RECHECK_MS = 1_500;
/** sessionStorage: the build whose toast was dismissed with "Later". */
export const UPDATE_DISMISSED_KEY = 'gf-update-dismissed';

/** Build ids are short lowercase hex. Anything else is not one of ours. */
const BUILD_RE = /^[0-9a-f]{6,64}$/;

export function isBuildId(value: unknown): value is string {
  return typeof value === 'string' && BUILD_RE.test(value);
}

/** The `build` field of a parsed /version.json, or null if it is not one. */
export function parseVersionFile(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const build = (body as { build?: unknown }).build;
  return isBuildId(build) ? build : null;
}

export interface UpdateFacts {
  /** The build this document booted; null when unstamped (dev). */
  running: string | null;
  /** The server's build at the last successful check; null if unknown. */
  served: string | null;
  /** A newer worker is installed and waiting, and a worker controls the page. */
  waiting: boolean;
}

export type UpdateVerdict =
  /** Nothing to do. */
  | 'current'
  /** The server is on another build: offer the reload. */
  | 'available'
  /**
   * A worker is waiting but this page is already on the server's build — the
   * page reloaded onto the new HTML before the worker finished. Activate it
   * quietly; there is nothing for the player to reload into.
   */
  | 'activate-quietly';

export function updateVerdict(f: UpdateFacts): UpdateVerdict {
  if (!f.running) return 'current'; // unstamped build: the feature is off
  if (f.served !== null) {
    if (f.served !== f.running) return 'available';
    return f.waiting ? 'activate-quietly' : 'current';
  }
  // The version file could not be read (offline, blocked). A waiting worker is
  // then the only evidence, and it is good evidence: its bytes changed, which
  // per stamp-build-id.js means a deploy.
  return f.waiting ? 'available' : 'current';
}

/** Should a check triggered by `reason` run now? */
export function shouldCheck(
  reason: 'start' | 'poll' | 'visible' | 'online',
  now: number,
  lastCheck: number,
): boolean {
  if (reason === 'visible') return now - lastCheck >= UPDATE_REFOCUS_GAP_MS;
  return true;
}

/**
 * Is the player in the middle of something a reload offer must not interrupt?
 *
 * Read from the document rather than from the game, so this layer needs no
 * hook into /play: any open modal dialog (a station panel, the merge dialog,
 * the tutorial), the HUD's enemy bar (it is only on screen while a foe is
 * engaged), or anything that opts in with `data-gf-busy`.
 */
export const BUSY_SELECTORS = [
  '[aria-modal="true"]:not([hidden])',
  '.meter.enemy',
  '[data-gf-busy]',
] as const;

/** The slice of Element the busy check reads. */
export interface BusyNode {
  getClientRects(): ArrayLike<unknown>;
  checkVisibility?(options?: { checkOpacity?: boolean; checkVisibilityCSS?: boolean }): boolean;
}

export interface BusyProbe {
  querySelectorAll(selector: string): ArrayLike<BusyNode>;
}

/**
 * Actually on screen. Not just "has a box": the footer's three donation modals
 * live in the DOM on every page at opacity 0 / visibility hidden, and a check
 * that only measured boxes read every page as permanently busy.
 */
export function isShown(node: BusyNode, style?: (n: BusyNode) => { visibility: string; opacity: string }): boolean {
  if (node.getClientRects().length === 0) return false;
  if (typeof node.checkVisibility === 'function') {
    return node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  }
  if (!style) return true;
  const s = style(node);
  return s.visibility !== 'hidden' && s.opacity !== '0';
}

export function isPlayerBusy(
  doc: BusyProbe,
  style?: (n: BusyNode) => { visibility: string; opacity: string },
): boolean {
  for (const selector of BUSY_SELECTORS) {
    const nodes = doc.querySelectorAll(selector);
    for (let i = 0; i < nodes.length; i++) {
      if (isShown(nodes[i], style)) return true;
    }
  }
  return false;
}
