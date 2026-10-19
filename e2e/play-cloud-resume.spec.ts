/**
 * play-cloud-resume.spec.ts — a signed-in device resumes cloud save on load
 * (docs/handoff/cross-save.md).
 *
 * Real Google sign-in cannot run here, so this pins the half that broke: the
 * shell must start `CloudSaveService.init()` on every load of /play, with no
 * click. The game-only shell deleted the header chip that used to do it, and
 * from then on a signed-in phone or PC never re-attached to Firestore unless
 * the player opened Account & settings — cross-save silently stopped.
 *
 * The probe: a browser that remembers a binding (`cloud-save-uid`) but holds
 * no Firebase session. If resume runs, Firebase reports nobody signed in and
 * the service drops the stale binding. If nothing resumes, the key sits there
 * forever — which is exactly what every returning player's device did.
 */
import { expect, test } from '@playwright/test';
import { openPlay, seed } from './play-helpers';

test('a remembered binding is resumed on load without opening any panel', async ({ page }) => {
  await seed(page, { 'cloud-save-uid': 'e2e-no-firebase-session' });
  await openPlay(page);

  await expect.poll(
    () => page.evaluate(() => localStorage.getItem('cloud-save-uid')),
    { timeout: 20000, message: 'CloudSaveService.init() never ran: the binding was not checked on load' },
  ).toBeNull();
  // Nothing was opened to get here.
  await expect(page.locator('app-account-panel')).toHaveCount(0);
});

test('a signed-out visitor never downloads the auth SDK', async ({ page }) => {
  const authRequests: string[] = [];
  page.on('request', r => { if (/identitytoolkit|securetoken/.test(r.url())) authRequests.push(r.url()); });
  await seed(page);
  await openPlay(page);
  await page.waitForTimeout(5000);
  expect(authRequests).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('cloud-save-uid'))).toBeNull();
});
