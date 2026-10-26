/**
 * td-mobs-shots.spec.ts — S6's pictures (docs/handoff/mobs.md): a pack with its aura (the bearer's sigil disc, the
 * mote lines, the reach ring), the Ashsinger singing the dead up, a meteor's tell, the raised roaming round a Keeper
 * who stands still, and ground items by rarity. The scenes are the engine's screenshot hooks (`?fxs6=…`, `?fxloot=1`,
 * honoured only under an automated browser). Run with MOBS_SHOTS=1; the shots land in docs/handoff/mobs/.
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';

test.skip(!process.env['MOBS_SHOTS'], 'screenshots only (MOBS_SHOTS=1)');

const canvas = (page: Page) => page.locator('canvas').first();
const OUT = 'docs/handoff/mobs';

async function open(page: Page, query: string, w = 1280, h = 800): Promise<void> {
  await page.setViewportSize({ width: w, height: h });
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, { 'eclipse-td': '1' });
  await page.goto(`/play?td=1&hour=12&${query}`);
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await page.addStyleTag({ content: '.guide, .glim-say { visibility: hidden !important; }' });
}
async function centre(page: Page, w: number, h: number, dy = 0): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = (await canvas(page).boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2 + dy;
  const x = Math.max(box.x, Math.round(cx - w / 2)), y = Math.max(box.y, Math.round(cy - h / 2));
  return { x, y, width: Math.min(w, Math.round(box.x + box.width - x)), height: Math.min(h, Math.round(box.y + box.height - y)) };
}

test('S6: a pack with its aura', async ({ page }) => {
  test.setTimeout(90000);
  await open(page, 'fxs6=aura');
  await expect(canvas(page)).toHaveAttribute('data-pack-auras', /might/, { timeout: 15000 });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${OUT}/aura-pack.jpg`, type: 'jpeg', quality: 88, clip: await centre(page, 1000, 560, -60) });
});

test('S6: the Ashsinger sings the dead up', async ({ page }) => {
  test.setTimeout(90000);
  await open(page, 'fxs6=raise');
  await page.waitForTimeout(5000);
  await expect(canvas(page)).toHaveAttribute('data-ability-tell', /sing-them-up/, { timeout: 15000 });
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUT}/raise.jpg`, type: 'jpeg', quality: 88, clip: await centre(page, 760, 460, -60) });
});

test('S6: a meteor\'s tell', async ({ page }) => {
  test.setTimeout(90000);
  await open(page, 'fxs6=meteor');
  await page.waitForTimeout(5000);
  await expect(canvas(page)).toHaveAttribute('data-ability-tell', /meteor/, { timeout: 15000 });
  await page.waitForTimeout(650);
  await page.screenshot({ path: `${OUT}/meteor-tell.jpg`, type: 'jpeg', quality: 88, clip: await centre(page, 900, 460, -40) });
});

test('S6: the raised roam round a Keeper who stands still', async ({ page }) => {
  test.setTimeout(90000);
  await open(page, 'fxs6=pets');
  await page.waitForTimeout(9000);
  await page.screenshot({ path: `${OUT}/roaming.jpg`, type: 'jpeg', quality: 88, clip: await centre(page, 1000, 640) });
});

test('S6: ground items by rarity', async ({ page }) => {
  test.setTimeout(90000);
  await open(page, 'fxs6=loot&fxloot=1');
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${OUT}/ground-items.jpg`, type: 'jpeg', quality: 88, clip: await centre(page, 760, 420, 80) });
});
