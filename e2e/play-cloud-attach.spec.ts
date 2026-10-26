/**
 * play-cloud-attach.spec.ts — signed in always ends attached to the account (owner bug 2026-10-26: signed in on a PC,
 * dropping an item said "Sign in to trade": the page was not attached, so the save was not reaching the account).
 *
 * The fake cloud (shared/cloud-save/fake-cloud.ts: `eclipse-cloud-fake` = a uid, localhost + WebDriver only) stands
 * in for Google sign-in and Firestore; the Hearth runs with SOCIAL_FAKE_AUTH + SOCIAL_FAKE_TRADE for the drop. With
 * the fake cloud on, the drop needs the real binding (trade-backend blocked()): attached or no drop.
 *  1. A browser an account signed in on, now in Guest (its own saves): Sign in from the list → one reload into the
 *     account's saves → attached → the account's Keeper drops an item.
 *  2. The redirect sign-in (a popup the browser blocks; the iPhone home-screen path) from a guest page: back from the
 *     redirect → into the account's saves → attached.
 */
import { expect, test, type Page } from '@playwright/test';
import { ERA, seed } from './play-helpers';
import { startHearth, type Hearth } from './hearth-helpers';

let hearth: Hearth;
test.beforeAll(async ({}, info) => { hearth = await startHearth(String(info.project.use.baseURL), undefined, { SOCIAL_FAKE_AUTH: '1', SOCIAL_FAKE_TRADE: '1' }); });
test.afterAll(async () => { await hearth?.stop(); });

const lobby = (page: Page, mode: string) => page.locator(`.lobby[data-lobby="${mode}"]`);
const fake = <T>(page: Page, fn: string) => (page.evaluate(`window.__cloudFake ? window.__cloudFake.${fn}() : null`) as Promise<T>).catch(() => null);
const rec = (id: string, name: string) => ({
  id, definitionId: 'keepers-cowl', kind: 'instance', category: 'equipment', tags: ['artifact'], rarity: 'uncommon', soulbound: false,
  acquiredAt: '2026-10-20T00:00:00.000Z', revision: { hlc: 10, deviceId: 'e2e', sequence: 1 }, source: 'inventory',
  name, type: 'artifact', stats: { magicFind: 1 }, rollQuality: { magicFind: 0.5 }, itemLevel: 8, sellValue: 20, location: { kind: 'bag' },
});

/** The account's save on this browser (unprefixed keys), this browser marked as signed in before, now in Guest. */
async function accountThenGuest(page: Page, extra: Record<string, unknown> = {}): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, {
    'eclipse-td': '1', 'godforge-realm-era': String(ERA), 'eclipse-hearth-port': String(hearth.port),
    'eclipse-hearth-fake-token': 'fake.uowner.keeper', 'eclipse-trade-fake': '1', 'eclipse-cloud-fake': 'uowner',
    'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Owner', vocation: 'warlock', updatedAt: 1 },
    'godforge-inventory': { version: 2, records: [rec('d1', 'Ember Charm')], tombstones: [], stackOps: [], goldFromSales: 0, sold: 0, hlc: 10, legacyBackup: null, era: 55 },
    'eclipse-account-seen': '1', 'eclipse-lobby-guest': '1',
    ...extra,
  });
  await page.evaluate(() => localStorage.removeItem('eclipse-lobby'));
}

const items = (page: Page) => page.evaluate(() => {
  const inv = JSON.parse(localStorage.getItem('godforge-inventory') ?? '{}');
  const tomb = new Map((inv.tombstones ?? []).map((t: { id: string; revision: { hlc: number } }) => [t.id, t.revision.hlc]));
  return (inv.records ?? []).filter((r: { id: string; kind: string; revision: { hlc: number } }) => r.kind === 'instance' && !r.id.startsWith('starter-') && !((tomb.get(r.id) as number ?? -1) >= r.revision.hlc)).map((r: { name: string }) => r.name).sort();
});

test('guest on a browser the account used, then Sign in: into the account\'s saves, attached, and a drop works', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await accountThenGuest(page);
  await page.goto('/play?td=1&hour=12');
  // The guest's list: none of the account's Keepers.
  const list = lobby(page, 'select');
  await expect(list).toBeVisible({ timeout: 30000 });
  await expect(list.locator('[data-character]')).toHaveCount(0);
  // Sign in (the fake popup): one reload into the account's saves.
  await list.locator('[data-lobby-signin]').click();
  await expect.poll(() => fake<boolean>(page, 'attached'), { timeout: 30000 }).toBe(true);
  expect(await fake<string>(page, 'profile')).toBe('account');
  expect(await page.evaluate(() => localStorage.getItem('eclipse-lobby-guest'))).toBeNull();
  await expect(lobby(page, 'select').locator('[data-character="c1"]')).toBeVisible({ timeout: 20000 });
  await lobby(page, 'select').locator('[data-character="c1"]').click();
  await lobby(page, 'select').locator('[data-lobby-enter]').click();
  await expect(page.locator('.viewport canvas')).toHaveAttribute('data-player-y', /\d/, { timeout: 30000 });
  await expect(page.locator('.td-chat')).toHaveAttribute('data-chat-connected', 'true', { timeout: 20000 });
  expect(await fake<boolean>(page, 'attached')).toBe(true);
  // The drop: needs the binding (the fake cloud on), and it goes.
  await page.waitForTimeout(600);
  if (await page.locator('.menu-scrim').count()) await page.locator('.menu-scrim').click({ position: { x: 4, y: 4 } });
  await page.getByRole('button', { name: /^Satchel/ }).first().click();
  await page.locator('#satchel-book .pocket[aria-label^="Ember Charm"]').click();
  await page.locator('[data-drop-item]').first().click();
  await expect.poll(() => items(page), { timeout: 15000 }).toEqual([]);
  await expect(page.getByText(/Sign in to trade|sign in to trade/)).toHaveCount(0);
});

test('the redirect sign-in from a guest page (a blocked popup): back from the redirect, into the account\'s saves, attached', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await accountThenGuest(page, { 'eclipse-cloud-fake-popup': 'blocked' });
  await page.goto('/play?td=1&hour=12');
  const list = lobby(page, 'select');
  await expect(list).toBeVisible({ timeout: 30000 });
  // The first click finds the popup blocked and takes the redirect: a full navigation and back.
  await list.locator('[data-lobby-signin]').click();
  await expect.poll(() => fake<boolean>(page, 'attached'), { timeout: 40000 }).toBe(true);
  expect(await fake<string>(page, 'profile')).toBe('account');
  expect(await fake<boolean>(page, 'stuck')).toBe(false);
  await expect(lobby(page, 'select').locator('[data-character="c1"]')).toBeVisible({ timeout: 20000 });
});
