import { defineConfig, devices } from '@playwright/test';

/**
 * The preview port is read from PW_PORT so two worktrees can run the suite at
 * the same time. It used to be the bare literal 4173 with
 * `reuseExistingServer` on, which meant a concurrent session's already-running
 * preview server answered this run's requests — the suite then graded that
 * session's build instead of this one's, silently, and a green run proved
 * nothing about the branch under test. Default stays 4173 so CI and muscle
 * memory are unchanged; set PW_PORT=4183 (or anything free) in a worktree.
 */
const PORT = Number(process.env['PW_PORT'] ?? 4173);
const BASE = `http://localhost:${PORT}`;

/**
 * Every spec in this suite drives a browser that has never been here before,
 * and since v2.83.0 that is exactly the browser the first-run tutorial claims.
 * `OnboardingService.shouldOnboard()` is true when neither the progression
 * ledger nor the wallet exists, and the overlay it raises is
 * `role="dialog" aria-modal="true"` across the whole viewport — so every
 * `.click()` in every spec resolved its target, scrolled to it, and then spent
 * the full 30s timeout being told `<div class="ob">` intercepts pointer
 * events. Nothing about the assertion was wrong; the page simply had a modal
 * over it that did not exist when the spec was written.
 *
 * Seeding the tutorial's own "already seen" record here rather than in each
 * spec is deliberate: the specs seed storage through their own
 * `addInitScript`, sixteen of them do it, and not one remembered this key.
 * `storageState` is applied to the context before any of that runs, so a spec
 * written tomorrow inherits the fix without knowing the tutorial exists.
 *
 * A spec that wants to TEST the tutorial must remove this key itself
 * (`page.addInitScript(() => localStorage.removeItem('eclipse-onboarding'))`).
 */
const ONBOARDING_SEEN = {
  cookies: [],
  origins: [
    {
      origin: BASE,
      localStorage: [
        {
          name: 'eclipse-onboarding',
          value: JSON.stringify({ done: true, lastStep: 5, at: '2026-01-01T00:00:00.000Z' }),
        },
      ],
    },
  ],
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE,
    storageState: ONBOARDING_SEEN,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `node scripts/serve-preview.js dist/xsantcastx/browser ${PORT}`,
    url: `${BASE}/world`,
    reuseExistingServer: !process.env['CI'],
    timeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
