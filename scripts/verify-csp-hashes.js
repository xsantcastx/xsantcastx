#!/usr/bin/env node
/**
 * verify-csp-hashes.js — fail the build when the production CSP no longer
 * matches the HTML it is meant to protect.
 *
 * WHY THIS EXISTS
 *
 * The `script-src` in firebase.json pins each inline <script> block by sha256
 * hash. A hash is a checksum of the exact script body, so any edit — even
 * whitespace or a comment — invalidates it. When that happens the browser
 * silently refuses to execute the block. There is no build error, no lint
 * warning, and `ng serve` sends no CSP at all, so local development looks
 * perfect while production quietly loses a feature.
 *
 * That is not hypothetical. Before this script existed, the CSP carried exactly
 * one hash while index.html carried two inline blocks, and the pinned hash
 * matched neither of them — the boot-sequence cut and the whole easter-egg
 * layer were both dead in production.
 *
 * WHAT IT CHECKS
 *
 *   1. Every executable inline <script> in the built HTML has a matching hash
 *      in script-src.                                    (missing => blocked)
 *   2. Every hash in script-src still corresponds to a block that exists.
 *                                                        (stale  => dead weight)
 *   3. Every inline event handler (onclick=, onload=, ...) is explicitly
 *      allowed. Handlers are NOT covered by the script-src hashes above: a
 *      handler runs only if script-src carries both 'unsafe-hashes' and a hash
 *      of the exact attribute value. Angular's inlineCritical optimisation
 *      emits one of these (onload="this.media='all'") on every prerendered
 *      page, and it was silently blocked — which left the site running on
 *      inlined critical CSS alone, because the deferred stylesheet never
 *      flipped from media="print" to media="all". Anything new that shows up
 *      here should be moved into assets/js/ and bound with addEventListener;
 *      allowlisting is for handlers a build tool emits and you cannot remove.
 *
 * <script type="application/ld+json"> is skipped: it is data, not code, and
 * browsers never execute it, so CSP does not gate it.
 *
 * USAGE
 *   node scripts/verify-csp-hashes.js            # checks dist/, falls back to src/
 *   node scripts/verify-csp-hashes.js --fix      # rewrites firebase.json hashes
 *
 * Exits non-zero on any mismatch so CI fails loudly.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const FIREBASE_JSON = path.join(ROOT, 'firebase.json');
const DIST_BROWSER = path.join(ROOT, 'dist', 'xsantcastx', 'browser');
const SRC_INDEX = path.join(ROOT, 'src', 'index.html');

/**
 * Collect every HTML file Hosting will actually serve.
 *
 * Checking dist/browser/index.html alone is not enough and was the first thing
 * this script got wrong: that file is a script-less stub (and `/` 301s to /home
 * anyway). The pages real visitors load are the prerendered <route>/index.html
 * files — 281 of them — plus index.csr.html for anything not prerendered. The
 * inline scripts live there, so that is what has to be hashed.
 */
function collectHtml(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectHtml(full, acc);
    else if (entry.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

const FIX = process.argv.includes('--fix');

function sha256(body) {
  return 'sha256-' + crypto.createHash('sha256').update(body, 'utf8').digest('base64');
}

/** Inline <script> blocks that the browser will actually execute. */
function inlineScripts(html) {
  const out = [];
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1];
    if (/\bsrc\s*=/i.test(attrs)) continue;            // external, covered by 'self'
    if (/type\s*=\s*["']application\/ld\+json["']/i.test(attrs)) continue; // data, not code
    out.push({ attrs: attrs.trim(), body: m[2], hash: sha256(m[2]) });
  }
  return out;
}

/**
 * Inline event handlers, with the hash of each handler body.
 *
 * These are not covered by the same rule as <script> blocks: a handler is only
 * permitted if script-src carries BOTH 'unsafe-hashes' and a hash of the exact
 * attribute value. So we hash the body and let the caller decide.
 *
 * Comments are stripped first, so prose mentioning `onclick=""` does not trip
 * the scan.
 */
function inlineHandlers(html) {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const out = [];
  const re = /\son(?:click|load|error|change|submit|input|focus|blur|mouse[a-z]+|key[a-z]+|touch[a-z]+)\s*=\s*"([^"]*)"/gi;
  let m;
  while ((m = re.exec(withoutComments)) !== null) {
    const start = Math.max(0, m.index - 60);
    out.push({
      body: m[1],
      hash: sha256(m[1]),
      context: withoutComments.slice(start, m.index + 40).replace(/\s+/g, ' ').trim(),
    });
  }
  return out;
}

function readCsp(firebaseJson) {
  for (const rule of firebaseJson.hosting.headers || []) {
    if (rule.source !== '**') continue;
    const header = (rule.headers || []).find(
      (h) => h.key.toLowerCase() === 'content-security-policy'
    );
    if (header) return { rule, header };
  }
  return null;
}

// ── resolve which HTML to check ───────────────────────────────────────────────
let targets;
let label;
if (fs.existsSync(DIST_BROWSER)) {
  targets = collectHtml(DIST_BROWSER);
  label = `built output — ${targets.length} HTML file(s) under dist/xsantcastx/browser`;
} else if (fs.existsSync(SRC_INDEX)) {
  targets = [SRC_INDEX];
  label = 'source (src/index.html) — dist/ not built, run after `npm run build` for the real check';
} else {
  console.error(`✗ verify-csp-hashes: no HTML found at ${DIST_BROWSER} or ${SRC_INDEX}`);
  process.exit(1);
}

const firebaseRaw = fs.readFileSync(FIREBASE_JSON, 'utf8');
const firebaseJson = JSON.parse(firebaseRaw);

const found = readCsp(firebaseJson);
if (!found) {
  console.error('✗ verify-csp-hashes: no Content-Security-Policy on the "**" hosting header rule');
  process.exit(1);
}

const csp = found.header.value;
const scriptSrc = (csp.match(/script-src ([^;]*)/) || [, ''])[1];
const policyHashes = new Set((scriptSrc.match(/'sha256-[A-Za-z0-9+/=]+'/g) || []).map((h) => h.slice(1, -1)));

// Union the inline scripts across every served page, keyed by hash so one block
// repeated across all 281 prerendered routes is reported once rather than 281
// times. Handlers are listed per-file, since the file is what you have to edit.
const byHash = new Map();
const handlersByHash = new Map();
for (const file of targets) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);
  for (const s of inlineScripts(html)) {
    if (!byHash.has(s.hash)) byHash.set(s.hash, { ...s, file: rel });
  }
  for (const h of inlineHandlers(html)) {
    const seen = handlersByHash.get(h.hash);
    if (seen) seen.count++;
    else handlersByHash.set(h.hash, { ...h, file: rel, count: 1 });
  }
}

const scripts = [...byHash.values()];
const htmlHashes = new Set(byHash.keys());

// A handler is only permitted with BOTH 'unsafe-hashes' and its own hash.
const hasUnsafeHashes = /'unsafe-hashes'/.test(scriptSrc);
const allHandlers = [...handlersByHash.values()];
const badHandlers = allHandlers.filter((h) => !hasUnsafeHashes || !policyHashes.has(h.hash));
const okHandlers = allHandlers.filter((h) => hasUnsafeHashes && policyHashes.has(h.hash));

// Hashes covering an allowed handler are legitimately in the policy but match no
// <script> block, so exclude them from the stale check.
const handlerHashes = new Set(okHandlers.map((h) => h.hash));
const missing = scripts.filter((s) => !policyHashes.has(s.hash));
const stale = [...policyHashes].filter((h) => !htmlHashes.has(h) && !handlerHashes.has(h));

console.log(`verify-csp-hashes: checking ${label}`);
console.log(`  ${scripts.length} distinct inline script block(s), ${policyHashes.size} hash(es) in script-src`);

let failed = false;

if (missing.length) {
  failed = true;
  console.error(`\n✗ ${missing.length} inline script block(s) have NO matching hash — these are BLOCKED in production:`);
  for (const s of missing) {
    const preview = s.body.trim().split('\n')[0].slice(0, 70);
    console.error(`    ${s.hash}`);
    console.error(`      in:     ${s.file}`);
    console.error(`      starts: ${preview}`);
  }
}

if (stale.length) {
  failed = true;
  console.error(`\n✗ ${stale.length} hash(es) in script-src match no script in the HTML (stale):`);
  for (const h of stale) console.error(`    ${h}`);
}

if (okHandlers.length) {
  for (const h of okHandlers) {
    console.log(`  allowed inline handler via 'unsafe-hashes': ${JSON.stringify(h.body)} (${h.count} page(s))`);
  }
}

if (badHandlers.length) {
  failed = true;
  console.error(`\n✗ ${badHandlers.length} inline event handler(s) are NOT permitted by the policy.`);
  console.error(`  Handlers need script-src to carry BOTH 'unsafe-hashes' and the hash of the`);
  console.error(`  exact attribute value. ${hasUnsafeHashes ? "'unsafe-hashes' is present." : "'unsafe-hashes' is MISSING."}`);
  console.error(`  Prefer moving the handler into assets/js/ and binding with addEventListener;`);
  console.error(`  allowlist it only when a build tool emits it and you cannot remove it.`);
  for (const h of badHandlers.slice(0, 10)) {
    console.error(`    ${JSON.stringify(h.body)}`);
    console.error(`      add to script-src: '${h.hash}'`);
    console.error(`      first seen in:     ${h.file} (${h.count} page(s))`);
  }
  if (badHandlers.length > 10) console.error(`    …and ${badHandlers.length - 10} more distinct handler(s)`);
}

if (failed && FIX && !badHandlers.length) {
  const correct = scripts.map((s) => `'${s.hash}'`).join(' ');
  const rebuilt = csp.replace(/script-src ([^;]*)/, (whole, body) => {
    const cleaned = body.replace(/'sha256-[A-Za-z0-9+/=]+'\s*/g, '').trim();
    const parts = cleaned.split(/\s+/);
    // keep 'self' first, then hashes, then the remaining allowlist
    const self = parts.filter((p) => p === "'self'");
    const rest = parts.filter((p) => p !== "'self'");
    return `script-src ${[...self, correct, ...rest].filter(Boolean).join(' ')}`;
  });
  found.header.value = rebuilt;
  fs.writeFileSync(FIREBASE_JSON, JSON.stringify(firebaseJson, null, 2) + '\n');
  console.log('\n✓ --fix: rewrote script-src hashes in firebase.json. Re-run to confirm.');
  process.exit(0);
}

if (failed) {
  console.error('\n  Fix: run `node scripts/verify-csp-hashes.js --fix` (hashes only), or move the');
  console.error('  script into assets/js/ so plain `script-src \'self\'` covers it.');
  process.exit(1);
}

console.log('✓ CSP script-src matches the built HTML: every inline script is hashed, every\n  inline handler is explicitly allowed, and no hash is stale.');
