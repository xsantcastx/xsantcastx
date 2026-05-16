#!/usr/bin/env node
/**
 * generate-sitemap.js
 * ─────────────────────────────────────────────────────────────────
 * Auto-generates src/sitemap.xml from prerender-routes.txt so the
 * <lastmod> dates never go stale.
 *
 * Rules:
 *   - Skip /embed/*  (iframe-only routes, not standalone pages)
 *   - Skip /404      (handled by robots.txt + intentional)
 *   - <lastmod>      = today's UTC date in YYYY-MM-DD
 *   - <changefreq>   per route type (home/tools=weekly, tool pages=monthly)
 *   - <priority>     per route type (home=1.0 → tool pages=0.6)
 *
 * Wired into package.json as a `postbuild` step so every production
 * build refreshes the sitemap automatically. Also rewrites the copy
 * inside dist/ so deploys ship the fresh dates.
 * ─────────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE_URL = 'https://xsantcastx.com';
const TODAY = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const ROUTES_FILE = path.join(ROOT, 'prerender-routes.txt');
const OUT_SRC = path.join(ROOT, 'src', 'sitemap.xml');
const OUT_DIST = path.join(ROOT, 'dist', 'xsantcastx', 'browser', 'sitemap.xml');

// Per-route metadata. Anything not matched here uses the default fallback below.
function metaFor(route) {
  if (route === '/home')        return { changefreq: 'weekly',  priority: '1.0' };
  if (route === '/tools')       return { changefreq: 'weekly',  priority: '0.9' };
  if (route === '/skills')      return { changefreq: 'monthly', priority: '0.7' };
  if (route === '/projects')    return { changefreq: 'monthly', priority: '0.7' };
  if (route === '/contact')     return { changefreq: 'monthly', priority: '0.7' };
  if (route === '/donate')      return { changefreq: 'monthly', priority: '0.7' };
  if (route === '/live')        return { changefreq: 'daily',   priority: '0.7' };
  if (route === '/games')       return { changefreq: 'monthly', priority: '0.6' };
  if (route === '/mcp')         return { changefreq: 'monthly', priority: '0.7' };
  if (route === '/guestbook')   return { changefreq: 'weekly',  priority: '0.6' };
  if (route.startsWith('/tools/')) return { changefreq: 'monthly', priority: '0.6' };
  return { changefreq: 'monthly', priority: '0.5' }; // fallback for anything new
}

function shouldInclude(route) {
  if (!route || !route.startsWith('/')) return false;
  if (route.startsWith('/embed/')) return false;
  if (route === '/embed') return false;
  if (route === '/404') return false;
  return true;
}

function buildSitemap(routes) {
  const urls = routes.map(route => {
    const { changefreq, priority } = metaFor(route);
    return `  <url>
    <loc>${SITE_URL}${route}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
  }).join('\n\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

${urls}

</urlset>
`;
}

function main() {
  if (!fs.existsSync(ROUTES_FILE)) {
    console.error(`[generate-sitemap] ${ROUTES_FILE} not found. Run a build first.`);
    process.exit(1);
  }

  const raw = fs.readFileSync(ROUTES_FILE, 'utf8');
  const routes = raw.split('\n').map(s => s.trim()).filter(shouldInclude);
  // De-duplicate while preserving order
  const seen = new Set();
  const unique = routes.filter(r => (seen.has(r) ? false : (seen.add(r), true)));

  const xml = buildSitemap(unique);

  fs.writeFileSync(OUT_SRC, xml);
  console.log(`[generate-sitemap] wrote ${unique.length} URLs → ${path.relative(ROOT, OUT_SRC)}`);

  if (fs.existsSync(path.dirname(OUT_DIST))) {
    fs.writeFileSync(OUT_DIST, xml);
    console.log(`[generate-sitemap] mirrored → ${path.relative(ROOT, OUT_DIST)}`);
  }
}

main();
