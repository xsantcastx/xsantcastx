/**
 * lobby-campfire.spec.ts — the character select as a campfire, Diablo II style (owner, 2026-10-21: "would be nice to
 * have the new character picker be like in a campfire like in d2 style").
 *
 * The Keepers stand round a fire on the lobby's canvas (play/lobby/camp-art.ts); a button sits over each sprite. Picking
 * one fills the name plate below; arrows cycle, Enter enters; the free place by the fire opens the Glass, where the
 * four callings stand by the fire. The junk rows the old "leaving New Keeper still creates a Keeper" bug wrote (no
 * name, level 1, nowhere) are pruned, and a nameless Keeper is deleted with a plain confirm.
 *
 * Screenshots: docs/handoff/cozy-ui/camp-*.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { ERA, seed } from './play-helpers';

const SHOTS = 'docs/handoff/cozy-ui';
const lobby = (page: Page, mode: string) => page.locator(`.lobby[data-lobby="${mode}"]`);

const KEEPERS = [
  { name: 'Aster', vocation: 'warlock', level: 7, area: 'Ember Isle', look: { hair: 'braid', hairColor: 4, outfit: 2 } },
  { name: 'Bryn', vocation: 'ashguard', level: 12, area: 'The Ashen Crypt · Floor 1', look: { body: 'broad', hair: 'cropped', hairColor: 1, outfit: 3 } },
  { name: 'Cole', vocation: 'lanternwright', level: 4, area: 'Hearthvale', look: { body: 'slight', hair: 'curls', hairColor: 2, skin: 3 } },
  { name: 'Dara', vocation: 'thornstrider', level: 9, area: 'Ember Isle', look: { hair: 'long', hairColor: 5, face: 'freckles' } },
  { name: 'Emberly', vocation: 'warlock', level: 21, area: 'The Ashen Crypt · Floor 3', look: { hair: 'topknot', hairColor: 0, skin: 1 } },
] as const;

/** `n` Keepers on this device, Aster as character #1 (the one this page plays), a returning offline player. */
async function camp(page: Page, n: number, extra: Record<string, unknown> = {}): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, {
    'eclipse-td': '1', 'godforge-realm-era': String(ERA), 'eclipse-lobby-guest': '1',
    'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Aster', vocation: 'warlock', hair: 'braid', hairColor: 4, outfit: 2, updatedAt: 1 },
  });
  await page.evaluate(({ keepers, n, extra }) => {
    localStorage.removeItem('eclipse-lobby');
    const now = Date.now();
    const chars: Record<string, unknown> = {};
    keepers.slice(0, n).forEach((k, i) => {
      const id = i === 0 ? 'c1' : `k${i + 1}${k.name.toLowerCase().slice(0, 4).padEnd(4, 'x')}00`;
      if (i > 0) {
        localStorage.setItem(`godforge-keeper-look@${id}`, JSON.stringify({ version: 1, made: true, prompted: true, name: k.name, vocation: k.vocation, ...k.look, updatedAt: 1 }));
        localStorage.setItem(`godforge-inventory@${id}`, JSON.stringify({ v: 1 }));
      }
      chars[id] = { id, name: k.name, vocation: k.vocation, level: k.level, area: k.area, look: { ...k.look, vocation: k.vocation }, createdAt: 1 + i, updatedAt: now };
    });
    Object.assign(chars, extra);
    localStorage.setItem('eclipse-characters', JSON.stringify({ v: 1, chars }));
  }, { keepers: KEEPERS as unknown as Array<{ name: string; vocation: string; level: number; area: string; look: Record<string, unknown> }>, n, extra });
}

async function open(page: Page): Promise<void> {
  await page.goto('/play?td=1&hour=12');
  const list = lobby(page, 'select');
  await expect(list).toBeVisible({ timeout: 30000 });
  // The buttons are placed once the stage is measured; let a few frames of fire be painted.
  await expect(list.locator('.keeper.is-placed').first()).toBeVisible();
  await page.waitForTimeout(400);
}

/** Every Keeper's button: on screen, at least 44px, and what a tap at its centre hits (none covers another). */
async function keepersReachable(page: Page): Promise<void> {
  const bad = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('.keeper.is-placed')) {
      const r = el.getBoundingClientRect();
      if (r.width < 44 || r.height < 44) out.push(`${el.dataset['character'] ?? 'new'} ${r.width}x${r.height}`);
      if (r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) out.push(`${el.dataset['character'] ?? 'new'} off screen`);
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!hit || !(hit === el || el.contains(hit))) out.push(`${el.dataset['character'] ?? 'new'} covered by ${hit?.className}`);
    }
    return out;
  });
  expect(bad).toEqual([]);
}

test.describe('the campfire character select (1280×800)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  for (const n of [1, 3, 5]) {
    test(`${n} Keeper${n > 1 ? 's' : ''} round the fire`, async ({ page }) => {
      test.setTimeout(90_000);
      await camp(page, n);
      await open(page);
      const list = lobby(page, 'select');
      await expect(list.locator('[data-character]')).toHaveCount(n);
      await expect(list.locator('[data-camp-new]')).toHaveCount(n < 5 ? 1 : 0);
      await expect(list.locator('[data-plate-name]')).toHaveText('Aster');
      await keepersReachable(page);
      if (n > 1) {
        await list.locator('[data-character]').nth(n - 1).click();
        await expect(list.locator('[data-plate-name]')).toHaveText(KEEPERS[n - 1].name);
        await expect(list.locator('[data-camp-plate]')).toContainText(`Level ${KEEPERS[n - 1].level}`);
        await expect(list.locator('[data-camp-plate]')).toContainText(KEEPERS[n - 1].area);
        await page.waitForTimeout(500);
      }
      await page.screenshot({ path: `${SHOTS}/camp-desktop-${n}.jpg`, type: 'jpeg', quality: 82 });
    });
  }

  test('arrows cycle the Keepers, Enter enters the world', async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await camp(page, 3);
    await open(page);
    const list = lobby(page, 'select');
    const pressed = () => list.locator('[data-character][aria-pressed="true"]').getAttribute('data-character');
    expect(await pressed()).toBe('c1');
    await page.keyboard.press('ArrowRight');
    expect(await pressed()).toBe('k2bryn00');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    expect(await pressed()).toBe('c1');
    await page.keyboard.press('ArrowLeft');
    await expect(list.locator('[data-plate-name]')).toHaveText('Cole');
    await page.keyboard.press('ArrowRight');
    await expect(list.locator('[data-plate-name]')).toHaveText('Aster');
    await page.keyboard.press('Enter');
    await expect(page.locator('.viewport canvas')).toHaveAttribute('data-player-x', /\d/, { timeout: 30000 });
  });

  test('double-clicking a Keeper enters the world', async ({ page }) => {
    test.setTimeout(90_000);
    await camp(page, 2);
    await open(page);
    await lobby(page, 'select').locator('[data-character="c1"]').dblclick();
    await expect(page.locator('.viewport canvas')).toHaveAttribute('data-player-x', /\d/, { timeout: 30000 });
  });

  test('the free place by the fire opens the Glass, where the callings stand by the fire', async ({ page }) => {
    test.setTimeout(120_000);
    await camp(page, 2);
    await open(page);
    await lobby(page, 'select').locator('[data-camp-new]').click();
    const glass = lobby(page, 'create');
    await expect(glass).toBeVisible({ timeout: 30000 });
    await expect(glass.locator('[data-camp-class]')).toHaveCount(4);
    // A calling by the fire chooses it, as the maker's own cards do.
    await glass.locator('[data-camp-class="ashguard"]').click();
    await expect(glass.locator('[data-vocation="ashguard"]')).toHaveAttribute('aria-checked', 'true');
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOTS}/camp-glass.jpg`, type: 'jpeg', quality: 82 });
    // Leaving makes nothing: the same two Keepers.
    await glass.locator('[data-lobby-close]').click();
    await expect(lobby(page, 'select').locator('[data-character]')).toHaveCount(2, { timeout: 30000 });
  });

  test('junk rows from the old New Keeper bug are pruned; a nameless Keeper deletes with a plain confirm', async ({ page }) => {
    test.setTimeout(90_000);
    const old = Date.UTC(2026, 9, 20);
    const junk = (id: string) => ({ id, name: '', vocation: 'warlock', level: 1, area: '', look: null, createdAt: old, updatedAt: old });
    await camp(page, 2, {
      k7junk000: junk('k7junk000'),
      k8junk000: junk('k8junk000'),
      // Nameless but real (it has levels): never pruned, and deleted with a plain confirm.
      k9lvls000: { ...junk('k9lvls000'), level: 3 },
    });
    await open(page);
    const list = lobby(page, 'select');
    await expect(list.locator('[data-character]')).toHaveCount(3);
    await expect(list.locator('[data-character="k7junk000"]')).toHaveCount(0);
    const rows = await page.evaluate(() => JSON.parse(localStorage.getItem('eclipse-characters')!).chars);
    expect(rows['k7junk000'].deletedAt).toBeGreaterThan(0);
    expect(rows['k8junk000'].deletedAt).toBeGreaterThan(0);
    expect(rows['k9lvls000'].deletedAt).toBeUndefined();
    expect(rows['c1'].deletedAt).toBeUndefined();

    await list.locator('[data-character="k9lvls000"]').click();
    await list.locator('[data-lobby-delete]').click();
    const confirm = page.locator('[data-delete-confirm]');
    await expect(confirm.locator('[data-delete-plain]')).toBeVisible();
    await expect(confirm.locator('input')).toHaveCount(0);
    await expect(confirm.locator('[data-delete-go]')).toBeEnabled();
    await confirm.locator('[data-delete-go]').click();
    await expect(list.locator('[data-character]')).toHaveCount(2);
    await expect(list.locator('[data-character="c1"]')).toBeVisible();
  });
});

const FIGURES = [
  { vocation: 'warlock', hair: 'long', hairColor: 4 },
  { vocation: 'ashguard', hair: 'ponytail', hairColor: 3 },
  { vocation: 'lanternwright', hair: 'bun', hairColor: 5 },
  { vocation: 'thornstrider', hair: 'pigtails', hairColor: 1 },
] as const;

/** Five Keepers of one figure: the four callings (plus a bare-headed fifth to show the hair), every class's kit over the body. */
async function lineup(page: Page, form: 'fem' | 'masc'): Promise<void> {
  const now = Date.now();
  const chars: Record<string, unknown> = {};
  FIGURES.forEach((f, i) => {
    const id = `k${i + 2}${form}${f.vocation.slice(0, 3)}`;
    chars[id] = { id, name: `${form === 'fem' ? 'She' : 'He'} ${f.vocation.slice(0, 5)}`, vocation: f.vocation, level: 3 + i, area: 'Ember Isle',
      look: { form, hair: form === 'fem' ? f.hair : 'cropped', hairColor: f.hairColor, skin: i * 2, outfit: i + 1, vocation: f.vocation }, createdAt: 10 + i, updatedAt: now };
  });
  await camp(page, 1, chars);
}

test.describe('feminine and masculine Keepers by the fire (1280×800)', () => {
  test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  for (const form of ['fem', 'masc'] as const) {
    test(`the four callings, ${form}`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await lineup(page, form);
      await open(page);
      await expect(lobby(page, 'select').locator('[data-character]')).toHaveCount(5);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${SHOTS}/camp-figures-${form}.jpg`, type: 'jpeg', quality: 86, clip: { x: 240, y: 120, width: 800, height: 360 } });
    });
  }
});

/** The Glass, opened from the free place by the fire. */
async function glassByFire(page: Page): Promise<void> {
  await camp(page, 2);
  await open(page);
  await lobby(page, 'select').locator('[data-camp-new]').click();
  await expect(lobby(page, 'create')).toBeVisible({ timeout: 30000 });
  await expect(lobby(page, 'create').locator('[data-camp-class]')).toHaveCount(4);
}

const GLASS_SIZES = [
  { name: 'desktop', width: 1280, height: 800, touch: false },
  { name: 'phone', width: 390, height: 844, touch: true },
  { name: 'small', width: 360, height: 640, touch: true },
  { name: 'landscape', width: 844, height: 390, touch: true },
];
for (const size of GLASS_SIZES) {
  test.describe(`the Glass by the fire (${size.width}×${size.height})`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, hasTouch: size.touch, isMobile: size.touch });

    test('the callings stand round the fire; the chosen one changes live; the fifth is locked and quotes the lore', async ({ page }) => {
      test.setTimeout(120_000);
      await glassByFire(page);
      const glass = lobby(page, 'create');
      // Choosing on the maker's cards and on the figures by the fire agree.
      await glass.locator('[data-vocation="thornstrider"]').click();
      await expect(glass.locator('[data-vocation="thornstrider"]')).toHaveAttribute('aria-checked', 'true');
      await glass.locator('[data-camp-class="lanternwright"]').click();
      await expect(glass.locator('[data-vocation="lanternwright"]')).toHaveAttribute('aria-checked', 'true');
      // Become is on screen without scrolling, and a 44px target.
      const keep = (await glass.locator('.km__keep').boundingBox())!;
      expect(keep.y + keep.height).toBeLessThanOrEqual(size.height);
      expect(keep.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${SHOTS}/camp-glass-${size.name}.jpg`, type: 'jpeg', quality: 82 });
      // The fifth, locked figure: its note quotes the lore log.
      await glass.locator('[data-camp-locked]').click();
      await expect(glass.locator('[data-camp-tip]')).toContainText('Wanewalkers');
      if (size.name === 'desktop') await page.screenshot({ path: `${SHOTS}/camp-glass-locked.jpg`, type: 'jpeg', quality: 82 });
    });
  });
}

test.describe('the lore log', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test('the character sheet\'s Lore tab holds the Wanewalkers', async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
    await seed(page, { 'eclipse-td': '1', 'godforge-realm-era': String(ERA),
      'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Aster', vocation: 'ashguard', form: 'fem', hair: 'ponytail', updatedAt: 1 } });
    await page.goto('/play?td=1&hour=12');
    const canvas = page.locator('.viewport canvas');
    await expect(canvas).toHaveAttribute('data-player-x', /\d/, { timeout: 30000 });
    await canvas.evaluate(c => (c as HTMLCanvasElement).focus({ preventScroll: true }));
    await page.keyboard.press('c');
    await page.locator('.ksheet [data-sheet-lore]').click();
    await expect(page.locator('.ksheet [data-lore-page="wanewalkers"]')).toContainText('The Wanewalkers');
    await page.screenshot({ path: `${SHOTS}/lore-wanewalkers.jpg`, type: 'jpeg', quality: 82 });
    // The same Keeper in the world, feminine, walking left and right (the side painter) and down (the front sheet).
    await page.keyboard.press('Escape');
    await page.screenshot({ path: `${SHOTS}/fem-world.jpg`, type: 'jpeg', quality: 82 });
  });
});

const PHONE_SIZES = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'landscape', width: 844, height: 390 },
];
for (const size of PHONE_SIZES) {
  test.describe(`the campfire on a ${size.name} (${size.width}×${size.height})`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, hasTouch: true, isMobile: true });

    for (const n of [1, 3, 5]) {
      test(`${n} Keeper${n > 1 ? 's' : ''}: the scene fits, every control a 44px target`, async ({ page }) => {
        test.setTimeout(90_000);
        await camp(page, n);
        await open(page);
        const list = lobby(page, 'select');
        await expect(list.locator('[data-character]')).toHaveCount(n);
        await keepersReachable(page);
        if (n > 1) await list.locator('[data-character]').nth(1).tap();
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
        for (const b of await list.locator('button:visible').all()) {
          const box = await b.boundingBox();
          if (box) expect(box.height, await b.innerText()).toBeGreaterThanOrEqual(44);
        }
        // Enter world is on screen and pressable.
        const enter = list.locator('[data-lobby-enter]');
        await enter.scrollIntoViewIfNeeded();
        const e = (await enter.boundingBox())!;
        expect(e.y + e.height).toBeLessThanOrEqual(size.height);
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${SHOTS}/camp-${size.name}-${n}.jpg`, type: 'jpeg', quality: 82 });
      });
    }
  });
}
