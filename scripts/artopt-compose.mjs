#!/usr/bin/env node
/**
 * artopt-compose.mjs — lays labelled panels (crops of screenshots, optionally scaled nearest-neighbour or smooth) on
 * one sheet: the art-direction prototype's comparisons (docs/handoff/artopt/).
 *
 *   node scripts/artopt-compose.mjs <spec.json> <out.png>
 *
 * spec: { cols, gap?, bg?, title?, panels: [{ src, label, crop?: [x, y, w, h], w, h, smooth? }] } — each panel's crop
 * (source px, default whole image) is drawn into w × h.
 */
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
const [specPath, out] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const panels = spec.panels.map(p => ({ ...p, data: 'data:image/png;base64,' + readFileSync(p.src).toString('base64') }));
const gap = spec.gap ?? 12, cols = spec.cols, rows = Math.ceil(panels.length / cols);
const cw = Math.max(...panels.map(p => p.w)), ch = Math.max(...panels.map(p => p.h)), lab = 34, top = spec.title ? 44 : 0;
const W = cols * cw + (cols + 1) * gap, H = top + rows * (ch + lab) + (rows + 1) * gap;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Math.min(W, 4000), height: 800 }, deviceScaleFactor: 1 });
await page.setContent('<canvas id=c></canvas>');
const png = await page.evaluate(async ({ panels, W, H, gap, cols, cw, ch, lab, top, title, bg }) => {
  const c = document.getElementById('c'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.fillStyle = bg ?? '#140e1a'; g.fillRect(0, 0, W, H);
  if (title) { g.fillStyle = '#ffd08a'; g.font = 'bold 26px system-ui'; g.fillText(title, gap, 32); }
  for (let i = 0; i < panels.length; i++) {
    const p = panels[i], img = new Image(); img.src = p.data; await img.decode();
    const x = gap + (i % cols) * (cw + gap), y = top + gap + Math.floor(i / cols) * (ch + lab + gap);
    const [sx, sy, sw, sh] = p.crop ?? [0, 0, img.width, img.height];
    g.imageSmoothingEnabled = !!p.smooth; g.imageSmoothingQuality = 'high';
    g.drawImage(img, sx, sy, sw, sh, x, y + lab, p.w, p.h);
    g.fillStyle = '#f3e7cf'; g.font = 'bold 22px system-ui'; g.fillText(p.label, x, y + 25);
  }
  return c.toDataURL('image/png');
}, { panels, W, H, gap, cols, cw, ch, lab, top, title: spec.title, bg: spec.bg });
(await import('node:fs')).writeFileSync(out, Buffer.from(png.split(',')[1], 'base64'));
await browser.close();
console.log('wrote', out, W + 'x' + H);
