#!/usr/bin/env node
/**
 * art-gallery.mjs — the top-down art style's gallery (docs/handoff/art-style.md).
 *
 *   node scripts/art-gallery.mjs <out-png> [scale]
 *
 * Bundles the real painters with esbuild (keeper-front + keeper-paint with and without the volume pass, td-mobs'
 * creatures, td-art's trees and props, td-ground's grass and paths, td-aura's ring) and paints them on one page at
 * `scale` (default 4) px per art px: the before/after of each family side by side. No server or app build: a camera
 * for the painters, nothing asserted.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from '@playwright/test';

const [out = 'output/art/gallery.png', scaleArg = '4', only = ''] = process.argv.slice(2);
const root = resolve(import.meta.dirname, '..');
const require = createRequire(join(root, 'package.json'));
let esbuild;
try { esbuild = require('esbuild'); } catch { esbuild = createRequire(require.resolve('vite/package.json'))('esbuild'); }
const src = (p) => JSON.stringify(join(root, 'src/app', p));

const entry = join(tmpdir(), `art-gallery-${process.pid}.ts`);
writeFileSync(entry, `
import { KeeperPainter } from ${src('shared/keeper-look/keeper-paint')};
import { frontSheet, FRONT_W, FRONT_H } from ${src('shared/keeper-look/keeper-front')};
import { setVolume } from ${src('shared/keeper-look/keeper-volume')};
import { defaultLook } from ${src('shared/keeper-look/keeper-look.model')};
import { vocationLook } from ${src('shared/keeper-look/vocation-look')};
import { MOBS, RAISED_SKELETON, mobCell, mobSheet } from ${src('play/td/td-mobs')};
import * as ART from ${src('play/td/td-art')};
import { paintRichGround } from ${src('play/td/td-ground')};
import { AURA_LOOKS, AuraFx } from ${src('play/td/td-aura')};
import { petSheet } from ${src('play/td/td-pet-art')};

const S = ${Number(scaleArg) || 4}, ONLY = ${JSON.stringify(only)};
const want = (k: string) => !ONLY || ONLY.split(',').includes(k);
function section(title: string): HTMLElement {
  const h = document.createElement('h2'); h.textContent = title; document.body.append(h);
  const row = document.createElement('div'); row.className = 'row'; document.body.append(row); return row;
}
function card(parent: HTMLElement, label: string, w: number, h: number, paint: (c: CanvasRenderingContext2D) => void): void {
  const box = document.createElement('figure');
  const el = document.createElement('canvas'); el.width = w * S; el.height = h * S;
  const c = el.getContext('2d')!; c.imageSmoothingEnabled = false; c.scale(S, S);
  paint(c);
  const cap = document.createElement('figcaption'); cap.textContent = label;
  box.append(el, cap); parent.append(box);
}
/** Ground painters write pixels (putImageData ignores the gallery's scale): paint unscaled, then blit. */
function ground(w: number, h: number, kind: (q: number, r: number) => any, seed = 0): HTMLCanvasElement {
  const el = document.createElement('canvas'); el.width = w; el.height = h;
  const g = el.getContext('2d')!;
  for (let r = 0; r * 16 < h; r++) for (let q = 0; q * 16 < w; q++) paintRichGround(g, kind(q, r), q + seed, r + 40, q * 16, r * 16, (dx, dy) => kind(q + dx, r + dy));
  return el;
}
const grassBg = (c: CanvasRenderingContext2D, w: number, h: number, seed = 0) => c.drawImage(ground(w, h, () => 'grass', seed), 0, 0);

const base = { ...defaultLook(), made: true };
const looks: [string, any, any][] = [
  ['Ashguard', { ...base, vocation: 'ashguard', hair: 'curls', skin: 1, outfit: 3 }, 'ashguard'],
  ['Warlock', { ...base, vocation: 'warlock', hair: 'long', hairColor: 7 }, 'warlock'],
  ['Lanternwright', { ...base, vocation: 'lanternwright', hair: 'bob', hairColor: 3, form: 'fem' }, 'lanternwright'],
  ['Thornstrider', { ...base, vocation: 'thornstrider', hair: 'braid', hairColor: 1 }, 'thornstrider'],
];
if (want('keeper')) {
  const row = section('Keepers (front sheet): before | after, facing down and up, idle + walk');
  for (const vol of [false, true]) {
    setVolume(vol);
    for (const [label, look, voc] of looks) {
      const v = vocationLook(voc, null), p = new KeeperPainter(look, v.gear, v.garb), sheet = frontSheet(p, voc === 'warlock');
      card(row, (vol ? 'after ' : 'before ') + label, FRONT_W * 4, FRONT_H * 2, c => {
        grassBg(c, FRONT_W * 4, FRONT_H * 2);
        for (let r = 0; r < 2; r++) [0, 2, 3, 4].forEach((f, i) => c.drawImage(sheet, f * FRONT_W, r * FRONT_H, FRONT_W, FRONT_H, i * FRONT_W, r * FRONT_H, FRONT_W, FRONT_H));
      });
    }
    const v = vocationLook('ashguard', null), p = new KeeperPainter(looks[0][1], v.gear, v.garb);
    card(row, (vol ? 'after ' : 'before ') + 'side', 120, 48, c => {
      grassBg(c, 120, 48);
      ([['idle', 0, 0], ['run', .1, 0], ['run', .45, 0], ['attack', 0, .5]] as const).forEach(([a, t, k], i) => { c.save(); c.translate(15 + i * 30, 46); p.draw(c, 1, { action: a, time: t, attackT: k, weapon: true }); c.restore(); });
    });
  }
  setVolume(true);
}
if (want('mobs')) {
  const row = section('Creatures (4 frames each)');
  const ids = ['bone-walker', 'bone-archer', 'ash-wolf', 'cinder-imp'];
  for (const id of ids) {
    const d0: any = (MOBS as any)[id] ?? RAISED_SKELETON; if (!d0) continue;
    const sh = mobSheet(d0), d: any = mobCell(d0);
    card(row, id, d.w * 4 + 6, d.h + 4, c => { grassBg(c, d.w * 4 + 6, d.h + 4, 3); for (let f = 0; f < 4; f++) c.drawImage(sh, f * d.w, 0, d.w, d.h, f * (d.w + 2), 2, d.w, d.h); });
  }
  const sh = mobSheet(RAISED_SKELETON as any), d: any = mobCell(RAISED_SKELETON as any);
  card(row, 'raised', d.w * 4 + 6, d.h + 4, c => { grassBg(c, d.w * 4 + 6, d.h + 4, 3); for (let f = 0; f < 4; f++) c.drawImage(sh, f * d.w, 0, d.w, d.h, f * (d.w + 2), 2, d.w, d.h); });
}
if (want('trees')) {
  const row = section('Trees: before | after');
  const kinds = ['oak', 'fruit', 'pine'] as const;
  card(row, 'before', 160, 64, c => { grassBg(c, 160, 64, 7); kinds.forEach((k, i) => { const sp = (ART as any).flatTree(k, i); c.drawImage(sp.img, 20 + i * 50 - sp.ax, 60 - sp.ay); c.drawImage(sp.roof.img, 20 + i * 50 + sp.roof.x, 60 + sp.roof.y); }); });
  card(row, 'after', 320, 64, c => {
    grassBg(c, 320, 64, 7);
    for (let i = 0; i < 6; i++) { const k = kinds[i % 3], sp = ART.tree(k, i), x = 26 + i * 52, y = 60; if (sp.shadow) c.drawImage(sp.shadow.img, x + sp.shadow.x, y + sp.shadow.y); c.drawImage(sp.img, x - sp.ax, y - sp.ay); c.drawImage(sp.roof!.img, x + sp.roof!.x, y + sp.roof!.y); }
  });
}
if (want('ground')) {
  const row = section('Ground: grass, flowers and a dirt road');
  const W = 24, H = 12, g = (c: number, r: number) => (Math.abs(r - 6 - Math.round(Math.sin(c / 3) * 2)) <= 1 || (c >= 15 && c <= 16 && r < 6) ? 'dirt' : (c * 7 + r * 3) % 23 === 0 ? 'flowers' : 'grass');
  card(row, 'ground', W * 16, H * 16, c => c.drawImage(ground(W * 16, H * 16, g), 0, 0));
  for (const [lush, worn] of [['moss', 'dirt'], ['moss', 'mire'], ['grass', 'sand'], ['cave', 'cave']] as const) {
    const k = (q: number, r: number) => (Math.abs(r - 3 - Math.round(Math.sin(q / 2) * 1.5)) <= 1 ? worn : lush);
    card(row, lush + ' / ' + worn, 10 * 16, 7 * 16, c => c.drawImage(ground(10 * 16, 7 * 16, k), 0, 0));
  }
}
if (want('props')) {
  const row = section('Town: a house, a stall, a fence and the standing props (grown 1.5x)');
  const props = [ART.lamp(), ART.bench(), ART.barrel(), ART.crate(), ART.signpost(), ART.anvil(), ART.chest(), ART.bush(1), ART.boulder(1), ART.gravestone(1)];
  card(row, 'house + stall', 200, 120, c => {
    grassBg(c, 200, 120, 5);
    for (const [sp, x, y] of [[ART.house(5, 3, 'red', 'timber', true, 1), 48, 112], [ART.stall(3, 1, 'bread', 1), 150, 112], [ART.fence(4), 150, 70]] as const) {
      if (sp.shadow) c.drawImage(sp.shadow.img, x + sp.shadow.x, y + sp.shadow.y);
      c.drawImage(sp.img, x - sp.ax, y - sp.ay); if (sp.roof) c.drawImage(sp.roof.img, x + sp.roof.x, y + sp.roof.y);
    }
  });
  card(row, 'props', 360, 60, c => {
    grassBg(c, 360, 60, 6);
    props.forEach((sp, i) => { const x = 18 + i * 34, y = 56; if (sp.shadow) c.drawImage(sp.shadow.img, x + sp.shadow.x, y + sp.shadow.y); c.drawImage(sp.img, x - sp.ax, y - sp.ay); });
  });
}
if (want('aura')) {
  const row = section('Auras');
  for (const id of ['arcane', 'ember', 'life', 'brass'] as const) {
    const fx = new AuraFx(), look = AURA_LOOKS[id];
    for (let t = 0; t < 1.2; t += 1 / 30) fx.step(t, look, false);
    card(row, id, 64, 56, c => { grassBg(c, 64, 56, 9); fx.ground(c, 32, 44, look, 1.2, false); fx.air(c, 32, 44, look); });
  }
}
if (want('pets')) {
  const row = section('Pets');
  for (const id of ['ink-pup', 'shade-kit', 'moss-hedgehog', 'spirit-beast']) { const sh = petSheet(id as any); if (!sh) continue; card(row, id, sh.width, sh.height + 2, c => { grassBg(c, sh.width, sh.height + 2, 2); c.drawImage(sh, 0, 1); }); }
}
(window as any).done = true;
`);

const built = await esbuild.build({ entryPoints: [entry], bundle: true, write: false, format: 'iife', target: 'es2022', logLevel: 'warning' });
const js = built.outputFiles[0].text;
const css = `body{margin:0;padding:12px;background:#120c18;color:#e8dcc8;font:12px system-ui,sans-serif}
h2{font-size:13px;margin:10px 0 4px;color:#ffd08a}.row{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start}
figure{margin:0;background:#1d1528;border:1px solid #33263a;padding:3px}figcaption{text-align:center;padding-top:2px}canvas{display:block;image-rendering:pixelated}`;
const html = `<!doctype html><meta charset="utf-8"><style>${css}</style><body><script>${js}</script></body>`;
mkdirSync(dirname(out), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1800, height: 900 } });
page.on('pageerror', e => console.error('pageerror', e.message));
await page.setContent(html);
await page.waitForFunction(() => window.done === true, null, { timeout: 30000 });
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`wrote ${out}`);
