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
  if (route.startsWith('/world/realms/')) return { changefreq: 'monthly', priority: '0.8' };
  if (route === '/world/fivefold-lock') return { changefreq: 'monthly', priority: '0.6' };
  if (route === '/sanctum')      return { changefreq: 'daily',   priority: '0.7' };
  if (route === '/world/trials') return { changefreq: 'monthly', priority: '0.6' };
  if (route === '/world/quests') return { changefreq: 'weekly',  priority: '0.7' };
  if (route === '/codex')        return { changefreq: 'weekly',  priority: '0.7' };
  if (route === '/character')    return { changefreq: 'monthly', priority: '0.5' };
  if (route === '/forge/runes')  return { changefreq: 'weekly',  priority: '0.7' };
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
  const retired = new Set([
    '/tools', '/embed', '/mcp', '/blueprint', '/mission-control',
    '/donate', '/pro', '/sponsors', '/changelog',
  ]);
  if (retired.has(route) || route.startsWith('/tools/') || route.startsWith('/embed/')) return false;
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
/**
 * Every URL the sitemap advertises must exist as a prerendered file.
 *
 * This is the guard that makes `noindex` safe as the default in src/index.html.
 * Hosting rewrites `**` to index.csr.html, and that shell is deliberately
 * noindex because the only URLs it answers are retired links and crawler
 * guesses. A route that is meant to be indexed but never got prerendered would
 * be served that same shell — advertised in the sitemap, crawled, and quietly
 * dropped, with nothing in the build output to say so.
 *
 * So: fail the build instead. Runs only on the `postbuild` pass, where dist/
 * exists; the `prebuild` pass has just deleted it and skips this.
 */
function verifyPrerendered(routes) {
  const browserDir = path.join(ROOT, 'dist', 'xsantcastx', 'browser');
  if (!fs.existsSync(browserDir)) return;

  const missing = routes.filter(
    route => !fs.existsSync(path.join(browserDir, route.replace(/^\//, ''), 'index.html'))
  );
  if (missing.length) {
    console.error(
      `[generate-sitemap] ${missing.length} sitemap URL(s) have no prerendered index.html:\n` +
      missing.map(r => `  ${r}`).join('\n') +
      '\n\nThese would be served the noindex CSR shell (firebase.json rewrites ** to\n' +
      'index.csr.html), so they can never be indexed. Add them to\n' +
      'prerender-routes.txt, or drop them from the sitemap.'
    );
    process.exit(1);
  }
  console.log(`[generate-sitemap] verified ${routes.length} sitemap URLs are prerendered`);
}

/**
 * Every prerendered sitemap page must self-canonicalise and declare no hreflang.
 *
 * Both halves of this guard the two Search Console reports that motivated it:
 *
 *   "Alternate page with proper canonical tag" came from hreflang tags naming
 *   `?lang=es` as a separate page. Hosting ignores the query string when it
 *   matches a static file, so that URL is answered with the same bytes as the
 *   bare path — including its canonical, which points at the bare path. An
 *   alternate that canonicalises itself away is crawled and then discarded.
 *   The rule here is blunt on purpose: no hreflang at all, because there is no
 *   set of per-language URLs for it to describe.
 *
 *   "Duplicate, Google chose different canonical than user" is what happens
 *   when the canonical tag argues with the content. A canonical pointing
 *   somewhere other than the page's own URL is the version of that this can
 *   actually see, so it is checked exactly.
 *
 * HTML comments are stripped before matching. The shell's own head carries a
 * long comment explaining why these tags are shaped the way they are, and a
 * naive substring search finds the prose long before it finds the tag.
 */
function verifyCanonicals(routes) {
  const browserDir = path.join(ROOT, 'dist', 'xsantcastx', 'browser');
  if (!fs.existsSync(browserDir)) return;

  const problems = [];
  for (const route of routes) {
    const file = path.join(browserDir, route.replace(/^\//, ''), 'index.html');
    if (!fs.existsSync(file)) continue; // verifyPrerendered already failed on this
    const head = fs
      .readFileSync(file, 'utf8')
      .replace(/<!--[\s\S]*?-->/g, '')
      .split('</head>')[0];

    const canonicals = [...head.matchAll(/<link rel="canonical" href="([^"]*)"/g)].map(m => m[1]);
    const expected = `${SITE_URL}${route}`;
    if (canonicals.length !== 1) {
      problems.push(`${route}: expected exactly 1 canonical, found ${canonicals.length}`);
    } else if (canonicals[0] !== expected) {
      problems.push(`${route}: canonical is ${canonicals[0]}, expected ${expected}`);
    }

    const alternates = [...head.matchAll(/<link rel="alternate"[^>]*hreflang="([^"]*)"/g)].map(m => m[1]);
    if (alternates.length) {
      problems.push(`${route}: has hreflang ${JSON.stringify(alternates)}, expected none`);
    }

    const robots = [...head.matchAll(/<meta name="robots" content="([^"]*)"/g)].map(m => m[1]);
    if (!robots.includes('index, follow')) {
      problems.push(`${route}: robots is ${JSON.stringify(robots)}, expected "index, follow"`);
    }
  }

  if (problems.length) {
    console.error(
      `[generate-sitemap] ${problems.length} canonical/hreflang problem(s) in the prerendered output:\n` +
      problems.map(p => `  ${p}`).join('\n')
    );
    process.exit(1);
  }
  console.log(`[generate-sitemap] verified ${routes.length} pages self-canonicalise with no hreflang`);
}

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

/** Routes Angular prerenders to static HTML. */
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
  verifyPrerendered(unique);
  verifyCanonicals(unique);

  const totalRoutes = raw.split('\n').map(s => s.trim()).filter(Boolean).length;
  writeBuildStats(totalRoutes, unique.length);
  writePrerenderStats(totalRoutes);
}

main();
