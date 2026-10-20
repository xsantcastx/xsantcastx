/**
 * td-quests.spec.ts — town tasks (shared/town-tasks): every town's keepers ask for something. A giver wears a "!" over
 * their head; the Map's key travels to them; the talk window says who they are, the task and its reward; Accept puts
 * it on the quest scroll; a delivery the satchel already holds asks to be handed in at once; Hand in pays (Gold, the
 * material, Hunting XP) once, and the receipt is saved. Screenshots: docs/handoff/cozy-ui/quests-*.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { ERA, ledger, seed } from './play-helpers';

const canvas = (page: Page) => page.locator('canvas').first();
const savedGold = (page: Page) => page.evaluate(() => Number(JSON.parse(localStorage.getItem('godforge-economy') || '{}').gold ?? 0));
/** The town tasks blob (the gateway may wrap it in `{ v, updatedAt }`). */
const savedTasks = (page: Page) => page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('godforge-town-tasks') || 'null');
  return (raw && 'v' in raw && 'updatedAt' in raw ? raw.v : raw) as { accepted: Record<string, number>; claimed: string[] } | null;
});
const stackOps = (page: Page) => page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('godforge-inventory') || 'null');
  const inv = raw && 'v' in raw && 'updatedAt' in raw ? raw.v : raw;
  return ((inv?.stackOps ?? []) as { id: string }[]).map(o => o.id);
});

async function open(page: Page, stacks: Record<string, number>): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, { 'eclipse-td': '1', 'godforge-realm-era': String(ERA), 'godforge-inventory': ledger(stacks) });
  await page.goto('/play?td=1&hour=12');
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
}
/** The Map's key travels to a giver (reduced motion: at once) and speaks to them. */
async function travelTo(page: Page, name: RegExp, phone = false): Promise<void> {
  if (phone) await page.locator('.td-dock button').last().click();
  else { await canvas(page).focus(); await page.keyboard.press('m'); }
  const map = page.locator('#places-list.td-map');
  await expect(map).toBeVisible();
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
  await page.locator('#places-list.td-map .td-map__key button', { hasText: /ship to pyrehold/i }).click();
  await expect(canvas(page)).toHaveAttribute('data-area', /pyrehold/i, { timeout: 30000 });
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
