/**
 * play-game-only-shell.spec.ts — the game is the site (docs/handoff/game-only-shell.md).
 *
 *   - `/` (and `/home`, `/world`) lands in the game.
 *   - /play carries no site chrome: no header, footer, bottom tab bar, command
 *     palette, corner Forge Flame, "Keepers forged today" counter or NPC orb.
 *   - The ☰ menu reaches Character, Sound and Account & settings, and the
 *     Account panel signs in, switches language and changes the cookie choice
 *     without leaving /play.
 *   - Retired page URLs open the matching place in the world, never a page.
 *   - No two fixed widgets overlap (bounding boxes), at desktop and phone size.
 */
import { expect, test, type Page } from '@playwright/test';
import { canvas, openPlay, placePanel, seed } from './play-helpers';

const SIZES = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'phone', width: 390, height: 844 },
] as const;

const SITE_CHROME = [
  'app-header', 'app-footer', '.gftabs', '.gfnav', 'app-command-palette',
  'app-forge-flame', 'app-forged-today', 'app-npc-dialogue', 'app-place-banner-outlet',
];

async function openMenu(page: Page): Promise<void> {
  const list = page.locator('#places-list');
  if (await list.isVisible()) return;
  await page.locator('.places-toggle').first().click();
  await expect(list).toBeVisible();
}

/** Visible, hit-testable position:fixed boxes, minus full-viewport layers (curtains, the game frame itself). */
async function fixedBoxes(page: Page) {
  return page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight;
    const out: { id: string; x: number; y: number; w: number; h: number }[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none') continue;
      if (Number(cs.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (r.width >= vw * 0.9 && r.height >= vh * 0.9) continue; // a full-viewport layer, not a widget
      if (r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh) continue;
      // Only the outermost fixed box counts: a fixed child inside a fixed widget is that widget.
      let p = el.parentElement, nested = false;
      while (p) { if (getComputedStyle(p).position === 'fixed') { nested = true; break; } p = p.parentElement; }
      if (nested) continue;
      out.push({ id: `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]}`, x: r.left, y: r.top, w: r.width, h: r.height });
    }
    return out;
  });
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
});

for (const size of SIZES) {
  test.describe(`game-only shell at ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('/ lands in the game, and so do /home and /world', async ({ page }) => {
      await seed(page);
      for (const from of ['/', '/home', '/world']) {
        await page.goto(from);
        await expect(page).toHaveURL(/\/play(\?|$)/);
        await expect(canvas(page)).toHaveAttribute('data-player-x', /\d/, { timeout: 20000 });
      }
    });

    test('no site chrome anywhere in /play', async ({ page }) => {
      await seed(page);
      await openPlay(page);
      for (const sel of SITE_CHROME) await expect(page.locator(sel), sel).toHaveCount(0);
      await openMenu(page);
      for (const sel of SITE_CHROME) await expect(page.locator(sel), `${sel} with the menu open`).toHaveCount(0);
    });

    test('the ☰ menu reaches Character, Sound and Account; nothing leaves /play', async ({ page }) => {
      await seed(page);
      await openPlay(page);
      await openMenu(page);
      await page.locator('#places-list [data-open="character"]').click();
      await expect(placePanel(page)).toBeVisible();
      await expect(page).toHaveURL(/\/play/);
      await page.keyboard.press('Escape');

      await openMenu(page);
      await page.locator('#places-list [data-open="account"]').click();
      const account = page.locator('[data-account-panel]');
      await expect(account).toBeVisible({ timeout: 15000 });
      await expect(account.locator('app-cloud-save-button')).toBeVisible();
      await account.locator('[data-lang="es"]').click();
      await expect(account.locator('h3').first()).toHaveText('Guardado en la nube');
      await account.locator('[data-lang="en"]').click();
      await account.locator('[data-consent-decline]').click();
      await expect(account.locator('[data-consent]')).toHaveText('Analytics: declined');
      await expect(page).toHaveURL(/\/play/);

      // Every link left inside the panel host stays in the game.
      const outward = await page.locator('section.place a[href]').evaluateAll(as => as
        .map(a => (a as HTMLAnchorElement).getAttribute('href') || '')
        .filter(h => h.startsWith('/') && !h.startsWith('/play')));
      expect(outward).toEqual([]);
    });

    test('retired page URLs open their place in the world', async ({ page }) => {
      await seed(page);
      await page.goto('/forge/crafting');
      await expect(page).toHaveURL(/\/play\?at=crafting/);
      await expect(placePanel(page)).toBeVisible({ timeout: 20000 });
      await page.goto('/character');
      await expect(page).toHaveURL(/\/play/);
    });

    test('no two fixed widgets overlap', async ({ page }) => {
      await seed(page);
      await openPlay(page);
      await page.waitForTimeout(1500);
      for (const phase of ['idle', 'menu'] as const) {
        if (phase === 'menu') await openMenu(page);
        const boxes = await fixedBoxes(page);
        const clashes: string[] = [];
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            if (overlaps(boxes[i], boxes[j])) clashes.push(`${boxes[i].id} × ${boxes[j].id}`);
          }
        }
        expect(clashes, `${phase}: ${JSON.stringify(boxes)}`).toEqual([]);
      }
    });
  });
}
