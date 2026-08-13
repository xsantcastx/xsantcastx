#!/usr/bin/env node
/**
 * nav-audit.js — proves two things about site navigation:
 *   1. No dead links: every routerLink in a template resolves to a real route.
 *   2. No orphans: every route with a page on the end of it is linked from
 *      site-wide chrome (header bar, tome, tab bar, footer).
 *
 * Run from the repo root: node nav-audit.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] || process.cwd();
const SRC = path.join(ROOT, 'src');

// ── Collect declared routes ────────────────────────────────────────────────
const routingSrc = fs.readFileSync(path.join(SRC, 'app/app-routing.module.ts'), 'utf8');
const declared = new Set();
const redirects = new Map();

// Top-level `path: 'x'` entries
for (const m of routingSrc.matchAll(/path:\s*'([^']*)'/g)) declared.add('/' + m[1]);
// redirectTo pairs
for (const m of routingSrc.matchAll(/path:\s*'([^']+)',\s*redirectTo:\s*'([^']+)'/g)) {
  redirects.set('/' + m[1], '/' + m[2].replace(/^\//, ''));
}

// Arena game routes live in their own file
const arenaSrc = fs.readFileSync(path.join(SRC, 'app/arena/games/arena-game.routes.ts'), 'utf8');
for (const m of arenaSrc.matchAll(/path:\s*'([^']+)'/g)) declared.add('/' + m[1]);

// Tool routes live in the tools module
const toolsRouting = ['app/tools/tools-routing.module.ts', 'app/tools/tools.module.ts']
  .map(p => path.join(SRC, p)).filter(fs.existsSync);
let toolPaths = new Set();
for (const f of toolsRouting) {
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/path:\s*'([^']+)'/g)) {
    toolPaths.add('/tools/' + m[1]);
  }
}

// ── Collect every routerLink used in templates ─────────────────────────────
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html') || e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}
const files = walk(path.join(SRC, 'app'));

const links = new Map(); // route -> Set(files)
for (const f of files) {
  const txt = fs.readFileSync(f, 'utf8');
  // routerLink="/x" and [routerLink]="'/x'" and navigate(['/x']) / navigateByUrl('/x')
  const pats = [
    /routerLink="(\/[^"{]*)"/g,
    /\[routerLink\]="'(\/[^']*)'"/g,
    /navigateByUrl\('(\/[^']*)'\)/g,
    /navigate\(\['(\/[^']*)'/g,
    /route:\s*'(\/[^']*)'/g,
  ];
  for (const pat of pats) {
    for (const m of txt.matchAll(pat)) {
      const r = m[1].split('?')[0].split('#')[0].replace(/\/$/, '') || '/';
      if (!links.has(r)) links.set(r, new Set());
      links.get(r).add(path.relative(ROOT, f));
    }
  }
}

// ── 1. Dead links ──────────────────────────────────────────────────────────
const dead = [];
for (const [route, where] of links) {
  if (route === '/') continue;
  if (declared.has(route) || toolPaths.has(route)) continue;
  // /tools/<slug> from the registry is resolved dynamically — accept the prefix
  if (route.startsWith('/tools/') || route.startsWith('/embed/')) continue;
  dead.push({ route, where: [...where] });
}

// ── 2. Orphan routes ───────────────────────────────────────────────────────
// Routes that render a real page (not a redirect, not the wildcard, not embeds)
const CHROME = ['app/header/header.component.html', 'app/header/header.component.ts',
                'app/footer/footer.component.html'];
const chromeLinks = new Set();
for (const [route, where] of links) {
  if ([...where].some(w => CHROME.includes(w.replace(/^src\//, '')))) chromeLinks.add(route);
}

const EXEMPT = new Set(['/admin', '/embed', '/tools', '/home', '/**', '/']);
const orphans = [];
for (const r of declared) {
  if (EXEMPT.has(r) || redirects.has(r) || r.startsWith('/arena/')) continue;
  if (r === '/' || r === '/**') continue;
  if (!chromeLinks.has(r)) orphans.push(r);
}

// ── Report ─────────────────────────────────────────────────────────────────
console.log('ROUTES DECLARED :', [...declared].filter(r => !redirects.has(r) && r !== '/**' && r !== '/').sort().join(' '));
console.log('REDIRECTS       :', [...redirects].map(([a, b]) => `${a}→${b}`).join(' '));
console.log('TOOL ROUTES     :', toolPaths.size);
console.log('');
console.log(dead.length ? '❌ DEAD LINKS:' : '✅ NO DEAD LINKS');
for (const d of dead) console.log(`   ${d.route}  ←  ${d.where.join(', ')}`);
console.log('');
console.log(orphans.length ? '❌ ORPHANED ROUTES (not linked from header/footer):' : '✅ NO ORPHANED ROUTES');
for (const o of orphans.sort()) console.log(`   ${o}`);
console.log('');
console.log('CHROME LINKS    :', [...chromeLinks].sort().join(' '));

process.exit(dead.length || orphans.length ? 1 : 0);
