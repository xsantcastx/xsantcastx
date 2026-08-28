/**
 * title-strategy.service.ts — the browser-tab name for every route.
 *
 * The product is Eclipse Realms. "xsantcastx" is the maker's mark, not the
 * product name, and it is deliberately absent from page titles — it lives in
 * the header logo, the footer copyright, the npm package name, and the SEO
 * keywords where it earns discovery. Nowhere else.
 *
 * Naming rule, applied by hand in the router config rather than by a helper:
 *
 *     <what the page is, in words people search> — <detail> | Eclipse Realms
 *
 * e.g. "Crafting Bench — Forge Weapons & Armor | Eclipse Realms".
 *
 * This replaced a rule that let a page whose name was already ours stand alone
 * — "The Codex", "The Standing Orders", "The Bench". Those titles read well and
 * ranked for nothing. A title is the strongest on-page signal there is, and
 * nobody searches for "The Standing Orders"; they search for "daily quests".
 * The in-world name is kept at the front because it is also the brand and the
 * page's actual heading, and the searchable phrase follows it in the same
 * breath, before the pipe. Both halves fit inside the ~60 characters Google
 * renders before it truncates.
 *
 * The suffix is "| Eclipse Realms" everywhere, including on pages that used to
 * end in "— The Godforge". Two wordmarks across one site splits the brand
 * signal between them; the Godforge survives as the name of the forge itself
 * (and as `alternateName` on the VideoGame node in the router), not as a second
 * name for the site.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TitleStrategy, RouterStateSnapshot } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { AnalyticsService } from '../analytics.service';

/** What the tab reads when a route supplies no title of its own. */
export const DEFAULT_TITLE = 'Eclipse Realms';

/**
 * Resolve a route's title, falling back to the product name.
 *
 * Deliberately does no appending. An earlier version bolted the wordmark onto
 * any title that lacked it, which cannot express the rule above — it would
 * turn "The Arena" into "The Arena — The Godforge". Titles are now fully
 * formed at the route, and this exists so `SeoService` derives og:title and
 * twitter:title from the same string the tab gets; when the two computed
 * branding independently they disagreed on every page.
 */
export function brandTitle(title: string | undefined | null): string {
  return title || DEFAULT_TITLE;
}

@Injectable()
export class AppTitleStrategy extends TitleStrategy {
  private readonly analytics = inject(AnalyticsService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor(private readonly title: Title) {
    super();
  }

  override updateTitle(routerState: RouterStateSnapshot): void {
    const resolved = brandTitle(this.buildTitle(routerState));
    this.title.setTitle(resolved);

    // @angular/fire's ScreenTrackingService used to emit this on every
    // navigation, but it lives in @angular/fire/analytics, which statically
    // imports the auth SDK — see AppModule's providers. updateTitle() runs
    // once per completed navigation, which is the same moment, so the
    // page_view is logged from here instead. AnalyticsService gates it on
    // consent and queues it until the SDK finishes downloading.
    if (this.isBrowser) {
      this.analytics.trackPageView(routerState.url, resolved);
    }
  }
}

/** Titles for the routes that share this map rather than spelling their own out. */
export const RouteTitles = {
  donate: 'Fuel the Forge',
} as const;
