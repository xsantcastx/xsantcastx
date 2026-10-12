// Pure-function tests for the station UI kit's affordability helpers.
// Run: node --test scripts/station-ui.test.cjs
// Transpiles the one model file in isolation (it has no imports), the same way
// seamworks-engine.test.cjs does, so it never needs Karma or a browser.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(rel) {
  const file = path.join(__dirname, '..', rel);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', code)(module, module.exports, require);
  return module.exports;
}

const m = load('src/app/shared/station-ui/station-ui.model.ts');
const gold = (have, need) => ({ kind: 'gold', label: 'Gold', have, need });
const mat = (have, need) => ({ kind: 'material', id: 'thornroot', label: 'Thornroot', have, need });

test('costShort is never negative and rounds partial units up', () => {
  assert.equal(m.costShort(gold(500, 200)), 0);
  assert.equal(m.costShort(gold(150, 200)), 50);
  assert.equal(m.costShort(gold(199.5, 200)), 1);
});

test('isAffordable needs every line; an empty price is free', () => {
  assert.equal(m.isAffordable([]), true);
  assert.equal(m.isAffordable([gold(12000, 12000), mat(6, 6)]), true);
  assert.equal(m.isAffordable([gold(12000, 12000), mat(5, 6)]), false);
});

test('affordProgress is the weakest line, clamped to 0..1', () => {
  assert.equal(m.affordProgress([]), 1);
  assert.equal(m.affordProgress([gold(0, 12000), mat(6, 6)]), 0);
  assert.equal(m.affordProgress([gold(6000, 12000), mat(3, 4)]), 0.5);
  assert.equal(m.affordProgress([gold(99999, 10)]), 1);
  assert.equal(m.affordProgress([gold(5, 0)]), 1);
});

test('shortfall names the first short line in caller order', () => {
  assert.equal(m.shortfall([gold(500, 500)]), null);
  const s = m.shortfall([gold(300, 500), mat(4, 6)]);
  assert.equal(s.cost.label, 'Gold');
  assert.equal(s.short, 200);
  const t = m.shortfall([gold(500, 500), mat(4, 6)]);
  assert.equal(t.cost.label, 'Thornroot');
  assert.equal(t.short, 2);
});

test('formatAmount is exact under 100K and compact above', () => {
  assert.equal(m.formatAmount(12000), '12,000');
  assert.equal(m.formatAmount(99999), '99,999');
  assert.equal(m.formatAmount(1250000), '1.25M');
  assert.equal(m.formatAmount(250000), '250K');
  assert.equal(m.formatAmount(NaN), '0');
});

test('maxAffordable is the tightest line, capped', () => {
  assert.equal(m.maxAffordable([gold(12000, 5000), mat(7, 3)]), 2);
  assert.equal(m.maxAffordable([gold(100, 500)]), 0);
  assert.equal(m.maxAffordable([gold(1e12, 1)]), 99);
  assert.equal(m.maxAffordable([gold(1e12, 1)], 5), 5);
  assert.equal(m.maxAffordable([]), 99);
});

test('priceLine joins every line', () => {
  assert.equal(m.priceLine([gold(0, 12000), mat(0, 6)]), '12,000 Gold + 6 Thornroot');
});
