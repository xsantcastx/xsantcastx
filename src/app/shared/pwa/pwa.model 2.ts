/**
 * pwa.model.ts — the pure rules behind the installable app.
 *
 * Everything here is a plain function of its arguments: no window, no
 * navigator, no storage, no Angular. PwaService gathers the facts from the
 * browser and hands them in, which is what lets the rules run under SSR (where
 * there are no facts) and in a spec without a fake DOM.
 *
 * Three questions are answered here:
 *
 *   1. Are we running as the installed app?          isStandaloneDisplay()
 *   2. How does this browser install, if at all?     detectInstallPlatform()
 *   3. Has this visitor earned the install offer?    shouldOfferInstall()
 */

/** How a browser gets the game onto a home screen or dock. */
export type InstallPlatform =
  /** Chromium: `beforeinstallprompt` fires and we can call `prompt()`. */
  | 'prompt'
  /** iOS / iPadOS: no event, no API — only Share → Add to Home Screen. */
  | 'ios'
  /** Firefox desktop, in-app webviews, anything else: nothing we can offer. */
  | 'none';

/**
 * Display modes that mean "the installed app, not a browser tab".
 *
 * `window-controls-overlay` is listed because a desktop install with the title
 * bar folded away reports *that* mode and not `standalone` — a check for
 * standalone alone would decide the installed app was a tab and offer to
 * install it inside itself.
 */
export const APP_DISPLAY_MODES = ['standalone', 'window-controls-overlay', 'fullscreen', 'minimal-ui'] as const;

/**
 * True when the page is running as the installed app.
 *
 * `matches` answers a media query; iOS also exposes the older non-standard
 * `navigator.standalone`, which is the only signal on iOS versions that predate
 * display-mode support for home-screen apps.
 */
export function isStandaloneDisplay(
  matches: (query: string) => boolean,
  navigatorStandalone: boolean | undefined,
): boolean {
  if (navigatorStandalone === true) return true;
  return APP_DISPLAY_MODES.some(mode => {
    try { return matches(`(display-mode: ${mode})`); } catch { return false; }
  });
}

/**
 * Which install path this browser has.
 *
 * `hasPromptEvent` wins outright — if Chromium has handed us the event, that is
 * the path whatever the user agent claims. Otherwise iOS is recognised by UA,
 * including iPadOS, which has reported itself as desktop Safari ("Macintosh")
 * since iPadOS 13 and is told apart from a real Mac only by its touch points.
 * Every iOS browser can Add to Home Screen from iOS 16.4, so Chrome and Firefox
 * on iOS (CriOS / FxiOS) get the same instructions; in-app webviews (Instagram,
 * Facebook, …) cannot, and get nothing rather than instructions that lie.
 */
export function detectInstallPlatform(
  userAgent: string,
  maxTouchPoints: number,
  hasPromptEvent: boolean,
): InstallPlatform {
  if (hasPromptEvent) return 'prompt';
  const ua = userAgent || '';
  const iPhoneOrPod = /iPhone|iPod/.test(ua);
  const iPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  if (!iPhoneOrPod && !iPad) return 'none';
  if (/FBAN|FBAV|Instagram|Line\/|GSA\/|Twitter|LinkedInApp/.test(ua)) return 'none';
  return 'ios';
}

// ─────────────────────────────────────────────────────────────────────────────
// The engagement rule
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Device-local bookkeeping for the install offer.
 *
 * Deliberately NOT game state and NOT synced: whether this browser has been
 * offered an install is a fact about the browser, and a dismissal on a phone
 * must not silence the offer on a desktop that has never seen it. It lives in
 * its own localStorage key beside the other per-device UI preferences
 * (`preferred-language`, the consent record), outside the save gateway, which
 * refuses keys it does not own.
 */
export interface InstallOfferRecord {
  /** Distinct browser sessions seen on this device (a tab session, not a page load). */
  sessions: number;
  /** When the offer was last dismissed, ms since epoch. */
  dismissedAt: number | null;
  /** How many times it has been dismissed. Drives the growing cooldown. */
  dismissals: number;
  /** When `appinstalled` fired here. Once set, the offer never returns. */
  installedAt: number | null;
}

export const INSTALL_OFFER_KEY = 'godforge-install-offer';
/** The key the previous banner used — read once so an old dismissal is honoured. */
export const LEGACY_DISMISSED_KEY = 'godforge-install-dismissed';

export function emptyInstallOfferRecord(): InstallOfferRecord {
  return { sessions: 0, dismissedAt: null, dismissals: 0, installedAt: null };
}

const finiteOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
const count = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(Math.floor(v), 1_000_000) : 0;

/** Anything off disk — absent, corrupt, hand-edited — becomes a valid record. */
export function coerceInstallOfferRecord(raw: unknown, legacyDismissedAt?: unknown): InstallOfferRecord {
  const base = emptyInstallOfferRecord();
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const r = raw as Partial<Record<keyof InstallOfferRecord, unknown>>;
    base.sessions = count(r.sessions);
    base.dismissedAt = finiteOrNull(r.dismissedAt);
    base.dismissals = count(r.dismissals);
    base.installedAt = finiteOrNull(r.installedAt);
  }
  const legacy = finiteOrNull(typeof legacyDismissedAt === 'string' ? Number(legacyDismissedAt) : legacyDismissedAt);
  if (legacy !== null && base.dismissedAt === null) {
    base.dismissedAt = legacy;
    base.dismissals = Math.max(base.dismissals, 1);
  }
  return base;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * How long a dismissal silences the offer: 14 days, then 30, then 90.
 *
 * Growing rather than fixed, because the first "not now" is usually literal and
 * the third is not. After three dismissals the offer stops for good — someone
 * who has said no three times has answered the question.
 */
export const COOLDOWN_STEPS_DAYS = [14, 30, 90] as const;
export const MAX_DISMISSALS = COOLDOWN_STEPS_DAYS.length;

export function cooldownMs(dismissals: number): number {
  if (dismissals <= 0) return 0;
  const i = Math.min(dismissals, COOLDOWN_STEPS_DAYS.length) - 1;
  return COOLDOWN_STEPS_DAYS[i] * DAY;
}

/**
 * Minimum time on the page before the offer may appear, in this page load.
 * "Never on first paint" made concrete: the visitor has to have been here long
 * enough to be doing something.
 */
export const MIN_DWELL_MS = 25_000;

export interface InstallOfferInput {
  record: InstallOfferRecord;
  now: number;
  platform: InstallPlatform;
  standalone: boolean;
  /** The cookie banner is answered, so the two are never on screen together. */
  consentSettled: boolean;
  /** Milliseconds this page has been open. */
  dwellMs: number;
  /** The visitor has crafted or forged at least once (read from the save). */
  hasCrafted: boolean;
}

/** Why the offer is or is not showing. Returned for the spec and for debugging. */
export type InstallOfferVerdict =
  | 'show'
  | 'standalone'
  | 'installed'
  | 'unsupported'
  | 'consent-pending'
  | 'too-soon'
  | 'not-engaged'
  | 'cooling-down'
  | 'declined';

/**
 * The whole rule, in priority order.
 *
 * Engagement is "came back" (a second session) OR "made something" (a first
 * craft or forge). Either is a visitor who has found the game worth a second
 * minute; neither can be satisfied by the first paint of a first visit.
 */
export function installOfferVerdict(input: InstallOfferInput): InstallOfferVerdict {
  const { record, now } = input;
  if (input.standalone) return 'standalone';
  if (record.installedAt !== null) return 'installed';
  if (input.platform === 'none') return 'unsupported';
  if (record.dismissals >= MAX_DISMISSALS) return 'declined';
  if (record.dismissedAt !== null && now - record.dismissedAt < cooldownMs(record.dismissals)) {
    return 'cooling-down';
  }
  if (!input.consentSettled) return 'consent-pending';
  if (record.sessions < 2 && !input.hasCrafted) return 'not-engaged';
  if (input.dwellMs < MIN_DWELL_MS) return 'too-soon';
  return 'show';
}

export function shouldOfferInstall(input: InstallOfferInput): boolean {
  return installOfferVerdict(input) === 'show';
}

/** A fresh browser session was seen. */
export function withSession(record: InstallOfferRecord): InstallOfferRecord {
  return { ...record, sessions: record.sessions + 1 };
}

export function withDismissal(record: InstallOfferRecord, now: number): InstallOfferRecord {
  return { ...record, dismissedAt: now, dismissals: record.dismissals + 1 };
}

export function withInstall(record: InstallOfferRecord, now: number): InstallOfferRecord {
  return { ...record, installedAt: now };
}

/**
 * Has this save crafted or forged anything? Reads the crafting blob's shape
 * loosely — this only gates a banner, so anything unrecognised is "no" rather
 * than an error.
 */
export function hasCraftedFromSave(crafting: unknown): boolean {
  if (!crafting || typeof crafting !== 'object' || Array.isArray(crafting)) return false;
  const c = crafting as { xp?: unknown; crafted?: unknown };
  if (typeof c.xp === 'number' && c.xp > 0) return true;
  if (c.crafted && typeof c.crafted === 'object') {
    return Object.values(c.crafted as Record<string, unknown>).some(n => typeof n === 'number' && n > 0);
  }
  return false;
}
