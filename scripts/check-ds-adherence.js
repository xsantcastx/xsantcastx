#!/usr/bin/env node
/**
 * check-ds-adherence.js — Eclipse Realms Design System adherence gate.
 *
 * The design system ships `_adherence.oxlintrc.json`, but it is written for
 * React + oxlint: its three rules are `react/forbid-elements`,
 * `no-restricted-imports` and `no-restricted-syntax` over JSX. This project is
 * Angular with plain CSS and no oxlint, so dropping that file in would lint
 * nothing at all. What follows enforces the same *intent* against this stack,
 * in the style of the repo's other gate scripts (audit-nav, check-i18n-keys).
 *
 * It is a RATCHET, not a wall. Each rule has a committed baseline count; the
 * build fails when a count goes UP. That locks in the cleanup already done and
 * blocks new violations, without demanding that the remaining backlog — mostly
 * emoji standing in for item art that has not been painted yet — be cleared in
 * one pass. Lower a baseline whenever you fix something; the script prints the
 * exact line to paste.
 *
 * Usage:  node scripts/check-ds-adherence.js [--update]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const BASELINE = path.join(__dirname, 'ds-adherence.baseline.json');
const TOKEN_DIR = path.join('src', 'styles', 'tokens');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const files = walk(SRC).map(f => ({ rel: path.relative(ROOT, f), body: null, abs: f }));
const read = f => (f.body ??= fs.readFileSync(f.abs, 'utf8'));
// Prose in a comment is documentation, not a violation — a rule that flags the
// paragraph explaining the rule is a rule nobody keeps. Scans that look for
// names rather than syntax run against the comment-stripped body.
const readCode = f => (f.code ??= read(f)
  .replace(/\/\*[\s\S]*?\*\//g, ' ')      // CSS + JS block comments
  .replace(/<!--[\s\S]*?-->/g, ' ')        // HTML comments
  .replace(/^\s*\/\/.*$/gm, ' '));         // JS line comments
const pick = (...exts) => files.filter(f => exts.some(e => f.rel.endsWith(e)));

// Emoji and decorative Unicode used as an icon. The design system is explicit:
// "Emoji and Unicode glyphs are never icons" — `✦ ◈ 🜃` are the same bug class
// as `🔨 ⚙️ 🌑`, which is what 37 market rows rendered as beside painted art.
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1F0FF}\u{FE0F}]/gu;

const RULES = {
  // The audit's headline finding: colour literals instead of tokens.
  'no-raw-hex-css': {
    why: 'Colour literals in CSS. Use a token from src/styles/tokens/.',
    scan: () => pick('.css')
      .filter(f => !f.rel.startsWith(TOKEN_DIR))
      .flatMap(f => (read(f).match(/#[0-9a-fA-F]{3,8}\b/g) || []).map(m => `${f.rel}: ${m}`)),
  },
  // Six golds were in play. There is one, and it has a ramp.
  'no-retired-golds': {
    why: 'A retired gold. The design system defines one gold (--gold) with a ramp.',
    scan: () => {
      const dead = /#(c9a84c|d6a84f|ffc669|e4a83a|e0a857|ffd97a|f5c451)\b/gi;
      return files.filter(f => /\.(css|ts|html)$/.test(f.rel) && !f.rel.includes('cosmic-engine'))
        .flatMap(f => (read(f).match(dead) || []).map(m => `${f.rel}: ${m}`));
    },
  },
  'no-emoji-in-templates': {
    why: 'Emoji/Unicode glyph in a template. Use the SVG control pack or approved raster art.',
    scan: () => pick('.html').flatMap(f => (read(f).match(EMOJI) || []).map(m => `${f.rel}: ${m}`)),
  },
  'no-emoji-in-code': {
    why: 'Emoji used as icon data. Needs painted art via scripts/import-assets.py.',
    scan: () => pick('.ts').filter(f => !f.rel.endsWith('.spec.ts'))
      .flatMap(f => (read(f).match(EMOJI) || []).map(m => `${f.rel}: ${m}`)),
  },
  // "No icon font, no CDN set, no Lucide/Heroicons substitution."
  'no-icon-cdn': {
    why: 'Icon font or CDN icon set. The two SVG packs are the whole system.',
    scan: () => files.filter(f => /\.(html|ts|css|js)$/.test(f.rel))
      .flatMap(f => (readCode(f).match(/font-awesome|fontawesome|lucide|heroicons|material-icons|cdnjs\.cloudflare/gi) || [])
        .map(m => `${f.rel}: ${m}`)),
  },
  // "The z-scale is a closed set — a component that needs a new value needs a
  //  design decision, not a bigger number."
  'no-raw-zindex': {
    why: 'Raw z-index >= 300. Name a step from the closed scale instead.',
    scan: () => files.filter(f => /\.(css|ts)$/.test(f.rel) && !f.rel.startsWith(TOKEN_DIR))
      .flatMap(f => (read(f).match(/z-index:\s*[3-9]\d{2,}|z-index:\s*\d{4,}/g) || [])
        .map(m => `${f.rel}: ${m.trim()}`)),
  },
};

const update = process.argv.includes('--update');
const base = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {};
const counts = {};
let failed = false, improved = [];

console.log('Eclipse Realms Design System — adherence\n');
for (const [name, rule] of Object.entries(RULES)) {
  const hits = rule.scan();
  counts[name] = hits.length;
  const allowed = base[name] ?? 0;
  if (hits.length > allowed) {
    failed = true;
    console.log(`  FAIL  ${name}: ${hits.length} (baseline ${allowed})`);
    console.log(`        ${rule.why}`);
    for (const h of hits.slice(0, 8)) console.log(`          ${h}`);
    if (hits.length > 8) console.log(`          ... and ${hits.length - 8} more`);
  } else {
    const tag = hits.length < allowed ? 'BETTER' : 'ok';
    if (hits.length < allowed) improved.push(`"${name}": ${hits.length}`);
    console.log(`  ${tag.padEnd(7)}${name}: ${hits.length}${hits.length < allowed ? ` (baseline ${allowed} — lower it)` : ''}`);
  }
}

if (update) {
  fs.writeFileSync(BASELINE, JSON.stringify(counts, null, 2) + '\n');
  console.log('\nBaseline updated.');
  process.exit(0);
}
if (improved.length) console.log(`\nImproved — lower the baseline: ${improved.join(', ')}`);
if (failed) {
  console.log('\nAdherence regressed. Fix the new violations, or run with --update if the rise is deliberate.');
  process.exit(1);
}
console.log('\nAdherence holds.');
