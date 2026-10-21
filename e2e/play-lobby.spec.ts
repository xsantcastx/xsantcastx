/**
 * play-lobby.spec.ts — the title screen and the Tibia-style character list (play/lobby).
 *
 * Owner, 2026-10-21: "we also need a login and select character screen" and "if I'm already logged in, it should go
 * to character screen". A browser holding a save from before characters existed signs in as a guest, finds that save
 * on the list as character #1 (the migration), enters, walks, goes back to the list from the menu, makes a second
 * Keeper at the Glass, enters as them, comes back and re-enters the first — whose level and place are intact.
 * Returning guests and resuming sign-ins open on the list without the title ever showing. Deleting needs the name.
 *
 * playwright.config skips the lobby for every other spec (`eclipse-lobby: skip`); this one removes the flag.
 * Screenshots: docs/handoff/cozy-ui/login-*.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { ERA, seed } from './play-helpers';
import { emptyActivityLedger } from '../src/app/shared/activity/activity.model';
import { keeperXpForLevel } from '../src/app/shared/skills/keeper-level';

const SHOTS = 'docs/handoff/cozy-ui';
const canvas = (page: Page) => page.locator('.viewport canvas');
const lobby = (page: Page, mode: string) => page.locator(`.lobby[data-lobby="${mode}"]`);

/** A save from before characters: a made Keeper "Aster", Hunting level 7, standing somewhere on Ember Isle. */
async function legacySave(page: Page): Promise<void> {
  const act = emptyActivityLedger();
  act.progress.xpByDiscipline = { hunting: keeperXpForLevel(7) + 3 } as typeof act.progress.xpByDiscipline;
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, {
    'eclipse-td': '1',
    'godforge-realm-era': String(ERA),
    'godforge-activity': act,
    'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Aster', vocation: 'warlock', hair: 'braid', hairColor: 4, outfit: 2, updatedAt: 1 },
  });
  // The lobby itself is under test: drop the skip the config gives every other spec.
  await page.evaluate(() => localStorage.removeItem('eclipse-lobby'));
}

async function inWorld(page: Page): Promise<void> {
  await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 30000 });
}

async function where(page: Page): Promise<{ x: number; y: number }> {
  return { x: Number(await canvas(page).getAttribute('data-player-x')), y: Number(await canvas(page).getAttribute('data-player-y')) };
}

/** The world's menu (M opens the Map, whose footer carries "Character select"). */
async function toCharacterSelect(page: Page): Promise<void> {
  await canvas(page).focus();
  await page.keyboard.press('m');
  await page.locator('#places-list [data-open="characters"]').click();
  await expect(lobby(page, 'select')).toBeVisible({ timeout: 15000 });
}

test.describe('login and character select', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('title → offline → the old save is character #1 → a second Keeper → back to the first, intact', async ({ page }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await legacySave(page);
    await page.goto('/play?td=1&hour=12');

    // The title: sign in or play offline. Nothing of the world is running behind it.
    const title = lobby(page, 'title');
    await expect(title).toBeVisible({ timeout: 20000 });
    await expect(title.locator('h1')).toHaveText('Eclipse Realms');
    await expect(title.locator('[data-lobby-signin]')).toBeVisible();
    await expect(page.locator('app-side-scroller')).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/login-title.jpg`, type: 'jpeg', quality: 82 });

    await title.locator('[data-lobby-guest]').click();
    const list = lobby(page, 'select');
    await expect(list).toBeVisible();
    // The migration: the single save is on the list as character #1, with its name, level and place.
    const aster = list.locator('[data-character="c1"]');
    await expect(aster).toHaveAttribute('data-name', 'Aster');
    await expect(aster).toHaveAttribute('data-level', '7');
    await expect(aster.locator('[data-char-where]')).toContainText(/Ember Isle|set out/);
    await expect(aster).toHaveAttribute('aria-pressed', 'true');

    // Enter, walk a little, and let the place save.
    await list.locator('[data-lobby-enter]').click();
    await inWorld(page);
    await expect(page.locator('[data-keeper-level]')).toHaveText('7');
    await canvas(page).focus();
    await page.keyboard.down('d');
    await page.waitForTimeout(900);
    await page.keyboard.up('d');
    await page.waitForTimeout(2600);
    const asterAt = await where(page);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('eclipse-play-world-v1') || '{}').td?.x ?? null))
      .toBe(asterAt.x);

    // Back to the list from the menu, then a new Keeper: the Glass, a name, into the world as them.
    await toCharacterSelect(page);
    await expect(list.locator('[data-character]')).toHaveCount(1);
    await list.locator('[data-lobby-new]').click();
    const glass = lobby(page, 'create');
    await expect(glass).toBeVisible({ timeout: 20000 });
    await expect(glass.locator('app-keeper-maker')).toBeVisible();
    await glass.locator('.km__name input').fill('Bryn');
    await page.screenshot({ path: `${SHOTS}/login-new-character.jpg`, type: 'jpeg', quality: 82 });
    await glass.locator('.km__keep').click();
    await inWorld(page);
    // A fresh character: level 1, none of Aster's save.
    await expect(page.locator('[data-keeper-level]')).toHaveText('1');
    const second = await page.evaluate(() => localStorage.getItem('eclipse-active-character'));
    expect(second).toMatch(/^k[a-z0-9]{7}$/);
    expect(await page.evaluate(id => localStorage.getItem(`godforge-keeper-look@${id}`), second)).toContain('Bryn');
    // The new Keeper is taught the island from step 1 (td/td-prologue.ts); none of Aster's progress came along.
    await expect.poll(() => page.evaluate(() => document.querySelector<HTMLElement>('.guide')?.dataset['goal'] ?? null), { timeout: 15000 }).toBe('pro-walk');
    expect(await page.evaluate(id => localStorage.getItem(`godforge-activity@${id}`)?.includes('"hunting"') ?? false, second)).toBe(false);

    // Both on the list now; back into Aster.
    await toCharacterSelect(page);
    await expect(list.locator('[data-character]')).toHaveCount(2);
    await expect(list.locator(`[data-character="${second}"]`)).toHaveAttribute('data-name', 'Bryn');
    await expect(list.locator(`[data-character="${second}"]`)).toHaveAttribute('data-level', '1');
    await expect(list.locator('[data-slots]')).toHaveText('2 of 5 Keepers');
    await page.screenshot({ path: `${SHOTS}/login-select.jpg`, type: 'jpeg', quality: 82 });

    // Re-entering the character this page already plays mounts the world again without a reload.
    await list.locator(`[data-character="${second}"]`).click();
    await list.locator('[data-lobby-enter]').click();
    await inWorld(page);
    await expect(page.locator('[data-keeper-level]')).toHaveText('1');
    await toCharacterSelect(page);

    await list.locator('[data-character="c1"]').click();
    await list.locator('[data-lobby-enter]').click();
    await inWorld(page);
    expect(await page.evaluate(() => localStorage.getItem('eclipse-active-character'))).toBe('c1');
    await expect(page.locator('[data-keeper-level]')).toHaveText('7');
    // A level-7 Keeper has played: no prologue for Aster.
    expect(await page.evaluate(() => document.querySelector<HTMLElement>('.guide')?.dataset['goal'] ?? '')).not.toMatch(/^pro-/);
    await expect.poll(async () => {
      const now = await where(page);
      return Math.hypot(now.x - asterAt.x, now.y - asterAt.y);
    }, { timeout: 10000 }).toBeLessThan(24);

    // A returning offline player opens on the list (no title).
    await page.goto('/play?td=1&hour=12');
    await expect(lobby(page, 'select')).toBeVisible({ timeout: 20000 });
    await expect(lobby(page, 'select').locator('[data-character]')).toHaveCount(2);
  });

  test('a Thornstrider made at the Glass is still a Thornstrider after a reload, on the list and in the world', async ({ page }) => {
    // Owner, 2026-10-21: "I created a ranger … when logging back in, the character looked like a warlock".
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await legacySave(page);
    await page.evaluate(() => localStorage.setItem('eclipse-lobby-guest', '1'));
    await page.goto('/play?td=1&hour=12');
    const list = lobby(page, 'select');
    await expect(list).toBeVisible({ timeout: 30000 });
    await list.locator('[data-lobby-new]').click();
    const glass = lobby(page, 'create');
    await expect(glass).toBeVisible({ timeout: 20000 });
    await glass.locator('[data-vocation="thornstrider"]').click();
    await glass.locator('.km__name input').fill('Rue');
    await glass.locator('.km__keep').click();
    await inWorld(page);
    const id = await page.evaluate(() => localStorage.getItem('eclipse-active-character'));
    expect(id).toMatch(/^k[a-z0-9]{7}$/);
    const saved = () => page.evaluate(k => ({
      look: JSON.parse(localStorage.getItem(`godforge-keeper-look@${k}`) || '{}').vocation,
      row: JSON.parse(localStorage.getItem('eclipse-characters') || '{"chars":{}}').chars[k as string]?.vocation,
    }), id);
    expect(await saved()).toEqual({ look: 'thornstrider', row: 'thornstrider' });

    await page.reload();
    await expect(list).toBeVisible({ timeout: 30000 });
    const rue = list.locator(`[data-character="${id}"]`);
    await expect(rue).toHaveAttribute('data-name', 'Rue');
    await expect(rue.locator('.char__line').first()).toContainText('Thornstrider');
    await rue.click();
    await list.locator('[data-lobby-enter]').click();
    await inWorld(page);
    expect(await saved()).toEqual({ look: 'thornstrider', row: 'thornstrider' });
    await canvas(page).focus();
    await page.keyboard.press('c');
    await expect(page.locator('#ksheet-title')).toContainText('Rue · Thornstrider', { timeout: 10000 });
  });

  test('delete needs the typed name, and the other Keeper stays', async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await legacySave(page);
    // Two characters already on this device: Aster (#1) and Cole (#2).
    await page.evaluate(() => {
      const now = Date.now();
      localStorage.setItem('eclipse-lobby-guest', '1');
      localStorage.setItem('godforge-keeper-look@k2cole00', JSON.stringify({ version: 1, made: true, prompted: true, name: 'Cole', updatedAt: 1 }));
      localStorage.setItem('godforge-inventory@k2cole00', JSON.stringify({ v: 1 }));
      localStorage.setItem('eclipse-characters', JSON.stringify({ v: 1, chars: {
        c1: { id: 'c1', name: 'Aster', vocation: 'warlock', level: 7, area: '', look: null, createdAt: 1, updatedAt: now },
        k2cole00: { id: 'k2cole00', name: 'Cole', vocation: 'warlock', level: 1, area: '', look: null, createdAt: 2, updatedAt: now },
      } }));
    });
    await page.goto('/play?td=1&hour=12');
    const list = lobby(page, 'select');
    await expect(list).toBeVisible({ timeout: 20000 });
    await list.locator('[data-character="k2cole00"]').click();
    await list.locator('[data-lobby-delete]').click();
    const confirm = page.locator('[data-delete-confirm]');
    await expect(confirm).toBeVisible();
    await expect(confirm.locator('[data-delete-go]')).toBeDisabled();
    await confirm.locator('input').fill('Col');
    await expect(confirm.locator('[data-delete-go]')).toBeDisabled();
    await confirm.locator('input').fill('cole');
    await expect(confirm.locator('[data-delete-go]')).toBeEnabled();
    await page.screenshot({ path: `${SHOTS}/login-delete.jpg`, type: 'jpeg', quality: 82 });
    await confirm.locator('[data-delete-go]').click();
    await expect(confirm).toHaveCount(0);
    await expect(list.locator('[data-character]')).toHaveCount(1);
    await expect(list.locator('[data-character="c1"]')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('godforge-keeper-look@k2cole00'))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('godforge-keeper-look'))).toContain('Aster');
    // The tombstone keeps it gone after a reload.
    await page.reload();
    await expect(lobby(page, 'select').locator('[data-character]')).toHaveCount(1);
  });

  test('a resuming sign-in never flashes the title; it waits quietly, then opens the list', async ({ page }) => {
    test.setTimeout(90_000);
    await legacySave(page);
    // Bound to an account (as after a sign-in) and an offline player before that: whatever the session resolves to,
    // this browser belongs on the list. Record whether the title ever rendered.
    await page.evaluate(() => { localStorage.setItem('cloud-save-uid', 'e2e-uid'); localStorage.setItem('eclipse-lobby-guest', '1'); });
    await page.addInitScript(() => {
      (window as unknown as { __titleSeen: boolean }).__titleSeen = false;
      new MutationObserver(() => {
        if (document.querySelector('.lobby[data-lobby="title"]')) (window as unknown as { __titleSeen: boolean }).__titleSeen = true;
      }).observe(document, { subtree: true, childList: true, attributes: true });
    });
    await page.goto('/play?td=1&hour=12');
    await expect(lobby(page, 'select')).toBeVisible({ timeout: 30000 });
    expect(await page.evaluate(() => (window as unknown as { __titleSeen: boolean }).__titleSeen)).toBe(false);
  });
});

test.describe('login on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the title and the list fit a 390×844 phone, every control a 44px target', async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await legacySave(page);
    await page.evaluate(() => {
      const now = Date.now();
      localStorage.setItem('godforge-keeper-look@k2wren00', JSON.stringify({ version: 1, made: true, prompted: true, name: 'Wren', hair: 'curls', hairColor: 1, outfit: 5, updatedAt: 1 }));
      localStorage.setItem('godforge-inventory@k2wren00', JSON.stringify({ v: 1 }));
      localStorage.setItem('eclipse-characters', JSON.stringify({ v: 1, chars: {
        k2wren00: { id: 'k2wren00', name: 'Wren', vocation: 'warlock', level: 3, area: 'The Ashen Crypt · Floor 1', look: null, createdAt: 5, updatedAt: now },
      } }));
    });
    await page.goto('/play?td=1&hour=12');
    const title = lobby(page, 'title');
    await expect(title).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: `${SHOTS}/login-title-phone.jpg`, type: 'jpeg', quality: 82 });
    await title.locator('[data-lobby-guest]').tap();
    const list = lobby(page, 'select');
    await expect(list.locator('[data-character]')).toHaveCount(2);
    await page.screenshot({ path: `${SHOTS}/login-select-phone.jpg`, type: 'jpeg', quality: 82 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    for (const b of await list.locator('button').all()) {
      const box = await b.boundingBox();
      if (box) expect(box.height, await b.innerText()).toBeGreaterThanOrEqual(44);
    }
  });
});
