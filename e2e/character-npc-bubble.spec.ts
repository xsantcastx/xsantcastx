import { expect, test, type Page } from '@playwright/test';

/**
 * Kael's speech bubble is a fixed bottom-left widget; on /character it used to
 * land on the Weapon well (1280x800). With the loadout mounted the line stays
 * folded, so the bubble can never sit over a well.
 */

async function open(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.addInitScript(() => {
    window.localStorage.setItem('xsantcastx_consent', 'denied');
    window.localStorage.setItem('preferred-language', 'en');
    window.sessionStorage.setItem('visit-counted', '1');
    window.localStorage.setItem('godforge-realm-era', '55');
  });
  await page.goto('/character', { waitUntil: 'load' });
  await page.locator('.ld__slot').first().waitFor();
  // Give the keeper's line time to arrive.
  await page.waitForTimeout(2500);
}

async function bubbleOverWell(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const hit: string[] = [];
    const bubble = document.querySelector('.npc__bubble') as HTMLElement | null;
    const shown = bubble && bubble.getBoundingClientRect().width > 0 ? bubble.getBoundingClientRect() : null;
    if (!shown) return hit;
    for (const well of Array.from(document.querySelectorAll('.ld__slot'))) {
      const r = well.getBoundingClientRect();
      if (r.width === 0) continue;
      const overlap = r.left < shown.right && r.right > shown.left && r.top < shown.bottom && r.bottom > shown.top;
      if (overlap) hit.push(well.getAttribute('aria-label') ?? 'well');
    }
    return hit;
  });
}

for (const [w, h] of [[1280, 800], [390, 844]] as const) {
  test(`Kael's bubble covers no loadout well at ${w}x${h}`, async ({ page }) => {
    await open(page, w, h);
    expect(await bubbleOverWell(page)).toEqual([]);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(300);
    expect(await bubbleOverWell(page)).toEqual([]);
  });
}
