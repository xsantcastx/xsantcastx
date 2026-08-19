import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { filter } from 'rxjs/operators';
import { brandTitle } from './shared/title-strategy.service';

export const SITE_URL = 'https://xsantcastx.com';

const SITE_NAME   = 'Eclipse Realms';
const DEFAULT_IMG = `${SITE_URL}/assets/og/og-godforge.jpg`;
const DEFAULT_IMG_ALT =
  'Eclipse Realms — a violet-lit anvil on a stone altar beneath an eclipse, ringed by broken pillars';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private meta  = inject(Meta);
  private title = inject(Title);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);
  private doc    = inject(DOCUMENT);

  /** Call once from AppComponent.ngOnInit */
  init(): void {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => {
        let r = this.route;
        while (r.firstChild) r = r.firstChild;
        const data = r.snapshot.data;
        const url  = this.router.url.split('?')[0].split('#')[0];

        // Brand the route's own resolved title rather than reading the
        // document's. AppTitleStrategy and this subscriber both run off
        // NavigationEnd, and during prerender this one wins the race — so
        // getTitle() handed back whatever index.html shipped with, and every
        // static page went out with the same generic og:title and
        // twitter:title regardless of what stood in its <title>. Going
        // through the same brandTitle() the strategy uses means the two
        // cannot disagree, including on routes that declare a title without
        // the wordmark. getTitle() remains the fallback for a route with no
        // title of its own.
        const routeTitle = brandTitle(r.snapshot.title ?? this.title.getTitle());
        this.apply(routeTitle, data, url);
      });
  }

  private apply(pageTitle: string, data: Record<string, string | object>, url: string): void {
    const desc      = (data['description'] as string) || 'Eclipse Realms — a persistent world of five realms. Discover artifacts, forge runes, and walk the trials.';
    const keywords  = data['keywords']  as string | undefined;
    const ogImage   = (data['ogImage']  as string | undefined) || DEFAULT_IMG;

    // The canonical is the bare path, always, with no query string on it.
    //
    // The previous version canonicalised `?lang=es` to itself so the Spanish
    // view could stand as an hreflang alternate. That never survived the
    // build. Production is prerender + a static CSR shell — there is no live
    // SSR — so nothing ever renders a query-string URL: Hosting matches
    // `/world?lang=es` to the same `world/index.html` it serves for `/world`,
    // and that file was prerendered in English with a canonical link pointing
    // at the bare /world. Every ?lang=es URL Google fetched therefore
    // declared a canonical pointing somewhere else, which Search Console files
    // as "Alternate page with proper canonical tag" — the page is crawled,
    // understood, and dropped. Rewriting the tag after hydration only made it
    // worse: the raw HTML and the rendered DOM then disagreed about the
    // canonical, and Google resolves that conflict by trusting neither.
    //
    // One URL per page is the honest description of this site. `?lang=es`
    // still switches the copy for a human who follows a shared link — it is
    // just no longer advertised to crawlers as a separate page. See the
    // matching note in index.html for the hreflang tags this replaces.
    const canonical = `${SITE_URL}${url}`;

    // ── Standard ──────────────────────────────────────────────────────────
    this.meta.updateTag({ name: 'description',  content: desc });
    if (keywords) this.meta.updateTag({ name: 'keywords', content: keywords });

    // /embed/* is the same tool as /tools/*, chrome-less for iframing. Left
    // indexable it competes with the real page for the same queries, so it is
    // explicitly noindex — but still `follow`, so the outbound links keep
    // passing signals. Every other route inherits the site default and has to
    // be reset here, because Meta.updateTag mutates one shared <meta> element:
    // without the else branch a single embed visit would leave the tag reading
    // noindex for the rest of the session as the user navigates back out.
    this.meta.updateTag({
      name: 'robots',
      content: (data['embed'] || data['noindex']) ? 'noindex, follow' : 'index, follow'
    });

    // ── Open Graph ────────────────────────────────────────────────────────
    this.meta.updateTag({ property: 'og:title',         content: pageTitle });
    this.meta.updateTag({ property: 'og:description',   content: desc });
    this.meta.updateTag({ property: 'og:url',           content: canonical });
    this.meta.updateTag({ property: 'og:image',         content: ogImage });
    this.meta.updateTag({ property: 'og:image:width',   content: '1200' });
    this.meta.updateTag({ property: 'og:image:height',  content: '630' });
    this.meta.updateTag({ property: 'og:image:type',    content: ogImage.endsWith('.png') ? 'image/png' : 'image/jpeg' });
    this.meta.updateTag({ property: 'og:image:alt',     content: DEFAULT_IMG_ALT });
    this.meta.updateTag({ property: 'og:site_name',     content: SITE_NAME });
    this.meta.updateTag({ property: 'og:type',          content: 'website' });
    this.meta.updateTag({ property: 'og:locale',        content: 'en_US' });

    // ── Twitter ───────────────────────────────────────────────────────────
    this.meta.updateTag({ name: 'twitter:card',        content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title',       content: pageTitle });
    this.meta.updateTag({ name: 'twitter:description', content: desc });
    this.meta.updateTag({ name: 'twitter:image',       content: ogImage });
    this.meta.updateTag({ name: 'twitter:image:alt',   content: DEFAULT_IMG_ALT });

    // ── Canonical ─────────────────────────────────────────────────────────
    let link = this.doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', canonical);

    // ── hreflang ──────────────────────────────────────────────────────────
    // Deliberately none. hreflang annotates a set of URLs that serve the same
    // page in different languages, and this site has no such set: one URL
    // serves both languages and the language is a client-side preference. The
    // tags that used to be written here advertised `?lang=es` as a separate
    // page, and the canonical above — correctly — pointed it back at the bare
    // path, which is the contradiction Search Console was reporting.
    //
    // The sweep is not decoration. Meta/link elements written into <head> on
    // one navigation survive the next one, and a page prerendered before this
    // change can still be in a CDN cache with the old trio in it, so anything
    // left over is cleared rather than left to rot.
    this.clearAlternates();

    // ── JSON-LD ───────────────────────────────────────────────────────────
    const jsonLd = data['jsonLd'] as object | undefined;
    if (jsonLd) this.setJsonLd(jsonLd);
  }

  /** Drop every `<link rel="alternate" hreflang>` left in <head>. */
  private clearAlternates(): void {
    this.doc
      .querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]')
      .forEach(el => el.remove());
  }

  private setJsonLd(schema: object): void {
    let el = this.doc.getElementById('json-ld-route') as HTMLScriptElement | null;
    if (!el) {
      el = this.doc.createElement('script');
      el.id   = 'json-ld-route';
      el.type = 'application/ld+json';
      this.doc.head.appendChild(el);
    }
    el.textContent = JSON.stringify(schema);
  }
}
