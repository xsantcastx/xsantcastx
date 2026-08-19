/**
 * realm.routes.ts — one explicit route per realm, generated from the bible.
 *
 * Why these are not left to `world/realms/:realmId`
 * -------------------------------------------------
 * A param route carries one `data` block, so all five realm pages shipped the
 * same `<meta name="description">` — "Inspect one of the five Eclipse Realms:
 * faction, landmark, hazard, resource, threat, and unresolved conflict." Their
 * bodies overlap too: measured against each other the prerendered pages are
 * ~53% identical text, because roughly 2,000 of their ~3,900 characters are
 * the shared header, footer, donation modals and cookie banner, and the lore
 * that distinguishes them is only ~1,800 characters deep.
 *
 * Five thin pages, one shared description, one shared title pattern, and one
 * shared template is the exact shape Google clusters — and once it clusters a
 * set it elects its own representative, which is what Search Console was
 * reporting as "Duplicate, Google chose different canonical than user". The
 * self-referential canonical tag does not settle that argument; Google treats
 * canonical as a hint and overrules it when the pages read as one page.
 *
 * So each realm gets its own route with its own title, description, keywords
 * and JSON-LD. Everything is derived from FIVE_REALMS rather than retyped, so
 * a change to the narrative bible cannot leave the search metadata behind.
 *
 * `world/realms/:realmId` stays as the fallback and is now `noindex` — an
 * arbitrary id renders the same shell with no realm in it, and there are
 * unlimited ways to spell one.
 */
import { Routes } from '@angular/router';

import { SITE_URL } from '../seo.service';
import { FIVE_REALMS, type NarrativeRealm } from '../shared/narrative/five-realms.narrative';

/**
 * ~150-165 characters, and distinct from the first word — the chapter title
 * leads, so no two of these share an opening phrase.
 */
function realmDescription(realm: NarrativeRealm): string {
  return `${realm.chapterTitle} — the ${realm.name} chapter of Eclipse Realms. `
    + `${realm.faction} at the ${realm.landmark}: `
    + `${realm.resource}, ${realm.hazard}, and ${realm.threat}.`;
}

function realmJsonLd(realm: NarrativeRealm) {
  const url = `${SITE_URL}/world/realms/${realm.id}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': url,
    url,
    name: `${realm.name} — Eclipse Realms`,
    description: realmDescription(realm),
    isPartOf: { '@id': `${SITE_URL}/#website` },
    about: {
      '@type': 'Place',
      name: realm.landmark,
      description: realm.landmarkDetail,
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'World', item: `${SITE_URL}/world` },
        { '@type': 'ListItem', position: 2, name: realm.name, item: url },
      ],
    },
  };
}

/**
 * Registered after the two sub-locations (`.../infernal/basalt-seamworks`,
 * `.../verdant/rootglass-canopy`) and before `world/realms/:realmId`, matching
 * the order those already rely on.
 */
export const REALM_ROUTES: Routes = FIVE_REALMS.map(realm => ({
  path: `world/realms/${realm.id}`,
  loadComponent: () =>
    import('./realm-landing.component').then(m => m.RealmLandingComponent),
  title: `${realm.name} — Eclipse Realms`,
  data: {
    description: realmDescription(realm),
    keywords: [
      'eclipse realms',
      realm.name.toLowerCase(),
      realm.chapterTitle.toLowerCase(),
      realm.faction.toLowerCase(),
      realm.landmark.toLowerCase(),
      realm.resource.toLowerCase(),
    ].join(', '),
    ogImage: `${SITE_URL}/assets/og/og-godforge.jpg`,
    jsonLd: realmJsonLd(realm),
  },
}));
