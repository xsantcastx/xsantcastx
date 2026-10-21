/**
 * td-quests.spec.ts — town tasks (shared/town-tasks): every town's keepers ask for something. A giver wears a "!" over
 * their head; the Map's key travels to them; the talk window says who they are, the task and its reward; Accept puts
 * it on the quest scroll; a delivery the satchel already holds asks to be handed in at once; Hand in pays (Gold, the
 * material, Hunting XP) once, and the receipt is saved. Screenshots: docs/handoff/cozy-ui/quests-*.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { ERA, ledger, purse, sail, seed } from './play-helpers';
import { dailyDay, dailyKey, dailyOf } from '../src/app/shared/town-tasks/town-tasks.model';

const canvas = (page: Page) => page.locator('canvas').first();
const savedGold = (page: Page) => page.evaluate(() => Number(JSON.parse(localStorage.getItem('godforge-economy') || '{}').gold ?? 0));
/** The town tasks blob (the gateway may wrap it in `{ v, updatedAt }`). */
const savedTasks = (page: Page) => page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('godforge-town-tasks') || 'null');
  return (raw && 'v' in raw && 'updatedAt' in raw ? raw.v : raw) as { accepted: Record<string, number>; claimed: string[]; dClaimed?: string[] } | null;
});
const stackOps = (page: Page) => page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('godforge-inventory') || 'null');
  const inv = raw && 'v' in raw && 'updatedAt' in raw ? raw.v : raw;
  return ((inv?.stackOps ?? []) as { id: string }[]).map(o => o.id);
});

async function open(page: Page, stacks: Record<string, number>, extra: Record<string, unknown> = {}): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, { 'eclipse-td': '1', 'godforge-realm-era': String(ERA), 'godforge-inventory': ledger(stacks), ...purse(100_000), ...extra });
  await page.goto('/play?td=1&hour=12');
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
}
/** The Map's key travels to a giver (reduced motion: at once) and speaks to them. */
async function travelTo(page: Page, name: RegExp, phone = false): Promise<void> {
  if (phone) await page.locator('.td-dock button').last().click();
  else { await canvas(page).focus(); await page.keyboard.press('m'); }
  const map = page.locator('#places-list.td-map');
  await expect(map).toBeVisible();
  await page.locator('#places-list [data-map-find]').fill(name.source);
  await map.locator('.td-map__key button[data-kind="npc"]', { hasText: name }).click();
}

test('a Seamworks keeper\'s task: offered with a "!", accepted, handed in from the satchel, paid once', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, { 'cinder-ore': 10 });
  // Every Seamworks giver has a task on offer.
  await expect(canvas(page)).toHaveAttribute('data-task-marks', /bench-smith:!.*buyback-clerk:!|buyback-clerk:!.*bench-smith:!/, { timeout: 10000 });
  await expect(canvas(page)).toHaveAttribute('data-task-marks', /sexton-wren:!/);

  // Edrin Kade's hunt: taken, it goes on the quest scroll with its count.
  await travelTo(page, /edrin kade/i);
  const talk = page.locator('.td-talk');
  await expect(talk).toBeVisible();
  await expect(talk).toHaveAttribute('data-talk', 'buyback-clerk');
  await expect(talk.locator('.td-talk__scroll')).toHaveAttribute('data-talk-state', 'offer');
  await expect(talk).toContainText(/Defeat 6 Rivet Maw/);
  await expect(talk).toContainText(/Hunting XP/);
  await expect(talk.locator('[data-talk-accept]')).toBeVisible();
  await page.screenshot({ path: 'docs/handoff/cozy-ui/quests-offer.jpg', type: 'jpeg', quality: 80 });
  await talk.locator('[data-talk-accept]').click();
  await expect(talk).toHaveCount(0);
  const row = page.locator('[data-tasks] li[data-task="seam-edrin-1"]');
  await expect(row).toBeVisible();
  await expect(row).toContainText('0/6');
  expect((await savedTasks(page))?.accepted['seam-edrin-1']).toBeGreaterThan(0);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/quests-scroll.jpg', type: 'jpeg', quality: 80 });

  // Mara Voss's delivery: the satchel already holds the ore, so she asks for it at once.
  const goldBefore = await savedGold(page);
  await travelTo(page, /mara voss/i);
  await expect(talk).toHaveAttribute('data-talk', 'bench-smith');
  await talk.locator('[data-talk-accept]').click();
  await expect(talk.locator('.td-talk__scroll')).toHaveAttribute('data-talk-state', 'ready');
  await expect(canvas(page)).toHaveAttribute('data-task-marks', /bench-smith:\?/);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/quests-handin.jpg', type: 'jpeg', quality: 80 });
  await talk.locator('[data-talk-handin]').click();
  await expect(talk.locator('.td-talk__scroll')).toHaveAttribute('data-talk-state', 'thanks');
  await expect(talk.locator('[data-talk-paid]')).toContainText(/Gold.*Ember Residue.*Hunting XP/);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/quests-thanks.jpg', type: 'jpeg', quality: 80 });

  // The receipt, the ore taken, the residue given, the Gold banked.
  await expect.poll(async () => (await savedTasks(page))?.claimed ?? []).toContain('seam-mara-1');
  const ops = await stackOps(page);
  expect(ops).toContain('town-task:seam-mara-1:in:cinder-ore');
  expect(ops).toContain('town-task:seam-mara-1:material');
  await expect.poll(() => savedGold(page), { timeout: 10000 }).toBeGreaterThan(goldBefore);
  const goldAfter = await savedGold(page);

  // Her next task is on offer; nothing pays twice.
  await talk.locator('.td-talk__acts button', { hasText: /anything else/i }).click();
  await expect(talk.locator('.td-talk__scroll')).toHaveAttribute('data-talk-task', 'seam-mara-2');
  await page.keyboard.press('Escape');
  await expect(talk).toHaveCount(0);
  await page.waitForTimeout(600);
  expect(await savedGold(page)).toBe(goldAfter);
});

test('a task giver of their own in Pyrehold, and the talk window on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, {});
  // Sail to Pyrehold (the Map's ship pin), then the captain of the Watch.
  await page.locator('.td-dock button').last().click();
  await sail(page, /pyrehold/i, /pyrehold/i);
  await expect(canvas(page)).toHaveAttribute('data-task-marks', /captain-vey:!/, { timeout: 10000 });
  await travelTo(page, /brannoc vey/i, true);
  const talk = page.locator('.td-talk');
  await expect(talk).toBeVisible();
  await expect(talk).toContainText(/Cinder-clan Orc/);
  await page.waitForTimeout(300);
  const box = (await talk.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(391);
  expect(box.y + box.height).toBeLessThanOrEqual(845);
  for (const b of await talk.locator('.td-talk__acts button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/quests-phone.jpg', type: 'jpeg', quality: 80 });
  await talk.locator('[data-talk-accept]').click();
  await expect(page.locator('[data-tasks] li[data-task="pyre-vey-1"]')).toBeVisible();
  await page.screenshot({ path: 'docs/handoff/cozy-ui/quests-phone-scroll.jpg', type: 'jpeg', quality: 80 });
});

/** A local noon on which Mara Voss's daily is a delivery of Cinder Ore (her pick rotates by day; the page clock is pinned to it). */
function oreDay(): Date {
  for (let i = 0; i < 6; i++) {
    const d = new Date(2026, 9, 20 + i, 12);
    if (dailyOf('bench-smith', dailyDay(d))?.id === 'dly-bench-smith-1') return d;
  }
  throw new Error('no day in range picks the ore daily');
}
/** Mara has handed in both one-time tasks; the satchel holds the ore her daily asks for. */
async function openDaily(page: Page): Promise<string> {
  const day = oreDay();
  await page.clock.setFixedTime(day);
  await open(page, { 'cinder-ore': 20 }, {
    'godforge-town-tasks': { version: 1, accepted: { 'seam-mara-1': 1, 'seam-mara-2': 2 }, progress: {}, claimed: ['seam-mara-1', 'seam-mara-2'] },
  });
  return dailyKey(dailyDay(day), 'dly-bench-smith-1');
}

test('a daily: offered after the one-time tasks, accepted, handed in once, then "come back tomorrow"', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const key = await openDaily(page);
  // A v1 blob migrated on read: the "!" is back over Mara for her daily.
  await expect(canvas(page)).toHaveAttribute('data-task-marks', /bench-smith:!/, { timeout: 10000 });
  await travelTo(page, /mara voss/i);
  const talk = page.locator('.td-talk');
  await expect(talk).toHaveAttribute('data-talk', 'bench-smith');
  await expect(talk.locator('.td-talk__scroll')).toHaveAttribute('data-talk-state', 'offer');
  await expect(talk.locator('[data-talk-task]')).toHaveAttribute('data-talk-task', 'dly-bench-smith-1');
  await expect(talk.locator('[data-talk-daily]')).toContainText(/Daily/);
  await expect(talk.locator('[data-talk-daily]')).toContainText(/Resets in 12h 0m/);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/quests-daily.jpg', type: 'jpeg', quality: 80 });
  const goldBefore = await savedGold(page);
  await talk.locator('[data-talk-accept]').click();
  // The satchel already holds the ore: ready at once.
  await expect(talk.locator('.td-talk__scroll')).toHaveAttribute('data-talk-state', 'ready');
  await expect(page.locator('[data-tasks] li[data-task="dly-bench-smith-1"]')).toContainText(/Daily/);
  await talk.locator('[data-talk-handin]').click();
  await expect(talk.locator('.td-talk__scroll')).toHaveAttribute('data-talk-state', 'thanks');
  await expect(talk.locator('[data-talk-paid]')).toContainText(/Gold.*Hunting XP/);
  await expect.poll(async () => (await savedTasks(page))?.dClaimed ?? []).toEqual([key]);
  await expect.poll(() => savedGold(page), { timeout: 10000 }).toBeGreaterThan(goldBefore);
  const goldAfter = await savedGold(page);
  // Nothing else to ask today: she says to come back tomorrow.
  await talk.locator('.td-talk__acts button', { hasText: /farewell/i }).click();
  await expect(talk).toHaveCount(0);
  await expect(canvas(page)).not.toHaveAttribute('data-task-marks', /bench-smith/);
  await travelTo(page, /mara voss/i);
  await expect(talk.locator('.td-talk__scroll')).toHaveAttribute('data-talk-state', 'done');
  await expect(talk).toContainText(/Come back tomorrow/);
  await expect(talk.locator('[data-talk-accept], [data-talk-handin]')).toHaveCount(0);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/quests-daily-done.jpg', type: 'jpeg', quality: 80 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  expect(await savedGold(page)).toBe(goldAfter);
  expect((await savedTasks(page))?.claimed).toEqual(['seam-mara-1', 'seam-mara-2']);
});

test('the daily offer on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDaily(page);
  await travelTo(page, /mara voss/i, true);
  const talk = page.locator('.td-talk');
  await expect(talk.locator('[data-talk-daily]')).toBeVisible();
  await page.waitForTimeout(300);
  const box = (await talk.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(391);
  expect(box.y + box.height).toBeLessThanOrEqual(845);
  for (const b of await talk.locator('.td-talk__acts button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/quests-daily-phone.jpg', type: 'jpeg', quality: 80 });
});

test('a Verdant keeper: Mossharbor\'s net-mender offers her task with a "!", and it goes on the scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, {});
  // Ember Harbour's second ship sails straight to Mossharbor (the Map's ship pin).
  await canvas(page).focus(); await page.keyboard.press('m');
  await sail(page, /mossharbor/i, /^Mossharbor$/);
  await expect(canvas(page)).toHaveAttribute('data-task-marks', /netmender-brisk:!/, { timeout: 10000 });
  await travelTo(page, /wenna brisk/i);
  const talk = page.locator('.td-talk');
  await expect(talk).toHaveAttribute('data-talk', 'netmender-brisk');
  await expect(talk.locator('.td-talk__scroll')).toHaveAttribute('data-talk-state', 'offer');
  await expect(talk.locator('[data-talk-task]')).toHaveAttribute('data-talk-task', 'moss-brisk-1');
  await expect(talk).toContainText(/Thornroot/);
  await expect(talk).toContainText(/Hunting XP/);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/verdant2-quest-offer.jpg', type: 'jpeg', quality: 80 });
  await talk.locator('[data-talk-accept]').click();
  const row = page.locator('[data-tasks] li[data-task="moss-brisk-1"]');
  await expect(row).toBeVisible();
  await expect(row).toContainText('0/6');
  expect((await savedTasks(page))?.accepted['moss-brisk-1']).toBeGreaterThan(0);
});
