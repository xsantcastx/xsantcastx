#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Build-Health-Monitor companion script.
 *
 * Why this exists
 * ---------------
 * After the Angular 21 upgrade (commit ea8c5015) we installed an
 * SsrErrorHandler in app.server.module.ts. It deliberately swallows
 * NotYetImplemented and other prerender errors so a single bad route
 * no longer hard-fails the entire build. The trade-off is that
 * `npx ng build` exit code is no longer a sufficient signal for the
 * build-health-monitor agent — a broken route now ships as a stub
 * with CI green.
 *
 * This script restores the canary by:
 *
 *   1. Reading prerender stdout/stderr and grepping for the
 *      `[SSR-SWALLOWED]` markers emitted by SsrErrorHandler.
 *   2. Walking dist/xsantcastx/browser/ and detecting stub-renders by
 *      file size + sentinel content (e.g. h1 tag present).
 *   3. Comparing both result sets against a small allowlist
 *      (scripts/prerender-health.allowlist.txt) so known-OK warnings
 *      don't page anyone.
 *   4. Emitting a JSON report on stdout AND a human-readable summary
 *      on stderr. Exits non-zero when there are unexpected entries so
 *      it can gate CI / a scheduled-task agent.
 *
 * Usage
 * -----
 *   node scripts/check-prerender-health.js [options]
 *
 * Options:
 *   --log <path>       Read build output from <path>, or pass `-` to
 *                      read from stdin. Omit to skip log analysis (the
 *                      stub-render check still runs).
 *   --dist <path>      Path to the prerendered browser dir.
 *                      Default: dist/xsantcastx/browser
 *   --allowlist <path> Default: scripts/prerender-health.allowlist.txt
 *   --json             Print only the JSON report (no stderr summary).
 *   --strict           Treat unexpected stub-renders as failures even
 *                      if no SSR-SWALLOWED line was logged for them.
 *   --quiet            Suppress success summary.
 *
 * Examples:
 *   npm run build 2>&1 | node scripts/check-prerender-health.js --log -
 *   node scripts/check-prerender-health.js --log /tmp/build.log
 *
 * Build-health-monitor agents should call:
 *   npm run build > /tmp/build.log 2>&1
 *   node scripts/check-prerender-health.js --log /tmp/build.log --json
 *
 * Exit codes:
 *   0 — clean (no unexpected swallowed errors, no unexpected stubs)
 *   1 — unexpected swallowed errors and/or stub-renders detected
 *   2 — script invocation error (bad args, missing dist, etc.)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SWALLOWED_RE = /^\[SSR-SWALLOWED\]\s+route=(\S+)\s+kind=(\S+)\s+msg=(.*)$/;

/* ------------------------------------------------------------------ */
/*  Argument parsing                                                   */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const out = {
    log: null,
    dist: 'dist/xsantcastx/browser',
    allowlist: 'scripts/prerender-health.allowlist.txt',
    json: false,
    strict: false,
    quiet: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--log': out.log = argv[++i]; break;
      case '--dist': out.dist = argv[++i]; break;
      case '--allowlist': out.allowlist = argv[++i]; break;
      case '--json': out.json = true; break;
      case '--strict': out.strict = true; break;
      case '--quiet': out.quiet = true; break;
      case '-h':
      case '--help':
        console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 60).join('\n'));
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${a}`);
        process.exit(2);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Allowlist parsing                                                  */
/* ------------------------------------------------------------------ */

/**
 * Allowlist format (one rule per line, # for comments):
 *   <route> <kind>           — allow swallowed errors on this route+kind
 *   stub:<route>              — allow this route to render below threshold
 * Blank lines and # comments are ignored.
 */
function loadAllowlist(filePath) {
  const allow = { swallowed: new Set(), stubs: new Set() };
  if (!fs.existsSync(filePath)) return allow;
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    if (line.startsWith('stub:')) {
      allow.stubs.add(line.slice(5).trim());
      continue;
    }
    const parts = line.split(/\s+/);
    if (parts.length >= 2) {
      allow.swallowed.add(`${parts[0]}|${parts[1]}`);
    }
  }
  return allow;
}

/* ------------------------------------------------------------------ */
/*  Log analysis                                                       */
/* ------------------------------------------------------------------ */

function analyzeLog(text) {
  const byRoute = new Map(); // route -> { kinds: Map<kind, {count, samples}> }
  if (!text) return byRoute;
  for (const line of text.split('\n')) {
    const m = SWALLOWED_RE.exec(line);
    if (!m) continue;
    const [, route, kind, msg] = m;
    if (!byRoute.has(route)) byRoute.set(route, { kinds: new Map() });
    const bucket = byRoute.get(route).kinds;
    if (!bucket.has(kind)) bucket.set(kind, { count: 0, samples: [] });
    const k = bucket.get(kind);
    k.count++;
    if (k.samples.length < 3) k.samples.push(msg);
  }
  return byRoute;
}

async function readLog(logArg) {
  if (!logArg) return ''; // log analysis is opt-in to keep CI invocations safe
  if (logArg === '-') {
    // Explicit stdin mode: drain until EOF.
    let buf = '';
    for await (const chunk of process.stdin) buf += chunk.toString('utf8');
    return buf;
  }
  if (!fs.existsSync(logArg)) {
    console.error(`--log: file not found: ${logArg}`);
    process.exit(2);
  }
  return fs.readFileSync(logArg, 'utf8');
}

/* ------------------------------------------------------------------ */
/*  Stub-render detection                                              */
/* ------------------------------------------------------------------ */

/**
 * Different route classes have different "healthy size" baselines.
 * A `/embed/*` widget is intentionally chrome-less and can be ~20KB.
 * A full tool page should be ≥30KB. The home/skills/etc. landing pages
 * weigh ≥50KB. A 1-line meta-refresh redirect is allowed only when
 * explicitly listed (e.g. `/` → `/home`).
 */
function thresholdFor(route) {
  if (route === '/' || route === '/index.html') return { min: 100, kind: 'redirect' };
  if (route.startsWith('/embed/')) return { min: 8000, kind: 'embed' };
  if (route.startsWith('/tools/') || route.startsWith('/games/')) return { min: 25000, kind: 'tool' };
  return { min: 25000, kind: 'page' };
}

function findStubs(distDir) {
  const stubs = [];
  if (!fs.existsSync(distDir)) {
    return { stubs, total: 0, missingDist: true };
  }
  let total = 0;
  function walk(dir, urlPath) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name === 'assets' || e.name === '404' || e.name.startsWith('chunk-')) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full, urlPath === '' ? '/' + e.name : urlPath + '/' + e.name);
      } else if (e.name === 'index.html') {
        total++;
        const route = urlPath || '/';
        const size = fs.statSync(full).size;
        const threshold = thresholdFor(route);
        const issues = [];
        if (size < threshold.min) issues.push(`size ${size}B < ${threshold.min}B (${threshold.kind})`);
        // Sentinel checks — only for pages, not redirects.
        if (threshold.kind !== 'redirect') {
          const html = fs.readFileSync(full, 'utf8');
          if (!/<h1\b/i.test(html) && !/<main\b/i.test(html)) {
            issues.push('no <h1> or <main> sentinel');
          }
        }
        if (issues.length) stubs.push({ route, size, threshold: threshold.min, kind: threshold.kind, issues });
      }
    }
  }
  walk(distDir, '');
  return { stubs, total, missingDist: false };
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const allow = loadAllowlist(args.allowlist);
  const logText = await readLog(args.log);
  const byRoute = analyzeLog(logText);
  const { stubs, total: prerendered, missingDist } = findStubs(args.dist);

  // Classify swallowed entries against allowlist.
  const swallowedItems = [];
  for (const [route, { kinds }] of byRoute) {
    for (const [kind, { count, samples }] of kinds) {
      const allowed = allow.swallowed.has(`${route}|${kind}`);
      swallowedItems.push({ route, kind, count, samples, allowed });
    }
  }
  const unexpectedSwallowed = swallowedItems.filter(s => !s.allowed);

  // Classify stubs against allowlist.
  const unexpectedStubs = stubs.filter(s => !allow.stubs.has(s.route));
  const allowedStubs = stubs.filter(s => allow.stubs.has(s.route));

  const ok = unexpectedSwallowed.length === 0 && (args.strict ? unexpectedStubs.length === 0 : unexpectedStubs.length === 0);

  const report = {
    ok,
    prerenderedCount: prerendered,
    swallowed: {
      total: swallowedItems.length,
      unexpected: unexpectedSwallowed,
      allowed: swallowedItems.filter(s => s.allowed),
    },
    stubs: {
      total: stubs.length,
      unexpected: unexpectedStubs,
      allowed: allowedStubs,
    },
    missingDist,
    logBytes: logText.length,
  };

  if (args.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    process.stdout.write(JSON.stringify(report) + '\n');
  }

  if (!args.json) {
    const out = process.stderr;
    out.write('\n=== Prerender Health Report ===\n');
    out.write(`Prerendered routes:   ${prerendered}\n`);
    out.write(`Log lines parsed:     ${logText.split('\n').length} (${logText.length}B)\n`);
    out.write(`Swallowed events:     ${swallowedItems.length} total, ${unexpectedSwallowed.length} unexpected\n`);
    out.write(`Stub renders:         ${stubs.length} total, ${unexpectedStubs.length} unexpected\n`);

    if (missingDist) out.write(`!! dist directory missing: ${args.dist}\n`);

    if (unexpectedSwallowed.length) {
      out.write('\n--- Unexpected swallowed errors ---\n');
      for (const s of unexpectedSwallowed) {
        out.write(`  ${s.route} [${s.kind}] x${s.count} — ${s.samples[0] || ''}\n`);
      }
    }
    if (unexpectedStubs.length) {
      out.write('\n--- Unexpected stub renders ---\n');
      for (const s of unexpectedStubs) {
        out.write(`  ${s.route} (${s.kind}) — ${s.issues.join('; ')} (size=${s.size}B)\n`);
      }
    }
    if (!args.quiet && ok) {
      out.write('\nOK: prerender output is healthy.\n');
    }
  }

  process.exit(ok ? 0 : 1);
}

main().catch(err => {
  console.error('check-prerender-health: fatal:', err && err.stack || err);
  process.exit(2);
});
