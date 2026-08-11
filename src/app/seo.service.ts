import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { filter } from 'rxjs/operators';

export const SITE_URL = 'https://xsantcastx.com';

const SITE_NAME   = 'xsantcastx';
const DEFAULT_IMG = `${SITE_URL}/assets/og/og-cosmic.svg`;
const DEFAULT_IMG_FALLBACK = `${SITE_URL}/assets/og/og-default.jpg`;

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
        const lang = r.snapshot.queryParamMap.get('lang') === 'es' ? 'es' : 'en';
        this.apply(this.title.getTitle(), data, url, lang);
      });
  }

  private apply(pageTitle: string, data: Record<string, string | object>, url: string, lang: 'en' | 'es'): void {
    const desc      = (data['description'] as string) || 'xsantcastx — Full-Stack Developer & Studio Utilities';
    const keywords  = data['keywords']  as string | undefined;
    const ogImage   = (data['ogImage']  as string | undefined) || DEFAULT_IMG;

    // One URL per language, and the canonical is always self-referential.
    // Canonicalising ?lang=es back to the bare path would tell Google the
    // Spanish view is a duplicate of the English one, which cancels out the
    // hreflang pair below — a URL cannot be an alternate and be canonicalised
    // away at the same time.
    const alternates = {
      en: `${SITE_URL}${url}`,
      es: `${SITE_URL}${url}?lang=es`
    };
    const canonical = alternates[lang];

    // ── Standard ──────────────────────────────────────────────────────────
    this.meta.updateTag({ name: 'description',  content: desc });
    if (keywords) this.meta.updateTag({ name: 'keywords', content: keywords });

    // ── Open Graph ────────────────────────────────────────────────────────
    this.meta.updateTag({ property: 'og:title',         content: pageTitle });
    this.meta.updateTag({ property: 'og:description',   content: desc });
    this.meta.updateTag({ property: 'og:url',           content: canonical });
    this.meta.updateTag({ property: 'og:image',         content: ogImage });
    this.meta.updateTag({ property: 'og:image:width',   content: '1200' });
    this.meta.updateTag({ property: 'og:image:height',  content: '630' });
    this.meta.updateTag({ property: 'og:image:type',    content: ogImage.endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg' });
    this.meta.updateTag({ property: 'og:image:alt',     content: 'xsantcastx — a cosmic constellation of free browser tools' });
    this.meta.updateTag({ property: 'og:site_name',     content: SITE_NAME });
    this.meta.updateTag({ property: 'og:type',          content: 'website' });
    this.meta.updateTag({ property: 'og:locale',          content: lang === 'es' ? 'es_ES' : 'en_US' });
    this.meta.updateTag({ property: 'og:locale:alternate', content: lang === 'es' ? 'en_US' : 'es_ES' });

    // ── Twitter ───────────────────────────────────────────────────────────
    this.meta.updateTag({ name: 'twitter:card',        content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title',       content: pageTitle });
    this.meta.updateTag({ name: 'twitter:description', content: desc });
    this.meta.updateTag({ name: 'twitter:image',       content: ogImage });
    this.meta.updateTag({ name: 'twitter:image:alt',   content: 'xsantcastx — a cosmic constellation of free browser tools' });

    // ── Canonical ─────────────────────────────────────────────────────────
    let link = this.doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', canonical);

    // ── hreflang ──────────────────────────────────────────────────────────
    // Rewritten per route rather than hard-coded in index.html, because an
    // hreflang set has to be self-referential: /tools/json-formatter must
    // point at its own two language URLs, not at the homepage's. A static
    // block in the head would make all 137 pages claim the homepage as their
    // alternate, which Search Console reports as "no return tag" site-wide.
    this.setAlternate('en', alternates.en);
    this.setAlternate('es', alternates.es);
    this.setAlternate('x-default', alternates.en);

    // ── JSON-LD ───────────────────────────────────────────────────────────
    const jsonLd = data['jsonLd'] as object | undefined;
    if (jsonLd) this.setJsonLd(jsonLd);
  }

  private setAlternate(hreflang: string, href: string): void {
    const selector = `link[rel="alternate"][hreflang="${hreflang}"]`;
    let el = this.doc.querySelector<HTMLLinkElement>(selector);
    if (!el) {
      el = this.doc.createElement('link');
      el.setAttribute('rel', 'alternate');
      el.setAttribute('hreflang', hreflang);
      this.doc.head.appendChild(el);
    }
    el.setAttribute('href', href);
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
