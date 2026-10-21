/**
 * td-sexton.spec.ts — the Sexton's Count (shared/sexton), Ember Isle's first story chain, walked whole: Sexton Wren
 * offers it with a "!"; three chalk-marked stones are read in the Hushed Barrow; the ledger page on the barrow's
 * jetty is only there at night; the Row-Walker gives up Barrow Key 1; the key opens Barrow Door 1 in the vault under
 * the plot; the Uncounted stands over the forty-first grave until it falls; the grave gives the Sexton's cursed cowl;
 * Wren lays it to rest (or the Keeper keeps it); the journal shows every step. The Seek points at each step's place.
 *
 * Test hooks, honoured only under an automated browser (td-engine): `?fxsexton=1` gives `window.__tdSexton`, which
 * stands the Keeper at each place of the chain with the creatures there calm (`to`), fells the Row-Walker or the
 * Uncounted through the real kill (`smite`), and reads what Lumvesh would point at (`seek`). `?phase=night` is the
 * world clock's own night. Screenshots: docs/handoff/cozy-ui/sexton-*.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { ERA, seed } from './play-helpers';

const canvas = (page: Page) => page.locator('canvas').first();
type Hook = {
  to(where: string): string | null;
  smite(what: 'walker' | 'uncounted'): boolean;
  seek(): { id: string; name: string; dir: string | null; floor: string; sea: boolean } | null;
  state(): { step: string; level: string; near: string | null; phase: string };
};
const hook = <T>(page: Page, fn: (h: Hook) => T) => page.evaluate(`(${fn.toString()})(window.__tdSexton)`) as Promise<T>;
const shot = (page: Page, name: string) => page.screenshot({ path: `docs/handoff/cozy-ui/sexton-${name}.jpg`, type: 'jpeg', quality: 82 });
const savedGold = (page: Page) => page.evaluate(() => Number(JSON.parse(localStorage.getItem('godforge-economy') || '{}').gold ?? 0));
/** The chain's facts as saved (the town tasks blob; the gateway may wrap it in `{ v, updatedAt }`). */
const savedFacts = (page: Page) => page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('godforge-town-tasks') || 'null');
  const s = raw && 'v' in raw && 'updatedAt' in raw ? raw.v : raw;
  return Object.keys(s?.chains?.['sexton-count'] ?? {}).sort();
});
const inventoryText = (page: Page) => page.evaluate(() => localStorage.getItem('godforge-inventory') || '');

async function open(page: Page, query: string, fresh: boolean): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  if (fresh) {
    await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
    await seed(page, { 'eclipse-td': '1', 'godforge-realm-era': String(ERA) });
  }
  await page.goto(`/play?td=1&fxsexton=1&${query}`);
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await page.waitForFunction(() => !!(window as unknown as { __tdSexton?: unknown }).__tdSexton, null, { timeout: 15000 });
  // The pictures are of the chain: the level-up fanfare and Glim's chatter step aside (they still happen).
  await page.addStyleTag({ content: '.lvl-banner, .glim-say { visibility: hidden !important; }' });
  await page.waitForTimeout(600);
}
/** Stand somewhere of the chain and press E there (the HUD's own use). */
async function useAt(page: Page, where: string, id: string): Promise<void> {
  await page.evaluate(`window.__tdSexton.to(${JSON.stringify(where)})`);
  await expect.poll(() => hook(page, h => h.state().near), { timeout: 5000 }).toBe(id);
  await canvas(page).focus();
  await page.keyboard.press('e');
}
async function talkToWren(page: Page): Promise<void> {
  await canvas(page).focus();
  await page.keyboard.press('m');
  const map = page.locator('#places-list.td-map');
  await expect(map).toBeVisible();
  await page.locator('#places-list [data-map-find]').fill('aldous wren');
  await map.locator('.td-map__key button[data-kind="npc"]', { hasText: /aldous wren/i }).click();
  await expect(page.locator('.td-talk')).toHaveAttribute('data-talk', 'sexton-wren');
}
const step = (page: Page) => hook(page, h => h.state().step);

test('the Sexton\'s Count, walked whole: stones, the page in the dark, the key, the door, the Uncounted, the choice', async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, 'hour=12', true);

  // ── Wren offers the Count with a "!" over his head; taken, it heads the quest scroll. ──
  await expect(canvas(page)).toHaveAttribute('data-task-marks', /sexton-wren:!/, { timeout: 10000 });
  await talkToWren(page);
  const talk = page.locator('.td-talk');
  await expect(talk.locator('[data-story-step]')).toHaveAttribute('data-story-step', 'offer');
  await expect(talk).toContainText(/Forty graves/);
  await expect(talk.locator('[data-story-reward]')).toContainText(/Gold.*Hunting XP/);
  await shot(page, '1-offer');
  await talk.locator('[data-story-accept]').click();
  await expect(talk).toHaveCount(0);
  await expect(page.locator('[data-tasks] li[data-task="sexton-count"]').first()).toContainText(/Sexton's Count/);
  expect(await step(page)).toBe('stones');
  expect(await savedFacts(page)).toEqual(['taken']);
  // Lumvesh points at the stones.
  expect((await hook(page, h => h.seek()))?.id).toBe('stones');

  // ── The three chalk-marked stones in the Hushed Barrow. ──
  for (const n of [1, 2, 3]) {
    await useAt(page, `stone-${n}`, `sexton:stone:${n}`);
    await expect.poll(() => savedFacts(page)).toContain(`stone-${n}`);
  }
  await expect(page.locator('.td-toast')).toContainText(/pushed UP|Counted/i);
  expect(await step(page)).toBe('page');
  await shot(page, '2-stones');

  // By day the page is not there: the nook holds only the wet note.
  await page.evaluate(`window.__tdSexton.to('page')`);
  await page.waitForTimeout(500);
  await expect(canvas(page)).toHaveAttribute('data-sexton', /^page\|surface\|0\|0\|0$/);
  expect(await hook(page, h => h.state().near)).not.toBe('sexton:page');

  // ── Night: the barrow's jetty is there, and on its nook the ledger page. ──
  await open(page, 'phase=night', false);
  await expect(canvas(page)).toHaveAttribute('data-phase', 'night', { timeout: 15000 });
  expect((await hook(page, h => h.seek()))?.id).toBe('nook');
  await useAt(page, 'page', 'sexton:page');
  await expect(page.locator('.td-toast')).toContainText(/Forty-one/);
  await expect.poll(() => savedFacts(page)).toContain('page');
  await shot(page, '3-page-in-the-dark');
  expect(await step(page)).toBe('key');

  // ── The Row-Walker rises at the plot; laid down, it gives up Barrow Key 1. ──
  await page.evaluate(`window.__tdSexton.to('barrow')`);
  await expect(canvas(page)).toHaveAttribute('data-sexton', /^key\|surface\|0\|1\|0$/, { timeout: 10000 });
  await page.waitForTimeout(800);
  await shot(page, '4-row-walker');
  expect(await hook(page, h => h.smite('walker'))).toBe(true);
  await expect.poll(() => step(page), { timeout: 10000 }).toBe('door');

  // ── Down under the plot: Barrow Door 1, locked until the key turns. ──
  const seekDoor = await hook(page, h => h.seek());
  expect(seekDoor?.id).toBe('door');
  expect(seekDoor?.floor).toBe('below');
  await useAt(page, 'door', 'sexton:door');
  await expect(canvas(page)).toHaveAttribute('data-sexton', /^uncounted\|hushed-barrow-1\|1\|/, { timeout: 5000 });
  await expect(page.locator('.td-toast')).toContainText(/door gives/);
  await shot(page, '5-barrow-door');

  // ── The vault: the Uncounted over the forty-first grave. It must fall before the grave can be read. ──
  await page.evaluate(`window.__tdSexton.to('vault')`);
  await page.waitForTimeout(600);
  await shot(page, '6-the-uncounted');
  await useAt(page, 'grave', 'sexton:grave');
  await expect(page.locator('.td-toast')).toContainText(/stands over the grave/);
  expect(await step(page)).toBe('uncounted');
  expect(await hook(page, h => h.smite('uncounted'))).toBe(true);
  await expect.poll(() => step(page), { timeout: 10000 }).toBe('grave');
  await useAt(page, 'grave', 'sexton:grave');
  await expect(page.locator('.td-toast')).toContainText(/tally mark/);
  await expect.poll(() => step(page), { timeout: 10000 }).toBe('return');
  // The cowl: the Uncounted's own unique, cursed, under its fixed id.
  await expect.poll(() => inventoryText(page), { timeout: 10000 }).toContain('sexton-count-cowl');
  expect(await inventoryText(page)).toContain('hollow-ward');
  await shot(page, '7-forty-first-grave');

  // ── Back to Wren (by day): "?" over him; lay the cowl to rest, for nothing, and his purse besides. ──
  await page.evaluate(`window.__tdSexton.to('square')`);
  await page.waitForTimeout(2600);
  await open(page, 'hour=12', false);
  await expect(canvas(page)).toHaveAttribute('data-task-marks', /sexton-wren:\?/, { timeout: 10000 });
  expect((await hook(page, h => h.seek()))?.id).toBe('wren');
  await talkToWren(page);
  await expect(talk.locator('[data-story-step]')).toHaveAttribute('data-story-step', 'return');
  await expect(talk.locator('[data-story-rest]')).toBeEnabled();
  await expect(talk.locator('[data-story-note]').first()).toContainText(/curse goes/);
  await shot(page, '8-the-choice');
  const goldBefore = await savedGold(page);
  await talk.locator('[data-story-rest]').click();
  await expect(talk.locator('[data-story-step]')).toHaveAttribute('data-story-step', 'thanks');
  await expect(talk.locator('[data-story-reward]')).toContainText(/Gold.*Hunting XP/);
  await expect.poll(() => savedFacts(page)).toContain('rested');
  await expect.poll(() => savedGold(page), { timeout: 10000 }).toBeGreaterThan(goldBefore);
  await expect.poll(() => inventoryText(page)).toContain('"cleansed":true');
  await shot(page, '9-laid-to-rest');

  // ── The journal: all six entries written. ──
  await talk.locator('[data-story-journal]').click();
  const journal = page.locator('[data-journal]');
  await expect(journal).toHaveAttribute('data-journal', 'done');
  await expect(journal.locator('[data-entry-state="done"]')).toHaveCount(6);
  await expect(journal).toContainText(/Laid to rest/);
  await shot(page, '10-journal');

  // Nothing pays twice: Wren's talk is his town tasks again; the Gold holds.
  const goldAfter = await savedGold(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await talkToWren(page);
  await expect(talk.locator('[data-story-step]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  expect(await savedGold(page)).toBe(goldAfter);
  expect(await step(page)).toBe('done');
});

test('the journal mid-chain, and Wren\'s choice on a phone', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  // A Keeper back from the vault with the cowl: the chain's facts and the cowl seeded as the game saves them.
  const facts = Object.fromEntries(['taken', 'stone-1', 'stone-2', 'stone-3', 'page', 'key', 'door'].map((f, i) => [f, 1000 + i]));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, {
    'eclipse-td': '1', 'godforge-realm-era': String(ERA),
    'godforge-town-tasks': { version: 3, accepted: {}, progress: {}, claimed: [], dAccepted: {}, dProgress: {}, dClaimed: [], chains: { 'sexton-count': facts } },
  });
  await open(page, 'hour=12', false);
  expect(await step(page)).toBe('uncounted');
  // The journal from the quest scroll's row: four written, the vault under way, the last still blank.
  await page.locator('[data-story-row]').first().click();
  const journal = page.locator('[data-journal]');
  await expect(journal).toHaveAttribute('data-journal', 'uncounted');
  await expect(journal.locator('[data-entry-state="done"]')).toHaveCount(4);
  await expect(journal.locator('[data-entry="vault"]')).toHaveAttribute('data-entry-state', 'now');
  await expect(journal.locator('[data-entry="return"]')).toHaveAttribute('data-entry-state', 'later');
  await shot(page, 'journal-phone');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  // Wren on a phone: the window fits and its buttons are thumb-sized.
  await page.locator('.td-dock button').last().click();
  await page.locator('#places-list [data-map-find]').fill('aldous wren');
  await page.locator('#places-list.td-map .td-map__key button[data-kind="npc"]', { hasText: /aldous wren/i }).click();
  const talk = page.locator('.td-talk');
  await expect(talk.locator('[data-story-step]')).toHaveAttribute('data-story-step', 'uncounted');
  await page.waitForTimeout(300);
  const box = (await talk.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(391);
  expect(box.y + box.height).toBeLessThanOrEqual(845);
  for (const b of await talk.locator('.td-talk__acts button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await shot(page, 'talk-phone');
  // "Something else": his town tasks and the Grave-goods desk are still his.
  await talk.locator('[data-story-else]').click();
  await expect(talk.locator('[data-talk-grave]')).toBeVisible();
});
