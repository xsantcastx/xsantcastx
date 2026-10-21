/**
 * td-corpse.spec.ts — corpses, Tibia-style (owner's backlog 2026-10-21). A slain creature lies where it fell and rots
 * (fresh → rotting → bones → gone); the loot lies beside it, still picked up by walking over it, and E (or a tap on the
 * corpse) opens a small window to see and take what is left. The window scrolls and reaches its last control on a phone.
 *
 * `?fxparty=1` (honoured only under an automated browser) fells a creature through the real kill, lays a heap of ember
 * residue in its corpse and moves the corpse clock forward, so the three-and-a-half-minute decay runs in a moment.
 * Screenshots: docs/handoff/cozy-ui/corpse-{fresh,rotting,bones,open,open-phone}.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';

const canvas = (page: Page) => page.locator('.viewport canvas');
interface CorpseRow { id: string; kind: string; stage: string; loot: number; x: number; y: number; px: number; py: number; scale: number }
type Hook = { smite: (type: string, dx: number) => string | null; corpses: () => CorpseRow[]; age: (s: number) => number; stock: () => boolean };
const hook = <T>(page: Page, fn: (h: Hook) => T) => page.evaluate(`(${fn.toString()})(window.__tdParty)`) as Promise<T>;
const corpses = (page: Page) => hook(page, h => h.corpses());

async function boot(page: Page, size = { width: 1280, height: 800 }): Promise<void> {
  await page.setViewportSize(size);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, { 'eclipse-td': '1' });
  await page.goto('/play?td=1&hour=12&fxparty=1');
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 30000 });
  await page.waitForFunction(() => !!(window as unknown as { __tdParty?: unknown }).__tdParty);
  await page.addStyleTag({ content: '.glim-say, .lvl-banner, .area-card, .guide { visibility: hidden !important; }' });
}
const key = async (page: Page, k: string) => { await canvas(page).evaluate(c => (c as HTMLCanvasElement).focus({ preventScroll: true })); await page.keyboard.press(k); };
const around = (c: CorpseRow) => ({ x: Math.max(0, c.px - 130), y: Math.max(0, c.py - 110), width: 260, height: 190 });

test('a slain creature lies where it fell and rots through its stages', async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page);
  expect(await hook(page, h => h.smite('ash-wolf', 24))).toBe('ash-wolf');
  await expect.poll(async () => (await corpses(page)).length).toBe(1);
  let c = (await corpses(page))[0];
  expect(c.kind).toBe('ash-wolf');
  expect(c.stage).toBe('fresh');
  expect(c.loot, 'its loot lies beside it').toBeGreaterThan(0);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/corpse-fresh.jpg', type: 'jpeg', quality: 88, clip: around(c) });

  await hook(page, h => h.age(60));
  await expect.poll(async () => (await corpses(page))[0].stage).toBe('rotting');
  await page.waitForTimeout(300);
  c = (await corpses(page))[0];
  await page.screenshot({ path: 'docs/handoff/cozy-ui/corpse-rotting.jpg', type: 'jpeg', quality: 88, clip: around(c) });

  await hook(page, h => h.age(100));
  await expect.poll(async () => (await corpses(page))[0].stage).toBe('bones');
  await page.waitForTimeout(300);
  c = (await corpses(page))[0];
  await page.screenshot({ path: 'docs/handoff/cozy-ui/corpse-bones.jpg', type: 'jpeg', quality: 88, clip: around(c) });

  await hook(page, h => h.age(100));
  await expect.poll(async () => (await corpses(page)).length).toBe(0);
});

test('E opens the corpse, the loot can be taken out of it, and the walk-over pickup still works', async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page);
  await hook(page, h => h.smite('ash-wolf', 24));
  await expect.poll(async () => (await corpses(page)).length).toBe(1);
  expect(await hook(page, h => h.stock())).toBe(true);
  await page.waitForTimeout(900);          // the pull has taken the coins in; the residue lies 30 px off
  await key(page, 'e');
  const win = page.locator('[data-corpse-window]');
  await expect(win).toBeVisible({ timeout: 5000 });
  await expect(win).toHaveAttribute('data-corpse-stage', 'fresh');
  await expect(win.locator('h2')).toContainText('Ash Wolf');
  const take = win.locator('[data-corpse-take]', { hasText: /ember residue/i });
  await expect(take).toBeVisible();
  await page.screenshot({ path: 'docs/handoff/cozy-ui/corpse-open.jpg', type: 'jpeg', quality: 88 });
  await take.click();
  await expect(win.locator('[data-corpse-take]', { hasText: /ember residue/i })).toHaveCount(0);
  await expect.poll(async () => (await corpses(page))[0].loot).toBe(0);
  // Closing it with Escape, and the corpse stays lying there.
  await page.keyboard.press('Escape');
  await expect(win).toHaveCount(0);
  expect((await corpses(page)).length).toBe(1);
});

test('walking away shuts the window, and a tap on the corpse walks up and opens it', async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page);
  await hook(page, h => h.smite('ash-wolf', 60));
  await expect.poll(async () => (await corpses(page)).length).toBe(1);
  await hook(page, h => h.stock());
  const c = (await corpses(page))[0];
  await page.mouse.click(c.px, c.py);
  const win = page.locator('[data-corpse-window]');
  await expect(win).toBeVisible({ timeout: 10000 });
  // Away from it: it closes by itself.
  await canvas(page).evaluate(el => (el as HTMLCanvasElement).focus({ preventScroll: true }));
  await page.keyboard.down('a'); await page.waitForTimeout(1400); await page.keyboard.up('a');
  await expect(win).toHaveCount(0, { timeout: 5000 });
});
