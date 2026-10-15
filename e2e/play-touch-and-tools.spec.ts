/**
 * play-touch-and-tools.spec.ts — two owner reports from playing on a phone
 * (docs/handoff/touch-and-tools.md):
 *
 *   1. "when I hold, it selects the text" — a long press on the world or any
 *      HUD control selects nothing and opens no context menu, while the
 *      Hearth's name/chat field still takes a text selection.
 *   2. "when fishing I still have the sword equipped" — a cast puts the rod in
 *      hand, a dig the pickaxe, a foe near brings the weapon back, and the
 *      equipped weapon never leaves its slot (a reload still wears it).
 *
 * The canvas says what is in hand: `data-keeper-held` ('' = the weapon,
 * 'rod', 'pickaxe', …) next to `data-keeper-gear` (what is worn).
 */
import { expect, test, type Page } from '@playwright/test';
import { blob, canvas, focusWorld, openPlay, seed, walk, walkTo, SHAFT_X } from './play-helpers';
import { CELL, DelveFixture } from './play-delve-fixtures';
import { INVENTORY_ERA } from '../src/app/shared/rpg/inventory.model';
import { REALM_ERA_KEY } from '../src/app/shared/save/realm-era';

/** The Starfall Maul, worn: the weapon that must come back after the work. */
const INVENTORY = {
  version: 2,
  era: INVENTORY_ERA,
  records: [{
    id: 'tt-maul', definitionId: 'starfall-maul', kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: 'legendary', soulbound: false,
    acquiredAt: '2026-10-15T00:00:00.000Z', revision: { hlc: 1, deviceId: 'e2e', sequence: 1 }, source: 'inventory',
    name: 'Starfall Maul', type: 'artifact', stats: { strikePower: 2 }, sellValue: 50, location: { kind: 'equipped', slotId: 'weapon' },
  }],
  tombstones: [], stackOps: [], goldFromSales: 0, sold: 0, hlc: 1, legacyBackup: null,
};

/** play-fishing.spec's dry shore west of the Grotto Mere (cols 15-18, floor row 35, sill at col 19, camp at col 15). */
function mereShore(): DelveFixture {
  const f = new DelveFixture().carve(15, 18, 30, 34).carve(19, 19, 30, 32).floor(15, 19, 35);
  f.set(19, 33, 'bedrock').set(19, 34, 'bedrock');
  return f.camp(15, 34);
}

/** Screenshots for the handoff: only with TT_SHOTS=1, into output/touch-and-tools/ (not committed). */
async function shot(page: Page, name: string): Promise<void> {
  if (process.env['TT_SHOTS']) await page.screenshot({ path: `output/touch-and-tools/${name}.png` });
}

async function tap(el: import('@playwright/test').Locator): Promise<void> {
  await el.evaluate(b => {
    for (const type of ['pointerdown', 'pointerup']) b.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', pointerId: 3, isPrimary: true, button: 0, bubbles: true, cancelable: true }));
  });
}

/** One swing: J on a keyboard, the action button pressed and let go on a phone. */
async function swing(page: Page, touch: boolean): Promise<void> {
  if (!touch) { await focusWorld(page); await page.keyboard.down('j'); await page.waitForTimeout(150); await page.keyboard.up('j'); return; }
  const use = page.locator('.tb--use').first();
  await use.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 5, isPrimary: true, button: 0 });
  await page.waitForTimeout(150);
  await use.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 5, isPrimary: true, button: 0 });
}

for (const [label, size, touch] of [['desktop', { width: 1280, height: 800 }, false], ['phone', { width: 390, height: 844 }, true]] as const) {
  test.describe(`The right tool in hand (${label})`, () => {
    test.use({ viewport: size, hasTouch: touch, isMobile: touch });

    test('dig: pickaxe; cast: rod; an attack: the weapon; reload: still wearing it', async ({ page }) => {
      test.setTimeout(150_000);
      const shore = mereShore();
      // A hard basalt block just west of the camp: four swings to break, so it is still there to hit.
      shore.set(14, 34, 'hard-rock');
      await seed(page, { ...shore.blobs(), 'godforge-inventory': INVENTORY, [REALM_ERA_KEY]: String(INVENTORY_ERA), 'preferred-language': 'en' });
      await openPlay(page);
      await walkTo(page, SHAFT_X, 30);
      const descend = page.getByRole('button', { name: /Descend to your camp/ });
      await expect(descend).toBeVisible();
      await descend.click();
      await expect(canvas(page)).toHaveAttribute('data-area', 'Ember Delve');
      await page.waitForTimeout(1800);
      await focusWorld(page);

      // Arrived: the maul is worn and in hand.
      await expect(canvas(page)).toHaveAttribute('data-keeper-gear', /weapon:hammer/);
      await expect(canvas(page)).toHaveAttribute('data-keeper-held', '');

      // Dig: face the hard basalt west of the camp and swing (J, or the action button on a phone): the pickaxe.
      await page.keyboard.down('a'); await page.waitForTimeout(120); await page.keyboard.up('a');
      await swing(page, touch);
      await expect(canvas(page)).toHaveAttribute('data-keeper-held', 'pickaxe', { timeout: 5000 });
      await shot(page, `${label}-pickaxe`);
      await expect(canvas(page)).toHaveAttribute('data-keeper-gear', /weapon:hammer/);
      // The work stops: the weapon is back after a few seconds.
      await expect(canvas(page)).toHaveAttribute('data-keeper-held', '', { timeout: 8000 });

      // Cast a line: the rod.
      await walk(page, 'd', 18 * CELL + 12, 10000);
      await expect(canvas(page)).toHaveAttribute('data-fishing', 'can:water', { timeout: 8000 });
      if (!touch) { await focusWorld(page); await page.keyboard.press('KeyE'); }
      else await tap(page.locator('.prompt .fish-go'));
      await expect(canvas(page)).toHaveAttribute('data-fishing', 'wait');
      await expect(canvas(page)).toHaveAttribute('data-keeper-held', 'rod');
      await expect(canvas(page)).toHaveAttribute('data-keeper-gear', /weapon:hammer/);
      await page.waitForTimeout(400);
      await shot(page, `${label}-rod`);
      // While the line is out the rod stays in hand (past the three seconds an idle tool lasts).
      await page.waitForTimeout(3600);
      if ((await canvas(page).getAttribute('data-fishing')) === 'wait') await expect(canvas(page)).toHaveAttribute('data-keeper-held', 'rod');

      // An attack (at the bedrock sill: nothing gives) is combat: the weapon is back at once.
      // (A foe coming near does the same: scripts/seamworks-engine.test.cjs "tool in hand".)
      await swing(page, touch);
      await expect(canvas(page)).toHaveAttribute('data-keeper-held', '', { timeout: 2000 });
      await expect(canvas(page)).toHaveAttribute('data-keeper-gear', /weapon:hammer/);
      await page.waitForTimeout(500);
      await shot(page, `${label}-weapon`);

      // Reload: the maul is still equipped (nothing moved between slots) and in hand.
      await page.reload();
      await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 20000 });
      await expect(canvas(page)).toHaveAttribute('data-keeper-gear', /weapon:hammer/);
      await expect(canvas(page)).toHaveAttribute('data-keeper-held', '');
      const saved = await blob<{ records: { id: string; location?: { kind: string; slotId?: string } }[] }>(page, 'godforge-inventory');
      expect(saved?.records.find(r => r.id === 'tt-maul')?.location).toEqual({ kind: 'equipped', slotId: 'weapon' });
    });
  });
}

test.describe('A long press is a game gesture (phone)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('holding controls and the world selects nothing and opens no menu; the Hearth field still selects', async ({ page }) => {
    test.setTimeout(90_000);
    await seed(page, { 'preferred-language': 'en' });
    await openPlay(page);
    const cdp = await page.context().newCDPSession(page);

    // The Places toggle goes last: a press that lifts is still a tap on it, and the open Places sheet
    // (one sheet system for every menu) folds the touch controls away while it is up.
    const targets = ['.viewport canvas', '.vitals', '.hotbar', '.touch-act button', '.touch-move button', '.title-block', '.places-toggle'];
    let pressed = 0;
    for (const sel of targets) {
      const el = page.locator(sel).first();
      if (!(await el.isVisible().catch(() => false))) continue;
      const box = (await el.boundingBox())!;
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      // A real long press: the finger rests 900 ms (past Chrome's long-press threshold) and lifts.
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await page.waitForTimeout(900);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      pressed++;
      expect(await page.evaluate(() => window.getSelection()?.toString() ?? ''), `a long press on ${sel} selected text`).toBe('');
      // The menu a long press would open is refused, and nothing is selectable there.
      const facts = await el.evaluate(node => {
        const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 1, clientY: 1 });
        const start = new Event('selectstart', { bubbles: true, cancelable: true });
        const style = getComputedStyle(node);
        return { menuOpen: node.dispatchEvent(menu), selectOpen: node.dispatchEvent(start), userSelect: style.userSelect || style.getPropertyValue('-webkit-user-select') };
      });
      expect(facts.menuOpen, `the context menu on ${sel} was not prevented`).toBe(false);
      expect(facts.selectOpen, `selectstart on ${sel} was not prevented`).toBe(false);
      expect(facts.userSelect, `${sel} is selectable`).toBe('none');
    }
    expect(pressed, 'at least the canvas and four controls were held').toBeGreaterThanOrEqual(5);
    // Fold the Places sheet the last press opened.
    if (await page.locator('.stage--menu').count()) { await page.keyboard.press('Escape'); await expect(page.locator('.stage--menu')).toHaveCount(0); }

    // A drag across HUD text selects nothing either.
    const title = (await page.locator('.title-block').boundingBox())!;
    await page.mouse.move(title.x + 2, title.y + title.height / 2);
    await page.mouse.down();
    await page.mouse.move(title.x + title.width - 2, title.y + title.height / 2, { steps: 6 });
    await page.mouse.up();
    expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('');

    // The Hearth's name field (and the chat field beside it) still takes text and a selection.
    await page.locator('.hearth-pill').evaluate(b => (b as HTMLButtonElement).click());
    const name = page.locator('#keeper-name');
    await expect(name).toBeVisible();
    await name.fill('Ashwyn');
    const field = await name.evaluate(node => {
      const input = node as HTMLInputElement;
      const start = new Event('selectstart', { bubbles: true, cancelable: true });
      const allowed = input.dispatchEvent(start);
      input.focus(); input.setSelectionRange(0, input.value.length);
      return { allowed, userSelect: getComputedStyle(input).userSelect, selected: input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0) };
    });
    expect(field.allowed, 'selectstart in the name field is allowed').toBe(true);
    expect(field.userSelect).toBe('text');
    expect(field.selected).toBe('Ashwyn');
    expect(await page.locator('#hearth-message').evaluate(n => getComputedStyle(n).userSelect)).toBe('text');
  });
});
