/**
 * td-stones.spec.ts — Spellstones, cursed grave-goods and whispering items (design-bible §5.1, §6.2, §7.7; roadmap §10
 * items 10–11), desktop. A level-30 Keeper with Soul and Basalt Blanks (the hook `?fxstones=1`, honoured only under an
 * automated browser) inscribes a Hellfire Nova Spellstone in the Spellbook, casts it from the belt (F: no mana), reads
 * a cursed grave-good's card, has Sexton Aldous Wren lay it to rest, and reads a whispering item's card.
 * Screenshots: docs/handoff/cozy-ui/stones-{craft,cast,cursed,sexton,whisper}.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { ERA, seed } from './play-helpers';
import { emptyActivityLedger } from '../src/app/shared/activity/activity.model';
import { keeperXpForLevel } from '../src/app/shared/skills/keeper-level';

const canvas = (page: Page) => page.locator('canvas').first();
const blob = (page: Page, key: string) => page.evaluate(k => {
  const raw = JSON.parse(localStorage.getItem(k) || 'null');
  return raw && typeof raw === 'object' && 'v' in raw && 'updatedAt' in raw ? raw.v : raw;
}, key);
const hook = (page: Page, name: string, ...args: unknown[]) => page.evaluate(([n, a]) => {
  const h = (window as unknown as { __tdStones?: Record<string, (...x: unknown[]) => unknown> }).__tdStones;
  if (!h) throw new Error('no __tdStones hook');
  return h[n as string](...(a as unknown[]));
}, [name, args] as const);

async function open(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  const act = emptyActivityLedger();
  act.progress.xpByDiscipline = { hunting: keeperXpForLevel(30) + 500 } as typeof act.progress.xpByDiscipline;
  await seed(page, {
    'eclipse-td': '1', 'godforge-realm-era': String(ERA), 'godforge-activity': act,
    'godforge-economy': { version: 3, goldEra: 1, gold: 50_000, totalGoldEarned: 50_000, runGoldEarned: 50_000 },
  });
  await page.goto('/play?td=1&hour=12&fxstones=1');
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await page.addStyleTag({ content: '.guide { visibility: hidden !important; }' });
  await expect.poll(() => page.evaluate(() => !!(window as unknown as { __tdStones?: unknown }).__tdStones), { timeout: 10000 }).toBe(true);
}

test('a Spellstone: inscribed in the Spellbook from a blank and Soul, cast from the belt with no mana', async ({ page }) => {
  test.setTimeout(90000);
  await open(page);
  await hook(page, 'soul', 40);
  await hook(page, 'blanks', 3);
  await expect(page.locator('[data-soul]')).toHaveAttribute('data-soul-n', '40', { timeout: 5000 });

  // ── The Spellbook: Hellfire Nova, Inscribe. ──
  await canvas(page).focus();
  await page.keyboard.press('k');
  const book = page.locator('.spellbook');
  await expect(book).toBeVisible();
  await book.locator('.sbt__tab[data-tree="ember"]').click();
  await book.locator('.sbt__node[data-skill="hellfire-nova"]').click();
  // The Spellstone is folded under the card ("Details" style): unfold it.
  const row = book.locator('[data-inscribe]');
  await expect(row).toBeVisible();
  await row.locator('summary').click();
  await expect(row.locator('[data-inscribe-btn]')).toContainText('5 Soul');
  await row.locator('[data-inscribe-btn]').click();
  await expect(row).toHaveAttribute('data-stone-held', '4');
  await expect(page.locator('[data-soul]')).toHaveAttribute('data-soul-n', '35');
  const saved = await blob(page, 'godforge-spellstones');
  expect(saved.soul).toBe(35);
  expect(Object.keys(saved.pouch)[0]).toMatch(/^hellfire-nova@\d+$/);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/stones-craft.jpg', type: 'jpeg', quality: 86 });
  await page.keyboard.press('Escape');
  await expect(book).toBeHidden();

  // ── The belt: the stone in its slot, F casts it. Mana untouched. ──
  const slot = page.locator('.td-belt [data-kind="stone"]');
  await expect(slot).toHaveAttribute('data-stone', /^hellfire-nova@/);
  await expect(slot.locator('.td-pot__n')).toHaveText('4');
  const mana = Number(await page.locator('.vital--mana label b').first().innerText());
  await canvas(page).focus();
  await page.keyboard.press('f');
  await expect(canvas(page)).toHaveAttribute('data-stone-cast', /^hellfire-nova@/, { timeout: 3000 });
  await expect(slot.locator('.td-pot__n')).toHaveText('3');
  // No mana spent (Hellfire Nova from the bar costs 25; the mana may only have regenerated a little meanwhile).
  expect(Number(await page.locator('.vital--mana label b').first().innerText())).toBeGreaterThanOrEqual(mana);
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/stones-cast.jpg', type: 'jpeg', quality: 86 });
  expect((await blob(page, 'godforge-spellstones')).pouch[Object.keys(saved.pouch)[0]]).toBe(3);
});

test('a cursed grave-good: its card shows the curse, and Sexton Aldous Wren lays it to rest for Gold', async ({ page }) => {
  test.setTimeout(90000);
  await open(page);
  const id = await hook(page, 'cursed', 'hollow-ward') as string;
  expect(id).toBeTruthy();

  // ── The card: Cursed · Hollow Ward, the gift and the price, who cleanses it. ──
  await canvas(page).focus();
  await page.keyboard.press('i');
  const cell = page.locator('button.pocket[aria-label^="Keeper"]').first();
  await expect(cell).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(700);
  await cell.hover();
  const card = page.locator('.d2tip [data-tip-curse]');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Cursed · Hollow Ward');
  await expect(card).toContainText(/grave's price/);
  await expect(card).toContainText(/Sexton Aldous Wren/);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/stones-cursed.jpg', type: 'jpeg', quality: 86 });
  await page.keyboard.press('Escape');

  // ── Sexton Wren, west lane of the Seamworks: Grave-goods → Lay to rest. ──
  await page.mouse.move(5, 5);
  await canvas(page).focus();
  await page.keyboard.press('m');
  const map = page.locator('#places-list.td-map');
  await expect(map).toBeVisible();
  await map.locator('.td-map__key button[data-kind="npc"]', { hasText: /aldous wren/i }).click();
  const talk = page.locator('.td-talk');
  await expect(talk).toBeVisible({ timeout: 10000 });
  // He speaks of the Sexton's Count first (shared/sexton); his Grave-goods desk is a "Something else" away.
  await talk.locator('[data-story-else]').click();
  await talk.locator('[data-talk-grave]').click();
  const desk = page.locator('[data-grave-desk="sexton"]');
  await expect(desk).toBeVisible();
  await expect(desk).toHaveAttribute('data-grave-rows', '1');
  const btn = desk.locator(`[data-grave-item="${id}"] button`);
  const price = Number((await btn.innerText()).replace(/\D/g, ''));
  expect(price).toBeGreaterThan(0);
  await btn.click();
  await expect(desk.locator(`[data-grave-item="${id}"]`)).toContainText('Laid to rest');
  await expect(desk.locator('[data-grave-said]')).toContainText('Counted twice');
  // The mark is saved on the item itself (per character): the curse laid to rest, its numbers kept.
  await expect.poll(async () => ((await blob(page, 'godforge-inventory'))?.records ?? [])
    .find((r: { id: string }) => r.id === id)?.curse?.cleansed).toBe(true);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/stones-sexton.jpg', type: 'jpeg', quality: 86 });
});

test('a whispering item: its card shows the words woken so far and its cost; the Archivist silences it', async ({ page }) => {
  test.setTimeout(90000);
  await open(page);
  await hook(page, 'whisper', 'first-tally', 80);
  await canvas(page).focus();
  await page.keyboard.press('i');
  const cell = page.locator('button.pocket[aria-label^="Keeper"]').first();
  await expect(cell).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(700);
  await cell.hover();
  const card = page.locator('.d2tip [data-tip-whisper]');
  await expect(card).toBeVisible();
  await expect(card).toContainText('It is saying something.');
  await expect(card).toContainText('Five marks on the wall');
  await expect(card).toContainText('The sixth is dated tomorrow');
  await expect(card).toContainText('Awake 3 of 4');
  await expect(card).toContainText(/All Resist while it whispers/);
  await page.screenshot({ path: 'docs/handoff/cozy-ui/stones-whisper.jpg', type: 'jpeg', quality: 86 });
  await page.keyboard.press('Escape');

  // ── The Archivist, east lane of the Seamworks: speaking to him opens his desk; Silence. ──
  await page.mouse.move(5, 5);
  await canvas(page).focus();
  await page.keyboard.press('m');
  const map = page.locator('#places-list.td-map');
  await expect(map).toBeVisible();
  await map.locator('.td-map__key button[data-kind="npc"]', { hasText: /archivist/i }).click();
  const desk = page.locator('[data-grave-desk="archivist"]');
  await expect(desk).toBeVisible({ timeout: 10000 });
  await expect(desk).toHaveAttribute('data-grave-rows', '1');
  await desk.locator('[data-grave-item] button').click();
  await expect(desk.locator('[data-grave-item]')).toContainText('Silenced');
  await expect.poll(async () => ((await blob(page, 'godforge-inventory'))?.records ?? [])
    .find((r: { whisper?: { silenced?: boolean } }) => r.whisper)?.whisper?.silenced).toBe(true);
});
