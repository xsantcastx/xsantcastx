/**
 * ad-config.ts — the one place that knows whether an ad network is live.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * Before this, "is Carbon configured?" was answerable only by reading a comment
 * above a string constant. The constant *looked* live — `serve=CWYD42JY` has
 * exactly the shape of a real Carbon serve id — and the only thing marking it
 * as fake was a line of prose four lines up. That is a placeholder that ships.
 *
 * So the placeholder values are now named constants compared against at
 * runtime, and every ad surface asks `activeAdNetwork()` instead of assuming.
 * When no network is live the surfaces render a house ad pointing at /sponsors
 * rather than an empty box, which turns dead inventory into a sales pitch.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TO GO LIVE — owner actions, one network is enough
 * ─────────────────────────────────────────────────────────────────────────────
 * Carbon Ads (best fit: developer audience, one tasteful unit, no tracking)
 *   1. Apply at https://www.carbonads.net/ with xsantcastx.com.
 *   2. On approval they hand you a snippet containing `?serve=XXXXXXXX&placement=yyyy`.
 *   3. Put that serve id in CARBON.serve and the placement in CARBON.placement.
 *
 * EthicalAds (easier to get into than Carbon; privacy-first, dev audience)
 *   1. Sign up at https://www.ethicalads.io/publishers/
 *   2. They assign a publisher slug.
 *   3. Put it in ETHICAL.publisher.
 *
 * Google AdSense (highest fill, lowest taste; last resort)
 *   1. Apply at https://adsense.google.com.
 *   2. Put the `ca-pub-…` id in ADSENSE.client and the numeric unit id in
 *      ADSENSE.slot, AND update the loader in src/index.html to match.
 *
 * Changing any of these is a one-line commit and needs no other edit: the
 * components read `activeAdNetwork()` and switch themselves.
 */

/** Networks the site knows how to render. */
export type AdNetwork = 'carbon' | 'ethical' | 'adsense' | 'house';

/**
 * Values that mean "not configured yet".
 *
 * Compared case-insensitively, and any value containing 'XXXX' is treated as a
 * placeholder too — that is the shape every vendor's own docs use for the
 * redacted example, so it is the shape a half-finished copy-paste leaves behind.
 */
const PLACEHOLDERS: ReadonlySet<string> = new Set([
  // The original Carbon placeholder. Looks exactly like a real serve id, which
  // is precisely why it needs to be named here rather than eyeballed.
  'cwyd42jy',
  'ca-pub-xxxxxxxxxx',
  '0000000000',
  '',
]);

function isPlaceholder(value: string): boolean {
  const v = value.trim().toLowerCase();
  return PLACEHOLDERS.has(v) || v.includes('xxxx');
}

export const CARBON = {
  /** The `serve=` parameter from the Carbon snippet. */
  serve: 'CWYD42JY',
  /** The `placement=` parameter from the Carbon snippet. */
  placement: 'xsantcastxcom',
} as const;

export const ETHICAL = {
  /** EthicalAds publisher slug. */
  publisher: '',
} as const;

export const ADSENSE = {
  /** `ca-pub-…` publisher id. */
  client: 'ca-pub-XXXXXXXXXX',
  /** Numeric ad-unit id. */
  slot: '0000000000',
} as const;

/**
 * Which network should render, in preference order.
 *
 * Carbon first because it is the best fit for a developer-tools audience: one
 * unobtrusive unit, no behavioural tracking, and an advertiser pool that is
 * mostly dev tooling — so the ad is plausibly useful to the person reading it.
 * AdSense sits last because it is the opposite of all three.
 *
 * Falls through to 'house' — never to nothing. An empty ad slot is wasted
 * inventory; a house ad at least tells a would-be sponsor the slot exists.
 */
export function activeAdNetwork(): AdNetwork {
  if (!isPlaceholder(CARBON.serve)) return 'carbon';
  if (!isPlaceholder(ETHICAL.publisher)) return 'ethical';
  if (!isPlaceholder(ADSENSE.client) && !isPlaceholder(ADSENSE.slot)) return 'adsense';
  return 'house';
}

/** True when a paying network is configured — i.e. the slot earns money. */
export function hasLiveAdNetwork(): boolean {
  return activeAdNetwork() !== 'house';
}

/** The full Carbon script URL, assembled from the configured parts. */
export function carbonScriptSrc(): string {
  return `//cdn.carbonads.com/carbon.js?serve=${CARBON.serve}&placement=${CARBON.placement}`;
}

/**
 * Route prefixes that never show ads.
 *
 * /admin and /forge-keeper are the owner's and the player's own dashboards —
 * surfaces where an ad reads as a bug rather than as inventory. Matched by
 * prefix so child routes inherit the suppression.
 */
export const AD_FREE_ROUTES: readonly string[] = [
  '/admin',
  '/forge-keeper',
  '/pro',
  '/sponsors',
  '/donate',
];

/** Whether ads are allowed on a given URL path. */
export function routeAllowsAds(url: string): boolean {
  // Strip query + fragment before matching so '/admin?tab=x' still suppresses.
  const path = url.split(/[?#]/)[0];
  return !AD_FREE_ROUTES.some(
    prefix => path === prefix || path.startsWith(prefix + '/'),
  );
}
