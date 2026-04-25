#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Plain-Node tests for scripts/check-prerender-health.js.
 *
 * Runs without any test runner — just `node scripts/check-prerender-health.test.js`.
 * Exits 0 on success, 1 on the first failure.
 *
 * Covered:
 *   - Allowlist parsing (swallowed + stub rules, comments)
 *   - Log parsing groups by route, captures count/samples
 *   - Stub detection respects per-route-class thresholds
 *   - Allowlisted entries don't trip the unexpected counters
 *   - Exit codes via spawn against fixtures
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');

const SCRIPT = path.join(__dirname, 'check-prerender-health.js');
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'prerender-health-test-'));

let passed = 0;
let failed = 0;
const failures = [];

function assertEq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failed++;
    failures.push(`FAIL ${label}\n  expected: ${e}\n  actual:   ${a}`);
  } else {
    passed++;
  }
}
function assert(cond, label) { assertEq(!!cond, true, label); }

function makeFixture(name, layout) {
  const root = path.join(tmpRoot, name);
  fs.mkdirSync(root, { recursive: true });
  for (const [route, content] of Object.entries(layout)) {
    const dir = path.join(root, route);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), content);
  }
  return root;
}

function runScript(opts) {
  const args = [];
  if (opts.log) args.push('--log', opts.log);
  if (opts.dist) args.push('--dist', opts.dist);
  if (opts.allowlist) args.push('--allowlist', opts.allowlist);
  args.push('--json', '--quiet');
  const r = cp.spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    input: opts.stdin || '',
  });
  return {
    code: r.status,
    stdout: r.stdout,
    stderr: r.stderr,
    report: (() => { try { return JSON.parse(r.stdout); } catch { return null; } })(),
  };
}

/* ----------------------- Test 1: clean run ----------------------- */
{
  const dist = makeFixture('clean', {
    '': '<html><body><main><h1>Home</h1></main>' + 'x'.repeat(60000) + '</body></html>',
    '/tools/json-formatter': '<html><body><main><h1>JSON Formatter</h1></main>' + 'y'.repeat(40000) + '</body></html>',
    '/embed/json-formatter': '<html><body><h1>Embed</h1>' + 'z'.repeat(15000) + '</body></html>',
  });
  const allowFile = path.join(tmpRoot, 'clean.allow');
  fs.writeFileSync(allowFile, '# empty\n');
  const r = runScript({ dist, allowlist: allowFile });
  assertEq(r.code, 0, 'clean: exit 0');
  assert(r.report && r.report.ok === true, 'clean: ok=true');
  assertEq(r.report.swallowed.unexpected.length, 0, 'clean: no swallowed');
  assertEq(r.report.stubs.unexpected.length, 0, 'clean: no stubs');
}

/* ----------------------- Test 2: stub detection ------------------ */
{
  const dist = makeFixture('stubs', {
    '': '<html><body><meta http-equiv="refresh" content="0;url=/home"></body></html>', // / is redirect
    '/tools/json-formatter': '<html><body>tiny</body></html>', // STUB
    '/embed/json-formatter': '<html><body><h1>OK</h1>' + 'x'.repeat(15000) + '</body></html>',
  });
  const allowFile = path.join(tmpRoot, 'stubs.allow');
  fs.writeFileSync(allowFile, 'stub:/\n');
  const r = runScript({ dist, allowlist: allowFile });
  assertEq(r.code, 1, 'stubs: exit 1');
  assert(r.report.stubs.unexpected.find(s => s.route === '/tools/json-formatter'),
    'stubs: detects undersized tool page');
  // / is allowlisted as a redirect stub — should NOT show up as unexpected.
  assert(!r.report.stubs.unexpected.find(s => s.route === '/'),
    'stubs: allowlisted / not in unexpected');
}

/* ----------------------- Test 3: log parsing --------------------- */
{
  const log = [
    'building...',
    '[SSR-SWALLOWED] route=/tools/foo kind=NotYetImplemented msg=NotYetImplemented',
    '[SSR-SWALLOWED] route=/tools/foo kind=NotYetImplemented msg=NotYetImplemented',
    '[SSR-SWALLOWED] route=/tools/bar kind=Other msg=Cannot read properties of undefined (reading "x")',
    '[SSR-SWALLOWED-STACK] route=/tools/bar at HeaderComponent.ngOnInit (header.ts:99) | at ...',
    '✓ Done',
  ].join('\n');
  const logFile = path.join(tmpRoot, 'log.txt');
  fs.writeFileSync(logFile, log);
  const dist = makeFixture('parsed', {
    '': '<html><body><main><h1>Home</h1></main>' + 'x'.repeat(60000) + '</body></html>',
  });
  const allowFile = path.join(tmpRoot, 'parsed.allow');
  fs.writeFileSync(allowFile, '/tools/foo NotYetImplemented\n');
  const r = runScript({ dist, log: logFile, allowlist: allowFile });
  assertEq(r.code, 1, 'log: exit 1 (bar is unexpected)');
  // foo is allowlisted, bar is not.
  const unexpected = r.report.swallowed.unexpected;
  assertEq(unexpected.length, 1, 'log: 1 unexpected');
  assertEq(unexpected[0].route, '/tools/bar', 'log: bar surfaced');
  assertEq(unexpected[0].kind, 'Other', 'log: bar kind=Other');
  // Allowed bucket has foo with count=2.
  const foo = r.report.swallowed.allowed.find(s => s.route === '/tools/foo');
  assertEq(foo.count, 2, 'log: foo count=2');
}

/* ----------------------- Test 4: missing dist -------------------- */
{
  const allowFile = path.join(tmpRoot, 'nodist.allow');
  fs.writeFileSync(allowFile, '');
  const r = runScript({ dist: path.join(tmpRoot, 'does-not-exist'), allowlist: allowFile });
  assert(r.report && r.report.missingDist === true, 'missing dist: flagged');
  // No dist + no log + no failures = ok=true. The monitor agent should
  // detect missingDist separately.
  assertEq(r.code, 0, 'missing dist: still exits 0 if no errors');
}

/* ----------------------- Summary --------------------------------- */
console.log(`${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('');
  console.log(failures.join('\n\n'));
  process.exit(1);
}
process.exit(0);
