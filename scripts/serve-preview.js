#!/usr/bin/env node
/**
 * serve-preview.js — prerendered files first, Angular SPA fallback second.
 *
 * `npx serve -s` rewrites every missing path to /index.html, including
 * `/world` when it looks for a file named `world` instead of the prerendered
 * `world/index.html`. That boots the root shell and loops. This server:
 *
 *   1. serves a real file when it exists
 *   2. serves <dir>/index.html for directory URLs such as /world
 *   3. falls back to /index.html for extensionless app routes (/tools,
 *      /world/realms/verge) so Angular can redirect or render
 *   4. 404s missing assets so a bad image is not HTML
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || 'dist/xsantcastx/browser');
const port = Number(process.argv[3] || process.env.PORT || 4173);

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
};

function insideRoot(abs) {
  const rel = path.relative(root, abs);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function existingFile(abs) {
  try {
    return insideRoot(abs) && fs.statSync(abs).isFile() ? abs : null;
  } catch {
    return null;
  }
}

function resolveFile(urlPath) {
  const decoded = decodeURIComponent((urlPath || '/').split('?')[0].split('#')[0]);
  const safe = path.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, '');
  const abs = path.join(root, safe);
  const ext = path.extname(safe);

  const direct = existingFile(abs);
  if (direct) return direct;

  const asIndex = existingFile(path.join(abs, 'index.html'));
  if (asIndex) return asIndex;

  if (ext && ext !== '.html') return null;
  // Root index.html is the prerendered `/` redirect to /world. The CSR
  // shell is what unknown Angular routes need to boot the router.
  return existingFile(path.join(root, 'index.csr.html'))
    || existingFile(path.join(root, 'index.html'));
}

const server = http.createServer((req, res) => {
  const file = resolveFile(req.url || '/');
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  const type = MIME[path.extname(file)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(file).pipe(res);
});

server.listen(port, () => {
  console.log(`Accepting connections at http://127.0.0.1:${port}`);
});
