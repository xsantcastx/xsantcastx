import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { filter } from 'rxjs/operators';

export const SITE_URL = 'https://xsantcastx.com';

const SITE_NAME   = 'xsantcastx';
const DEFAULT_IMG = `${SITE_URL}/assets/og/og-default.jpg`;

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
        this.apply(this.title.getTitle(), data, url);
      });
  }

  private apply(pageTitle: string, data: Record<string, string | object>, url: string): void {
    const desc      = (data['description'] as string) || 'xsantcastx — Full-Stack Developer & Studio Utilities';
    const keywords  = data['keywords']  as string | undefined;
    const ogImage   = (data['ogImage']  as string | undefined) || DEFAULT_IMG;
    const canonical = `${SITE_URL}${url}`;

    // ── Standard ──────────────────────────────────────────────────────────
    this.meta.updateTag({ name: 'description',  content: desc });
    if (keywords) this.meta.updateTag({ name: 'keywords', content: keywords });

    // ── Open Graph ────────────────────────────────────────────────────────
    this.meta.updateTag({ property: 'og:title',       content: pageTitle });
    this.meta.updateTag({ property: 'og:description', content: desc });
    this.meta.updateTag({ property: 'og:url',         content: canonical });
    this.meta.updateTag({ property: 'og:image',       content: ogImage });
    this.meta.updateTag({ property: 'og:site_name',   content: SITE_NAME });
    this.meta.updateTag({ property: 'og:type',        content: 'website' });

    // ── Twitter ───────────────────────────────────────────────────────────
    this.meta.updateTag({ name: 'twitter:card',        content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title',       content: pageTitle });
    this.meta.updateTag({ name: 'twitter:description', content: desc });
    this.meta.updateTag({ name: 'twitter:image',       content: ogImage });

    // ── Canonical ─────────────────────────────────────────────────────────
    let link = this.doc.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', canonical);

    // ── JSON-LD ───────────────────────────────────────────────────────────
    const jsonLd = data['jsonLd'] as object | undefined;
    if (jsonLd) this.setJsonLd(jsonLd);
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
