/**
 * td-hd-mobs-shots.spec.ts — isometric B's HD creatures (td-hd-creatures.ts): the contact sheet (every converted
 * creature × six facings × its clips) and the creatures standing in the world round the Keeper, in iso. A camera, not a
 * test; skipped unless HD_SHOTS is set:
 *
 *   HD_SHOTS=1 [HD_IDS=bone-walker,ash-wolf] PW_PORT=4710 npx playwright test e2e/td-hd-mobs-shots --project=chromium
 *
 * Output: output/hd-mobs/gallery.png and output/hd-mobs/world-<size>.png (not committed).
 */
import { expect, test, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import { seed } from './play-helpers';

test.skip(!process.env['HD_SHOTS'], 'screenshots only (HD_SHOTS=1)');
const DIR = 'output/hd-mobs';
const IDS = process.env['HD_IDS'] ? process.env['HD_IDS'].split(',') : undefined;

async function open(page: Page, extra = ''): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, {
    'eclipse-td': '1',
    'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Brann', vocation: 'ashguard', skin: 1, hair: 'curls', hairColor: 0, outfit: 3, updatedAt: 1 },
  });
  await page.goto(`/play?td=1&hour=12&artopt=iso${extra}`);
  await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await page.waitForFunction(() => !!(window as unknown as { __tdArt?: unknown }).__tdArt);
  await page.waitForTimeout(1500);
  const skip = page.locator('[data-prologue-skip]').first();
  if (await skip.isVisible().catch(() => false)) await skip.click().catch(() => undefined);
}

test('HD creatures: the contact sheet', async ({ page }) => {
  test.setTimeout(240000);
  fs.mkdirSync(DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  // Every creature, six at a sheet: idle, the strike and the fallen (two frames each), six facings each.
  const all = IDS ?? await page.evaluate(() => (window as unknown as { __tdArt: { hdIds: () => string[] } }).__tdArt.hdIds());
  for (let i = 0; i < all.length; i += 6) {
    const url = await page.evaluate(ids => (window as unknown as { __tdArt: { hdGallery: (i?: string[], a?: string[], k?: number, f?: number[]) => string } }).__tdArt.hdGallery(ids, ['idle', 'attack', 'death'], 1, [1, 3]), all.slice(i, i + 6));
    fs.writeFileSync(`${DIR}/gallery-${i / 6 + 1}.png`, Buffer.from(url.split(',')[1], 'base64'));
  }
});

for (const size of [{ name: 'desktop', w: 1280, h: 800 }, { name: 'phone', w: 390, h: 844 }]) {
  test(`HD creatures: in the world (${size.name})`, async ({ page }) => {
    test.setTimeout(120000);
    fs.mkdirSync(DIR, { recursive: true });
    await page.setViewportSize({ width: size.w, height: size.h });
    await open(page);
    const ids = IDS ?? [];
    await page.evaluate(list => {
      const w = window as unknown as { __tdZones: { to: (c: number, r: number) => boolean; foe: (t: string, l: number, dx: number, dy: number) => unknown } };
      w.__tdZones.to(58, 62);
      const kinds = list.length ? list : ['bone-walker', 'ash-wolf', 'rivet-maw', 'cinder-imp', 'cinder-bailiff', 'cinder-orc', 'orc-firecaller', 'lava-hound', 'thorn-weaver', 'gloam-witch', 'ember-drake', 'sporecap'];
      kinds.forEach((k, i) => { const a = i / kinds.length * Math.PI * 2; w.__tdZones.foe(k, 3, Math.cos(a) * 52, Math.sin(a) * 40); });
    }, ids);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${DIR}/world-${size.name}.png` });
    const st = await page.evaluate(() => (window as unknown as { __tdArt: { hdStats: () => unknown } }).__tdArt.hdStats());
    console.log('hd stats', JSON.stringify(st));
  });
}

test('HD creatures: an elite pack (tints, affix tells, the pack aura)', async ({ page }) => {
  test.setTimeout(120000);
  fs.mkdirSync(DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, '&fxs6=aura');
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${DIR}/elites-desktop.png` });
});

test('HD pets and Glim: each pet at the Keeper\'s side', async ({ page }) => {
  test.setTimeout(240000);
  fs.mkdirSync(DIR, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  const url = await page.evaluate(() => (window as unknown as { __tdArt: { hdGallery: (i?: string[], a?: string[]) => string } }).__tdArt.hdGallery(
    ['ink-pup', 'shade-kit', 'rivet-hatchling', 'moss-hedgehog', 'ember-newt', 'star-owlet', 'prism-mothkit', 'sunling', 'spirit-beast'].map(id => `pet:${id}`), ['walk', 'idle']));
  fs.writeFileSync(`${DIR}/pets-gallery.png`, Buffer.from(url.split(',')[1], 'base64'));
  for (const id of ['ink-pup', 'star-owlet', 'sunling']) {
    await page.evaluate(i => (window as unknown as { __tdArt: { pet: (i: string) => boolean } }).__tdArt.pet(i), id);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${DIR}/pet-${id}.png`, clip: { x: 440, y: 220, width: 400, height: 300 } });
  }
});
