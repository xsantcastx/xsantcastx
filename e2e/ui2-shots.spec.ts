/**
 * ui2-shots.spec.ts — the UI clean pass camera (docs/handoff/ui2.md): the HUD and the main menus at every size the
 * owner plays on, in English and Spanish. A camera, not a test: skipped unless UI2_SHOTS names a prefix.
 *
 *   UI2_SHOTS=before|after PW_PORT=4711 npx playwright test --project=chromium --reporter=line e2e/ui2-shots
 *   UI2_ONLY=hud,keys UI2_SIZES=1280x800 …   (narrow the run)
 *
 * Writes docs/handoff/ui2/<prefix>/<scene>-<size>-<lang>.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { ERA, ledger, purse, seed, openMenu } from './play-helpers';
import { activity, xpForLevel } from './play-delve-fixtures';

const PREFIX = process.env['UI2_SHOTS'] ?? '';
const ONLY = (process.env['UI2_ONLY'] ?? '').split(',').filter(Boolean);
const ONLY_SIZES = (process.env['UI2_SIZES'] ?? '').split(',').filter(Boolean);
const LANGS = (process.env['UI2_LANGS'] ?? 'en,es').split(',').filter(Boolean);
const OUT = `docs/handoff/ui2/${PREFIX}`;

const SIZES = [
  { tag: '1280x800', width: 1280, height: 800, phone: false },
  { tag: '1920x1080', width: 1920, height: 1080, phone: false },
  { tag: '1366x768', width: 1366, height: 768, phone: false },
  { tag: '390x844', width: 390, height: 844, phone: true },
  { tag: '360x640', width: 360, height: 640, phone: true },
  { tag: '844x390', width: 844, height: 390, phone: true },
].filter(s => !ONLY_SIZES.length || ONLY_SIZES.includes(s.tag));

const canvas = (page: Page) => page.locator('canvas').first();

async function enterWorld(page: Page, lang: string, query = ''): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const base = ledger({ 'cinder-ore': 24, 'minor-health-potion': 5, 'minor-mana-potion': 3 }) as Record<string, unknown>;
  await seed(page, {
    // Classic graphics: the Isometric Beta (the default) layers extra canvases; the before set was Classic.
    'eclipse-td': '1', 'eclipse-td-graphics': 'classic', 'preferred-language': lang, 'godforge-realm-era': String(ERA), 'godforge-inventory': base,
    ...purse(124_350), ...activity({ hunting: xpForLevel(24) + 4321 }),
    'godforge-keeper-look': {
      version: 1, made: true, prompted: true, name: 'Tomasina', vocation: 'warlock', skin: 2, hair: 'cropped', updatedAt: 1,
      tree: { spent: {}, free: ['bone-spear', 'raise-skeleton', 'aura-siphon'], at: 1 },
    },
  });
  await page.goto(`/play?td=1&hour=12${query}`);
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await page.waitForTimeout(3500);
}

async function shot(page: Page, scene: string, size: string, lang: string): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/${scene}-${size}-${lang}.jpg`, type: 'jpeg', quality: 78 });
}

const SCENES: { id: string; query?: string; run: (page: Page, phone: boolean) => Promise<void> }[] = [
  { id: 'hud', run: async () => {} },
  { id: 'xp', run: async (page, phone) => {
    const bar = page.locator('[data-xp-bar]').first();
    if (await bar.count()) { if (phone) await bar.tap(); else await bar.hover(); }
    await page.waitForTimeout(250);
  } },
  { id: 'menu', run: async page => { await openMenu(page); } },
  { id: 'keys', run: async page => {
    await canvas(page).focus();
    await page.keyboard.press('k');
    await expect(page.locator('.sbook .book')).toBeVisible({ timeout: 10000 });
    await page.locator('[data-book-tab="keys"]').click();
    await page.waitForTimeout(300);
  } },
  { id: 'sheet', run: async page => {
    await canvas(page).focus();
    await page.keyboard.press('c');
    await page.waitForTimeout(600);
  } },
  { id: 'settings', run: async page => {
    await openMenu(page);
    await page.locator('#game-menu [data-open="sound"]').click();
    await expect(page.locator('[data-graphics-setting]').first()).toBeVisible();
    await page.locator('[data-graphics-setting]').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
  } },
  { id: 'satchel', run: async page => {
    await canvas(page).focus();
    await page.keyboard.press('i');
    await expect(page.locator('[data-satchel-sort]')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);
  } },
  { id: 'vault', query: '&at=vault', run: async page => {
    await expect(page.locator('[data-vault-actions]')).toBeVisible({ timeout: 10000 });
    await page.locator('[data-vault-actions]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
  } },
];

for (const size of SIZES) {
  for (const lang of LANGS) {
    test.describe(`ui2 ${size.tag} ${lang}`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, hasTouch: size.phone, isMobile: size.phone });
      for (const scene of SCENES) {
        if (ONLY.length && !ONLY.includes(scene.id)) continue;
        test(scene.id, async ({ page }) => {
          test.skip(!PREFIX, 'set UI2_SHOTS to take the screenshots');
          test.setTimeout(90000);
          await enterWorld(page, lang, scene.query ?? '');
          try { await scene.run(page, size.phone); } catch { /* shoot what is there */ }
          await shot(page, scene.id, size.tag, lang);
        });
      }
    });
  }
}
