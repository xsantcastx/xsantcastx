/**
 * td-monster-shots.spec.ts — every top-down creature side by side, as the world draws it (td-mobs.ts mobSheet: four
 * frames, the selective outline, a boss's rim), with the Warlock's raised skeleton at the end: docs/handoff/cozy-ui/
 * monster-lineup.jpg; and the oldest six up close with every frame of their walk: monster-lineup-x2.jpg.
 *
 * The page is blank: td-mobs.ts (and the two modules it needs) are transpiled here and served as ES modules, so the
 * picture is the real paint code, not a copy of it.
 */
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const HOST = 'http://lineup.test';
const FILES: Readonly<Record<string, string>> = { 'td-mobs': 'td-mobs.ts', 'td-art': 'td-art.ts', 'td-skills': 'td-skills.ts', 'potions.model': '../../shared/potions/potions.model.ts' };

test('the monster lineup: every creature of the top-down world, and the raised skeleton', async ({ page }) => {
  await page.route(`${HOST}/**`, route => {
    const name = new URL(route.request().url()).pathname.replace(/^\//, '').replace(/\.js$/, '');
    if (name === '' || name === 'index.html') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><body style="margin:0;background:#1a1014"><canvas id="c"></canvas></body>' });
    const file = FILES[name];
    if (!file) return route.fulfill({ status: 404, body: '' });
    const src = readFileSync(`src/app/play/td/${file}`, 'utf8');
    const out = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
      .replace(/from '\.\/(td-[a-z-]+)'/g, "from './$1.js'")
      // The potion roll the kill code imports (shared/potions): served beside the td modules.
      .replace(/from '\.\.\/\.\.\/shared\/potions\/potions\.model'/g, "from './potions.model.js'");
    return route.fulfill({ contentType: 'text/javascript', body: out });
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${HOST}/index.html`);
  // k: the zoom; ids: only these (all when empty); frames: how many of each sheet's frames side by side.
  const draw = (k: number, ids: string[], frames: number) => page.evaluate(async ({ k, ids, frames }) => {
    const mod = await import('./td-mobs.js' as string);
    const all = [...Object.values(mod.MOBS as Record<string, { id: string; name: string; w: number; h: number }>), mod.RAISED_SKELETON];
    const defs = ids.length ? all.filter(d => ids.includes(d.id)) : all;
    const gap = 14, cv = document.getElementById('c') as HTMLCanvasElement;
    cv.width = 1280; cv.height = 720;
    const c = cv.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#2a1e26'; c.fillRect(0, 0, cv.width, cv.height);
    let x = 16, y = 16, rowH = 0;
    c.font = 'bold 12px monospace'; c.textAlign = 'center';
    for (const d of defs) {
      const sheet = mod.mobSheet(d) as HTMLCanvasElement, n = Math.min(frames, sheet.width / d.w), w = d.w * k, h = d.h * k, span = n * w + (n - 1) * 4;
      if (x + span > cv.width - 16) { x = 16; y += rowH + 30; rowH = 0; }
      for (let f = 0; f < n; f++) {
        const fx = x + f * (w + 4);
        c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(fx + 6, y + h - 4, w - 12, 6);
        c.drawImage(sheet, f * d.w, 0, d.w, d.h, fx, y, w, h);
      }
      c.fillStyle = '#f3e7cf'; c.fillText(d.name, x + span / 2, y + h + 16);
      x += Math.max(span, 110) + gap; rowH = Math.max(rowH, h);
    }
    return defs.length;
  }, { k, ids, frames });
  expect(await draw(2, [], 1)).toBeGreaterThan(15);
  await page.locator('#c').screenshot({ path: 'docs/handoff/cozy-ui/monster-lineup.jpg', type: 'jpeg', quality: 90 });
  // The ×2 crop: the oldest creatures up close, every frame of their walk.
  expect(await draw(4, ['ash-wolf', 'cinder-imp', 'rivet-maw', 'cinder-bailiff', 'lava-hound', 'obsidian-golem'], 4)).toBe(6);
  await page.locator('#c').screenshot({ path: 'docs/handoff/cozy-ui/monster-lineup-x2.jpg', type: 'jpeg', quality: 90 });
});
