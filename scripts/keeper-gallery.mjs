#!/usr/bin/env node
/**
 * keeper-gallery.mjs — the people and creature galleries for art passes.
 *
 *   node scripts/keeper-gallery.mjs <out-dir> <prefix>
 *
 * Bundles the pixel painters (shared/keeper-look/keeper-paint.ts, npc-looks.ts,
 * play/engine/creature-pixel.ts) with esbuild, paints every named person, a row
 * of player Keepers (looks + gear) and every creature's frames into a page, and
 * screenshots it with Playwright into <out-dir>/<prefix>-gallery-people.png and
 * <prefix>-gallery-creatures.png. No server and no app build needed: it is a
 * camera for the painters, nothing is asserted.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from '@playwright/test';

const [outDir = 'output/gallery', prefix = 'now'] = process.argv.slice(2);
const root = resolve(import.meta.dirname, '..');
const require = createRequire(join(root, 'package.json'));
let esbuild;
try { esbuild = require('esbuild'); } catch { esbuild = createRequire(require.resolve('vite/package.json'))('esbuild'); }

const entry = join(tmpdir(), `keeper-gallery-${process.pid}.ts`);
writeFileSync(entry, `
import { KeeperPainter } from ${JSON.stringify(join(root, 'src/app/shared/keeper-look/keeper-paint'))};
import { NPC_LOOKS } from ${JSON.stringify(join(root, 'src/app/shared/keeper-look/npc-looks'))};
import { defaultLook } from ${JSON.stringify(join(root, 'src/app/shared/keeper-look/keeper-look.model'))};
import { gearPiece } from ${JSON.stringify(join(root, 'src/app/shared/keeper-look/keeper-gear'))};
import { CREATURE_ART, CREATURE_FRAMES, CreaturePainter } from ${JSON.stringify(join(root, 'src/app/play/engine/creature-pixel'))};

const S = 4, W = 52 * S, H = 56 * S;
function card(parent: HTMLElement, label: string, paint: (c: CanvasRenderingContext2D) => void, w = W, h = H): void {
  const box = document.createElement('figure');
  const el = document.createElement('canvas'); el.width = w; el.height = h;
  const c = el.getContext('2d')!; c.imageSmoothingEnabled = false;
  paint(c);
  const cap = document.createElement('figcaption'); cap.textContent = label;
  box.append(el, cap); parent.append(box);
}
function keeper(parent: HTMLElement, label: string, p: KeeperPainter, action: any = 'idle', t = 0, attackT = 0): void {
  card(parent, label, c => {
    c.fillStyle = '#2a2236'; c.fillRect(0, H - 3 * S, W, 3 * S);
    c.save(); c.translate(W / 2, H - 3 * S); p.draw(c, S, { action, time: t, attackT, weapon: true }); c.restore();
  });
}
const people = document.getElementById('people')!;
const base = { ...defaultLook(), made: true };
const players: [string, any, any][] = [
  ['Keeper (default)', base, null],
  ['Keeper, sword + plate', { ...base, hair: 'swept', hairColor: 4 }, { weapon: gearPiece('weapon', 'Ember Sword', 'infernal', 'rare'), chest: gearPiece('chest', 'Cinder Plate', 'infernal', 'rare') }],
  ['Keeper, maul + helm', { ...base, body: 'broad', hair: 'cropped', face: 'beard' }, { weapon: gearPiece('weapon', 'Starfall Maul', 'celestial', 'legendary'), head: gearPiece('head', 'Cometfall Helm', 'celestial', 'epic'), feet: gearPiece('feet', 'Boots', 'neutral', 'common') }],
  ['Keeper, staff + mantle', { ...base, body: 'slight', hair: 'long', hairColor: 7, eyes: 'bright', eyeColor: 4 }, { weapon: gearPiece('weapon', 'Nullthorn Staff', 'umbral', 'epic'), chest: gearPiece('chest', 'Aureth Mantle', 'luminous', 'legendary'), head: gearPiece('head', 'Lantern Oath', 'luminous', 'rare') }],
  ['Keeper, bow + hood', { ...base, hair: 'braid', hairColor: 1, face: 'freckles' }, { weapon: gearPiece('weapon', 'Meridian Longbow', 'verdant', 'rare'), head: gearPiece('head', 'Voidweave Cowl', 'void', 'epic'), 'off-hand': gearPiece('off-hand', 'Rootwall Shield', 'verdant', 'uncommon') }],
  ['Keeper, spear + crown', { ...base, hair: 'topknot', hairColor: 9, skin: 7 }, { weapon: gearPiece('weapon', 'Dawn Spear', 'luminous', 'mythic'), head: gearPiece('head', 'Crown of the First Dawn', 'luminous', 'mythic'), chest: gearPiece('chest', 'Cinderhide Coat', 'infernal', 'uncommon') }],
];
for (const [label, look, gear] of players) keeper(people, label, new KeeperPainter(look, gear));
for (const [id, npc] of Object.entries(NPC_LOOKS)) keeper(people, id, new KeeperPainter(npc.look, npc.gear, npc.garb), 'talk', .4);
const actions = document.getElementById('actions')!;
const hero = new KeeperPainter(players[1][1], players[1][2]);
for (const [a, t, k] of [['idle', 0, 0], ['idle', 1.3, 0], ['run', .1, 0], ['run', .45, 0], ['walk', 2, 0], ['jump', 0, 0], ['fall', 0, 0], ['attack', 0, .2], ['attack', 0, .7], ['hurt', 0, 0], ['dodge', 0, 0], ['rest', 0, 0], ['death', 0, 0]] as const) {
  keeper(actions, a + (k ? ' ' + k : ''), hero, a, t, k);
}
const creatures = document.getElementById('creatures')!;
for (const [key, art] of Object.entries(CREATURE_ART)) {
  const p = new CreaturePainter(art);
  for (const f of CREATURE_FRAMES) {
    const w = (art.w + 6) * 3, h = (art.h + 6) * 3;
    card(creatures, key + ' ' + f, c => {
      c.fillStyle = '#2a2236'; c.fillRect(0, h - 6, w, 6);
      c.save(); c.translate(w / 2, h - 6); p.draw(c, 3, f, false); c.restore();
    }, w, h);
  }
}
(window as any).done = true;
`);

const built = await esbuild.build({ entryPoints: [entry], bundle: true, write: false, format: 'iife', target: 'es2022', logLevel: 'silent' });
const js = built.outputFiles[0].text;
const css = `body{margin:0;padding:16px;background:#120c18;color:#e8dcc8;font:12px system-ui,sans-serif}
h2{font-size:14px;margin:12px 0 6px;color:#ffd08a}.row{display:flex;flex-wrap:wrap;gap:8px}
figure{margin:0;background:#1d1528;border:1px solid #33263a;padding:4px}figcaption{text-align:center;padding-top:2px}canvas{display:block;image-rendering:pixelated}`;
const html = `<!doctype html><meta charset="utf-8"><style>${css}</style>
<h2>Player Keepers</h2><div class="row" id="people"></div><h2>One Keeper, every action</h2><div class="row" id="actions"></div>
<h2>Creatures</h2><div class="row" id="creatures"></div><script>${js}</script>`;

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
await page.setContent(html);
await page.waitForFunction(() => window.done === true);
const peopleBox = await page.evaluate(() => { const a = document.querySelector('h2').getBoundingClientRect(); const b = document.getElementById('actions').getBoundingClientRect(); return { x: 0, y: a.top + scrollY - 8, width: 1500, height: b.bottom - a.top + 16 }; });
await page.screenshot({ path: join(outDir, `${prefix}-gallery-people.png`), clip: peopleBox, fullPage: true });
const creatureBox = await page.evaluate(() => { const h = document.querySelectorAll('h2')[2].getBoundingClientRect(); const b = document.getElementById('creatures').getBoundingClientRect(); return { x: 0, y: h.top + scrollY - 8, width: 1500, height: b.bottom - h.top + 16 }; });
await page.screenshot({ path: join(outDir, `${prefix}-gallery-creatures.png`), clip: creatureBox, fullPage: true });
await browser.close();
console.log(`wrote ${outDir}/${prefix}-gallery-people.png and ${prefix}-gallery-creatures.png`);
