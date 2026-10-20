/**
 * td-monster-shots.spec.ts — every top-down creature side by side, as the world draws it (td-mobs.ts mobSheet: two
 * frames, the dark outline), with the Warlock's raised skeleton at the end: docs/handoff/cozy-ui/monster-lineup.jpg.
 *
 * The page is blank: td-mobs.ts (and the two modules it needs) are transpiled here and served as ES modules, so the
 * picture is the real paint code, not a copy of it.
 */
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const HOST = 'http://lineup.test';
const FILES: Readonly<Record<string, string>> = { 'td-mobs': 'td-mobs.ts', 'td-art': 'td-art.ts', 'td-skills': 'td-skills.ts' };

test('the monster lineup: every creature of the top-down world, and the raised skeleton', async ({ page }) => {
  await page.route(`${HOST}/**`, route => {
    const name = new URL(route.request().url()).pathname.replace(/^\//, '').replace(/\.js$/, '');
    if (name === '' || name === 'index.html') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><body style="margin:0;background:#1a1014"><canvas id="c"></canvas></body>' });
    const file = FILES[name];
    if (!file) return route.fulfill({ status: 404, body: '' });
    const src = readFileSync(`src/app/play/td/${file}`, 'utf8');
    const out = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
      .replace(/from '\.\/(td-[a-z-]+)'/g, "from './$1.js'");
    return route.fulfill({ contentType: 'text/javascript', body: out });
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${HOST}/index.html`);
  const drawn = await page.evaluate(async () => {
    const mod = await import('./td-mobs.js' as string);
    const defs = [...Object.values(mod.MOBS as Record<string, { id: string; name: string; w: number; h: number }>), mod.RAISED_SKELETON];
    const k = 3, gap = 18, cv = document.getElementById('c') as HTMLCanvasElement;
    cv.width = 1280; cv.height = 720;
    const c = cv.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#2a1e26'; c.fillRect(0, 0, cv.width, cv.height);
    let x = 16, y = 24, rowH = 0;
    c.font = 'bold 12px monospace'; c.textAlign = 'center';
    for (const d of defs) {
      const w = d.w * k, h = d.h * k;
      if (x + w > cv.width - 16) { x = 16; y += rowH + 40; rowH = 0; }
      c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x + 6, y + h - 4, w - 12, 6);
      c.drawImage(mod.mobSheet(d), 0, 0, d.w, d.h, x, y, w, h);
      c.fillStyle = '#f3e7cf'; c.fillText(d.name, x + w / 2, y + h + 18);
      x += Math.max(w, 120) + gap; rowH = Math.max(rowH, h);
    }
    return defs.length;
  });
  expect(drawn).toBeGreaterThan(15);
  await page.locator('#c').screenshot({ path: 'docs/handoff/cozy-ui/monster-lineup.jpg', type: 'jpeg', quality: 90 });
});
