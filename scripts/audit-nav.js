#!/usr/bin/env node
/**
 * audit-nav.js — proves the game-only shell holds (docs/handoff/game-only-shell.md).
 *
 * The game at /play is the whole site. Every other page is an in-game panel
 * (play/world/panel-registry.ts) or gone, and its old URL is a router redirect
 * into the world (shared/canonical-routes.ts). This audit checks, from source:
 *
 *   1. Only the game is routed. APP_ROUTES may declare `play`, the owner's
 *      `admin`, the redirect table and the `**` catch-all — no page beside
 *      the game.
 *   2. No link leaves the game. Every routerLink / navigate / navigateByUrl /
 *      `route:` / `href:` target in the app is `/play` (with or without a
 *      query), or a retired URL the router redirects INTO /play. A `?at=` must
 *      name a real station or panel. `/admin` is allowed only from admin/.
 *   3. Every panel is reachable in-game, derived rather than listed:
 *        (a) a station in a built town hosts it (walk there, Places, Waystone);
 *        (b) the ☰ menu opens it (side-scroller.component.html `data-open`);
 *        (c) a reachable panel links its old URL (the side-scroller opens that
 *            panel in place) — followed through each panel component's own
 *            relative imports, to a fixpoint.
 *      There are no per-route exemptions: an unreachable panel fails.
 *   4. No player-facing leftover of the deleted tool product (unchanged).
 *
 * Run from the repo root: node scripts/audit-nav.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] || process.cwd();
const SRC = path.join(ROOT, 'src');
const APP = path.join(SRC, 'app');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html') || e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}
const files = walk(APP).filter(f => !/ \d\.(ts|html)$/.test(f));
const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');

// TypeScript source loaded in memory (the way the engine tests load the world),
// so the audit reads the same tables the game does.
function loadTs(file, cache = new Map()) {
  if (cache.has(file)) return cache.get(file).exports;
  const ts = require('typescript');
  const mod = { exports: {} };
  cache.set(file, mod);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const req = name => (name.startsWith('.')
    ? loadTs(path.resolve(path.dirname(file), `${name}.ts`), cache)
    : require(name));
  new Function('require', 'module', 'exports', code)(req, mod, mod.exports);
  return mod.exports;
}

// ── 1. Only the game is routed ─────────────────────────────────────────────
const routingSrc = fs.readFileSync(path.join(APP, 'app-routing.module.ts'), 'utf8');
const ALLOWED_PATHS = new Set(['play', 'admin', '**']);
const extraRoutes = [...routingSrc.matchAll(/\bpath:\s*'([^']*)'/g)].map(m => m[1]).filter(p => !ALLOWED_PATHS.has(p));
if (!/\.\.\.CANONICAL_REDIRECTS/.test(routingSrc)) extraRoutes.push('(CANONICAL_REDIRECTS is not spread into APP_ROUTES)');
const { CANONICAL_REDIRECTS, INTO_PLAY, intoPlay } = loadTs(path.join(APP, 'shared/canonical-routes.ts'));
const redirects = new Map(); // '/old' -> '/play?at=x'
for (const [from, at] of Object.entries(INTO_PLAY)) redirects.set('/' + from, intoPlay(at));
for (const r of CANONICAL_REDIRECTS) {
  if (typeof r.redirectTo === 'string') redirects.set('/' + r.path, r.redirectTo.startsWith('/') ? r.redirectTo : '/' + r.redirectTo);
  else if (!(r.path in INTO_PLAY)) redirects.set('/' + r.path, '(a redirect function the audit cannot read)');
}
const leaky = [...redirects].filter(([, to]) => !/^\/play(\?|$)/.test(to));

// ── World tables: towns, stations, panels ──────────────────────────────────
const world = loadTs(path.join(APP, 'play/world/world.model.ts'));
const registryPath = path.join(APP, 'play/world/panel-registry.ts');
const registrySrc = fs.readFileSync(registryPath, 'utf8');
const panelIds = [...world.PANEL_IDS];
const panelRoute = new Map(); // id -> legacy route
const panelFile = new Map(); // id -> component .ts
for (const m of registrySrc.matchAll(/^\s*'?([\w-]+)'?:\s*\{([^\n]*)\},?$/gm)) {
  const id = m[1];
  if (!panelIds.includes(id)) continue;
  const r = m[2].match(/route:\s*'([^']+)'/);
  if (r) panelRoute.set(id, r[1]);
  const imp = m[2].match(/import\('([^']+)'\)/);
  if (imp) panelFile.set(id, path.resolve(path.dirname(registryPath), imp[1] + '.ts'));
}
const stationIds = new Set();
const hostedByStation = new Map(); // panel -> 'town/station'
for (const town of Object.values(world.TOWNS)) {
  if (!town) continue;
  for (const st of town.stations || []) {
    stationIds.add(st.id);
    if (st.kind === 'panel' && st.panel && !hostedByStation.has(st.panel)) hostedByStation.set(st.panel, `${town.id}/${st.id}`);
  }
}
// The Homestead is an area of its own, not a town: its buildings are stations too.
const homestead = loadTs(path.join(APP, 'play/world/homestead.ts'));
for (const st of homestead.HOMESTEAD_BUILDINGS || []) {
  stationIds.add(st.id);
  if (st.kind === 'panel' && st.panel && !hostedByStation.has(st.panel)) hostedByStation.set(st.panel, `homestead/${st.id}`);
}
const atTargets = new Set([...stationIds, ...panelIds]);
const badAt = [...redirects].filter(([, to]) => {
  const at = (to.split('?')[1] || '').match(/(?:^|&)at=([^&]+)/);
  return at && !atTargets.has(at[1]);
});

// ── 2. No link leaves the game ─────────────────────────────────────────────
const LINK_PATS = [
  /routerLink="(\/[^"{]*)"/g,
  /\[routerLink\]="'(\/[^']*)'"/g,
  /navigateByUrl\('(\/[^']*)'\)/g,
  /navigate\(\['(\/[^']*)'/g,
  /\broute:\s*'(\/[^']*)'/g,
  /\bhref:\s*'(\/[^']*)'/g,
];
// `export const FOO_HREF = '/x'`: a URL held in a constant and bound with
// [routerLink] elsewhere. Checked for leaving the game like any link; for
// reachability it only counts where a file in the same panel uses FOO_HREF
// AND binds a [routerLink] (see reachability below).
const HREF_CONST = /export const (\w+_HREF)\s*=\s*'(\/[^']*)'/g;
const hrefConsts = new Map(); // file -> [[name, url]]
const linksIn = new Map(); // file -> [targets]
for (const f of files) {
  if (f.endsWith('.spec.ts')) continue;
  const txt = fs.readFileSync(f, 'utf8');
  const out = [];
  for (const pat of LINK_PATS) for (const m of txt.matchAll(pat)) out.push(m[1]);
  const consts = [...txt.matchAll(HREF_CONST)].map(m => [m[1], m[2]]);
  if (consts.length) hrefConsts.set(f, consts);
  for (const [, url] of consts) out.push(url);
  if (out.length) linksIn.set(f, out);
}
// Files that are data, not navigation: the router tables, the panel table, history prose.
const NOT_NAV = new Set(['app-routing.module.ts', 'shared/canonical-routes.ts', 'play/world/panel-registry.ts', 'version-history.ts', 'version.ts']);
const outward = [];
for (const [f, targets] of linksIn) {
  const r = path.relative(APP, f).replace(/\\/g, '/');
  if (NOT_NAV.has(r)) continue;
  for (const t of targets) {
    const p = t.split(/[?#]/)[0].replace(/\/$/, '') || '/';
    if (p === '/play') continue;
    if (p === '/admin' && r.startsWith('admin/')) continue;
    if (redirects.has(p)) continue;
    if (/^\/(tools|embed)\//.test(p)) continue; // retired slugs: '/tools/:slug' redirects into /play
    outward.push(`${t}  ←  ${rel(f)}`);
  }
}

// ── 3. Every panel is reachable in-game ────────────────────────────────────
const menuHtml = fs.readFileSync(path.join(APP, 'play/side-scroller.component.html'), 'utf8');
const menuBlock = (menuHtml.match(/<nav id="places-list"[\s\S]*?<\/nav>/) || [''])[0];
const menuOpens = new Set([...menuBlock.matchAll(/data-open="([\w-]+)"/g)].map(m => m[1]));
const reach = new Map(); // panel -> how
for (const [id, where] of hostedByStation) reach.set(id, `station ${where}`);
for (const id of panelIds) if (!reach.has(id) && menuOpens.has(id)) reach.set(id, '☰ menu');

function importClosure(entry) {
  const seen = new Set(); const stack = [entry];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f) || !fs.existsSync(f)) continue;
    seen.add(f);
    const txt = fs.readFileSync(f, 'utf8');
    const tpl = txt.match(/templateUrl:\s*'([^']+)'/);
    if (tpl) seen.add(path.resolve(path.dirname(f), tpl[1]));
    for (const m of txt.matchAll(/from\s+'(\.[^']+)'/g)) stack.push(path.resolve(path.dirname(f), m[1] + '.ts'));
  }
  return seen;
}
const byRoute = new Map([...panelRoute].map(([id, r]) => [r, id]));
let grew = true;
while (grew) {
  grew = false;
  for (const [id, how] of [...reach]) {
    const entry = panelFile.get(id);
    if (!entry) continue;
    const closure = importClosure(entry);
    const texts = [...closure].filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f, 'utf8'));
    for (const f of closure) {
      const constUrls = new Set((hrefConsts.get(f) || [])
        .filter(([name]) => texts.some(t => t.includes(name) && /\[routerLink\]=/.test(t) && !t.includes(`export const ${name}`)))
        .map(([, url]) => url));
      const literal = (linksIn.get(f) || []).filter(t => !(hrefConsts.get(f) || []).some(([, url]) => url === t));
      for (const t of [...literal, ...constUrls]) {
        const target = byRoute.get(t.split(/[?#]/)[0]) || (redirects.get(t.split(/[?#]/)[0]) || '').match(/at=([\w-]+)/)?.[1];
        if (target && panelIds.includes(target) && !reach.has(target)) {
          reach.set(target, `linked from the ${id} panel (${rel(f)})`);
          grew = true;
        }
      }
    }
  }
}
const unreachable = panelIds.filter(id => !reach.has(id));
const loaderless = panelIds.filter(id => !panelFile.has(id));

// ── 4. Player-facing leftover of the deleted tool product ──────────────────
// Templates and SEO are what a player reads. Infrastructure (historical
// changelog, the legacy egg records) is out of scope.
const PLAYER_FACING = files.filter(f => {
  const rel = path.relative(path.join(SRC, 'app'), f).replace(/\\/g, '/');
  if (rel.startsWith('admin/')) return false;
  if (rel === 'version.ts') return false;
  // The release log moved out of version.ts in v2.70.0 so its ~140 kB of prose
  // would stop riding the initial bundle. It is the same historical changelog
  // this audit has always skipped — it describes features as they shipped,
  // including the tool product that has since been retired, and rewriting
  // history to please a copy audit would be the wrong fix.
  if (rel === 'version-history.ts') return false;
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

// ── 4b. Data sources rendered by public templates ───────────────────────────
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
const ok = (cond, good, bad, rows) => {
  console.log(cond ? `✅ ${good}` : `❌ ${bad}`);
  if (!cond) for (const r of rows) console.log(`   ${r}`);
};
ok(!extraRoutes.length, 'ONLY THE GAME IS ROUTED (play, admin, redirects, **)', 'ROUTES BESIDE THE GAME:', extraRoutes);
ok(!leaky.length, `EVERY RETIRED URL REDIRECTS INTO /play (${redirects.size})`, 'REDIRECTS THAT LEAVE THE GAME:', leaky.map(([a, b]) => `${a} → ${b}`));
ok(!badAt.length, 'EVERY ?at= NAMES A REAL STATION OR PANEL', '?at= TARGETS THAT DO NOT EXIST:', badAt.map(([a, b]) => `${a} → ${b}`));
ok(!outward.length, 'NO LINK LEAVES THE GAME', 'LINKS TO PAGES OUTSIDE /play:', outward);
ok(!loaderless.length, 'EVERY PANEL HAS A LOADER', 'PANELS WITH NO LOADER IN panel-registry.ts:', loaderless);
ok(!unreachable.length, `EVERY PANEL IS REACHABLE IN-GAME (${panelIds.length})`, 'PANELS NO PLAYER CAN REACH (no station, not in ☰, not linked from a reachable panel):', unreachable);
ok(!leftover.length, 'NO PLAYER-FACING TOOL PRODUCT', 'PLAYER-FACING TOOL PRODUCT:', leftover.map(h => `${h.file}:${h.line}  ${h.why}  —  ${h.text}`));
console.log('');
console.log('☰ MENU OPENS   :', [...menuOpens].sort().join(' '));
for (const id of panelIds) console.log(`  ${id.padEnd(15)} ${reach.get(id) || '—'}`);

process.exit(extraRoutes.length || leaky.length || badAt.length || outward.length || loaderless.length || unreachable.length || leftover.length ? 1 : 0);
