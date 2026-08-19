#!/usr/bin/env node
/**
 * check-i18n-keys.js — fail the build when a template asks for a string the
 * translation table does not have.
 *
 * A missing key is invisible in development: TranslationService falls back to
 * returning the key itself, so the page renders `godforge.journey.arena` in
 * place of "The Arena" and nothing errors. That is exactly the failure a
 * large-scale prune of unused keys can cause, so the prune ships with the
 * check that makes it safe to repeat.
 *
 * This runs in Node rather than Karma because it has to read the source tree,
 * and the Karma suite runs in a browser with no filesystem.
 *
 * Direction matters:
 *   · referenced-but-undeclared is a BUILD FAILURE — it is a visible bug.
 *   · declared-but-unreferenced is only reported — a key can legitimately be
 *     staged ahead of the surface that will use it.
 *
 * Keys are not always literals. Two indirections are handled:
 *   · `t(\`market.rarity.${r}\`)` and `'hub.tab.' + id` — the prefix is
 *     collected and every declared key under it counts as referenced.
 *   · `labelKey: 'gfnav.world'` in a manifest — already a literal, so the
 *     plain string scan finds it.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src');
const TABLE = path.join(ROOT, 'app', 'translation.service.ts');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|html)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const table = fs.readFileSync(TABLE, 'utf8');
const declared = new Set(
  [...table.matchAll(/^\s*'([a-zA-Z][a-zA-Z0-9_.-]*)':\s*\{/gm)].map(m => m[1]),
);

const files = walk(ROOT).filter(f => f !== TABLE && !f.endsWith('.spec.ts'));
const referenced = new Set();
const prefixes = new Set();

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  // Literal keys: anything quoted that looks like a dotted lower-camel path.
  for (const m of src.matchAll(/['"`]([a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_-]+)+)['"`]/g)) {
    referenced.add(m[1]);
  }
  // Dynamic keys: `prefix.${x}` and 'prefix.' + x
  for (const m of src.matchAll(/`([a-z][\w.]*\.)\$\{/g)) prefixes.add(m[1]);
  for (const m of src.matchAll(/['"]([a-z][\w.]*\.)['"]\s*\+/g)) prefixes.add(m[1]);
}

const underPrefix = key => [...prefixes].some(p => key.startsWith(p));

// A referenced string is only a missing *key* if it looks like one of ours:
// it has to share a namespace with something the table already declares.
const namespaces = new Set([...declared].map(k => k.split('.')[0]));
const missing = [...referenced]
  .filter(k => !declared.has(k) && namespaces.has(k.split('.')[0]) && !underPrefix(k))
  .sort();

const unused = [...declared]
  .filter(k => !referenced.has(k) && !underPrefix(k))
  .sort();

console.log(
  `i18n: ${declared.size} keys declared, ${declared.size - unused.length} referenced, ` +
  `${unused.length} unreferenced, ${prefixes.size} dynamic prefixes.`,
);

if (unused.length) {
  console.log(`\nUnreferenced (not an error — prune when you are sure):`);
  for (const k of unused.slice(0, 40)) console.log(`  ${k}`);
  if (unused.length > 40) console.log(`  … and ${unused.length - 40} more`);
}

if (missing.length) {
  console.error(`\nERROR: ${missing.length} key(s) are asked for but not declared.`);
  console.error('These render as the raw key to visitors, in both languages:');
  for (const k of missing) console.error(`  ${k}`);
  process.exit(1);
}

console.log('\nEvery key a template asks for exists. ✓');
