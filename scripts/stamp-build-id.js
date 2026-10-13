#!/usr/bin/env node
/**
 * stamp-build-id.js — give every deploy a name the running app can compare.
 *
 * Why this exists: an installed PWA, or a tab left open for days, never
 * navigates, so it never meets the network-first navigation that would hand it
 * the new deploy. It keeps running the old bundle indefinitely. To offer an
 * "update ready — Reload" toast, the running page has to be able to ask "is the
 * server on a different build than me?", and before this nothing changed in a
 * way it could see: `service-worker.js` is byte-for-byte identical across
 * deploys unless someone edits it, so `registration.update()` never found
 * anything.
 *
 * Runs after `ng build` (the `postbuild` hook) against dist/xsantcastx/browser:
 *
 *   1. BUILD ID — a short sha256 over the content-hashed bundle names the app
 *      shell references (main-, polyfills-, styles-, chunk- …). esbuild folds a
 *      chunk's hash into every importer's, so any code or style change moves it,
 *      and rebuilding identical source yields the same id (no false prompts).
 *   2. version.json — `{ "build": id }`. Polled by AppUpdateService with
 *      `cache: 'no-store'`; firebase.json serves it `no-cache`.
 *   3. <meta name="gf-build" content=id> in every HTML page that boots the app,
 *      so the running document knows which build it is.
 *   4. service-worker.js — `__GF_BUILD_ID__` is replaced, so the worker's bytes
 *      change with every deploy and the browser installs it as an update.
 *
 * Idempotent: re-running replaces an existing meta rather than adding a second.
 * Usage: node scripts/stamp-build-id.js [distBrowserDir]
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist', 'xsantcastx', 'browser'));
const SHELL = path.join(root, 'index.csr.html');
const SW = path.join(root, 'service-worker.js');
const PLACEHOLDER = '__GF_BUILD_ID__';
const META_RE = /<meta name="gf-build" content="[^"]*">/;

function fail(msg) {
  console.error(`[stamp-build-id] ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(SHELL)) fail(`no app shell at ${SHELL} — run ng build first`);

const shell = fs.readFileSync(SHELL, 'utf8');
const refs = [...shell.matchAll(/\s(?:src|href)="([^"]*-[A-Z0-9]{8,}\.(?:js|css))"/g)].map(m => m[1]);
if (!refs.some(r => /(?:^|\/)main-/.test(r))) fail('the app shell references no main-*.js bundle');
const build = crypto.createHash('sha256').update([...new Set(refs)].sort().join('\n')).digest('hex').slice(0, 12);

// 2. version.json
fs.writeFileSync(path.join(root, 'version.json'), JSON.stringify({ build }) + '\n');

// 3. the meta, in every page that boots the app
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith('.html')) out.push(full);
  }
  return out;
}
const tag = `<meta name="gf-build" content="${build}">`;
let pages = 0;
for (const file of walk(root)) {
  const html = fs.readFileSync(file, 'utf8');
  if (!/<script[^>]+src="[^"]*main-[A-Z0-9]{8,}\.js"/.test(html)) continue; // not an app page
  // After the charset declaration, which must stay first in <head>.
  const next = META_RE.test(html) ? html.replace(META_RE, tag)
    : /<meta charset="[^"]*">/i.test(html) ? html.replace(/<meta charset="[^"]*">/i, m => m + tag)
    : html.replace(/<head[^>]*>/i, m => m + tag);
  if (next === html && !META_RE.test(html)) fail(`no <head> in ${path.relative(root, file)}`);
  if (next !== html) fs.writeFileSync(file, next);
  pages++;
}

// 4. the service worker
if (fs.existsSync(SW)) {
  const sw = fs.readFileSync(SW, 'utf8');
  const stamped = sw.replace(/const BUILD_ID = '[^']*';/, `const BUILD_ID = '${build}';`);
  if (stamped === sw && !sw.includes(`const BUILD_ID = '${build}';`)) {
    fail(`service-worker.js has no "const BUILD_ID = '${PLACEHOLDER}';" line to stamp`);
  }
  fs.writeFileSync(SW, stamped);
}

console.log(`[stamp-build-id] build ${build}: ${pages} pages, version.json, service-worker.js`);
