#!/usr/bin/env node
/**
 * artopt-gallery.mjs — the art-direction prototype's close-up (docs/handoff/artopt/): the game's Keeper, Bone Walker,
 * shade-kit and oak beside their HD repaints (td-hd-art.ts), at the same world size, on grass. No app build.
 *
 *   node scripts/artopt-gallery.mjs <out-png> [css px per world px, default 4]
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from '@playwright/test';

const [out = 'output/artopt/gallery.png', scaleArg = '4'] = process.argv.slice(2);
const root = resolve(import.meta.dirname, '..');
const require = createRequire(join(root, 'package.json'));
let esbuild;
try { esbuild = require('esbuild'); } catch { esbuild = createRequire(require.resolve('vite/package.json'))('esbuild'); }
const src = (p) => JSON.stringify(join(root, 'src/app', p));
const entry = join(tmpdir(), `artopt-gallery-${process.pid}.ts`);
writeFileSync(entry, `
import { KeeperPainter } from ${src('shared/keeper-look/keeper-paint')};
import { frontSheet, FRONT_W, FRONT_H } from ${src('shared/keeper-look/keeper-front')};
import { defaultLook } from ${src('shared/keeper-look/keeper-look.model')};
import { vocationLook } from ${src('shared/keeper-look/vocation-look')};
import { MOBS, mobCell, mobSheet } from ${src('play/td/td-mobs')};
import * as ART from ${src('play/td/td-art')};
import { paintRichGround } from ${src('play/td/td-ground')};
import { petSheet, PET_W, PET_H } from ${src('play/td/td-pet-art')};
import * as HD from ${src('play/td/td-hd-art')};
const S = ${Number(scaleArg) || 4};
const wrap = document.createElement('div'); wrap.className = 'row'; document.body.appendChild(wrap);
function card(title: string, w: number, h: number, paint: (c: CanvasRenderingContext2D) => void) {
  const f = document.createElement('figure'), el = document.createElement('canvas');
  el.width = w * S; el.height = h * S; el.style.width = el.width + 'px';
  const c = el.getContext('2d')!; c.imageSmoothingEnabled = false; c.scale(S, S);
  for (let r = 0; r * 16 < h; r++) for (let q = 0; q * 16 < w; q++) { const t = document.createElement('canvas'); t.width = 16; t.height = 16; paintRichGround(t.getContext('2d')!, 'grass', q, r + 40, 0, 0, () => 'grass'); c.drawImage(t, q * 16, r * 16); }
  paint(c);
  const cap = document.createElement('figcaption'); cap.textContent = title; f.append(el, cap); wrap.appendChild(f);
}
const look = { ...defaultLook(), made: true, vocation: 'ashguard', hair: 'curls', skin: 1, outfit: 3 } as any;
const v = vocationLook('ashguard', null), p = new KeeperPainter(look, v.gear, v.garb), ks = frontSheet(p, false);
card('Keeper now', FRONT_W * 2, FRONT_H * 2, c => { [0, 2].forEach((f, i) => { c.drawImage(ks, f * FRONT_W, 0, FRONT_W, FRONT_H, i * FRONT_W, 0, FRONT_W, FRONT_H); c.drawImage(ks, f * FRONT_W, FRONT_H, FRONT_W, FRONT_H, i * FRONT_W, FRONT_H, FRONT_W, FRONT_H); }); });
const hk = HD.hdKeeperSheet(), K = HD.HD_KEEPER;
card('Keeper HD', FRONT_W * 2, FRONT_H * 2, c => { [0, 2].forEach((f, i) => { for (let r = 0; r < 2; r++) c.drawImage(hk, f * K.w, r * K.h, K.w, K.h, i * FRONT_W + (FRONT_W / 2) - K.ax / 2, r * FRONT_H + 57 - K.ay / 2, K.w / 2, K.h / 2); }); });
const bw = MOBS['bone-walker'], cell = mobCell(bw), ms = mobSheet(bw);
card('Bone Walker now', cell.w * 2 + 4, cell.h + 4, c => { [0, 1].forEach(i => c.drawImage(ms, i * cell.w, 0, cell.w, cell.h, 2 + i * cell.w, 2, cell.w, cell.h)); });
const hs = HD.hdSkeletonSheet(), Sk = HD.HD_SKEL;
card('Bone Walker HD', cell.w * 2 + 4, cell.h + 4, c => { [0, 1].forEach(i => c.drawImage(hs, i * Sk.w, 0, Sk.w, Sk.h, 2 + i * cell.w, 2 + cell.h - Sk.h / 2, Sk.w / 2, Sk.h / 2)); });
const ps = petSheet('shade-kit')!;
card('Pet now', PET_W * 3, PET_H + 4, c => { [0, 4, 7].forEach((f, i) => c.drawImage(ps, f * PET_W, 0, PET_W, PET_H, i * PET_W, 2, PET_W, PET_H)); });
const hp = HD.hdPetSheet(), Pp = HD.HD_PET;
card('Pet HD', PET_W * 3, PET_H + 4, c => { [0, 4, 7].forEach((f, i) => c.drawImage(hp, f * Pp.w, 0, Pp.w, Pp.h, i * PET_W, 2 + PET_H - Pp.h / 2, Pp.w / 2, Pp.h / 2)); });
const tr = ART.tree('oak', 1);
card('Oak now', 56, 64, c => { c.drawImage(tr.img, 28 - tr.ax, 60 - tr.ay); c.drawImage(tr.roof!.img, 28 + tr.roof!.x, 60 + tr.roof!.y); });
const ho = HD.hdOak(1) as any;
card('Oak HD', 56, 64, c => { c.drawImage(ho.img, 28 - ho.ax / 2, 60 - ho.ay / 2, ho.img.width / 2, ho.img.height / 2); c.drawImage(ho.roof.img, 28 + ho.roof.x, 60 + ho.roof.y, ho.roof.img.width / 2, ho.roof.img.height / 2); });
const raw = document.createElement('div'); raw.className = 'row'; document.body.appendChild(raw);
for (const cv of [hk, hs, hp]) { const el = document.createElement('canvas'); el.width = cv.width * 2; el.height = cv.height * 2; const g = el.getContext('2d')!; g.imageSmoothingEnabled = false; g.fillStyle = '#4c8c36'; g.fillRect(0, 0, el.width, el.height); g.drawImage(cv, 0, 0, el.width, el.height); el.style.width = el.width + 'px'; raw.appendChild(el); }
(window as any).done = true;
`);
const built = await esbuild.build({ entryPoints: [entry], bundle: true, write: false, format: 'iife', target: 'es2022', logLevel: 'warning' });
const css = 'body{margin:0;padding:10px;background:#120c18;color:#e8dcc8;font:13px system-ui}.row{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start;margin-bottom:8px}figure{margin:0;background:#1d1528;padding:3px}figcaption{text-align:center}canvas{display:block;image-rendering:pixelated}';
const html = `<!doctype html><meta charset="utf-8"><style>${css}</style><body><script>${built.outputFiles[0].text}</script></body>`;
mkdirSync(dirname(out), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1900, height: 900 } });
page.on('pageerror', e => console.error('pageerror', e.message));
await page.setContent(html);
await page.waitForFunction(() => window.done === true, null, { timeout: 30000 });
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`wrote ${out}`);
