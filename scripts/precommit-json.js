#!/usr/bin/env node
/**
 * precommit-json.js — validates every staged *.json file parses cleanly.
 * Catches stray trailing commas, missing quotes, or accidental binary writes
 * before they reach CI.
 */

const fs = require('fs');

const files = process.argv.slice(2).filter(f => f.endsWith('.json'));
if (!files.length) process.exit(0);

const RED = '\x1b[31m', RST = '\x1b[0m';
let bad = 0;

for (const file of files) {
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`${RED}✗${RST} ${file}: ${e.message}`);
    bad++;
  }
}

if (bad > 0) {
  console.error(`\n${RED}${bad} invalid JSON file(s) — fix before committing.${RST}`);
  process.exit(1);
}

console.log(`precommit-json: ✓ ${files.length} JSON file(s) valid.`);
