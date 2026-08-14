/**
 * game-only-cutover.spec.ts — Character and Codex must not advertise the
 * deleted developer-tool product. Route redirects alone are not enough: a
 * live mastery row or Bestiary card still sends a player to /world after
 * telling them to open a tool.
 */
import { test, expect, Page } from '@playwright/test';

const CONSENT_KEY = 'xsantcastx_consent';
const EGGS_FOUND_KEY = 'easter-eggs-found';

async function openSettled(page: Page, url: string): Promise<void> {
  await page.addInitScript(
    (state) => {
      for (const [key, value] of Object.entries(state as Record<string, string>)) {
        window.localStorage.setItem(key, value);
      }
      window.sessionStorage.setItem('visit-counted', '1');
    },
    {
      [CONSENT_KEY]: 'denied',
      [EGGS_FOUND_KEY]: JSON.stringify(['forge-self-aware', 'codex-archivist']),
    },
  );
  await page.goto(url, { waitUntil: 'load' });
}

const TOOL_COPY = /Open a tool|Familiar Five|Tools Mastered|the tools you actually reach for|Search tools|Master every tool|Tools touched|Use a tool/i;

test.describe('game-only cutover', () => {
  test('character sheet shows loadout, not tool mastery', async ({ page }) => {
    await openSettled(page, '/character');
    await page.locator('.fk').waitFor();
    await expect(page.locator('#fk-path-title')).toHaveText('The Path');
    await expect(page.locator('.fk')).toContainText('Loadout');
    await expect(page.locator('.fk')).not.toContainText(TOOL_COPY);
    expect(await page.locator('a[href^="/tools"]').count()).toBe(0);
    expect(await page.locator('a[href*="tab=bestiary"]').count()).toBe(0);
  });

  test('codex has no Bestiary and no tool-page links', async ({ page }) => {
    await openSettled(page, '/codex');
    await page.locator('.cx-page').waitFor();
    await expect(page.locator('.cx-tab__label', { hasText: 'Bestiary' })).toHaveCount(0);
    await expect(page.locator('#cx-panel-bestiary')).toHaveCount(0);
    await expect(page.locator('.cx-page')).not.toContainText(TOOL_COPY);
    expect(await page.locator('a[href^="/tools"]').count()).toBe(0);
  });

  test('retired bestiary query falls back to a live Codex panel', async ({ page }) => {
    await openSettled(page, '/codex?tab=bestiary');
    await page.locator('.cx-page').waitFor();
    await expect(page.locator('#cx-panel-bestiary')).toHaveCount(0);
    await expect(page.locator('#cx-panel-achievements')).toBeVisible();
  });

  test('an unlocked legacy tool egg cannot render on the Codex wall', async ({ page }) => {
    await page.addInitScript(
      (state) => {
        for (const [key, value] of Object.entries(state as Record<string, string>)) {
          window.localStorage.setItem(key, value);
        }
        window.sessionStorage.setItem('visit-counted', '1');
      },
      {
        [CONSENT_KEY]: 'denied',
        [EGGS_FOUND_KEY]: JSON.stringify([
          'forge-self-aware',
          'codex-archivist',
          'json-inception',
          'b64-mirror',
          'regex-master',
          'shadow-lord',
        ]),
      },
    );
    await page.goto('/codex', { waitUntil: 'load' });
    await page.locator('.cx-page').waitFor();
    const body = await page.locator('.cx-page').innerText();
    expect(body).not.toMatch(/Formatted JSON nested 10\+ levels deep/i);
    expect(body).not.toMatch(/Encoded .+ in Base64/i);
    expect(body).not.toMatch(/Wrote a regex/i);
    expect(body).not.toMatch(/Created a box shadow/i);
    expect(body).not.toContain('Inception');
    expect(body).not.toContain('Mirror Mirror');
    expect(body).not.toContain('Regex Master');
    expect(body).not.toContain('Shadow Lord');
  });
});
