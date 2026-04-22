/**
 * Patch domino's nyi() to suppress NotYetImplemented errors during SSR prerender.
 * Domino (bundled with @angular/platform-server) throws on unimplemented DOM APIs
 * like outerHTML.set, which crashes worker threads and fails the entire prerender.
 * These are non-critical — the browser applies them on hydration.
 *
 * Runs automatically via the "postinstall" npm script.
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@angular',
  'platform-server',
  'third_party',
  'domino',
  'bundled-domino.mjs'
);

if (!fs.existsSync(filePath)) {
  console.log('[patch-domino-ssr] domino not found — skipping.');
  process.exit(0);
}

const src = fs.readFileSync(filePath, 'utf8');
const needle = "throw new Error('NotYetImplemented');";
const replacement = "return; // patched: suppress for SSR prerender";

if (!src.includes(needle)) {
  console.log('[patch-domino-ssr] already patched or needle not found — skipping.');
  process.exit(0);
}

fs.writeFileSync(filePath, src.replace(needle, replacement), 'utf8');
console.log('[patch-domino-ssr] domino patched successfully.');
