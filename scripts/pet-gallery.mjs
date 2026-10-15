#!/usr/bin/env node
/**
 * pet-gallery.mjs — the pets gallery for art passes (docs/handoff/pets/).
 *
 *   node scripts/pet-gallery.mjs <out-dir> <prefix>
 *
 * Bundles the pet painter (shared/pets/pet-art.ts) and the Keeper painter with
 * esbuild, paints every pet's frames (plain and hatted), its egg, and each pet
 * beside a chibi Keeper at world scale, then screenshots the page with
 * Playwright into <out-dir>/<prefix>-pets.png. No server or app build: it is a
 * camera for the painter, nothing is asserted.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from '@playwright/test';

const [outDir = 'output/pets', prefix = 'now'] = process.argv.slice(2);
const root = resolve(import.meta.dirname, '..');
const require = createRequire(join(root, 'package.json'));
let esbuild;
try { esbuild = require('esbuild'); } catch { esbuild = createRequire(require.resolve('vite/package.json'))('esbuild'); }

const entry = join(tmpdir(), `pet-gallery-${process.pid}.ts`);
writeFileSync(entry, `
import { PET_FRAMES, drawPet, eggPortrait } from ${JSON.stringify(join(root, 'src/app/shared/pets/pet-art'))};
import { PETS } from ${JSON.stringify(join(root, 'src/app/shared/pets/pets.model'))};
import { KeeperPainter } from ${JSON.stringify(join(root, 'src/app/shared/keeper-look/keeper-paint'))};
import { defaultLook } from ${JSON.stringify(join(root, 'src/app/shared/keeper-look/keeper-look.model'))};

function card(parent: HTMLElement, label: string, w: number, h: number, paint: (c: CanvasRenderingContext2D) => void): void {
  const box = document.createElement('figure');
  const el = document.createElement('canvas'); el.width = w; el.height = h;
  const c = el.getContext('2d')!; c.imageSmoothingEnabled = false;
  paint(c);
  const cap = document.createElement('figcaption'); cap.textContent = label;
  box.append(el, cap); parent.append(box);
}
const S = 4;
const sheet = document.getElementById('frames')!;
for (const pet of PETS) {
  const row = document.createElement('div'); row.className = 'row';
  sheet.append(row);
  const egg = new Image(); egg.src = eggPortrait(pet.id, 0, 4);
  const fig = document.createElement('figure'); const cap = document.createElement('figcaption'); cap.textContent = pet.name + ' egg';
  fig.append(egg, cap); row.append(fig);
  for (const hat of [false, true]) for (const f of PET_FRAMES) {
    if (hat && f !== 'idle0' && f !== 'happy') continue;
    card(row, (hat ? 'hat ' : '') + f, 30 * S, 28 * S, c => {
      c.fillStyle = '#2a2236'; c.fillRect(0, 28 * S - 2 * S, 30 * S, 2 * S);
      drawPet(c, pet.id, f, hat, 15 * S, 26 * S, S, 1);
    });
  }
}
const scene = document.getElementById('scene')!;
const keeper = new KeeperPainter({ ...defaultLook(), made: true, face: 'rosy' } as any, null);
card(scene, 'Keeper and the seven, world scale (4 px per art px)', 1400, 260, c => {
  c.fillStyle = '#2a2236'; c.fillRect(0, 230, 1400, 30);
  c.save(); c.translate(110, 232); keeper.draw(c, S, { action: 'idle', time: 0, attackT: 0, weapon: false } as any); c.restore();
  PETS.forEach((pet, i) => drawPet(c, pet.id, i % 2 ? 'idle1' : 'idle0', i === 3, 250 + i * 160, 232, S, i === 6 ? -1 : 1));
});
(window as any).done = true;
`);

const built = await esbuild.build({ entryPoints: [entry], bundle: true, write: false, format: 'iife', target: 'es2022', logLevel: 'silent' });
const js = built.outputFiles[0].text;
const css = `body{margin:0;padding:16px;background:#120c18;color:#e8dcc8;font:12px system-ui,sans-serif}
h2{font-size:14px;margin:12px 0 6px;color:#ffd08a}.row{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}
figure{margin:0;background:#1d1528;border:1px solid #33263a;padding:4px}figcaption{text-align:center;padding-top:2px}canvas,img{display:block;image-rendering:pixelated}`;
const html = `<!doctype html><meta charset="utf-8"><style>${css}</style>
<h2>Pets beside the Keeper</h2><div class="row" id="scene"></div><h2>Every frame (and the hat)</h2><div id="frames"></div><script>${js}</script>`;

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1460, height: 900 } });
await page.setContent(html);
await page.waitForFunction(() => window.done === true);
await page.waitForTimeout(200);
await page.screenshot({ path: join(outDir, `${prefix}-pets.png`), fullPage: true });
await browser.close();
console.log(`wrote ${outDir}/${prefix}-pets.png`);
