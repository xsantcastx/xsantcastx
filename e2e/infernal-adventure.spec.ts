import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const screenshotDirectory = 'outputs/seamworks-preview';

// Start with no tutorial flag and no gameplay resources. Consent is the only
// preference pre-set, so the opening must stand on its own for a new player.
test.use({ storageState: { cookies: [], origins: [] } });

async function openAdventure(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('xsantcastx_consent', 'denied'));
  await page.goto('/play/storyboard');
  await expect(page.getByRole('heading', { name: 'Basalt Seamworks', exact: true })).toBeVisible();
  await expect(page.locator('app-header, app-onboarding-outlet, app-npc-dialogue, app-milestone-effect')).toHaveCount(0);
}

async function forgeFirstBlade(page: Page): Promise<void> {
  await page.getByRole('button', { name: /The old forge/ }).click();
  await expect(page.getByRole('button', { name: /Forge Basalt Edge/ })).toBeDisabled();
  await page.getByRole('button', { name: /The crossing/ }).click();
  await expect(page.getByRole('button', { name: /Face the Rivet Maw/ })).toBeDisabled();
  await page.getByRole('button', { name: /Cinder seam/ }).click();
  for (let count = 1; count <= 6; count++) {
    await page.getByRole('button', { name: /Mine Cinder Ore/ }).click();
    await expect(page.getByText(`${count} / 6 collected`, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Seam recovering/ })).toBeDisabled();
  }
  await page.getByRole('button', { name: /Take your ore to the forge/ }).click();
  // Mining may naturally discover Ember Residue. Accept the guaranteed ember
  // only when the player needs it; neither route seeds a resource.
  const ember = page.getByRole('button', { name: "Accept the Keeper's ember" });
  if (await ember.count()) await ember.click();
  await page.getByRole('button', { name: /Forge Basalt Edge/ }).click();
  await page.getByRole('button', { name: /Equip Basalt Edge/ }).click();
  await expect(page.getByText('Equipped · ready for the crossing')).toBeVisible();
}

async function bladeCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const ledger = JSON.parse(localStorage.getItem('godforge-inventory') || '{}');
    return (ledger.records || []).filter((row: { definitionId: string }) => row.definitionId === 'basalt-edge').length;
  });
}

test('fresh player gathers, forges, learns combat and restores the crossing persistently', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openAdventure(page);
  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({ path: `${screenshotDirectory}/desktop-opening.png`, fullPage: true });
  await forgeFirstBlade(page);
  expect(await bladeCount(page)).toBe(1);
  await page.reload();
  await page.getByRole('button', { name: /The old forge/ }).click();
  await expect(page.getByText('Equipped · ready for the crossing')).toBeVisible();
  await expect(page.getByRole('button', { name: /Forge Basalt Edge/ })).toHaveCount(0);
  await page.getByRole('button', { name: /Walk to the crossing/ }).click();
  await page.getByRole('button', { name: /Face the Rivet Maw/ }).click();
  for (let turn = 0; turn < 3; turn++) await page.getByRole('button', { name: 'Strike', exact: true }).click();
  await expect(page.getByRole('button', { name: /Try the encounter again/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Light the beacon/ })).toHaveCount(0);
  await page.getByRole('button', { name: /Try the encounter again/ }).click();
  for (let turn = 0; turn < 3; turn++) {
    await page.getByRole('button', { name: 'Guard', exact: true }).click();
    await page.getByRole('button', { name: 'Strike', exact: true }).click();
  }
  await page.getByRole('button', { name: /Light the beacon/ }).click();
  await expect(page.getByText(/Seamworks reclaimed/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Light the beacon/ })).toHaveCount(0);
  await page.screenshot({ path: `${screenshotDirectory}/desktop-restored.png`, fullPage: true });
  await page.reload();
  await expect(page.getByText(/Seamworks reclaimed/i)).toBeVisible();
  expect(await bladeCount(page)).toBe(1);
  await page.getByRole('link', { name: /Explore the other realms/ }).click();
  await expect(page).toHaveURL(/\/world$/);
  for (const selector of ['app-header', 'app-onboarding-outlet', 'app-npc-dialogue', 'app-milestone-effect']) {
    await expect(page.locator(selector)).toHaveCount(1);
  }
  await page.locator('#hero').getByRole('link', { name: /Play the adventure/ }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.locator('app-header, app-onboarding-outlet, app-npc-dialogue, app-milestone-effect')).toHaveCount(0);
});

test('mobile opening fits the viewport and keeps places and satchel accessible', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openAdventure(page);
  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({ path: `${screenshotDirectory}/mobile-opening.png`, fullPage: true });
  for (const location of ['Cinder seam', 'The old forge', 'The crossing']) {
    await page.getByRole('button', { name: new RegExp(location) }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: /Satchel/ }).click();
  await expect(page.getByRole('link', { name: /Open full inventory/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
