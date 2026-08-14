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
  if (route === '/world')        return { changefreq: 'weekly',  priority: '1.0' };
  if (route === '/tools')        return { changefreq: 'weekly',  priority: '0.9' };
  if (route === '/skills')       return { changefreq: 'monthly', priority: '0.7' };
  if (route === '/projects')     return { changefreq: 'monthly', priority: '0.7' };
  if (route === '/contact')      return { changefreq: 'monthly', priority: '0.7' };
  if (route === '/donate')       return { changefreq: 'monthly', priority: '0.7' };
  if (route === '/live')         return { changefreq: 'daily',   priority: '0.7' };
  if (route === '/world/trials') return { changefreq: 'monthly', priority: '0.6' };
  if (route === '/world/quests') return { changefreq: 'weekly',  priority: '0.7' };
  if (route === '/mcp')          return { changefreq: 'monthly', priority: '0.7' };
  if (route === '/guestbook')    return { changefreq: 'weekly',  priority: '0.6' };
  if (route === '/blueprint')    return { changefreq: 'weekly',  priority: '0.8' };
  if (route === '/sponsors')     return { changefreq: 'monthly', priority: '0.6' };
  if (route === '/codex')        return { changefreq: 'weekly',  priority: '0.7' };
  if (route === '/character')    return { changefreq: 'monthly', priority: '0.5' };
  if (route === '/forge/runes')  return { changefreq: 'weekly',  priority: '0.7' };
  if (route.startsWith('/tools/')) return { changefreq: 'monthly', priority: '0.6' };
  if (route.startsWith('/arena/')) return { changefreq: 'monthly', priority: '0.6' };
  return { changefreq: 'monthly', priority: '0.5' }; // fallback for anything new
}

function shouldInclude(route) {
  if (!route || !route.startsWith('/')) return false;
  if (route.startsWith('/embed/')) return false;
  if (route === '/embed') return false;
  if (route === '/404') return false;
  // /admin is the owner-only dashboard. It is deliberately absent from
  // prerender-routes.txt, so this line is defence against a future edit that
  // adds it there for some other reason — the sitemap is a public document and
  // must never advertise the route.
  if (route === '/admin' || route.startsWith('/admin/')) return false;
  // Redirect leftovers must not be advertised if they linger in prerender-routes.txt.
  if (route === '/home' || route === '/forge-keeper' || route === '/rune-forge'
      || route === '/quests' || route === '/arena') return false;
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

/**
 * Measure the built bundle so /admin can show real numbers instead of a
 * "connect something" placeholder.
 *
 * Returns null when dist/ is absent, which is the normal case on the `prebuild`
 * run (dist has just been deleted) and in `ng serve`. The dashboard reports
 * that honestly rather than rendering a zero, and the `postbuild` run — which
 * happens after the bundle exists — overwrites this with the real figures.
 */
function measureBundle() {
  const browserDir = path.join(ROOT, 'dist', 'xsantcastx', 'browser');
  if (!fs.existsSync(browserDir)) return null;

  const js = fs.readdirSync(browserDir).filter(f => f.endsWith('.js'));
  if (!js.length) return null;

  const kb = file => Math.round(fs.statSync(path.join(browserDir, file)).size / 1024);
  const main = js.find(f => /^main[.-]/.test(f));

  return {
    mainKb: main ? kb(main) : 0,
    totalJsKb: js.reduce((sum, f) => sum + kb(f), 0),
    chunks: js.length
  };
}

/**
 * Build-time facts the /admin dashboard reads at runtime.
 *
 * Written into src/assets so the `prebuild` run seeds a copy that the Angular
 * asset pipeline picks up, and into dist/ directly so the `postbuild` run —
 * the only one that can actually see the bundle — gets the real byte counts
 * into the deployed artifact.
 */
function writeBuildStats(totalRoutes, sitemapUrls) {
  const stats = {
    generatedAt: new Date().toISOString(),
    prerenderRoutes: totalRoutes,
    sitemapUrls,
    bundle: measureBundle()
  };
  const json = JSON.stringify(stats, null, 2) + '\n';

  const srcAssets = path.join(ROOT, 'src', 'assets');
  if (fs.existsSync(srcAssets)) {
    fs.writeFileSync(path.join(srcAssets, 'build-stats.json'), json);
  }

  const distAssets = path.join(ROOT, 'dist', 'xsantcastx', 'browser', 'assets');
  if (fs.existsSync(distAssets)) {
    fs.writeFileSync(path.join(distAssets, 'build-stats.json'), json);
  }

  console.log(
    `[generate-sitemap] build-stats: ${totalRoutes} prerender routes, ` +
    `${sitemapUrls} sitemap URLs, bundle ${stats.bundle ? stats.bundle.totalJsKb + ' kB' : 'not measured'}`
  );
}

/**
 * The prerendered-route count, written as a committed TypeScript constant.
 *
 * The homepage's "Paths Prerendered" stat needs this number at *compile* time
 * on both the server and the browser build, so it cannot come from
 * assets/build-stats.json — that file is generated, uncommitted, and read at
 * runtime by /admin, which means a fresh clone running `ng serve` would fail to
 * resolve it. A checked-in .ts file always exists, and the `prebuild` run
 * rewrites it from prerender-routes.txt before the compiler sees it, so the
 * stat cannot drift from the routes actually being prerendered.
 *
 * Rewritten only when the number changed, so a build on an unchanged tree
 * leaves the working directory clean.
 */
function writePrerenderStats(totalRoutes) {
  const out = path.join(ROOT, 'src', 'app', 'prerender-stats.ts');
  const contents = `/**
 * prerender-stats.ts — GENERATED FILE. Do not edit by hand.
 *
 * Written by scripts/generate-sitemap.js on every \`prebuild\`, counting the
 * non-blank lines of prerender-routes.txt. Checked in so a fresh clone
 * compiles before any build has run.
 *
 * Consumed by the homepage's "Paths Prerendered" stat.
 */

/** Routes Angular prerenders to static HTML, /embed pages included. */
export const PRERENDERED_PATHS = ${totalRoutes};
`;

  const existing = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
  if (existing === contents) {
    console.log(`[generate-sitemap] prerender-stats.ts already at ${totalRoutes} — unchanged`);
    return;
  }
  fs.writeFileSync(out, contents);
  console.log(`[generate-sitemap] wrote PRERENDERED_PATHS = ${totalRoutes} → ${path.relative(ROOT, out)}`);
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

  // Count every non-blank line, not just the sitemap-eligible ones — the
  // /embed routes are prerendered too, so this is the real SSR route count.
  const totalRoutes = raw.split('\n').map(s => s.trim()).filter(Boolean).length;
  writeBuildStats(totalRoutes, unique.length);
  writePrerenderStats(totalRoutes);
}

main();
