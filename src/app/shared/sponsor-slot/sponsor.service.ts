/**
 * SponsorService
 * ──────────────
 * Inventory + tracking layer for the Sponsored Tool Slots program
 * (direct-deal partnerships sold per Notion task 351e6899-…).
 *
 * Why hardcoded TS, not Firestore?
 *   • 1–2 sponsor changes/mo doesn't justify CMS infra cost.
 *   • Bypasses the Firebase egress block that's been stalling other
 *     monetization initiatives (see Day-16+ stall in strategy digest).
 *   • Each sponsor change ships as a normal commit → reviewable, revertable,
 *     and visible in changelog without an admin UI.
 *
 * Inventory model:
 *   • `placement` is the named slot location (e.g. 'tools-sidebar:ai',
 *     'tools-index:hero', 'category-banner:performance').
 *   • A sponsor entry can list multiple placements and a date window;
 *     the service returns only entries whose window covers "now".
 *   • Click + impression tracking: localStorage counter (immediate UX) +
 *     gtag custom event (analytics) — no Firebase dependency.
 *
 * The Cloudflare Worker endpoint mentioned in the Notion task is a
 * Phase-2 add-on; this module is wired so swapping `trackImpression` /
 * `trackClick` to POST to a Worker is a 5-line change.
 */
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Named placement slots — keep this list short and stable. */
export type SponsorPlacement =
  | 'tools-sidebar:ai'
  | 'tools-sidebar:networking'
  | 'tools-sidebar:performance'
  | 'tools-sidebar:security'
  | 'tools-sidebar:json'
  | 'tools-sidebar:design'
  | 'tools-index:hero'
  | 'category-banner:performance'
  | 'category-banner:ai'
  | 'category-banner:networking';

export interface Sponsor {
  /** Stable unique id used for tracking + storage keys */
  id: string;
  /** Brand display name (used in CTA) */
  brand: string;
  /** Short headline (max ~50 chars) */
  headline: string;
  /** One-line description (max ~110 chars) */
  description: string;
  /** CTA button label (e.g. 'Try free', 'Get $200 credit') */
  cta: string;
  /** Outbound URL (must include UTM tags) */
  ctaUrl: string;
  /** Slots this sponsor occupies — entry shown when component asks for any of these */
  slots: SponsorPlacement[];
  /** ISO date string (UTC) — inclusive */
  startDate: string;
  /** ISO date string (UTC) — inclusive. Use far-future for evergreen */
  endDate: string;
  /** Inline SVG path/contents (24×24 viewBox); falls back to a neutral mark if empty */
  iconSvg?: string;
  /** Accent color hex (used for CTA border + button) */
  accentColor: string;
  /**
   * Optional internal tracking endpoint override. When the Cloudflare Worker
   * endpoint is wired, set this per-sponsor (or globally) to POST events.
   */
  impressionTrackerUrl?: string;
}

/**
 * Live sponsor inventory — single source of truth.
 *
 * Owner workflow to add a sponsor:
 *   1. Land the deal (Polar invoice flow).
 *   2. Add an entry below with start/end dates from the contract.
 *   3. Commit + ship as `feat(sponsor): add <brand> <slot> <YYYY-MM>`.
 *   4. Verify on the live page using `?sponsor_debug=1` (logs slot decisions).
 */
const SPONSOR_INVENTORY: Sponsor[] = [
  // No paid sponsors yet — Week 1 of the 3-week launch plan is sales outreach.
  // Once a deal closes, append the entry here. The component renders nothing
  // when `getActiveSponsorForPlacement(...)` returns null, so keeping this
  // empty is the correct production default.
];

/**
 * Default placeholder entries used when a placement has no live sponsor AND
 * the "house" mode is enabled (querystring or env). These promote the
 * site's own initiatives (newsletter, donation, pro pack) to keep slot
 * inventory warm during sales ramp-up.
 *
 * Off by default: production renders nothing rather than a placeholder
 * unless the owner explicitly opts in via `?sponsor_house=1`.
 */
const HOUSE_INVENTORY: Sponsor[] = [
  {
    id: 'house-newsletter',
    brand: 'xsantcastx',
    headline: 'Get one new dev tool a week',
    description: 'Free newsletter — no spam, just the new tools shipped this week.',
    cta: 'Subscribe free',
    ctaUrl: '/contact?source=sponsor-slot-newsletter#newsletter',
    slots: [
      'tools-sidebar:ai',
      'tools-sidebar:networking',
      'tools-sidebar:performance',
      'tools-sidebar:security',
      'tools-sidebar:json',
      'tools-sidebar:design',
      'tools-index:hero',
    ],
    startDate: '2026-01-01',
    endDate: '2099-12-31',
    accentColor: '#00ffcc',
  },
];

@Injectable({ providedIn: 'root' })
export class SponsorService {
  private readonly isBrowser: boolean;
  /** Per-pageload impressions deduper so a slot doesn't double-count if reused */
  private impressedThisLoad = new Set<string>();

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  /**
   * Return the highest-priority sponsor that is live today and matches the
   * requested placement. Order = inventory order (so paid > house, top first).
   * Returns null when nothing is bookable — component should render nothing.
   */
  getActiveSponsorForPlacement(placement: SponsorPlacement): Sponsor | null {
    const now = this.now();
    const live = (s: Sponsor) =>
      s.slots.includes(placement) &&
      s.startDate <= now &&
      s.endDate >= now;

    const paid = SPONSOR_INVENTORY.find(live);
    if (paid) return paid;

    if (this.houseModeEnabled()) {
      const house = HOUSE_INVENTORY.find(live);
      if (house) return house;
    }

    return null;
  }

  /**
   * Return all sponsors live today for a placement (rotation/A-B candidates).
   */
  getAllActiveSponsors(placement: SponsorPlacement): Sponsor[] {
    const now = this.now();
    const live = (s: Sponsor) =>
      s.slots.includes(placement) &&
      s.startDate <= now &&
      s.endDate >= now;
    const list = SPONSOR_INVENTORY.filter(live);
    if (this.houseModeEnabled()) list.push(...HOUSE_INVENTORY.filter(live));
    return list;
  }

  /**
   * Record an impression. Idempotent per placement-per-pageload to avoid
   * over-counting when a component re-renders.
   */
  trackImpression(sponsor: Sponsor, placement: SponsorPlacement): void {
    if (!this.isBrowser) return;
    const dedupeKey = `${sponsor.id}|${placement}`;
    if (this.impressedThisLoad.has(dedupeKey)) return;
    this.impressedThisLoad.add(dedupeKey);

    this.bumpLocalCounter(`sponsor_imp_${sponsor.id}`);
    this.fireGtag('sponsor_impression', sponsor, placement);
    this.maybePostToWorker(sponsor, placement, 'impression');
  }

  /**
   * Record a click. Always counted (each click is meaningful).
   */
  trackClick(sponsor: Sponsor, placement: SponsorPlacement): void {
    if (!this.isBrowser) return;
    this.bumpLocalCounter(`sponsor_click_${sponsor.id}`);
    this.fireGtag('sponsor_click', sponsor, placement);
    this.maybePostToWorker(sponsor, placement, 'click');
  }

  /**
   * Read local counters — handy for the owner's daily standup or for
   * surfacing per-sponsor running totals in an admin view later.
   */
  getLocalCounter(sponsorId: string, kind: 'imp' | 'click'): number {
    if (!this.isBrowser) return 0;
    try {
      const raw = localStorage.getItem(`sponsor_${kind}_${sponsorId}`);
      return raw ? parseInt(raw, 10) || 0 : 0;
    } catch {
      return 0;
    }
  }

  // ── internals ──────────────────────────────────────────────────────────

  private now(): string {
    // YYYY-MM-DD comparison — safe lexicographic order
    return new Date().toISOString().slice(0, 10);
  }

  private houseModeEnabled(): boolean {
    if (!this.isBrowser) return false;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('sponsor_house') === '1') return true;
      // Persist for the session once enabled
      if (sessionStorage.getItem('sponsor_house') === '1') return true;
    } catch {
      // ignore
    }
    return false;
  }

  private bumpLocalCounter(key: string): void {
    try {
      const next = (parseInt(localStorage.getItem(key) || '0', 10) || 0) + 1;
      localStorage.setItem(key, String(next));
    } catch {
      // localStorage may be disabled — silently ignore
    }
  }

  private fireGtag(
    event: 'sponsor_impression' | 'sponsor_click',
    sponsor: Sponsor,
    placement: SponsorPlacement,
  ): void {
    const w = window as unknown as {
      gtag?: (event: string, action: string, params: Record<string, string>) => void;
    };
    if (typeof w.gtag === 'function') {
      w.gtag('event', event, {
        sponsor_id: sponsor.id,
        sponsor_brand: sponsor.brand,
        placement,
        event_category: 'monetization',
      });
    }
  }

  private maybePostToWorker(
    sponsor: Sponsor,
    placement: SponsorPlacement,
    event: 'impression' | 'click',
  ): void {
    const url = sponsor.impressionTrackerUrl;
    if (!url) return;
    try {
      // beacon is fire-and-forget, ignored by ad-blockers less aggressively
      // than fetch + 3rd-party domain. Stays sync with no UX cost.
      const payload = JSON.stringify({
        sponsor_id: sponsor.id,
        placement,
        event,
        ts: Date.now(),
      });
      const ok =
        'sendBeacon' in navigator &&
        (navigator as Navigator).sendBeacon(url, new Blob([payload], { type: 'application/json' }));
      if (!ok) {
        // Fallback for browsers without sendBeacon — non-blocking fetch
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => undefined);
      }
    } catch {
      // never let analytics break the page
    }
  }
}
