/**
 * td-fresh-device-save.spec.ts — a browser that has never been here must not queue deleting the account's save.
 *
 * Owner, 2026-10-21: "connected my account to another device and in the character screen it said i was level 1?" A
 * virgin browser runs the realm-era wipe on boot; it used to go through GameStateGateway.remove(), which persists a
 * cloud delete in `godforge-pending-deletes` for the next sign-in to send — and the first sign-in deleted the
 * account's activity ledger (every point of Hunting XP). The fake-cloud proof is fresh-device-progress.spec.ts; this
 * pins the real boot: after a first visit to /play, for character #1 and for a second character, nothing is queued.
 */
import { expect, test } from '@playwright/test';

const PENDING = 'godforge-pending-deletes';
const ERA_KEYS = ['godforge-activity', 'godforge-stats', 'godforge-inventory'];

for (const character of ['c1', 'k2second']) {
  test(`a first visit queues no cloud delete of the save (${character})`, async ({ page }) => {
    test.setTimeout(90_000);
    // A truly virgin browser: cleared from a page that does not boot Angular (cannot-simulate-a-first-visit-by-clearing).
    await page.goto('/robots.txt');
    await page.evaluate(id => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('xsantcastx_consent', 'denied');
      if (id !== 'c1') localStorage.setItem('eclipse-active-character', id);
    }, character);
    await page.goto('/play?td=1&hour=12');
    const suffix = character === 'c1' ? '' : `@${character}`;
    // The era wipe ran (its stamp is written last).
    await expect.poll(() => page.evaluate(k => localStorage.getItem(k), `godforge-realm-era${suffix}`), { timeout: 30_000 }).not.toBeNull();
    const queued = await page.evaluate(k => {
      try { return JSON.parse(localStorage.getItem(k) ?? '[]') as string[]; } catch { return []; }
    }, `${PENDING}${suffix}`);
    for (const key of ERA_KEYS) expect(queued).not.toContain(key);
  });
}
