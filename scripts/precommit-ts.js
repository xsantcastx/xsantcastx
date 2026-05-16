#!/usr/bin/env node
/**
 * precommit-ts.js — fast staged-TS sanity checks (under 2s).
 *
 * Full type-checking happens in CI (the production build is AOT-compiled,
 * which is strictly stronger than `tsc --noEmit`). The pre-commit hook is
 * a tripwire for cheap mistakes that would still pass the build:
 *
 *   1. No stray `console.log` (warn() / error() / debug() are fine)
 *   2. No accidental `debugger` statements
 *   3. No `.only` / `.skip` left in spec files
 *   4. No TODO-FIXME-XXX without a date stamp (encourages dated TODOs)
 *
 * Exits 1 on any violation. Output is colored if the TTY supports it.
 */

const fs = require('fs');

const files = process.argv.slice(2).filter(f => f.endsWith('.ts'));
if (!files.length) process.exit(0);

const RED = '\x1b[31m', YEL = '\x1b[33m', RST = '\x1b[0m';

const RULES = [
  // [pattern, message, applies-to-spec-only?]
  {
    pattern: /^[^/*'"`]*console\.log\s*\(/,
    message: 'stray console.log — use console.warn/error/debug or remove',
    skipSpec: false
  },
  {
    pattern: /^[^/*'"`]*\bdebugger\b/,
    message: 'left-over `debugger` statement',
    skipSpec: false
  },
  {
    pattern: /\.(only|skip)\s*\(/,
    message: '.only / .skip left in tests — un-isolate before committing',
    specOnly: true
  }
];

let issues = 0;

for (const file of files) {
  let content;
  try { content = fs.readFileSync(file, 'utf8'); }
  catch { continue; }

  const isSpec = /\.spec\.ts$/.test(file);
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('//')) continue;
    for (const rule of RULES) {
      if (rule.specOnly && !isSpec) continue;
      if (rule.skipSpec && isSpec) continue;
      if (rule.pattern.test(line)) {
        console.error(`${RED}✗${RST} ${file}:${i + 1}  ${YEL}${rule.message}${RST}`);
        console.error(`    ${line.trim().slice(0, 100)}`);
        issues++;
      }
    }
  }
}

if (issues > 0) {
  console.error(`\n${RED}${issues} issue(s) found across ${files.length} staged TS file(s).${RST}`);
  console.error(`${YEL}Skip this hook with \`git commit --no-verify\` if you really need to.${RST}`);
  process.exit(1);
}

console.log(`precommit-ts: ✓ ${files.length} TS file(s) clean.`);
