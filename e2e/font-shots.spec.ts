/**
 * font-shots.spec.ts — the pixel face's three small-size bugs, photographed and asserted
 * (docs/handoff/cozy-ui/font-*.jpg).
 *
 * Pixelify Sans draws 2 and 5 like 8 ("Lv 24" read "Lv 84"), a capital C like O ("Common" read "Oommon"), and its
 * baked "fi" ligature as a capital A ("Hellfire" read "HellAre"). The fix is global (styles/tokens/fonts.css and
 * styles.css): digits and C come from Inter through `unicode-range`, ligatures are off everywhere.
 *
 *   FONT_SHOTS=before|after PW_PORT=4693 npx playwright test --project=chromium e2e/font-shots   # a camera
 *   FONT_SHOTS=compose      PW_PORT=4693 npx playwright test --project=chromium e2e/font-shots   # before | after sheets
 *
 * Without FONT_SHOTS only the assertions run (computed ligatures, the digit/C faces, and that a canvas "fi" shapes
 * as two glyphs); they need the fix, so they are what "before" lacks.
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { ERA, ledger, seed } from './play-helpers';
import { emptyActivityLedger } from '../src/app/shared/activity/activity.model';
import { keeperXpForLevel } from '../src/app/shared/skills/keeper-level';
import { activity, xpForLevel } from './play-delve-fixtures';

const MODE = process.env['FONT_SHOTS'] ?? '';
const RAW = process.env['FONT_RAW'] ?? '/tmp/er-font-shots';
const OUT = 'docs/handoff/cozy-ui';
const SIZES = [{ tag: 'desktop', width: 1280, height: 800, phone: false }, { tag: 'phone', width: 390, height: 844, phone: true }];
const canvas = (page: Page) => page.locator('canvas').first();

async function shoot(page: Page, name: string, size: string, clip?: { x: number; y: number; width: number; height: number }): Promise<void> {
  if (!MODE || MODE === 'compose') return;
  mkdirSync(`${RAW}/${MODE}`, { recursive: true });
  await page.screenshot({ path: `${RAW}/${MODE}/${name}-${size}.png`, type: 'png', clip });
}

function gear(id: string, definitionId: string, name: string, rarity: string, stats: Record<string, number>, i: number, extra: Record<string, unknown> = {}): unknown {
  return {
    id, definitionId, kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity, soulbound: false,
    acquiredAt: '2026-10-01T00:00:00.000Z', revision: { hlc: 100 + i, deviceId: 'e2e', sequence: 1 }, source: 'inventory',
    name, type: 'artifact', stats, sellValue: 1200 * (i + 1), econ: 3, location: { kind: 'bag' }, ...extra,
  };
}
const ITEMS = [
  gear('i-epic', 'cindergnaw', 'Cindergnaw', 'epic', { spellDamage: 14.1, critChance: 3.6, mana: 22, castSpeed: 8 }, 1, { itemLevel: 25 }),
  gear('i-common', 'voidweave-cowl', 'Voidweave Cowl', 'common', { defense: 6 }, 3, { itemLevel: 5 }),
];

async function enterWorld(page: Page, query = '', blobs: Record<string, unknown> = {}): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, {
    'eclipse-td': '1', 'preferred-language': 'en', 'godforge-realm-era': String(ERA), ...activity({ hunting: xpForLevel(24) }),
    'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Tomas', vocation: 'warlock', skin: 2, hair: 'cropped', updatedAt: 1 },
    ...blobs,
  });
  await page.goto(`/play?td=1&hour=12${query}`);
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await page.waitForTimeout(3500);   // the place's title card fades
}

async function openMapItem(page: Page, size: (typeof SIZES)[number], key: string): Promise<void> {
  if (size.phone) await page.locator('.td-dock button').last().click();
  else { await canvas(page).focus(); await page.keyboard.press('m'); }
  await page.locator(`.td-map__menu [data-open="${key}"]`).click();
  await page.waitForTimeout(500);
}

for (const size of SIZES) {
  test.describe(`${size.tag}`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, hasTouch: size.phone, isMobile: size.phone });

    test('the HUD: level badge, gold', async ({ page }) => {
      test.setTimeout(90000);
      await enterWorld(page);
      await shoot(page, 'hud', size.tag);
      if (MODE) return;
      const lv = page.locator(size.phone ? '.td-dock' : '.hero-lv').first();
      await expect(lv).toBeVisible();
      expect(await lv.evaluate(e => getComputedStyle(e).fontVariantLigatures)).toBe('none');
    });

    test('the Spellbook: ranks, levels, Hellfire', async ({ page }) => {
      test.setTimeout(90000);
      await enterWorld(page);
      await canvas(page).focus();
      if (size.phone) { await page.keyboard.press('k'); } else await page.keyboard.press('k');
      await expect(page.locator('.sbt')).toBeVisible();
      await page.locator('.sbt__node').nth(1).click();
      await page.mouse.move(2, 2);
      await page.waitForTimeout(300);
      await shoot(page, 'spellbook', size.tag);
      if (MODE) return;
      const tab = page.locator('.sbt__tab').first();
      expect(await tab.evaluate(e => getComputedStyle(e).fontVariantLigatures)).toBe('none');
    });

    test('an item card: rarity, levels, prices', async ({ page }) => {
      test.setTimeout(90000);
      const base = ledger({ 'cinder-ore': 24 }) as { records: unknown[]; hlc: number };
      await enterWorld(page, '', { 'godforge-inventory': { ...base, records: [...base.records, ...ITEMS], hlc: base.hlc + 200 } });
      await canvas(page).focus();
      await page.keyboard.press('i');
      const cell = page.locator('button.pocket[aria-label^="Cindergnaw"]').first();
      await expect(cell).toBeVisible({ timeout: 10000 });
      if (size.phone) await cell.click(); else await cell.hover();
      const card = page.locator('.d2tip');
      await expect(card).toBeVisible();
      await page.waitForTimeout(400);
      await shoot(page, 'item-card', size.tag);
      if (MODE) return;
      expect(await card.evaluate(e => getComputedStyle(e).fontVariantLigatures)).toBe('none');
    });

    test('the character sheet', async ({ page }) => {
      test.setTimeout(90000);
      await enterWorld(page);
      await openMapItem(page, size, 'character');
      await shoot(page, 'character', size.tag);
    });

    test('the bestiary', async ({ page }) => {
      test.setTimeout(90000);
      await enterWorld(page, '', { 'eclipse-bestiary-v1': { version: 1, kills: { 'ash-wolf': 12, 'rivet-maw': 3 } } });
      await openMapItem(page, size, 'bestiary');
      await expect(page.locator('.td-best')).toBeVisible();
      await shoot(page, 'bestiary', size.tag);
      if (MODE) return;
      expect(await page.locator('.td-best').evaluate(e => getComputedStyle(e).fontVariantLigatures)).toBe('none');
    });

    test('the lobby character list', async ({ page }) => {
      test.setTimeout(90000);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const act = emptyActivityLedger();
      act.progress.xpByDiscipline = { hunting: keeperXpForLevel(25) + 3 } as typeof act.progress.xpByDiscipline;
      await seed(page, {
        'eclipse-td': '1', 'preferred-language': 'en', 'godforge-realm-era': String(ERA), 'godforge-activity': act,
        'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Cinder', vocation: 'warlock', hair: 'braid', hairColor: 4, outfit: 2, updatedAt: 1 },
      });
      await page.evaluate(() => localStorage.removeItem('eclipse-lobby'));
      await page.goto('/play?td=1&hour=12');
      const title = page.locator('.lobby[data-lobby="title"]');
      await expect(title).toBeVisible({ timeout: 20000 });
      await title.locator('[data-lobby-guest]').click();
      const list = page.locator('.lobby[data-lobby="select"]');
      await expect(list).toBeVisible();
      await page.waitForTimeout(500);
      await shoot(page, 'lobby', size.tag);
      if (MODE) return;
      expect(await list.evaluate(e => getComputedStyle(e).fontVariantLigatures)).toBe('none');
    });

    test('canvas: "N Gold" plates and "+N Gold" floaters', async ({ page }) => {
      test.setTimeout(90000);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await seed(page, { 'eclipse-td': '1', 'preferred-language': 'en' });
      await page.goto('/play?td=1&hour=12&fxgold=1');
      await expect(canvas(page)).toHaveAttribute('data-gold-piles', '3', { timeout: 20000 });
      await page.addStyleTag({ content: '.guide { visibility: hidden !important; }' });
      await page.waitForTimeout(2500);
      const box = (await canvas(page).boundingBox())!;
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2 + 20;
      const clip = { x: Math.max(0, Math.round(cx - 140)), y: Math.max(0, Math.round(cy - 150)), width: Math.min(size.width - Math.max(0, Math.round(cx - 140)), 520), height: 300 };
      await shoot(page, 'gold-plates', size.tag, clip);
      await canvas(page).focus();
      await page.keyboard.down('ArrowRight');
      await expect(canvas(page)).not.toHaveAttribute('data-gold-piles', '3', { timeout: 15000 });
      await page.waitForTimeout(200);
      await page.keyboard.up('ArrowRight');
      await shoot(page, 'gold-floaters', size.tag, clip);
    });
  });
}

test.describe('the fix itself', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test('digits and C come from Inter, the rest stays pixel; ligatures are off; a canvas "fi" is two glyphs', async ({ page }) => {
    test.skip(!!MODE, 'assertions only');
    await seed(page, { 'eclipse-td': '1' });
    await page.goto('/play?td=1&hour=12');
    await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
    const r = await page.evaluate(async () => {
      await document.fonts.load('700 13px "Pixelify Sans"', 'a');
      await document.fonts.load('700 13px "Pixelify Sans"', '5C');
      const c = document.createElement('canvas').getContext('2d')!;
      const w = (font: string, s: string) => { c.font = font; return c.measureText(s).width; };
      const f = '8px "Pixelify Sans", monospace';
      const probe = document.createElement('span');
      probe.style.cssText = 'font:700 13px "Pixelify Sans";position:absolute';
      document.body.appendChild(probe);
      const lig = getComputedStyle(probe).fontVariantLigatures;
      return {
        lig,
        fi: w(f, 'fi'), parts: w(f, 'f') + w(f, 'i'),
        five: w(f, '5'), inter5: w('8px Inter', '5'),
        ok: document.fonts.check('13px "Pixelify Sans"', '5') && document.fonts.check('13px "Pixelify Sans"', 'a'),
      };
    });
    expect(r.lig).toBe('none');
    expect(Math.abs(r.fi - r.parts)).toBeLessThan(.6);   // two glyphs, not the ligature's one
    expect(Math.abs(r.five - r.inter5)).toBeLessThan(.6);   // a 5 in the pixel stack is Inter's 5
  });
});

test('compose before | after sheets', async ({ page }) => {
  test.skip(MODE !== 'compose', 'FONT_SHOTS=compose');
  const dir = (m: string) => `${RAW}/${m}`;
  test.skip(!existsSync(dir('before')) || !existsSync(dir('after')), 'needs both runs');
  const names = readdirSync(dir('before')).filter(f => f.endsWith('.png') && existsSync(`${dir('after')}/${f}`));
  const b64 = (p: string) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
  for (const size of SIZES) {
    const mine = names.filter(n => n.endsWith(`-${size.tag}.png`));
    const rows = mine.map(n => `<section><h2>${n.replace(`-${size.tag}.png`, '')}</h2><div class="pair"><figure><figcaption>before</figcaption><img src="${b64(`${dir('before')}/${n}`)}"></figure><figure><figcaption>after</figcaption><img src="${b64(`${dir('after')}/${n}`)}"></figure></div></section>`).join('');
    const html = `<style>body{margin:0;padding:16px;background:#1b1410;color:#f3e7cf;font:14px system-ui}h2{margin:18px 0 6px;font-size:15px}
      .pair{display:flex;gap:12px;align-items:flex-start}figure{margin:0}figcaption{font-size:12px;opacity:.7;margin-bottom:3px}img{display:block;max-width:${size.phone ? 380 : 620}px;height:auto;border:1px solid #4a382a}</style>${rows}`;
    await page.setViewportSize({ width: size.phone ? 840 : 1320, height: 800 });
    await page.setContent(html);
    await page.waitForTimeout(300);
    mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: `${OUT}/font-${size.tag}.jpg`, type: 'jpeg', quality: 80, fullPage: true });
  }
});
