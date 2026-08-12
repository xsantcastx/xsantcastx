/**
 * title-strategy.service.ts — the browser-tab name for every route.
 *
 * House format is `<Page> · xsantcastx`, with the middot as the separator and
 * the wordmark last. Routes carry their own fully-formed title in the router
 * config; this strategy only brands the ones that forgot to, and supplies the
 * fallback for a route with no title at all.
 *
 * Nothing here says "portfolio" or names a job. The site is a platform — the
 * Godforge — and the tab should read like one on every page.
 */
import { Injectable } from '@angular/core';
import { TitleStrategy, RouterStateSnapshot } from '@angular/router';
import { Title } from '@angular/platform-browser';

/** What the tab reads when a route supplies no title of its own. */
export const DEFAULT_TITLE = 'xsantcastx · The Godforge';

/**
 * Put the wordmark on a route title, once.
 *
 * Exported because SeoService needs the identical string for og:title and
 * twitter:title — when the two branded independently, the arena game routes
 * (which declare a title without the wordmark) ended up with a `<title>` and
 * an `og:title` that disagreed on every page.
 *
 * Titles that already name the site are returned untouched, which is what
 * keeps the 128 tool pages — all ending in "| xsantcastx" — off this path.
 */
export function brandTitle(title: string | undefined | null): string {
  if (!title) return DEFAULT_TITLE;
  return title.includes('xsantcastx') ? title : `${title} · xsantcastx`;
}

@Injectable()
export class AppTitleStrategy extends TitleStrategy {
  constructor(private readonly title: Title) {
    super();
  }

  override updateTitle(routerState: RouterStateSnapshot): void {
    // brandTitle handles the undefined case by returning DEFAULT_TITLE.
    this.title.setTitle(brandTitle(this.buildTitle(routerState)));
  }
}

/**
 * Titles for the routes that share this map rather than spelling their own out.
 *
 * Each value is already fully formed, wordmark included, so `updateTitle` above
 * passes them through rather than re-branding them.
 */
export const RouteTitles = {
  skills: 'Skills · xsantcastx',
  projects: 'Projects · xsantcastx',
  contact: 'Contact · xsantcastx',
  donate: 'Fuel the Forge · xsantcastx',
} as const;
