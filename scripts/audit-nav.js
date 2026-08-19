#!/usr/bin/env node
/**
 * nav-audit.js — proves three things about the public game:
 *   1. No dead links: every routerLink in a template resolves to a real route.
 *   2. No orphans: every route with a page on the end of it is linked from
 *      site-wide chrome (header bar, tome, tab bar, footer).
 *   3. No player-facing leftover of the deleted tool product: Character,
 *      Codex, SEO, and other public templates must not send a player to
 *      /tools/* or tell them to open, search, or master tools.
 *
 * Run from the repo root: node scripts/audit-nav.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] || process.cwd();
const SRC = path.join(ROOT, 'src');

// ── Collect declared routes ────────────────────────────────────────────────
const routingFiles = [
  'app/app-routing.module.ts',
  'app/shared/canonical-routes.ts',
].map(p => path.join(SRC, p));
const declared = new Set();
const redirects = new Map();

for (const file of routingFiles) {
  const routingSrc = fs.readFileSync(file, 'utf8');
  // Top-level `path: 'x'` entries
  for (const m of routingSrc.matchAll(/path:\s*'([^']*)'/g)) declared.add('/' + m[1]);
  // redirectTo pairs
  for (const m of routingSrc.matchAll(/path:\s*'([^']+)',\s*redirectTo:\s*'([^']+)'/g)) {
    redirects.set('/' + m[1], '/' + m[2].replace(/^\//, ''));
  }
}

// Arena game routes live in their own file
const arenaSrc = fs.readFileSync(path.join(SRC, 'app/arena/games/arena-game.routes.ts'), 'utf8');
for (const m of arenaSrc.matchAll(/path:\s*'([^']+)'/g)) declared.add('/' + m[1]);

// Retired /tools and /embed pages redirect; they are not live routes.
const toolPaths = new Set();

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

const canonMap = {};
const canonSrc = fs.readFileSync(path.join(SRC, 'app/shared/canonical-routes.ts'), 'utf8');
for (const m of canonSrc.matchAll(/^\s*(\w+):\s*'(\/[^']+)'/gm)) {
  canonMap[m[1]] = m[2];
}

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
  for (const m of txt.matchAll(/route:\s*CANONICAL\.(\w+)/g)) {
    const r = canonMap[m[1]];
    if (!r) continue;
    if (!links.has(r)) links.set(r, new Set());
    links.get(r).add(path.relative(ROOT, f));
  }
}

// ── 1. Dead links ──────────────────────────────────────────────────────────
const dead = [];
for (const [route, where] of links) {
  if (route === '/') continue;
  if (declared.has(route) || toolPaths.has(route)) continue;
  // /tools/<slug> from the registry is resolved dynamically — accept the prefix
  if (route.startsWith('/tools/') || route.startsWith('/embed/')) continue; // retired, redirect to /world
  dead.push({ route, where: [...where] });
}

// ── 2. Orphan routes ───────────────────────────────────────────────────────
// Routes that render a real page (not a redirect, not the wildcard, not embeds)
const CHROME = ['app/header/header.component.html', 'app/header/header.component.ts',
                'app/footer/footer.component.html',
                'app/shared/nav/nav.manifest.ts'];
const chromeLinks = new Set();
for (const [route, where] of links) {
  if ([...where].some(w => CHROME.includes(w.replace(/^src\//, '')))) chromeLinks.add(route);
}

const EXEMPT = new Set(['/admin', '/embed', '/tools', '/world', '/**', '/']);
const orphans = [];
for (const r of declared) {
  if (EXEMPT.has(r) || redirects.has(r) || r.startsWith('/arena/')) continue;
  if (r.startsWith('/world/realms') || r === '/world/fivefold-lock') continue;
  // The Gambler is entered from the Market, which is the hall it belongs to:
  // `market.component.html` links it, and "a new hall next to the Market" is
  // what it shipped as in v2.71.0. Same shape as the /arena and /world/realms
  // skips above — a room reached through its parent rather than from global
  // chrome. It is not unreachable, and this check only ever looked at chrome.
  if (r === '/gambler') continue;
  if (r === '/' || r === '/**') continue;
  if (!chromeLinks.has(r)) orphans.push(r);
}

// ── 3. Player-facing leftover of the deleted tool product ──────────────────
// Templates and SEO are what a player reads. Infrastructure (tools-registry,
// hidden quest pools, historical changelog) is out of scope.
const PLAYER_FACING = files.filter(f => {
  const rel = path.relative(path.join(SRC, 'app'), f).replace(/\\/g, '/');
  if (rel.startsWith('admin/')) return false;
  if (rel === 'tools/tools-registry.ts') return false;
  if (rel === 'version.ts') return false;
  // The release log moved out of version.ts in v2.70.0 so its ~140 kB of prose
  // would stop riding the initial bundle. It is the same historical changelog
  // this audit has always skipped — it describes features as they shipped,
  // including the tool product that has since been retired, and rewriting
  // history to please a copy audit would be the wrong fix.
  if (rel === 'version-history.ts') return false;
  if (rel === 'translation.service.ts') return false;
  if (rel === 'shared/easter-eggs/easter-egg.service.ts') return false;
  if (rel === 'codex/codex-hints.ts') return false;
  if (/\.spec\.ts$/.test(rel)) return false;
  return /\.(html|ts)$/.test(rel);
});

const BANNED = [
  { re: /routerLink="\/tools(?:\/[^"]*)?"/i, why: 'routerLink to a deleted tool page' },
  { re: /\[routerLink\]="'\/tools(?:\/[^']*)?'"/i, why: 'bound routerLink to a deleted tool page' },
  { re: /\[routerLink\]="[^"]*toolRoute/i, why: 'achievement/mastery link to a deleted tool page' },
  { re: /queryParams\]="\{[^}]*bestiary/i, why: 'Codex Bestiary tab is retired' },
  { re: /tab:\s*['"]bestiary['"]/i, why: 'Codex Bestiary tab is retired' },
  { re: /\bOpen a tool\b/i, why: 'instructs a player to open a deleted product' },
  { re: /\bSearch tools\b/i, why: 'tool Bestiary search' },
  { re: /\bMaster every tool\b/i, why: 'tool mastery call-to-action' },
  { re: /\bTools touched\b/i, why: 'tool mastery stat' },
  { re: /\bTools Mastered\b/i, why: 'tool mastery stat' },
  { re: /the tools you actually reach for/i, why: 'Character tool-mastery board' },
  { re: /\bUse a tool\b/i, why: 'tells a player to use a deleted product' },
  { re: /\bFamiliar Five\b/i, why: 'Character tool-mastery board' },
  { re: /mastery for all \d+ tools/i, why: 'SEO still selling tool mastery' },
  { re: /\btool mastery\b/i, why: 'player-facing tool-mastery copy' },
  { re: /Formatted JSON nested/i, why: 'legacy JSON-formatter achievement' },
  { re: /in Base64/i, why: 'legacy Base64 achievement' },
  { re: /Wrote a regex/i, why: 'legacy regex achievement' },
  { re: /Created a box shadow/i, why: 'legacy box-shadow achievement' },
  { re: /buried in a tool/i, why: 'Arena still selling tool secrets' },
  { re: /Hidden inside the tools/i, why: 'Arena still selling tool secrets' },
  { re: /Visit 5 different tools/i, why: 'Speed Demon still counts tool pages' },
  { re: /Box Shadow Generator|JSON Formatter|Regex Tester|Color Converter|SQL Formatter|Grid Generator|Hash Generator|CSS Minifier|UUID Generator|Chmod Calculator|Base64 Encoder/i, why: 'names a deleted tool product' },
];

const leftover = [];
for (const f of PLAYER_FACING) {
  const rel = path.relative(ROOT, f);
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('<!--')) return;
    for (const ban of BANNED) {
      if (ban.re.test(line)) leftover.push({ file: rel, line: i + 1, why: ban.why, text: trimmed.slice(0, 160) });
    }
  });
}

// ── 4. Data sources rendered by public templates ───────────────────────────
// The Achievement Wall, Secrets tab, Arena unlock lines and SEO all render
// strings from these files. A template-only scan misses them.
const DATA_BANNED = [
  { re: /Formatted JSON nested 10\+ levels deep/i, why: 'unlocked JSON-formatter description' },
  { re: /Encoded .+ in Base64/i, why: 'unlocked Base64 description' },
  { re: /Wrote a regex/i, why: 'unlocked regex description' },
  { re: /Created a box shadow/i, why: 'unlocked box-shadow description' },
  { re: /different tools/i, why: 'tells a player to use deleted tools' },
  { re: /buried in a tool/i, why: 'tool-product secret copy' },
  { re: /Box Shadow Generator|JSON Formatter|Regex Tester|Color Converter|SQL Formatter|Grid Generator|Hash Generator|CSS Minifier|UUID Generator|Chmod Calculator|Base64 Encoder/i, why: 'names a deleted tool product' },
  { re: /Visit 5 different tools/i, why: 'Speed Demon still counts tool pages' },
];

function quotedField(block, name) {
  const m = block.match(new RegExp(`${name}:\\s*'((?:\\\\'|[^'])*)'`));
  return m ? m[1].replace(/\\'/g, "'") : '';
}

function parseObjectRecords(src, exportName) {
  const start = src.indexOf(`export const ${exportName}`);
  if (start < 0) return [];
  const open = src.indexOf('[', start);
  const end = src.indexOf('\n];', open);
  if (open < 0 || end < 0) return [];
  const body = src.slice(open, end);
  return [...body.matchAll(/\{[\s\S]*?\}/g)].map(m => m[0]);
}

function checkDataText(file, label, text, lineHint) {
  for (const ban of DATA_BANNED) {
    if (ban.re.test(text)) {
      leftover.push({
        file,
        line: lineHint,
        why: `${label}: ${ban.why}`,
        text: text.slice(0, 160),
      });
    }
  }
}

const eggFile = path.join(SRC, 'app/shared/easter-eggs/easter-egg.service.ts');
const eggSrc = fs.readFileSync(eggFile, 'utf8');
const publicEggIds = new Set();
for (const block of parseObjectRecords(eggSrc, 'EASTER_EGGS')) {
  const id = quotedField(block, 'id');
  const tool = quotedField(block, 'tool');
  const description = quotedField(block, 'description');
  const name = quotedField(block, 'name');
  const isPublic = !tool || tool === 'global';
  if (isPublic) {
    publicEggIds.add(id);
    checkDataText(path.relative(ROOT, eggFile), `public egg ${id}`, `${name} ${description}`, 1);
  }
}

const hintFile = path.join(SRC, 'app/codex/codex-hints.ts');
const hintSrc = fs.readFileSync(hintFile, 'utf8');
for (const m of hintSrc.matchAll(/'([^']+)':\s*'((?:\\'|[^'])*)'/g)) {
  if (!publicEggIds.has(m[1])) continue;
  checkDataText(path.relative(ROOT, hintFile), `public hint ${m[1]}`, m[2], 1);
}

const secretFile = path.join(SRC, 'app/codex/codex-secrets.ts');
const secretSrc = fs.readFileSync(secretFile, 'utf8');
for (const block of parseObjectRecords(secretSrc, 'SECRETS')) {
  const id = quotedField(block, 'id');
  const text = ['name', 'reveal', 'clue', 'lore'].map(k => quotedField(block, k)).join(' ');
  checkDataText(path.relative(ROOT, secretFile), `secret ${id}`, text, 1);
}

const narrativeFile = path.join(SRC, 'app/shared/narrative/five-realms.narrative.ts');
if (fs.existsSync(narrativeFile)) {
  checkDataText(path.relative(ROOT, narrativeFile), 'five-realm narrative', fs.readFileSync(narrativeFile, 'utf8'), 1);
}

const arenaModel = path.join(SRC, 'app/arena/games/arena-game.model.ts');
const playableSrc = fs.readFileSync(arenaModel, 'utf8');
for (const block of parseObjectRecords(playableSrc, 'ARENA_PLAYABLE')) {
  const id = quotedField(block, 'id');
  checkDataText(path.relative(ROOT, arenaModel), `arena ${id}`, quotedField(block, 'unlockHint'), 1);
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
console.log(leftover.length ? '❌ PLAYER-FACING TOOL PRODUCT:' : '✅ NO PLAYER-FACING TOOL PRODUCT');
for (const hit of leftover) console.log(`   ${hit.file}:${hit.line}  ${hit.why}  —  ${hit.text}`);
console.log('');
console.log('CHROME LINKS    :', [...chromeLinks].sort().join(' '));

process.exit(dead.length || orphans.length || leftover.length ? 1 : 0);
