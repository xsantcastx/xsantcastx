/**
 * title-strategy.service.ts — the browser-tab name for every route.
 *
 * The site is The Godforge. "xsantcastx" is the maker's mark, not the product
 * name, and it is deliberately absent from page titles — it lives in the header
 * logo, the footer copyright, /about, the npm package name, and the SEO
 * keywords where it earns discovery. Nowhere else.
 *
 * Naming rule, applied by hand in the router config rather than by a helper:
 *   - a page whose name is already ours stands alone — "The Arena",
 *     "The Codex", "The War Table", "Fuel the Forge"
 *   - a page with a generic name takes the product on the end for context —
 *     "Contact — The Godforge", "MCP Server — The Godforge"
 *
 * The 128 tool pages keep their keyword phrasing and simply end in
 * "— The Godforge" instead of the old wordmark: a title is the strongest
 * on-page ranking signal there is, and those phrases are what the pages rank
 * on. Rebranding the suffix costs nothing; rewriting them to bare tool names
 * would.
 */
import { Injectable } from '@angular/core';
import { TitleStrategy, RouterStateSnapshot } from '@angular/router';
import { Title } from '@angular/platform-browser';

/** What the tab reads when a route supplies no title of its own. */
export const DEFAULT_TITLE = 'The Godforge';

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
  constructor(private readonly title: Title) {
    super();
  }

  override updateTitle(routerState: RouterStateSnapshot): void {
    this.title.setTitle(brandTitle(this.buildTitle(routerState)));
  }
}

/** Titles for the routes that share this map rather than spelling their own out. */
export const RouteTitles = {
  skills: 'Skills — The Godforge',
  projects: 'Projects — The Godforge',
  contact: 'Contact — The Godforge',
  donate: 'Fuel the Forge',
} as const;
